// node src/__tests__/lib/members.test.js
//
// Lọc · tìm · sắp xếp danh sách thành viên (`lib/members.js`). Ba chỗ sai tốn tiền thật:
//   1. tìm bỏ dấu — gõ "thuy" không ra "Thúy" thì người thu tiền tưởng chưa có tên đó và
//      tạo thêm một bản ghi trùng, từ đó quỹ tháng đẻ hai khoản cho một người;
//   2. trạng thái thu 'none' (chưa chốt danh sách, chưa có gì để thu) KHÁC 'paid' (đã thu đủ) —
//      gộp hai cái là bỏ sót người phải thu, hoặc đi đòi người đã đóng;
//   3. sắp trình độ theo thang của CLB, không theo chữ cái.

import assert from 'node:assert/strict'
import {
  FILTER0, MERGE_FIELDS, duesStatusOf, filterMembers, fixedGroups, hasFilter, mergeRows,
  nextSort, sortMembers,
} from '#lib/members.js'

const MONTH = '2026-09'

const db = {
  month: MONTH,
  // Thang của CLB: mạnh dần. Theo alphabet thì 'TBY' đứng TRƯỚC 'TB+' — đúng ngược với thang này.
  levels: ['Newbie', 'TBY', 'TB-', 'TB', 'TB+'],
  groups: [
    { id: 'G6', name: 'Ca thứ 6', short: 'T6' },
    { id: 'GCN', name: 'Ca chủ nhật', short: 'CN' },
  ],
  members: [
    { id: 'm1', name: 'Thúy', fullName: 'Nguyễn Thị Thuý', email: 'Thuy@Gmail.com', gender: 'nu', level: 'TBY', phone: '0327 279 292' },
    { id: 'm2', name: 'Vân Anh', gender: 'nu', level: 'TB+', phone: '0912345678' },
    { id: 'm3', name: 'Đạt', gender: 'nam', level: 'TB-', phone: '' },
    { id: 'm4', name: 'Khải', gender: 'nam', level: 'Newbie', phone: '0900000001' },
  ],
  roster: {
    [MONTH]: {
      G6: { m1: 'fixed', m2: 'fixed' },
      GCN: { m2: 'fixed', m3: 'fixed' },
      // m4 không cố định nhóm nào — đi lẻ.
    },
  },
  dues: [
    { id: 'd1', month: MONTH, groupId: 'G6', memberId: 'm1', amount: 250000, paidAmount: 250000 },
    { id: 'd2', month: MONTH, groupId: 'G6', memberId: 'm2', amount: 250000, paidAmount: 100000 },
    { id: 'd3', month: MONTH, groupId: 'GCN', memberId: 'm2', amount: 250000, paidAmount: 250000 },
    { id: 'd4', month: MONTH, groupId: 'GCN', memberId: 'm3', amount: 300000, paidAmount: 0 },
    // m4 chưa có khoản nào → 'none'.
    // Tháng khác: không được lọt vào tháng đang xem.
    { id: 'd9', month: '2026-08', groupId: 'G6', memberId: 'm4', amount: 250000, paidAmount: 250000 },
  ],
}

const all = db.members
const names = (rows) => rows.map((m) => m.name)
const f = (patch) => ({ ...FILTER0, ...patch })

/* ---------- tìm theo tên và số điện thoại ---------- */

assert.deepEqual(names(filterMembers(db, all, f({ q: 'thuy' }), MONTH)), ['Thúy'],
  'gõ không dấu không ra người có dấu → người thu tiền tưởng chưa có tên này và tạo bản ghi trùng, quỹ tháng đẻ hai khoản cho một người')

assert.deepEqual(names(filterMembers(db, all, f({ q: 'VÂN ANH' }), MONTH)), ['Vân Anh'],
  'tìm phải bỏ qua hoa/thường, không thì gõ đúng tên vẫn ra rỗng')

assert.deepEqual(names(filterMembers(db, all, f({ q: 'vananh' }), MONTH)), ['Vân Anh'],
  'tìm phải bỏ qua khoảng trắng — người ta gõ liền tên là chuyện thường')

assert.deepEqual(names(filterMembers(db, all, f({ q: '0327279292' }), MONTH)), ['Thúy'],
  'SĐT trong DB lưu có dấu cách mà tìm bằng số liền không ra → không tra được người từ tin nhắn chuyển khoản')

assert.deepEqual(names(filterMembers(db, all, f({ q: 'nguyen thi thuy' }), MONTH)), ['Thúy'],
  'tìm phải soi cả TÊN ĐẦY ĐỦ — người thu tiền cầm giấy chuyển khoản ghi tên khai sinh, gõ vào ra rỗng là họ tạo thêm một bản ghi trùng cho người đã có')

assert.deepEqual(names(filterMembers(db, all, f({ q: 'thuy@gmail.com' }), MONTH)), ['Thúy'],
  'tìm phải soi cả EMAIL, và không phân biệt hoa/thường — email trong sổ CLB lưu sao thì gõ sao cũng phải ra')

assert.deepEqual(filterMembers(db, all, f({ q: 'khong-co-ai' }), MONTH), [],
  'không khớp gì thì phải rỗng, không được trả cả danh sách')

assert.deepEqual(names(filterMembers(db, all, FILTER0, MONTH)), names(all),
  'bộ lọc rỗng phải trả nguyên danh sách, không được nuốt mất ai')

/* ---------- lọc giới tính · trình độ · nhóm ---------- */

assert.deepEqual(names(filterMembers(db, all, f({ gender: 'nu' }), MONTH)), ['Thúy', 'Vân Anh'],
  'lọc giới tính sai là chia đội và tính quỹ nam/nữ nhầm mức phí')

assert.deepEqual(names(filterMembers(db, all, f({ level: 'TB+' }), MONTH)), ['Vân Anh'],
  'lọc trình độ sai là xếp sân lệch trình và tính giá khách nhầm bậc')

assert.deepEqual(names(filterMembers(db, all, f({ group: 'G6' }), MONTH)), ['Thúy', 'Vân Anh'],
  'lọc nhóm phải đọc roster THÁNG ĐANG XEM, không phải groupIds — sai là thu nhầm người của ca khác')

assert.deepEqual(names(filterMembers(db, all, f({ group: 'none' }), MONTH)), ['Khải'],
  '"Không cố định" phải ra đúng người đi lẻ — họ trả theo giá khách từng buổi, không đóng quỹ tháng')

assert.deepEqual(names(filterMembers(db, all, f({ gender: 'nu', group: 'GCN' }), MONTH)), ['Vân Anh'],
  'hai bộ lọc phải cộng dồn (AND), không được cái sau đè cái trước')

/* ---------- trạng thái thu ---------- */

assert.equal(duesStatusOf(db, 'm1', MONTH), 'paid', 'đóng đủ mà không báo paid → đi đòi người đã trả')
assert.equal(duesStatusOf(db, 'm2', MONTH), 'unpaid',
  'đóng thiếu một phần vẫn là CHƯA đóng — coi là xong thì mất phần còn thiếu')
assert.equal(duesStatusOf(db, 'm3', MONTH), 'unpaid', 'chưa trả đồng nào phải là unpaid')
assert.equal(duesStatusOf(db, 'm4', MONTH), 'none',
  'chưa chốt danh sách nên chưa có khoản nào — báo "paid" là bỏ sót cả một người phải thu')

assert.deepEqual(names(filterMembers(db, all, f({ dues: 'unpaid' }), MONTH)), ['Vân Anh', 'Đạt'],
  'lọc "Chưa đóng" là danh sách đi đòi tiền — sót một người là hụt quỹ tháng đó')
assert.deepEqual(names(filterMembers(db, all, f({ dues: 'paid' }), MONTH)), ['Thúy'])
assert.deepEqual(names(filterMembers(db, all, f({ dues: 'none' }), MONTH)), ['Khải'])

/* ---------- sắp xếp ---------- */

assert.deepEqual(names(sortMembers(db, all, {}, MONTH)), names(all),
  'chưa chọn cột nào thì giữ nguyên thứ tự gốc, không được tự sắp')

assert.deepEqual(
  names(sortMembers(db, all, { key: 'l', dir: 'asc' }, MONTH)),
  ['Khải', 'Thúy', 'Đạt', 'Vân Anh'],
  'trình độ phải sắp theo THỨ TỰ trong db.levels (Newbie < TBY < TB- < TB+). Theo chữ cái thì ' +
  '"TB+" đứng trước "TBY" — bảng xếp hạng trình độ sai và không ai nhìn ra')

assert.deepEqual(
  names(sortMembers(db, all, { key: 'l', dir: 'desc' }, MONTH)),
  ['Vân Anh', 'Đạt', 'Thúy', 'Khải'],
  'đảo chiều phải đảo đúng thang, không phải đảo chữ cái')

assert.deepEqual(
  names(sortMembers(db, all, { key: 'd', dir: 'asc' }, MONTH)).slice(0, 2),
  ['Vân Anh', 'Đạt'],
  'sắp cột quỹ tháng là để đi đòi tiền: người CHƯA đóng phải lên đầu, không phải người đã đóng')

assert.deepEqual(names(sortMembers(db, all, { key: 'g', dir: 'asc' }, MONTH)), ['Đạt', 'Khải', 'Thúy', 'Vân Anh'],
  'sắp giới tính phải gom nam về một cụm, nữ về một cụm')

assert.deepEqual(sortMembers(db, all, { key: 'khong-co-cot-nay' }, MONTH), all,
  'cột lạ thì trả nguyên danh sách, không được throw giữa lúc render bảng')

// Không được sửa mảng gốc: `db.members` là state của React, sắp tại chỗ là mutate state.
const before = names(all).join()
sortMembers(db, all, { key: 'n', dir: 'desc' }, MONTH)
assert.equal(names(all).join(), before, 'sortMembers mutate mảng gốc → mutate thẳng state React')

/* ---------- phụ trợ ---------- */

assert.equal(hasFilter(FILTER0), false)
assert.equal(hasFilter(f({ q: 'a' })), true)
assert.deepEqual(nextSort({}, 'n'), { key: 'n', dir: 'asc' }, 'bấm cột mới → xuôi từ đầu')
assert.deepEqual(nextSort({ key: 'n', dir: 'asc' }, 'n'), { key: 'n', dir: 'desc' }, 'bấm lại → đảo chiều')
assert.deepEqual(nextSort({ key: 'n', dir: 'desc' }, 'n'), { key: 'n', dir: 'asc' }, 'bấm lần ba → về xuôi')
assert.deepEqual(nextSort({ key: 'n', dir: 'asc' }, 'p'), { key: 'p', dir: 'asc' }, 'đổi cột → xuôi lại từ đầu')

assert.deepEqual(fixedGroups(db, 'm2', MONTH).map((g) => g.short), ['T6', 'CN'])
assert.deepEqual(fixedGroups(db, 'm4', MONTH), [])

/* ---------- ghép hồ sơ tài khoản vào bản ghi thành viên ---------- */
//
// Đây là màn duyệt người mới vào CLB. Tick nhầm một ô là ghi đè dữ liệu CLB đang dùng để tính
// tiền và xếp sân, mà không có đường lùi: `club_members` là bản sao độc lập, không phải khung
// nhìn của `profiles`, nên gỡ ghép cũng không lấy lại được giá trị cũ.

const rowOf = (rows, field) => rows.find((r) => r.field === field)

// Bản ghi tay chủ CLB đã nhập, và hồ sơ tài khoản của người xin vào.
const mem = {
  name: 'Thuý (SĐT chị Lan)', fullName: '', phone: '0327 279 292',
  email: 'THUY@GMAIL.COM', gender: 'nu', level: 'TBY',
}
const usr = {
  name: 'Nguyễn Thị Thuý', nick: 'Thúy', phone: '0327279292',
  email: 'thuy@gmail.com', gender: 'nu', level: 'TB',
}

const rows = mergeRows(mem, usr, db.levels)

assert.deepEqual(rows.map((r) => r.field), MERGE_FIELDS,
  'bảng chọn phải liệt kê ĐÚNG bộ trường mà RPC approve_join_request nhận — thừa một ô là tick xong không có gì đổi, thiếu một ô là không ghép được thứ người duyệt đang nhìn')

assert.equal(rowOf(rows, 'name').to, 'Thúy',
  'tên hiển thị phải ưu tiên nick: cả app gọi nhau bằng nick, ghi đè bằng tên khai sinh là mọi bảng điểm danh đổi tên một lượt')

assert.equal(rowOf(rows, 'fullName').to, 'Nguyễn Thị Thuý',
  'TÊN ĐẦY ĐỦ phải lấy profiles.name còn TÊN HIỂN THỊ lấy nick — ghép nhầm chiều là mọi bảng điểm danh đổi sang tên khai sinh, còn ô tên đầy đủ thì đọng biệt danh')

assert.equal(rowOf(rows, 'email').block, 'same',
  'email so không phân biệt hoa/thường (cột citext dưới DB cũng vậy) — bày ra ô tick cho hai chuỗi cùng một hộp thư là hỏi thừa')

assert.equal(rowOf(rows, 'phone').block, 'same',
  'SĐT phải so theo CHỮ SỐ — "0327 279 292" và "0327279292" là một số, bày ra ô tick là hỏi thừa và mời người ta bấm nhầm')

assert.equal(rowOf(rows, 'gender').block, 'same',
  'hai bên giống nhau thì không được mở ô tick: mỗi ô mở ra là một lần có thể bấm nhầm')

assert.equal(rowOf(rows, 'level').block, '',
  'trình độ khác nhau và THUỘC thang CLB thì phải cho ghép — đây là lý do chính người ta mở bảng này')

// Trình độ ngoài thang: 'TBK' không có trong db.levels của CLB này.
const off = mergeRows(mem, { ...usr, level: 'TBK' }, db.levels)
assert.equal(rowOf(off, 'level').block, 'offScale',
  'trình độ ngoài thang CLB mà cho ghép là levels.indexOf() ra -1: cột trình độ sắp sai và thuật toán cân sân đọc sai bậc, không màn nào lộ ra')

// Bản ghi CLB chưa có tên đầy đủ → vẫn ghép được (ô trống bên CLB không phải lý do khoá).
assert.equal(rowOf(rows, 'fullName').block, '',
  'bên CLB trống mà tài khoản có thì phải cho ghép — đó chính là lúc bảng này có ích nhất')

// Ghép Avatar và QR, Thông tin ngân hàng
const withBank = mergeRows(
  { ...mem, avatarUrl: '', qrUrl: '', bankNo: '' },
  { ...usr, avatarUrl: 'data:image/webp;base64,...', qrUrl: 'data:image/webp;base64,...', bankHolder: 'NGUYEN THI THUY', bankNo: '0912345678', bankName: 'MB Bank' },
  db.levels,
)
assert.equal(rowOf(withBank, 'avatarUrl').block, '', 'Tài khoản có avatar mới thì phải cho phép ghép')
assert.equal(rowOf(withBank, 'qrUrl').block, '', 'Tài khoản có mã QR mới thì phải cho phép ghép')
assert.equal(rowOf(withBank, 'bankNo').block, '', 'Tài khoản có STK mới thì phải cho phép ghép')
assert.equal(rowOf(withBank, 'bankNo').to, '0912345678')

// Hồ sơ tài khoản bỏ trống: ghi đè là XOÁ dữ liệu CLB đang có.
const empty = mergeRows(mem, { name: 'Nguyễn Thị Thuý', nick: 'Thúy' }, db.levels)
assert.equal(rowOf(empty, 'phone').block, 'empty',
  'tài khoản chưa có SĐT mà cho ghi đè là xoá mất SĐT chủ CLB đã nhập tay — mất luôn đường đòi tiền')
assert.equal(rowOf(empty, 'level').block, 'empty',
  'tài khoản chưa có trình độ mà cho ghi đè là club_members.level thành rỗng, mà cột đó NOT NULL')
assert.equal(rowOf(empty, 'email').block, 'empty',
  'tài khoản chưa có email thì không được xoá email chủ CLB đã nhập tay vào sổ')
assert.equal(rowOf(empty, 'avatarUrl').block, 'empty')
assert.equal(rowOf(empty, 'qrUrl').block, 'empty')

// Bản ghi rỗng / hồ sơ rỗng không được throw: màn duyệt render trước khi người duyệt chọn ai.
assert.equal(mergeRows(null, null, db.levels).length, MERGE_FIELDS.length,
  'thiếu bản ghi hoặc thiếu hồ sơ thì trả bảng đầy đủ với block, KHÔNG được throw giữa lúc render màn duyệt')
assert.ok(mergeRows(null, null, db.levels).every((r) => r.block === 'empty'))

console.log('members merge check: OK')

console.log('members filter/sort check: OK')
