// src/lib/homePersonal.js
// Logic thuần phục vụ Màn Thành tích của tôi (Bảng thành tích cá nhân).
// HÀM THUẦN — không gọi React hay Supabase, test độc lập bằng Node (docs/RULES.md §4).

import { getPlayerRating, DEFAULT_RATING, isFemalePlayer } from '#lib/rating.js'
import { calculateMemberBadges, getMemberStreak } from '#lib/badges.js'
import {
  calculateSeasonLeaderboard,
  getMemberSeasonLedger,
  resolveSeason,
  seasonMatchesOf,
  calcSeasonMatchDeltaFinal,
  isChallengeMatch,
} from '#lib/season.js'
import { memberOf, courtTxt, timeTxt, isPresent } from '#lib/money.js'
import { formatScoreString } from '#lib/activity.js'

/**
 * Hàm băm xác định (Deterministic PRNG) để chọn biến thể giao diện ổn định trong phiên
 * @param {string} seedStr
 * @param {number} [range=2]
 * @returns {number} 0 đến range - 1
 */
export function getDeterministicRoll(seedStr, range = 2) {
  if (!seedStr || range <= 1) return 0
  let hash = 0
  for (let i = 0; i < seedStr.length; i++) {
    hash = ((hash << 5) - hash) + seedStr.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % range
}

/**
 * Tính số tuần hiện tại của mùa giải (1-indexed)
 * @param {string} [startDate] 'YYYY-MM-DD'
 * @param {Date|number|string} [targetDate]
 * @returns {number}
 */
export function calcSeasonWeek(startDate, targetDate = new Date()) {
  if (!startDate) return 1
  const startTs = typeof startDate === 'string' && startDate.includes('T')
    ? Date.parse(startDate)
    : Date.parse(`${startDate}T00:00:00Z`)
  const targetTs = new Date(targetDate).getTime()
  if (isNaN(startTs) || isNaN(targetTs) || targetTs < startTs) return 1
  const diffDays = Math.floor((targetTs - startTs) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.floor(diffDays / 7) + 1)
}

/**
 * Bảng xếp hạng Elo đầy đủ của toàn bộ thành viên đang hoạt động
 * @param {Object} db
 * @returns {Array<{ id: string, name: string, member: Object, elo: number, rank: number, gamesCount: number, confidence: string }>}
 */
function getMemberAvatarUrl(m) {
  if (!m) return ''
  return m.avatarUrl || m.avatar_url || m.avatar || m.profile?.avatar_url || m.profile?.avatarUrl || ''
}

export function getClubEloLeaderboard(db) {
  if (!db || !Array.isArray(db.members)) return []
  const activeMembers = db.members.filter((m) => m && m.active !== false)
  const list = activeMembers.map((m) => {
    const pr = getPlayerRating(db.playerRatings, m.id, m, db.levels)
    const elo = pr?.displayRating ?? pr?.rating ?? DEFAULT_RATING
    return {
      id: m.id,
      name: m.name || '',
      avatarUrl: getMemberAvatarUrl(m),
      member: m,
      elo,
      gamesCount: pr?.gamesCount || 0,
      confidence: pr?.confidence || 'low',
    }
  })

  list.sort((a, b) => b.elo - a.elo || b.gamesCount - a.gamesCount || a.name.localeCompare(b.name))
  list.forEach((item, index) => {
    item.rank = index + 1
  })
  return list
}

/**
 * Tính tổng Elo thay đổi của một thành viên trong 7 ngày gần nhất từ các trận đấu thật
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [days=7]
 * @returns {number}
 */
export function getRecentEloDelta(db, memberId, days = 7) {
  if (!db || !memberId || !Array.isArray(db.matches)) return 0
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let totalDelta = 0
  let matchFound = false

  db.matches.forEach((m) => {
    if (!m || !m.winnerTeam || m.ratingEnabled === false) return
    const matchTs = m.at || (m.ended_at ? new Date(m.ended_at).getTime() : 0)
    if (matchTs < cutoff) return

    const inA = (m.teamA || []).includes(memberId)
    const inB = (m.teamB || []).includes(memberId)
    if (!inA && !inB) return

    matchFound = true
    const delta = Number(m.eloDelta) || 0
    if (inA) {
      totalDelta += m.winnerTeam === 'A' ? delta : -delta
    } else {
      totalDelta += m.winnerTeam === 'B' ? delta : -delta
    }
  })

  // Nếu không có trận nào trong 7 ngày qua, đọc delta từ trận gần nhất
  if (!matchFound) {
    const lastMatch = [...db.matches]
      .filter((m) => m && m.winnerTeam && m.ratingEnabled !== false && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)))
      .sort((a, b) => (b.at || 0) - (a.at || 0))[0]
    if (lastMatch) {
      const inA = (lastMatch.teamA || []).includes(memberId)
      const delta = Number(lastMatch.eloDelta) || 0
      return inA ? (lastMatch.winnerTeam === 'A' ? delta : -delta) : (lastMatch.winnerTeam === 'B' ? delta : -delta)
    }
  }

  return totalDelta
}

/**
 * 01. Dữ liệu Thẻ Hero: Hạng của tôi, Elo, điểm mùa, tiến độ lên hạng
 * @param {Object} db
 * @param {string} memberId
 */
export function getMyHeroStats(db, memberId) {
  const empty = {
    rank: null,
    totalMembers: 0,
    elo: 0,
    eloDeltaWeek: 0,
    seasonMatches: 0,
    seasonWins: 0,
    seasonWinRate: 0,
    seasonPoints: 0,
    badgesCount: 0,
    targetRival: null,
    pointsToNextRank: 0,
    progressPct: 0,
    isLeader: false,
  }
  if (!db || !memberId) return empty

  const rankedList = getClubEloLeaderboard(db)
  const totalMembers = rankedList.length
  if (!totalMembers) return empty

  const myItem = rankedList.find((x) => x.id === memberId)
  if (!myItem) return empty

  const myRank = myItem.rank
  const myElo = myItem.elo

  // Elo delta tuần từ trận thật
  const eloDeltaWeek = getRecentEloDelta(db, myItem.id, 7)

  // Buổi gần nhất của CLB (tìm ngày diễn ra trận đấu gần nhất của CLB)
  let latestClubDayStart = 0
  const validMatches = (db.matches || []).filter((m) => m && m.winnerTeam && m.ratingEnabled !== false)
  validMatches.forEach((m) => {
    const ts = m.at || (m.ended_at ? new Date(m.ended_at).getTime() : 0)
    if (ts > 0) {
      const day = new Date(ts).setHours(0, 0, 0, 0)
      if (day > latestClubDayStart) latestClubDayStart = day
    }
  })

  // Điểm mùa từ calculateSeasonLeaderboard thật
  let seasonRank = myRank
  let seasonRankDelta = 0
  let seasonTotalMembers = totalMembers
  let seasonMatches = 0
  let seasonWins = 0
  let seasonWinRate = 0
  let seasonPoints = 0
  let seasonTargetRival = null
  let seasonPointsToNextRank = 0
  let seasonProgressPct = 100
  let isSeasonLeader = false
  let seasonLatestDelta = 0
  let seasonPctChange = 0
  let genderSeasonRank = 0
  let genderSeasonTotal = 0

  let sLeaderboard = []
  try {
    const seasonData = calculateSeasonLeaderboard(db)
    sLeaderboard = seasonData?.leaderboard || []
    if (sLeaderboard.length > 0) {
      seasonTotalMembers = sLeaderboard.length
      const mySeasonIndex = sLeaderboard.findIndex((r) => r.id === myItem.id)
      if (mySeasonIndex >= 0) {
        const mySeasonRow = sLeaderboard[mySeasonIndex]
        seasonRank = mySeasonRow.rank || (mySeasonIndex + 1)
        seasonMatches = mySeasonRow.matchesCount || 0
        seasonWins = mySeasonRow.winsCount || 0
        seasonWinRate = mySeasonRow.winRate || 0
        seasonPoints = mySeasonRow.totalSeasonPoints || 0
        isSeasonLeader = seasonRank === 1

        if (seasonRank > 1 && mySeasonIndex > 0) {
          const rivalRow = sLeaderboard[mySeasonIndex - 1]
          if (rivalRow) {
            seasonTargetRival = {
              id: rivalRow.id,
              name: rivalRow.name,
              rank: rivalRow.rank || mySeasonIndex,
              points: rivalRow.totalSeasonPoints || 0,
            }
            seasonPointsToNextRank = Math.max(1, (rivalRow.totalSeasonPoints || 0) - seasonPoints)
            // 40 điểm mùa làm mẫu số tham chiếu trực quan cho thanh tiến độ leo rank mùa
            seasonProgressPct = Math.min(95, Math.max(10, Math.round(100 - (seasonPointsToNextRank / 40) * 100)))
          }
        }

        const isFemale = isFemalePlayer(myItem.member || myItem)
        const genderRows = sLeaderboard.filter((r) => {
          const mObj = memberOf(db, r.id) || r.member
          return isFemale ? isFemalePlayer(mObj) : !isFemalePlayer(mObj)
        })
        genderSeasonTotal = genderRows.length
        const myGenderIdx = genderRows.findIndex((r) => r.id === myItem.id)
        genderSeasonRank = myGenderIdx >= 0 ? myGenderIdx + 1 : 0

        // Tính thứ hạng mùa giải buổi trước của CLB (kể cả không đi thì vẫn có biến động)
        if (latestClubDayStart > 0) {
          const prevSeasonScores = sLeaderboard.map((row) => {
            const logs = row.matchLogs || []
            const latestSessionLogs = logs.filter((l) => {
              const ts = l.at ? Number(l.at) : 0
              return ts > 0 && new Date(ts).setHours(0, 0, 0, 0) === latestClubDayStart
            })
            const latestDelta = latestSessionLogs.reduce((s, l) => s + (Number(l.effectiveChange) || 0), 0)
            const prevPoints = (row.totalSeasonPoints || 0) - latestDelta
            return {
              id: row.id,
              name: row.name,
              prevPoints,
            }
          })
          prevSeasonScores.sort((a, b) => b.prevPoints - a.prevPoints || a.name.localeCompare(b.name))
          const myPrevIndex = prevSeasonScores.findIndex((r) => r.id === myItem.id)
          if (myPrevIndex >= 0) {
            const prevRank = myPrevIndex + 1
            seasonRankDelta = prevRank - seasonRank
          }
        }
      }
    }
  } catch { /* thiếu log buổi trước: giữ seasonRankDelta = 0 */ }

  // Buổi người đó đi gần nhất (most recent attended session)
  try {
    const myRow = sLeaderboard.find((r) => r.id === myItem.id)
    const myLogs = (myRow?.matchLogs || []).filter((l) => l.at && Number.isFinite(Number(l.at)))
    if (myLogs.length > 0) {
      myLogs.sort((a, b) => Number(a.at) - Number(b.at))
      const myLatestAt = Number(myLogs[myLogs.length - 1].at)
      const myLatestDayStart = new Date(myLatestAt).setHours(0, 0, 0, 0)
      const myLatestSessionLogs = myLogs.filter(
        (l) => new Date(Number(l.at)).setHours(0, 0, 0, 0) === myLatestDayStart
      )
      seasonLatestDelta = myLatestSessionLogs.reduce(
        (sum, l) => sum + (Number(l.effectiveChange) || 0),
        0
      )
      const firstLogOfSession = myLatestSessionLogs[0]
      const pointsBeforeSession = (firstLogOfSession.pointsAfter ?? seasonPoints) - (firstLogOfSession.effectiveChange || 0)
      if (pointsBeforeSession > 0) {
        seasonPctChange = Math.round((seasonLatestDelta / pointsBeforeSession) * 100)
      } else if (seasonLatestDelta > 0) {
        seasonPctChange = 100
      } else if (seasonLatestDelta < 0) {
        seasonPctChange = -100
      } else {
        seasonPctChange = 0
      }
    } else {
      seasonLatestDelta = seasonPoints
      seasonPctChange = 0
    }
  } catch {
    seasonLatestDelta = seasonPoints
    seasonPctChange = 0
  }

  // Thứ hạng Elo buổi trước của CLB
  let eloRankDelta = 0
  if (rankedList.length > 0 && latestClubDayStart > 0) {
    const prevEloScores = rankedList.map((item) => {
      const memberMatches = validMatches.filter((m) => {
        const ts = m.at || (m.ended_at ? new Date(m.ended_at).getTime() : 0)
        const inDay = ts > 0 && new Date(ts).setHours(0, 0, 0, 0) === latestClubDayStart
        const inTeam = (m.teamA || []).includes(item.id) || (m.teamB || []).includes(item.id)
        return inDay && inTeam
      })
      let dayEloDelta = 0
      memberMatches.forEach((m) => {
        const inA = (m.teamA || []).includes(item.id)
        const delta = Number(m.eloDelta) || 0
        dayEloDelta += (inA ? m.winnerTeam === 'A' : m.winnerTeam === 'B') ? delta : -delta
      })
      return {
        id: item.id,
        name: item.name,
        prevElo: item.elo - dayEloDelta,
      }
    })
    prevEloScores.sort((a, b) => b.prevElo - a.prevElo || a.name.localeCompare(b.name))
    const myPrevEloIndex = prevEloScores.findIndex((r) => r.id === myItem.id)
    if (myPrevEloIndex >= 0) {
      const prevRank = myPrevEloIndex + 1
      eloRankDelta = prevRank - myRank
    }
  }

  const prevElo = myElo - eloDeltaWeek
  const eloPctChange = prevElo > 0 ? Math.round((eloDeltaWeek / prevElo) * 100) : 0

  // Số lượng huy hiệu đã mở
  let badgesCount = 0
  try {
    const badgesData = calculateMemberBadges(myItem.id, db)
    badgesCount = (badgesData?.unlocked || []).length
  } catch { /* không tính được huy hiệu: giữ badgesCount = 0 */ }

  // Đối thủ đứng ngay trên (Mục tiêu)
  let targetRival = null
  let pointsToNextRank = 0
  let progressPct = 100
  let isLeader = myRank === 1

  if (myRank > 1) {
    const rivalItem = rankedList[myRank - 2]
    if (rivalItem) {
      targetRival = {
        id: rivalItem.id,
        name: rivalItem.name,
        rank: rivalItem.rank,
        elo: rivalItem.elo,
      }
      pointsToNextRank = Math.max(1, rivalItem.elo - myElo)
      // ponytail: Mẫu số 100 Elo là khoảng tham chiếu trực quan cho thanh tiến độ leo hạng, clamp [10, 95]% để giữ độ mở tương tác.
      progressPct = Math.min(95, Math.max(10, Math.round(100 - (pointsToNextRank / 100) * 100)))
      isLeader = false
    }
  }

  return {
    rank: myRank,
    eloRank: myRank,
    totalMembers,
    elo: myElo,
    eloDeltaWeek,
    eloPctChange,
    eloRankDelta,
    seasonRank,
    seasonRankDelta,
    seasonTotalMembers,
    seasonMatches,
    seasonWins,
    seasonWinRate,
    seasonPoints,
    seasonLatestDelta,
    seasonPctChange,
    seasonTargetRival,
    seasonPointsToNextRank,
    seasonProgressPct,
    isSeasonLeader,
    badgesCount,
    targetRival,
    pointsToNextRank,
    progressPct,
    isLeader,
    genderSeasonRank,
    genderSeasonTotal,
  }
}

/**
 * 02. Phong độ 5 trận gần nhất và tiến độ chuỗi thắng
 * @param {Object} db
 * @param {string} memberId
 */
export function getPlayerForm5(db, memberId) {
  const result = {
    matches: [],
    winsCount: 0,
    streak: 0,
    nextBadgeStreak: 5,
    winsNeededForBadge: 3,
  }
  if (!db || !memberId || !Array.isArray(db.matches)) return result

  const targetMatches = seasonMatchesOf(db)
  const playerMatches = (targetMatches || [])
    .filter((m) => m && m.winnerTeam && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)))
    .sort((a, b) => (b.at || 0) - (a.at || 0))

  const last5Desc = playerMatches.slice(0, 5)
  const last5Asc = [...last5Desc].reverse()

  const matches = last5Asc.map((m, index) => {
    const inA = (m.teamA || []).includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
    return {
      id: m.id,
      won,
      label: won ? 'T' : 'B',
      isLatest: index === last5Asc.length - 1,
    }
  })

  const winsCount = matches.filter((x) => x.won).length

  let streak = 0
  try {
    const streakInfo = getMemberStreak(memberId, db)
    streak = streakInfo?.streak || 0
  } catch { /* không tính được chuỗi: giữ streak = 0 */ }

  const milestones = [3, 5, 7, 10, 15]
  const nextBadgeStreak = milestones.find((m) => m > streak) || (streak + 3)
  const winsNeededForBadge = Math.max(1, nextBadgeStreak - streak)

  return {
    matches,
    winsCount,
    streak,
    nextBadgeStreak,
    winsNeededForBadge,
  }
}

/**
 * 03. Phân tích kình địch & mục tiêu vượt hạng
 * @param {Object} db
 * @param {string} memberId
 * @param {string} [targetRivalId]
 */
export function getRivalAnalysis(db, memberId, targetRivalId = null) {
  if (!db || !memberId) return null
  const rankedList = getClubEloLeaderboard(db)
  const myIndex = rankedList.findIndex((x) => x.id === memberId)
  if (myIndex < 0) return null

  // Ngày vào seed để hai câu insight xoay vòng theo NGÀY, giống câu chào — nhưng đứng yên
  // trong suốt một ngày nên chữ không nhảy mỗi lần db sync.
  const todayKey = db.today || new Date().toISOString().slice(0, 10)

  const myItem = rankedList[myIndex]

  let rivalItem = null
  if (targetRivalId) {
    rivalItem = rankedList.find((x) => x.id === targetRivalId)
  }
  if (!rivalItem && myIndex > 0) {
    rivalItem = rankedList[myIndex - 1]
  }

  const chaserItem = myIndex < rankedList.length - 1 ? rankedList[myIndex + 1] : null

  let rival = null
  if (rivalItem) {
    let rivalStreak = 0
    try {
      rivalStreak = getMemberStreak(rivalItem.id, db)?.streak || 0
    } catch { /* không tính được chuỗi của đối thủ: giữ 0 */ }

    let myH2HWins = 0
    let rivalH2HWins = 0
    ;(db.matches || []).forEach((m) => {
      if (!m || !m.winnerTeam) return
      const inA = (m.teamA || []).includes(memberId)
      const inB = (m.teamB || []).includes(memberId)
      const rivalInA = (m.teamA || []).includes(rivalItem.id)
      const rivalInB = (m.teamB || []).includes(rivalItem.id)

      if ((inA && rivalInB) || (inB && rivalInA)) {
        if ((inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')) {
          myH2HWins++
        } else {
          rivalH2HWins++
        }
      }
    })

    const gapPoints = Math.max(0, rivalItem.elo - myItem.elo)
    // ponytail: neededWins = ceil(gap / 20) là ước lượng xấp xỉ trực quan dựa trên mức delta ~20 Elo/trận (chưa tính trường hợp đối thủ cùng thua làm co khoảng cách ~2x).
    const neededWins = Math.max(1, Math.min(5, Math.ceil(gapPoints / 20)))

    let myStreak = 0
    try {
      myStreak = getMemberStreak(memberId, db)?.streak || 0
    } catch { /* không tính được chuỗi của mình: giữ 0 */ }

    let rivalInsightKey = 'rivalInsightMedium'
    let rivalInsightParams = { name: rivalItem.name, gap: gapPoints, n: neededWins }

    if (gapPoints === 0) {
      rivalInsightKey = 'rivalInsightEven'
      rivalInsightParams = { name: rivalItem.name }
    } else if (gapPoints <= 20) {
      const v = getDeterministicRoll(`${memberId}_${rivalItem.id}_${todayKey}_rivalClose`, 2) === 0 ? '1' : '2'
      rivalInsightKey = `rivalInsightClose${v}`
      rivalInsightParams = { name: rivalItem.name, rank: rivalItem.rank }
    } else if (myStreak >= 3 && gapPoints <= 50) {
      rivalInsightKey = 'rivalInsightOnFire'
      rivalInsightParams = { name: rivalItem.name, streak: myStreak }
    } else if (myH2HWins >= 2 && myH2HWins > rivalH2HWins && gapPoints <= 60) {
      rivalInsightKey = 'rivalInsightH2H'
      rivalInsightParams = { name: rivalItem.name, myWins: myH2HWins, rivalWins: rivalH2HWins }
    } else if (neededWins <= 3) {
      rivalInsightKey = 'rivalInsightMedium'
      rivalInsightParams = { name: rivalItem.name, gap: gapPoints, n: neededWins }
    } else {
      rivalInsightKey = 'rivalInsightFar'
      rivalInsightParams = { name: rivalItem.name, gap: gapPoints }
    }

    rival = {
      id: rivalItem.id,
      name: rivalItem.name,
      avatarUrl: getMemberAvatarUrl(rivalItem.member) || rivalItem.avatarUrl || '',
      rank: rivalItem.rank,
      elo: rivalItem.elo,
      streak: rivalStreak,
      h2h: {
        myWins: myH2HWins,
        rivalWins: rivalH2HWins,
        text: `${myH2HWins}–${rivalH2HWins}`,
      },
      gapPoints,
      neededWins,
      tacticalInsight: {
        key: rivalInsightKey,
        params: rivalInsightParams,
      },
    }
  }

  let chaser = null
  if (chaserItem) {
    let chaserStreak = 0
    try {
      chaserStreak = getMemberStreak(chaserItem.id, db)?.streak || 0
    } catch { /* không tính được chuỗi của người bám đuổi: giữ 0 */ }

    const chaserGap = Math.max(0, myItem.elo - chaserItem.elo)
    let chaserWarningKey = 'chaserWarningNormal'
    let chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap }

    if (chaserGap <= 25 && chaserStreak >= 2) {
      const v = getDeterministicRoll(`${memberId}_${chaserItem.id}_${todayKey}_chaserThreat`, 2) === 0 ? '1' : '2'
      chaserWarningKey = `chaserWarningThreat${v}`
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap, streak: chaserStreak }
    } else if (chaserGap <= 25) {
      chaserWarningKey = 'chaserWarningClose'
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap }
    } else if (chaserStreak >= 2) {
      chaserWarningKey = 'chaserWarningHot'
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, streak: chaserStreak }
    } else if (chaserGap > 50) {
      const v = getDeterministicRoll(`${memberId}_${chaserItem.id}_${todayKey}_chaserSafe`, 2) === 0 ? '1' : '2'
      chaserWarningKey = `chaserWarningSafe${v}`
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap }
    }

    chaser = {
      id: chaserItem.id,
      name: chaserItem.name,
      avatarUrl: getMemberAvatarUrl(chaserItem.member) || chaserItem.avatarUrl || '',
      rank: chaserItem.rank,
      elo: chaserItem.elo,
      streak: chaserStreak,
      gapPoints: chaserGap,
      warningInsight: {
        key: chaserWarningKey,
        params: chaserWarningParams,
      },
    }
  }

  return {
    me: myItem,
    rival,
    chaser,
  }
}

/**
 * Xây dựng chuỗi Elo lịch sử thực tế neo vào rating hiện tại từ getPlayerRating và đi lùi ngược thời gian
 * (đảm bảo mốc cuối cùng khớp 100% với rating thật của người chơi)
 * @param {Object} db
 * @param {string} memberId
 * @returns {Array<{ at: number, rating: number }>}
 */
function buildMemberEloTrajectory(db, memberId, seasonMatches = null) {
  if (!db || !memberId) return []
  const member = memberOf(db, memberId) || (db.members || []).find((m) => m.id === memberId)
  const pr = getPlayerRating(db.playerRatings, memberId, member, db.levels)
  const currentRating = pr?.displayRating ?? pr?.rating ?? DEFAULT_RATING

  const sourceMatches = seasonMatches || db.matches || []
  const matches = sourceMatches
    .filter((m) => m && m.ratingEnabled !== false && m.winnerTeam && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)))
    .sort((a, b) => (a.at || 0) - (b.at || 0))

  if (matches.length === 0) {
    return [{ at: 0, rating: currentRating }]
  }

  // Đi lùi từ rating hiện tại:
  // Mốc cuối cùng là currentRating sau trận mới nhất.
  // Mỗi trận trước đó được tính bằng cách đảo ngược delta trận đấu.
  const trajectory = []
  let runningRating = currentRating

  const lastMatch = matches[matches.length - 1]
  trajectory.unshift({ at: lastMatch.at || 0, rating: runningRating })

  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    const inA = (m.teamA || []).includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')
    const delta = Math.abs(Number(m.eloDelta) || 0)

    runningRating += won ? -delta : delta

    const prevMatchAt = i > 0 ? (matches[i - 1].at || 0) : 0
    trajectory.unshift({ at: prevMatchAt, rating: runningRating })
  }

  return trajectory
}

/**
 * Xây dựng chuỗi điểm mùa lịch sử thực tế của một thành viên trong mùa giải hiện tại
 * @param {Object} db
 * @param {string} memberId
 * @param {Object} [activeSeason]
 * @returns {Array<{ at: number, points: number }>}
 */
function buildMemberSeasonPointsTrajectory(db, memberId, activeSeason = null) {
  if (!db || !memberId) return []
  const season = activeSeason || resolveSeason(db)
  const startTs = season?.startDate ? Date.parse(`${season.startDate}T00:00:00Z`) : 0
  const startPoints = season?.startPoints ?? 0

  let currentPoints = 0
  const events = []

  try {
    const seasonData = calculateSeasonLeaderboard(db, season)
    const memberRow = (seasonData?.leaderboard || []).find((r) => r.id === memberId)
    if (memberRow) {
      currentPoints = memberRow.totalSeasonPoints || 0
      const logs = memberRow.matchLogs || []
      logs.forEach((l) => {
        if (l.at) {
          events.push({ at: Number(l.at), points: l.pointsAfter })
        }
      })
      const preds = memberRow.predictionLogs || []
      preds.forEach((p) => {
        if (p.at) {
          events.push({ at: Number(p.at), points: p.pointsAfter })
        }
      })
    }
  } catch { /* thiếu phiếu dự đoán: quỹ đạo vẫn dựng từ các trận */ }

  events.sort((a, b) => a.at - b.at)

  if (events.length === 0) {
    return [
      { at: startTs || 0, points: currentPoints },
      { at: Date.now(), points: currentPoints },
    ]
  }

  const trajectory = []
  if (startTs > 0 && events[0].at > startTs) {
    trajectory.push({ at: startTs, points: startPoints })
  }
  events.forEach((ev) => {
    trajectory.push({ at: ev.at, points: ev.points })
  })

  trajectory.push({ at: Date.now(), points: currentPoints })
  return trajectory
}

export const RIVAL_COLORS = [
  'var(--violet-400)',
  'var(--amber-500)',
  'var(--rank-rookie)',
  'var(--rank-court-boss)',
  'var(--rank-solid)',
  'var(--status-incident-fg)',
]

/**
 * 04. Biểu đồ đường đua mùa / Elo (Season / Elo Race Time-Series) dựng từ lịch sử trận thật
 * @param {Object} db
 * @param {string} memberId
 * @param {string|Array<string>} [rivalId] ID hoặc danh sách ID đối thủ cần so sánh
 * @param {number} [weeksCount=6]
 * @param {'season'|'elo'} [metric='elo']
 */
export function calcSeasonRaceHistory(db, memberId, rivalId = null, weeksCount = 6, metric = 'elo') {
  if (!db || !memberId) return { empty: true }

  const activeSeason = resolveSeason(db)
  const seasonMatches = seasonMatchesOf(db, activeSeason)

  const isSeason = metric === 'season'

  // Elo & Season Trajectory của bản thân
  const myEloTrajectory = buildMemberEloTrajectory(db, memberId, seasonMatches)
  const currentMyElo = myEloTrajectory.length > 0 ? myEloTrajectory[myEloTrajectory.length - 1].rating : DEFAULT_RATING
  const startMyElo = myEloTrajectory.length > 0 ? myEloTrajectory[0].rating : DEFAULT_RATING

  const mySeasonTrajectory = buildMemberSeasonPointsTrajectory(db, memberId, activeSeason)
  const currentMySeasonPts = mySeasonTrajectory.length > 0 ? mySeasonTrajectory[mySeasonTrajectory.length - 1].points : 0
  const startMySeasonPts = mySeasonTrajectory.length > 0 ? mySeasonTrajectory[0].points : 0

  const myTrajectory = isSeason ? mySeasonTrajectory : myEloTrajectory

  if (myTrajectory.length <= 1 && myEloTrajectory.length <= 1) {
    return { empty: true }
  }

  // Chuẩn hoá danh sách rivalIds
  const rivalIds = Array.isArray(rivalId)
    ? rivalId.filter(Boolean)
    : (rivalId ? [rivalId] : [])

  // Thông tin đối thủ và quỹ đạo của từng đối thủ
  let seasonLeaderboard = null
  let eloLeaderboard = null

  const getRivalMeta = (rId) => {
    let name = ''
    let rank = null
    if (isSeason) {
      try {
        if (!seasonLeaderboard) {
          const seasonData = calculateSeasonLeaderboard(db, activeSeason)
          seasonLeaderboard = seasonData?.leaderboard || []
        }
        const row = seasonLeaderboard.find((x) => x.id === rId)
        if (row) {
          name = row.name
          rank = row.rank
        }
      } catch { /* không tra được BXH mùa: để trống, rơi sang BXH Elo bên dưới */ }
    }
    if (!name) {
      if (!eloLeaderboard) {
        eloLeaderboard = getClubEloLeaderboard(db)
      }
      const row = eloLeaderboard.find((x) => x.id === rId)
      if (row) {
        name = row.name
        rank = row.rank
      }
    }
    if (!name) {
      name = memberOf(db, rId)?.name || rId
    }
    return { name, rank }
  }

  const samplePoints = (traj, count, key = 'rating') => {
    if (!traj || !traj.length) return []
    if (traj.length === 1) return Array(count).fill(traj[0][key])
    const res = []
    for (let i = 0; i < count; i++) {
      const idx = Math.min(traj.length - 1, Math.round((i / (count - 1)) * (traj.length - 1)))
      res.push(traj[idx][key])
    }
    return res
  }

  const currentVal = isSeason ? currentMySeasonPts : currentMyElo
  const startValDirect = isSeason ? startMySeasonPts : startMyElo

  let myWeeklyValues = []
  let effectiveWeeksCount = weeksCount

  const startTs = activeSeason?.startDate ? Date.parse(`${activeSeason.startDate}T00:00:00Z`) : 0
  const key = isSeason ? 'points' : 'rating'

  if (startTs > 0 && Number.isFinite(startTs)) {
    const nowWeek = calcSeasonWeek(activeSeason.startDate)
    const span = Math.max(1, Math.min(weeksCount, nowWeek))
    effectiveWeeksCount = span
    const firstWeek = Math.max(1, nowWeek - span + 1)

    const getValueAtWeek = (traj, weekIdx) => {
      const weekCutoff = startTs + weekIdx * 7 * 86400000
      let latestVal = traj[0]?.[key] ?? 0
      for (const pt of traj) {
        if (pt.at && pt.at <= weekCutoff) {
          latestVal = pt[key]
        } else if (pt.at && pt.at > weekCutoff) {
          break
        }
      }
      return latestVal
    }

    myWeeklyValues = Array.from({ length: span }, (_, i) => {
      const weekIdx = firstWeek + i
      if (weekIdx >= nowWeek) {
        return currentVal
      }
      return getValueAtWeek(myTrajectory, weekIdx)
    })
  } else {
    myWeeklyValues = samplePoints(myTrajectory, weeksCount, key)
  }

  // Dựng dữ liệu cho từng rival
  const rivals = rivalIds.map((rId, idx) => {
    const meta = getRivalMeta(rId)
    const traj = isSeason
      ? buildMemberSeasonPointsTrajectory(db, rId, activeSeason)
      : buildMemberEloTrajectory(db, rId, seasonMatches)

    let weeklyValues = []
    if (startTs > 0 && Number.isFinite(startTs)) {
      const nowWeek = calcSeasonWeek(activeSeason.startDate)
      const span = effectiveWeeksCount
      const firstWeek = Math.max(1, nowWeek - span + 1)
      const currentRivalVal = traj.length > 0 ? traj[traj.length - 1][key] : 0

      const getValueAtWeek = (weekIdx) => {
        const weekCutoff = startTs + weekIdx * 7 * 86400000
        let latestVal = traj[0]?.[key] ?? 0
        for (const pt of traj) {
          if (pt.at && pt.at <= weekCutoff) {
            latestVal = pt[key]
          } else if (pt.at && pt.at > weekCutoff) {
            break
          }
        }
        return latestVal
      }

      weeklyValues = Array.from({ length: span }, (_, i) => {
        const weekIdx = firstWeek + i
        if (weekIdx >= nowWeek) {
          return currentRivalVal
        }
        return getValueAtWeek(weekIdx)
      })
    } else {
      weeklyValues = samplePoints(traj, weeksCount, key)
    }

    return {
      id: rId,
      name: meta.name,
      rank: meta.rank,
      color: RIVAL_COLORS[idx % RIVAL_COLORS.length],
      trajectory: traj,
      weeklyValues,
      hasTrajectory: traj.length > 1,
    }
  })

  // Toạ độ SVG (viewBox 0 0 660 96)
  const allValues = [...myWeeklyValues]
  rivals.forEach((r) => {
    if (r.hasTrajectory) {
      allValues.push(...r.weeklyValues)
    }
  })

  const minVal = Math.min(...allValues) - 10
  const maxVal = Math.max(...allValues) + 10
  const range = Math.max(20, maxVal - minVal)

  const startVal = myWeeklyValues[0] ?? startValDirect
  const deltaVal = currentVal - startVal

  // Tính toạ độ X linh hoạt theo số mốc thực tế của biểu đồ
  const xPointsCount = myWeeklyValues.length
  const xCoords = Array.from({ length: xPointsCount }, (_, i) => Math.round(20 + (i / Math.max(1, xPointsCount - 1)) * 620))
  const toY = (val) => {
    const normalized = (val - minVal) / range
    return Math.round(84 - normalized * 64)
  }

  const svgPointsMy = myWeeklyValues.map((val, idx) => `${xCoords[idx]},${toY(val)}`).join(' ')

  // Gán svgPoints cho từng rival
  rivals.forEach((r) => {
    r.svgPoints = r.weeklyValues.map((val, idx) => `${xCoords[idx]},${toY(val)}`).join(' ')
  })

  // Rival đầu tiên (để tương thích ngược)
  const firstRival = rivals[0] || null
  const hasRivalTrajectory = firstRival?.hasTrajectory || false
  const svgPointsRival = firstRival?.svgPoints || ''
  const rivalName = firstRival?.name || ''
  const rivalRank = firstRival?.rank || 1

  const startRivalVal = firstRival?.weeklyValues?.[0] ?? (firstRival?.trajectory?.[0]?.[key] ?? null)
  const currentRivalVal = firstRival?.weeklyValues?.[firstRival.weeklyValues.length - 1] ?? (firstRival?.trajectory?.[firstRival.trajectory.length - 1]?.[key] ?? null)
  const initialGap = (startRivalVal != null) ? Math.abs(startRivalVal - startVal) : null
  const currentGap = (currentRivalVal != null) ? Math.abs(currentRivalVal - currentVal) : null

  let gapNoteKey = null
  let gapFrom = null
  let gapTo = null
  let gapWeeks = null
  if (hasRivalTrajectory && initialGap != null && currentGap != null && initialGap !== currentGap) {
    gapFrom = Math.round(initialGap)
    gapTo = Math.round(currentGap)
    gapWeeks = Math.max(1, Math.round(effectiveWeeksCount / 2))
    gapNoteKey = currentGap < initialGap ? 'gapShrinkNote' : 'gapWidenNote'
  }

  const effectiveStartElo = isSeason ? startMyElo : startVal
  const effectiveDeltaElo = isSeason ? (currentMyElo - startMyElo) : deltaVal

  return {
    empty: false,
    metric,
    unitKey: isSeason ? 'seasonPointsShortUnit' : 'eloNormal',
    weeks: effectiveWeeksCount,
    startVal,
    currentVal,
    deltaVal,
    startElo: effectiveStartElo,
    currentElo: currentMyElo,
    deltaElo: effectiveDeltaElo,
    rivalId: rivalIds[0] || null,
    rivalIds,
    rivals,
    rivalName,
    rivalRank,
    svgPointsMy,
    svgPointsRival,
    hasRivalTrajectory,
    latestMyX: xCoords[xCoords.length - 1],
    latestMyY: toY(currentVal),
    initialGap,
    currentGap,
    gapNoteKey,
    gapFrom,
    gapTo,
    gapWeeks,
  }
}

/**
 * 05. Danh sách trận gần nhất của thành viên với dữ liệu điểm thật
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [limit=3]
 */
export function getRecentPlayerMatches(db, memberId, limit = 3) {
  if (!db || !memberId || !Array.isArray(db.matches)) return []

  const season = resolveSeason(db)

  // Đọc trước ledger để tra cứu điểm mùa chuẩn (có streak/upset bonus nếu có)
  const eventByMatchId = new Map()
  const eventByTimestamp = new Map()
  try {
    const ledger = getMemberSeasonLedger(memberId, db, season)
    if (ledger?.events && ledger.events.length > 0) {
      ledger.events.forEach((ev) => {
        if (ev.id) eventByMatchId.set(ev.id, ev)
        if (ev.at) eventByTimestamp.set(ev.at, ev)
      })
    }
  } catch { /* không dựng được sổ điểm mùa: rơi sang nhánh duyệt db.matches */ }

  // Chuẩn bị trajectory điểm mùa của tất cả active members để tính biến động thứ hạng mùa (season rankImpact)
  const allSeasonTrajectories = new Map()
  const allEloTrajectories = new Map()
  const activeMembers = (db.members || []).filter((mem) => mem && mem.active !== false)

  let seasonData = null
  try {
    seasonData = calculateSeasonLeaderboard(db, season)
  } catch { /* không tính được BXH mùa: giữ seasonData = null */ }

  const startTs = season?.startDate ? Date.parse(`${season.startDate}T00:00:00Z`) : 0
  const startPoints = season?.startPoints ?? 0

  if (seasonData?.leaderboard) {
    const rowByMemId = new Map(seasonData.leaderboard.map((r) => [r.id, r]))
    activeMembers.forEach((mem) => {
      const row = rowByMemId.get(mem.id)
      if (row) {
        let currentPoints = row.totalSeasonPoints || 0
        const events = []
        ;(row.matchLogs || []).forEach((l) => {
          if (l.at) events.push({ at: Number(l.at), points: l.pointsAfter })
        })
        ;(row.predictionLogs || []).forEach((p) => {
          if (p.at) events.push({ at: Number(p.at), points: p.pointsAfter })
        })
        events.sort((a, b) => a.at - b.at)

        const traj = []
        if (startTs > 0 && events.length > 0 && events[0].at > startTs) {
          traj.push({ at: startTs, points: startPoints })
        }
        events.forEach((ev) => traj.push({ at: ev.at, points: ev.points }))
        traj.push({ at: Date.now(), points: currentPoints })
        allSeasonTrajectories.set(mem.id, traj)
      } else {
        allSeasonTrajectories.set(mem.id, [{ at: 0, points: 0 }, { at: Date.now(), points: 0 }])
      }
    })
  }

  // Dự phòng trajectory Elo
  activeMembers.forEach((mem) => {
    allEloTrajectories.set(mem.id, buildMemberEloTrajectory(db, mem.id))
  })

  const getMemberSeasonPointsAt = (mid, ts) => {
    const traj = allSeasonTrajectories.get(mid)
    if (!traj || !traj.length) return 0
    let points = traj[0].points
    for (const pt of traj) {
      if (pt.at && pt.at <= ts) {
        points = pt.points
      } else if (pt.at && pt.at > ts) {
        break
      }
    }
    return points
  }

  const getMemberRatingAt = (mid, ts) => {
    const traj = allEloTrajectories.get(mid)
    if (!traj || !traj.length) return DEFAULT_RATING
    let rating = traj[0].rating
    for (const pt of traj) {
      if (pt.at && pt.at <= ts) {
        rating = pt.rating
      } else if (pt.at && pt.at > ts) {
        break
      }
    }
    return rating
  }

  // Lấy các trận gần nhất của người chơi từ db.matches
  const playerMatches = db.matches
    .filter((m) => m && m.winnerTeam && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, limit)

  return playerMatches.map((m, idx) => {
    const inA = (m.teamA || []).includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')

    const myTeamIds = inA ? (m.teamA || []) : (m.teamB || [])
    const oppTeamIds = inA ? (m.teamB || []) : (m.teamA || [])

    const myTeamPlayers = myTeamIds.map((id) => ({
      id,
      name: memberOf(db, id)?.name || id,
      isMe: id === memberId,
    }))
    const oppTeamPlayers = oppTeamIds.map((id) => ({
      id,
      name: memberOf(db, id)?.name || id,
      isMe: false,
    }))

    const myTeamNames = myTeamPlayers.map((p) => p.name).join(' · ')
    const oppTeamNames = oppTeamPlayers.map((p) => p.name).join(' · ')

    // Trích xuất điểm số phân biệt bên user (myScore) và bên đối thủ (oppScore)
    let scoreSets = []
    if (Array.isArray(m.sets) && m.sets.length > 0) {
      scoreSets = m.sets
        .map((s) => {
          if (Array.isArray(s)) {
            const myScore = inA ? s[0] : s[1]
            const oppScore = inA ? s[1] : s[0]
            return { myScore, oppScore }
          }
          return null
        })
        .filter(Boolean)
    }

    if (scoreSets.length === 0) {
      const sA = m.scoreA ?? m.score_a
      const sB = m.scoreB ?? m.score_b
      if (sA != null && sB != null) {
        scoreSets = [
          {
            myScore: inA ? sA : sB,
            oppScore: inA ? sB : sA,
          },
        ]
      } else if (m.scoreText || m.score) {
        const rawStr = String(m.scoreText || m.score).trim()
        const parts = rawStr.split('-').map((x) => x.trim())
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          scoreSets = [
            {
              myScore: inA ? parts[0] : parts[1],
              oppScore: inA ? parts[1] : parts[0],
            },
          ]
        }
      }
    }

    const score =
      scoreSets.length > 0
        ? scoreSets.map((s) => `${s.myScore}-${s.oppScore}`).join(', ')
        : formatScoreString(m) || '—'

    const eloDelta = Number(m.eloDelta) || 0
    const eloChange = eloDelta > 0 ? (won ? `+${eloDelta}` : `−${eloDelta}`) : '0'

    let dateStr = '—'
    let dateKey = null
    let timeStr = ''
    if (m.at) {
      const matchDate = new Date(m.at)
      if (!isNaN(matchDate.getTime())) {
        const hh = String(matchDate.getHours()).padStart(2, '0')
        const mm = String(matchDate.getMinutes()).padStart(2, '0')
        timeStr = `${hh}:${mm}`
      }

      const now = new Date()
      const isToday = matchDate.getFullYear() === now.getFullYear() &&
                      matchDate.getMonth() === now.getMonth() &&
                      matchDate.getDate() === now.getDate()
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const isYesterday = matchDate.getFullYear() === yesterday.getFullYear() &&
                          matchDate.getMonth() === yesterday.getMonth() &&
                          matchDate.getDate() === yesterday.getDate()

      if (isToday) {
        dateKey = 'today'
      } else if (isYesterday) {
        dateKey = 'yesterday'
      }

      const d = String(matchDate.getDate()).padStart(2, '0')
      const mo = String(matchDate.getMonth() + 1).padStart(2, '0')
      dateStr = `${d}/${mo}`
    }

    // Tính biến động thứ hạng mùa giải (seasonRankImpact), fallback về Elo nếu chưa có mùa
    let rankImpact = null
    const matchTs = m.at || 0
    if (matchTs > 0 && activeMembers.length > 0) {
      if (allSeasonTrajectories.size > 0) {
        const myPointsBefore = getMemberSeasonPointsAt(memberId, matchTs - 1)
        const myPointsAfter = getMemberSeasonPointsAt(memberId, matchTs)

        const rankBefore = 1 + activeMembers.filter((other) => other.id !== memberId && getMemberSeasonPointsAt(other.id, matchTs - 1) > myPointsBefore).length
        const rankAfter = 1 + activeMembers.filter((other) => other.id !== memberId && getMemberSeasonPointsAt(other.id, matchTs) > myPointsAfter).length

        if (rankAfter < rankBefore) {
          rankImpact = { type: 'up', from: rankBefore, to: rankAfter }
        } else if (rankAfter > rankBefore) {
          rankImpact = { type: 'down', from: rankBefore, to: rankAfter }
        } else {
          rankImpact = { type: 'same', from: rankBefore, to: rankAfter }
        }
      } else {
        const myRatingBefore = getMemberRatingAt(memberId, matchTs - 1)
        const myRatingAfter = getMemberRatingAt(memberId, matchTs)

        const rankBefore = 1 + activeMembers.filter((other) => other.id !== memberId && getMemberRatingAt(other.id, matchTs - 1) > myRatingBefore).length
        const rankAfter = 1 + activeMembers.filter((other) => other.id !== memberId && getMemberRatingAt(other.id, matchTs) > myRatingAfter).length

        if (rankAfter < rankBefore) {
          rankImpact = { type: 'up', from: rankBefore, to: rankAfter }
        } else if (rankAfter > rankBefore) {
          rankImpact = { type: 'down', from: rankBefore, to: rankAfter }
        } else {
          rankImpact = { type: 'same', from: rankBefore, to: rankAfter }
        }
      }
    }

    // Tra cứu điểm mùa:
    // 1. Ưu tiên từ ledger event
    const matchedEvent = eventByMatchId.get(m.id) || eventByTimestamp.get(m.at)
    let seasonChange = '—'

    if (matchedEvent) {
      seasonChange = matchedEvent.pts || (matchedEvent.numPts > 0 ? `+${matchedEvent.numPts}` : `${matchedEvent.numPts}`)
    } else if (m.ratingEnabled === false) {
      // Trận giao lưu không tính điểm mùa
      seasonChange = '—'
    } else {
      // 2. Tính trực tiếp qua công thức dải Elo của mùa giải
      let myElo = inA ? m.initialRatingA : m.initialRatingB
      let oppElo = inA ? m.initialRatingB : m.initialRatingA
      if (myElo == null || oppElo == null) {
        myElo = DEFAULT_RATING
        oppElo = DEFAULT_RATING
      }
      const { delta } = calcSeasonMatchDeltaFinal(myElo, oppElo, won, {
        isChallenge: isChallengeMatch(m),
        scaleConfig: season?.deltaScale,
        multiplier: season?.challengeMultiplier,
      })
      seasonChange = delta > 0 ? `+${delta}` : `${delta}`
    }

    return {
      id: m.id || `match-${idx}`,
      at: m.at || (m.ended_at ? new Date(m.ended_at).getTime() : 0),
      won,
      myTeamNames,
      oppTeamNames,
      myTeamPlayers,
      oppTeamPlayers,
      score,
      scoreSets,
      eloDelta,
      eloChange,
      seasonChange,
      dateStr,
      dateKey,
      timeStr,
      rankImpact,
      isChallenge: isChallengeMatch(m),
    }
  })
}

/**
 * Trả về khung giờ { from, to } của buổi tập dựa vào các sân hoặc chuỗi time
 * @param {Object} s
 */
export function getSessionTimeRange(s) {
  if (!s) return { from: '00:00', to: '23:59' }
  const courts = s.courts || []
  let from = ''
  let to = ''
  for (const c of courts) {
    if (c.from && (!from || c.from < from)) from = c.from
    if (c.to && (!to || c.to > to)) to = c.to
  }
  if ((!from || !to) && typeof s.time === 'string') {
    const parts = s.time.split(/[-→]/).map((p) => p.trim())
    if (parts[0] && /^\d{2}:\d{2}$/.test(parts[0])) from = from || parts[0]
    if (parts[1] && /^\d{2}:\d{2}$/.test(parts[1])) to = to || parts[1]
  }
  return {
    from: from || '00:00',
    to: to || '23:59',
  }
}

/**
 * 07. Thông tin buổi tập sắp tới gần nhất (hoặc đang diễn ra)
 * @param {Object} db
 * @param {string} memberId
 * @param {Date|string} [nowTime=new Date()]
 */
export function getNextUpcomingSession(db, memberId, nowTime = new Date()) {
  if (!db || !Array.isArray(db.sessions) || db.sessions.length === 0) return null
  const now = nowTime instanceof Date ? nowTime : new Date(nowTime)
  const currentHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  const todayStr = db.today || (
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
  )

  // Lọc các buổi hợp lệ (kể cả đã chốt, đang mở hay chưa mở; bỏ qua buổi đã huỷ)
  const validSessions = db.sessions.filter((s) => s && s.status !== 'cancelled')
  if (!validSessions.length) return null

  // 1. Các buổi chưa kết thúc:
  // - Hoặc ở ngày tương lai (s.date > todayStr)
  // - Hoặc ở ngày hôm nay (s.date === todayStr) và giờ kết thúc chưa qua (currentHHMM <= to)
  //   -> Trong khoảng thời gian buổi tập (từ 'from' đến 'to'), buổi vẫn được hiển thị là buổi hiện tại.
  //      Chỉ khi đã qua giờ kết thúc ('to') thì mới chuyển sang buổi tiếp theo.
  const activeAndFuture = validSessions
    .filter((s) => {
      if (s.date > todayStr) return true
      if (s.date === todayStr) {
        const { to } = getSessionTimeRange(s)
        return currentHHMM <= to
      }
      return false
    })
    .sort((a, b) => {
      const cmp = a.date.localeCompare(b.date)
      if (cmp !== 0) return cmp
      const rangeA = getSessionTimeRange(a)
      const rangeB = getSessionTimeRange(b)
      return rangeA.from.localeCompare(rangeB.from) || rangeA.to.localeCompare(rangeB.to)
    })

  // 2. Nếu tất cả các buổi đều đã kết thúc (trong ngày hôm nay đã qua giờ hoặc toàn bộ buổi ở quá khứ),
  // lấy buổi vừa kết thúc gần nhất để thẻ không bị trống.
  const endedSessions = validSessions
    .filter((s) => {
      if (s.date < todayStr) return true
      if (s.date === todayStr) {
        const { to } = getSessionTimeRange(s)
        return currentHHMM > to
      }
      return false
    })
    .sort((a, b) => {
      const cmp = b.date.localeCompare(a.date)
      if (cmp !== 0) return cmp
      const rangeA = getSessionTimeRange(a)
      const rangeB = getSessionTimeRange(b)
      return rangeB.to.localeCompare(rangeA.to) || rangeB.from.localeCompare(rangeA.from)
    })

  const s = activeAndFuture[0] || endedSessions[0] || null
  if (!s) return null

  const att = db.attendance?.[s.id] || {}
  const isRegistered = Boolean(att[memberId]) || (s.attendees || []).some((a) => (typeof a === 'string' ? a === memberId : a?.memberId === memberId))

  const courtsCount = (s.courts || []).length || 1
  const goingCount = Object.keys(att).length || 0
  const expectedMatches = Math.max(1, Math.round(goingCount * 0.35))

  let venue = courtTxt(db, s) || s.courtTxt || s.venue || ''
  if (venue.includes(' · ')) {
    const parts = venue.split(' · ')
    // Nếu có dạng "X sân · Tên Sân" -> đảo lại thành "Tên Sân · X sân" chuẩn mockup D1 DESKTOP 1440
    if (parts.length === 2 && /^\d+/.test(parts[0])) {
      venue = `${parts[1]} · ${parts[0]}`
    }
  }
  const time = timeTxt(s) || s.time || ''
  const isToday = s.date === todayStr
  const { from: sFrom, to: sTo } = getSessionTimeRange(s)
  const isHappeningNow = isToday && sFrom <= currentHHMM && currentHHMM <= sTo

  let dateFormatted = ''
  if (s.date) {
    const parts = s.date.split('-')
    if (parts.length === 3) {
      dateFormatted = `${parts[2]}/${parts[1]}`
    }
  }

  // Lọc các kèo của buổi tập này hoặc các kèo đang mở sắp tới
  const allChallenges = db.challenges || []
  const sessionChallenges = allChallenges.filter(
    (c) =>
      c &&
      (c.sessionId === s.id || (!c.sessionId && (c.status === 'pending' || c.status === 'accepted'))) &&
      c.status !== 'cancelled' &&
      c.status !== 'completed' &&
      c.status !== 'played',
  )

  // Sắp xếp: Kèo của bản thân lên đầu, tiếp theo là kèo pending, rồi accepted
  sessionChallenges.sort((a, b) => {
    const aIsMine = (a.teamA || []).includes(memberId) || (a.teamB || []).includes(memberId)
    const bIsMine = (b.teamA || []).includes(memberId) || (b.teamB || []).includes(memberId)
    if (aIsMine && !bIsMine) return -1
    if (!aIsMine && bIsMine) return 1
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })

  const challengesList = sessionChallenges.slice(0, 3).map((c) => {
    const isMine = (c.teamA || []).includes(memberId) || (c.teamB || []).includes(memberId)
    const teamANames = (c.teamA || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
    const teamBNames = (c.teamB || []).length > 0
      ? (c.teamB || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
      : ''
    return {
      id: c.id,
      code: c.code || '',
      isMine,
      status: c.status,
      teamANames,
      teamBNames,
    }
  })

  return {
    id: s.id,
    date: s.date,
    dateFormatted,
    isToday,
    isHappeningNow,
    time,
    venue,
    courtsCount,
    goingCount,
    isRegistered,
    expectedMatches,
    challenges: challengesList,
    status: s.status,
  }
}

/**
 * 08. Danh sách sự kiện nóng CLB hôm nay từ dữ liệu thật
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [limit=4]
 */
export function getClubTodayHighlights(db, memberId, limit = 4) {
  const events = []
  if (!db) return events

  const matches = (db.matches || []).filter((m) => m && m.winnerTeam)
  const sortedMatches = [...matches].sort((a, b) => (b.at || 0) - (a.at || 0))

  // 1. Phân tích các trận đấu gần nhất (hạ chuỗi, chuỗi thắng, kết quả trận)
  if (sortedMatches.length > 0) {
    const lastMatch = sortedMatches[0]
    const inA = lastMatch.winnerTeam === 'A'
    const winIds = inA ? (lastMatch.teamA || []) : (lastMatch.teamB || [])
    const loseIds = inA ? (lastMatch.teamB || []) : (lastMatch.teamA || [])
    const winnerNames = winIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
    const loserNames = loseIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
    const score = formatScoreString(lastMatch) || '—'
    const timeAgo = lastMatch.at ? new Date(lastMatch.at).toTimeString().slice(0, 5) : ''

    // 1a. Hạ chuỗi: Đối thủ ở phe thua có ai vừa bị cắt chuỗi thắng >= 3 không
    let brokenStreakInfo = null
    for (const lId of loseIds) {
      const prevMatches = sortedMatches.filter(
        (m) => (m.at || 0) < (lastMatch.at || 0) && ((m.teamA || []).includes(lId) || (m.teamB || []).includes(lId))
      )
      let st = 0
      for (const pm of prevMatches) {
        const pmWon = (pm.winnerTeam === 'A' && (pm.teamA || []).includes(lId)) ||
                      (pm.winnerTeam === 'B' && (pm.teamB || []).includes(lId))
        if (pmWon) st++
        else break
      }
      if (st >= 3) {
        const loserSingleName = memberOf(db, lId)?.name || lId
        brokenStreakInfo = { loserName: loserSingleName, streak: st }
        break
      }
    }

    if (brokenStreakInfo) {
      events.push({
        id: `streak-broken-${lastMatch.id}`,
        dotColor: 'var(--status-incident-fg)',
        type: 'streak_broken',
        winnerNames,
        loserNames: brokenStreakInfo.loserName,
        streak: brokenStreakInfo.streak,
        timeAgo,
      })
    }

    // 1b. Cán mốc chuỗi thắng: Phe thắng có ai chạm mốc chuỗi thắng >= 3 không
    let winStreakInfo = null
    for (const wId of winIds) {
      const allPlayerMatches = sortedMatches.filter(
        (m) => (m.at || 0) <= (lastMatch.at || 0) && ((m.teamA || []).includes(wId) || (m.teamB || []).includes(wId))
      )
      let st = 0
      for (const pm of allPlayerMatches) {
        const pmWon = (pm.winnerTeam === 'A' && (pm.teamA || []).includes(wId)) ||
                      (pm.winnerTeam === 'B' && (pm.teamB || []).includes(wId))
        if (pmWon) st++
        else break
      }
      if (st >= 3) {
        const winnerSingleName = memberOf(db, wId)?.name || wId
        winStreakInfo = { winnerName: winnerSingleName, streak: st }
        break
      }
    }

    if (winStreakInfo) {
      events.push({
        id: `win-streak-${lastMatch.id}`,
        dotColor: 'var(--status-delayed-fg)',
        type: 'win_streak_milestone',
        winnerNames: winStreakInfo.winnerName,
        streak: winStreakInfo.streak,
        timeAgo,
      })
    }

    // 1c. Trận đấu vừa kết thúc
    events.push({
      id: `match-${lastMatch.id}`,
      dotColor: 'var(--status-delivered-fg)',
      type: 'match_finished',
      winnerNames,
      loserNames,
      score,
      timeAgo,
    })
  }

  // 2. Kèo thách đấu đang chờ hoặc đã chốt
  const challenges = db.challenges || []
  const acceptedChallenge = challenges.find((c) => c.status === 'accepted')
  if (acceptedChallenge) {
    const teamANames = (acceptedChallenge.teamA || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
    const teamBNames = (acceptedChallenge.teamB || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
    events.push({
      id: `chal-acc-${acceptedChallenge.id}`,
      dotColor: 'var(--status-delivered-fg)',
      type: 'challenge_accepted',
      teamANames,
      teamBNames,
      timeAgo: acceptedChallenge.createdAt ? new Date(acceptedChallenge.createdAt).toTimeString().slice(0, 5) : '',
    })
  }

  const pendingChallenge = challenges.find((c) => c.status === 'pending')
  if (pendingChallenge) {
    const challengers = (pendingChallenge.teamA || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
    events.push({
      id: `chal-pend-${pendingChallenge.id}`,
      dotColor: 'var(--text-link)',
      type: 'challenge_pending',
      challengers,
      timeAgo: pendingChallenge.createdAt ? new Date(pendingChallenge.createdAt).toTimeString().slice(0, 5) : '',
    })
  }

  // 3. Top 1 Bảng Mùa
  try {
    const seasonData = calculateSeasonLeaderboard(db)
    const topLeader = seasonData?.leaderboard?.[0]
    if (topLeader && (topLeader.matchesCount > 0 || topLeader.totalSeasonPoints > 0)) {
      events.push({
        id: `top1-season-${topLeader.id}`,
        dotColor: 'var(--status-delayed-fg)',
        type: 'rank_top1',
        name: topLeader.name,
        points: topLeader.totalSeasonPoints || 0,
        timeAgo: '',
      })
    }
  } catch { /* không lấy được top 1 mùa: bỏ tin này khỏi feed */ }

  // 4. Trận thứ 2 nếu còn chỗ
  if (sortedMatches.length > 1 && events.length < limit) {
    const secondMatch = sortedMatches[1]
    const inA = secondMatch.winnerTeam === 'A'
    const winIds = inA ? (secondMatch.teamA || []) : (secondMatch.teamB || [])
    const loseIds = inA ? (secondMatch.teamB || []) : (secondMatch.teamA || [])
    const winnerNames = winIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
    const loserNames = loseIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
    const score = formatScoreString(secondMatch) || '—'
    events.push({
      id: `match-2-${secondMatch.id}`,
      dotColor: 'var(--status-delivered-fg)',
      type: 'match_finished',
      winnerNames,
      loserNames,
      score,
      timeAgo: secondMatch.at ? new Date(secondMatch.at).toTimeString().slice(0, 5) : '',
    })
  }

  return events.slice(0, limit)
}

/**
 * 09. Danh sách 5 thành viên xung quanh thứ hạng của người dùng trên Desktop
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [windowSize=5]
 * @param {'elo'|'season'} [mode='elo']
 */
export function getSurroundingStandings(db, memberId, windowSize = 5, mode = 'elo') {
  if (!db || !memberId) return []

  if (mode === 'season') {
    try {
      const seasonData = calculateSeasonLeaderboard(db)
      const list = (seasonData?.leaderboard || []).map((r) => {
        let streakWins = 0
        try {
          const st = getMemberStreak(r.id, db)?.streak || 0
          if (st >= 3) streakWins = st
        } catch { /* không tính được chuỗi: coi như không có chuỗi */ }
        return {
          id: r.id,
          name: r.name,
          rank: r.rank,
          points: r.totalSeasonPoints,
          elo: r.member ? getPlayerRating(db.playerRatings, r.id, r.member, db.levels)?.displayRating ?? DEFAULT_RATING : DEFAULT_RATING,
          isQualified: r.isQualified,
          streakWins,
        }
      })

      if (list.length > 0) {
        const myIndex = list.findIndex((x) => x.id === memberId)
        if (myIndex < 0) return list.slice(0, windowSize)

        let start = Math.max(0, myIndex - Math.floor(windowSize / 2))
        let end = start + windowSize
        if (end > list.length) {
          end = list.length
          start = Math.max(0, end - windowSize)
        }

        const windowRows = list.slice(start, end)
        return windowRows.map((item) => {
          const isMe = item.id === memberId
          const isTarget = myIndex > 0 && list[myIndex - 1]?.id === item.id
          return {
            ...item,
            isMe,
            isTarget,
          }
        })
      }
    } catch { /* không dựng được BXH mùa: giữ nguyên danh sách Elo đã tính */ }
  }

  const list = getClubEloLeaderboard(db)
  if (!list.length) return []

  const myIndex = list.findIndex((x) => x.id === memberId)
  if (myIndex < 0) return list.slice(0, windowSize)

  let start = Math.max(0, myIndex - Math.floor(windowSize / 2))
  let end = start + windowSize
  if (end > list.length) {
    end = list.length
    start = Math.max(0, end - windowSize)
  }

  const windowRows = list.slice(start, end)

  return windowRows.map((item) => {
    const isMe = item.id === memberId
    const isTarget = rivalGoalCheck(list, myIndex, item)
    let streakWins = 0
    try {
      const st = getMemberStreak(item.id, db)?.streak || 0
      if (st >= 3) {
        streakWins = st
      }
    } catch { /* không tính được chuỗi: coi như không có chuỗi */ }

    return {
      ...item,
      isMe,
      isTarget,
      streakWins,
    }
  })
}

export function getSurroundingSeasonStandings(db, memberId, windowSize = 5) {
  return getSurroundingStandings(db, memberId, windowSize, 'season')
}

function rivalGoalCheck(list, myIndex, item) {
  if (myIndex <= 0) return false
  return list[myIndex - 1]?.id === item.id
}

/**
 * Tính lịch sử tham gia các buổi tập trong quá khứ của CLB
 * @param {Object} db
 * @param {string} memberId
 * @returns {{ missedSessions: number, isComeback: boolean }}
 */
export function calcSessionAttendanceHistory(db, memberId) {
  if (!db || !memberId) return { missedSessions: 0, isComeback: false }

  const attendance = db?.attendance || {}
  const allMatches = Array.isArray(db?.matches) ? db.matches : []
  const allSessionIdsWithMatches = new Set()
  const memberSessionIds = new Set()
  let memberHasMatches = false

  for (const m of allMatches) {
    if (!m) continue
    if (m.sessionId) {
      allSessionIdsWithMatches.add(m.sessionId)
    }
    const inA = (m.teamA || []).includes(memberId)
    const inB = (m.teamB || []).includes(memberId)
    if (inA || inB) {
      memberHasMatches = true
      if (m.sessionId) {
        memberSessionIds.add(m.sessionId)
      }
    }
  }

  let memberHasAttendance = false
  for (const sId in attendance) {
    if (isPresent(attendance[sId]?.[memberId])) {
      memberHasAttendance = true
      break
    }
  }

  // 1. Kiểm tra thành viên đã từng tham gia bất kỳ buổi nào hay chưa
  const hasEverAttended = memberHasMatches || memberHasAttendance
  if (!hasEverAttended) {
    // Thành viên mới hoặc chưa từng tham gia buổi nào -> không báo vắng nhiều buổi
    return { missedSessions: 0, isComeback: false }
  }

  const checkAttended = (s) => {
    if (!s) return false
    const attMap = attendance[s.id] || (typeof s.attendance === 'object' && !Array.isArray(s.attendance) ? s.attendance : {})
    if (isPresent(attMap[memberId])) return true
    if (Array.isArray(s.attendance) && s.attendance.some((a) => (a.memberId === memberId || a.id === memberId) && (a.status === 'present' || a.present === true))) return true
    if (Array.isArray(s.attendees) && s.attendees.some((a) => (typeof a === 'string' ? a === memberId : a.memberId === memberId))) return true
    if (memberSessionIds.has(s.id)) return true
    return false
  }

  const todayStr = db.today || new Date().toISOString().slice(0, 10)

  // 2. Lấy danh sách các buổi tập trong quá khứ của CLB
  const pastSessions = (db.sessions || [])
    .filter((s) => s && s.status !== 'cancelled' && s.status !== 'draft')
    .filter((s) => {
      if (s.status === 'closed' || s.status === 'completed') return true
      // Buổi chưa đóng chỉ tính là buổi quá khứ hợp lệ nếu đã diễn ra trước hôm nay VÀ có dữ liệu thực tế (điểm danh hoặc trận đấu)
      if (s.date && s.date < todayStr) {
        const hasAttData = attendance[s.id] && Object.keys(attendance[s.id]).length > 0
        return Boolean(hasAttData || allSessionIdsWithMatches.has(s.id))
      }
      return false
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  if (pastSessions.length > 0) {
    // Tính lười (lazy check) - chỉ kiểm tra tối đa 5 buổi gần nhất
    const firstAttended = checkAttended(pastSessions[0])
    if (!firstAttended) {
      let missed = 1
      const maxCheck = Math.min(pastSessions.length, 5)
      for (let i = 1; i < maxCheck; i++) {
        if (!checkAttended(pastSessions[i])) {
          missed++
        } else {
          break
        }
      }
      return { missedSessions: Math.min(missed, 5), isComeback: false }
    } else {
      // Buổi gần nhất có đi -> kiểm tra xem có phải comeback sau khi vắng >= 2 buổi trước đó
      let priorMissed = 0
      const maxCheck = Math.min(pastSessions.length, 4)
      for (let i = 1; i < maxCheck; i++) {
        if (!checkAttended(pastSessions[i])) {
          priorMissed++
        } else {
          break
        }
      }
      return { missedSessions: 0, isComeback: priorMissed >= 2 }
    }
  }

  // Fallback: Gom theo ngày thi đấu trong quá khứ từ allMatches nếu db.sessions không có
  if (allMatches.length > 0) {
    const todayStart = new Date(db.today || Date.now()).setHours(0, 0, 0, 0)
    const dayMap = new Map()

    allMatches.forEach((m) => {
      if (!m) return
      const ts = m.at || (m.ended_at ? new Date(m.ended_at).getTime() : 0)
      if (!ts) return
      const dayStart = new Date(ts).setHours(0, 0, 0, 0)
      if (dayStart >= todayStart) return
      if (!dayMap.has(dayStart)) {
        dayMap.set(dayStart, { dayStart, matches: [] })
      }
      dayMap.get(dayStart).matches.push(m)
    })

    const sortedDays = Array.from(dayMap.values()).sort((a, b) => b.dayStart - a.dayStart)
    if (sortedDays.length > 0) {
      const checkDayAttended = (d) => d.matches.some((m) => (m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId))
      const firstAttended = checkDayAttended(sortedDays[0])
      if (!firstAttended) {
        let missed = 1
        const maxCheck = Math.min(sortedDays.length, 5)
        for (let i = 1; i < maxCheck; i++) {
          if (!checkDayAttended(sortedDays[i])) {
            missed++
          } else {
            break
          }
        }
        return { missedSessions: Math.min(missed, 5), isComeback: false }
      } else {
        let priorMissed = 0
        const maxCheck = Math.min(sortedDays.length, 4)
        for (let i = 1; i < maxCheck; i++) {
          if (!checkDayAttended(sortedDays[i])) {
            priorMissed++
          } else {
            break
          }
        }
        return { missedSessions: 0, isComeback: priorMissed >= 2 }
      }
    }
  }

  return { missedSessions: 0, isComeback: false }
}

/**
 * Lời chào cá nhân & Subtitle tương tác sinh động theo dữ liệu thực tế
 * @param {Object} currentMember
 * @param {Object} heroStats
 * @param {Object} formStats
 * @param {Array} recentMatches
 * @param {Object} upcomingSession
 * @param {Object} db
 * @returns {{ greetingKey: string, greetingParams: Object, subKey: string|null, subParams: Object }}
 */
export function getPersonalGreeting(currentMember, heroStats, formStats, recentMatches, upcomingSession, db, sessionSeed = 0) {
  if (!currentMember) return null

  const isFemale = isFemalePlayer(currentMember)
  const memberName = currentMember.name || ''
  const todayKey = db?.today || new Date().toISOString().slice(0, 10)
  const seedBase = `${currentMember.id}_${todayKey}_${sessionSeed}`

  // 1. Chọn Greeting Key (deterministic theo ngày, memberId và sessionSeed)
  const randIndex = getDeterministicRoll(seedBase + '_greet', 3) + 1
  let greetingKey = 'home.personal.greetingNeutral'
  if (isFemale) {
    greetingKey = `home.personal.greetingFemale${randIndex}`
  } else {
    greetingKey = `home.personal.greetingMale${randIndex}`
  }

  // 2. Tính toán thứ hạng Bảng Mùa (ALL và riêng Nam/Nữ)
  let seasonRank = heroStats?.seasonRank ?? 0
  let seasonTotalMembers = heroStats?.seasonTotalMembers ?? 0
  let genderSeasonRank = heroStats?.genderSeasonRank ?? 0
  let genderSeasonTotal = heroStats?.genderSeasonTotal ?? 0

  if (heroStats?.seasonRank == null && db) {
    try {
      const seasonData = calculateSeasonLeaderboard(db)
      const sLeaderboard = seasonData?.leaderboard || []
      if (sLeaderboard.length > 0) {
        if (!seasonTotalMembers) seasonTotalMembers = sLeaderboard.length
        const myIdx = sLeaderboard.findIndex((r) => r.id === currentMember.id)
        if (myIdx >= 0) {
          seasonRank = sLeaderboard[myIdx].rank || (myIdx + 1)
        }

        const isDbConsistent = !seasonTotalMembers || sLeaderboard.length === seasonTotalMembers || !seasonRank || (myIdx >= 0 && sLeaderboard[myIdx].rank === seasonRank)
        if (isDbConsistent) {
          const genderRows = sLeaderboard.filter((r) => {
            const mObj = memberOf(db, r.id) || r.member
            return isFemale ? isFemalePlayer(mObj) : !isFemalePlayer(mObj)
          })
          if (!genderSeasonTotal) genderSeasonTotal = genderRows.length
          const myGenderIdx = genderRows.findIndex((r) => r.id === currentMember.id)
          if (myGenderIdx >= 0) {
            genderSeasonRank = myGenderIdx + 1
          }
        }
      }
    } catch { /* không tra được BXH mùa: giữ genderSeasonRank = 0 */ }
  }

  // Đáy bảng là khoảng 4-5 người cuối bảng mùa (bảng all hoặc bảng riêng nam/nữ)
  const isBottomRank = (total, rank) => {
    if (!total || !rank || rank <= 3) return false // Top 1, 2, 3 không tính là đáy; rank = 0 không tính
    if (total <= 4) return rank === total
    const threshold = Math.max(4, total - 4) // Khoảng 4-5 người cuối bảng
    return rank >= threshold
  }

  const isBottom = isBottomRank(seasonTotalMembers, seasonRank) ||
                   (genderSeasonTotal >= 4 && isBottomRank(genderSeasonTotal, genderSeasonRank))

  const streak = formStats?.streak || 0
  const lastMatch = recentMatches?.[0]
  const justRankedUp = lastMatch?.rankImpact?.type === 'up'
  const isTodaySession = upcomingSession?.dateKey === 'today' || (upcomingSession?.date && upcomingSession.date === todayKey)
  const isLoseStreak = formStats?.matches?.length >= 2 && formStats.matches.slice(-2).every((x) => !x.won)

  // 3. Random 2 tầng cho Subtitle tương tác
  // TẦNG 1: Thu thập tất cả các trạng thái đang hợp lệ của thành viên (Active Contexts)
  const candidateStates = []

  const isTop1 = (seasonRank === 1)
  const isGenderTop1 = (!isTop1 && genderSeasonRank === 1 && genderSeasonTotal >= 3)

  if (isTop1) {
    candidateStates.push({ type: 'top1' })
  } else if (isGenderTop1) {
    candidateStates.push({ type: 'gender_top1' })
  }
  if (justRankedUp && lastMatch?.rankImpact?.to) {
    candidateStates.push({ type: 'rank_up', params: { rank: lastMatch.rankImpact.to } })
  }
  if (streak >= 3) {
    candidateStates.push({ type: 'win_streak', params: { streak } })
  }
  if (isBottom) {
    candidateStates.push({ type: 'bottom' })
  }
  if (seasonRank >= 2 && seasonRank <= 4) {
    candidateStates.push({
      type: 'top_chaser',
      params: { rank: seasonRank },
    })
  }
  if (isLoseStreak) {
    candidateStates.push({ type: 'lose_streak' })
  }
  if (isTodaySession) {
    candidateStates.push({ type: 'session_today' })
  }
  // Đánh giá dựa trên số buổi sinh hoạt quá khứ của CLB
  const { missedSessions, isComeback } = calcSessionAttendanceHistory(db, currentMember.id)

  if (missedSessions >= 2) {
    candidateStates.push({ type: 'inactive', params: { n: missedSessions } })
  }
  if (isComeback) {
    candidateStates.push({ type: 'comeback' })
  }

  // TẦNG 2: Bốc ngẫu nhiên 1 trạng thái, sau đó bốc ngẫu nhiên 1 biến thể câu thoại của trạng thái đó
  let subKey = null
  let subParams = {}

  if (candidateStates.length > 0) {
    const chosenIndex = getDeterministicRoll(seedBase + '_state', candidateStates.length)
    const chosen = candidateStates[chosenIndex]
    subParams = chosen.params || {}
    const coin = getDeterministicRoll(seedBase + '_coin', 2) === 0

    switch (chosen.type) {
      case 'top1':
        subKey = coin ? 'home.personal.subRank1' : 'home.personal.subRank1b'
        break
      case 'gender_top1':
        if (isFemale) {
          subKey = coin ? 'home.personal.subGenderTop1Female' : 'home.personal.subGenderTop1Female2'
        } else {
          subKey = coin ? 'home.personal.subGenderTop1Male' : 'home.personal.subGenderTop1Male2'
        }
        break
      case 'rank_up':
        subKey = coin ? 'home.personal.subRankUp' : 'home.personal.subRankUp2'
        break
      case 'win_streak':
        if (isFemale) {
          subKey = coin ? 'home.personal.subWinStreakFemale' : 'home.personal.subWinStreakFemale2'
        } else {
          subKey = coin ? 'home.personal.subWinStreakMale' : 'home.personal.subWinStreakMale2'
        }
        break
      case 'bottom':
        subKey = coin ? 'home.personal.subRankBottom' : 'home.personal.subRankBottom2'
        break
      case 'top_chaser':
        subKey = coin ? 'home.personal.subRankTop' : 'home.personal.subRankTop2'
        break
      case 'lose_streak':
        subKey = coin ? 'home.personal.subLoseStreak' : 'home.personal.subLoseStreak2'
        break
      case 'session_today':
        subKey = coin ? 'home.personal.subSessionToday' : 'home.personal.subSessionToday2'
        break
      case 'inactive':
        subKey = coin ? 'home.personal.subInactive' : 'home.personal.subInactive2'
        break
      case 'comeback':
        subKey = coin ? 'home.personal.subComeback' : 'home.personal.subComeback2'
        break
    }
  } else {
    // Trạng thái bình thường (lưng chừng bảng, phong độ ổn định): câu chào khích lệ chung
    subKey = getDeterministicRoll(seedBase + '_gen', 2) === 0 ? 'home.personal.subGeneral1' : 'home.personal.subGeneral2'
  }

  return {
    greetingKey,
    greetingParams: { name: memberName },
    subKey,
    subParams,
  }
}

