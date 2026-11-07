// node src/__tests__/games/covua.test.js
// Luật Cờ vua (lib/games/covua.js). Sai ở đây là cho đi nước phạm luật, không nhận ra chiếu hết / hoà.
// Gác chính bằng perft — đếm số thế sau đúng N nước, so với số chuẩn ai viết engine cờ cũng dùng
// (chessprogramming.org/Perft_Results): lệch một con số là có luật sai (nhập thành, bắt qua đường, phong cấp, ghim…).

import assert from 'node:assert/strict'
import cv, { legalMoves } from '#lib/games/covua.js'
import { replay } from '#lib/games/registry.js'

/** Dựng state từ FEN (chỉ dùng trong test). */
function fen(str) {
  const [rows, side, castle, ep] = str.split(' ')
  const board = []
  for (const ch of rows.replaceAll('/', '')) {
    if (/\d/.test(ch)) board.push(...Array(Number(ch)).fill(null))
    else board.push(ch)
  }
  const sq = ep === '-' ? null : (8 - Number(ep[1])) * 8 + (ep.charCodeAt(0) - 97)
  return { ...cv.setup(), board, turn: side === 'w' ? 0 : 1, castle: castle === '-' ? '' : castle, ep: sq, reps: {} }
}
const perft = (s, d) => (d === 0 ? 1 : legalMoves(s).reduce((n, m) => n + perft(cv.apply(s, s.turn, m), d - 1), 0))
const sq = (name) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97)
const mv = (a, b, promo) => ({ from: sq(a), to: sq(b), ...(promo ? { promo } : {}) })
const run = (s, list) => list.reduce((x, m) => {
  const err = cv.validate(x, x.turn, m)
  assert.equal(err, null, JSON.stringify(m) + ' phải hợp lệ, bị: ' + err)
  return cv.apply(x, x.turn, m)
}, s)

// Perft: thế đầu, "Kiwipete" (nhập thành, ghim, bắt qua đường, phong cấp dày đặc), thế 3 (bắt qua đường lộ vua).
assert.equal(perft(cv.setup(), 1), 20)
assert.equal(perft(cv.setup(), 2), 400)
assert.equal(perft(cv.setup(), 3), 8902)
const kiwi = fen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -')
assert.equal(perft(kiwi, 1), 48)
assert.equal(perft(kiwi, 2), 2039)
const p3 = fen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -')
assert.equal(perft(p3, 1), 14)
assert.equal(perft(p3, 2), 191)
assert.equal(perft(p3, 3), 2812)
const p4 = fen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -')
assert.equal(perft(p4, 1), 6)
assert.equal(perft(p4, 2), 264)

// Chiếu hết nhanh nhất (fool's mate): đen thắng, không ai đi được nữa.
{
  const s = run(cv.setup(), [mv('f2', 'f3'), mv('e7', 'e5'), mv('g2', 'g4'), mv('d8', 'h4')])
  assert.deepEqual([s.over, s.winner, s.reason, s.check], [true, 1, 'mate', sq('e1')])
  assert.deepEqual(cv.result(s), { winners: [1], draw: false })
  assert.equal(cv.validate(s, 0, mv('a2', 'a3')), 'games.err.over')
}

// Lỗi trả về đúng mã; nước để vua bị chiếu không hợp lệ.
{
  const s = cv.setup()
  assert.equal(cv.validate(s, 1, mv('e7', 'e5')), 'games.err.notYourTurn')
  assert.equal(cv.validate(s, 0, mv('e7', 'e5')), 'games.err.notYourPiece')
  assert.equal(cv.validate(s, 0, mv('e2', 'e5')), 'games.err.illegal')
  assert.equal(cv.validate(s, 0, { from: 'e2', to: 52 }), 'games.err.badMove')
  assert.equal(cv.validate(s, 0, mv('e2', 'e4', 'q')), 'games.err.badMove', 'không phải nước phong cấp thì không kèm promo')
  const pin = fen('4k3/8/8/8/8/8/4r3/4K3 w - -')
  assert.equal(cv.validate(pin, 0, mv('e1', 'e2')), null, 'vua ăn xe không ai giữ')
  assert.equal(cv.validate(pin, 0, mv('e1', 'f1')), null)
  assert.equal(cv.validate(fen('4k3/8/8/8/8/8/3r4/4K3 w - -'), 0, mv('e1', 'e2')), 'games.err.illegal', 'đi vào ô bị khống chế')
}

// Nhập thành: xe về đúng ô, mất quyền khi vua / xe đã đi; bắt qua đường; phong cấp phải chọn quân.
{
  let s = fen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -')
  s = run(s, [mv('e1', 'g1')])
  assert.deepEqual([s.board[sq('f1')], s.board[sq('h1')], s.castle, s.last.castle], ['R', null, 'kq', true])
  s = run(s, [mv('a8', 'b8')])
  assert.equal(s.castle, 'k', 'xe a8 đi thì mất quyền nhập thành cánh hậu bên đen')
  assert.equal(cv.validate(s, 0, mv('e1', 'c1')), 'games.err.notYourPiece')

  let e = run(cv.setup(), [mv('e2', 'e4'), mv('a7', 'a6'), mv('e4', 'e5'), mv('d7', 'd5')])
  assert.equal(e.ep, sq('d6'))
  e = run(e, [mv('e5', 'd6')])
  assert.deepEqual([e.board[sq('d5')], e.last.captured], [null, 'p'], 'bắt qua đường: tốt d5 bị ăn')

  const p = fen('8/4P3/8/8/8/8/8/k6K w - -')
  assert.equal(cv.validate(p, 0, mv('e7', 'e8')), 'games.err.needPromo')
  assert.equal(cv.validate(p, 0, mv('e7', 'e8', 'x')), 'games.err.needPromo')
  assert.equal(cv.apply(p, 0, mv('e7', 'e8', 'n')).board[sq('e8')], 'N')
}

// Hoà: hết nước đi, thiếu quân, lặp thế 3 lần, 50 nước.
{
  const st = cv.apply(fen('7k/8/5QK1/8/8/8/8/8 w - -'), 0, mv('f6', 'f7'))
  assert.deepEqual([st.over, st.winner, st.reason], [true, null, 'stalemate'])
  assert.deepEqual(cv.result(st), { winners: [], draw: true })

  const mat = cv.apply(fen('7k/8/8/8/8/8/6r1/6NK w - -'), 0, mv('h1', 'g2'))
  assert.deepEqual([mat.over, mat.reason], [true, 'material'], 'vua + mã với vua đơn')

  const shuffle = [mv('g1', 'f3'), mv('g8', 'f6'), mv('f3', 'g1'), mv('f6', 'g8')]
  const rep = run(cv.setup(), [...shuffle, ...shuffle])
  assert.deepEqual([rep.over, rep.reason], [true, 'repetition'], 'thế đầu lặp lần thứ 3')

  const fifty = cv.apply({ ...fen('7k/8/8/8/8/8/R7/K7 w - -'), half: 99 }, 0, mv('a2', 'b2'))
  assert.deepEqual([fifty.over, fifty.reason], [true, 'fifty'])
}

// Dựng lại từ log ra đúng state; apply không sửa state cũ.
{
  const moves = [mv('e2', 'e4'), mv('e7', 'e5'), mv('g1', 'f3'), mv('b8', 'c6'), mv('f1', 'c4'), mv('g8', 'f6'), mv('e1', 'g1')]
  const s = run(cv.setup(), moves)
  const log = moves.map((move, k) => ({ seq: k + 1, seat: k % 2, move }))
  assert.deepEqual(replay(cv, {}, log), s)
  const s0 = cv.setup()
  const snap = JSON.stringify(s0)
  cv.apply(s0, 0, mv('e2', 'e4'))
  assert.equal(JSON.stringify(s0), snap)
}

console.log('covua check: OK')
