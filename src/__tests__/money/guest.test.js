// node --test — Khách giao lưu: bảng giá và công nợ.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  guestPaidRev, guestRev, sGuests,
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

console.log('money/guest check: OK')
