import { t } from '#i18n'

// Thẻ BXH mobile luôn nền tối (hex cứng) nên màu chữ cũng là hex sáng — chép từ status-*-fg của dark.css.
export const STAT_COLORS = { win: '#5FD9A2', loss: '#FF9A8F', match: '#9FC0EA', session: '#C4B5FD', muted: '#8494AA' }

/** Pill độ chênh Elo của một trận trong sổ mùa: Kèo trên (lệch nhiều/ít) · Kèo cân · Kèo dưới (ít/nhiều). */
export function getTierPill(gap, gapText, isDark) {
  const g = typeof gap === 'number' ? gap : 0
  if (g >= 150) {
    return {
      text: t('season.tierPillHeavyFavored', { gap: gapText }),
      color: isDark ? '#5FDBD3' : '#0F766E',
      bg: isDark ? 'rgba(0, 178, 169, 0.20)' : 'rgba(13, 148, 136, 0.14)',
      border: isDark ? '1px solid rgba(0, 178, 169, 0.40)' : '1px solid rgba(13, 148, 136, 0.28)',
    }
  }
  if (g >= 50) {
    return {
      text: t('season.tierPillFavored', { gap: gapText }),
      color: isDark ? '#5FDBD3' : '#0F766E',
      bg: isDark ? 'rgba(0, 178, 169, 0.16)' : 'rgba(13, 148, 136, 0.12)',
      border: isDark ? '1px solid rgba(0, 178, 169, 0.32)' : '1px solid rgba(13, 148, 136, 0.22)',
    }
  }
  if (g > -50) {
    return {
      text: t('season.tierPillBalanced', { gap: gapText }),
      color: isDark ? '#94A3B8' : '#475569',
      bg: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.12)',
      border: isDark ? '1px solid rgba(148, 163, 184, 0.30)' : '1px solid rgba(148, 163, 184, 0.22)',
    }
  }
  if (g > -150) {
    return {
      text: t('season.tierPillUnderdog', { gap: gapText }),
      color: isDark ? '#FB923C' : '#EA580C',
      bg: isDark ? 'rgba(249, 115, 22, 0.18)' : 'rgba(249, 115, 22, 0.12)',
      border: isDark ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid rgba(249, 115, 22, 0.25)',
    }
  }
  return {
    text: t('season.tierPillDeepUnderdog', { gap: gapText }),
    color: isDark ? '#FF9A8F' : '#DC2626',
    bg: isDark ? 'rgba(225, 68, 52, 0.20)' : 'rgba(220, 38, 38, 0.14)',
    border: isDark ? '1px solid rgba(225, 68, 52, 0.40)' : '1px solid rgba(220, 38, 38, 0.30)',
  }
}