import { useMemo, useState } from 'react'
import { t } from '#i18n'
import { calcCourtBalanceScore } from '#lib/planner.js'
import { playerName, playerOf } from '#lib/money.js'
import { Icon, Avatar } from '#ds'

export default function PlannerGridCol({
  db,
  rounds = [],
  players = [],
  ratingsMap = {},
  highlightRoundIndex = null,
  onDropPlayer,
  onRemovePlayer,
  onClearCourt,
  onAddRound,
}) {
  const [dragOverCell, setDragOverCell] = useState(null)

  const pMap = useMemo(() => {
    const map = {}
    ;(players || []).forEach((p) => { map[p.key || p.id] = p })
    return map
  }, [players])

  const numCourts = rounds[0]?.courts?.length || 2
  const gridTemplate = `52px repeat(${numCourts}, 1fr)`

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
      {/* Header dòng tiêu đề: Vòng · Sân 1 · Sân 2 */}
      <div style={{ ...S.headerGrid, gridTemplateColumns: gridTemplate }}>
        <div style={S.headerColRound}>{t('planner.roundCol')}</div>
        {Array.from({ length: numCourts }, (_, i) => (
          <div key={i} style={S.headerColCourt}>
            {rounds[0]?.courts?.[i]?.name || t('planner.courtDefault', { n: i + 1 })}
          </div>
        ))}
      </div>

      {/* Lưới các vòng đấu */}
      <div style={S.gridScrollArea}>
        {rounds.map((r) => {
          const isHighlighted = highlightRoundIndex === r.roundIndex
          const hasChallengeInRound = r.courts.some((c) => c.challengeId)
          const roundInk = hasChallengeInRound ? '#F0B75C' : '#A8B7CB'

          return (
            <div
              key={r.roundIndex}
              id={`planner-round-${r.roundIndex}`}
              style={{
                ...S.roundRow,
                gridTemplateColumns: gridTemplate,
                ...(isHighlighted ? S.roundRowHighlight : {}),
              }}
            >
              {/* Cột Vòng: R1, 19:00 */}
              <div style={S.roundTimeCell}>
                <span style={{ ...S.roundLabel, color: roundInk }}>
                  {r.label}
                </span>
                <span style={S.roundTime}>
                  {r.time}
                </span>
              </div>

              {/* Các ô sân của vòng này */}
              {r.courts.map((c, cIdx) => {
                const teamA = c.teamA || []
                const teamB = c.teamB || []
                const totalPlaced = teamA.length + teamB.length
                const missing = 4 - totalPlaced
                const isChallenge = !!c.challengeId || c.tag === 'CHALLENGE'
                const isWish = !!c.wishId || c.tag === 'WISH'

                // Tính điểm cân bằng
                const bal = totalPlaced === 4 ? calcCourtBalanceScore(teamA, teamB, ratingsMap) : null
                const balInk = bal != null
                  ? (bal >= 85 ? '#5FDBD3' : bal >= 75 ? '#8494AA' : '#F0B75C')
                  : '#54637B'

                // Hiển thị tên đội A và B
                let textA = ''
                if (teamA.length === 2) textA = `${pName(teamA[0])} + ${pName(teamA[1])}`
                else if (teamA.length === 1) textA = `${pName(teamA[0])} + ?`
                else textA = totalPlaced === 0 ? t('planner.emptyCourt') : t('planner.needTwo')

                let textB = ''
                if (teamB.length === 2) textB = `${pName(teamB[0])} + ${pName(teamB[1])}`
                else if (teamB.length === 1) textB = `${pName(teamB[0])} + ?`
                else textB = missing >= 2 ? t('planner.needTwo') : t('planner.needOne')

                // Style theo trạng thái
                let cellBg = '#141D2E'
                let cellBorder = '#22304A'
                if (missing > 0 && totalPlaced > 0) {
                  cellBg = 'rgba(214, 59, 43, 0.08)'
                  cellBorder = 'rgba(214, 59, 43, 0.45)'
                } else if (isChallenge) {
                  cellBg = 'rgba(240, 183, 92, 0.12)'
                  cellBorder = 'rgba(240, 183, 92, 0.65)'
                } else if (isWish) {
                  cellBg = 'rgba(139, 92, 246, 0.12)'
                  cellBorder = 'rgba(139, 92, 246, 0.65)'
                }

                const cellKey = `${r.roundIndex}-${cIdx}`
                const isOver = dragOverCell === cellKey

                return (
                  <div
                    key={cIdx}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (dragOverCell !== cellKey) setDragOverCell(cellKey)
                    }}
                    onDragLeave={() => {
                      if (dragOverCell === cellKey) setDragOverCell(null)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverCell(null)
                      const playerKey = e.dataTransfer.getData('text/plain')
                      if (playerKey && onDropPlayer) {
                        onDropPlayer(r.roundIndex, cIdx, playerKey)
                      }
                    }}
                    style={{
                      ...S.courtCell,
                      background: cellBg,
                      borderColor: isOver ? '#00B2A9' : cellBorder,
                      boxShadow: isOver ? '0 0 10px rgba(0, 178, 169, 0.4)' : 'none',
                    }}
                  >
                    {/* Cặp đấu A vs B */}
                    <span style={S.matchContent}>
                      <span
                        style={{
                          ...S.teamName,
                          color: teamA.length === 0 ? '#54637B' : '#E9EFF7',
                        }}
                        title={textA}
                      >
                        {teamA.length === 0 ? (
                          totalPlaced === 0 ? t('planner.emptyCourt') : t('planner.needTwo')
                        ) : (
                          <span style={S.playerTeamWrap}>
                            {teamA.map((k, idx) => (
                              <span key={k + idx} style={S.playerInlineItem}>
                                <Avatar name={pName(k)} src={pAvatar(k)} size={18} style={{ flexShrink: 0 }} />
                                <span>{pName(k)}</span>
                                {idx < teamA.length - 1 && <span style={S.plusSign}>+</span>}
                              </span>
                            ))}
                            {teamA.length === 1 && <span style={S.slotPending}>+ ?</span>}
                          </span>
                        )}
                      </span>
                      <span style={S.vsText}>{t('planner.vs')}</span>
                      <span
                        style={{
                          ...S.teamName,
                          color: teamB.length === 0 || missing > 0 ? '#F08A7C' : '#E9EFF7',
                        }}
                        title={textB}
                      >
                        {teamB.length === 0 ? (
                          missing >= 2 ? t('planner.needTwo') : t('planner.needOne')
                        ) : (
                          <span style={S.playerTeamWrap}>
                            {teamB.map((k, idx) => (
                              <span key={k + idx} style={S.playerInlineItem}>
                                <Avatar name={pName(k)} src={pAvatar(k)} size={18} style={{ flexShrink: 0 }} />
                                <span>{pName(k)}</span>
                                {idx < teamB.length - 1 && <span style={S.plusSign}>+</span>}
                              </span>
                            ))}
                            {teamB.length === 1 && <span style={S.slotPending}>+ ?</span>}
                          </span>
                        )}
                      </span>
                    </span>

                    {/* Tag trạng thái + Điểm cân bằng */}
                    <span style={S.courtMeta}>
                      {isChallenge && (
                        <span style={S.tagChallenge}>
                          {t('planner.tagChallenge')}
                        </span>
                      )}
                      {isWish && (
                        <span style={S.tagWish}>
                          {t('planner.tagWish')}
                        </span>
                      )}
                      {missing > 0 && totalPlaced > 0 && (
                        <span style={S.tagMissing}>
                          {t('planner.tagMissing', { n: missing })}
                        </span>
                      )}
                      <span style={{ ...S.balText, color: balInk }}>
                        {bal != null ? bal : '—'}
                      </span>

                      {/* Nút xoá ô trận nếu đã có người */}
                      {totalPlaced > 0 && onClearCourt && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onClearCourt(r.roundIndex, cIdx)
                          }}
                          style={S.btnClear}
                          title={t('planner.clearCourtTitle')}
                        >
                          <Icon name="x" size={12} color="#8494AA" />
                        </button>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Nút Thêm vòng */}
        {onAddRound && (
          <button
            type="button"
            onClick={onAddRound}
            style={S.btnAddRound}
          >
            <Icon name="plus" size={14} color="#8494AA" />
            <span>{t('planner.addRound', { n: rounds.length + 1 })}</span>
          </button>
        )}
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
  headerGrid: {
    flex: '0 0 auto',
    display: 'grid',
    gap: 8,
    padding: '10px 16px 7px',
    background: '#0B1220',
    borderBottom: '1px solid #1A2437',
  },
  headerColRound: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: '#54637B',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    alignSelf: 'center',
    textAlign: 'center',
  },
  headerColCourt: {
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    letterSpacing: '.1em',
    textTransform: 'uppercase',
    alignSelf: 'center',
  },
  gridScrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 16px 16px',
  },
  roundRow: {
    display: 'grid',
    gap: 8,
    marginBottom: 7,
    transition: 'background 120ms ease, box-shadow 120ms ease',
    borderRadius: 8,
    padding: '2px 0',
  },
  roundRowHighlight: {
    background: 'rgba(240, 183, 92, 0.08)',
    boxShadow: '0 0 12px rgba(240, 183, 92, 0.4)',
  },
  roundTimeCell: {
    display: 'grid',
    gap: 2,
    alignContent: 'center',
    justifyItems: 'center',
  },
  roundLabel: {
    font: '600 13px/1 "IBM Plex Mono", monospace',
  },
  roundTime: {
    font: '400 10px/1 "IBM Plex Mono", monospace',
    color: '#54637B',
  },
  courtCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 40,
    padding: '0 12px',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    transition: 'all 120ms ease',
  },
  matchContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flex: 1,
  },
  teamName: {
    font: '600 12.5px/1.3 "IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: '1 1 0',
  },
  playerTeamWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  playerInlineItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  },
  plusSign: {
    color: '#54637B',
    margin: '0 2px',
    fontWeight: 500,
  },
  slotPending: {
    color: '#8494AA',
    marginLeft: 2,
    fontWeight: 500,
  },
  vsText: {
    flex: '0 0 auto',
    font: '500 9.5px/1 "IBM Plex Mono", monospace',
    color: '#54637B',
    letterSpacing: '.08em',
  },
  courtMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    flex: '0 0 auto',
  },
  tagChallenge: {
    color: '#04302C',
    background: '#F0B75C',
    padding: '3px 7px',
    borderRadius: 4,
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '.05em',
  },
  tagWish: {
    color: '#FFFFFF',
    background: '#8B5CF6',
    padding: '3px 7px',
    borderRadius: 4,
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '.05em',
  },
  tagMissing: {
    color: '#fff',
    background: '#D63B2B',
    padding: '3px 7px',
    borderRadius: 4,
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '.05em',
  },
  balText: {
    font: '600 11px/1 "IBM Plex Mono", monospace',
    minWidth: 16,
    textAlign: 'right',
  },
  btnClear: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 4,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  btnAddRound: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    marginTop: 4,
    borderRadius: 8,
    border: '1px dashed #2E3E5C',
    background: 'transparent',
    font: '600 12px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
}
