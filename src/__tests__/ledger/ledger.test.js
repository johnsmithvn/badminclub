// node src/__tests__/ledger.test.js
import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import { CATS, MANUAL_CATS, availableBalance, catLabel, dailySummary, fundBalance, groupKey, ledger, ledgerGrouped, monthFlow } from '#lib/ledger.js'
import { advanceRows, courtCost, courtExtraCost, freezeCost, isVault, soldTotal, unfrozenCost } from '#lib/money.js'
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

/* ---------- SỔ QUỸ KHÔNG ĐƯỢC TRÔI KHI CHỦ SÂN TĂNG GIÁ (migration 0012) ----------
 * P2 đóng băng giá thành ở tầng BUỔI, nhưng sổ quỹ ghi tiền sân bằng courtCost/courtExtraCost —
 * hai hàm cộng từ rowCost, mà rowCost nhân giá HIỆN TẠI. Hậu quả: chủ sân tăng giá thì dòng chi
 * của buổi đã chốt năm ngoái đổi số, trong khi card giá thành ngay cạnh nó đứng yên. Thủ quỹ đối
 * chiếu với sao kê ngân hàng sẽ thấy lệch mà không có gì giải thích.
 */
const dbl = (d) => ({ ...d, courts: d.courts.map((c) => ({ ...c, price: c.price * 2 })) })
const freezeAll = (d) => ({
  ...d,
  sessions: d.sessions.map((s) => (s.status === 'closed' ? { ...s, ...freezeCost(d, s, '2026-08-02') } : s)),
})
const courtTotal = (d) => ledger(d).filter((r) => r.cat === CATS.court).reduce((t, r) => t + r.amount, 0)

// Chưa đóng băng thì trôi — hành vi cũ, giữ nguyên cho dữ liệu có sẵn (không backfill).
assert.notEqual(courtTotal(dbl(perSession)), courtTotal(perSession),
  'buổi chưa đóng băng vẫn theo giá sân hiện tại, đúng như cũ')

// Đã chốt (đóng băng) thì đứng yên — đây là thứ 0012 mua về.
const psFrozen = freezeAll(perSession)
assert.equal(courtTotal(psFrozen), courtTotal(perSession), 'đóng băng không được làm lệch số đang hiện')
assert.equal(courtTotal(dbl(psFrozen)), courtTotal(perSession),
  'chủ sân tăng giá KHÔNG được đổi dòng chi tiền sân của buổi đã chốt')

// Sân thuê thêm đi qua cùng một rowCost nên cũng phải đứng yên.
const exFrozen = freezeAll(withExtra)
const exTotal = (d) => ledger(d).filter((r) => r.cat === CATS.courtExtra).reduce((t, r) => t + r.amount, 0)
assert.equal(exTotal(exFrozen), 260000)
assert.equal(exTotal(dbl(exFrozen)), 260000, 'dòng chi sân thuê thêm của buổi đã chốt phải đứng yên')
assert.notEqual(exTotal(dbl(withExtra)), 260000, 'buổi chưa đóng băng thì vẫn trôi')

// Mở lại buổi → thả băng cả từng dòng sân, số sống lại theo giá mới.
const thawed = {
  ...psFrozen,
  sessions: psFrozen.sessions.map((s) => ({ ...s, ...unfrozenCost(s) })),
}
assert.equal(courtTotal(dbl(thawed)), courtTotal(dbl(perSession)),
  'mở lại buổi thì tiền sân phải sống lại theo giá mới')
assert.notEqual(courtTotal(dbl(thawed)), courtTotal(dbl(psFrozen)),
  'thả băng phải thật sự đổi số, không thì phép so trên vô nghĩa')
// Thả băng gọi TRẦN (không truyền buổi) không được xoá sạch sân của buổi.
assert.ok(psFrozen.sessions.every((s) => ({ ...s, ...unfrozenCost() }).courts.length === s.courts.length),
  'unfrozenCost() gọi thiếu tham số không được biến courts thành mảng rỗng')

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

// `groupKey` là công thức mà `appActions` phải dùng lại để bung sẵn nhóm vừa ghi vào.
// Ghi một khoản TRÙNG ngày + hạng mục + chiều với khoản đã có thì nó chui vào dòng cũ, dòng cũ
// đổi thành "N dòng" và màn hình KHÔNG có dòng nào mới — người ghi tưởng bấm hụt rồi ghi lại
// lần nữa, thành hai khoản chi trùng trong sổ. Đây là bug thật đã gặp, khoá lại ở đây.
assert.equal(
  groupKey({ date: '2026-09-01', cat: CATS.other, dir: 'out' }),
  groupKey({ date: '2026-09-01', cat: CATS.other, dir: 'out' }),
  'hai khoản trùng ngày + hạng mục + chiều PHẢI cùng khoá — nếu tách khoá thì action bung nhầm nhóm'
)
assert.notEqual(
  groupKey({ date: '2026-09-01', cat: CATS.other, dir: 'out' }),
  groupKey({ date: '2026-09-01', cat: CATS.other, dir: 'in' }),
  'thu và chi cùng ngày cùng hạng mục không được gộp chung')
assert.notEqual(
  groupKey({ date: '2026-09-01', cat: CATS.other, dir: 'out' }),
  groupKey({ date: '2026-09-02', cat: CATS.other, dir: 'out' }),
  'khác ngày không được gộp chung')
// Tiền sân và khoản ứng giữ riêng từng dòng để còn đọc được tên sân.
assert.equal(groupKey({ id: 'cbX', date: '2026-09-01', cat: CATS.court, dir: 'out' }), 'cbX')
assert.equal(groupKey({ id: 'puY', date: '2026-09-01', cat: CATS.shuttle, dir: 'advance' }), 'puY')
assert.ok(grouped.every((g) => g.key === groupKey(g.items[0])),
  'ledgerGrouped phải dùng đúng groupKey — lệch là action bung một nhóm không tồn tại')

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

/* ---------- LUẬT NGƯỜI GIỮ QUỸ: thành viên ứng tiền (migration 0011) ---------- */

const pu = (x) => ledger(x).filter((r) => r.id === 'puP3')       // đợt cầu 3.300.000
const bal = (x) => fundBalance(x)
const withP3 = (patch) => ({ ...db, purchases: db.purchases.map((p) => (p.id === 'P3' ? { ...p, ...patch } : p)) })

// Fixture chưa có payerId (dữ liệu prototype cũ) → coi như quỹ trả thẳng, giữ nguyên hành vi cũ.
assert.equal(pu(db).length, 1, 'không có người trả thì vẫn là chi của quỹ')
assert.equal(pu(db)[0].date, '2026-08-17')

// M1 Thúy là owner → két. Két trả thì tiền ra khỏi quỹ ngay hôm mua.
const byOwner = withP3({ payerId: 'M1' })
assert.equal(pu(byOwner)[0].date, '2026-08-17')
assert.equal(bal(byOwner), bal(db), 'két trả: số dư y như cũ')

// M8 Đạt là treasurer → cũng là két.
assert.equal(pu(withP3({ payerId: 'M8' })).length, 1, 'thủ quỹ cũng là két')

// M7 Thắng em là member thường → ứng tiền. Chưa trả lại thì KHÔNG có dòng chi nào.
const byMember = withP3({ payerId: 'M7' })
assert.equal(pu(byMember).length, 0, 'thành viên ứng: khoản chi chưa vào sổ')
assert.equal(bal(byMember), bal(db) + 3300000, 'số dư CAO HƠN đúng bằng khoản đang nợ')

// Trả lại rồi thì dòng chi xuất hiện, mang NGÀY TRẢ chứ không phải ngày mua.
const repaid = withP3({ payerId: 'M7', repaidAt: '2026-08-25' })
assert.equal(pu(repaid).length, 1)
assert.equal(pu(repaid)[0].date, '2026-08-25', 'ngày tiền rời két, không phải ngày mua')
assert.ok(pu(repaid)[0].label.indexOf('17/08') >= 0, 'nhãn phải nhắc ngày mua gốc, không thì đọc nhầm')
assert.equal(bal(repaid), bal(db), 'trả xong thì số dư về đúng như quỹ tự trả')

// Hoá đơn sân đi cùng một luật.
const billMember = { ...db, courtBills: db.courtBills.map((b) => (b.id === 'SB1' ? { ...b, payerId: 'M7' } : b)) }
assert.equal(ledger(billMember).filter((r) => r.id === 'cbSB1').length, 0, 'hoá đơn sân do thành viên ứng')
assert.equal(bal(billMember), bal(db) + 1920000)

/* ---------- danh sách khoản ứng ---------- */
const adv = advanceRows(byMember)
assert.equal(adv.length, 1)
assert.equal(adv[0].kind, 'shuttle')
assert.equal(adv[0].memberId, 'M7')
assert.equal(adv[0].amount, 3300000)
assert.equal(adv[0].repaidAt, '')
assert.deepEqual(advanceRows(byOwner), [], 'két trả thì không phải khoản ứng')
assert.equal(advanceRows(repaid)[0].repaidAt, '2026-08-25', 'đã trả vẫn còn trong danh sách, có ngày')
assert.equal(advanceRows(db).length, 0, 'fixture gốc: không ai ứng')
// Đợt P1 tổng 0 đ (cầu dư mang sang) — không phải khoản nợ ai.
assert.deepEqual(advanceRows(withP3({ payerId: 'M7', total: 0 })).filter((r) => r.id === 'P3'), [])

assert.equal(isVault(db, 'M1'), true, 'owner')
assert.equal(isVault(db, 'M8'), true, 'treasurer')
assert.equal(isVault(db, 'M7'), false, 'member thường')
assert.equal(isVault(db, 'M3'), false, 'host không phải két')
assert.equal(isVault(db, null), true, 'không ghi người trả = quỹ trả thẳng')

/* ---------- T2 · số dư sổ vs số dư khả dụng ---------- */

// Fixture không nợ ai → hai số bằng nhau, không có ô nào phải hiện.
const av0 = availableBalance(db)
assert.equal(av0.owed, 0)
assert.equal(av0.available, av0.balance)

// Thành viên ứng 3.300.000 chưa được trả: số dư SỔ cao lên (chi chưa vào sổ), khả dụng thì không.
const avAdv = availableBalance(byMember)
assert.equal(avAdv.advance, 3300000)
assert.equal(avAdv.balance, av0.balance + 3300000, 'sổ cao hơn vì khoản chi chưa ghi')
assert.equal(avAdv.available, av0.balance, 'khả dụng đứng yên — đó mới là điểm của T2')

// Trả rồi thì hết nghĩa vụ, hai số bằng nhau trở lại.
assert.equal(availableBalance(repaid).owed, 0)

// Back tiền: chỉ khoản ĐÃ CHỐT, trả tiền mặt, chưa trả mới là nghĩa vụ.
const withBack = (adj) => ({ ...db, adjustments: adj })
const A = (over) => ({
  id: 'a1', key: 'k', month: '2026-08', groupId: 'G1', memberId: 'M5', kind: 'absent_back',
  sessions: 2, unit: 40000, amount: -80000, settle: 'cash', paid: false, paidAt: null, ...over,
})
assert.equal(availableBalance(withBack([A()])).back, 80000, 'quỹ nợ người: amount âm → phải trả')
assert.equal(availableBalance(withBack([A({ paid: true })])).back, 0, 'đã trả thì hết nghĩa vụ')
assert.equal(availableBalance(withBack([A({ settle: 'offset_next_dues' })])).back, 0,
  'trừ vào quỹ tháng sau: không đồng nào rời két')
assert.equal(availableBalance(withBack([A({ amount: 60000 })])).back, 0,
  'amount dương = NGƯỜI nợ quỹ, đó là phải thu chứ không phải nghĩa vụ')

// Hai nguồn nghĩa vụ cộng dồn.
const both = { ...byMember, adjustments: [A()] }
assert.equal(availableBalance(both).owed, 3300000 + 80000)
assert.equal(availableBalance(both).available, availableBalance(both).balance - 3380000)

/* ---------- nhãn hạng mục ---------- */
// `cat` lưu là KEY ổn định; đổi câu chữ hay đổi ngôn ngữ KHÔNG được làm đổi dữ liệu đã ghi
// (RULES §3.3). Mọi key trong CATS phải có nhãn, không thì sổ quỹ hiện thẳng 'ledger.cat.back'.
Object.values(CATS).forEach((c) => {
  assert.ok(catLabel(c) && !catLabel(c).includes('ledger.cat.'), 'thiếu nhãn i18n cho hạng mục ' + c)
})
assert.ok(MANUAL_CATS.every((c) => Object.values(CATS).includes(c)),
  'hạng mục ghi tay phải nằm trong CATS')
assert.ok(MANUAL_CATS.includes(CATS.back),
  'phải ghi tay được khoản back: người đã ngưng hoạt động không còn sinh dòng đối chiếu nào')

console.log('ledger check: OK')
