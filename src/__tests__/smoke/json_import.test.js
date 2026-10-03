// 🚨 Component (.jsx) và hook KHÔNG import thẳng file .json — đi qua cửa `#config/<tên>.js`.
//
// Vì sao: Node (`npm test`) bắt buộc `with { type: 'json' }` khi import JSON, mà luật React Compiler
// của eslint-plugin-react-hooks gặp cú pháp đó là IM LẶNG bỏ qua cả file. Đo 2026-10-03: 5 file giấu
// 15 lỗi hook (setState trong effect, đọc ref lúc render…) mà `npm run lint` vẫn sạch. Import không
// kèm thuộc tính thì Node lại vỡ khi test nạp tới component đó — nên cấm cả hai dạng, chỉ một đường.
// Cửa vào: src/config/app.js · badges.js · banks.js (thiếu JSON nào thì thêm một cửa cùng mẫu).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')
const JSON_IMPORT = /\bfrom\s+['"][^'"]+\.json['"]/

/** File thuộc diện gác: component .jsx và mọi file trong src/hooks. */
const isGuarded = (rel) => rel.endsWith('.jsx') || (rel.startsWith('hooks/') && rel.endsWith('.js'))

function listFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== '__tests__') listFiles(p, out)
    } else out.push(p)
  }
  return out
}

/** Các dòng import JSON trực tiếp trong một đoạn mã: [{ line, text }]. */
function jsonImportsIn(code) {
  return code.split(/\r?\n/)
    .map((text, i) => ({ line: i + 1, text: text.trim() }))
    .filter(({ text }) => !text.startsWith('//') && !text.startsWith('*') && JSON_IMPORT.test(text))
}

test('Bộ dò bắt cả hai dạng import JSON và tha cửa vào #config/*.js', () => {
  const code = [
    "import cfg from '#config/app.json' with { type: 'json' }",
    "import badges from '#config/badges.json'",
    "import cfg2 from '#config/app.js'",
    "// import x from '#config/app.json' — comment không tính",
    "const label = 'file.json'",
  ].join('\n')
  assert.deepEqual(
    jsonImportsIn(code).map((h) => h.line),
    [1, 2],
    'Bộ dò sai thì test gác bên dưới vô nghĩa — phải bắt dạng có `with` lẫn dạng trần, tha import .js và comment'
  )
})

test('Component và hook không import thẳng .json — lint mới đọc được lỗi hook trong đó', () => {
  const offenders = []
  for (const file of listFiles(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/')
    if (!isGuarded(rel)) continue
    for (const h of jsonImportsIn(fs.readFileSync(file, 'utf8'))) {
      offenders.push(`${rel}:${h.line}  ${h.text}`)
    }
  }
  assert.equal(
    offenders.length, 0,
    'Import JSON trong component/hook: có `with { type: \'json\' }` thì luật React Compiler bỏ qua cả ' +
    'file (lỗi hook bị giấu), không có thì `npm test` vỡ khi nạp tới. Đổi sang `#config/<tên>.js`:\n' +
    offenders.join('\n')
  )
})

test('Cửa vào #config/*.js tồn tại và tự mang thuộc tính JSON', () => {
  for (const name of ['app', 'badges', 'banks']) {
    const code = fs.readFileSync(path.join(SRC, 'config', `${name}.js`), 'utf8')
    assert.ok(
      code.includes(`from './${name}.json' with { type: 'json' }`),
      `src/config/${name}.js phải import ./${name}.json kèm thuộc tính — thiếu thì Node không nạp được JSON`
    )
  }
})
