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
import * as CH from '#lib/challenge.js'
import * as R from '#lib/rating.js'
import * as MS from '#lib/matchSearch.js'
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

// CLB chưa có nhóm nào là trạng thái HỢP LỆ (0008): ai chưa thuộc nhóm nào thì tính đi lẻ.
// `dbmap` từng bịa ra một nhóm "Cố định" với uuid MỚI mỗi lần nạp khi DB trả về 0 nhóm — xoá
// nhóm xong, reload là nó mọc lại với id khác, rồi `storage: save` ghi ngược xuống DB thành
// nhóm ma. Nó cũng che luôn cả bài test này: cả file dưới đây tưởng là đang chạy trên CLB
// rỗng, thật ra vẫn có một nhóm. Khoá lại ở đây.
assert.deepEqual(db.groups, [],
  'dbmap bịa ra nhóm mặc định khi CLB chưa có nhóm → xoá nhóm xong reload là nó mọc lại với id khác, và cả bộ test "CLB rỗng" dưới đây chạy trên dữ liệu không rỗng')

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
assert.equal(ok('playerName', () => M.playerName(db, 'x')), 'x')
assert.equal(ok('sessionOf', () => M.sessionOf(db, 'x')), undefined)
assert.ok(ok('groupOf', () => M.groupOf(db, 'x')).courtIds)
assert.ok(ok('groupOf ALL', () => M.groupOf(db, 'ALL')).name)

/* ---------- tổng hợp toàn CLB ---------- */

assert.equal(ok('fundBalance', () => L.fundBalance(db)), 0)
assert.deepEqual(ok('availableBalance', () => L.availableBalance(db)),
  { balance: 0, advance: 0, back: 0, owed: 0, available: 0 })
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
assert.equal(ok('courtPayMode', () => M.courtPayMode(db)), 'month')

/* ---------- một buổi vừa tạo: chưa sân, chưa ai điểm danh ---------- */

const s0 = {
  id: 'S', date: TODAY, groupId: 'ALL', scheduleId: null, status: 'open', note: '',
  closedAt: null, courts: [],
}
const dbS = { ...db, sessions: [s0] }

assert.equal(ok('presentCount', () => M.presentCount(dbS, s0)), 0)
assert.equal(ok('courtCost', () => M.courtCost(dbS, s0)), 0)
assert.equal(ok('courtBase', () => M.courtBase(dbS, s0)), 0)
assert.equal(ok('courtExtraCost', () => M.courtExtraCost(dbS, s0)), 0)
assert.equal(ok('soldTotal', () => M.soldTotal(dbS, s0)), 0)
assert.equal(ok('guestRev', () => M.guestRev(dbS, 'S')), 0)
assert.equal(ok('playedCourts', () => M.playedCourts(dbS, s0)), 0)
ok('courtTxt', () => M.courtTxt(dbS, s0))
ok('timeTxt', () => M.timeTxt(s0))
// CLB rỗng thì không có gì để cảnh báo — nhắc "chưa nhập hoá đơn sân" ngay hôm tạo CLB là nhắc oan.
assert.deepEqual(ok('homeAlerts', () => M.homeAlerts(db)), [])
assert.deepEqual(ok('advanceRows', () => M.advanceRows(db)), [])
assert.equal(ok('isVault', () => M.isVault(db, 'không-có-ai')), false)
ok('joinDues', () => M.joinDues(db, { gender: 'nam' }, M.groupOf(db, 'ALL'), MONTH))
// CLB rỗng: chốt danh sách không sinh khoản nào, và ngưng hoạt động không hỏi back tiền.
assert.deepEqual(ok('lockDues', () => M.lockDues(db, MONTH)), { rows: [], used: [] })
assert.equal(ok('offBackSuggest', () => M.offBackSuggest(db, 'không-có-ai')), null)
ok('payerName', () => M.payerName(db, null, ''))
assert.equal(M.intOf('1.650.000'), 1650000)
assert.deepEqual(ok('memberRefs', () => M.memberRefs(db, 'x')), [])

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

/* ---------- kèo đấu, elo và tìm trận khi CLB rỗng ---------- */

assert.equal(ok('nextChallengeCode', () => CH.nextChallengeCode(db.challenges)), 'C-0101')
assert.deepEqual(ok('pickableMembersForChallenge', () => CH.pickableMembersForChallenge(db.members, db.attendance, 's0')), [])
assert.equal(ok('challengeDirection', () => CH.challengeDirection(null, 'mid')), 'none')
assert.equal(ok('canCancelChallenge', () => CH.canCancelChallenge(null, 'mid')), false)
assert.equal(ok('isWaitingCourt', () => CH.isWaitingCourt(null)), false)
ok('evalChallengeBalance', () => CH.evalChallengeBalance([], [], {}))
ok('getPlayerRating non-existent', () => R.getPlayerRating(db.playerRatings, 'non-existent'))
ok('expectedScore', () => R.expectedScore(0, 0))
ok('teamRating', () => R.teamRating([], {}))
ok('calcEloDelta', () => R.calcEloDelta(0, 0, true))
ok('confidenceProgress', () => R.confidenceProgress(0))
assert.equal(ok('computeClubCalibration', () => R.computeClubCalibration(db.matches, db.members)).length, 3)
assert.deepEqual(ok('searchMatches', () => MS.searchMatches(db.matches, {})), [])
assert.deepEqual(ok('headToHeadMatrix', () => MS.headToHeadMatrix(db.matches, db.members)), {})
assert.deepEqual(ok('neverMetPairs', () => MS.neverMetPairs(db.matches, db.members)), [])

console.log('empty check: OK')
