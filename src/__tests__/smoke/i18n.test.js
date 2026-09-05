// node src/__tests__/i18n.test.js
//
// Luật cứng của dự án: không chữ cứng trong .jsx, mọi chữ đi qua t('key') (docs/RULES.md §3.1).
// Thiếu key thì t() chỉ console.warn ở DEV — nghĩa là chữ "toast.levelsSaved" hiện nguyên si
// trên màn hình mà không ai biết. Test này quét toàn bộ src và bắt lỗi đó lúc build.
//
// Hai phần: (1) quét regex mọi key viết THẲNG trong code · (2) các họ key GHÉP ĐỘNG
// (t('roles.' + r + '.label')) — regex không thấy được nên miền giá trị liệt kê tay ở dưới,
// lấy từ config / hằng số thật để thêm route hay chế độ mới là test tự đòi key.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import vi from '#i18n/vi.json' with { type: 'json' }
import cfg from '#config/app.json' with { type: 'json' }
import perm from '#config/permissions.json' with { type: 'json' }
import { MODE_KEYS } from '#lib/assign.js'
import { WARN_KEYS } from '#lib/money.js'
import { CATS, MANUAL_CATS } from '#lib/ledger.js'
import { BLOCK_KEYS } from '#lib/schedules.js'
import { MERGE_FIELDS } from '#lib/members.js'
import { SCHEMA_GROUPS } from '#data/schema.js'

// Miền giá trị của các họ key ghép động mà file nguồn không export ra được.
// Đổi ở nguồn thì phải đổi ở đây — cố ý, để test đòi key mới.
// Đúng bộ mục sidebar trong Sidebar.jsx (KHÔNG phải toàn bộ route: 'session' không có ở sidebar).
const NAV = ['home', 'calendar', 'sessions', 'assign', 'leaderboard', 'members',
  'debts', 'fund', 'profile', 'settings']
const SECTIONS = ['ops', 'money', 'account']
const SETUP_STEPS = ['court', 'group', 'member', 'schedule', 'price']
const CHANGE_FIELDS = ['level', 'phone', 'gender', 'name']
// Lý do một trường KHÔNG ghép được ở màn duyệt vào CLB — khớp `members.js: mergeRows().block`.
const MERGE_BLOCKS = ['empty', 'same', 'offScale']
const SETTINGS_TABS = ['general', 'money', 'courts', 'groups', 'schedules', 'access']
// Hai chiều của bảng đối chiếu và hai cách trả — khớp enum adjust_kind / settle_mode ở DB.
const ADJUST_KINDS = ['absent_back', 'extra_session']
const SETTLE_MODES = ['cash', 'offset_next_dues']
// Lý do không xoá cứng được một thành viên — khớp money.js: memberRefs.
const MEMBER_REFS = ['attend', 'dues', 'adjust', 'guest', 'match', 'payer', 'change', 'account']
// Lý do không xoá được một NHÓM — khớp money.js: groupRefs.
const GROUP_REFS = ['session', 'history', 'schedule', 'dues', 'adjust', 'roster']

const SRC = 'src'
const SKIP = new Set(['ds', '__tests__'])

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return SKIP.has(name) ? [] : files(p)
    return /\.jsx?$/.test(name) ? [p] : []
  })
}

const get = (key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), vi)

const missing = []
const found = new Set()
files(SRC).forEach((p) => {
  const src = readFileSync(p, 'utf8')
  // t('a.b.c') hoặc t("a.b.c"). Bắt buộc có `)` hoặc `,` ngay sau nháy đóng để loại
  // những key ghép động kiểu t('roles.' + r + '.label') — chúng không kiểm được ở đây.
  for (const m of src.matchAll(/\bt\(\s*(['"])([A-Za-z0-9_.]+)\1\s*[),]/g)) {
    const key = m[2]
    found.add(key)
    if (typeof get(key) !== 'string') missing.push(p + ' → ' + key)
  }
})

assert.equal(missing.length, 0, 'key i18n không tồn tại:\n  ' + missing.join('\n  '))
assert.ok(found.size > 400, 'quét được quá ít key (' + found.size + ') — regex chắc bị hỏng')

// Giá trị trong vi.json chỉ được là: chuỗi · mảng chuỗi (danh sách như tên các thứ trong tuần)
// · object lồng. Số hay bool lọt vào là hằng số nghiệp vụ đặt sai chỗ — nó thuộc config/app.json.
const walk = (node, path) => {
  Object.keys(node).forEach((k) => {
    const v = node[k]
    const at = path ? path + '.' + k : k
    if (typeof v === 'string') return
    if (Array.isArray(v)) {
      v.forEach((x, i) => assert.equal(typeof x, 'string', 'vi.json.' + at + '[' + i + '] phải là chuỗi'))
      return
    }
    assert.ok(v && typeof v === 'object', 'vi.json.' + at + ' phải là chuỗi, mảng chuỗi hoặc object')
    walk(v, at)
  })
}
walk(vi, '')

/* ---------- CHIỀU NGƯỢC LẠI: chữ cứng còn sót trong code ---------- */
// Phần trên chỉ hỏi "key đang dùng có tồn tại không". Nó KHÔNG bắt được lỗi ngược lại: viết
// thẳng 'Đã xoá thành viên' vào .jsx thì chẳng key nào thiếu, test vẫn xanh, và luật RULES §3.1
// vỡ trong im lặng. Đó đúng là chuyện đã xảy ra — đợt dựng lại màn Công nợ / Cài đặt / Sổ quỹ
// để lại 279 chuỗi cứng mà bộ test cũ không hé một lời, trong khi header file này vẫn khai
// "không chữ cứng trong .jsx".
//
// Cách bắt: chữ tiếng Việt LUÔN có dấu thanh / dấu mũ (tách ra được bằng NFD) hoặc chữ đ.
// Định danh và cú pháp JS thì không bao giờ có. Nên quét dấu trên dòng code thật là đủ, không
// cần parse.
//
// Ba ngoại lệ, đúng theo §3.1:
//   · comment — cắt trước khi quét
//   · `console.*` và `throw new Error(...)` — chữ dành cho developer, không ai dùng thấy
//   · dấu `i18n-ok` cuối dòng — chuỗi tiếng Việt là DỮ LIỆU chứ không phải nhãn: tên cột của
//     file CSV (hợp đồng định dạng, dịch là từ chối file cũ), nội dung file mẫu, regex bỏ dấu.
//     Đặt dấu này phải kèm lý do; nó là cửa duy nhất để lách luật nên đừng rải bừa.
const hasVi = (s) => /[̀-ͯ]/.test(s.normalize('NFD')) || /[đĐ]/.test(s)

const hard = []
files(SRC).forEach((p) => {
  const raw = readFileSync(p, 'utf8').split(/\r?\n/)
  // Comment khối xoá theo ký tự (giữ nguyên số dòng), comment dòng cắt phần đuôi. `[^:]` phía
  // trước `//` để không cắt nhầm 'https://...'.
  const code = readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split(/\r?\n/)
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
  code.forEach((line, i) => {
    if (raw[i].includes('i18n-ok')) return
    if (/console\.|new Error\(/.test(line)) return
    if (hasVi(line)) hard.push(p + ':' + (i + 1) + '  ' + line.trim().slice(0, 90))
  })
})

assert.equal(hard.length, 0,
  'chữ cứng trong code — phải chuyển sang vi.json rồi gọi t(\'key\') (RULES §3.1).\n' +
  'Chuỗi cứng thì đổi ngôn ngữ không tới được, và sửa câu chữ phải đi lục từng file:\n  ' +
  hard.join('\n  '))

/* ---------- key GHÉP ĐỘNG: liệt kê tay vì regex trên không thấy được ---------- */
// Đây là chỗ thiếu key mà không ai phát hiện: t('nav.' + p.key) thiếu một route thì sidebar
// hiện thẳng chuỗi "nav.shuttles". Miền giá trị của từng họ key lấy từ config / hằng số thật,
// nên thêm route hay thêm chế độ xếp mới là test tự đòi key tương ứng.
const cap = (s) => s[0].toUpperCase() + s.slice(1)
const dyn = []
const need = (key) => { if (typeof get(key) !== 'string') dyn.push(key) }

NAV.forEach((k) => need('nav.' + k))
SECTIONS.forEach((s) => need('nav.section.' + s))
MODE_KEYS.forEach((m) => { need('assign.modes.' + m + '.label'); need('assign.modes.' + m + '.desc') })
;[...new Set([...Object.keys(CATS), ...MANUAL_CATS])].forEach((c) => need('ledger.cat.' + c))
cfg.sessionStates.forEach((s) => need('sessionState.' + s))
cfg.genders.forEach((g) => need('gender.' + g))
cfg.rosterStates.forEach((r) => need('rosterState.' + r))
perm.order.forEach((r) => { need('roles.' + r + '.label'); need('roles.' + r + '.desc') })
SETUP_STEPS.forEach((s) => ['title', 'hint', 'btn'].forEach((f) => need('setup.step.' + s + '.' + f)))
CHANGE_FIELDS.forEach((f) => need('members.changeField.' + f))
MERGE_FIELDS.forEach((f) => need('members.changeField.' + f))
MERGE_BLOCKS.forEach((k) => need('settings.mergeBlock.' + k))
SCHEMA_GROUPS.forEach((g) => need('schema.group' + g.groupKey))
SETTINGS_TABS.forEach((k) => need('settings.tab' + cap(k)))
ADJUST_KINDS.forEach((k) => need('debts.kind.' + k))
SETTLE_MODES.forEach((k) => need('debts.settle.' + k))
MEMBER_REFS.forEach((k) => need('members.ref.' + k))
GROUP_REFS.forEach((k) => need('settings.groupRef.' + k))
;['attend', 'guest', 'match', 'closed'].forEach((k) => need('session.ref.' + k))
WARN_KEYS.forEach((k) => ['title', 'body'].forEach((f) => need('home.warn.' + k + '.' + f)))
// Lý do chặn lưu khi sửa lịch + hai cặp nhãn chọn theo điều kiện — đều tới màn hình qua
// `t(bienSo)` nên regex quét key ở trên không thấy.
Object.values(BLOCK_KEYS).forEach(need)
;['groupFree', 'groupLocked', 'del', 'delBlocked'].forEach((k) => need('schedules.' + k))

assert.equal(dyn.length, 0, 'key i18n ghép động không tồn tại:\n  ' + dyn.join('\n  '))


/* ---------- KHÓA TRÙNG trong vi.json ---------- */
// JSON trùng key thì cái SAU đè cái TRƯỚC, im lặng tuyệt đối: không lỗi parse, không cảnh báo,
// `import vi from 'vi.json'` chỉ thấy giá trị cuối. Đã dính thật: thêm `bank.memo` là một
// object mẫu nội dung chuyển khoản, trong khi `bank.memo` đã có sẵn là nhãn "Nội dung" —
// object mới bị nuốt sạch, t('bank.memo.all') trả về chính cái key.
//
// JSON.parse của Node không báo trùng nên phải soát trên văn bản gốc.

const rawJson = readFileSync('src/i18n/vi.json', 'utf8')
const rootSeen = new Set()
const dupPath = []
const stack = []
// Tach dong bang ma ky tu, khong dung regex: chuoi escape hay bi mangle khi truyen file.
rawJson.split(String.fromCharCode(10)).forEach((line) => {
  const key = (line.match(/^\s*"([^"]+)"\s*:/) || [])[1]
  const depth = (line.match(/^\s*/) || [''])[0].length
  while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop()
  if (!key) return
  const parent = stack.length ? stack[stack.length - 1] : null
  const bag = parent ? parent.seen : rootSeen
  const full = (parent ? parent.path + '.' : '') + key
  if (bag.has(key)) dupPath.push(full)
  bag.add(key)
  if (/\{\s*$/.test(line)) stack.push({ depth, path: full, seen: new Set() })
})

assert.equal(dupPath.length, 0,
  'vi.json có key TRÙNG — cái sau đè cái trước mà không báo gì, nhánh trước biến mất: '
  + dupPath.join(', '))

console.log('i18n check: OK · ' + found.size + ' key dùng thẳng + ' +
  'các họ key ghép động (nav · roles · assign.modes · ledger.cat · setup.step …)')
