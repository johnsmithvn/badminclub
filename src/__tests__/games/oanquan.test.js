// node src/__tests__/games/oanquan.test.js
// Luật Ô ăn quan (lib/games/oanquan.js). Sai ở đây là cộng điểm nhầm / xử thắng nhầm cho người đang chơi thật.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import oq, { isQuanNon, MAX_STEPS, QUAN_NON, QUAN_VALUE, START_STONES } from '#lib/games/oanquan.js'
import { replay } from '#lib/games/registry.js'

const fresh = () => oq.setup({ options: oq.defaultOptions, seats: [0, 1] })
/** Bàn tự đặt: stones theo map {ô: số sỏi}, quan theo danh sách ô còn quan. */
const mk = (cells, { quan = [0, 6], score = [0, 0], turn = 0 } = {}) => {
  const s = fresh()
  s.stones = Array(12).fill(0)
  for (const [k, v] of Object.entries(cells)) s.stones[k] = v
  s.quan = Array(12).fill(false)
  for (const q of quan) s.quan[q] = true
  return { ...s, score, turn }
}
const total = (s) => s.stones.reduce((a, b) => a + b, 0) + s.score[0] + s.score[1] + s.quan.filter(Boolean).length * s.quanValue

// Rải xong mà ô kế tiếp là ô quan → dừng, không ăn, hết lượt.
{
  const s = oq.apply(mk({ 4: 1, 6: 2, 11: 3 }), 0, { cell: 4, dir: 1 })
  assert.equal(s.stones[6], 2, 'không được bốc sỏi trong ô quan')
  assert.equal(s.stones[7], 0)
  assert.equal(s.stones[5], 1)
  assert.equal(s.stones[4], 0, 'ô vừa bốc phải trống')
  assert.deepEqual(s.score, [0, 0], 'gặp ô quan thì dừng, không được ăn')
  assert.equal(s.turn, 1)
}

// Bốc tiếp ô dân kế tiếp, rồi ăn dây chuyền: ăn dân, ăn quan, vòng qua đầu bàn, ăn tiếp đến khi gặp ô có sỏi.
{
  const s = oq.apply(mk({ 0: 5, 1: 1, 3: 5, 10: 2 }), 0, { cell: 1, dir: 1 })
  assert.deepEqual(s.last.taken, [10, 0, 2, 4], 'thứ tự ăn: 10 → quan trái → 2 → 4')
  assert.deepEqual(s.score, [2 + (10 + 5) + 1 + 1, 0], 'quan trị giá 10 + số dân trong ô quan, dân mỗi viên 1')
  assert.equal(s.quan[0], false, 'quan đã bị ăn')
  assert.equal(s.quan[6], true)
  assert.deepEqual(s.stones, [0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0])
  assert.equal(s.over, false)
}

// Hai ô trống liền → hết lượt, không ăn.
{
  const s = oq.apply(mk({ 1: 1, 3: 4, 11: 1 }), 0, { cell: 1, dir: 1 })
  assert.deepEqual(s.score, [0, 0], 'trống hai ô liền thì mất lượt')
  assert.equal(s.turn, 1)
}

// Quan non: ô quan còn quan mà dưới 5 dân thì chưa ăn được — mất lượt. Nước đầu rải ngược chiều vòng về
// đúng ô quan (lúc đó mới 1 dân): không có luật này là ăn được quan ngay nước đầu.
{
  const s = oq.apply(fresh(), 0, { cell: 1, dir: -1 })
  assert.deepEqual(s.last.taken, [], 'quan non không được ăn')
  assert.deepEqual(s.score, [0, 0])
  assert.equal(s.quan[0], true)
  assert.equal(s.turn, 1, 'gặp quan non là mất lượt')

  const chain = oq.apply(mk({ 1: 1, 3: 5, 10: 2 }), 0, { cell: 1, dir: 1 })
  assert.deepEqual(chain.last.taken, [10], 'ăn dây chuyền tới quan non thì dừng')
  assert.deepEqual(chain.score, [2, 0])

  const young = oq.apply(mk({ 0: 4, 1: 1, 3: 5, 10: 2 }), 0, { cell: 1, dir: 1 })
  assert.deepEqual(young.last.taken, [10], '4 dân vẫn là quan non')
  const ripe = oq.apply(mk({ 0: 5, 1: 1, 3: 5, 10: 2 }), 0, { cell: 1, dir: 1 })
  assert.equal(ripe.last.taken.includes(0), true, 'đủ 5 dân thì ăn được quan')
  assert.equal(isQuanNon(young, 6), true, 'quan phải mới 1 dân')
  assert.equal(isQuanNon(ripe, 0), false, 'quan đã bị ăn thì không còn là quan non')
}

// Diễn lại nước đi: khung đầu là lúc bốc, khung cuối khớp bàn sau nước đi, mỗi lần rải tay bớt đúng một viên.
{
  const s0 = mk({ 0: 5, 1: 1, 3: 5, 10: 2 })
  const s = oq.apply(s0, 0, { cell: 1, dir: 1 })
  const f = s.last.frames
  assert.deepEqual(f[0], { kind: 'pick', at: 1, hand: 1, stones: [5, 0, 0, 5, 0, 0, 0, 0, 0, 0, 2, 0], quan: s0.quan, score: [0, 0] })
  assert.deepEqual(f.map((x) => x.kind).join(' '), 'pick drop pick drop drop drop drop drop eat eat eat eat')
  assert.deepEqual(f.at(-1).stones, s.stones, 'khung cuối phải đúng bàn sau nước đi')
  assert.deepEqual(f.at(-1).score, s.score)
  for (let k = 1; k < f.length; k++) if (f[k].kind === 'drop') assert.equal(f[k].hand, f[k - 1].hand - 1)
  assert.equal(s.ply, 1)
}

// Người sắp đi hết dân → lấy 5 điểm rải lại mỗi ô một viên.
{
  const s = oq.apply(mk({ 4: 1 }, { score: [0, 5] }), 0, { cell: 4, dir: 1 })
  assert.deepEqual(s.score, [0, 0], 'vừa đủ 5 điểm vẫn được rải lại, trừ đúng 5')
  assert.deepEqual([7, 8, 9, 10, 11].map((k) => s.stones[k]), [1, 1, 1, 1, 1])
  assert.equal(s.over, false)
}

// Hết dân mà không đủ 5 điểm để rải lại → hết ván, ai còn gì thu về nấy.
{
  const s = oq.apply(mk({ 4: 1 }, { score: [0, 3] }), 0, { cell: 4, dir: 1 })
  assert.equal(s.over, true)
  assert.deepEqual(s.score, [1, 3])
  assert.deepEqual(oq.result(s), { winners: [1], draw: false })
}

// Hết quan, tàn dân: ăn nốt quan cuối → hết ván, dân còn bên nào về bên đó.
{
  const s = oq.apply(mk({ 3: 1, 6: 5, 7: 2 }, { quan: [6] }), 0, { cell: 3, dir: 1 })
  assert.equal(s.over, true, 'hết cả hai quan phải hết ván')
  assert.deepEqual(s.score, [10 + 5 + 1, 2])
  assert.equal(s.last.frames.at(-1).kind, 'sweep')
  assert.deepEqual(oq.result(s), { winners: [0], draw: false })
  assert.equal(oq.validate(s, 1, { cell: 7, dir: 1 }), 'games.err.over')
}

// Hoà điểm.
{
  const s = oq.apply(mk({ 4: 1 }, { score: [3, 4] }), 0, { cell: 4, dir: 1 })
  assert.equal(s.over, true)
  assert.deepEqual(s.score, [4, 4])
  assert.deepEqual(oq.result(s), { winners: [], draw: true })
}

// Nước sai.
{
  const s = fresh()
  assert.equal(oq.validate(s, 1, { cell: 7, dir: 1 }), 'games.err.notYourTurn')
  assert.equal(oq.validate(s, 0, { cell: 7, dir: 1 }), 'games.err.notYourCell', 'không được bốc ô dân bên kia')
  assert.equal(oq.validate(s, 0, { cell: 0, dir: 1 }), 'games.err.notYourCell', 'không được bốc ô quan')
  assert.equal(oq.validate(s, 0, { cell: 1, dir: 2 }), 'games.err.badMove')
  assert.equal(oq.validate(s, 0, {}), 'games.err.notYourCell')
  assert.equal(oq.validate(s, 0, null), 'games.err.notYourCell')
  assert.equal(oq.validate(mk({ 2: 1, 7: 1 }), 0, { cell: 1, dir: 1 }), 'games.err.emptyCell')
  assert.equal(oq.validate(s, 0, { cell: 1, dir: 1 }), null)
}

// apply không sửa state cũ — dựng lại từ log dựa vào điều này.
{
  const s0 = fresh()
  oq.apply(s0, 0, { cell: 1, dir: 1 })
  assert.deepEqual(s0, fresh(), 'apply sửa thẳng state cũ thì dựng lại từ log ra sai')
}

// Chơi ngẫu nhiên (tất định) nhiều ván: luôn kết thúc, tổng sỏi + điểm + quan không đổi.
{
  let seed = 12345
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  for (let g = 0; g < 300; g++) {
    let s = fresh()
    const sum = total(s)
    let turns = 0
    while (!s.over) {
      const moves = [1, 2, 3, 4, 5].map((k) => (s.turn === 0 ? k : k + 6)).flatMap((cell) => [{ cell, dir: 1 }, { cell, dir: -1 }])
        .filter((m) => oq.validate(s, s.turn, m) == null)
      assert.ok(moves.length > 0, 'chưa hết ván mà không còn nước nào đi được')
      s = oq.apply(s, s.turn, moves[rand(moves.length)])
      assert.equal(total(s), sum, 'sỏi tự sinh ra hoặc biến mất')
      assert.ok(++turns < 1000, 'ván không chịu kết thúc')
    }
  }
}

// Server chấm lại bằng SQL (0075: game_oanquan_result). Không có Postgres trong test nên gác hai lớp:
//   1. Hằng số luật trong SQL = hằng số JS.
//   2. Bộ ván mẫu nhúng trong file kiểm tay 0075 — JS chấm ở đây phải ra đúng kết quả ghi trong đó;
//      file kiểm tay chạy trên DB thật bắt SQL chấm ra đúng kết quả đó. Hai đầu cùng một bộ ván.
{
  const sql = readFileSync('supabase/migrations/0075_games_results.sql', 'utf8')
  const fn = sql.slice(sql.indexOf('FUNCTION public.game_oanquan_result'), sql.indexOf('FUNCTION public.game_finish'))
  for (const [name, v] of [['c_quan', QUAN_VALUE], ['c_start', START_STONES], ['c_non', QUAN_NON], ['c_max', MAX_STEPS]]) {
    assert.ok(new RegExp(name + ' +CONSTANT int := ' + v + ';').test(fn), name + ' trong 0075 phải = ' + v + ' như JS')
  }

  const check = readFileSync('supabase/manual/0075_games_results_check.sql', 'utf8').split('$fx$')
  assert.equal(check.length, 3, 'file kiểm 0075 phải có đúng một khối ván mẫu')
  const fixtures = JSON.parse(check[1])
  assert.ok(fixtures.length >= 4)
  const room = { options: oq.defaultOptions, seed: 'x', seats: [0, 1] }
  for (const f of fixtures) {
    const s = replay(oq, room, f.moves.map((m, k) => ({ ...m, seq: k + 1 })))
    assert.deepEqual(oq.result(s), f.result, 'ván mẫu "' + f.note + '": JS chấm khác kết quả ghi trong file kiểm 0075 — cố ý đổi luật thì chạy node src/__tests__/games/fixtures.mjs')
  }
  assert.ok(fixtures.some((f) => f.result?.draw) && fixtures.some((f) => f.result == null), 'bộ ván phải có cả ván hoà và ván chưa xong')
}

console.log('oanquan check: OK')
