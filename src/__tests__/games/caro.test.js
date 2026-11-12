// node src/__tests__/games/caro.test.js
// Luật Caro (lib/games/caro.js). Sai ở đây là xử thắng/thua nhầm cho người đang chơi thật.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import caro from '#lib/games/caro.js'

const at = (s, r, c) => r * s.size + c
/** Đi lần lượt các ô [r, c]; ghế tự đổi theo lượt. */
const play = (s, cells) => cells.reduce((st, [r, c]) => {
  const err = caro.validate(st, st.turn, { i: at(st, r, c) })
  assert.equal(err, null, 'nước ' + r + ',' + c + ' phải hợp lệ, nhận ' + err)
  return caro.apply(st, st.turn, { i: at(st, r, c) })
}, s)

const fresh = (options = {}) => caro.setup({ options, seats: [0, 1] })

// Ngang: X đi hàng 7 cột 3..7, O đi hàng 0.
{
  const s = play(fresh(), [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]])
  assert.equal(s.winner, 0, '5 quân ngang liền nhau phải thắng')
  assert.deepEqual(s.line, [at(s, 7, 3), at(s, 7, 4), at(s, 7, 5), at(s, 7, 6), at(s, 7, 7)], 'đường thắng phải đúng 5 ô theo thứ tự')
  assert.deepEqual(caro.result(s), { winners: [0], draw: false })
  assert.equal(caro.validate(s, 1, { i: at(s, 10, 10) }), 'games.err.over', 'ván đã xong thì không đi tiếp được')
}

// 4 quân chưa thắng.
{
  const s = play(fresh(), [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6]])
  assert.equal(s.winner, null, '4 quân không được tính thắng')
  assert.equal(caro.result(s), null)
}

// Dọc và hai đường chéo — O thắng (ghế 1).
for (const line of [
  [[2, 9], [3, 9], [4, 9], [5, 9], [6, 9]],
  [[2, 2], [3, 3], [4, 4], [5, 5], [6, 6]],
  [[2, 12], [3, 11], [4, 10], [5, 9], [6, 8]],
]) {
  const xs = [[14, 0], [14, 2], [14, 4], [14, 6], [14, 8]]
  const seq = line.flatMap((o, k) => [xs[k], o])
  const s = play(fresh(), seq)
  assert.equal(s.winner, 1, 'đường ' + JSON.stringify(line) + ' phải cho O thắng')
}

// Quân đặt GIỮA đường (không phải đầu mút) vẫn tạo thắng.
{
  const s = play(fresh(), [[7, 3], [0, 0], [7, 4], [0, 1], [7, 6], [0, 2], [7, 7], [0, 3], [7, 5]])
  assert.equal(s.winner, 0, 'lấp ô giữa thành 5 quân phải thắng')
}

// Sai lượt, đè ô, nước bậy.
{
  const s = play(fresh(), [[7, 7]])
  assert.equal(caro.validate(s, 0, { i: at(s, 1, 1) }), 'games.err.notYourTurn', 'X vừa đi thì không được đi tiếp')
  assert.equal(caro.validate(s, 1, { i: at(s, 7, 7) }), 'games.err.taken', 'không được đè ô đã có quân')
  assert.equal(caro.validate(s, 1, { i: -1 }), 'games.err.badMove')
  assert.equal(caro.validate(s, 1, { i: 1.5 }), 'games.err.badMove')
  assert.equal(caro.validate(s, 1, { i: 225 }), 'games.err.badMove', 'ngoài bàn 15x15')
  assert.equal(caro.validate(s, 1, {}), 'games.err.badMove')
}

// apply không sửa state cũ — dựng lại từ log dựa vào điều này.
{
  const s0 = fresh()
  const s1 = caro.apply(s0, 0, { i: 0 })
  assert.equal(s0.board[0], null, 'apply sửa thẳng state cũ thì dựng lại từ log ra sai')
  assert.equal(s0.moves, 0)
  assert.equal(s1.board[0], 0)
}

// Chặn hai đầu: 5 quân bị O chặn cả hai đầu thì chưa thắng; mở một đầu thì thắng.
{
  const opts = { blockedEnds: true }
  const blocked = play(fresh(opts), [[7, 3], [7, 2], [7, 4], [7, 8], [7, 5], [0, 0], [7, 6], [0, 1], [7, 7]])
  assert.equal(blocked.winner, null, 'luật chặn hai đầu: bị chặn cả hai đầu thì chưa thắng')

  const open = play(fresh(opts), [[7, 3], [7, 2], [7, 4], [0, 9], [7, 5], [0, 0], [7, 6], [0, 1], [7, 7]])
  assert.equal(open.winner, 0, 'chỉ bị chặn một đầu thì vẫn thắng')

  const off = play(fresh(), [[7, 3], [7, 2], [7, 4], [7, 8], [7, 5], [0, 0], [7, 6], [0, 1], [7, 7]])
  assert.equal(off.winner, 0, 'tắt luật chặn hai đầu thì bị chặn vẫn thắng')

  const edge = play(fresh(opts), [[7, 0], [0, 9], [7, 1], [0, 10], [7, 2], [0, 11], [7, 3], [0, 12], [7, 4]])
  assert.equal(edge.winner, 0, 'mép bàn không tính là bị chặn')
}

// Đúng 5 quân (0107): 6 quân liền không tính thắng; đúng 5 thì vẫn thắng; tắt luật thì 6 quân vẫn thắng.
{
  // X hàng 7 cột 0, 1, 2, 4, 5 rồi lấp cột 3 → 6 quân liền (y ván ở bước 6 của file kiểm 0107).
  const six = [[7, 0], [0, 0], [7, 1], [0, 2], [7, 2], [0, 4], [7, 4], [0, 6], [7, 5], [0, 8], [7, 3]]
  assert.equal(play(fresh({ exact: true }), six).winner, null, 'đúng 5 quân: 6 quân liền chưa thắng')
  assert.equal(play(fresh(), six).winner, 0, 'tắt luật đúng 5 quân thì 6 quân liền vẫn thắng')
  const five = [[7, 0], [0, 0], [7, 1], [0, 2], [7, 2], [0, 4], [7, 3], [0, 6], [7, 4]]
  assert.equal(play(fresh({ exact: true }), five).winner, 0, 'đúng 5 quân thì thắng')
  const check = readFileSync('supabase/manual/0107_games_xo_check.sql', 'utf8')
  assert.ok(check.includes('{"seat":0,"move":{"i":110}},{"seat":1,"move":{"i":8}},{"seat":0,"move":{"i":108}}'), 'bước 6 file kiểm 0107 phải là ván 6 quân này')
}

// Hoà khi đầy bàn mà không ai thắng (bàn 3x3, cần 3 quân).
{
  // X O X / X O O / O X X — không có 3 quân liền.
  const order = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 0], [1, 2], [2, 1], [2, 0], [2, 2]]
  const s = play(fresh({ size: 3, win: 3 }), order)
  assert.equal(s.winner, null)
  assert.deepEqual(caro.result(s), { winners: [], draw: true }, 'đầy bàn không ai thắng là hoà')
  assert.equal(caro.validate(s, s.turn, { i: 0 }), 'games.err.over')
}

// Server chấm lại Caro bằng SQL (game_caro_result, bản mới nhất 0107) — mặc định cỡ bàn / số quân phải khớp JS,
// không thì phòng tạo không kèm tuỳ chọn sẽ bị server chấm theo luật khác với luật đang hiện trên màn hình.
{
  const sql = readFileSync('supabase/migrations/0107_games_xo.sql', 'utf8')
  const fn = sql.slice(sql.indexOf('FUNCTION public.game_caro_result'), sql.indexOf('FUNCTION public.game_create'))
  assert.ok(fn.includes(`(v_opt ->> 'size')::int, ${caro.defaultOptions.size})`), 'cỡ bàn mặc định SQL ≠ JS')
  assert.ok(fn.includes(`(v_opt ->> 'win')::int, ${caro.defaultOptions.win})`), 'số quân thắng mặc định SQL ≠ JS')
  assert.ok(fn.includes(`(v_opt ->> 'blockedEnds')::boolean, ${caro.defaultOptions.blockedEnds})`), 'chặn hai đầu mặc định SQL ≠ JS')
  assert.ok(fn.includes(`(v_opt ->> 'exact')::boolean, ${caro.defaultOptions.exact})`), 'đúng 5 quân mặc định SQL ≠ JS')
}

// Phòng Caro 3 × 3 cũ (0088, đã chuyển sang Cờ X-O ở 0107): luật vẫn chấm được — 3 quân liền thắng, đầy 9 ô hoà.
{
  const xo = { size: 3, win: 3 }
  const s = play(fresh(xo), [[0, 0], [1, 0], [1, 1], [2, 0], [2, 2]])
  assert.equal(s.winner, 0, 'X đủ 3 quân chéo trên bàn 3 × 3 phải thắng')
  assert.deepEqual(s.line, [at(s, 0, 0), at(s, 1, 1), at(s, 2, 2)])
  const draw = play(fresh(xo), [[0, 0], [0, 1], [0, 2], [1, 1], [1, 0], [1, 2], [2, 1], [2, 0], [2, 2]])
  assert.deepEqual(caro.result(draw), { winners: [], draw: true }, 'đầy bàn 3 × 3 không ai thắng là hoà')
  // Server nhận cỡ 3..30 (bản 0107) — form tạo phòng chỉ còn bàn lớn.
  const sql = readFileSync('supabase/migrations/0107_games_xo.sql', 'utf8')
  assert.ok(sql.includes("(p_options ->> 'size')::int, 15) BETWEEN 3 AND 30"), 'game_create 0107 phải nhận cỡ bàn tới 30')
  const cfg = JSON.parse(readFileSync('src/config/app.json', 'utf8'))
  assert.ok(cfg.games.caroSizes.every((n) => n >= 5 && n <= 30), 'cỡ bàn cho chọn phải nằm trong khoảng server nhận, không còn 3 × 3')
}

console.log('caro check: OK')
