import { useMemo, useState } from 'react'
import { t } from '#i18n'
import { calcCourtBalanceScore } from '#lib/planner.js'
import { playerName, playerOf } from '#lib/money.js'
import { Icon, Avatar } from '#ds'

/**
 * Slot người chơi (Pill):
 * - Nếu có người: Hiển thị Avatar + Tên + Nút gỡ, có thể kéo thả để swap / move.
 * - Nếu trống: Hiển thị ô nét đứt "+ Trống" để thả người từ ngoài hoặc từ slot khác vào.
 */
function PlayerSlotPill({
  roundIndex,
  courtIndex,
  team,
  slotIndex,
  playerKey,
  pName,
  pAvatar,
  dragOverKey,
  setDragOverKey,
  onDropPlayer,
  onSwapOrMovePlayerSlot,
  onRemovePlayer,
}) {
  const slotKey = `SLOT:${roundIndex}-${courtIndex}-${team}-${slotIndex}`
  const isOver = dragOverKey === slotKey

  if (!playerKey) {
    return (
      <div
        style={{
          ...S.emptySlotPill,
          borderColor: isOver ? '#00B2A9' : 'rgba(255, 255, 255, 0.12)',
          background: isOver ? 'rgba(0, 178, 169, 0.15)' : 'rgba(255, 255, 255, 0.02)',
          color: isOver ? '#00B2A9' : '#54637B',
        }}
        title={t('planner.dragPlayerHint')}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (dragOverKey !== slotKey) setDragOverKey(slotKey)
        }}
        onDragLeave={(e) => {
          e.stopPropagation()
          if (dragOverKey === slotKey) setDragOverKey(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOverKey(null)

          // 1. Drop từ 1 slot khác trong kế hoạch (swap hoặc move)
          try {
            const raw = e.dataTransfer.getData('application/json')
            if (raw) {
              const data = JSON.parse(raw)
              if (data && data.type === 'PLAYER_SLOT' && onSwapOrMovePlayerSlot) {
                onSwapOrMovePlayerSlot(data, { roundIndex, courtIndex, team, slotIndex })
                return
              }
            }
          } catch {}

          // 2. Drop từ sidebar player list ngoài vào
          const extKey = e.dataTransfer.getData('text/plain')
          if (extKey && onDropPlayer) {
            onDropPlayer(roundIndex, courtIndex, extKey, team, slotIndex)
          }
        }}
      >
        <span style={S.emptySlotText}>{t('planner.emptySlot')}</span>
      </div>
    )
  }

  const name = pName(playerKey)
  const avatar = pAvatar(playerKey)

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({
            type: 'PLAYER_SLOT',
            roundIndex,
            courtIndex,
            team,
            slotIndex,
            playerKey,
          })
        )
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (dragOverKey !== slotKey) setDragOverKey(slotKey)
      }}
      onDragLeave={(e) => {
        e.stopPropagation()
        if (dragOverKey === slotKey) setDragOverKey(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOverKey(null)

        try {
          const raw = e.dataTransfer.getData('application/json')
          if (raw) {
            const data = JSON.parse(raw)
            if (data && data.type === 'PLAYER_SLOT' && onSwapOrMovePlayerSlot) {
              onSwapOrMovePlayerSlot(data, { roundIndex, courtIndex, team, slotIndex })
              return
            }
          }
        } catch {}

        const extKey = e.dataTransfer.getData('text/plain')
        if (extKey && onDropPlayer) {
          onDropPlayer(roundIndex, courtIndex, extKey, team, slotIndex)
        }
      }}
      style={{
        ...S.playerSlotPill,
        borderColor: isOver ? '#00B2A9' : 'rgba(255, 255, 255, 0.1)',
        background: isOver ? 'rgba(0, 178, 169, 0.2)' : 'rgba(255, 255, 255, 0.05)',
      }}
      title={name + ' · ' + t('planner.dragPlayerHint')}
    >
      <Avatar name={name} src={avatar} size={18} style={{ flexShrink: 0 }} />
      <span style={S.slotPlayerName}>{name}</span>
      {onRemovePlayer && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemovePlayer(roundIndex, courtIndex, playerKey)
          }}
          style={S.btnRemovePlayer}
          title={t('planner.removePlayerTitle')}
        >
          <Icon name="x" size={10} color="#8494AA" />
        </button>
      )}
    </div>
  )
}

export default function PlannerGridCol({
  db,
  rounds = [],
  players = [],
  ratingsMap = {},
  highlightRoundIndex = null,
  onDropPlayer,
  onSwapOrMovePlayerSlot,
  onSwapTeam,
  onRemovePlayer,
  onMoveMatch,
  onClearCourt,
  onAddRound,
}) {
  const [dragOverKey, setDragOverKey] = useState(null)
  const [draggingMatch, setDraggingMatch] = useState(null)

  const pMap = useMemo(() => {
    const map = {}
    ;(players || []).forEach((p) => {
      map[p.key || p.id] = p
    })
    return map
  }, [players])

  const numCourts = rounds[0]?.courts?.length || 2
  const minTableWidth = Math.max(860, 60 + numCourts * 420)
  const gridTemplate = `60px repeat(${numCourts}, minmax(400px, 1fr))`

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
      <div style={{ ...S.tableScrollWrapper, minWidth: minTableWidth }}>
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
                  <span style={S.roundTime}>{r.time}</span>
                </div>

                {/* Các ô sân của vòng này */}
                {r.courts.map((c, cIdx) => {
                  const teamA = c.teamA || []
                  const teamB = c.teamB || []
                  const totalPlaced = teamA.length + teamB.length
                  const missing = 4 - totalPlaced
                  const isChallenge = !!c.challengeId || c.tag === 'CHALLENGE'
                  const isWish = !!c.wishId || c.tag === 'WISH'
                  const isBo3 = c.bestOf === 3 || c.bo3Part != null

                  // Tính điểm cân bằng
                  const bal = totalPlaced === 4 ? calcCourtBalanceScore(teamA, teamB, ratingsMap) : null
                  const balInk =
                    bal != null
                      ? bal >= 85
                        ? '#5FDBD3'
                        : bal >= 75
                        ? '#8494AA'
                        : '#F0B75C'
                      : '#54637B'

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

                  const cellKey = `MATCH:${r.roundIndex}-${cIdx}`
                  const isOverCell = dragOverKey === cellKey
                  const isThisDragging = draggingMatch === cellKey

                  return (
                    <div
                      key={cIdx}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (dragOverKey !== cellKey) setDragOverKey(cellKey)
                      }}
                      onDragLeave={() => {
                        if (dragOverKey === cellKey) setDragOverKey(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOverKey(null)
                        setDraggingMatch(null)

                        // 1. Thả cả trận đấu (MATCH)
                        try {
                          const rawJson = e.dataTransfer.getData('application/json')
                          if (rawJson) {
                            const data = JSON.parse(rawJson)
                            if (data && data.type === 'MATCH' && onMoveMatch) {
                              onMoveMatch(data.sourceRound, data.sourceCourt, r.roundIndex, cIdx)
                              return
                            }
                            if (data && data.type === 'TEAM' && onSwapTeam) {
                              // Thả team vào cả ô sân -> mặc định gán vào Đội A
                              onSwapTeam(data, { roundIndex: r.roundIndex, courtIndex: cIdx, team: 'A' })
                              return
                            }
                          }
                        } catch {}

                        // 2. Thả người chơi từ ngoài vào sân
                        const playerKey = e.dataTransfer.getData('text/plain')
                        if (playerKey && onDropPlayer) {
                          onDropPlayer(r.roundIndex, cIdx, playerKey)
                        }
                      }}
                      style={{
                        ...S.courtCell,
                        background: cellBg,
                        borderColor: isOverCell ? '#00B2A9' : cellBorder,
                        boxShadow: isOverCell ? '0 0 12px rgba(0, 178, 169, 0.5)' : 'none',
                        opacity: isThisDragging ? 0.45 : 1,
                      }}
                    >
                      {/* Khu vực trận đấu (Cố định trục giữa VS) */}
                      <div style={S.courtMatchArea}>
                        {/* Tay cầm kéo cả trận (Cấp 3: Cầm cả 4 người) */}
                        <div
                          draggable={totalPlaced > 0}
                          onDragStart={(e) => {
                            if (totalPlaced === 0) return
                            e.stopPropagation()
                            setDraggingMatch(cellKey)
                            e.dataTransfer.setData(
                              'application/json',
                              JSON.stringify({
                                type: 'MATCH',
                                sourceRound: r.roundIndex,
                                sourceCourt: cIdx,
                              })
                            )
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggingMatch(null)
                            setDragOverKey(null)
                          }}
                          style={{
                            ...S.matchDragHandle,
                            cursor: totalPlaced > 0 ? 'grab' : 'default',
                            opacity: totalPlaced > 0 ? 0.75 : 0.2,
                          }}
                          title={totalPlaced > 0 ? t('planner.dragMatchHandle') : undefined}
                        >
                          <Icon name="grip-vertical" size={13} color="#6C7F99" />
                        </div>

                        {/* Cụm Đội A */}
                        <div
                          style={S.teamBlock}
                          onDragOver={(e) => {
                            e.preventDefault()
                          }}
                          onDrop={(e) => {
                            try {
                              const raw = e.dataTransfer.getData('application/json')
                              if (raw) {
                                const data = JSON.parse(raw)
                                if (data && data.type === 'TEAM' && onSwapTeam) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onSwapTeam(data, { roundIndex: r.roundIndex, courtIndex: cIdx, team: 'A' })
                                }
                              }
                            } catch {}
                          }}
                        >
                          {/* Tay cầm kéo cả Đội A (Cấp 2: Cầm cả đôi) */}
                          <div
                            draggable={teamA.length > 0}
                            onDragStart={(e) => {
                              if (teamA.length === 0) return
                              e.stopPropagation()
                              e.dataTransfer.setData(
                                'application/json',
                                JSON.stringify({
                                  type: 'TEAM',
                                  roundIndex: r.roundIndex,
                                  courtIndex: cIdx,
                                  team: 'A',
                                })
                              )
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            style={{
                              ...S.teamDragHandle,
                              cursor: teamA.length > 0 ? 'grab' : 'default',
                              opacity: teamA.length > 0 ? 0.75 : 0.2,
                            }}
                            title={teamA.length > 0 ? t('planner.dragTeamHandle') : undefined}
                          >
                            <Icon name="users" size={11} color="#6C7F99" />
                          </div>

                          {/* 2 Slot Đội A (Cấp 1: Cầm từng người) */}
                          <div style={S.slotsRow}>
                            <PlayerSlotPill
                              roundIndex={r.roundIndex}
                              courtIndex={cIdx}
                              team="A"
                              slotIndex={0}
                              playerKey={teamA[0]}
                              pName={pName}
                              pAvatar={pAvatar}
                              dragOverKey={dragOverKey}
                              setDragOverKey={setDragOverKey}
                              onDropPlayer={onDropPlayer}
                              onSwapOrMovePlayerSlot={onSwapOrMovePlayerSlot}
                              onRemovePlayer={onRemovePlayer}
                            />
                            <PlayerSlotPill
                              roundIndex={r.roundIndex}
                              courtIndex={cIdx}
                              team="A"
                              slotIndex={1}
                              playerKey={teamA[1]}
                              pName={pName}
                              pAvatar={pAvatar}
                              dragOverKey={dragOverKey}
                              setDragOverKey={setDragOverKey}
                              onDropPlayer={onDropPlayer}
                              onSwapOrMovePlayerSlot={onSwapOrMovePlayerSlot}
                              onRemovePlayer={onRemovePlayer}
                            />
                          </div>
                        </div>

                        {/* Huy hiệu VS chính giữa tuyệt đối */}
                        <div style={S.vsBadge}>{t('planner.vs')}</div>

                        {/* Cụm Đội B */}
                        <div
                          style={S.teamBlock}
                          onDragOver={(e) => {
                            e.preventDefault()
                          }}
                          onDrop={(e) => {
                            try {
                              const raw = e.dataTransfer.getData('application/json')
                              if (raw) {
                                const data = JSON.parse(raw)
                                if (data && data.type === 'TEAM' && onSwapTeam) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onSwapTeam(data, { roundIndex: r.roundIndex, courtIndex: cIdx, team: 'B' })
                                }
                              }
                            } catch {}
                          }}
                        >
                          {/* 2 Slot Đội B (Cấp 1: Cầm từng người) */}
                          <div style={S.slotsRow}>
                            <PlayerSlotPill
                              roundIndex={r.roundIndex}
                              courtIndex={cIdx}
                              team="B"
                              slotIndex={0}
                              playerKey={teamB[0]}
                              pName={pName}
                              pAvatar={pAvatar}
                              dragOverKey={dragOverKey}
                              setDragOverKey={setDragOverKey}
                              onDropPlayer={onDropPlayer}
                              onSwapOrMovePlayerSlot={onSwapOrMovePlayerSlot}
                              onRemovePlayer={onRemovePlayer}
                            />
                            <PlayerSlotPill
                              roundIndex={r.roundIndex}
                              courtIndex={cIdx}
                              team="B"
                              slotIndex={1}
                              playerKey={teamB[1]}
                              pName={pName}
                              pAvatar={pAvatar}
                              dragOverKey={dragOverKey}
                              setDragOverKey={setDragOverKey}
                              onDropPlayer={onDropPlayer}
                              onSwapOrMovePlayerSlot={onSwapOrMovePlayerSlot}
                              onRemovePlayer={onRemovePlayer}
                            />
                          </div>

                          {/* Tay cầm kéo cả Đội B (Cấp 2: Cầm cả đôi) */}
                          <div
                            draggable={teamB.length > 0}
                            onDragStart={(e) => {
                              if (teamB.length === 0) return
                              e.stopPropagation()
                              e.dataTransfer.setData(
                                'application/json',
                                JSON.stringify({
                                  type: 'TEAM',
                                  roundIndex: r.roundIndex,
                                  courtIndex: cIdx,
                                  team: 'B',
                                })
                              )
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            style={{
                              ...S.teamDragHandle,
                              cursor: teamB.length > 0 ? 'grab' : 'default',
                              opacity: teamB.length > 0 ? 0.75 : 0.2,
                            }}
                            title={teamB.length > 0 ? t('planner.dragTeamHandle') : undefined}
                          >
                            <Icon name="users" size={11} color="#6C7F99" />
                          </div>
                        </div>
                      </div>

                      {/* Khu vực Meta bên phải (Cố định độ rộng minWidth để không làm lệch trục giữa) */}
                      <div style={S.courtMeta}>
                        {isChallenge && (
                          <span style={S.tagChallenge}>
                            {isBo3
                              ? c.bo3Part === 2
                                ? t('planner.tagChallengeBo3Part2')
                                : t('planner.tagChallengeBo3Part1')
                              : t('planner.tagChallenge')}
                          </span>
                        )}
                        {isWish && (
                          <span style={S.tagWish}>{t('planner.tagWish')}</span>
                        )}
                        {missing > 0 && totalPlaced > 0 && (
                          <span style={S.tagMissing}>
                            {t('planner.tagMissing', { n: missing })}
                          </span>
                        )}
                        <span style={{ ...S.balText, color: balInk }}>
                          {bal != null ? bal : '—'}
                        </span>

                        {/* Nút xoá ô trận */}
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
                            <Icon name="x" size={13} color="#8494AA" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Nút Thêm vòng */}
          {onAddRound && (
            <button type="button" onClick={onAddRound} style={S.btnAddRound}>
              <Icon name="plus" size={14} color="#8494AA" />
              <span>{t('planner.addRound', { n: rounds.length + 1 })}</span>
            </button>
          )}
        </div>
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
  tableScrollWrapper: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflowX: 'auto',
    overflowY: 'hidden',
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
    font: '600 11px/1 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    alignSelf: 'center',
    paddingLeft: 4,
  },
  gridScrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
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
    gap: 8,
    minHeight: 52,
    padding: '4px 10px',
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
    transition: 'all 120ms ease',
    userSelect: 'none',
  },
  courtMatchArea: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  matchDragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 28,
    padding: 0,
    background: 'none',
    border: 'none',
    userSelect: 'none',
    flexShrink: 0,
    transition: 'opacity 120ms ease',
  },
  teamBlock: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  teamDragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 26,
    padding: 0,
    background: 'none',
    border: 'none',
    userSelect: 'none',
    flexShrink: 0,
    transition: 'opacity 120ms ease',
  },
  slotsRow: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  playerSlotPill: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 28,
    padding: '0 6px',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'solid',
    cursor: 'grab',
    userSelect: 'none',
    overflow: 'hidden',
    transition: 'all 120ms ease',
  },
  emptySlotPill: {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    padding: '0 4px',
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    userSelect: 'none',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  },
  emptySlotText: {
    font: '500 11px/1 "IBM Plex Sans", sans-serif',
    whiteSpace: 'nowrap',
  },
  slotPlayerName: {
    flex: '1 1 0',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    font: '600 12px/1.2 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  btnRemovePlayer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    borderRadius: 3,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    opacity: 0.6,
    transition: 'opacity 120ms ease',
  },
  vsBadge: {
    flex: '0 0 32px',
    font: '600 10px/1 "IBM Plex Mono", monospace',
    color: '#8494AA',
    background: 'rgba(255, 255, 255, 0.06)',
    padding: '4px 0',
    borderRadius: 4,
    letterSpacing: '.05em',
    textAlign: 'center',
    userSelect: 'none',
  },
  courtMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    flex: '0 0 auto',
    minWidth: 145,
  },
  tagChallenge: {
    color: '#04302C',
    background: '#F0B75C',
    padding: '3px 6px',
    borderRadius: 4,
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '.03em',
    whiteSpace: 'nowrap',
  },
  tagWish: {
    color: '#FFFFFF',
    background: '#8B5CF6',
    padding: '3px 6px',
    borderRadius: 4,
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '.03em',
    whiteSpace: 'nowrap',
  },
  tagMissing: {
    color: '#fff',
    background: '#D63B2B',
    padding: '3px 6px',
    borderRadius: 4,
    font: '600 10px/1 "IBM Plex Sans", sans-serif',
    letterSpacing: '.03em',
    whiteSpace: 'nowrap',
  },
  balText: {
    font: '600 11px/1 "IBM Plex Mono", monospace',
    minWidth: 18,
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
    flexShrink: 0,
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
