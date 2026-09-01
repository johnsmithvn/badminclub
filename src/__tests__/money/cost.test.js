// node --test — Giá thành một buổi (Tầng B): tính live · đóng băng khi chốt · cảnh báo trước và sau.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  closeWarnings, costDrift, costRow, costState, courtNet, freezeCost,
  presentCount, sGuests, sessionCost, sessionOf, shuttleUnit, soldTotal,
  unfrozenCost,
} from '#lib/money.js'

const db = seed()
const S = (id) => sessionOf(db, id)
// Giá bình quân một quả — chính con số mà shuttle.test.js khoá; ở đây chỉ dùng lại.
const unit = shuttleUnit(db)
/* ---------- giá thành một buổi ---------- */
const cr = costRow(db, S('B1'))
assert.equal(cr.people, presentCount(db, S('B1')) + 6, 'B1 có 6 khách')
assert.equal(cr.cost, courtNet(db, S('B1')) + 34 * unit)
assert.equal(cr.subsidy, cr.cost - cr.rev, 'quỹ bù = chi phí − thu khách')
assert.equal(cr.per, cr.cost / cr.people)
assert.equal(sessionCost(db, S('B1')), cr.cost)
// buổi không ai đi thì chia cho 1, không ra Infinity
const empty = { ...S('B9'), shuttleUsed: 0 }
assert.ok(Number.isFinite(costRow({ ...db, attendance: {} }, empty).per))

/* ---------- quỹ bù KHÔNG trừ tiền bán sân ---------- */
// B3 bán 1 sân 240.000. courtNet đã loại sân đó khỏi chi phí rồi — trừ thêm soldAmount nữa là
// tính lợi ích bán sân hai lần. Card chi tiết buổi và bảng Báo cáo phải ra CÙNG một con số.
const b3 = S('B3')
assert.ok(soldTotal(b3) > 0, 'B3 có bán sân')
const c3 = costRow(db, b3)
assert.equal(c3.cost, courtNet(db, b3) + b3.shuttleUsed * unit, 'chi phí = courtNet + tiền cầu')
assert.equal(c3.subsidy, c3.cost - c3.rev, 'quỹ bù = chi phí − thu khách, KHÔNG trừ tiền bán sân')
assert.notEqual(c3.subsidy, c3.cost - c3.rev - soldTotal(b3), 'công thức cũ của SessionDetail là sai')

/* ---------- ĐÓNG BĂNG giá thành: số của buổi đã chốt không được trôi ---------- */

const b1 = S('B1')
const live1 = costRow(db, b1)
assert.equal(live1.frozen, false)

// Đóng băng phải cho ra ĐÚNG con số đang hiện trên màn hình lúc chốt.
const frozen1 = { ...b1, ...freezeCost(db, b1, '2026-08-02') }
const read1 = costRow(db, frozen1)
assert.equal(read1.frozen, true)
;['people', 'cost', 'rev', 'court', 'shuttle', 'unit', 'per', 'subsidy'].forEach((k) => {
  assert.equal(read1[k], live1[k], 'đóng băng làm lệch ' + k)
})

// Mua thêm một đợt cầu giá khác → giá bình quân toàn kho đổi.
const dbNew = {
  ...db,
  purchases: db.purchases.concat([{
    id: 'P9', date: '2026-09-01', typeId: 'S1', tubes: 10, extra: 0, qty: 120,
    pricePerTube: 400000, total: 4000000, payer: '', note: '',
  }]),
}
assert.notEqual(shuttleUnit(dbNew), shuttleUnit(db), 'đợt mua mới phải làm đổi giá bình quân')

// Buổi CHƯA đóng băng thì trôi theo giá mới — đây chính là cái issue muốn chặn.
assert.notEqual(costRow(dbNew, b1).cost, live1.cost, 'buổi chưa đóng băng thì trôi, đúng như cũ')
// Buổi ĐÃ đóng băng thì đứng yên, kể cả tiền cầu và giá một quả.
assert.equal(costRow(dbNew, frozen1).cost, live1.cost, 'buổi đã đóng băng KHÔNG được đổi số')
assert.equal(costRow(dbNew, frozen1).shuttle, live1.shuttle)
assert.equal(costRow(dbNew, frozen1).unit, live1.unit, 'giá một quả lúc đó phải giữ lại được')

// Chủ sân tăng giá cũng vậy.
const dbPricier = { ...db, courts: db.courts.map((c) => ({ ...c, price: c.price * 2 })) }
assert.notEqual(costRow(dbPricier, b1).court, live1.court, 'buổi chưa đóng băng thì theo giá sân mới')
assert.equal(costRow(dbPricier, frozen1).court, live1.court, 'buổi đã đóng băng giữ giá sân lúc chốt')

// Mở lại buổi → quay về tính live.
const reopened = { ...frozen1, ...unfrozenCost() }
assert.equal(costRow(dbNew, reopened).cost, costRow(dbNew, b1).cost, 'mở lại buổi thì số phải sống lại')

/* ---------- ba trạng thái của con số giá thành ---------- */

assert.equal(costState(b1), 'live', 'chưa đóng băng')
assert.equal(costState({ ...b1, costFrozenAt: '2026-08-02', shuttleEst: true }), 'temp', 'chờ kiểm kho')
assert.equal(costState({ ...b1, costFrozenAt: '2026-08-02', shuttleEst: false }), 'final', 'số chốt')
assert.equal(costState(reopened), 'live', 'mở lại buổi thì về live')

/* ---------- chốt buổi: cảnh báo trước (closeWarnings) ---------- */

const B6 = S('B6')
const wKeys = (x, s2) => closeWarnings(x, s2).map((w) => w.key)
// Fixture ĐÃ điểm danh B6 (6 có mặt, 1 vắng) → không nhắc gì.
assert.deepEqual(wKeys(db, B6), [], 'buổi đã điểm danh thì im')
assert.deepEqual(wKeys(db, S('B1')), [])

// Chưa điểm danh ai: bảng rỗng.
const noAtt = { ...db, attendance: { ...db.attendance, B6: {} } }
assert.deepEqual(wKeys(noAtt, B6), ['noAttend'], 'chưa điểm danh ai')
// Buổi chưa có bản ghi điểm danh nào cũng thế (B9 còn draft).
assert.deepEqual(wKeys(db, S('B9')), ['noAttend'])

// Đánh vắng TẤT CẢ cũng là chưa ai đi — số người 0, giá thành vô nghĩa.
const allAbsent = { ...db, attendance: { ...db.attendance, B6: { M2: false, M3: false } } }
assert.deepEqual(wKeys(allAbsent, B6), ['noAttend'])
// Một người 'extra' (đi thêm) cũng tính là có mặt.
const oneExtra = { ...db, attendance: { ...db.attendance, B6: { M2: 'extra' } } }
assert.deepEqual(wKeys(oneExtra, B6), [])

// Sân đánh dấu bán mà ô tiền để trống — hai ô chỏi nhau.
const soldNoAmt = { ...B6, courts: B6.courts.map((c, i) => (i === 0 ? { ...c, sold: true, soldAmount: 0 } : c)) }
assert.deepEqual(wKeys(db, soldNoAmt), ['soldBlank'])
// Có tiền bán rồi thì không nhắc.
const soldOk = { ...soldNoAmt, courts: soldNoAmt.courts.map((c) => (c.sold ? { ...c, soldAmount: 240000 } : c)) }
assert.deepEqual(wKeys(db, soldOk), [])
// Hai lỗi cùng lúc thì hiện cả hai, đúng thứ tự.
assert.deepEqual(wKeys(noAtt, soldNoAmt), ['noAttend', 'soldBlank'])
assert.deepEqual(closeWarnings(noAtt, soldNoAmt)[1], { key: 'soldBlank', n: 1 })
assert.deepEqual(closeWarnings(db, null), [], 'không có buổi thì không throw')

/* ---------- chốt buổi: cảnh báo sau (costDrift) ---------- */

// Buổi chưa chốt thì không có gì để lệch.
assert.equal(costDrift(db, B6), null)

// Chốt B1 rồi so lại chính nó: không lệch.
const frozenB1 = { ...S('B1'), ...freezeCost(db, S('B1'), '2026-08-02') }
const dbF = { ...db, sessions: db.sessions.map((x) => (x.id === 'B1' ? frozenB1 : x)) }
assert.equal(costDrift(dbF, frozenB1), null, 'vừa chốt xong thì không lệch')

// Sửa điểm danh sau khi chốt → lệch số người.
const lessAttend = { ...dbF, attendance: { ...dbF.attendance, B1: { M2: true } } }
const dHeads = costDrift(lessAttend, frozenB1)
assert.equal(dHeads.length, 1)
assert.equal(dHeads[0].key, 'heads')
assert.equal(dHeads[0].was, frozenB1.costHeads)
assert.equal(dHeads[0].now, 1 + sGuests(db, 'B1').length)

// Sửa số cầu sau khi chốt → lệch số cầu, và `was` suy đúng từ tiền cầu ÷ đơn giá đã lưu.
const moreShuttle = { ...frozenB1, shuttleUsed: frozenB1.shuttleUsed + 6 }
const dQty = costDrift({ ...dbF, sessions: dbF.sessions.map((x) => (x.id === 'B1' ? moreShuttle : x)) }, moreShuttle)
assert.equal(dQty.length, 1)
assert.equal(dQty[0].key, 'shuttle')
assert.equal(dQty[0].was, S('B1').shuttleUsed)
assert.equal(dQty[0].now, S('B1').shuttleUsed + 6)

// GIÁ cầu đổi (mua đợt mới đắt hơn) mà KHÔNG ai sửa buổi → KHÔNG được cảnh báo.
// Đây đúng là thứ đóng băng sinh ra để chống; cảnh báo ở đây là nhắc oan mỗi lần nhập kho.
const pricier = {
  ...dbF,
  purchases: dbF.purchases.concat([{
    id: 'PX', date: '2026-08-20', typeId: 'S1', tubes: 10, extra: 0, qty: 120,
    pricePerTube: 900000, total: 9000000, payer: '', note: '',
  }]),
}
assert.ok(shuttleUnit(pricier) > shuttleUnit(db), 'đơn giá cầu đã tăng thật')
assert.equal(costDrift(pricier, frozenB1), null, 'giá đổi KHÔNG phải lệch dữ liệu buổi')

// Thêm khách sau khi chốt → lệch thu khách.
const moreGuest = {
  ...dbF,
  sessionGuests: dbF.sessionGuests.concat([{
    id: 'SGX', sessionId: 'B1', guestId: dbF.guests[0].id, level: dbF.levels[0],
    gender: 'nam', price: 70000, paid: false, invitedBy: 'M2',
  }]),
}
const dRev = costDrift(moreGuest, frozenB1).map((x) => x.key).sort()
assert.deepEqual(dRev, ['heads', 'rev'], 'thêm khách đổi cả đầu người lẫn thu khách')

console.log('money/cost check: OK')
