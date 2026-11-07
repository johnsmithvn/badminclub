// node src/__tests__/games/cotuong.test.js
// Luật Cờ tướng (lib/games/cotuong.js). Sai ở đây là cho đi nước phạm luật (mã bị cản chân, pháo không ngòi, lộ mặt
// tướng…) hoặc không nhận ra hết nước. Gác chính bằng perft của thế đầu (số chuẩn: 44, 1920).

import assert from 'node:assert/strict'
import ct, { COLS, legalMoves } from '#lib/games/cotuong.js'
import { replay } from '#lib/games/registry.js'

const perft = (s, d) => (d === 0 ? 1 : legalMoves(s).reduce((n, m) => n + perft(ct.apply(s, s.turn, m), d - 1), 0))
const p = (r, c) => r * COLS + c
/** Bàn trống + danh sách [quân, hàng, cột]. */
const board = (pieces, turn = 0) => {
  const b = Array(90).fill(null)
  for (const [q, r, c] of pieces) b[p(r, c)] = q
  return { ...ct.setup(), board: b, turn, reps: {} }
}
const targets = (s, r, c) => legalMoves(s).filter((m) => m.from === p(r, c)).map((m) => m.to).sort((x, y) => x - y)

assert.equal(perft(ct.setup(), 1), 44)
assert.equal(perft(ct.setup(), 2), 1920)

// Mã bị cản chân; tượng bị cản mắt và không qua sông; pháo ăn phải có đúng một ngòi.
{
  const s = board([['K', 9, 4], ['k', 0, 3], ['H', 5, 4], ['P', 4, 4]])
  assert.deepEqual(targets(s, 5, 4), [p(4, 2), p(4, 6), p(6, 2), p(6, 6), p(7, 3), p(7, 5)].sort((x, y) => x - y), 'chân phía trên bị cản')
  const e = board([['K', 9, 4], ['k', 0, 3], ['E', 5, 2], ['P', 6, 3]])
  assert.deepEqual(targets(e, 5, 2), [p(7, 0)], 'qua sông không được, mắt (6,3) bị cản')
  const c = board([['K', 9, 4], ['k', 0, 3], ['C', 7, 1], ['p', 3, 1], ['r', 1, 1], ['h', 7, 6]])
  const tc = targets(c, 7, 1)
  assert.ok(tc.includes(p(1, 1)), 'nhảy qua tốt ăn xe')
  assert.ok(!tc.includes(p(3, 1)), 'không ngòi thì không ăn')
  assert.ok(!tc.includes(p(7, 6)), 'không ngòi thì không ăn ngang')
  assert.ok(tc.includes(p(7, 5)) && tc.includes(p(4, 1)), 'đi như xe khi không ăn')
}

// Tốt: chưa qua sông chỉ tiến; qua sông đi ngang được; không lùi.
{
  const s = board([['K', 9, 4], ['k', 0, 3], ['P', 6, 0], ['P', 4, 6]])
  assert.deepEqual(targets(s, 6, 0), [p(5, 0)])
  assert.deepEqual(targets(s, 4, 6), [p(3, 6), p(4, 5), p(4, 7)].sort((x, y) => x - y))
}

// Lộ mặt tướng: không được rút quân cản cuối cùng; tướng không ra khỏi cung.
{
  const s = board([['K', 9, 4], ['k', 0, 4], ['R', 5, 4]])
  assert.deepEqual(targets(s, 5, 4), [p(1, 4), p(2, 4), p(3, 4), p(4, 4), p(6, 4), p(7, 4), p(8, 4), p(0, 4)].sort((x, y) => x - y),
    'xe chỉ được đi trên cột tướng')
  assert.deepEqual(targets(board([['K', 7, 3], ['k', 0, 5]]), 7, 3), [p(7, 4), p(8, 3)])
  assert.equal(ct.validate(s, 0, { from: p(5, 4), to: p(5, 0) }), 'games.err.illegal')
}

// Chiếu hết (xe + tướng chặn mặt): đỏ thắng; hết nước dù không bị chiếu cũng thua.
{
  const s = board([['K', 9, 3], ['k', 0, 4], ['R', 5, 0], ['R', 4, 8]])
  const m = ct.apply(ct.apply(s, 0, { from: p(5, 0), to: p(1, 0) }), 1, { from: p(0, 4), to: p(0, 5) })
  const end = ct.apply(m, 0, { from: p(4, 8), to: p(0, 8) })
  assert.deepEqual([end.over, end.winner, end.reason], [true, 0, 'mate'])
  assert.deepEqual(ct.result(end), { winners: [0], draw: false })
  assert.equal(ct.validate(end, 1, { from: p(0, 5), to: p(0, 4) }), 'games.err.over')

  const stuck = board([['K', 9, 5], ['k', 0, 4], ['R', 2, 0], ['H', 2, 2]])
  const st = ct.apply(stuck, 0, { from: p(2, 0), to: p(1, 0) })
  assert.equal(st.check, null)
  assert.deepEqual([st.over, st.winner, st.reason], [true, 0, 'stalemate'], 'hết nước là thua, không hoà như cờ vua')
}

// Hoà: lặp thế 3 lần; không bên nào còn quân tấn công.
{
  const shuffle = [[p(9, 1), p(7, 2)], [p(0, 1), p(2, 2)], [p(7, 2), p(9, 1)], [p(2, 2), p(0, 1)]]
  let s = ct.setup()
  for (const [from, to] of [...shuffle, ...shuffle]) {
    assert.equal(ct.validate(s, s.turn, { from, to }), null)
    s = ct.apply(s, s.turn, { from, to })
  }
  assert.deepEqual([s.over, s.reason], [true, 'repetition'])
  const bare = ct.apply(board([['K', 9, 4], ['k', 0, 3], ['R', 5, 0], ['a', 0, 5], ['A', 8, 4]], 1), 1, { from: p(0, 5), to: p(1, 4) })
  assert.equal(bare.over, false)
  const mat = ct.apply(board([['K', 9, 4], ['k', 0, 3], ['p', 8, 3], ['A', 8, 4]]), 0, { from: p(9, 4), to: p(8, 3) })
  assert.deepEqual([mat.over, mat.reason], [true, 'material'])
}

// Dựng lại từ log ra đúng state; apply không sửa state cũ.
{
  const moves = [{ from: p(7, 1), to: p(7, 4) }, { from: p(0, 1), to: p(2, 2) }, { from: p(9, 1), to: p(7, 2) }]
  let s = ct.setup()
  for (const m of moves) s = ct.apply(s, s.turn, m)
  assert.deepEqual(replay(ct, {}, moves.map((move, k) => ({ seq: k + 1, seat: k % 2, move }))), s)
  const s0 = ct.setup()
  const snap = JSON.stringify(s0)
  ct.apply(s0, 0, moves[0])
  assert.equal(JSON.stringify(s0), snap)
}

console.log('cotuong check: OK')
