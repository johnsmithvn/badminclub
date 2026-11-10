// node src/__tests__/games/bantau.test.js
// Luật Bắn tàu (lib/games/bantau.js). Sai ở đây là nhận hạm đội bậy, chuyển lượt sai sau phát trúng / trượt,
// không nhận ra hết ván.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import bt, { fleetOk, randomFleet, SHIPS, TOTAL } from '#lib/games/bantau.js'
import { replay } from '#lib/games/registry.js'

const FLEET = [[0, 1, 2, 3, 4], [20, 30, 40, 50], [7, 8, 9], [97, 98, 99], [66, 67]]

// Hạm đội: đúng độ dài, thẳng, liền, không chồng; ngang không được tràn sang hàng dưới.
{
  assert.equal(fleetOk(FLEET), true)
  assert.equal(fleetOk([[4, 3, 2, 1, 0], ...FLEET.slice(1)]), true, 'thứ tự ô trong tàu không quan trọng')
  assert.equal(fleetOk([[8, 9, 10, 11, 12], ...FLEET.slice(1)]), false, 'ngang tràn hàng')
  assert.equal(fleetOk([[0, 1, 2, 3, 5], ...FLEET.slice(1)]), false, 'không liền')
  assert.equal(fleetOk([[0, 11, 22, 33, 44], ...FLEET.slice(1)]), false, 'chéo')
  assert.equal(fleetOk([FLEET[0], [4, 14, 24, 34], ...FLEET.slice(2)]), false, 'chồng nhau')
  assert.equal(fleetOk(FLEET.slice(0, 4)), false)
  assert.equal(fleetOk([FLEET[0], FLEET[1], FLEET[2], [97, 98], [66, 67, 68]]), false, 'sai độ dài theo thứ tự')
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 50; k++) assert.equal(fleetOk(randomFleet(rand)), true, 'xếp ngẫu nhiên luôn hợp lệ')
  assert.equal(TOTAL, 17)
  assert.deepEqual(SHIPS, [5, 4, 3, 3, 2])
}

// Xếp xong cả hai mới bắn; ghế 0 bắn trước; trúng bắn tiếp, trượt đổi lượt; bắn lại ô cũ bị chặn.
{
  let s = bt.setup()
  assert.equal(bt.validate(s, 0, { fire: 5 }), 'games.err.notReady')
  assert.equal(bt.validate(s, 0, { place: FLEET }), null)
  assert.equal(bt.validate(s, 0, { place: FLEET.slice(1) }), 'games.err.badFleet')
  assert.equal(bt.request(s, 0, { place: FLEET }), true)
  assert.equal(bt.apply(s, 0, { place: FLEET }), s, 'nước chưa qua server không áp')
  s = bt.apply(s, 1, { placed: true })
  assert.equal(bt.validate(s, 1, { placed: true }), 'games.err.placed')
  s = bt.apply(s, 0, { placed: true })
  assert.deepEqual([s.phase, s.turn], ['fire', 0])
  assert.equal(bt.validate(s, 1, { fire: 3 }), 'games.err.notYourTurn')
  assert.equal(bt.request(s, 0, { fire: 3 }), true)
  s = bt.apply(s, 0, { fire: 3, hit: true })
  assert.equal(s.turn, 0, 'trúng thì bắn tiếp')
  assert.equal(bt.validate(s, 0, { fire: 3 }), 'games.err.fired')
  s = bt.apply(s, 0, { fire: 50, hit: false })
  assert.deepEqual([s.turn, s.shots[0][3], s.shots[0][50]], [1, 'hit', 'miss'])
  s = bt.apply(s, 1, { fire: 66, hit: true })
  s = bt.apply(s, 1, { fire: 67, hit: true, sunk: [66, 67] })
  assert.deepEqual([s.shots[1][66], s.sunk[1]], ['sunk', [[66, 67]]])
}

// Trúng đủ 17 ô là thắng; dựng lại từ log đúng state.
{
  const log = [{ seq: 1, seat: 0, move: { placed: true } }, { seq: 2, seat: 1, move: { placed: true } }]
  FLEET.flat().forEach((cell, k) => log.push({ seq: 3 + k, seat: 0, move: { fire: cell, hit: true } }))
  const s = replay(bt, {}, log)
  assert.deepEqual([s.over, s.winner, s.hits[0], bt.result(s)], [true, 0, 17, { winners: [0], draw: false }])
  assert.equal(bt.validate(s, 1, { fire: 0 }), 'games.err.over')
}

// SQL 0080: cùng độ dài tàu, kết quả chấm theo 17 ô trúng, hàm không gọi thẳng được.
{
  const sql = readFileSync('supabase/migrations/0080_games_bantau.sql', 'utf8')
  for (const m of sql.matchAll(/c_ships CONSTANT int\[\] := ARRAY\[([\d, ]+)\]/g)) assert.deepEqual(m[1].split(', ').map(Number), SHIPS)
  assert.match(sql, /HAVING count\(DISTINCT \(move ->> 'fire'\)::int\) >= 17/)
  for (const fn of ['game_bantau_fleet_ok(int[])', 'game_bantau_result(uuid)', 'game_bantau_fill(uuid, integer, jsonb)']) {
    assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.' + fn + ' FROM PUBLIC, anon, authenticated'), fn)
  }
}

console.log('bantau check: OK')
