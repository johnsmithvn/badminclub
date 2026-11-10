// Xì dách (bài dân gian kiểu blackjack Việt Nam). 2–8 người, chơi bằng điểm, không dính tiền.
//   Mỗi ván một người làm cái, lần lượt theo ghế (mỗi người làm cái `laps` lượt). Ai cũng được chia 2 lá úp.
//   Điểm: 2–10 theo số, J Q K = 10, A tính 1, 10 hoặc 11 khi trên tay 2 lá, 1 hoặc 10 khi từ 3 lá (chọn cách có lợi nhất).
//   Xì bàn = hai lá A; xì dách = A + 10 / J / Q / K. Vừa chia xong: cái có xì thì lật bài ngay; con có xì thì lật lá,
//   ngồi chờ (thắng cái trừ khi cái cũng xì).
//   Lượt: các con lần lượt sau cái, rồi tới cái. Đến lượt thì Rút (tối đa 5 lá) hoặc Dằn — con dằn khi đủ 16 điểm, cái dằn
//   khi đủ 15. Trên 21 là quắc (vẫn được dằn, không ai biết tới lúc lật). 5 lá mà không quá 21 là ngũ linh.
//   Cái dằn (hoặc rút đủ 5 lá) thì lật bài cả bàn, so từng con với cái:
//     xì bàn > xì dách > ngũ linh (ít điểm hơn thắng) > điểm thường (nhiều điểm hơn thắng); bằng nhau là hoà.
//     Quắc thua mọi bài không quắc; con và cái cùng quắc thì hoà.
//   Thắng thường ăn 1 điểm, thắng bằng xì bàn / xì dách / ngũ linh ăn 2.
//   Hết số ván → người còn ngồi nhiều điểm nhất thắng (bằng nhau cùng thắng).
//   Cái rời bàn giữa ván: ván đó bỏ. Con rời bàn: không tính ván đó.
//
// Bài trên tay KHÔNG nằm trong log (docs/GAMES.md §5.2): server chia (0098 game_hands ghế ≥ 0 của ván đang chơi, nọc ở
// ghế -1), log chỉ ghi { draw: true }. Bài con có xì ghi công khai trong { deal } (`xi`); lúc lật bài server ghi cả bàn
// vào nước cuối (`show`). Server kiểm điều kiện dằn (cần biết điểm) — ở đây chỉ chặn sai lượt.
// Đồng hồ lượt (opts.time giây, 0 = tắt) tính theo server từ created_at của nước trước: hết giờ máy bất kỳ gửi
// { timeout: true }, server đi thay người tới lượt (đủ tuổi thì dằn, chưa thì rút) và ghi như nước của người đó.
//
// Lá c = hạng * 4 + chất như tienlen.js: hạng 0..12 = 3 4 5 6 7 8 9 10 J Q K A 2.
// state = { started, n0, out[], round, rounds, banker, phase ('play' | 'done'), order[], turn, counts[], stood[],
//           xi { seat: lá }, show { seat: lá } | null, scores[], since, last, over, ply, opts }
// move  = { deal: { n, round, banker, xi, show? } } (server) · { deal: true } (xin chia ván mới) · { draw: true }
//         · { stand: true, show? } · { timeout: true } (client) / { draw | stand, timeout, show? } (server) · { out: true }

import { rankOf } from '#lib/games/tienlen.js'

export const ACE = 11
export const MAX_CARDS = 5
export const TIMES = [0, 20, 30, 45]
export const LAPS = [1, 2, 3]
export const optsOf = (o) => ({ time: TIMES.includes(o?.time) ? o.time : 30, laps: LAPS.includes(o?.laps) ? o.laps : 1 })
export const deadlineOf = (s) => (s.opts.time && s.phase === 'play' && s.turn != null && s.since != null && !s.over ? s.since + s.opts.time * 1000 : null)

const valOf = (c) => {
  const r = rankOf(c)
  return r <= 7 ? r + 3 : r <= 10 ? 10 : r === 12 ? 2 : 0
}

/** Điểm tốt nhất ≤ 21 (A chọn 1 / 10 / 11 khi 2 lá, 1 / 10 khi từ 3 lá); không cách nào ≤ 21 thì điểm nhỏ nhất. */
export function pointsOf(hand) {
  const aces = hand.filter((c) => rankOf(c) === ACE).length
  const base = hand.reduce((sum, c) => sum + valOf(c), 0)
  const opts = hand.length <= 2 ? [1, 10, 11] : [1, 10]
  let best = null
  let min = Infinity
  const rec = (k, sum) => {
    if (k === aces) {
      if (sum <= 21 && (best == null || sum > best)) best = sum
      min = Math.min(min, sum)
      return
    }
    for (const o of opts) rec(k + 1, sum + o)
  }
  rec(0, base)
  return best ?? min
}

/** Loại bài: 'xiban' · 'xidach' · 'ngulinh' · 'quac' · 'du' (điểm thường). */
export function kindOf(hand) {
  if (hand.length === 2) {
    const a = hand.filter((c) => rankOf(c) === ACE).length
    if (a === 2) return 'xiban'
    if (a === 1 && hand.some((c) => rankOf(c) >= 7 && rankOf(c) <= 10)) return 'xidach'
  }
  const p = pointsOf(hand)
  if (p > 21) return 'quac'
  return hand.length >= MAX_CARDS ? 'ngulinh' : 'du'
}
export const isXi = (hand) => ['xiban', 'xidach'].includes(kindOf(hand))
const LEVEL = { quac: 0, du: 1, ngulinh: 2, xidach: 3, xiban: 4 }
const SPECIAL = ['ngulinh', 'xidach', 'xiban']

/** Điểm con được (dương) / mất (âm) khi so với cái. */
export function payOf(player, banker) {
  const kp = kindOf(player)
  const kb = kindOf(banker)
  const pp = pointsOf(player)
  const pb = pointsOf(banker)
  let v
  if (kp === 'quac' || kb === 'quac') v = kp === kb ? 0 : kp === 'quac' ? -1 : 1
  else if (LEVEL[kp] !== LEVEL[kb]) v = LEVEL[kp] > LEVEL[kb] ? 1 : -1
  else if (kp === 'ngulinh') v = Math.sign(pb - pp)
  else if (kp === 'du') v = Math.sign(pp - pb)
  else v = 0
  const win = v > 0 ? kp : kb
  return v * (SPECIAL.includes(win) ? 2 : 1)
}

/** Ngưỡng dằn: con 16, cái 15. */
export const standMin = (s, seat) => (seat === s.banker ? 15 : 16)

const isN = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi
const isCards = (a) => Array.isArray(a) && a.length >= 2 && a.length <= MAX_CARDS && a.every((c) => isN(c, 0, 51))
const isHands = (o, n) => o && typeof o === 'object' && !Array.isArray(o) && Object.entries(o).every(([k, v]) => isN(Number(k), 0, n - 1) && isCards(v))

/** Lượt kế: người kế trong `order` chưa dằn, chưa rời. */
function advance(s) {
  const turn = s.order.find((y) => !s.stood[y] && !s.out[y]) ?? null
  return { ...s, turn }
}

/** Lật bài: so từng con (còn ngồi, có bài) với cái, cộng điểm, hết ván. */
function settle(s, show) {
  const scores = s.scores.slice()
  const won = {}
  const bh = show[s.banker]
  if (bh) {
    for (const [k, hand] of Object.entries(show)) {
      const y = Number(k)
      if (y === s.banker || s.out[y]) continue
      const v = payOf(hand, bh)
      won[y] = v
      scores[y] += v
      scores[s.banker] -= v
    }
  }
  return roundEnd({ ...s, scores, show, won })
}

function roundEnd(s) {
  const over = s.round + 1 >= s.rounds || s.out.filter((o) => !o).length < 2
  return { ...s, phase: 'done', turn: null, over }
}

const game = {
  id: 'xidach',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: { time: 30, laps: 1 },

  setup({ options } = {}) {
    return {
      started: false, n0: 0, out: [], round: -1, rounds: 0, banker: null, phase: null, order: [], turn: null, counts: [],
      stood: [], xi: {}, show: null, won: null, scores: [], since: null, last: null, over: false, ply: 0, opts: optsOf(options),
    }
  },

  validate(s, seat, move) {
    const d = move?.deal
    if (d === true) return s.started && s.phase === 'done' && !s.over && isN(seat, 0, s.n0 - 1) && !s.out[seat] ? null : 'games.err.badMove'
    if (d && typeof d === 'object') {
      const n = s.started ? s.n0 : d.n
      if (!isN(n, 2, 8) || (s.started && (s.phase !== 'done' || s.over)) || d.round !== s.round + 1) return 'games.err.badMove'
      if (!isN(d.banker, 0, n - 1) || (s.started && s.out[d.banker]) || !isHands(d.xi || {}, n)) return 'games.err.badMove'
      if (d.show != null && (!isHands(d.show, n) || !d.show[d.banker])) return 'games.err.badMove'
      return null
    }
    if (!s.started) return 'games.err.badMove'
    if (s.over) return 'games.err.over'
    if (!isN(seat, 0, s.n0 - 1) || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (s.phase !== 'play' || s.turn == null) return 'games.err.notYourTurn'
    // Hết giờ: client gửi { timeout } trơn; server ghi { draw | stand, timeout } — kiểm như nước của người tới lượt.
    if (move?.timeout === true && !move.draw && !move.stand) return s.opts.time ? null : 'games.err.badMove'
    const who = move?.timeout === true ? s.turn : seat
    if (who !== s.turn) return 'games.err.notYourTurn'
    if (move?.draw === true) return s.counts[who] < MAX_CARDS ? null : 'games.err.badMove'
    if (move?.stand === true) {
      if (move.show != null && (!isHands(move.show, s.n0) || !move.show[s.banker])) return 'games.err.badMove'
      return null
    }
    return 'games.err.badMove'
  },

  /** Rút / dằn / hết giờ / chia ván: server điền (lá, lật bài) — máy này chờ bản server ghi. */
  request: (s, seat, move) => move?.out !== true,

  apply(s0, seat, move, meta) {
    const t = Date.parse(meta?.at)
    const at = Number.isFinite(t) ? t : null
    let s = { ...s0, ply: s0.ply + 1 }
    const d = move.deal
    if (d && typeof d === 'object') {
      const n = s.started ? s.n0 : d.n
      const out = s.started ? s.out : Array(n).fill(false)
      const xi = d.xi || {}
      const players = Array.from({ length: n - 1 }, (_, k) => (d.banker + 1 + k) % n).filter((y) => !out[y] && !xi[y])
      s = {
        ...s, started: true, n0: n, out, round: d.round, rounds: s.started ? s.rounds : s.opts.laps * n, banker: d.banker,
        phase: 'play', order: [...players, d.banker], counts: out.map((o) => (o ? 0 : 2)), stood: out.map((o, y) => o || !!xi[y]),
        xi, show: null, won: null, scores: s.started ? s.scores : Array(n).fill(0), since: at, last: { seat, deal: true },
      }
      return d.show ? settle({ ...s, last: { ...s.last, xiBanker: true } }, d.show) : advance(s)
    }
    if (move.out === true) {
      s = { ...s, out: s.out.map((o, i) => o || i === seat), last: { seat, out: true } }
      if (s.phase !== 'play') return s.out.filter((o) => !o).length < 2 ? { ...s, over: true } : s
      if (seat === s.banker) return roundEnd({ ...s, show: null, won: null })
      return advance(s)
    }
    const who = move.timeout === true ? s.turn : seat
    const last = { seat: who, ...(move.timeout ? { timeout: true } : {}) }
    s = { ...s, since: at }
    if (move.draw === true) {
      const counts = s.counts.map((k, i) => (i === who ? k + 1 : k))
      s = { ...s, counts, last: { ...last, draw: true } }
      if (counts[who] < MAX_CARDS) return s
      s = { ...s, stood: s.stood.map((v, i) => v || i === who) }
    } else {
      s = { ...s, stood: s.stood.map((v, i) => v || i === who), last: { ...last, stand: true } }
    }
    if (who === s.banker) return move.show ? settle(s, move.show) : roundEnd(s)
    return advance(s)
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    const pool = s.scores.map((_, i) => i).filter((i) => !s.out[i])
    const from = pool.length ? pool : s.scores.map((_, i) => i)
    const best = Math.max(...from.map((i) => s.scores[i]))
    return { winners: from.filter((i) => s.scores[i] === best), draw: false, scores: Object.fromEntries(s.scores.map((v, i) => [i, v])) }
  },
}

export default game
