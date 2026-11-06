// Cờ lật (luật chung, không có chủ — trò kẹp-lật quân có từ thế kỷ 19). Bàn 8×8, mỗi bên một màu.
//   - Đặt: một quân vào ô trống sao cho kẹp được ít nhất một hàng quân đối phương (ngang, dọc, chéo) giữa quân
//     mới và một quân sẵn có của mình → lật hết mọi hàng bị kẹp.
//   - Không có nước nào kẹp được → mất lượt (tự động, không phải bấm). Cả hai không đi được → hết ván.
//   - Hết ván: nhiều quân hơn thắng, bằng thì hoà. Mỗi nước lấp một ô nên ván dài tối đa 60 nước.
// Hợp đồng chung: docs/GAMES.md §3. Server chấm lại bằng SQL: 0076 game_colat_result — đổi luật ở đây là
// phải đổi cả ở đó (colat.test.js chạy chung bộ ván mẫu với file kiểm 0076 để gác).
//
// Ô i = hàng * 8 + cột, hàng 0 ở trên. Ghế 0 = quân đen, đi trước.
// state = { board[64] (null | 0 | 1), turn (null khi hết ván), ply, over, last }
//   last = { seat, cell, flipped[], skipped }   skipped = ghế vừa bị mất lượt (null nếu không)
// move  = { cell }

const SIZE = 8
export const CELLS = SIZE * SIZE
// Xếp quân ban đầu: bốn ô giữa, chéo màu.
export const START = { 0: [28, 35], 1: [27, 36] }
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const inside = (r, c) => r >= 0 && c >= 0 && r < SIZE && c < SIZE

/** Các quân bị lật nếu `seat` đặt vào ô i — rỗng nghĩa là không đặt được. Đi theo hàng / cột nên không tràn sang hàng bên. */
export function flipsOf(board, i, seat) {
  if (board[i] != null) return []
  const out = []
  const r0 = Math.floor(i / SIZE)
  const c0 = i % SIZE
  for (const [dr, dc] of DIRS) {
    const line = []
    let r = r0 + dr
    let c = c0 + dc
    while (inside(r, c) && board[r * SIZE + c] === 1 - seat) {
      line.push(r * SIZE + c)
      r += dr
      c += dc
    }
    if (inside(r, c) && board[r * SIZE + c] === seat) out.push(...line) // hàng rỗng (quân mình kề sát) thì không thêm gì
  }
  return out
}

/** Các ô `seat` đặt được. */
export const movesOf = (board, seat) => board.flatMap((_, i) => (flipsOf(board, i, seat).length ? [i] : []))

export default {
  id: 'colat',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    const board = Array(CELLS).fill(null)
    for (const seat of [0, 1]) for (const i of START[seat]) board[i] = seat
    return { board, turn: 0, ply: 0, over: false, last: null }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const i = move?.cell
    if (!Number.isInteger(i) || i < 0 || i >= CELLS) return 'games.err.badMove'
    if (s.board[i] != null) return 'games.err.taken'
    if (!flipsOf(s.board, i, seat).length) return 'games.err.mustFlip'
    return null
  },

  apply(s0, seat, { cell }) {
    const board = s0.board.slice()
    const flipped = flipsOf(board, cell, seat)
    board[cell] = seat
    for (const j of flipped) board[j] = seat
    const foe = 1 - seat
    const turn = movesOf(board, foe).length ? foe : movesOf(board, seat).length ? seat : null
    return {
      board,
      turn,
      ply: s0.ply + 1,
      over: turn == null,
      last: { seat, cell, flipped, skipped: turn === seat ? foe : null },
    }
  },

  view: (s) => s,

  /** Kèm số quân mỗi bên (`scores`) — server cũng trả y vậy, nên bộ ván mẫu gác được cả việc lật đúng từng quân. */
  result(s) {
    if (!s.over) return null
    const n = [0, 1].map((p) => s.board.filter((v) => v === p).length)
    const scores = { 0: n[0], 1: n[1] }
    return n[0] === n[1] ? { winners: [], draw: true, scores } : { winners: [n[0] > n[1] ? 0 : 1], draw: false, scores }
  },
}
