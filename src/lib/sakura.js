// Dàn chữ lời chúc 20/10 (SakuraEvent.jsx): câu đầu làm câu dẫn, câu cuối vào khung nổi bật,
// giữa là thân bài. `**cụm**` được tô nền, `!!cụm!!` gạch sóng như lỗi chính tả (chữ "cài cắm" cho
// người đọc tinh ý nhận ra), tên người nhận được in đậm.

// Hết câu = dấu câu, hoặc mặt cười kiểu ":)))" — văn của CLB hay kết câu bằng nó. Phải có khoảng
// trắng/hết chuỗi theo sau, nên "20/10" hay "1.342" không bị cắt.
// KHÔNG dùng lookbehind `(?<=…)`: Safari < 16.4 (iPhone 7 / iOS 15 vẫn dùng app) gặp nó là lỗi cú
// pháp lúc nạp bundle, sập cả app chứ không riêng thiệp.
// Cụm `!!…!!` đi nguyên khối: hai dấu chấm than của nó KHÔNG phải hết câu.
const SENTENCE = /(?:!!.+?!!|.)+?(?:[.!?…]+|:\)+|$)(?=\s|$)/g

const MARK = /\*\*(.+?)\*\*|!!(.+?)!!/g

/** Một đoạn chữ → [{ t, kind }] với kind 'plain' | 'hl' (bọc **) | 'odd' (bọc !!) | 'name'. */
export function greetingSegs(str, name) {
  const text = String(str || '')
  const out = []
  const plain = (part) => (name ? part.split(name) : [part]).forEach((q, j) => {
    if (j) out.push({ t: name, kind: 'name' })
    if (q) out.push({ t: q, kind: 'plain' })
  })
  let last = 0
  for (const m of text.matchAll(MARK)) {
    if (m.index > last) plain(text.slice(last, m.index))
    out.push(m[1] != null ? { t: m[1], kind: 'hl' } : { t: m[2], kind: 'odd' })
    last = m.index + m[0].length
  }
  if (last < text.length) plain(text.slice(last))
  return out
}

/**
 * Lời chúc → { lead, body, close }. `body` là mảng đoạn; quá 3 câu giữa thì gộp 2 câu một đoạn
 * cho thiệp đỡ vụn. Chỉ một câu thì không có khung cuối (`close` = null).
 */
export function parseGreeting(text, name) {
  const ss = (String(text || '').match(SENTENCE) || []).map((s) => s.trim()).filter(Boolean)
  const mid = ss.length > 2 ? ss.slice(1, -1) : []
  const step = mid.length > 3 ? 2 : 1
  const body = []
  for (let i = 0; i < mid.length; i += step) body.push(greetingSegs(mid.slice(i, i + step).join(' '), name))
  return {
    lead: greetingSegs(ss[0] || '', name),
    body,
    close: ss.length > 1 ? greetingSegs(ss[ss.length - 1], name) : null,
  }
}
