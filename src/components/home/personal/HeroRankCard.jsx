import { t } from '#i18n'

export default function HeroRankCard({ hero, data, isMobile }) {
  const activeHero = hero || data || {}
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
  } = activeHero

  const sign = eloDeltaWeek > 0 ? '↑ ' : eloDeltaWeek < 0 ? '↓ ' : ''
  const absDelta = Math.abs(eloDeltaWeek)

  if (!isMobile) {
    return (
      <div style={S.cardDesktop}>
        <span style={S.glowDesktop} />
        {/* Cụm trái: Rank + Elo */}
        <div style={S.desktopLeftCluster}>
          <div style={S.rankCol}>
            <span style={S.rankOverline}>{t('home.personal.rankHero')}</span>
            <span style={S.bigRankDesktop}>#{rank}</span>
            <span style={S.totalLabel}>{t('home.personal.overTotal', { total: totalMembers })}</span>
          </div>
          <div style={S.desktopEloSubCol}>
            <span style={S.eloNumDesktop}>{elo}</span>
            <span style={S.eloMono}>{t('home.personal.eloHighConfidence')}</span>
            {eloDeltaWeek !== 0 && (
              <span style={eloDeltaWeek >= 0 ? S.deltaGreen : S.deltaRed}>
                {sign}{absDelta} {t('home.personal.upWeek', { delta: '' }).trim()}
              </span>
            )}
          </div>
        </div>

        {/* Cụm phải: 4 ô stat + Thanh tiến độ */}
        <div style={S.desktopRightCluster}>
          <div style={S.statsGrid}>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonMatches}</span>
              <span style={S.statDesc}>{t('home.personal.seasonMatches')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonWins}</span>
              <span style={S.statDesc}>{t('home.personal.winRateWithPct', { pct: seasonWinRate })}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statValGreen}>{seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}</span>
              <span style={S.statDesc}>{t('home.personal.seasonPoints')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statValGold}>{badgesCount}</span>
              <span style={S.statDesc}>{t('home.personal.badgesCount')}</span>
            </span>
          </div>

          <div style={S.progressBoxDesktop}>
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
                <span style={S.trackLabel}>#{rank} · {elo}</span>
                <span style={S.track}>
                  <span style={{ ...S.fill, width: `${progressPct}%` }} />
                </span>
                <span style={S.trackLabelRight}>#{rank - 1}{targetRival?.elo ? ` · ${targetRival.elo}` : ''}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Mobile layout
  return (
    <div style={S.card}>
      <span style={S.glow} />
      <div style={S.mobileHeroRow}>
        <div style={S.rankCol}>
          <span style={S.bigRankMobile}>#{rank}</span>
          <span style={S.totalLabel}>{t('home.personal.overTotal', { total: totalMembers })}</span>
        </div>

        <div style={S.eloColMobile}>
          <div style={S.eloRow}>
            <span style={S.eloNumMobile}>{elo}</span>
            <span style={S.eloMono}>{t('home.personal.eloNormal')}</span>
            {eloDeltaWeek !== 0 && (
              <span style={eloDeltaWeek >= 0 ? S.deltaGreen : S.deltaRed}>
                {sign}{absDelta}
              </span>
            )}
          </div>

          <div style={S.statsGrid}>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonMatches}</span>
              <span style={S.statDesc}>{t('home.personal.seasonMatches')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonWinRate}%</span>
              <span style={S.statDesc}>{t('home.personal.winRate')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statValGreen}>{seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}</span>
              <span style={S.statDesc}>{t('home.personal.seasonPoints')}</span>
            </span>
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
  cardDesktop: {
    position: 'relative',
    padding: '22px 24px',
    borderRadius: 'var(--radius-card, 18px)',
    background: 'linear-gradient(140deg, var(--surface-card), var(--surface-inset))',
    border: '1px solid var(--border-default)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    gap: 28,
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
  glowDesktop: {
    position: 'absolute',
    top: -70,
    right: 80,
    width: 280,
    height: 280,
    borderRadius: 999,
    background: 'radial-gradient(circle, var(--status-delayed-bg), transparent 66%)',
    pointerEvents: 'none',
  },
  mobileHeroRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  },
  desktopLeftCluster: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    gap: 16,
    flex: '0 0 auto',
  },
  desktopEloSubCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingBottom: 6,
  },
  desktopRightCluster: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 13,
  },
  progressBoxDesktop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
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
