import { Avatar } from '#ds'
import { t } from '#i18n'
import { shortName } from '#lib/money.js'

export default function RivalGoalCard({ rivalData, rivalAnalysis, isMobile, onH2HClick, onChallenge }) {
  const activeRivalData = rivalData || rivalAnalysis
  const handleH2H = onH2HClick || onChallenge

  if (!activeRivalData || !activeRivalData.rival) {
    return null
  }

  const { me, rival, chaser } = activeRivalData

  const h2hText = rival.h2h?.myWins || rival.h2h?.rivalWins
    ? t('home.personal.h2hScore', { w: rival.h2h.myWins, l: rival.h2h.rivalWins })
    : t('home.personal.h2h')

  return (
    <div style={S.card}>
      <div style={S.topRow}>
        <span style={S.badge}>{t('home.personal.goalBadge')}</span>
        <span style={{ flex: 1 }} />
        <span style={S.gapMono}>{t('home.personal.goalGap', { points: rival.gapPoints })}</span>
      </div>

      <div style={S.rivalRow}>
        <Avatar name={rival.name} src={rival.avatarUrl} size={isMobile ? 38 : 42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={isMobile ? S.rivalNameMobile : S.rivalNameDesktop} title={rival.name}>{shortName(rival.name)}</div>
          <div style={S.rivalMeta}>
            #{rival.rank} · {rival.elo} {t('home.personal.eloNormal')}
            {rival.streak > 0 ? ` · ${t('home.personal.recentWinsStreak', { n: rival.streak })}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={handleH2H}
          style={S.h2hButton}
        >
          {h2hText}
        </button>
      </div>

      <div style={S.insightBox}>
        <span>
          {rival.tacticalInsight?.key
            ? t(`home.personal.${rival.tacticalInsight.key}`, rival.tacticalInsight.params)
            : t('home.personal.rivalTacticalInsight', { n: rival.neededWins || 2, name: rival.name })}
        </span>
      </div>

      {isMobile ? (
        <div style={S.mobileStandings}>
          <div style={S.standingRow}>
            <span style={S.standingRank}>#{rival.rank}</span>
            <span style={S.standingName} title={rival.name}>{shortName(rival.name)}</span>
            <span style={S.standingElo}>{rival.elo}</span>
          </div>
          <div style={S.standingRowActive}>
            <span style={S.standingRankActive}>#{me?.rank || 7}</span>
            <span style={S.standingNameActive}>{t('home.personal.you')}</span>
            <span style={S.standingEloActive}>{me?.elo || 0}</span>
          </div>
          {chaser && (
            <div style={S.standingRow}>
              <span style={S.standingRank}>#{chaser.rank}</span>
              <span style={S.standingName}>
                <span title={chaser.name}>{shortName(chaser.name)}</span>
                {chaser.streak >= 2 && (
                  <span style={S.streakNote}> · {t('home.personal.chaserWarningShort', { streak: chaser.streak })}</span>
                )}
              </span>
              <span style={S.standingElo}>{chaser.elo}</span>
            </div>
          )}
        </div>
      ) : (
        chaser && (
          <div style={S.chaserRowDesktop}>
            <span style={S.redDot} />
            <span style={{ flex: 1, minWidth: 0 }}>
              {chaser.warningInsight?.key
                ? t(`home.personal.${chaser.warningInsight.key}`, chaser.warningInsight.params)
                : t('home.personal.chaserWarning', {
                    name: chaser.name,
                    rank: chaser.rank,
                    gap: chaser.gapPoints,
                    streak: chaser.streak || 2,
                  })}
            </span>
          </div>
        )
      )}
    </div>
  )
}

const S = {
  card: {
    padding: '14px 15px',
    borderRadius: 'var(--radius-card, 14px)',
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
  },
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '5px 9px',
    borderRadius: 999,
    background: 'var(--status-delayed-fg)',
    color: 'var(--text-inverse)',
  },
  gapMono: {
    font: '400 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  rivalRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },
  avatarMobile: {
    width: 38,
    height: 38,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'linear-gradient(160deg, var(--status-delayed-fg), var(--navy-800))',
    display: 'grid',
    placeItems: 'center',
    font: '700 14px/1 var(--font-display)',
    color: 'var(--text-inverse)',
  },
  avatarDesktop: {
    width: 42,
    height: 42,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'linear-gradient(160deg, var(--status-delayed-fg), var(--navy-800))',
    display: 'grid',
    placeItems: 'center',
    font: '700 15px/1 var(--font-display)',
    color: 'var(--text-inverse)',
  },
  rivalNameMobile: {
    font: '700 17px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  rivalNameDesktop: {
    font: '700 18px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  rivalMeta: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  h2hButton: {
    border: '1px solid var(--border-subtle)',
    borderRadius: 999,
    background: 'var(--surface-inset)',
    color: 'var(--text-secondary)',
    font: '600 11.5px/1 var(--font-sans)',
    padding: '8px 11px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  insightBox: {
    padding: '10px 11px',
    borderRadius: 'var(--radius-sm, 10px)',
    background: 'var(--surface-brand-soft)',
    border: '1px solid var(--border-subtle)',
    font: '400 12.5px/1.5 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  mobileStandings: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingTop: 4,
    borderTop: '1px solid var(--border-subtle)',
  },
  standingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm, 8px)',
  },
  standingRowActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm, 8px)',
    background: 'var(--surface-accent-soft)',
  },
  standingRank: {
    width: 26,
    font: '600 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  standingRankActive: {
    width: 26,
    font: '600 11.5px/1 var(--font-mono)',
    color: 'var(--status-transit-fg)',
  },
  standingName: {
    flex: 1,
    minWidth: 0,
    font: '500 12.5px/1.3 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  standingNameActive: {
    flex: 1,
    minWidth: 0,
    font: '600 12.5px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  standingElo: {
    font: '600 11.5px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  standingEloActive: {
    font: '600 11.5px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  streakNote: {
    color: 'var(--status-incident-fg)',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
  },
  chaserRowDesktop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    font: '400 11.5px/1.4 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    background: 'var(--status-incident-fg)',
    flexShrink: 0,
  },
}
