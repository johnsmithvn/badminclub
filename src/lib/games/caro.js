// Caro (gomoku dân gian): hai người thay phiên đặt quân lên bàn vuông, ai có `win` quân liền
// nhau theo hàng ngang / dọc / chéo trước là thắng. Hợp đồng chung: docs/GAMES.md §3.
//
// state = { size, win, blockedEnds, board, turn, moves, winner, line, last }
//   board: mảng phẳng size*size, mỗi ô là số ghế (0 | 1) hoặc null
//   line:  các ô của đường thắng (để tô), null khi chưa có
// move  = { i } — chỉ số ô trong `board`

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]]

/** Đếm quân cùng ghế đi từ ô (r, c) theo hướng (dr, dc), không tính ô gốc. Trả các ô + ô chặn đầu. */
function ray(s, r, c, dr, dc, seat) {
  const cells = []
  let y = r + dr
  let x = c + dc
  while (y >= 0 && y < s.size && x >= 0 && x < s.size && s.board[y * s.size + x] === seat) {
    cells.push(y * s.size + x)
    y += dr
    x += dc
  }
  const inside = y >= 0 && y < s.size && x >= 0 && x < s.size
  // Mép bàn không tính là bị chặn; chỉ quân đối phương mới chặn.
  const blocked = inside && s.board[y * s.size + x] != null && s.board[y * s.size + x] !== seat
  return { cells, blocked }
}

/** Đường thắng đi qua ô `i` vừa đặt, hoặc null. */
function winLine(s, i, seat) {
  const r = Math.floor(i / s.size)
  const c = i % s.size
  for (const [dr, dc] of DIRS) {
    const a = ray(s, r, c, -dr, -dc, seat)
    const b = ray(s, r, c, dr, dc, seat)
    const line = [...a.cells.reverse(), i, ...b.cells]
    if (line.length < s.win) continue
    // Luật chặn hai đầu: đủ quân nhưng hai đầu đều bị đối phương chặn thì chưa thắng.
    if (s.blockedEnds && a.blocked && b.blocked) continue
    return line
  }
  return null
}

const full = (s) => s.moves >= s.size * s.size

const DEFAULTS = { size: 15, win: 5, blockedEnds: false }

export default {
  id: 'caro',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: DEFAULTS,

  setup({ options }) {
    const o = { ...DEFAULTS, ...options }
    return {
      size: o.size, win: o.win, blockedEnds: !!o.blockedEnds,
      board: Array(o.size * o.size).fill(null),
      turn: 0, moves: 0, winner: null, line: null, last: null,
    }
  },

  validate(s, seat, move) {
    if (s.winner != null || full(s)) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const i = move?.i
    if (!Number.isInteger(i) || i < 0 || i >= s.board.length) return 'games.err.badMove'
    if (s.board[i] != null) return 'games.err.taken'
    return null
  },

  apply(s, seat, move) {
    const board = s.board.slice()
    board[move.i] = seat
    const next = { ...s, board, moves: s.moves + 1, last: move.i, turn: 1 - seat }
    const line = winLine(next, move.i, seat)
    return line ? { ...next, winner: seat, line } : next
  },

  view: (s) => s,

  result(s) {
    if (s.winner != null) return { winners: [s.winner], draw: false }
    if (full(s)) return { winners: [], draw: true }
    return null
  },
}
