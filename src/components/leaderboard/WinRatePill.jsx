import { STAT_COLORS } from '#components/leaderboard/statColors.js'

export default function WinRatePill({ winRate = 0, hasMatches = true }) {
  const good = winRate >= 50
  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 999,
        background: hasMatches ? (good ? 'rgba(18,168,103,.2)' : 'rgba(225,68,52,.2)') : 'transparent',
        color: hasMatches ? (good ? STAT_COLORS.win : STAT_COLORS.loss) : STAT_COLORS.muted,
      }}
    >
      {winRate || 0}%
    </span>
  )
}
