// node src/__tests__/games/coganh.test.js
// Luật Cờ gánh (lib/games/coganh.js). Sai ở đây là đổi màu nhầm quân / xử thắng nhầm cho người đang chơi thật.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cg, { forcedFrom, MAX_PLY, NEIGHBORS, QUIET_LIMIT } from '#lib/games/coganh.js'
import { replay } from '#lib/games/registry.js'

/** Bàn vẽ bằng chữ, hàng trên cùng trước: A = ghế 0 (đỏ, đi trước), B = ghế 1 (xanh), . = trống. */
const mk = (rows, extra = {}) => ({
  ...cg.setup(),
  board: rows.join('').replace(/ /g, '').split('').map((ch) => (ch === 'A' ? 0 : ch === 'B' ? 1 : null)),
  ...extra,
})
const draw = (s) => Array.from({ length: 5 }, (_, r) =>
  s.board.slice(r * 5, r * 5 + 5).map((v) => (v === 0 ? 'A' : v === 1 ? 'B' : '.')).join(' '))
const play = (s, from, to) => {
  const err = cg.validate(s, s.turn, { from, to })
  assert.equal(err, null, `nước ${from}→${to} phải hợp lệ, nhận ${err}`)
  return cg.apply(s, s.turn, { from, to })
}
const sorted = (a) => [...a].sort((x, y) => x - y)

// Xếp quân: 5 quân hàng cuối, 2 quân hai đầu hàng thứ hai, 1 quân đầu bên trái (phía mình) hàng giữa.
assert.deepEqual(draw(cg.setup()), [
  'B B B B B',
  'B . . . B',
  'A . . . B',
  'A . . . A',
  'A A A A A',
])

// Đường kẻ: điểm (hàng + cột) chẵn có thêm đường chéo, điểm lẻ chỉ ngang dọc.
assert.deepEqual(sorted(NEIGHBORS[0]), [1, 5, 6], 'góc có đường chéo')
assert.deepEqual(sorted(NEIGHBORS[1]), [0, 2, 6], 'điểm lẻ không có đường chéo')
assert.deepEqual(sorted(NEIGHBORS[12]), [6, 7, 8, 11, 13, 16, 17, 18], 'tâm bàn nối 8 hướng')
assert.deepEqual(sorted(NEIGHBORS[7]), [2, 6, 8, 12])

// Nước sai.
{
  const s = cg.setup()
  assert.equal(cg.validate(s, 0, { from: 15, to: 16 }), null)
  assert.equal(cg.validate(s, 0, { from: 10, to: 6 }), null, 'điểm chẵn được đi chéo')
  assert.equal(cg.validate(s, 0, { from: 15, to: 11 }), 'games.err.badMove', 'điểm lẻ không có đường chéo để đi')
  assert.equal(cg.validate(s, 0, { from: 15, to: 17 }), 'games.err.badMove', 'chỉ đi một bước')
  assert.equal(cg.validate(s, 0, { from: 20, to: 15 }), 'games.err.taken')
  assert.equal(cg.validate(s, 0, { from: 5, to: 6 }), 'games.err.notYourPiece')
  assert.equal(cg.validate(s, 0, { from: 16, to: 11 }), 'games.err.notYourPiece', 'điểm trống không phải quân mình')
  assert.equal(cg.validate(s, 1, { from: 5, to: 6 }), 'games.err.notYourTurn')
  for (const bad of [null, {}, { from: '15', to: 16 }, { from: 15.5, to: 16 }, { from: -1, to: 0 }, { from: 24, to: 25 }]) {
    assert.equal(cg.validate(s, 0, bad), 'games.err.badMove', 'nước rác: ' + JSON.stringify(bad))
  }
}

// Gánh một đường; quân bị gánh đổi màu chứ không mất — bàn luôn đủ quân.
{
  const s = play(mk([
    'B . . . .',
    '. . . . .',
    '. B . B .',
    '. . A . .',
    '. . . . A',
  ]), 17, 12)
  assert.deepEqual(sorted(s.last.flipped), [11, 13])
  assert.equal(s.board[11], 0)
  assert.equal(s.board[13], 0)
  assert.equal(s.quiet, 0, 'có gánh thì đếm lại lượt im')
  assert.equal(s.over, false)
}

// Đường chéo chỉ gánh được ở điểm có kẻ chéo.
{
  const diag = play(mk([
    '. . . . .',
    '. B A . .',
    '. . . . .',
    '. . . B .',
    'B . . . A',
  ]), 7, 12)
  assert.deepEqual(sorted(diag.last.flipped), [6, 18], 'tâm bàn có đường chéo: gánh chéo')

  const odd = play(mk([
    '. B A . .',
    '. . . . .',
    '. . . B .',
    '. . . . .',
    'B . . . A',
  ]), 2, 7)
  assert.deepEqual(odd.last.flipped, [], 'điểm lẻ không có đường chéo: không gánh chéo')
}

// Chầu: gánh hai đường cùng lúc.
{
  const s = play(mk([
    'B . . . .',
    '. A B . .',
    '. B . B .',
    '. . B . .',
    '. . . . A',
  ]), 6, 12)
  assert.deepEqual(sorted(s.last.flipped), [7, 11, 13, 17])
}

// Vây: một quân bị bao kín đổi màu; cả nhóm bị bao kín đổi màu; nhóm còn đường thì không.
{
  const one = play(mk([
    'B A . . .',
    'A . . . .',
    '. . A . .',
    '. . . . .',
    '. . . . B',
  ]), 12, 6)
  assert.deepEqual(one.last.flipped, [0])

  const group = play(mk([
    'B B A . .',
    'A . . . .',
    '. . A . .',
    '. . . . .',
    '. . . . B',
  ]), 12, 6)
  assert.deepEqual(sorted(group.last.flipped), [0, 1], 'nhóm hết đường thì đổi màu cả nhóm')

  const breath = play(mk([
    'B B . . .',
    'A . . . .',
    '. . A . .',
    '. . . . .',
    '. . . . B',
  ]), 12, 6)
  assert.deepEqual(breath.last.flipped, [], 'nhóm còn một điểm trống thì chưa bị vây')
}

// Gánh xong mới xét vây: quân vừa bị gánh đổi màu có thể khép kín vòng vây.
{
  const s = play(mk([
    '. . . . .',
    'A A . . .',
    'B B . B .',
    'A A A . .',
    '. . . . B',
  ]), 17, 12)
  assert.deepEqual(sorted(s.last.flipped), [10, 11, 13])
}

// Mở: rút quân ra khỏi giữa hai quân cùng phe → bên kia có quân kề thì bắt buộc đi vào gánh.
{
  const s = play(mk([
    '. . . . B',
    '. . . . .',
    '. A A A .',
    '. . B . .',
    'A . . . .',
  ]), 12, 7)
  assert.equal(s.open, 12)
  assert.deepEqual(forcedFrom(s, 1), [17])
  assert.equal(cg.validate(s, 1, { from: 17, to: 22 }), 'games.err.mustCapture', 'bị mở thì phải gánh')
  assert.equal(cg.validate(s, 1, { from: 4, to: 3 }), 'games.err.mustCapture', 'quân khác cũng không được đi')
  const t = play(s, 17, 12)
  assert.deepEqual(sorted(t.last.flipped), [11, 13])
  assert.equal(t.open, null)

  const far = play(mk([
    '. . . . B',
    '. . . . .',
    '. A A A .',
    '. . . . .',
    'A . . . B',
  ]), 12, 7)
  assert.deepEqual(forcedFrom(far, 1), [], 'không có quân kề điểm mở thì không bị bắt buộc')
  assert.equal(cg.validate(far, 1, { from: 4, to: 3 }), null)
}

// Hết quân → thua.
{
  const s = play(mk([
    '. . . . .',
    '. . . . .',
    '. B . B .',
    '. . A . .',
    '. . . . A',
  ]), 17, 12)
  assert.equal(s.over, true)
  assert.deepEqual(cg.result(s), { winners: [0], draw: false })
  assert.equal(cg.validate(s, 1, { from: 0, to: 1 }), 'games.err.over')
}

// Chống ván kéo dài: đủ QUIET_LIMIT nước liền không ai ăn được, hoặc đủ MAX_PLY nước → đếm quân.
{
  const even = play({ ...cg.setup(), quiet: QUIET_LIMIT - 1 }, 15, 16)
  assert.equal(even.over, true)
  assert.deepEqual(cg.result(even), { winners: [], draw: true }, '8 – 8 là hoà')

  const lead = mk([
    'B B B B .',
    'B . . . A',
    'A . . . B',
    'A . . . A',
    'A A A A A',
  ], { quiet: QUIET_LIMIT - 2 })
  const one = play(lead, 15, 16)
  assert.equal(one.over, false, 'chưa đủ số nước im')
  const two = play(one, 5, 6)
  assert.equal(two.over, true)
  assert.deepEqual(cg.result(two), { winners: [0], draw: false }, 'nhiều quân hơn thì thắng')

  const long = play({ ...cg.setup(), ply: MAX_PLY - 1 }, 15, 16)
  assert.equal(long.over, true, 'đủ MAX_PLY nước thì hết ván')
}

// apply không sửa state cũ — dựng lại từ log dựa vào điều này.
{
  const s0 = cg.setup()
  cg.apply(s0, 0, { from: 15, to: 16 })
  assert.deepEqual(s0, cg.setup())
}

// Chơi ngẫu nhiên (tất định): luôn đủ 16 quân, chưa hết ván thì luôn còn nước đi, luôn kết thúc.
{
  let seed = 4242
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  for (let g = 0; g < 200; g++) {
    let s = cg.setup()
    while (!s.over) {
      const moves = []
      for (let f = 0; f < 25; f++) {
        if (s.board[f] !== s.turn) continue
        for (const to of NEIGHBORS[f]) if (cg.validate(s, s.turn, { from: f, to }) == null) moves.push({ from: f, to })
      }
      assert.ok(moves.length > 0, 'chưa hết ván mà không còn nước đi:\n' + draw(s).join('\n'))
      s = cg.apply(s, s.turn, moves[rand(moves.length)])
      assert.equal(s.board.filter((v) => v != null).length, 16, 'quân tự sinh ra hoặc biến mất')
      assert.ok(s.ply <= MAX_PLY)
    }
  }
}

// Server chấm lại bằng SQL (0075: game_coganh_result) — gác hai lớp như oanquan.test.js:
// hằng số SQL = JS, và bộ ván mẫu $cg$ trong file kiểm tay 0075 JS chấm phải ra đúng kết quả ghi trong đó.
{
  const sql = readFileSync('supabase/migrations/0075_games_results.sql', 'utf8')
  const fn = sql.slice(sql.indexOf('FUNCTION public.game_coganh_result'), sql.indexOf('FUNCTION public.game_finish'))
  assert.ok(new RegExp(`c_quiet CONSTANT int := ${QUIET_LIMIT};`).test(fn), 'c_quiet trong 0075 phải = QUIET_LIMIT')
  assert.ok(new RegExp(`c_max   CONSTANT int := ${MAX_PLY};`).test(fn), 'c_max trong 0075 phải = MAX_PLY')
  const start = cg.setup().board
  for (const seat of [0, 1]) {
    const pts = start.flatMap((v, i) => (v === seat ? [i] : [])).sort((a, b) => a - b)
    const m = fn.match(new RegExp(`FOREACH i IN ARRAY ARRAY\\[([0-9, ]+)\\] LOOP v_b\\[i \\+ 1\\] := ${seat};`))
    assert.ok(m, 'không thấy chỗ xếp quân ghế ' + seat + ' trong 0075')
    assert.deepEqual(m[1].split(',').map(Number).sort((a, b) => a - b), pts, 'xếp quân ghế ' + seat + ' trong SQL khác JS')
  }

  const check = readFileSync('supabase/manual/0075_games_results_check.sql', 'utf8').split('$cg$')
  assert.equal(check.length, 3, 'file kiểm 0075 phải có đúng một khối ván mẫu Cờ gánh')
  const fixtures = JSON.parse(check[1])
  const room = { options: cg.defaultOptions, seed: 'x', seats: [0, 1] }
  for (const f of fixtures) {
    const s = replay(cg, room, f.moves.map((m, k) => ({ ...m, seq: k + 1 })))
    assert.deepEqual(cg.result(s), f.result,
      'ván mẫu "' + f.note + '": JS chấm khác kết quả ghi trong file kiểm 0075 — cố ý đổi luật thì chạy node src/__tests__/games/fixtures.mjs')
  }
  assert.ok(fixtures.some((f) => f.result?.draw) && fixtures.some((f) => f.result == null), 'bộ ván phải có cả ván hoà và ván chưa xong')
}

console.log('coganh check: OK')
