// src/lib/activity.js
// Logic thuần xử lý sự kiện (Social Activity, Notifications & Personal Highlights).
// Không phụ thuộc Supabase hay React state, dễ dàng viết unit test.

import { getPlayerPartnersAndMatchups } from '#lib/rating.js'
import { getMemberStreak } from '#lib/badges.js'
import { seasonMatchesOf } from '#lib/season.js'
import { isChallengeExpired } from '#lib/challenge.js'
import { buildPushUrl } from '#routes'
import { dd, isoOf } from '#utils/dates.js'
import { t } from '#i18n'

/**
 * Lấy tên hiển thị của thành viên hoặc khách từ ID
 */
export function getEntityName(db, id) {
  if (!id) return ''
  const m = (db?.members || []).find((x) => x.id === id)
  if (m) return m.name
  const g = (db?.guests || []).find((x) => x.id === id)
  if (g) return g.name
  return id
}

/**
 * Ghép danh sách ID thành chuỗi tên nối bằng ' & '
 */
export function formatTeamNames(db, ids = []) {
  return (ids || []).map((id) => getEntityName(db, id)).filter(Boolean).join(' & ')
}

/**
 * Chuẩn hoá tỷ số trận đấu thành chuỗi (ví dụ: "21-19, 18-21, 22-20" hoặc "21-18")
 */
export function formatScoreString(match) {
  if (!match) return ''
  if (Array.isArray(match.sets) && match.sets.length > 0) {
    return match.sets
      .map((s) => (Array.isArray(s) ? `${s[0]}-${s[1]}` : String(s)))
      .join(', ')
  }
  if (match.scoreText) return String(match.scoreText)
  if (match.score) return String(match.score)
  const sA = match.scoreA ?? match.score_a
  const sB = match.scoreB ?? match.score_b
  if (sA != null && sB != null) return `${sA}-${sB}`
  return ''
}

/**
 * Phân loại sắc thái trận đấu (Match Narrative Tag)
 * @returns {'comeback' | 'clutch' | 'blowout' | 'normal'}
 */
export function detectMatchNarrative(match) {
  if (!match) return 'normal'

  const sets = Array.isArray(match.sets) && match.sets.length > 0 ? match.sets : null
  const winnerTeam = match.winnerTeam // 'A' hoặc 'B'

  // 1. Kiểm tra Lội ngược dòng (Comeback): bo3, thua set 1 nhưng thắng chung cuộc
  if (sets && sets.length >= 3 && winnerTeam) {
    const s1 = sets[0]
    if (Array.isArray(s1) && s1.length >= 2) {
      const winnerWonS1 = winnerTeam === 'A' ? s1[0] > s1[1] : s1[1] > s1[0]
      if (!winnerWonS1) {
        return 'comeback'
      }
    }
  }

  // Lấy các set để xét điểm sát nút hoặc áp đảo
  let targetSets = sets
  if (!targetSets) {
    const scoreStr = match.scoreText || match.score || ''
    if (scoreStr) {
      const parts = String(scoreStr).split(',').map((x) => x.trim())
      targetSets = parts.map((p) => {
        const [a, b] = p.split('-').map((v) => parseInt(v, 10))
        return [a || 0, b || 0]
      })
    } else {
      const sA = match.scoreA ?? match.score_a ?? 0
      const sB = match.scoreB ?? match.score_b ?? 0
      if (sA || sB) targetSets = [[sA, sB]]
    }
  }

  if (!targetSets || targetSets.length === 0) return 'normal'

  // 2. Kiểm tra Thắng nghẹt thở (Clutch): Có set quyết định chạm mốc >= 20 và cách biệt <= 2 điểm
  const lastSet = targetSets[targetSets.length - 1]
  if (Array.isArray(lastSet) && lastSet.length >= 2) {
    const [pA, pB] = lastSet
    const diff = Math.abs(pA - pB)
    if ((pA >= 20 || pB >= 20) && diff <= 2 && diff > 0) {
      return 'clutch'
    }
  }

  // 3. Kiểm tra Thắng áp đảo (Blowout): Cách biệt >= 10 điểm hoặc đối thủ dưới 12 điểm trong set 21
  const hasBlowout = targetSets.some(([pA, pB]) => {
    const diff = Math.abs(pA - pB)
    const minP = Math.min(pA, pB)
    const maxP = Math.max(pA, pB)
    return diff >= 10 || (maxP >= 21 && minP <= 11)
  })
  if (hasBlowout) {
    return 'blowout'
  }

  return 'normal'
}

/**
 * Tính toán Điểm nhấn cá nhân (Personal Highlights) cho 1 thành viên
 * On-demand, không lưu trữ DB, đảm bảo luôn cập nhật theo dữ liệu mới nhất.
 * @returns {Array<{type: string, [key: string]: any}>}
 */
export function getPersonalHighlights(memberId, db) {
  if (!memberId || !db) return []

  const highlights = []
  const matches = db.matches || []
  const members = db.members || []
  const membersMap = Object.fromEntries(members.map((m) => [m.id, m]))
  const ratingsMap = db.playerRatings || {}

  // 1. Cặp đôi ăn ý nhất (Best Partner): yêu cầu tối thiểu 5 trận cùng nhau
  const partnerData = getPlayerPartnersAndMatchups(matches, memberId, membersMap, ratingsMap)
  const validPartners = (partnerData?.partners || []).filter((p) => (p.games || p.gamesCount || 0) >= 5)
  if (validPartners.length > 0) {
    // Sắp theo tỷ lệ thắng cao nhất, sau đó đến số trận
    validPartners.sort((a, b) => {
      const wrA = a.wins / a.games
      const wrB = b.wins / b.games
      return wrB - wrA || b.games - a.games
    })
    const best = validPartners[0]
    const winRate = Math.round((best.wins / best.games) * 100)
    highlights.push({
      type: 'best_partner',
      partnerId: best.id,
      partnerName: getEntityName(db, best.id),
      games: best.games,
      wins: best.wins,
      winRate,
    })
  }

  // 2. Cạ cứng mới (Hot Synergy Partner): Cùng nhau đánh >= 3 trận gần nhất và toàn thắng 100%
  const memberMatchesDesc = matches
    .filter((mt) => {
      const inA = (mt.teamA || []).includes(memberId)
      const inB = (mt.teamB || []).includes(memberId)
      return inA || inB
    })
    .sort((a, b) => {
      const tA = a.at ? new Date(a.at).getTime() : 0
      const tB = b.at ? new Date(b.at).getTime() : 0
      return tB - tA
    })

  // Đếm chuỗi trận thắng gần nhất theo từng partner
  const partnerRecentStreak = new Map()
  const partnerRecentBroken = new Set()

  for (const mt of memberMatchesDesc) {
    if (!mt.winnerTeam) continue
    const inA = (mt.teamA || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
    const myTeam = inA ? mt.teamA || [] : mt.teamB || []
    const partnerId = myTeam.find((id) => id !== memberId)

    if (partnerId) {
      if (!partnerRecentBroken.has(partnerId)) {
        if (won) {
          const current = partnerRecentStreak.get(partnerId) || 0
          partnerRecentStreak.set(partnerId, current + 1)
        } else {
          partnerRecentBroken.add(partnerId)
        }
      }
    }
  }

  const bestPartnerId = highlights.find((h) => h.type === 'best_partner')?.partnerId
  for (const [pId, streak] of partnerRecentStreak.entries()) {
    // Nếu đạt >= 3 trận thắng liên tiếp gần nhất và không trùng với bestPartner vừa thêm
    if (streak >= 3 && pId !== bestPartnerId) {
      highlights.push({
        type: 'reliable_partner',
        partnerId: pId,
        partnerName: getEntityName(db, pId),
        streak,
      })
      break // Chỉ cần hiển thị 1 cạ cứng nổi bật nhất
    }
  }

  // 3. Phá dớp kỵ giơ (Nemesis Beaten) & 4. Kỳ phùng địch thủ (Arch-Rival)
  // Quét toàn bộ lịch sử H2H theo thời gian tăng dần
  const memberMatchesAsc = [...memberMatchesDesc].reverse()
  const oppH2HHistory = new Map() // oppId -> array of boolean (true: user won, false: user lost)

  for (const mt of memberMatchesAsc) {
    if (!mt.winnerTeam) continue
    const inA = (mt.teamA || []).includes(memberId)
    const won = (inA && mt.winnerTeam === 'A') || (!inA && mt.winnerTeam === 'B')
    const oppTeam = inA ? mt.teamB || [] : mt.teamA || []

    oppTeam.forEach((oppId) => {
      if (!oppH2HHistory.has(oppId)) {
        oppH2HHistory.set(oppId, [])
      }
      oppH2HHistory.get(oppId).push(won)
    })
  }

  // Kiểm tra Nemesis Beaten: H2H >= 3 trận, trận mới nhất thắng, trước đó thua >= 2 trận liên tiếp
  let nemesisBeatenFound = false
  for (const [oppId, history] of oppH2HHistory.entries()) {
    if (history.length >= 3) {
      const latestWin = history[history.length - 1] === true
      if (latestWin) {
        // Kiểm tra 2 trận ngay trước đó có phải thua không
        const prev1 = history[history.length - 2] === false
        const prev2 = history[history.length - 3] === false
        if (prev1 && prev2) {
          const latestMatchWithOpp = memberMatchesDesc.find(
            (m) => (m.teamA || []).includes(oppId) || (m.teamB || []).includes(oppId)
          )
          const isRecent = memberMatchesDesc.indexOf(latestMatchWithOpp) < 5
          if (isRecent) {
            highlights.push({
              type: 'nemesis_beaten',
              rivalId: oppId,
              rivalName: getEntityName(db, oppId),
            })
            nemesisBeatenFound = true
            break
          }
        }
      }
    }
  }

  // Kỳ phùng địch thủ (Arch-Rival): Chạm trán nhiều nhất (>= 4 trận), tỷ số đối đầu chênh lệch <= 2
  let bestRival = null
  for (const [oppId, history] of oppH2HHistory.entries()) {
    const total = history.length
    if (total >= 4) {
      const myWins = history.filter(Boolean).length
      const oppWins = total - myWins
      const diff = Math.abs(myWins - oppWins)
      if (diff <= 2) {
        if (!bestRival || total > bestRival.total) {
          bestRival = { oppId, total, myWins, oppWins }
        }
      }
    }
  }

  if (bestRival && (!nemesisBeatenFound || bestRival.oppId !== highlights.find((h) => h.type === 'nemesis_beaten')?.rivalId)) {
    highlights.push({
      type: 'arch_rival',
      rivalId: bestRival.oppId,
      rivalName: getEntityName(db, bestRival.oppId),
      games: bestRival.total,
      myWins: bestRival.myWins,
      oppWins: bestRival.oppWins,
    })
  }

  // 5. Phong độ chạm đỉnh (Hot Streak): Chuỗi thắng hiện tại >= 3
  const { streak } = getMemberStreak(memberId, db)
  if (streak >= 3) {
    highlights.push({
      type: 'hot_streak',
      streak,
    })
  }

  return highlights
}

/**
 * Lọc danh sách người nhận thông báo: bỏ trùng, bỏ chính người gây ra sự kiện, và CHỈ giữ
 * thành viên CLB.
 *
 * Vế cuối là vế đã âm thầm làm hỏng cả tính năng: `notifications.member_id` có khoá ngoại tới
 * `club_members`, mà `match.playerKeys` trộn cả ID khách giao lưu. Một `.insert([...])` nhiều
 * dòng là ATOMIC — lọt một ID khách là Postgres từ chối cả lô, và không ai trong trận nhận
 * được gì, chỉ có một dòng console.warn không ai đọc.
 *
 * @param {string[]} recipients  ID người nhận (có thể lẫn khách, trùng, null)
 * @param {string|null} actorId  người gây ra sự kiện — không tự báo cho chính mình
 * @param {Set<string>} memberIds  ID của các thành viên CLB
 * @returns {string[]}
 */
export function notifyRecipients(recipients, actorId, memberIds) {
  return [...new Set((recipients || []).filter(Boolean))]
    .filter((id) => id !== actorId && memberIds.has(id))
}

/**
 * ID của những thành viên THẬT SỰ đọc được thông báo — truyền vào `notifyRecipients`.
 *
 * Phải có `userId`. RLS của `notifications` (migration 0038) cho đọc theo
 * `member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())`, nên dòng gửi cho
 * thành viên CHƯA liên kết tài khoản thì KHÔNG AI đọc được, mãi mãi — kể cả chính người đó.
 *
 * Không lọc thì mỗi sự kiện đẻ ra vài dòng chết: chúng chiếm chỗ trong cửa sổ 100 dòng mà
 * `reloadNotifications` lấy về (đẩy thông báo thật ra ngoài), và mỗi dòng còn kéo theo một lượt
 * gọi `push-send` chỉ để nhận lại `sentCount: 0`.
 *
 * CỐ Ý không lọc theo `active`: người đã ngưng hoạt động vẫn đọc được thông báo của mình —
 * RLS không kiểm cờ đó. Ở đây chỉ loại thứ vật lý không đọc nổi.
 */
export function notifiableMemberIds(members = []) {
  return new Set((members || []).filter((m) => m && m.id && m.userId).map((m) => m.id))
}

/**
 * Chuẩn hoá tỷ số chuỗi của đội thắng để số ván thắng luôn đứng trước (ví dụ "1-0", "2-1").
 */
export function formatWinnerSeriesScore(seriesScore) {
  if (!seriesScore) return '1-0'
  if (typeof seriesScore === 'object' && seriesScore !== null) {
    const wA = Number(seriesScore.winsA) || 0
    const wB = Number(seriesScore.winsB) || 0
    return `${Math.max(wA, wB)}-${Math.min(wA, wB)}`
  }
  const match = String(seriesScore).match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (match) {
    const s1 = parseInt(match[1], 10)
    const s2 = parseInt(match[2], 10)
    return `${Math.max(s1, s2)}-${Math.min(s1, s2)}`
  }
  return String(seriesScore)
}

/**
 * Lọc danh sách nạn nhân thực sự bị ngắt chuỗi (nếu payload gom cả đội thua nhưng chỉ 1 người có chuỗi).
 */
export function resolveBountyVictimIds(victimIds, item, db) {
  if (!Array.isArray(victimIds) || victimIds.length <= 1 || !db) return victimIds || []
  const p = item?.payload || {}
  const streakReq = p.streak
  if (!streakReq) return victimIds
  try {
    const matchId = p.matchId || item?.refId
    const mt = matchId ? (db?.matches || []).find((m) => m.id === matchId) : null
    const prevMatches = (db?.matches || []).filter((m) => m.id !== matchId && (mt?.at ? m.at < mt.at : true))
    const seasonMatches = seasonMatchesOf({ ...db, matches: prevMatches })
    const actualVictims = victimIds.filter((pid) => {
      const { streak } = getMemberStreak(pid, db, null, seasonMatches)
      return streak === streakReq || streak >= streakReq
    })
    return actualVictims.length > 0 ? actualVictims : victimIds
  } catch (err) {
    return victimIds
  }
}

/**
 * Trích xuất và giải mã tên hiển thị từ payload (chứa ID) phục vụ render giao diện và i18n
 */
export function resolveActivityPayload(item, db) {
  const p = item?.payload || {}
  const res = { ...p }

  if (item?.type === 'match_recorded') {
    // Ưu tiên ID trong payload; chỉ dò `db.matches` cho các dòng cũ chưa có `winnerIds`.
    // Tên luôn giải mã từ ID lúc render (RULES §3.3) — đổi tên thành viên là bảng tin đổi theo.
    const mt = !p.winnerIds ? (db?.matches || []).find((m) => m.id === p.matchId) : null
    const winTeam = p.winnerTeam || mt?.winnerTeam
    const winIds = p.winnerIds || (winTeam === 'A' ? mt?.teamA : mt?.teamB) || []
    const loseIds = p.loserIds || (winTeam === 'A' ? mt?.teamB : mt?.teamA) || []
    res.winners = formatTeamNames(db, winIds)
    res.losers = formatTeamNames(db, loseIds)
    res.score = p.score || mt?.scoreText || ''
    res.matchCode = p.matchCode || mt?.code || ''
    res.winnerIds = winIds
    res.loserIds = loseIds
  }

  if (item?.type === 'bounty_broken') {
    const victimIds = resolveBountyVictimIds(p.victimIds, item, db)
    res.breakers = p.breakers || formatTeamNames(db, p.breakerIds)
    res.victims = p.victims || formatTeamNames(db, victimIds)
    res.breakerIds = p.breakerIds || []
    res.victimIds = victimIds
  }

  if (item?.type === 'challenge_created') {
    res.challengers = p.challengers || formatTeamNames(db, p.challengerIds)
    res.opponents = p.opponents || formatTeamNames(db, p.opponentIds)
    res.challengerIds = p.challengerIds || []
    res.opponentIds = p.opponentIds || []
  }

  if (item?.type === 'challenge_completed') {
    res.winners = p.winners || formatTeamNames(db, p.winnerIds)
    res.losers = p.losers || formatTeamNames(db, p.loserIds)
    res.winnerIds = p.winnerIds || []
    res.loserIds = p.loserIds || []
    if (res.seriesScore) {
      res.seriesScore = formatWinnerSeriesScore(res.seriesScore)
    }
  }

  if (item?.type === 'member_joined') {
    res.name = p.name || getEntityName(db, p.memberId)
  }

  if (item?.type === 'session_opened' || item?.type === 'session_closed' || item?.type === 'session_cancelled') {
    if (p.date && p.date.includes('-')) {
      res.date = dd(p.date)
    }
  }

  return res
}

export function resolveNotificationPayload(item, db) {
  const p = item?.payload || {}
  const res = { ...p }

  if (item?.type === 'challenge_created') {
    const chal = (db?.challenges || []).find((c) => c.id === (item.refId || p.chalId))
    const creatorId = p.createdBy || p.creatorId || chal?.createdBy || p.challengerIds?.[0]
    // `p.creator` chỉ dùng cho dòng cũ đã lỡ ghi tên cứng xuống DB — dòng mới ghi ID thôi.
    res.creator = getEntityName(db, creatorId) || p.creator || formatTeamNames(db, p.challengerIds) || ''
    res.challengers = p.challengers || formatTeamNames(db, p.challengerIds)
  }

  if (item?.type === 'challenge_completed') {
    res.winners = p.winners || formatTeamNames(db, p.winnerIds)
    if (res.seriesScore) {
      res.seriesScore = formatWinnerSeriesScore(res.seriesScore)
    }
  }

  if (item?.type === 'bounty_broken') {
    const victimIds = resolveBountyVictimIds(p.victimIds, item, db)
    res.victims = p.victims || formatTeamNames(db, victimIds)
  }

  if (item?.type === 'match_recorded') {
    if (!res.matchCode && p.matchId) {
      const mt = (db?.matches || []).find((m) => m.id === p.matchId)
      res.matchCode = mt?.code || ''
      res.score = res.score || mt?.scoreText || ''
    }
  }

  if (item?.type === 'match_cancelled') {
    if (!res.matchCode && p.matchId) {
      const mt = (db?.matches || []).find((m) => m.id === p.matchId)
      res.matchCode = mt?.code || ''
    }
  }

  if (item?.type === 'claim_approved' || item?.type === 'claim_rejected') {
    const kindKey = p.kind ? `notification.kind_${p.kind}` : ''
    res.kind = kindKey ? t(kindKey) : (p.kind || '')
  }

  if (item?.type === 'claim_submitted' || item?.type === 'member_change_requested') {
    res.name = p.name || getEntityName(db, p.memberId)
  }

  // Tên trường là KEY dưới DB ('phone' / 'level') — nhãn tiếng Việt dựng lúc render, theo
  // RULES §3.3. Đổi câu chữ không được làm đổi dòng đã ghi.
  if (item?.type === 'member_change_requested'
    || item?.type === 'member_change_approved'
    || item?.type === 'member_change_rejected') {
    const fieldKey = p.field ? `notification.field_${p.field}` : ''
    res.field = fieldKey ? t(fieldKey) : (p.field || '')
  }

  if (item?.type === 'attendance_reported') {
    res.name = p.name || getEntityName(db, p.memberId)
    if (p.date && p.date.includes('-')) {
      res.date = dd(p.date)
    }
  }

  if (item?.type === 'session_rsvp_invite' || item?.type === 'session_cancelled') {
    if (p.date && p.date.includes('-')) {
      res.date = dd(p.date)
    }
  }

  // Chuông giải đấu (0059): payload lưu KEY nội dung ('md'…) — tên dịch lúc hiển thị (RULES §3.3).
  if (item?.type === 'tournament_match_ready' || item?.type === 'tournament_match_court') {
    res.event = p.kind ? t('tournament.kind.' + p.kind) : ''
    res.court = p.court || ''
  }

  if (item?.type === 'refund_session') {
    if (p.date && p.date.includes('-')) {
      res.date = dd(p.date)
    }
  }

  return res
}

/**
 * Tách tỷ số trận đấu / kèo thành điểm đội thắng (ws) và đội thua (ls)
 * Ví dụ: "21-19" -> { ws: '21', ls: '19', diff: 2 }
 * "21-15, 18-21, 22-20" -> { ws: '22', ls: '20', diff: 2 }
 */
export function parseScoreWinningLosing(scoreStr) {
  if (!scoreStr) return { ws: '', ls: '', diff: 0 }
  const str = String(scoreStr).trim()
  const parts = str.split(',').map((x) => x.trim()).filter(Boolean)
  const target = parts.length > 0 ? parts[parts.length - 1] : str
  const match = target.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (match) {
    const s1 = parseInt(match[1], 10)
    const s2 = parseInt(match[2], 10)
    const ws = Math.max(s1, s2)
    const ls = Math.min(s1, s2)
    return { ws: String(ws), ls: String(ls), diff: ws - ls }
  }
  return { ws: str, ls: '', diff: 0 }
}

export const AVATAR_PALETTE = [
  '#2B6F6A', '#5B4B8A', '#8A5A2B', '#2E5C8A', '#8A3B5C', '#4E7A3A',
  '#3B6E8F', '#7A4A3A', '#3A6E5A', '#8A4A7A', '#6A5A9A', '#9A5A4A',
  '#41607E', '#4A587E', '#4A6E7E', '#6A7A3A',
]

export function getAvatarBg(id = '', name = '') {
  const str = id || name || ''
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

export function getPlayerInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  // `Array.from` tách theo ký tự thật — `word[0]` cắt đôi emoji đầu tên thành ký tự hỏng.
  const first = (word) => Array.from(word)[0]
  if (parts.length === 1) return first(parts[0]).toUpperCase()
  return (first(parts[0]) + first(parts[parts.length - 1])).toUpperCase()
}

export function getPlayerProfile(db, id) {
  if (!id) return { id: '', name: '', ini: '?', bg: '#4A587E', avatarUrl: '' }
  const m = (db?.members || []).find((x) => x.id === id)
  if (m) {
    return {
      id: m.id,
      name: m.name,
      ini: getPlayerInitials(m.name),
      bg: getAvatarBg(m.id, m.name),
      avatarUrl: m.avatarUrl || m.avatar_url || '',
    }
  }
  const g = (db?.guests || []).find((x) => x.id === id)
  if (g) {
    return {
      id: g.id,
      name: g.name,
      ini: getPlayerInitials(g.name),
      bg: getAvatarBg(g.id, g.name),
      avatarUrl: g.avatarUrl || g.avatar_url || '',
    }
  }
  return {
    id,
    name: id,
    ini: getPlayerInitials(id),
    bg: getAvatarBg(id, id),
    avatarUrl: '',
  }
}

export function resolveTeamProfiles(db, ids = []) {
  const list = (ids || []).map((id, idx) => {
    const p = getPlayerProfile(db, id)
    return {
      ...p,
      sep: idx < ids.length - 1,
    }
  })
  return {
    list,
    names: list.map((p) => p.name).join(' & '),
    lead1: list[0] || null,
    lead2: list[1] || null,
  }
}

export function formatDateLabelUpper(dateObj, todayIso, yesterdayIso) {
  if (!dateObj || isNaN(dateObj.getTime())) return ''
  const iso = isoOf(dateObj)
  const dNum = dateObj.getDate()
  const mNum = dateObj.getMonth() + 1
  const monthWord = t('activity.monthName')
  const dateStr = `${dNum} ${monthWord} ${mNum}`.toUpperCase()

  if (todayIso && iso === todayIso) {
    return `${t('activity.today')} · ${dateStr}`.toUpperCase()
  }
  if (yesterdayIso && iso === yesterdayIso) {
    return `${t('activity.yesterday')} · ${dateStr}`.toUpperCase()
  }
  return dateStr
}

export function formatEventTime(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return ''
  const hh = String(dateObj.getHours()).padStart(2, '0')
  const mm = String(dateObj.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function resolveActivityRow2a(event, db, attachedStreak = null) {
  const p = resolveActivityPayload(event, db)
  const rawTs = event?.created_at || event?.createdAt
  const d = rawTs ? new Date(rawTs) : new Date()
  const tStr = formatEventTime(d)

  // 1. match_recorded
  if (event?.type === 'match_recorded') {
    const winIds = p.winnerIds || []
    const loseIds = p.loserIds || []
    const W = resolveTeamProfiles(db, winIds)
    const L = resolveTeamProfiles(db, loseIds)
    // `p.score` là `scoreText` của trận: một set thì là ĐIỂM ("21 – 19"), nhiều set thì là SỐ
    // SET THẮNG ("2 – 1"). Cột phải hiện nguyên như vậy, nhưng "cách N điểm" phải lấy điểm thật
    // từ các set — lấy từ "2 – 1" là ra "hơn đúng 1 điểm".
    const { ws, ls } = parseScoreWinningLosing(p.score)
    const mt = (db?.matches || []).find((m) => m.id === p.matchId)
    const setDiffs = (mt?.sets || [])
      .filter((s) => Array.isArray(s) && s.length >= 2)
      .map((s) => Math.abs(Number(s[0]) - Number(s[1])))
    const narrativeType = p.narrativeType || (mt ? detectMatchNarrative(mt) : 'normal')
    // Xét đúng set mà `detectMatchNarrative` dựa vào: áp đảo là set chênh nhất, còn lại là set cuối.
    const diff = setDiffs.length === 0 ? 0
      : narrativeType === 'blowout' ? Math.max(...setDiffs) : setDiffs[setDiffs.length - 1]
    const verb = t('activity.verb_' + narrativeType)
    // Không có điểm từng set (trận đã xoá) thì bỏ con số chứ không in "cách 0 điểm".
    const caption = diff > 0 || narrativeType === 'comeback'
      ? t('activity.cap_' + narrativeType, { diff })
      : t('activity.cap_' + narrativeType + '_plain')
    const capColor = narrativeType === 'clutch' ? 'var(--status-delayed-fg)'
      : narrativeType === 'blowout' ? 'var(--action-violet-bg)'
      : narrativeType === 'comeback' ? 'var(--status-delivered-fg)'
      : 'var(--text-muted)'

    const streak = attachedStreak?.streak || p.streak
    const victim = attachedStreak?.victimName || p.victim || (L.lead1?.name || '')
    const hasStreak = Boolean(streak)
    const streakText = hasStreak ? t('activity.streakText', { streak, victim }) : ''

    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'start',
      hasLeadAv: winIds.length > 0,
      lead1: W.lead1,
      lead2: W.lead2,
      hasLeadIcon: false,
      isMatch: true,
      W,
      L,
      verb,
      caption,
      capColor,
      hasStreak,
      streakText,
      ws,
      ls,
    }
  }

  // 2. challenge_completed
  if (event?.type === 'challenge_completed') {
    const winIds = p.winnerIds || []
    const loseIds = p.loserIds || []
    const W = resolveTeamProfiles(db, winIds)
    const L = resolveTeamProfiles(db, loseIds)
    const { ws, ls } = parseScoreWinningLosing(p.seriesScore || '1-0')
    const code = p.code || ''

    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'start',
      hasLeadAv: winIds.length > 0,
      lead1: W.lead1,
      lead2: W.lead2,
      hasLeadIcon: false,
      isResolved: true,
      code,
      W,
      L,
      ws,
      ls,
    }
  }

  // 3. challenge_created
  if (event?.type === 'challenge_created') {
    const code = p.code || ''
    const chalId = event.ref_id || event.refId || p.chalId
    const chal = (db?.challenges || []).find((c) => c.id === chalId || (code && c.code === code))
    const challengerIds = p.challengerIds || chal?.teamA || []
    const opponentIds = p.opponentIds || chal?.teamB || []
    const A = resolveTeamProfiles(db, challengerIds)
    const B = resolveTeamProfiles(db, opponentIds)
    // Nhãn dùng chung bộ `challenge.status.*` với Sàn kèo — hai nơi phải nói cùng một chữ.
    // Không còn thấy kèo thì để trống: đoán "Chờ nhận" là nói sai về một kèo đã xong từ lâu.
    //
    // Từ chối và hết hạn CHUNG một nhãn "Không thành". Bảng tin là cả CLB đọc: tách riêng
    // "Từ chối" là chỉ ra đội B đã từ chối — ngược với từ chối âm thầm ở `respondChallenge`.
    // `isChallengeExpired` bắt luôn kèo 'pending' đã quá hạn nhận mà chưa ai quét sang 'expired'.
    const keoStatus = !chal ? ''
      : chal.status === 'declined' || isChallengeExpired(chal) ? t('activity.statusVoid')
      : chal.status === 'accepted' ? t('activity.statusAccepted')
      : ['pending', 'oncourt', 'played', 'cancelled'].includes(chal.status)
        ? t('challenge.status.' + chal.status)
        : ''

    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'start',
      hasLeadAv: challengerIds.length > 0,
      lead1: A.lead1,
      lead2: A.lead2,
      hasLeadIcon: false,
      isKeo: true,
      code,
      A,
      B,
      keoStatus,
    }
  }

  // 4. challenge_accepted
  if (event?.type === 'challenge_accepted') {
    const code = p.code || ''
    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'center',
      hasLeadAv: false,
      hasLeadIcon: true,
      icon: '✓',
      iconBg: 'var(--status-transit-bg)',
      iconFg: 'var(--status-transit-fg)',
      singleAccept: true,
      code,
    }
  }

  // 5. session_opened
  if (event?.type === 'session_opened') {
    const dateStr = p.date || ''
    const title = dateStr ? t('activity.sessionTitle', { date: dateStr }) : t('activity.sessionDefault')
    const sessionId = p.sessionId || event.ref_id || event.refId
    const sess = (db?.sessions || []).find((s) => s.id === sessionId)
    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'start',
      hasLeadAv: false,
      hasLeadIcon: true,
      icon: '📋',
      iconBg: 'var(--status-scheduled-bg)',
      iconFg: 'var(--status-scheduled-fg)',
      isSession: true,
      title,
      sessionId,
      // Chỉ mời điểm danh khi buổi CÒN mở — buổi đã chốt/huỷ mà vẫn "Điểm danh ngay" là nói dối.
      canRsvp: sess?.status === 'open',
    }
  }

  // 6. challenge_cancelled / challenge_declined
  if (event?.type === 'challenge_cancelled' || event?.type === 'challenge_declined') {
    const code = p.code || ''
    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'center',
      hasLeadAv: false,
      hasLeadIcon: true,
      icon: '✕',
      iconBg: 'var(--status-incident-bg)',
      iconFg: 'var(--status-incident-fg)',
      isCancel: true,
      code,
    }
  }

  // 7. bounty_broken (standalone)
  if (event?.type === 'bounty_broken') {
    const breakerIds = p.breakerIds || []
    const victimIds = p.victimIds || []
    const breakers = resolveTeamProfiles(db, breakerIds)
    const victims = resolveTeamProfiles(db, victimIds)
    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'start',
      hasLeadAv: false,
      hasLeadIcon: true,
      icon: '🔥',
      iconBg: 'var(--status-incident-bg)',
      iconFg: 'var(--status-incident-fg)',
      isBounty: true,
      breakers,
      victims,
      streak: p.streak || 0,
    }
  }

  // 8. member_joined
  if (event?.type === 'member_joined') {
    const name = p.name || getEntityName(db, p.memberId)
    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'center',
      hasLeadAv: false,
      hasLeadIcon: true,
      icon: '👋',
      iconBg: 'var(--surface-brand-soft)',
      iconFg: 'var(--text-link)',
      isMemberJoined: true,
      name,
    }
  }

  // 9. session_closed / session_cancelled
  if (event?.type === 'session_closed' || event?.type === 'session_cancelled') {
    const isClosed = event.type === 'session_closed'
    const dateStr = p.date || ''
    const title = dateStr ? t('activity.sessionTitle', { date: dateStr }) : t('activity.sessionDefault')
    return {
      id: event.id,
      type: event.type,
      rawTs,
      t: tStr,
      align: 'center',
      hasLeadAv: false,
      hasLeadIcon: true,
      icon: isClosed ? '✅' : '✕',
      iconBg: isClosed ? 'var(--status-delivered-bg)' : 'var(--status-incident-bg)',
      iconFg: isClosed ? 'var(--status-delivered-fg)' : 'var(--status-incident-fg)',
      isSessionState: true,
      isClosed,
      title,
    }
  }

  // Fallback
  return {
    id: event.id,
    type: event.type,
    rawTs,
    t: tStr,
    align: 'center',
    hasLeadAv: false,
    hasLeadIcon: true,
    icon: '⚡',
    iconBg: 'var(--surface-sunken)',
    iconFg: 'var(--text-accent)',
    isFallback: true,
    text: t('activity.' + event.type, p),
  }
}

/**
 * Đích khi bấm một dòng Bảng tin: kèo → Sàn kèo (làm nổi bật đúng kèo), buổi → trang buổi.
 * URL dựng bằng `buildPushUrl` để Bảng tin và thông báo đẩy luôn đi cùng một chỗ.
 *
 * `null` (dòng không bấm được) khi:
 *   - Thứ đó không còn trong db — đưa người ta tới một màn trống là tệ hơn không đưa.
 *   - Kèo "Không thành" (từ chối / hết hạn). Thẻ kèo trên Sàn kèo ghi rõ "Từ chối", mở nó cho
 *     cả CLB là lộ lại đúng điều Bảng tin vừa giấu. Hết hạn cũng khoá theo — khoá riêng từ chối
 *     thì dòng bấm được hay không lại thành dấu hiệu để đoán.
 */
export function activityLinkOf(event, db) {
  const refType = event?.ref_type || event?.refType
  const refId = event?.ref_id || event?.refId
  if (!refId) return null
  if (refType === 'challenge') {
    const chal = (db?.challenges || []).find((c) => c.id === refId)
    if (!chal || chal.status === 'declined' || isChallengeExpired(chal)) return null
    return buildPushUrl({ refType, refId })
  }
  if (refType === 'session') {
    return (db?.sessions || []).some((s) => s.id === refId) ? buildPushUrl({ refType, refId }) : null
  }
  return null
}

export function groupActivities2a(events = [], db = {}) {
  if (!Array.isArray(events) || events.length === 0) return []

  const bountyMap = new Map()
  for (const ev of events) {
    if (ev.type === 'bounty_broken') {
      const mId = ev.payload?.matchId || ev.ref_id || ev.refId
      if (mId) bountyMap.set(mId, ev)
    }
  }

  const matchIds = new Set(
    events
      .filter((e) => e.type === 'match_recorded')
      .map((e) => e.payload?.matchId || e.ref_id || e.refId)
      .filter(Boolean)
  )

  const effectiveEvents = events.filter((ev) => {
    if (ev.type === 'bounty_broken') {
      const mId = ev.payload?.matchId || ev.ref_id || ev.refId
      if (mId && matchIds.has(mId)) return false
    }
    return true
  })

  const todayIso = isoOf(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = isoOf(yesterday)

  const dayMap = new Map()
  for (const ev of effectiveEvents) {
    const rawTs = ev.created_at || ev.createdAt
    const d = rawTs ? new Date(rawTs) : new Date()
    const dateKey = !isNaN(d.getTime()) ? isoOf(d) : 'unknown'
    const mId = ev.payload?.matchId || ev.ref_id || ev.refId
    const attachedBounty = ev.type === 'match_recorded' && mId ? bountyMap.get(mId) : null
    const attachedStreak = attachedBounty
      ? {
          streak: attachedBounty.payload?.streak,
          victimName: formatTeamNames(db, resolveBountyVictimIds(attachedBounty.payload?.victimIds, attachedBounty, db)),
        }
      : null

    const row = { ...resolveActivityRow2a(ev, db, attachedStreak), link: activityLinkOf(ev, db) }
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dateKey,
        dateObj: d,
        labelUpper: formatDateLabelUpper(d, todayIso, yesterdayIso),
        items: [],
      })
    }
    dayMap.get(dateKey).items.push(row)
  }

  return Array.from(dayMap.values())
}


