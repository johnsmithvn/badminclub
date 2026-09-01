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
  FILTER0, duesStatusOf, filterMembers, fixedGroups, hasFilter, nextSort, sortMembers,
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
    { id: 'm1', name: 'Thúy', gender: 'nu', level: 'TBY', phone: '0327 279 292' },
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

console.log('members filter/sort check: OK')
