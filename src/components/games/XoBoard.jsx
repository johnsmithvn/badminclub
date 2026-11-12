import { useState } from 'react'
import { CELL, Mark } from '#components/games/CaroBoard.jsx'
import { CAP, fadingOf, moving } from '#lib/games/xo.js'
import { t } from '#i18n'

/**
 * Bàn Cờ X-O 3 × 3 — cùng nét vẽ với bàn Caro (Mark, CELL). Luật ở lib/games/xo.js.
 * Chế độ 3 quân di chuyển: đủ quân thì bấm một quân của mình (viền sáng) rồi bấm ô trống để nhấc sang.
 * Chế độ quân cũ biến mất: quân sắp mất của người tới lượt hiện mờ.
 */
const N = 3
const SPAN = N * CELL

export default function XoBoard({ state, mySeat, canMove, onMove }) {
  const { board, last, line, mode } = state
  const [hover, setHover] = useState(null)
  const [pick, setPick] = useState({ ply: -1, from: null }) // quân đang chọn để nhấc — gắn với số nước, sang nước mới tự bỏ
  const from = pick.ply === state.ply ? pick.from : null
  const lifting = canMove && moving(state, mySeat)
  const fading = state.over ? null : fadingOf(state, state.turn)
  const win = new Set(line || [])
  const center = (i) => [(i % N) * CELL + CELL / 2, Math.floor(i / N) * CELL + CELL / 2]

  const cellAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const c = Math.floor(((e.clientX - box.left) / box.width) * N)
    const r = Math.floor(((e.clientY - box.top) / box.height) * N)
    return r < 0 || c < 0 || r >= N || c >= N ? null : r * N + c
  }
  const tap = (e) => {
    if (!canMove) return
    const i = cellAt(e)
    if (i == null) return
    if (lifting) {
      if (board[i] === mySeat) setPick({ ply: state.ply, from: i === from ? null : i })
      else if (board[i] == null && from != null) { setPick({ ply: -1, from: null }); onMove({ from, to: i }) }
      return
    }
    if (board[i] == null) { setHover(null); onMove({ i }) }
  }
  const ghostOk = (i) => i != null && board[i] == null && (!lifting || from != null)

  const hint = !canMove || state.over ? ''
    : lifting ? t(from == null ? 'games.xo.hintPick' : 'games.xo.hintDrop')
      : fading != null ? t('games.xo.hintFade') : ''
  const left = mode !== 'classic' && !state.over ? CAP - Math.floor(state.ply / 2) : null

  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      <svg
        data-game-fx
        viewBox={`0 0 ${SPAN} ${SPAN}`}
        onClick={tap}
        onPointerMove={(e) => { if (canMove && e.pointerType === 'mouse') setHover(cellAt(e)) }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={t('games.xo.boardAria')}
        style={{
          width: '100%', maxWidth: 330, aspectRatio: '1', display: 'block',
          background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-sm)', cursor: canMove ? 'pointer' : 'default', touchAction: 'manipulation', userSelect: 'none',
        }}
      >
        {[...win].map((i) => (
          <rect key={'w' + i} x={(i % N) * CELL} y={Math.floor(i / N) * CELL} width={CELL} height={CELL} fill="var(--status-delivered-bg)" />
        ))}
        {last && !win.has(last.i) && [last.i, last.from].filter((i) => i != null).map((i) => (
          <rect key={'l' + i} x={(i % N) * CELL} y={Math.floor(i / N) * CELL} width={CELL} height={CELL} fill="var(--surface-accent-soft)" opacity={i === last.i ? 1 : 0.5} />
        ))}
        {[1, 2].map((k) => (
          <g key={k} stroke="var(--border-default)" strokeWidth={1.2}>
            <line x1={0} y1={k * CELL} x2={SPAN} y2={k * CELL} />
            <line x1={k * CELL} y1={0} x2={k * CELL} y2={SPAN} />
          </g>
        ))}
        {from != null && (
          <rect x={(from % N) * CELL + 2} y={Math.floor(from / N) * CELL + 2} width={CELL - 4} height={CELL - 4} rx={4}
            fill="none" stroke="var(--border-focus-color)" strokeWidth={1.6} />
        )}
        {ghostOk(hover) && mySeat != null && <Mark seat={mySeat} x={center(hover)[0]} y={center(hover)[1]} ghost />}
        {board.map((v, i) => v != null && (
          <g key={i} opacity={i === fading ? 0.35 : 1}>
            <Mark seat={v} x={center(i)[0]} y={center(i)[1]} pop={i === last?.i} />
          </g>
        ))}
        {line?.length > 1 && (
          <line x1={center(line[0])[0]} y1={center(line[0])[1]} x2={center(line[2])[0]} y2={center(line[2])[1]}
            stroke="var(--status-delivered-fg)" strokeWidth={5} strokeLinecap="round" opacity={0.45} />
        )}
      </svg>
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', minHeight: 18 }}>
        {t('games.xo.modeOpt.' + mode)}{left != null ? ' · ' + t('games.xo.turnsLeft', { n: left }) : ''}{hint ? ' · ' + hint : ''}
      </span>
    </div>
  )
}
