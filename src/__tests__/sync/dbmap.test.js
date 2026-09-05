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

// `sessions.shuttle_mode` là enum NOT NULL (0001_init) nhưng cột đã hết nghĩa từ lúc bỏ kho cầu —
// buổi tạo mới mang `shuttleMode: null`. Gửi NULL tường minh thì DEFAULT của Postgres KHÔNG chạy,
// insert bị từ chối và cả hàng đợi đồng bộ kẹt: không tạo được buổi nào nữa.
const dNoMode = clone(db)
dNoMode.sessions[0] = { ...dNoMode.sessions[0], shuttleMode: null }
const rowNoMode = toRows(dNoMode, ctx).sessions.find((r) => r.id === dNoMode.sessions[0].id)
assert.equal(rowNoMode.shuttle_mode, 'quota',
  'buổi không còn chế độ cầu vẫn phải xuống DB một enum hợp lệ, không thì insert vỡ vì NOT NULL')

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
  courts: [
    { id: 'c1', name: 'Sân 1', address: '123 Đường A', map_url: 'https://maps.app.goo.gl/c1', price_per_hour: 120000, active: true },
    { id: 'c2', name: 'Sân 2', address: '123 Đường A', map_url: null, price_per_hour: 120000, active: true },
  ],
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

assert.equal(back.courts[0].mapUrl, 'https://maps.app.goo.gl/c1', 'map_url phải map thành mapUrl')
assert.equal(back.courts[1].mapUrl, '', 'map_url null phải map thành chuỗi rỗng')
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
  paid: true, paidAt: '2026-08-28', claimedAt: null,
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
assert.equal(cr.has_member_extra_discount, false, 'mặc định tắt ưu đãi đi thêm')
assert.equal(cr.member_extra_discount, 5000, 'mặc định mức giảm 5.000đ')
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

/* ---------- guests: map hai chiều name, phone, note, invited_by ---------- */
const guestDb = {
  ...db,
  guests: [{ id: 'G_NOTE', name: 'Đức Anh', gender: 'nam', level: 'TB', phone: '0912345678', note: 'tay trái', invitedBy: '' }],
}
const gRows = toRows(guestDb, ctx).guests
const gRow = gRows.find((r) => r.id === 'G_NOTE')
assert.equal(gRow.note, 'tay trái')
assert.equal(gRow.phone, '0912345678')
assert.equal(gRow.invited_by, null)

const gBack = toDb({
  guests: [{ id: 'G_NOTE', name: 'Đức Anh', gender: 'nam', level: 'TB', phone: '0912345678', note: 'tay trái', invited_by: null }],
}, { clubId: 'CL1' })
assert.equal(gBack.guests[0].note, 'tay trái')
assert.equal(gBack.guests[0].phone, '0912345678')

/* ---------- claimed_at: thành viên tự khai đã chuyển tiền (migration 0018) ---------- */
// Ba bảng nợ, mỗi bảng một cột `claimed_at`. Quên map MỘT bảng ở MỘT chiều là khoản đó khai
// xong không lưu, hoặc lưu rồi mà màn hình không biết — người ta chuyển tiền rồi vẫn thấy nợ.

const CLAIM = '2026-08-20T10:00:00Z'

const claimBack = toDb({
  club: {},
  dues: [{
    id: 'D_C', month: '2026-08', group_id: 'G1', member_id: 'M1',
    amount: 250000, paid_amount: 0, paid_at: null, claimed_at: CLAIM,
  }],
  adjustments: [{
    id: 'AJ_C', month: '2026-08', group_id: 'G1', member_id: 'M1', kind: 'extra_session',
    sessions: 1, unit_price: 50000, amount: 50000, settle: 'cash',
    paid: false, paid_at: null, claimed_at: CLAIM,
  }],
  sessions: [{
    id: 'S_C', date: '2026-08-10', group_id: 'G1', status: 'closed', shuttle_used: 0,
    session_guests: [{
      id: 'SG_C', guest_id: null, member_id: 'M1', level: 'TB', gender: 'nam',
      price: 70000, paid: false, claimed_at: CLAIM,
    }],
  }],
}, { clubId: 'CL1' })

assert.equal(claimBack.dues[0].claimedAt, CLAIM,
  'quỹ tháng: mất claimed_at xuống client thì màn hình không phân biệt được "chưa khai" với '
  + '"đang chờ duyệt", người ta khai lại và chuyển tiền lần hai')
assert.equal(claimBack.adjustments[0].claimedAt, CLAIM, 'đối chiếu buổi: mất claimed_at')
assert.equal(claimBack.sessionGuests[0].claimedAt, CLAIM, 'buổi đi lẻ: mất claimed_at')

// Chưa khai thì phải là null, KHÔNG được undefined: undefined lọt xuống PostgREST là bỏ qua
// cột, tức là từ chối (đặt lại NULL) không bao giờ ghi được xuống DB.
const noClaim = toDb({
  club: {},
  dues: [{ id: 'D_N', month: '2026-08', group_id: 'G1', member_id: 'M1', amount: 1, paid_amount: 0 }],
}, { clubId: 'CL1' })
assert.equal(noClaim.dues[0].claimedAt, null, 'chưa khai phải là null, không phải undefined')

const claimRows = toRows({
  ...db,
  dues: [{ id: 'D_C', month: '2026-08', groupId: 'G1', memberId: 'M1', amount: 250000, paidAmount: 0, claimedAt: CLAIM }],
  adjustments: [{ id: 'AJ_C', key: '2026-08:G1:M1:extra_session', month: '2026-08', groupId: 'G1', memberId: 'M1', kind: 'extra_session', sessions: 1, unit: 50000, amount: 50000, settle: 'cash', paid: false, paidAt: null, claimedAt: CLAIM }],
}, ctx)

assert.equal(claimRows.monthly_dues.find((r) => r.id === 'D_C').claimed_at, CLAIM,
  'quỹ tháng: không ghi claimed_at lên DB thì khai xong reload là mất, người ta khai lại mãi')
assert.equal(claimRows.member_adjustments.find((r) => r.id === 'AJ_C').claimed_at, CLAIM,
  'đối chiếu buổi: không ghi claimed_at lên DB')

const sgRow = toRows({
  ...db,
  sessionGuests: [{ id: 'SG_C', sessionId: db.sessions[0].id, guestId: null, memberId: 'M1', level: 'TB', gender: 'nam', price: 70000, paid: false, claimedAt: CLAIM }],
}, ctx).session_guests.find((r) => r.id === 'SG_C')
assert.equal(sgRow.claimed_at, CLAIM, 'buổi đi lẻ: không ghi claimed_at lên DB')

/* ---------- player_ratings & matches: an toàn ID và cột rating (Đợt 1) ---------- */

const ratingRows = toRows({
  ...db,
  playerRatings: {
    M1: { id: 'PR_1', memberId: 'M1', rating: 1250, gamesCount: 5 },
    M2: { memberId: 'M2', rating: 1100, gamesCount: 2 }, // Không có id -> toRows không được đẩy id: null
  },
  matches: [{
    id: 'MT_1', sessionId: db.sessions[0].id, courtIdx: 0, minutes: 20, at: 1725440000000,
    sourceType: 'session', sets: [[21, 19]], winnerTeam: 'A', scoreText: '21-19',
    teamA: ['M1'], teamB: ['M2'], playerKeys: ['M1', 'M2'],
    initialRatingA: 1200, initialRatingB: 1150, eloDelta: 16,
  }],
}, ctx)

assert.ok(ratingRows.player_ratings.every((r) => r.id != null), 'player_ratings không bao giờ được chứa id null')
assert.equal(ratingRows.player_ratings.length, 1, 'dòng không có id không được đẩy xuống DB gây crash 23502')

const mtRow = ratingRows.matches.find((m) => m.id === 'MT_1')
assert.equal(mtRow.initial_rating_a, 1200)
assert.equal(mtRow.initial_rating_b, 1150)
assert.equal(mtRow.elo_delta, 16)

const rawMtBack = toDb({
  club: {},
  sessions: [{ id: 'S1', date: '2026-09-04', group_id: 'G1', matches: [{
    id: 'MT_1', court_index: 0, minutes: 20, ended_at: new Date(1725440000000).toISOString(),
    source_type: 'session', sets: [[21, 19]], winner_team: 'A', score_text: '21-19',
    initial_rating_a: 1200, initial_rating_b: 1150, elo_delta: 16,
    match_players: [{ player_id: 'M1', team: 0 }, { player_id: 'M2', team: 1 }],
  }] }],
}, { clubId: 'CL1' })

assert.equal(rawMtBack.matches[0].initialRatingA, 1200)
assert.equal(rawMtBack.matches[0].initialRatingB, 1150)
assert.equal(rawMtBack.matches[0].eloDelta, 16)

/* ---------- S5: editMatchScore cascade không được sinh delIds cho player_ratings ---------- */
const prevRatingsState = {
  ...db,
  playerRatings: {
    M1: { id: 'PR_1', memberId: 'M1', rating: 1250, gamesCount: 5 },
    M2: { id: 'PR_2', memberId: 'M2', rating: 1100, gamesCount: 2 },
  },
}
const nextRatingsState = {
  ...db,
  playerRatings: {
    M1: { id: 'PR_1', memberId: 'M1', rating: 1260, gamesCount: 5 },
    M2: { id: 'PR_2', memberId: 'M2', rating: 1090, gamesCount: 2 },
  },
}
const prevRows = toRows(prevRatingsState, ctx)
const nextRows = toRows(nextRatingsState, ctx)
const ratingOps = diff(prevRows, nextRows)
const delRatingOps = ratingOps.filter((o) => o.table === 'player_ratings' && o.op === 'delIds')
assert.equal(delRatingOps.length, 0, 'S5: editMatchScore cascade không được sinh delIds xoá bảng điểm CLB')

/* ---------- R8: match_edits noDelete không bao giờ sinh delIds ---------- */
const prevEditsState = {
  ...db,
  matchEdits: [{ id: 'ME_1', matchId: 'MT_1', fieldChanged: 'sets', reason: 'Nhập sai' }],
}
const nextEditsState = {
  ...db,
  matchEdits: [], // Client làm rơi log khỏi state
}
const editOps = diff(toRows(prevEditsState, ctx), toRows(nextEditsState, ctx))
const delEditOps = editOps.filter((o) => o.table === 'match_edits' && o.op === 'delIds')
assert.equal(delEditOps.length, 0, 'R8: match_edits noDelete ngăn chặn delIds gây lỗi 42501 Postgres RLS')

/* ---------- X2: match_edits insertOnly sinh conflict: 'id' và ignoreDuplicates: true ---------- */
const newEditState = {
  ...db,
  matchEdits: [{ id: 'ME_2', matchId: 'MT_1', fieldChanged: 'sets', reason: 'Sửa điểm' }],
}
const addEditOps = diff(toRows(db, ctx), toRows(newEditState, ctx))
const upsertEditOp = addEditOps.find((o) => o.table === 'match_edits')
assert.ok(upsertEditOp, 'match_edits phải có thao tác ghi')
assert.equal(upsertEditOp.conflict, 'id', 'match_edits giữ conflict: id để Postgres ON CONFLICT hoạt động')
assert.equal(upsertEditOp.ignoreDuplicates, true, 'X2: match_edits phải có ignoreDuplicates: true để idempotent DO NOTHING')

console.log('dbmap check: OK')
