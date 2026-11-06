// Cờ gánh (dân gian, Quảng Nam). Bàn 5×5 điểm, đường ngang + dọc ở mọi điểm, đường chéo ở các điểm có
// (hàng + cột) chẵn (bàn kiểu "chéo xen kẽ"). Mỗi bên 8 quân xếp quanh mép phía mình. Không bắt quân ra khỏi
// bàn: quân bị ăn ĐỔI MÀU sang phe ăn, nên lúc nào bàn cũng đủ 16 quân.
//   - Đi: một quân sang điểm kề còn trống, theo đường kẻ.
//   - Gánh: quân vừa đi đứng giữa hai quân đối phương thẳng hàng (đường có kẻ qua điểm đó) → cả hai đổi màu.
//     Nhiều đường cùng lúc thì gánh hết ("chầu"). Chỉ người vừa đi mới gánh; tự đi vào giữa hai quân địch không sao.
//   - Vây: sau khi gánh, nhóm quân đối phương (liền nhau theo đường kẻ) không còn điểm trống kề nào → đổi màu cả nhóm.
//   - Mở: nước vừa đi rút một quân ra khỏi giữa hai quân cùng phe (để trống điểm ở giữa) → bên kia, nếu có quân
//     kề điểm đó, BẮT BUỘC phải đi vào gánh.
//   - Hết ván: một bên hết quân → bên kia thắng. Chống ván kéo dài vô hạn (luật riêng của app):
//     QUIET_LIMIT nước liền không ai gánh / vây được, hoặc đủ MAX_PLY nước → ai nhiều quân hơn thắng, bằng thì hoà.
// Hợp đồng chung: docs/GAMES.md §3. Server chấm lại bằng SQL: 0075 game_coganh_result — đổi luật ở đây là
// phải đổi cả ở đó (coganh.test.js chạy chung bộ ván mẫu với file kiểm 0075 để gác).
//
// Điểm i = hàng * 5 + cột, hàng 0 ở trên. Ghế 0 (đi trước) ở dưới, ghế 1 ở trên.
// state = { board[25] (null | 0 | 1), turn, ply, quiet, open, over, winner, last }
//   open = điểm vừa bị "mở" (null nếu không) · last = { seat, from, to, flipped[] }
// move  = { from, to }

const SIZE = 5
export const POINTS = SIZE * SIZE
export const QUIET_LIMIT = 40
export const MAX_PLY = 400
// Bốn hướng của một đường thẳng qua một điểm (mỗi hướng tính cả hai phía).
const LINES = [[0, 1], [1, 0], [1, 1], [1, -1]]

export const hasDiag = (i) => (Math.floor(i / SIZE) + (i % SIZE)) % 2 === 0
/** Điểm kế bên theo hướng (dr, dc), null nếu ra ngoài bàn hoặc không có đường kẻ chéo. */
function step(i, dr, dc) {
  if (dr && dc && !hasDiag(i)) return null
  const r = Math.floor(i / SIZE) + dr
  const c = (i % SIZE) + dc
  return r < 0 || c < 0 || r >= SIZE || c >= SIZE ? null : r * SIZE + c
}
/** Các điểm nối thẳng với i bằng đường kẻ. */
export const NEIGHBORS = Array.from({ length: POINTS }, (_, i) =>
  LINES.flatMap(([dr, dc]) => [step(i, dr, dc), step(i, -dr, -dc)]).filter((j) => j != null))

/** Điểm i nằm giữa hai quân của `seat` trên cùng một đường. */
function flanked(board, i, seat) {
  return LINES.some(([dr, dc]) => {
    const p = step(i, dr, dc)
    const q = step(i, -dr, -dc)
    return p != null && q != null && board[p] === seat && board[q] === seat
  })
}

/** Những quân của `seat` phải đi vào điểm vừa mở (rỗng nếu không bị bắt buộc). */
export function forcedFrom(s, seat) {
  if (s.open == null || s.board[s.open] != null) return []
  return NEIGHBORS[s.open].filter((j) => s.board[j] === seat)
}

const isPoint = (i) => Number.isInteger(i) && i >= 0 && i < POINTS

export default {
  id: 'coganh',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    const board = Array(POINTS).fill(null)
    for (const i of [0, 1, 2, 3, 4, 5, 9, 14]) board[i] = 1
    for (const i of [20, 21, 22, 23, 24, 15, 19, 10]) board[i] = 0
    return { board, turn: 0, ply: 0, quiet: 0, open: null, over: false, winner: null, last: null }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const from = move?.from
    const to = move?.to
    if (!isPoint(from) || !isPoint(to)) return 'games.err.badMove'
    if (s.board[from] !== seat) return 'games.err.notYourPiece'
    if (s.board[to] != null) return 'games.err.taken'
    if (!NEIGHBORS[from].includes(to)) return 'games.err.badMove'
    if (forcedFrom(s, seat).length && to !== s.open) return 'games.err.mustCapture'
    return null
  },

  apply(s0, seat, { from, to }) {
    const board = s0.board.slice()
    const foe = 1 - seat
    const flipped = []
    board[from] = null
    board[to] = seat

    for (const [dr, dc] of LINES) {
      const p = step(to, dr, dc)
      const q = step(to, -dr, -dc)
      if (p != null && q != null && board[p] === foe && board[q] === foe) {
        board[p] = seat; board[q] = seat
        flipped.push(p, q)
      }
    }

    // Vây: duyệt từng nhóm quân đối phương; nhóm không còn điểm trống kề nào thì đổi màu cả nhóm.
    const seen = new Set()
    for (let i = 0; i < POINTS; i++) {
      if (board[i] !== foe || seen.has(i)) continue
      const group = [i]
      seen.add(i)
      let free = false
      for (let k = 0; k < group.length; k++) {
        for (const j of NEIGHBORS[group[k]]) {
          if (board[j] == null) free = true
          else if (board[j] === foe && !seen.has(j)) { seen.add(j); group.push(j) }
        }
      }
      if (!free) for (const g of group) { board[g] = seat; flipped.push(g) }
    }

    const count = [0, 0]
    for (const v of board) if (v != null) count[v] += 1
    const s = {
      board,
      turn: foe,
      ply: s0.ply + 1,
      quiet: flipped.length ? 0 : s0.quiet + 1,
      open: flanked(board, from, seat) ? from : null,
      over: false,
      winner: null,
      last: { seat, from, to, flipped },
    }
    if (count[foe] === 0) return { ...s, over: true, winner: seat }
    if (s.quiet >= QUIET_LIMIT || s.ply >= MAX_PLY) {
      return { ...s, over: true, winner: count[0] === count[1] ? null : count[0] > count[1] ? 0 : 1 }
    }
    return s
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner == null ? { winners: [], draw: true } : { winners: [s.winner], draw: false }
  },
}
