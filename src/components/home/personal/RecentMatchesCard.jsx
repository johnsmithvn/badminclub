import { Icon } from '#ds'
import { t } from '#i18n'

function formatSeasonPoints(val, won) {
  if (!val || val === '—') return '—'
  const str = String(val).trim()
  if (str === '0' || str === '+0' || str === '−0' || str === '-0') return `0 ${t('home.personal.seasonPointsShort')}`
  if (str.startsWith('+') || str.startsWith('−') || str.startsWith('-')) {
    return `${str} ${t('home.personal.seasonPointsShort')}`
  }
  const num = Number(str)
  if (!isNaN(num) && num > 0) {
    return `+${num} ${t('home.personal.seasonPointsShort')}`
  }
  if (!isNaN(num) && num < 0) {
    return `−${Math.abs(num)} ${t('home.personal.seasonPointsShort')}`
  }
  if (won) {
    return `+${str} ${t('home.personal.seasonPointsShort')}`
  }
  return `${str} ${t('home.personal.seasonPointsShort')}`
}

export default function RecentMatchesCard({ matches = [], isMobile, onViewAll }) {
  if (!matches.length) {
    return (
      <div style={S.card}>
        <div style={S.headerRow}>
          <span style={S.title}>{isMobile ? t('home.personal.recentMatchTitleMobile') : t('home.personal.recentMatchesTitle')}</span>
        </div>
        <div style={S.emptyState}>{t('home.personal.emptyMatches')}</div>
      </div>
    )
  }

  // Mobile: Hiển thị danh sách các trận gần nhất (tối đa 3 trận)
  if (isMobile) {
    return (
      <div style={S.card}>
        <div style={S.headerRow}>
          <span style={S.title}>{t('home.personal.recentMatchesTitle')}</span>
          <button type="button" onClick={onViewAll} style={S.viewAllBtn}>
            {t('home.personal.viewAll')}
          </button>
        </div>

        <div style={S.mobileList}>
          {matches.slice(0, 3).map((m, idx) => {
            const dateLabel = m.dateKey === 'today' ? t('home.personal.today') : (m.dateKey === 'yesterday' ? t('home.personal.yesterday') : m.dateStr)
            const myPlayers = m.myTeamPlayers?.length
              ? m.myTeamPlayers
              : [{ id: 'me', name: m.myTeamNames, isMe: true }]
            const oppPlayers = m.oppTeamPlayers?.length
              ? m.oppTeamPlayers
              : [{ id: 'opp', name: m.oppTeamNames, isMe: false }]

            return (
              <div key={m.id || idx} style={idx > 0 ? S.mobileMatchItemWithDivider : S.mobileMatchItem}>
                <div style={S.mobileItemHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.isChallenge && (
                      <span style={S.challengeBadgeMobile} title={t('home.personal.challengeMatchTooltip')}>
                        <Icon name="swords" size={10} style={{ color: 'var(--status-delayed-fg)' }} />
                        <span>{t('home.personal.challengeMatchBadge')}</span>
                      </span>
                    )}
                    <span style={S.timeMono}>
                      {dateLabel}
                      {m.timeStr ? ` · ${m.timeStr}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={m.won ? S.greenMono : S.redMono}>
                      {formatSeasonPoints(m.seasonChange, m.won)}
                    </span>
                    <span style={m.won ? S.badgeWin : S.badgeLoss}>
                      {m.won ? t('home.personal.win') : t('home.personal.loss')}
                    </span>
                  </div>
                </div>

                <div style={S.mobileMatchRow}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={S.mobileTeamRow}>
                      {myPlayers.map((p, pIdx) => (
                        <span key={p.id || pIdx}>
                          {pIdx > 0 && <span style={S.playerSep}>·</span>}
                          <span
                            style={
                              p.isMe
                                ? m.won
                                  ? S.myPlayerWin
                                  : S.myPlayerLoss
                                : S.partnerPlayer
                            }
                          >
                            {p.name}
                          </span>
                        </span>
                      ))}
                    </div>
                    <div style={S.mobileOppRow}>
                      {oppPlayers.map((p, pIdx) => (
                        <span key={p.id || pIdx}>
                          {pIdx > 0 && <span style={S.playerSep}>·</span>}
                          <span style={S.oppPlayer}>{p.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                    <div style={S.mobileScoreCol}>
                      {m.scoreSets && m.scoreSets.length > 0 ? (
                        m.scoreSets.map((s, sIdx) => (
                          <span key={sIdx} style={S.scoreSetRow}>
                            {sIdx > 0 && <span style={S.scoreComma}>, </span>}
                            <span style={m.won ? S.myScoreWinMobile : S.myScoreLossMobile}>{s.myScore}</span>
                            <span style={S.scoreSepMobile}>-</span>
                            <span style={S.oppScoreMobile}>{s.oppScore}</span>
                          </span>
                        ))
                      ) : (
                        <span style={m.won ? S.scoreGreen : S.scoreRed}>{m.score}</span>
                      )}
                    </div>
                  </div>
                </div>

                {m.rankImpact && m.rankImpact.type !== 'same' && (
                  <div style={S.mobileRankImpactRow}>
                    <span style={m.rankImpact.type === 'up' ? S.greenMono : S.redMono}>
                      {m.rankImpact.type === 'up' && `#${m.rankImpact.from} → #${m.rankImpact.to}`}
                      {m.rankImpact.type === 'down' && `#${m.rankImpact.from} → #${m.rankImpact.to}`}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Desktop: Hiển thị tối đa 3 trận
  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.title}>{t('home.personal.recentMatchesTitle')}</span>
        <button type="button" onClick={onViewAll} style={S.viewAllBtn}>
          {t('home.personal.viewAll')}
        </button>
      </div>

      <div style={S.desktopList}>
        {matches.map((m) => {
          const dateLabel = m.dateKey === 'today' ? t('home.personal.today') : (m.dateKey === 'yesterday' ? t('home.personal.yesterday') : m.dateStr)
          const myPlayers = m.myTeamPlayers?.length
            ? m.myTeamPlayers
            : [{ id: 'me', name: m.myTeamNames, isMe: true }]
          const oppPlayers = m.oppTeamPlayers?.length
            ? m.oppTeamPlayers
            : [{ id: 'opp', name: m.oppTeamNames, isMe: false }]

          return (
            <div key={m.id} style={m.isChallenge ? S.desktopRowChallenge : S.desktopRow}>
              {/* Cột 1: Ngày + Giờ biến động */}
              <span style={S.desktopDateCol}>
                <span style={S.dateLabelText}>{dateLabel}</span>
                {m.timeStr ? <span style={S.timeLabelText}>{m.timeStr}</span> : null}
              </span>

              {/* Cột 2: Matchup (Highlight tên user sáng lên: thắng xanh, thua đỏ) */}
              <span style={S.desktopMatchupCol}>
                <span style={S.teamSpan}>
                  {myPlayers.map((p, pIdx) => (
                    <span key={p.id || pIdx}>
                      {pIdx > 0 && <span style={S.playerSep}>·</span>}
                      <span
                        style={
                          p.isMe
                            ? m.won
                              ? S.myPlayerWin
                              : S.myPlayerLoss
                            : S.partnerPlayer
                        }
                      >
                        {p.name}
                      </span>
                    </span>
                  ))}
                </span>
                {m.isChallenge ? (
                  <span style={S.vsChallenge} title={t('home.personal.challengeMatchTooltip')}>
                    <Icon name="swords" size={12} style={S.swordsChallengeIcon} />
                    <span style={S.challengeBadgeText}>{t('home.personal.challengeMatchBadge')}</span>
                  </span>
                ) : (
                  <span style={S.vsNormal} title={t('home.personal.matchAgainst')}>
                    <Icon name="swords" size={13} style={S.swordsNormalIcon} />
                  </span>
                )}
                <span style={S.oppSpan}>
                  {oppPlayers.map((p, pIdx) => (
                    <span key={p.id || pIdx}>
                      {pIdx > 0 && <span style={S.playerSep}>·</span>}
                      <span style={S.oppPlayer}>{p.name}</span>
                    </span>
                  ))}
                </span>
              </span>

              {/* Cột 3: Tỷ số (Highlight điểm của bên user) */}
              <span style={S.desktopScoreCol}>
                {m.scoreSets && m.scoreSets.length > 0 ? (
                  m.scoreSets.map((s, sIdx) => (
                    <span key={sIdx} style={S.scoreSetRow}>
                      {sIdx > 0 && <span style={S.scoreComma}>, </span>}
                      <span style={m.won ? S.myScoreWin : S.myScoreLoss}>{s.myScore}</span>
                      <span style={S.scoreSep}>-</span>
                      <span style={S.oppScore}>{s.oppScore}</span>
                    </span>
                  ))
                ) : (
                  <span style={m.won ? S.desktopScoreGreen : S.desktopScoreRed}>{m.score}</span>
                )}
              </span>

              {/* Cột 4: Biến động Điểm Mùa */}
              <span style={m.won ? S.desktopDeltaGreen : S.desktopDeltaRed}>
                {formatSeasonPoints(m.seasonChange, m.won)}
              </span>

              {/* Cột 5: Biến động Hạng Mùa */}
              <span style={S.desktopRankCol}>
                {m.rankImpact ? (
                  m.rankImpact.type === 'up' ? (
                    <span style={S.rankTextUp}>#{m.rankImpact.from} → #{m.rankImpact.to}</span>
                  ) : m.rankImpact.type === 'down' ? (
                    <span style={S.rankTextDown}>#{m.rankImpact.from} → #{m.rankImpact.to}</span>
                  ) : (
                    <span style={S.rankTextSame}>{t('home.personal.keepRank', { rank: m.rankImpact.to })}</span>
                  )
                ) : (
                  <span style={S.rankTextSame}>—</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '14px 15px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    font: '600 11px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  timeMono: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  viewAllBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-link)',
    cursor: 'pointer',
  },
  mobileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  mobileMatchItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '4px 0',
    width: '100%',
    minWidth: 0,
  },
  mobileMatchItemWithDivider: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '10px 0 4px 0',
    borderTop: '1px solid var(--border-subtle)',
    width: '100%',
    minWidth: 0,
  },
  mobileItemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
    width: '100%',
  },
  mobileRankImpactRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    fontSize: 11,
    width: '100%',
  },
  mobileMatchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minWidth: 0,
  },
  mobileTeamRow: {
    font: '600 14px/1.25 var(--font-display)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  mobileOppRow: {
    font: '400 11.5px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  teamSpan: {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  oppSpan: {
    display: 'inline-flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  myPlayerWin: {
    color: 'var(--status-delivered-fg)',
    fontWeight: 700,
    textShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
  },
  myPlayerLoss: {
    color: 'var(--status-incident-fg)',
    fontWeight: 700,
    textShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
  },
  partnerPlayer: {
    color: 'var(--text-primary)',
    fontWeight: 500,
  },
  oppPlayer: {
    color: 'var(--text-secondary)',
    fontWeight: 400,
  },
  playerSep: {
    color: 'var(--text-muted)',
    opacity: 0.5,
    margin: '0 4px',
  },
  vsNormal: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 8px',
    flexShrink: 0,
    verticalAlign: 'middle',
  },
  swordsNormalIcon: {
    color: 'var(--text-muted)',
    opacity: 0.65,
  },
  vsChallenge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    margin: '0 8px',
    padding: '2px 7px',
    borderRadius: 999,
    background: 'var(--status-delayed-bg)',
    border: '1px solid rgba(240, 183, 92, 0.4)',
    color: 'var(--status-delayed-fg)',
    flexShrink: 0,
    boxShadow: '0 0 8px rgba(240, 183, 92, 0.15)',
  },
  swordsChallengeIcon: {
    color: 'var(--status-delayed-fg)',
  },
  challengeBadgeText: {
    font: '700 10px/1 var(--font-mono)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  challengeBadgeMobile: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3.5,
    padding: '1.5px 6px',
    borderRadius: 999,
    background: 'var(--status-delayed-bg)',
    border: '1px solid rgba(240, 183, 92, 0.35)',
    color: 'var(--status-delayed-fg)',
    font: '700 9.5px/1 var(--font-mono)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  scoreGreen: {
    font: '700 20px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
  },
  scoreRed: {
    font: '700 20px/1 var(--font-display)',
    color: 'var(--status-incident-fg)',
  },
  badgeWin: {
    font: '600 10.5px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--status-delivered-fg)',
  },
  badgeLoss: {
    font: '600 10.5px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--status-incident-fg)',
  },
  pillsRow: {
    display: 'flex',
    gap: 7,
  },
  pillPadded: {
    flex: 1,
    padding: '7px 9px',
    borderRadius: 9,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-default)',
    textAlign: 'center',
  },
  greenMono: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  redMono: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  mutedMono: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  desktopList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  desktopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '11px 13px',
    borderRadius: 11,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-default)',
  },
  desktopRowChallenge: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '11px 13px 11px 10px',
    borderRadius: 11,
    background: 'linear-gradient(90deg, rgba(240, 183, 92, 0.08) 0%, var(--surface-inset) 28%)',
    border: '1px solid var(--border-default)',
    borderLeft: '3px solid var(--status-delayed-fg)',
    boxShadow: '0 0 10px rgba(240, 183, 92, 0.06)',
  },
  desktopDateCol: {
    width: 68,
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  dateLabelText: {
    font: '500 11.5px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  },
  timeLabelText: {
    font: '400 10.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  desktopMatchupCol: {
    flex: 1,
    minWidth: 0,
    font: '500 14px/1.3 var(--font-display)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  desktopScoreCol: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
    whiteSpace: 'nowrap',
  },
  scoreSetRow: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  myScoreWin: {
    font: '700 16.5px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
    textShadow: '0 0 10px rgba(16, 185, 129, 0.35)',
  },
  myScoreLoss: {
    font: '700 16.5px/1 var(--font-display)',
    color: 'var(--status-incident-fg)',
    textShadow: '0 0 10px rgba(239, 68, 68, 0.35)',
  },
  scoreSep: {
    font: '400 15px/1 var(--font-display)',
    color: 'var(--text-muted)',
    opacity: 0.6,
    margin: '0 1.5px',
  },
  oppScore: {
    font: '500 15px/1 var(--font-display)',
    color: 'var(--text-muted)',
  },
  scoreComma: {
    color: 'var(--text-muted)',
    marginRight: 4,
  },
  mobileScoreCol: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  myScoreWinMobile: {
    font: '700 15.5px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
    textShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
  },
  myScoreLossMobile: {
    font: '700 15.5px/1 var(--font-display)',
    color: 'var(--status-incident-fg)',
    textShadow: '0 0 8px rgba(239, 68, 68, 0.3)',
  },
  scoreSepMobile: {
    font: '400 14px/1 var(--font-display)',
    color: 'var(--text-muted)',
    opacity: 0.6,
    margin: '0 1.5px',
  },
  oppScoreMobile: {
    font: '500 14px/1 var(--font-display)',
    color: 'var(--text-muted)',
  },
  desktopScoreGreen: {
    font: '700 16px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
  },
  desktopScoreRed: {
    font: '700 16px/1 var(--font-display)',
    color: 'var(--status-incident-fg)',
  },
  desktopDeltaGreen: {
    width: 96,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
    whiteSpace: 'nowrap',
  },
  desktopDeltaRed: {
    width: 96,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
    whiteSpace: 'nowrap',
  },
  desktopRankCol: {
    width: 86,
    flex: '0 0 auto',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  rankTextUp: {
    font: '700 13px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
    whiteSpace: 'nowrap',
  },
  rankTextDown: {
    font: '700 13px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
    whiteSpace: 'nowrap',
  },
  rankTextSame: {
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    opacity: 0.85,
  },
  desktopSeasonGreen: {
    width: 86,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  desktopSeasonRed: {
    width: 86,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  desktopSeasonMuted: {
    width: 86,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  emptyState: {
    padding: '12px 0',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
}
