// node src/__tests__/games/baucua.test.js
// Luật Bầu cua (lib/games/baucua.js). Sai ở đây là trả thưởng sai, cái xoay nhầm người, kẹt ván khi có người rời.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import bc, { CAP, deadlineOf, optsOf, payOf, waitingOf } from '#lib/games/baucua.js'

const T0 = '2026-11-08T10:00:00.000Z'
const at = (sec) => ({ at: new Date(Date.parse(T0) + sec * 1000).toISOString() })
const step = (s, seat, move, meta) => {
  const err = bc.validate(s, seat, move)
  assert.equal(err, null, 'nước ' + JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return bc.apply(s, seat, move, meta)
}
const begin = (n, options) => step(bc.setup({ options }), 0, { deal: { n } }, at(0))

// Trả thưởng: ra k hột → k lần, không ra → mất.
assert.equal(payOf([2, 0, 0, 0, 0, 0], [0, 0, 3]), 4)
assert.equal(payOf([0, 3, 0, 0, 0, 1], [0, 0, 3]), -4)
assert.equal(payOf([1, 0, 0, 1, 0, 0], [0, 3, 3]), 3)
assert.deepEqual(optsOf({ time: 7, laps: 9 }), { time: 20, laps: 1 }, 'tuỳ chọn bậy → mặc định như SQL')

// Một ván: cái ghế 0, hai người đặt (đặt = chốt), cả bàn chốt thì mở bát; cái xoay sang ghế 1.
{
  let s = begin(3)
  assert.deepEqual([s.banker, s.rounds, deadlineOf(s)], [0, 3, Date.parse(T0) + 20000])
  assert.equal(bc.validate(s, 0, { bet: [1, 0, 0, 0, 0, 0] }), 'games.err.badMove', 'cái không đặt')
  assert.equal(bc.validate(s, 1, { bet: [CAP, 1, 0, 0, 0, 0] }), 'games.err.badMove', 'quá CAP điểm một ván')
  s = step(s, 1, { bet: [2, 0, 0, 0, 0, 0] })
  assert.deepEqual(waitingOf(s), [2])
  s = step(s, 2, { bet: [0, 0, 0, 0, 0, 3] })
  assert.equal(bc.validate(s, 1, { bet: [0, 1, 0, 0, 0, 0] }), 'games.err.badMove', 'chốt rồi thì khoá')
  assert.deepEqual(waitingOf(s), [])
  assert.equal(bc.request(s, 2, { roll: true }), true, 'mở bát chờ server lắc')
  s = step(s, 2, { roll: true, dice: [0, 0, 4] }, at(12))
  assert.deepEqual(s.scores, [-4 + 3, 4, -3])
  assert.deepEqual([s.banker, s.round, s.since], [1, 1, Date.parse(T0) + 12000])
  assert.deepEqual(s.bets[1], [0, 0, 0, 0, 0, 0], 'ván mới xoá điểm đặt')
}

// Cái rời giữa ván: bỏ ván, chuyển cái. Còn một người thì 0074 game_leave tự kết thúc phòng.
{
  let s = begin(3, { laps: 2 })
  s = step(s, 1, { bet: [1, 0, 0, 0, 0, 0] })
  s = step(s, 0, { out: true }, at(5))
  assert.deepEqual([s.banker, s.round, s.scores], [1, 1, [0, 0, 0]])
  s = step(s, 2, { out: true }, at(6))
  assert.deepEqual([s.ready[2], s.bets[2]], [true, [0, 0, 0, 0, 0, 0]], 'người đặt rời: bỏ điểm đặt, không phải chờ')
}

// Hết số ván → người còn ngồi nhiều điểm nhất thắng.
{
  let s = begin(2)
  s = step(s, 1, { bet: [5, 0, 0, 0, 0, 0] })
  s = step(s, 0, { roll: true, dice: [0, 1, 2] }, at(20))
  s = step(s, 0, { bet: [0, 0, 0, 0, 0, 1] })
  s = step(s, 1, { roll: true, dice: [5, 5, 5] }, at(40))
  assert.equal(s.over, true)
  assert.deepEqual(bc.result(s), { winners: [1], draw: false, scores: { 0: -2, 1: 2 } })
}

// SQL 0087 chép cùng hằng số / nhánh.
{
  const sql = readFileSync('supabase/migrations/0087_games_baucua.sql', 'utf8')
  for (const f of ['IN (15, 20, 30)', 'ELSE 20 END', 'IN (1, 2, 3)', "'games.err.notYet'", 'x > 10', '> 10 THEN', 'floor(random() * 6)::int',
    'v_rounds := v_laps * v_n']) assert.ok(sql.includes(f), '0087 thiếu ' + f)
}

console.log('baucua check: OK')
