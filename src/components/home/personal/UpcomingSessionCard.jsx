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
  const venueStr = session.venue || t('common.unknown')
  const goingCount = session.goingCount || 0
  const isRegistered = session.isRegistered ?? false
  const expectedMatches = session.expectedMatches || 0

  const statusText = isRegistered
    ? t('home.personal.attendeeRegistered', { n: goingCount })
    : t('home.personal.attendeeNotRegistered', { n: goingCount })

  const subtitle = isMobile
    ? statusText
    : `${statusText} · ${t('home.personal.expectedMatchesCount', { n: expectedMatches })}`

  return (
    <div style={isMobile ? S.cardMobile : S.cardDesktop}>
      <div style={S.infoCol}>
        <span style={S.overline}>{t('home.personal.upcomingTimeDefault', { time: timeStr })}</span>
        <span style={isMobile ? S.titleMobile : S.titleDesktop}>{venueStr}</span>
        <span style={S.meta}>{subtitle}</span>
      </div>

      {isMobile ? (
        <button
          type="button"
          onClick={onViewSchedule}
          style={S.btnPrimaryMobile}
        >
          {t('home.personal.viewSchedule')}
        </button>
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
    padding: '13px 14px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  cardDesktop: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 11,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  overline: {
    font: '600 10.5px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-link)',
  },
  titleMobile: {
    font: '700 15.5px/1.25 var(--font-display)',
    color: 'var(--text-primary)',
  },
  titleDesktop: {
    font: '700 18px/1.25 var(--font-display)',
    color: 'var(--text-primary)',
  },
  meta: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  emptyState: {
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  btnPrimaryMobile: {
    flex: '0 0 auto',
    font: '600 12.5px/1 var(--font-sans)',
    padding: '11px 14px',
    borderRadius: 999,
    background: 'var(--action-primary-bg)',
    color: 'var(--action-primary-fg)',
    border: 'none',
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
