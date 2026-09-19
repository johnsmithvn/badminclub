import { t } from '#i18n'

export default function UpcomingSessionCard({
  session = null,
  isMobile,
  onViewSchedule,
  onViewAssignment,
  onChallenge,
}) {
  if (!session) {
    return (
      <div style={isMobile ? S.cardMobile : S.cardDesktop}>
        <div style={S.infoCol}>
          <span style={S.overline}>{t('home.personal.upcomingSession', { time: '—' })}</span>
          <span style={S.emptyState}>{t('home.noUpcoming')}</span>
        </div>
        {isMobile ? (
          <button type="button" onClick={onViewSchedule} style={S.btnPrimaryMobile}>
            {t('home.personal.viewSchedule')}
          </button>
        ) : (
          <div style={S.desktopActions}>
            <button type="button" onClick={onViewSchedule} style={S.btnPrimaryDesktop}>
              {t('home.personal.viewSchedule')}
            </button>
          </div>
        )}
      </div>
    )
  }

  const timeStr = session.time || '—'
  const venueStr = session.venue || t('home.personal.defaultVenue')
  const goingCount = session.goingCount || 0
  const isRegistered = session.isRegistered ?? false
  const expectedMatches = session.expectedMatches || 0

  const statusText = isRegistered
    ? t('home.personal.attendeeRegistered', { n: goingCount })
    : t('home.personal.attendeeNotRegistered', { n: goingCount })

  const subtitle = isMobile
    ? statusText
    : `${statusText} · ${t('home.personal.expectedMatchesCount', { n: expectedMatches })}`

  const timePart = session.time || '—'
  const overlineText = session.isToday
    ? t('home.personal.upcomingSessionToday', { time: timePart })
    : t('home.personal.upcomingSessionDate', { date: session.dateFormatted || session.date, time: timePart })

  const challenges = session.challenges || []

  return (
    <div style={isMobile ? S.cardMobile : S.cardDesktop}>
      <div style={S.infoCol}>
        <span style={S.overline}>{overlineText}</span>
        <span style={isMobile ? S.titleMobile : S.titleDesktop}>{venueStr}</span>
        <span style={S.meta}>{subtitle}</span>
      </div>

      {/* Danh sách kèo hot / Kèo của bản thân trong buổi tập */}
      {challenges.length > 0 && (
        <div style={S.challengesBox}>
          {challenges.map((c) => (
            <div key={c.id} style={c.isMine ? S.challengeRowMine : S.challengeRow}>
              <span style={c.isMine ? S.tagMine : (c.status === 'pending' ? S.tagPending : S.tagAccepted)}>
                {c.isMine
                  ? t('home.personal.myChallengeTag')
                  : (c.status === 'pending' ? t('home.personal.seekingOpponentTag') : t('home.personal.readyTag'))}
              </span>
              <div style={S.matchupCol}>
                <span style={c.isMine ? S.teamANameMine : S.teamAName}>{c.teamANames}</span>
                <span style={S.vsText}> vs </span>
                <span style={c.teamBNames ? (c.isMine ? S.teamBNameMine : S.teamBName) : S.teamBEmpty}>
                  {c.teamBNames || t('home.personal.challengeSeekingOpponent')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isMobile ? (
        <div style={S.mobileActions}>
          <button
            type="button"
            onClick={onViewAssignment}
            style={S.btnPrimaryMobile}
          >
            {t('home.personal.viewCourtAssignment')}
          </button>
          <button
            type="button"
            onClick={onChallenge}
            style={S.btnSecondaryMobile}
          >
            {t('home.personal.challengeAction')}
          </button>
        </div>
      ) : (
        <div style={S.desktopActions}>
          <button
            type="button"
            onClick={onViewAssignment}
            style={S.btnPrimaryDesktop}
          >
            {t('home.personal.viewCourtAssignment')}
          </button>
          <button
            type="button"
            onClick={onChallenge}
            style={S.btnSecondaryDesktop}
          >
            {t('home.personal.challengeAction')}
          </button>
        </div>
      )}
    </div>
  )
}

const S = {
  cardMobile: {
    padding: '14px 15px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    overflow: 'hidden',
  },
  cardDesktop: {
    padding: '18px 18px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  infoCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  overline: {
    font: '700 11px/1 var(--font-mono)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-link)',
  },
  titleMobile: {
    font: '700 16px/1.3 var(--font-display)',
    color: 'var(--text-primary)',
  },
  titleDesktop: {
    font: '700 18px/1.3 var(--font-display)',
    color: 'var(--text-primary)',
  },
  meta: {
    font: '400 12px/1.4 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  emptyState: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  challengesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
    padding: '10px 11px',
    borderRadius: 10,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-default)',
  },
  challengeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    minHeight: 24,
  },
  challengeRowMine: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12.5,
    padding: '3px 6px',
    borderRadius: 6,
    background: 'var(--status-delayed-bg)',
    minHeight: 24,
  },
  tagMine: {
    font: '700 9.5px/1 var(--font-sans)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 6,
    background: 'var(--status-delayed-bg)',
    color: 'var(--status-delayed-fg)',
    border: '1px solid var(--status-delayed-fg)',
    flex: '0 0 auto',
  },
  tagPending: {
    font: '700 9.5px/1 var(--font-sans)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 6,
    background: 'var(--status-delivered-bg)',
    color: 'var(--status-delivered-fg)',
    flex: '0 0 auto',
  },
  tagAccepted: {
    font: '700 9.5px/1 var(--font-sans)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 6,
    background: 'var(--surface-card)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-subtle)',
    flex: '0 0 auto',
  },
  matchupCol: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    font: '500 12.5px/1.35 var(--font-sans)',
  },
  teamAName: {
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  teamANameMine: {
    color: 'var(--text-primary)',
    fontWeight: 700,
  },
  vsText: {
    color: 'var(--text-muted)',
    margin: '0 4px',
    fontWeight: 400,
  },
  teamBName: {
    color: 'var(--text-secondary)',
  },
  teamBNameMine: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
  teamBEmpty: {
    color: 'var(--status-delayed-fg)',
    fontStyle: 'italic',
  },
  mobileActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnPrimaryMobile: {
    flex: 1,
    textAlign: 'center',
    font: '600 12.5px/1 var(--font-sans)',
    padding: '10px 12px',
    borderRadius: 999,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnSecondaryMobile: {
    flex: '0 0 auto',
    font: '600 12.5px/1 var(--font-sans)',
    padding: '10px 14px',
    borderRadius: 999,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  desktopActions: {
    display: 'flex',
    gap: 9,
  },
  btnPrimaryDesktop: {
    flex: 1,
    textAlign: 'center',
    font: '600 12.5px/1 var(--font-sans)',
    padding: '11px 12px',
    borderRadius: 999,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    border: 'none',
    cursor: 'pointer',
  },
  btnSecondaryDesktop: {
    flex: '0 0 auto',
    font: '600 12.5px/1 var(--font-sans)',
    padding: '11px 14px',
    borderRadius: 999,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  },
}
