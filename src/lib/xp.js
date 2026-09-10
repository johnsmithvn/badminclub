import cfg from '#config/app.json' with { type: 'json' }
import { isPresent } from '#lib/money.js'
import { DEFAULT_RATING } from '#lib/rating.js'

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
      const ra = m.initialRatingA ?? DEFAULT_RATING
      const rb = m.initialRatingB ?? DEFAULT_RATING
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
    const ra = m.initialRatingA ?? DEFAULT_RATING
    const rb = m.initialRatingB ?? DEFAULT_RATING
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
 * Tính điểm Season Point delta sau mỗi trận đấu dựa trên 5 dải Elo chênh lệch giữa 2 đội.
 * Cả 2 người cùng đội nhận cùng delta; không cần đưa partner vào công thức Season Point.
 *
 * @param {number} teamElo - Elo của đội người chơi (trung bình Elo đôi hoặc Elo đơn)
 * @param {number} opponentTeamElo - Elo của đội đối thủ
 * @param {boolean} won - Kết quả trận đấu: true nếu thắng, false nếu thua
 * @param {object} [scaleConfig] - Cấu hình thang điểm (tuỳ chọn)
 * @returns {{ delta: number, tier: string, gap: number }}
 */
export function calcSeasonMatchDelta(teamElo, opponentTeamElo, won, scaleConfig = null) {
  const scale = scaleConfig || cfg?.season?.deltaScale || {
    heavyFavored: { win: 10, loss: -12 },
    favored: { win: 12, loss: -10 },
    balanced: { win: 14, loss: -8 },
    underdog: { win: 17, loss: -5 },
    deepUnderdog: { win: 22, loss: -3 },
  }

  const gap = Math.round((teamElo ?? DEFAULT_RATING) - (opponentTeamElo ?? DEFAULT_RATING))

  // Ngưỡng chia dải đọc từ `minGap` trong app.json, KHÔNG hard-code trong logic (RULES §3.2).
  // Xếp giảm dần theo minGap rồi lấy dải đầu tiên thoả `gap >= minGap` — sửa app.json là đổi
  // được luật chơi, không phải đụng code. `gap` luôn là số nguyên (đã Math.round) nên mốc
  // -49 / -149 tương đương đúng với "> -50" / "> -150" trong đặc tả.
  const FALLBACK_MIN_GAP = { heavyFavored: 150, favored: 50, balanced: -49, underdog: -149, deepUnderdog: -Infinity }
  const tiers = Object.entries(scale)
    .map(([key, val]) => ({
      key,
      minGap: Number.isFinite(val?.minGap) ? val.minGap : (FALLBACK_MIN_GAP[key] ?? -Infinity),
      win: val?.win ?? 0,
      loss: val?.loss ?? 0,
    }))
    .sort((a, b) => b.minGap - a.minGap)

  const hit = tiers.find((x) => gap >= x.minGap) || tiers[tiers.length - 1]
  return {
    delta: won ? hit.win : hit.loss,
    tier: hit.key,
    gap,
  }
}

/**
 * Tính toán bảng xếp hạng Mùa giải theo cơ chế Cày Rank Thi Đấu (Season Points Leaderboard - Screen SS1)
 * @param {Object} db - Toàn bộ dữ liệu CLB
 * @param {Object} [customSeason] - Cấu hình mùa giải tùy biến
 */
export function calculateSeasonLeaderboard(db = {}, customSeason = null) {
  const season = customSeason || db?.settings?.season || cfg?.season || {
    id: '2026-Q3',
    code: '2026-Q3',
    name: 'Thu Rực Lửa', // i18n-ok: default season name
    fullName: 'Mùa 3 · 2026 — Thu Rực Lửa', // i18n-ok: default season full name
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    cycle: 'quarter',
    totalSessionsExpected: 14,
    minMatchesOfficial: 20,
    inactiveDays: 21,
    bonusConfig: {
      streak3: 5,
      streak5: 10,
      upset150: 5,
    },
    deltaScale: {
      heavyFavored: { win: 10, loss: -12 },
      favored: { win: 12, loss: -10 },
      balanced: { win: 14, loss: -8 },
      underdog: { win: 17, loss: -5 },
      deepUnderdog: { win: 22, loss: -3 },
    },
  }

  const bonusCfg = season.bonusConfig || cfg?.season?.bonusConfig || {
    streak3: 5,
    streak5: 10,
    upset150: 5,
  }
  // Ngưỡng Elo để tính là thắng lội ngược dòng — lấy từ config, không hard-code (RULES §3.2)
  const upsetMinGap = bonusCfg.upsetMinGap ?? 150

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

  // Sắp xếp các trận theo thời gian tăng dần (chronological) để tính điểm lũy kế sàn Floor 0 và streak.
  // BẮT BUỘC tie-break theo id: sàn Floor 0 kẹp sau MỖI trận nên phép tính phụ thuộc thứ tự
  // (thua-rồi-thắng = 14đ, thắng-rồi-thua = 6đ). Hai sân bấm lưu cùng mili-giây mà không có
  // tie-break thì cùng một bộ dữ liệu sẽ ra hai bảng điểm khác nhau giữa các lần render.
  const getMatchTs = (mt) => mt.at || (mt.playedAt ? Date.parse(mt.playedAt) : (mt.createdAt ? Date.parse(mt.createdAt) : 0))
  const sortedSeasonMatches = [...seasonMatches].sort(
    (a, b) => getMatchTs(a) - getMatchTs(b) || String(a.id || '').localeCompare(String(b.id || ''))
  )

  const attendance = db.attendance || {}
  // Mốc so sánh trạng thái Tạm nghỉ = min(hôm nay, hết mùa). Dùng chính endTs (23:59:59 ngày
  // cuối mùa) để khớp với khung lọc trận ở trên, tránh lệch 1 ngày ở ranh giới 21 ngày.
  const refDate = season.referenceDate
    ? Date.parse(season.referenceDate)
    : Math.min(Date.now(), endTs)

  const rows = members.map((m) => {
    const memberId = m.id

    // 1. Lọc trận đấu của thành viên theo thứ tự thời gian
    const myMatches = []
    const myMatchSessionIds = new Set()
    sortedSeasonMatches.forEach((mt) => {
      const pKeys = mt.playerKeys || []
      const teamA = (mt.teamA && mt.teamA.length)
        ? mt.teamA
        : (pKeys.length <= 2 ? (pKeys[0] ? [pKeys[0]] : []) : pKeys.slice(0, 2))
      const teamB = (mt.teamB && mt.teamB.length)
        ? mt.teamB
        : (pKeys.length <= 2 ? (pKeys[1] ? [pKeys[1]] : []) : pKeys.slice(2, 4))
      const inA = teamA.includes(memberId)
      const inB = teamB.includes(memberId)
      if (inA || inB) {
        // Có mặt trong buổi được ghi nhận cho MỌI trận, kể cả trận giao lưu không tính rating.
        if (mt.sessionId) myMatchSessionIds.add(mt.sessionId)

        // Trận đánh dấu "không tính rating" thì không sinh điểm mùa và không tính vào mốc 20 trận:
        // cả cơ chế cày rank dẫn xuất từ Elo, mà trận này cố ý đứng ngoài Elo.
        if (mt.ratingEnabled === false) return

        const won = (inA && mt.winnerTeam === 'A') || (inB && mt.winnerTeam === 'B')
        const ra = mt.initialRatingA ?? DEFAULT_RATING
        const rb = mt.initialRatingB ?? DEFAULT_RATING
        const myElo = inA ? ra : rb
        const oppElo = inA ? rb : ra
        const isThreeSets = (mt.sets || []).length >= 3
        const isUpset = won && (oppElo - myElo >= upsetMinGap)

        myMatches.push({
          ...mt,
          inA,
          won,
          myElo,
          oppElo,
          isThreeSets,
          isUpset,
          at: getMatchTs(mt),
        })
      }
    })

    // 2. Tính điểm trận, thưởng mốc và sàn Floor = 0
    let totalSeasonPoints = 0
    let streak = 0
    let matchNetPts = 0
    let streakBonusPts = 0
    let upsetBonusPts = 0
    let upsetsCount = 0
    const matchLogs = []

    myMatches.forEach((match) => {
      const { delta, tier, gap } = calcSeasonMatchDelta(match.myElo, match.oppElo, match.won, season.deltaScale)
      let matchBonus = 0
      let earnedStreakBonus = 0
      let earnedUpsetBonus = 0

      if (match.won) {
        streak++
        if (streak === 3) {
          earnedStreakBonus = bonusCfg.streak3 || 5
          streakBonusPts += earnedStreakBonus
          matchBonus += earnedStreakBonus
        } else if (streak === 5) {
          earnedStreakBonus = bonusCfg.streak5 || 10
          streakBonusPts += earnedStreakBonus
          matchBonus += earnedStreakBonus
        }
        if (match.isUpset) {
          upsetsCount++
          earnedUpsetBonus = bonusCfg.upset150 || 5
          upsetBonusPts += earnedUpsetBonus
          matchBonus += earnedUpsetBonus
        }
      } else {
        streak = 0
      }

      matchNetPts += delta
      const netGain = delta + matchBonus
      const prevPoints = totalSeasonPoints
      totalSeasonPoints = Math.max(0, totalSeasonPoints + netGain)
      const effectiveChange = totalSeasonPoints - prevPoints

      matchLogs.push({
        ...match,
        delta,
        tier,
        gap,
        matchBonus,
        earnedStreakBonus,
        earnedUpsetBonus,
        effectiveChange,
        pointsAfter: totalSeasonPoints,
      })
    })

    // 3. Số buổi có mặt
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

    const matchesCount = myMatches.length
    const winsCount = myMatches.filter((x) => x.won).length
    const lossesCount = matchesCount - winsCount
    const threeSetsCount = myMatches.filter((x) => x.isThreeSets).length
    const winRate = matchesCount > 0 ? Math.round((winsCount / matchesCount) * 100) : 0

    const lastMatch = myMatches[myMatches.length - 1]
    const lastMatchAt = lastMatch ? lastMatch.at : null
    const daysSinceLastMatch = lastMatchAt ? Math.max(0, Math.floor((refDate - lastMatchAt) / (1000 * 60 * 60 * 24))) : null
    const isInactive = matchesCount > 0 && daysSinceLastMatch > (season.inactiveDays || 21)
    const isQualified = matchesCount >= (season.minMatchesOfficial || 20)

    return {
      id: m.id,
      member: m,
      name: m.name,
      avatar: m.avatarUrl || m.avatar || '',
      avatarUrl: m.avatarUrl || m.avatar || '',
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
      isInactive,
      isQualified,
      daysSinceLastMatch,
      lastMatchAt,
      matchLogs,
      breakdown: {
        matchNetPts,
        streakBonusPts,
        upsetBonusPts,
      },
    }
  })

  // Thứ tự BXH: (1) người đủ điều kiện tranh huy chương đứng trên người còn đang thẩm định,
  // (2) điểm mùa giảm dần, (3) số trận thắng, (4) tỷ lệ thắng.
  // Ưu tiên 1 chính là cơ chế chống "ôm rank": đánh 3 trận thắng cả 3 (~42đ) không được
  // đứng trên người đã cày 25 trận, dù điểm tuyệt đối có cao hơn.
  rows.sort((a, b) => (
    (Number(b.isQualified) - Number(a.isQualified))
    || (b.totalSeasonPoints - a.totalSeasonPoints)
    || (b.winsCount - a.winsCount)
    || (b.winRate - a.winRate)
  ))

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

  // Tìm khoảng cách điểm với người đứng trên
  let ptsToNextRank = 0
  if (memberRow.rank > 1) {
    const higherRow = leaderboard[memberRow.rank - 2]
    ptsToNextRank = Math.max(0, higherRow.totalSeasonPoints - memberRow.totalSeasonPoints)
  }

  // Danh sách các trận trong mùa (mới nhất lên đầu)
  const allLogs = memberRow.matchLogs || []
  const recentLogs = [...allLogs].reverse().slice(0, 15)

  let latestSessionPts = 0
  const latestSessionId = allLogs[allLogs.length - 1]?.sessionId || null
  if (latestSessionId) {
    allLogs.filter((m) => m.sessionId === latestSessionId).forEach((m) => {
      latestSessionPts += (m.effectiveChange ?? 0)
    })
  }

  // Trả về KEY + tham số, không dựng sẵn câu chữ — cùng pattern với getMemberXpLedger ở trên.
  // lib/ là hàm thuần, câu chữ do component render bằng t() (RULES §3.1).
  const events = recentLogs.map((m, idx) => {
    const timeStr = m.createdAt ? m.createdAt.slice(11, 16) : `19:${20 + idx * 20}`
    const scoreStr = (m.sets || []).map((s) => `${s[0]}–${s[1]}`).join(', ') || ''
    const gapStr = m.gap >= 0 ? `+${m.gap}` : `${m.gap}`
    const sign = m.effectiveChange > 0 ? `+${m.effectiveChange}` : `${m.effectiveChange}`

    return {
      time: timeStr,
      titleKey: m.won ? 'season.ledgerWin' : 'season.ledgerLoss',
      scoreText: scoreStr,
      gapText: gapStr,
      streakBonus: m.earnedStreakBonus || 0,
      upsetBonus: m.earnedUpsetBonus || 0,
      pts: sign,
      numPts: m.effectiveChange,
      pointsAfter: m.pointsAfter,
      type: m.won ? 'win' : 'loss',
      isUpset: Boolean(m.earnedUpsetBonus),
      gap: m.gap,
      tier: m.tier,
    }
  })

  return {
    season,
    member: memberRow.member,
    totalPoints: memberRow.totalSeasonPoints,
    rank: memberRow.rank,
    totalMembers: leaderboard.length,
    latestSessionPts,
    ptsToNextRank,
    isInactive: memberRow.isInactive,
    isQualified: memberRow.isQualified,
    daysSinceLastMatch: memberRow.daysSinceLastMatch,
    breakdown: memberRow.breakdown,
    recentEvents: events,
  }
}
