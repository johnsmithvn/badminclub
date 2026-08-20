// node src/__tests__/dbmap.test.js
//
// Lớp map client ↔ Postgres là chỗ duy nhất biết cả hai hình dữ liệu, nên nó cũng là chỗ
// sai một dòng là mất tiền thật. Ba thứ phải đúng:
//   1. Không đổi gì thì diff() phải RỖNG. Sai chỗ này là mỗi lần bấm phím ghi lại cả CLB.
//   2. Đổi một chỗ thì chỉ ghi đúng chỗ đó.
//   3. Mọi bảng toRows() sinh ra phải có trong TABLES, không thì âm thầm không đồng bộ.

import assert from 'node:assert/strict'
import { TABLES, diff, toDb, toRows } from '#contexts/dbmap.js'
import { seed } from './fixture.js'

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
      { court_id: 'c1', court_index: 0, start_time: '18:00:00', end_time: '20:00:00', is_sold: true, is_extra: false, sold_amount: 240000, sold_to: 'CLB X' },
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
  backCredits: [{ month: '2026-08', group_id: 'gr1', member_id: 'm1', paid: true }],
  guestPrices: [{ level: 'Y', gender: 'nu', price: 50000 }],
  manual: [{ id: 'l1', date: '2026-08-10', direction: 'out', category: 'withdraw', label: 'X', amount: 5000, payer_name: 'A' }],
}
const back = toDb(raw, { clubId: 'CL1' })

assert.deepEqual(back.levels, ['Y', 'Y+', 'TB-'], 'thang trình độ phải lấy của CLB')
assert.equal(back.attendance.s1.m1, false, "status 'absent' phải đọc thành false, không phải vắng bản ghi")
assert.deepEqual(back.sessions[0].courts.map((c) => c.courtId), ['c1', 'c2'], 'sân phải xếp theo court_index')
assert.equal(back.sessions[0].courts[0].soldTo, 'CLB X')
assert.equal(back.sessions[0].courts[0].from, '18:00', 'giờ phải cắt còn HH:MM')
assert.deepEqual(back.courtMin.s1, { 1: 18 })
assert.equal(back.groupMode.s1, true)
assert.deepEqual(back.lineups.s1, { c0t1s0: 'g1' })
assert.deepEqual(back.courtGroups.s1, { m1: 1 })
assert.deepEqual(back.matches[0].playerKeys, ['m1', 'g1'], 'người chơi phải xếp theo team 0 trước')
assert.deepEqual(back.roster, { '2026-09': { gr1: { m1: 'off' } } })
assert.deepEqual(back.locked, { '2026-08': true })
assert.deepEqual(back.backPaid, { '2026-08:gr1:m1': true })
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

console.log('dbmap check: OK')
