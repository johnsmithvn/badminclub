/**
 * Hai dòng đội thắng (vương miện) / đội thua kèm điểm trên thẻ trận mobile — tab Trận của buổi và trang
 * Trận đấu. `sides` = matchSides() của #lib/matchSearch.js. Nhiều set: số set thắng + điểm từng set.
 */
export default function MatchScoreLines({ sides }) {
  const { winnerNames, loserNames, winnerFull, loserFull, scoreSets, isMultiSet, winSetsCount, loseSetsCount } = sides
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 5, margin: '2px 0' }}>
      {/* Đội thắng */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 18,
              height: 18,
              flex: '0 0 auto',
              borderRadius: 5,
              background: 'rgba(0,178,169,.16)',
              border: '1px solid rgba(0,178,169,.42)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
            }}
          >
            👑
          </span>
          <span
            style={{
              font: "600 14px/1.25 'IBM Plex Sans', sans-serif",
              color: '#5FDBD3',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span title={winnerFull}>{winnerNames}</span>
          </span>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {isMultiSet ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ font: "700 16px/1 'IBM Plex Mono', monospace", color: '#8BEDE6' }}>{winSetsCount}</span>
              <span style={{ font: "500 11.5px/1 'IBM Plex Mono', monospace", color: '#5FDBD3', opacity: 0.85 }}>
                ({scoreSets.map((s) => s.winPts).join('-')})
              </span>
            </div>
          ) : (
            <span
              style={{
                display: 'inline-block',
                minWidth: 28,
                textAlign: 'right',
                font: "700 18px/1 'IBM Plex Mono', monospace",
                color: '#8BEDE6',
              }}
            >
              {scoreSets[0]?.winPts ?? ''}
            </span>
          )}
        </div>
      </div>

      {/* Đội thua */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, paddingLeft: 26 }}>
          <span
            style={{
              font: "500 13.5px/1.25 'IBM Plex Sans', sans-serif",
              color: '#BFCDDE',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span title={loserFull}>{loserNames}</span>
          </span>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          {isMultiSet ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ font: "700 16px/1 'IBM Plex Mono', monospace", color: '#B3C2D6' }}>{loseSetsCount}</span>
              <span style={{ font: "500 11.5px/1 'IBM Plex Mono', monospace", color: '#8494AA' }}>
                ({scoreSets.map((s) => s.losePts).join('-')})
              </span>
            </div>
          ) : (
            <span
              style={{
                display: 'inline-block',
                minWidth: 28,
                textAlign: 'right',
                font: "700 18px/1 'IBM Plex Mono', monospace",
                color: '#B3C2D6',
              }}
            >
              {scoreSets[0]?.losePts ?? ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
