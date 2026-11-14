// Cờ X-O 3 × 3 (0107 — tách khỏi Caro). 2 người, X (ghế 0) đi trước, 3 quân liền hàng ngang / dọc / chéo là thắng.
// Chủ phòng chọn chế độ (options.mode):
//   - classic: lần lượt đặt quân vào ô trống; đầy 9 ô mà chưa ai thắng thì hoà.
//   - move:    mỗi bên đặt đủ 3 quân, sau đó mỗi lượt nhấc 1 quân của mình đặt sang ô trống bất kỳ { from, to }.
//   - vanish:  luôn đặt quân { i }; đã có 3 quân trên bàn thì đặt quân mới là quân cũ nhất của mình biến mất.
//   Đủ CAP lượt mỗi bên (2 × CAP lượt) mà chưa ai thắng thì hoà — move / vanish không bao giờ đầy bàn; cổ điển chỉ chạm
//   mức này khi có lượt bị mất vì hết giờ.
// ĐỒNG HỒ LƯỢT (options.time = 3 | 5 | 10 giây, khác = không tính giờ — 0109): hạn = giờ server của lượt gần nhất
//   (`since`) + time. Nước đầu ván không tính giờ (bàn vừa hiện ra đã mất gần một giây tải). Hết giờ thì máy bất kỳ đang
//   ngồi báo { timeout: true }; server (0109 game_xo_check) so với giờ của nó — sớm thì games.err.notYet — rồi đóng dấu
//   { timeout: true, skip: true } (game_xo_fill): người tới lượt MẤT LƯỢT, không đặt quân nào, lượt sang đối thủ.
//   Lượt bị mất vẫn tính vào số lượt (ply) nên hai bên cùng bỏ mặc thì ván vẫn hết (hoà) sau 2 × CAP lượt.
// Server chấm lại y luật này (0109 game_xo_run / game_xo_result) — đổi luật ở đây là phải đổi cả ở đó (xo.test.js chạy
// chung bộ ván mẫu với file kiểm 0107).
//
// state = { mode, time, since, board[9] (null | 0 | 1), q[2] (ô quân từng bên, cũ trước), turn, ply (số lượt đã qua, gồm
//           cả lượt bị mất), winner, line, last { seat, i, from?, gone? } | { seat, skip: true }, over }
// move  = { i } (đặt) · { from, to } (chế độ move, khi đã đủ 3 quân)
//       · { timeout: true } (máy khách báo hết giờ) → server ghi { timeout: true, skip: true }

export const MODES = ['classic', 'move', 'vanish']
export const PIECES = 3
/** Lượt mỗi bên tối đa. PHẢI khớp c_cap của 0109. */
export const CAP = 30
/** Giây mỗi nước; 0 = không tính giờ (mọi phòng tạo trước 0109). PHẢI khớp phần đọc options.time của 0109. */
export const TIMES = [0, 3, 5, 10]
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

export const optsOf = (o) => ({ mode: MODES.includes(o?.mode) ? o.mode : 'classic', time: TIMES.includes(o?.time) ? o.time : 0 })

/** Hạn lượt hiện tại (ms, giờ server) hoặc null: phòng không tính giờ, chưa có nước đầu, nước vừa đi chưa có giờ server. */
export const deadlineOf = (s) => (s.time && s.since != null && !s.over ? s.since + s.time * 1000 : null)

/** Đã đủ quân, tới lượt thì phải di quân (chế độ move). */
export const moving = (s, seat) => s.mode === 'move' && s.q[seat].length >= PIECES
/** Quân sẽ biến mất khi `seat` đặt quân tiếp (chế độ vanish), hoặc null. */
export const fadingOf = (s, seat) => (s.mode === 'vanish' && s.q[seat].length >= PIECES ? s.q[seat][0] : null)

const cell = (x) => (Number.isInteger(x) && x >= 0 && x < 9 ? x : null)

export default {
  id: 'xo',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: { mode: 'classic', time: 3 },

  setup({ options } = {}) {
    const o = optsOf(options)
    return { mode: o.mode, time: o.time, since: null, board: Array(9).fill(null), q: [[], []], turn: 0, ply: 0, winner: null, line: null, last: null, over: false }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    // Hết giờ: ai đang ngồi cũng báo được (người tới lượt có thể đã tắt máy); chỉ server biết giờ thật.
    if (move?.timeout === true) return s.time && s.since != null ? null : 'games.err.badMove'
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

  /** Báo hết giờ phải qua server (nó so giờ rồi đóng dấu) — màn chơi không áp trước. */
  request: (s, seat, move) => move?.timeout === true,

  /** `meta.at` = giờ server ghi nước (registry.replay truyền cả dòng log); nước máy mình vừa hiện trước thì chưa có. */
  apply(s, seat, move, meta) {
    const at = Date.parse(meta?.at)
    const since = Number.isFinite(at) ? at : null
    if (move.timeout === true) {
      if (move.skip !== true) return s // chưa qua server (hoặc DB chưa chạy 0109) — không đoán
      const ply = s.ply + 1
      return { ...s, turn: 1 - s.turn, ply, since, last: { seat: s.turn, skip: true }, over: ply >= 2 * CAP }
    }
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
    // Đầy bàn (chỉ cổ điển tới được) hoặc đủ 2 × CAP lượt. Cổ điển không có lượt bị mất thì đầy bàn đúng ở lượt thứ 9 như trước.
    const draw = !line && (board.every((v) => v != null) || ply >= 2 * CAP)
    return { ...s, board, q, turn: 1 - seat, ply, since, last, line, winner: line ? seat : null, over: !!line || draw }
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner != null ? { winners: [s.winner], draw: false } : { winners: [], draw: true }
  },
}
