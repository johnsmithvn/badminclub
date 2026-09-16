import { useMemo } from 'react'
import { t } from '#i18n'
import { isPresent } from '#lib/money.js'

export default function PlannerPlayerCol({
  players = [],
  loads = {},
  attendance = {},
  challenges = [],
  wishes = [],
  onDragPlayerStart,
}) {
  // Tính số lượng nguyện vọng + kèo của mỗi người
  const wishCounts = useMemo(() => {
    const counts = {}
    ;(players || []).forEach((p) => { counts[p.key] = 0 })

    // Đếm từ kèo đấu
    ;(challenges || []).forEach((c) => {
      ;[...(c.teamA || []), ...(c.teamB || [])].forEach((k) => {
        if (counts[k] !== undefined) counts[k]++
      })
    })

    // Đếm từ nguyện vọng
    ;(wishes || []).forEach((w) => {
      if (w.memberId && counts[w.memberId] !== undefined) counts[w.memberId]++
      if (w.targetId && counts[w.targetId] !== undefined) counts[w.targetId]++
    })

    return counts
  }, [players, challenges, wishes])

  return (
    <div style={S.colWrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTitle}>{t('planner.colPlayers')}</div>
        <div style={S.headerSub}>{t('planner.dragHint')}</div>
      </div>

      {/* Danh sách người & tải trận */}
      <div style={S.playerList}>
        {players.map((p) => {
          const loadInfo = loads[p.key] || { count: 0, loadState: 'underload' }
          const load = loadInfo.count || 0
          const isAtt = isPresent(attendance[p.key])
          const dotColor = isAtt ? '#2FCCC3' : '#54637B'
          const wishesNum = wishCounts[p.key] || 0

          // Màu thanh tiến độ và số trận
          const barColor = load >= 7 ? '#D63B2B' : load <= 3 ? '#54637B' : '#00B2A9'
          const loadInk = load >= 7 ? '#F08A7C' : load <= 3 ? '#54637B' : '#A8B7CB'
          const fillWidth = Math.min(100, Math.round((load / 8) * 100))

          return (
            <div
              key={p.key}
              draggable="true"
              onDragStart={(e) => {
                try {
                  e.dataTransfer.setData('text/plain', p.key)
                  e.dataTransfer.effectAllowed = 'move'
                } catch {
                  /* Safari fallback */
                }
                if (onDragPlayerStart) onDragPlayerStart(p.key)
              }}
              style={S.playerRow}
            >
              {/* Dot trạng thái điểm danh */}
              <span style={{ ...S.dot, background: dotColor }} />

              {/* Tên */}
              <span style={S.playerName} title={p.name}>
                {p.name}
              </span>

              {/* Badge Nguyện vọng / Kèo nếu có */}
              {wishesNum > 0 && (
                <span style={S.wishBadge}>
                  {'★' + wishesNum}
                </span>
              )}

              {/* Thanh tải trận */}
              <span style={S.barTrack}>
                <span style={{ ...S.barFill, width: `${fillWidth}%`, background: barColor }} />
              </span>

              {/* Số trận */}
              <span style={{ ...S.loadText, color: loadInk }}>
                {load}
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer chú thích */}
      <div style={S.footer}>
        <div style={S.legendRow}>
          <span style={{ ...S.dotSmall, background: '#2FCCC3' }} />
          <span>{t('planner.legendPresent')}</span>
          <span style={{ ...S.dotSmall, background: '#54637B', marginLeft: 8 }} />
          <span>{t('planner.legendUnknown')}</span>
        </div>
        <div style={S.footnote}>
          {t('planner.loadFootnote')}
        </div>
      </div>
    </div>
  )
}

const S = {
  colWrap: {
    width: 232,
    flex: '0 0 auto',
    display: 'flex',
    flexDirection: 'column',
    background: '#0E1626',
    borderRight: '1px solid #22304A',
    minHeight: 0,
    overflow: 'hidden',
  },
  header: {
    padding: '11px 13px 9px',
    borderBottom: '1px solid #22304A',
    display: 'grid',
    gap: 2,
    flex: '0 0 auto',
  },
  headerTitle: {
    font: '600 13px/1.2 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
  },
  headerSub: {
    font: '400 11.5px/1.35 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
  },
  playerList: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    minHeight: 32,
    padding: '0 7px',
    borderRadius: 6,
    cursor: 'grab',
    userSelect: 'none',
    transition: 'background 100ms ease',
  },
  dot: {
    width: 7,
    height: 7,
    flex: '0 0 auto',
    borderRadius: 999,
  },
  playerName: {
    flex: '1 1 auto',
    minWidth: 0,
    font: '600 12.5px/1.2 "IBM Plex Sans", sans-serif',
    color: '#E9EFF7',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  wishBadge: {
    font: '600 10.5px/1 "IBM Plex Sans", sans-serif',
    color: '#F0B75C',
    flex: '0 0 auto',
  },
  barTrack: {
    width: 32,
    height: 4,
    flex: '0 0 auto',
    borderRadius: 999,
    background: '#22304A',
    overflow: 'hidden',
    display: 'block',
  },
  barFill: {
    display: 'block',
    height: '100%',
    borderRadius: 999,
    transition: 'width 200ms ease',
  },
  loadText: {
    width: 14,
    flex: '0 0 auto',
    textAlign: 'right',
    font: '600 11.5px/1 "IBM Plex Mono", monospace',
  },
  footer: {
    padding: '9px 13px',
    borderTop: '1px solid #22304A',
    display: 'grid',
    gap: 4,
    font: '400 11.5px/1.35 "IBM Plex Sans", sans-serif',
    color: '#8494AA',
    flex: '0 0 auto',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  dotSmall: {
    width: 7,
    height: 7,
    borderRadius: 999,
    display: 'inline-block',
  },
  footnote: {
    color: '#8494AA',
    fontSize: 11,
  },
}
