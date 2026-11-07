// node src/__tests__/games/domino.test.js
// Luật Domino (lib/games/domino.js). Sai ở đây là nối quân sai đầu, chuyển lượt sai sau bốc / bỏ, không nhận ra tắc.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import dm, { endsFor, HAND, pipsOf, TILES } from '#lib/games/domino.js'
import { replay } from '#lib/games/registry.js'

const tile = (a, b) => TILES.findIndex(([x, y]) => x === Math.min(a, b) && y === Math.max(a, b))
const deal = (n, first = 0, lead = null) => ({ deal: { first, lead, n: Array(n).fill(HAND), pile: 28 - HAND * n } })
const start = (n, first, lead) => dm.apply(dm.setup(), first ?? 0, deal(n, first, lead))
const step = (s, seat, move) => {
  const err = dm.validate(s, seat, move)
  assert.equal(err, null, JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return dm.apply(s, seat, move)
}

// Bộ quân: 28 con, đôi-sáu cuối cùng, nút đúng.
assert.equal(TILES.length, 28)
assert.deepEqual(TILES[27], [6, 6])
assert.equal(pipsOf(tile(3, 5)), 8)

// Nước deal: đúng hình dạng, nọc = 28 − 7n; nước đầu phải là quân bắt buộc.
{
  const s = dm.setup()
  assert.equal(dm.validate(s, 0, { deal: { first: 0, lead: null, n: [7, 7], pile: 13 } }), 'games.err.badMove')
  assert.equal(dm.validate(s, 1, deal(2, 0)), 'games.err.badMove')
  let g = start(2, 1, tile(6, 6))
  assert.deepEqual([g.turn, g.pile, g.counts], [1, 14, [7, 7]])
  assert.equal(dm.validate(g, 1, { play: tile(5, 5) }), 'games.err.mustOpen')
  assert.equal(dm.validate(g, 1, { draw: true }), 'games.err.mustLead')
  g = step(g, 1, { play: tile(6, 6) })
  assert.deepEqual([g.left, g.right, g.turn, g.lead], [6, 6, 0, null])
}

// Nối hai đầu: quân xoay cho khớp; phải chọn đầu khi khớp cả hai; không khớp bị chặn.
{
  let s = start(2, 0)
  s = step(s, 0, { play: tile(2, 5) })
  assert.deepEqual(endsFor(s, tile(2, 5 - 5)), ['L'])
  assert.equal(dm.validate(s, 1, { play: tile(2, 6) }), 'games.err.pickEnd')
  assert.equal(dm.validate(s, 1, { play: tile(2, 6), end: 'R' }), 'games.err.noMatch')
  assert.equal(dm.validate(s, 1, { play: tile(3, 4), end: 'L' }), 'games.err.noMatch')
  assert.equal(dm.validate(s, 1, { play: tile(2, 5), end: 'L' }), 'games.err.notYourCard', 'quân đã nằm trên dây')
  s = step(s, 1, { play: tile(2, 6), end: 'L' })
  s = step(s, 0, { play: tile(1, 5), end: 'R' })
  assert.deepEqual([s.line, s.left, s.right], [[[6, 2], [2, 5], [5, 1]], 6, 1])
  assert.equal(endsFor(s, tile(1, 6)).join(), 'L,R')
}

// Bốc: còn nọc mới bốc, bốc xong vẫn lượt mình; hết nọc mới được bỏ; cả bàn bỏ liền nhau là tắc.
{
  let s = step(start(2, 0), 0, { play: tile(0, 1) })
  assert.equal(dm.request(s, 1, { draw: true }), true)
  assert.equal(dm.validate(s, 1, { pass: true }), 'games.err.mustDraw')
  s = step(s, 1, { draw: true })
  assert.deepEqual([s.turn, s.counts, s.pile], [1, [6, 8], 13])
  s = { ...s, pile: 0 }
  assert.equal(dm.validate(s, 1, { draw: true }), 'games.err.pileEmpty')
  s = step(s, 1, { pass: true })
  assert.equal(s.over, false)
  s = step(s, 0, { pass: true })
  assert.deepEqual([s.over, dm.result(s)], [true, { winners: [], draw: false, pending: true }], 'tắc: server chấm ai ít nút')
}

// Hết quân là thắng ngay.
{
  let s = { ...start(2, 0), counts: [1, 7] }
  s = step(s, 0, { play: tile(4, 4) })
  assert.deepEqual([s.over, s.winner, dm.result(s)], [true, 0, { winners: [0], draw: false }])
  assert.equal(dm.validate(s, 1, { play: tile(4, 5), end: 'L' }), 'games.err.over')
}

// Người rời ván 3 người: lượt bỏ qua họ; còn một người là người đó thắng.
{
  let s = step(start(3, 0), 0, { play: tile(3, 3) })
  s = dm.apply(s, 1, { out: true })
  assert.deepEqual([s.turn, s.out], [2, [false, true, false]])
  s = step(s, 2, { play: tile(3, 6), end: 'R' })
  assert.equal(s.turn, 0)
  s = dm.apply(s, 2, { out: true })
  assert.deepEqual([s.over, s.winner], [true, 0])
}

// Dựng lại từ log; apply không sửa state cũ.
{
  const log = [
    { seq: 1, seat: 0, move: deal(2, 0, tile(5, 5)) },
    { seq: 2, seat: 0, move: { play: tile(5, 5), end: 'L' } },
    { seq: 3, seat: 1, move: { draw: true } },
    { seq: 4, seat: 1, move: { play: tile(5, 2), end: 'R' } },
  ]
  let s = dm.setup()
  for (const m of log) s = step(s, m.seat, m.move)
  assert.deepEqual(replay(dm, {}, log), s)
  const snap = JSON.stringify(s)
  dm.apply(s, 0, { play: tile(2, 2), end: 'R' })
  assert.equal(JSON.stringify(s), snap)
}

// SQL 0081: bảng quân khớp TILES, nọc ở ghế -1, hàm không gọi thẳng được.
{
  const sql = readFileSync('supabase/migrations/0081_games_domino.sql', 'utf8')
  for (const m of sql.matchAll(/c_a CONSTANT int\[\] := ARRAY\[([\d, ]+)\]/g)) assert.deepEqual(m[1].split(', ').map(Number), TILES.map((x) => x[0]))
  for (const m of sql.matchAll(/c_b CONSTANT int\[\] := ARRAY\[([\d, ]+)\]/g)) assert.deepEqual(m[1].split(', ').map(Number), TILES.map((x) => x[1]))
  assert.match(sql, /c_hand CONSTANT int := 7;/)
  assert.match(sql, /VALUES \(p_room, -1,/)
  for (const fn of ['game_domino_run(uuid, int, jsonb)', 'game_domino_result(uuid)', 'game_domino_fill(uuid, integer, jsonb)', 'game_domino_deal(uuid)']) {
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.' + fn + ' FROM PUBLIC, anon, authenticated'), fn)
  }
}

console.log('domino check: OK')
