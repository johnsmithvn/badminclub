import { useId, useState } from 'react'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cg, { forcedFrom, NEIGHBORS } from '#lib/games/coganh.js'

// Bàn Cờ gánh bằng SVG: mặt gỗ, lưới 5×5 với đường chéo xen kẽ, quân tròn có khối (đỏ / xanh).
// Ghế 1 thấy bàn xoay 180° (điểm i vẽ ở chỗ điểm 24 − i) để quân mình luôn ở dưới.
// Chạm quân → hiện điểm đi được → chạm điểm. Quân vừa đi trượt tới, quân vừa bị gánh / vây lật màu
// (effects.css: gameSlide / gameFlip). Bị "mở" thì điểm phải đi vào nháy sáng. Luật: lib/games/coganh.js.

const G = 90 // khoảng cách hai điểm
const M = 48 // lề quanh lưới
const BAND = 34 // dải đếm quân trên / dưới
const W = G * 4 + M * 2
const H = W + BAND * 2
const WOOD = 'var(--status-delayed-bg)'
const INK = 'var(--status-delayed-fg)'
// Màu quân lấy từ bảng màu gốc (không đổi theo sáng / tối) cho quân có khối ở cả hai chế độ.
const COLORS = ['var(--status-incident)', 'var(--navy-400)']
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
// Đường chéo: hai đường chéo lớn + hình thoi nối trung điểm bốn cạnh (đúng các điểm có hàng + cột chẵn).
const DIAGS = [[0, 24], [4, 20], [2, 10], [10, 22], [22, 14], [14, 2]]

export default function CoGanhBoard({ state, mySeat, canMove, onMove }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isMobile = useMobile(768)
  const [picked, setPicked] = useState(null)
  const flip = mySeat === 1
  const pos = (i) => {
    const k = flip ? 24 - i : i
    return [M + (k % 5) * G, BAND + M + Math.floor(k / 5) * G]
  }
  const ok = (from, to) => cg.validate(state, mySeat, { from, to }) == null
  const movable = (i) => canMove && state.board[i] === mySeat && NEIGHBORS[i].some((to) => ok(i, to))
  const sel = picked != null && movable(picked) ? picked : null
  const targets = sel == null ? [] : NEIGHBORS[sel].filter((to) => ok(sel, to))
  const forced = canMove ? forcedFrom(state, mySeat) : []
  const last = state.last
  const flipped = new Set(last?.flipped || [])
  const bottom = flip ? 1 : 0
  const count = [0, 1].map((seat) => state.board.filter((v) => v === seat).length)

  const tap = (i) => {
    if (!canMove) return
    if (sel != null && targets.includes(i)) {
      setPicked(null)
      onMove({ from: sel, to: i })
      return
    }
    setPicked(movable(i) && picked !== i ? i : null)
  }

  const line = (a, b, key) => {
    const [x1, y1] = pos(a)
    const [x2, y2] = pos(b)
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />
  }

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.coganh.boardAria')}
        style={{ width: '100%', maxWidth: 520, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none' }}
      >
        <defs>
          {COLORS.map((c, n) => (
            <radialGradient key={n} id={uid + 'p' + n} cx="36%" cy="30%" r="75%">
              <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${c} 45%, var(--gray-0))` }} />
              <stop offset="45%" style={{ stopColor: c }} />
              <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${c} 60%, var(--navy-950))` }} />
            </radialGradient>
          ))}
        </defs>

        {[1 - bottom, bottom].map((seat, row) => (
          <text key={seat} x={W / 2} y={row ? H - 11 : 23} textAnchor="middle" fontSize={15}
            fill={state.turn === seat && !state.over ? 'var(--text-primary)' : 'var(--text-secondary)'}
            fontWeight={state.turn === seat && !state.over ? 600 : 400}>
            <tspan>{t('games.coganh.mark' + seat)}</tspan>
            <tspan dx={8} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{count[seat]}</tspan>
            <tspan dx={4}>{t('games.coganh.pieces')}</tspan>
          </text>
        ))}

        <rect x={6} y={BAND + 6} width={W - 12} height={W - 12} rx={20} fill={WOOD} stroke={mix(INK, 35)} />
        <g stroke={mix(INK, 55)} strokeWidth={2.5} strokeLinecap="round">
          {[0, 1, 2, 3, 4].flatMap((k) => [line(k * 5, k * 5 + 4, 'h' + k), line(k, 20 + k, 'v' + k)])}
          {DIAGS.map(([a, b]) => line(a, b, 'd' + a + '-' + b))}
        </g>
        {state.board.map((_, i) => {
          const [x, y] = pos(i)
          return <circle key={'pt' + i} cx={x} cy={y} r={4} fill={mix(INK, 50)} />
        })}

        {forced.length > 0 && state.open != null && (() => {
          const [x, y] = pos(state.open)
          return (
            <circle cx={x} cy={y} r={31} fill={mix('var(--status-delayed)', 18)} stroke="var(--status-delayed)" strokeWidth={3} strokeDasharray="6 5"
              style={{ animation: 'gameFlash 900ms var(--ease-standard) infinite alternate' }} />
          )
        })()}
        {last && (() => {
          const [x, y] = pos(last.from)
          return state.board[last.from] == null && <circle cx={x} cy={y} r={15} fill="none" stroke={mix(INK, 70)} strokeWidth={2} strokeDasharray="4 4" />
        })()}

        {state.board.map((v, i) => {
          if (v == null) return null
          const [x, y] = pos(i)
          let fx
          if (last && i === last.to) {
            const [fx0, fy0] = pos(last.from)
            fx = { '--game-dx': fx0 - x + 'px', '--game-dy': fy0 - y + 'px', animation: 'gameSlide var(--dur-slow) var(--ease-standard) both' }
          } else if (flipped.has(i)) {
            fx = { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gameFlip var(--dur-slow) var(--ease-standard) 200ms both' }
          }
          return (
            <g key={i + '-' + v} transform={`translate(${x} ${y})`}>
              <g style={fx}>
                {sel === i && <circle r={34} fill="none" stroke="var(--border-focus-color)" strokeWidth={4} />}
                {sel == null && forced.includes(i) && <circle r={33} fill="none" stroke="var(--status-delayed)" strokeWidth={3} />}
                <circle r={27} fill={`url(#${uid}p${v})`} />
                <circle r={18} fill="none" stroke={mix('var(--gray-0)', 38)} strokeWidth={2} />
              </g>
            </g>
          )
        })}

        {targets.map((i) => {
          const [x, y] = pos(i)
          return <circle key={'t' + i} cx={x} cy={y} r={12} fill="var(--text-accent)" opacity={0.85} pointerEvents="none" />
        })}

        {canMove && state.board.map((v, i) => {
          const [x, y] = pos(i)
          const target = targets.includes(i)
          const mine = movable(i)
          return (
            <circle key={'hit' + i} cx={x} cy={y} r={G / 2} fill="transparent" onClick={() => tap(i)}
              role={target || mine ? 'button' : undefined}
              aria-label={target ? t('games.coganh.toAria') : mine ? t('games.coganh.pieceAria') : undefined}
              style={{ cursor: target || mine ? 'pointer' : 'default' }} />
          )
        })}
      </svg>

      {canMove && (
        <div style={{ ...S.hint, minHeight: isMobile ? 40 : 24 }}>
          {forced.length ? t('games.coganh.forcedHint') : sel == null ? t('games.coganh.pickHint') : t('games.coganh.moveHint')}
        </div>
      )}
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
}
