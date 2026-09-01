// node src/__tests__/lib/schedules.test.js
//
// SỬA lịch tập cố định (`lib/schedules.js`). Đây là thao tác duy nhất trong app xoá buổi hàng
// loạt, mà mỗi buổi bị xoá kéo theo điểm danh, trận, và TIỀN KHÁCH đã thu của buổi đó
// (`sessions` cascade xuống `session_guests`). Bốn chỗ sai tốn tiền:
//   1. đụng vào buổi đã chốt → sửa con số đã đóng băng, đã chia tiền cho cả nhóm;
//   2. đụng vào buổi quá khứ → xoá lịch sử điểm danh của ngày đã đánh;
//   3. sinh trùng ngày → UNIQUE (schedule_id, date) nổ, hàng đợi đồng bộ kẹt vĩnh viễn
//      mà màn hình vẫn báo đã lưu;
//   4. quên báo tháng bị đổi số buổi → đơn giá một buổi đổi âm thầm, tiền back cả nhóm sai.

import assert from 'node:assert/strict'
import { applyScheduleEdit, isEditable, planScheduleEdit } from '#lib/schedules.js'

const TODAY = '2026-09-10'
const SCHED = { id: 'SC1', groupId: 'G6', name: 'Oánh cầu thứ 6', weekdays: [5], rows: [], start: '2026-09-01', end: '2026-09-30' }

// Tháng 9/2026: các thứ 6 là 04, 11, 18, 25. Các thứ 5 là 03, 10, 17, 24.
const mkSession = (id, date, status = 'draft') => ({
  id, date, status, scheduleId: 'SC1', groupId: 'G6', courts: [{ courtId: 'C1', from: '20:30', to: '22:30' }],
})

const db = {
  today: TODAY,
  shuttleTypes: [{ id: 'ST1' }],
  schedules: [SCHED],
  sessions: [
    mkSession('s04', '2026-09-04', 'closed'), // đã chốt, đã đóng băng giá thành
    mkSession('s11', '2026-09-11'),           // draft, tương lai → sửa được
    mkSession('s18', '2026-09-18'),           // draft, tương lai → sửa được
    mkSession('s25', '2026-09-25'),           // draft, tương lai → sửa được
    { ...mkSession('sx', '2026-09-03'), scheduleId: 'SC2' }, // lịch KHÁC, không được đụng
  ],
}

const form = (patch) => ({
  sName: 'Oánh cầu thứ 6', weekdays: [5], start: '2026-09-01', end: '2026-09-30',
  rows: [{ courtId: 'C1', from: '20:30', to: '22:30' }],
  ...patch,
})

const ids = (list) => list.map((s) => s.id)

/* ---------- không đổi gì thì không đụng gì ---------- */

const same = planScheduleEdit(db, SCHED, form())
assert.deepEqual(same.add, [], 'lưu mà không đổi gì vẫn sinh buổi mới → trùng ngày, UNIQUE (schedule_id,date) nổ và kẹt hàng đợi đồng bộ')
assert.deepEqual(same.remove, [], 'lưu mà không đổi gì vẫn xoá buổi → mất điểm danh và tiền khách của buổi đó')
assert.deepEqual(ids(same.keep), ['s11', 's18', 's25'])
assert.deepEqual(ids(same.locked), ['s04'], 'buổi đã chốt phải nằm ở `locked` để màn hình báo, không được lẫn vào keep')
assert.deepEqual(same.monthsTouched, [], 'không đổi số buổi thì không được báo tháng nào bị ảnh hưởng')

/* ---------- buổi đã chốt và buổi quá khứ là bất khả xâm phạm ---------- */

// Bỏ hẳn thứ 6, chuyển sang thứ 5 → mọi buổi thứ 6 "đáng lẽ" bị xoá.
const moved = planScheduleEdit(db, SCHED, form({ weekdays: [4] }))
assert.ok(moved.remove.indexOf('s04') < 0,
  'buổi ĐÃ CHỐT bị đem đi xoá → mất giá thành đã đóng băng và tiền khách đã thu của buổi đó')
assert.deepEqual(moved.remove.sort(), ['s11', 's18', 's25'],
  'buổi draft tương lai không còn trong lịch mới thì phải xoá, không thì lịch nói một đằng buổi một nẻo')
assert.deepEqual(moved.add, ['2026-09-17', '2026-09-24'],
  'chuyển sang thứ 5 phải sinh đúng các thứ 5 CÒN LẠI của kỳ — 03 và 10 đã qua ngày hôm nay, không sinh ngược về quá khứ')

// Buổi draft nhưng đã qua ngày.
const dbPast = { ...db, sessions: db.sessions.concat([mkSession('s01', '2026-09-01')]) }
const past = planScheduleEdit(dbPast, SCHED, form({ weekdays: [4] }))
assert.ok(past.remove.indexOf('s01') < 0,
  'buổi draft ĐÃ QUA NGÀY vẫn bị xoá → xoá điểm danh của một ngày đã đánh xong')
assert.deepEqual(ids(past.past), ['s01'])

/* ---------- không sinh trùng ngày ---------- */

// Ngày 04 đã có buổi (đang closed). Giữ nguyên thứ 6 thì tuyệt đối không được sinh lại ngày đó.
assert.ok(same.add.indexOf('2026-09-04') < 0,
  'sinh lại ngày đã có buổi → UNIQUE (schedule_id, date) nổ, op hỏng kẹt trong hàng đợi mãi mà màn hình vẫn báo đã lưu')

// Kéo dài kỳ sang tháng 10: chỉ sinh phần MỚI.
const longer = planScheduleEdit(db, SCHED, form({ end: '2026-10-31' }))
assert.deepEqual(longer.add, ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'])
assert.deepEqual(longer.remove, [], 'kéo dài kỳ mà lại xoá buổi đang có')

// Rút ngắn kỳ.
const shorter = planScheduleEdit(db, SCHED, form({ end: '2026-09-15' }))
assert.deepEqual(shorter.remove.sort(), ['s18', 's25'])
assert.deepEqual(shorter.add, [])

/* ---------- báo tháng bị đổi đơn giá ---------- */

assert.deepEqual(longer.monthsTouched, ['2026-10'],
  'thêm buổi tháng 10 mà không báo tháng 10 → đơn giá một buổi (quỹ tháng ÷ số buổi) đổi âm thầm, tiền back cả nhóm sai')
assert.deepEqual(shorter.monthsTouched, ['2026-09'])

/* ---------- lịch khác không bị đụng ---------- */

assert.ok(moved.remove.indexOf('sx') < 0, 'xoá lan sang buổi của lịch KHÁC')
assert.ok(ids(moved.keep).indexOf('sx') < 0)

/* ---------- chặn lưu ---------- */

assert.deepEqual(planScheduleEdit(db, SCHED, form({ weekdays: [] })).blocked, ['schedules.errNoWeekday'])
assert.deepEqual(planScheduleEdit(db, SCHED, form({ end: '2026-08-01' })).blocked, ['schedules.errRange'],
  'ngày kết thúc trước ngày bắt đầu mà vẫn cho lưu → genDates trả rỗng, lưu xong xoá sạch buổi tương lai')
assert.deepEqual(planScheduleEdit(db, SCHED, form({ rows: [{ courtId: '' }] })).blocked, ['schedules.errNoCourt'],
  'sân rỗng lọt xuống DB là 22P02 (session_courts.court_id NOT NULL) và kẹt cả hàng đợi đồng bộ')
assert.deepEqual(same.blocked, [])

/* ---------- isEditable ---------- */

assert.equal(isEditable(mkSession('a', '2026-09-20'), TODAY), true)
assert.equal(isEditable(mkSession('a', '2026-09-20', 'closed'), TODAY), false)
assert.equal(isEditable(mkSession('a', '2026-09-20', 'open'), TODAY), false, 'buổi đang điểm danh dở không được sửa')
assert.equal(isEditable(mkSession('a', '2026-09-01'), TODAY), false)
assert.equal(isEditable(mkSession('a', TODAY), TODAY), false, 'buổi của CHÍNH HÔM NAY cũng không đụng — có thể đang đánh')

/* ---------- applyScheduleEdit ---------- */

let n = 0
const next = applyScheduleEdit(db, SCHED, form({ weekdays: [4] }), moved, () => 'new' + (++n))
const kept = next.sessions.filter((s) => s.scheduleId === 'SC1')

assert.ok(kept.some((s) => s.id === 's04'), 'buổi đã chốt phải còn nguyên trong state sau khi lưu')
assert.equal(kept.find((s) => s.id === 's04').courts[0].from, '20:30',
  'buổi đã chốt bị ghi đè sân/giờ → đổi số đã đóng băng của buổi đã chia tiền')
assert.ok(!kept.some((s) => s.id === 's11'), 'buổi draft tương lai không còn trong lịch mới phải bị xoá')
assert.equal(kept.filter((s) => s.date === '2026-09-17').length, 1)
assert.ok(next.sessions.some((s) => s.id === 'sx'), 'buổi của lịch khác biến mất khỏi state')

// Buổi GIỮ LẠI phải nhận sân/giờ mới, không thì sửa xong nhìn buổi cũ vẫn sân cũ.
const keepPlan = planScheduleEdit(db, SCHED, form({ rows: [{ courtId: 'C9', from: '19:00', to: '21:00' }] }))
const applied = applyScheduleEdit(db, SCHED, form({ rows: [{ courtId: 'C9', from: '19:00', to: '21:00' }] }), keepPlan, () => 'x')
assert.equal(applied.sessions.find((s) => s.id === 's11').courts[0].courtId, 'C9',
  'đổi sân mà buổi giữ lại vẫn sân cũ → user tưởng chưa lưu, bấm lại lần nữa')
assert.equal(applied.sessions.find((s) => s.id === 's04').courts[0].courtId, 'C1',
  'buổi đã chốt phải giữ SÂN CŨ kể cả khi đổi sân của lịch')

// Không mutate state gốc.
assert.equal(db.sessions.length, 5, 'applyScheduleEdit mutate mảng gốc → mutate thẳng state React')

console.log('schedule edit check: OK')
