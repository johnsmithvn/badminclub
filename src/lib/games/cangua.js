// Cờ cá ngựa (luật truyền thống Việt Nam). 2–4 người, mỗi người 4 ngựa, một con xúc xắc. Đường đua vòng 48 ô,
// mỗi màu xuất quân ở ô riêng, chạy hết một vòng tới "cửa chuồng" (ô ngay trước ô xuất quân) rồi lên chuồng 6 bậc.
//   - Đến lượt: đổ xúc xắc (server đổ — 0079 game_cangua_fill, máy khách không biết trước số).
//   - Ra quân: đổ 1 hoặc 6 mới được đưa một ngựa từ chuồng ra ô xuất quân.
//   - Đi: ngựa tiến đúng số nút. Không được nhảy qua ngựa nào (của ai cũng vậy), không được dừng trên ngựa mình;
//     dừng trúng ngựa đối phương là đá nó về chuồng.
//   - Về chuồng: phải dừng ĐÚNG ở cửa chuồng (không được đi lố). Đứng ở cửa, đổ n thì lên thẳng bậc n (các bậc dưới
//     phải trống). Đã lên chuồng thì chỉ lên được bậc kế tiếp, và phải đổ đúng số của bậc đó.
//   - Đổ 6 được đổ tiếp. Đổ ra số không đi được con nào thì mất lượt (6 vẫn được đổ tiếp). Có nước đi thì phải đi.
//   - Thắng: 4 ngựa đứng ở bậc 3, 4, 5, 6.
//   - Rời ván (ván 3–4 người): ngựa của người đó rút khỏi bàn, những người còn lại chơi tiếp.
// Hợp đồng chung: docs/GAMES.md §3, nước server điền: §5.2. Chưa có SQL chấm lại — game_finish tin kết quả client.
//
// Màu theo ghế: 2 người đỏ / vàng (đối diện), 3 người đỏ / xanh lá / vàng, 4 người đủ 4 màu.
// pos của một ngựa: -1 trong chuồng · 0..47 số bước đã đi trên đường (0 = ô xuất quân, 47 = cửa chuồng) ·
//   48..53 = bậc chuồng 1..6.
// state = { colors[], horses[ghế][4], turn, dice (số vừa đổ, chờ đi | null), out[], over, winner, last, ply }
//   last = { seat, dice?, horse?, from?, to?, kicked?: { seat, horse }, pass?, out? }
// move  = { roll: true } (máy khách gửi; server ghi kèm dice: 1..6) · { horse: 0..3 } · { out: true } (server ghi)

export const TRACK = 48
export const DOOR = TRACK - 1
export const HOME = TRACK // bậc 1
export const LANE = 6
export const COLORS_FOR = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] }
/** Ô tuyệt đối (0..47) của ngựa màu `color` đã đi `p` bước trên đường. */
export const squareOf = (color, p) => (color * 12 + p) % TRACK

const isHorse = (k) => Number.isInteger(k) && k >= 0 && k < 4

/** Ai đang đứng ở ô đường `sq` → { seat, horse } | null. */
function standing(s, sq) {
  for (let seat = 0; seat < s.horses.length; seat++) {
    const k = s.horses[seat].findIndex((p) => p >= 0 && p < TRACK && squareOf(s.colors[seat], p) === sq)
    if (k >= 0) return { seat, horse: k }
  }
  return null
}

/** Nước đi được của ghế `seat` với số `d` → [{ horse, to, kicked? }]. */
export function movesOf(s, seat, d = s.dice) {
  if (!d) return []
  const color = s.colors[seat]
  const hs = s.horses[seat]
  const out = []
  hs.forEach((p, horse) => {
    let to = null
    if (p === -1) to = d === 1 || d === 6 ? 0 : null
    else if (p < DOOR) to = p + d <= DOOR ? p + d : null
    else if (p === DOOR) to = HOME + d - 1
    else to = p - HOME + 2 === d && p < HOME + LANE - 1 ? p + 1 : null
    if (to == null) return
    if (to >= HOME) {
      // Trong chuồng chỉ có ngựa mình: các bậc đi qua và bậc tới phải trống.
      const from = p >= HOME ? p + 1 : HOME
      for (let q = from; q <= to; q++) if (hs.includes(q)) return
      out.push({ horse, to })
      return
    }
    for (let q = p + 1; q < to; q++) if (standing(s, squareOf(color, q))) return // không nhảy qua ngựa nào
    const hit = standing(s, squareOf(color, to))
    if (hit && hit.seat === seat) return
    out.push({ horse, to, ...(hit ? { kicked: hit } : {}) })
  })
  return out
}

const done = (hs) => hs.every((p) => p >= HOME + 2)

/** Lượt kế: ghế còn chơi tiếp theo sau `seat`. */
function nextSeat(s, seat) {
  const n = s.horses.length
  for (let k = 1; k <= n; k++) {
    const y = (seat + k) % n
    if (!s.out[y]) return y
  }
  return seat
}

/** Sau khi xong một lần đổ: 6 thì đổ tiếp, không thì sang người kế. */
const passOn = (s, seat, d) => ({ ...s, dice: null, turn: d === 6 ? seat : nextSeat(s, seat) })

export default {
  id: 'cangua',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: {},

  setup(room) {
    const n = Math.min(4, Math.max(2, room?.seats?.length || 2))
    return {
      colors: COLORS_FOR[n], horses: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0, dice: null,
      out: Array(n).fill(false), over: false, winner: null, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.horses.length || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (move?.roll === true) {
      if (s.dice != null) return 'games.err.rolled'
      // Máy khách gửi không kèm số (server điền). Số trong log phải là 1..6.
      return move.dice === undefined || (Number.isInteger(move.dice) && move.dice >= 1 && move.dice <= 6) ? null : 'games.err.badMove'
    }
    if (!isHorse(move?.horse)) return 'games.err.badMove'
    if (s.dice == null) return 'games.err.mustRoll'
    return movesOf(s, seat).some((m) => m.horse === move.horse) ? null : 'games.err.cantMove'
  },

  /** Nước đổ xúc xắc cần server điền số — màn chơi không hiện trước (useGameRoom.play). */
  request: (s, seat, move) => move?.roll === true,

  apply(s0, seat, move) {
    if (move.out === true) {
      const horses = s0.horses.map((hs, i) => (i === seat ? [-1, -1, -1, -1] : hs))
      const out = s0.out.map((o, i) => o || i === seat)
      let s = { ...s0, horses, out, ply: s0.ply + 1, last: { seat, out: true } }
      if (s0.turn === seat) s = { ...s, dice: null, turn: nextSeat(s, seat) }
      const alive = out.map((o, i) => (o ? null : i)).filter((i) => i != null)
      return alive.length <= 1 ? { ...s, over: true, winner: alive[0] ?? null, turn: null } : s
    }
    if (move.roll === true) {
      if (move.dice === undefined) return s0 // server chưa điền (thiếu 0079) — bỏ qua, không đoán số
      const s = { ...s0, dice: move.dice, ply: s0.ply + 1, last: { seat, dice: move.dice } }
      if (movesOf(s, seat).length) return s
      return passOn({ ...s, last: { seat, dice: move.dice, pass: true } }, seat, move.dice)
    }
    const m = movesOf(s0, seat).find((x) => x.horse === move.horse)
    const horses = s0.horses.map((hs, i) => hs.map((p, k) => {
      if (i === seat && k === m.horse) return m.to
      if (m.kicked && i === m.kicked.seat && k === m.kicked.horse) return -1
      return p
    }))
    const s = {
      ...s0, horses, ply: s0.ply + 1,
      last: { seat, dice: s0.dice, horse: m.horse, from: s0.horses[seat][m.horse], to: m.to, ...(m.kicked ? { kicked: m.kicked } : {}) },
    }
    if (done(horses[seat])) return { ...s, dice: null, over: true, winner: seat, turn: null }
    return passOn(s, seat, s0.dice)
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner == null ? { winners: [], draw: true } : { winners: [s.winner], draw: false }
  },
}
