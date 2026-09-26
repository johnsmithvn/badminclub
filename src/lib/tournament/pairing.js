/**
 * @file pairing.js
 * Ghép cặp / lập đội của một nội dung. Thuần: không React, không Supabase.
 * Rating dùng `registration.ratingSnapshot` (chụp lúc đăng ký), không đọc Elo sống.
 */

import cfg from '#config/app.json' with { type: 'json' }
import { BALANCE_THRESHOLD, IMBALANCE_THRESHOLD, calcPairImpact } from '#lib/rating.js'

const PAIR = cfg.tournament.pairing
export const PAIR_MODES = ['balanced', 'seeded', 'chemistry', 'random']

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
    // Sort ỔN ĐỊNH (JS sort giữ nguyên thứ tự khi hoà) — trước khi bốc thăm mọi đội đều `drawNo: null` nên
    // hoà hết, giữ nguyên thứ tự `tour.teams` (đội mới ghép luôn ở cuối = "Cặp mới nhất"). KHÔNG thêm
    // tiebreak theo `id` (uuid ngẫu nhiên) — làm vậy đội mới sẽ rơi vào giữa danh sách trông như lỗi.
    .sort((a, b) => (a.drawNo ?? Infinity) - (b.drawNo ?? Infinity))
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
 * Ăn ý của 2 người = lịch sử đánh CHUNG một đội ở CLB (`db.matches`, dùng lại `calcPairImpact` của rating.js).
 * `known` = đã đánh chung đủ `chemistryMinGames` trận để tin được tỉ lệ thắng.
 * @returns {{ games: number, winPct: number, known: boolean }}
 */
export function chemistryOf(history, a, b) {
  const info = calcPairImpact(history || [], a.playerId, b.playerId)
  return { games: info.gamesCount, winPct: Math.round(info.actualWinPct), known: info.gamesCount >= PAIR.chemistryMinGames }
}

/**
 * Ghép tự động những người CHƯA có cặp. Trả mảng cặp [a, b] (registration). Người lẻ không ghép.
 *   balanced:  mạnh nhất + yếu nhất → tổng rating các cặp gần nhau.
 *   seeded:    mạnh + mạnh (1–2, 3–4…) → có cặp hạt giống rõ ràng.
 *   chemistry: cặp đã đánh chung nhiều và thắng nhiều ghép trước; người chưa có lịch sử ghép kiểu cân bằng.
 *   random:    bốc ngẫu nhiên.
 * Nam nữ: luôn 1 nam + 1 nữ, thừa bên nào thì bên đó chờ.
 * @param {object[]} [history]  `db.matches` — chỉ cần cho `chemistry`
 */
export function autoPair(pool, { genderRule, mode = 'balanced', rand = Math.random, history = [] }) {
  const byDesc = (a, b) => rating(b) - rating(a) || a.id.localeCompare(b.id)
  const mixed = genderRule === 'mixed'
  if (mode === 'chemistry') {
    const cand = []
    pool.forEach((a, i) => pool.slice(i + 1).forEach((b) => {
      if (mixed && a.gender === b.gender) return
      const c = chemistryOf(history, a, b)
      if (c.known) cand.push({ a, b, ...c })
    }))
    cand.sort((x, y) => y.winPct - x.winPct || y.games - x.games || x.a.id.localeCompare(y.a.id))
    const used = new Set()
    const pairs = []
    cand.forEach(({ a, b }) => {
      if (used.has(a.id) || used.has(b.id)) return
      used.add(a.id)
      used.add(b.id)
      pairs.push(mixed && a.gender !== 'nam' ? [b, a] : [a, b])
    })
    return [...pairs, ...autoPair(pool.filter((r) => !used.has(r.id)), { genderRule, mode: 'balanced' })]
  }
  if (mixed) {
    const men = pool.filter((r) => r.gender === 'nam')
    const women = pool.filter((r) => r.gender === 'nu')
    const m = mode === 'random' ? shuffle(men, rand) : [...men].sort(byDesc)
    const w = mode === 'random' ? shuffle(women, rand) : mode === 'seeded' ? [...women].sort(byDesc) : [...women].sort(byDesc).reverse()
    return m.slice(0, Math.min(m.length, w.length)).map((man, i) => [man, w[i]])
  }
  const list = mode === 'random' ? shuffle(pool, rand) : [...pool].sort(byDesc)
  const pairs = []
  if (mode === 'random' || mode === 'seeded') {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]])
  } else {
    for (let i = 0, j = list.length - 1; i < j; i++, j--) pairs.push([list[i], list[j]])
  }
  return pairs
}

/**
 * Nhận xét một cặp (handoff "Ghép cặp"): chỉ điều có căn cứ, không đoán. Trả danh sách key i18n + biến.
 *   · sai luật nam nữ · chênh trình trong cặp lớn (người yếu bị nhắm) · ăn ý / kém ăn ý (đã đánh chung đủ trận)
 *   · chưa có dữ liệu đánh chung · có khách (rating tự khai)
 * @param {object} team  từ `eventTeams` (players = registration)
 * @param {{ genderRule: string, history?: object[] }} opts
 * @returns {Array<{ tone: 'bad'|'warn'|'good'|'info', key: string, vars?: object }>}
 */
export function teamInsights(team, { genderRule, history = [] }) {
  const ps = team.players
  if (ps.length < 2) return []
  const out = []
  if (genderRule === 'mixed' && ps.filter((p) => p.gender === 'nam').length !== 1) {
    out.push({ tone: 'bad', key: 'tournament.pairing.insMixed' })
  }
  const gap = Math.round(Math.abs(rating(ps[0]) - rating(ps[1])))
  if (gap > PAIR.gapWarn) out.push({ tone: 'warn', key: 'tournament.pairing.insGap', vars: { n: gap } })
  const c = chemistryOf(history, ps[0], ps[1])
  if (!c.known) out.push({ tone: 'info', key: 'tournament.pairing.insNoHistory' })
  else if (c.winPct >= PAIR.chemGood) out.push({ tone: 'good', key: 'tournament.pairing.insChemGood' })
  else if (c.winPct <= PAIR.chemBad) out.push({ tone: 'warn', key: 'tournament.pairing.insChemBad' })
  else out.push({ tone: 'info', key: 'tournament.pairing.insChemMid' })
  if (ps.some((p) => p.playerType === 'guest')) out.push({ tone: 'info', key: 'tournament.pairing.insGuest' })
  return out
}

/** Tổng rating cặp so với trung bình các cặp đủ người; `warn` khi lệch quá `avgWarn` (handoff: tô vàng). */
export function vsAverage(teams) {
  const full = teams.filter((t) => t.full)
  if (!full.length) return {}
  const avg = full.reduce((s, t) => s + t.sum, 0) / full.length
  return Object.fromEntries(full.map((t) => {
    const d = Math.round(t.sum - avg)
    return [t.id, { diff: d, warn: Math.abs(d) > PAIR.avgWarn }]
  }))
}

/**
 * Gợi ý đổi 2 người giữa 2 đội chưa ghim để giảm độ lệch (handoff "gợi ý đổi"). Nam nữ: chỉ đổi cùng giới.
 * Chỉ gợi ý khi độ lệch giảm HƠN `swapMinGain` — đổi để được vài điểm thì không đáng làm BTC bận.
 * @param {object[]} teams  từ `eventTeams`
 * @returns {null | { teamA: string, regA: object, teamB: string, regB: object, before: number, after: number }}
 */
export function suggestSwap(teams, genderRule) {
  const full = teams.filter((t) => t.full)
  if (full.length < 2) return null
  const spreadOf = (sums) => Math.max(...sums) - Math.min(...sums)
  const before = spreadOf(full.map((t) => t.sum))
  let best = null
  full.forEach((ta, i) => full.slice(i + 1).forEach((tb) => {
    if (ta.pinned || tb.pinned) return
    ta.players.forEach((p) => tb.players.forEach((q) => {
      if (genderRule === 'mixed' && p.gender !== q.gender) return
      const d = rating(q) - rating(p)
      if (!d) return
      const after = spreadOf(full.map((t) => (t === ta ? t.sum + d : t === tb ? t.sum - d : t.sum)))
      if (before - after > PAIR.swapMinGain && (!best || after < best.after)) {
        best = { teamA: ta.id, regA: p, teamB: tb.id, regB: q, before, after }
      }
    }))
  }))
  return best
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
