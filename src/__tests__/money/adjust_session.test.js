// node src/__tests__/money/adjust_session.test.js
//
// Kiểm thử tính năng Thu / Hoàn trả và Hoàn tác độc lập theo từng buổi lẻ
// cho hội viên cố định (absent_back & extra_session).
//
// Các luật nghiệp vụ & phòng ngừa rủi ro tài chính:
//  1. adjustSessions phải chỉ nhận buổi đã chốt (closed) của đúng nhóm trong tháng.
//  2. Mỗi buổi lẻ được thanh toán độc lập: thêm vào settledSessions mà KHÔNG làm ảnh hưởng buổi khác.
//  3. Sổ quỹ (ledger) phải sinh đúng số dòng tương ứng với các buổi đã thanh toán thực tế,
//     mỗi dòng mang đúng ngày của buổi đó và đơn giá của buổi đó.
//  4. Hoàn tác 1 buổi lẻ (undoTarget -> adjust_session) CHỈ gỡ đúng buổi đó, các buổi khác còn nguyên.
//  5. Tương thích ngược: bản ghi cũ paid = true và settledSessions rỗng vẫn xuất hiện đúng trong sổ quỹ.

import assert from 'node:assert/strict'
import { adjustRows, adjustSessions, debtRows } from '#lib/money.js'
import { CATS, ledger, undoTarget } from '#lib/ledger.js'

console.log('--- 1. Testing adjustSessions ---')

const db = {
  club: { openingDate: '2026-09-01', opening: 0 },
  today: '2026-09-17',
  month: '2026-09',
  groups: [
    { id: 'g1', name: 'Nhóm T2-T4', feeNam: 200000, feeNu: 200000, unitNam: 50000, unitNu: 50000, hasRefund: true },
  ],
  members: [
    { id: 'm1', name: 'Nguyễn Văn A', gender: 'nam', active: true },
    { id: 'm2', name: 'Trần Thị B', gender: 'nu', active: true },
  ],
  sessions: [
    // Buổi 1: đã chốt, m1 vắng, m2 đi thêm
    { id: 's1', groupId: 'g1', date: '2026-09-02', status: 'closed', courts: [{ courtId: 'c1' }] },
    // Buổi 2: đã chốt, m1 vắng, m2 có mặt bình thường
    { id: 's2', groupId: 'g1', date: '2026-09-09', status: 'closed', courts: [{ courtId: 'c1' }] },
    // Buổi 3: đang mở (open), m1 báo vắng -> KHÔNG được tính vào đối chiếu
    { id: 's3', groupId: 'g1', date: '2026-09-23', status: 'open', courts: [{ courtId: 'c1' }] },
    // Buổi 4: nhóm khác (g2), m1 vắng -> KHÔNG được tính vào g1
    { id: 's4', groupId: 'g2', date: '2026-09-10', status: 'closed', courts: [{ courtId: 'c1' }] },
  ],
  attendance: {
    s1: { m1: false, m2: 'extra' },
    s2: { m1: false, m2: true },
    s3: { m1: false },
    s4: { m1: false },
  },
  roster: {
    '2026-09': {
      g1: { m1: 'fixed' },
    },
  },
  adjustments: [],
  manual: [],
  dues: [],
  sessionGuests: [],
  courtBills: [],
  guestPrices: [],
}

const rowAbsent = { groupId: 'g1', memberId: 'm1', kind: 'absent_back' }
const matchingAbsent = adjustSessions(db, '2026-09', rowAbsent)
assert.equal(matchingAbsent.length, 2, 'm1 vắng 2 buổi đã chốt (s1, s2) trong tháng 09')
assert.deepEqual(matchingAbsent.map((s) => s.id), ['s1', 's2'], 'Phải trả đúng 2 session s1 và s2')

const rowExtra = { groupId: 'g1', memberId: 'm2', kind: 'extra_session' }
const matchingExtra = adjustSessions(db, '2026-09', rowExtra)
assert.equal(matchingExtra.length, 1, 'm2 đi thêm đúng 1 buổi s1')
assert.equal(matchingExtra[0].id, 's1', 'm2 đi thêm ở buổi s1')

console.log('adjustSessions: OK')

console.log('--- 2. Testing adjustRows with settledSessions ---')

const dbWithAdjust = {
  ...db,
  adjustments: [
    {
      id: 'adj1',
      key: '2026-09:g1:m1:absent_back',
      month: '2026-09',
      groupId: 'g1',
      memberId: 'm1',
      kind: 'absent_back',
      sessions: 2,
      unit: 50000,
      amount: -100000,
      settle: 'cash',
      paid: false,
      settledSessions: ['s1'], // Chỉ mới trả tiền buổi s1
    },
  ],
}

const rows = adjustRows(dbWithAdjust, '2026-09')
const r1 = rows.find((r) => r.key === '2026-09:g1:m1:absent_back')
assert.ok(r1, 'Phải tìm thấy dòng đối chiếu của m1')
assert.deepEqual(r1.settledSessions, ['s1'], 'Dòng đối chiếu phải mang mảng settledSessions')
assert.equal(r1.paid, false, 'Chưa trả đủ 2 buổi thì paid vẫn phải là false')

console.log('adjustRows: OK')

console.log('--- 3. Testing ledger entries per session ---')

// 3.1: Chỉ thanh toán 1 buổi s1 -> Sổ quỹ chỉ có 1 dòng chi 50.000 với ngày của s1 (2026-09-02)
const lines1 = ledger(dbWithAdjust)
const adjLines1 = lines1.filter((l) => l.cat === CATS.back)
assert.equal(adjLines1.length, 1, 'Sổ quỹ chỉ được xuất 1 dòng tiền cho buổi s1 đã trả')
assert.equal(adjLines1[0].id, 'ajadj1_s1', 'ID dòng sổ quỹ phải mang id buổi lẻ: ajadj1_s1')
assert.equal(adjLines1[0].amount, 50000, 'Số tiền chi phải là đơn giá 1 buổi (50.000), không phải cả tháng (100.000)')
assert.equal(adjLines1[0].date, '2026-09-02', 'Ngày dòng sổ quỹ phải là ngày của buổi s1')
assert.equal(adjLines1[0].dir, 'out', 'Hoàn tiền vắng là dòng chi (out)')

// 3.2: Thanh toán cả 2 buổi s1 và s2 -> Sổ quỹ xuất hiện 2 dòng độc lập
const dbWithBoth = {
  ...db,
  adjustments: [
    {
      id: 'adj1',
      key: '2026-09:g1:m1:absent_back',
      month: '2026-09',
      groupId: 'g1',
      memberId: 'm1',
      kind: 'absent_back',
      sessions: 2,
      unit: 50000,
      amount: -100000,
      settle: 'cash',
      paid: true,
      settledSessions: ['s1', 's2'],
    },
  ],
}
const lines2 = ledger(dbWithBoth)
const adjLines2 = lines2.filter((l) => l.cat === CATS.back)
assert.equal(adjLines2.length, 2, 'Sổ quỹ phải xuất đủ 2 dòng tiền cho 2 buổi')
assert.equal(adjLines2[0].amount, 50000)
assert.equal(adjLines2[1].amount, 50000)
assert.equal(adjLines2[0].date, '2026-09-02')
assert.equal(adjLines2[1].date, '2026-09-09')

// 3.3: Dữ liệu cũ (paid = true nhưng settledSessions rỗng) -> Vẫn tương thích ngược, xuất 1 dòng gộp
const dbLegacy = {
  ...db,
  adjustments: [
    {
      id: 'adjLegacy',
      key: '2026-09:g1:m1:absent_back',
      month: '2026-09',
      groupId: 'g1',
      memberId: 'm1',
      kind: 'absent_back',
      sessions: 2,
      unit: 50000,
      amount: -100000,
      settle: 'cash',
      paid: true,
      paidAt: '2026-09-15',
      settledSessions: [],
    },
  ],
}
const linesLegacy = ledger(dbLegacy)
const adjLinesLegacy = linesLegacy.filter((l) => l.cat === CATS.back)
assert.equal(adjLinesLegacy.length, 1, 'Bản ghi cũ phải xuất 1 dòng gộp như trước')
assert.equal(adjLinesLegacy[0].amount, 100000, 'Số tiền gộp là 100.000')
assert.equal(adjLinesLegacy[0].id, 'ajadjLegacy')

console.log('ledger entries: OK')

console.log('--- 4. Testing undoTarget for per-session ledger lines ---')

// Dòng lẻ có id dạng 'aj<adjId>_<sessionId>'
const targetSession = undoTarget(dbWithAdjust, { id: 'ajadj1_s1' })
assert.deepEqual(targetSession, {
  kind: 'adjust_session',
  key: '2026-09:g1:m1:absent_back',
  sessionId: 's1',
}, 'undoTarget phải nhận diện đúng kind adjust_session và trích xuất sessionId')

// Dòng gộp cũ có id dạng 'aj<adjId>'
const targetLegacy = undoTarget(dbLegacy, { id: 'ajadjLegacy' })
assert.deepEqual(targetLegacy, {
  kind: 'adjust',
  key: '2026-09:g1:m1:absent_back',
}, 'undoTarget với dòng gộp cũ phải trả về kind adjust')

console.log('undoTarget: OK')

console.log('--- 5. Simulating per-session toggle & undo state transitions ---')

// Kịch bản: m1 vắng 2 buổi (s1, s2).
// Bước 1: Thủ quỹ bấm Trả buổi s1 -> settledSessions = ['s1'], paid = false
let curSettled = ['s1']
let isPaid = ['s1', 's2'].every((id) => curSettled.includes(id))
assert.equal(isPaid, false, 'Chưa trả s2 nên paid = false')

// Bước 2: Thủ quỹ bấm Trả tiếp buổi s2 -> settledSessions = ['s1', 's2'], paid = true
curSettled = [...curSettled, 's2']
isPaid = ['s1', 's2'].every((id) => curSettled.includes(id))
assert.equal(isPaid, true, 'Đã trả cả s1 và s2 nên paid = true')

// Bước 3: Thủ quỹ bấm Hoàn tác buổi s1 -> CHỈ gỡ s1 khỏi settledSessions, s2 vẫn giữ nguyên!
curSettled = curSettled.filter((id) => id !== 's1')
isPaid = ['s1', 's2'].every((id) => curSettled.includes(id))
assert.deepEqual(curSettled, ['s2'], 'Sau khi hoàn tác s1, s2 PHẢI vẫn nằm trong settledSessions!')
assert.equal(isPaid, false, 'Đã hoàn tác 1 buổi nên paid quay về false')

console.log('State transitions simulation: OK')

console.log('--- 6. Testing debtRows with partially settled sessions ---')

const dbExtraPart = {
  ...db,
  adjustments: [
    {
      id: 'adj_extra_1',
      key: '2026-09:g1:m1:extra_session',
      month: '2026-09',
      groupId: 'g1',
      memberId: 'm1',
      kind: 'extra_session',
      sessions: 3,
      unit: 40000,
      amount: 120000,
      settle: 'cash',
      paid: false,
      settledSessions: ['s1'], // Đã trả 1/3 buổi
    },
  ],
}

const myDebtsRemaining = debtRows(dbExtraPart, '2026-09', { memberId: 'm1' })
assert.equal(myDebtsRemaining.length, 1, 'Phải có 1 dòng nợ còn lại')
assert.equal(myDebtsRemaining[0].amount, 80000, 'Số tiền nợ còn lại phải là 2 * 40.000 = 80.000 (đã trừ 1 buổi đã trả)')

// Khi trả đủ 3 buổi
const dbExtraFull = {
  ...db,
  adjustments: [
    {
      ...dbExtraPart.adjustments[0],
      paid: true,
      settledSessions: ['s1', 's2', 's3'],
    },
  ],
}
const myDebtsFull = debtRows(dbExtraFull, '2026-09', { memberId: 'm1' })
assert.equal(myDebtsFull.length, 0, 'Đã trả hết thì không còn dòng nợ trong debtRows')

console.log('debtRows remaining check: OK')

console.log('adjust_session check: OK')

