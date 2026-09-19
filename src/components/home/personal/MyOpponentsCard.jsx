import { useState, useMemo } from 'react'
import { Avatar } from '#ds'
import { t } from '#i18n'

export default function MyOpponentsCard({
  opponents = [],
  nemeses = [],
  favoriteOpponents = [],
  nemesis = null,
  favoriteOpponent = null,
  isMobile = false,
}) {
  const [genderFilter, setGenderFilter] = useState('all') // 'all' | 'nam' | 'nu'

  const filteredOpponents = useMemo(() => {
    let nSource = nemeses?.length ? nemeses : (nemesis ? [nemesis] : [])
    let fSource = favoriteOpponents?.length ? favoriteOpponents : (favoriteOpponent ? [favoriteOpponent] : [])

    if (!nSource.length && !fSource.length && opponents?.length) {
      nSource = opponents.filter((x) => (x.matchupImpact ?? 0) < 0)
      fSource = opponents.filter((x) => (x.matchupImpact ?? 0) >= 0)
    }

    const filterByGender = (list) =>
      list.filter((opp) => {
        if (genderFilter === 'all') return true
        const g = opp?.opponent?.gender || 'nam'
        const isNu = g === 'nu' || g === 'female'
        return genderFilter === 'nu' ? isNu : !isNu
      })

    const nList = filterByGender(nSource)
    const fList = filterByGender(fSource)

    // Lấy tối đa 2 Khắc tinh và 2 Đối thủ ưa thích (tối đa 4 người)
    // Nếu một bên không đủ 2 thì bên kia bù vào cho đủ 4
    let nTake = Math.min(nList.length, 2)
    let fTake = Math.min(fList.length, 2)
    if (nTake + fTake < 4) {
      if (nList.length > nTake) nTake = Math.min(nList.length, 4 - fTake)
      if (fList.length > fTake) fTake = Math.min(fList.length, 4 - nTake)
    }
    return [...nList.slice(0, nTake), ...fList.slice(0, fTake)]
  }, [opponents, nemeses, favoriteOpponents, nemesis, favoriteOpponent, genderFilter])

  const getOpponentAvatar = (opp) => {
    const m = opp?.opponent
    return (
      m?.avatarUrl ||
      m?.avatar_url ||
      m?.avatar ||
      m?.profile?.avatar_url ||
      m?.profile?.avatarUrl ||
      ''
    )
  }

  const genderToggle = (
    <div style={S.genderToggle}>
      <button
        type="button"
        onClick={() => setGenderFilter('all')}
        style={genderFilter === 'all' ? S.genderBtnActive : S.genderBtn}
      >
        {t('gender.all')}
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

  return (
    <div style={isMobile ? S.cardMobile : S.cardDesktop}>
      <div style={S.headerRow}>
        <span style={S.label}>{t('home.personal.myOpponentsTitle')}</span>
        {genderToggle}
      </div>

      {!filteredOpponents.length ? (
        <div style={S.emptyState}>{t('home.personal.emptyOpponents')}</div>
      ) : (
        <div style={S.list}>
          {filteredOpponents.map((opp, idx) => {
            const isNemesis = (opp.matchupImpact ?? 0) < 0
            const impact = opp.matchupImpact ?? 0

            return (
              <div key={opp.opponent?.id || idx}>
                {idx > 0 && <div style={S.divider} />}
                <div style={S.opponentRow}>
                  <Avatar
                    name={opp.oppName}
                    src={getOpponentAvatar(opp)}
                    size={36}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.nameRow}>
                      <span style={S.nameBold}>{opp.oppName}</span>
                      <span style={isNemesis ? S.tagRed : S.tagGreen}>
                        {isNemesis
                          ? t('home.personal.nemesisLabel')
                          : t('home.personal.favoriteOpponentLabel')}
                      </span>
                    </div>
                    <div style={S.meta}>
                      <span style={S.numBold}>{opp.gamesCount}</span>{' '}
                      <span style={S.metaDim}>{t('home.personal.matchesAgainstUnit')}</span>
                      <span style={S.dotSep}>·</span>
                      <span style={S.metaDim}>{t('home.personal.winPrefix')}</span>{' '}
                      <span style={S.numBold}>{opp.winsCount}</span>{' '}
                      <span style={S.metaDim}>(</span>
                      <span style={S.numBold}>{opp.actualWinPct}%</span>
                      <span style={S.metaDim}>)</span>
                    </div>
                  </div>
                  <span style={isNemesis ? S.impactRed : S.impactGreen}>
                    {opp.matchupImpact != null
                      ? (impact > 0 ? `+${impact}` : `${impact}`)
                      : `${opp.actualWinPct}%`}
                  </span>
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
  cardDesktop: {
    padding: '16px 17px',
    borderRadius: 14,
    background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
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
    flexWrap: 'wrap',
    gap: 8,
  },
  genderToggle: {
    display: 'inline-flex',
    padding: 2,
    borderRadius: 7,
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    gap: 2,
    flexShrink: 0,
  },
  genderBtn: {
    background: 'none',
    border: 'none',
    padding: '2px 6px',
    borderRadius: 5,
    font: '600 10.5px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  },
  genderBtnActive: {
    background: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    padding: '2px 6px',
    borderRadius: 5,
    font: '600 10.5px/1 var(--font-sans)',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)',
    cursor: 'default',
    whiteSpace: 'nowrap',
  },
  label: {
    font: '600 11px/1.1 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
  },
  opponentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  nameBold: {
    font: '700 15px/1.2 var(--font-display)',
    color: 'var(--text-primary)',
  },
  tagRed: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 999,
    background: 'var(--status-incident-bg)',
    color: 'var(--status-incident-fg)',
  },
  tagGreen: {
    font: '600 10px/1 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '3px 6px',
    borderRadius: 999,
    background: 'var(--status-delivered-bg)',
    color: 'var(--status-delivered-fg)',
  },
  meta: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  numBold: {
    font: '700 12px/1.35 var(--font-mono)',
    color: 'var(--text-primary)',
  },
  metaDim: {
    font: '400 11.5px/1.35 var(--font-mono)',
    color: 'var(--text-muted)',
  },
  dotSep: {
    color: 'var(--text-muted)',
    opacity: 0.5,
    margin: '0 3px',
  },
  impactRed: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--status-incident-fg)',
  },
  impactGreen: {
    font: '700 15px/1 var(--font-mono)',
    color: 'var(--status-delivered-fg)',
  },
  divider: {
    height: 1,
    background: 'var(--border-subtle)',
    margin: '4px 0',
  },
  emptyState: {
    padding: '12px 0',
    font: '400 13px/1.4 var(--font-sans)',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
}
