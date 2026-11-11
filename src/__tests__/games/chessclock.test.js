// node src/__tests__/games/chessclock.test.js
// Đồng hồ tổng mỗi bên + xin hoà (lib/games/chessClock.js) dùng trong Cờ vua / Cờ tướng, ký hiệu nước đi (SAN cờ vua,
// ký hiệu Việt cờ tướng), và gác server 0105 chép đúng hằng số / luật đồng hồ.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cv, { san } from '#lib/games/covua.js'
import xq, { notation } from '#lib/games/cotuong.js'
import { INC_SEC, clockMins, deadlineOf, leftOf } from '#lib/games/chessClock.js'
import { replay } from '#lib/games/registry.js'

const at = (sec) => ({ at: new Date(Date.UTC(2026, 0, 1, 0, 0, sec)).toISOString() })
const T0 = Date.parse(at(0).at)
const sq = (name) => (8 - Number(name[1])) * 8 + (name.charCodeAt(0) - 97)
const mv = (a, b, promo) => ({ from: sq(a), to: sq(b), ...(promo ? { promo } : {}) })

// ── Tuỳ chọn ──
assert.equal(clockMins({ clock: 10 }), 10)
assert.equal(clockMins({ clock: '10' }), 0, 'chuỗi không tính — khớp SQL so jsonb số')
assert.equal(clockMins({ clock: 7 }), 0)
assert.equal(cv.setup().clock, null, 'phòng cũ không có đồng hồ')
assert.equal(cv.setup({ options: { clock: 5 } }).clock.left[0], 5 * 60000)

// ── Đồng hồ chạy theo giờ của dòng log ──
for (const g of [cv, xq]) {
  const first = g === cv ? mv('e2', 'e4') : { from: 7 * 9 + 1, to: 7 * 9 + 4 }
  const reply = g === cv ? mv('e7', 'e5') : { from: 2 * 9 + 1, to: 2 * 9 + 4 }
  let s = g.setup({ options: { clock: 5 } })
  assert.equal(g.validate(s, 1, { timeout: true }), 'games.err.badMove', 'chưa chạy giờ thì không báo hết giờ được')
  assert.equal(g.validate(s, 0, { start: true }), null)
  s = g.apply(s, 0, { start: true }, at(0))
  assert.equal(s.clock.since, T0)
  assert.equal(deadlineOf(s), T0 + 300000)
  assert.equal(g.validate(s, 0, { start: true }), 'games.err.badMove', 'start chỉ một lần')
  s = g.apply(s, 0, first, at(20))
  assert.equal(s.clock.left[0], 300000 - 20000 + INC_SEC * 1000, 'trừ 20 giây nghĩ, cộng thêm giây mỗi nước')
  assert.equal(s.clock.left[1], 300000)
  assert.equal(leftOf(s, 1, T0 + 50000), 300000 - 30000, 'người tới lượt bị trừ dần')
  assert.equal(leftOf(s, 0, T0 + 50000), s.clock.left[0], 'người chờ đứng yên')
  // Hết giờ: báo → người tới lượt thua.
  assert.equal(g.request(s, 0, { timeout: true }), true, 'báo hết giờ phải chờ server xác nhận')
  const out = g.apply(s, 0, { timeout: true }, at(400))
  assert.deepEqual([out.over, out.winner, out.reason], [true, 0, 'time'])
  assert.deepEqual(g.result(out), { winners: [0], draw: false })
  // Đi khi đã hết giờ (log tới muộn) → người đi thua, bàn không đổi.
  const late = g.apply(s, 1, reply, at(20 + 301))
  assert.deepEqual([late.over, late.winner, late.reason, late.board], [true, 0, 'time', s.board])
  // Cùng log dựng lại qua registry.replay (meta = dòng log) ra đúng thế đó.
  const log = [{ seq: 1, seat: 0, move: { start: true }, ...at(0) }, { seq: 2, seat: 0, move: first, ...at(20) }]
  assert.deepEqual(replay(g, { options: { clock: 5 }, seats: [0, 1] }, log).clock, s.clock)
}

// ── Xin hoà ──
{
  let s = cv.setup()
  assert.equal(cv.validate(s, 0, { draw: 'offer' }), 'games.err.badMove', 'chưa đi nước nào thì chưa xin hoà')
  s = cv.apply(s, 0, mv('e2', 'e4'))
  assert.equal(cv.validate(s, 0, { draw: 'offer' }), null, 'xin hoà không cần tới lượt')
  s = cv.apply(s, 0, { draw: 'offer' })
  assert.equal(s.offer, 0)
  assert.equal(s.turn, 1, 'xin hoà không đổi lượt')
  assert.equal(cv.validate(s, 0, { draw: 'accept' }), 'games.err.badMove', 'không tự nhận lời mình')
  assert.equal(cv.validate(s, 1, { draw: 'offer' }), 'games.err.badMove', 'đang có lời xin hoà')
  const declined = cv.apply(s, 1, { draw: 'decline' })
  assert.equal(declined.offer, null)
  const moved = cv.apply(s, 1, mv('e7', 'e5'))
  assert.equal(moved.offer, null, 'đi nước thường = bỏ qua lời xin hoà')
  const agreed = cv.apply(s, 1, { draw: 'accept' })
  assert.deepEqual([agreed.over, agreed.reason], [true, 'agreed'])
  assert.deepEqual(cv.result(agreed), { winners: [], draw: true })
  assert.equal(cv.validate(agreed, 0, { draw: 'offer' }), 'games.err.over')
}

// ── SAN cờ vua ──
{
  const play = (list) => {
    let s = cv.setup()
    const out = []
    for (const m of list) {
      const n = cv.apply(s, s.turn, m)
      out.push(san(s, m, n))
      s = n
    }
    return out
  }
  // Mục đồng (Scholar's mate): e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#
  assert.deepEqual(play([mv('e2', 'e4'), mv('e7', 'e5'), mv('f1', 'c4'), mv('b8', 'c6'), mv('d1', 'h5'), mv('g8', 'f6'), mv('h5', 'f7')]),
    ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'])
  // Nhập thành + tốt ăn: e4 d5 exd5 ... O-O
  assert.deepEqual(play([mv('e2', 'e4'), mv('d7', 'd5'), mv('e4', 'd5'), mv('g8', 'f6'), mv('g1', 'f3'), mv('f6', 'd5'), mv('f1', 'e2'), mv('b8', 'c6'), mv('e1', 'g1')]),
    ['e4', 'd5', 'exd5', 'Nf6', 'Nf3', 'Nxd5', 'Be2', 'Nc6', 'O-O'])
  // Hai mã cùng tới một ô: phân biệt bằng cột.
  assert.deepEqual(play([mv('g1', 'f3'), mv('a7', 'a6'), mv('b1', 'c3'), mv('a6', 'a5'), mv('c3', 'e4'), mv('a5', 'a4'), mv('e4', 'g5')]).slice(-1),
    ['Neg5'])
  assert.equal(san(cv.setup(), { draw: 'offer' }, cv.setup()), null)
}

// ── Ký hiệu Việt cờ tướng ──
{
  const P = (r, c) => r * 9 + c
  let s = xq.setup()
  const step = (m) => { const n = xq.apply(s, s.turn, m); const k = notation(s, m, n); s = n; return k }
  assert.equal(step({ from: P(7, 7), to: P(7, 4) }), 'P2-5', 'Pháo đầu: pháo cột 2 bình 5')
  assert.equal(step({ from: P(0, 1), to: P(2, 2) }), 'M2.3', 'đen đếm cột từ phải của đen')
  assert.equal(step({ from: P(9, 7), to: P(7, 6) }), 'M2.3')
  assert.equal(step({ from: P(0, 0), to: P(1, 0) }), 'X1.1', 'xe tiến: số bước')
  assert.equal(step({ from: P(9, 8), to: P(8, 8) }), 'X1.1')
  assert.equal(step({ from: P(1, 0), to: P(0, 0) }), 'X1/1', 'xe thoái')
  assert.equal(step({ from: P(8, 8), to: P(8, 5) }), 'X1-4', 'xe bình')
}

// ── Gác SQL 0105 chép đúng luật đồng hồ ──
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0105_games_lobby.sql', import.meta.url), 'utf8')
  assert.match(sql, new RegExp('c_inc\\s+CONSTANT numeric := ' + INC_SEC + ';'), 'giây cộng mỗi nước khớp INC_SEC')
  for (const m of [5, 10, 15]) assert.ok(sql.includes(`p_options -> 'clock' = '${m}'::jsonb THEN ${m}`), 'phút ' + m + ' khớp CLOCKS')
  assert.ok(sql.includes("m.move ? 'draw' OR m.move ? 'timeout' OR m.move ? 'out'"), 'nước đặc biệt không đụng đồng hồ')
  assert.ok(sql.includes("'games.err.notYet'"))
  assert.ok(sql.includes("RAISE EXCEPTION 'games.err.needReady'"), 'game_start đòi mọi người Sẵn sàng')
  assert.ok(sql.includes("(p_options - 'stake')"), 'đổi luật không đổi được mức cược')
}

console.log('chessclock check: OK')
