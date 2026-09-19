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

  // Mobile: Chỉ hiển thị 1 trận gần nhất
  if (isMobile) {
    const m = matches[0]
    const dateLabel = m.dateKey === 'today' ? t('home.personal.today') : (m.dateKey === 'yesterday' ? t('home.personal.yesterday') : m.dateStr)
    return (
      <div style={S.card}>
        <div style={S.headerRow}>
          <span style={S.title}>{t('home.personal.recentMatchTitleMobile')}</span>
          <span style={S.timeMono}>{dateLabel}</span>
        </div>

        <div style={S.mobileMatchRow}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.teamNames}>{m.myTeamNames}</span>
            <span style={S.oppNames}>{m.oppTeamNames}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
            <span style={m.won ? S.scoreGreen : S.scoreRed}>{m.score}</span>
            <span style={m.won ? S.badgeWin : S.badgeLoss}>
              {m.won ? t('home.personal.win') : t('home.personal.loss')}
            </span>
          </div>
        </div>

        <div style={S.pillsRow}>
          <span style={S.pillPadded}>
            <span style={m.won ? S.greenMono : S.redMono}>
              {m.eloDelta ? (m.won ? `+${m.eloDelta} ${t('home.personal.eloNormal')}` : `−${m.eloDelta} ${t('home.personal.eloNormal')}`) : (m.eloChange ? `${m.eloChange} ${t('home.personal.eloNormal')}` : `0 ${t('home.personal.eloNormal')}`)}
            </span>
          </span>
          <span style={S.pillPadded}>
            {m.rankImpact ? (
              <span style={m.rankImpact.type === 'up' ? S.greenMono : (m.rankImpact.type === 'down' ? S.redMono : S.mutedMono)}>
                {m.rankImpact.type === 'up' && `#${m.rankImpact.from} → #${m.rankImpact.to}`}
                {m.rankImpact.type === 'down' && `#${m.rankImpact.from} → #${m.rankImpact.to}`}
                {m.rankImpact.type === 'same' && t('home.personal.keepRank', { rank: m.rankImpact.to })}
              </span>
            ) : (
              <span style={m.seasonChange && m.seasonChange !== '—' ? (m.won ? S.greenMono : S.redMono) : S.mutedMono}>
                {formatSeasonPoints(m.seasonChange, m.won)}
              </span>
            )}
          </span>
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
          return (
            <div key={m.id} style={S.desktopRow}>
              <span style={S.desktopDateCol}>{dateLabel}</span>
              <span style={S.desktopMatchupCol}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.myTeamNames}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, margin: '0 6px' }}>vs</span>
                <span style={{ color: 'var(--text-secondary)' }}>{m.oppTeamNames}</span>
              </span>
              <span style={m.won ? S.desktopScoreGreen : S.desktopScoreRed}>{m.score}</span>
              <span style={m.won ? S.desktopDeltaGreen : S.desktopDeltaRed}>
                {m.eloDelta ? (m.won ? `+${m.eloDelta} ${t('home.personal.eloNormal')}` : `−${m.eloDelta} ${t('home.personal.eloNormal')}`) : (m.eloChange ? `${m.eloChange} ${t('home.personal.eloNormal')}` : `0 ${t('home.personal.eloNormal')}`)}
              </span>
              <span style={S.desktopRankCol}>
                {m.rankImpact ? (
                  m.rankImpact.type === 'up' ? (
                    <span style={S.rankPillUp}>#{m.rankImpact.from} → #{m.rankImpact.to}</span>
                  ) : m.rankImpact.type === 'down' ? (
                    <span style={S.rankPillDown}>#{m.rankImpact.from} → #{m.rankImpact.to}</span>
                  ) : (
                    <span style={S.rankPillSame}>{t('home.personal.keepRank', { rank: m.rankImpact.to })}</span>
                  )
                ) : (
                  <span style={m.seasonChange && m.seasonChange !== '—' ? (m.won ? S.desktopSeasonGreen : S.desktopSeasonRed) : S.desktopSeasonMuted}>
                    {formatSeasonPoints(m.seasonChange, m.won)}
                  </span>
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
  mobileMatchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  teamNames: {
    font: '600 14.5px/1.25 var(--font-display)',
    color: 'var(--text-primary)',
  },
  oppNames: {
    font: '400 11.5px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
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
  desktopDateCol: {
    width: 62,
    flex: '0 0 auto',
    font: '400 11px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  desktopMatchupCol: {
    flex: 1,
    minWidth: 0,
    font: '600 14px/1.3 var(--font-display)',
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
    width: 74,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  desktopDeltaRed: {
    width: 74,
    textAlign: 'right',
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  desktopRankCol: {
    width: 86,
    flex: '0 0 auto',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  rankPillUp: {
    padding: '3px 8px',
    borderRadius: 6,
    background: 'var(--status-delivered-bg)',
    border: '1px solid var(--status-delivered-fg)',
    color: 'var(--status-delivered-fg)',
    font: '600 11.5px/1 var(--font-mono)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  rankPillDown: {
    padding: '3px 8px',
    borderRadius: 6,
    background: 'var(--status-incident-bg)',
    border: '1px solid var(--status-incident-fg)',
    color: 'var(--status-incident-fg)',
    font: '600 11.5px/1 var(--font-mono)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  rankPillSame: {
    padding: '3px 8px',
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
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
