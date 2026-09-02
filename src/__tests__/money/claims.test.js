// node --test — Thành viên tự khai đã chuyển tiền: khoản nào được phép khai, khoản nào không.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  debtRows, debtSum, myDebtSummary, myDebts, myMember, openSessions, pendingClaims,
} from '#lib/money.js'

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

/* ---------- myDebtCounts vs clubDebtCounts ---------- */

import { clubDebtCounts, myDebtCounts } from '#lib/money.js'

const clubCounts = clubDebtCounts(base, M)
assert.equal(typeof clubCounts.total, 'number')
assert.equal(clubCounts.total, clubCounts.sessions + clubCounts.dues + clubCounts.advance)

const memberCounts = myDebtCounts(base, M)
assert.equal(typeof memberCounts.total, 'number')
assert.equal(memberCounts.total, memberCounts.sessions + memberCounts.dues + memberCounts.advance)
// Member U1 (M1) đã đóng đủ trong base fixture nên nợ cá nhân <= tổng CLB
assert.equal(memberCounts.total <= clubCounts.total, true, 'nợ của 1 member không thể nhiều hơn nợ toàn CLB')

const customMemberCounts = myDebtCounts(unpaidDues, M, 'M1')
assert.equal(customMemberCounts.dues, 1, 'M1 có 1 khoản quỹ tháng chưa đóng')

console.log('myDebtCounts & clubDebtCounts check: OK')


/* ---------- banner "sân đang mở" ở Trang chủ ---------- */

const openList = openSessions(base)
assert.equal(openList.every((s) => s.id), true, 'mỗi buổi phải mang id để bấm vào mở được')

// Chỉ buổi `open`, và chỉ từ hôm nay trở đi.
const stats = { open: 0, other: 0 }
base.sessions.forEach((s) => { stats[s.status === 'open' && s.date >= base.today ? 'open' : 'other']++ })
assert.equal(openList.length, stats.open,
  'banner chỉ được liệt kê buổi đang MỞ từ hôm nay — lọt buổi đã chốt là mời người ta tới sân đã tan')

const draftDb = { ...base, sessions: base.sessions.map((s) => ({ ...s, status: 'draft' })) }
assert.deepEqual(openSessions(draftDb), [], 'chưa mở buổi nào thì banner phải rỗng, không hiện khống')

const closedDb = { ...base, sessions: base.sessions.map((s) => ({ ...s, status: 'closed' })) }
assert.deepEqual(openSessions(closedDb), [], 'buổi đã chốt không phải buổi đang mở')

// Buổi mở nhưng ở QUÁ KHỨ: không nhắc nữa, người ta không đi ngược thời gian được.
const past = {
  ...base,
  sessions: [{ ...base.sessions[0], id: 'PAST1', date: '2020-01-01', status: 'open' }],
}
assert.deepEqual(openSessions(past), [], 'buổi mở đã qua ngày thì thôi nhắc')

// Số người đã nhận đi KHÔNG được dùng presentCount: hàm đó trả 0 khi buổi chưa đánh phút nào,
// tức là mọi buổi sắp diễn ra đều ra 0 người và banner nói dối.
const sid = base.sessions.find((s) => (base.attendance[s.id] || {}) && Object.keys(base.attendance[s.id] || {}).length)
if (sid) {
  const marked = Object.values(base.attendance[sid.id]).filter((v) => v === true || v === 'extra').length
  const one = openSessions({ ...base, sessions: [{ ...sid, status: 'open', date: base.today }] })[0]
  assert.equal(one.going >= marked, true,
    'đếm thiếu người đã điểm danh thì banner báo ít hơn thực tế, chủ sân xếp sân sai')
}

console.log('openSessions check: OK')

/* ---------- myDebtSummary: nguồn chung của cả ba kiểu banner ---------- */
// Ba banner đọc CÙNG một tóm tắt. Đếm lệch một con số là ba màn hình nói ba số khác nhau về
// cùng một khoản tiền, và người dùng không biết tin cái nào.

const mixed = {
  ...base,
  dues: base.dues.map((d) => (d.id === d1.id
    ? { ...d, paidAmount: 0, paidAt: null, claimedAt: '2026-08-20T10:00:00Z' } : d)),
  sessionGuests: (base.sessionGuests || []).concat([{
    id: 'SG_S', sessionId: 'B1', guestId: null, memberId: 'M1',
    level: 'TB', gender: 'nam', price: 70000, paid: false, invitedBy: '', claimedAt: null,
  }]),
}

const sum = myDebtSummary(mixed)
assert.equal(sum.items.length, sum.open.length + sum.waiting.length,
  'mỗi khoản phải nằm ĐÚNG một nhóm: hụt là banner báo thiếu, đúp là báo thừa')
assert.equal(sum.waiting.every((x) => x.claimedAt), true, 'nhóm chờ duyệt chỉ chứa khoản đã khai')
assert.equal(sum.open.every((x) => !x.claimedAt), true, 'nhóm chưa khai không được lẫn khoản đã khai')
assert.equal(sum.total, debtSum(sum.items))
assert.equal(sum.openTotal, debtSum(sum.open))

// `total` PHẢI gồm cả khoản đang chờ duyệt: chưa được thủ quỹ xác nhận thì vẫn đang nợ.
// Trừ ra là banner báo hết nợ trong khi tiền chưa ai xác nhận nhận được.
assert.equal(sum.total > sum.openTotal, true,
  'total phải lớn hơn openTotal khi có khoản chờ duyệt — bằng nhau là đã trừ mất khoản đó')
assert.equal(sum.total, sum.openTotal + debtSum(sum.waiting))

// Chưa ghép tài khoản: mọi số về 0, không throw.
const none = myDebtSummary({ ...base, currentUserId: null })
assert.deepEqual([none.items, none.open, none.waiting], [[], [], []])
assert.equal(none.total, 0)
assert.equal(debtSum([]), 0, 'danh sách rỗng phải ra 0, không NaN')

/* ---------- debtRows: một hàm, hai màn ---------- */
// myDebts và pendingClaims dùng chung hàm này. Tách đôi thì sớm muộn cùng một khoản hiện ở
// màn này mà không hiện ở màn kia.

const meId = myMember(mixed).id
assert.deepEqual(
  debtRows(mixed, M, { memberId: meId }).map((x) => x.key),
  myDebts(mixed, M).map((x) => x.key),
  'myDebts phải đúng bằng debtRows lọc theo chính mình')

const onlyClaimed = debtRows(mixed, M, { claimedOnly: true })
assert.equal(onlyClaimed.every((x) => x.claimedAt), true)
assert.equal(onlyClaimed.length <= debtRows(mixed, M, {}).length, true)

// Mọi dòng phải mang đủ khoá để RPC gọi được và UI hiện được.
debtRows(mixed, M, {}).forEach((x) => {
  assert.ok(x.kind && x.id, 'thiếu kind/id thì RPC claim_payments không khai được khoản này')
  assert.ok(x.key, 'thiếu key thì React trùng key, tick ô này nhảy ô kia')
  assert.ok(x.memberId && x.name, 'thiếu tên thì tab Chờ duyệt không biết của ai')
  assert.equal(x.amount > 0, true, 'chỉ chiều NGƯỜI NỢ QUỸ mới được vào danh sách')
})

console.log('myDebtSummary & debtRows check: OK')
