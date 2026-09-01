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

assert.deepEqual(ROLE_KEYS, ['owner', 'treasurer', 'host', 'member', 'viewer'],
  'thứ tự vai là thứ tự MẠNH → YẾU, viewAsOptions cắt mảng theo đúng nó')

assert.equal(can('owner', 'money'), true)
assert.equal(can('owner', 'settings'), true)
assert.equal(can('treasurer', 'money'), true)
assert.equal(can('treasurer', 'settings'), false, 'thủ quỹ xem được Cài đặt nhưng không sửa')
assert.equal(can('host', 'sessions'), true)
assert.equal(can('host', 'money'), false)
assert.equal(can('member', 'assign'), false, 'thành viên chỉ XEM sơ đồ sân')
assert.deepEqual(perm.flags.member, [], 'thành viên không có cờ ghi nào')
assert.equal(can('viewer', 'viewAll'), true)
assert.equal(can('viewer', 'sessions'), false)
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
assert.equal(seedRows.length, ROLE_KEYS.length, 'phải đọc được đủ 5 dòng seed role_permissions')

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
Object.keys(perm.routes).forEach((r) => {
  const list = perm.routes[r]
  if (!list) return
  list.forEach((k) => assert.ok(ROUTE_KEYS.includes(k), 'vai ' + r + ' trỏ tới route không tồn tại: ' + k))
})

assert.equal(effRoute('member', 'fund'), 'fund')
assert.equal(effRoute('member', 'settings'), 'home', 'route không được phép thì về Trang chủ, không hiện trang lỗi')
assert.equal(effRoute('owner', 'settings'), 'settings')

/* ---------- BẤT BIẾN: vào được mà không có cờ ghi thì màn hình PHẢI chỉ đọc ---------- */
//
// Đây là lỗi đã xảy ra thật: vai `member` có route `assign` (handoff cho 3 màn mobile) nhưng
// không có cờ `assign`, trong khi RLS của `session_lineups` / `session_court_groups` / `matches` /
// `match_players` đều gác bằng đúng cờ đó (`0002_auth_rls.sql:409`). `Assign.jsx` lại không gác gì
// — member kéo một người là Supabase từ chối, `flush()` ném lỗi, ảnh chụp đồng bộ không cập nhật
// và CẢ hàng đợi kẹt lại, trong khi màn hình vẫn báo đã lưu.
//
// Mỗi cặp dưới đây là một lời hứa: "màn này CHỈ ĐỌC với vai này, và code có chỗ chặn thật".
// Thêm route cho một vai mà quên gác thì test này đỏ, buộc phải quyết định chứ không lọt im lặng.

const ROUTE_WRITE_FLAG = {
  sessions: 'sessions', session: 'sessions', schedules: 'sessions',
  assign: 'assign', members: 'members', settings: 'settings',
  debts: 'money', fund: 'money', shuttles: 'money',
}
/** Cặp `vai:route` đã rà tay và xác nhận màn hình có chặn ghi. */
const READ_ONLY_OK = new Set([
  'treasurer:sessions', 'treasurer:session', 'treasurer:settings',
  'host:members',
  'member:assign', 'member:fund',
  'viewer:sessions', 'viewer:session', 'viewer:fund', 'viewer:debts', 'viewer:shuttles',
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
assert.deepEqual(viewAsOptions('host'), ['host', 'member', 'viewer'])
assert.deepEqual(viewAsOptions('viewer'), ['viewer'], 'vai yếu nhất chỉ có chính nó')
assert.ok(!viewAsOptions('treasurer').includes('owner'), 'KHÔNG được tự nâng lên vai mạnh hơn')
assert.deepEqual(viewAsOptions('vai lạ'), ROLE_KEYS, 'vai không nhận ra thì trả cả danh sách, không crash')

/* ---------- nhãn ---------- */

assert.equal(ROLES.length, ROLE_KEYS.length)
ROLE_KEYS.forEach((r) => {
  assert.ok(roleName(r) && !roleName(r).includes('roles.'), 'thiếu nhãn i18n cho vai ' + r)
  assert.ok(roleDesc(r) && !roleDesc(r).includes('roles.'), 'thiếu mô tả i18n cho vai ' + r)
})

console.log('lib/roles check: OK')
