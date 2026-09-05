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
//     (`session_courts.cost`) — sửa là đổi con số người ta đã đọc và đã chia tiền.
//     Buổi `open` đang điểm danh dở. Cả hai chỉ ĐẾM để báo, không nằm trong add/remove.
//  2. KHÔNG đụng buổi trong quá khứ, kể cả còn `draft`: đã qua ngày đó rồi thì nó là lịch sử,
//     không phải kế hoạch.
//  3. Đổi `groupId` CHỈ khi mọi buổi của lịch còn sửa được (chưa mở, chưa qua ngày) — lúc đó
//     dời được cả lũ sang nhóm mới nên không có buổi nào rớt lại. Còn một buổi đã mở/đã chốt/
//     đã qua ngày là cấm: buổi đó giữ groupId cũ ⇒ lịch nói nhóm A, buổi nói nhóm B, mà
//     `unitPrice`/`remainSessions`/`joinDues` đều đếm theo groupId.
//     Chọn nhầm nhóm lúc tạo là chuyện thường; khoá cứng mà không có đường lùi thì người ta
//     kẹt với một lịch sai vĩnh viễn.
//  4. Số buổi của một nhóm trong tháng là MẪU SỐ của đơn giá một buổi
//     (`money.js: unitPrice` = quỹ tháng ÷ số buổi). Thêm/bớt buổi là đổi tiền back của cả
//     nhóm trong tháng đó — nên `monthsTouched` trả về để màn hình nói thẳng ra trước khi lưu.

import { genDates, monthOf } from '#utils/dates.js'

/**
 * Lý do không cho lưu → key i18n. Là hằng số EXPORT để `smoke/i18n.test.js` đòi được key:
 * mấy key này chỉ tới màn hình qua `t(bienSo)` nên regex quét key của test không thấy chúng.
 */
export const BLOCK_KEYS = {
  groupLocked: 'schedules.errGroupLocked',
  noWeekday: 'schedules.errNoWeekday',
  noStart: 'schedules.errNoStart',
  noEnd: 'schedules.errNoEnd',
  range: 'schedules.errRange',
  noCourt: 'schedules.errNoCourt',
}

/** Buổi đã mở/chốt/huỷ thì bất khả xâm phạm — chỉ đếm để báo, không bao giờ xoá. */
const LOCKED_STATUS = ['open', 'closed', 'cancelled']

export const isLocked = (s) => LOCKED_STATUS.indexOf(s.status) >= 0

/**
 * Buổi này có được sửa/xoá không: phải còn `draft` VÀ nằm ở tương lai.
 * `today` so bằng chuỗi ISO — cùng kiểu so sánh với `money.js: remainSessions`.
 */
export const isEditable = (s, today) => !isLocked(s) && s.date > today

/**
 * Lịch này còn "mềm" không: chưa buổi nào mở, chốt, huỷ, hay qua ngày. Mềm thì đổi nhóm được
 * và xoá hẳn được; cứng rồi thì chỉ sửa được phần tương lai.
 */
export const canRebind = (plan) => plan.locked.length === 0 && plan.past.length === 0

/**
 * Kế hoạch XOÁ HẲN một lịch. Chỉ cho khi lịch còn mềm: xoá lịch mà còn buổi đã chốt thì hoặc
 * mất giá thành đã đóng băng, hoặc bỏ buổi lại mồ côi — mà `sessions.schedule_id` là khoá ngoại
 * TRẦN (không cascade), nên bỏ mồ côi là Postgres 23503 và kẹt cả hàng đợi đồng bộ.
 * Lịch đã cứng thì đường đúng là bấm "Tắt", không phải xoá.
 */
export function planScheduleDelete(db, sched) {
  const mine = (db.sessions || []).filter((s) => s.scheduleId === sched.id)
  const locked = mine.filter(isLocked)
  const past = mine.filter((s) => !isLocked(s) && s.date <= db.today)
  return { sessions: mine, locked, past, ok: locked.length === 0 && past.length === 0 }
}

/**
 * Kế hoạch sửa. `form` = { weekdays, rows, start, end, sGroup } — đúng bộ trường của dialog.
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

  const soft = locked.length === 0 && past.length === 0
  // Đổi nhóm là dời TẤT CẢ buổi sang nhóm mới, nên chỉ làm được khi không buổi nào rớt lại.
  const groupTo = form.sGroup && form.sGroup !== sched.groupId ? form.sGroup : null

  // Đổi số buổi của tháng nào thì đơn giá một buổi của tháng đó đổi theo.
  const months = new Set()
  add.forEach((d) => months.add(monthOf(d)))
  remove.forEach((id) => {
    const s = mine.find((x) => x.id === id)
    if (s) months.add(monthOf(s.date))
  })
  // Dời nhóm cũng là đổi số buổi — rút hết buổi khỏi nhóm cũ và bơm sang nhóm mới, nên đơn giá
  // một buổi của CẢ HAI nhóm đổi trong mọi tháng có buổi bị dời. Thiếu dòng này thì đổi nhóm
  // trôi qua im lặng: `add`/`remove` đều rỗng nên không có gì báo, mà tiền back thì đã sai.
  if (groupTo) keep.forEach((s) => months.add(monthOf(s.date)))

  const blocked = []
  if (groupTo && !soft) blocked.push(BLOCK_KEYS.groupLocked)
  if (!(form.weekdays || []).length) blocked.push(BLOCK_KEYS.noWeekday)
  if (!form.start) blocked.push(BLOCK_KEYS.noStart)
  // Bảng lịch có nhãn "mở vô hạn" cho lịch không đặt ngày kết thúc, nên `end` rỗng là trạng thái
  // hợp lệ — nhưng `genDates(wd, start, '')` trả RỖNG (nó lấy e = start). Không chặn ở đây thì
  // `wantSet` rỗng ⇒ mọi buổi draft tương lai rơi vào `remove` và nút Lưu vẫn bật: mở hộp thoại
  // Sửa rồi bấm Lưu là xoá sạch buổi tương lai, kèm điểm danh và tiền khách của từng buổi.
  if (!form.end) blocked.push(BLOCK_KEYS.noEnd)
  if (form.end && form.end < form.start) blocked.push(BLOCK_KEYS.range)
  if (!(form.rows || []).length) blocked.push(BLOCK_KEYS.noCourt)
  if ((form.rows || []).some((r) => !r.courtId)) blocked.push(BLOCK_KEYS.noCourt)

  return {
    keep, add, remove, locked, past, groupTo, soft,
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

  // Đổi nhóm thì buổi phải đi theo. `plan.groupTo` chỉ khác null khi lịch còn mềm (không buổi
  // nào đã mở / đã qua ngày), nên không có buổi nào rớt lại ở nhóm cũ.
  const gid = plan.groupTo || sched.groupId

  const born = plan.add.map((date) => ({
    id: mkId(), date, groupId: gid, status: 'draft', note: '',
    courts: rows.map((r) => ({ ...r })), scheduleId: sched.id,
  }))

  return {
    schedules: db.schedules.map((x) => (x.id === sched.id
      ? { ...x, name: form.sName || x.name, groupId: gid, weekdays: form.weekdays, rows: form.rows, start: form.start, end: form.end }
      : x)),
    sessions: db.sessions
      .filter((s) => !dropIds.has(s.id))
      .map((s) => (keepIds.has(s.id) ? { ...s, groupId: gid, courts: rows.map((r) => ({ ...r })) } : s))
      .concat(born)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  }
}
