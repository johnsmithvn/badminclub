// node src/__tests__/dbmap.test.js
//
// Lớp map client ↔ Postgres là chỗ duy nhất biết cả hai hình dữ liệu, nên nó cũng là chỗ
// sai một dòng là mất tiền thật. Ba thứ phải đúng:
//   1. Không đổi gì thì diff() phải RỖNG. Sai chỗ này là mỗi lần bấm phím ghi lại cả CLB.
//   2. Đổi một chỗ thì chỉ ghi đúng chỗ đó.
//   3. Mọi bảng toRows() sinh ra phải có trong TABLES, không thì âm thầm không đồng bộ.

import assert from 'node:assert/strict'
import cfg from '#config/app.json' with { type: 'json' }
import { TABLES, clubRow, diff, toDb, toRows } from '#contexts/dbmap.js'
import { seed } from '../fixture.js'

const db = seed()
const ctx = { clubId: 'CL1', memberIds: new Set(db.members.map((m) => m.id)) }
const rows = toRows(db, ctx)
const clone = (x) => JSON.parse(JSON.stringify(x))

/* ---------- 3. mọi bảng sinh ra đều được khai báo ---------- */

const known = new Set(TABLES.map((x) => x.table))
Object.keys(rows).forEach((table) => {
  assert.ok(known.has(table), 'toRows sinh bảng ' + table + ' nhưng TABLES không khai báo → sẽ không bao giờ được ghi')
})
TABLES.filter((s) => s.mode === 'key').forEach((s) => {
  assert.ok(s.child && s.conflict, 'bảng ' + s.table + ' mode key phải có cả child và conflict')
})
TABLES.filter((s) => s.mode === 'id').forEach((s) => {
  ;(rows[s.table] || []).forEach((r) => assert.ok(r.id, 'thiếu id ở ' + s.table))
})

/* ---------- 1. không đổi gì → không ghi gì ---------- */

assert.deepEqual(diff(rows, toRows(clone(db), ctx)), [], 'db không đổi mà vẫn sinh thao tác ghi')

/* ---------- 2. đổi một chỗ → ghi đúng một chỗ ---------- */

// Điểm danh: bật/tắt một người trong một buổi.
const d1 = clone(db)
const sid = 'B7'
const mid = Object.keys(d1.attendance[sid])[0]
d1.attendance[sid][mid] = !d1.attendance[sid][mid]
const ops1 = diff(rows, toRows(d1, ctx))
assert.equal(ops1.length, 1, 'đổi 1 ô điểm danh phải ra đúng 1 thao tác')
assert.equal(ops1[0].table, 'attendances')
assert.equal(ops1[0].op, 'upsert')
assert.equal(ops1[0].rows.length, 1)
assert.equal(ops1[0].rows[0].member_id, mid)
assert.equal(ops1[0].conflict, 'session_id,member_id')

// Đóng băng giá thành một buổi: chỉ ghi đúng buổi đó, và cột cost_* phải xuống DB thật.
// Sai chỗ này thì số đóng băng chỉ sống trong RAM, F5 một cái là trôi lại như cũ.
const dFreeze = clone(db)
const iFreeze = dFreeze.sessions.findIndex((x) => x.id === 'B1')
dFreeze.sessions[iFreeze] = {
  ...dFreeze.sessions[iFreeze],
  costCourt: 480000, costShuttleUnit: 27500, costShuttle: 935000, costTotal: 1415000,
  costGuestRev: 130000, costHeads: 10, costFrozenAt: '2026-08-02',
}
const opsF = diff(rows, toRows(dFreeze, ctx))
assert.equal(opsF.length, 1, 'đóng băng 1 buổi phải ra đúng 1 thao tác')
assert.equal(opsF[0].table, 'sessions')
assert.equal(opsF[0].rows.length, 1)
assert.equal(opsF[0].rows[0].cost_total, 1415000)
assert.equal(opsF[0].rows[0].cost_frozen_at, '2026-08-02')
assert.equal(opsF[0].rows[0].cost_shuttle_unit, 27500)
// Buổi chưa đóng băng phải xuống DB là NULL, không phải 0 — 0 nghĩa là "đã chốt, tốn 0 đồng".
const anyRow = rows.sessions.find((r) => r.id !== 'B1')
assert.equal(anyRow.cost_frozen_at, null)
assert.equal(anyRow.cost_total, null)

// Đóng băng TỪNG DÒNG SÂN (0012) cũng phải xuống DB thật. Không xuống thì F5 xong sổ quỹ đọc lại
// giá sân hiện tại và dòng chi của buổi đã chốt nhảy số — đúng con bug 0012 sinh ra để chặn.
const dRow = clone(db)
const iRow = dRow.sessions.findIndex((x) => x.courts.length > 0)
dRow.sessions[iRow].courts = dRow.sessions[iRow].courts.map((c) => ({ ...c, cost: 240000 }))
const opsR = diff(rows, toRows(dRow, ctx))
const upR = opsR.find((o) => o.table === 'session_courts')
assert.ok(upR, 'đóng băng dòng sân phải sinh thao tác ghi session_courts')
assert.ok(upR.rows.every((r) => r.cost === 240000), 'cột cost phải xuống DB')
// Chưa đóng băng thì NULL, không phải 0 — 0 là "sân này 0 đồng", đọc lại là mất tiền im lặng.
const anyCourt = rows.session_courts.find((r) => r.cost == null)
assert.ok(anyCourt, 'buổi chưa chốt thì cost xuống NULL')
assert.notEqual(anyCourt.cost, 0)

// Xoá một khách của buổi: bảng có id ở client → xoá theo id.
const d2 = clone(db)
const goneId = d2.sessionGuests[0].id
d2.sessionGuests = d2.sessionGuests.filter((x) => x.id !== goneId)
const ops2 = diff(rows, toRows(d2, ctx))
assert.equal(ops2.length, 1)
assert.deepEqual(ops2[0], { table: 'session_guests', op: 'delIds', ids: [goneId] })

// Bỏ một sân của buổi: dòng con không có id → xoá trong phạm vi buổi, giữ lại sân còn dùng.
const d3 = clone(db)
const s3 = d3.sessions.find((x) => x.courts.length > 1)
s3.courts = s3.courts.slice(0, 1)
const ops3 = diff(rows, toRows(d3, ctx))
const del3 = ops3.find((o) => o.table === 'session_courts' && o.op === 'delScope')
assert.ok(del3, 'bỏ sân phải sinh thao tác xoá trong phạm vi buổi')
assert.deepEqual(del3.scope, { session_id: s3.id })
assert.deepEqual(del3.keep, [0], 'chỉ giữ lại sân index 0')
assert.equal(del3.child, 'court_index')

// XOÁ MỘT THÀNH VIÊN: dòng con phải đi TRƯỚC dòng cha.
// `club_members` đứng thứ 4 trong TABLES còn `group_memberships` thứ 19. Ghi theo thứ tự khai
// báo là đúng cho INSERT nhưng ngược hẳn cho DELETE: Postgres chặn bằng khoá ngoại (23503),
// và vì storage.js chỉ cập nhật ảnh chụp khi MỌI op xong nên op hỏng nằm lại trong diff mãi —
// cả hàng đợi đồng bộ kẹt ở đó trong khi màn hình vẫn báo đã lưu.
const dDel = clone(db)
const delId = Object.keys(dDel.roster[Object.keys(dDel.roster)[0]][db.groups[0].id])[0]
dDel.members = dDel.members.filter((m) => m.id !== delId)
Object.keys(dDel.roster).forEach((mo) => {
  Object.keys(dDel.roster[mo]).forEach((gid) => { delete dDel.roster[mo][gid][delId] })
})
const opsDel = diff(rows, toRows(dDel, ctx))
const iParent = opsDel.findIndex((o) => o.table === 'club_members' && o.op === 'delIds')
const iChild = opsDel.findIndex((o) => o.table === 'group_memberships' && o.op === 'delScope')
assert.ok(iParent >= 0, 'xoá thành viên phải sinh delIds trên club_members')
assert.ok(iChild >= 0, 'xoá thành viên phải dọn cả group_memberships')
assert.ok(iChild < iParent, 'phải xoá group_memberships TRƯỚC club_members, không thì khoá ngoại chặn')
assert.deepEqual(opsDel[iParent].ids, [delId])

// Thêm một trình độ: bảng giá khách phải nở thêm 2 dòng (nam + nữ), không đụng bảng nào khác.
const d4 = clone(db)
d4.levels = d4.levels.concat(['TB+'])
d4.club.levels = d4.levels
d4.guestPrices = d4.guestPrices.concat([{ level: 'TB+', nam: 0, nu: 0 }])
const ops4 = diff(rows, toRows(d4, ctx))
assert.deepEqual([...new Set(ops4.map((o) => o.table))], ['guest_price_rules'])
const ins4 = ops4.find((o) => o.op === 'upsert')
assert.equal(ins4.rows.length, (db.guestPrices.length + 1) * 2)

/* ---------- đọc ngược: chỗ dễ sai nhất ---------- */

const raw = {
  club: {
    id: 'CL1', name: 'CLB Thử', code: 'ABC12345', opening_balance: 1000, opening_date: '2026-08-01',
    lock_day: 25, round_unit: true, see_fund: true, see_debt_each_other: false,
    court_pay_mode: 'month', allow_code_join: true, allow_invite: true, allow_phone_suggest: true,
    levels: ['Y', 'Y+', 'TB-'],
  },
  members: [{ id: 'm1', name: 'A', gender: 'nam', level: 'Y+', role: 'owner', joined_at: '2026-08-01', active: true }],
  guests: [{ id: 'g1', name: 'K', gender: 'nu', level: 'Y', club_id: 'CL1' }],
  sessions: [{
    id: 's1', group_id: 'gr1', date: '2026-08-09', status: 'open', shuttle_mode: 'tubes',
    tubes_opened: 1, loose_units: 2, shuttle_used: 14, shuttle_est: false, group_mode: true,
    // Cố tình trả về ngược thứ tự: court_index phải quyết định thứ tự, không phải thứ tự trả về.
    session_courts: [
      { court_id: 'c2', court_index: 1, start_time: '20:00:00', end_time: '22:00:00', is_sold: false, is_extra: true, sold_amount: 0, default_minutes: 18 },
      { court_id: 'c1', court_index: 0, start_time: '18:00:00', end_time: '20:00:00', is_sold: true, is_extra: false, sold_amount: 240000, sold_to: 'CLB X', cost: 310000 },
    ],
    attendances: [{ member_id: 'm1', status: 'absent' }],
    session_lineups: [{ slot: 'c0t1s0', court_index: 0, player_type: 'guest', player_id: 'g1' }],
    session_court_groups: [{ court_index: 1, player_type: 'member', player_id: 'm1' }],
    matches: [{
      id: 'mt1', court_index: 0, minutes: 22, ended_at: '2026-08-09T13:00:00Z',
      match_players: [
        { player_type: 'guest', player_id: 'g1', team: 1 },
        { player_type: 'member', player_id: 'm1', team: 0 },
      ],
    }],
  }],
  rosterRows: [{ month: '2026-09', group_id: 'gr1', member_id: 'm1', state: 'off' }],
  locks: [{ month: '2026-08' }],
  adjustments: [{
    id: 'aj1', month: '2026-08', group_id: 'gr1', member_id: 'm1', kind: 'absent_back',
    sessions: 2, unit_price: 40000, amount: -80000, settle: 'cash', paid: true, paid_at: '2026-08-28',
  }],
  guestPrices: [{ level: 'Y', gender: 'nu', price: 50000 }],
  manual: [{ id: 'l1', date: '2026-08-10', direction: 'out', category: 'withdraw', label: 'X', amount: 5000, payer_name: 'A' }],
}
const back = toDb(raw, { clubId: 'CL1' })

assert.deepEqual(back.levels, ['Y', 'Y+', 'TB-'], 'thang trình độ phải lấy của CLB')
assert.equal(back.attendance.s1.m1, false, "status 'absent' phải đọc thành false, không phải vắng bản ghi")
assert.deepEqual(back.sessions[0].courts.map((c) => c.courtId), ['c1', 'c2'], 'sân phải xếp theo court_index')
assert.equal(back.sessions[0].courts[0].soldTo, 'CLB X')
assert.equal(back.sessions[0].courts[0].from, '18:00', 'giờ phải cắt còn HH:MM')
// Tiền sân đóng băng (0012): có số thì giữ nguyên, NULL phải về null chứ không phải 0 —
// rowCost phân biệt hai cái đó bằng `== null`, thành 0 là buổi chưa chốt hoá ra "sân 0 đồng".
assert.equal(back.sessions[0].courts[0].cost, 310000, 'tiền sân đã đóng băng phải đọc lại được')
assert.equal(back.sessions[0].courts[1].cost, null, 'chưa đóng băng thì null để rowCost tính live')
assert.deepEqual(back.courtMin.s1, { 1: 18 })
assert.equal(back.groupMode.s1, true)
assert.deepEqual(back.lineups.s1, { c0t1s0: 'g1' })
assert.deepEqual(back.courtGroups.s1, { m1: 1 })
assert.deepEqual(back.matches[0].playerKeys, ['m1', 'g1'], 'người chơi phải xếp theo team 0 trước')

// Trận phải về theo thứ tự thời gian: "Bỏ trận vừa ghi" lấy phần tử CUỐI mảng, mà load()
// không ORDER BY bảng nào — trả về thứ tự nào là may thứ tự đó, sau F5 là xoá nhầm trận khác.
const mtRaw = {
  ...raw,
  sessions: [{
    ...raw.sessions[0],
    matches: [
      { id: 'mtB', court_index: 0, minutes: 20, ended_at: '2026-08-09T15:00:00Z', match_players: [] },
      { id: 'mtA', court_index: 0, minutes: 20, ended_at: '2026-08-09T13:00:00Z', match_players: [] },
    ],
  }],
}
assert.deepEqual(toDb(mtRaw, { clubId: 'CL1' }).matches.map((m) => m.id), ['mtA', 'mtB'],
  'matches phải sắp theo thời gian kết thúc, không theo thứ tự Postgres trả về')
assert.deepEqual(back.roster, { '2026-09': { gr1: { m1: 'off' } } })
assert.deepEqual(back.locked, { '2026-08': true })
assert.deepEqual(back.adjustments, [{
  id: 'aj1', key: '2026-08:gr1:m1:absent_back', month: '2026-08', groupId: 'gr1', memberId: 'm1',
  kind: 'absent_back', sessions: 2, unit: 40000, amount: -80000, settle: 'cash',
  paid: true, paidAt: '2026-08-28',
}], 'bảng đối chiếu phải mang ĐỦ số xuống client, không chỉ cờ paid như back_credits cũ')
assert.deepEqual(back.guestPrices, [
  { level: 'Y', nam: 0, nu: 50000 },
  { level: 'Y+', nam: 0, nu: 0 },
  { level: 'TB-', nam: 0, nu: 0 },
], 'bảng giá phải phủ đủ thang trình độ, thiếu thì 0')
assert.deepEqual(back.manual[0], { id: 'l1', date: '2026-08-10', dir: 'out', cat: 'withdraw', label: 'X', amount: 5000, by: 'A' })

// Đọc rồi ghi lại phải không sinh thao tác nào: load() dựng ảnh chụp bằng chính toRows,
// lệch nhau là lần save đầu sẽ xoá/ghi bừa.
const backCtx = { clubId: 'CL1', memberIds: new Set(['m1']) }
assert.deepEqual(diff(toRows(back, backCtx), toRows(clone(back), backCtx)), [])

// Buổi đột xuất của toàn CLB: DB lưu group_id NULL, client gọi là 'ALL'. Đi được cả hai chiều.
const allRaw = {
  ...raw,
  sessions: [{ ...raw.sessions[0], id: 's2', group_id: null, session_courts: [], attendances: [], matches: [] }],
}
const allBack = toDb(allRaw, { clubId: 'CL1' })
assert.equal(allBack.sessions[0].groupId, 'ALL', "group_id NULL phải đọc thành 'ALL'")
assert.equal(toRows(allBack, backCtx).sessions[0].group_id, null, "'ALL' phải ghi xuống NULL")

// `repaid_at` (0011) phải đi được cả hai chiều: đọc hụt thì mọi khoản ứng đã trả biến thành
// đang nợ, ghi hụt thì bấm "Đã trả" xong tải lại là mất dấu.
const advRaw = {
  ...raw,
  purchases: [{
    id: 'p1', date: '2026-08-06', type_id: 's1', tubes: 1, extra_units: 0, total_units: 12,
    price_per_tube: 320000, total_amount: 320000, payer_member_id: 'm1', funded_by: null,
    note: null, repaid_at: '2026-08-20',
  }],
  courtBills: [{
    id: 'b1', month: '2026-08', paid_on: '2026-08-01', venue: 'X', amount: 100000,
    payer_member_id: 'm1', payer: null, note: null, repaid_at: null,
  }],
}
const advBack = toDb(advRaw, { clubId: 'CL1' })
assert.equal(advBack.purchases[0].repaidAt, '2026-08-20')
assert.equal(advBack.courtBills[0].repaidAt, '', 'chưa trả thì đọc thành chuỗi rỗng')
const advRows = toRows(advBack, { clubId: 'CL1', memberIds: new Set(['m1']) })
assert.equal(advRows.shuttle_purchases[0].repaid_at, '2026-08-20')
assert.equal(advRows.court_bills[0].repaid_at, null, 'chưa trả phải xuống NULL, không phải chuỗi rỗng')

/* ---------- bảng `clubs`: cập nhật, không insert ---------- */
// `clubRow` đi đường RIÊNG trong storage.js (một dòng, `update` chứ không `upsert`) nên nó KHÔNG
// nằm trong TABLES và không được `diff()` kiểm. Sai ở đây thì cấu hình CLB im lặng không lưu.
const cr = clubRow(db)
assert.ok(!('id' in cr), 'không ghi id: RPC create_club đã tạo dòng, đây chỉ là update')
assert.ok(!('code' in cr), 'mã CLB do server sinh, client không được ghi đè')
assert.equal(cr.opening_balance, db.club.opening)
assert.equal(cr.court_pay_mode, db.club.courtPayMode)
assert.equal(cr.allow_code_join, db.club.linkModes.code)
assert.deepEqual(cr.levels, db.club.levels, 'thang trình độ là dữ liệu của từng CLB')
// Chuỗi rỗng phải xuống NULL, không phải '' — cột text nullable đọc lại thành '' thì diff nhảy mãi.
const bare = clubRow({ club: { ...db.club, openingBy: '', bank: { holder: '', no: '', bank: '' }, levels: [] } })
assert.equal(bare.opening_by, null)
assert.equal(bare.bank_holder, null)
assert.ok(bare.levels.length > 0, 'thang rỗng phải rơi về thang mặc định, không ghi mảng rỗng xuống DB')

/* ---------- enum roster_state: 'none' là sentinel client, không được xuống DB ---------- */
// `roster_state` chỉ có ('fixed','off','pending'). Ghi 'none' xuống là Postgres 22P02, và vì
// ảnh chụp đồng bộ chỉ cập nhật khi MỌI op xong nên cả hàng đợi đồng bộ kẹt lại — màn hình vẫn
// hiện thay đổi nên người dùng không biết là từ đó về sau KHÔNG có gì được lưu nữa.
const gid0 = db.groups[0].id
const mid0 = db.members[0].id
const dirty = { ...db, roster: { ...db.roster, '2026-08': { [gid0]: { [mid0]: 'none' } } } }
const dirtyRows = toRows(dirty, ctx)
assert.ok(
  (dirtyRows.group_memberships || []).every((r) => cfg.rosterStates.indexOf(r.state) >= 0),
  "trạng thái ngoài enum lọt xuống group_memberships.state là kẹt cả hàng đợi đồng bộ"
)
assert.ok(
  !(dirtyRows.group_memberships || []).some((r) =>
    r.month === '2026-08' && r.member_id === mid0 && r.group_id === gid0),
  'ô đặt về none phải BIẾN MẤT khỏi rows để diff sinh delScope xoá dòng cũ'
)

/* ---------- session_guests: lượt trả tiền của KHÁCH hoặc của THÀNH VIÊN ---------- */
// migration 0003: CHECK `session_guests_who_chk` đòi ĐÚNG MỘT trong guest_id / member_id có giá
// trị. Map sai là Postgres chặn và cả hàng đợi đồng bộ kẹt lại — mọi thay đổi sau đó im lặng
// không lưu, trong khi màn hình vẫn hiện đúng.
const chargeDb = {
  ...db,
  sessionGuests: db.sessionGuests.concat([{
    // guestId '' chứ không null: đúng quy ước "rỗng = không có" mà repo dùng khắp nơi
    // (invitedBy: ''). `uu()` phải ép nó về NULL, không thì '' xuống cột uuid là 22P02.
    id: 'SGM9', sessionId: 'B1', memberId: 'M1', guestId: '',
    level: 'TB-', gender: 'nu', price: 60000, paid: false, invitedBy: '',
  }]),
}
const sgRows = toRows(chargeDb, ctx).session_guests
const mine = sgRows.find((r) => r.id === 'SGM9')
assert.equal(mine.member_id, 'M1')
assert.equal(mine.guest_id, null, 'dòng của thành viên phải để guest_id NULL, không phải chuỗi rỗng')
const theirs = sgRows.find((r) => r.id === 'SG1')
assert.equal(theirs.member_id, null, 'dòng của khách phải để member_id NULL')
assert.equal(theirs.guest_id, 'K1')

// Chiều đọc: quên map member_id là sau khi tải lại, dòng thu của thành viên hoá thành một khách
// vô danh — bị đếm thêm một đầu người và mất tên trong sổ quỹ.
const sgBack = toDb({
  sessions: [{
    id: 'B1', date: '2026-08-02', status: 'closed', group_id: 'G1',
    session_guests: [{
      id: 'SGM9', guest_id: null, member_id: 'M1', level: 'TB-', gender: 'nu',
      price: 60000, paid: false, invited_by: null,
    }],
  }],
}, { clubId: 'CL1' })
assert.equal(sgBack.sessionGuests[0].memberId, 'M1')
assert.equal(sgBack.sessionGuests[0].guestId, null)

console.log('dbmap check: OK')
