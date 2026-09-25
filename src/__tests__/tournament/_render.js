// Render component thật trong node (không trình duyệt): biên dịch .jsx lúc import bằng rolldown — chính
// trình biên dịch Vite dùng — rồi render tĩnh bằng react-dom/server. Dùng để khoá "cái gì hiện trên màn":
// chữ, nút theo quyền, chip theo giới. Không bấm được (không có DOM); tương tác đi qua hàm thuần.
// Tên file không có `.test` nên `npm test` không chạy nó như một test.

import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'rolldown/experimental'

registerHooks({
  load(url, ctx, next) {
    if (!url.endsWith('.jsx')) return next(url, ctx)
    const file = fileURLToPath(url)
    const out = transformSync(file, readFileSync(file, 'utf8'), { jsx: { runtime: 'automatic' } })
    if (out.errors?.length) throw new Error(file + ': ' + out.errors.map((e) => e.message).join('; '))
    return { format: 'module', source: out.code, shortCircuit: true }
  },
})

const { renderToStaticMarkup } = await import('react-dom/server')
const { createElement } = await import('react')

/** HTML tĩnh của component. */
export const html = (Comp, props) => renderToStaticMarkup(createElement(Comp, props))

/** Chữ người đọc thấy (bỏ thẻ, gộp khoảng trắng) — so chữ không lệ thuộc cấu trúc DOM. */
export const text = (Comp, props) => html(Comp, props).replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** Nạp module .jsx sau khi hook đã gắn. */
export const load = (spec) => import(spec)

/** Hành động giả: hàm nào cũng có, luôn thành công. */
export const fakeActions = () => new Proxy({}, { get: () => () => Promise.resolve(true) })

/** Thẻ mở của <button> chứa đúng nhãn `label` (null nếu không có) — để hỏi nút ĐÓ có `disabled` không. */
export function buttonTag(markup, label) {
  for (const m of markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    if (m[1].replace(/<[^>]+>/g, '').includes(label)) return m[0].slice(0, m[0].indexOf('>') + 1)
  }
  return null
}
export const isDisabled = (tag) => /\sdisabled(=""|\s|>)/.test(tag || '')
