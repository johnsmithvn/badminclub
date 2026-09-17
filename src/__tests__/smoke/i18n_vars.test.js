// Gác CHIỀU THỨ BA của i18n: key có biến `{{...}}` thì chỗ gọi phải truyền biến.
//
// `smoke/i18n.test.js` đã gác hai chiều — key đang dùng phải tồn tại trong `vi.json`, và không
// dòng code nào còn chữ tiếng Việt cứng. Nhưng nó KHÔNG thấy được lỗi này: key tồn tại, chữ
// nằm đúng chỗ, test xanh, mà nút trên màn hình hiện nguyên văn `{{court}}`.
//
// Đây là lỗi thật đã lên tới giao diện: `SessionMatchesTab` gọi `t('scoreModal.title')` cho một
// kèo chưa lên sân, mà key đó là "Nhập kết quả · sân {{court}}". Quét ra thêm bốn chỗ nữa cùng
// kiểu ở màn Danh hiệu và hai modal Kèo.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const vi = JSON.parse(fs.readFileSync('src/i18n/vi.json', 'utf8'))

/** vi.json lồng nhau → bảng phẳng 'a.b.c' → chuỗi */
const flat = {}
;(function walk(obj, prefix) {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') flat[key] = v
    else if (v && typeof v === 'object') walk(v, key)
  }
})(vi, '')

const VAR_RE = /\{\{\s*\w+\s*\}\}/
const keysWithVars = new Set(Object.keys(flat).filter((k) => VAR_RE.test(flat[k])))
assert.ok(keysWithVars.size > 0, 'Phải có ít nhất một key mang biến, không thì test này vô nghĩa')

/** Mọi file nguồn, bỏ test và node_modules */
const files = []
;(function rec(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|__tests__/.test(fp)) rec(fp)
    } else if (/\.(jsx|js)$/.test(e.name)) {
      files.push(fp)
    }
  }
})('src')

// `t('key')` → không tham số. `t('key', {...})` → có tham số. Chỉ bắt dạng chuỗi hằng; `t(key)`
// với biến động thì không kiểm được ở đây và cũng hiếm.
const CALL_RE = /\bt\(\s*'([^']+)'\s*(\)|,)/g

const offenders = []
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  let m
  while ((m = CALL_RE.exec(src)) !== null) {
    const key = m[1]
    const hasArgs = m[2] === ','
    if (keysWithVars.has(key) && !hasArgs) {
      const line = src.slice(0, m.index).split('\n').length
      offenders.push(`${file}:${line}  t('${key}')  →  "${flat[key]}"`)
    }
  }
}

assert.deepEqual(
  offenders, [],
  'Key có {{biến}} mà gọi không truyền tham số — biến sẽ hiện nguyên văn trên giao diện:\n'
  + offenders.join('\n'),
)

console.log(`i18n vars check: OK (${keysWithVars.size} key mang biến, ${files.length} file nguồn)`)
