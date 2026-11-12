// Nhà cái trong máy cho phòng chơi với máy (game bài): làm thay phần server ở phòng thật — chia bài, giữ bài từng tay,
// kiểm lá có trên tay, điền lá thật vào nước, lật bài, chấm điểm cần bài trên tay. Bám đúng SQL của từng game:
// Tiến lên 0078 / 0094 (game_tienlen_deal, thối ở _run) · Bài bịp 0082 (game_baibip_deal / _round / _fill) ·
// Phỏm 0090 (bản JS sẵn có: phom.js dealMove / referee / judge) · Xì dách 0098 (game_xidach_round / _fill).
// Đổi luật server là phải đổi cả ở đây (bots.test.js cho máy đấu máy qua đúng các hàm này).
//
// secret.cards (BotRoom giữ, máy chỉ được đọc tay của chính nó — handOf):
//   tienlen { hands[ghế] = 13 lá lúc chia (lá đã đánh lọc theo state.gone, như game_hands của 0078) }
//   baibip  { hands[ghế], wires[ghế] = dây nổ, last = lá vừa úp (ghế -2 của server) }
//   phom    { hands[ghế], stock = nọc }
//   xidach  { hands[ghế], deck = nọc }
// Mọi hàm ở đây SỬA `secret.cards` tại chỗ — BotRoom đưa vào bản sao, ghi lại khi nước hợp lệ.

import tienlen, { thoiOf, whiteOf } from '#lib/games/tienlen.js'
import baibip, { DECK as BB_DECK, HAND as BB_HAND, WIRES } from '#lib/games/baibip.js'
import phom, { HAND as PH_HAND, dealMove, judge, referee } from '#lib/games/phom.js'
import xidach, { isXi, MAX_CARDS, pointsOf, standMin } from '#lib/games/xidach.js'
import { shuffle } from '#lib/games/bots/search.js'

export const CARD_GAMES = ['tienlen', 'phom', 'baibip', 'xidach']
const RULES = { tienlen, baibip, phom, xidach }
const num = (a, b) => a - b
const range = (n) => Array.from({ length: n }, (_, i) => i)
const fail = (key) => { throw new Error(key) }

/** Ghế kế tiếp sau `from` chưa bị loại (vòng tròn, không tính chính nó); không ai thì `from`. */
const nextIn = (out, from) => {
  for (let k = 1; k <= out.length; k++) if (!out[(from + k) % out.length]) return (from + k) % out.length
  return from
}

// ---------- Tiến lên ----------

function tienlenStart(s, n, cards, rand, options) {
  const deck = shuffle(range(52), rand)
  cards.hands = range(n).map((i) => deck.slice(i * 13, i * 13 + 13).sort(num))
  // Ván đầu: ai cầm lá nhỏ nhất đi trước (phòng máy không có "ván chơi lại" nên luôn vậy).
  const lows = cards.hands.map((h) => h[0])
  const first = lows.indexOf(Math.min(...lows))
  const white = s.bac ? -1 : cards.hands.findIndex(whiteOf)
  const low = options?.lead === 'free' ? null : lows[first]
  return { seat: first, move: { deal: { first, low, n: Array(n).fill(13), white: white >= 0 ? white : null } } }
}

function tienlenFill(s, seat, move, cards) {
  if (Array.isArray(move?.play)) {
    const left = cards.hands[seat].filter((c) => !s.gone.includes(c))
    if (move.play.some((c) => !left.includes(c))) fail('games.err.notYourCard')
  }
  return move
}

/** Thối như _run của 0078 / 0094: ai còn bài (không phải người về Nhất, không rời ván) trả người về Nhất. Tới trắng thì thôi. */
function tienlenResult(s, cards) {
  const base = tienlen.result(s)
  if (!base || s.last?.white) return base
  const scores = { ...base.scores }
  const top = s.order[0]
  s.n0.forEach((_, i) => {
    if (i === top || s.left.includes(i)) return
    const v = thoiOf(cards.hands[i].filter((c) => !s.gone.includes(c)), s.bac)
    if (v > 0) { scores[i] -= v; scores[top] += v }
  })
  return { ...base, scores }
}

// ---------- Bài bịp ----------

/** Như game_baibip_round: xáo 20 lá, chia 5 lá cho người còn trụ, chọn lá chủ ngẫu nhiên. */
function baibipRound(out, first, cards, rand) {
  const deck = shuffle(range(BB_DECK), rand)
  let k = 0
  cards.hands = out.map((o) => (o ? [] : deck.slice(k * BB_HAND, ++k * BB_HAND).sort(num)))
  cards.last = []
  return { table: Math.floor(rand() * 3), n: out.map((o) => (o ? 0 : BB_HAND)), first }
}

function baibipStart(s, n, cards, rand) {
  cards.wires = range(n).map(() => Math.floor(rand() * WIRES))
  const first = Math.floor(rand() * n)
  return { seat: first, move: { deal: baibipRound(Array(n).fill(false), first, cards, rand) } }
}

function baibipFill(s, seat, move, cards, rand) {
  if (move?.deal === true) return { deal: baibipRound(s.out, seat, cards, rand) }
  if (Array.isArray(move?.play)) {
    const hand = cards.hands[seat]
    if (move.play.some((c) => !hand.includes(c))) fail('games.err.notYourCard')
    cards.hands[seat] = hand.filter((c) => !move.play.includes(c))
    cards.last = move.play.slice()
    return { play: move.play.length }
  }
  if (move?.call === true) {
    const liar = cards.last.some((c) => c < 18 && Math.floor(c / 6) !== s.table)
    const loser = liar ? s.lastPlay.seat : seat
    const out = { call: true, cards: cards.last.slice(), liar }
    // Người thua đã rời bàn (phòng máy không có ai rời — giữ cho khớp server): chia luôn, người kế sau họ đi trước.
    return s.out[loser] ? { ...out, deal: baibipRound(s.out, nextIn(s.out, loser), cards, rand) } : out
  }
  if (move?.cut !== undefined) {
    const boom = move.cut === cards.wires[seat]
    const out = s.out.map((o, i) => o || (boom && i === seat))
    if (out.filter((o) => !o).length <= 1) return { cut: move.cut, boom }
    return { cut: move.cut, boom, deal: baibipRound(out, boom ? nextIn(out, seat) : seat, cards, rand) }
  }
  return move
}

// ---------- Phỏm ----------

function phomStart(s, n, cards, rand) {
  const deck = shuffle(range(52), rand)
  const first = Math.floor(rand() * n)
  let k = 0
  cards.hands = range(n).map((i) => {
    const take = i === first ? PH_HAND + 1 : PH_HAND
    const h = deck.slice(k, k + take).sort(num)
    k += take
    return h
  })
  cards.stock = deck.slice(k)
  return { seat: first, move: dealMove(cards.hands, first, cards.stock.length) }
}

function phomFill(s, seat, move, cards) {
  const r = referee(s, cards.hands, cards.stock, seat, move)
  cards.hands = r.hands
  cards.stock = r.stock
  return r.move
}

// ---------- Xì dách ----------

/** Như game_xidach_round: xáo 52 lá, mỗi người còn ngồi 2 lá; ai có xì ghi vào `xi`, cái có xì thì lật bài luôn. */
function xidachRound(round, banker, out, cards, rand) {
  const deck = shuffle(range(52), rand)
  const xi = {}
  cards.hands = out.map((o, y) => {
    if (o) return []
    const h = deck.splice(0, 2)
    if (isXi(h)) xi[y] = h
    return h
  })
  cards.deck = deck
  const d = { n: out.length, round, banker, xi }
  return xi[banker] ? { ...d, show: xidachShow(cards) } : d
}

const xidachShow = (cards) => Object.fromEntries(cards.hands.map((h, y) => [y, h]).filter(([, h]) => h.length >= 2).map(([y, h]) => [y, h.slice()]))

function xidachStart(s, n, cards, rand) {
  return { seat: 0, move: { deal: xidachRound(0, 0, Array(n).fill(false), cards, rand) } }
}

function xidachFill(s, seat, move, cards, rand) {
  if (move?.deal === true) return { deal: xidachRound(s.round + 1, nextIn(s.out, s.banker), s.out, cards, rand) }
  if (move?.draw === true) {
    cards.hands[seat] = [...cards.hands[seat], cards.deck.shift()]
    const show = seat === s.banker && cards.hands[seat].length >= MAX_CARDS
    return show ? { draw: true, show: xidachShow(cards) } : { draw: true }
  }
  if (move?.stand === true) {
    if (pointsOf(cards.hands[seat]) < standMin(s, seat)) fail('games.err.notEnough')
    return seat === s.banker ? { stand: true, show: xidachShow(cards) } : { stand: true }
  }
  return move
}

// ---------- Chung ----------

const START = { tienlen: tienlenStart, baibip: baibipStart, phom: phomStart, xidach: xidachStart }
const FILL = { tienlen: tienlenFill, baibip: baibipFill, phom: phomFill, xidach: xidachFill }

/** Nước chia đầu ván (server ghi lúc bắt đầu) → { seat, move }, đồng thời chia bài vào `secret.cards`. */
export function dealStart(id, s, n, secret, rand = Math.random, options) {
  secret.cards = {}
  return START[id](s, n, secret.cards, rand, options)
}

/**
 * Nước người / máy gửi → nước ghi log (lá thật, lật bài, chia ván mới…), như game_<id>_fill. Kiểm luật công khai trước
 * (như server chạy _run trước _fill) rồi kiểm bài trên tay; sai thì throw Error(mã lỗi i18n).
 */
export function dealFill(id, s, seat, move, secret, rand = Math.random) {
  const e = RULES[id].validate(s, seat, move)
  if (e) fail(e)
  return FILL[id](s, seat, move, secret.cards, rand)
}

/** Kết quả cần bài trên tay (Phỏm: điểm rác · Tiến lên: thối) — như game_<id>_result. Game khác: kết quả của luật. */
export function dealResult(id, s, secret) {
  if (id === 'phom') return judge(s, secret.cards.hands)
  if (id === 'tienlen') return tienlenResult(s, secret.cards)
  return RULES[id].result(s)
}

/** Tay của một ghế lúc này (Tiến lên: bỏ lá đã ra bàn). Máy chỉ được nhận tay của chính nó. */
export function handOf(id, s, secret, seat) {
  const h = secret?.cards?.hands?.[seat] || []
  return id === 'tienlen' ? h.filter((c) => !s.gone.includes(c)) : h.slice()
}

/**
 * Bài màn chơi được thấy (thay game_hands + RLS): đang chơi chỉ tay mình, hết ván thì cả bàn. Tiến lên trả tay lúc chia
 * như server — màn chơi tự lọc lá đã đánh.
 */
export function handsView(secret, me, over) {
  const hands = secret?.cards?.hands
  if (!hands) return null
  return over ? Object.fromEntries(hands.map((h, y) => [y, h.slice()])) : { [me]: hands[me].slice() }
}
