/**
 * Bản sáng của màn Danh hiệu (trang bộ sưu tập desktop + mobile, thẻ huy hiệu, kệ, poster truy nã, BXH
 * sưu tập). Bản tối là thiết kế arcade gốc — giữ Y HỆT: hook trả hàm đồng nhất. Bản sáng đổi màu NỀN /
 * CHỮ / VIỀN trung tính sang token sáng của app (thẻ kính trắng trên trời hoàng hôn) và hạ tông các màu
 * nhấn khi làm màu chữ cho đọc được trên nền sáng. Icon huy hiệu (BadgeHex) và popup chi tiết / mở khoá
 * giữ nguyên kiểu tối "sân khấu", không dùng file này.
 *
 * Dùng: `const ts = useBadgeTone()` rồi `style={ts({ ... })}` — ts đổi từng giá trị chuỗi trong object:
 * `color` / `fill` / `stroke` theo bảng CHỮ, thuộc tính khác (nền, viền, bóng) theo bảng NỀN. Phần tử có
 * nền màu nhấn (nút, tag gradient) giữ nguyên màu chữ — chữ trắng / tối trên nút đã đúng sẵn.
 */
import { useTheme } from '#contexts/ThemeContext.jsx'
import { createTone } from '#utils/tone.js'

// Khung trang cao bằng cả trang: KHÔNG dùng var(--surface-card) — luật kính (effects.css) sẽ gắn
// backdrop-filter, phần tử cao vậy vượt giới hạn texture GPU (mất nội dung / nhấp nháy). Trắng mờ viết thẳng.
const SURF_CARD = 'rgba(255,255,255,.8)'
const SURF_INSET = 'var(--surface-inset)'
const BD_SUBTLE = 'var(--border-subtle)'
const BD_DEFAULT = 'var(--border-default)'

/** Nền / viền / bóng (mọi thuộc tính trừ màu chữ). Khoá viết hoa. */
const SURF = {
  // Nền trang và khối lớn
  '#07030F': SURF_CARD, '#09060F': SURF_CARD,
  // Ô / thẻ con tối
  '#050A1A': SURF_INSET, '#080615': SURF_INSET, '#0A0514': SURF_INSET, '#0B0820': SURF_INSET, '#0D0820': SURF_INSET,
  '#0D061A': SURF_INSET, '#120823': SURF_INSET, '#120A24': SURF_INSET, '#150A26': SURF_INSET, '#15082A': SURF_INSET,
  '#160B26': SURF_INSET, '#190C2D': SURF_INSET, '#1A0C3A': SURF_INSET, '#1A1430': SURF_INSET, '#1D0D35': SURF_INSET,
  '#241640': SURF_INSET, '#1A0310': SURF_INSET,
  // Viền tím tối
  '#2A1145': BD_SUBTLE, '#2A1F4A': BD_SUBTLE, '#221A3A': BD_SUBTLE, '#2E2447': BD_SUBTLE,
  '#3B1B66': BD_DEFAULT, '#3A2C5C': BD_DEFAULT, '#3B2560': BD_DEFAULT, '#4C2673': BD_DEFAULT, '#4A3B66': BD_DEFAULT,
  '#4E3F6B': BD_DEFAULT, '#5A4E78': BD_DEFAULT,
  // Nền thẻ theo bậc (lib/badges.js → TIER.panel): tông nhạt cùng màu bậc
  '#2B0617': '#FFE4EE', '#110208': '#FFF7FA', // huyền thoại
  '#1E0740': '#F1E6FF', '#0E0220': '#FAF6FF', // sử thi
  '#07203F': '#E3F1FF', '#020C1B': '#F6FAFF', // tinh anh
  '#042925': '#DDF7F2', '#010F0D': '#F5FCFA', // hiếm
  '#2A1D02': '#FFF3CC', '#120C00': '#FFFBEE', // tự phong
  '#150C24': '#EEEAF4', '#0A0512': '#F8F7FA', // ẩn
}

/** Màu chữ (color / fill / stroke). */
const TEXT = {
  '#FFFFFF': 'var(--text-primary)', '#E9EFF7': 'var(--text-primary)', '#FBF0FF': 'var(--text-primary)',
  '#C9BFDC': 'var(--text-secondary)', '#C9B8E6': 'var(--text-secondary)', '#C8A8F0': 'var(--text-secondary)', '#A899C5': 'var(--text-secondary)',
  '#9C8ABE': 'var(--text-muted)', '#8E83A8': 'var(--text-muted)', '#7E6FA0': 'var(--text-muted)', '#9A90AD': 'var(--text-muted)',
  '#8E7DAE': 'var(--text-muted)', '#6B5C8C': 'var(--text-muted)', '#6B6188': 'var(--text-muted)', '#5A4E78': 'var(--text-muted)',
  // Màu nhấn làm chữ: hạ tông cho đọc được trên nền sáng
  '#FFE24B': '#A16207', '#F6C945': '#A16207', '#FFD95E': '#A16207',
  '#F6A03C': '#C2410C', '#FF9A3D': '#C2410C', '#FFB38A': '#C2410C', '#FFB03A': '#C2410C', '#FFC46B': '#B45309',
  '#2EE9FF': '#0369A1', '#3FC8FF': '#0369A1', '#7CC0FF': '#0369A1', '#7FE7FF': '#0369A1',
  '#5FDBD3': '#0F766E', '#5FEBD0': '#0F766E',
  '#D9A8FF': '#7E22CE', '#C04BFF': '#7E22CE', '#C878FF': '#7E22CE', '#8E4CF5': '#7E22CE', '#7A4DFF': '#6D28D9',
  '#8B2BFF': '#6D28D9', '#6D14FF': '#6D28D9',
  '#FF2E7E': '#BE185D', '#FF3D77': '#BE185D', '#FF6A95': '#BE185D', '#FF7A9E': '#BE185D',
}

/** Nền có màu nhấn (nút / tag gradient): giữ nguyên màu chữ trên nó. */
const ACCENT_BG = /#(FF2E7E|FF3D77|FF7A18|FF9A3D|FFE24B|F6C945|6D14FF|8B2BFF|C04BFF|2EE9FF|0B63FF|00776B|2EE9C0|B77400|F6A03C|FF6BE0|FFB03A|5FDBD3|3FC8FF|7A4DFF|8E4CF5)\b/i

/** Đổi một style object sang bản sáng. Lớp phủ tối của màn (6,4,16 · 23,10,39 · 7,3,15) → lớp phủ trắng. */
export const toneStyle = createTone({ surf: SURF, text: TEXT, accentBg: ACCENT_BG, darkVeils: ['6,4,16', '23,10,39', '7,3,15'] })

const same = (st) => st

/** Hàm tô màu theo chế độ đang dùng: tối → giữ nguyên, sáng → toneStyle. */
export function useBadgeTone() {
  const { isDark } = useTheme()
  return isDark ? same : toneStyle
}
