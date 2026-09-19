// src/lib/homePersonal.js
// Logic thuần phục vụ Màn Thành tích của tôi (Bảng thành tích cá nhân).
// HÀM THUẦN — không gọi React hay Supabase, test độc lập bằng Node (docs/RULES.md §4).

import { getPlayerRating, DEFAULT_RATING } from '#lib/rating.js'
import { calculateMemberBadges, getMemberStreak } from '#lib/badges.js'
import { calculateSeasonLeaderboard, getMemberSeasonLedger, resolveSeason, seasonMatchesOf } from '#lib/season.js'
import { memberOf } from '#lib/money.js'
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

  // Điểm mùa từ calculateSeasonLeaderboard thật
  let seasonMatches = 0
  let seasonWins = 0
  let seasonWinRate = 0
  let seasonPoints = 0
  try {
    const seasonData = calculateSeasonLeaderboard(db)
    const mySeasonRow = (seasonData?.leaderboard || []).find((r) => r.id === myItem.id)
    if (mySeasonRow) {
      seasonMatches = mySeasonRow.matchesCount || 0
      seasonWins = mySeasonRow.winsCount || 0
      seasonWinRate = mySeasonRow.winRate || 0
      seasonPoints = mySeasonRow.totalSeasonPoints || 0
    }
  } catch {}

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
    totalMembers,
    elo: myElo,
    eloDeltaWeek,
    seasonMatches,
    seasonWins,
    seasonWinRate,
    seasonPoints,
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
    }
  }

  let chaser = null
  if (chaserItem) {
    let chaserStreak = 0
    try {
      chaserStreak = getMemberStreak(chaserItem.id, db)?.streak || 0
    } catch {}

    chaser = {
      id: chaserItem.id,
      name: chaserItem.name,
      avatarUrl: getMemberAvatarUrl(chaserItem.member) || chaserItem.avatarUrl || '',
      rank: chaserItem.rank,
      elo: chaserItem.elo,
      streak: chaserStreak,
      gapPoints: Math.max(0, myItem.elo - chaserItem.elo),
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
 * 04. Biểu đồ đường đua mùa (Season Race Time-Series) dựng từ lịch sử trận thật
 * @param {Object} db
 * @param {string} memberId
 * @param {string} [rivalId]
 * @param {number} [weeksCount=6]
 */
export function calcSeasonRaceHistory(db, memberId, rivalId = null, weeksCount = 6) {
  if (!db || !memberId) return { empty: true }

  const activeSeason = resolveSeason(db)
  const seasonMatches = seasonMatchesOf(db, activeSeason)

  const myTrajectory = buildMemberEloTrajectory(db, memberId, seasonMatches)
  if (myTrajectory.length <= 1) {
    return { empty: true }
  }

  const currentMyElo = myTrajectory[myTrajectory.length - 1].rating
  const startMyElo = myTrajectory[0].rating

  const leaderboard = getClubEloLeaderboard(db)
  const rivalRankItem = rivalId ? leaderboard.find((x) => x.id === rivalId) : null

  let rivalTrajectory = []
  if (rivalId) {
    rivalTrajectory = buildMemberEloTrajectory(db, rivalId, seasonMatches)
  }

  const hasRivalTrajectory = rivalTrajectory.length > 1

  // Lấy các mốc mẫu từ trajectory
  const samplePoints = (traj, count) => {
    if (!traj || !traj.length) return []
    if (traj.length === 1) return Array(count).fill(traj[0].rating)
    const res = []
    for (let i = 0; i < count; i++) {
      const idx = Math.min(traj.length - 1, Math.round((i / (count - 1)) * (traj.length - 1)))
      res.push(traj[idx].rating)
    }
    return res
  }

  let myWeeklyElo = []
  let rivalWeeklyElo = []
  let effectiveWeeksCount = weeksCount

  const startTs = activeSeason?.startDate ? Date.parse(`${activeSeason.startDate}T00:00:00Z`) : 0
  if (startTs > 0 && Number.isFinite(startTs)) {
    const nowWeek = calcSeasonWeek(activeSeason.startDate)
    const span = Math.max(1, Math.min(weeksCount, nowWeek))
    effectiveWeeksCount = span
    const firstWeek = Math.max(1, nowWeek - span + 1)

    // Gom mốc Elo theo tuần của mùa giải
    const getRatingAtWeek = (traj, weekIdx) => {
      const weekCutoff = startTs + weekIdx * 7 * 86400000
      let latestRating = traj[0].rating
      for (const pt of traj) {
        if (pt.at && pt.at <= weekCutoff) {
          latestRating = pt.rating
        } else if (pt.at && pt.at > weekCutoff) {
          break
        }
      }
      return latestRating
    }

    myWeeklyElo = Array.from({ length: span }, (_, i) => {
      const weekIdx = firstWeek + i
      if (weekIdx >= nowWeek) {
        return currentMyElo
      }
      return getRatingAtWeek(myTrajectory, weekIdx)
    })

    if (hasRivalTrajectory) {
      const currentRivalElo = rivalTrajectory[rivalTrajectory.length - 1].rating
      rivalWeeklyElo = Array.from({ length: span }, (_, i) => {
        const weekIdx = firstWeek + i
        if (weekIdx >= nowWeek) {
          return currentRivalElo
        }
        return getRatingAtWeek(rivalTrajectory, weekIdx)
      })
    }
  } else {
    myWeeklyElo = samplePoints(myTrajectory, weeksCount)
    if (hasRivalTrajectory) {
      rivalWeeklyElo = samplePoints(rivalTrajectory, weeksCount)
    }
  }

  // Toạ độ SVG (viewBox 0 0 660 96)
  const allRatings = hasRivalTrajectory ? [...myWeeklyElo, ...rivalWeeklyElo] : [...myWeeklyElo]
  const minElo = Math.min(...allRatings) - 15
  const maxElo = Math.max(...allRatings) + 15
  const eloRange = Math.max(30, maxElo - minElo)

  // Mốc đầu tiên của biểu đồ khớp với giá trị điểm đầu trên đường vẽ
  const startElo = myWeeklyElo[0] ?? startMyElo
  const deltaElo = currentMyElo - startElo

  // Tính toạ độ X linh hoạt theo số mốc thực tế của biểu đồ
  const xPointsCount = myWeeklyElo.length
  const xCoords = Array.from({ length: xPointsCount }, (_, i) => Math.round(20 + (i / Math.max(1, xPointsCount - 1)) * 620))
  const toY = (val) => {
    const normalized = (val - minElo) / eloRange
    return Math.round(84 - normalized * 64)
  }

  const svgPointsMy = myWeeklyElo.map((val, idx) => `${xCoords[idx]},${toY(val)}`).join(' ')
  const svgPointsRival = hasRivalTrajectory ? rivalWeeklyElo.map((val, idx) => `${xCoords[idx]},${toY(val)}`).join(' ') : ''

  const startRivalElo = hasRivalTrajectory ? (rivalWeeklyElo[0] ?? rivalTrajectory[0].rating) : null
  const currentRivalElo = hasRivalTrajectory ? (rivalWeeklyElo[rivalWeeklyElo.length - 1] ?? rivalTrajectory[rivalTrajectory.length - 1].rating) : null
  const initialGap = (startRivalElo != null) ? Math.abs(startRivalElo - startElo) : null
  const currentGap = (currentRivalElo != null) ? Math.abs(currentRivalElo - currentMyElo) : null

  return {
    empty: false,
    weeks: effectiveWeeksCount,
    startElo,
    currentElo: currentMyElo,
    deltaElo,
    rivalName: rivalRankItem?.name || '',
    rivalRank: rivalRankItem?.rank || null,
    svgPointsMy,
    svgPointsRival,
    hasRivalTrajectory,
    latestMyX: xCoords[xCoords.length - 1],
    latestMyY: toY(currentMyElo),
    initialGap,
    currentGap,
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

  const myName = memberOf(db, memberId)?.name || ''

  // 1. Ưu tiên đọc từ sổ điểm mùa giải getMemberSeasonLedger (chứa streak bonus, upset bonus và effectiveChange chuẩn)
  try {
    const ledger = getMemberSeasonLedger(memberId, db)
    if (ledger?.events && ledger.events.length > 0) {
      const logs = ledger.events.slice(0, limit)
      return logs.map((ev, idx) => {
        const won = ev.type === 'win'
        const myTeamNames = ev.partnerName ? `${myName} · ${ev.partnerName}` : myName
        const oppTeamNames = ev.oppNamesStr || '—'
        const score = ev.scoreText || '—'
        const seasonChange = ev.pts || '0'

        let dateStr = '—'
        if (ev.at) {
          const matchDate = new Date(ev.at)
          const d = String(matchDate.getDate()).padStart(2, '0')
          const mo = String(matchDate.getMonth() + 1).padStart(2, '0')
          dateStr = `${d}/${mo}`
        }

        // Đọc eloDelta số thật từ match tương ứng
        const matchObj = (db.matches || []).find((m) => m && (m.id === ev.id || m.at === ev.at))
        const eloDelta = matchObj ? (Number(matchObj.eloDelta) || 0) : 0
        const eloChange = eloDelta > 0 ? (won ? `+${eloDelta}` : `−${eloDelta}`) : '0'

        return {
          id: ev.id || `match-${idx}`,
          won,
          myTeamNames,
          oppTeamNames,
          score,
          eloDelta,
          eloChange,
          seasonChange,
          dateStr,
        }
      })
    }
  } catch {}

  // 2. Fallback khi chưa có ledger: duyệt db.matches trực tiếp
  const playerMatches = db.matches
    .filter((m) => m && m.winnerTeam && ((m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, limit)

  return playerMatches.map((m) => {
    const inA = (m.teamA || []).includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (!inA && m.winnerTeam === 'B')

    const myTeamIds = inA ? (m.teamA || []) : (m.teamB || [])
    const oppTeamIds = inA ? (m.teamB || []) : (m.teamA || [])

    const myTeamNames = myTeamIds.map((id) => memberOf(db, id)?.name || id).join(' · ')
    const oppTeamNames = oppTeamIds.map((id) => memberOf(db, id)?.name || id).join(' · ')

    const score = formatScoreString(m) || '—'
    const eloDelta = Number(m.eloDelta) || 0
    const eloChange = eloDelta > 0 ? (won ? `+${eloDelta}` : `−${eloDelta}`) : '0'

    let dateStr = '—'
    if (m.at) {
      const matchDate = new Date(m.at)
      const d = String(matchDate.getDate()).padStart(2, '0')
      const mo = String(matchDate.getMonth() + 1).padStart(2, '0')
      dateStr = `${d}/${mo}`
    }

    return {
      id: m.id,
      won,
      myTeamNames,
      oppTeamNames,
      score,
      eloDelta,
      eloChange,
      seasonChange: '—',
      dateStr,
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

  return {
    id: s.id,
    date: s.date,
    time: s.time || '',
    venue: s.courtTxt || '',
    courtsCount,
    goingCount,
    isRegistered,
    expectedMatches,
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

  // 1. Kèo thách đấu đang chờ
  const challenges = db.challenges || []
  const pendingChallenge = challenges.find((c) => c.status === 'pending')
  if (pendingChallenge) {
    const challengers = (pendingChallenge.teamA || []).map((id) => memberOf(db, id)?.name || id).join(' · ')
    events.push({
      id: `chal-${pendingChallenge.id}`,
      dotColor: 'var(--text-link)',
      type: 'challenge',
      challengers,
      timeAgo: '1d',
    })
  }

  // 2. Buổi tập chốt chia sân
  const closedSession = (db.sessions || []).find((s) => s.status === 'closed')
  if (closedSession) {
    events.push({
      id: `session-${closedSession.id}`,
      dotColor: 'var(--text-muted)',
      type: 'session_locked',
      date: closedSession.date,
      timeAgo: '1d',
    })
  }

  return events.slice(0, limit)
}

/**
 * 09. Danh sách 5 thành viên xung quanh thứ hạng của người dùng trên Desktop
 * @param {Object} db
 * @param {string} memberId
 * @param {number} [windowSize=5]
 */
export function getSurroundingStandings(db, memberId, windowSize = 5) {
  if (!db || !memberId) return []
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

function rivalGoalCheck(list, myIndex, item) {
  if (myIndex <= 0) return false
  return list[myIndex - 1]?.id === item.id
}
