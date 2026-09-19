import { t } from '#i18n'

export default function SeasonRaceCard({ raceData, data }) {
  const activeData = raceData || data
  if (!activeData || activeData.empty) {
    return (
      <div style={S.card}>
        <div style={S.headerRow}>
          <span style={S.title}>{t('home.personal.seasonRaceTitle', { weeks: activeData?.weeks || 6 })}</span>
        </div>
        <div style={S.emptyState}>
          {t('home.personal.emptyMatches')}
        </div>
      </div>
    )
  }

  const {
    weeks = 6,
    startElo = 0,
    currentElo = 0,
    deltaElo = 0,
    rivalName = '',
    rivalRank = 6,
    svgPointsMy = '',
    svgPointsRival = '',
    hasRivalTrajectory = false,
    latestMyX = 640,
    latestMyY = 22,
    initialGap = 0,
    currentGap = 0,
  } = activeData

  const sign = deltaElo >= 0 ? '+' : ''

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.title}>{t('home.personal.seasonRaceTitle', { weeks })}</span>
        <span style={S.rangeMono}>{startElo} → {currentElo}</span>
        <span style={S.deltaGreen}>{sign}{deltaElo}</span>
      </div>

      <div style={S.chartContainer}>
        <svg viewBox="0 0 660 96" preserveAspectRatio="none" style={S.svg}>
          <line x1="0" y1="24" x2="660" y2="24" stroke="var(--border-subtle)" strokeWidth="1" />
          <line x1="0" y1="60" x2="660" y2="60" stroke="var(--border-subtle)" strokeWidth="1" />
          {hasRivalTrajectory && svgPointsRival && (
            <polyline
              points={svgPointsRival}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}
          {svgPointsMy && (
            <polyline
              points={svgPointsMy}
              fill="none"
              stroke="var(--action-accent-bg)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {latestMyX > 0 && (
            <circle cx={latestMyX} cy={latestMyY} r="4.5" fill="var(--status-delivered-fg)" />
          )}
        </svg>
      </div>

      <div style={S.legendRow}>
        <div style={S.myLegend}>
          <span style={S.myBar} />
          <span>{t('home.personal.myEloLegend')}</span>
        </div>
        {hasRivalTrajectory && svgPointsRival && rivalName && (
          <div style={S.rivalLegend}>
            <span style={S.rivalBar} />
            <span>{t('home.personal.rivalEloLegend', { name: rivalName, rank: rivalRank })}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  rangeMono: {
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  deltaGreen: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  gapShrinkBadge: {
    font: '600 11px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  chartContainer: {
    width: '100%',
    overflowX: 'auto',
  },
  svg: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },
  legendRow: {
    display: 'flex',
    gap: 16,
  },
  myLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-secondary)',
  },
  myBar: {
    width: 14,
    height: 2.5,
    borderRadius: 999,
    background: 'var(--action-accent-bg)',
  },
  rivalLegend: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  rivalBar: {
    width: 14,
    height: 2,
    borderRadius: 999,
    background: 'var(--text-muted)',
  },
  trendNote: {
    font: '400 11.5px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  emptyState: {
    padding: '24px 0',
    textAlign: 'center',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
  },
}
