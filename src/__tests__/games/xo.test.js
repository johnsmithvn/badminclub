// node src/__tests__/games/xo.test.js
// Luật Cờ X-O 3 × 3 (lib/games/xo.js, 0107). Sai ở đây là xử thắng / hoà nhầm, cho đặt quân khi phải di quân, hay quân
// cũ không biến mất — và server (0107 game_xo_result) chấm lại y luật này, lệch là máy báo một kiểu, phòng lưu một kiểu.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import xo, { CAP, deadlineOf, fadingOf, moving, optsOf, TIMES } from '#lib/games/xo.js'
import { replay } from '#lib/games/registry.js'

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

// ---------- Đồng hồ lượt (0109): hết giờ thì mất lượt ----------
const T0 = Date.parse('2026-11-13T10:00:00Z')
const at = (sec) => ({ at: new Date(T0 + sec * 1000).toISOString() })
const timed = (mode, time = 3) => xo.setup({ options: { mode, time } })
const SKIP = { timeout: true, skip: true }

// Tuỳ chọn: phòng cũ (không có `time`) không tính giờ; phòng mới mặc định 3 giây; giá trị lạ về 0.
{
  assert.deepEqual(TIMES, [0, 3, 5, 10])
  assert.equal(xo.defaultOptions.time, 3, 'phòng mới mặc định 3 giây mỗi nước')
  assert.deepEqual(optsOf({}), { mode: 'classic', time: 0 }, 'phòng tạo trước 0109 không có time → không tính giờ')
  for (const bad of ['3', 4, 3.5, -3, true, null]) assert.equal(optsOf({ time: bad }).time, 0, 'time lạ: ' + JSON.stringify(bad))
  assert.equal(optsOf({ time: 10 }).time, 10)
}

// Hạn lượt: nước đầu không tính giờ; từ đó hạn = giờ server của lượt gần nhất + time. Nước chưa có giờ server thì chưa tính.
{
  const s0 = timed()
  assert.equal(deadlineOf(s0), null, 'nước đầu ván không tính giờ')
  assert.equal(xo.validate(s0, 1, { timeout: true }), 'games.err.badMove', 'chưa có nước đầu thì không có hết giờ')
  const s1 = xo.apply(s0, 0, { i: 4 }, at(7))
  assert.equal(deadlineOf(s1), T0 + 10_000, 'X đi lúc giây 7, phòng 3 giây → O phải đi trước giây 10')
  assert.equal(deadlineOf(xo.apply(s0, 0, { i: 4 })), null, 'nước máy mình vừa hiện trước (chưa có giờ server): chưa tính giờ — tính bừa là báo hết giờ oan')
  assert.equal(deadlineOf(xo.apply(timed('classic', 10), 0, { i: 4 }, at(7))), T0 + 17_000)
  assert.equal(xo.validate(fresh(), 0, { timeout: true }), 'games.err.badMove', 'phòng không tính giờ thì không có hết giờ')
  assert.equal(deadlineOf(xo.apply(fresh(), 0, { i: 4 }, at(7))), null)
}

// Báo hết giờ: ai ngồi bàn cũng báo được, phải qua server; chỉ dòng server đóng dấu `skip` mới làm mất lượt.
{
  const s1 = xo.apply(timed(), 0, { i: 4 }, at(0))
  for (const seat of [0, 1]) assert.equal(xo.validate(s1, seat, { timeout: true }), null, 'ghế ' + seat + ' báo hết giờ')
  assert.equal(xo.request(s1, 0, { timeout: true }), true, 'báo hết giờ không được hiện trước — giờ thật chỉ server biết')
  assert.equal(xo.request(s1, 1, { i: 0 }), false)
  assert.equal(xo.apply(s1, 0, { timeout: true }, at(3)), s1, 'dòng chưa có dấu skip (chưa qua server / DB thiếu 0109): không đổi gì')
  const s2 = xo.apply(s1, 0, SKIP, at(3.4)) // máy ghế 0 báo, người mất lượt là O (đang tới lượt)
  assert.deepEqual([s2.turn, s2.ply, s2.last, s2.over], [0, 2, { seat: 1, skip: true }, false])
  assert.deepEqual(s2.board, s1.board, 'mất lượt: không quân nào được đặt')
  assert.equal(deadlineOf(s2), T0 + 6_400, 'lượt mới tính giờ từ dòng mất lượt')
  assert.equal(xo.validate(s2, 1, { i: 0 }), 'games.err.notYourTurn', 'O vừa mất lượt, tới X')
  // X đi hai nước liền nhờ O mất lượt → thắng hàng trên.
  const win = [[0, { i: 3 }], [1, SKIP], [0, { i: 5 }]].reduce((s, [seat, m], k) => xo.apply(s, seat, m, at(4 + k)), s2)
  assert.deepEqual(xo.result(win), { winners: [0], draw: false })
  assert.equal(xo.validate(win, 1, { timeout: true }), 'games.err.over')
}

// Dựng lại từ log (registry.replay) ra đúng như áp từng nước; dòng hết giờ ở phòng không tính giờ bị bỏ qua.
{
  const log = [
    { seq: 1, seat: 0, move: { i: 0 }, ...at(0) },
    { seq: 2, seat: 0, move: SKIP, ...at(3.3) },       // O mất lượt
    { seq: 3, seat: 0, move: { i: 1 }, ...at(4) },
    { seq: 4, seat: 1, move: { timeout: true }, ...at(5) }, // rác: không có dấu skip
    { seq: 5, seat: 1, move: { i: 2 }, ...at(6) },
  ]
  const s = replay(xo, { options: { mode: 'classic', time: 3 } }, log)
  assert.deepEqual([s.board.slice(0, 3), s.turn, s.ply], [[0, 0, 1], 0, 4])
  const plain = replay(xo, { options: { mode: 'classic' } }, log)
  assert.deepEqual([plain.board.slice(0, 3), plain.turn, plain.ply], [[0, null, 1], 0, 2], 'phòng không tính giờ: dòng skip bị bỏ qua, O vẫn giữ lượt')
}

// Hai bên cùng bỏ mặc: lượt bị mất vẫn tính vào số lượt → hoà sau 2 × CAP lượt, không chạy mãi. Cổ điển cũng vậy.
for (const mode of ['classic', 'move', 'vanish']) {
  let s = xo.apply(timed(mode), 0, { i: 4 }, at(0))
  let k = 0
  while (!s.over) {
    assert.equal(xo.validate(s, 0, { timeout: true }), null)
    s = xo.apply(s, 0, SKIP, at(++k * 3.3))
    assert.ok(k < 200, mode + ': ván không chịu kết thúc')
  }
  assert.deepEqual([s.ply, xo.result(s)], [2 * CAP, { winners: [], draw: true }], mode + ': đủ 2 × CAP lượt (kể cả lượt mất) là hoà')
}

// Cổ điển có lượt bị mất: vẫn hoà đúng lúc ĐẦY BÀN (không phải ở lượt thứ 9 — lúc đó bàn còn ô trống).
{
  let s = xo.apply(timed(), 0, { i: 0 }, at(0))
  s = xo.apply(s, 0, SKIP, at(4)) // O mất lượt → ply 2, bàn mới có 1 quân
  for (const [seat, i] of [[0, 1], [1, 2], [0, 4], [1, 3], [0, 5], [1, 7], [0, 6]]) s = xo.apply(s, seat, { i }, at(5 + i))
  assert.equal(s.ply, 9)
  assert.equal(s.over, false, 'lượt thứ 9 nhưng bàn còn 1 ô trống (do có lượt bị mất) — chưa hoà')
  s = xo.apply(s, 1, { i: 8 }, at(20))
  assert.deepEqual(xo.result(s), { winners: [], draw: true })
}

// Server (0107 → 0109) dùng cùng hằng số và đọc cùng bộ ván mẫu: JS chấm từng ván phải ra đúng kết quả ghi trong file kiểm.
{
  // 0109 = bản đang chạy của hàm dựng lại ván (game_xo_run) + kiểm / đóng dấu hết giờ.
  const sql9 = readFileSync('supabase/migrations/0109_games_xo_time.sql', 'utf8')
  const run = sql9.slice(sql9.indexOf('FUNCTION public.game_xo_run'), sql9.indexOf('FUNCTION public.game_xo_result'))
  assert.ok(run.includes(`c_cap    CONSTANT int := ${CAP};`), 'số lượt tối đa SQL 0109 ≠ JS')
  assert.ok(run.includes("options -> 'time' IN (" + TIMES.filter(Boolean).map((n) => `'${n}'::jsonb`).join(', ') + ')'), 'các mức giờ ở 0109 ≠ TIMES của JS')
  assert.ok(run.includes("IF m.move -> 'skip' = 'true'::jsonb AND v_time > 0 AND v_since IS NOT NULL THEN"), 'chỉ dòng server đóng dấu skip, phòng có giờ, đã có nước đầu mới mất lượt — như validate / apply của JS')
  assert.ok(run.includes('v_over := v_ply >= 2 * c_cap;'), 'lượt bị mất phải tính vào số lượt — không thì hai bên bỏ mặc là ván chạy mãi')
  assert.ok(run.includes('NOT EXISTS (SELECT 1 FROM unnest(v_board) x WHERE x IS NULL) OR v_ply >= 2 * c_cap'), 'luật hoà: đầy bàn hoặc đủ 2 × CAP lượt')
  const chk = sql9.slice(sql9.indexOf('FUNCTION public.game_xo_check'), sql9.indexOf('FUNCTION public.game_xo_fill'))
  assert.ok(chk.includes("IF p_move ? 'skip' THEN RETURN 'games.err.badMove'"), 'máy khách tự gửi dấu skip phải bị từ chối — không thì ai cũng ép được đối thủ mất lượt')
  assert.ok(chk.includes("RETURN 'games.err.notYet'") && chk.includes('r.o_since + r.o_time * 1000'), 'báo hết giờ phải do server so giờ')
  assert.ok(sql9.includes(`'{"timeout": true, "skip": true}'::jsonb`), 'game_xo_fill phải đóng dấu skip')
  // game_move (0078) tìm hàm theo đúng chữ ký này.
  for (const fn of ['game_xo_check(p_room uuid, p_seat integer, p_move jsonb)', 'game_xo_fill(p_room uuid, p_seat integer, p_move jsonb)']) {
    assert.ok(sql9.includes('FUNCTION public.' + fn), 'thiếu / sai chữ ký ' + fn)
  }
  for (const fn of ['game_xo_run(uuid)', 'game_xo_result(uuid)', 'game_xo_check(uuid, integer, jsonb)', 'game_xo_fill(uuid, integer, jsonb)']) {
    assert.ok(sql9.includes('REVOKE ALL ON FUNCTION public.' + fn + ' FROM PUBLIC, anon, authenticated;'), fn + ' phải khoá khỏi máy khách')
  }

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
