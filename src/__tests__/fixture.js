// FIXTURE CHO TEST — port nguyên từ prototype handoff (2 CLB, tháng 08/2026).
// App KHÔNG import file này: dữ liệu thật nằm ở Supabase (xem src/contexts/storage.js).
// Giữ lại vì 4 bộ test cần một bộ dữ liệu cố định, đủ ngóc ngách, để kiểm công thức tiền /
// sổ quỹ / chia sân mà không phải dựng DB.

export const LEVELS = ['Newbie', 'TBY', 'TB-', 'TB']

const GUEST_PRICES = [
  { level: 'Newbie', nam: 60000, nu: 50000 },
  { level: 'TBY', nam: 65000, nu: 55000 },
  { level: 'TB-', nam: 70000, nu: 60000 },
  { level: 'TB', nam: 75000, nu: 60000 },
]
const priceOf = (level, gender) => {
  const r = GUEST_PRICES.find((x) => x.level === level)
  return gender === 'nu' ? r.nu : r.nam
}

/* ---------- CLB 1: Phú Khê Badminton ---------- */

function club1Data() {
  const courts = [
    { id: 'C1', name: 'Sân Phú Khê 1', price: 120000, addr: 'Nhà TĐ Phú Khê', active: true },
    { id: 'C2', name: 'Sân Phú Khê 2', price: 120000, addr: 'Nhà TĐ Phú Khê', active: true },
    { id: 'C3', name: 'Sân Yên Phong', price: 130000, addr: '27 Lê Văn Lương', active: true },
  ]
  const groups = [
    { id: 'G1', name: 'Cố định Chủ nhật', short: 'CN', weekday: 0, feeNam: 250000, feeNu: 200000,
      from: '18:00', to: '20:00', courtIds: ['C1', 'C2'], quota: 34, active: true },
    { id: 'G2', name: 'Cố định Thứ 6', short: 'T6', weekday: 5, feeNam: 250000, feeNu: 200000,
      from: '20:00', to: '22:00', courtIds: ['C3'], quota: 23, active: true },
  ]

  const mk = (id, name, gender, level, groupIds, role) => ({
    id, name, gender, level, groupIds, role,
    phone: '09' + (10000000 + parseInt(id.slice(1), 10) * 137).toString(),
    joined: '2026-04-26', active: true, userId: null,
    pendingLevel: null, pendingLevelFrom: null,
  })
  const members = [
    mk('M1', 'Thúy', 'nu', 'TB-', ['G1'], 'owner'),
    mk('M2', 'Mai', 'nu', 'TBY', ['G1', 'G2'], 'member'),
    mk('M3', 'Vân Anh', 'nu', 'TB-', ['G1', 'G2'], 'host'),
    mk('M4', 'Giang nữ', 'nu', 'TBY', ['G1', 'G2'], 'member'),
    mk('M5', 'Hằng', 'nu', 'Newbie', ['G1'], 'member'),
    mk('M6', 'Hương', 'nu', 'TBY', ['G1'], 'member'),
    mk('M7', 'Thắng em', 'nam', 'TB', ['G1'], 'member'),
    mk('M8', 'Đạt', 'nam', 'TB', ['G1', 'G2'], 'treasurer'),
    mk('M9', 'Thành', 'nam', 'TB-', ['G1'], 'member'),
    mk('M10', 'Anh Tùng', 'nam', 'TB-', ['G1'], 'member'),
    mk('M11', 'Thiện', 'nam', 'TB-', ['G1'], 'member'),
    mk('M12', 'Kuro', 'nam', 'TB', ['G1', 'G2'], 'member'),
    mk('M13', 'Anh Vương', 'nam', 'TB-', ['G1', 'G2'], 'member'),
    mk('M14', 'Khải', 'nam', 'TBY', ['G1'], 'member'),
    mk('M15', 'Trường', 'nam', 'TB-', ['G1'], 'member'),
    mk('M16', 'Giang nam', 'nam', 'TBY', ['G2'], 'member'),
    mk('M17', 'Tùng', 'nam', 'TBY', [], 'member'),
    mk('M18', 'Long', 'nam', 'Newbie', [], 'member'),
  ]
  // Ba bản ghi đã ghép tài khoản; còn lại user_id = null (chủ CLB tạo tay).
  const linkMap = { M1: 'U1', M2: 'U2', M8: 'U3' }
  members.forEach((m) => { m.userId = linkMap[m.id] || null })

  const gs = (id, name, gender, level, by) => ({ id, name, gender, level, invitedBy: by, phone: '' })
  const guests = [
    gs('K1', 'Trang', 'nu', 'TBY', 'M2'), gs('K2', 'Bạn Trang', 'nam', 'TB-', 'M2'),
    gs('K3', 'Đức Anh', 'nam', 'TB', 'M8'), gs('K4', 'Hoa', 'nu', 'Newbie', 'M6'),
    gs('K5', 'Thắng', 'nam', 'TB-', 'M7'), gs('K6', 'Sĩ quan', 'nam', 'TB', 'M13'),
    gs('K7', 'Hiếu', 'nam', 'TBY', 'M10'), gs('K8', 'Vũ', 'nu', 'Newbie', 'M3'),
    gs('K9', 'Anh Quân', 'nam', 'TB-', 'M12'), gs('K10', 'Nguyên', 'nam', 'TBY', 'M9'),
    gs('K11', 'Sự', 'nu', 'TBY', 'M1'), gs('K12', 'Linh', 'nu', 'Newbie', 'M5'),
  ]

  const mkS = (id, date, groupId, status, used, mode) => {
    const g = groups.find((x) => x.id === groupId)
    const md = mode || 'tubes'
    const courtRows = g.courtIds.map((c) => ({
      courtId: c, from: g.from, to: g.to, sold: false, soldAmount: 0, soldTo: '', extra: false,
    }))
    const qt = md === 'quota' ? g.quota : used
    const tb = Math.floor(qt / 12)
    return {
      id, date, groupId, status, shuttleUsed: qt, shuttleTypeId: 'S1', note: '',
      shuttleMode: md, tubesOpened: tb, loose: qt - tb * 12, shuttleEst: md === 'quota',
      courts: courtRows, scheduleId: groupId === 'G1' ? 'SC1' : 'SC2',
    }
  }
  const sessions = [
    mkS('B1', '2026-08-02', 'G1', 'closed', 34), mkS('B2', '2026-08-07', 'G2', 'closed', 22),
    mkS('B3', '2026-08-09', 'G1', 'closed', 36), mkS('B4', '2026-08-14', 'G2', 'closed', 24),
    mkS('B5', '2026-08-16', 'G1', 'closed', 0, 'quota'), mkS('B6', '2026-08-21', 'G2', 'open', 0, 'quota'),
    mkS('B7', '2026-08-23', 'G1', 'open', 0, 'quota'), mkS('B8', '2026-08-28', 'G2', 'draft', 0, 'quota'),
    mkS('B9', '2026-08-30', 'G1', 'draft', 0, 'quota'),
  ]
  // Buổi B3 bán một sân cho CLB khác — sân đó không tính vào chi phí buổi.
  sessions.forEach((s) => {
    if (s.id === 'B3') s.courts[1] = { ...s.courts[1], sold: true, soldAmount: 240000, soldTo: 'CLB Yên Phong' }
  })

  const absent = { B1: ['M5', 'M15'], B2: ['M16'], B3: ['M6'], B4: [], B5: ['M5', 'M6', 'M15'] }
  const attendance = {}
  sessions.forEach((s) => {
    if (s.status !== 'closed') return
    const map = {}
    members.filter((m) => m.groupIds.indexOf(s.groupId) >= 0)
      .forEach((m) => { map[m.id] = (absent[s.id] || []).indexOf(m.id) < 0 })
    attendance[s.id] = map
  })
  attendance.B6 = {}
  attendance.B7 = {}
  members.filter((m) => m.groupIds.indexOf('G2') >= 0).forEach((m) => { attendance.B6[m.id] = m.id !== 'M16' })
  members.filter((m) => m.groupIds.indexOf('G1') >= 0)
    .forEach((m) => { attendance.B7[m.id] = ['M5', 'M15'].indexOf(m.id) < 0 })

  const sgSpec = [
    ['B1', 'K1', true], ['B1', 'K2', false], ['B1', 'K3', false], ['B1', 'K4', true], ['B1', 'K5', false], ['B1', 'K7', false],
    ['B2', 'K5', false], ['B2', 'K6', true],
    ['B3', 'K1', false], ['B3', 'K2', false], ['B3', 'K7', false], ['B3', 'K8', true], ['B3', 'K9', false], ['B3', 'K3', false], ['B3', 'K12', false],
    ['B4', 'K10', false], ['B4', 'K11', false],
    ['B5', 'K1', false], ['B5', 'K2', false], ['B5', 'K3', false], ['B5', 'K5', false], ['B5', 'K11', false], ['B5', 'K12', false], ['B5', 'K7', false], ['B5', 'K9', false],
    ['B7', 'K1', true], ['B7', 'K3', false], ['B7', 'K6', false],
  ]
  const sessionGuests = sgSpec.map((r, i) => {
    const g = guests.find((x) => x.id === r[1])
    return {
      id: 'SG' + (i + 1), sessionId: r[0], guestId: r[1], level: g.level, gender: g.gender,
      price: priceOf(g.level, g.gender), paid: r[2], invitedBy: g.invitedBy,
    }
  })

  const dues = []
  let dn = 0
  groups.forEach((g) => {
    members.filter((m) => m.groupIds.indexOf(g.id) >= 0).forEach((m) => {
      const unpaid = g.id === 'G1' && (m.id === 'M5' || m.id === 'M9')
      dues.push({
        id: 'D' + ++dn, month: '2026-08', groupId: g.id, memberId: m.id,
        amount: m.gender === 'nu' ? g.feeNu : g.feeNam,
        paidAmount: unpaid ? 0 : (m.gender === 'nu' ? g.feeNu : g.feeNam),
        paidAt: unpaid ? null : '2026-08-03', method: 'Chuyển khoản', note: '',
      })
    })
  })

  return {
    courts, groups, members, guests, sessions, attendance, sessionGuests, dues,
    guestPrices: GUEST_PRICES.map((x) => ({ ...x })),
    shuttleTypes: [
      { id: 'S1', name: 'TC77', perTube: 12, pricePerTube: 320000, active: true },
      { id: 'S2', name: 'Kumpoo K520', perTube: 12, pricePerTube: 280000, active: true },
    ],
    schedules: [
      { id: 'SC1', name: 'Cố định Chủ nhật', groupId: 'G1', weekdays: [0],
        rows: [{ courtId: 'C1', from: '18:00', to: '20:00' }, { courtId: 'C2', from: '18:00', to: '20:00' }],
        start: '2026-04-26', end: '', active: true },
      { id: 'SC2', name: 'Cố định Thứ 6', groupId: 'G2', weekdays: [5],
        rows: [{ courtId: 'C3', from: '20:00', to: '22:00' }], start: '2026-05-01', end: '', active: true },
    ],
    purchases: [
      { id: 'P1', date: '2026-08-01', typeId: 'S1', tubes: 0, extra: 29, qty: 29, pricePerTube: 0, total: 0,
        payer: 'Quỹ cũ', note: 'Bổ sung cầu dư tháng 7' },
      { id: 'P2', date: '2026-08-06', typeId: 'S1', tubes: 10, extra: 0, qty: 120, pricePerTube: 320000, total: 3200000,
        payer: 'Thúy', note: '' },
      { id: 'P3', date: '2026-08-17', typeId: 'S1', tubes: 10, extra: 0, qty: 120, pricePerTube: 330000, total: 3300000,
        payer: 'Thắng em', note: 'Đợt này 330k/ống' },
    ],
    stockChecks: [{ id: 'SK1', date: '2026-07-31', month: '2026-07', counted: 29, systemLeft: 29, diff: 0, spread: 0 }],
    courtBills: [
      { id: 'SB1', month: '2026-08', date: '2026-08-01', venue: 'Nhà TĐ Phú Khê', amount: 1920000,
        payer: 'Thúy · chuyển khoản', note: '4 buổi CN × 2 sân, trả trước' },
      { id: 'SB2', month: '2026-08', date: '2026-08-01', venue: 'Sân Yên Phong', amount: 1040000,
        payer: 'Thúy · chuyển khoản', note: '4 buổi T6 × 1 sân, trả trước' },
    ],
    manual: [
      { id: 'L1', date: '2026-08-10', dir: 'out', cat: 'withdraw', label: 'Trích quỹ cho Giải CLB 2026', amount: 1125000, by: 'Thúy' },
      { id: 'L2', date: '2026-08-09', dir: 'in', cat: 'other', label: 'Ủng hộ quỹ — sinh nhật anh Vương', amount: 500000, by: 'Thúy' },
      { id: 'L3', date: '2026-07-31', dir: 'in', cat: 'other', label: 'Tổng thu tháng 7 (số liệu chuyển từ Excel)', amount: 7004000, by: 'Chuyển sổ' },
      { id: 'L4', date: '2026-07-31', dir: 'out', cat: 'other', label: 'Tổng chi tháng 7 (số liệu chuyển từ Excel)', amount: 7475000, by: 'Chuyển sổ' },
    ],
    adjustments: [],
    roster: {
      '2026-09': {
        G1: { M1: 'fixed', M2: 'fixed', M3: 'fixed', M4: 'fixed', M5: 'off', M6: 'fixed', M7: 'fixed', M8: 'fixed',
          M9: 'fixed', M10: 'fixed', M11: 'fixed', M12: 'fixed', M13: 'fixed', M14: 'fixed', M15: 'off', M17: 'pending' },
        G2: { M2: 'fixed', M3: 'fixed', M4: 'fixed', M8: 'fixed', M12: 'fixed', M13: 'fixed', M16: 'off' },
      },
    },
    locked: {},
    changes: [
      { id: 'CH1', memberId: 'M14', field: 'level', from: 'TBY', to: 'TB-', by: 'member', effective: 'next', status: 'pending' },
      { id: 'CH2', memberId: 'M6', field: 'phone', from: '090' + (10000000 + 6 * 137).toString().slice(1),
        to: '0987 654 321', by: 'member', effective: 'now', status: 'pending' },
    ],
    lineups: {}, matches: [], playing: {}, courtMin: {}, courtGroups: {}, groupMode: {},
    sessionId: 'B5',
    seq: { B: 9, SG: sgSpec.length, D: dn, K: 12, M: 18, P: 3, L: 4, SC: 2, SK: 1, MT: 0 },
  }
}

/* ---------- CLB 2: Cầu lông Yên Phong ---------- */

function club2Data() {
  const courts = [{ id: 'C1', name: 'Sân Yên Phong A', price: 130000, addr: '27 Lê Văn Lương', active: true }]
  const groups = [
    { id: 'G1', name: 'Cố định Thứ 4', short: 'T4', weekday: 3, feeNam: 200000, feeNu: 170000,
      from: '19:00', to: '21:00', courtIds: ['C1'], quota: 20, active: true },
  ]
  const m2 = (id, name, gender, level, role, userId) => ({
    id, name, gender, level, groupIds: ['G1'], role,
    phone: '092' + (1000000 + parseInt(id.slice(1), 10) * 211).toString().slice(0, 7),
    joined: '2026-08-01', active: true, userId: userId || null, pendingLevel: null, pendingLevelFrom: null,
  })
  const members = [
    m2('M1', 'Thúy', 'nu', 'TB-', 'owner', 'U1'), m2('M2', 'Huy', 'nam', 'TBY', 'host', 'U4'),
    m2('M3', 'Sơn', 'nam', 'TB', 'member'), m2('M4', 'Lan', 'nu', 'TBY', 'member'),
    m2('M5', 'Tú', 'nam', 'TB-', 'member'), m2('M6', 'Bích', 'nu', 'Newbie', 'member'),
    m2('M7', 'Quyết', 'nam', 'TB-', 'treasurer'), m2('M8', 'Hà', 'nu', 'TBY', 'member'),
  ]
  const mkS = (id, date, status, used) => ({
    id, date, groupId: 'G1', status, shuttleUsed: used, shuttleTypeId: 'S1', note: '',
    shuttleMode: used ? 'tubes' : 'quota', tubesOpened: Math.floor(used / 12),
    loose: used - Math.floor(used / 12) * 12, shuttleEst: !used,
    courts: [{ courtId: 'C1', from: '19:00', to: '21:00', sold: false, soldAmount: 0, soldTo: '', extra: false }],
    scheduleId: 'SC1',
  })
  const sessions = [
    mkS('B1', '2026-08-05', 'closed', 18), mkS('B2', '2026-08-12', 'closed', 20),
    mkS('B3', '2026-08-19', 'open', 0), mkS('B4', '2026-08-26', 'draft', 0),
  ]
  const attendance = { B1: {}, B2: {}, B3: {} }
  members.forEach((m) => {
    attendance.B1[m.id] = m.id !== 'M6'
    attendance.B2[m.id] = true
    attendance.B3[m.id] = m.id !== 'M5'
  })
  const dues = members.map((m, i) => ({
    id: 'D' + (i + 1), month: '2026-08', groupId: 'G1', memberId: m.id,
    amount: m.gender === 'nu' ? 170000 : 200000,
    paidAmount: m.id === 'M6' ? 0 : (m.gender === 'nu' ? 170000 : 200000),
    paidAt: m.id !== 'M6' ? '2026-08-02' : null, method: 'Tiền mặt', note: '',
  }))

  return {
    courts, groups, members, guests: [], sessions, attendance, sessionGuests: [], dues,
    guestPrices: GUEST_PRICES.map((x) => ({ ...x })),
    shuttleTypes: [{ id: 'S1', name: 'TC77', perTube: 12, pricePerTube: 320000, active: true }],
    schedules: [
      { id: 'SC1', name: 'Cố định Thứ 4', groupId: 'G1', weekdays: [3],
        rows: [{ courtId: 'C1', from: '19:00', to: '21:00' }], start: '2026-08-01', end: '', active: true },
    ],
    purchases: [
      { id: 'P1', date: '2026-08-01', typeId: 'S1', tubes: 5, extra: 0, qty: 60, pricePerTube: 320000,
        total: 1600000, payer: 'Huy', note: '' },
    ],
    stockChecks: [], courtBills: [], manual: [], adjustments: [], roster: {}, locked: {}, changes: [],
    lineups: {}, matches: [], playing: {}, courtMin: {}, courtGroups: {}, groupMode: {},
    sessionId: 'B3',
    seq: { B: 4, SG: 0, D: dues.length, K: 0, M: members.length, P: 1, L: 0, SC: 1, SK: 0, MT: 0 },
  }
}

/* ---------- toàn bộ state ban đầu ---------- */

export function seed() {
  const club1 = {
    id: 'CL1', name: 'Phú Khê Badminton', code: '8NJHE8', opening: 6000000, openingDate: '2026-07-01',
    openingBy: 'Thúy',
    bank: { holder: 'LE THI THUY ANH', no: '8804505982', bank: 'BIDV - PGD Cầu Dền' },
    seeDebtEachOther: false, seeFund: true, roundUnit: true, lockDay: 25, courtPayMode: 'month',
    linkModes: { code: true, invite: true, phone: true },
    // toDb LUÔN đặt club.levels — fixture phải cùng hình, không thì test chạy trên dữ liệu
    // không bao giờ tồn tại lúc chạy thật.
    levels: LEVELS,
  }
  const club2 = {
    id: 'CL2', name: 'Cầu lông Yên Phong', code: 'YP42K9', opening: 1200000, openingDate: '2026-08-01',
    openingBy: 'Huy',
    bank: { holder: 'DO QUANG HUY', no: '0331000455112', bank: 'Vietcombank - Yên Phong' },
    seeDebtEachOther: false, seeFund: true, roundUnit: true, lockDay: 25, courtPayMode: 'session',
    linkModes: { code: true, invite: false, phone: false },
    levels: LEVELS,
  }
  const d1 = club1Data()

  return {
    users: [
      { id: 'U1', name: 'Lê Thị Thuý Anh', nick: 'Thúy', phone: '0910000137', gender: 'nu', level: 'TB-', since: '2026-04-20' },
      { id: 'U2', name: 'Nguyễn Thị Mai', nick: 'Mai', phone: '0910000274', gender: 'nu', level: 'TBY', since: '2026-04-22' },
      { id: 'U3', name: 'Bùi Văn Đạt', nick: 'Đạt', phone: '0910001096', gender: 'nam', level: 'TB', since: '2026-05-02' },
      { id: 'U4', name: 'Đỗ Quang Huy', nick: 'Huy', phone: '0906558877', gender: 'nam', level: 'TBY', since: '2026-08-18' },
      { id: 'U5', name: 'Phạm Văn Thắng', nick: 'Thắng em', phone: '0910000959', gender: 'nam', level: 'TB', since: '2026-08-12' },
    ],
    clubs: [club1, club2],
    clubId: 'CL1',
    club: club1,
    currentUserId: 'U1',
    viewAs: 'owner',
    clubStore: { CL2: club2Data() },
    joinRequests: [
      { id: 'JR1', clubId: 'CL1', userId: 'U4', code: '8NJHE8', at: '2026-08-18', status: 'pending',
        note: 'Bạn của Mai rủ vào nhóm Chủ nhật' },
    ],
    levels: LEVELS,
    month: '2026-08',
    today: '2026-08-19',
    ...d1,
  }
}
