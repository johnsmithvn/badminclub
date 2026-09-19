import { useState } from 'react'
import { t } from '#i18n'

export default function HeroRankCard({ hero, data, isMobile }) {
  const [mode, setMode] = useState('season') // 'season' | 'elo'
  const activeHero = hero || data || {}
  const {
    rank = 1,
    eloRank = 1,
    totalMembers = 0,
    elo = 0,
    eloDeltaWeek = 0,
    seasonRank = 1,
    seasonTotalMembers = 0,
    seasonMatches = 0,
    seasonWins = 0,
    seasonWinRate = 0,
    seasonPoints = 0,
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
  const displayTotalMembers = isSeasonMode ? (seasonTotalMembers || totalMembers) : totalMembers
  const sign = eloDeltaWeek > 0 ? '↑ ' : eloDeltaWeek < 0 ? '↓ ' : ''
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

  if (!isMobile) {
    return (
      <div style={S.cardDesktop}>
        <span style={S.glowDesktop} />
        <div style={S.desktopToggleContainer}>
          {toggleNode}
        </div>

        {/* Cụm trái: Rank + Metric chính */}
        <div style={S.desktopLeftCluster}>
          <div style={S.rankCol}>
            <span style={S.rankOverline}>
              {isSeasonMode ? t('home.personal.seasonRankHero') : t('home.personal.rankHero')}
            </span>
            <span style={S.bigRankDesktop}>#{displayRank}</span>
            <span style={S.totalLabel}>{t('home.personal.overTotal', { total: displayTotalMembers })}</span>
          </div>

          {isSeasonMode ? (
            <div style={S.desktopEloSubCol}>
              <span style={S.seasonPointsDesktop}>
                {seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}
              </span>
              <span style={S.eloMono}>{t('home.personal.seasonPoints')}</span>
              <span style={S.subMetricMuted}>
                {elo} {t('home.personal.eloNormal')}
              </span>
            </div>
          ) : (
            <div style={S.desktopEloSubCol}>
              <span style={S.eloNumDesktop}>{elo}</span>
              <span style={S.eloMono}>{t('home.personal.eloHighConfidence')}</span>
              {eloDeltaWeek !== 0 && (
                <span style={eloDeltaWeek >= 0 ? S.deltaGreen : S.deltaRed}>
                  {sign}{absDelta} {t('home.personal.upWeek', { delta: '' }).trim()}
                </span>
              )}
            </div>
          )}
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
            {isSeasonMode ? (
              <span style={S.statPill}>
                <span style={S.statVal}>{elo}</span>
                <span style={S.statDesc}>{t('home.personal.eloNormal')}</span>
              </span>
            ) : (
              <span style={S.statPill}>
                <span style={S.statValGreen}>{seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}</span>
                <span style={S.statDesc}>{t('home.personal.seasonPoints')}</span>
              </span>
            )}
            <span style={S.statPill}>
              <span style={S.statValGold}>{badgesCount}</span>
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
                        rank: displayRank - 1,
                      })
                    : t('home.personal.pointsToRank', {
                        points: pointsToNextRank,
                        rank: displayRank - 1,
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
                    #{displayRank - 1}{targetRival?.elo ? ` · ${targetRival.elo}` : ''}
                  </span>
                </div>
              )
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
      <div style={S.mobileTopRow}>
        <span style={S.rankOverline}>
          {isSeasonMode ? t('home.personal.seasonRankHero') : t('home.personal.rankHero')}
        </span>
        {toggleNode}
      </div>

      <div style={S.mobileHeroRow}>
        <div style={S.rankCol}>
          <span style={S.bigRankMobile}>#{displayRank}</span>
          <span style={S.totalLabel}>{t('home.personal.overTotal', { total: displayTotalMembers })}</span>
        </div>

        <div style={S.eloColMobile}>
          {isSeasonMode ? (
            <div style={S.eloRow}>
              <span style={S.seasonPointsMobile}>
                {seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}
              </span>
              <span style={S.eloMono}>{t('home.personal.seasonPoints')}</span>
              <span style={S.subMetricMuted}>({elo} Elo)</span>
            </div>
          ) : (
            <div style={S.eloRow}>
              <span style={S.eloNumMobile}>{elo}</span>
              <span style={S.eloMono}>{t('home.personal.eloNormal')}</span>
              {eloDeltaWeek !== 0 && (
                <span style={eloDeltaWeek >= 0 ? S.deltaGreen : S.deltaRed}>
                  {sign}{absDelta}
                </span>
              )}
            </div>
          )}

          <div style={S.statsGrid}>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonMatches}</span>
              <span style={S.statDesc}>{t('home.personal.seasonMatches')}</span>
            </span>
            <span style={S.statPill}>
              <span style={S.statVal}>{seasonWinRate}%</span>
              <span style={S.statDesc}>{t('home.personal.winRate')}</span>
            </span>
            {isSeasonMode ? (
              <span style={S.statPill}>
                <span style={S.statVal}>{elo}</span>
                <span style={S.statDesc}>{t('home.personal.eloNormal')}</span>
              </span>
            ) : (
              <span style={S.statPill}>
                <span style={S.statValGreen}>{seasonPoints >= 0 ? `+${seasonPoints}` : seasonPoints}</span>
                <span style={S.statDesc}>{t('home.personal.seasonPoints')}</span>
              </span>
            )}
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
                    rank: displayRank - 1,
                  })
                : t('home.personal.pointsToRank', {
                    points: pointsToNextRank,
                    rank: displayRank - 1,
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
              <span style={S.trackLabelRight}>#{displayRank - 1}</span>
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
  desktopToggleContainer: {
    position: 'absolute',
    top: 14,
    right: 18,
    zIndex: 2,
  },
  mobileTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modeToggle: {
    display: 'inline-flex',
    padding: 2,
    borderRadius: 8,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  modeBtn: {
    background: 'none',
    border: 'none',
    padding: '3px 9px',
    borderRadius: 6,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modeBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '3px 9px',
    borderRadius: 6,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
  },
  seasonPointsDesktop: {
    font: '700 30px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
  },
  seasonPointsMobile: {
    font: '700 24px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
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
