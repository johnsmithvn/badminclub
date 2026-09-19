import { useState } from 'react'
import { t } from '#i18n'

export default function HeroRankCard({ hero, data, isMobile }) {
  const [mode, setMode] = useState('season') // 'season' | 'elo'
  const activeHero = hero || data || {}
  const {
    rank = 1,
    eloRank = 1,
    eloRankDelta = 0,
    elo = 0,
    eloDeltaWeek = 0,
    seasonRank = 1,
    seasonRankDelta = 0,
    seasonMatches = 0,
    seasonWins = 0,
    seasonWinRate = 0,
    seasonPoints = 0,
    seasonLatestDelta = 0,
    seasonPctChange = 0,
    seasonTargetRival = null,
    seasonPointsToNextRank = 0,
    seasonProgressPct = 100,
    isSeasonLeader = false,
    badgesCount = 0,
    targetRival = null,
    pointsToNextRank = 0,
    progressPct = 100,
    isLeader = false,
  } = activeHero

  const isSeasonMode = mode === 'season'
  const displayRank = isSeasonMode ? (seasonRank || rank) : (eloRank || rank)
  const rankDelta = isSeasonMode ? (seasonRankDelta ?? 0) : (eloRankDelta ?? 0)
  const absDelta = Math.abs(eloDeltaWeek)

  const toggleNode = (
    <div style={S.modeToggle}>
      <button
        type="button"
        onClick={() => setMode('season')}
        style={isSeasonMode ? S.modeBtnActive : S.modeBtn}
      >
        {t('home.personal.seasonTab')}
      </button>
      <button
        type="button"
        onClick={() => setMode('elo')}
        style={!isSeasonMode ? S.modeBtnActive : S.modeBtn}
      >
        {t('home.personal.eloTab')}
      </button>
    </div>
  )

  const renderRankDelta = () => {
    if (rankDelta > 0) {
      return (
        <span style={S.rankDeltaGreen}>
          {isMobile
            ? t('home.personal.rankUpMobile', { n: rankDelta })
            : t('home.personal.rankUp', { n: rankDelta })}
        </span>
      )
    }
    if (rankDelta < 0) {
      return (
        <span style={S.rankDeltaRed}>
          {isMobile
            ? t('home.personal.rankDownMobile', { n: Math.abs(rankDelta) })
            : t('home.personal.rankDown', { n: Math.abs(rankDelta) })}
        </span>
      )
    }
    return (
      <span style={S.rankDeltaMuted}>
        {isMobile ? t('home.personal.rankSameMobile') : t('home.personal.rankSame')}
      </span>
    )
  }

  if (!isMobile) {
    return (
      <div style={S.cardDesktop}>
        <span style={S.glowDesktop} />

        {/* Header row riêng biệt trên cùng: Chống tab che mất text các ô stat */}
        <div style={S.cardHeaderRow}>
          <span style={S.rankOverline}>
            {isSeasonMode ? t('home.personal.seasonRankHero') : t('home.personal.rankHero')}
          </span>
          <div style={S.toggleWrapper}>
            {toggleNode}
          </div>
        </div>

        <div style={S.desktopBody}>
          {/* Cụm trái: Rank + Metric chính */}
          <div style={S.desktopLeftCluster}>
            <div style={S.rankCol}>
              <span style={S.bigRankDesktop}>#{displayRank}</span>
              {renderRankDelta()}
            </div>

            {isSeasonMode ? (
              <div style={S.desktopEloSubCol}>
                <div style={S.eloRow}>
                  <span style={seasonPoints >= 0 ? S.seasonPointsDesktop : S.seasonPointsDesktopRed}>
                    {seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}
                  </span>
                  <span style={S.subMetricUnit}>{t('home.personal.seasonPointsShortUnit')}</span>
                </div>
                {seasonLatestDelta !== 0 || seasonPctChange !== 0 ? (
                  <span style={seasonLatestDelta >= 0 ? S.deltaGreen : S.deltaRed}>
                    {seasonLatestDelta > 0 ? `+${seasonLatestDelta}` : (seasonLatestDelta < 0 ? `−${Math.abs(seasonLatestDelta)}` : '0')}
                    {seasonPctChange !== 0 ? ` (${seasonPctChange > 0 ? '↑' : '↓'} ${Math.abs(seasonPctChange)}%)` : ''} {t('home.personal.latestAttendedSession')}
                  </span>
                ) : (
                  <span style={S.deltaMuted}>
                    0 {t('home.personal.latestAttendedSession')}
                  </span>
                )}
              </div>
            ) : (
              <div style={S.desktopEloSubCol}>
                <div style={S.eloRow}>
                  <span style={S.eloNumDesktop}>{elo}</span>
                  <span style={S.subMetricUnit}>{t('home.personal.eloNormal')}</span>
                </div>
                {eloDeltaWeek !== 0 ? (
                  <span style={eloDeltaWeek > 0 ? S.deltaGreen : S.deltaRed}>
                    {eloDeltaWeek > 0 ? '↑' : '↓'} {absDelta} Elo {t('home.personal.thisWeek')}
                  </span>
                ) : (
                  <span style={S.deltaMuted}>
                    0 Elo {t('home.personal.thisWeek')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Cụm phải: 3 ô stat tinh gọn + Mục tiêu & Thanh tiến độ */}
          <div style={S.desktopRightCluster}>
            <div style={S.statsGrid}>
              <span style={S.statPill}>
                <span style={S.statValCyan}>{seasonMatches}</span>
                <span style={S.statDesc}>{t('home.personal.seasonMatches')}</span>
              </span>
              <span style={S.statPill}>
                <span style={S.statValGreen}>{seasonWins}</span>
                <span style={S.statDesc}>{t('home.personal.winRateWithPct', { pct: seasonWinRate })}</span>
              </span>
              <span style={S.statPill}>
                <span style={S.statValPurple}>{badgesCount}</span>
                <span style={S.statDesc}>{t('home.personal.badgesCount')}</span>
              </span>
            </div>

            <div style={S.progressBoxDesktop}>
              <div style={S.progressTextRow}>
                {isSeasonMode ? (
                  isSeasonLeader ? (
                    <span style={S.targetText}>{t('home.personal.rankSeasonLeader')}</span>
                  ) : (
                    <span style={S.targetText}>
                      {seasonTargetRival?.name
                        ? t('home.personal.pointsToOvertakeSeason', {
                            points: seasonPointsToNextRank,
                            name: seasonTargetRival.name,
                            rank: Math.max(1, displayRank - 1),
                          })
                        : t('home.personal.pointsToRankSeason', {
                            points: seasonPointsToNextRank,
                            rank: Math.max(1, displayRank - 1),
                          })}
                    </span>
                  )
                ) : isLeader ? (
                  <span style={S.targetText}>{t('home.personal.rankLeader')}</span>
                ) : (
                  <span style={S.targetText}>
                    {targetRival?.name
                      ? t('home.personal.pointsToOvertake', {
                          points: pointsToNextRank,
                          name: targetRival.name,
                          rank: Math.max(1, displayRank - 1),
                        })
                      : t('home.personal.pointsToRank', {
                          points: pointsToNextRank,
                          rank: Math.max(1, displayRank - 1),
                        })}
                  </span>
                )}
              </div>

              {isSeasonMode ? (
                !isSeasonLeader && (
                  <div style={S.progressBarRow}>
                    <span style={S.trackLabel}>
                      #{displayRank} · {seasonPoints} {t('home.personal.seasonPointsShortUnit')}
                    </span>
                    <span style={S.track}>
                      <span style={{ ...S.fill, width: `${seasonProgressPct}%` }} />
                    </span>
                    <span style={S.trackLabelRight}>
                      #{Math.max(1, displayRank - 1)}{seasonTargetRival?.points != null ? ` · ${seasonTargetRival.points} ${t('home.personal.seasonPointsShortUnit')}` : ''}
                    </span>
                  </div>
                )
              ) : (
                !isLeader && (
                  <div style={S.progressBarRow}>
                    <span style={S.trackLabel}>#{displayRank} · {elo}</span>
                    <span style={S.track}>
                      <span style={{ ...S.fill, width: `${progressPct}%` }} />
                    </span>
                    <span style={S.trackLabelRight}>
                      #{Math.max(1, displayRank - 1)}{targetRival?.elo ? ` · ${targetRival.elo}` : ''}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mobile layout
  return (
    <div style={S.card}>
      <span style={S.glow} />
      <div style={S.cardHeaderRow}>
        <span style={S.rankOverline}>
          {isSeasonMode ? t('home.personal.seasonRankHero') : t('home.personal.rankHero')}
        </span>
        <div style={S.toggleWrapper}>
          {toggleNode}
        </div>
      </div>

      <div style={S.mobileHeroRow}>
        <div style={S.rankCol}>
          <span style={S.bigRankMobile}>#{displayRank}</span>
          {renderRankDelta()}
        </div>

        <div style={S.eloColMobile}>
          {isSeasonMode ? (
            <div style={S.eloRow}>
              <span style={seasonLatestDelta >= 0 ? S.seasonPointsMobile : S.seasonPointsMobileRed}>
                {seasonLatestDelta > 0 ? `+${seasonLatestDelta}` : (seasonLatestDelta < 0 ? `−${Math.abs(seasonLatestDelta)}` : '0')}
              </span>
              {seasonPctChange !== 0 ? (
                <span style={seasonPctChange > 0 ? S.deltaGreen : S.deltaRed}>
                  {seasonPctChange > 0 ? '↑' : '↓'} {Math.abs(seasonPctChange)}% {t('home.personal.latestAttendedSession')}
                </span>
              ) : (
                <span style={S.deltaMuted}>
                  0% {t('home.personal.latestAttendedSession')}
                </span>
              )}
            </div>
          ) : (
            <div style={S.eloRow}>
              <span style={S.eloNumMobile}>{elo}</span>
              {eloDeltaWeek !== 0 ? (
                <span style={eloDeltaWeek > 0 ? S.deltaGreen : S.deltaRed}>
                  {eloDeltaWeek > 0 ? '↑' : '↓'} {absDelta} Elo {t('home.personal.thisWeek')}
                </span>
              ) : (
                <span style={S.deltaMuted}>
                  0 Elo {t('home.personal.thisWeek')}
                </span>
              )}
            </div>
          )}

          <div style={S.statsGrid}>
            <span style={S.statPill}>
              <span style={S.statValCyan}>{seasonMatches}</span>
              <span style={S.statDesc}>{t('home.personal.seasonMatches')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statValGreen}>{seasonWinRate}%</span>
              <span style={S.statDesc}>{t('home.personal.winRate')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statValAmber}>{seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}</span>
              <span style={S.statDesc}>{t('home.personal.totalSeasonPoints')}</span>
            </span>
          </div>
        </div>
      </div>

      <div style={S.progressBox}>
        <div style={S.progressTextRow}>
          {isSeasonMode ? (
            isSeasonLeader ? (
              <span style={S.targetText}>{t('home.personal.rankSeasonLeader')}</span>
            ) : (
              <span style={S.targetText}>
                {seasonTargetRival?.name
                  ? t('home.personal.pointsToOvertakeSeason', {
                      points: seasonPointsToNextRank,
                      name: seasonTargetRival.name,
                      rank: Math.max(1, displayRank - 1),
                    })
                  : t('home.personal.pointsToRankSeason', {
                      points: seasonPointsToNextRank,
                      rank: Math.max(1, displayRank - 1),
                    })}
              </span>
            )
          ) : isLeader ? (
            <span style={S.targetText}>{t('home.personal.rankLeader')}</span>
          ) : (
            <span style={S.targetText}>
              {targetRival?.name
                ? t('home.personal.pointsToOvertake', {
                    points: pointsToNextRank,
                    name: targetRival.name,
                    rank: Math.max(1, displayRank - 1),
                  })
                : t('home.personal.pointsToRank', {
                    points: pointsToNextRank,
                    rank: Math.max(1, displayRank - 1),
                  })}
            </span>
          )}
        </div>

        {isSeasonMode ? (
          !isSeasonLeader && (
            <div style={S.progressBarRow}>
              <span style={S.trackLabel}>
                #{displayRank} · {seasonPoints} {t('home.personal.seasonPointsShortUnit')}
              </span>
              <span style={S.track}>
                <span style={{ ...S.fill, width: `${seasonProgressPct}%` }} />
              </span>
              <span style={S.trackLabelRight}>
                #{Math.max(1, displayRank - 1)}{seasonTargetRival?.points != null ? ` · ${seasonTargetRival.points} ${t('home.personal.seasonPointsShortUnit')}` : ''}
              </span>
            </div>
          )
        ) : (
          !isLeader && (
            <div style={S.progressBarRow}>
              <span style={S.trackLabel}>#{displayRank}</span>
              <span style={S.track}>
                <span style={{ ...S.fill, width: `${progressPct}%` }} />
              </span>
              <span style={S.trackLabelRight}>#{Math.max(1, displayRank - 1)}</span>
            </div>
          )
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
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
  },
  cardDesktop: {
    position: 'relative',
    padding: '20px 24px',
    borderRadius: 'var(--radius-card, 18px)',
    background: 'linear-gradient(140deg, var(--surface-card), var(--surface-inset))',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  toggleWrapper: {
    display: 'inline-flex',
  },
  desktopBody: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 24,
    width: '100%',
  },
  modeToggle: {
    display: 'inline-flex',
    padding: 3,
    borderRadius: 999,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 3,
  },
  modeBtn: {
    background: 'none',
    border: 'none',
    padding: '6px 14px',
    borderRadius: 999,
    font: '600 12px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '6px 14px',
    borderRadius: 999,
    font: '600 12px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
    minHeight: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  seasonPointsDesktop: {
    font: '700 28px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
  },
  seasonPointsDesktopRed: {
    font: '700 28px/1 var(--font-display)',
    color: 'var(--status-incident-fg)',
  },
  subMetricUnit: {
    font: '600 12px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    marginLeft: 3,
  },
  seasonPointsMobile: {
    font: '700 24px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
  },
  seasonPointsMobileRed: {
    font: '700 24px/1 var(--font-display)',
    color: 'var(--status-incident-fg)',
  },
  subMetricMuted: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--text-muted)',
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
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    width: '100%',
    minWidth: 0,
  },
  desktopLeftCluster: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 20,
    flex: '0 0 auto',
  },
  desktopEloSubCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingLeft: 20,
    borderLeft: '1px solid var(--border-subtle)',
  },
  desktopRightCluster: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  progressBoxDesktop: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  rankCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: '0 0 auto',
  },
  rankOverline: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--status-delayed-fg)',
  },
  bigRankMobile: {
    font: '700 50px/0.92 var(--font-display)',
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
  },
  bigRankDesktop: {
    font: '700 52px/1 var(--font-display)',
    letterSpacing: '-0.03em',
    color: 'var(--text-primary)',
  },
  rankDeltaGreen: {
    font: '600 11.5px/1.2 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
    whiteSpace: 'nowrap',
  },
  rankDeltaRed: {
    font: '600 11.5px/1.2 var(--font-mono)',
    color: 'var(--status-incident-fg)',
    whiteSpace: 'nowrap',
  },
  rankDeltaMuted: {
    font: '500 11.5px/1.2 var(--font-mono)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  eloColMobile: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingLeft: 10,
    borderLeft: '1px solid var(--border-subtle)',
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
    font: '600 11.5px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  deltaRed: {
    font: '600 11.5px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  deltaMuted: {
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  statsGrid: {
    display: 'flex',
    gap: 6,
    width: '100%',
    minWidth: 0,
  },
  statPill: {
    flex: 1,
    minWidth: 0,
    padding: '6px 6px',
    borderRadius: 'var(--radius-sm, 8px)',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    overflow: 'hidden',
  },
  statVal: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  statValCyan: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--action-accent-bg)',
  },
  statValGreen: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  statValAmber: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  statValPurple: {
    display: 'block',
    font: '600 14px/1.2 var(--font-mono)',
    color: 'var(--violet-400)',
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
