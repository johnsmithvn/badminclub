// node src/__tests__/games/covay.test.js
// Luật Cờ vây (lib/games/covay.js). Sai ở đây là ăn nhầm quân, cho đi nước cấm (ko, tự sát), hoặc chấm điểm sai người
// thắng — và server (0089) chấm lại y luật này, lệch là ván xong mà máy báo một kiểu, phòng lưu một kiểu.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cv, { areaOf, capOf, CAP_PER_POINT, groupOf, KOMI, optsOf, SIZES } from '#lib/games/covay.js'

const at = (r, c, n = 9) => r * n + c
/** Đi lần lượt các nước (ghế tự đổi theo lượt), nước nào cũng phải hợp lệ. */
const play = (s, list) => list.reduce((st, m) => {
  const move = typeof m === 'number' ? { i: m } : m
  const err = cv.validate(st, st.turn, move)
  assert.equal(err, null, JSON.stringify(move) + ' phải hợp lệ, nhận ' + err)
  return cv.apply(st, st.turn, move)
}, s)
const fresh = (options = {}) => cv.setup({ options })
const PASS = { pass: true }

// Cỡ bàn: 9 / 13 / 19, lạ thì 9 — server đọc y vậy.
{
  assert.deepEqual(SIZES, [9, 13, 19])
  assert.equal(fresh().board.length, 81)
  assert.equal(fresh({ size: 19 }).board.length, 361)
  for (const bad of [7, '13', null, 13.5]) assert.equal(optsOf({ size: bad }).size, 9, JSON.stringify(bad) + ' → bàn 9')
}

// Ăn một quân: Trắng ở (0,1) hết khí khi Đen chặn (0,0), (0,2), (1,1).
{
  const s = play(fresh(), [at(0, 0), at(0, 1), at(0, 2), at(5, 5), at(1, 1)])
  assert.equal(s.board[at(0, 1)], null, 'quân hết khí phải bị nhấc khỏi bàn')
  assert.deepEqual(s.last.captured, [at(0, 1)])
  assert.deepEqual(s.caps, [1, 0], 'Đen đã ăn 1 quân')
}

// Ăn cả nhóm hai quân.
{
  const s = play(fresh(), [at(1, 0), at(0, 0), at(1, 1), at(0, 1), at(5, 5), at(6, 6), at(0, 2)])
  assert.deepEqual([s.board[at(0, 0)], s.board[at(0, 1)]], [null, null], 'nhóm hai quân hết khí bị ăn cả nhóm')
  assert.equal(s.caps[0], 2)
}

// Tự sát bị cấm — trừ khi nước đó ăn được quân (khi đó không phải tự sát).
{
  const s = play(fresh(), [at(4, 4), at(0, 1), at(4, 5), at(1, 0)])
  assert.equal(cv.validate(s, 0, { i: at(0, 0) }), 'games.err.suicide', 'Đen vào góc bị Trắng bịt hai phía là tự sát')
  // Đen đặt (1,0): ba phía là Trắng (0,0), (1,1), (2,0) — trông như tự sát, nhưng Trắng góc (0,0) bị Đen (0,1) và
  // quân mới bịt hết khí nên bị ăn trước → Đen có khí (0,0) → hợp lệ.
  const t = play(fresh(), [at(0, 1), at(0, 0), at(5, 5), at(1, 1), at(6, 6), at(2, 0)])
  const u = play(t, [at(1, 0)])
  assert.equal(u.board[at(0, 0)], null, 'lấp khí cuối của quân địch là ăn quân, không phải tự sát')
  assert.deepEqual([u.board[at(1, 0)], groupOf(u.board, 9, at(1, 0)).libs], [0, 1], 'quân vừa đặt còn đúng khí ở chỗ vừa ăn')
}

// Ko: ăn đúng một quân bằng một quân đơn còn một khí → đối phương không ăn lại ngay được; đi nước khác rồi mới được.
{
  let s = play(fresh(), [1, 2, 9, 12, 19, 20, 70, 10, 11])
  assert.equal(s.ko, 10, 'Đen ăn Trắng ở 10 → điểm 10 thành ko')
  assert.equal(cv.validate(s, 1, { i: 10 }), 'games.err.ko', 'Trắng không được ăn lại ngay')
  s = play(s, [71, 61])
  assert.equal(s.ko, -1, 'đi nước khác là hết ko')
  s = play(s, [10])
  assert.equal(s.ko, 11, 'Trắng ăn lại → ko chuyển sang Đen')
  assert.equal(play(s, [PASS]).ko, -1, 'bỏ lượt cũng xoá ko')
}

// Hết ván khi hai bên bỏ lượt liền nhau; một lần bỏ lượt rồi đi tiếp thì chưa.
{
  const s1 = play(fresh(), [at(4, 4), PASS, at(4, 5)])
  assert.equal(s1.over, false)
  assert.equal(play(s1, [PASS]).over, false, 'bỏ lượt xen kẽ nước đi không hết ván')
  const end = play(s1, [PASS, PASS])
  assert.equal(end.over, true)
  assert.equal(cv.validate(end, end.turn ?? 0, { i: 0 }), 'games.err.over')
}

// Tính điểm vùng: quân + đất trống chỉ giáp một màu; Trắng cộng 7,5 — không bao giờ hoà.
{
  // Đen dựng tường cột 4 từ trên xuống dưới: cả nửa trái (36 điểm) là đất Đen + 9 quân; nửa phải không ai có quân.
  const wall = Array.from({ length: 9 }, (_, r) => at(r, 4))
  const s = play(fresh(), wall.flatMap((i) => [i, PASS]).slice(0, -1).concat([PASS, PASS]))
  const a = areaOf(s.board, 9)
  assert.equal(a.b, 81, 'tường Đen chia bàn mà bên kia không có quân Trắng → cả bàn là của Đen')
  assert.deepEqual(cv.result(s), { winners: [0], draw: false, scores: { 0: 81, 1: KOMI } })
  // Thêm một quân Trắng bên phải: vùng phải giáp cả hai màu → không của ai.
  const t = play(fresh(), [...wall.flatMap((i, k) => (k === 0 ? [i, at(4, 7)] : [i, PASS])).slice(0, -1), PASS, PASS])
  const b = areaOf(t.board, 9)
  assert.deepEqual([b.b, b.w], [9 + 36, 1], 'vùng giáp cả hai màu không tính cho ai')
  assert.equal(cv.result(t).winners[0], 0)
  const empty = areaOf(Array(81).fill(null), 9)
  assert.deepEqual([empty.b, empty.w], [0, 0], 'bàn trống không ai có đất')
  assert.equal(cv.result(play(fresh(), [PASS, PASS])).winners[0], 1, 'không ai đặt quân: Trắng thắng nhờ komi')
}

// Trần số nước: đủ 3 × số giao điểm nước hợp lệ là hết ván (chặn ko ba vô tận).
{
  assert.equal(capOf(9), CAP_PER_POINT * 81)
  const s = { ...fresh(), ply: capOf(9) - 1 }
  assert.equal(cv.apply(s, 0, { i: 40 }).over, true)
}

// groupOf đếm khí không lặp.
{
  const s = play(fresh(), [at(4, 4), PASS, at(4, 5)])
  assert.deepEqual([groupOf(s.board, 9, at(4, 4)).stones.length, groupOf(s.board, 9, at(4, 4)).libs], [2, 6])
}

// Nước rác bị bỏ qua.
{
  const s = fresh()
  for (const m of [null, {}, { i: -1 }, { i: 81 }, { i: '4' }, { i: 2.5 }, []]) {
    assert.notEqual(cv.validate(s, 0, m), null, JSON.stringify(m) + ' phải bị từ chối')
  }
  assert.equal(cv.validate(s, 1, { i: 0 }), 'games.err.notYourTurn')
}

// Server (0089) dùng cùng hằng số và đọc cùng bộ ván mẫu: JS chấm từng ván phải ra đúng kết quả ghi trong file kiểm.
{
  const sql = readFileSync('supabase/migrations/0089_games_covay.sql', 'utf8')
  assert.ok(sql.includes(`c_komi CONSTANT numeric := ${KOMI};`), 'komi SQL ≠ JS')
  assert.ok(sql.includes(`c_cap  CONSTANT int := ${CAP_PER_POINT};`), 'trần số nước SQL ≠ JS')
  assert.ok(sql.includes(`IN (${SIZES.join(', ')})`), 'cỡ bàn SQL ≠ JS')
  const check = readFileSync('supabase/manual/0089_games_covay_check.sql', 'utf8').split('$gv$')
  assert.equal(check.length, 3, 'file kiểm 0089 phải có đúng một khối $gv$')
  const fixtures = JSON.parse(check[1])
  for (const f of fixtures) {
    let s = cv.setup({ options: f.options || {} })
    for (const m of f.moves) if (cv.validate(s, m.seat, m.move) == null) s = cv.apply(s, m.seat, m.move)
    assert.deepEqual(cv.result(s), f.result,
      'ván mẫu "' + f.note + '": JS chấm khác kết quả ghi trong file kiểm 0089 — cố ý đổi luật thì chạy node src/__tests__/games/fixtures.mjs')
  }
  assert.ok(fixtures.length >= 10 && fixtures.some((f) => f.result == null), 'bộ ván phải đủ và có ván chưa xong')
  assert.ok(fixtures.some((f) => f.result?.winners[0] === 0) && fixtures.some((f) => f.result?.winners[0] === 1), 'có ván Đen thắng và Trắng thắng')
}

console.log('covay check: OK')
