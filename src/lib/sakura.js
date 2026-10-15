// Dàn chữ lời chúc 20/10 (SakuraEvent.jsx): câu đầu làm câu dẫn, câu cuối vào khung nổi bật,
// giữa là thân bài. `**cụm**` được tô nền, tên người nhận được in đậm.

// Hết câu = dấu câu, hoặc mặt cười kiểu ":)))" — văn của CLB hay kết câu bằng nó. Phải có khoảng
// trắng/hết chuỗi theo sau, nên "20/10" hay "1.342" không bị cắt.
// KHÔNG dùng lookbehind `(?<=…)`: Safari < 16.4 (iPhone 7 / iOS 15 vẫn dùng app) gặp nó là lỗi cú
// pháp lúc nạp bundle, sập cả app chứ không riêng thiệp.
const SENTENCE = /.+?(?:[.!?…]+|:\)+|$)(?=\s|$)/g

/** Một đoạn chữ → [{ t, kind }] với kind 'plain' | 'hl' (bọc trong **) | 'name'. */
export function greetingSegs(str, name) {
  const out = []
  String(str || '').split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    if (!part) return
    if (i % 2) return out.push({ t: part, kind: 'hl' })
    ;(name ? part.split(name) : [part]).forEach((q, j) => {
      if (j) out.push({ t: name, kind: 'name' })
      if (q) out.push({ t: q, kind: 'plain' })
    })
  })
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
