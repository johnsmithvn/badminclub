// Máy chơi bằng tìm kiếm (minimax + cắt tỉa alpha-beta, đào sâu dần trong hạn giờ) cho 4 trò cờ: Cờ vua, Cờ tướng,
// Ô ăn quan, Cờ gánh. Dùng thẳng luật của game (validate / apply / result) nên máy không bao giờ đi sai luật.
// Thuần JS, không React — chạy trong Web Worker (worker.js) để màn hình không đứng lúc máy nghĩ.
//
// Đa dạng nước đi: các nước kém nước tốt nhất không quá `noise` điểm được chọn ngẫu nhiên — mức Dễ noise lớn
// (hay đi nước dở), mức Khó noise nhỏ (chỉ đổi giữa các nước gần ngang nhau).
// ponytail: tìm kiếm gọi thẳng game.apply (chép cả bàn, tự xét chiếu hết) nên chậm hơn engine thật vài chục lần —
// đủ cho mức Khó; muốn mạnh hơn thì mức Cao thủ dùng engine nhúng (engine.js).

import covua, { legalMoves as chessMoves, typeOf as chessType, colorOf as chessColor } from '#lib/games/covua.js'
import cotuong, { legalMoves as xqMoves, typeOf as xqType, colorOf as xqColor, COLS as XQ_COLS } from '#lib/games/cotuong.js'
import oanquan, { sideOf } from '#lib/games/oanquan.js'
import coganh, { NEIGHBORS, POINTS } from '#lib/games/coganh.js'

const WIN = 1e6

class Timeout extends Error {}

/**
 * Chọn nước cho ghế `me`. rule = { game, moves(s) → nước của người tới lượt, evaluate(s, me) → điểm theo phía me,
 * captures?(s) → nước ăn quân (tìm thêm ở lá cho khỏi "đi xong mới thấy mất quân"), order?(s, ms) }.
 * opt = { depth, ms, noise, rand }.
 */
export function pick(rule, s0, me, { depth = 2, ms = 1000, noise = 0, rand = Math.random } = {}) {
  const { game, moves, evaluate, captures, order } = rule
  const end = Date.now() + ms
  let nodes = 0
  const tick = () => { if ((++nodes & 255) === 0 && Date.now() > end) throw new Timeout() }

  const done = (s, ply) => {
    const r = game.result(s)
    if (!r) return null
    if (r.draw || !r.winners?.length) return 0
    return r.winners.includes(me) ? WIN - ply : -WIN + ply
  }

  const quiesce = (s, alpha, beta, ply, left) => {
    tick()
    const stand = evaluate(s, me)
    if (!captures || left <= 0) return stand
    const max = s.turn === me
    if (max) { if (stand >= beta) return stand; alpha = Math.max(alpha, stand) } else { if (stand <= alpha) return stand; beta = Math.min(beta, stand) }
    let best = stand
    for (const m of captures(s)) {
      const c = game.apply(s, s.turn, m)
      const v = done(c, ply + 1) ?? quiesce(c, alpha, beta, ply + 1, left - 1)
      if (max) { if (v > best) best = v; if (v > alpha) alpha = v } else { if (v < best) best = v; if (v < beta) beta = v }
      if (alpha >= beta) break
    }
    return best
  }

  const node = (s, d, alpha, beta, ply) => {
    tick()
    if (d === 0) return quiesce(s, alpha, beta, ply, 4)
    const ms0 = moves(s)
    if (!ms0.length) return evaluate(s, me)
    const list = order ? order(s, ms0) : ms0
    const max = s.turn === me
    let best = max ? -Infinity : Infinity
    for (const m of list) {
      const c = game.apply(s, s.turn, m)
      const v = done(c, ply + 1) ?? node(c, d - 1, alpha, beta, ply + 1)
      if (max) { if (v > best) best = v; if (v > alpha) alpha = v } else { if (v < best) best = v; if (v < beta) beta = v }
      if (alpha >= beta) break
    }
    return best
  }

  // Xáo trước khi xếp: các nước bằng điểm không lúc nào cũng ra cùng một nước.
  let root = shuffle(moves(s0), rand).map((m) => ({ m, v: 0 }))
  if (root.length <= 1) return root[0]?.m ?? null
  if (order) {
    const ordered = order(s0, root.map((r) => r.m))
    root = ordered.map((m) => root.find((r) => r.m === m))
  }
  let scored = null
  for (let d = 1; d <= depth; d++) {
    try {
      const out = []
      let alpha = -Infinity
      for (const r of root) {
        const c = game.apply(s0, me, r.m)
        // Cửa sổ rộng hơn alpha một khoảng noise: nước gần ngang nước tốt nhất vẫn có điểm thật để bốc ngẫu nhiên.
        const v = done(c, 1) ?? node(c, d - 1, alpha - noise - 1, Infinity, 1)
        out.push({ m: r.m, v })
        if (v > alpha) alpha = v
      }
      scored = out
      root = out.slice().sort((a, b) => b.v - a.v)
      if (root[0].v >= WIN - 100) break // đã thấy nước thắng
    } catch (e) {
      if (!(e instanceof Timeout)) throw e
      break
    }
  }
  if (!scored) return root[0].m // hết giờ ngay vòng 1 — đi nước đầu theo thứ tự xếp
  const best = Math.max(...scored.map((r) => r.v))
  const near = scored.filter((r) => r.v >= best - noise)
  return near[Math.floor(rand() * near.length)].m
}

export function shuffle(a, rand = Math.random) {
  const out = a.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Cờ vua ──────────────────────────────────────────────────────────────────────────────────────────────────────
const CHESS_VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 }
const center8 = (i) => 3.5 - Math.max(Math.abs((i >> 3) - 3.5), Math.abs((i & 7) - 3.5)) // 0 ở mép … 3 ở giữa

function chessEval(s, me) {
  let v = 0
  s.board.forEach((p, i) => {
    if (p == null) return
    const t = chessType(p)
    const side = chessColor(p)
    let x = CHESS_VAL[t]
    if (t === 'P') x += 6 * (side === 0 ? 6 - (i >> 3) : (i >> 3) - 1) + ((i & 7) >= 2 && (i & 7) <= 5 ? 6 : 0)
    else if (t === 'N' || t === 'B') x += 8 * center8(i)
    else if (t === 'K' && s.ply < 60) x -= 6 * center8(i) // đầu / giữa ván: vua nên nằm góc
    v += side === me ? x : -x
  })
  return v
}

const chessOrder = (s, ms) => ms.slice().sort((a, b) => (s.board[b.to] ? CHESS_VAL[chessType(s.board[b.to])] : 0) - (s.board[a.to] ? CHESS_VAL[chessType(s.board[a.to])] : 0))

export const CHESS = {
  game: covua,
  moves: (s) => chessMoves(s),
  evaluate: chessEval,
  captures: (s) => chessOrder(s, chessMoves(s).filter((m) => s.board[m.to] != null)),
  order: chessOrder,
}

// ── Cờ tướng ────────────────────────────────────────────────────────────────────────────────────────────────────
const XQ_VAL = { R: 900, C: 450, H: 400, E: 200, A: 200, P: 100, K: 0 }

function xqEval(s, me) {
  let v = 0
  s.board.forEach((p, i) => {
    if (p == null) return
    const t = xqType(p)
    const side = xqColor(p)
    const r = Math.floor(i / XQ_COLS)
    const c = i % XQ_COLS
    const fwd = side === 0 ? 9 - r : r // số hàng đã tiến
    let x = XQ_VAL[t]
    if (t === 'P' && fwd >= 5) x += 90 + (c >= 3 && c <= 5 ? 30 : 0) - (fwd === 9 ? 60 : 0) // qua sông; tới đáy là tốt chết
    else if (t === 'H' || t === 'C') x += 6 * Math.min(fwd, 6) - 4 * Math.abs(c - 4)
    else if (t === 'R') x += 4 * Math.min(fwd, 7)
    v += side === me ? x : -x
  })
  return v
}

const xqOrder = (s, ms) => ms.slice().sort((a, b) => (s.board[b.to] ? XQ_VAL[xqType(s.board[b.to])] + 1 : 0) - (s.board[a.to] ? XQ_VAL[xqType(s.board[a.to])] + 1 : 0))

export const XIANGQI = {
  game: cotuong,
  moves: (s) => xqMoves(s),
  evaluate: xqEval,
  captures: (s) => xqOrder(s, xqMoves(s).filter((m) => s.board[m.to] != null)),
  order: xqOrder,
}

// ── Ô ăn quan ───────────────────────────────────────────────────────────────────────────────────────────────────
export const OANQUAN = {
  game: oanquan,
  moves: (s) => sideOf(s.turn).filter((c) => s.stones[c] > 0).flatMap((cell) => [{ cell, dir: 1 }, { cell, dir: -1 }]),
  // Điểm đã ăn là chắc; dân còn bên mình thì cuối ván về mình nhưng cũng là mồi cho đối phương — tính nửa giá.
  evaluate: (s, me) => s.score[me] - s.score[1 - me]
    + 0.4 * (sideOf(me).reduce((a, c) => a + s.stones[c], 0) - sideOf(1 - me).reduce((a, c) => a + s.stones[c], 0)),
}

// ── Cờ gánh ─────────────────────────────────────────────────────────────────────────────────────────────────────
function ganhMoves(s) {
  const out = []
  for (let from = 0; from < POINTS; from++) {
    if (s.board[from] !== s.turn) continue
    for (const to of NEIGHBORS[from]) if (coganh.validate(s, s.turn, { from, to }) == null) out.push({ from, to })
  }
  return out
}

export const COGANH = {
  game: coganh,
  moves: ganhMoves,
  // Quân là tất cả: bị ăn là đổi màu, mất 1 quân = đối phương thêm 1.
  evaluate: (s, me) => {
    let v = 0
    for (const p of s.board) if (p != null) v += p === me ? 10 : -10
    return v
  },
}
