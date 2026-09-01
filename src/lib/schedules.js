// SỬA một lịch tập cố định đã sinh buổi. Thuần: (db, sched, form) => bản kế hoạch, không ghi gì.
//
// Vì sao tách khỏi component: sửa lịch là thao tác DUY NHẤT trong app có thể xoá buổi hàng loạt,
// mà mỗi buổi bị xoá kéo theo điểm danh, trận, và TIỀN KHÁCH đã thu của buổi đó
// (`sessions` cascade xuống `session_guests`). Luật "được đụng buổi nào" phải nằm một chỗ,
// test được, chứ không rải trong JSX.
//
// BỐN RÀNG BUỘC, mỗi cái đổi bằng tiền thật:
//
//  1. KHÔNG đụng buổi đã mở / đã chốt / đã huỷ. Buổi `closed` đã đóng băng giá thành
//     (`sessions.cost_frozen_at`) — sửa là đổi con số người ta đã đọc và đã chia tiền.
//     Buổi `open` đang điểm danh dở. Cả hai chỉ ĐẾM để báo, không nằm trong add/remove.
//  2. KHÔNG đụng buổi trong quá khứ, kể cả còn `draft`: đã qua ngày đó rồi thì nó là lịch sử,
//     không phải kế hoạch.
//  3. KHÔNG cho đổi `groupId` khi lịch đã sinh buổi. Buổi cũ giữ groupId cũ ⇒ lịch nói nhóm A,
//     buổi nói nhóm B; mà `unitPrice`/`remainSessions`/`joinDues` đều đếm theo groupId.
//  4. Số buổi của một nhóm trong tháng là MẪU SỐ của đơn giá một buổi
//     (`money.js: unitPrice` = quỹ tháng ÷ số buổi). Thêm/bớt buổi là đổi tiền back của cả
//     nhóm trong tháng đó — nên `monthsTouched` trả về để màn hình nói thẳng ra trước khi lưu.

import { genDates, monthOf } from '#utils/dates.js'

/** Buổi đã mở/chốt/huỷ thì bất khả xâm phạm — chỉ đếm để báo, không bao giờ xoá. */
const LOCKED_STATUS = ['open', 'closed', 'cancelled']

export const isLocked = (s) => LOCKED_STATUS.indexOf(s.status) >= 0

/**
 * Buổi này có được sửa/xoá không: phải còn `draft` VÀ nằm ở tương lai.
 * `today` so bằng chuỗi ISO — cùng kiểu so sánh với `money.js: remainSessions`.
 */
export const isEditable = (s, today) => !isLocked(s) && s.date > today

/**
 * Kế hoạch sửa. `form` = { weekdays, rows, start, end } — đúng bộ trường của dialog tạo lịch.
 *
 * Trả về:
 *   keep     buổi giữ nguyên ngày, chỉ cập nhật sân/giờ (chỉ gồm buổi sửa được)
 *   add      ngày mới cần sinh buổi
 *   remove   id buổi draft-tương-lai không còn nằm trong lịch mới
 *   locked   buổi đã mở/chốt/huỷ nằm trong phạm vi — KHÔNG đụng, chỉ để báo
 *   past     buổi draft đã qua ngày — cũng không đụng
 *   monthsTouched  các tháng bị đổi SỐ BUỔI (add/remove), tức là đổi đơn giá một buổi
 *   blocked  lý do không cho lưu (mảng key i18n), rỗng = lưu được
 */
export function planScheduleEdit(db, sched, form) {
  const today = db.today
  const mine = (db.sessions || []).filter((s) => s.scheduleId === sched.id)
  const wanted = genDates(form.weekdays, form.start, form.end)
  const wantSet = new Set(wanted)

  const keep = []
  const remove = []
  const locked = []
  const past = []

  mine.forEach((s) => {
    if (isLocked(s)) return locked.push(s)
    if (s.date <= today) return past.push(s)
    if (wantSet.has(s.date)) keep.push(s)
    else remove.push(s.id)
  })

  // Ngày đã có buổi thì không sinh nữa — kể cả buổi đó đang bị khoá hoặc đã qua. Bỏ qua bước
  // này là `UNIQUE (schedule_id, date)` nổ 23503/23505, và theo `storage.js: flush` thì op
  // hỏng nằm lại trong hàng đợi MÃI, mọi thay đổi sau nó không xuống được DB.
  const had = new Set(mine.map((s) => s.date))
  const add = wanted.filter((d) => !had.has(d) && d > today)

  // Đổi số buổi của tháng nào thì đơn giá một buổi của tháng đó đổi theo.
  const months = new Set()
  add.forEach((d) => months.add(monthOf(d)))
  remove.forEach((id) => {
    const s = mine.find((x) => x.id === id)
    if (s) months.add(monthOf(s.date))
  })

  const blocked = []
  if (!(form.weekdays || []).length) blocked.push('schedules.errNoWeekday')
  if (!form.start) blocked.push('schedules.errNoStart')
  if (form.end && form.end < form.start) blocked.push('schedules.errRange')
  if (!(form.rows || []).length) blocked.push('schedules.errNoCourt')
  if ((form.rows || []).some((r) => !r.courtId)) blocked.push('schedules.errNoCourt')

  return {
    keep, add, remove, locked, past,
    monthsTouched: [...months].sort(),
    blocked,
  }
}

/**
 * Phần state thay đổi khi lưu. Tách khỏi `planScheduleEdit` để màn hình xem trước kế hoạch mà
 * không phải dựng sẵn bản ghi. `mkId` do action truyền vào (lib không được gọi crypto).
 *
 * Buổi GIỮ LẠI cũng phải cập nhật sân/giờ, không thì sửa lịch xong nhìn buổi cũ vẫn sân cũ và
 * người dùng tưởng chưa lưu. Chỉ đụng `keep` — buổi khoá và buổi quá khứ giữ nguyên tuyệt đối.
 */
export function applyScheduleEdit(db, sched, form, plan, mkId) {
  const rows = (form.rows || []).map((r) => ({ ...r, sold: false, soldAmount: 0, soldTo: '', extra: false }))
  const keepIds = new Set(plan.keep.map((s) => s.id))
  const dropIds = new Set(plan.remove)
  const stId = (db.shuttleTypes || [])[0] ? db.shuttleTypes[0].id : null

  const born = plan.add.map((date) => ({
    id: mkId(), date, groupId: sched.groupId, status: 'draft', shuttleUsed: 0,
    shuttleTypeId: stId, note: '', shuttleMode: 'quota', tubesOpened: 0, loose: 0, shuttleEst: true,
    courts: rows.map((r) => ({ ...r })), scheduleId: sched.id,
  }))

  return {
    schedules: db.schedules.map((x) => (x.id === sched.id
      ? { ...x, name: form.sName || x.name, weekdays: form.weekdays, rows: form.rows, start: form.start, end: form.end }
      : x)),
    sessions: db.sessions
      .filter((s) => !dropIds.has(s.id))
      .map((s) => (keepIds.has(s.id) ? { ...s, courts: rows.map((r) => ({ ...r })) } : s))
      .concat(born)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  }
}
