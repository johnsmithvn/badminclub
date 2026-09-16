import { useMemo } from 'react'
import { t } from '#i18n'
import { playerName, playerOf } from '#lib/money.js'
import { Avatar } from '#ds'

export default function PlannerTimelineCol({
  db,
  rounds = [],
  players = [],
  highlightRoundIndex = null,
  onDropPlayer,
}) {
  const pMap = useMemo(() => {
    const map = {}
    ;(players || []).forEach((p) => { map[p.key || p.id] = p })
    return map
  }, [players])

  const pName = (k) => {
    if (!k) return '?'
    if (pMap[k]?.name && pMap[k].name !== k) return pMap[k].name
    if (db) {
      const resolved = playerName(db, k)
      if (resolved && resolved !== k) return resolved
      const pObj = playerOf(db, k)
      if (pObj?.name && pObj.name !== k) return pObj.name
    }
    if (typeof k === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(k)) {
      return t('planner.defaultGuestName')
    }
    return k
  }

  const pAvatar = (k) => {
    if (!k || k === '?') return ''
    if (pMap[k]?.avatarUrl) return pMap[k].avatarUrl
    if (db) {
      const pObj = playerOf(db, k)
      if (pObj?.avatarUrl) return pObj.avatarUrl
      if (pObj?.avatar_url) return pObj.avatar_url
      if (pObj?.profile?.avatar_url) return pObj.profile.avatar_url
      if (pObj?.profile?.avatarUrl) return pObj.profile.avatarUrl
    }
    return ''
  }

  return (
    <div style={S.colWrap}>
      <div style={S.scrollArea}>
        {rounds.map((r) => {
          const isHighlighted = highlightRoundIndex === r.roundIndex

          // Tìm danh sách người đang đánh ở vòng này
          const placedThisRound = new Set()
          let isShort = false
          let isChallenge = false

          ;(r.courts || []).forEach((c) => {
            if (c.challengeId) isChallenge = true
            const count = (c.teamA?.length || 0) + (c.teamB?.length || 0)
            if (count > 0 && count < 4) isShort = true
            ;(c.teamA || []).forEach((k) => placedThisRound.add(k))
            ;(c.teamB || []).forEach((k) => placedThisRound.add(k))
          })

          // Danh sách người rảnh
          const freePlayers = players.filter((p) => !placedThisRound.has(p.key || p.id))

          let badgeText = ''
          let badgeStyle = {}
          if (isChallenge) {
            badgeText = t('planner.tagChallenge')
            badgeStyle = S.badgeGold
          } else if (isShort) {
            badgeText = t('planner.tagMissing', { n: '' }).trim()
            badgeStyle = S.badgeRed
          }

          let cardBorder = '#22304A'
          if (isShort) cardBorder = 'rgba(214, 59, 43, 0.42)'
          else if (isChallenge) cardBorder = 'rgba(240, 183, 92, 0.42)'

          return (
            <div
              key={r.roundIndex}
              id={`planner-tl-${r.roundIndex}`}
              style={{
                ...S.roundCard,
                borderColor: isHighlighted ? '#F0B75C' : cardBorder,
                boxShadow: isHighlighted ? '0 0 12px rgba(240, 183, 92, 0.5)' : 'none',
              }}
            >
              {/* Cột Vòng */}
              <div style={S.roundMetaCol}>
                <span style={{ ...S.roundTitle, color: isChallenge ? '#F0B75C' : '#E9EFF7' }}>
                  {r.label}
                </span>
                <span style={S.roundTimeText}>{r.timeRange}</span>
                {badgeText && (
                  <span style={badgeStyle}>{badgeText}</span>
                )}
              </div>

              {/* Khối các sân */}
              <div style={S.courtsGrid}>
                {(r.courts || []).map((c, cIdx) => {
                  const teamA = c.teamA || []
                  const teamB = c.teamB || []
                  const total = teamA.length + teamB.length

                  return (
                    <div
                      key={cIdx}
                      style={{
                        ...S.courtBox,
                        borderColor: total > 0 && total < 4 ? 'rgba(214, 59, 43, 0.45)' : '#22304A',
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const playerKey = e.dataTransfer.getData('text/plain')
                        if (playerKey && onDropPlayer) {
                          onDropPlayer(r.roundIndex, cIdx, playerKey)
                        }
                      }}
                    >
                      <div style={S.courtHeader}>
                        <span style={S.courtName}>
                          {c.name || t('planner.courtDefault', { n: cIdx + 1 })}
                        </span>
                        {c.challengeId && (
                          <span style={S.tagCourtChal}>{t('planner.tagChallenge')}</span>
                        )}
                      </div>

                      {/* Đội A vs Đội B */}
                      <div style={S.teamsRow}>
                        <div style={S.teamChips}>
                          {teamA.length > 0 ? (
                            teamA.map((k) => (
                              <span key={k} style={S.playerChipPlay}>
                                <Avatar name={pName(k)} src={pAvatar(k)} size={16} style={{ flexShrink: 0, marginRight: 5 }} />
                                <span>{pName(k)}</span>
                              </span>
                            ))
                          ) : (
                            <span style={S.slotEmptyChip}>{t('planner.needTwo')}</span>
                          )}
                        </div>
                        <span style={S.vsSpan}>{t('planner.vs')}</span>
                        <div style={S.teamChips}>
                          {teamB.length > 0 ? (
                            teamB.map((k) => (
                              <span key={k} style={S.playerChipPlay}>
                                <Avatar name={pName(k)} src={pAvatar(k)} size={16} style={{ flexShrink: 0, marginRight: 5 }} />
                                <span>{pName(k)}</span>
                              </span>
                            ))
                          ) : (
                            <span style={S.slotEmptyChip}>{t('planner.needTwo')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Khối Đang rảnh (Free Bench) */}
              <div style={S.freeBenchCol}>
                <div style={S.benchHeader}>
                  <span style={S.benchTitle}>{t('planner.freeBench')}</span>
                  <span style={S.benchCount}>{freePlayers.length}</span>
                </div>
                <div style={S.benchChipsWrap}>
                  {freePlayers.slice(0, 10).map((p) => (
                    <span key={p.key} style={S.playerChipFree}>
                      <Avatar name={p.name} src={p.avatarUrl} size={15} style={{ flexShrink: 0, marginRight: 5 }} />
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    ...S.benchHint,
                    color: isShort ? '#F08A7C' : '#5FDBD3',
                  }}
                >
                  {isShort
                    ? t('planner.benchHintNeed', { n: 2, court: 2 })
                    : freePlayers.length >= 8
                      ? t('planner.benchHintExtraCourt')
                      : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  colWrap: {
    flex: '1 1 500px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#0B1220',
    overflow: 'hidden',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 18px 20px',
    display: 'grid',
    gap: 11,
    alignContent: 'start',
  },
  roundCard: {
    display: 'flex',
    gap: 12,
    padding: '12px 13px',
    borderRadius: 10,
    background: '#141D2E',
    borderWidth: 1,
    borderStyle: 'solid',
    transition: 'all 120ms ease',
    flexWrap: 'wrap',
  },
  roundMetaCol: {
    width: 76,
    flex: '0 0 auto',
    display: 'grid',
    gap: 2,
    alignContent: 'start',
    paddingTop: 2,
  },
  roundTitle: {
    font: '600 17px/1 Barlow, sans-serif',
  },
  roundTimeText: {
    font: '400 11px/1 "IBM Plex Mono", monospace',
    color: '#54637B',
  },
  badgeGold: {
    font: '600 9.5px/1 "IBM Plex Sans", sans-serif',
    color: '#04302C',
    background: '#F0B75C',
    padding: '3px 6px',
    borderRadius: 4,
    justifySelf: 'start',
    marginTop: 3,
  },
  badgeRed: {
    font: '600 9.5px/1 "IBM Plex Sans", sans-serif',
    color: '#fff',
    background: '#D63B2B',
    padding: '3px 6px',
    borderRadius: 4,
    justifySelf: 'start',
    marginTop: 3,
  },
  courtsGrid: {
    flex: '1 1 320px',
    minWidth: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 9,
  },
  courtBox: {
    padding: '10px 11px',
    borderRadius: 8,
    background: '#101927',
    borderWidth: 1,
    borderStyle: 'solid',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 68,
  },
  courtHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  courtName: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    flex: 1,
  },
  tagCourtChal: {
    font: '600 9.5px/1 "IBM Plex Sans", sans-serif',
    color: '#04302C',
    background: '#F0B75C',
    padding: '2px 5px',
    borderRadius: 3,
  },
  teamsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  teamChips: {
    flex: 1,
    minWidth: 0,
    display: 'grid',
    gap: 4,
  },
  vsSpan: {
    flex: '0 0 auto',
    font: '500 9.5px/1 "IBM Plex Mono", monospace',
    color: '#54637B',
    letterSpacing: '.08em',
  },
  playerChipPlay: {
    display: 'flex',
    alignItems: 'center',
    height: 24,
    padding: '0 8px',
    borderRadius: 5,
    font: '600 11.5px/1 "IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    background: 'rgba(0, 178, 169, 0.16)',
    border: '1px solid rgba(0, 178, 169, 0.4)',
    color: '#BDEFEB',
  },
  slotEmptyChip: {
    display: 'flex',
    alignItems: 'center',
    height: 24,
    padding: '0 8px',
    borderRadius: 5,
    border: '1px dashed #D63B2B',
    font: '500 11px/1 "IBM Plex Sans", sans-serif',
    color: '#F08A7C',
  },
  freeBenchCol: {
    width: 230,
    flex: '0 0 auto',
    borderLeft: '1px dashed #2E3E5C',
    paddingLeft: 12,
  },
  benchHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginBottom: 6,
  },
  benchTitle: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: '#5FDBD3',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    flex: 1,
  },
  benchCount: {
    font: '600 10.5px/1 "IBM Plex Mono", monospace',
    color: '#8494AA',
  },
  benchChipsWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  playerChipFree: {
    display: 'flex',
    alignItems: 'center',
    height: 24,
    padding: '0 7px',
    borderRadius: 5,
    font: '500 11px/1 "IBM Plex Sans", sans-serif',
    background: '#161F31',
    border: '1px solid #2A3A56',
    color: '#A8B7CB',
    whiteSpace: 'nowrap',
  },
  benchHint: {
    marginTop: 6,
    font: '500 11px/1.35 "IBM Plex Sans", sans-serif',
  },
}
