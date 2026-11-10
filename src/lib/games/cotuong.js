// Cờ tướng. 2 người, quân đỏ (ghế 0) đi trước. Bàn 9 cột × 10 hàng, quân đi trên giao điểm, sông ở giữa, cung 3 × 3.
//   Tướng: 1 bước ngang / dọc trong cung. Sĩ: 1 bước chéo trong cung. Tượng: 2 bước chéo, không qua sông, bị cản
//   "mắt" (điểm giữa). Mã: 1 thẳng + 1 chéo, bị cản "chân" (điểm thẳng kề). Xe: ngang / dọc bao xa cũng được.
//   Pháo: đi như xe, ăn phải nhảy qua đúng một quân (ngòi). Tốt: tiến 1; qua sông được đi ngang 1, không lùi.
//   Hai tướng không được đối mặt trên một cột trống (lộ mặt tướng). Không được đi nước để tướng mình bị chiếu.
//   Đến lượt mà hết nước đi (bị chiếu hết hay bị vây) là THUA.
// Chống ván kéo dài (luật riêng của app): QUIET_LIMIT nước liền không ăn quân, lặp thế 3 lần, hoặc cả hai không còn
// quân sang sông được (xe, mã, pháo, tốt) → hoà.
// ponytail: lặp thế xử hoà; luật chiếu dai / đuổi dai bị xử thua của giải đấu chưa làm — thêm khi CLB đánh giải.
// Hợp đồng chung: docs/GAMES.md §3. Chưa có SQL chấm lại — game_finish tin kết quả client.
//
// Điểm i = hàng * 9 + cột, hàng 0 ở trên (phía quân đen). Quân: chữ hoa = đỏ, chữ thường = đen —
// K tướng, A sĩ, E tượng, H mã, R xe, C pháo, P tốt.
// state = { board[90] (null | quân), turn, quiet, reps { thế: số lần }, ply, check (điểm tướng bị chiếu | null),
//           over, winner, reason ('mate' | 'stalemate' | 'quiet' | 'repetition' | 'material'), last }
//   last = { seat, from, to, captured }
// move  = { from, to }

export const COLS = 9
export const ROWS = 10
export const POINTS = COLS * ROWS
export const QUIET_LIMIT = 120
export const START = 'rheakaehr' + '.'.repeat(9) + '.c.....c.' + 'p.p.p.p.p' + '.'.repeat(18)
  + 'P.P.P.P.P' + '.C.....C.' + '.'.repeat(9) + 'RHEAKAEHR'

export const colorOf = (p) => (p == null ? null : p === p.toUpperCase() ? 0 : 1)
export const typeOf = (p) => p.toUpperCase()
const at = (r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS ? -1 : r * COLS + c)
const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
const inPalace = (r, c, seat) => c >= 3 && c <= 5 && (seat === 0 ? r >= 7 : r <= 2)
const ownSide = (r, seat) => (seat === 0 ? r >= 5 : r <= 4)

/**
 * Nước đi theo hình quân của bên `seat` (chưa xét tướng bị chiếu / lộ mặt).
 * Cờ úp (coup.js) truyền thêm: `kindAt(i)` = quân đi theo luật quân nào (quân úp đi theo quân gốc ở ô đó),
 * `free(i)` = sĩ / tượng đã lật, đi khắp bàn (ra khỏi cung, qua sông).
 */
export function pseudo(b, seat, kindAt = (i) => typeOf(b[i]), free = () => false) {
  const out = []
  const add = (from, to) => { if (to >= 0 && colorOf(b[to]) !== seat) out.push({ from, to }) }
  for (let i = 0; i < POINTS; i++) {
    const p = b[i]
    if (p == null || colorOf(p) !== seat) continue
    const r = Math.floor(i / COLS)
    const c = i % COLS
    const kind = kindAt(i)
    switch (kind) {
      case 'K':
        for (const [dr, dc] of ORTH) if (inPalace(r + dr, c + dc, seat)) add(i, at(r + dr, c + dc))
        break
      case 'A':
        for (const [dr, dc] of DIAG) if (free(i) || inPalace(r + dr, c + dc, seat)) add(i, at(r + dr, c + dc))
        break
      case 'E':
        for (const [dr, dc] of DIAG) {
          const eye = at(r + dr, c + dc)
          if (eye >= 0 && b[eye] == null && (free(i) || ownSide(r + 2 * dr, seat))) add(i, at(r + 2 * dr, c + 2 * dc))
        }
        break
      case 'H':
        for (const [dr, dc] of ORTH) {
          const leg = at(r + dr, c + dc)
          if (leg < 0 || b[leg] != null) continue
          if (dr) { add(i, at(r + 2 * dr, c + 1)); add(i, at(r + 2 * dr, c - 1)) } else { add(i, at(r + 1, c + 2 * dc)); add(i, at(r - 1, c + 2 * dc)) }
        }
        break
      case 'R':
      case 'C':
        for (const [dr, dc] of ORTH) {
          let screen = false
          for (let k = 1; ; k++) {
            const j = at(r + dr * k, c + dc * k)
            if (j < 0) break
            if (kind === 'R') {
              if (b[j] == null) { out.push({ from: i, to: j }); continue }
              add(i, j)
              break
            }
            if (!screen) {
              if (b[j] == null) out.push({ from: i, to: j })
              else screen = true
            } else if (b[j] != null) {
              add(i, j)
              break
            }
          }
        }
        break
      default: { // P
        const fwd = seat === 0 ? -1 : 1
        add(i, at(r + fwd, c))
        if (!ownSide(r, seat)) { add(i, at(r, c - 1)); add(i, at(r, c + 1)) }
      }
    }
  }
  return out
}

export const kingOf = (b, seat) => b.indexOf(seat === 0 ? 'K' : 'k')

/** Hai tướng cùng cột, giữa không có quân nào. */
export function facing(b) {
  const k0 = kingOf(b, 0)
  const k1 = kingOf(b, 1)
  if (k0 % COLS !== k1 % COLS) return false
  for (let j = k1 + COLS; j < k0; j += COLS) if (b[j] != null) return false
  return true
}

const inCheck = (b, seat) => {
  const k = kingOf(b, seat)
  return pseudo(b, 1 - seat).some((m) => m.to === k)
}

function play(b0, m) {
  const b = b0.slice()
  const captured = b[m.to] ?? null
  b[m.to] = b[m.from]
  b[m.from] = null
  return { board: b, captured }
}

/** Mọi nước hợp lệ của bên `seat`. */
export function legalMoves(s, seat = s.turn) {
  return pseudo(s.board, seat).filter((m) => {
    const { board } = play(s.board, m)
    return !facing(board) && !inCheck(board, seat)
  })
}

export const movesFrom = (s, from) => legalMoves(s).filter((m) => m.from === from)

const keyOf = (s) => s.board.map((p) => p ?? '.').join('') + s.turn
const isPoint = (i) => Number.isInteger(i) && i >= 0 && i < POINTS
const noAttackers = (b) => !b.some((p) => p != null && 'RHCP'.includes(typeOf(p)))

export default {
  id: 'cotuong',
  minPlayers: 2,
  maxPlayers: 2,
  defaultOptions: {},

  setup() {
    const s = {
      board: [...START].map((ch) => (ch === '.' ? null : ch)), turn: 0, quiet: 0, reps: {}, ply: 0, check: null,
      over: false, winner: null, reason: null, last: null,
    }
    return { ...s, reps: { [keyOf(s)]: 1 } }
  },

  validate(s, seat, move) {
    if (s.over) return 'games.err.over'
    if (seat !== s.turn) return 'games.err.notYourTurn'
    const { from, to } = move || {}
    if (!isPoint(from) || !isPoint(to)) return 'games.err.badMove'
    if (colorOf(s.board[from]) !== seat) return 'games.err.notYourPiece'
    return movesFrom(s, from).some((m) => m.to === to) ? null : 'games.err.illegal'
  },

  apply(s0, seat, { from, to }) {
    const { board, captured } = play(s0.board, { from, to })
    const foe = 1 - seat
    const quiet = captured ? 0 : s0.quiet + 1
    const s = { ...s0, board, turn: foe, quiet, ply: s0.ply + 1, check: null, last: { seat, from, to, captured } }
    const key = keyOf(s)
    s.reps = { ...(captured ? {} : s0.reps), [key]: ((captured ? 0 : s0.reps[key]) || 0) + 1 }
    const check = inCheck(board, foe)
    if (check) s.check = kingOf(board, foe)
    const end = (winner, reason) => ({ ...s, over: true, winner, reason })
    if (!legalMoves(s, foe).length) return end(seat, check ? 'mate' : 'stalemate')
    if (noAttackers(board)) return end(null, 'material')
    if (s.reps[key] >= 3) return end(null, 'repetition')
    if (quiet >= QUIET_LIMIT) return end(null, 'quiet')
    return s
  },

  view: (s) => s,

  result(s) {
    if (!s.over) return null
    return s.winner == null ? { winners: [], draw: true } : { winners: [s.winner], draw: false }
  },
}
