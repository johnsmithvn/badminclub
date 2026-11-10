// node src/__tests__/games/phom.test.js
// Luật Phỏm (lib/games/phom.js). Sai ở đây là nhận nhầm phỏm, đánh được lá đã ăn, hạ sai lá ăn, gửi bừa,
// lượt đi nhầm, chấm điểm / trả điểm sai (móm, ăn chốt, ù đền làng).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ph, { bestLay, deadlineOf, eatWith, finalOf, isPhom, optsOf, pointsOf, uOf, valOf } from '#lib/games/phom.js'

const R = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, J: 8, Q: 9, K: 10, A: 11, 2: 12 }
const S = { s: 0, c: 1, d: 2, h: 3 }
const c = (x) => R[x.slice(0, -1)] * 4 + S[x.slice(-1)] // '7h', '10s', 'As'
const cs = (str) => str.split(' ').map(c)
const T0 = Date.parse('2026-11-08T10:00:00.000Z')
const at = (sec) => ({ at: new Date(T0 + sec * 1000).toISOString() })
const step = (s, seat, move, sec) => {
  const err = ph.validate(s, seat, move)
  assert.equal(err, null, 'nước ' + JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return ph.apply(s, seat, move, at(sec))
}

// Số lá: A = 1, 2 = 2, K = 13.
assert.deepEqual(cs('As 2s 10s Ks').map(valOf), [1, 2, 10, 13])
assert.equal(pointsOf(cs('As 2s Ks')), 16)

// Phỏm ngang / dọc; A đứng đầu dây (A 2 3), không vòng K → A.
assert.equal(isPhom(cs('7s 7h 7d')), true)
assert.equal(isPhom(cs('As 2s 3s')), true)
assert.equal(isPhom(cs('Qh Kh Ah')), false, 'không vòng K → A')
assert.equal(isPhom(cs('5s 6s 7h')), false, 'dọc phải cùng chất')
assert.equal(isPhom(cs('5s 5h')), false, 'phải từ 3 lá')
assert.equal(isPhom(cs('5s 6s 7s 8s')), true)

// Xếp bài: ít điểm còn lại nhất; nhóm khoá phải nằm trọn trong một phỏm.
{
  const hand = cs('7s 7h 7d 8s 9s Kc Qd')
  const b = bestLay(hand)
  assert.equal(b.points, 7 + 7 + 13 + 12, 'hạ 7s 8s 9s (còn 39) lợi hơn hạ 7s 7h 7d (còn 42)')
}
{
  const hand = cs('7s 7h 7d 7c 8s 9s')
  assert.equal(bestLay(hand).rest.length, 0, '7h 7d 7c + 7s 8s 9s')
  const locked = bestLay(hand, [cs('7s 7h 7d')])
  assert.deepEqual([locked.rest.length, locked.points], [2, 8 + 9], 'khoá 7s 7h 7d: nối thêm 7c được, 8s 9s lẻ')
  assert.equal(bestLay(cs('7s 8s Kd'), [cs('7s 8s 9s')]), null, 'nhóm khoá thiếu lá thì không xếp nổi')
}
assert.ok(uOf(cs('3s 4s 5s 9h 9d 9c Jd Jh Js Kc')), 'phỏm hết trừ một lá → ù')
assert.equal(uOf(cs('3s 4s 5s 9h 9d 9c Jd Jh Kc Qc')), null)
assert.deepEqual(eatWith(cs('5h 5d Kc'), [], c('5s')).sort(), cs('5h 5d').sort())
assert.equal(eatWith(cs('5h Kc Qd'), [], c('5s')), null, 'không ghép được thì không ăn')
assert.equal(eatWith(cs('5h 5d 5c'), [cs('5h 5d 5c')], c('5s')), null, 'lá đã khoá không dùng để ghép lần nữa')
assert.deepEqual(optsOf({ time: 7 }), { time: 30 })

// Một ván 2 người: ghế 0 đi đầu (10 lá); ghế 1 ăn lá đầu; mỗi người đánh 4 lá; lượt 4 hạ, gửi, đánh lá cuối.
{
  let s = step(ph.setup(), 0, { deal: { n: 2, first: 0 } }, 0)
  assert.deepEqual([s.turn, s.step, s.counts, deadlineOf(s)], [0, 'discard', [10, 9], T0 + 30000])
  assert.equal(ph.validate(s, 0, { draw: true }), 'games.err.badMove', 'người đi đầu đánh luôn, không bốc')
  assert.equal(ph.request(s, 0, { discard: c('Kc') }), true)
  s = step(s, 0, { discard: c('5s') }, 1)
  assert.deepEqual([s.turn, s.step, s.top], [1, 'take', { card: c('5s'), seat: 0 }])
  assert.equal(ph.validate(s, 0, { draw: true }), 'games.err.notYourTurn')
  s = step(s, 1, { eat: true }, 2)
  assert.deepEqual([s.eaten[1], s.piles[0], s.counts[1], s.step], [[c('5s')], [], 10, 'discard'])
  assert.equal(ph.validate(s, 1, { discard: c('5s') }), 'games.err.locked', 'không đánh lá vừa ăn')
  s = step(s, 1, { discard: c('Kd') }, 3)
  for (let k = 0; k < 2; k++) {
    s = step(s, 0, { draw: true }, 4)
    s = step(s, 0, { discard: c(['Qs', 'Js'][k]) }, 5)
    s = step(s, 1, { draw: true }, 6)
    s = step(s, 1, { discard: c(['Qd', 'Jd'][k]) }, 7)
  }
  assert.deepEqual(s.turns, [3, 3])
  s = step(s, 0, { draw: true }, 8)
  assert.equal(s.step, 'lay', 'lượt thứ 4: bốc xong phải hạ')
  assert.equal(ph.validate(s, 0, { discard: c('Ks') }), 'games.err.badMove')
  s = step(s, 0, { lay: [cs('7s 7h 7d')] }, 9)
  assert.equal(ph.validate(s, 0, { send: { card: c('7c'), to: 1, group: 0 } }), 'games.err.badMove', 'ghế 1 chưa hạ thì không gửi')
  s = step(s, 0, { discard: c('Ks') }, 10)
  s = step(s, 1, { draw: true }, 11)
  assert.equal(ph.validate(s, 1, { lay: [cs('5h 5d 5c')] }), 'games.err.badLay', 'lá ăn 5s phải nằm trong phỏm hạ')
  s = step(s, 1, { lay: [cs('5s 5h 5d')] }, 12)
  assert.equal(ph.validate(s, 1, { send: { card: c('8h'), to: 0, group: 0 } }), 'games.err.badMove', 'gửi phải thành phỏm')
  s = step(s, 1, { send: { card: c('7c'), to: 0, group: 0 } }, 13)
  assert.deepEqual(s.laid[0], [cs('7s 7h 7d 7c')])
  s = step(s, 1, { discard: c('9h') }, 14)
  assert.deepEqual([s.over, s.turn, s.counts], [true, null, [6, 5]])
  assert.deepEqual(ph.result(s), { winners: [], draw: false, pending: true }, 'điểm do server chấm')

  // Còn trên tay: ghế 0 = 6 lá (3+4+6+8+9+10 = 40), ghế 1 = 5 lá (2+3+4+6+8 = 23) → ghế 1 Nhất.
  const f = finalOf(s, { 0: cs('3s 4h 6c 8d 9c 10c'), 1: cs('2s 3h 4d 6h 8c') })
  assert.deepEqual(f.ranks, [1, 0])
  assert.deepEqual(f.points, { 0: 40, 1: 23 })
  assert.deepEqual(f.scores, { 0: -2, 1: 2 }, 'bị ăn 1 lá trả 1 + Nhì trả Nhất 1')
}

// Móm, ăn chốt, rời bàn.
{
  const base = { n: 3, out: [false, false, true], u: null, eats: [{ from: 0, to: 1, chot: true }], layOrder: [1, 0], laid: [[], [cs('5s 5h 5d')], null] }
  const f = finalOf(base, { 0: cs('2s'), 1: cs('Ks Qs') })
  assert.deepEqual([f.ranks, f.mom], [[1, 0, 2], [0]], 'móm xếp sau người hạ được dù ít điểm hơn')
  assert.deepEqual(f.scores, { 0: -8, 1: 12, 2: -4 }, 'ăn chốt 4 + móm 4 + rời bàn 4')
}

// Ù: mỗi người trả 5; người ù ăn đủ 3 lá của cùng một người thì người đó đền cả làng.
{
  const eats = [0, 1, 2].map(() => ({ from: 2, to: 0, chot: false }))
  const f = finalOf({ n: 3, out: [false, false, false], u: 0, eats, layOrder: [], laid: [] }, {})
  assert.deepEqual(f.scores, { 0: 13, 1: 0, 2: -13 }, 'ghế 2 đền 10 + bị ăn 3')
  assert.deepEqual(f.ranks, [0, 1, 2])
}
{
  let s = step(ph.setup(), 0, { deal: { n: 2, first: 0 } }, 0)
  assert.equal(ph.validate(s, 0, { u: [cs('3s 4s 2s')] }), null, 'đi đầu đủ phỏm thì ù luôn')
  s = step(s, 0, { u: [cs('3s 4s 5s'), cs('9h 9d 9c'), cs('Jd Jh Js')], rest: [c('Kc')] }, 1)
  assert.deepEqual([s.over, s.u, ph.result(s).winners], [true, 0, [0]])
}

// Hết giờ: chỉ gửi được khi bật đồng hồ, server đi thay người tới lượt.
{
  let s = step(ph.setup({ options: { time: 0 } }), 1, { deal: { n: 2, first: 1 } }, 0)
  assert.equal(deadlineOf(s), null)
  assert.equal(ph.validate(s, 0, { timeout: true }), 'games.err.badMove')
  s = step(ph.setup(), 1, { deal: { n: 2, first: 1 } }, 0)
  assert.equal(ph.validate(s, 0, { timeout: true }), null)
  s = step(s, 0, { timeout: true, discard: c('Ks') }, 31)
  assert.deepEqual([s.turn, s.last], [0, { seat: 1, timeout: true, discard: c('Ks') }])
}

// Server (0090) giữ bài: kiểm lá khoá, ù đủ lá, đi thay khi hết giờ.
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0090_games_phom.sql', import.meta.url), 'utf8')
  for (const frag of ['game_phom_groups_ok', "'games.err.locked'", "'games.err.badLay'", "'games.err.cantEat'", "'games.err.notYet'",
    'cardinality(v_hand) - 1', '-10 - p_seat', "v_mv := '{\"eat\": true}'"]) {
    assert.ok(sql.includes(frag), '0090 phải có ' + frag)
  }
}

console.log('Phỏm check: OK')
