// Ba cây (bộ 36 lá A…9): luật JS (lib/games/bacay.js) + gác khớp server 0092 bằng bộ ván mẫu chung trong file kiểm.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import bc, { DECK, HAND, PAY, SUIT_POWER, nutOf, pipOf, powerOf, scoreOf, topOf } from '#lib/games/bacay.js'
import { replay } from '#lib/games/registry.js'

const R = { A: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8 }
const S = { '♠': 0, '♣': 1, '♦': 2, '♥': 3 }
const c = (txt) => { const m = txt.match(/^([A2-9])(.)$/); return R[m[1]] * 4 + S[m[2]] }
const h = (txt) => txt.split(' ').map(c).sort((a, b) => a - b)

/* ---------- Bộ bài, điểm lá, nút ---------- */
assert.equal(DECK, 36)
assert.equal(c('9♥'), 35, 'lá to nhất bộ 36 là 9♥ = 35')
assert.deepEqual(['A♠', '5♣', '9♥'].map((x) => pipOf(c(x))), [1, 5, 9])
assert.equal(nutOf(h('7♠ 8♣ 9♦')), 4)
assert.equal(nutOf(h('3♦ 3♥ 4♦')), 0, 'tròn 10 là bù')

/* ---------- Lá to nhất: chất trước (♦ > ♥ > ♠ > ♣), cùng chất A > 9 > … > 2 ---------- */
assert.equal(topOf(h('9♥ 2♦ A♠')), c('2♦'), '2 rô to hơn 9 cơ')
assert.equal(topOf(h('9♦ A♦ 8♦')), c('A♦'), 'A rô to nhất')
assert.ok(powerOf(c('2♣')) < powerOf(c('A♣')) && powerOf(c('A♣')) < powerOf(c('2♠')))
assert.deepEqual(SUIT_POWER, [1, 0, 3, 2])
assert.equal(new Set(Array.from({ length: DECK }, (_, i) => powerOf(i))).size, DECK, '36 lá có 36 độ to khác nhau → không hoà')

/* ---------- Chấm ---------- */
{
  const r = scoreOf([h('2♠ 3♠ 4♠'), h('9♦ 8♦ A♥'), h('A♠ 2♣ 3♣')], [false, false, false])
  assert.deepEqual(r, { winners: [0], draw: false, ranks: [0, 1, 2], scores: { 0: 2, 1: -1, 2: -1 } }, '9 nút ăn mỗi người 1')
  const r2 = scoreOf([h('2♠ 3♠ 4♠'), h('9♦ 8♦ A♥'), h('A♠ 2♣ 3♣')], [true, false, false])
  assert.deepEqual(r2.ranks, [1, 2, 0], 'người rời xếp cuối dù bài mạnh nhất')
  assert.deepEqual(r2.scores, { 0: -1, 1: 2, 2: -1 })
  for (const x of [r, r2]) assert.equal(Object.values(x.scores).reduce((a, b) => a + b, 0), 0, 'cả bàn cộng lại bằng 0')
  assert.equal(scoreOf([h('A♠ 2♠ 3♠'), null], [false, false]), null, 'người còn chơi chưa có bài → chưa chấm')
  assert.equal(scoreOf([null, null], [true, true]), null)
  assert.equal(PAY, 1)
}

/* ---------- Luật ván: chia, lật, rời, hết ván ---------- */
{
  const room = { options: {}, seed: 's', seats: [0, 1, 2] }
  const log = [
    { seq: 1, seat: 0, move: { deal: { n: 3 } } },
    { seq: 2, seat: 1, move: { flip: true, cards: [6, 10, 14] } }, // 2♦ 3♦ 4♦ = 9 nút
    { seq: 3, seat: 1, move: { flip: true, cards: h('2♥ 3♥ 4♥') } }, // lật lần hai → bỏ qua
    { seq: 4, seat: 0, move: { flip: true, cards: [0, 4, 8] } }, // A♠ 2♠ 3♠ = 6 nút
    { seq: 5, seat: 2, move: { flip: true, cards: h('A♠ 4♣ 5♣') } }, // trùng lá người khác → bỏ qua
    { seq: 6, seat: 1, move: { out: true } },
  ]
  let s = replay(bc, room, log)
  assert.equal(s.over, false)
  assert.deepEqual(bc.waiting(s), [2], 'chỉ còn ghế 2 chưa lật — mất kết nối chỉ xử ghế này')
  assert.equal(bc.result(s), null)
  assert.equal(bc.validate(s, 0, { flip: true }), 'games.err.flipped')
  assert.equal(bc.validate(s, 2, { flip: true }), null, 'máy khách gửi { flip: true } không kèm lá')
  assert.equal(bc.validate(s, 2, { flip: true, cards: [13, 17] }), 'games.err.badMove')
  assert.equal(bc.validate(s, 2, { flip: true, cards: [13, 17, 40] }), 'games.err.badMove', 'lá 40 (J) không có trong bộ 36')
  assert.equal(bc.validate(s, 2, { foo: 1 }), 'games.err.badMove')
  assert.equal(bc.validate(s, 1, { flip: true }), 'games.err.badMove', 'người đã rời không lật được')
  assert.equal(bc.request(s, 2, { flip: true }), true)
  assert.equal(bc.request(s, 2, { out: true }), false)
  assert.equal(bc.apply(s, 2, { flip: true }).cards[2], null, '{ flip } chưa qua server không đổi bài')

  // Đúng kịch bản bước 6 của file kiểm 0092: người rời có 9 nút vẫn thua; nước sau khi xong bị bỏ qua.
  s = replay(bc, room, [...log, { seq: 7, seat: 2, move: { flip: true, cards: [13, 17, 21] } }, { seq: 8, seat: 0, move: { out: true } }])
  assert.equal(s.over, true)
  assert.deepEqual(bc.result(s), { winners: [0], draw: false, ranks: [0, 2, 1], scores: { 0: 2, 1: -1, 2: -1 } })
  assert.equal(bc.validate(s, 0, { out: true }), 'games.err.over')

  // Người rời khi CHƯA lật không làm kẹt ván: hai người còn lại lật xong là hết.
  const early = replay(bc, room, [log[0], { seq: 2, seat: 2, move: { out: true } }, log[1], log[3]])
  assert.equal(early.over, true, 'người rời chưa lật không được giữ ván chờ mãi')
  assert.deepEqual(bc.result(early).ranks, [1, 0, 2])

  // Chỉ còn một người chưa lật, mọi người kia rời → người đó thắng, không điểm (0092 cùng kiểu).
  const lone = replay(bc, room, [log[0], { seq: 2, seat: 0, move: { out: true } }, { seq: 3, seat: 1, move: { out: true } }])
  assert.deepEqual(bc.result(lone), { winners: [2], draw: false })
}

/* ---------- Chia: chỉ ghế 0 ghi, đúng 2..8 người, chỉ một lần ---------- */
{
  const s0 = bc.setup({})
  assert.equal(bc.validate(s0, 0, { deal: { n: 2 } }), null)
  assert.equal(bc.validate(s0, 1, { deal: { n: 2 } }), 'games.err.badMove')
  assert.equal(bc.validate(s0, 0, { deal: { n: 9 } }), 'games.err.badMove')
  assert.equal(bc.validate(s0, 0, { flip: true }), 'games.err.badMove', 'chưa chia chưa lật được')
  const s1 = bc.apply(s0, 0, { deal: { n: 2 } })
  assert.equal(bc.validate(s1, 0, { deal: { n: 2 } }), 'games.err.badMove')
  assert.ok(HAND * bc.maxPlayers <= DECK)
}

/* ---------- Bộ ván mẫu chung với file kiểm 0092 ---------- */
const check = readFileSync(new URL('../../../supabase/manual/0092_games_bacay_check.sql', import.meta.url), 'utf8')
const fx = JSON.parse(check.match(/v_fx\s+jsonb := \$bc\$(.*?)\$bc\$;/s)[1])
assert.ok(fx.length >= 20, 'bộ mẫu quá ít')
for (const f of fx) {
  assert.ok(f.hands.flat().every((x) => x >= 0 && x < DECK), 'ván mẫu có lá ngoài bộ 36: ' + f.name)
  assert.deepEqual(scoreOf(f.hands, f.out), f.result, 'lệch luật JS ở ván mẫu: ' + f.name)
}
assert.ok(fx.some((f) => f.out.some(Boolean)), 'bộ mẫu phải có người rời')
assert.ok(new Set(fx.map((f) => f.hands.length)).size >= 7, 'bộ mẫu phải phủ đủ 2..8 người')
assert.ok(fx.some((f) => nutOf(f.hands[f.result.winners[0]]) === nutOf(f.hands[f.result.ranks[1]])), 'bộ mẫu phải có ván bằng nút so lá')

/* ---------- SQL 0092 chép đúng hằng số ---------- */
{
  const sql = readFileSync(new URL('../../../supabase/migrations/0092_games_bacay.sql', import.meta.url), 'utf8')
  assert.match(sql, /\(ARRAY\[1, 0, 3, 2\]\)\[\(x & 3\) \+ 1\] \* 9 \+ CASE WHEN \(x >> 2\) = 0 THEN 8 ELSE \(x >> 2\) - 1 END/, 'độ to lá phải khớp powerOf')
  assert.match(sql, /sum\(\(x >> 2\) \+ 1\) % 10 AS nut/, 'nút phải khớp nutOf')
  assert.match(sql, /generate_series\(0, 35\) c ORDER BY random\(\)/, 'chia từ bộ 36 lá')
  assert.match(sql, /CASE WHEN i = v_w THEN v_n - 1 ELSE -1 END/, 'người thắng ăn mỗi người 1 — khớp PAY')
  assert.match(sql, /IS DISTINCT FROM '\{"flip": true\}'::jsonb THEN RAISE EXCEPTION 'games\.err\.badMove'/)
  assert.match(sql, /RAISE EXCEPTION 'games\.err\.flipped'/)
  assert.match(sql, /> 8 THEN\s+RAISE EXCEPTION 'games\.err\.badCount'/, 'chặn quá 8 người khi chia')
}

console.log('bacay check: OK')
