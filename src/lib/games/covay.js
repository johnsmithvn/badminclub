// Cờ vây (luật Trung Quốc rút gọn — tính điểm theo vùng). 2 người, Đen (ghế 0) đi trước. Bàn 9 × 9, 13 × 13 hoặc
// 19 × 19 (chủ phòng chọn).
//   - Đến lượt: đặt một quân vào giao điểm trống, hoặc bỏ lượt.
//   - Nhóm quân (liền nhau theo hàng / cột) không còn khí (giao điểm trống kề nhóm) thì bị ăn, nhấc khỏi bàn.
//   - Cấm tự sát: đặt xong (sau khi đã nhấc quân bị ăn) mà nhóm mình hết khí là nước sai.
//   - Luật ko: vừa ăn đúng MỘT quân bằng một quân đơn chỉ còn một khí thì đối phương không được ăn lại ngay ở điểm vừa
//     bị ăn; đi nước khác hoặc bỏ lượt một lần rồi mới được.
//   - Hết ván: hai bên bỏ lượt liền nhau — hoặc đủ 3 × số giao điểm nước hợp lệ (chặn ván vô tận, ví dụ ko ba).
//   - Tính điểm tự động: quân trên bàn + giao điểm trống chỉ giáp quân một màu; Trắng cộng 7,5 (komi). Không có bước
//     đánh dấu quân chết — quân chết phải ăn hẳn trước khi bỏ lượt. Điểm có ,5 nên không bao giờ hoà.
// Hợp đồng chung: docs/GAMES.md §3. Server chấm lại bằng SQL (0089 game_covay_result) — đổi luật ở đây là phải đổi cả ở
// đó (covay.test.js chạy chung bộ ván mẫu với file kiểm 0089).
//
// Giao điểm i = hàng * n + cột. state = { size, board[] (null | 0 Đen | 1 Trắng), turn, ko (giao điểm cấm ăn lại | -1),
//   passes (số lần bỏ lượt liền nhau), ply (số nước hợp lệ), caps[2] (quân mỗi bên đã ăn), over, score { 0, 1 } | null,
//   last }
//   last = { seat, i, captured[] } | { seat, pass: true }
// move  = { i } · { pass: true }

export const SIZES = [9, 13, 19]
export const KOMI = 7.5
/** Trần số nước hợp lệ = CAP_PER_POINT × số giao điểm. PHẢI khớp 0089. */
export const CAP_PER_POINT = 3

export const optsOf = (o) => ({ size: SIZES.includes(o?.size) ? o.size : SIZES[0] })
export const capOf = (n) => CAP_PER_POINT * n * n

/** Các giao điểm kề i (trên, dưới, trái, phải). */
export function around(n, i) {
  const r = Math.floor(i / n)
  const c = i % n
  const out = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}

/** Nhóm quân chứa giao điểm i → { stones[], libs } (libs = số khí). */
export function groupOf(board, n, i) {
  const color = board[i]
  const seen = new Set([i])
  const libs = new Set()
  const stack = [i]
  const stones = []
  while (stack.length) {
    const x = stack.pop()
    stones.push(x)
    for (const y of around(n, x)) {
      if (board[y] == null) libs.add(y)
      else if (board[y] === color && !seen.has(y)) { seen.add(y); stack.push(y) }
    }
  }
  return { stones, libs: libs.size }
}

/**
 * Đặt quân của `seat` vào giao điểm trống i → { board, captured[], ko } — hoặc null nếu là nước tự sát.
 * ko = giao điểm vừa bị ăn khi nước này ăn đúng một quân bằng một quân đơn còn một khí, không thì -1.
 */
export function place(board, n, i, seat) {
  const b = board.slice()
  b[i] = seat
  const captured = []
  for (const y of around(n, i)) {
    if (b[y] !== 1 - seat) continue
    const g = groupOf(b, n, y)
    if (g.libs > 0) continue
    for (const k of g.stones) { b[k] = null; captured.push(k) }
  }
  const own = groupOf(b, n, i)
  if (own.libs === 0) return null
  const ko = captured.length === 1 && own.stones.length === 1 && own.libs === 1 ? captured[0] : -1
  return { board: b, captured, ko }
}

/**
 * Vùng của từng giao điểm khi tính điểm → { owner[] (0 | 1 | null), b, w }: quân thuộc màu của nó, giao điểm trống
 * thuộc màu duy nhất mà vùng trống đó giáp; giáp cả hai màu (hoặc bàn trống) thì không của ai.
 */
export function areaOf(board, n) {
  const owner = board.slice()
  const seen = new Set()
  for (let i = 0; i < board.length; i++) {
    if (board[i] != null || seen.has(i)) continue
    const region = []
    const touch = new Set()
    const stack = [i]
    seen.add(i)
    while (stack.length) {
      const x = stack.pop()
      region.push(x)
      for (const y of around(n, x)) {
        if (board[y] != null) touch.add(board[y])
        else if (!seen.has(y)) { seen.add(y); stack.push(y) }
      }
    }
    const who = touch.size === 1 ? [...touch][0] : null
    for (const x of region) owner[x] = who
  }
  return { owner, b: owner.filter((v) => v === 0).length, w: owner.filter((v) => v === 1).length }
}

/** Hai bên bỏ lượt liền nhau hoặc chạm trần số nước → hết ván, chấm điểm. */
function settle(s) {
  if (s.passes < 2 && s.ply < capOf(s.size)) return s
  const a = areaOf(s.board, s.size)
  return { ...s, over: true, turn: null, ko: -1, score: { 0: a.b, 1: a.w + KOMI } }
}

export default {
  id: 'covay',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: { size: SIZES[0] },

  setup({ options } = {}) {
    const { size } = optsOf(options)
    return {
      size, board: Array(size * size).fill(null), turn: 0, ko: -1, passes: 0, ply: 0, caps: [0, 0], over: false,
      score: null, last: null,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (move?.pass === true) return null
    const i = move?.i
    if (!Number.isInteger(i) || i < 0 || i >= s.board.length) return 'games.err.badMove'
    if (s.board[i] != null) return 'games.err.taken'
    if (i === s.ko) return 'games.err.ko'
    return place(s.board, s.size, i, seat) ? null : 'games.err.suicide'
  },

  apply(s0, seat, move) {
    const s = { ...s0, ply: s0.ply + 1, turn: 1 - seat }
    if (move.pass === true) return settle({ ...s, passes: s0.passes + 1, ko: -1, last: { seat, pass: true } })
    const p = place(s0.board, s0.size, move.i, seat)
    return settle({
      ...s, board: p.board, ko: p.ko, passes: 0,
      caps: s0.caps.map((k, x) => (x === seat ? k + p.captured.length : k)),
      last: { seat, i: move.i, captured: p.captured },
    })
  },

  view: (s) => s,

  /** Điểm có ,5 (komi) nên luôn có người thắng. `scores` = điểm vùng, Trắng đã cộng komi — server chấm y vậy. */
  result(s) {
    if (!s.over) return null
    return { winners: [s.score[0] > s.score[1] ? 0 : 1], draw: false, scores: { 0: s.score[0], 1: s.score[1] } }
  },
}
