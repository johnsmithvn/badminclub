import { STAT_COLORS } from '#components/leaderboard/statColors.js'
import { useTheme } from '#contexts/ThemeContext.jsx'

export default function WinRatePill({ winRate = 0, hasMatches = true }) {
  const good = winRate >= 50
  // Chế độ sáng: chữ đậm trên nền nhạt (màu STAT_COLORS là bản sáng dành cho nền tối — đặt lên nền sáng thì chìm)
  const { isDark } = useTheme()
  const fg = !hasMatches ? (isDark ? STAT_COLORS.muted : 'var(--text-muted)') : good ? (isDark ? STAT_COLORS.win : '#047857') : (isDark ? STAT_COLORS.loss : '#B91C1C')
  const bg = !hasMatches ? 'transparent' : good ? (isDark ? 'rgba(18,168,103,.2)' : 'rgba(4,120,87,.12)') : (isDark ? 'rgba(225,68,52,.2)' : 'rgba(185,28,28,.10)')
  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontWeight: isDark ? undefined : 600,
      }}
    >
      {winRate || 0}%
    </span>
  )
}
