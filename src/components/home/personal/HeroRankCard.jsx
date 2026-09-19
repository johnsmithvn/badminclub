import { t } from '#i18n'

export default function HeroRankCard({ hero, isMobile }) {
  const {
    rank = 1,
    totalMembers = 0,
    elo = 0,
    eloDeltaWeek = 0,
    seasonMatches = 0,
    seasonWins = 0,
    seasonWinRate = 0,
    seasonPoints = 0,
    badgesCount = 0,
    targetRival = null,
    pointsToNextRank = 0,
    progressPct = 100,
    isLeader = false,
  } = hero || {}

  const sign = eloDeltaWeek > 0 ? '↑ ' : eloDeltaWeek < 0 ? '↓ ' : ''
  const absDelta = Math.abs(eloDeltaWeek)

  return (
    <div style={S.card}>
      <span style={S.glow} />
      <div style={isMobile ? S.mobileHeroRow : S.desktopHeroRow}>
        <div style={S.rankCol}>
          {!isMobile && (
            <span style={S.rankOverline}>{t('home.personal.rankHero')}</span>
          )}
          <span style={isMobile ? S.bigRankMobile : S.bigRankDesktop}>#{rank}</span>
          <span style={S.totalLabel}>{t('home.personal.overTotal', { total: totalMembers })}</span>
        </div>

        <div style={isMobile ? S.eloColMobile : S.eloColDesktop}>
          <div style={S.eloRow}>
            <span style={isMobile ? S.eloNumMobile : S.eloNumDesktop}>{elo}</span>
            <span style={S.eloMono}>{isMobile ? t('home.personal.eloNormal') : t('home.personal.eloHighConfidence')}</span>
            {eloDeltaWeek !== 0 && (
              <span style={eloDeltaWeek >= 0 ? S.deltaGreen : S.deltaRed}>
                {sign}{absDelta} {isMobile ? '' : t('home.personal.upWeek', { delta: '' }).trim()}
              </span>
            )}
          </div>

          <div style={S.statsGrid}>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonMatches}</span>
              <span style={S.statDesc}>{t('home.personal.seasonMatches')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statVal}>
                {isMobile ? `${seasonWinRate}%` : `${seasonWins}`}
              </span>
              <span style={S.statDesc}>
                {isMobile ? t('home.personal.winRate') : t('home.personal.winRateWithPct', { pct: seasonWinRate })}
              </span>
            </span>
            <span style={S.statPill}>
              <span style={S.statValGreen}>{seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}</span>
              <span style={S.statDesc}>{t('home.personal.seasonPoints')}</span>
            </span>
            {!isMobile && (
              <span style={S.statPill}>
                <span style={S.statValGold}>{badgesCount}</span>
                <span style={S.statDesc}>{t('home.personal.badgesCount')}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={S.progressBox}>
        <div style={S.progressTextRow}>
          {isLeader ? (
            <span style={S.targetText}>{t('home.personal.rankLeader')}</span>
          ) : (
            <span style={S.targetText}>
              {targetRival?.name
                ? t('home.personal.pointsToOvertake', { points: pointsToNextRank, name: targetRival.name, rank: rank - 1 })
                : t('home.personal.pointsToRank', { points: pointsToNextRank, rank: rank - 1 })}
            </span>
          )}
        </div>
        {!isLeader && (
          <div style={S.progressBarRow}>
            <span style={S.trackLabel}>#{rank}</span>
            <span style={S.track}>
              <span style={{ ...S.fill, width: `${progressPct}%` }} />
            </span>
            <span style={S.trackLabelRight}>#{rank - 1}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  card: {
    position: 'relative',
    padding: '18px 20px',
    borderRadius: 'var(--radius-card, 16px)',
    background: 'linear-gradient(155deg, var(--surface-card), var(--surface-inset))',
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 999,
    background: 'radial-gradient(circle, var(--status-delayed-bg), transparent 68%)',
    pointerEvents: 'none',
  },
  mobileHeroRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  },
  desktopHeroRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 28,
  },
  rankCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: '0 0 auto',
  },
  rankOverline: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--status-delayed-fg)',
  },
  bigRankMobile: {
    font: '700 56px/0.92 var(--font-display)',
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
  },
  bigRankDesktop: {
    font: '700 84px/0.86 var(--font-display)',
    letterSpacing: '-0.04em',
    color: 'var(--text-primary)',
  },
  totalLabel: {
    font: '600 10.5px/1 var(--font-mono)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--status-delayed-fg)',
  },
  eloColMobile: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingTop: 3,
  },
  eloColDesktop: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  eloRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 7,
    flexWrap: 'wrap',
  },
  eloNumMobile: {
    font: '700 24px/1 var(--font-display)',
    color: 'var(--text-primary)',
  },
  eloNumDesktop: {
    font: '700 30px/1 var(--font-display)',
    color: 'var(--text-primary)',
  },
  eloMono: {
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  deltaGreen: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  deltaRed: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  statsGrid: {
    display: 'flex',
    gap: 8,
  },
  statPill: {
    flex: 1,
    padding: '7px 9px',
    borderRadius: 'var(--radius-sm, 8px)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
  },
  statVal: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  statValGreen: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  statValGold: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  statDesc: {
    display: 'block',
    font: '400 10px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  progressBox: {
    position: 'relative',
    marginTop: 14,
    paddingTop: 13,
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  progressTextRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
  },
  targetText: {
    font: '400 12.5px/1.4 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  progressBarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  trackLabel: {
    font: '600 11px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  trackLabelRight: {
    font: '600 11px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  track: {
    position: 'relative',
    flex: 1,
    height: 8,
    borderRadius: 999,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    inset: 0,
    borderRadius: 999,
    background: 'linear-gradient(90deg, var(--action-primary-bg), var(--status-delayed-fg))',
    transition: 'width 0.4s ease',
  },
}
