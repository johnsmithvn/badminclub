// node src/__tests__/games/coup.test.js
// Luật Cờ úp (lib/games/coup.js). Sai ở đây là quân úp đi sai luật quân gốc, lật nhầm mặt, sĩ / tượng đã lật bị nhốt.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cu, { HIDDEN_SQUARES, isHidden, movesFrom } from '#lib/games/coup.js'
import { START } from '#lib/games/cotuong.js'

const at = (r, c) => r * 9 + c
const step = (s, seat, move) => {
  const err = cu.validate(s, seat, move)
  assert.equal(err, null, 'nước ' + JSON.stringify(move) + ' phải hợp lệ, bị: ' + err)
  return cu.apply(s, seat, move)
}

// Đầu ván: 30 quân úp đúng ô xuất phát, chỉ hai tướng lộ mặt.
{
  const s = cu.setup()
  assert.equal(HIDDEN_SQUARES.length, 30)
  assert.equal(s.board.filter(isHidden).length, 30)
  assert.deepEqual([s.board[at(9, 4)], s.board[at(0, 4)]], ['K', 'k'])
  assert.equal(s.board[at(9, 0)], 'X', 'quân đỏ úp là X')
}

// Quân úp đi theo quân gốc ở ô đó: ô xe đi dọc như xe, ô tốt tiến 1, ô sĩ chỉ trong cung.
{
  const s = cu.setup()
  assert.ok(movesFrom(s, at(9, 0)).some((m) => m.to === at(7, 0)), 'úp ở ô xe đi như xe')
  assert.deepEqual(movesFrom(s, at(6, 0)).map((m) => m.to), [at(5, 0)], 'úp ở ô tốt chỉ tiến 1')
  assert.deepEqual(movesFrom(s, at(9, 3)).map((m) => m.to), [at(8, 4)], 'úp ở ô sĩ chỉ đi trong cung')
}

// Đi xong thì lật theo mặt server điền; sĩ đã lật ra khỏi cung, tượng đã lật qua sông được.
{
  let s = cu.setup()
  s = step(s, 0, { from: at(9, 3), to: at(8, 4), flip: 'A' })
  assert.equal(s.board[at(8, 4)], 'A')
  assert.equal(s.last.flip, 'A')
  s = step(s, 1, { from: at(3, 0), to: at(4, 0), flip: 'R' })
  assert.equal(s.board[at(4, 0)], 'r', 'mặt thật quân đen viết thường')
  assert.ok(movesFrom(s, at(8, 4)).some((m) => m.to === at(7, 3)))
  s = step(s, 0, { from: at(8, 4), to: at(7, 3) })
  s = step(s, 1, { from: at(4, 0), to: at(5, 0) })
  assert.ok(movesFrom(s, at(7, 3)).some((m) => m.to === at(8, 2)), 'sĩ đã lật ra khỏi cung')
}

// Ăn quân úp: quân bị ăn lật theo `took`.
{
  let s = cu.setup()
  s = step(s, 0, { from: at(7, 1), to: at(0, 1), flip: 'C', took: 'H' }) // úp ở ô pháo đi như pháo, nhảy qua ngòi ăn ô mã
  assert.equal(s.last.captured, 'h')
  assert.equal(s.board[at(0, 1)], 'C')
}

// Nước client gửi (chưa có flip) vẫn hợp lệ để gửi đi; flip / took bậy thì sai.
{
  const s = cu.setup()
  assert.equal(cu.validate(s, 0, { from: at(6, 0), to: at(5, 0) }), null)
  assert.equal(cu.validate(s, 0, { from: at(6, 0), to: at(5, 0), flip: 'K' }), 'games.err.badMove')
  assert.equal(cu.validate(s, 1, { from: at(3, 0), to: at(4, 0) }), 'games.err.notYourTurn')
}

// SQL 0086 xáo đúng bàn xuất phát và điền theo ô.
{
  const sql = readFileSync('supabase/migrations/0086_games_coup.sql', 'utf8')
  assert.ok(sql.includes("'" + START + "'"), '0086 phải dùng đúng START của cotuong.js')
  for (const f of ["'AEHRCP'", "jsonb_build_object('flip'", "jsonb_build_object('took'", "NOT IN ('.', 'K', 'k')"]) assert.ok(sql.includes(f), '0086 thiếu ' + f)
}

console.log('coup check: OK')
