// Ô ăn quan (dân gian): 10 ô dân chia hai hàng, hai ô quan ở hai đầu. Đến lượt thì bốc hết sỏi
// một ô dân bên mình, rải mỗi ô một viên theo một chiều; rải xong xem ô kế tiếp:
//   - ô dân còn sỏi  → bốc tiếp ô đó, rải tiếp cùng chiều
//   - ô quan còn quân → dừng, hết lượt (sỏi trong ô quan không được bốc)
//   - ô trống         → ô sau nữa có sỏi thì ĂN cả ô đó; ăn xong gặp "trống rồi có sỏi" thì ăn tiếp
//   - hai ô trống liền → hết lượt
//   - quan non: ô quan còn quan mà dưới 5 dân thì CHƯA ăn được — gặp là mất lượt. Không có luật này thì
//     nước đầu tiên đã ăn được quan, hai bên ăn hai quan là hết ván sau 2 nước.
// Hết lượt mà cả 5 ô dân bên người sắp đi đều trống → người đó lấy 5 điểm của mình rải lại mỗi ô
// một viên; không đủ 5 điểm thì ván kết thúc. Hết cả hai quan → ván kết thúc, sỏi còn bên nào về
// bên đó ("hết quan, tàn dân, thu quân, kéo về"). Nhiều điểm hơn thì thắng.
// Hợp đồng chung: docs/GAMES.md §3. Server chấm lại bằng SQL: 0075 game_oanquan_result — đổi luật ở đây
// là phải đổi cả ở đó (oanquan.test.js chạy chung bộ ván mẫu với file kiểm 0075 để gác).
//
// Vòng ô (chiều +1):  0 = quan trái · 1..5 = dân của ghế 0 (hàng dưới, trái → phải) ·
//                     6 = quan phải · 7..11 = dân của ghế 1 (hàng trên, phải → trái)
// state = { stones[12], quan[12], score: [s0, s1], quanValue, turn, ply, over, winner, last }
//   last = { seat, cell, dir, taken[], frames[] } — frames: từng bước của nước vừa đi để bàn diễn lại
// move  = { cell, dir }  — cell là ô dân của mình, dir ∈ { 1, -1 }

const N = 12
const QUAN_CELLS = [0, 6]
// Không có tuỳ chọn phòng: số cố định để server chấm (0075) không phải tin số client gửi.
export const QUAN_VALUE = 10
export const START_STONES = 5
export const QUAN_NON = 5
// Chặn vòng lặp rải vô tận (về lý thuyết bốc-rải có thể quay vòng). Thực tế một lượt chỉ vài chục bước.
export const MAX_STEPS = 2000
// Diễn lại tối đa bấy nhiêu bước; dài hơn thì bàn nhảy thẳng tới kết quả.
const MAX_FRAMES = 300

const next = (i, dir) => (i + dir + N) % N
export const sideOf = (seat) => (seat === 0 ? [1, 2, 3, 4, 5] : [7, 8, 9, 10, 11])
const isQuanCell = (i) => i === 0 || i === 6
const empty = (s, i) => s.stones[i] === 0 && !s.quan[i]
/** Ô ăn được: dân còn sỏi, hoặc quan đã "già" (đủ QUAN_NON dân). */
const eatable = (s, i) => (s.quan[i] ? s.stones[i] >= QUAN_NON : s.stones[i] > 0)
const worth = (s, i) => s.stones[i] + (s.quan[i] ? s.quanValue : 0)
/** Quan còn đó mà chưa đủ dân — bàn chơi vẽ mờ đi cho người chơi biết chưa ăn được. */
export const isQuanNon = (s, i) => s.quan[i] && s.stones[i] < QUAN_NON

/** Hết quan, tàn dân: sỏi còn bên nào về bên đó, ô quan (nếu còn sỏi lẻ) không của ai. */
function sweep(s) {
  for (const seat of [0, 1]) {
    for (const i of sideOf(seat)) { s.score[seat] += s.stones[i]; s.stones[i] = 0 }
  }
  s.over = true
  s.winner = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1
}

export default {
  id: 'oanquan',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    const stones = Array(N).fill(START_STONES)
    const quan = Array(N).fill(false)
    for (const q of QUAN_CELLS) { stones[q] = 0; quan[q] = true }
    return { stones, quan, score: [0, 0], quanValue: QUAN_VALUE, turn: 0, ply: 0, over: false, winner: null, last: null }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const cell = move?.cell
    if (!sideOf(seat).includes(cell)) return 'games.err.notYourCell'
    if (move.dir !== 1 && move.dir !== -1) return 'games.err.badMove'
    if (s.stones[cell] === 0) return 'games.err.emptyCell'
    return null
  },

  apply(s0, seat, { cell, dir }) {
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
      while (hand > 0) { i = next(i, dir); s.stones[i] += 1; hand -= 1; steps += 1; snap('drop', i) }
      let n = next(i, dir)
      if (!empty(s, n)) {
        if (isQuanCell(n) || steps > MAX_STEPS) break
        hand = s.stones[n]; s.stones[n] = 0; i = n; snap('pick', i)
        continue
      }
      // Ô kế tiếp trống: ăn ô sau nó, rồi cứ "trống – ăn được" là ăn tiếp. Gặp quan non thì dừng.
      let m = next(n, dir)
      while (empty(s, n) && eatable(s, m)) {
        s.score[seat] += worth(s, m)
        taken.push(m)
        s.stones[m] = 0
        s.quan[m] = false
        snap('eat', m)
        n = next(m, dir)
        m = next(n, dir)
      }
      break
    }

    s.last = { seat, cell, dir, taken, frames }
    s.turn = 1 - seat
    s.ply = s0.ply + 1

    if (QUAN_CELLS.every((q) => empty(s, q))) { sweep(s); snap('sweep', null); return s }

    // Người sắp đi hết dân bên mình → rải lại 5 viên từ điểm của mình, không đủ thì hết ván.
    const side = sideOf(s.turn)
    if (side.every((k) => s.stones[k] === 0)) {
      if (s.score[s.turn] < side.length) { sweep(s); snap('sweep', null); return s }
      s.score[s.turn] -= side.length
      for (const k of side) s.stones[k] = 1
      snap('refill', s.turn)
    }
    return s
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner == null ? { winners: [], draw: true } : { winners: [s.winner], draw: false }
  },
}
