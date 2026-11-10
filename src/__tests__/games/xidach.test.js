// node src/__tests__/games/xidach.test.js
// Luật Xì dách (lib/games/xidach.js). Sai ở đây là tính điểm A sai, so bài nhầm (xì / ngũ linh / quắc), trả điểm sai,
// lượt đi nhầm người, kẹt ván khi cái rời bàn.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import xd, { deadlineOf, kindOf, optsOf, payOf, pointsOf } from '#lib/games/xidach.js'

const R = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, J: 8, Q: 9, K: 10, A: 11, 2: 12 }
const h = (...faces) => faces.map((f, i) => R[f] * 4 + (i % 4))
const T0 = Date.parse('2026-11-08T10:00:00.000Z')
const at = (sec) => ({ at: new Date(T0 + sec * 1000).toISOString() })
const step = (s, seat, move, meta) => {
  const err = xd.validate(s, seat, move)
  assert.equal(err, null, 'nước ' + JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return xd.apply(s, seat, move, meta)
}

// Điểm: A = 1 / 10 / 11 khi 2 lá, 1 / 10 khi từ 3 lá.
assert.equal(pointsOf(h('A', 9)), 20)
assert.equal(pointsOf(h('A', 10)), 21)
assert.equal(pointsOf(h('A', 5, 5)), 20, '3 lá: A tính 10')
assert.equal(pointsOf(h('A', 5, 6)), 21, '3 lá: A tính 10 → 21')
assert.equal(pointsOf(h('A', 6, 6)), 13, '3 lá: A không được tính 11')
assert.equal(pointsOf(h('K', 'Q', 5)), 25)
assert.deepEqual([h('A', 'A'), h('A', 'K'), h('A', 10), h(2, 3, 4, 5, 6), h('K', 'Q', 2), h(10, 6)].map(kindOf),
  ['xiban', 'xidach', 'xidach', 'ngulinh', 'quac', 'du'])

// So bài: con thắng (+) / thua (−), thắng bằng bài đặc biệt ăn 2.
assert.equal(payOf(h(10, 9), h(10, 7)), 1)
assert.equal(payOf(h(10, 6), h(10, 7)), -1)
assert.equal(payOf(h(10, 7), h(9, 8)), 0, 'bằng điểm là hoà')
assert.equal(payOf(h('K', 'Q', 5), h(10, 6)), -1, 'con quắc thua')
assert.equal(payOf(h('K', 'Q', 5), h('K', 'J', 9)), 0, 'cùng quắc là hoà')
assert.equal(payOf(h(10, 6), h('K', 'J', 9)), 1, 'cái quắc thua con không quắc')
assert.equal(payOf(h(2, 3, 4, 5, 6), h('A', 'K')), -2, 'xì dách thắng ngũ linh, ăn 2')
assert.equal(payOf(h(2, 3, 4, 2, 3), h(2, 3, 4, 5, 6)), 2, 'cùng ngũ linh: ít điểm hơn thắng')
assert.equal(payOf(h('A', 'A'), h('A', 'K')), 2, 'xì bàn thắng xì dách')
assert.deepEqual(optsOf({ time: 7, laps: 5 }), { time: 30, laps: 1 })

// Một ván 3 người: cái ghế 0, ghế 1 rồi ghế 2 đi, cái đi cuối; cái dằn thì lật bài, so từng con.
{
  let s = step(xd.setup(), 0, { deal: { n: 3, round: 0, banker: 0, xi: {} } }, at(0))
  assert.deepEqual([s.turn, s.order, s.rounds, deadlineOf(s)], [1, [1, 2, 0], 3, T0 + 30000])
  assert.equal(xd.validate(s, 2, { draw: true }), 'games.err.notYourTurn')
  assert.equal(xd.request(s, 1, { draw: true }), true, 'rút chờ server chia lá')
  s = step(s, 1, { draw: true }, at(5))
  assert.equal(s.counts[1], 3)
  s = step(s, 1, { stand: true }, at(8))
  s = step(s, 2, { stand: true }, at(9))
  assert.equal(s.turn, 0, 'các con xong thì tới cái')
  const show = { 0: h(10, 8), 1: h(5, 'K', 4), 2: h(9, 6) }
  s = step(s, 0, { stand: true, show }, at(12))
  assert.deepEqual([s.phase, s.scores], ['done', [0, 1, -1]])
  assert.equal(xd.validate(s, 2, { deal: true }), null, 'hết ván thì ai cũng xin chia được')
  s = step(s, 1, { deal: { round: 1, banker: 1, xi: { 0: h('A', 'Q') } } }, at(15))
  assert.deepEqual([s.banker, s.order, s.turn, s.stood[0]], [1, [2, 1], 2, true], 'con có xì ngồi chờ, không có lượt')
}

// Cái có xì lúc chia: lật bài ngay, hết ván.
{
  const s = step(xd.setup(), 0, { deal: { n: 2, round: 0, banker: 0, xi: { 0: h('A', 'A') }, show: { 0: h('A', 'A'), 1: h(10, 9) } } }, at(0))
  assert.deepEqual([s.phase, s.scores, s.over], ['done', [2, -2], false])
}

// Hết giờ: client gửi { timeout } trơn; server ghi như nước của người tới lượt.
{
  let s = step(xd.setup(), 0, { deal: { n: 2, round: 0, banker: 0, xi: {} } }, at(0))
  assert.equal(xd.validate(s, 0, { timeout: true }), null, 'ai cũng báo hết giờ được')
  s = step(s, 0, { draw: true, timeout: true }, at(31))
  assert.deepEqual([s.counts[1], s.last.seat, s.last.timeout], [3, 1, true], 'nước hết giờ tính cho người tới lượt')
  const off = step(xd.setup({ options: { time: 0 } }), 0, { deal: { n: 2, round: 0, banker: 0, xi: {} } }, at(0))
  assert.equal(xd.validate(off, 0, { timeout: true }), 'games.err.badMove', 'tắt đồng hồ thì không có hết giờ')
  assert.equal(deadlineOf(off), null)
}

// Cái rời giữa ván: bỏ ván, không so bài.
{
  let s = step(xd.setup(), 0, { deal: { n: 3, round: 0, banker: 0, xi: {} } }, at(0))
  s = step(s, 0, { out: true })
  assert.deepEqual([s.phase, s.scores, s.over], ['done', [0, 0, 0], false])
}

// Hết số ván → người nhiều điểm nhất thắng.
{
  let s = step(xd.setup(), 0, { deal: { n: 2, round: 0, banker: 0, xi: {} } }, at(0))
  s = step(s, 1, { stand: true }, at(1))
  s = step(s, 0, { stand: true, show: { 0: h(10, 6), 1: h(10, 9) } }, at(2))
  s = step(s, 0, { deal: { round: 1, banker: 1, xi: {} } }, at(3))
  s = step(s, 0, { stand: true }, at(4))
  s = step(s, 1, { draw: true }, at(5))
  s = step(s, 1, { stand: true, show: { 0: h(10, 7), 1: h(5, 5, 'K') } }, at(6))
  assert.equal(s.over, true)
  assert.deepEqual(xd.result(s), { winners: [1], draw: false, scores: { 0: -2, 1: 2 } })
}

// SQL 0098 chép cùng ngưỡng / bảng xếp hạng.
{
  const sql = readFileSync('supabase/migrations/0098_games_xidach.sql', 'utf8')
  for (const f of ['IN (0, 20, 30, 45)', 'ELSE 30 END', 'IN (1, 2, 3)', "THEN 15 ELSE 16 END", "ARRAY['quac', 'du', 'ngulinh', 'xidach', 'xiban']",
    "IN ('ngulinh', 'xidach', 'xiban') THEN 2 ELSE 1", 'IF j > 0 AND n > 2', "'games.err.notEnough'", "'games.err.notYet'"]) {
    assert.ok(sql.includes(f), '0098 thiếu ' + f)
  }
}

console.log('xidach check: OK')
