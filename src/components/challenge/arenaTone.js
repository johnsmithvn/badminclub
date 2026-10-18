/**
 * Bản sáng cho các khối thiết kế navy tối: khu "đấu trường" kèo + khung Bục mùa / Top 3 Elo ở BXH (SeasonRaceTab,
 * CareerEloTab). Khu "đấu trường" kèo (tab Sàn kèo ở Trận đấu & Kèo: đầu khu, tab con, ô tìm, các thẻ kèo
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
  // Bục BXH: nền khung dải navy → trắng mờ; viền navy / vòng tối quanh huy chương → sáng; viền bạc / vàng / đồng nhạt
  // hơn. Nền huy chương và vòng hào quang (bạc / vàng / đồng) giữ nguyên.
  '#18212F': 'rgba(255,255,255,.86)', '#101827': 'rgba(255,255,255,.8)', '#0D1422': 'rgba(255,255,255,.74)', '#16202E': 'rgba(255,255,255,.8)',
  '#2E3E5C': 'var(--border-default)',
  '#141D2B': '#FFFFFF', '#161104': '#FFFFFF', '#170E07': '#FFFFFF', '#171206': '#FFFFFF', '#1A1008': '#FFFFFF',
  '#6F7F96': '#B8C4D6', '#8A6F16': '#D4A836', '#8A4E24': '#C8804A', '#A66A38': '#C8804A',
  // Danh sách BXH mobile: nền dòng navy → trắng mờ, viền navy → viền sáng
  '#141D2E': 'rgba(255,255,255,.82)', '#101927': 'rgba(255,255,255,.76)', '#22304A': 'var(--border-subtle)',
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
  // Bục BXH: số / chữ bạc → xám đá, vàng → vàng đậm, đồng → nâu đồng
  '#DCE6F5': '#475569', '#EDF3FB': '#475569', '#B6CDEC': '#475569', '#C7D2E4': '#475569',
  '#A8B7CB': 'var(--text-muted)', '#8FA3BE': 'var(--text-muted)',
  '#C6B683': '#8A6F16', '#F0D26A': '#A16207', '#F7E3A1': '#A16207', '#FFF3C4': '#A16207',
  '#F0C096': '#9A5B2E', '#F5C09A': '#9A5B2E', '#E8C8AE': '#9A5B2E', '#F5E0D0': '#9A5B2E',
  // Danh sách BXH mobile + màu chỉ số (statColors.js: thắng / thua / trận / buổi) → bản đậm đọc được trên nền sáng
  '#BAC7D5': '#475569', '#D2DCE6': '#475569', '#7F93B8': 'var(--text-muted)', '#8C99A8': 'var(--text-muted)',
  '#D98844': '#9A5B2E', '#E8A76B': '#9A5B2E', '#FFE24B': '#A16207', '#E5B842': '#A16207', '#E5A824': '#A16207',
  '#5FDBD3': '#0F766E', '#38BDF8': '#0369A1', '#F1A79D': '#B91C1C', '#FF9A8F': '#B91C1C',
  '#9FC0EA': '#1D4ED8', '#C4B5FD': '#6D28D9', '#FFB36B': '#9A4A00',
}

// + nền huy chương bạc / vàng / đồng của bục BXH (chữ tối trên huy chương giữ nguyên)
const ACCENT_BG = /#(2EC4B6|F5C451|FF7A59|1E8F85|C9533A|00F5D4|EF4444|F0B75C|5FD9A2|A78BFA|EDF3FB|8FA3BE|C9A227|D4A836|F7E3A1|C77C48|B0562A|7A5620|C8804A)\b/i

/** Đổi một style object sang bản sáng (trắng mờ → navy mờ). */
export const arenaToneStyle = createTone({ surf: SURF, text: TEXT, accentBg: ACCENT_BG, darkVeils: ['20,29,46', '20,27,45'], ink: '20,32,56', inkSurf: '20,32,56' })

const same = (st) => st

/** Hàm tô màu theo chế độ đang dùng: tối → giữ nguyên, sáng → arenaToneStyle. */
export function useArenaTone() {
  const { isDark } = useTheme()
  return isDark ? same : arenaToneStyle
}
