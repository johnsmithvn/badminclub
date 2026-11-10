import { useState } from 'react'
import { t } from '#i18n'

/**
 * Bàn Caro vẽ bằng SVG — một phần tử, co theo bề ngang, màu theo token (tự đổi sáng / tối).
 * Chỉ vẽ + bắt bấm; luật nằm ở lib/games/caro.js, đi nước qua `onMove` của khung phòng.
 * Quân vừa đặt hiện dần, đường thắng vẽ dần (effects.css: gamePop / gameDraw); chuột rê trên bàn
 * thì hiện mờ quân của mình ở ô đó (chỉ máy có chuột, chỉ khi tới lượt).
 *
 * Props chung của mọi màn chơi (components/games/screens.js):
 *   state, mySeat (null = người xem), canMove (đúng lượt mình, ván đang chơi), onMove(move)
 */
const CELL = 32
const X_INK = 'var(--status-incident-fg)'
const O_INK = 'var(--status-scheduled-fg)'

/** Điểm sao cho dễ định vị trên bàn lớn: góc cách mép 3 ô + tâm (+ giữa các cạnh từ 19 ô). */
function stars(size) {
  if (size < 13) return []
  const a = 3, b = size - 4, m = (size - 1) / 2
  const pts = [[a, a], [a, b], [b, a], [b, b], [m, m]]
  if (size >= 19) pts.push([a, m], [m, a], [b, m], [m, b])
  return pts.filter(([r, c]) => Number.isInteger(r) && Number.isInteger(c))
}

function Mark({ seat, x, y, ghost, pop }) {
  const d = CELL * 0.27
  const style = pop ? { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' } : undefined
  return seat === 0
    ? (
      <g stroke={X_INK} strokeWidth={3.4} strokeLinecap="round" opacity={ghost ? 0.3 : 1} style={style}>
        <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} />
        <line x1={x + d} y1={y - d} x2={x - d} y2={y + d} />
      </g>
    )
    : <circle cx={x} cy={y} r={d * 1.12} fill="none" stroke={O_INK} strokeWidth={3.4} opacity={ghost ? 0.3 : 1} style={style} />
}

export default function CaroBoard({ state, mySeat, canMove, onMove }) {
  const { size, board, last, line } = state
  const [hover, setHover] = useState(null)
  const pad = CELL / 2
  const span = size * CELL
  const win = new Set(line || [])
  const center = (i) => [(i % size) * CELL + pad, Math.floor(i / size) * CELL + pad]

  const cellAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const c = Math.floor(((e.clientX - box.left) / box.width) * size)
    const r = Math.floor(((e.clientY - box.top) / box.height) * size)
    return r < 0 || c < 0 || r >= size || c >= size ? null : r * size + c
  }
  const pick = (e) => {
    if (!canMove) return
    const i = cellAt(e)
    if (i != null && board[i] == null) { setHover(null); onMove({ i }) }
  }
  const move = (e) => { if (canMove && e.pointerType === 'mouse') setHover(cellAt(e)) }

  const [wx1, wy1] = line?.length ? center(line[0]) : [0, 0]
  const [wx2, wy2] = line?.length ? center(line[line.length - 1]) : [0, 0]
  const wlen = Math.ceil(Math.hypot(wx2 - wx1, wy2 - wy1)) + 1

  return (
    <svg
      data-game-fx
      viewBox={`0 0 ${span} ${span}`}
      onClick={pick}
      onPointerMove={move}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={t('games.caro.boardAria', { n: size })}
      style={{
        // Nét vẽ co giãn theo viewBox: bàn nhỏ (3 × 3) mà kéo tới 640px thì X / O dày cộp — chặn bề rộng theo số ô.
        width: '100%', maxWidth: Math.min(640, size * 110), aspectRatio: '1', display: 'block', margin: '0 auto',
        background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)', cursor: canMove ? 'pointer' : 'default', touchAction: 'manipulation', userSelect: 'none',
      }}
    >
      {[...win].map((i) => (
        <rect key={'w' + i} x={(i % size) * CELL} y={Math.floor(i / size) * CELL} width={CELL} height={CELL} fill="var(--status-delivered-bg)" />
      ))}
      {last != null && !win.has(last) && (
        <rect x={(last % size) * CELL} y={Math.floor(last / size) * CELL} width={CELL} height={CELL} fill="var(--surface-accent-soft)" />
      )}
      {Array.from({ length: size - 1 }, (_, k) => (
        <g key={k} stroke="var(--border-subtle)" strokeWidth={1}>
          <line x1={0} y1={(k + 1) * CELL} x2={span} y2={(k + 1) * CELL} />
          <line x1={(k + 1) * CELL} y1={0} x2={(k + 1) * CELL} y2={span} />
        </g>
      ))}
      {stars(size).map(([r, c]) => board[r * size + c] == null && (
        <circle key={'s' + r + '-' + c} cx={c * CELL + pad} cy={r * CELL + pad} r={2.2} fill="var(--border-strong-color)" />
      ))}

      {canMove && hover != null && board[hover] == null && mySeat != null && (
        <Mark seat={mySeat} x={center(hover)[0]} y={center(hover)[1]} ghost />
      )}
      {board.map((v, i) => v != null && <Mark key={i} seat={v} x={center(i)[0]} y={center(i)[1]} pop={i === last} />)}

      {line?.length > 1 && (
        <line x1={wx1} y1={wy1} x2={wx2} y2={wy2} stroke="var(--status-delivered-fg)" strokeWidth={7} strokeLinecap="round" opacity={0.45}
          strokeDasharray={wlen} style={{ '--game-len': wlen, animation: 'gameDraw 520ms var(--ease-standard) both' }} />
      )}
    </svg>
  )
}
