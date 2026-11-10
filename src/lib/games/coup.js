// Cờ úp (biến thể dân gian của Cờ tướng). 2 người, đỏ (ghế 0) đi trước, bàn và cách đi như cotuong.js.
//   Đầu ván: trừ hai tướng, mọi quân bị úp và xáo lẫn trong phe mình, đặt vào đúng các vị trí xuất phát của Cờ tướng —
//   không ai biết quân úp nào là quân gì, kể cả chủ của nó.
//   Quân úp đi nước đầu theo luật của QUÂN GỐC ở vị trí đó (úp ở chỗ xe thì đi như xe, chỗ tốt thì tiến 1…), đi xong
//   thì lật lên và từ đó đi theo đúng mặt thật. Sĩ, tượng đã lật đi khắp bàn: ra khỏi cung, qua sông được.
//   Ăn phải quân úp thì quân đó lật cho cả bàn xem. Chiếu, chiếu hết, lộ mặt tướng, hoà… như Cờ tướng; hết quân, chỉ
//   còn hai tướng thì hoà.
//
// Server giữ mặt thật của quân úp (0086: game_hands ghế -1) và điền vào nước đi lúc ghi:
//   { from, to, flip?, took? } — flip = mặt thật quân vừa đi (nếu ô `from` là ô xuất phát của quân úp), took = mặt thật
//   quân bị ăn ở ô `to` (nếu là ô xuất phát của quân úp). Server điền theo ô xuất phát, KHÔNG xét quân còn úp hay đã
//   lật — ô đã có người đi qua thì mặt thật ở đó đã công khai, điền lại không lộ gì; ở đây chỉ dùng khi quân còn úp.
// ponytail: server không kiểm luật đi (luật Cờ tướng chưa chép sang SQL) — máy khách sửa code gửi nước sai thì mọi máy
// bỏ qua nước đó, nhưng server đã điền mặt thật ô `to` → dò được một quân úp. Thêm kiểm luật ở SQL nếu CLB đánh giải.
//
// Bàn: chữ hoa = đỏ, chữ thường = đen như Cờ tướng; 'X' / 'x' = quân úp của đỏ / đen.
// state = { board[90], turn, quiet, reps, ply, check, over, winner, reason, last }
//   last = { seat, from, to, captured, flip? } — captured: quân bị ăn (đã lật), flip: mặt vừa lật của quân đi
// move  = { from, to } (client gửi) · { from, to, flip?, took? } (server ghi)

import { COLS, POINTS, QUIET_LIMIT, START, colorOf, facing, kingOf, pseudo, typeOf } from '#lib/games/cotuong.js'

export { COLS, POINTS, colorOf, typeOf }
export const KINDS = ['A', 'E', 'H', 'R', 'C', 'P']
export const isHidden = (p) => p === 'X' || p === 'x'

/** Ô xuất phát của quân úp (mọi quân trừ tướng) — server cũng xáo đúng các ô này (0086). */
export const HIDDEN_SQUARES = [...START].map((ch, i) => (ch !== '.' && typeOf(ch) !== 'K' ? i : null)).filter((i) => i != null)

const gen = (b, seat) => pseudo(b, seat, (i) => typeOf(isHidden(b[i]) ? START[i] : b[i]), (i) => !isHidden(b[i]))
const inCheck = (b, seat) => {
  const k = kingOf(b, seat)
  return gen(b, 1 - seat).some((m) => m.to === k)
}
const cased = (k, seat) => (seat === 0 ? k : k.toLowerCase())

/** Quân đi tới ô mới. Chưa biết mặt thật (đang dò nước hợp lệ) thì giữ quân úp — chỉ chỗ đứng mới quyết tướng có an toàn. */
function play(b0, { from, to }, face) {
  const b = b0.slice()
  b[to] = face ?? b[from]
  b[from] = null
  return b
}

/** Mọi nước hợp lệ của bên `seat`. */
export function legalMoves(s, seat = s.turn) {
  return gen(s.board, seat).filter((m) => {
    const b = play(s.board, m)
    return !facing(b) && !inCheck(b, seat)
  })
}

export const movesFrom = (s, from) => legalMoves(s).filter((m) => m.from === from)

const keyOf = (s) => s.board.map((p) => p ?? '.').join('') + s.turn
const isPoint = (i) => Number.isInteger(i) && i >= 0 && i < POINTS
const isKind = (k) => k == null || KINDS.includes(k)

export default {
  id: 'coup',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    const board = [...START].map((ch) => (ch === '.' ? null : typeOf(ch) === 'K' ? ch : colorOf(ch) === 0 ? 'X' : 'x'))
    const s = { board, turn: 0, quiet: 0, reps: {}, ply: 0, check: null, over: false, winner: null, reason: null, last: null }
    return { ...s, reps: { [keyOf(s)]: 1 } }
  },

  /** Đụng quân úp (đi hoặc ăn) thì server điền mặt thật — máy này chờ bản server ghi, không hiện trước. */
  request: (s, seat, move) => isHidden(s.board[move?.from]) || isHidden(s.board[move?.to]),

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const { from, to, flip, took } = move || {}
    if (!isPoint(from) || !isPoint(to) || !isKind(flip) || !isKind(took)) return 'games.err.badMove'
    if (colorOf(s.board[from]) !== seat) return 'games.err.notYourPiece'
    return movesFrom(s, from).some((m) => m.to === to) ? null : 'games.err.illegal'
  },

  apply(s0, seat, { from, to, flip, took }) {
    const foe = 1 - seat
    const up = isHidden(s0.board[from]) && flip ? cased(flip, seat) : null
    const prev = s0.board[to]
    const captured = prev == null ? null : isHidden(prev) && took ? cased(took, foe) : prev
    const board = play(s0.board, { from, to }, up)
    const quiet = captured ? 0 : s0.quiet + 1
    const s = { ...s0, board, turn: foe, quiet, ply: s0.ply + 1, check: null, last: { seat, from, to, captured, ...(up ? { flip: up } : {}) } }
    const key = keyOf(s)
    s.reps = { ...(captured ? {} : s0.reps), [key]: ((captured ? 0 : s0.reps[key]) || 0) + 1 }
    const check = inCheck(board, foe)
    if (check) s.check = kingOf(board, foe)
    const end = (winner, reason) => ({ ...s, over: true, winner, reason })
    if (!legalMoves(s, foe).length) return end(seat, check ? 'mate' : 'stalemate')
    if (board.every((p) => p == null || typeOf(p) === 'K')) return end(null, 'material')
    if (s.reps[key] >= 3) return end(null, 'repetition')
    if (quiet >= QUIET_LIMIT) return end(null, 'quiet')
    return s
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner == null ? { winners: [], draw: true } : { winners: [s.winner], draw: false }
  },
}
