// node --test — Dùng design system có đúng không: tên icon có thật, prop của Dialog đúng tên,
// và danh sách hằng ở client khớp với CHECK ở DB.
//
// VÌ SAO CÓ FILE NÀY. Cả ba lớp lỗi dưới đây đều đã xảy ra thật và ĐỀU IM LẶNG — không lỗi
// runtime, không cảnh báo build, lint xanh, test xanh. Chỉ người dùng nhìn màn hình mới thấy.
// Bản đồ đầy đủ: src/__tests__/README.md

import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ICONS } from '#components/ds/icons.js'

const SRC = 'src'
const SKIP = new Set(['__tests__'])

function files(dir, out = []) {
  readdirSync(dir).forEach((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (!SKIP.has(name)) files(p, out)
    } else if (/\.jsx?$/.test(name)) {
      out.push(p)
    }
  })
  return out
}

const ALL = files(SRC)
const APP = ALL.filter((p) => !p.replace(/\\/g, '/').includes('/components/ds/'))

/* ================== 1. Mọi icon được gọi phải có trong bảng ICONS ================== */
// Thiếu icon thì `Icon` render một <span> RỖNG và chỉ console.warn ở DEV. Nút vẫn bấm được,
// chỉ là không có hình — nên nó sống sót hàng tháng. Đã dính: `qr-code` và `maximize-2` ở màn
// Thành viên / Công nợ, `copy` ở popup QR, và 14 cái khác tìm ra khi quét cả repo.

const ATTR = /\b(?:icon|iconAfter|leadingIcon|trailingIcon)\s*=\s*(?:"([^"]+)"|\{([^}]*)\})/g
const NAME = /<Icon\b[^>]*?\bname\s*=\s*(?:"([^"]+)"|\{([^}]*)\})/gs
const PROP = /\bicon\s*:\s*(?:'([a-z0-9-]+)'|([^,\n]{0,80}))/g

const used = new Map()
APP.forEach((p) => {
  const src = readFileSync(p, 'utf8')
  ;[ATTR, NAME, PROP].forEach((rx) => {
    rx.lastIndex = 0
    for (const m of src.matchAll(rx)) {
      const lit = m[1]
      // Trong biểu thức `icon={...}`, chuỗi nằm sau `===` / `!==` là giá trị ĐEM SO SÁNH
      // (ví dụ `tone === 'danger'`), không phải tên icon. Cắt đi trước khi bóc.
      const expr = (m[2] || '').replace(/[=!]==\s*'[^']*'/g, '')
      const names = lit ? [lit] : [...expr.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((x) => x[1])
      names.forEach((n) => {
        if (!used.has(n)) used.set(n, new Set())
        used.get(n).add(p)
      })
    }
  })
})

assert.ok(used.size > 40, 'quét được quá ít icon (' + used.size + ') — regex chắc bị hỏng')

const missingIcons = [...used.keys()]
  .filter((n) => !ICONS[n])
  .map((n) => n + '  ← ' + [...used.get(n)].join(', '))

assert.equal(missingIcons.length, 0,
  'icon được gọi nhưng KHÔNG có trong src/components/ds/icons.js.\n' +
  'Ô icon sẽ rỗng trên màn hình, chỉ console.warn ở DEV nên không ai phát hiện.\n' +
  'Thêm 1 dòng import + 1 dòng trong ICONS (hướng dẫn ngay đầu icons.js):\n  ' +
  missingIcons.join('\n  '))

/* ================== 2. Mọi tên trong bảng ICONS phải resolve được ================== */
// Gõ sai tên export của lucide-react thì bảng có key nhưng giá trị là `undefined` — vẫn ô rỗng.
const deadIcons = Object.keys(ICONS).filter((k) => ICONS[k] == null)
assert.equal(deadIcons.length, 0,
  'ICONS trỏ tới export không tồn tại của lucide-react: ' + deadIcons.join(', '))

/* ================== 3. Dialog nhận `footer`, KHÔNG phải `actions` ================== */
// `Card` có prop `actions`, `Dialog` thì KHÔNG — nó tên `footer`. Truyền nhầm thì prop rơi vào
// `...rest`, spread lên <div> như attribute lạ, React vứt đi: popup hiện ra KHÔNG CÓ NÚT NÀO.
// Không lỗi, không cảnh báo. Đã dính 4 dialog cùng lúc, trong đó có popup xác nhận chuyển tiền.

const badDialogs = []
APP.forEach((p) => {
  const src = readFileSync(p, 'utf8')
  for (const m of src.matchAll(/<Dialog\b/g)) {
    // Cắt tới dấu `>` đóng thẻ MỞ, bỏ qua `>` nằm trong biểu thức `{...}`.
    let i = m.index + m[0].length
    let depth = 0
    let end = src.length
    while (i < src.length) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) { end = i; break }
      i++
    }
    if (/\bactions\s*=/.test(src.slice(m.index, end))) {
      badDialogs.push(p + ':' + (src.slice(0, m.index).split('\n').length))
    }
  }
})

assert.equal(badDialogs.length, 0,
  '<Dialog> nhận prop `actions` — Dialog KHÔNG có prop đó, nó tên `footer`.\n' +
  'Hậu quả: cụm nút của popup không render, im lặng tuyệt đối. Đổi `actions=` thành `footer=`:\n  ' +
  badDialogs.join('\n  '))

/* ================== 4. Hằng ở client phải khớp CHECK ở DB ================== */
// `Settings.jsx` liệt kê tay các kiểu banner; migration 0019 có CHECK cùng danh sách đó. Lệch
// nhau thì user chọn được một giá trị mà DB từ chối bằng 23514 — lỗi chỉ nổ lúc bấm Lưu.

const settingsSrc = readFileSync('src/pages/Settings.jsx', 'utf8')
const sqlSrc = readFileSync('supabase/migrations/0019_debt_banner_style.sql', 'utf8')

const clientList = (settingsSrc.match(/const DEBT_BANNERS = \[([^\]]*)\]/) || [])[1]
assert.ok(clientList, 'không tìm thấy DEBT_BANNERS trong Settings.jsx')
const fromClient = [...clientList.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()

const sqlList = (sqlSrc.match(/debt_banner IN \(([^)]*)\)/) || [])[1]
assert.ok(sqlList, 'không tìm thấy CHECK debt_banner trong migration 0019')
const fromSql = [...sqlList.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()

assert.deepEqual(fromClient, fromSql,
  'DEBT_BANNERS ở Settings.jsx lệch với CHECK clubs_debt_banner_chk ở migration 0019.\n' +
  'Người dùng chọn được giá trị DB từ chối, lỗi 23514 chỉ nổ lúc bấm Lưu.\n' +
  '  client: ' + fromClient.join(', ') + '\n  DB    : ' + fromSql.join(', '))

/* ================== 5. Mọi CSS Design Token (var(--...)) phải tồn tại ================== */
// Gõ sai tên token CSS (ví dụ `var(--accent)` thay vì `var(--text-accent)`) làm thuộc tính CSS
// không hợp lệ, chữ/nền biến mất hoặc kế thừa sai màu cha. Không ném lỗi JS, lint không bắt được.
// Khắc phục bằng cách quét toàn bộ token định nghĩa trong src/styles/tokens/*.css và đối chiếu
// với mọi lệnh gọi `var(--*)` trong code ứng dụng.

const tokenFiles = readdirSync('src/styles/tokens').map((f) => join('src/styles/tokens', f))
const definedTokens = new Set()
tokenFiles.forEach((f) => {
  const content = readFileSync(f, 'utf8')
  for (const m of content.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
    definedTokens.add('--' + m[1])
  }
})

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

const usedTokens = new Map()
APP.forEach((p) => {
  const content = stripComments(readFileSync(p, 'utf8'))
  for (const m of content.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
    const tok = m[1]
    // Bỏ qua các tiền tố nội suy động
    if (tok === '--shadow-' || tok === '--status-') continue
    if (!usedTokens.has(tok)) usedTokens.set(tok, new Set())
    usedTokens.get(tok).add(p)
  }
})

const missingTokens = [...usedTokens.keys()]
  .filter((tok) => !definedTokens.has(tok))
  .map((tok) => tok + '  ← ' + [...usedTokens.get(tok)].join(', '))

assert.equal(missingTokens.length, 0,
  'CSS Token được gọi trong code nhưng KHÔNG tồn tại trong src/styles/tokens/.\n' +
  'Thuộc tính CSS sẽ bị invalid hoặc kế thừa sai màu.\n  ' +
  missingTokens.join('\n  '))

console.log('design system usage check: OK (' + used.size + ' icon, ' + usedTokens.size + ' token, ' + APP.length + ' file)')

