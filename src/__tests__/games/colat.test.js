// node src/__tests__/games/colat.test.js
// Luật Cờ lật (lib/games/colat.js). Sai ở đây là lật nhầm quân / xử thắng nhầm cho người đang chơi thật.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cl, { CELLS, flipsOf, movesOf, START } from '#lib/games/colat.js'
import { replay } from '#lib/games/registry.js'

/** Bàn vẽ bằng chữ, hàng trên cùng trước: X = ghế 0 (đen, đi trước), O = ghế 1 (trắng), . = trống. */
const mk = (rows, extra = {}) => ({
  ...cl.setup(),
  board: rows.join('').split('').map((ch) => (ch === 'X' ? 0 : ch === 'O' ? 1 : null)),
  ...extra,
})
const draw = (s) => Array.from({ length: 8 }, (_, r) =>
  s.board.slice(r * 8, r * 8 + 8).map((v) => (v === 0 ? 'X' : v === 1 ? 'O' : '.')).join(''))
const at = (r, c) => r * 8 + c
const play = (s, cell) => {
  const err = cl.validate(s, s.turn, { cell })
  assert.equal(err, null, `đặt ô ${cell} phải hợp lệ, nhận ${err}`)
  return cl.apply(s, s.turn, { cell })
}
const sorted = (a) => [...a].sort((x, y) => x - y)
const EMPTY = '........'

// Xếp quân: bốn ô giữa chéo màu, đen đi trước, đúng 4 nước mở đầu.
{
  const s = cl.setup()
  assert.deepEqual(draw(s), [EMPTY, EMPTY, EMPTY, '...OX...', '...XO...', EMPTY, EMPTY, EMPTY])
  assert.equal(s.turn, 0)
  assert.deepEqual(movesOf(s.board, 0), [at(2, 3), at(3, 2), at(4, 5), at(5, 4)])
}

// Đặt quân lật hàng bị kẹp, lượt sang bên kia.
{
  const s = play(cl.setup(), at(2, 3))
  assert.deepEqual(draw(s).slice(2, 5), ['...X....', '...XX...', '...XO...'])
  assert.deepEqual(s.last, { seat: 0, cell: at(2, 3), flipped: [at(3, 3)], skipped: null })
  assert.equal(s.turn, 1)
  assert.equal(s.ply, 1)
}

// Nước sai.
{
  const s = cl.setup()
  assert.equal(cl.validate(s, 1, { cell: at(2, 3) }), 'games.err.notYourTurn')
  assert.equal(cl.validate(s, 0, { cell: at(3, 3) }), 'games.err.taken')
  assert.equal(cl.validate(s, 0, { cell: at(0, 0) }), 'games.err.mustFlip')
  assert.equal(cl.validate(s, 0, { cell: at(2, 4) }), 'games.err.mustFlip', 'kề quân đối phương mà không kẹp được')
  for (const bad of [null, {}, { cell: '19' }, { cell: 19.5 }, { cell: -1 }, { cell: CELLS }, [19]]) {
    assert.equal(cl.validate(s, 0, bad), 'games.err.badMove', JSON.stringify(bad))
  }
  assert.equal(cl.validate({ ...s, over: true }, 0, { cell: at(2, 3) }), 'games.err.over')
}

// Một nước lật nhiều hàng; mỗi hàng chỉ lật tới quân mình gần nhất; hàng chạm mép / gặp ô trống / không có quân
// đối phương xen giữa thì không lật.
{
  const s = mk([
    'X.......',
    '.O.O....',
    '..OOO...',
    'XOO.OOOX',
    '..XOO...',
    '...X.O..',
    '...O..O.',
    '.......O',
  ])
  assert.deepEqual(sorted(flipsOf(s.board, at(3, 3), 0)), [at(1, 1), at(2, 2), at(3, 1), at(3, 2), at(3, 4), at(3, 5), at(3, 6), at(4, 3)])
  const n = play(s, at(3, 3))
  assert.equal(n.board[at(6, 3)], 1, 'quân sau quân chặn không bị lật')
  assert.equal(n.board[at(4, 4)], 1, 'hàng chéo chạm mép không có quân chặn thì không lật')
  assert.equal(n.board[at(2, 3)], 1, 'hàng có ô trống ở cuối thì không lật')

  const gap = mk([EMPTY, EMPTY, EMPTY, 'X.O.....', EMPTY, EMPTY, EMPTY, EMPTY])
  assert.deepEqual(flipsOf(gap.board, at(3, 3), 0), [], 'có ô trống chen giữa thì không kẹp')
}

// Không tràn qua mép: ô cuối hàng trên và ô đầu hàng dưới liền nhau trong mảng nhưng không cùng hàng.
{
  const s = mk(['.......X', 'O......O', 'X.......', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY])
  assert.deepEqual(flipsOf(s.board, at(1, 1), 0), [], 'đi sang trái từ cột 1 không được tràn lên cuối hàng trên')
  assert.deepEqual(flipsOf(s.board, at(1, 6), 0), [], 'đi sang phải từ cột 6 không được tràn xuống đầu hàng dưới')
  assert.equal(cl.validate(s, 0, { cell: at(1, 1) }), 'games.err.mustFlip')
}

// Mất lượt: bên kia không còn nước nào → người vừa đi đi tiếp. Xoá sạch quân → hết ván dù bàn còn trống.
{
  const s = mk(['.OX.....', EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, 'XO......'])
  const a = play(s, at(0, 0))
  assert.equal(a.turn, 0, 'trắng không có nước thì đen đi tiếp')
  assert.equal(a.last.skipped, 1)
  assert.equal(a.over, false)
  assert.deepEqual(movesOf(a.board, 1), [])

  const b = play(a, at(7, 2))
  assert.equal(b.over, true, 'hết quân trắng → cả hai không đi được → hết ván')
  assert.equal(b.turn, null)
  assert.equal(b.last.skipped, null)
  assert.deepEqual(cl.result(b), { winners: [0], draw: false, scores: { 0: 6, 1: 0 } })
  assert.equal(cl.validate(b, 0, { cell: at(5, 5) }), 'games.err.over')
}

// Đầy bàn → hết ván, đếm quân: người đi nước cuối vẫn có thể thua.
{
  const s = mk(['.OXXXXXX', ...Array(7).fill('OOOOOOOO')])
  const end = play(s, at(0, 0))
  assert.equal(end.over, true)
  assert.deepEqual(cl.result(end), { winners: [1], draw: false, scores: { 0: 8, 1: 56 } })
}

// Hoà khi bằng quân; chưa hết ván thì chưa có kết quả.
{
  const full = { ...cl.setup(), board: Array(CELLS).fill(0).fill(1, 32), turn: null, over: true }
  assert.deepEqual(cl.result(full), { winners: [], draw: true, scores: { 0: 32, 1: 32 } })
  assert.equal(cl.result(cl.setup()), null)
}

// apply không sửa state cũ — dựng lại từ log dựa vào điều này.
{
  const s0 = cl.setup()
  cl.apply(s0, 0, { cell: at(2, 3) })
  assert.deepEqual(s0, cl.setup())
}

// Chơi ngẫu nhiên (tất định): mỗi nước thêm đúng một quân, chỉ đổi màu đúng các quân flipsOf trả về,
// chưa hết ván thì người tới lượt luôn có nước, mất lượt đúng lúc, ván luôn kết thúc trong 60 nước.
{
  let seed = 7777
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  let skips = 0
  for (let g = 0; g < 300; g++) {
    let s = cl.setup()
    while (!s.over) {
      const moves = movesOf(s.board, s.turn)
      assert.ok(moves.length > 0, 'chưa hết ván mà không còn nước đi:\n' + draw(s).join('\n'))
      const cell = moves[rand(moves.length)]
      const want = sorted(flipsOf(s.board, cell, s.turn))
      const n = cl.apply(s, s.turn, { cell })
      const changed = n.board.flatMap((v, i) => (v !== s.board[i] && i !== cell ? [i] : []))
      assert.deepEqual(changed, want, 'đổi màu khác danh sách lật')
      assert.equal(n.board.filter((v) => v != null).length, 4 + n.ply)
      if (n.last.skipped != null) {
        skips += 1
        assert.equal(n.turn, s.turn)
        assert.deepEqual(movesOf(n.board, n.last.skipped), [])
      }
      s = n
    }
    assert.ok(s.ply <= CELLS - 4)
    assert.deepEqual([movesOf(s.board, 0), movesOf(s.board, 1)], [[], []], 'hết ván mà vẫn còn nước')
  }
  assert.ok(skips > 0, '300 ván không có lần mất lượt nào — bộ thử không phủ được luật mất lượt')
}

// Server chấm lại bằng SQL (0076: game_colat_result) — gác hai lớp như coganh.test.js:
// xếp quân trong SQL = JS, và bộ ván mẫu $cl$ trong file kiểm tay 0076 JS chấm phải ra đúng kết quả ghi trong đó
// (kết quả có cả số quân mỗi bên, nên lật sai một quân là lệch).
{
  const sql = readFileSync('supabase/migrations/0076_games_colat.sql', 'utf8')
  for (const seat of [0, 1]) {
    const m = sql.match(new RegExp(`FOREACH i IN ARRAY ARRAY\\[([0-9, ]+)\\] LOOP v_b\\[i \\+ 1\\] := ${seat};`))
    assert.ok(m, 'không thấy chỗ xếp quân ghế ' + seat + ' trong 0076')
    assert.deepEqual(sorted(m[1].split(',').map(Number)), sorted(START[seat]), 'xếp quân ghế ' + seat + ' trong SQL khác JS')
  }

  const check = readFileSync('supabase/manual/0076_games_colat_check.sql', 'utf8').split('$cl$')
  assert.equal(check.length, 3, 'file kiểm 0076 phải có đúng một khối ván mẫu Cờ lật')
  const fixtures = JSON.parse(check[1])
  const room = { options: cl.defaultOptions, seed: 'x', seats: [0, 1] }
  for (const f of fixtures) {
    const s = replay(cl, room, f.moves.map((m, k) => ({ ...m, seq: k + 1 })))
    assert.deepEqual(cl.result(s), f.result,
      'ván mẫu "' + f.note + '": JS chấm khác kết quả ghi trong file kiểm 0076 — cố ý đổi luật thì chạy node src/__tests__/games/fixtures.mjs')
  }
  assert.ok(fixtures.some((f) => f.result?.draw) && fixtures.some((f) => f.result == null), 'bộ ván phải có cả ván hoà và ván chưa xong')
}

console.log('colat check: OK')
