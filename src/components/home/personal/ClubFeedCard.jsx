import { t } from '#i18n'

function getEventTitle(item) {
  if (item.type === 'match_finished') {
    return t('home.personal.feedMatchFinished', {
      winner: item.winnerNames,
      score: item.score,
      loser: item.loserNames,
    })
  }
  if (item.type === 'challenge') {
    return t('home.personal.feedChallengePending', {
      challengers: item.challengers,
    })
  }
  if (item.type === 'session_locked') {
    return t('home.personal.feedSessionLocked', {
      date: item.date,
      venue: item.venue,
    })
  }
  return item.title || ''
}

export default function ClubFeedCard({ events = [], isMobile, onViewAll }) {
  return (
    <div style={S.card}>
      <div style={S.headerRow}>
        <span style={S.title}>{t('home.personal.clubToday')}</span>
        {!isMobile && events.length > 0 && (
          <button type="button" onClick={onViewAll} style={S.viewAllBtn}>
            {t('home.personal.viewAll')}
          </button>
        )}
      </div>

      {!events.length ? (
        <div style={S.emptyState}>{t('home.personal.emptyActivity')}</div>
      ) : (
        <div style={S.eventsList}>
          {events.map((item) => (
            <div key={item.id} style={S.eventRow}>
              <span style={{ ...S.dot, background: item.dotColor || 'var(--status-delivered-fg)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.eventTitle}>{getEventTitle(item)}</div>
                {!isMobile && item.timeAgo && (
                  <div style={S.eventTime}>{item.timeAgo}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
  viewAllBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    font: '400 12px/1 var(--font-sans)',
    color: 'var(--text-link)',
    cursor: 'pointer',
  },
  emptyState: {
    padding: '12px 0',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  eventRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  dot: {
    width: 6,
    height: 6,
    flex: '0 0 auto',
    marginTop: 6,
    borderRadius: 999,
  },
  eventTitle: {
    font: '400 12.5px/1.45 var(--font-sans)',
    color: 'var(--text-secondary)',
  },
  eventTime: {
    font: '400 11px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
}
