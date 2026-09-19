import { t } from '#i18n'

export default function NearbyStandingsCard({ standings = [], onViewLeaderboard }) {
  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.title}>{t('home.personal.aroundYouTitle')}</span>
        <button type="button" onClick={onViewLeaderboard} style={S.viewBtn}>
          {t('home.personal.viewLeaderboard')}
        </button>
      </div>

      <div style={S.rowsList}>
        {standings.map((item) => {
          if (item.isMe) {
            return (
              <div key={item.id} style={S.rowActive}>
                <span style={S.rankActive}>#{item.rank}</span>
                <span style={S.nameActive}>{t('home.personal.you')}</span>
                <span style={S.eloActive}>{item.elo}</span>
              </div>
            )
          }

          if (item.isTarget) {
            return (
              <div key={item.id} style={S.rowTarget}>
                <span style={S.rankTarget}>#{item.rank}</span>
                <span style={S.nameTarget}>
                  {item.name}
                  <span style={S.targetTag}> · {t('home.personal.targetTag')}</span>
                </span>
                <span style={S.eloTarget}>{item.elo}</span>
              </div>
            )
          }

          return (
            <div key={item.id} style={S.rowNormal}>
              <span style={S.rankNormal}>#{item.rank}</span>
              <span style={S.nameNormal}>
                {item.name}
                {item.streakNote && (
                  <span style={S.streakNote}> · {item.streakNote}</span>
                )}
              </span>
              <span style={S.eloNormal}>{item.elo}</span>
            </div>
          )
        })}
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
  viewBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-link)',
    cursor: 'pointer',
  },
  rowsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  rowNormal: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 9px',
    borderRadius: 9,
  },
  rowActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 9px',
    borderRadius: 9,
    background: 'var(--surface-accent-soft)',
  },
  rowTarget: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 9px',
    borderRadius: 9,
    border: '1px solid var(--status-delayed-fg)',
  },
  rankNormal: {
    width: 28,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  rankActive: {
    width: 28,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-transit-fg)',
  },
  rankTarget: {
    width: 28,
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  nameNormal: {
    flex: 1,
    minWidth: 0,
    font: '500 13px/1.3 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  nameActive: {
    flex: 1,
    minWidth: 0,
    font: '600 13px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  nameTarget: {
    flex: 1,
    minWidth: 0,
    font: '600 13px/1.3 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  targetTag: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  streakNote: {
    font: '400 11px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  eloNormal: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  eloActive: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  eloTarget: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--text-primary)',
  },
}
