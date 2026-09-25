/**
 * @file pairing.js
 * Ghép cặp / lập đội của một nội dung. Thuần: không React, không Supabase.
 * Rating dùng `registration.ratingSnapshot` (chụp lúc đăng ký), không đọc Elo sống.
 */

import { BALANCE_THRESHOLD, IMBALANCE_THRESHOLD } from '#lib/rating.js'

const rating = (r) => r.ratingSnapshot || 0

/** Thí sinh (đang đăng ký) của nội dung, kèm đội họ đang ở. */
export function eventPlayers(tour, eventId) {
  const regs = new Map(tour.registrations.filter((r) => r.status === 'registered').map((r) => [r.id, r]))
  const teamOf = new Map(tour.teamPlayers.filter((p) => p.eventId === eventId).map((p) => [p.registrationId, p.teamId]))
  return tour.entries
    .filter((e) => e.eventId === eventId && regs.has(e.registrationId))
    .map((e) => ({ ...regs.get(e.registrationId), teamId: teamOf.get(e.registrationId) || null }))
}

/** Đội của nội dung: thành viên (registration), tổng rating, đủ người chưa. */
export function eventTeams(tour, eventId) {
  const event = tour.events.find((e) => e.id === eventId)
  const regs = new Map(tour.registrations.map((r) => [r.id, r]))
  return tour.teams
    .filter((t) => t.eventId === eventId)
    .map((t) => {
      const players = tour.teamPlayers.filter((p) => p.teamId === t.id).map((p) => regs.get(p.registrationId)).filter(Boolean)
      return { ...t, players, sum: players.reduce((s, r) => s + rating(r), 0), full: players.length === (event?.teamSize || 2) }
    })
    .sort((a, b) => (a.drawNo ?? Infinity) - (b.drawNo ?? Infinity) || a.id.localeCompare(b.id))
}

/** Xáo Fisher–Yates với nguồn ngẫu nhiên truyền vào (test cần lặp lại được). */
export function shuffle(list, rand = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Ghép tự động những người CHƯA có cặp. Trả mảng cặp [a, b] (registration). Người lẻ không ghép.
 *   balanced: mạnh nhất + yếu nhất → tổng rating các cặp gần nhau.
 *   random:   bốc ngẫu nhiên.
 * `mixed` (đôi nam nữ) luôn ghép 1 nam + 1 nữ: balanced = nam mạnh→yếu với nữ yếu→mạnh.
 */
export function autoPair(pool, { genderRule, mode = 'balanced', rand = Math.random }) {
  const byDesc = (a, b) => rating(b) - rating(a) || a.id.localeCompare(b.id)
  if (genderRule === 'mixed') {
    const men = pool.filter((r) => r.gender === 'nam')
    const women = pool.filter((r) => r.gender === 'nu')
    const m = mode === 'random' ? shuffle(men, rand) : [...men].sort(byDesc)
    const w = mode === 'random' ? shuffle(women, rand) : [...women].sort(byDesc).reverse()
    return m.slice(0, Math.min(m.length, w.length)).map((man, i) => [man, w[i]])
  }
  const list = mode === 'random' ? shuffle(pool, rand) : [...pool].sort(byDesc)
  const pairs = []
  if (mode === 'random') {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]])
  } else {
    for (let i = 0, j = list.length - 1; i < j; i++, j--) pairs.push([list[i], list[j]])
  }
  return pairs
}

/**
 * Độ lệch = tổng rating cặp mạnh nhất − cặp yếu nhất (chỉ cặp đủ người).
 * Màu theo đúng ngưỡng "cân / lệch" đang dùng cho kèo đấu (rating.js) — không đặt số riêng.
 */
export function balanceOf(teams) {
  const sums = teams.filter((t) => t.full).map((t) => t.sum)
  if (sums.length < 2) return { spread: null, tone: 'idle', avg: sums[0] ?? null }
  const spread = Math.max(...sums) - Math.min(...sums)
  const tone = spread <= BALANCE_THRESHOLD ? 'ok' : spread <= IMBALANCE_THRESHOLD ? 'warn' : 'bad'
  return { spread, tone, avg: Math.round(sums.reduce((s, x) => s + x, 0) / sums.length) }
}

/**
 * Chốt đội hình được chưa. Trả key i18n của lý do đầu tiên, hoặc null.
 *   - ít nhất 2 đội; mọi đội đủ người; đôi nam nữ: đúng 1 nam + 1 nữ mỗi đội.
 * Đơn: đội sinh tự động lúc chốt (mỗi người một đội) nên chỉ cần ≥ 2 người.
 */
export function lineupIssue(event, teams, players) {
  if (event.teamSize === 1) return players.length >= 2 ? null : 'tournament.pairing.issueTooFew'
  if (teams.filter((t) => t.full).length < 2) return 'tournament.pairing.issueTooFew'
  if (teams.some((t) => !t.full)) return 'tournament.pairing.issueIncomplete'
  if (event.genderRule === 'mixed' && teams.some((t) => t.players.filter((p) => p.gender === 'nam').length !== 1)) {
    return 'tournament.pairing.issueMixed'
  }
  return null
}
