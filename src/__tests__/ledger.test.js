// node src/__tests__/ledger.test.js
import assert from 'node:assert/strict'
import { seed } from './fixture.js'
import { CATS, dailySummary, fundBalance, ledger, ledgerGrouped, monthFlow } from '#lib/ledger.js'
import { courtCost, courtExtraCost, soldTotal } from '#lib/money.js'
import { monthOf } from '#utils/dates.js'

const db = seed()
const rows = ledger(db)
const cats = (rs) => [...new Set(rs.map((r) => r.cat))].sort()

/* ---------- cấu trúc ---------- */
assert.ok(rows.length > 0)
assert.ok(
  rows.every((r, i) => i === 0 || rows[i - 1].date <= r.date),
  'sổ quỹ phải sắp theo ngày tăng dần'
)
assert.ok(rows.every((r) => r.dir === 'in' || r.dir === 'out'), 'chiều chỉ có in/out')
assert.ok(rows.every((r) => typeof r.amount === 'number' && Number.isFinite(r.amount)))
assert.ok(rows.every((r) => r.label && r.cat), 'mọi dòng phải có nhãn và hạng mục để giải thích được')
assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'id dòng không được trùng')

/* ---------- dòng mở sổ ---------- */
const open = rows.filter((r) => r.cat === CATS.opening)
assert.equal(open.length, 1, 'chỉ một dòng mang sang')
assert.equal(open[0].amount, 6000000)
assert.equal(open[0].date, '2026-07-01')
assert.equal(open[0].dir, 'in')

/* ---------- số dư = tổng thu − tổng chi ---------- */
const sumIn = rows.filter((r) => r.dir === 'in').reduce((t, r) => t + r.amount, 0)
const sumOut = rows.filter((r) => r.dir === 'out').reduce((t, r) => t + r.amount, 0)
assert.equal(fundBalance(db), sumIn - sumOut)

/* ---------- chế độ trả tiền sân ---------- */
// CLB1 trả TRỌN THÁNG: tiền sân lấy từ court_bills, KHÔNG ghi theo từng buổi
assert.equal(db.club.courtPayMode, 'month')
const courtRows = rows.filter((r) => r.cat === CATS.court)
assert.equal(courtRows.length, 2, 'hai hoá đơn sân tháng 08')
assert.equal(courtRows.reduce((t, r) => t + r.amount, 0), 1920000 + 1040000)
assert.ok(courtRows.every((r) => r.dir === 'out'))

// Thuê thêm sân vẫn ghi chi riêng theo buổi (nằm ngoài hoá đơn tháng) — seed không có buổi nào extra
assert.equal(rows.filter((r) => r.cat === CATS.courtExtra).length, 0)
const withExtra = {
  ...db,
  sessions: db.sessions.map((s) =>
    s.id === 'B1'
      ? { ...s, courts: s.courts.concat([{ courtId: 'C3', from: '20:00', to: '22:00', sold: false, soldAmount: 0, extra: true }]) }
      : s
  ),
}
const extraRows = ledger(withExtra).filter((r) => r.cat === CATS.courtExtra)
assert.equal(extraRows.length, 1, 'buổi đã chốt có sân thuê thêm thì phải có dòng chi riêng')
assert.equal(extraRows[0].amount, 260000)
assert.equal(extraRows[0].amount, courtExtraCost(withExtra, withExtra.sessions.find((s) => s.id === 'B1')))

// Đổi sang trả TỪNG BUỔI: mỗi buổi đã chốt một dòng, không dùng court_bills
const perSession = { ...db, club: { ...db.club, courtPayMode: 'session' } }
const psCourt = ledger(perSession).filter((r) => r.cat === CATS.court)
const closed = db.sessions.filter((s) => s.status === 'closed')
assert.equal(psCourt.length, closed.length)
assert.equal(
  psCourt.reduce((t, r) => t + r.amount, 0),
  closed.reduce((t, s) => t + courtCost(db, s), 0),
  'trả từng buổi thì ghi courtCost (tổng mọi dòng sân), không phải courtNet'
)
assert.equal(ledger(perSession).filter((r) => r.cat === CATS.courtExtra).length, 0,
  'trả từng buổi thì không tách dòng thuê thêm — đã nằm trong courtCost')

/* ---------- bán sân dư ---------- */
const sold = rows.filter((r) => r.cat === CATS.courtSold)
assert.equal(sold.length, 1, 'chỉ B3 bán sân')
assert.equal(sold[0].amount, 240000)
assert.equal(sold[0].amount, soldTotal(db.sessions.find((s) => s.id === 'B3')))
assert.equal(sold[0].dir, 'in')
// Buổi chưa chốt mà có sân bán thì KHÔNG vào sổ
const soldButOpen = { ...db, sessions: db.sessions.map((s) => (s.id === 'B3' ? { ...s, status: 'open' } : s)) }
assert.equal(ledger(soldButOpen).filter((r) => r.cat === CATS.courtSold).length, 0,
  'buổi chỉ ảnh hưởng tiền khi status = closed')

/* ---------- quỹ tháng, khách, mua cầu ---------- */
const dues = rows.filter((r) => r.cat === CATS.dues)
assert.equal(dues.length, db.dues.filter((d) => d.paidAmount > 0).length, 'chỉ dues đã nhận tiền mới vào sổ')
assert.ok(dues.every((r) => r.dir === 'in'))
assert.equal(dues.reduce((x, r) => x + r.amount, 0),
  db.dues.reduce((x, d) => x + (d.paidAmount || 0), 0), 'sổ quỹ ghi đúng tổng đã nhận')

// ĐÓNG THIẾU: phải đóng 250.000, đưa trước 150.000 → sổ quỹ chỉ được thấy 150.000.
// Cờ boolean cũ không ghi được cảnh này: tick thì thừa 100.000, không tick thì thiếu 150.000.
const someDue = db.dues.find((d) => d.paidAmount > 0)
const partial = {
  ...db,
  dues: db.dues.map((d) => (d.id === someDue.id ? { ...d, paidAmount: 150000, amount: 250000 } : d)),
}
const pr = ledger(partial).filter((r) => r.cat === CATS.dues && r.id === 'du' + someDue.id)
assert.equal(pr.length, 1)
assert.equal(pr[0].amount, 150000, 'ghi số ĐÃ NHẬN, không phải số phải đóng')
assert.ok(pr[0].label.includes('100.000'), 'nhãn phải nói còn thiếu bao nhiêu')
assert.equal(fundBalance(partial), fundBalance(db) - someDue.paidAmount + 150000)

// Chưa nhận đồng nào → không có dòng nào.
const none = { ...db, dues: db.dues.map((d) => ({ ...d, paidAmount: 0 })) }
assert.equal(ledger(none).filter((r) => r.cat === CATS.dues).length, 0)

const guests = rows.filter((r) => r.cat === CATS.guest)
assert.equal(guests.length, db.sessionGuests.filter((g) => g.paid).length, 'chỉ khách đã trả mới vào sổ')

const buys = rows.filter((r) => r.cat === CATS.shuttle)
assert.equal(buys.length, 2, 'P1 total = 0 nên không phải giao dịch tiền')
assert.equal(buys.reduce((t, r) => t + r.amount, 0), 3200000 + 3300000)

/* ---------- đối chiếu buổi chỉ vào sổ khi đã trả / đã thu ---------- */
assert.equal(rows.filter((r) => r.cat === CATS.back).length, 0)
const adj = (x) => ({
  id: 'AJ1', key: '2026-08:G1:M5:absent_back', month: '2026-08', groupId: 'G1', memberId: 'M5',
  kind: 'absent_back', sessions: 2, unit: 40000, amount: -80000, settle: 'cash',
  paid: true, paidAt: null, ...x,
})
// Chiều ÂM: quỹ trả lại người vắng → một dòng CHI.
const paidBack = { ...db, adjustments: [adj({})] }
const bk = ledger(paidBack).filter((r) => r.cat === CATS.back)
assert.equal(bk.length, 1)
assert.equal(bk[0].amount, 80000, 'sổ quỹ ghi số dương, chiều nằm ở dir')
assert.equal(bk[0].date, '2026-08-28', 'back ghi ngày month-28')
assert.equal(bk[0].dir, 'out')
assert.equal(fundBalance(paidBack), fundBalance(db) - 80000)

// Chiều DƯƠNG: người đi thêm buổi trả quỹ → một dòng THU, hạng mục riêng.
const paidExtra = {
  ...db,
  adjustments: [adj({ kind: 'extra_session', amount: 63000, paidAt: '2026-08-20' })],
}
const ex = ledger(paidExtra).filter((r) => r.cat === CATS.extra)
assert.equal(ex.length, 1)
assert.equal(ex[0].dir, 'in')
assert.equal(ex[0].amount, 63000)
assert.equal(ex[0].date, '2026-08-20', 'có paidAt thì ghi đúng ngày đó')
assert.equal(fundBalance(paidExtra), fundBalance(db) + 63000)

// Chưa trả → không có dòng nào.
assert.equal(ledger({ ...db, adjustments: [adj({ paid: false })] }).filter((r) => r.cat === CATS.back).length, 0)

// Trừ vào quỹ tháng sau → KHÔNG có giao dịch, quỹ không đổi một đồng.
// Tiền không đổi tay lần nào, ghi vào sổ là bịa ra giao dịch không có thật.
const offset = { ...db, adjustments: [adj({ settle: 'offset_next_dues' })] }
assert.equal(ledger(offset).filter((r) => r.cat === CATS.back).length, 0)
assert.equal(fundBalance(offset), fundBalance(db), 'trừ vào tháng sau thì số dư đứng yên')

/* ---------- monthFlow KHÔNG tính dòng mang sang ---------- */
const flow = monthFlow(db, '2026-08')
const aug = rows.filter((r) => monthOf(r.date) === '2026-08')
assert.ok(!aug.some((r) => r.cat === CATS.opening), 'dòng mang sang nằm ở 2026-07')
assert.equal(flow.in, aug.filter((r) => r.dir === 'in').reduce((t, r) => t + r.amount, 0))
assert.equal(flow.out, aug.filter((r) => r.dir === 'out').reduce((t, r) => t + r.amount, 0))
// tháng 07 có dòng mang sang 6.000.000 nhưng monthFlow phải loại nó ra
const jul = monthFlow(db, '2026-07')
assert.equal(jul.in, 7004000, 'chỉ còn dòng chuyển sổ Excel, không có 6.000.000 mang sang')
assert.equal(jul.out, 7475000)

/* ---------- gộp dòng trùng ngày + hạng mục + chiều ---------- */
const grouped = ledgerGrouped(db, '2026-08')
assert.ok(grouped.length > 0)
assert.ok(
  grouped.every((g) => g.amount === g.items.reduce((t, x) => t + x.amount, 0)),
  'tiền dòng cha = tổng dòng con'
)
assert.equal(
  grouped.reduce((t, g) => t + g.items.length, 0),
  aug.length,
  'gộp không được làm mất dòng nào'
)
assert.equal(new Set(grouped.map((g) => g.key)).size, grouped.length, 'key nhóm phải duy nhất')
// 20 người đóng quỹ cùng ngày 03/08 phải gộp thành MỘT dòng
const duesGroup = grouped.find((g) => g.cat === CATS.dues && g.date === '2026-08-03')
assert.ok(duesGroup && duesGroup.items.length > 1, 'nhiều người đóng cùng ngày phải gộp')
assert.equal(duesGroup.items.length, db.dues.filter((d) => d.paidAmount > 0 && d.paidAt === '2026-08-03').length)

/* ---------- tổng hợp theo ngày: quỹ luỹ kế ---------- */
const sum = dailySummary(db, '2026-08')
assert.equal(sum.opening, rows.filter((r) => monthOf(r.date) < '2026-08')
  .reduce((t, r) => t + (r.dir === 'in' ? r.amount : -r.amount), 0), 'số dư đầu tháng = luỹ kế trước đó')
assert.ok(sum.rows.every((r, i) => i === 0 || sum.rows[i - 1].date < r.date), 'sắp theo ngày')
// quỹ luỹ kế cộng dồn đúng
let run = sum.opening
sum.rows.forEach((r) => {
  run += r.in - r.out
  assert.equal(r.balance, run)
})
assert.equal(sum.rows[sum.rows.length - 1].balance, fundBalance(db),
  'quỹ cuối tháng cuối cùng phải bằng số dư toàn bộ')
assert.deepEqual(cats(rows.filter((r) => r.amount < 0)), [], 'không dòng nào có số tiền âm — dùng dir thay vì dấu')

console.log('ledger check: OK')
