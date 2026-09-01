// node --test — Ma trận quyền 5 vai: cờ · route · "xem như".
// Bản đồ đầy đủ: src/__tests__/README.md
//
// Vì sao đáng test dù chỉ là tra bảng: ma trận này tồn tại ở HAI NƠI — `src/config/permissions.json`
// cho client và bảng `role_permissions` seed trong `0001_init.sql` cho RLS. Lệch nhau thì UI mở ra
// một thứ mà Supabase từ chối, và người dùng chỉ nhận được lỗi không hiểu.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ROLE_KEYS, ROLES, allowedRoutes, can, effRoute, roleDesc, roleName, viewAsOptions } from '#lib/roles.js'
import perm from '#config/permissions.json' with { type: 'json' }
import { ROUTE_KEYS } from '#routes'

/* ---------- cờ quyền ---------- */

assert.deepEqual(ROLE_KEYS, ['owner', 'treasurer', 'member'],
  'thứ tự vai là thứ tự MẠNH → YẾU, viewAsOptions cắt mảng theo đúng nó')

assert.equal(can('owner', 'money'), true)
assert.equal(can('owner', 'settings'), true)
assert.equal(can('treasurer', 'money'), true)
assert.equal(can('treasurer', 'sessions'), true, 'thủ quỹ sửa được buổi tập/điểm danh')
assert.equal(can('treasurer', 'assign'), true, 'thủ quỹ sửa được chia sân')
assert.equal(can('treasurer', 'members'), false, 'thủ quỹ xem được thành viên nhưng không sửa')
assert.equal(can('treasurer', 'settings'), false, 'thủ quỹ xem được Cài đặt nhưng không sửa')
assert.equal(can('member', 'assign'), false, 'thành viên chỉ XEM sơ đồ sân')
assert.equal(can('member', 'money'), false, 'thành viên chỉ XEM tiền')
assert.equal(can('member', 'viewAll'), true, 'thành viên xem được toàn bộ')
assert.deepEqual(perm.flags.member, ['viewAll'], 'thành viên chỉ có cờ viewAll')
assert.equal(can('vai lạ', 'money'), false, 'vai không có trong ma trận thì không được gì, không throw')
assert.equal(can('owner', 'cờ lạ'), false)

/* ---------- KHỚP VỚI SEED TRONG DB ---------- */
// `role_permissions` là nguồn RLS dùng; `permissions.json` là nguồn UI dùng. Đây là chỗ duy nhất
// hai file đó được so với nhau — lệch thì test đỏ ngay, không đợi tới lúc user bấm.

const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8')
const COLS = ['money', 'members', 'sessions', 'assign', 'settings', 'viewAll']
// Cắt đúng khối INSERT: chữ 'owner' còn xuất hiện ở enum club_role và ở create_club.
const seedBlock = sql.split('INSERT INTO role_permissions VALUES')[1]
assert.ok(seedBlock, 'không tìm thấy seed role_permissions trong 0001_init.sql')
const seedRows = [...seedBlock.split(';')[0].matchAll(/\('(\w+)',([^)]+)\)/g)]
assert.equal(seedRows.length, ROLE_KEYS.length, 'phải đọc được đủ 3 dòng seed role_permissions')

seedRows.forEach(([, role, rest]) => {
  const bits = rest.split(',').map((x) => x.trim() === 'true')
  assert.equal(bits.length, COLS.length, 'seed ' + role + ' phải có đủ 6 cờ')
  const fromSql = COLS.filter((_, i) => bits[i])
  assert.deepEqual(
    [...(perm.flags[role] || [])].sort(),
    fromSql.sort(),
    'permissions.json và seed role_permissions LỆCH NHAU ở vai ' + role
  )
})

/* ---------- route ---------- */

assert.equal(allowedRoutes('owner'), null, 'owner vào được tất cả — null nghĩa là không giới hạn')
assert.equal(allowedRoutes('treasurer'), null, 'treasurer vào được tất cả để xem')
assert.equal(allowedRoutes('member'), null, 'member vào được tất cả để xem')

assert.equal(effRoute('member', 'fund'), 'fund')
assert.equal(effRoute('member', 'settings'), 'settings')
assert.equal(effRoute('owner', 'settings'), 'settings')

/* ---------- BẤT BIẾN: vào được mà không có cờ ghi thì màn hình PHẢI chỉ đọc ---------- */

const ROUTE_WRITE_FLAG = {
  sessions: 'sessions', session: 'sessions', schedules: 'sessions',
  assign: 'assign', members: 'members', settings: 'settings',
  debts: 'money', fund: 'money', shuttles: 'money',
}
/** Cặp `vai:route` đã rà tay và xác nhận màn hình có chặn ghi. */
const READ_ONLY_OK = new Set([
  'treasurer:members', 'treasurer:settings',
  'member:sessions', 'member:session', 'member:schedules',
  'member:assign', 'member:members', 'member:settings',
  'member:debts', 'member:fund', 'member:shuttles',
])

ROLE_KEYS.forEach((role) => {
  const routes = allowedRoutes(role) || ROUTE_KEYS
  routes.forEach((route) => {
    const flag = ROUTE_WRITE_FLAG[route]
    if (!flag || can(role, flag)) return
    assert.ok(
      READ_ONLY_OK.has(role + ':' + route),
      'vai `' + role + '` vào được `' + route + '` mà không có cờ `' + flag + '`. ' +
      'Màn đó phải CHẶN GHI (gác bằng can(role, \'' + flag + '\')) rồi mới thêm vào READ_ONLY_OK — ' +
      'không thì RLS từ chối và kẹt cả hàng đợi đồng bộ.'
    )
  })
})

/* ---------- "xem như": chỉ vai của mình hoặc YẾU HƠN ---------- */
// Cho tự nâng quyền thì UI mở ra nhưng RLS vẫn chặn — người dùng chỉ nhận lỗi không hiểu.

assert.deepEqual(viewAsOptions('owner'), ROLE_KEYS, 'owner xem được như mọi vai')
assert.deepEqual(viewAsOptions('treasurer'), ['treasurer', 'member'])
assert.deepEqual(viewAsOptions('member'), ['member'], 'vai yếu nhất chỉ có chính nó')
assert.ok(!viewAsOptions('treasurer').includes('owner'), 'KHÔNG được tự nâng lên vai mạnh hơn')
assert.deepEqual(viewAsOptions('vai lạ'), ROLE_KEYS, 'vai không nhận ra thì trả cả danh sách, không crash')

/* ---------- nhãn ---------- */

assert.equal(ROLES.length, ROLE_KEYS.length)
ROLE_KEYS.forEach((r) => {
  assert.ok(roleName(r) && !roleName(r).includes('roles.'), 'thiếu nhãn i18n cho vai ' + r)
  assert.ok(roleDesc(r) && !roleDesc(r).includes('roles.'), 'thiếu mô tả i18n cho vai ' + r)
})

console.log('lib/roles check: OK')
