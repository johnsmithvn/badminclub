import { useState, useMemo } from 'react'
import { Avatar, Icon } from '#ds'
import { t } from '#i18n'

export default function SynergyBadgesCard({
  partners = [],
  bestPartner = null,
  underperformingPartner = null,
  badgesCount = 0,
  nextStreakBadge = 5,
  winsNeededForStreak = 3,
  isMobile,
}) {
  const [sortMode, setSortMode] = useState('synergy') // 'synergy' | 'matches'
  const [genderFilter, setGenderFilter] = useState('all') // 'all' | 'nam' | 'nu'

  const toggleSortMode = () => {
    setSortMode((prev) => (prev === 'synergy' ? 'matches' : 'synergy'))
  }

  const filteredPartners = useMemo(() => {
    let list = []
    if (partners && partners.length > 0) {
      list = [...partners]
    } else if (bestPartner) {
      list = [bestPartner]
      if (underperformingPartner) list.push(underperformingPartner)
    }

    if (sortMode === 'matches') {
      list.sort((a, b) => (b.games || 0) - (a.games || 0) || (b.synergyScore || 0) - (a.synergyScore || 0))
    } else {
      list.sort((a, b) => (b.synergyScore || 0) - (a.synergyScore || 0) || (b.games || 0) - (a.games || 0))
    }

    return list
      .filter((p) => {
        if (genderFilter === 'all') return true
        const g = p?.partner?.gender || 'nam'
        const isNu = g === 'nu' || g === 'female'
        return genderFilter === 'nu' ? isNu : !isNu
      })
      .slice(0, 4)
  }, [partners, bestPartner, underperformingPartner, sortMode, genderFilter])

  const hasPartnerData = filteredPartners.length > 0

  const sortToggleBtn = (
    <button
      type="button"
      onClick={toggleSortMode}
      style={S.sortToggleBtn}
      title={sortMode === 'synergy' ? t('home.personal.sortMatches') : t('home.personal.sortSynergy')}
    >
      <Icon
        name="repeat"
        size={11.5}
        style={{
          transform: sortMode === 'matches' ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.25s ease',
          color: 'var(--action-accent-bg)',
        }}
      />
      <span style={S.sortToggleText}>
        {sortMode === 'synergy' ? t('home.personal.sortSynergy') : t('home.personal.sortMatches')}
      </span>
    </button>
  )

  const genderToggle = (
    <div style={S.genderToggle}>
      <button
        type="button"
        onClick={() => setGenderFilter('all')}
        style={genderFilter === 'all' ? S.genderBtnActive : S.genderBtn}
      >
        {t('common.all')}
      </button>
      <button
        type="button"
        onClick={() => setGenderFilter('nam')}
        style={genderFilter === 'nam' ? S.genderBtnActive : S.genderBtn}
      >
        {t('gender.nam')}
      </button>
      <button
        type="button"
        onClick={() => setGenderFilter('nu')}
        style={genderFilter === 'nu' ? S.genderBtnActive : S.genderBtn}
      >
        {t('gender.nu')}
      </button>
    </div>
  )

  // Mobile layout: 2 card đôi
  if (isMobile) {
    const topPartner = filteredPartners[0] || bestPartner
    return (
      <div style={S.mobileRow}>
        <div style={S.mobileBox}>
          <div style={S.mobileBoxHeader}>
            <span style={S.label}>{t('home.personal.bestPartnersTitle')}</span>
            <div style={S.controlsRow}>
              {sortToggleBtn}
              {genderToggle}
            </div>
          </div>
          {topPartner ? (
            <>
              <span style={S.valBarlow}>{t('home.personal.synergyWith', { name: topPartner.name })}</span>
              <span style={S.greenMono}>
                {sortMode === 'matches'
                  ? t('home.personal.matchesSummary', {
                      total: topPartner.games,
                      impact: topPartner.pairImpact >= 0 ? `+${topPartner.pairImpact}` : topPartner.pairImpact,
                    })
                  : t('home.personal.synergySummary', {
                      w: topPartner.wins,
                      total: topPartner.games,
                      impact: topPartner.pairImpact,
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

  // Desktop layout: Thẻ "Đồng đội tốt của tôi"
  return (
    <div style={S.desktopCard}>
      <div style={S.headerRow}>
        <span style={S.label}>{t('home.personal.bestPartnersTitle')}</span>
        <div style={S.controlsRow}>
          {sortToggleBtn}
          {genderToggle}
        </div>
      </div>

      {!hasPartnerData ? (
        <div style={S.emptyState}>{t('common.empty')}</div>
      ) : (
        <div style={S.partnerList}>
          {filteredPartners.map((p, idx) => {
            const avatar =
              p?.partner?.avatarUrl ||
              p?.partner?.avatar_url ||
              p?.partner?.avatar ||
              p?.partner?.profile?.avatar_url ||
              p?.partner?.profile?.avatarUrl ||
              p?.avatarUrl ||
              ''
            const impact = p.pairImpact ?? 0
            const isPositive = impact >= 0
            const impactStr = isPositive ? `+${impact}` : `${impact}`

            return (
              <div key={p.id || idx}>
                {idx > 0 && <div style={S.divider} />}
                <div style={S.partnerRow}>
                  <Avatar name={p.name} src={avatar} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.partnerNameBold}>{p.name}</div>
                    <div style={S.partnerMeta}>
                      {sortMode === 'matches'
                        ? t('home.personal.matchesTogetherWins', { w: p.wins, impact: impactStr })
                        : t('home.personal.matchesTogether', { total: p.games, w: p.wins })}
                    </div>
                  </div>
                  {sortMode === 'matches' ? (
                    <span style={S.matchesBadge}>
                      {t('home.personal.matchesCountUnit', { n: p.games })}
                    </span>
                  ) : (
                    <span style={isPositive ? S.impactGreen : S.impactRed}>
                      {impactStr}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
  mobileBoxHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  controlsRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  sortToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    padding: '2px 7px',
    borderRadius: 7,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  sortToggleText: {
    font: '600 10.5px/1 var(--font-sans)',
    color: 'var(--text-primary)',
  },
  genderToggle: {
    display: 'inline-flex',
    padding: 2,
    borderRadius: 7,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
  },
  genderBtn: {
    background: 'none',
    border: 'none',
    padding: '2px 7px',
    borderRadius: 5,
    font: '600 10.5px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  genderBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '2px 7px',
    borderRadius: 5,
    font: '600 10.5px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
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
  partnerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  partnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },
  partnerNameBold: {
    font: '700 15px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  partnerMeta: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  matchesBadge: {
    font: '700 13.5px/1 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
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
    margin: '4px 0',
  },
}
