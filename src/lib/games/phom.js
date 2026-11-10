// Phỏm / Tá lả (bài dân gian miền Bắc). 2–4 người, bộ 52 lá, chơi bằng điểm, không dính tiền.
//   Thứ tự lá A 2 3 … 10 J Q K (A nhỏ nhất); điểm A = 1 … J = 11, Q = 12, K = 13.
//   Phỏm = 3+ lá cùng số (phỏm ngang) hoặc 3+ lá cùng chất liền số (phỏm dọc, không vòng K → A).
//   Người đi đầu 10 lá, còn lại 9 lá; bài thừa là nọc. Người đi đầu đánh một lá rác. Tới lượt: ĂN lá người trước vừa
//   đánh (phải ghép được phỏm với bài trên tay) hoặc BỐC một lá nọc, rồi đánh một lá rác.
//   Lá đã ăn và các lá ghép cùng nó bị khoá: không đánh, không gửi được, lúc hạ phải nằm trong cùng một phỏm (thêm lá
//   cho dài thì được); một phỏm không chứa hai lá ăn.
//   Mỗi người đánh đúng 4 lá rác. Lượt thứ 4: bốc / ăn xong thì HẠ các phỏm (không hạ được phỏm nào là MÓM), rồi được GỬI
//   lá lẻ vào phỏm người đã hạ trước, rồi đánh lá cuối. Ai cũng đánh đủ 4 lá thì tính điểm bài còn trên tay.
//   Ù: vừa bốc / ăn mà cả tay (10 lá) xếp được thành phỏm, hoặc phỏm hết trừ đúng một lá → thắng ngay.
//   Xếp hạng: ít điểm nhất là Nhất (bằng điểm thì ai hạ trước đứng trên); móm xếp sau mọi người hạ được; người rời bàn bét.
//   Trả điểm: Nhì trả Nhất 1, Ba trả 2, Bét trả 3, móm / rời bàn trả 4 · bị ăn một lá trả người ăn 1, bị ăn lá chốt (người ăn đang ở
//   lượt thứ 4) trả 4 · ù: mỗi người trả người ù 5; người ù ăn đủ 3 lá của cùng một người thì người đó đền cả làng.
//   Không làm: ù khan, ù tròn, chuyển phỏm / né hạ, thêm vòng (luật nhà từng nơi mỗi khác).
//
// Bài trên tay KHÔNG nằm trong log (docs/GAMES.md §5.2): server chia và giữ (0090 game_hands ghế ≥ 0, nọc ở ghế -1,
// nhóm bị khoá của ghế s ở ghế -10 - s). Log: { draw: true } · { eat: true } (lá ghép giấu đi) · { discard: lá } ·
// { lay: [[lá…]…] } · { send: { card, to, group } } · { u: [[lá…]…], rest } — hạ / gửi / ù là lộ bài nên ghi công khai.
// Server kiểm mọi nước có dính bài trên tay và chấm điểm (cần bài còn lại). Ở đây chỉ kiểm phần công khai.
// Đồng hồ lượt (opts.time giây, 0 = tắt) theo server: hết giờ máy bất kỳ gửi { timeout: true }, server đi thay người tới
// lượt (bốc · hạ các nhóm bị khoá · đánh lá to nhất không bị khoá) và ghi như nước của người đó.
//
// Lá c = hạng * 4 + chất như tienlen.js (hạng 0..12 = 3 … 10 J Q K A 2) để dùng chung lá bài; đổi sang số Phỏm bằng valOf.
// state = { started, n, first, out[], counts[], turn, step ('take' | 'lay' | 'discard'), turns[], piles[seat][], top,
//           eaten[seat][], laid[seat] (null | [[lá]]), layOrder[], eats[{ from, to, chot }], u, since, over, last, ply, opts }
//   top = lá rác vừa đánh còn ăn được { card, seat } | null

import { rankOf, suitOf } from '#lib/games/tienlen.js'

export const TURNS = 4
export const TIMES = [0, 20, 30, 45]
export const optsOf = (o) => ({ time: TIMES.includes(o?.time) ? o.time : 30 })
export const deadlineOf = (s) => (s.opts.time && s.started && !s.over && s.turn != null && s.since != null ? s.since + s.opts.time * 1000 : null)

/** Số Phỏm của lá: A = 1, 2 … 10, J 11, Q 12, K 13. */
export const valOf = (c) => {
  const r = rankOf(c)
  return r <= 10 ? r + 3 : r === 11 ? 1 : 2
}

/** Phỏm hợp lệ: 3+ lá cùng số, hoặc 3+ lá cùng chất liền số. */
export function isPhom(cards) {
  if (!Array.isArray(cards) || cards.length < 3 || new Set(cards).size !== cards.length) return false
  const vs = cards.map(valOf)
  if (vs.every((v) => v === vs[0])) return true
  if (!cards.every((c) => suitOf(c) === suitOf(cards[0]))) return false
  const sorted = [...vs].sort((a, b) => a - b)
  return sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)
}

export const pointsOf = (hand) => hand.reduce((sum, c) => sum + valOf(c), 0)

/** Mọi phỏm (tập con) lấy được từ `cards`. */
function phomsIn(cards) {
  const out = []
  const byVal = new Map()
  for (const c of cards) byVal.set(valOf(c), [...(byVal.get(valOf(c)) || []), c])
  for (const g of byVal.values()) {
    if (g.length >= 3) out.push(g)
    if (g.length === 4) for (let k = 0; k < 4; k++) out.push(g.filter((_, i) => i !== k))
  }
  for (let su = 0; su < 4; su++) {
    const cs = cards.filter((c) => suitOf(c) === su).sort((a, b) => valOf(a) - valOf(b))
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 2; j < cs.length; j++) {
        const run = cs.slice(i, j + 1)
        if (isPhom(run)) out.push(run)
      }
    }
  }
  return out
}

/**
 * Cách hạ tốt nhất (ít điểm còn lại nhất) của một tay: mỗi nhóm khoá (`locks`) phải nằm trọn trong một phỏm,
 * một phỏm không chứa hai nhóm khoá. Trả { groups, rest, points } hoặc null nếu không xếp nổi các nhóm khoá.
 */
export function bestLay(hand, locks = []) {
  const all = phomsIn(hand)
  const lockOf = (g) => locks.filter((l) => l.every((c) => g.includes(c))).length
  const cands = all.filter((g) => lockOf(g) <= 1 && locks.every((l) => l.every((c) => g.includes(c)) || l.every((c) => !g.includes(c))))
  let best = null
  const rec = (k, used, groups) => {
    if (k === cands.length) {
      if (!locks.every((l) => groups.some((g) => l.every((c) => g.includes(c))))) return
      const rest = hand.filter((c) => !used.has(c))
      const points = pointsOf(rest)
      if (!best || points < best.points || (points === best.points && rest.length < best.rest.length)) best = { groups, rest, points }
      return
    }
    rec(k + 1, used, groups)
    const g = cands[k]
    if (g.some((c) => used.has(c))) return
    rec(k + 1, new Set([...used, ...g]), [...groups, g])
  }
  rec(0, new Set(), [])
  return best
}

/** Ù được không: cả tay xếp thành phỏm, hoặc còn đúng một lá lẻ. */
export function uOf(hand, locks = []) {
  const b = bestLay(hand, locks)
  return b && b.rest.length <= 1 ? b : null
}

/** Lá ghép tốt nhất để ăn `card`: [lá…] (2+ lá chưa khoá) sao cho vẫn hạ được mọi nhóm khoá, hoặc null. */
export function eatWith(hand, locks, card) {
  const free = hand.filter((c) => !locks.some((l) => l.includes(c)))
  let best = null
  for (const g of phomsIn([...free, card])) {
    if (!g.includes(card)) continue
    const w = g.filter((c) => c !== card)
    const lay = bestLay([...hand, card], [...locks, g])
    if (lay && (!best || lay.points < best.points)) best = { with: w, points: lay.points }
  }
  return best?.with || null
}

const isN = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi
const isCard = (c) => isN(c, 0, 51)
const isGroups = (g) => Array.isArray(g) && g.every((x) => Array.isArray(x) && x.every(isCard))

/** Ghế còn chơi kế sau `from` chưa đánh đủ 4 lá. */
function nextOf(s, from) {
  for (let k = 1; k <= s.n; k++) {
    const y = (from + k) % s.n
    if (!s.out[y] && s.turns[y] < TURNS) return y
  }
  return null
}

const game = {
  id: 'phom',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: { time: 30 },

  setup({ options } = {}) {
    return {
      started: false, n: 0, first: null, out: [], counts: [], turn: null, step: null, turns: [], piles: [], top: null,
      eaten: [], laid: [], layOrder: [], eats: [], u: null, since: null, over: false, last: null, ply: 0, opts: optsOf(options),
    }
  },

  validate(s, seat, move) {
    const d = move?.deal
    if (d && typeof d === 'object') {
      return !s.started && isN(d.n, 2, 4) && isN(d.first, 0, d.n - 1) && seat === d.first ? null : 'games.err.badMove'
    }
    if (!s.started) return 'games.err.badMove'
    if (s.over) return 'games.err.over'
    if (!isN(seat, 0, s.n - 1) || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (s.turn == null) return 'games.err.notYourTurn'
    const timeout = move?.timeout === true
    if (timeout && !move.draw && !move.lay && move.discard === undefined) return s.opts.time ? null : 'games.err.badMove'
    const who = timeout ? s.turn : seat
    if (who !== s.turn) return 'games.err.notYourTurn'
    if (move?.draw === true) return s.step === 'take' ? null : 'games.err.badMove'
    if (move?.eat === true) return s.step === 'take' && s.top && !s.out[s.top.seat] ? null : 'games.err.badMove'
    if (move?.u !== undefined) {
      if (s.step === 'take' || !isGroups(move.u) || !move.u.every(isPhom)) return 'games.err.badMove'
      return s.turns[who] < TURNS && !s.laid[who] ? null : 'games.err.badMove'
    }
    if (move?.lay !== undefined) {
      if (s.step !== 'lay' || !isGroups(move.lay) || !move.lay.every(isPhom)) return 'games.err.badMove'
      const eaten = s.eaten[who]
      if (!eaten.every((c) => move.lay.filter((g) => g.includes(c)).length === 1)) return 'games.err.badLay'
      if (move.lay.some((g) => g.filter((c) => eaten.includes(c)).length > 1)) return 'games.err.badLay'
      return null
    }
    if (move?.send !== undefined) {
      const { card, to, group } = move.send || {}
      if (s.step !== 'discard' || !s.laid[who] || !isCard(card) || !isN(to, 0, s.n - 1) || to === who) return 'games.err.badMove'
      const g = s.laid[to]?.[group]
      return g && isPhom([...g, card]) ? null : 'games.err.badMove'
    }
    if (move?.discard !== undefined) {
      if (s.step !== 'discard' || !isCard(move.discard)) return 'games.err.badMove'
      return s.eaten[who].includes(move.discard) ? 'games.err.locked' : null
    }
    return 'games.err.badMove'
  },

  /** Mọi nước đụng bài trên tay: server điền / kiểm — máy này chờ bản server ghi. */
  request: (s, seat, move) => move?.out !== true,

  apply(s0, seat, move, meta) {
    const t = Date.parse(meta?.at)
    const at = Number.isFinite(t) ? t : null
    let s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const { n, first } = move.deal
      return {
        ...s, started: true, n, first, out: Array(n).fill(false), counts: Array.from({ length: n }, (_, i) => (i === first ? 10 : 9)),
        turn: first, step: 'discard', turns: Array(n).fill(0), piles: Array.from({ length: n }, () => []),
        eaten: Array.from({ length: n }, () => []), laid: Array(n).fill(null), since: at, last: null,
      }
    }
    if (move.out === true) {
      s = { ...s, out: s.out.map((o, i) => o || i === seat), last: { seat, out: true } }
      if (s.top?.seat === seat) s = { ...s, top: null }
      if (seat !== s.turn) return s
      const turn = nextOf(s, seat)
      return turn == null ? { ...s, turn: null, over: true } : { ...s, turn, step: 'take', since: at }
    }
    const who = move.timeout === true ? s.turn : seat
    const last = { seat: who, ...(move.timeout ? { timeout: true } : {}) }
    const inc = (arr, k) => arr.map((x, i) => (i === who ? x + k : x))
    s = { ...s, since: at }
    if (move.draw === true || move.eat === true) {
      const step = s.turns[who] === TURNS - 1 ? 'lay' : 'discard'
      if (move.draw) return { ...s, counts: inc(s.counts, 1), step, last: { ...last, draw: true } }
      const { card, seat: from } = s.top
      return {
        ...s, counts: inc(s.counts, 1), step, top: null,
        piles: s.piles.map((p, i) => (i === from ? p.filter((c) => c !== card) : p)),
        eaten: s.eaten.map((e, i) => (i === who ? [...e, card] : e)),
        eats: [...s.eats, { from, to: who, chot: s.turns[who] === TURNS - 1 }],
        last: { ...last, eat: card, from },
      }
    }
    if (move.u !== undefined) {
      return { ...s, u: who, over: true, turn: null, laid: s.laid.map((l, i) => (i === who ? move.u : l)), last: { ...last, u: true } }
    }
    if (move.lay !== undefined) {
      const k = move.lay.reduce((sum, g) => sum + g.length, 0)
      return {
        ...s, counts: inc(s.counts, -k), step: 'discard', laid: s.laid.map((l, i) => (i === who ? move.lay : l)),
        layOrder: [...s.layOrder, who], last: { ...last, lay: true, mom: !move.lay.length },
      }
    }
    if (move.send !== undefined) {
      const { card, to, group } = move.send
      return {
        ...s, counts: inc(s.counts, -1),
        laid: s.laid.map((l, i) => (i === to ? l.map((g, j) => (j === group ? [...g, card] : g)) : l)),
        last: { ...last, send: card, to },
      }
    }
    // Đánh rác.
    const c = move.discard
    s = {
      ...s, counts: inc(s.counts, -1), turns: inc(s.turns, 1), piles: s.piles.map((p, i) => (i === who ? [...p, c] : p)),
      top: { card: c, seat: who }, last: { ...last, discard: c },
    }
    const turn = nextOf(s, who)
    return turn == null ? { ...s, turn: null, top: null, over: true } : { ...s, turn, step: 'take' }
  },

  view: (s) => s,

  /** Điểm cần bài còn trên tay — chỉ server chấm được (0090 game_phom_result). Ở đây chỉ báo đã hết ván. */
  result(s) {
    if (!s.over) return null
    return { winners: s.u != null ? [s.u] : [], draw: false, pending: true }
  },
}

/**
 * Chấm điểm khi hết ván (server làm y vậy — 0090): `hands` = bài còn trên tay từng ghế (sau hạ / gửi / đánh).
 * Trả { ranks, scores, points, mom }.
 */
export function finalOf(s, hands) {
  const seats = Array.from({ length: s.n }, (_, i) => i)
  const scores = Object.fromEntries(seats.map((i) => [i, 0]))
  const pay = (from, to, k) => { scores[from] -= k; scores[to] += k }
  for (const e of s.eats) pay(e.from, e.to, e.chot ? 4 : 1)
  const points = Object.fromEntries(seats.map((i) => [i, pointsOf(hands[i] || [])]))
  const left = seats.filter((i) => s.out[i])
  if (s.u != null) {
    const others = seats.filter((i) => i !== s.u)
    const byFrom = {}
    for (const e of s.eats) if (e.to === s.u) byFrom[e.from] = (byFrom[e.from] || 0) + 1
    const den = others.find((i) => (byFrom[i] || 0) >= 3)
    for (const i of others) pay(den ?? i, s.u, 5)
    return { ranks: [s.u, ...others.filter((i) => !s.out[i]), ...left], scores, points, mom: [] }
  }
  const at = (i) => s.layOrder.indexOf(i)
  const mom = seats.filter((i) => !s.out[i] && !(s.laid[i]?.length))
  const ok = seats.filter((i) => !s.out[i] && !mom.includes(i)).sort((a, b) => points[a] - points[b] || at(a) - at(b))
  const ranked = ok.length ? ok : [...mom].sort((a, b) => points[a] - points[b] || at(a) - at(b))
  const moms = ok.length ? mom.sort((a, b) => at(a) - at(b)) : []
  const ranks = [...ranked, ...moms, ...left]
  const top = ranks[0]
  ranked.forEach((i, k) => { if (k) pay(i, top, k) })
  for (const i of [...moms, ...left]) pay(i, top, 4)
  return { ranks, scores, points, mom: moms }
}

export default game
