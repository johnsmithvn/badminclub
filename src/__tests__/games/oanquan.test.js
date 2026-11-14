// node src/__tests__/games/oanquan.test.js
// Luật Ô ăn quan (lib/games/oanquan.js). Sai ở đây là cộng điểm nhầm / xử thắng nhầm cho người đang chơi thật.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import oq, { deadlineOf, isQuanNon, MAX_STEPS, optsOf, QUAN_NON, QUAN_VALUE, queueStates, sideOf } from '#lib/games/oanquan.js'
import { replay } from '#lib/games/registry.js'

const fresh = (options = oq.defaultOptions) => oq.setup({ options, seats: [0, 1] })
/** Bàn tự đặt: stones theo map {ô: số sỏi}, quan theo danh sách ô còn quan. */
const mk = (cells, { quan = [0, 6], score = [0, 0], turn = 0, options } = {}) => {
  const s = fresh(options)
  s.stones = Array(12).fill(0)
  for (const [k, v] of Object.entries(cells)) s.stones[k] = v
  s.quan = Array(12).fill(false)
  for (const q of quan) s.quan[q] = true
  return { ...s, score, turn }
}
const total = (s) => s.stones.reduce((a, b) => a + b, 0) + s.score.reduce((a, b) => a + b, 0) + s.quan.filter(Boolean).length * s.quanValue

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

// Server chấm lại bằng SQL (game_oanquan_run — bản đang chạy là 0108, chép 0104 + người rời ván). Không có Postgres trong
// test nên gác hai lớp:
//   1. Hằng số luật trong SQL = hằng số JS.
//   2. Bộ ván mẫu nhúng trong file kiểm tay 0075 — JS chấm ở đây phải ra đúng kết quả ghi trong đó;
//      file kiểm tay chạy trên DB thật bắt SQL chấm ra đúng kết quả đó. Hai đầu cùng một bộ ván.
{
  // Hàm deal vẫn ở 0104; _run / _result bản mới nhất ở 0108.
  const sql = readFileSync('supabase/migrations/0104_games_oanquan_rules.sql', 'utf8')
  const sql8 = readFileSync('supabase/migrations/0108_games_oanquan_out.sql', 'utf8')
  const fn = sql8.slice(sql8.indexOf('FUNCTION public.game_oanquan_run'), sql8.indexOf('FUNCTION public.game_oanquan_result'))
  for (const [name, v] of [['c_quan', QUAN_VALUE], ['c_non', QUAN_NON], ['c_max', MAX_STEPS]]) {
    assert.ok(new RegExp(name + ' +CONSTANT int := ' + v + ';').test(fn), name + ' trong 0108 phải = ' + v + ' như JS')
  }
  // Người rời ván (0108): server phải áp nước { out } y như JS — thiếu là ván 3 quan kẹt ở ghế đã rời, xu cược bị giữ.
  assert.ok(fn.includes("ELSIF m.move -> 'out' = 'true'::jsonb THEN"), '0108 phải nhận nước { out } trong log')
  assert.ok(/IF m\.probe OR [^;]*v_out\[v_seat \+ 1\] THEN v_err := 'games\.err\.badMove'/.test(fn), '{ out } chỉ server ghi: máy khách gửi (probe) phải bị từ chối')
  assert.ok(fn.includes('IF NOT v_out[y + 1] THEN v_turn := y; EXIT; END IF;'), 'lượt phải sang ghế kế CÒN trong ván')
  // \s+ chứ không so nguyên xuống dòng: máy Windows checkout ra CRLF.
  assert.ok(/ELSIF v_seat <> v_turn THEN\s+CONTINUE;/.test(fn), 'người rời không tới lượt: lượt và hạn giờ giữ nguyên')
  const res = sql8.slice(sql8.indexOf('FUNCTION public.game_oanquan_result'), sql8.indexOf('FUNCTION public.game_oanquan_check'))
  assert.ok(res.includes('WHERE NOT r.o_out[i] AND r.o_score[i] = v_top'), 'người rời không được tính thắng')
  assert.ok(res.includes('jsonb_array_length(v_win) = r.o_quans'), 'chỉ hoà khi CẢ BÀN bằng điểm')
  // optsOf ↔ SQL: cùng tập giá trị, cùng mặc định.
  const has = (x, msg) => assert.ok(fn.includes(x), msg || 'game_oanquan_run thiếu: ' + x)
  assert.deepEqual(optsOf({}), { quans: 2, rows: 5, stones: 5, nhon: false, time: 0 })
  has("CASE WHEN v_opt -> 'quans' = '3'::jsonb THEN 3 ELSE 2 END")
  has("v_opt -> 'rows' IN ('6'::jsonb, '7'::jsonb)")
  has("v_opt -> 'stones' IN ('6'::jsonb, '7'::jsonb)")
  has("v_opt -> 'time' IN ('20'::jsonb, '30'::jsonb, '50'::jsonb)")
  has("v_opt -> 'nhon' = 'true'::jsonb")
  has("'games.err.notYet'", 'hết giờ phải do server xét giờ')
  assert.ok(sql.includes("RAISE EXCEPTION 'games.err.badCount'"), 'bắt đầu phòng phải đủ đúng số người = số quan')

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

// Hàng chờ diễn lại (queueStates): nước mới không được cắt ngang nước đang diễn.
{
  const s0 = fresh()
  const s1 = oq.apply(s0, 0, { cell: 1, dir: 1 })
  const s2 = oq.apply(s1, 1, { cell: 7, dir: 1 })
  assert.deepEqual(queueStates([], s0), [s0])
  const q1 = queueStates([s0], s1)
  assert.deepEqual(q1.map((x) => x.ply), [0, 1])
  assert.deepEqual(queueStates(q1, s2).map((x) => x.ply), [0, 1, 2], 'máy đi ngay sau mình: nước của mình phải còn trong hàng — bỏ đi là người chơi không thấy sỏi mình rải')
  assert.equal(queueStates(q1, s1), q1, 'cùng thế thì giữ nguyên hàng (đổi mảng là bàn vẽ lại vô ích)')
  const s1b = { ...s1 }
  const q1b = queueStates(q1, s1b)
  assert.equal(q1b.length, 2, 'cùng ply, object mới (phòng nạp lại): thay chỗ, không xếp thêm — xếp thêm là diễn một nước hai lần')
  assert.equal(q1b[1], s1b)
  assert.deepEqual(queueStates([s1, s2], s0), [s0], 'ván mới (ply lùi về 0): bỏ cả hàng, không diễn tiếp ván cũ')
}

// ---------- Tuỳ chọn phòng (0104) ----------

// optsOf: giá trị lạ về mặc định.
{
  assert.deepEqual(optsOf({ quans: 3, rows: 7, stones: 6, nhon: true, time: 50 }), { quans: 3, rows: 7, stones: 6, nhon: true, time: 50 })
  assert.deepEqual(optsOf({ quans: 4, rows: '6', stones: 9, nhon: 'yes', time: 45 }), optsOf({}))
  assert.deepEqual(optsOf(null), optsOf({}))
}

// Bàn tam giác 3 quan, 6 ô, 7 dân: quan ở 0 / 7 / 14, mỗi ghế một hàng giữa hai quan.
{
  const s = fresh({ quans: 3, rows: 6, stones: 7 })
  assert.equal(s.stones.length, 21)
  assert.deepEqual(s.quan.flatMap((q, i) => (q ? [i] : [])), [0, 7, 14])
  assert.deepEqual(sideOf(s, 2), [15, 16, 17, 18, 19, 20])
  assert.equal(s.stones[15], 7)
  assert.deepEqual(s.score, [0, 0, 0])
  assert.equal(oq.validate(s, 0, { cell: 7, dir: 1 }), 'games.err.notYourCell', 'ô quan không bốc được')
  assert.equal(oq.apply(s, 0, { cell: 3, dir: 1 }).turn, 1)
  assert.deepEqual(oq.players({ quans: 3 }), [3, 3])
  assert.deepEqual(oq.players({}), [2, 2])
}

// Nhón: rải xong mà ô kế là quan có dân → lấy 1 dân đẩy sang ô sau quan, xét tiếp (ở đây: trống – ăn 9, trống – ăn 11).
{
  const cells = { 4: 1, 6: 2, 9: 3, 11: 1 }
  const off = oq.apply(mk(cells), 0, { cell: 4, dir: 1 })
  assert.equal(off.stones[6], 2, 'không bật nhón thì gặp quan là dừng')
  assert.deepEqual(off.score, [0, 0])
  const on = oq.apply(mk(cells, { options: { nhon: true } }), 0, { cell: 4, dir: 1 })
  assert.equal(on.stones[6], 1, 'nhón đúng 1 dân')
  assert.equal(on.quan[6], true, 'chỉ nhón dân, quan vẫn nằm nguyên trong ô')
  assert.equal(on.stones[7], 1, 'dân nhón rơi xuống ô ngay sau quan')
  assert.deepEqual(on.last.taken, [9, 11])
  assert.deepEqual(on.score, [4, 0])
  assert.deepEqual(on.last.frames.map((f) => f.kind).join(' '), 'pick drop pick drop eat eat')
  // Ô quan chỉ còn quan, không còn dân → không được nhón (không bao giờ nhón quan) → dừng như luật thường.
  const bare = oq.apply(mk({ 4: 1, 9: 3, 11: 1 }, { options: { nhon: true } }), 0, { cell: 4, dir: 1 })
  assert.deepEqual(bare.score, [0, 0])
  assert.equal(bare.stones[7], 0)
  assert.equal(bare.quan[6], true, 'quan không bị nhón')
  assert.equal(bare.turn, 1, 'không nhón được thì mất lượt')
}

// 3 người: hết ván thì điểm cao nhất thắng; bằng nhau ở đầu bảng thì cùng thắng; cả ba bằng = hoà.
{
  const end = (score) => {
    const s = fresh({ quans: 3 })
    s.stones = Array(18).fill(0); s.stones[4] = 1; s.stones[13] = 1
    return oq.apply({ ...s, score }, 0, { cell: 4, dir: 1 }) // ghế 1 hết dân, thiếu điểm → hết ván; ghế 0 và 2 mỗi người thu về 1 dân
  }
  assert.deepEqual(oq.result(end([1, 0, 9])), { winners: [2], draw: false })
  assert.deepEqual(oq.result(end([7, 0, 7])), { winners: [0, 2], draw: false })
  assert.deepEqual(oq.result(end([0, 1, 0])), { winners: [], draw: true })
}

// ---------- Người rời ván 3 quan (0108) ----------
// Server ghi { out } khi bàn còn ≥ 2 người. Trước đây luật bỏ qua nước này: lượt đứng mãi ở ghế đã rời, ván kẹt, xu cược bị giữ.

// Rời lúc CHƯA tới lượt: lượt + hạn giờ giữ nguyên; tới vòng thì bỏ qua ghế đó.
{
  const s0 = oq.apply(fresh({ quans: 3, time: 30 }), 0, { start: true }, { at: '2026-11-13T10:00:00Z' })
  assert.deepEqual(s0.out, [false, false, false])
  assert.equal(oq.validate(s0, 2, { out: true }), null)
  const s1 = oq.apply(s0, 2, { out: true }, { at: '2026-11-13T10:00:10Z' })
  assert.deepEqual(s1.out, [false, false, true])
  assert.equal(s1.turn, 0, 'chưa tới lượt người rời thì lượt không đổi')
  assert.equal(deadlineOf(s1), deadlineOf(s0), 'người khác rời không được làm người đang nghĩ có thêm / mất giờ')
  assert.equal(s1.ply, s0.ply, '{ out } không tính là một nước: đổi ply là bàn diễn lại nước cũ')
  assert.equal(oq.validate(s1, 2, { out: true }), 'games.err.badMove', 'đã rời rồi thì không rời lần nữa')
  assert.equal(oq.validate(s1, 5, { out: true }), 'games.err.badMove')
  const s2 = oq.apply(s1, 0, { cell: 1, dir: -1 }, { at: '2026-11-13T10:00:12Z' }) // rải 1 viên sang ô quan 0, dừng trước ô 17
  const s3 = oq.apply(s2, s2.turn, { cell: sideOf(s2, s2.turn).find((c) => s2.stones[c] > 0), dir: 1 })
  assert.equal(s2.turn, 1)
  assert.equal(s3.turn, 0, 'sau ghế 1 phải về ghế 0, bỏ qua ghế 2 đã rời')
}

// Rời đúng lúc TỚI LƯỢT: lượt sang người kế còn trong ván, tính giờ lại từ lúc rời. Dựng lại từ log cũng vậy.
{
  const room = { options: { quans: 3, time: 20 }, seed: 'x', seats: [0, 1, 2] }
  const log = [
    { seq: 1, seat: 0, move: { start: true }, at: '2026-11-13T10:00:00Z' },
    { seq: 2, seat: 0, move: { cell: 1, dir: 1 }, at: '2026-11-13T10:00:05Z' },
    { seq: 3, seat: 1, move: { out: true }, at: '2026-11-13T10:00:15Z' },
  ]
  const before = replay(oq, room, log.slice(0, 2))
  const s = replay(oq, room, log)
  assert.equal(before.turn, 1)
  assert.equal(s.turn, 2, 'người tới lượt rời ván: lượt phải sang ghế 2 — đứng ở ghế 1 là ván kẹt vĩnh viễn')
  assert.equal(s.over, false)
  assert.equal(s.ply, before.ply)
  assert.deepEqual(s.last, before.last)
  assert.equal(oq.apply(before, 1, { out: true }, log[2]).last, before.last, 'giữ nguyên nước vừa đi (cùng object) để bàn không diễn lại')
  assert.equal(deadlineOf(s), Date.parse('2026-11-13T10:00:35Z'), 'người kế được đủ giờ tính từ lúc người kia rời')
  assert.equal(oq.validate(s, 2, { cell: sideOf(s, 2).find((c) => s.stones[c] > 0), dir: 1 }), null)
  assert.equal(oq.validate(s, 1, { cell: sideOf(s, 1)[0], dir: 1 }), 'games.err.notYourTurn', 'người đã rời không còn lượt')
  // Ô dân của người rời vẫn trên bàn: tổng sỏi + điểm không đổi.
  assert.equal(total(s), total(before))
}

// Người rời đang tới lượt, người kế hết dân: rải lại như đầu lượt thường; thiếu điểm thì hết ván.
{
  const base = fresh({ quans: 3 })
  const bare = { ...base, stones: base.stones.map((x, i) => (sideOf(base, 2).includes(i) ? 0 : x)), turn: 1 }
  const refill = oq.apply({ ...bare, score: [0, 0, 9] }, 1, { out: true })
  assert.equal(refill.turn, 2)
  assert.deepEqual(sideOf(refill, 2).map((c) => refill.stones[c]), [1, 1, 1, 1, 1])
  assert.equal(refill.score[2], 4, 'rải lại trừ đúng số ô một hàng')
  const end = oq.apply({ ...bare, score: [0, 0, 3] }, 1, { out: true })
  assert.equal(end.over, true, 'người kế hết dân, thiếu điểm rải lại → hết ván')
}

// Chấm khi có người rời: người rời không được thắng dù nhiều điểm nhất; hai người còn lại bằng điểm là CÙNG THẮNG, không
// phải hoà (hoà là người bỏ ván không mất cược).
{
  // Chỉ ghế 0 còn 1 dân: đi xong thì người kế (còn trong ván) hết dân, thiếu điểm rải lại → hết ván; ghế 0 thu về 1 dân.
  const end = (score, out) => {
    const s = fresh({ quans: 3 })
    s.stones = Array(18).fill(0); s.stones[4] = 1
    return oq.apply({ ...s, score, out }, 0, { cell: 4, dir: 1 })
  }
  assert.deepEqual(oq.result(end([1, 0, 9], [false, false, true])), { winners: [0], draw: false }, 'ghế 2 nhiều điểm nhất nhưng đã rời')
  assert.deepEqual(oq.result(end([2, 50, 3], [false, true, false])), { winners: [0, 2], draw: false }, 'hai người còn lại bằng điểm (3 – 3): cùng thắng, người rời (50 điểm) thua')
  assert.deepEqual(oq.result(end([2, 3, 3], [false, false, false])), { winners: [], draw: true }, 'không ai rời, cả bàn bằng điểm: vẫn là hoà')
  const tie = fresh({ quans: 3 })
  tie.stones = Array(18).fill(0); tie.stones[4] = 1; tie.stones[13] = 1
  // Ghế 1 đã rời → lượt sang ghế 2 (còn dân), chưa hết ván; ghế 2 đi nốt.
  const mid = oq.apply({ ...tie, score: [3, 20, 3], out: [false, true, false] }, 0, { cell: 4, dir: 1 })
  assert.equal(mid.turn, 2, 'bỏ qua ghế 1 đã rời')
  assert.equal(mid.over, false)
  // Còn ≤ 1 người trong ván (server thường đã xử thắng trước): người còn lại thắng.
  const last = oq.apply({ ...fresh({ quans: 3 }), out: [true, false, false] }, 2, { out: true })
  assert.equal(last.over, true)
  assert.deepEqual(oq.result(last), { winners: [1], draw: false })
}

// 3 quan, một người rời ở thời điểm bất kỳ: ván luôn kết thúc, không sinh / mất sỏi, người rời không bao giờ có lượt / thắng.
{
  let seed = 4242
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  for (const options of [{ quans: 3 }, { quans: 3, rows: 6, stones: 6, nhon: true }]) {
    for (let g = 0; g < 80; g++) {
      let s = fresh(options)
      const sum = total(s)
      const gone = rand(3)
      const when = rand(12)
      let turns = 0
      while (!s.over) {
        if (turns === when) s = oq.apply(s, gone, { out: true })
        if (s.over) break
        assert.ok(turns < when || s.turn !== gone, 'người đã rời không được tới lượt')
        const moves = sideOf(s, s.turn).filter((c) => s.stones[c] > 0).flatMap((cell) => [{ cell, dir: 1 }, { cell, dir: -1 }])
        assert.ok(moves.length > 0, 'tới lượt mà không có nước nào — ván kẹt')
        const mv = moves[rand(moves.length)]
        assert.equal(oq.validate(s, s.turn, mv), null)
        s = oq.apply(s, s.turn, mv)
        assert.equal(total(s), sum, 'sỏi tự sinh ra hoặc biến mất')
        assert.ok(++turns < 2000, 'ván không chịu kết thúc')
      }
      const r = oq.result(s)
      if (turns >= when) assert.ok(!r.winners.includes(gone) && !r.draw, 'đã có người rời: không hoà, người rời không thắng')
    }
  }
}

// Hết giờ: { timeout } trơn phải qua server; nước server ghi { cell, dir, timeout } áp cho người tới lượt.
{
  const plain = fresh()
  assert.equal(oq.validate(plain, 1, { timeout: true }), 'games.err.badMove', 'phòng không đồng hồ thì không có hết giờ')
  const timed = fresh({ time: 30 })
  assert.equal(oq.request(timed, 1, { timeout: true }), true)
  assert.equal(oq.validate(timed, 1, { timeout: true }), null)
  assert.equal(oq.apply(timed, 1, { timeout: true }), timed, 'chưa qua server thì không đổi gì')
  assert.equal(deadlineOf(timed), null)
  const started = oq.apply(timed, 0, { start: true }, { at: '2026-11-11T10:00:00Z' })
  assert.equal(deadlineOf(started), Date.parse('2026-11-11T10:00:30Z'))
  assert.equal(oq.validate(started, 0, { start: true }), 'games.err.badMove', 'chỉ một nước start, đầu ván')
  assert.equal(oq.validate(started, 1, { cell: 2, dir: 1, timeout: true }), null, 'máy ghế 1 báo, server đi thay ghế 0')
  const s = oq.apply(started, 1, { cell: 2, dir: 1, timeout: true }, { at: '2026-11-11T10:00:31Z' })
  assert.equal(s.last.seat, 0)
  assert.equal(s.last.timeout, true)
  assert.equal(s.turn, 1)
  assert.equal(deadlineOf(s), Date.parse('2026-11-11T10:01:01Z'))
}

// Chơi ngẫu nhiên mọi biến thể: luôn kết thúc, tổng sỏi + điểm + quan không đổi, lượt xoay vòng.
{
  let seed = 777
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
  for (const options of [{ quans: 3 }, { quans: 3, rows: 7, stones: 7, nhon: true }, { rows: 6, stones: 6, nhon: true }, { rows: 7, nhon: true }]) {
    for (let g = 0; g < 60; g++) {
      let s = fresh(options)
      const sum = total(s)
      let turns = 0
      while (!s.over) {
        const moves = sideOf(s, s.turn).flatMap((cell) => [{ cell, dir: 1 }, { cell, dir: -1 }]).filter((m) => oq.validate(s, s.turn, m) == null)
        assert.ok(moves.length > 0, 'chưa hết ván mà không còn nước nào đi được')
        const was = s.turn
        s = oq.apply(s, s.turn, moves[rand(moves.length)])
        assert.equal(s.turn, (was + 1) % s.opts.quans)
        assert.equal(total(s), sum, 'sỏi tự sinh ra hoặc biến mất')
        assert.ok(++turns < 2000, 'ván không chịu kết thúc')
      }
    }
  }
}

console.log('oanquan check: OK')
