// Cờ X-O 3 × 3 (0107 — tách khỏi Caro). 2 người, X (ghế 0) đi trước, 3 quân liền hàng ngang / dọc / chéo là thắng.
// Chủ phòng chọn chế độ (options.mode):
//   - classic: lần lượt đặt quân vào ô trống; đầy 9 ô mà chưa ai thắng thì hoà.
//   - move:    mỗi bên đặt đủ 3 quân, sau đó mỗi lượt nhấc 1 quân của mình đặt sang ô trống bất kỳ { from, to }.
//   - vanish:  luôn đặt quân { i }; đã có 3 quân trên bàn thì đặt quân mới là quân cũ nhất của mình biến mất.
//   move / vanish không bao giờ đầy bàn: đủ CAP lượt mỗi bên (2 × CAP nước) mà chưa ai thắng thì hoà.
// Server chấm lại y luật này (0107 game_xo_result) — đổi luật ở đây là phải đổi cả ở đó (xo.test.js chạy chung bộ ván
// mẫu với file kiểm 0107).
//
// state = { mode, board[9] (null | 0 | 1), q[2] (ô quân từng bên, cũ trước), turn, ply (số nước hợp lệ), winner, line,
//           last { seat, i, from?, gone? }, over }
// move  = { i } (đặt) · { from, to } (chế độ move, khi đã đủ 3 quân)

export const MODES = ['classic', 'move', 'vanish']
export const PIECES = 3
/** Lượt mỗi bên tối đa ở chế độ move / vanish. PHẢI khớp c_cap của 0107. */
export const CAP = 30
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

export const optsOf = (o) => ({ mode: MODES.includes(o?.mode) ? o.mode : 'classic' })

/** Đã đủ quân, tới lượt thì phải di quân (chế độ move). */
export const moving = (s, seat) => s.mode === 'move' && s.q[seat].length >= PIECES
/** Quân sẽ biến mất khi `seat` đặt quân tiếp (chế độ vanish), hoặc null. */
export const fadingOf = (s, seat) => (s.mode === 'vanish' && s.q[seat].length >= PIECES ? s.q[seat][0] : null)

const cell = (x) => (Number.isInteger(x) && x >= 0 && x < 9 ? x : null)

export default {
  id: 'xo',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: { mode: 'classic' },

  setup({ options } = {}) {
    return { mode: optsOf(options).mode, board: Array(9).fill(null), q: [[], []], turn: 0, ply: 0, winner: null, line: null, last: null, over: false }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (moving(s, seat)) {
      const from = cell(move?.from)
      const to = cell(move?.to)
      if (from == null || to == null || move.i !== undefined) return 'games.err.badMove'
      if (s.board[from] !== seat) return 'games.err.notYourPiece'
      return s.board[to] == null ? null : 'games.err.taken'
    }
    const i = cell(move?.i)
    if (i == null || move.from !== undefined) return 'games.err.badMove'
    return s.board[i] == null ? null : 'games.err.taken'
  },

  apply(s, seat, move) {
    const board = s.board.slice()
    const q = s.q.map((x) => x.slice())
    let last
    if (moving(s, seat)) {
      board[move.from] = null
      board[move.to] = seat
      q[seat] = [...q[seat].filter((x) => x !== move.from), move.to]
      last = { seat, i: move.to, from: move.from }
    } else {
      const gone = fadingOf(s, seat)
      if (gone != null) {
        board[gone] = null
        q[seat].shift()
      }
      board[move.i] = seat
      q[seat].push(move.i)
      last = gone != null ? { seat, i: move.i, gone } : { seat, i: move.i }
    }
    const ply = s.ply + 1
    const line = LINES.find((l) => l.every((x) => board[x] === seat)) || null
    const draw = !line && (s.mode === 'classic' ? ply >= 9 : ply >= 2 * CAP)
    return { ...s, board, q, turn: 1 - seat, ply, last, line, winner: line ? seat : null, over: !!line || draw }
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner != null ? { winners: [s.winner], draw: false } : { winners: [], draw: true }
  },
}
