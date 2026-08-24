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
import { CLOSE_WARN_KEYS, DRIFT_KEYS, WARN_KEYS } from '#lib/money.js'
import { CATS, MANUAL_CATS } from '#lib/ledger.js'
import { SCHEMA_GROUPS } from '#data/schema.js'

// Miền giá trị của các họ key ghép động mà file nguồn không export ra được.
// Đổi ở nguồn thì phải đổi ở đây — cố ý, để test đòi key mới.
// Đúng bộ mục sidebar trong Sidebar.jsx (KHÔNG phải toàn bộ route: 'session' không có ở sidebar).
const NAV = ['home', 'calendar', 'sessions', 'assign', 'schedules', 'members',
  'debts', 'fund', 'shuttles', 'profile', 'settings', 'schema']
const SECTIONS = ['ops', 'money', 'account']
const SETUP_STEPS = ['court', 'group', 'member', 'schedule', 'price']
const CHANGE_FIELDS = ['level', 'phone', 'gender', 'name']
const SETTINGS_TABS = ['general', 'money', 'courts', 'shuttles', 'groups', 'access']
// Trạng thái con số giá thành (money.js: costState) và lý do nhắc kiểm kho (money.js: checkDue).
const COST_STATES = ['live', 'temp', 'final']
// Hai chiều của bảng đối chiếu và hai cách trả — khớp enum adjust_kind / settle_mode ở DB.
const ADJUST_KINDS = ['absent_back', 'extra_session']
const SETTLE_MODES = ['cash', 'offset_next_dues']
// Lý do không xoá cứng được một thành viên — khớp money.js: memberRefs.
const MEMBER_REFS = ['attend', 'dues', 'adjust', 'guest', 'match', 'payer', 'change', 'account']
const CHECK_DUE = ['never', 'stale', 'low']

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
cfg.shuttleModes.forEach((m) => need('session.shuttleMode' + cap(m)))
perm.order.forEach((r) => { need('roles.' + r + '.label'); need('roles.' + r + '.desc') })
SETUP_STEPS.forEach((s) => ['title', 'hint', 'btn'].forEach((f) => need('setup.step.' + s + '.' + f)))
CHANGE_FIELDS.forEach((f) => need('members.changeField.' + f))
SCHEMA_GROUPS.forEach((g) => need('schema.group' + g.groupKey))
SETTINGS_TABS.forEach((k) => need('settings.tab' + cap(k)))
COST_STATES.forEach((k) => need('session.costState.' + k))
CHECK_DUE.forEach((k) => need('shuttles.due.' + k))
ADJUST_KINDS.forEach((k) => need('debts.kind.' + k))
SETTLE_MODES.forEach((k) => need('debts.settle.' + k))
MEMBER_REFS.forEach((k) => need('members.ref.' + k))
WARN_KEYS.forEach((k) => ['title', 'body'].forEach((f) => need('home.warn.' + k + '.' + f)))
CLOSE_WARN_KEYS.forEach((k) => need('session.closeWarn.' + k))
DRIFT_KEYS.forEach((k) => need('session.drift.' + k))

assert.equal(dyn.length, 0, 'key i18n ghép động không tồn tại:\n  ' + dyn.join('\n  '))

console.log('i18n check: OK · ' + found.size + ' key dùng thẳng + ' +
  'các họ key ghép động (nav · roles · assign.modes · ledger.cat · setup.step …)')
