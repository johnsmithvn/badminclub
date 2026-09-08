import cfg from '#config/app.json' with { type: 'json' }
import { isPresent } from '#lib/money.js'

/**
 * Module tính toán XP, Cấp bậc và Sổ ghi đóng góp của Vận Động Viên (Screen 07 & Nhóm 8a SS1-SS3).
 *
 * Nguyên tắc:
 * - XP chỉ tăng, không giảm khi thua (đo lường mức độ tham gia và gắn bó với CLB).
 * - Cấp độ (Level) = floor(totalXP / 600) + 1.
 * - Danh xưng cấp bậc phân theo mốc level.
 */

/**
 * Lấy danh xưng theo level.
 * @param {number} level
 * @returns {string}
 */
export function titleOfLevel(level) {
  if (level >= 25) return 'Cao thủ' // i18n-ok: tier title
  if (level >= 20) return 'Hảo thủ' // i18n-ok: tier title
  if (level >= 15) return 'Thực chiến' // i18n-ok: tier title
  if (level >= 10) return 'Quen sân' // i18n-ok: tier title
  if (level >= 5) return 'Tập sự' // i18n-ok: tier title
  return 'Tân thủ' // i18n-ok: tier title
}

/**
 * Tính tổng XP, Level và tiến trình của một thành viên.
 * @param {string} memberId
 * @param {Object} db
 * @returns {Object}
 */
export function calculateMemberXp(memberId, db) {
  if (!memberId || !db) {
    return {
      totalXp: 0,
      level: 1,
      title: 'Tân thủ', // i18n-ok: default title
      nextLevelXp: 600,
      currentLevelBaseXp: 0,
      levelProgressPct: 0,
      sessionCount: 0,
      matchCount: 0,
    }
  }

  const matches = db.matches || []
  const sessions = db.sessions || []

  // 1. Số buổi tham gia
  const attendedSessions = new Set()
  const attendance = db.attendance || {}
  sessions.forEach((s) => {
    const attMap = attendance[s.id] || (typeof s.attendance === 'object' && !Array.isArray(s.attendance) ? s.attendance : {})
    if (isPresent(attMap[memberId])) {
      attendedSessions.add(s.id)
    }
    const attendees = s.attendees || []
    if (attendees.some((a) => (typeof a === 'string' ? a === memberId : a.memberId === memberId))) {
      attendedSessions.add(s.id)
    }
    if (Array.isArray(s.attendance) && s.attendance.some((a) => (a.memberId === memberId || a.id === memberId) && (a.status === 'present' || a.present === true))) {
      attendedSessions.add(s.id)
    }
  })

  // 2. Lọc các trận của người này
  const memberMatches = []
  matches.forEach((m) => {
    const teamA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const teamB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    const inA = teamA.includes(memberId)
    const inB = teamB.includes(memberId)
    if (inA || inB) {
      if (m.sessionId) attendedSessions.add(m.sessionId)
      const won = (inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')
      const isThreeSets = (m.sets || []).length >= 3
      const ra = m.initialRatingA || 1200
      const rb = m.initialRatingB || 1200
      const isUpsetWon = (inA && won && ra < rb) || (inB && won && rb < ra)

      memberMatches.push({
        ...m,
        won,
        isThreeSets,
        isUpsetWon,
      })
    }
  })

  const sessionCount = attendedSessions.size
  const matchCount = memberMatches.length

  // Công thức XP:
  // - Mỗi buổi có mặt: +50 XP
  // - Mỗi trận ra sân: +10 XP
  // - Trận 3 set kịch tính: +20 XP
  // - Hạ đối thủ rating cao hơn (Upset): +30 XP
  let matchXp = 0
  memberMatches.forEach((m) => {
    matchXp += 10 // Ra sân
    if (m.isThreeSets) matchXp += 20 // 3 set
    if (m.isUpsetWon) matchXp += 30 // Hạ đối thủ mạnh hơn
  })

  const sessionXp = sessionCount * 50

  // Thưởng cơ bản theo thâm niên thành viên (nếu có gamesCount trong playerRatings)
  const pr = db.playerRatings?.[memberId]
  const historicalGames = pr?.gamesCount || 0
  const baseBonus = Math.max(0, historicalGames - matchCount) * 15

  const totalXp = sessionXp + matchXp + baseBonus

  const level = Math.max(1, Math.floor(totalXp / 600) + 1)
  const currentLevelBaseXp = (level - 1) * 600
  const nextLevelXp = level * 600
  const xpInCurrentLevel = totalXp - currentLevelBaseXp
  const levelProgressPct = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / 600) * 100)))
  const title = titleOfLevel(level)

  return {
    totalXp,
    level,
    title,
    currentLevelBaseXp,
    nextLevelXp,
    levelProgressPct,
    sessionCount,
    matchCount,
  }
}

/**
 * Lấy lịch sử Sổ XP minh bạch cho thành viên.
 * @param {string} memberId
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getMemberXpLedger(memberId, db) {
  if (!memberId || !db) return []

  const matches = db.matches || []
  const ledger = []

  // Đọc từ các trận gần nhất
  const memberMatches = matches.filter((m) => {
    return (m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId)
  })

  memberMatches.forEach((m) => {
    const code = m.code || `M-${String(m.id || '').slice(0, 4)}`
    const dateStr = m.createdAt ? m.createdAt.slice(0, 10) : ''
    const inA = (m.teamA || []).includes(memberId)
    const inB = (m.teamB || []).includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')
    const ra = m.initialRatingA || 1200
    const rb = m.initialRatingB || 1200
    const isUpsetWon = (inA && won && ra < rb) || (inB && won && rb < ra)

    // Ra sân
    ledger.push({
      id: `${m.id}-play`,
      titleKey: 'xpPlayedMatch',
      source: `${code} · ${dateStr}`,
      amount: 10,
      date: m.createdAt || m.playedAt || '',
    })

    // Trận 3 set
    if ((m.sets || []).length >= 3) {
      ledger.push({
        id: `${m.id}-3sets`,
        titleKey: 'xpThreeSets',
        source: `${code} · ${dateStr}`,
        amount: 20,
        date: m.createdAt || m.playedAt || '',
      })
    }

    // Hạ đối thủ mạnh hơn
    if (isUpsetWon) {
      ledger.push({
        id: `${m.id}-upset`,
        titleKey: 'xpBeatStronger',
        source: `${code} · ${dateStr}`,
        amount: 30,
        date: m.createdAt || m.playedAt || '',
      })
    }
  })

  // Sắp xếp mới nhất lên đầu, giới hạn 10 dòng
  ledger.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  return ledger.slice(0, 8)
}

/**
 * Tính toán 4 mốc thành tựu chuẩn Screen 07.
 * @param {string} memberId
 * @param {Object} db
 * @returns {Array<Object>}
 */
export function getMemberAchievements(memberId, db) {
  if (!memberId || !db) return []

  const matches = db.matches || []
  let memberMatchesCount = 0
  let currentStreak = 0
  let maxStreak = 0

  const sortedMatches = [...matches]
    .filter((m) => (m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  sortedMatches.forEach((m) => {
    memberMatchesCount++
    const inA = (m.teamA || []).includes(memberId)
    const inB = (m.teamB || []).includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')

    if (won) {
      currentStreak++
      if (currentStreak > maxStreak) maxStreak = currentStreak
    } else {
      currentStreak = 0
    }
  })

  return [
    {
      id: 'matches_100',
      title: '100 trận', // i18n-ok: milestone title
      achieved: memberMatchesCount >= 100,
      progressText: memberMatchesCount >= 100 ? 'Đã đạt' : `${memberMatchesCount}/100`, // i18n-ok: milestone status
    },
    {
      id: 'streak_5',
      title: 'Thắng 5 liền', // i18n-ok: milestone title
      achieved: maxStreak >= 5,
      progressText: maxStreak >= 5 ? 'Đã đạt' : `${maxStreak}/5`, // i18n-ok: milestone status
    },
    {
      id: 'streak_10',
      title: 'Thắng 10 liền', // i18n-ok: milestone title
      achieved: maxStreak >= 10,
      progressText: maxStreak >= 10 ? 'Đã đạt' : `${maxStreak}/10`, // i18n-ok: milestone status
    },
    {
      id: 'matches_200',
      title: '200 trận', // i18n-ok: milestone title
      achieved: memberMatchesCount >= 200,
      progressText: memberMatchesCount >= 200 ? 'Đã đạt' : `${memberMatchesCount}/200`, // i18n-ok: milestone status
    },
  ]
}

/**
 * Tìm VĐV đang có chuỗi thắng dài nhất để treo thưởng Bounty.
 * @param {Object} db
 * @returns {Object|null}
 */
export function getSeasonBountyPlayer(db) {
  if (!db) return null
  const members = db.members || []
  const matches = db.matches || []

  let bestPlayer = null
  let maxStreak = 0

  members.forEach((m) => {
    const memberMatches = matches
      .filter((mt) => (mt.teamA || []).includes(m.id) || (mt.teamB || []).includes(m.id))
      .sort((a, b) => (b.createdAt || b.playedAt || '').localeCompare(a.createdAt || a.playedAt || ''))

    let streak = 0
    for (const mt of memberMatches) {
      const inA = (mt.teamA || []).includes(m.id)
      const inB = (mt.teamB || []).includes(m.id)
      const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
      if (won) {
        streak++
      } else {
        break
      }
    }

    if (streak > maxStreak) {
      maxStreak = streak
      bestPlayer = {
        member: m,
        streak,
      }
    }
  })

  if (maxStreak >= 3 && bestPlayer) {
    return bestPlayer
  }

  return null
}

/**
 * Tính toán bảng xếp hạng Mùa giải (Season Points Leaderboard - Screen SS1)
 * @param {Object} db - Toàn bộ dữ liệu CLB
 * @param {Object} [customSeason] - Cấu hình mùa giải tùy biến (nếu không truyền dùng cfg.season)
 */
export function calculateSeasonLeaderboard(db = {}, customSeason = null) {
  const season = customSeason || db?.settings?.season || cfg.season || {
    id: '2026-Q3',
    code: '2026-Q3',
    name: 'Thu Rực Lửa', // i18n-ok: default season name
    fullName: 'Mùa 3 · 2026 — Thu Rực Lửa', // i18n-ok: default season full name
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    totalSessionsExpected: 14,
    pointsConfig: {
      attendance: 30,
      matchPlayed: 10,
      matchWon: 15,
      upsetWon: 25,
      threeSets: 10,
      streakThree: 20,
    },
  }

  const pCfg = season.pointsConfig || {
    attendance: 30,
    matchPlayed: 10,
    matchWon: 15,
    upsetWon: 25,
    threeSets: 10,
    streakThree: 20,
  }

  const members = (db.members || []).filter((m) => m.active !== false)
  const allSessions = db.sessions || []
  const allMatches = db.matches || []

  // Lọc các buổi và trận trong khung thời gian của mùa giải
  const startTs = season.startDate ? Date.parse(`${season.startDate}T00:00:00Z`) : 0
  const endTs = season.endDate ? Date.parse(`${season.endDate}T23:59:59Z`) : Infinity

  const seasonSessions = allSessions.filter((s) => {
    const d = s.date || s.createdAt || ''
    const ts = Date.parse(d)
    return ts >= startTs && ts <= endTs
  })
  const seasonSessionIds = new Set(seasonSessions.map((s) => s.id))

  const seasonMatches = allMatches.filter((m) => {
    if (m.sessionId && seasonSessionIds.has(m.sessionId)) return true
    const d = m.playedAt || m.createdAt || ''
    const ts = Date.parse(d)
    return ts >= startTs && ts <= endTs
  })

  // Tính điểm từng thành viên
  const attendance = db.attendance || {}
  const rows = members.map((m) => {
    const memberId = m.id

    // 1. Trận đấu trong mùa & các buổi có tham gia thi đấu
    const myMatches = []
    const myMatchSessionIds = new Set()
    seasonMatches.forEach((mt) => {
      const teamA = mt.teamA || (mt.playerKeys ? mt.playerKeys.slice(0, 2) : [])
      const teamB = mt.teamB || (mt.playerKeys ? mt.playerKeys.slice(2, 4) : [])
      const inA = teamA.includes(memberId)
      const inB = teamB.includes(memberId)
      if (inA || inB) {
        if (mt.sessionId) myMatchSessionIds.add(mt.sessionId)
        const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
        const isThreeSets = (mt.sets || []).length >= 3
        const ra = mt.initialRatingA || 1200
        const rb = mt.initialRatingB || 1200
        const isUpsetWon = (inA && won && ra < rb) || (inB && won && rb < ra)
        myMatches.push({
          ...mt,
          won,
          isThreeSets,
          isUpsetWon,
          at: mt.at || (mt.playedAt ? Date.parse(mt.playedAt) : 0),
        })
      }
    })

    // 2. Số buổi có mặt
    let attendedCount = 0
    seasonSessions.forEach((s) => {
      const attMap = attendance[s.id] || (typeof s.attendance === 'object' && !Array.isArray(s.attendance) ? s.attendance : {})
      const inAttMap = isPresent(attMap[memberId])
      const inAttendees = (s.attendees || []).some((a) => (typeof a === 'string' ? a === memberId : a.memberId === memberId))
      const inAttArr = Array.isArray(s.attendance) && s.attendance.some((a) => (a.memberId === memberId || a.id === memberId) && (a.status === 'present' || a.present === true))
      const playedInSession = myMatchSessionIds.has(s.id)

      if (inAttMap || inAttendees || inAttArr || playedInSession) {
        attendedCount++
      }
    })

    // Sắp xếp trận mới nhất trước để tính chuỗi
    myMatches.sort((a, b) => (b.at || 0) - (a.at || 0))
    let streak = 0
    for (const match of myMatches) {
      if (match.won) streak++
      else break
    }

    const matchesCount = myMatches.length
    const winsCount = myMatches.filter((x) => x.won).length
    const lossesCount = matchesCount - winsCount
    const upsetsCount = myMatches.filter((x) => x.isUpsetWon).length
    const threeSetsCount = myMatches.filter((x) => x.isThreeSets).length
    const winRate = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0

    // Điểm thành phần
    const attendancePts = attendedCount * (pCfg.attendance || 30)
    const matchPlayPts = matchesCount * (pCfg.matchPlayed || 10)
    const winPts = winsCount * (pCfg.matchWon || 15)
    const upsetPts = upsetsCount * (pCfg.upsetWon || 25)
    const threeSetPts = threeSetsCount * (pCfg.threeSets || 10)
    const streakBonusPts = Math.floor(streak / 3) * (pCfg.streakThree || 20)

    const totalSeasonPoints = attendancePts + matchPlayPts + winPts + upsetPts + threeSetPts + streakBonusPts

    return {
      id: m.id,
      member: m,
      name: m.name,
      avatar: m.avatar,
      gender: m.gender,
      level: m.level,
      totalSeasonPoints,
      attendedCount,
      totalSessionsExpected: season.totalSessionsExpected || 14,
      matchesCount,
      winsCount,
      lossesCount,
      winRate,
      upsetsCount,
      threeSetsCount,
      streak,
      breakdown: {
        attendancePts,
        matchPlayPts,
        winPts,
        upsetPts,
        threeSetPts,
        streakBonusPts,
      },
    }
  })

  // Sắp xếp điểm mùa giảm dần
  rows.sort((a, b) => b.totalSeasonPoints - a.totalSeasonPoints || b.winsCount - a.winsCount)

  // Đánh số thứ hạng 1..N
  rows.forEach((row, idx) => {
    row.rank = idx + 1
  })

  // Tính thống kê tổng hợp mùa
  const totalSeasonPoints = rows.reduce((sum, r) => sum + r.totalSeasonPoints, 0)
  const totalSeasonMatches = seasonMatches.length
  const leaderPlayer = rows[0] || null
  const mostAttendedPlayer = [...rows].sort((a, b) => b.attendedCount - a.attendedCount)[0] || null
  const mostUpsetsPlayer = [...rows].sort((a, b) => b.upsetsCount - a.upsetsCount)[0] || null

  return {
    season,
    leaderboard: rows,
    topStats: {
      totalSeasonPoints,
      totalSeasonMatches,
      leaderPlayer,
      mostAttendedPlayer,
      mostUpsetsPlayer,
      playedSessionsCount: seasonSessions.length,
    },
  }
}

/**
 * Lấy sổ điểm mùa giải chi tiết (Audit Ledger) của một VĐV (Screen SS3)
 */
export function getMemberSeasonLedger(memberId, db = {}, customSeason = null) {
  if (!memberId || !db) return null
  const { season, leaderboard } = calculateSeasonLeaderboard(db, customSeason)
  const memberRow = leaderboard.find((r) => r.id === memberId)
  if (!memberRow) return null

  const pCfg = season.pointsConfig || {
    attendance: 30,
    matchPlayed: 10,
    matchWon: 15,
    upsetWon: 25,
    threeSets: 10,
    streakThree: 20,
  }

  // Tìm khoảng cách điểm với người đứng trên
  let ptsToNextRank = 0
  if (memberRow.rank > 1) {
    const higherRow = leaderboard[memberRow.rank - 2]
    ptsToNextRank = Math.max(0, higherRow.totalSeasonPoints - memberRow.totalSeasonPoints)
  }

  // Tìm buổi gần nhất có trận của người này
  const matches = db.matches || []
  const myMatches = matches.filter((m) => {
    const tA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const tB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    return tA.includes(memberId) || tB.includes(memberId)
  })
  myMatches.sort((a, b) => (b.createdAt || b.playedAt || '').localeCompare(a.createdAt || a.playedAt || ''))

  const latestSessionId = myMatches[0]?.sessionId || null
  const latestSessionMatches = myMatches.filter((m) => m.sessionId === latestSessionId)

  // Xây dựng các sự kiện chi tiết của buổi gần nhất
  const events = []
  let latestSessionPts = 0

  // 1. Điểm danh
  events.push({
    time: '19:02',
    title: 'Có mặt · điểm danh', // i18n-ok: sample event title
    pts: pCfg.attendance || 30,
    type: 'attendance',
  })
  latestSessionPts += (pCfg.attendance || 30)

  // 2. Từng trận đấu
  latestSessionMatches.forEach((m, idx) => {
    const tA = m.teamA || (m.playerKeys ? m.playerKeys.slice(0, 2) : [])
    const tB = m.teamB || (m.playerKeys ? m.playerKeys.slice(2, 4) : [])
    const inA = tA.includes(memberId)
    const inB = tB.includes(memberId)
    const won = (inA && m.winnerTeam === 'A') || (inB && m.winnerTeam === 'B')
    const ra = m.initialRatingA || 1200
    const rb = m.initialRatingB || 1200
    const isUpsetWon = (inA && won && ra < rb) || (inB && won && rb < ra)
    const isThreeSets = (m.sets || []).length >= 3

    let matchPts = pCfg.matchPlayed || 10
    if (won) matchPts += (pCfg.matchWon || 15)
    if (isUpsetWon) matchPts += (pCfg.upsetWon || 25)
    if (isThreeSets) matchPts += (pCfg.threeSets || 10)

    latestSessionPts += matchPts

    const timeStr = m.createdAt ? m.createdAt.slice(11, 16) : `19:${20 + idx * 25}`
    const scoreStr = (m.sets || []).map((s) => `${s[0]}–${s[1]}`).join(', ') || '21–17'

    events.push({
      time: timeStr,
      title: `Trận ${idx + 1} · ${won ? 'thắng' : 'thua'} ${scoreStr}${isUpsetWon ? ' · Upset' : ''}${isThreeSets ? ' · 3 set' : ''}`, // i18n-ok: match ledger title
      pts: matchPts,
      type: isUpsetWon ? 'upset' : won ? 'win' : 'play',
      isUpsetWon,
    })
  })

  return {
    season,
    member: memberRow.member,
    totalPoints: memberRow.totalSeasonPoints,
    rank: memberRow.rank,
    totalMembers: leaderboard.length,
    latestSessionPts,
    ptsToNextRank,
    breakdown: memberRow.breakdown,
    recentEvents: events,
  }
}
