// node src/__tests__/games/cangua.test.js
// Luật Cờ cá ngựa (lib/games/cangua.js). Sai ở đây là ngựa nhảy qua ngựa, đi lố cửa chuồng, không mất lượt khi
// không đi được, kẹt ván khi có người rời.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cg, { DOOR, HOME, movesOf, squareOf } from '#lib/games/cangua.js'
import { replay } from '#lib/games/registry.js'

const room = (n) => ({ seats: Array.from({ length: n }, (_, i) => i) })
const step = (s, seat, move) => {
  const err = cg.validate(s, seat, move)
  assert.equal(err, null, JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ, bị: ' + err)
  return cg.apply(s, seat, move)
}
const at = (s, horses) => ({ ...s, horses })

// Màu theo số người; ván mới ai cũng trong chuồng.
assert.deepEqual(cg.setup(room(2)).colors, [0, 2])
assert.deepEqual(cg.setup(room(3)).colors, [0, 1, 2])
assert.deepEqual(cg.setup(room(4)).horses, Array(4).fill([-1, -1, -1, -1]))

// Đổ: chưa đổ thì không đi; đổ rồi không đổ lại; không ra quân được thì mất lượt; 6 được đổ tiếp.
{
  let s = cg.setup(room(2))
  assert.equal(cg.validate(s, 0, { horse: 0 }), 'games.err.mustRoll')
  assert.equal(cg.validate(s, 1, { roll: true }), 'games.err.notYourTurn')
  assert.equal(cg.validate(s, 0, { roll: true, dice: 7 }), 'games.err.badMove')
  assert.equal(cg.request(s, 0, { roll: true }), true)
  assert.equal(cg.apply(s, 0, { roll: true }), s, 'thiếu số (server chưa điền) thì bỏ qua')
  s = step(s, 0, { roll: true, dice: 3 })
  assert.deepEqual([s.turn, s.dice, s.last.pass], [1, null, true], 'đổ 3 khi cả chuồng: mất lượt')
  s = step(s, 1, { roll: true, dice: 6 })
  assert.equal(cg.validate(s, 1, { roll: true }), 'games.err.rolled')
  assert.equal(cg.validate(s, 1, { horse: 4 }), 'games.err.badMove')
  s = step(s, 1, { horse: 2 })
  assert.deepEqual([s.horses[1], s.turn, s.dice], [[-1, -1, 0, -1], 1, null], 'ra quân bằng 6, được đổ tiếp')
  s = step(s, 1, { roll: true, dice: 1 })
  assert.equal(cg.validate(s, 1, { horse: 0 }), 'games.err.cantMove', 'ô xuất quân đang có ngựa mình')
  s = step(s, 1, { horse: 2 })
  assert.deepEqual([s.horses[1], s.turn], [[-1, -1, 1, -1], 0], 'đổ 1 không được đổ tiếp')
  assert.equal(cg.validate(s, 0, { horse: 0 }), 'games.err.mustRoll')
}

// Không dừng trên ngựa mình, không nhảy qua ngựa nào; dừng trúng ngựa đối phương là đá về chuồng.
{
  const s = cg.setup(room(2))
  // Ghế 1 màu 2 (vàng) xuất quân ở ô 24. Ngựa đỏ ở bước 22 = ô 22, ngựa vàng ở bước 0 = ô 24.
  const b = { ...at(s, [[22, 20, -1, -1], [0, -1, -1, -1]]), dice: 2 }
  assert.deepEqual(movesOf(b, 0).map((m) => m.horse), [0], 'ngựa ở bước 20 đi 2 trúng ngựa mình ở bước 22')
  assert.deepEqual(movesOf(b, 0)[0].kicked, { seat: 1, horse: 0 }, 'bước 24 của đỏ = ô 24, đá ngựa vàng')
  const after = cg.apply(b, 0, { horse: 0 })
  assert.deepEqual(after.horses, [[24, 20, -1, -1], [-1, -1, -1, -1]])
  const c = { ...at(s, [[20, -1, -1, -1], [0, -1, -1, -1]]), dice: 5 }
  assert.deepEqual(movesOf(c, 0), [], 'đi 5 phải nhảy qua ngựa vàng ở ô 24')
  const e = { ...at(s, [[-1, -1, -1, -1], [36, -1, -1, -1]]), dice: 6 }
  assert.equal(squareOf(2, 36), 12 % 48)
  assert.deepEqual(movesOf({ ...e, horses: [[-1, -1, -1, -1], [24, -1, -1, -1]] }, 0)[0].kicked, { seat: 1, horse: 0 }, 'ra quân trúng ngựa đối phương ở ô xuất quân: đá luôn')
}

// Về chuồng: phải dừng đúng cửa, đứng cửa đổ n lên bậc n, trong chuồng chỉ lên bậc kế bằng đúng số đó.
{
  const s = cg.setup(room(2))
  assert.deepEqual(movesOf({ ...at(s, [[44, -1, -1, -1], [-1, -1, -1, -1]]), dice: 4 }, 0), [], 'đi lố cửa chuồng')
  assert.deepEqual(movesOf({ ...at(s, [[44, -1, -1, -1], [-1, -1, -1, -1]]), dice: 3 }, 0), [{ horse: 0, to: DOOR }])
  assert.deepEqual(movesOf({ ...at(s, [[DOOR, -1, -1, -1], [-1, -1, -1, -1]]), dice: 4 }, 0), [{ horse: 0, to: HOME + 3 }])
  assert.deepEqual(movesOf({ ...at(s, [[DOOR, HOME + 1, -1, -1], [-1, -1, -1, -1]]), dice: 4 }, 0).map((m) => m.horse), [],
    'lên bậc 4 phải đi qua bậc 2 đang có ngựa; ngựa ở bậc 2 cần đúng 3')
  assert.deepEqual(movesOf({ ...at(s, [[HOME + 1, -1, -1, -1], [-1, -1, -1, -1]]), dice: 3 }, 0), [{ horse: 0, to: HOME + 2 }])
  assert.ok(!movesOf({ ...at(s, [[HOME + 5, -1, -1, -1], [-1, -1, -1, -1]]), dice: 6 }, 0).some((m) => m.horse === 0), 'bậc 6 là cao nhất')
  const win = { ...at(s, [[HOME + 5, HOME + 4, HOME + 3, HOME + 1], [-1, -1, -1, -1]]), dice: 3 }
  const end = cg.apply(win, 0, { horse: 3 })
  assert.deepEqual([end.over, end.winner, cg.result(end)], [true, 0, { winners: [0], draw: false }])
  assert.equal(cg.validate(end, 1, { roll: true }), 'games.err.over')
}

// Người rời ván 3 người: ngựa rút khỏi bàn, lượt bỏ qua họ; còn một người là người đó thắng.
{
  let s = { ...at(cg.setup(room(3)), [[5, -1, -1, -1], [10, -1, -1, -1], [-1, -1, -1, -1]]), turn: 1 }
  s = cg.apply(s, 1, { out: true })
  assert.deepEqual([s.horses[1], s.turn, s.out], [[-1, -1, -1, -1], 2, [false, true, false]])
  assert.equal(cg.validate(s, 1, { roll: true }), 'games.err.badMove')
  s = step(s, 2, { roll: true, dice: 2 })
  assert.equal(s.turn, 0, 'bỏ qua ghế 1 đã rời')
  s = cg.apply(s, 2, { out: true })
  assert.deepEqual([s.over, s.winner], [true, 0])
}

// Dựng lại từ log ra đúng state.
{
  const log = [
    { seq: 1, seat: 0, move: { roll: true, dice: 6 } },
    { seq: 2, seat: 0, move: { horse: 1 } },
    { seq: 3, seat: 0, move: { roll: true, dice: 4 } },
    { seq: 4, seat: 1, move: { horse: 0 } }, // sai lượt → bỏ qua
    { seq: 5, seat: 0, move: { horse: 1 } },
  ]
  let s = cg.setup(room(2))
  for (const m of [log[0], log[1], log[2], log[4]]) s = step(s, m.seat, m.move)
  assert.deepEqual(replay(cg, room(2), log), s)
  assert.deepEqual(s.horses[0], [-1, 4, -1, -1])
}

// Server điền số xúc xắc, chặn client tự ghi { out } (0079).
{
  const sql = readFileSync('supabase/migrations/0079_games_cangua.sql', 'utf8')
  assert.match(sql, /FUNCTION public\.game_cangua_fill\(p_room uuid, p_seat integer, p_move jsonb\)/)
  assert.match(sql, /1 \+ floor\(random\(\) \* 6\)/)
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.game_cangua_fill\(uuid, integer, jsonb\) FROM PUBLIC, anon, authenticated/)
}

console.log('cangua check: OK')
