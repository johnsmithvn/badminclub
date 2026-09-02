// node --test — Thành viên tự khai đã chuyển tiền: khoản nào được phép khai, khoản nào không.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import { myDebts, myMember } from '#lib/money.js'

const base = seed()
const M = '2026-08'
const kinds = (list) => list.map((x) => x.kind + ':' + x.id)

/* ---------- myMember: tài khoản ↔ bản ghi thành viên ---------- */

assert.equal(myMember(base).id, 'M1', 'fixture ghép U1 với M1')
assert.equal(myMember({ ...base, currentUserId: null }), null,
  'chưa đăng nhập thì không có bản ghi nào — không được đoán bừa ra một người để hiện nợ của họ')
assert.equal(myMember({ ...base, currentUserId: 'U-khong-co' }), null,
  'tài khoản chưa ghép vào CLB phải trả null, không phải người đầu danh sách')

/* ---------- quỹ tháng ---------- */

// M1 trong fixture đã đóng đủ → không còn nợ gì ở nhánh quỹ tháng.
assert.equal(myDebts(base, M).filter((x) => x.kind === 'dues').length, 0,
  'đóng đủ rồi mà vẫn hiện nút Trả là mời người ta chuyển tiền lần hai')

const d1 = base.dues.find((d) => d.memberId === 'M1')
const unpaidDues = {
  ...base,
  dues: base.dues.map((d) => (d.id === d1.id ? { ...d, paidAmount: 0, paidAt: null } : d)),
}
const mineDues = myDebts(unpaidDues, M).filter((x) => x.kind === 'dues')
assert.equal(mineDues.length, 1, 'quỹ tháng chưa đóng phải hiện ra cho chính chủ')
assert.equal(mineDues[0].id, d1.id)
assert.equal(mineDues[0].amount, d1.amount, 'số tiền phải là phần CÒN THIẾU, không phải số đã đóng')

// Đóng thiếu: chỉ được khai phần còn lại, không phải cả khoản.
const partial = {
  ...base,
  dues: base.dues.map((d) => (d.id === d1.id ? { ...d, paidAmount: 50000, paidAt: '2026-08-03' } : d)),
}
assert.equal(myDebts(partial, M).find((x) => x.kind === 'dues').amount, d1.amount - 50000,
  'đóng thiếu mà khai cả khoản là quỹ nhận thừa, sổ lệch đúng bằng phần đã đóng trước đó')

// Nợ của NGƯỜI KHÁC không bao giờ lọt vào danh sách của mình.
assert.equal(myDebts(unpaidDues, M).every((x) => x.id !== 'D-cua-nguoi-khac'), true)
const otherDue = base.dues.find((d) => d.memberId !== 'M1')
assert.equal(myDebts(unpaidDues, M).some((x) => x.id === otherDue.id), false,
  'thấy được khoản của người khác là mở đường tự khai hộ / khai bừa')

/* ---------- đối chiếu buổi: CHỈ chiều người nợ quỹ ---------- */

const g2 = base.groups.find((g) => g.id === 'G2')
const adj = (over) => ({
  ...base,
  adjustments: (base.adjustments || []).concat([{
    id: 'AJX', key: [M, g2.id, 'M1', 'extra_session'].join(':'),
    month: M, groupId: g2.id, memberId: 'M1', kind: 'extra_session',
    sessions: 1, unit: 60000, amount: 60000, settle: 'cash',
    paid: false, paidAt: null, claimedAt: null, ...over,
  }]),
})

assert.equal(kinds(myDebts(adj({}), M)).includes('adjust:AJX'), true,
  'đi thêm buổi (amount DƯƠNG) là người nợ quỹ — phải cho khai')

assert.equal(kinds(myDebts(adj({ amount: -60000 }), M)).includes('adjust:AJX'), false,
  'amount ÂM là QUỸ NỢ NGƯỜI (hoàn tiền vắng). Hiện nút Trả ở đây là bắt người ta chuyển tiền '
  + 'cho khoản đáng lẽ được nhận — mất tiền thật, không phải lỗi hiển thị')

assert.equal(kinds(myDebts(adj({ paid: true }), M)).includes('adjust:AJX'), false,
  'đã trả rồi thì không được khai lại')

assert.equal(kinds(myDebts(adj({ id: null }), M)).includes('adjust:null'), false,
  'khoản chưa từng ghi xuống DB (id rỗng) không khai được: RPC khoá theo id thật')

assert.equal(kinds(myDebts(adj({ memberId: 'M2' }), M)).includes('adjust:AJX'), false,
  'đối chiếu của người khác không được lọt vào danh sách của mình')

/* ---------- trạng thái chờ duyệt đi xuống được UI ---------- */

const claimed = myDebts(adj({ claimedAt: '2026-08-20T10:00:00Z' }), M).find((x) => x.id === 'AJX')
assert.equal(claimed.claimedAt, '2026-08-20T10:00:00Z',
  'mất claimedAt là màn hình không phân biệt được "chưa khai" với "đang chờ duyệt", '
  + 'người ta khai lại lần hai và chuyển tiền lần hai')

/* ---------- buổi đi lẻ (session_guests của THÀNH VIÊN) ---------- */

const sgOf = (over) => ({
  ...base,
  sessionGuests: (base.sessionGuests || []).concat([{
    id: 'SGX', sessionId: 'B1', guestId: null, memberId: 'M1',
    level: 'TB', gender: 'nam', price: 70000, paid: false, invitedBy: '', claimedAt: null, ...over,
  }]),
})

assert.equal(kinds(myDebts(sgOf({}), M)).includes('guest:SGX'), true,
  'thành viên đi buổi đột xuất vẫn là nợ của họ')
assert.equal(kinds(myDebts(sgOf({ paid: true }), M)).includes('guest:SGX'), false)
assert.equal(kinds(myDebts(sgOf({ memberId: 'M2' }), M)).includes('guest:SGX'), false)
assert.equal(kinds(myDebts(sgOf({ guestId: 'K1', memberId: null }), M)).includes('guest:SGX'), false,
  'dòng thu của KHÁCH NGOÀI không phải nợ của thành viên nào đang đăng nhập')

// Tháng khác không được lẫn vào: người ta chỉ đang nhìn tháng hiện tại.
assert.equal(myDebts(sgOf({}), '2026-07').some((x) => x.id === 'SGX'), false,
  'buổi tháng 8 lọt vào danh sách tháng 7 là tính nợ sai tháng')

/* ---------- chưa ghép tài khoản thì không có gì ---------- */

assert.deepEqual(myDebts({ ...base, currentUserId: null }, M), [],
  'chưa đăng nhập / chưa ghép thì trả mảng rỗng, không throw')

console.log('myDebts & myMember check: OK')
