// Giá trị mặc định cho các form/dialog. Để ở đây để header, dialog và trang dùng chung một nguồn.


/**
 * Một dòng sân mặc định để ĐIỀN SẴN ô nhập: sân đầu tiên của CLB, giờ của nhóm đang chọn.
 * Đổi nhóm trong hộp thoại thì giờ đi theo — xem `appActions: setScheduleGroup`.
 * Giờ của nhóm KHÔNG phải giờ của buổi: buổi giữ giờ riêng trong `session_courts`, sửa giờ
 * nhóm về sau không đụng buổi nào đã sinh.
 */
export function defaultCourtRows(db) {
  const g = db.groups[0]
  const c = db.courts[0]
  return [{ courtId: c ? c.id : '', from: g ? g.from : '18:00', to: g ? g.to : '20:00' }]
}

/** Form tạo buổi đột xuất. */
export const adhocForm = (db) => ({ aDate: db.today, rows: defaultCourtRows(db) })

/** Form tạo lịch tập hàng loạt. */
export const scheduleForm = (db) => ({
  sName: '', sGroup: db.groups[0] && db.groups[0].id, weekdays: [],
  rows: defaultCourtRows(db), start: db.today, end: '',
})

/**
 * Form SỬA lịch đã có. `eSchedId` là cờ phân biệt sửa với tạo mới — dialog dùng chung một
 * component. `sGroup` có mặt để hiện tên nhóm, nhưng KHÔNG cho đổi: buổi đã sinh giữ groupId
 * cũ, đổi là lịch nói nhóm A còn buổi nói nhóm B, mà đơn giá và công nợ đều đếm theo groupId.
 */
export const editScheduleForm = (s) => ({
  eSchedId: s.id, sName: s.name || '', sGroup: s.groupId,
  weekdays: (s.weekdays || []).slice(),
  rows: (s.rows || []).map((r) => ({ ...r })),
  start: s.start, end: s.end || '',
})

/** Form nhập kho cầu. `pLeft` = số quả còn trong tủ TRƯỚC khi nhập, để trống thì bỏ qua. */
export const purchaseForm = (db) => ({
  pDate: db.today, pType: db.shuttleTypes[0] && db.shuttleTypes[0].id,
  pTubes: 10, pExtra: 0, pTotal: '', pPayer: '', pNote: '', pLeft: '',
})

/** Địa điểm để chọn khi nhập hoá đơn sân: gom địa chỉ các sân của CLB, bỏ trùng. */
export const venueOptions = (db) => {
  const seen = []
  ;(db.courts || []).forEach((c) => {
    const v = (c.addr || '').trim() || c.name
    if (v && seen.indexOf(v) < 0) seen.push(v)
  })
  return seen
}

/** Form kiểm kho cuối tháng. */
export const stockCheckForm = (db) => ({ ckDate: db.today, ckCount: '' })

/** Form hoá đơn sân trọn tháng. `bPayer` là id thành viên, không phải tên gõ tay. */
export const courtBillForm = (db) => ({
  bDate: db.today, bMonth: db.month, bVenue: venueOptions(db)[0] || '',
  bAmount: '', bPayer: '', bNote: '',
})

/** Form ghi thu/chi tay vào sổ quỹ. */
export const ledgerForm = (db) => ({ lDate: db.today, lDir: 'out', lCat: 'other', lLabel: '', lAmount: '' })

/** Form SỬA một hoá đơn sân đã ghi. `eBillId` là cờ phân biệt sửa với ghi mới. */
export const editBillForm = (b) => ({
  eBillId: b.id, bDate: b.date, bMonth: b.month, bVenue: b.venue,
  bAmount: String(b.amount ?? ''), bPayer: b.payerId || '', bNote: b.note || '',
})

/** Form SỬA một dòng thu/chi ghi tay. `eLedgerId` là cờ phân biệt sửa với ghi mới. */
export const editLedgerForm = (m) => ({
  eLedgerId: m.id, lDate: m.date, lDir: m.dir, lCat: m.cat,
  lLabel: m.label, lAmount: String(m.amount ?? ''),
})

/** Form thêm thành viên. */
export const memberForm = (db) => ({
  mName: '', mFull: '', mPhone: '', mEmail: '', mGender: 'nam', mLevel: lv1(db), mNote: '', mGroups: [],
  // CLB chưa có nhóm cố định nào thì mặc định 'đi lẻ', không thì bấm Thêm là bị chặn ngay.
  mStart: db.groups.length ? 'next' : 'none',
})

/** Trình độ gợi ý mặc định: bậc thứ hai trong thang của CLB, không có thì bậc đầu. */
const lv1 = (db) => (db.levels || [])[1] || (db.levels || [])[0] || ''

/**
 * Form sửa thành viên. `eGroups` là nhóm cố định, `eWhenGroup` quyết định áp dụng từ tháng nào —
 * mặc định THÁNG SAU vì tháng này có thể đã đóng tiền rồi, đổi ngay là phải xử lý khoản đã thu.
 * Trình độ áp dụng ngay lập tức cho các buổi tiếp theo.
 */
export const editMemberForm = (m) => ({
  eId: m.id, eName: m.name, eFull: m.fullName || '', ePhone: m.phone || '', eEmail: m.email || '',
  eGender: m.gender, eLevel: m.level, eNote: m.note || '',
  eGroups: (m.groupIds || []).slice(), eWhenGroup: 'next',
})

/** Form thêm sân cho một buổi. */
export const addCourtForm = (db, s) => {
  const r = (s && (s.courts || [])[0]) || { from: '18:00', to: '20:00' }
  return { acCourt: db.courts[0] && db.courts[0].id, acFrom: r.from, acTo: r.to }
}

/** Form thêm sân của CLB (không phải thêm sân cho một buổi — cái đó là addCourtForm). */
export const courtForm = () => ({ cName: '', cAddr: '', cPrice: '' })

/** Form thêm nhóm cố định. Giờ và định mức lấy theo nhóm đã có, không có thì mặc định. */
export const groupForm = (db) => {
  const g = db.groups[0]
  return {
    grName: '', grShort: '',
    grFrom: g ? g.from : '18:00', grTo: g ? g.to : '20:00',
    grFeeNam: '', grFeeNu: '', grQuota: String(g ? g.quota : ''),
    grCourts: db.courts.length === 1 ? [db.courts[0].id] : [],
  }
}

/** Form thêm khách giao lưu. */
export const guestForm = (db) => ({
  gName: '', gGender: 'nam', gLevel: lv1(db), gBy: '', gPaid: false,
})
