import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '#ds'
import { t } from '#i18n'

/**
 * Bàn Caro vẽ bằng SVG — một phần tử, màu theo token (tự đổi sáng / tối).
 * Chỉ vẽ + bắt bấm; luật nằm ở lib/games/caro.js, đi nước qua `onMove` của khung phòng.
 * Quân vừa đặt hiện dần, đường thắng vẽ dần (effects.css: gamePop / gameDraw); chuột rê trên bàn
 * thì hiện mờ quân của mình ở ô đó (chỉ máy có chuột, chỉ khi tới lượt).
 *
 * Bàn lớn (từ BIG ô — 19 × 19, 30 × 30): bàn nằm trong khung cuộn, mỗi ô tối thiểu ZOOM[mức] px (mức 0 = vừa khung).
 * Nút − / + / về nước vừa đánh; Ctrl + lăn chuột hoặc chụm hai ngón để phóng to / thu nhỏ; kéo chuột hoặc vuốt để di
 * chuyển. Chạm (điện thoại) thì chạm lần 1 hiện quân mờ, chạm lần 2 cùng ô mới đánh — ô nhỏ dễ bấm nhầm.
 * Nước mới của đối phương nằm ngoài khung thì tự cuộn tới.
 *
 * Props chung của mọi màn chơi (components/games/screens.js):
 *   state, mySeat (null = người xem), canMove (đúng lượt mình, ván đang chơi), onMove(move)
 */
export const CELL = 32
const X_INK = 'var(--status-incident-fg)'
const O_INK = 'var(--status-scheduled-fg)'
const BIG = 19
/** Cỡ ô tối thiểu (px) theo mức phóng; 0 = cả bàn vừa khung. */
const ZOOM = [0, 20, 28, 36, 44]
const DRAG_PX = 5 // kéo quá ngần này là di chuyển bàn, không tính là bấm

/** Điểm sao cho dễ định vị trên bàn lớn: góc cách mép 3 ô + tâm (+ giữa các cạnh từ 19 ô). */
function stars(size) {
  if (size < 13) return []
  const a = 3, b = size - 4, m = (size - 1) / 2
  const pts = [[a, a], [a, b], [b, a], [b, b], [m, m]]
  if (size >= 19) pts.push([a, m], [m, a], [b, m], [m, b])
  return pts.filter(([r, c]) => Number.isInteger(r) && Number.isInteger(c))
}

/** Quân X / O tại (x, y) theo khung ô CELL — Cờ X-O (XoBoard) dùng lại. */
export function Mark({ seat, x, y, ghost, pop }) {
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
  const big = size >= BIG
  const [hover, setHover] = useState(null)
  const [aim, setAim] = useState({ ply: -1, i: null }) // chạm lần 1 trên bàn lớn — gắn với số nước, sang nước mới tự bỏ
  const [zoom, setZoom] = useState(big ? 1 : 0)
  const box = useRef(null)
  const gesture = useRef({ type: 'mouse', down: null, dragged: false, pinch: null, pts: new Map() })
  const pad = CELL / 2
  const span = size * CELL
  const win = new Set(line || [])
  const center = (i) => [(i % size) * CELL + pad, Math.floor(i / size) * CELL + pad]
  const pending = aim.ply === state.moves ? aim.i : null

  // Đổi mức phóng: giữ nguyên điểm đang ở giữa khung.
  const mid = useRef(null)
  const zoomTo = (z) => {
    const el = box.current
    const next = Math.max(0, Math.min(ZOOM.length - 1, z))
    if (!el || next === zoom) return
    mid.current = [(el.scrollLeft + el.clientWidth / 2) / el.scrollWidth, (el.scrollTop + el.clientHeight / 2) / el.scrollHeight]
    setZoom(next)
  }
  useLayoutEffect(() => {
    const el = box.current
    if (!el || !mid.current) return
    el.scrollLeft = mid.current[0] * el.scrollWidth - el.clientWidth / 2
    el.scrollTop = mid.current[1] * el.scrollHeight - el.clientHeight / 2
    mid.current = null
  }, [zoom])

  // Nước mới khuất ngoài khung → tự cuộn tới (lần đầu vào phòng cũng vậy).
  useEffect(() => { if (big) reveal(box.current, size, last) }, [big, size, last])

  // Ctrl + lăn chuột = phóng to / thu nhỏ (cần listener không passive để chặn trình duyệt tự zoom trang). Gắn lại mỗi
  // lần vẽ để luôn đọc đúng mức phóng hiện tại.
  useEffect(() => {
    const el = box.current
    if (!el || !big) return undefined
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      zoomTo(zoom + (e.deltaY < 0 ? 1 : -1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const cellAt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    return r < 0 || c < 0 || r >= size || c >= size ? null : r * size + c
  }
  const pick = (e) => {
    const g = gesture.current
    if (g.dragged) { g.dragged = false; return }
    if (!canMove) return
    const i = cellAt(e)
    if (i == null || board[i] != null) return
    if (big && g.type !== 'mouse' && pending !== i) { setAim({ ply: state.moves, i }); return }
    setHover(null)
    setAim({ ply: -1, i: null })
    onMove({ i })
  }

  // Kéo chuột để di chuyển bàn; hai ngón để phóng (vuốt một ngón là cuộn sẵn của trình duyệt).
  const down = (e) => {
    const g = gesture.current
    g.type = e.pointerType
    g.dragged = false
    if (!big) return
    if (e.pointerType === 'mouse' && e.button === 0) g.down = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop }
    if (e.pointerType === 'touch') {
      g.pts.set(e.pointerId, [e.clientX, e.clientY])
      if (g.pts.size === 2) g.pinch = { dist: spread(g.pts), zoom }
    }
  }
  const moveOn = (e) => {
    const g = gesture.current
    if (canMove && e.pointerType === 'mouse' && !g.down) setHover(cellAt(e))
    if (!big) return
    if (g.down) {
      const dx = e.clientX - g.down.x
      const dy = e.clientY - g.down.y
      if (!g.dragged && Math.hypot(dx, dy) < DRAG_PX) return
      g.dragged = true
      box.current.scrollLeft = g.down.left - dx
      box.current.scrollTop = g.down.top - dy
    }
    if (g.pts.has(e.pointerId)) {
      g.pts.set(e.pointerId, [e.clientX, e.clientY])
      if (g.pinch && g.pts.size === 2) {
        const ratio = spread(g.pts) / g.pinch.dist
        const step = ratio > 1.25 ? 1 : ratio < 0.8 ? -1 : 0
        if (step) {
          zoomTo(g.pinch.zoom + step)
          g.pinch = { dist: spread(g.pts), zoom: g.pinch.zoom + step }
          g.dragged = true
        }
      }
    }
  }
  const up = (e) => {
    const g = gesture.current
    g.down = null
    g.pts.delete(e.pointerId)
    if (g.pts.size < 2) g.pinch = null
  }

  const [wx1, wy1] = line?.length ? center(line[0]) : [0, 0]
  const [wx2, wy2] = line?.length ? center(line[line.length - 1]) : [0, 0]
  const wlen = Math.ceil(Math.hypot(wx2 - wx1, wy2 - wy1)) + 1
  const ghost = pending ?? hover
  const px = ZOOM[zoom]

  const svg = (
    <svg
      data-game-fx
      viewBox={`0 0 ${span} ${span}`}
      onClick={pick}
      onPointerDown={down}
      onPointerMove={moveOn}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={(e) => { setHover(null); up(e) }}
      role="img"
      aria-label={t('games.caro.boardAria', { n: size })}
      style={{
        // Bàn nhỏ: nét vẽ co giãn theo viewBox, kéo tới 640px thì X / O dày cộp — chặn bề rộng theo số ô.
        // Bàn lớn: rộng ít nhất `px` mỗi ô (khung ngoài cuộn), mức 0 = vừa khung.
        display: 'block', aspectRatio: '1', flexShrink: 0,
        ...(big ? { width: px ? `max(100%, ${size * px}px)` : '100%' } : { width: '100%', maxWidth: Math.min(640, size * 110), margin: '0 auto' }),
        background: 'var(--surface-card)', borderRadius: big ? 0 : 10, border: big ? 0 : '1px solid var(--border-default)',
        boxShadow: big ? 'none' : 'var(--shadow-sm)', cursor: canMove ? 'pointer' : big ? 'grab' : 'default',
        touchAction: big ? 'pan-x pan-y' : 'manipulation', userSelect: 'none',
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

      {pending != null && (
        <rect x={(pending % size) * CELL + 1.5} y={Math.floor(pending / size) * CELL + 1.5} width={CELL - 3} height={CELL - 3} rx={4}
          fill="none" stroke="var(--border-focus-color)" strokeWidth={2} />
      )}
      {canMove && ghost != null && board[ghost] == null && mySeat != null && (
        <Mark seat={mySeat} x={center(ghost)[0]} y={center(ghost)[1]} ghost />
      )}
      {board.map((v, i) => v != null && <Mark key={i} seat={v} x={center(i)[0]} y={center(i)[1]} pop={i === last} />)}

      {line?.length > 1 && (
        <line x1={wx1} y1={wy1} x2={wx2} y2={wy2} stroke="var(--status-delivered-fg)" strokeWidth={7} strokeLinecap="round" opacity={0.45}
          strokeDasharray={wlen} style={{ '--game-len': wlen, animation: 'gameDraw 520ms var(--ease-standard) both' }} />
      )}
    </svg>
  )
  if (!big) return svg

  return (
    <div style={{ display: 'grid', gap: 8, width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        {pending != null && <span style={{ ...S.note, marginRight: 'auto' }}>{t('games.caro.tapAgain')}</span>}
        <Tool icon="minus" label={t('games.caro.zoomOut')} onClick={() => zoomTo(zoom - 1)} off={zoom === 0} />
        <Tool icon="plus" label={t('games.caro.zoomIn')} onClick={() => zoomTo(zoom + 1)} off={zoom === ZOOM.length - 1} />
        <Tool icon="target" label={t('games.caro.toLast')} onClick={() => reveal(box.current, size, last, true)} off={last == null} />
      </div>
      <div ref={box} style={S.frame}>{svg}</div>
    </div>
  )
}

/** Nút công cụ vuông trên bàn lớn (phóng / thu / về nước vừa đánh). */
function Tool({ icon, label, onClick, off }) {
  return (
    <button type="button" onClick={onClick} disabled={off} aria-label={label} title={label} style={{ ...S.tool, opacity: off ? 0.4 : 1 }}>
      <Icon name={icon} size={16} />
    </button>
  )
}

/** Cuộn khung `el` cho ô `i` vào giữa (chỉ khi ô đang khuất, trừ khi `force`). */
function reveal(el, size, i, force) {
  if (!el || i == null) return
  const k = el.scrollWidth / size
  const x = (i % size + 0.5) * k
  const y = (Math.floor(i / size) + 0.5) * k
  const inside = x > el.scrollLeft && x < el.scrollLeft + el.clientWidth && y > el.scrollTop && y < el.scrollTop + el.clientHeight
  if (force || !inside) el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2, behavior: 'smooth' })
}

/** Khoảng cách giữa hai ngón. */
const spread = (pts) => {
  const [[x1, y1], [x2, y2]] = [...pts.values()]
  return Math.hypot(x2 - x1, y2 - y1) || 1
}

const S = {
  frame: {
    width: '100%', aspectRatio: '1', overflow: 'auto', overscrollBehavior: 'contain', display: 'flex',
    background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)',
  },
  tool: {
    width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', cursor: 'pointer',
    background: 'var(--surface-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)',
  },
  note: { font: 'var(--type-caption)', color: 'var(--text-accent)' },
}
