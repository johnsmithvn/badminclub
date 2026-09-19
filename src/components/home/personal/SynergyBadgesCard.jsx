import { useState, useMemo } from 'react'
import { Avatar, Icon } from '#ds'
import { t } from '#i18n'
import { isFemalePlayer } from '#lib/rating.js'

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
        const isNu = isFemalePlayer(p?.partner)
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
        size={12}
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
        {t('home.personal.allShort')}
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

  // Layout đồng bộ Mobile & Desktop: Hiển thị tối đa 4 người mỗi tab, header wrap chống tràn
  return (
    <div style={isMobile ? S.cardMobile : S.desktopCard}>
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
                      {sortMode === 'matches' ? (
                        <>
                          <span style={S.metaSegment}>
                            <span style={S.metaDim}>{t('home.personal.winPrefix')}</span>
                            <span style={S.numBold}>{p.wins}</span>
                          </span>
                          <span style={S.dotSep}>·</span>
                          <span style={S.metaSegment}>
                            <span style={isPositive ? S.impactInlineGreen : S.impactInlineRed}>
                              {impactStr}
                            </span>
                            <span style={S.metaDim}>{t('home.personal.synergySuffix')}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span style={S.metaSegment}>
                            <span style={S.numBold}>{p.games}</span>
                            <span style={S.metaDim}>{t('home.personal.matchesTogetherUnit')}</span>
                          </span>
                          <span style={S.dotSep}>·</span>
                          <span style={S.metaSegment}>
                            <span style={S.metaDim}>{t('home.personal.winPrefix')}</span>
                            <span style={S.numBold}>{p.wins}</span>
                          </span>
                        </>
                      )}
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
  cardMobile: {
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
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'nowrap',
  },
  controlsRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  sortToggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    padding: '3px 7px',
    borderRadius: 999,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    minHeight: 26,
    transition: 'all 0.15s ease',
  },
  sortToggleText: {
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  },
  genderToggle: {
    display: 'inline-flex',
    padding: 2,
    borderRadius: 999,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 1.5,
    flexShrink: 0,
  },
  genderBtn: {
    background: 'none',
    border: 'none',
    padding: '3px 7px',
    borderRadius: 999,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  genderBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '3px 7px',
    borderRadius: 999,
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
    whiteSpace: 'nowrap',
    minHeight: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    font: '600 11px/1.1 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
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
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '3px 4px',
  },
  metaSegment: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3.5,
  },
  numBold: {
    font: '700 12px/1.35 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  metaDim: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  impactInlineGreen: {
    font: '700 12px/1.35 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  impactInlineRed: {
    font: '700 12px/1.35 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  dotSep: {
    color: 'var(--text-muted)',
    opacity: 0.5,
    margin: '0 4px',
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
