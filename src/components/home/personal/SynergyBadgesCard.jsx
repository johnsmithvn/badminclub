import { t } from '#i18n'

export default function SynergyBadgesCard({
  bestPartner = null,
  underperformingPartner = null,
  badgesCount = 0,
  nextStreakBadge = 5,
  winsNeededForStreak = 3,
  isMobile,
}) {
  const hasPartnerData = Boolean(bestPartner)

  // Mobile layout: 2 card đôi
  if (isMobile) {
    return (
      <div style={S.mobileRow}>
        <div style={S.mobileBox}>
          <span style={S.label}>{t('home.personal.synergyPartner')}</span>
          {hasPartnerData ? (
            <>
              <span style={S.valBarlow}>{t('home.personal.synergyWith', { name: bestPartner.name })}</span>
              <span style={S.greenMono}>
                {t('home.personal.synergySummary', {
                  w: bestPartner.wins,
                  total: bestPartner.games,
                  impact: bestPartner.pairImpact,
                })}
              </span>
            </>
          ) : (
            <span style={S.emptyHint}>{t('common.empty')}</span>
          )}
        </div>

        <div style={S.mobileBox}>
          <span style={S.label}>{t('home.personal.badgesTitle')}</span>
          <span style={S.valBarlow}>{t('home.personal.badgesUnit', { n: badgesCount })}</span>
          <span style={S.goldMono}>
            {t('home.personal.badgeProgress', {
              need: winsNeededForStreak,
              n: nextStreakBadge,
            })}
          </span>
        </div>
      </div>
    )
  }

  // Desktop layout: Thẻ "Người hợp với tôi"
  return (
    <div style={S.desktopCard}>
      <span style={S.label}>{t('home.personal.bestPartnersTitle')}</span>

      {!hasPartnerData ? (
        <div style={S.emptyState}>{t('common.empty')}</div>
      ) : (
        <>
          <div style={S.partnerRow}>
            <span style={S.avatarGreen}>
              {bestPartner.name.charAt(0).toUpperCase()}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.partnerNameBold}>{bestPartner.name}</div>
              <div style={S.partnerMeta}>
                {t('home.personal.matchesTogether', { total: bestPartner.games, w: bestPartner.wins })}
              </div>
            </div>
            <span style={S.impactGreen}>{bestPartner.pairImpact}</span>
          </div>

          {underperformingPartner && (
            <>
              <div style={S.divider} />
              <div style={S.partnerRow}>
                <span style={S.avatarBlue}>
                  {underperformingPartner.name.charAt(0).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.partnerName}>{underperformingPartner.name}</div>
                  <div style={S.partnerMeta}>
                    {t('home.personal.matchesTogether', {
                      total: underperformingPartner.games,
                      w: underperformingPartner.wins,
                    })}
                  </div>
                </div>
                <span style={S.impactRed}>{underperformingPartner.pairImpact}</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const S = {
  mobileRow: {
    display: 'flex',
    gap: 11,
  },
  mobileBox: {
    flex: 1,
    minWidth: 0,
    padding: '12px 13px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  label: {
    font: '600 10.5px/1 var(--font-sans)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
  },
  valBarlow: {
    font: '700 15px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  greenMono: {
    font: '400 11.5px/1.4 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  goldMono: {
    font: '400 11.5px/1.4 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
  },
  emptyHint: {
    font: '400 12px/1.3 var(--font-sans)',
    color: 'var(--text-muted)',
  },
  desktopCard: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  emptyState: {
    padding: '12px 0',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  partnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },
  avatarGreen: {
    width: 36,
    height: 36,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'var(--status-delivered-bg)',
    border: '1px solid var(--status-delivered-fg)',
    display: 'grid',
    placeItems: 'center',
    font: '700 13px/1 var(--font-display)',
    color: 'var(--status-delivered-fg)',
  },
  avatarBlue: {
    width: 36,
    height: 36,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'var(--status-scheduled-bg)',
    border: '1px solid var(--status-scheduled-fg)',
    display: 'grid',
    placeItems: 'center',
    font: '700 13px/1 var(--font-display)',
    color: 'var(--status-scheduled-fg)',
  },
  partnerNameBold: {
    font: '700 15px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  partnerName: {
    font: '600 15px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  partnerMeta: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  impactGreen: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  impactRed: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  divider: {
    height: 1,
    background: 'var(--border-subtle)',
  },
}
