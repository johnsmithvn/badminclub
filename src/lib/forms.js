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
  return [{ courtId: c ? c.id : '', label: '', from: g ? g.from : '18:00', to: g ? g.to : '20:00' }]
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


/**
 * Chuẩn hoá tên sân cho hoá đơn:
 * Nếu `venue` đang lưu địa chỉ của một sân trong CLB (do dữ liệu cũ hoặc người dùng chọn địa chỉ),
 * ánh xạ lại thành tên sân để hiển thị và lưu cho chuẩn.
 */
export const resolveVenue = (db, venue) => {
  if (!venue || !db || !db.courts) return venue || ''
  const trimmed = String(venue).trim()
  if (!trimmed) return ''
  const byName = (db.courts || []).find((c) => (c.name || '').trim() === trimmed)
  if (byName && (byName.name || '').trim()) return byName.name.trim()
  const byAddr = (db.courts || []).find((c) => (c.addr || '').trim() === trimmed)
  if (byAddr && (byAddr.name || '').trim()) return byAddr.name.trim()
  return venue
}

/** Tên sân để chọn khi nhập hoá đơn sân: ưu tiên tên sân của CLB, bỏ trùng; sân không có tên thì lấy địa chỉ. */
export const venueOptions = (db) => {
  const seen = []
  ;(db.courts || []).forEach((c) => {
    const v = (c.name || '').trim() || (c.addr || '').trim()
    if (v && seen.indexOf(v) < 0) seen.push(v)
  })
  return seen
}


/** Form hoá đơn sân trọn tháng. `bPayer` là id thành viên, không phải tên gõ tay. */
export const courtBillForm = (db) => ({
  bDate: db.today, bMonth: db.month, bVenue: venueOptions(db)[0] || '',
  bAmount: '', bPayer: '', bNote: '',
})

/** Form ghi thu/chi tay vào sổ quỹ. */
export const ledgerForm = (db) => ({ lDate: db.today, lDir: 'out', lCat: 'other', lLabel: '', lAmount: '' })

/** Form SỬA một hoá đơn sân đã ghi. `eBillId` là cờ phân biệt sửa với ghi mới. */
export const editBillForm = (b, db = null) => ({
  eBillId: b.id, bDate: b.date, bMonth: b.month,
  bVenue: db ? resolveVenue(db, b.venue) : (b.venue || ''),
  bAmount: String(b.amount ?? ''), bPayer: b.payerId || '', bNote: b.note || '',
})

/** Form SỬA một dòng thu/chi ghi tay. `eLedgerId` là cờ phân biệt sửa với ghi mới. */
export const editLedgerForm = (m) => ({
  eLedgerId: m.id, lDate: m.date, lDir: m.dir, lCat: m.cat,
  lLabel: m.label, lAmount: String(m.amount ?? ''),
})

/** Form thêm thành viên. */
export const memberForm = (db) => ({
  mName: '', mFull: '', mPhone: '', mEmail: '', mGender: 'nam', mLevel: lv1(db), mNote: '',
  mAvatarUrl: '', mQrUrl: '', mBankHolder: '', mBankNo: '', mBankName: '', mBankAccounts: [],
  mGroups: [],
  // CLB chưa có nhóm cố định nào thì mặc định 'đi lẻ', không thì bấm Thêm là bị chặn ngay.
  mStart: db.groups.length ? 'next' : 'none',
})

/** Trình độ gợi ý mặc định: bậc thứ hai trong thang của CLB, không có thì bậc đầu. */
const lv1 = (db) => (db.levels || [])[1] || (db.levels || [])[0] || ''

/**
 * Form sửa thành viên. `eGroups` là nhóm cố định trong hồ sơ.
 * Trình độ áp dụng ngay lập tức cho các buổi tiếp theo.
 */
export const editMemberForm = (m) => ({
  eId: m.id, eName: m.name, eFull: m.fullName || '', ePhone: m.phone || '', eEmail: m.email || '',
  eGender: m.gender, eLevel: m.level, eNote: m.note || '',
  eAvatarUrl: m.avatarUrl || '', eQrUrl: m.qrUrl || '',
  eBankHolder: m.bankHolder || '', eBankNo: m.bankNo || '', eBankName: m.bankName || '',
  eBankAccounts: (m.bankAccounts || []).slice(),
  eGroups: (m.groupIds || []).slice(),
})

/** Form thêm sân cho một buổi. */
export const addCourtForm = (db, s) => {
  const r = (s && (s.courts || [])[0]) || { from: '18:00', to: '20:00' }
  return { acCourt: db.courts[0] && db.courts[0].id, acLabel: '', acFrom: r.from, acTo: r.to }
}

/** Form thêm sân của CLB (không phải thêm sân cho một buổi — cái đó là addCourtForm). */
export const courtForm = () => ({ cName: '', cAddr: '', cMapUrl: '', cPrice: '' })

/** Form thêm nhóm cố định. Giờ lấy theo nhóm đã có, không có thì mặc định. */
export const groupForm = (db) => {
  const g = db.groups[0]
  return {
    grName: '', grShort: '',
    grFrom: g ? g.from : '18:00', grTo: g ? g.to : '20:00',
    grFeeNam: '', grFeeNu: '',
    grCourts: db.courts.length === 1 ? [db.courts[0].id] : [],
  }
}

/** Form thêm khách giao lưu. */
export const guestForm = (db) => ({
  gGuestId: '', gName: '', gGender: 'nam', gLevel: lv1(db), gBy: '', gPhone: '', gNote: '', gPaid: false, gUpdateGuestLevel: true,
  gHasCompanion: false, gCompanionName: '', gCompanionGender: 'nu', gCompanionLevel: lv1(db),
})
