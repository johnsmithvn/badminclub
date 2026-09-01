// node --test — Khách giao lưu: bảng giá và công nợ.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  guestPaidRev, guestRev, sGuests, sGuestsOnly, headCount, adhocCharges, sessionOf, costRow,
  guestDebtRows, guestPrice,
} from '#lib/money.js'

const db = seed()
/* ---------- giá khách giao lưu ---------- */
assert.equal(guestPrice(db, 'Newbie', 'nam'), 60000)
assert.equal(guestPrice(db, 'Newbie', 'nu'), 50000)
assert.equal(guestPrice(db, 'TB', 'nam'), 75000)
assert.equal(guestPrice(db, 'TB', 'nu'), 60000)
assert.equal(guestPrice(db, 'trình độ lạ', 'nam'), 0, 'không có bảng giá thì 0, không NaN')

/* ---------- công nợ khách ---------- */
const debts = guestDebtRows(db, '2026-08')
assert.ok(debts.length > 0)
assert.ok(
  debts.every((r, i, arr) => i === 0 || arr[i - 1].debt >= r.debt),
  'sắp theo nợ giảm dần'
)
const k1 = debts.find((r) => r.guest.id === 'K1')
assert.equal(k1.sessions, 4, 'K1 đi B1, B3, B5, B7')
assert.equal(k1.paidAmt + k1.debt, k1.rows.reduce((t, x) => t + x.price, 0), 'đã trả + còn nợ = tổng')
assert.deepEqual(guestDebtRows(db, '2030-01'), [], 'tháng không có khách thì rỗng')

/* ---------- thu khách: tổng vs ĐÃ thu ---------- */
// Hai con số khác nhau, trộn là ra "khách còn nợ" âm. `guestRev` = tổng phải thu của buổi;
// `guestPaidRev` = phần đã vào tay. Hiệu hai cái mới là nợ.
const sid = db.sessionGuests[0].sessionId
const all = sGuests(db, sid)
assert.equal(guestRev(db, sid), all.reduce((x, g) => x + g.price, 0))
assert.equal(guestPaidRev(db, sid), all.filter((g) => g.paid).reduce((x, g) => x + g.price, 0))
assert.ok(guestPaidRev(db, sid) <= guestRev(db, sid), 'đã thu không bao giờ vượt tổng phải thu')
assert.equal(guestRev(db, 'buổi-không-có'), 0, 'buổi không tồn tại thì 0, không NaN')
assert.equal(guestPaidRev(db, 'buổi-không-có'), 0)

/* ---------- buổi ĐỘT XUẤT: ai đi nấy trả theo giá giao lưu ---------- */
// Buổi ngoài lịch cố định không nằm trong gói quỹ tháng của ai. Không thu thì quỹ gánh trọn
// tiền sân + tiền cầu của mọi buổi lẻ, và không màn nào lộ ra chuyện đó.

const adhoc = {
  id: 'ADH1', date: '2026-08-12', groupId: 'ALL', status: 'open', shuttleUsed: 0,
  shuttleTypeId: 'S1', note: '', courts: [], scheduleId: null,
}
const dbA = {
  ...db,
  sessions: db.sessions.concat([adhoc]),
  attendance: { ...db.attendance, ADH1: { M1: true, M5: false } },
}

// Buổi của LỊCH CỐ ĐỊNH không sinh khoản nào: người cố định đã đóng trọn gói tháng rồi, thu
// thêm theo lượt là thu HAI LẦN trên cùng một buổi.
assert.deepEqual(
  adhocCharges(dbA, sessionOf(dbA, 'B1'), dbA.attendance.B1),
  { add: [], remove: [] },
  'thu theo lượt ở buổi cố định là thu hai lần trên cùng một buổi'
)

const c1 = adhocCharges(dbA, adhoc, dbA.attendance.ADH1)
assert.equal(c1.add.length, 1, 'chỉ người CÓ MẶT mới sinh khoản thu; người vắng thì không')
assert.equal(c1.add[0].memberId, 'M1')
assert.equal(c1.add[0].guestId, null, 'dòng của thành viên phải để guest_id NULL — CHECK ở migration 0003')
assert.equal(c1.add[0].price, 60000,
  'M1 nữ TB- phải lấy GIÁ GIAO LƯU 60.000, không phải đơn giá chia từ quỹ tháng')
assert.equal(c1.add[0].paid, false, 'sinh ra là còn nợ, thu hay không là thao tác riêng')

// Gọi lại sau mỗi lần chạm điểm danh — không được đẻ dòng thứ hai cho cùng một người, không thì
// bấm qua bấm lại là thu gấp đôi.
const row = {
  id: 'SGM1', sessionId: 'ADH1', memberId: 'M1', guestId: null,
  level: 'TB-', gender: 'nu', price: 60000, paid: false, invitedBy: '',
}
const withRow = { ...dbA, sessionGuests: dbA.sessionGuests.concat([row]) }
const c2 = adhocCharges(withRow, adhoc, withRow.attendance.ADH1)
assert.equal(c2.add.length, 0, 'đã có dòng thu rồi thì không sinh thêm')
assert.deepEqual(c2.remove, [])

assert.deepEqual(adhocCharges(withRow, adhoc, { M1: false }).remove, ['SGM1'],
  'bỏ Có mặt mà CHƯA thu thì gỡ khoản, không để lại một khoản nợ ma')

const paidRow = { ...withRow, sessionGuests: withRow.sessionGuests.map((g) => (g.id === 'SGM1' ? { ...g, paid: true } : g)) }
assert.deepEqual(adhocCharges(paidRow, adhoc, { M1: false }).remove, [],
  'tiền ĐÃ vào quỹ thì bỏ tick điểm danh không được làm nó bốc hơi khỏi sổ')

// Một người, một đầu người. M1 vừa có ô điểm danh vừa có dòng thu — đếm cả hai là "chi phí mỗi
// người" tụt còn một nửa, và đó là con số CLB dùng để quyết có tăng quỹ hay không.
assert.equal(sGuestsOnly(withRow, 'ADH1').length, 0, 'dòng thu của thành viên KHÔNG phải khách')
assert.equal(sGuests(withRow, 'ADH1').length, 1)
assert.equal(headCount(withRow, adhoc), 1, 'M1 có mặt + có dòng thu vẫn là MỘT người')
assert.equal(costRow(withRow, adhoc).people, 1,
  'chi phí mỗi người chia cho đúng 1 — đếm thành 2 là con số quyết định tăng quỹ sai một nửa')
assert.equal(guestRev(withRow, 'ADH1'), 60000, 'thu của thành viên vẫn là tiền vào của buổi đó')

console.log('money/guest check: OK')
