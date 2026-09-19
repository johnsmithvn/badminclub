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
import { memberOf, courtTxt, timeTxt } from '#lib/money.js'
import { formatScoreString } from '#lib/activity.js'

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
  } catch {}

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
  } catch {}

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

  const playerMatches = db.matches
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
  } catch {}

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
    } catch {}

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

    const myStreak = getMemberStreak(memberId, db)?.streak || 0
    let rivalInsightKey = 'rivalInsightMedium'
    let rivalInsightParams = { name: rivalItem.name, gap: gapPoints, n: neededWins }

    if (gapPoints === 0) {
      rivalInsightKey = 'rivalInsightEven'
      rivalInsightParams = { name: rivalItem.name }
    } else if (myH2HWins >= 2 && myH2HWins > rivalH2HWins) {
      rivalInsightKey = 'rivalInsightH2H'
      rivalInsightParams = { name: rivalItem.name, myWins: myH2HWins, rivalWins: rivalH2HWins }
    } else if (myStreak >= 3) {
      rivalInsightKey = 'rivalInsightOnFire'
      rivalInsightParams = { name: rivalItem.name, streak: myStreak }
    } else if (neededWins === 1 || gapPoints <= 20) {
      const v = Math.random() < 0.5 ? '1' : '2'
      rivalInsightKey = `rivalInsightClose${v}`
      rivalInsightParams = { name: rivalItem.name, rank: rivalItem.rank }
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
    } catch {}

    const chaserGap = Math.max(0, myItem.elo - chaserItem.elo)
    let chaserWarningKey = 'chaserWarningNormal'
    let chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap }

    if (chaserGap <= 25 && chaserStreak >= 2) {
      const v = Math.random() < 0.5 ? '1' : '2'
      chaserWarningKey = `chaserWarningThreat${v}`
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap, streak: chaserStreak }
    } else if (chaserGap <= 25) {
      chaserWarningKey = 'chaserWarningClose'
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, gap: chaserGap }
    } else if (chaserStreak >= 2) {
      chaserWarningKey = 'chaserWarningHot'
      chaserWarningParams = { name: chaserItem.name, rank: chaserItem.rank, streak: chaserStreak }
    } else if (chaserGap > 50) {
      const v = Math.random() < 0.5 ? '1' : '2'
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
  } catch {}

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
      } catch {}
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
  } catch {}

  // Chuẩn bị trajectory điểm mùa của tất cả active members để tính biến động thứ hạng mùa (season rankImpact)
  const allSeasonTrajectories = new Map()
  const allEloTrajectories = new Map()
  const activeMembers = (db.members || []).filter((mem) => mem && mem.active !== false)

  let seasonData = null
  try {
    seasonData = calculateSeasonLeaderboard(db, season)
  } catch {}

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
 * 07. Thông tin buổi tập sắp tới gần nhất
 * @param {Object} db
 * @param {string} memberId
 */
export function getNextUpcomingSession(db, memberId) {
  if (!db || !Array.isArray(db.sessions)) return null
  const nowStr = db.today || new Date().toISOString().slice(0, 10)
  const openSessionsList = db.sessions
    .filter((s) => s.status === 'open' && s.date >= nowStr)
    .sort((a, b) => a.date.localeCompare(b.date))

  const s = openSessionsList[0] || db.sessions.find((x) => x.status === 'open') || null
  if (!s) return null

  const att = db.attendance?.[s.id] || {}
  const isRegistered = Boolean(att[memberId]) || (s.attendees || []).some((a) => (typeof a === 'string' ? a === memberId : a?.memberId === memberId))

  const courtsCount = (s.courts || []).length || 1
  const goingCount = Object.keys(att).length || 0
  const expectedMatches = Math.max(1, Math.round(goingCount * 0.35))

  const venue = courtTxt(db, s) || s.courtTxt || s.venue || ''
  const time = timeTxt(s) || s.time || ''
  const isToday = s.date === nowStr

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
    time,
    venue,
    courtsCount,
    goingCount,
    isRegistered,
    expectedMatches,
    challenges: challengesList,
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

  // 1. Trận đấu vừa kết thúc gần nhất
  const matches = db.matches || []
  if (matches.length > 0) {
    const sortedMatches = [...matches]
      .filter((m) => m && m.winnerTeam)
      .sort((a, b) => (b.at || 0) - (a.at || 0))
    const lastMatch = sortedMatches[0]
    if (lastMatch) {
      const inA = lastMatch.winnerTeam === 'A'
      const winIds = inA ? (lastMatch.teamA || []) : (lastMatch.teamB || [])
      const loseIds = inA ? (lastMatch.teamB || []) : (lastMatch.teamA || [])
      const winnerNames = winIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
      const loserNames = loseIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
      const score = formatScoreString(lastMatch) || '—'

      events.push({
        id: `match-${lastMatch.id}`,
        dotColor: 'var(--status-delivered-fg)',
        type: 'match_finished',
        winnerNames,
        loserNames,
        score,
        timeAgo: lastMatch.at ? new Date(lastMatch.at).toTimeString().slice(0, 5) : '',
      })
    }
  }

  // 2. Kèo thách đấu đang chờ
  const challenges = db.challenges || []
  const pendingChallenge = challenges.find((c) => c.status === 'pending')
  if (pendingChallenge) {
    const challengers = (pendingChallenge.teamA || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
    events.push({
      id: `chal-${pendingChallenge.id}`,
      dotColor: 'var(--text-link)',
      type: 'challenge',
      challengers,
      timeAgo: pendingChallenge.createdAt ? new Date(pendingChallenge.createdAt).toTimeString().slice(0, 5) : '',
    })
  }

  // 3. Buổi tập chốt chia sân
  const closedSession = (db.sessions || []).find((s) => s.status === 'closed')
  if (closedSession) {
    const venue = courtTxt(db, closedSession) || closedSession.venue || ''
    events.push({
      id: `session-${closedSession.id}`,
      dotColor: 'var(--text-muted)',
      type: 'session_locked',
      date: closedSession.date,
      venue,
      timeAgo: '',
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
        } catch {}
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
    } catch {}
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
    } catch {}

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
 * Lời chào cá nhân & Subtitle tương tác sinh động theo dữ liệu thực tế
 * @param {Object} currentMember
 * @param {Object} heroStats
 * @param {Object} formStats
 * @param {Array} recentMatches
 * @param {Object} upcomingSession
 * @param {Object} db
 * @returns {{ greetingKey: string, greetingParams: Object, subKey: string|null, subParams: Object }}
 */
export function getPersonalGreeting(currentMember, heroStats, formStats, recentMatches, upcomingSession, db) {
  if (!currentMember) return null

  const isFemale = isFemalePlayer(currentMember)
  const memberName = currentMember.name || ''

  // 1. Chọn Greeting Key (ngẫu nhiên 1 trong 3 biến thể theo giới tính)
  const randIndex = Math.floor(Math.random() * 3) + 1
  let greetingKey = 'home.personal.greetingNeutral'
  if (isFemale) {
    greetingKey = `home.personal.greetingFemale${randIndex}`
  } else {
    greetingKey = `home.personal.greetingMale${randIndex}`
  }

  // 2. Tính toán thứ hạng Bảng Mùa (ALL và riêng Nam/Nữ)
  const seasonRank = heroStats?.seasonRank || heroStats?.myRank || heroStats?.rank || 0
  const seasonTotalMembers = heroStats?.seasonTotalMembers || heroStats?.totalMembers || (db?.members || []).filter((m) => m && m.active !== false).length || 0

  let genderSeasonRank = 0
  let genderSeasonTotal = 0
  try {
    const seasonData = calculateSeasonLeaderboard(db)
    const sLeaderboard = seasonData?.leaderboard || []
    if (sLeaderboard.length > 0) {
      const genderRows = sLeaderboard.filter((r) => {
        const mObj = memberOf(db, r.id) || r.member
        return isFemale ? isFemalePlayer(mObj) : !isFemalePlayer(mObj)
      })
      genderSeasonTotal = genderRows.length
      const myGenderIdx = genderRows.findIndex((r) => r.id === currentMember.id)
      if (myGenderIdx >= 0) {
        genderSeasonRank = myGenderIdx + 1
      }
    }
  } catch {}

  // Đáy bảng là khoảng 4-5 người cuối bảng (bảng all hoặc bảng riêng nam/nữ)
  const isBottomRank = (total, rank) => {
    if (!total || !rank || rank <= 3) return false // Top 1, 2, 3 không tính là đáy
    if (total <= 4) return rank === total
    const threshold = Math.max(4, total - 4) // Khoảng 4-5 người cuối bảng
    return rank >= threshold
  }

  const isBottom = isBottomRank(seasonTotalMembers, seasonRank) ||
                   (genderSeasonTotal >= 4 && isBottomRank(genderSeasonTotal, genderSeasonRank))

  const streak = formStats?.streak || 0
  const lastMatch = recentMatches?.[0]
  const justRankedUp = lastMatch?.rankImpact?.type === 'up'
  const isTodaySession = upcomingSession?.dateKey === 'today' || (upcomingSession?.date && upcomingSession.date === (db?.today || new Date().toISOString().slice(0, 10)))

  let lastMatchAt = 0
  if (lastMatch?.at) {
    lastMatchAt = lastMatch.at
  } else if (Array.isArray(db?.matches)) {
    const memMatch = db.matches.find((m) => m && ((m.teamA || []).includes(currentMember.id) || (m.teamB || []).includes(currentMember.id)))
    lastMatchAt = memMatch?.at || 0
  }
  const daysInactive = lastMatchAt > 0 ? Math.floor((Date.now() - lastMatchAt) / (1000 * 60 * 60 * 24)) : 0

  let subKey = null
  let subParams = {}

  if (seasonRank === 1 || (genderSeasonRank === 1 && genderSeasonTotal >= 3)) {
    subKey = 'home.personal.subRank1'
  } else if (justRankedUp && lastMatch?.rankImpact?.to) {
    subKey = 'home.personal.subRankUp'
    subParams = { rank: lastMatch.rankImpact.to }
  } else if (streak >= 3) {
    subKey = isFemale ? 'home.personal.subWinStreakFemale' : 'home.personal.subWinStreakMale'
    subParams = { streak }
  } else if (isBottom) {
    subKey = Math.random() < 0.5 ? 'home.personal.subRankBottom' : 'home.personal.subRankBottom2'
  } else if ((seasonRank >= 2 && seasonRank <= 4) || (genderSeasonRank >= 2 && genderSeasonRank <= 4 && genderSeasonTotal >= 6)) {
    subKey = 'home.personal.subRankTop'
    subParams = { rank: (seasonRank >= 2 && seasonRank <= 4) ? seasonRank : genderSeasonRank }
  } else if (streak <= -2 || (lastMatch && !lastMatch.won && formStats?.form5?.slice(-2).every((w) => !w))) {
    subKey = 'home.personal.subLoseStreak'
  } else if (isTodaySession) {
    subKey = 'home.personal.subSessionToday'
  } else if (daysInactive >= 7) {
    subKey = 'home.personal.subInactive'
  }

  return {
    greetingKey,
    greetingParams: { name: memberName },
    subKey,
    subParams,
  }
}

