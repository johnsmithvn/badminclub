// node src/__tests__/games/xo.test.js
// Luật Cờ X-O 3 × 3 (lib/games/xo.js, 0107). Sai ở đây là xử thắng / hoà nhầm, cho đặt quân khi phải di quân, hay quân
// cũ không biến mất — và server (0107 game_xo_result) chấm lại y luật này, lệch là máy báo một kiểu, phòng lưu một kiểu.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import xo, { CAP, fadingOf, moving } from '#lib/games/xo.js'

const fresh = (mode) => xo.setup({ options: mode ? { mode } : {} })
/** Đi lần lượt các nước (ghế theo lượt); mọi nước phải hợp lệ. */
const play = (s, moves) => moves.reduce((st, m) => {
  const move = typeof m === 'number' ? { i: m } : m
  assert.equal(xo.validate(st, st.turn, move), null, JSON.stringify(move) + ' phải hợp lệ')
  return xo.apply(st, st.turn, move)
}, s)

// Cổ điển: 3 quân liền thắng, đầy bàn hoà, chế độ lạ về cổ điển.
{
  const s = play(fresh(), [0, 3, 4, 5, 8])
  assert.deepEqual([s.winner, s.line, xo.result(s)], [0, [0, 4, 8], { winners: [0], draw: false }])
  assert.equal(xo.validate(s, 1, { i: 1 }), 'games.err.over')
  const draw = play(fresh(), [0, 1, 2, 4, 3, 5, 7, 6, 8])
  assert.deepEqual(xo.result(draw), { winners: [], draw: true })
  assert.equal(fresh('loco').mode, 'classic')
  const t = play(fresh(), [4])
  assert.equal(xo.validate(t, 0, { i: 0 }), 'games.err.notYourTurn')
  assert.equal(xo.validate(t, 1, { i: 4 }), 'games.err.taken')
  for (const bad of [{ i: 9 }, { i: -1 }, { i: '0' }, { i: 1.5 }, {}, null, { from: 4, to: 0 }, { i: 0, from: null }]) {
    assert.equal(xo.validate(t, 1, bad), 'games.err.badMove', JSON.stringify(bad))
  }
}

// 3 quân di chuyển: đủ 3 quân thì phải nhấc quân của mình sang ô trống; không bao giờ đầy bàn.
{
  let s = play(fresh('move'), [0, 1, 3, 4, 8, 6]) // X 0 3 8 · O 1 4 6 — chưa ai thắng
  assert.equal(moving(s, 0), true)
  assert.equal(xo.validate(s, 0, { i: 2 }), 'games.err.badMove', 'đủ quân thì không đặt thêm')
  assert.equal(xo.validate(s, 0, { from: 1, to: 2 }), 'games.err.notYourPiece')
  assert.equal(xo.validate(s, 0, { from: 0, to: 4 }), 'games.err.taken')
  assert.equal(xo.validate(s, 0, { from: 0, to: 2, i: 2 }), 'games.err.badMove')
  s = play(s, [{ from: 8, to: 2 }]) // X 0 3 2
  assert.deepEqual([s.board[8], s.board[2], s.q[0], s.last], [null, 0, [0, 3, 2], { seat: 0, i: 2, from: 8 }])
  s = play(s, [{ from: 6, to: 7 }]) // O 1 4 7 → O thắng cột giữa
  assert.deepEqual(xo.result(s), { winners: [1], draw: false })
}

// Quân cũ tự biến mất: đặt quân thứ 4 thì quân đặt sớm nhất của mình mất; không đặt đè lên quân sắp mất.
{
  let s = play(fresh('vanish'), [0, 4, 1, 8, 5, 3]) // X 0 1 5 · O 4 8 3
  assert.equal(fadingOf(s, 0), 0)
  assert.equal(xo.validate(s, 0, { i: 0 }), 'games.err.taken', 'quân sắp mất vẫn đang chiếm ô')
  s = play(s, [6]) // X đặt 6 → mất 0: X 1 5 6
  assert.deepEqual([s.board[0], s.q[0], s.last], [null, [1, 5, 6], { seat: 0, i: 6, gone: 0 }])
  assert.equal(xo.result(s), null)
  s = play(s, [2]) // O đặt 2 → mất 4: O 8 3 2
  assert.equal(s.board[4], null)
}

// move / vanish: đủ 2 × CAP nước mà chưa ai thắng thì hoà. Bàn đi vòng X 0 → 2 → 0…, O 8 → 6 → 8… (không ai đủ hàng).
{
  let s = play(fresh('move'), [0, 8, 4, 5, 7, 3]) // X 0 4 7 · O 8 5 3
  const loop = [{ from: 0, to: 2 }, { from: 8, to: 6 }, { from: 2, to: 0 }, { from: 6, to: 8 }]
  while (!s.over) s = play(s, [loop[(s.ply - 6) % 4]])
  assert.deepEqual([s.ply, xo.result(s)], [2 * CAP, { winners: [], draw: true }])
}

// Server (0107) dùng cùng hằng số và đọc cùng bộ ván mẫu: JS chấm từng ván phải ra đúng kết quả ghi trong file kiểm.
{
  const sql = readFileSync('supabase/migrations/0107_games_xo.sql', 'utf8')
  assert.ok(sql.includes(`c_cap    CONSTANT int := ${CAP};`), 'số lượt tối đa SQL ≠ JS')
  assert.ok(sql.includes("WHERE game = 'caro' AND options ->> 'size' = '3'"), '0107 phải chuyển phòng Caro 3 × 3 cũ sang Cờ X-O')
  const check = readFileSync('supabase/manual/0107_games_xo_check.sql', 'utf8').split('$xo$')
  assert.equal(check.length, 3, 'file kiểm 0107 phải có đúng một khối $xo$')
  const fixtures = JSON.parse(check[1])
  for (const f of fixtures) {
    let s = xo.setup({ options: f.options || {} })
    for (const m of f.moves) if (xo.validate(s, m.seat, m.move) == null) s = xo.apply(s, m.seat, m.move)
    assert.deepEqual(xo.result(s), f.result,
      'ván mẫu "' + f.note + '": JS chấm khác kết quả ghi trong file kiểm 0107 — cố ý đổi luật thì chạy node src/__tests__/games/fixtures.mjs')
  }
  for (const mode of ['move', 'vanish']) {
    assert.ok(fixtures.some((f) => f.options?.mode === mode && f.result?.draw), mode + ': phải có ván hoà vì hết lượt')
  }
  assert.ok(fixtures.some((f) => f.result == null), 'phải có ván chưa xong')
}

console.log('xo check: OK')
