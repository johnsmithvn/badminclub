// node --test — Giá trị mặc định của mọi dialog (`src/lib/forms.js`).
// Bản đồ đầy đủ: src/__tests__/README.md
//
// Mấy hàm này trông vô hại nhưng quyết định thứ người dùng thấy sẵn trong ô nhập, và mặc định
// sai thì họ bấm Lưu mà không đọc. Hai thứ phải khoá:
//   1. CLB RỖNG không được sinh giá trị rác — `courtId: ''` xuống cột `uuid NOT NULL` là
//      Postgres 22P02 và kẹt cả hàng đợi đồng bộ (xem `appActions: createAdhoc`).
//   2. Mặc định nào ảnh hưởng TIỀN hoặc LỊCH SỬ thì phải là lựa chọn an toàn.

import assert from 'node:assert/strict'
import { seed } from '../fixture.js'
import {
  addCourtForm, adhocForm, courtBillForm, courtForm, defaultCourtRows, editMemberForm,
  groupForm, guestForm, ledgerForm, memberForm, scheduleForm,
  resolveVenue, venueOptions,
} from '#lib/forms.js'
import cfg from '#config/app.json' with { type: 'json' }

const db = seed()
/** CLB vừa tạo: không sân, không nhóm, không loại cầu, không thành viên. */
const empty = {
  ...db, courts: [], groups: [], members: [], guests: [],
  levels: cfg.levelsDefault,
}

/* ---------- dòng sân mặc định ---------- */

const rows = defaultCourtRows(db)
assert.equal(rows.length, 1)
assert.equal(rows[0].courtId, db.courts[0].id, 'lấy sân đầu tiên của CLB')
assert.equal(rows[0].from, db.groups[0].from, 'giờ lấy theo nhóm đầu tiên, không bịa')

// CLB rỗng: KHÔNG có sân nào để chọn. `courtId` rỗng là giá trị rác — action phải chặn trước
// khi nó xuống DB. Khoá ở đây để nếu ai đó đổi mặc định thành một id bịa thì test đỏ.
assert.equal(defaultCourtRows(empty)[0].courtId, '', 'không có sân thì để rỗng, KHÔNG bịa id')
assert.equal(defaultCourtRows(empty)[0].from, '18:00', 'không có nhóm thì rơi về giờ mặc định')

/* ---------- form buổi và lịch ---------- */

assert.equal(adhocForm(db).aDate, db.today, 'buổi đột xuất mặc định là HÔM NAY')
assert.equal(scheduleForm(db).sGroup, db.groups[0].id)
assert.deepEqual(scheduleForm(db).weekdays, [], 'không chọn sẵn thứ nào — chọn hộ là sinh buổi người ta không muốn')
assert.equal(scheduleForm(db).start, db.today)
assert.equal(scheduleForm(db).end, '', 'để trống = chỉ sinh đúng ngày bắt đầu, không sinh vô hạn')
assert.equal(scheduleForm(empty).sGroup, undefined, 'CLB chưa có nhóm thì không có gì để chọn')

assert.equal(addCourtForm(db, db.sessions[0]).acFrom, db.sessions[0].courts[0].from,
  'thêm sân cho buổi thì lấy giờ của sân đang có, khỏi gõ lại')
assert.equal(addCourtForm(empty, null).acCourt, undefined)
assert.equal(addCourtForm(empty, null).acFrom, '18:00', 'buổi chưa có sân nào vẫn phải ra giờ hợp lệ')

/* ---------- form tiền ---------- */



assert.equal(courtBillForm(db).bMonth, db.month, 'hoá đơn sân mặc định đúng tháng đang xem')
assert.equal(courtBillForm(db).bAmount, '')
assert.equal(courtBillForm(db).bVenue, venueOptions(db)[0])
assert.equal(courtBillForm(empty).bVenue, '', 'không có sân thì không bịa địa điểm')

assert.equal(ledgerForm(db).lDir, 'out', 'ghi tay mặc định là CHI')
assert.equal(ledgerForm(db).lAmount, '')

// Tên sân gom từ danh sách sân của CLB, ưu tiên tên sân; sân không có tên thì lấy địa chỉ.
const venues = venueOptions(db)
assert.equal(venues.length, new Set(venues).size, 'không được lặp địa điểm')
assert.deepEqual(venueOptions(empty), [])

const dbDup = { ...db, courts: [{ id: '1', name: 'Sân An Bình' }, { id: '2', name: 'Sân An Bình' }] }
assert.equal(venueOptions(dbDup).length, 1, 'hai sân cùng tên phải gộp làm một')

const dbNoName = { ...empty, courts: [{ id: '1', name: '', addr: 'Số 1 Mai Dịch' }] }
assert.equal(venueOptions(dbNoName)[0], 'Số 1 Mai Dịch', 'sân không có tên thì lấy địa chỉ')

// Chuẩn hoá tên sân: địa chỉ cũ được ánh xạ về tên sân
assert.equal(resolveVenue(db, 'Nhà TĐ Phú Khê'), 'Sân Phú Khê 1', 'địa chỉ cũ phải ánh xạ về tên sân')
assert.equal(resolveVenue(db, 'Sân Yên Phong'), 'Sân Yên Phong', 'đã là tên sân thì giữ nguyên')
assert.equal(resolveVenue(empty, 'Địa chỉ lạ'), 'Địa chỉ lạ')

/* ---------- form thành viên ---------- */

assert.equal(memberForm(db).mStart, 'next', 'thêm người mặc định cố định từ THÁNG SAU')
assert.equal(memberForm(empty).mStart, 'none',
  'CLB chưa có nhóm nào thì mặc định "đi lẻ" — để "next" thì bấm Thêm là bị chặn ngay')
assert.deepEqual(memberForm(db).mGroups, [])
assert.equal(memberForm(db).mLevel, db.levels[1], 'gợi ý bậc thứ hai trong thang, không phải bậc yếu nhất')
assert.equal(memberForm({ ...empty, levels: ['A'] }).mLevel, 'A', 'thang một bậc thì dùng bậc đó')
assert.equal(memberForm({ ...empty, levels: [] }).mLevel, '', 'không có thang thì để rỗng, không undefined')

const ef = editMemberForm(db.members[0])
assert.equal(ef.eId, db.members[0].id)
assert.deepEqual(ef.eGroups, db.members[0].groupIds, 'mở dialog phải tích sẵn đúng nhóm đang có')
assert.equal(typeof ef.eNote, 'string', 'có trường eNote')
assert.equal(typeof memberForm(db).mNote, 'string', 'có trường mNote')

/* ---------- form khách ---------- */

const gf = guestForm(db)
assert.equal(gf.gName, '')
assert.equal(gf.gGender, 'nam')
assert.equal(gf.gLevel, db.levels[1])
assert.equal(gf.gBy, '', 'người rủ để trống — chọn hộ là gán nợ khách cho người không rủ')
assert.equal(gf.gPaid, false, 'mặc định GHI NỢ, không phải đã trả')
assert.equal(guestForm({ ...empty, levels: [] }).gLevel, '',
  'CLB chưa có thang trình độ thì rỗng — addGuest bắt được và chặn, thay vì nhét undefined xuống cột NOT NULL')

/* ---------- form cấu hình ---------- */

assert.deepEqual(courtForm(), { cName: '', cAddr: '', cMapUrl: '', cPrice: '' })
assert.deepEqual(groupForm(db).grCourts, [], 'CLB nhiều sân thì không chọn hộ sân nào')
assert.deepEqual(groupForm({ ...empty, courts: [db.courts[0]] }).grCourts, [db.courts[0].id],
  'CLB đúng một sân thì chọn sẵn — không có lựa chọn nào khác để mà phân vân')
assert.equal(groupForm(db).grFeeNam, '', 'quỹ tháng để trống, không gợi ý số tiền')

console.log('lib/forms check: OK')
