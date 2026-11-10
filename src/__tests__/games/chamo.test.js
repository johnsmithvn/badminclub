// node src/__tests__/games/chamo.test.js
// Luật Chấm ô (lib/games/chamo.js). Sai ở đây là trao nhầm ô / cho đi tiếp nhầm người / xử thắng nhầm.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ch, { boxesOf, edgesOf, ends, SIZE_DEFAULT, SIZE_MAX, SIZE_MIN, sizeOf } from '#lib/games/chamo.js'
import { replay } from '#lib/games/registry.js'
import cfg from '#config/app.json' with { type: 'json' }

const fresh = (size) => ch.setup({ options: { size } })
const play = (s, line) => {
  const err = ch.validate(s, s.turn, { line })
  assert.equal(err, null, `nối nét ${line} phải hợp lệ, nhận ${err}`)
  return ch.apply(s, s.turn, { line })
}
const total = (n) => 2 * n * (n + 1)

// Cỡ bàn: mặc định 5 × 5; cỡ ngoài khoảng / không phải số nguyên thì về mặc định — SQL làm y vậy (ván mẫu gác).
{
  const s = ch.setup()
  assert.deepEqual([s.size, s.lines.length, s.boxes.length, s.turn, s.over], [SIZE_DEFAULT, total(SIZE_DEFAULT), 25, 0, false])
  assert.equal(fresh(3).lines.length, 24)
  assert.equal(fresh(SIZE_MIN).boxes.length, SIZE_MIN * SIZE_MIN)
  assert.equal(fresh(SIZE_MAX).lines.length, total(SIZE_MAX))
  for (const bad of ['3', SIZE_MAX + 1, SIZE_MIN - 1, 4.5, null, -3, Infinity, NaN]) {
    assert.equal(sizeOf({ size: bad }), SIZE_DEFAULT, 'cỡ ' + String(bad) + ' phải về mặc định')
  }
  assert.equal(sizeOf(null), SIZE_DEFAULT)
  assert.equal(sizeOf({}), SIZE_DEFAULT)
  for (const n of cfg.games.chamoSizes) assert.equal(sizeOf({ size: n }), n, 'app.json chamoSizes có cỡ ' + n + ' mà luật không nhận')
  assert.ok(cfg.games.chamoSizes.includes(SIZE_DEFAULT), 'form tạo phòng phải có cỡ mặc định')
}

// Đánh số nét / ô: mọi cỡ, nét nối hai chấm kề nhau, không trùng; ô và nét kề nhau hai chiều khớp nhau.
for (let n = SIZE_MIN; n <= SIZE_MAX; n++) {
  const seen = new Set()
  let border = 0
  for (let l = 0; l < total(n); l++) {
    const [[r1, c1], [r2, c2]] = ends(n, l)
    assert.equal(Math.abs(r1 - r2) + Math.abs(c1 - c2), 1, `n=${n} nét ${l} không nối hai chấm kề nhau`)
    for (const v of [r1, c1, r2, c2]) assert.ok(v >= 0 && v <= n, `n=${n} nét ${l} ra ngoài bàn`)
    seen.add([r1, c1, r2, c2].join())
    const bs = boxesOf(n, l)
    assert.ok(bs.length === 1 || bs.length === 2)
    if (bs.length === 1) border += 1
    for (const b of bs) assert.ok(edgesOf(n, b).includes(l), `n=${n}: nét ${l} kề ô ${b} mà ô không có cạnh đó`)
  }
  assert.equal(seen.size, total(n), `n=${n}: có hai nét trùng nhau`)
  assert.equal(border, 4 * n, `n=${n}: số nét mép bàn phải là 4n`)
  for (let b = 0; b < n * n; b++) {
    const e = edgesOf(n, b)
    assert.equal(new Set(e).size, 4)
    for (const l of e) assert.ok(boxesOf(n, l).includes(b), `n=${n}: ô ${b} có cạnh ${l} mà nét không kề ô`)
  }
}
assert.deepEqual(edgesOf(2, 3), [3, 5, 10, 11])
assert.deepEqual(boxesOf(2, 2), [0, 2], 'nét ngang giữa bàn kề ô trên và ô dưới')
assert.deepEqual(boxesOf(2, 7), [0, 1], 'nét dọc giữa bàn kề ô trái và ô phải')
assert.deepEqual(boxesOf(2, 8), [1], 'nét dọc mép phải chỉ kề một ô')

// Nước sai.
{
  const s = fresh(2)
  assert.equal(ch.validate(s, 1, { line: 0 }), 'games.err.notYourTurn')
  for (const bad of [null, {}, { line: '3' }, { line: 2.5 }, { line: -1 }, { line: 12 }, [3], { cell: 3 }]) {
    assert.equal(ch.validate(s, 0, bad), 'games.err.badMove', JSON.stringify(bad))
  }
  const a = play(s, 0)
  assert.equal(ch.validate(a, 1, { line: 0 }), 'games.err.lineTaken')
  assert.equal(ch.validate({ ...a, over: true }, 1, { line: 1 }), 'games.err.over')
}

// Một ván 2 × 2 dựng tay: không khép ô thì đổi lượt; khép ô thì đi tiếp; một nét khép hai ô; lượt gần nhất (trail).
// Ô 0: nét 0 2 6 7 · ô 1: 1 3 7 8 · ô 2: 2 4 9 10 · ô 3: 3 5 10 11.
{
  let s = fresh(2)
  s = play(s, 0)
  assert.deepEqual([s.turn, s.last, s.trail], [1, { seat: 0, line: 0, boxes: [] }, [0]])
  s = play(s, 2)
  s = play(s, 6)
  assert.equal(s.turn, 1, 'nét thứ ba của ô chưa khép ô — vẫn đổi lượt')
  s = play(s, 7)
  assert.deepEqual([s.turn, s.boxes, s.last.boxes, s.trail], [1, [1, null, null, null], [0], [7]], 'khép ô thì lấy ô và đi tiếp')
  s = play(s, 1)
  assert.deepEqual([s.turn, s.trail], [0, [7, 1]], 'lượt gần nhất gồm mọi nét người đó nối liền')
  s = play(s, 4)
  s = play(s, 9)
  s = play(s, 3)
  s = play(s, 8)
  assert.deepEqual([s.turn, s.boxes], [1, [1, 1, null, null]])
  s = play(s, 5)
  s = play(s, 11)
  assert.equal(s.over, false)
  const end = play(s, 10)
  assert.deepEqual(end.last, { seat: 1, line: 10, boxes: [2, 3] }, 'một nét khép hai ô')
  assert.deepEqual([end.over, end.turn, end.ply, end.trail], [true, null, 12, [10]])
  assert.deepEqual(ch.result(end), { winners: [1], draw: false, scores: { 0: 0, 1: 4 } })
  assert.equal(ch.validate(end, 1, { line: 0 }), 'games.err.over')
}

// Hoà khi bằng ô; ván mới chưa có kết quả.
{
  const s = { ...fresh(2), lines: Array(12).fill(0), boxes: [0, 1, 1, 0], over: true, turn: null }
  assert.deepEqual(ch.result(s), { winners: [], draw: true, scores: { 0: 2, 1: 2 } })
  assert.equal(ch.result(fresh(4)), null)
}

// apply không sửa state cũ — dựng lại từ log dựa vào điều này.
{
  const s0 = fresh(3)
  ch.apply(s0, 0, { line: 4 })
  assert.deepEqual(s0, fresh(3))
}

// Chơi ngẫu nhiên (tất định) mọi cỡ: mỗi nước thêm đúng một nét; chỉ trao đúng các ô vừa đủ 4 cạnh quanh nét đó;
// có ô thì đi tiếp, không thì đổi lượt; hết nét đúng lúc hết ô; lượt gần nhất chỉ dài ra khi nét trước đã ăn ô.
{
  let seed = 4242
  const rand = (k) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % k }
  let doubles = 0
  let draws = 0
  for (let g = 0; g < 300; g++) {
    const n = SIZE_MIN + (g % 5)
    let s = fresh(n)
    while (!s.over) {
      const free = s.lines.flatMap((v, i) => (v == null ? [i] : []))
      assert.ok(free.length > 0, 'chưa hết ván mà hết nét')
      const line = free[rand(free.length)]
      const seat = s.turn
      const next = play(s, line)
      assert.equal(next.lines.filter((v, i) => v !== s.lines[i]).length, 1)
      assert.equal(next.lines[line], seat)
      const want = boxesOf(n, line).filter((b) => edgesOf(n, b).every((e) => next.lines[e] != null))
      const got = next.boxes.flatMap((v, b) => (v !== s.boxes[b] ? [b] : []))
      assert.deepEqual(got, want, 'trao ô khác danh sách ô vừa khép')
      assert.ok(got.every((b) => next.boxes[b] === seat))
      if (got.length === 2) doubles += 1
      assert.equal(next.over, next.lines.every((v) => v != null), 'hết ván phải đúng lúc hết nét')
      if (!next.over) assert.equal(next.turn, got.length ? seat : 1 - seat)
      if (next.trail.length > 1) assert.ok(s.last.boxes.length > 0 && s.last.seat === seat, 'lượt gần nhất dài ra mà nét trước không ăn ô')
      s = next
    }
    assert.equal(s.ply, total(n))
    const r = ch.result(s)
    assert.equal(r.scores[0] + r.scores[1], n * n)
    if (r.draw) draws += 1
  }
  assert.ok(doubles > 0 && draws > 0, '300 ván không có nét khép hai ô / ván hoà nào — bộ thử không phủ đủ luật')
}

// Server chấm lại bằng SQL (0077: game_chamo_result) — gác hai lớp như colat.test.js:
// hằng cỡ bàn trong SQL = JS, và bộ ván mẫu $ch$ trong file kiểm tay 0077 JS chấm phải ra đúng kết quả ghi trong đó
// (có cả số ô mỗi bên và cả ván dùng cỡ bàn khác / cỡ bàn bậy).
{
  const sql = readFileSync('supabase/migrations/0077_games_chamo.sql', 'utf8')
  for (const [name, want] of [['c_min', SIZE_MIN], ['c_max', SIZE_MAX], ['c_def', SIZE_DEFAULT]]) {
    const m = sql.match(new RegExp(name + ' +CONSTANT int := (\\d+);'))
    assert.ok(m, 'không thấy hằng ' + name + ' trong 0077')
    assert.equal(Number(m[1]), want, name + ' trong SQL khác JS')
  }

  const check = readFileSync('supabase/manual/0077_games_chamo_check.sql', 'utf8').split('$ch$')
  assert.equal(check.length, 3, 'file kiểm 0077 phải có đúng một khối ván mẫu Chấm ô')
  const fixtures = JSON.parse(check[1])
  for (const f of fixtures) {
    const room = { options: f.options || {}, seed: 'x', seats: [0, 1] }
    const s = replay(ch, room, f.moves.map((m, k) => ({ ...m, seq: k + 1 })))
    assert.deepEqual(ch.result(s), f.result,
      'ván mẫu "' + f.note + '": JS chấm khác kết quả ghi trong file kiểm 0077 — cố ý đổi luật thì chạy node src/__tests__/games/fixtures.mjs')
  }
  assert.ok(fixtures.some((f) => f.result?.draw) && fixtures.some((f) => f.result == null), 'bộ ván phải có cả ván hoà và ván chưa xong')
  assert.ok(fixtures.some((f) => sizeOf(f.options) !== SIZE_DEFAULT), 'bộ ván phải có ván dùng cỡ bàn khác mặc định')
  assert.ok(fixtures.some((f) => f.options?.size != null && f.options.size !== SIZE_DEFAULT && sizeOf(f.options) === SIZE_DEFAULT),
    'bộ ván phải có ván với cỡ bàn bậy (phải về mặc định)')
}

console.log('chamo check: OK')
