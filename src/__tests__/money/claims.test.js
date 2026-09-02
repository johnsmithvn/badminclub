// node --test — Thành viên tự khai đã chuyển tiền: khoản nào được phép khai, khoản nào không.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import { myDebts, myMember, pendingClaims } from '#lib/money.js'

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

/* ---------- tab Chờ duyệt: gộp khoản đã khai của MỌI người ---------- */

const twoClaims = {
  ...base,
  dues: base.dues.map((d) => (d.id === d1.id
    ? { ...d, paidAmount: 0, paidAt: null, claimedAt: '2026-08-20T10:00:00Z' } : d)),
  adjustments: (base.adjustments || []).concat([{
    id: 'AJY', key: [M, g2.id, 'M2', 'extra_session'].join(':'),
    month: M, groupId: g2.id, memberId: 'M2', kind: 'extra_session',
    sessions: 1, unit: 60000, amount: 60000, settle: 'cash',
    paid: false, paidAt: null, claimedAt: '2026-08-21T09:00:00Z',
  }]),
}

const groups = pendingClaims(twoClaims, M)
assert.equal(groups.length, 2, 'hai người khai thì phải ra hai nhóm, không gộp nhầm vào một')
assert.deepEqual(groups.map((g) => g.memberId).sort(), ['M1', 'M2'])
assert.equal(groups.every((g) => g.items.every((x) => x.claimedAt)), true,
  'tab Chờ duyệt chỉ được chứa khoản ĐÃ khai — lọt khoản chưa khai vào là người giữ quỹ '
  + 'duyệt một khoản chưa ai báo chuyển, tức ghi nhận tiền chưa về')
assert.equal(groups[0].total >= groups[1].total, true, 'nợ to lên trước')
assert.equal(groups.find((g) => g.memberId === 'M2').total, 60000)

// Chưa ai khai thì tab rỗng, không phải hiện cả bảng công nợ.
assert.deepEqual(pendingClaims(base, M), [],
  'không có ai khai mà tab vẫn liệt kê là mời duyệt khống')

// Khoản đã trả rồi thì rời khỏi tab dù claimedAt còn (cố ý giữ claimedAt sau khi duyệt).
const settled = {
  ...twoClaims,
  dues: twoClaims.dues.map((d) => (d.id === d1.id ? { ...d, paidAmount: d.amount } : d)),
}
assert.equal(pendingClaims(settled, M).some((g) => g.memberId === 'M1'), false,
  'duyệt xong mà vẫn nằm trong tab Chờ duyệt là duyệt hai lần, thu hai lần')

console.log('pendingClaims check: OK')

// Một người khai NHIỀU khoản cùng lúc ("trả 1 phát hết") phải gộp về MỘT nhóm, cộng dồn tiền.
// Không gộp thì màn hình hiện người đó hai lần với hai số lẻ, và "Duyệt tất cả" chỉ duyệt một nửa.
const multi = {
  ...twoClaims,
  sessionGuests: (base.sessionGuests || []).concat([{
    id: 'SGZ', sessionId: 'B1', guestId: null, memberId: 'M1',
    level: 'TB', gender: 'nam', price: 70000, paid: false, invitedBy: '',
    claimedAt: '2026-08-20T10:00:05Z',
  }]),
}
const gM1 = pendingClaims(multi, M).find((g) => g.memberId === 'M1')
assert.equal(gM1.items.length, 2, 'hai khoản của cùng một người phải nằm chung một nhóm')
assert.equal(gM1.total, gM1.items.reduce((n, x) => n + x.amount, 0),
  'tổng của nhóm phải bằng tổng các khoản trong nhóm — lệch là duyệt thiếu tiền')
assert.equal(pendingClaims(multi, M).length, 2, 'vẫn chỉ hai người, không tách thành ba dòng')

console.log('pendingClaims gộp theo người: OK')
