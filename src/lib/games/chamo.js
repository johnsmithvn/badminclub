// Chấm ô (trò giấy bút dân gian, không có chủ — học trò vẫn chơi trên vở ô ly). Bàn n × n ô = (n + 1) × (n + 1) chấm.
//   - Mỗi lượt nối một nét ngang hoặc dọc giữa hai chấm kề nhau mà chưa ai nối.
//   - Nét vừa nối khép kín ô nào (đủ 4 cạnh) thì ô đó của người nối, và người đó ĐI TIẾP. Một nét có thể khép
//     hai ô cùng lúc. Không khép được ô nào → đổi lượt.
//   - Nối hết mọi nét là hết ván: nhiều ô hơn thắng, bằng thì hoà (chỉ có thể khi n chẵn).
// Hợp đồng chung: docs/GAMES.md §3. Server chấm lại bằng SQL: 0077 game_chamo_result — đổi luật ở đây là
// phải đổi cả ở đó (chamo.test.js chạy chung bộ ván mẫu với file kiểm 0077 để gác).
//
// Cỡ bàn n lấy từ tuỳ chọn phòng; không phải số nguyên SIZE_MIN..SIZE_MAX thì dùng SIZE_DEFAULT — server cũng
// làm y vậy, nên client gửi cỡ bậy không làm nặng DB, cũng không làm hai bên hiểu khác nhau.
// Nét đánh số: nét ngang trước — hàng chấm r (0..n), cột c (0..n-1) → r * n + c; rồi nét dọc — hàng ô r (0..n-1),
// cột chấm c (0..n) → H + r * (n + 1) + c, với H = n * (n + 1) nét ngang. Ô b = hàng * n + cột. Ghế 0 đi trước.
// state = { size, lines[] (null | ghế đã nối), boxes[] (null | ghế), turn (null khi hết ván), ply, over, last, trail }
//   last  = { seat, line, boxes[] }   boxes = các ô nét vừa nối khép được
//   trail = các nét của lượt gần nhất — ăn ô thì một người nối liền nhiều nét, bàn tô lại cho người kia thấy
// move  = { line }

export const SIZE_MIN = 2
export const SIZE_MAX = 8
export const SIZE_DEFAULT = 5

export const sizeOf = (o) => (Number.isInteger(o?.size) && o.size >= SIZE_MIN && o.size <= SIZE_MAX ? o.size : SIZE_DEFAULT)

/** Hai chấm đầu nét, chấm trái / trên trước: [[hàng, cột], [hàng, cột]]. */
export function ends(n, line) {
  const H = n * (n + 1)
  if (line < H) return [[Math.floor(line / n), line % n], [Math.floor(line / n), (line % n) + 1]]
  const r = Math.floor((line - H) / (n + 1))
  const c = (line - H) % (n + 1)
  return [[r, c], [r + 1, c]]
}

/** Các ô kề nét: một ô nếu nét nằm ở mép bàn, hai ô nếu ở trong. */
export function boxesOf(n, line) {
  const [[r, c], [r2]] = ends(n, line)
  if (r2 === r) return [...(r > 0 ? [(r - 1) * n + c] : []), ...(r < n ? [r * n + c] : [])]
  return [...(c > 0 ? [r * n + c - 1] : []), ...(c < n ? [r * n + c] : [])]
}

/** Bốn nét quanh ô b: trên, dưới, trái, phải. */
export function edgesOf(n, b) {
  const r = Math.floor(b / n)
  const c = b % n
  const v = n * (n + 1) + r * (n + 1) + c
  return [r * n + c, (r + 1) * n + c, v, v + 1]
}

export default {
  id: 'chamo',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: { size: SIZE_DEFAULT },

  setup({ options } = {}) {
    const n = sizeOf(options)
    return { size: n, lines: Array(2 * n * (n + 1)).fill(null), boxes: Array(n * n).fill(null), turn: 0, ply: 0, over: false, last: null, trail: [] }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const i = move?.line
    if (!Number.isInteger(i) || i < 0 || i >= s.lines.length) return 'games.err.badMove'
    if (s.lines[i] != null) return 'games.err.lineTaken'
    return null
  },

  apply(s0, seat, { line }) {
    const lines = s0.lines.slice()
    lines[line] = seat
    const won = boxesOf(s0.size, line).filter((b) => edgesOf(s0.size, b).every((e) => lines[e] != null))
    const boxes = s0.boxes.slice()
    for (const b of won) boxes[b] = seat
    const over = boxes.every((v) => v != null)
    return {
      size: s0.size,
      lines,
      boxes,
      turn: over ? null : won.length ? seat : 1 - seat,
      ply: s0.ply + 1,
      over,
      last: { seat, line, boxes: won },
      trail: s0.last?.seat === seat ? [...s0.trail, line] : [line],
    }
  },

  view: (s) => s,

  /** Kèm số ô mỗi bên (`scores`) — server trả y vậy, nên bộ ván mẫu gác được cả việc trao đúng từng ô. */
  result(s) {
    if (!s.over) return null
    const n = [0, 1].map((p) => s.boxes.filter((v) => v === p).length)
    const scores = { 0: n[0], 1: n[1] }
    return n[0] === n[1] ? { winners: [], draw: true, scores } : { winners: [n[0] > n[1] ? 0 : 1], draw: false, scores }
  },
}
