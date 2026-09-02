// node --test — Test toàn diện cho Khách giao lưu, Chuẩn hoá tên, Thống kê khách và Người đi kèm (+1 Companion)

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  normalizeText, guestStats, headCount, guestRev, sessionOf, sGuestsOnly, costRow,
} from '#lib/money.js'
import { guestForm } from '#lib/forms.js'

const db = seed()

/* ==========================================================================
   1. TEST CHUẨN HOÁ TÊN TIẾNG VIỆT (normalizeText)
   ========================================================================== */
assert.equal(normalizeText('Nguyễn Văn Thắng'), 'nguyen van thang')
assert.equal(normalizeText('  ĐẶNG   THỊ   MỸ   DUYÊN  '), 'dang thi my duyen')
assert.equal(normalizeText('Trần Đức Bo'), 'tran duc bo')
assert.equal(normalizeText('Lê Minh Thắng 99'), 'le minh thang 99')
assert.equal(normalizeText(''), '')
assert.equal(normalizeText(null), '')
assert.equal(normalizeText(undefined), '')
assert.equal(normalizeText('Đạt G'), 'dat g')
assert.equal(normalizeText('Phạm Đăng Khôi'), 'pham dang khoi')
assert.equal(normalizeText('Út Ơi'), 'ut oi')

/* ==========================================================================
   2. TEST THỐNG KÊ HOẠT ĐỘNG CỦA KHÁCH (guestStats)
   ========================================================================== */
// Test khách chưa từng đi buổi nào (0 buổi)
const emptyGuestDb = {
  ...db,
  guests: db.guests.concat([{ id: 'G_NEWBIE', name: 'Khách Mới', gender: 'nam', level: 'Y' }]),
}
const stNewbie = guestStats(emptyGuestDb, 'G_NEWBIE')
assert.equal(stNewbie.sessionCount, 0, 'Khách mới có 0 buổi')
assert.equal(stNewbie.isRegular, false, '0 buổi không phải khách quen')
assert.equal(stNewbie.lastSession, null, 'Chưa có ngày gần nhất')
assert.equal(stNewbie.totalPaid, 0)
assert.equal(stNewbie.totalDebt, 0)

// Test khách đi 1 buổi
const oneSessionDb = {
  ...emptyGuestDb,
  sessionGuests: emptyGuestDb.sessionGuests.concat([{
    id: 'SG_ONCE', sessionId: 'B1', guestId: 'G_NEWBIE', level: 'Y', gender: 'nam',
    price: 50000, paid: false, invitedBy: 'M1',
  }]),
}
const stOnce = guestStats(oneSessionDb, 'G_NEWBIE')
assert.equal(stOnce.sessionCount, 1)
assert.equal(stOnce.isRegular, false, '1 buổi chưa phải khách quen')
assert.equal(stOnce.totalDebt, 50000)
assert.equal(stOnce.totalPaid, 0)
assert.equal(stOnce.topInviter?.name, 'Thúy')

// Test khách đi ≥ 3 buổi (khách quen)
const regularGuestDb = {
  ...oneSessionDb,
  sessionGuests: oneSessionDb.sessionGuests.concat([
    { id: 'SG_ONCE_2', sessionId: 'B2', guestId: 'G_NEWBIE', level: 'Y', gender: 'nam', price: 50000, paid: true, invitedBy: 'M1' },
    { id: 'SG_ONCE_3', sessionId: 'B3', guestId: 'G_NEWBIE', level: 'Y', gender: 'nam', price: 50000, paid: true, invitedBy: 'M2' },
  ]),
}
const stRegular = guestStats(regularGuestDb, 'G_NEWBIE')
assert.equal(stRegular.sessionCount, 3)
assert.equal(stRegular.isRegular, true, '≥ 3 buổi là khách quen')
assert.equal(stRegular.totalPaid, 100000)
assert.equal(stRegular.totalDebt, 50000)
assert.equal(stRegular.topInviter?.count, 2, 'M1 rủ 2 lần là top inviter')

/* ==========================================================================
   3. TEST KHÁCH KÈM BẠN (+1 COMPANION) VÀ ĐẦU NGƯỜI
   ========================================================================== */
const testSessionId = 'B1'
const companionTestDb = {
  ...db,
  guests: db.guests.concat([
    { id: 'G_LEADER', name: 'Đức Hoàng', gender: 'nam', level: 'TB', phone: '0988776655', note: 'Đặt sân 2 người' },
    { id: 'G_FRIEND', name: 'Bạn Đức Hoàng', gender: 'nu', level: 'Y', phone: '', note: 'Đi cùng Đức Hoàng', companionOf: 'G_LEADER' },
  ]),
  sessionGuests: db.sessionGuests.concat([
    { id: 'SG_L1', sessionId: testSessionId, guestId: 'G_LEADER', level: 'TB', gender: 'nam', price: 75000, paid: false, invitedBy: null },
    { id: 'SG_F1', sessionId: testSessionId, guestId: 'G_FRIEND', level: 'Y', gender: 'nu', price: 50000, paid: false, invitedBy: null, companionOf: 'G_LEADER' },
  ]),
}

// 1. Kiểm tra headCount phải đếm cả 2 người
const s1 = sessionOf(companionTestDb, testSessionId)
const guestsInSession = sGuestsOnly(companionTestDb, testSessionId)
assert.ok(guestsInSession.some((g) => g.guestId === 'G_LEADER'))
assert.ok(guestsInSession.some((g) => g.guestId === 'G_FRIEND'))

const totalHeads = headCount(companionTestDb, s1)
assert.ok(totalHeads >= 2, 'headCount phải tính cả 2 người chơi trên sân')

// 2. Kiểm tra tổng doanh thu khách bao gồm cả 2 suất
const totalGuestRev = guestRev(companionTestDb, testSessionId)
assert.ok(totalGuestRev >= 125000, 'Doanh thu khách gồm 75k (Leader) + 50k (Friend)')

// 3. Kiểm tra chi phí tính đúng số đầu người
const cost = costRow(companionTestDb, s1)
assert.equal(cost.people, totalHeads, 'Số người trong costRow phải bằng headCount')

/* ==========================================================================
   4. TEST FORM KHÁCH VÀ CẤU TRÚC KHỞI TẠO (guestForm)
   ========================================================================== */
const gf = guestForm(db)
assert.equal(gf.gHasCompanion, false)
assert.equal(gf.gCompanionName, '')
assert.equal(gf.gCompanionGender, 'nu')
assert.ok(gf.gCompanionLevel)

console.log('companion_guest check: OK')
