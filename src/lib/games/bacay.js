// Ba cây (so bài) — chủ dự án duyệt 2026-11-09 (docs/GAMES.md §12). 2–8 người, bộ 36 lá A…9 (bỏ 10, J, Q, K), không nhà cái.
//   - Chia mỗi người 3 lá úp. Không có lượt: ai cũng tự nặn bài rồi bấm Lật — lá lật hiện cho cả bàn. Mọi người lật xong
//     (hoặc đã rời) là hết ván.
//   - Điểm lá: A = 1, 2…9 đúng số. Nút = tổng 3 lá lấy hàng đơn vị (0…9).
//   - So: nút cao hơn thắng; bằng nút so lá to nhất — CHẤT trước (♦ > ♥ > ♠ > ♣), cùng chất so số (A > 9 > … > 2).
//     Hai tay không bao giờ chung một lá nên luôn phân được thắng — không có hoà.
//   - Người rời ván (nước { out }) thua, không được xét thắng.
//   - Điểm: người thắng ăn mỗi người khác 1 điểm. Cả bàn cộng lại bằng 0 → BXH xếp theo điểm.
//
// THÔNG TIN ẨN (docs/GAMES.md §5.2): bài ở game_hands. Server chia (0092 game_bacay_deal) rồi ghi nước 1 = { deal: { n } }.
// Máy khách gửi { flip: true }; server (game_bacay_fill) điền lá thật → log ghi { flip: true, cards }. Nên khi hết ván mọi
// lá cần so đã nằm trong log: result() ở đây tính được đủ, và game_bacay_result tính y vậy (bacay.test.js chạy chung bộ
// mẫu với file kiểm 0092). Đổi luật ở đây là phải đổi cả 0092.
//
// Lá c = 0..35 (cùng cách đánh số với Phỏm / Tiến lên, chỉ dùng phần A…9): hạng c >> 2 (0 = A … 8 = 9), chất c & 3 (♠ ♣ ♦ ♥).
// state = { started, n, cards[] (null = chưa lật), out[], over, act, ply }

import { rankOf, suitOf } from '#lib/games/phom.js'

export const HAND = 3
/** Bộ bài: A…9 bốn chất = lá 0..35. */
export const DECK = 36
export const PAY = 1
/** Sức mạnh chất theo chỉ số c & 3 (♠ ♣ ♦ ♥): ♦ > ♥ > ♠ > ♣. */
export const SUIT_POWER = [1, 0, 3, 2]

const isCard = (c) => Number.isInteger(c) && c >= 0 && c < DECK

/** Điểm một lá: A = 1 … 9 = 9. */
export const pipOf = (c) => rankOf(c) + 1
export const nutOf = (cards) => cards.reduce((a, c) => a + pipOf(c), 0) % 10
/** Độ to của lá khi so: chất trước, cùng chất thì A > 9 > … > 2. */
export const powerOf = (c) => SUIT_POWER[suitOf(c)] * 9 + (rankOf(c) === 0 ? 8 : rankOf(c) - 1)
export const topOf = (cards) => cards.reduce((a, c) => (powerOf(c) > powerOf(a) ? c : a))
const keyOf = (cards) => [nutOf(cards), powerOf(topOf(cards))]
const cmp = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

/**
 * Chấm ván — bản JS của game_bacay_score. `hands[ghế]` = 3 lá của ghế (người rời có thể null), `out[ghế]` = đã rời.
 * Người còn chơi xếp theo bài (mạnh trước), người rời xếp sau theo số ghế. null khi không còn ai để thắng.
 */
export function scoreOf(hands, out) {
  const n = hands.length
  const live = Array.from({ length: n }, (_, i) => i).filter((i) => !out[i])
  if (!live.length || live.some((i) => !Array.isArray(hands[i]) || hands[i].length !== HAND)) return null
  live.sort((a, b) => cmp(keyOf(hands[b]), keyOf(hands[a])))
  const w = live[0]
  const ranks = [...live, ...Array.from({ length: n }, (_, i) => i).filter((i) => out[i])]
  const scores = Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i), i === w ? PAY * (n - 1) : -PAY]))
  return { winners: [w], draw: false, ranks, scores }
}

const cardsOk = (cards, s) => Array.isArray(cards) && cards.length === HAND && cards.every(isCard)
  && new Set(cards).size === HAND && !s.cards.some((h) => h && h.some((c) => cards.includes(c)))

const settled = (s) => s.cards.every((h, i) => h || s.out[i]) || s.out.filter((o) => !o).length <= 1

export default {
  id: 'bacay',
  minPlayers: 2,
  maxPlayers: 8,
  defaultOptions: {},

  setup() {
    return { started: false, n: 0, cards: [], out: [], over: false, act: null, ply: 0 }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (move?.deal !== undefined) {
      const n = move.deal?.n
      return !s.started && seat === 0 && Number.isInteger(n) && n >= 2 && n <= 8 ? null : 'games.err.badMove'
    }
    if (!s.started || !Number.isInteger(seat) || seat < 0 || seat >= s.n || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (move?.flip !== true) return 'games.err.badMove'
    if (s.cards[seat]) return 'games.err.flipped'
    // Máy khách gửi { flip: true } — lá do server điền; nước trong log phải mang đủ 3 lá chưa ai lật.
    return move.cards === undefined || cardsOk(move.cards, s) ? null : 'games.err.badMove'
  },

  /** Lật bài cần server điền lá thật — màn chơi không hiện trước, ghi xong mới thấy. */
  request: (s, seat, move) => move?.flip === true,

  apply(s0, seat, move) {
    const s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const n = move.deal.n
      return { ...s, started: true, n, cards: Array(n).fill(null), out: Array(n).fill(false), act: null }
    }
    if (move.out === true) {
      const next = { ...s, out: s.out.map((o, i) => o || i === seat), act: { seat, out: true } }
      return { ...next, over: settled(next) }
    }
    if (!move.cards) return s // { flip } chưa có lá (chưa qua server) — không đổi gì
    const next = { ...s, cards: s.cards.map((h, i) => (i === seat ? move.cards.slice().sort((x, y) => x - y) : h)), act: { seat, flip: true } }
    return { ...next, over: settled(next) }
  },

  view: (s) => s,

  /** Ghế còn chưa lật — Mất kết nối chỉ xử những người này (registry.waitingOf). */
  waiting: (s) => (s.started && !s.over ? s.cards.map((h, i) => (h || s.out[i] ? -1 : i)).filter((i) => i >= 0) : []),

  result(s) {
    if (!s.over) return null
    const live = s.out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0)
    // Chỉ còn một người mà chưa lật (mọi người kia rời) — người đó thắng, không có điểm (server làm y vậy).
    if (live.length === 1 && !s.cards[live[0]]) return { winners: live, draw: false }
    return scoreOf(s.cards, s.out)
  },
}
