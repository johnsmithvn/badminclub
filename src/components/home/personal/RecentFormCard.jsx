import { t } from '#i18n'

export default function RecentFormCard({ formData, isMobile }) {
  const {
    matches = [],
    winsCount = 0,
    streak = 0,
    nextBadgeStreak = 5,
    winsNeededForBadge = 3,
  } = formData || {}

  const displaySlots = [...matches]
  while (displaySlots.length < 5) {
    displaySlots.unshift({ id: `placeholder-${displaySlots.length}`, label: '—', won: null, isLatest: false })
  }

  const streakBadgeName = t('home.personal.streakBadgeName', { n: nextBadgeStreak })

  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.title}>{t('home.personal.formTitle')}</span>
        <span style={S.winCount}>{t('home.personal.formWins', { n: winsCount })}</span>
      </div>

      <div style={S.boxesRow}>
        {displaySlots.map((item, idx) => {
          const isLatest = idx === displaySlots.length - 1
          let boxStyle = S.neutralBox
          if (item.won === true) {
            boxStyle = isLatest ? S.winBoxLatest : S.winBox
          } else if (item.won === false) {
            boxStyle = S.lossBox
          }

          const height = isMobile ? 38 : 44
          const fontSize = isMobile ? 14 : 15

          return (
            <span
              key={item.id || idx}
              style={{
                ...boxStyle,
                height,
                font: `700 ${fontSize}px/1 var(--font-display)`,
              }}
            >
              {item.label}
            </span>
          )
        })}
      </div>

      <div style={S.footerText}>
        {streak > 0 ? (
          <span>
            {t('home.personal.streakProgress', {
              streak,
              need: winsNeededForBadge,
              badge: streakBadgeName,
            })}
          </span>
        ) : (
          <span>{t('home.personal.streakNew')}</span>
        )}
      </div>
    </div>
  )
}

const S = {
  card: {
    padding: '14px 15px',
    borderRadius: 'var(--radius-card, 14px)',
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
  winCount: {
    font: '600 12px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  boxesRow: {
    display: 'flex',
    gap: 7,
  },
  winBox: {
    flex: 1,
    borderRadius: 'var(--radius-sm, 8px)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--status-delivered-bg)',
    border: '1px solid var(--status-delivered-fg)',
    color: 'var(--status-delivered-fg)',
  },
  winBoxLatest: {
    flex: 1,
    borderRadius: 'var(--radius-sm, 8px)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--status-delivered-bg)',
    border: '2px solid var(--status-delivered-fg)',
    color: 'var(--status-delivered-fg)',
  },
  lossBox: {
    flex: 1,
    borderRadius: 'var(--radius-sm, 8px)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--status-incident-bg)',
    border: '1px solid var(--status-incident-fg)',
    color: 'var(--status-incident-fg)',
  },
  neutralBox: {
    flex: 1,
    borderRadius: 'var(--radius-sm, 8px)',
    display: 'grid',
    placeItems: 'center',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-muted)',
  },
  footerText: {
    font: '400 12px/1.45 var(--font-sans)',
    color: 'var(--text-muted)',
  },
}
