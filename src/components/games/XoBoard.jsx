import { useEffect, useRef, useState } from 'react'
import { CELL, Mark } from '#components/games/CaroBoard.jsx'
import { CAP, deadlineOf, fadingOf, moving, openCell } from '#lib/games/xo.js'
import { t } from '#i18n'

/**
 * Bàn Cờ X-O 3 × 3 — cùng nét vẽ với bàn Caro (Mark, CELL). Luật ở lib/games/xo.js.
 * Chế độ 3 quân di chuyển: đủ quân thì bấm một quân của mình (viền sáng) rồi bấm ô trống để nhấc sang.
 * Chế độ quân cũ biến mất: quân sắp mất của người tới lượt hiện mờ.
 * Đồng hồ lượt (0109): thanh giờ dưới bàn; hết giờ máy tự báo { timeout }, server so giờ rồi cho mất lượt.
 * X-O lồng (0113): bàn 9 × 9 chia 9 bàn con (UltSvg) — bàn con được đánh sáng lên, bàn con thắng phủ quân to.
 */
const N = 3
const SPAN = N * CELL
const SYM = ['X', 'O']

/** Đồng hồ máy, nhích 10 lần mỗi giây khi lượt có hạn giờ (lượt chỉ 3 giây nên cần mịn hơn các bàn khác). */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [on])
  return now
}

export default function XoBoard({ state, mySeat, canMove, onMove }) {
  const { board, last, line, mode } = state
  const [hover, setHover] = useState(null)
  const [pick, setPick] = useState({ ply: -1, from: null }) // quân đang chọn để nhấc — gắn với số nước, sang nước mới tự bỏ
  const from = pick.ply === state.ply ? pick.from : null

  // Đồng hồ lượt → tự báo { timeout }: người tới lượt báo trước, đối thủ chờ thêm (phòng khi máy kia đã tắt).
  // Server đo bằng giờ của nó; chưa tới thì im lặng (games.err.notYet), mỗi 1,5 giây thử lại.
  const due = deadlineOf(state)
  const now = useNow(due != null)
  const sent = useRef('')
  useEffect(() => {
    if (due == null || mySeat == null) return
    const at = due + (state.turn === mySeat ? 250 : 900)
    if (now < at) return
    const tag = state.ply + ':' + Math.floor((now - at) / 1500)
    if (sent.current === tag) return
    sent.current = tag
    onMove({ timeout: true })
  }, [due, mySeat, now, state.turn, state.ply, onMove])
  const leftMs = due != null ? Math.max(0, due - now) : null
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

  const hint = last?.skip && !state.over ? t('games.xo.skipped', { who: SYM[last.seat] })
    : !canMove || state.over ? ''
      : lifting ? t(from == null ? 'games.xo.hintPick' : 'games.xo.hintDrop')
        : fading != null ? t('games.xo.hintFade') : ''
  const ult = mode === 'ultimate'
  const left = (mode === 'move' || mode === 'vanish') && !state.over ? CAP - Math.floor(state.ply / 2) : null
  const ultHint = ult && canMove && !state.over ? t(state.next >= 0 ? 'games.xo.hintBoard' : 'games.xo.hintFree') : ''

  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
      {ult ? <UltSvg state={state} mySeat={mySeat} canMove={canMove} onMove={onMove} /> : (
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
      )}
      {/* Thanh giờ của lượt đang đi: cạn dần, đỏ khi còn dưới 1 giây. Phòng không tính giờ / chưa có nước đầu thì không vẽ. */}
      {leftMs != null && (
        <div role="timer" aria-label={t('games.xo.timerAria')} style={{ width: '100%', maxWidth: ult ? 440 : 330, height: 4, borderRadius: 99, background: 'var(--border-default)', overflow: 'hidden' }}>
          <div style={{
            width: Math.min(100, (leftMs / (state.time * 1000)) * 100) + '%', height: '100%', borderRadius: 99,
            background: leftMs <= 1000 ? 'var(--status-incident-fg)' : 'var(--status-delivered-fg)', transition: 'width .1s linear',
          }} />
        </div>
      )}
      <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', minHeight: 18 }}>
        {t('games.xo.modeOpt.' + mode)}{left != null ? ' · ' + t('games.xo.turnsLeft', { n: left }) : ''}{hint ? ' · ' + hint : ''}{ultHint ? ' · ' + ultHint : ''}
      </span>
    </div>
  )
}

/**
 * Bàn X-O lồng: ô i = bàn con b × 9 + ô k trong bàn con → hàng floor(b / 3) × 3 + floor(k / 3), cột (b % 3) × 3 + k % 3.
 * Bàn con được đánh tô sáng; bàn con thắng phủ mờ + quân to; bàn con hoà phủ mờ. 3 bàn con thắng liền → gạch bàn lớn.
 */
function UltSvg({ state, mySeat, canMove, onMove }) {
  const { board, big, last, line } = state
  const [hover, setHover] = useState(null)
  const N9 = 9
  const span = N9 * CELL
  const B = 3 * CELL // cạnh một bàn con
  const rc = (i) => {
    const b = Math.floor(i / 9)
    const k = i % 9
    return [Math.floor(b / 3) * 3 + Math.floor(k / 3), (b % 3) * 3 + (k % 3)]
  }
  const center = (i) => { const [r, c] = rc(i); return [c * CELL + CELL / 2, r * CELL + CELL / 2] }
  const bigAt = (b) => [(b % 3) * B, Math.floor(b / 3) * B]
  const cellAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const c = Math.floor(((e.clientX - box.left) / box.width) * N9)
    const r = Math.floor(((e.clientY - box.top) / box.height) * N9)
    if (r < 0 || c < 0 || r >= N9 || c >= N9) return null
    return (Math.floor(r / 3) * 3 + Math.floor(c / 3)) * 9 + (r % 3) * 3 + (c % 3)
  }
  const live = canMove && !state.over
  const tap = (e) => {
    if (!live) return
    const i = cellAt(e)
    if (i != null && openCell(state, i)) { setHover(null); onMove({ i }) }
  }
  return (
    <svg
      data-game-fx
      viewBox={`0 0 ${span} ${span}`}
      onClick={tap}
      onPointerMove={(e) => { if (live && e.pointerType === 'mouse') setHover(cellAt(e)) }}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={t('games.xo.boardAriaUlt')}
      style={{
        width: '100%', maxWidth: 440, aspectRatio: '1', display: 'block',
        background: 'var(--surface-card)', borderRadius: 10, border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)', cursor: live ? 'pointer' : 'default', touchAction: 'manipulation', userSelect: 'none',
      }}
    >
      {/* Bàn con được đánh (lượt của mình) */}
      {live && big.map((v, b) => v == null && (state.next < 0 || state.next === b) && (
        <rect key={'a' + b} x={bigAt(b)[0]} y={bigAt(b)[1]} width={B} height={B} fill="var(--surface-accent-soft)" opacity={0.6} />
      ))}
      {last?.i != null && (
        <rect x={rc(last.i)[1] * CELL} y={rc(last.i)[0] * CELL} width={CELL} height={CELL} fill="var(--surface-accent-soft)" />
      )}
      {Array.from({ length: 8 }, (_, k) => k + 1).map((k) => (
        <g key={k} stroke={k % 3 ? 'var(--border-default)' : 'var(--text-muted)'} strokeWidth={k % 3 ? 0.8 : 2.4}>
          <line x1={0} y1={k * CELL} x2={span} y2={k * CELL} />
          <line x1={k * CELL} y1={0} x2={k * CELL} y2={span} />
        </g>
      ))}
      {hover != null && mySeat != null && openCell(state, hover) && <Mark seat={mySeat} x={center(hover)[0]} y={center(hover)[1]} ghost />}
      {board.map((v, i) => v != null && <Mark key={i} seat={v} x={center(i)[0]} y={center(i)[1]} pop={i === last?.i} />)}
      {/* Bàn con đã xong: phủ mờ; thắng thì vẽ quân to */}
      {big.map((v, b) => v != null && (
        <g key={'b' + b}>
          <rect x={bigAt(b)[0] + 2} y={bigAt(b)[1] + 2} width={B - 4} height={B - 4} rx={6} fill="var(--surface-card)" opacity={v === 2 ? 0.55 : 0.72} />
          {v !== 2 && (
            <g transform={`translate(${bigAt(b)[0] + B / 2} ${bigAt(b)[1] + B / 2}) scale(2.6)`}>
              <Mark seat={v} x={0} y={0} pop={Math.floor((last?.i ?? -1) / 9) === b} />
            </g>
          )}
        </g>
      ))}
      {line?.length > 1 && (
        <line x1={bigAt(line[0])[0] + B / 2} y1={bigAt(line[0])[1] + B / 2} x2={bigAt(line[2])[0] + B / 2} y2={bigAt(line[2])[1] + B / 2}
          stroke="var(--status-delivered-fg)" strokeWidth={9} strokeLinecap="round" opacity={0.5} />
      )}
    </svg>
  )
}
