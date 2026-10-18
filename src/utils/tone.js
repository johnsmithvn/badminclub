/**
 * Bộ đổi màu cho các màn vẽ theo thiết kế tối cố định (Danh hiệu, đấu trường kèo) sang bản sáng. Mỗi màn có bảng
 * màu riêng (badges/badgeTone.js, challenge/arenaTone.js); hàm trả về đổi từng giá trị chuỗi trong một style object:
 * `color` / `fill` / `stroke` theo bảng CHỮ, thuộc tính khác (nền, viền, bóng) theo bảng NỀN. Phần tử có nền màu
 * nhấn (nút, tag) giữ nguyên màu chữ. Lớp mờ trắng trên nền tối → lớp mờ màu `ink` trên nền sáng; lớp phủ tối trong
 * `darkVeils` → lớp phủ trắng. Khoá bảng viết hoa (#RRGGBB).
 *
 * @param {{ surf: object, text: object, accentBg: RegExp, darkVeils?: string[], ink?: string, inkSurf?: string }} p
 *   ink / inkSurf = "r,g,b" thay cho trắng mờ ở chữ / ở nền.
 */
const COLOR_RE = /#[0-9A-Fa-f]{6}\b|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/g
const TEXT_KEYS = new Set(['color', 'fill', 'stroke', 'caretColor'])

export function createTone({ surf, text, accentBg, darkVeils = [], ink = '30,20,60', inkSurf = '60,40,110' }) {
  const veil = new Set(darkVeils)
  const swap = (v, isText) => v.replace(COLOR_RE, (m) => {
    if (m[0] === '#') return (isText ? text : surf)[m.toUpperCase()] ?? m
    const [r, g, b, a] = m.slice(5, -1).split(',').map((x) => x.trim())
    const rgb = `${r},${g},${b}`
    // Vệt / lớp mờ trắng trên nền tối → vệt màu ink trên nền sáng (đậm hơn chút cho thấy được)
    if (rgb === '255,255,255') return isText ? `rgba(${ink},${Math.min(0.75, +a + 0.15)})` : `rgba(${inkSurf},${Math.min(0.5, +a * 1.5).toFixed(3)})`
    if (veil.has(rgb)) return `rgba(255,255,255,${a})`
    if (rgb === '0,0,0') return `rgba(${ink},${Math.min(0.18, +a).toFixed(2)})`
    return m
  })
  return (st) => {
    if (!st || typeof st !== 'object') return st
    const keepText = accentBg.test(String(st.background ?? '') + String(st.backgroundImage ?? ''))
    const out = {}
    for (const k in st) {
      const v = st[k]
      out[k] = typeof v !== 'string' ? v : TEXT_KEYS.has(k) ? (keepText ? v : swap(v, true)) : swap(v, false)
    }
    return out
  }
}
