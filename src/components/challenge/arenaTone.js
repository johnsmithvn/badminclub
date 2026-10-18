/**
 * Bản sáng của khu "đấu trường" kèo (tab Sàn kèo ở Trận đấu & Kèo: đầu khu, tab con, ô tìm, các thẻ kèo
 * ArenaChallengeCard). Bản tối là thiết kế navy gốc — giữ Y HỆT: hook trả hàm đồng nhất. Bản sáng đổi nền / chữ /
 * viền trung tính sang token sáng của app và hạ tông màu nhấn khi làm màu chữ (cơ chế chung: utils/tone.js).
 *
 * Dùng: `const ts = useArenaTone()` rồi `style={ts({ ... })}`.
 */
import { useTheme } from '#contexts/ThemeContext.jsx'
import { createTone } from '#utils/tone.js'

// Thẻ / khối cao (danh sách kèo): KHÔNG dùng var(--surface-card) — luật kính (effects.css) gắn backdrop-filter,
// phần tử cao vượt giới hạn texture GPU (mất hình). Trắng mờ viết thẳng.
const CARD = 'rgba(255,255,255,.8)'

/** Nền / viền / bóng. */
const SURF = {
  '#080D18': 'transparent',
  '#0D1526': CARD,
  '#0A1120': 'var(--surface-inset)', '#0F1728': 'var(--surface-inset)',
  '#1B2842': 'rgba(20,32,56,.10)',
  '#182236': 'var(--border-subtle)', '#1E2A40': 'var(--border-default)', '#243353': 'var(--border-default)',
}

/** Màu chữ. Chữ tối trên nút màu nhấn (#04201D, #2A0E05, #1A1204) giữ nguyên. */
const TEXT = {
  '#F4F7FB': 'var(--text-primary)', '#E9EFF7': 'var(--text-primary)', '#FFFFFF': 'var(--text-primary)',
  '#A9B6C9': 'var(--text-secondary)',
  '#8494AA': 'var(--text-muted)', '#6F7E95': 'var(--text-muted)', '#5B6A82': 'var(--text-muted)', '#4A5A74': 'var(--text-muted)',
  '#2EC4B6': '#0F766E', '#8FE3DA': '#0F766E', '#00F5D4': '#0F766E', '#1E8F85': '#0F766E',
  '#5FD9A2': '#047857',
  '#F5C451': '#A16207', '#F0B75C': '#A16207',
  '#FF9C9C': '#B91C1C', '#FFB39F': '#C2410C', '#FF7A59': '#C2410C', '#C9533A': '#C2410C',
  '#D8B4FE': '#7E22CE', '#A78BFA': '#7E22CE',
}

const ACCENT_BG = /#(2EC4B6|F5C451|FF7A59|1E8F85|C9533A|00F5D4|EF4444|F0B75C|5FD9A2|A78BFA)\b/i

/** Đổi một style object sang bản sáng (trắng mờ → navy mờ). */
export const arenaToneStyle = createTone({ surf: SURF, text: TEXT, accentBg: ACCENT_BG, ink: '20,32,56', inkSurf: '20,32,56' })

const same = (st) => st

/** Hàm tô màu theo chế độ đang dùng: tối → giữ nguyên, sáng → arenaToneStyle. */
export function useArenaTone() {
  const { isDark } = useTheme()
  return isDark ? same : arenaToneStyle
}
