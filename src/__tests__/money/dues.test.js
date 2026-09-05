// node --test — Tiền của thành viên — một chuỗi: quỹ tháng → đơn giá một buổi → đối chiếu buổi.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  savedAdjust,
  adjustKey, adjustRows, dueState, duesTotal, groupMembers, isPresent,
  joinDues, lockDues, pendingOffset, presentCount, regroupDues, sessionMembers,
  sessionOf, unitPrice, memberExtraPrice, guestPrice,
} from '#lib/money.js'

const db = seed()
const S = (id) => sessionOf(db, id)
/* ---------- đơn giá một buổi và back tiền ---------- */
// Nhóm CN tháng 08 có 5 buổi (B1,B3,B5,B7,B9) đều ≠ cancelled
const g1 = db.groups.find((g) => g.id === 'G1')
const uNam = unitPrice(db, { gender: 'nam' }, g1, '2026-08')
assert.equal(uNam.n, 5)
assert.equal(uNam.fee, 250000)
assert.equal(uNam.unit, 50000, '250.000 / 5 buổi = 50.000, làm tròn nghìn')
const uNu = unitPrice(db, { gender: 'nu' }, g1, '2026-08')
assert.equal(uNu.unit, 40000, '200.000 / 5 = 40.000')
// roundUnit = false thì không làm tròn về nghìn
const dbNoRound = { ...db, club: { ...db.club, roundUnit: false } }
const g2 = db.groups.find((g) => g.id === 'G2')
assert.equal(unitPrice(dbNoRound, { gender: 'nam' }, g2, '2026-08').n, 4)
assert.equal(unitPrice(dbNoRound, { gender: 'nam' }, g2, '2026-08').unit, 62500)
assert.equal(unitPrice(db, { gender: 'nam' }, g2, '2026-08').unit, 63000, 'roundUnit làm tròn 62.500 → 63.000')
// Buổi đột xuất ('ALL' → group_id NULL) KHÔNG được đếm vào số buổi của ca cố định. Đếm nhầm
// là mẫu số tăng, đơn giá một buổi tụt, và tiền back cho MỌI người vắng của ca đó trả thiếu —
// không ai sửa gì mà số vẫn đổi. `createAdhoc` luôn ghi 'ALL' chính là để giữ luật này.
const dbAdhoc = {
  ...db,
  sessions: db.sessions.concat([{
    id: 'ADHOC1', date: '2026-08-12', groupId: 'ALL', status: 'closed',
    note: '', courts: [], scheduleId: null,
  }]),
}
assert.equal(unitPrice(dbAdhoc, { gender: 'nam' }, g1, '2026-08').n, 5,
  'thêm một buổi đột xuất mà mẫu số đổi = tiền back của cả ca CN trả thiếu')
assert.equal(unitPrice(dbAdhoc, { gender: 'nam' }, g1, '2026-08').unit, 50000,
  'đơn giá một buổi phải đứng yên ở 50.000')

// tháng không có buổi nào → mẫu số tối thiểu 1, không chia cho 0
assert.equal(unitPrice(db, { gender: 'nam' }, g1, '2030-01').n, 1)
assert.equal(unitPrice(db, { gender: 'nam' }, g1, '2030-01').unit, 250000)

// Back tiền: chỉ tính buổi đã CHỐT mà người đó bị đánh Vắng. Dấu ÂM = quỹ nợ người.
const backs = adjustRows(db, '2026-08')
const m5 = backs.find((r) => r.member.id === 'M5' && r.kind === 'absent_back')
assert.ok(m5, 'M5 vắng B1 và B5 (cả hai đã chốt)')
assert.equal(m5.sessions, 2)
assert.equal(m5.unit, 40000, 'M5 là nữ nhóm CN')
assert.equal(m5.amount, -80000, 'quỹ nợ người thì amount ÂM')
assert.equal(m5.settle, 'cash')
assert.equal(m5.paid, false)
assert.ok(!backs.some((r) => r.sessions === 0), 'không ai nghỉ 0 buổi mà vẫn có dòng')
assert.ok(
  backs.every((r, i, arr) => i === 0 || Math.abs(arr[i - 1].amount) >= Math.abs(r.amount)),
  'sắp theo số tiền giảm dần, không phân biệt chiều'
)

/* ---------- B8: đơn giá lấy từ quỹ tháng NGƯỜI ĐÓ ĐÓNG, không từ cấu hình nhóm ---------- */

// Sửa quỹ nhóm giữa chừng: người đã đóng 250.000 không được back theo giá mới.
const dbRaise = { ...db, groups: db.groups.map((g) => (g.id === 'G1' ? { ...g, feeNam: 280000 } : g)) }
const mNam = db.members.find((m) => m.gender === 'nam' && groupMembers(db, 'G1', '2026-08').some((x) => x.id === m.id))
assert.ok(mNam, 'phải có ít nhất một nam cố định nhóm CN')
const dueNam = db.dues.find((d) => d.month === '2026-08' && d.groupId === 'G1' && d.memberId === mNam.id)
assert.ok(dueNam && dueNam.amount === 250000, 'người đó đã chốt quỹ 250.000 cho tháng 8')
// Phải truyền NHÓM ĐÃ TĂNG GIÁ vào, không thì đọc feeNam cũ cũng ra 250.000 và assert vô nghĩa.
const g1Raised = dbRaise.groups.find((g) => g.id === 'G1')
assert.equal(g1Raised.feeNam, 280000, 'dựng đúng cảnh: cấu hình nhóm đã bị sửa')
assert.equal(unitPrice(dbRaise, mNam, g1Raised, '2026-08').fee, 250000,
  'đọc quỹ ĐÃ CHỐT của người đó, không đọc feeNam mới')
assert.equal(unitPrice(dbRaise, mNam, g1Raised, '2026-08').unit, 50000,
  '250.000 ÷ 5 buổi = 50.000, không phải 280.000 ÷ 5 = 56.000')

// Tháng chưa chốt danh sách (chưa có dòng dues) thì mới rơi về giá cấu hình của nhóm.
const dbNoDues = { ...db, dues: [] }
assert.equal(unitPrice(dbNoDues, mNam, dbRaise.groups.find((g) => g.id === 'G1'), '2026-08').fee, 280000)

/* ---------- đối chiếu chiều NGƯỢC: người đi thêm buổi nhóm khác ---------- */

// Người cố định nhóm T6 và KHÔNG cố định nhóm CN, hôm 02/08 đi thêm buổi CN (B1 đã chốt).
// Nhiều người cố định cả hai nhóm nên phải lọc, không lấy bừa người đầu danh sách.
const g1ids = new Set(groupMembers(db, 'G1', '2026-08').map((m) => m.id))
const gone = groupMembers(db, 'G2', '2026-08').find((m) => !g1ids.has(m.id))
assert.ok(gone, 'phải có người cố định T6 mà không cố định CN')
const dbExtra = {
  ...db,
  attendance: { ...db.attendance, B1: { ...(db.attendance.B1 || {}), [gone.id]: 'extra' } },
}
assert.equal(isPresent('extra'), true, "'extra' vẫn là có mặt")
assert.ok(sessionMembers(dbExtra, S('B1')).some((m) => m.id === gone.id), 'người đi thêm phải lọt vào danh sách buổi')
assert.equal(presentCount(dbExtra, S('B1')), presentCount(db, S('B1')) + 1, 'đầu người tăng 1')

const ex = adjustRows(dbExtra, '2026-08').find((r) => r.kind === 'extra_session' && r.memberId === gone.id)
assert.ok(ex, 'phải sinh một dòng người-nợ-quỹ')
assert.equal(ex.sessions, 1)
assert.equal(ex.amount, ex.unit, 'đi 1 buổi thì nợ đúng 1 đơn giá')
assert.ok(ex.amount > 0, 'người nợ quỹ thì amount DƯƠNG')
assert.equal(ex.key, adjustKey('2026-08', 'G1', gone.id, 'extra_session'))

// Test toggle chênh lệch giá thành viên đi thêm so với khách giao lưu:
const gPrice = guestPrice(db, gone.level, gone.gender)
assert.ok(gPrice > 0, 'fixture phải có giá khách cho trình độ của gone')
assert.equal(
  memberExtraPrice(db, gone, '2026-08'),
  gPrice,
  'khi toggle tắt (mặc định), thành viên đi thêm trả nguyên giá khách giao lưu'
)
const dbWithDiscount = {
  ...db,
  club: { ...db.club, hasMemberExtraDiscount: true, memberExtraDiscount: 5000 },
}
assert.equal(
  memberExtraPrice(dbWithDiscount, gone, '2026-08'),
  gPrice - 5000,
  'khi toggle bật, thành viên đi thêm được giảm đúng 5.000đ'
)
const dbWithCustomDiscount = {
  ...db,
  club: { ...db.club, hasMemberExtraDiscount: true, memberExtraDiscount: 10000 },
}
assert.equal(
  memberExtraPrice(dbWithCustomDiscount, gone, '2026-08'),
  gPrice - 10000,
  'khi cấu hình mức giảm 10.000đ, thành viên được giảm đúng 10.000đ'
)

// CLB chưa cấu hình guestPrices (hoặc trình độ của thành viên chưa có giá khách):
// Đơn giá đi thêm buổi phải fallback về unitPrice(db, m, g, month).unit, KHÔNG ĐƯỢC ra 0đ.
const dbNoGuestPrices = { ...dbExtra, guestPrices: [] }
const exFallback = adjustRows(dbNoGuestPrices, '2026-08').find((r) => r.kind === 'extra_session' && r.memberId === gone.id)
assert.ok(exFallback, 'vẫn phải sinh dòng extra_session')
assert.ok(exFallback.unit > 0, 'đơn giá không được bằng 0 khi CLB chưa nhập bảng giá khách')
assert.equal(exFallback.unit, unitPrice(dbNoGuestPrices, gone, exFallback.group, '2026-08').unit, 'fallback về đơn giá chia từ quỹ/nhóm')
assert.equal(exFallback.amount, exFallback.unit * exFallback.sessions)

// REGRESSION: người ĐÃ cố định nhóm CN mà ô điểm danh là 'extra' thì KHÔNG bị tính tiền —
// họ đã đóng quỹ tháng cho nhóm này rồi, tính thêm là thu hai lần cùng một buổi.
const both = groupMembers(db, 'G2', '2026-08').find((m) => g1ids.has(m.id))
assert.ok(both, 'fixture phải có người cố định cả hai nhóm')
const dbBoth = {
  ...db,
  attendance: { ...db.attendance, B1: { ...(db.attendance.B1 || {}), [both.id]: 'extra' } },
}
assert.equal(
  adjustRows(dbBoth, '2026-08').filter((r) => r.kind === 'extra_session' && r.memberId === both.id).length,
  0, 'người cố định nhóm đó không bao giờ là người đi thêm'
)

/* ---------- dòng đã lưu thì ĐỨNG YÊN, không tính lại ---------- */

const saved = {
  id: 'AJ1', key: m5.key, month: '2026-08', groupId: 'G1', memberId: 'M5', kind: 'absent_back',
  sessions: 2, unit: 40000, amount: -80000, settle: 'cash', paid: true, paidAt: '2026-08-28',
}
// Quỹ nhóm đổi + điểm danh đổi, khoản đã trả vẫn phải giữ nguyên con số.
const dbSaved = {
  ...dbRaise, dues: [], adjustments: [saved],
  attendance: { ...db.attendance, B3: { ...(db.attendance.B3 || {}), M5: false } },
}
const m5b = adjustRows(dbSaved, '2026-08').find((r) => r.key === m5.key)
assert.equal(m5b.amount, -80000, 'khoản đã chốt không được tính lại')
assert.equal(m5b.sessions, 2)
assert.equal(m5b.paid, true)
assert.equal(m5b.saved, true)

/* ---------- khoản xin trừ vào quỹ tháng sau ---------- */

const off = { ...saved, id: 'AJ2', settle: 'offset_next_dues', paid: false, paidAt: null }
const dbOff = { ...db, adjustments: [off] }
assert.equal(pendingOffset(dbOff, 'M5', '2026-09').length, 1, 'tháng sau thì thấy khoản treo')
assert.equal(pendingOffset(dbOff, 'M5', '2026-08').length, 0, 'chính tháng sinh ra nó thì chưa')
assert.equal(pendingOffset({ ...dbOff, adjustments: [{ ...off, paid: true }] }, 'M5', '2026-09').length, 0,
  'đã xử lý thì thôi')
assert.equal(pendingOffset({ ...dbOff, adjustments: [saved] }, 'M5', '2026-09').length, 0,
  'khoản trả tiền mặt không trừ vào quỹ tháng sau')

/* ---------- đóng thiếu: trạng thái suy ra từ SỐ TIỀN, không phải cờ ---------- */

const D = (amount, paidAmount) => dueState({ amount, paidAmount })
assert.deepEqual(D(250000, 0).state, 'none')
assert.deepEqual(D(250000, 150000).state, 'partial', 'đưa trước một phần')
assert.deepEqual(D(250000, 250000).state, 'full')
assert.deepEqual(D(250000, 300000).state, 'full', 'đưa dư vẫn là đủ')
assert.equal(D(250000, 150000).remain, 100000)
assert.equal(D(250000, 300000).remain, 0, 'đưa dư thì còn nợ 0, không ra số âm')
assert.equal(D(250000, 300000).paid, 300000, 'phần dư giữ nguyên, không bị cắt về 250.000')
assert.equal(D(250000, -5).paid, 0, 'số âm rác thì coi như chưa đóng')
assert.equal(D(0, 0).state, 'none')
assert.equal(D(0, 0).full, false, 'khoản 0 đồng không tính là đã đóng đủ')

const tot = duesTotal([{ amount: 250000, paidAmount: 150000 }, { amount: 200000, paidAmount: 200000 }])
assert.deepEqual(tot, { amount: 450000, paid: 350000, remain: 100000 })
assert.deepEqual(duesTotal([]), { amount: 0, paid: 0, remain: 0 })
assert.deepEqual(duesTotal(undefined), { amount: 0, paid: 0, remain: 0 })

/* ---------- đơn giá một buổi do CLB TỰ ĐẶT thì ưu tiên hơn cách chia của app ---------- */

const gcn = db.groups.find((g) => g.id === 'G1')
const nam = { id: 'MU', gender: 'nam' }
const nu = { id: 'MV', gender: 'nu' }
// Chưa đặt gì → app tự chia như cũ.
assert.equal(unitPrice(db, nam, gcn, '2026-08').override, false)
assert.equal(unitPrice(db, nam, gcn, '2026-08').unit, 50000, '250.000 ÷ 5 buổi')

// Đặt 60.000/buổi cho nam, 45.000 cho nữ → dùng thẳng, không chia lại.
const gOwn = { ...gcn, unitNam: 60000, unitNu: 45000 }
const dbOwn = { ...db, groups: db.groups.map((g) => (g.id === 'G1' ? gOwn : g)) }
assert.equal(unitPrice(dbOwn, nam, gOwn, '2026-08').unit, 60000)
assert.equal(unitPrice(dbOwn, nam, gOwn, '2026-08').override, true)
assert.equal(unitPrice(dbOwn, nu, gOwn, '2026-08').unit, 45000)
// Số CLB gõ vào KHÔNG bị làm tròn lại — làm tròn là sửa số của họ.
const gOdd = { ...gcn, unitNam: 63500, unitNu: 63500 }
assert.equal(unitPrice({ ...db, groups: [gOdd] }, nam, gOdd, '2026-08').unit, 63500)
// 0 và bỏ trống đều nghĩa là "để app tự chia".
const gZero = { ...gcn, unitNam: 0, unitNu: null }
assert.equal(unitPrice(db, nam, gZero, '2026-08').override, false)
assert.equal(unitPrice(db, nu, gZero, '2026-08').override, false)

// Back tiền đi theo số tự đặt: M5 nữ vắng 2 buổi → 45.000 × 2, không phải 40.000 × 2.
const dbBackOwn = { ...db, groups: db.groups.map((g) => (g.id === 'G1' ? gOwn : g)) }
const m5own = adjustRows(dbBackOwn, '2026-08').find((r) => r.memberId === 'M5' && r.kind === 'absent_back')
assert.equal(m5own.unit, 45000)
assert.equal(m5own.amount, -90000)
assert.equal(m5own.unitOverride, true)

/* ---------- chốt danh sách tháng: lockDues ---------- */
// Hàm sinh ra TOÀN BỘ tiền phải thu của một tháng. Trước đây nằm trong appActions nên không
// test được bằng node — mà đây là chỗ sai một dòng thì cả CLB thu nhầm.

const SEP = '2026-09'
const fixedCount = Object.keys(db.roster[SEP]).reduce(
  (n, gid) => n + Object.keys(db.roster[SEP][gid]).filter((mid) => db.roster[SEP][gid][mid] === 'fixed').length, 0)

const lk = lockDues(db, SEP)
assert.equal(lk.rows.length, fixedCount, 'chỉ sinh khoản cho người fixed, bỏ off và pending')
assert.ok(lk.rows.every((r) => r.month === SEP && r.paidAmount === 0 && r.amount > 0))
assert.ok(!lk.rows.some((r) => r.memberId === 'M5' && r.groupId === 'G1'), 'M5 để off thì không thu')
assert.ok(!lk.rows.some((r) => r.memberId === 'M17'), 'M17 mới xin (pending) thì chưa thu')
// Tháng đã có dues rồi thì chốt lại không đẻ thêm — bỏ chốt rồi chốt lại là chuyện thường.
assert.deepEqual(lockDues(db, '2026-08').rows, [], 'tháng đã có khoản thu thì không sinh trùng')

// NGƯNG HOẠT ĐỘNG thì thôi thu. Người đã ngưng biến mất khỏi mọi màn (đâu đâu cũng lọc
// `active !== false`) nên cũng không có cách nào gỡ họ khỏi danh sách cố định — không chặn ở
// đây thì tháng nào chốt danh sách cũng đẻ thêm một khoản nợ cho người đã nghỉ, mãi mãi.
const dOff = { ...db, members: db.members.map((m) => (m.id === 'M1' ? { ...m, active: false } : m)) }
const lkOff = lockDues(dOff, SEP)
assert.equal(lkOff.rows.length, fixedCount - 1, 'người đã ngưng không được sinh thêm khoản thu')
assert.ok(!lkOff.rows.some((r) => r.memberId === 'M1'))

// Khoản "trừ vào quỹ tháng sau" cộng THẲNG dấu vào số phải đóng, và một người ở hai nhóm
// chỉ được trừ MỘT lần (M2 cố định cả G1 lẫn G2).
const offKey = adjustKey('2026-08', 'G1', 'M2', 'absent_back')
const dAdj = {
  ...db,
  adjustments: [{
    id: 'AJX', key: offKey, month: '2026-08', groupId: 'G1', memberId: 'M2', kind: 'absent_back',
    sessions: 2, unit: 30000, amount: -60000, settle: 'offset_next_dues', paid: false, paidAt: null,
  }],
}
const lkAdj = lockDues(dAdj, SEP)
const m2Rows = lkAdj.rows.filter((r) => r.memberId === 'M2')
const m2Base = lk.rows.filter((r) => r.memberId === 'M2').reduce((s, r) => s + r.amount, 0)
assert.equal(m2Rows.reduce((s, r) => s + r.amount, 0), m2Base - 60000, 'khoản âm phải làm đóng ÍT đi đúng 60.000')
assert.deepEqual(lkAdj.used, [offKey], 'khoản đã tiêu phải được đánh dấu đúng một lần dù người đó ở hai nhóm')
assert.equal(m2Rows.filter((r) => r.note).length, 1, 'chỉ một dòng mang ghi chú đã trừ')

/* ---------- đổi nhóm cố định: regroupDues ---------- */
// Tách khỏi appActions vì nó vừa xoá vừa giữ vừa sinh khoản tiền, mà trước đây cộng dồn
// `kept`/`dropped` NGAY TRONG updater của React — StrictMode gọi hai lần là toast báo gấp đôi.

const M1 = db.members.find((m) => m.id === 'M1')   // chỉ G1, đã đóng đủ
const M5 = db.members.find((m) => m.id === 'M5')   // chỉ G1, chưa đóng đồng nào
const AUG = '2026-08'

// Gỡ nhóm mà ĐÃ đóng tiền → giữ nguyên dòng trong sổ quỹ, chỉ ghi chú lý do.
const rgKeep = regroupDues(db, { ...M1, groupIds: [] }, [], AUG)
assert.equal(rgKeep.dropped, 0)
assert.equal(rgKeep.kept, dueState(db.dues.find((d) => d.memberId === 'M1' && d.groupId === 'G1')).paid)
assert.equal(rgKeep.dues.length, db.dues.length, 'tiền đã vào quỹ thì không được bốc hơi khỏi sổ')
assert.ok(rgKeep.dues.find((d) => d.memberId === 'M1' && d.groupId === 'G1').note, 'phải ghi chú lý do')

// Gỡ nhóm mà CHƯA đóng đồng nào → xoá hẳn, khỏi bị nhắc một khoản không còn phải đóng.
const rgDrop = regroupDues(db, { ...M5, groupIds: [] }, [], AUG)
assert.equal(rgDrop.kept, 0)
assert.equal(rgDrop.dropped, 1)
assert.equal(rgDrop.dues.length, db.dues.length - 1)
assert.ok(!rgDrop.dues.some((d) => d.memberId === 'M5' && d.groupId === 'G1' && d.month === AUG))

// Không đổi gì → không đụng dòng nào.
const rgSame = regroupDues(db, M1, ['G1'], AUG)
assert.deepEqual({ k: rgSame.kept, d: rgSame.dropped, a: rgSame.add.length }, { k: 0, d: 0, a: 0 })

// Vào nhóm mới: tháng CHƯA chốt danh sách thì không sinh khoản (chốt danh sách mới sinh);
// tháng ĐÃ chốt thì phải sinh, không thì thu hụt người vào giữa chừng.
assert.deepEqual(regroupDues(db, M1, ['G1', 'G2'], AUG).add, [], 'tháng chưa chốt thì để lockDues lo')
const dLocked = { ...db, locked: { ...db.locked, [AUG]: true } }
const jdG2 = joinDues(dLocked, M1, db.groups.find((g) => g.id === 'G2'), AUG)
const rgJoin = regroupDues(dLocked, M1, ['G1', 'G2'], AUG)
assert.equal(rgJoin.add.length, jdG2.amount > 0 ? 1 : 0, 'tháng đã chốt: có tiền thì phải sinh khoản')
if (jdG2.amount > 0) {
  assert.equal(rgJoin.add[0].groupId, 'G2')
  assert.equal(rgJoin.add[0].amount, jdG2.amount)
  assert.equal(rgJoin.add[0].paidAmount, 0)
  assert.ok(!rgJoin.add[0].id, 'id do action gắn, hàm thuần không sinh id')
}
// Đã có khoản rồi thì không sinh thêm lần hai dù tháng đã chốt.
assert.equal(regroupDues(dLocked, M1, ['G1'], AUG).add.length, 0)


/* ---------- tra dòng đối chiếu ĐÃ LƯU ---------- */
// `savedAdjust` là cái quyết định một dòng đối chiếu còn tính lại hay đã đứng yên. Trả null cho
// khoá lạ chứ không undefined — `adjustRows` phân nhánh bằng chính giá trị này.
assert.equal(savedAdjust(db, 'khoá-không-có'), null)
assert.equal(savedAdjust({ ...db, adjustments: undefined }, 'x'), null, 'CLB chưa có bảng nào cũng không throw')
const savedKey = adjustKey('2026-08', 'G1', 'M2', 'absent_back')
const dSaved = {
  ...db,
  adjustments: [{
    id: 'AJS', key: savedKey, month: '2026-08', groupId: 'G1', memberId: 'M2',
    kind: 'absent_back', sessions: 9, unit: 11000, amount: -99000,
    settle: 'cash', paid: false, paidAt: null,
  }],
}
assert.equal(savedAdjust(dSaved, savedKey).amount, -99000)
const rowSaved = adjustRows(dSaved, '2026-08').find((r) => r.key === savedKey)
assert.equal(rowSaved.amount, -99000, 'dòng đã lưu thì adjustRows ĐỌC số đã lưu, không tính lại')
assert.equal(rowSaved.saved, true)

console.log('money/dues check: OK')
