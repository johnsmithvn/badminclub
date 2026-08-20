// Giá trị mặc định cho các form/dialog. Để ở đây để header, dialog và trang dùng chung một nguồn.


/** Một dòng sân mặc định: sân đầu tiên của CLB, giờ của nhóm đầu tiên. */
export function defaultCourtRows(db) {
  const g = db.groups[0]
  const c = db.courts[0]
  return [{ courtId: c ? c.id : '', from: g ? g.from : '18:00', to: g ? g.to : '20:00' }]
}

/** Form tạo buổi đột xuất. */
export const adhocForm = (db) => ({ aDate: db.today, aGroup: 'ALL', rows: defaultCourtRows(db) })

/** Form tạo lịch tập hàng loạt. */
export const scheduleForm = (db) => ({
  sName: '', sGroup: db.groups[0] && db.groups[0].id, weekdays: [],
  rows: defaultCourtRows(db), start: db.today, end: '',
})

/** Form nhập kho cầu. */
export const purchaseForm = (db) => ({
  pDate: db.today, pType: db.shuttleTypes[0] && db.shuttleTypes[0].id,
  pTubes: 10, pExtra: 0, pTotal: '', pPayer: '', pNote: '',
})

/** Form kiểm kho cuối tháng. */
export const stockCheckForm = (db) => ({ ckDate: db.today, ckCount: '' })

/** Form hoá đơn sân trọn tháng. */
export const courtBillForm = (db) => ({
  bDate: db.today, bMonth: db.month, bVenue: (db.courts[0] && db.courts[0].addr) || '',
  bAmount: '', bPayer: '', bNote: '',
})

/** Form ghi thu/chi tay vào sổ quỹ. */
export const ledgerForm = (db) => ({ lDate: db.today, lDir: 'out', lCat: 'other', lLabel: '', lAmount: '' })

/** Form thêm thành viên. */
export const memberForm = (db) => ({
  mName: '', mPhone: '', mGender: 'nam', mLevel: lv1(db), mGroups: [], mStart: 'next',
})

/** Trình độ gợi ý mặc định: bậc thứ hai trong thang của CLB, không có thì bậc đầu. */
const lv1 = (db) => (db.levels || [])[1] || (db.levels || [])[0] || ''

/** Form sửa thành viên. */
export const editMemberForm = (m) => ({
  eId: m.id, eName: m.name, ePhone: m.phone, eGender: m.gender, eLevel: m.level, eWhen: 'now',
})

/** Form thêm sân cho một buổi. */
export const addCourtForm = (db, s) => {
  const r = (s && (s.courts || [])[0]) || { from: '18:00', to: '20:00' }
  return { acCourt: db.courts[0] && db.courts[0].id, acFrom: r.from, acTo: r.to }
}

/** Form thêm khách giao lưu. */
export const guestForm = (db) => ({
  gName: '', gGender: 'nam', gLevel: lv1(db), gBy: '', gPaid: false,
})
