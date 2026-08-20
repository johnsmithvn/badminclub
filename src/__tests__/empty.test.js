// node src/__tests__/empty.test.js
//
// CLB VỪA TẠO thì mọi bảng đều rỗng: không sân, không nhóm, không thành viên, không buổi.
// Đây là trạng thái người dùng gặp ĐẦU TIÊN, và là trạng thái prototype chưa bao giờ chạy
// (prototype luôn có dữ liệu mẫu). Test này gọi TOÀN BỘ selector thuần với db rỗng và yêu cầu:
// không throw, không NaN, không Infinity. Màn hình nào cũng gọi mấy hàm này ngay dòng đầu.

import assert from 'node:assert/strict'
import { toDb } from '#contexts/dbmap.js'
import * as M from '#lib/money.js'
import * as L from '#lib/ledger.js'
import * as A from '#lib/assign.js'
import { monthGrid, monthOf } from '#utils/dates.js'
import cfg from '#config/app.json' with { type: 'json' }

const TODAY = '2026-08-20'
const MONTH = monthOf(TODAY)

// Đi qua chính toDb() để hình db giống hệt lúc load một CLB mới toanh từ Supabase.
const db = {
  ...toDb({
    club: {
      id: 'CL', name: 'CLB Mới', code: 'AAAAAAAA', opening_balance: 0, opening_date: TODAY,
      lock_day: 25, round_unit: true, see_fund: true, see_debt_each_other: false,
      court_pay_mode: 'month', allow_code_join: true, allow_invite: true, allow_phone_suggest: true,
      levels: cfg.levelsDefault,
    },
  }, { clubId: 'CL' }),
  clubId: 'CL', today: TODAY, month: MONTH, myRole: 'owner', viewAs: 'owner', currentUserId: null,
  sessionId: null,
}

/** Không được ra NaN / Infinity: mấy giá trị đó chảy thẳng vào ô tiền trên màn hình. */
const finite = (v, label) => {
  if (typeof v === 'number') {
    assert.ok(Number.isFinite(v), label + ' ra ' + v)
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => finite(x, label + '[' + i + ']'))
  } else if (v && typeof v === 'object') {
    Object.keys(v).forEach((k) => finite(v[k], label + '.' + k))
  }
  return v
}

const ok = (label, fn) => {
  let out
  assert.doesNotThrow(() => { out = fn() }, label + ' throw khi CLB rỗng')
  return finite(out, label)
}

/* ---------- tra cứu: id không tồn tại phải trả về giá trị an toàn ---------- */

assert.equal(ok('courtOf', () => M.courtOf(db, 'x')).price, 0)
assert.ok(ok('memberOf', () => M.memberOf(db, 'x')).name)
assert.ok(ok('guestOf', () => M.guestOf(db, 'x')).name)
assert.equal(ok('sessionOf', () => M.sessionOf(db, 'x')), undefined)
assert.ok(ok('groupOf', () => M.groupOf(db, 'x')).courtIds)
assert.ok(ok('groupOf ALL', () => M.groupOf(db, 'ALL')).quota > 0)

/* ---------- tổng hợp toàn CLB ---------- */

assert.equal(ok('fundBalance', () => L.fundBalance(db)), 0)
// Sổ quỹ của CLB mới vẫn có đúng một dòng: quỹ mang sang (kể cả bằng 0).
ok('ledger', () => L.ledger(db, MONTH))
ok('ledgerGrouped', () => L.ledgerGrouped(db, MONTH))
ok('dailySummary', () => L.dailySummary(db, MONTH))
ok('monthFlow', () => L.monthFlow(db, MONTH))

assert.deepEqual(ok('monthSessions', () => M.monthSessions(db, MONTH)), [])
assert.deepEqual(ok('groupMembers', () => M.groupMembers(db, 'x', MONTH)), [])
assert.deepEqual(ok('guestDebtRows', () => M.guestDebtRows(db, MONTH)), [])
assert.deepEqual(ok('guestDebtByInviter', () => M.guestDebtByInviter(db, MONTH)), [])
assert.deepEqual(ok('duesOf', () => M.duesOf(db, MONTH)), [])
assert.deepEqual(ok('adjustRows', () => M.adjustRows(db, MONTH)), [])
assert.deepEqual(ok('pendingOffset', () => M.pendingOffset(db, 'x', MONTH)), [])
assert.deepEqual(ok('billsOf', () => M.billsOf(db, MONTH)), [])
assert.deepEqual(ok('estSessions', () => M.estSessions(db, MONTH)), [])
ok('stock', () => M.stock(db))
ok('checkPreview', () => M.checkPreview(db, '', ''))
// Chưa mua đợt cầu nào → phải dùng giá dự phòng ở config, KHÔNG chia cho 0.
assert.equal(ok('shuttleUnit', () => M.shuttleUnit(db)), cfg.money.shuttleUnitFallback)
assert.equal(ok('courtPayMode', () => M.courtPayMode(db)), 'month')

/* ---------- một buổi vừa tạo: chưa sân, chưa ai điểm danh ---------- */

const s0 = {
  id: 'S', date: TODAY, groupId: 'ALL', scheduleId: null, status: 'open', note: '',
  shuttleTypeId: null, shuttleMode: 'quota', tubesOpened: 0, loose: 0, shuttleUsed: 0,
  shuttleEst: true, closedAt: null, courts: [],
}
const dbS = { ...db, sessions: [s0] }

assert.equal(ok('presentCount', () => M.presentCount(dbS, s0)), 0)
assert.equal(ok('courtCost', () => M.courtCost(dbS, s0)), 0)
assert.equal(ok('courtBase', () => M.courtBase(dbS, s0)), 0)
assert.equal(ok('courtExtraCost', () => M.courtExtraCost(dbS, s0)), 0)
assert.equal(ok('soldTotal', () => M.soldTotal(dbS, s0)), 0)
assert.equal(ok('shuttleCost', () => M.shuttleCost(dbS, s0)), 0)
assert.equal(ok('sessionCost', () => M.sessionCost(dbS, s0)), 0)
assert.equal(ok('guestRev', () => M.guestRev(dbS, 'S')), 0)
assert.equal(ok('playedCourts', () => M.playedCourts(dbS, s0)), 0)
assert.equal(ok('perTube', () => M.perTube(dbS, s0)), cfg.shuttle.perTubeDefault)
ok('quotaFor', () => M.quotaFor(dbS, s0))
ok('costRow', () => M.costRow(dbS, s0))
ok('courtTxt', () => M.courtTxt(dbS, s0))
ok('timeTxt', () => M.timeTxt(s0))
// Buổi rỗng: chi phí mỗi người không được ra NaN (0/0). Trường tên là `per`, KHÔNG phải
// `perHead` — viết sai tên thì assert luôn đúng một cách vô nghĩa (undefined không chứa 'NaN').
assert.ok(Number.isFinite(M.costRow(dbS, s0).per), 'chi phí mỗi người ra NaN/Infinity')
assert.ok(Number.isFinite(M.costRow(dbS, s0).subsidy))
ok('costState', () => M.costState(s0))
ok('checkDue', () => M.checkDue(db))
assert.deepEqual(M.spreadDiff([], 5), {})

assert.equal(ok('remainSessions', () => M.remainSessions(dbS, 'x', MONTH)), 0)
ok('unitPrice', () => M.unitPrice(dbS, { gender: 'nam' }, M.groupOf(dbS, 'ALL'), MONTH))
assert.equal(ok('absentCount', () => M.absentCount(dbS, s0)), 0)
assert.equal(ok('rosterStatus', () => M.rosterStatus(dbS, MONTH, 'x', 'y')), 'none')
ok('guestPrice', () => M.guestPrice(dbS, cfg.levelsDefault[0], 'nam'))
ok('levelStyle', () => M.levelStyle(cfg.levelsDefault[0]))
ok('statusMeta', () => M.statusMeta('open'))

/* ---------- chia sân: buổi không có sân nào ---------- */

assert.deepEqual(ok('assignableSessions', () => A.assignableSessions(db)), [])
assert.deepEqual(ok('sessionPlayers', () => A.sessionPlayers(dbS, s0)), [])
assert.deepEqual(ok('activeCourtIdxs', () => A.activeCourtIdxs(s0)), [])
assert.deepEqual(ok('slotIds', () => A.slotIds(s0)), [])
assert.deepEqual(ok('matchStats', () => A.matchStats([], 'S')), {})
ok('fairness', () => A.fairness([], {}))
ok('courtBalance', () => A.courtBalance({}, 0, () => undefined, db.levels))
ok('arrange rỗng', () => A.arrange({ players: [], session: s0, mode: 'balance', stats: {} }))
assert.deepEqual(ok('autoSplit', () => A.autoSplit([], [], db.levels)), {})

/* ---------- lịch tháng ---------- */

const grid = ok('monthGrid', () => monthGrid(MONTH))
assert.equal(grid.length, 6, 'lưới lịch luôn 6 tuần')
grid.forEach((w) => assert.equal(w.length, 7))

console.log('empty check: OK')
