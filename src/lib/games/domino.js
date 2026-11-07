// Domino (bộ đôi-sáu, 28 quân, kiểu "bốc" — draw game). 2–4 người, mỗi người 7 quân, còn lại úp làm nọc.
//   - Ván đầu: ai có con đôi cao nhất đi trước, nước đầu phải đánh con đó (không ai có đôi thì con lớn nhất).
//     Ván chơi lại: người thắng ván trước đi trước, đánh con nào cũng được.
//   - Đến lượt: đặt một quân khớp số với một đầu dây. Không có quân khớp thì bốc nọc từng con tới khi đánh được;
//     nọc hết mà vẫn không đánh được thì bỏ lượt. Có quân khớp thì phải đánh (không được bốc / bỏ).
//   - Hết quân trước là thắng. Cả bàn bỏ lượt liền nhau (tắc) thì ai còn ít nút nhất thắng, bằng nhau thì hoà.
//   - Điểm: người thắng ăn tổng nút còn trên tay các đối thủ.
//
// Game có THÔNG TIN ẨN (docs/GAMES.md §5.2): quân trên tay ở game_hands (nọc ở ghế -1, không ai đọc được). Server
// (0081 game_domino_fill) kiểm từng nước với đủ quân từng tay — đánh quân không có / bốc khi đang có quân khớp / bỏ
// lượt khi còn nọc đều bị từ chối, nên log chỉ có nước đúng. Bốc: server chuyển một quân ngẫu nhiên từ nọc vào tay,
// log chỉ ghi { draw: true } (không lộ quân). Điểm (cần quân còn lại) chỉ server chấm — game_domino_result.
// Đổi luật ở đây là phải đổi cả ở 0081.
//
// Quân t = 0..27, TILES[t] = [a, b] với a ≤ b (0 = trắng). Đôi: a = b.
// state = { started, counts[], pile, line[] ([a, b] theo thứ tự trái → phải), left, right, turn, lead, passes, out[],
//           over, winner, last, ply }
// move  = { play: t, end: 'L' | 'R' } · { draw: true } · { pass: true } · { out: true } · { deal } (hai nước cuối server ghi)
//   deal = { first, lead (quân bắt buộc của nước đầu | null), n[] (số quân mỗi người), pile }

export const TILES = []
for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) TILES.push([a, b])
export const HAND = 7
export const pipsOf = (t) => TILES[t][0] + TILES[t][1]

const isTile = (t) => Number.isInteger(t) && t >= 0 && t < TILES.length

/** Đầu nào đặt được quân `t`: ['L', 'R'] (dây trống: ['L']). */
export function endsFor(s, t) {
  if (!s.line.length) return ['L']
  const [a, b] = TILES[t]
  const out = []
  if (a === s.left || b === s.left) out.push('L')
  if (a === s.right || b === s.right) out.push('R')
  return out
}

function nextSeat(s, seat) {
  const n = s.counts.length
  for (let k = 1; k <= n; k++) {
    const y = (seat + k) % n
    if (!s.out[y]) return y
  }
  return seat
}
const alive = (s) => s.out.filter((o) => !o).length

export default {
  id: 'domino',
  minPlayers: 2,
  maxPlayers: 4,
  defaultOptions: {},

  setup() {
    return {
      started: false, counts: [], pile: 0, line: [], left: null, right: null, turn: null, lead: null, passes: 0, out: [],
      over: false, winner: null, last: null, ply: 0,
    }
  },

  validate(s, seat, move) {
    const d = move?.deal
    if (d && typeof d === 'object') {
      if (s.started) return 'games.err.badMove'
      if (!Array.isArray(d.n) || d.n.length < 2 || d.n.length > 4 || !d.n.every((k) => k === HAND)) return 'games.err.badMove'
      if (!Number.isInteger(d.first) || d.first < 0 || d.first >= d.n.length || seat !== d.first) return 'games.err.badMove'
      if (d.lead != null && !isTile(d.lead)) return 'games.err.badMove'
      return Number.isInteger(d.pile) && d.pile === TILES.length - HAND * d.n.length ? null : 'games.err.badMove'
    }
    if (!s.started) return 'games.err.badMove'
    if (s.over) return 'games.err.over'
    if (!Number.isInteger(seat) || seat < 0 || seat >= s.counts.length || s.out[seat]) return 'games.err.badMove'
    if (move?.out === true) return null
    if (seat !== s.turn) return 'games.err.notYourTurn'
    if (move?.draw === true || move?.pass === true) {
      if (!s.line.length) return 'games.err.mustLead'
      if (move.draw) return s.pile > 0 ? null : 'games.err.pileEmpty'
      return s.pile > 0 ? 'games.err.mustDraw' : null
    }
    const tile = move?.play
    if (!isTile(tile)) return 'games.err.badMove'
    // Máy này không biết quân người khác: chỉ chặn quân đã nằm trên dây. Server chặn đủ (quân không có trên tay).
    if (s.line.some(([a, b]) => TILES[tile][0] === Math.min(a, b) && TILES[tile][1] === Math.max(a, b))) return 'games.err.notYourCard'
    if (s.lead != null && tile !== s.lead) return 'games.err.mustOpen'
    const ends = endsFor(s, tile)
    if (!ends.length) return 'games.err.noMatch'
    if (s.line.length && !ends.includes(move.end)) return ends.length && move.end == null ? 'games.err.pickEnd' : 'games.err.noMatch'
    return null
  },

  /** Bốc nọc cần server (chuyển quân vào tay) — màn chơi không hiện trước, chờ log rồi nạp lại tay. */
  request: (s, seat, move) => move?.draw === true,

  apply(s0, seat, move) {
    const s = { ...s0, ply: s0.ply + 1 }
    if (move.deal) {
      const { n, first, lead, pile } = move.deal
      return { ...s, started: true, counts: n.slice(), pile, turn: first, lead: lead ?? null, out: n.map(() => false), last: null }
    }
    if (move.out === true) {
      const out = s.out.map((o, i) => o || i === seat)
      let next = { ...s, out, last: { seat, out: true } }
      if (s.turn === seat) next = { ...next, turn: nextSeat(next, seat) }
      if (alive(next) <= 1) return { ...next, over: true, winner: out.findIndex((o) => !o), turn: null }
      return next.passes >= alive(next) ? { ...next, over: true, turn: null } : next
    }
    if (move.draw) {
      return { ...s, counts: s.counts.map((k, i) => (i === seat ? k + 1 : k)), pile: s.pile - 1, passes: 0, last: { seat, draw: true } }
    }
    if (move.pass) {
      const next = { ...s, passes: s.passes + 1, turn: nextSeat(s, seat), last: { seat, pass: true } }
      return next.passes >= alive(next) ? { ...next, over: true, turn: null } : next
    }
    const [a, b] = TILES[move.play]
    let { line, left, right } = s
    if (!line.length) { line = [[a, b]]; left = a; right = b } else if (move.end === 'L') {
      const piece = b === left ? [a, b] : [b, a]
      line = [piece, ...line]
      left = piece[0]
    } else {
      const piece = a === right ? [a, b] : [b, a]
      line = [...line, piece]
      right = piece[1]
    }
    const counts = s.counts.map((k, i) => (i === seat ? k - 1 : k))
    const next = {
      ...s, line, left, right, counts, lead: null, passes: 0, turn: nextSeat(s, seat),
      last: { seat, play: move.play, end: s.line.length ? move.end : 'L' },
    }
    return counts[seat] === 0 ? { ...next, over: true, winner: seat, turn: null } : next
  },

  view: (s) => s,

  /**
   * Hết quân → người đó thắng. Tắc → máy này không biết ai ít nút nhất: trả `pending` để vẫn gọi game_finish,
   * server (game_domino_result) chấm thật. Điểm luôn là của server (room.result).
   */
  result(s) {
    if (!s.over) return null
    return s.winner != null ? { winners: [s.winner], draw: false } : { winners: [], draw: false, pending: true }
  },
}
