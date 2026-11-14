// Ô ăn quan (dân gian): mỗi người một hàng ô dân, giữa hai hàng là ô quan. Đến lượt thì bốc hết sỏi
// một ô dân bên mình, rải mỗi ô một viên theo một chiều; rải xong xem ô kế tiếp:
//   - ô dân còn sỏi  → bốc tiếp ô đó, rải tiếp cùng chiều
//   - ô quan còn quân → dừng, hết lượt (sỏi trong ô quan không được bốc) — trừ luật NHÓN (tuỳ chọn): ô quan có dân
//     thì nhón 1 dân (chỉ dân, không nhón quan), đẩy sang ô ngay sau quan (hàng người kế) rồi xét tiếp như vừa rải
//     xong ở đó; quan không còn dân thì không nhón được
//   - ô trống         → ô sau nữa có sỏi thì ĂN cả ô đó; ăn xong gặp "trống rồi có sỏi" thì ăn tiếp
//   - hai ô trống liền → hết lượt
//   - quan non: ô quan còn quan mà dưới 5 dân thì CHƯA ăn được — gặp là mất lượt. Không có luật này thì
//     nước đầu tiên đã ăn được quan, hai bên ăn hai quan là hết ván sau 2 nước.
// Hết lượt mà cả hàng dân của người sắp đi đều trống → người đó lấy (số ô một hàng) điểm rải lại mỗi ô
// một viên; không đủ điểm thì ván kết thúc. Hết mọi quan → ván kết thúc, sỏi còn bên nào về bên đó
// ("hết quan, tàn dân, thu quân, kéo về"). Nhiều điểm nhất thì thắng (bằng nhau ở đầu bảng thì cùng thắng; ai cũng bằng nhau = hoà).
// Hợp đồng chung: docs/GAMES.md §3. Server chấm lại bằng SQL: 0104 game_oanquan_run — đổi luật ở đây
// là phải đổi cả ở đó (oanquan.test.js chạy chung bộ ván mẫu với file kiểm 0075 để gác).
//
// Tuỳ chọn phòng (optsOf ↔ 0104): quans 2 | 3 (= số người; 3 = bàn tam giác) · rows 5 | 6 | 7 ô dân mỗi hàng ·
// stones 5 | 6 | 7 dân mỗi ô · nhon · time 0 | 20 | 30 | 50 giây mỗi nước (0 = không giới hạn).
// Mặc định (2 quan, 5 ô, 5 dân, không nhón) = luật cũ, ván cũ chấm ra y như trước.
//
// Vòng ô (chiều +1), R = rows, P = quans, N = P·(R+1):
//   quan của "đoạn" k ở ô k·(R+1) · dân của ghế k là k·(R+1)+1 … k·(R+1)+R.
//   2 quan, 5 ô: 0 = quan trái · 1..5 = ghế 0 (hàng dưới, trái → phải) · 6 = quan phải · 7..11 = ghế 1 (hàng trên).
// state = { opts, stones[N], quan[N], score[P], out[P], quanValue, turn, ply, over, winners, last, since }
//   last = { seat, cell, dir, taken[], frames[], timeout? } — frames: từng bước của nước vừa đi để bàn diễn lại
//   since = giờ server (ms) của nước gần nhất — tính hạn lượt khi có đồng hồ.
//   out  = ghế đã rời ván (bàn 3 quan): mất lượt từ đó, không được tính thắng; ô dân của họ vẫn nằm trên bàn, người
//          khác vẫn rải qua / ăn được, hết ván dân còn bên đó vẫn về điểm của họ (không ai hưởng).
// move  = { cell, dir } — cell là ô dân của mình, dir ∈ { 1, -1 }
//       · { timeout: true } (máy khách báo hết giờ) → server ghi { cell, dir, timeout: true } đi thay người tới lượt
//       · { start: true } — server ghi lúc bắt đầu phòng có đồng hồ (0104 game_oanquan_deal), chỉ để lấy giờ.
//       · { out: true } — server ghi khi người đó rời ván / mất kết nối mà bàn còn ≥ 2 người (game_leave / game_claim).
//         KHÔNG đổi ply / last: bàn không diễn lại nước cũ, chỉ chuyển lượt (0108 game_oanquan_run chép y vậy).

export const QUANS = [2, 3]
export const ROWS = [5, 6, 7]
export const STONES = [5, 6, 7]
export const TIMES = [0, 20, 30, 50]
export const optsOf = (o) => ({
  quans: QUANS.includes(o?.quans) ? o.quans : 2,
  rows: ROWS.includes(o?.rows) ? o.rows : 5,
  stones: STONES.includes(o?.stones) ? o.stones : 5,
  nhon: o?.nhon === true,
  time: TIMES.includes(o?.time) ? o.time : 0,
})
// Không phải tuỳ chọn: số cố định để server chấm (0104) không phải tin số client gửi.
export const QUAN_VALUE = 10
export const QUAN_NON = 5
// Chặn vòng lặp rải vô tận (về lý thuyết bốc-rải có thể quay vòng). Thực tế một lượt chỉ vài chục bước.
export const MAX_STEPS = 2000
// Diễn lại tối đa bấy nhiêu bước; dài hơn thì bàn nhảy thẳng tới kết quả.
const MAX_FRAMES = 300

const sizeOf = (s) => s.stones.length
const next = (s, i, dir) => (i + dir + sizeOf(s)) % sizeOf(s)
/** Các ô quan: 0, R+1, 2(R+1)… */
export const quanCells = (s) => Array.from({ length: s.opts.quans }, (_, k) => k * (s.opts.rows + 1))
/** Ô dân của ghế. */
export const sideOf = (s, seat) => Array.from({ length: s.opts.rows }, (_, k) => seat * (s.opts.rows + 1) + 1 + k)
export const isQuanCell = (s, i) => i % (s.opts.rows + 1) === 0
const empty = (s, i) => s.stones[i] === 0 && !s.quan[i]
/** Ô ăn được: dân còn sỏi, hoặc quan đã "già" (đủ QUAN_NON dân). */
const eatable = (s, i) => (s.quan[i] ? s.stones[i] >= QUAN_NON : s.stones[i] > 0)
const worth = (s, i) => s.stones[i] + (s.quan[i] ? s.quanValue : 0)
/** Quan còn đó mà chưa đủ dân — bàn chơi vẽ mờ đi cho người chơi biết chưa ăn được. */
export const isQuanNon = (s, i) => s.quan[i] && s.stones[i] < QUAN_NON
/** Hạn lượt hiện tại (ms, giờ server) hoặc null. */
export const deadlineOf = (s) => (s.opts.time && s.since != null && !s.over ? s.since + s.opts.time * 1000 : null)
/** Nước hợp lệ của người tới lượt (bot, điền thay khi hết giờ). */
export const movesOf = (s) => sideOf(s, s.turn).filter((c) => s.stones[c] > 0).flatMap((cell) => [{ cell, dir: 1 }, { cell, dir: -1 }])

/**
 * Hàng chờ để bàn diễn lại: q[0] là thế đang hiện, phần sau chờ tới lượt. Nước mới KHÔNG cắt ngang nước đang diễn
 * (máy trả lời sau 450ms trong khi một nước diễn 1–3 giây — cắt ngang là người chơi không thấy nước của chính mình).
 *   cùng ply với cuối hàng → thay chỗ (cùng thế, object mới) · ply lớn hơn → xếp vào cuối ·
 *   ply nhỏ hơn (ván mới / đi lại) → bỏ cả hàng, hiện ngay.
 */
export function queueStates(q, s) {
  const tail = q[q.length - 1]
  if (!tail || s.ply < tail.ply) return [s]
  if (tail === s) return q
  return s.ply === tail.ply ? [...q.slice(0, -1), s] : [...q, s]
}

/** Ghế kế tiếp còn trong ván sau `seat` (vòng tròn). */
function nextSeat(s, seat) {
  for (let k = 1; k <= s.opts.quans; k++) {
    const y = (seat + k) % s.opts.quans
    if (!s.out[y]) return y
  }
  return seat
}

/**
 * Hết quan, tàn dân: sỏi còn bên nào về bên đó, ô quan (nếu còn sỏi lẻ) không của ai.
 * Người thắng = điểm cao nhất trong những người CÒN trong ván. Cả bàn bằng điểm = hoà; đã có người rời thì người rời
 * thua, những người còn lại bằng điểm nhau là cùng thắng (không tính hoà — hoà là người bỏ ván không mất gì).
 */
function sweep(s) {
  for (let seat = 0; seat < s.opts.quans; seat++) {
    for (const i of sideOf(s, seat)) { s.score[seat] += s.stones[i]; s.stones[i] = 0 }
  }
  s.over = true
  const live = s.score.flatMap((_, k) => (s.out[k] ? [] : [k]))
  const top = Math.max(...live.map((k) => s.score[k]))
  const tops = live.filter((k) => s.score[k] === top)
  s.winners = tops.length === s.opts.quans ? [] : tops
}

/**
 * Đầu lượt của `s.turn`: hết quan → thu quân, hết ván; người sắp đi hết dân bên mình → rải lại mỗi ô một viên từ điểm
 * của mình, không đủ điểm thì hết ván. `snap` ghi bước cho bàn diễn lại.
 */
function startTurn(s, snap) {
  if (quanCells(s).every((q) => empty(s, q))) { sweep(s); snap('sweep', null); return }
  const side = sideOf(s, s.turn)
  if (!side.every((k) => s.stones[k] === 0)) return
  if (s.score[s.turn] < side.length) { sweep(s); snap('sweep', null); return }
  s.score[s.turn] -= side.length
  for (const k of side) s.stones[k] = 1
  snap('refill', s.turn)
}

const game = {
  id: 'oanquan',
  minPlayers: 2,
  maxPlayers: 3,
  /** Số người đúng bằng số quan (bàn tam giác 3 người). */
  players: (options) => [optsOf(options).quans, optsOf(options).quans],
  defaultOptions: { quans: 2, rows: 5, stones: 5, nhon: false, time: 0 },

  setup({ options } = {}) {
    const opts = optsOf(options)
    const N = opts.quans * (opts.rows + 1)
    const stones = Array(N).fill(opts.stones)
    const quan = Array(N).fill(false)
    for (let k = 0; k < opts.quans; k++) { stones[k * (opts.rows + 1)] = 0; quan[k * (opts.rows + 1)] = true }
    return {
      opts, stones, quan, score: Array(opts.quans).fill(0), out: Array(opts.quans).fill(false), quanValue: QUAN_VALUE,
      turn: 0, ply: 0, over: false, winners: null, last: null, since: null,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    // Chỉ server ghi (0108 từ chối máy khách gửi): ghế còn trong ván mới rời được.
    if (move?.out === true) return Number.isInteger(seat) && seat >= 0 && seat < s.opts.quans && !s.out[seat] ? null : 'games.err.badMove'
    if (move?.start === true) return s.ply === 0 && s.since == null ? null : 'games.err.badMove'
    if (move?.timeout === true) {
      // Máy khách báo hết giờ (chưa có ô): server mới biết giờ thật — sớm thì games.err.notYet, máy tự thử lại.
      if (move.cell === undefined) return s.opts.time ? null : 'games.err.badMove'
      seat = s.turn
    }
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const cell = move?.cell
    if (!sideOf(s, seat).includes(cell)) return 'games.err.notYourCell'
    if (move.dir !== 1 && move.dir !== -1) return 'games.err.badMove'
    if (s.stones[cell] === 0) return 'games.err.emptyCell'
    return null
  },

  /** Báo hết giờ phải qua server (nó chọn nước đi thay) — màn chơi không áp trước. */
  request: (s, seat, move) => move?.timeout === true,

  apply(s0, seat0, move, meta) {
    const at = Date.parse(meta?.at)
    const stamp = (s) => (Number.isFinite(at) ? { ...s, since: at } : s)
    if (move.start === true) return stamp(s0)
    if (move.out === true) {
      const s = { ...s0, stones: s0.stones.slice(), quan: s0.quan.slice(), score: s0.score.slice(), out: s0.out.map((o, i) => o || i === seat0) }
      // Còn ≤ 1 người: hết ván (thực tế server đã xử thắng người còn lại trước khi tới đây).
      if (s.out.filter((o) => !o).length <= 1) { sweep(s); return stamp(s) }
      // Không phải lượt người rời: lượt và hạn giờ giữ nguyên.
      if (s0.turn !== seat0) return s
      s.turn = nextSeat(s, seat0)
      startTurn(s, () => {})
      return stamp(s)
    }
    if (move.timeout === true && move.cell === undefined) return s0 // chưa qua server
    const seat = move.timeout === true ? s0.turn : seat0
    const { cell, dir } = move
    const s = { ...s0, stones: s0.stones.slice(), quan: s0.quan.slice(), score: s0.score.slice() }
    const taken = []
    const frames = []
    let hand = 0
    // kind: pick | drop | eat | refill | sweep — at: ô vừa xảy ra chuyện (refill: ghế được rải lại).
    const snap = (kind, at) => {
      if (frames.length < MAX_FRAMES) frames.push({ kind, at, hand, stones: s.stones.slice(), quan: s.quan.slice(), score: s.score.slice() })
    }

    let i = cell
    hand = s.stones[i]; s.stones[i] = 0; snap('pick', i)
    let steps = 0

    for (;;) {
      while (hand > 0) { i = next(s, i, dir); s.stones[i] += 1; hand -= 1; steps += 1; snap('drop', i) }
      let n = next(s, i, dir)
      if (!empty(s, n)) {
        if (steps > MAX_STEPS) break
        if (isQuanCell(s, n)) {
          // Nhón: ô quan có dân → lấy 1 DÂN (không bao giờ nhón quan), rơi xuống ô ngay sau quan, xét tiếp như vừa
          // rải xong ở đó. Ô quan không còn dân (chỉ còn quan) → không nhón được, dừng như luật thường.
          if (!s.opts.nhon || s.stones[n] === 0) break
          s.stones[n] -= 1; hand = 1; i = n; snap('pick', i)
          continue
        }
        hand = s.stones[n]; s.stones[n] = 0; i = n; snap('pick', i)
        continue
      }
      // Ô kế tiếp trống: ăn ô sau nó, rồi cứ "trống – ăn được" là ăn tiếp. Gặp quan non thì dừng.
      let m = next(s, n, dir)
      while (empty(s, n) && eatable(s, m)) {
        s.score[seat] += worth(s, m)
        taken.push(m)
        s.stones[m] = 0
        s.quan[m] = false
        snap('eat', m)
        n = next(s, m, dir)
        m = next(s, n, dir)
      }
      break
    }

    s.last = { seat, cell, dir, taken, frames, ...(move.timeout === true ? { timeout: true } : {}) }
    s.turn = nextSeat(s, seat)
    s.ply = s0.ply + 1
    startTurn(s, snap)
    return stamp(s)
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winners.length ? { winners: s.winners, draw: false } : { winners: [], draw: true }
  },
}

export default game
