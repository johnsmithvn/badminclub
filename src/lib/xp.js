/**
 * Module tính toán XP, Cấp bậc và Sổ ghi đóng góp của Vận Động Viên (Screen 07).
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
  sessions.forEach((s) => {
    const attendees = s.attendees || []
    if (attendees.some((a) => (typeof a === 'string' ? a === memberId : a.memberId === memberId))) {
      attendedSessions.add(s.id)
    }
  })

  // 2. Lọc các trận của người này
  const memberMatches = []
  matches.forEach((m) => {
    const inA = (m.teamA || []).includes(memberId)
    const inB = (m.teamB || []).includes(memberId)
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
