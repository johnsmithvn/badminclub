// Cờ vua (luật FIDE). 2 người, quân trắng (ghế 0) đi trước. Đủ luật: nhập thành, bắt tốt qua đường, phong cấp,
// chiếu hết, hết nước (stalemate) hoà, 50 nước không ăn quân / không đi tốt hoà, lặp thế 3 lần hoà, không đủ quân
// chiếu hết hoà (vua đơn, vua + 1 mã / 1 tượng, các tượng cùng màu ô).
// Hợp đồng chung: docs/GAMES.md §3. Chưa có SQL chấm lại — game_finish tin kết quả client (như Giai đoạn 1 trước 0075).
// ponytail: không có cầu hoà / đồng hồ — thêm khi CLB cần.
//
// Ô i = hàng * 8 + cột, hàng 0 = hàng 8 của bàn (phía quân đen), cột 0 = cột a.
// Quân: chữ hoa = trắng, chữ thường = đen — K vua, Q hậu, R xe, B tượng, N mã, P tốt.
// state = { board[64] (null | quân), turn, castle ('KQkq' còn quyền nào), ep (ô bắt qua đường | null), half (nước
//           kể từ lần ăn quân / đi tốt gần nhất), reps { thế: số lần }, ply, check (ô vua bị chiếu | null),
//           over, winner, reason ('mate' | 'stalemate' | 'fifty' | 'repetition' | 'material'), last }
//   last = { seat, from, to, promo?, captured, castle? }
// move  = { from, to, promo? } — promo 'q' | 'r' | 'b' | 'n', bắt buộc khi tốt lên hàng cuối.

export const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR'
export const PROMOS = ['q', 'r', 'b', 'n']

export const colorOf = (p) => (p == null ? null : p === p.toUpperCase() ? 0 : 1)
export const typeOf = (p) => p.toUpperCase()
const at = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7 ? -1 : r * 8 + c)
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
const KING = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
const ROOK = KING.slice(0, 4)
const BISHOP = KING.slice(4)

/** Ô `sq` có bị bên `by` khống chế không. */
export function attacked(b, sq, by) {
  const r = sq >> 3
  const c = sq & 7
  const pawn = by === 0 ? 'P' : 'p'
  for (const dc of [-1, 1]) {
    const j = at(by === 0 ? r + 1 : r - 1, c + dc)
    if (j >= 0 && b[j] === pawn) return true
  }
  const is = (j, types) => j >= 0 && b[j] != null && colorOf(b[j]) === by && types.includes(typeOf(b[j]))
  if (KNIGHT.some(([dr, dc]) => is(at(r + dr, c + dc), 'N'))) return true
  if (KING.some(([dr, dc]) => is(at(r + dr, c + dc), 'K'))) return true
  const ray = (dirs, types) => dirs.some(([dr, dc]) => {
    for (let k = 1; ; k++) {
      const j = at(r + dr * k, c + dc * k)
      if (j < 0) return false
      if (b[j] != null) return is(j, types)
    }
  })
  return ray(ROOK, 'RQ') || ray(BISHOP, 'BQ')
}

const kingOf = (b, seat) => b.indexOf(seat === 0 ? 'K' : 'k')
const inCheck = (b, seat) => attacked(b, kingOf(b, seat), 1 - seat)

/** Đi nước `m` trên bàn `b` (không kiểm luật) → { board, captured, castle }. */
function play(b0, m, seat, ep) {
  const b = b0.slice()
  const p = b[m.from]
  let captured = b[m.to]
  b[m.to] = m.promo ? (seat === 0 ? m.promo.toUpperCase() : m.promo) : p
  b[m.from] = null
  if (typeOf(p) === 'P' && m.to === ep && (m.to & 7) !== (m.from & 7)) {
    const cap = m.to + (seat === 0 ? 8 : -8)
    captured = b[cap]
    b[cap] = null
  }
  let castle = false
  if (typeOf(p) === 'K' && Math.abs(m.to - m.from) === 2) {
    const rook = m.to > m.from ? m.from + 3 : m.from - 4
    b[(m.from + m.to) / 2] = b[rook]
    b[rook] = null
    castle = true
  }
  return { board: b, captured: captured ?? null, castle }
}

/** Mọi nước hợp lệ của bên `seat` (đã bỏ nước để vua mình bị chiếu). */
export function legalMoves(s, seat = s.turn) {
  const b = s.board
  const out = []
  const last = seat === 0 ? 0 : 7
  const add = (from, to) => {
    if (typeOf(b[from]) === 'P' && to >> 3 === last) for (const promo of PROMOS) out.push({ from, to, promo })
    else out.push({ from, to })
  }
  for (let i = 0; i < 64; i++) {
    const p = b[i]
    if (p == null || colorOf(p) !== seat) continue
    const r = i >> 3
    const c = i & 7
    const t = typeOf(p)
    if (t === 'P') {
      const d = seat === 0 ? -1 : 1
      const one = at(r + d, c)
      if (one >= 0 && b[one] == null) {
        add(i, one)
        const two = at(r + 2 * d, c)
        if (r === (seat === 0 ? 6 : 1) && b[two] == null) out.push({ from: i, to: two })
      }
      for (const dc of [-1, 1]) {
        const j = at(r + d, c + dc)
        if (j >= 0 && ((b[j] != null && colorOf(b[j]) !== seat) || j === s.ep)) add(i, j)
      }
    } else if (t === 'N' || t === 'K') {
      for (const [dr, dc] of t === 'N' ? KNIGHT : KING) {
        const j = at(r + dr, c + dc)
        if (j >= 0 && colorOf(b[j]) !== seat) out.push({ from: i, to: j })
      }
    } else {
      for (const [dr, dc] of t === 'R' ? ROOK : t === 'B' ? BISHOP : KING) {
        for (let k = 1; ; k++) {
          const j = at(r + dr * k, c + dc * k)
          if (j < 0) break
          if (b[j] == null) { out.push({ from: i, to: j }); continue }
          if (colorOf(b[j]) !== seat) out.push({ from: i, to: j })
          break
        }
      }
    }
  }
  // Nhập thành: vua, xe chưa đi; ô giữa trống; vua không đang bị chiếu, không đi qua / tới ô bị khống chế.
  const k = seat === 0 ? 60 : 4
  const foe = 1 - seat
  const [K, Q, R] = seat === 0 ? ['K', 'Q', 'R'] : ['k', 'q', 'r']
  if (b[k] === K && !attacked(b, k, foe)) {
    if (s.castle.includes(K) && b[k + 3] === R && b[k + 1] == null && b[k + 2] == null
      && !attacked(b, k + 1, foe) && !attacked(b, k + 2, foe)) out.push({ from: k, to: k + 2 })
    if (s.castle.includes(Q) && b[k - 4] === R && b[k - 1] == null && b[k - 2] == null && b[k - 3] == null
      && !attacked(b, k - 1, foe) && !attacked(b, k - 2, foe)) out.push({ from: k, to: k - 2 })
  }
  return out.filter((m) => !inCheck(play(b, m, seat, s.ep).board, seat))
}

/** Nước hợp lệ của quân ở ô `from` (để màn chơi hiện ô đi được). */
export const movesFrom = (s, from) => legalMoves(s).filter((m) => m.from === from)

/** Không bên nào còn đủ quân để chiếu hết. */
function noMaterial(b) {
  const rest = []
  b.forEach((p, i) => { if (p != null && typeOf(p) !== 'K') rest.push([typeOf(p), ((i >> 3) + (i & 7)) % 2]) })
  if (rest.length === 0) return true
  if (rest.length === 1) return rest[0][0] === 'N' || rest[0][0] === 'B'
  return rest.every(([t, sq]) => t === 'B' && sq === rest[0][1])
}

const keyOf = (s) => s.board.map((p) => p ?? '.').join('') + s.turn + s.castle + (s.ep ?? '-')
const isSq = (i) => Number.isInteger(i) && i >= 0 && i < 64
const RIGHTS = { 60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q' }

export default {
  id: 'covua',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    const s = {
      board: [...START].map((ch) => (ch === '.' ? null : ch)), turn: 0, castle: 'KQkq', ep: null, half: 0, reps: {},
      ply: 0, check: null, over: false, winner: null, reason: null, last: null,
    }
    return { ...s, reps: { [keyOf(s)]: 1 } }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const { from, to, promo } = move || {}
    if (!isSq(from) || !isSq(to)) return 'games.err.badMove'
    if (colorOf(s.board[from]) !== seat) return 'games.err.notYourPiece'
    const ms = movesFrom(s, from).filter((m) => m.to === to)
    if (!ms.length) return 'games.err.illegal'
    if (ms[0].promo) return PROMOS.includes(promo) ? null : 'games.err.needPromo'
    return promo == null ? null : 'games.err.badMove'
  },

  apply(s0, seat, move) {
    const m = { from: move.from, to: move.to, ...(move.promo ? { promo: move.promo } : {}) }
    const piece = s0.board[m.from]
    const { board, captured, castle: castled } = play(s0.board, m, seat, s0.ep)
    let castle = s0.castle
    for (const sq of [m.from, m.to]) for (const ch of RIGHTS[sq] || '') castle = castle.replace(ch, '')
    const pawn = typeOf(piece) === 'P'
    const half = pawn || captured ? 0 : s0.half + 1
    const foe = 1 - seat
    const s = {
      ...s0, board, turn: foe, castle, ep: pawn && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null, half,
      ply: s0.ply + 1, check: null,
      last: { seat, ...m, captured, ...(castled ? { castle: true } : {}) },
    }
    const key = keyOf(s)
    // Ăn quân / đi tốt thì không thể lặp lại thế cũ nữa — xoá sổ, khỏi phình state.
    s.reps = { ...(half === 0 ? {} : s0.reps), [key]: ((half === 0 ? 0 : s0.reps[key]) || 0) + 1 }
    const check = inCheck(board, foe)
    if (check) s.check = kingOf(board, foe)
    const end = (winner, reason) => ({ ...s, over: true, winner, reason })
    if (!legalMoves(s, foe).length) return check ? end(seat, 'mate') : end(null, 'stalemate')
    if (noMaterial(board)) return end(null, 'material')
    if (s.reps[key] >= 3) return end(null, 'repetition')
    if (half >= 100) return end(null, 'fifty')
    return s
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner == null ? { winners: [], draw: true } : { winners: [s.winner], draw: false }
  },
}
