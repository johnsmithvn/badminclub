// src/lib/activity.js
// Logic thuần xử lý sự kiện (Social Activity, Notifications & Personal Highlights).
// Không phụ thuộc Supabase hay React state, dễ dàng viết unit test.

import { getPlayerPartnersAndMatchups } from '#lib/rating.js'
import { getMemberStreak } from '#lib/badges.js'
import { seasonMatchesOf } from '#lib/season.js'
import { dd } from '#utils/dates.js'
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
  }

  if (item?.type === 'bounty_broken') {
    const victimIds = resolveBountyVictimIds(p.victimIds, item, db)
    res.breakers = p.breakers || formatTeamNames(db, p.breakerIds)
    res.victims = p.victims || formatTeamNames(db, victimIds)
  }

  if (item?.type === 'challenge_created') {
    res.challengers = p.challengers || formatTeamNames(db, p.challengerIds)
    res.opponents = p.opponents || formatTeamNames(db, p.opponentIds)
  }

  if (item?.type === 'challenge_completed') {
    res.winners = p.winners || formatTeamNames(db, p.winnerIds)
    res.losers = p.losers || formatTeamNames(db, p.loserIds)
    if (res.seriesScore) {
      res.seriesScore = formatWinnerSeriesScore(res.seriesScore)
    }
  }

  if (item?.type === 'member_joined') {
    res.name = p.name || getEntityName(db, p.memberId)
  }

  if (item?.type === 'bot_remark') {
    // Payload chỉ giữ `subject` (id) — tên giải mã lúc render như mọi loại khác (RULES §3.3).
    res.name = getEntityName(db, p.subject)
    res.bot = getEntityName(db, item.actor_id || item.actorId)
  }

  if (item?.type === 'arcade_played') {
    res.userName = getEntityName(db, item.actor_id || item.actorId)
    res.oppName = getEntityName(db, p.opponentId)
    res.stake = p.stake
    res.game = t(p.game === 'rps' ? 'bot.gameRps' : 'bot.gameCoin')
    res.outcome = p.outcome
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

  if (item?.type === 'refund_session') {
    if (p.date && p.date.includes('-')) {
      res.date = dd(p.date)
    }
  }

  return res
}


