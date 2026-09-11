import cfg from '#config/app.json' with { type: 'json' }
import { isPresent } from '#lib/money.js'

/**
 * TRỤC GẮN BÓ — XP, Cấp bậc và Sổ đóng góp của hội viên.
 *
 * Nguyên tắc: XP KHÔNG BAO GIỜ hỏi "thắng hay thua". Nó đo mức độ gắn bó với CLB
 * (có mặt, ra sân, thâm niên, rủ khách), chỉ tăng, không bao giờ giảm.
 * Mọi thứ đo TRÌNH ĐỘ và THÀNH TÍCH THI ĐẤU nằm ở `#lib/rating.js` (Elo) và
 * `#lib/season.js` (điểm mùa) — đừng trộn hai trục vào nhau lần nữa.
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
 * Số tháng TRÒN đã trôi qua kể từ một mốc ngày. Chưa đủ 1 tháng thì trả 0.
 * @param {string|number|Date} [since]
 * @param {Date} [asOf]
 * @returns {number}
 */
export function monthsSince(since, asOf = new Date()) {
  if (!since) return 0
  const from = new Date(since)
  const to = new Date(asOf)
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) return 0
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1 // chưa tới ngày kỷ niệm trong tháng
  return Math.max(0, months)
}

/**
 * Đếm số khách giao lưu do một thành viên rủ tới sân.
 * Khách được khai ở hai chỗ: hồ sơ khách của CLB (`guests.invitedBy`) và bản ghi
 * khách theo từng buổi (`sessionGuests.invitedBy`) — đếm gộp, không trùng lặp
 * vì `sessionGuests` trỏ về `guestId`, còn khách vãng lai chỉ có bản ghi buổi.
 * @param {Object} db
 * @param {string} memberId
 * @returns {number}
 */
export function countInvitedBy(db, memberId) {
  if (!db || !memberId) return 0
  const seen = new Set()
  ;(db.guests || []).forEach((g) => {
    if (g?.invitedBy === memberId && g.id) seen.add(g.id)
  })
  ;(db.sessionGuests || []).forEach((sg) => {
    if (sg?.invitedBy !== memberId) return
    seen.add(sg.guestId || sg.id)
  })
  return seen.size
}

/**
 * Tính tổng XP, Level và tiến trình của một thành viên.
 * @param {string} memberId
 * @param {Object} db
 * @returns {Object}
 */
export function calculateMemberXp(memberId, db, asOf = new Date()) {
  if (!memberId || !db) {
    return {
      totalXp: 0,
      level: 1,
      title: 'Tân thủ', // i18n-ok: default title
      nextLevelXp: cfg.xp?.levelSize ?? 600,
      currentLevelBaseXp: 0,
      levelProgressPct: 0,
      sessionCount: 0,
      matchCount: 0,
      tenureMonths: 0,
      invitedCount: 0,
      breakdown: { sessionXp: 0, matchXp: 0, tenureXp: 0, inviteXp: 0 },
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
      memberMatches.push({ ...m, won })
    }
  })

  const sessionCount = attendedSessions.size
  const matchCount = memberMatches.length

  const xpCfg = cfg.xp || {}
  const perSession = xpCfg.perSession ?? 50
  const perMatch = xpCfg.perMatch ?? 10
  const perTenureMonth = xpCfg.perTenureMonth ?? 20
  const perGuestInvited = xpCfg.perGuestInvited ?? 25
  const levelSize = xpCfg.levelSize ?? 600

  // 3. Thâm niên: số tháng tròn kể từ ngày vào CLB
  const tenureMonths = monthsSince(
    (db.members || []).find((x) => x.id === memberId)?.joined,
    asOf
  )

  // 4. Số khách do chính mình rủ tới sân (đóng góp cho CLB, không dính trình độ)
  const invitedCount = countInvitedBy(db, memberId)

  const sessionXp = sessionCount * perSession
  const matchXp = matchCount * perMatch
  const tenureXp = tenureMonths * perTenureMonth
  const inviteXp = invitedCount * perGuestInvited

  const totalXp = sessionXp + matchXp + tenureXp + inviteXp

  const level = Math.max(1, Math.floor(totalXp / levelSize) + 1)
  const currentLevelBaseXp = (level - 1) * levelSize
  const nextLevelXp = level * levelSize
  const xpInCurrentLevel = totalXp - currentLevelBaseXp
  const levelProgressPct = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / levelSize) * 100)))
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
    tenureMonths,
    invitedCount,
    breakdown: { sessionXp, matchXp, tenureXp, inviteXp },
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

  const xpCfg = cfg.xp || {}
  const perSession = xpCfg.perSession ?? 50
  const perMatch = xpCfg.perMatch ?? 10
  const ledger = []

  // Chỉ hai khoản SINH THEO SỰ KIỆN mới lên sổ: có mặt một buổi, và ra sân một trận.
  // Thâm niên và rủ khách là khoản cộng dồn theo trạng thái, đã nằm ở `breakdown`.
  // KHÔNG còn dòng "3 set" / "hạ đối thủ mạnh hơn" — hai khoản đó thuộc trục thi đấu
  // (Elo + điểm mùa), XP không hỏi thắng thua.
  ;(db.matches || []).forEach((m) => {
    const inA = (m.teamA || []).includes(memberId)
    const inB = (m.teamB || []).includes(memberId)
    if (!inA && !inB) return
    const code = m.code || `M-${String(m.id || '').slice(0, 4)}`
    // `at` là epoch ms — trận từ Supabase KHÔNG có createdAt (dbmap chỉ map `ended_at` -> `at`)
    const dateStr = m.at ? new Date(m.at).toISOString().slice(0, 10) : ''
    ledger.push({
      id: `${m.id}-play`,
      titleKey: 'xpPlayedMatch',
      source: `${code} · ${dateStr}`,
      amount: perMatch,
      date: m.at || 0,
    })
  })

  const attendance = db.attendance || {}
  ;(db.sessions || []).forEach((sn) => {
    const attMap = attendance[sn.id] || (typeof sn.attendance === 'object' && !Array.isArray(sn.attendance) ? sn.attendance : {})
    const inAttMap = isPresent(attMap[memberId])
    const inAttendees = (sn.attendees || []).some((x) => (typeof x === 'string' ? x === memberId : x.memberId === memberId))
    const inAttArr = Array.isArray(sn.attendance) && sn.attendance.some((x) => (x.memberId === memberId || x.id === memberId) && (x.status === 'present' || x.present === true))
    if (!inAttMap && !inAttendees && !inAttArr) return
    ledger.push({
      id: `${sn.id}-session`,
      titleKey: 'xpFullSession',
      source: sn.date || '',
      amount: perSession,
      date: sn.date ? Date.parse(sn.date) : 0,
    })
  })

  // Sắp xếp mới nhất lên đầu, giới hạn 8 dòng
  ledger.sort((a, b) => (b.date || 0) - (a.date || 0))
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

  // Cũ -> mới để dò chuỗi thắng dài nhất. Sort theo `at`, KHÔNG theo createdAt:
  // trận không có field đó nên sort cũ là lệnh rỗng, chỉ đúng nhờ ăn may dbmap đã sort sẵn.
  const sortedMatches = [...matches]
    .filter((m) => (m.teamA || []).includes(memberId) || (m.teamB || []).includes(memberId))
    .sort((a, b) => (a.at || 0) - (b.at || 0))

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
