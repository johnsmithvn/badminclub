// node src/__tests__/money.test.js
import assert from 'node:assert/strict'
import { seed } from './fixture.js'
import {
  adjustKey, adjustRows, checkDue, checkPreview, costRow, costState, courtBase, courtCost,
  courtExtraCost, courtNet, estSessions, fmt, fmtK, freezeCost, groupMembers, guestDebtRows,
  guestPrice, isPresent, levelIdx, levelOf, levelStyle, playedCourts, pendingOffset, presentCount, quotaFor,
  remainSessions, sessionCost, sessionMembers, sessionOf, shuttleUnit, soldTotal, spreadDiff,
  stock, unfrozenCost, unitPrice,
} from '#lib/money.js'
import cfg from '#config/app.json' with { type: 'json' }

const db = seed()
const S = (id) => sessionOf(db, id)

/* ---------- hiển thị: làm tròn nghìn, giữ dấu âm ---------- */
assert.equal(fmtK(1234567), '1.235.000')
assert.equal(fmtK(1234000), '1.234.000')
// Math.round làm tròn .5 về phía +∞, nên -2500 ra -2.000 (KHÔNG phải -3.000).
// Đây là hành vi của prototype, giữ nguyên có ý — đừng "sửa" thành round-half-away-from-zero.
assert.equal(fmtK(-2500), '-2.000')
assert.equal(fmtK(-3500), '-3.000') // cùng quirk: -3.5 → -3
assert.equal(fmtK(-2400), '-2.000')
assert.equal(fmtK(0), '0')
assert.equal(fmtK(499), '0', 'dưới 500 làm tròn về 0')
assert.equal(fmtK(500), '1.000')
assert.equal(fmt(120000), '120.000 đ')

/* ---------- trình độ ---------- */
// Khoá THỨ TỰ chứ không khoá vị trí cụ thể: thang mặc định là cấu hình, thêm bậc là chuyện
// bình thường; cái không được sai là thứ tự yếu → mạnh, vì thuật toán cân sân dùng đúng nó.
assert.equal(levelIdx('Newbie'), 0, 'bậc đầu thang luôn là yếu nhất')
assert.ok(
  cfg.levelsDefault.every((l, i) => i === 0 || levelIdx(l) > levelIdx(cfg.levelsDefault[i - 1])),
  'levelIdx phải tăng dần đúng theo thứ tự khai trong app.json'
)
assert.ok(levelIdx('TB') > levelIdx('TB-') && levelIdx('TB-') > levelIdx('TBY'), 'TBY < TB- < TB')
assert.ok(levelIdx('TBY') > levelIdx('Y'), 'Y < TBY')
assert.equal(levelIdx('không có'), 0, 'trình độ lạ về 0, không crash')

// Màu chia theo VỊ TRÍ trong thang của CLB, không theo tên bậc.
const scale = ['a', 'b', 'c', 'd', 'e', 'f']
assert.notDeepEqual(levelStyle('a', scale), levelStyle('f', scale), 'yếu nhất và mạnh nhất phải khác màu')
assert.deepEqual(levelStyle('a', scale), levelStyle('Newbie'), 'bậc đầu thang nào cũng cùng một màu')
assert.deepEqual(levelStyle('lạ hoắc', scale), levelStyle('a', scale), 'bậc không có trong thang thì về màu đầu')

// levelOf tôn trọng thay đổi đang chờ áp dụng
const m = { level: 'TBY', pendingLevel: 'TB-', pendingLevelFrom: '2026-09' }
assert.equal(levelOf(m, '2026-08'), 'TBY', 'tháng trước mốc thì giữ trình độ cũ')
assert.equal(levelOf(m, '2026-09'), 'TB-', 'đúng tháng mốc thì đổi')
assert.equal(levelOf(m, '2026-10'), 'TB-')
assert.equal(levelOf({ level: 'TB' }, '2026-09'), 'TB', 'không có pending thì dùng level')

/* ---------- tiền sân ---------- */
// B1: nhóm CN, 2 sân × 2 giờ × 120.000 = 480.000, không bán, không thuê thêm
assert.equal(courtCost(db, S('B1')), 480000)
assert.equal(courtNet(db, S('B1')), 480000)
assert.equal(courtBase(db, S('B1')), 480000)
assert.equal(courtExtraCost(db, S('B1')), 0)
assert.equal(playedCourts(S('B1')), 2)

// B3 bán 1 sân cho CLB khác: chi phí thực chỉ còn 1 sân, tiền bán ghi thu riêng
assert.equal(courtCost(db, S('B3')), 480000, 'courtCost vẫn là tổng mọi dòng sân')
assert.equal(courtNet(db, S('B3')), 240000, 'sân đã bán KHÔNG tính vào chi phí buổi')
assert.equal(soldTotal(S('B3')), 240000)
assert.equal(playedCourts(S('B3')), 1)

// B2: nhóm T6, 1 sân Yên Phong × 2 giờ × 130.000
assert.equal(courtCost(db, S('B2')), 260000)

/* ---------- định mức cầu ---------- */
// Nhóm CN quota 34 cho 2 sân; buổi đủ 2 sân thì đúng 34
assert.equal(quotaFor(db, S('B5')), 34)
// B3 bán 1 sân → định mức giảm theo số sân còn chơi: 34 × 1/2 = 17
assert.equal(quotaFor(db, S('B3')), 17)
// Nhóm T6 quota 23 cho 1 sân
assert.equal(quotaFor(db, S('B6')), 23)
// Sàn 6 quả: quota nhỏ vẫn không xuống dưới 6
const tiny = { ...S('B6'), groupId: 'G2', courts: S('B6').courts }
const dbTiny = { ...db, groups: db.groups.map((g) => (g.id === 'G2' ? { ...g, quota: 2 } : g)) }
assert.equal(quotaFor(dbTiny, tiny), 6, 'định mức không bao giờ dưới 6 quả')

/* ---------- giá cầu bình quân toàn kho ---------- */
// P1 29 quả giá 0 (không tính) · P2 120 quả 3.200.000 · P3 120 quả 3.300.000
// → (3.200.000 + 3.300.000) / 240 = 27.083,33…
const unit = shuttleUnit(db)
assert.ok(Math.abs(unit - 6500000 / 240) < 1e-9, 'giá bình quân tính trên các đợt có tiền')
assert.ok(unit > 27000 && unit < 27100)
assert.equal(shuttleUnit({ ...db, purchases: [] }), 26667, 'chưa mua đợt nào thì dùng fallback')
assert.equal(
  shuttleUnit({ ...db, purchases: [{ qty: 10, total: 0 }] }),
  26667,
  'đợt total = 0 không được kéo giá bình quân xuống'
)

/* ---------- kho ---------- */
const st = stock(db)
assert.equal(st.bought, 29 + 120 + 120)
assert.equal(st.left, st.bought - st.used)
assert.equal(
  st.used,
  db.sessions.filter((s) => s.status === 'closed').reduce((t, s) => t + s.shuttleUsed, 0),
  'chỉ buổi đã chốt mới trừ kho'
)

/* ---------- giá khách giao lưu ---------- */
assert.equal(guestPrice(db, 'Newbie', 'nam'), 60000)
assert.equal(guestPrice(db, 'Newbie', 'nu'), 50000)
assert.equal(guestPrice(db, 'TB', 'nam'), 75000)
assert.equal(guestPrice(db, 'TB', 'nu'), 60000)
assert.equal(guestPrice(db, 'trình độ lạ', 'nam'), 0, 'không có bảng giá thì 0, không NaN')

/* ---------- điểm danh và nhóm cố định ---------- */
// B1 nhóm CN: 15 người cố định, 2 người vắng (M5, M15)
const g1Members = groupMembers(db, 'G1', '2026-08')
assert.equal(g1Members.length, 15)
assert.equal(presentCount(db, S('B1')), 13)
assert.equal(presentCount(db, S('B4')), groupMembers(db, 'G2', '2026-08').length, 'B4 không ai vắng')
// Tháng 09 có bản ghi roster riêng: M5 và M15 nghỉ, M17 chờ duyệt → chỉ còn fixed
assert.equal(groupMembers(db, 'G1', '2026-09').length, 13, 'off và pending không tính là cố định')

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

/* ---------- kiểm kho: tháng lấy từ NGÀY KIỂM, không phải tháng đang xem ---------- */
assert.equal(db.month, '2026-08', 'fixture đang xem tháng 8')
const ck8 = checkPreview(db, '2026-08-31', 40)
assert.equal(ck8.month, '2026-08')
assert.equal(ck8.systemLeft, stock(db).left)
assert.equal(ck8.diff, stock(db).left - 40)
assert.equal(ck8.n, estSessions(db, '2026-08').length, 'chia vào đúng số buổi ước lượng của tháng 8')
assert.ok(ck8.n > 0, 'tháng 8 phải còn buổi ước lượng, không thì test này vô nghĩa')
assert.equal(ck8.share, Math.round(ck8.diff / ck8.n))

// REGRESSION Issue 6: header vẫn ở tháng 8 nhưng kiểm ngày 05/09 → phải chia vào buổi tháng 9,
// không được mượn buổi tháng 8. Bug cũ lấy d0.month nên hai tháng sai cùng lúc.
const ck9 = checkPreview(db, '2026-09-05', 40)
assert.equal(ck9.month, '2026-09', 'tháng lấy từ ngày kiểm, không lấy tháng đang xem')
assert.equal(ck9.n, estSessions(db, '2026-09').length)
assert.equal(ck9.share, 0, 'không có buổi ước lượng thì không chia được')

// Bỏ trống ngày thì rơi về hôm nay, vẫn không đọc db.month
assert.equal(checkPreview(db, '', 40).month, db.today.slice(0, 7))
// Chưa gõ số đếm: coi như 0, không NaN
assert.ok(Number.isFinite(checkPreview(db, '2026-08-31', '').diff))

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
assert.equal(ex.group.id, 'G1', 'đơn giá lấy theo nhóm của BUỔI, không phải nhóm của người')
assert.equal(ex.key, adjustKey('2026-08', 'G1', gone.id, 'extra_session'))

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

/* ---------- chia phần lệch kiểm kho: tổng phải khớp TUYỆT ĐỐI ---------- */

const est3 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const sum = (o) => Object.keys(o).reduce((x, k) => x + o[k], 0)
// 16 ÷ 3 không chia hết — phần dư dồn vào buổi cuối, tổng vẫn đúng 16.
assert.equal(sum(spreadDiff(est3, 16)), 16)
assert.equal(sum(spreadDiff(est3, -5)), -5, 'lệch âm cũng phải khớp')
assert.equal(sum(spreadDiff(est3, 0)), 0)
assert.equal(sum(spreadDiff([{ id: 'a' }], 7)), 7)
assert.deepEqual(spreadDiff([], 9), {}, 'không có buổi ước lượng thì không chia đi đâu cả')

/* ---------- nhắc kiểm kho ---------- */

const ck = (month) => ({ id: 'X' + month, date: month + '-28', month, counted: 0, systemLeft: 0, diff: 0, spread: 0 })
assert.equal(checkDue({ ...db, purchases: [], stockChecks: [] }), '', 'chưa mua cầu thì không có gì để đếm')
assert.equal(checkDue({ ...db, stockChecks: [] }), 'never', 'đã mua cầu mà chưa kiểm lần nào')
assert.equal(checkDue({ ...db, stockChecks: [ck('2026-08')] }), '', 'tháng này kiểm rồi thì im')
assert.equal(checkDue({ ...db, stockChecks: [ck('2026-01')] }), 'stale', 'quá lâu không kiểm')
const dbLow = {
  ...db,
  purchases: [{ id: 'P0', date: '2026-08-01', typeId: 'S1', tubes: 0, extra: 10, qty: 10, pricePerTube: 0, total: 300000, payer: '', note: '' }],
  stockChecks: [ck('2026-07')],
}
assert.ok(stock(dbLow).left < cfg.shuttle.checkLowStock, 'dựng đúng cảnh tồn kho thấp')
assert.equal(checkDue(dbLow), 'low')

/* ---------- số buổi còn lại trong tháng ---------- */
const dbToday = { ...db, today: '2026-08-19' }
assert.equal(remainSessions(dbToday, 'G1', '2026-08'), 2, 'B7 (23/08) và B9 (30/08)')
assert.equal(remainSessions(dbToday, 'G2', '2026-08'), 2, 'B6 (21/08) và B8 (28/08)')

console.log('money check: OK')
