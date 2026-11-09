// node src/__tests__/games/phom.test.js
// Luật Phỏm (lib/games/phom.js): phần công khai máy khách dựng lại từ log + trọng tài / chấm điểm (bản JS của server 0090).
// Sai ở đây là cho ăn bậy, chặn nhầm nước đúng, lệch lượt hạ khi chuyển bài, hay chấm sai người về Nhất / đền nhầm người.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ph, { bestLay, cover, dealMove, judge, khanOf, meldOk, meldsIn, pendingOf, referee, sendsFor, uOf } from '#lib/games/phom.js'

// Lá c = hạng * 4 + chất (hạng 0 = A … 12 = K; chất 0 ♠ · 1 ♣ · 2 ♦ · 3 ♥).
const C = (r, s) => r * 4 + s

// Phỏm: bộ cùng số, dây cùng chất liên tiếp; A thấp nhất, không vòng.
{
  assert.equal(meldOk([C(6, 0), C(6, 1), C(6, 3)]), true, 'ba lá 7 là phỏm ngang')
  assert.equal(meldOk([C(6, 0), C(6, 1), C(6, 2), C(6, 3)]), true, 'bốn lá cùng số')
  assert.equal(meldOk([C(0, 2), C(1, 2), C(2, 2)]), true, 'A-2-3 cùng chất là dây')
  assert.equal(meldOk([C(11, 2), C(12, 2), C(0, 2)]), false, 'Q-K-A không được — A chỉ là 1')
  assert.equal(meldOk([C(4, 0), C(5, 1), C(6, 0)]), false, 'dây phải cùng chất')
  assert.equal(meldOk([C(4, 0), C(6, 0), C(7, 0)]), false, 'dây phải liền')
  assert.equal(meldOk([C(4, 0), C(5, 0)]), false, 'ít nhất 3 lá')
  assert.equal(meldsIn([C(6, 0), C(6, 1), C(6, 2), C(6, 3)]).length, 5, 'bộ tứ cho 1 phỏm 4 lá + 4 phỏm 3 lá')
}

// Xếp lá ăn: mỗi lá ăn một phỏm riêng, không dùng chung lá trên tay.
{
  assert.equal(cover([C(6, 1), C(6, 2)], [C(6, 0)]), true)
  assert.equal(cover([C(5, 0), C(7, 0)], [C(6, 0)]), true, 'dây kẹp giữa')
  assert.equal(cover([C(6, 1)], [C(6, 0)]), false, 'thiếu một lá thì không ăn được')
  // Hai lá ăn 7♠ và 7♣ chỉ có 7♦ 7♥ trên tay: phải ghép chung một bộ → cấm (một phỏm không chứa hai lá ăn).
  assert.equal(cover([C(6, 2), C(6, 3)], [C(6, 0), C(6, 1)]), false)
  assert.equal(cover([C(6, 2), C(6, 3), C(5, 1), C(4, 1)], [C(6, 0), C(6, 1)]), true, '7♣ đi dây 5♣6♣7♣, 7♠ đi bộ')
}

// Ù khan: không đôi, không cạ (cùng chất cách ≤ 2).
{
  assert.equal(khanOf([C(0, 0), C(3, 0), C(6, 0), C(9, 0), C(1, 1), C(4, 1), C(7, 1), C(2, 2), C(5, 2), C(8, 2)]), true)
  assert.equal(khanOf([C(0, 0), C(2, 0), C(9, 1)]), false, 'A♠ 3♠ là cạ (chờ 2♠)')
  assert.equal(khanOf([C(0, 0), C(0, 1)]), false, 'đôi')
}

// Gợi ý hạ / ù / gửi.
{
  const hand = [C(6, 0), C(6, 1), C(6, 2), C(2, 3), C(3, 3), C(4, 3), C(12, 0), C(12, 1), C(10, 2)]
  const lay = bestLay(hand)
  assert.deepEqual(lay.flat().sort((a, b) => a - b), [C(2, 3), C(3, 3), C(4, 3), C(6, 0), C(6, 1), C(6, 2)].sort((a, b) => a - b))
  assert.equal(uOf([...hand.slice(0, 6), C(12, 2), C(12, 0), C(12, 1), C(10, 2)]) != null, true, '9 lá thành phỏm + 1 lá đánh là ù')
  assert.deepEqual(sendsFor([C(5, 3), C(9, 0)], [null, [[C(2, 3), C(3, 3), C(4, 3)]]], 0), [[1, 0, C(5, 3)]], 'lá nối dây người khác thì gửi')
}

// Nước chia + chuyển bài: Q ăn của P → lá trên cùng chồng Q sang chồng P, Q đánh thêm lượt (hạ muộn hơn).
{
  const deal = { deal: { first: 0, n: [10, 9], stock: 33, khan: null } }
  let s = ph.apply(ph.setup(), 0, deal)
  assert.deepEqual([s.turn, s.step], [0, 'discard'], 'người đi đầu lượt đầu chỉ đánh')
  const go = (seat, move) => {
    assert.equal(ph.validate(s, seat, move), null, JSON.stringify(move) + ' của ghế ' + seat + ' phải hợp lệ')
    s = ph.apply(s, seat, move)
  }
  go(0, { discard: 40 })
  go(1, { eat: 40 })
  assert.deepEqual(s.piles, [[], []], 'người ăn chưa có lá nào thì không chuyển — chồng người bị ăn thiếu một')
  go(1, { discard: 41 })
  go(0, { draw: true })
  go(0, { discard: 42 })
  go(1, { eat: 42 })
  assert.deepEqual(s.piles, [[41], []], 'lá trên cùng chồng người ăn chuyển sang chồng người bị ăn')
  assert.equal(s.eaten.length, 2)
  assert.equal(ph.validate(s, 1, { discard: 40 }), 'games.err.keepEaten', 'không được đánh lá đã ăn')
  // Chồng đủ 3 lá thì tới lượt (sau khi ăn / bốc) phải hạ.
  const t = { ...s, piles: [[1, 2, 3], [4]], turn: 0, step: 'take', last: { seat: 1, card: 5, chot: false } }
  assert.equal(ph.apply(t, 0, { draw: true }).step, 'lay')
  assert.equal(ph.apply({ ...t, piles: [[1, 2], [4]] }, 0, { draw: true }).step, 'discard')
}

// Chấm điểm.
{
  const base = (n) => ({ ...ph.apply(ph.setup(), 0, { deal: { first: 0, n: [10, ...Array(n - 1).fill(9)], stock: 52 - 10 - 9 * (n - 1), khan: null } }), over: true })
  // 4 người, không ai ù: ít điểm nhất về Nhất; bằng điểm ai hạ trước hơn; móm xếp sau; Nhì −1 Ba −2 Bét −3, móm −4.
  const s = { ...base(4), order: [2, 3, 0, 1], mom: [false, true, false, false] }
  const hands = [[C(4, 0)], [C(0, 0)], [C(4, 1)], [C(1, 0), C(2, 0)]] // điểm 5 · 1 (móm) · 5 · 5
  const r = judge(s, hands)
  assert.deepEqual(r.ranks, [2, 3, 0, 1], 'bằng 5 điểm: ghế 2 hạ trước ghế 3, ghế 3 trước ghế 0; móm xuống cuối dù 1 điểm')
  assert.deepEqual(r.scores, { 0: -2, 1: -4, 2: 7, 3: -1 })
  assert.deepEqual(r.points, { 0: 5, 1: 1, 2: 5, 3: 5 })
  // Ăn bài: 1 điểm, ăn chốt 4.
  const e = judge({ ...s, eaten: [{ card: 1, by: 0, from: 1, chot: false }, { card: 2, by: 3, from: 2, chot: true }] }, hands)
  assert.deepEqual(e.scores, { 0: -1, 1: -5, 2: 3, 3: 3 })
  // Ù: mỗi người trả 5; ù tròn 10; người ù ăn ≥ 3 lá của cùng một người → người đó đền cả làng.
  const u = { ...base(3), u: { seat: 1, tron: false, khan: false } }
  assert.deepEqual(judge(u, [[], [], []]).scores, { 0: -5, 1: 10, 2: -5 })
  assert.deepEqual(judge({ ...u, u: { ...u.u, tron: true } }, [[], [], []]).scores, { 0: -10, 1: 20, 2: -10 })
  const eaten = [1, 2, 3].map((card) => ({ card, by: 1, from: 0, chot: false }))
  assert.deepEqual(judge({ ...u, eaten }, [[], [], []]).scores, { 0: -13, 1: 13, 2: 0 }, 'ghế 0 bị ăn 3 lá rồi ghế 1 ù → ghế 0 đền thay ghế 2')
  // Người rời: xếp cuối, rời trước đứng dưới; vẫn trả theo chỗ của mình.
  const o = { ...base(4), out: [false, true, false, true], left: [3, 1], order: [0, 2] }
  const ro = judge(o, [[C(9, 0)], [], [C(0, 1)], []])
  assert.deepEqual(ro.ranks, [2, 0, 1, 3])
  assert.deepEqual(ro.scores, { 0: -1, 1: -2, 2: 6, 3: -3 })
  assert.deepEqual(ro.points, { 0: 10, 2: 1 }, 'người rời không có điểm rác')
  assert.equal(ph.result(s).pending, true, 'máy khách không biết bài người khác — chờ server chấm')
}

// Bộ ván mẫu chung với file kiểm 0090: trọng tài JS ghi đúng từng nước / báo đúng từng lỗi, chấm đúng kết quả; luật công
// khai nhận mọi nước đã ghi (không thì máy khách dựng lại ván lệch với server).
{
  const check = readFileSync('supabase/manual/0090_games_phom_check.sql', 'utf8').split('$ph$')
  assert.equal(check.length, 3, 'file kiểm 0090 phải có đúng một khối $ph$')
  const fixtures = JSON.parse(check[1])
  const seenErr = new Set()
  for (const f of fixtures) {
    assert.deepEqual(dealMove(f.hands, f.first, f.stock.length), f.deal, f.note + ': nước chia')
    let hands = f.hands.map((h) => h.slice())
    let stock = f.stock.slice()
    let pub = ph.apply(ph.setup(), f.first, f.deal)
    for (const st of f.steps) {
      if (st.out) { pub = ph.apply(pub, st.seat, { out: true }); continue }
      if (st.err) {
        assert.throws(() => referee(pub, hands, stock, st.seat, st.move), { message: st.err }, f.note + ': ' + JSON.stringify(st.move))
        seenErr.add(st.err)
        continue
      }
      const r = referee(pub, hands, stock, st.seat, st.move)
      assert.deepEqual(r.move, st.log, f.note + ': nước ghi của ' + JSON.stringify(st.move))
      assert.equal(ph.validate(pub, st.seat, r.move), null, f.note + ': máy khách phải nhận nước đã ghi ' + JSON.stringify(r.move))
      hands = r.hands
      stock = r.stock
      pub = ph.apply(pub, st.seat, r.move)
      pub.counts.forEach((k, i) => assert.equal(k, hands[i].length, f.note + ': số lá công khai ≠ bài thật'))
    }
    assert.equal(pub.over, true, f.note + ': ván mẫu phải xong')
    assert.deepEqual(judge(pub, hands), f.result, f.note + ': chấm khác kết quả ghi trong file kiểm 0090')
    assert.equal(Object.values(f.result.scores).reduce((a, b) => a + b, 0), 0, f.note + ': điểm phải cộng lại bằng 0')
  }
  for (const k of ['badMove', 'over', 'notYourTurn', 'nothingToEat', 'cantEat', 'notYourCard', 'keepEaten', 'badMeld', 'eatenMeld', 'momSend', 'badSend', 'notU']) {
    assert.ok(seenErr.has('games.err.' + k), 'bộ ván mẫu phải có nước rác báo ' + k)
  }
  // Đủ loại ván: ù khan / ù tròn / ù thường / đền · ăn chốt · gửi bài · móm · hạ lệch thứ tự vì chuyển bài · có người rời.
  for (const want of ['ù khan', 'ù tròn', 'ù thường', 'đền', 'chot', 'send', 'mom', 'shift', 'out']) {
    assert.ok(fixtures.some((f) => f.note.includes(want)), 'bộ ván mẫu phải có ván "' + want + '"')
  }
  assert.deepEqual([...new Set(fixtures.map((f) => f.hands.length))].sort(), [2, 3, 4], 'đủ ván 2, 3, 4 người')
}

// Server (0090) dùng cùng giá điểm và mã lỗi.
{
  const sql = readFileSync('supabase/migrations/0090_games_phom.sql', 'utf8')
  assert.ok(sql.includes('WHEN r.o_echot[i] THEN 4 ELSE 1'), 'giá ăn bài / ăn chốt SQL ≠ JS')
  assert.ok(sql.includes("WHEN (r.o_u ->> 'tron')::boolean THEN 10 ELSE 5"), 'giá ù / ù tròn SQL ≠ JS')
  assert.ok(sql.includes('WHEN r.o_mom[x + 1] THEN 4 WHEN i = r.o_n THEN 3 ELSE i - 1'), 'giá hạng / móm SQL ≠ JS')
  for (const k of ['badMove', 'over', 'notYourTurn', 'pileEmpty', 'nothingToEat', 'cantEat', 'notYourCard', 'keepEaten', 'badMeld', 'eatenMeld', 'momSend', 'badSend', 'notU']) {
    assert.ok(sql.includes("'games.err." + k + "'"), '0090 phải dùng mã lỗi ' + k)
  }
  void pendingOf
}

console.log('phom check: OK')
