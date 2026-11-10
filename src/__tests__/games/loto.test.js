// node src/__tests__/games/loto.test.js
// Luật Lô tô (lib/games/loto.js). Sai ở đây là nhận tờ dò bậy, kinh khi chưa đủ hàng, hoặc ai kinh sau lại thắng.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import lt, { colOf, deadlineOf, marksOf, optsOf, rowsOf, validTicket } from '#lib/games/loto.js'

const T0 = Date.parse('2026-11-08T10:00:00.000Z')
const at = (sec) => ({ at: new Date(T0 + sec * 1000).toISOString() })
const step = (s, seat, move, meta) => {
  const err = lt.validate(s, seat, move)
  assert.equal(err, null, 'nước ' + JSON.stringify(move) + ' phải hợp lệ, bị: ' + err)
  return lt.apply(s, seat, move, meta)
}

assert.deepEqual([colOf(1), colOf(9), colOf(10), colOf(79), colOf(80), colOf(90)], [0, 0, 1, 7, 8, 8])
const good = Array.from({ length: 9 }, (_, r) => (r % 2 ? [4, 5, 6, 7, 8] : [0, 1, 2, 3, 4]).map((c) => (c === 0 ? r + 1 : c * 10 + r))).flat()
assert.equal(validTicket(good), true)
assert.equal(validTicket(good.slice(0, 44)), false, 'thiếu số')
assert.equal(validTicket([...good.slice(0, 5), 1, ...good.slice(6)]), false, 'trùng số trong tờ')
assert.equal(validTicket([...good.slice(0, 4), 3, ...good.slice(5)]), false, 'hai số cùng cột trong một hàng')
assert.deepEqual(optsOf({ time: 4 }), { time: 5 })

{
  const other = good.map((x) => (x === 1 ? 2 : x === 2 ? 1 : x)) // vẫn hợp lệ, khác thứ tự
  let s = step(lt.setup(), 0, { deal: { tickets: [good, other] } }, at(0))
  assert.equal(deadlineOf(s), T0 + 5000)
  assert.equal(lt.request(s, 1, { call: true }), true)
  const row0 = rowsOf(good)[0]
  assert.equal(lt.validate(s, 0, { kinh: true }), 'games.err.noKinh')
  row0.slice(0, 4).forEach((x, k) => { s = step(s, 1, { call: x }, at(5 * (k + 1))) })
  assert.deepEqual([marksOf(good, s.called).waiting >= 1, marksOf(good, s.called).full], [true, 0], 'thiếu một số là chờ')
  assert.equal(lt.validate(s, 1, { call: row0[0] }), 'games.err.badMove', 'không xướng lại số cũ')
  s = step(s, 0, { call: row0[4] }, at(25))
  assert.equal(s.since, T0 + 25000)
  s = step(s, 0, { kinh: true })
  assert.deepEqual(lt.result(s), { winners: [0], draw: false })
  assert.equal(lt.validate(s, 1, { kinh: true }), 'games.err.over', 'kinh sau không tính')
}

{
  const sql = readFileSync('supabase/migrations/0097_games_loto.sql', 'utf8')
  for (const f of ['IN (3, 5, 8)', 'ELSE 5 END', "'games.err.noKinh'", "'games.err.notYet'", 'CASE WHEN c = 8 THEN 90', 'LIMIT 5'])
    assert.ok(sql.includes(f), '0097 thiếu ' + f)
}

console.log('loto check: OK')
