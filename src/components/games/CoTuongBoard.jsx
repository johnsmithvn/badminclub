import { useId, useState } from 'react'
import { t } from '#i18n'
import { colorOf, COLS, movesFrom, POINTS, typeOf } from '#lib/games/cotuong.js'

// Bàn Cờ tướng bằng SVG: mặt gỗ, 9 × 10 đường, sông giữa bàn, cung có đường chéo, quân tròn khắc chữ Hán truyền
// thống (đỏ / đen). Ghế 1 (quân đen) thấy bàn xoay 180° để quân mình ở dưới — chữ trên quân vẫn đứng thẳng.
// Chạm quân → chấm điểm đi được → chạm điểm. Quân vừa đi trượt tới (effects.css: gameSlide). Luật: lib/games/cotuong.js.

const G = 56 // khoảng cách hai đường
const M = 36 // lề
const W = G * 8 + M * 2
const H = G * 9 + M * 2
const WOOD = 'var(--status-delayed-bg)'
const INK = 'var(--status-delayed-fg)'
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const COLOR = ['var(--status-incident)', 'var(--navy-950)']
// Chữ trên quân — ký hiệu của bộ cờ, không phải chữ cần dịch.
const CHARS = [
  { K: '帥', A: '仕', E: '相', H: '傌', R: '俥', C: '炮', P: '兵' },
  { K: '將', A: '士', E: '象', H: '馬', R: '車', C: '砲', P: '卒' },
]
const PALACE = [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]]

export default function CoTuongBoard({ state, mySeat, canMove, onMove }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [picked, setPicked] = useState(null)
  const flip = mySeat === 1
  const xy = (r, c) => (flip ? [M + (8 - c) * G, M + (9 - r) * G] : [M + c * G, M + r * G])
  const pos = (i) => xy(Math.floor(i / COLS), i % COLS)
  const mine = (i) => canMove && colorOf(state.board[i]) === mySeat
  const sel = picked != null && mine(picked) ? picked : null
  const targets = sel == null ? [] : movesFrom(state, sel).map((m) => m.to)
  const last = state.last

  const tap = (i) => {
    if (!canMove) return
    if (sel != null && targets.includes(i)) {
      setPicked(null)
      onMove({ from: sel, to: i })
      return
    }
    setPicked(mine(i) && picked !== i ? i : null)
  }
  const line = (r1, c1, r2, c2, key) => {
    const [x1, y1] = xy(r1, c1)
    const [x2, y2] = xy(r2, c2)
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} />
  }

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.cotuong.boardAria')}
        style={{ width: '100%', maxWidth: 520, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none' }}
      >
        <defs>
          <radialGradient id={uid + 'disc'} cx="38%" cy="32%" r="75%">
            <stop offset="0%" style={{ stopColor: 'var(--gray-0)' }} />
            <stop offset="70%" style={{ stopColor: `color-mix(in srgb, ${INK} 18%, var(--gray-0))` }} />
            <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${INK} 40%, var(--gray-0))` }} />
          </radialGradient>
        </defs>
        <rect x={4} y={4} width={W - 8} height={H - 8} rx={18} fill={WOOD} stroke={mix(INK, 35)} />
        <g stroke={mix(INK, 60)} strokeWidth={2} strokeLinecap="round">
          {Array.from({ length: 10 }, (_, r) => line(r, 0, r, 8, 'h' + r))}
          {Array.from({ length: 9 }, (_, c) => (c === 0 || c === 8
            ? line(0, c, 9, c, 'v' + c)
            : [line(0, c, 4, c, 'vt' + c), line(5, c, 9, c, 'vb' + c)]))}
          {PALACE.map(([r1, c1, r2, c2]) => line(r1, c1, r2, c2, 'p' + r1 + c1))}
        </g>
        <rect x={M - 7} y={M - 7} width={G * 8 + 14} height={G * 9 + 14} rx={4} fill="none" stroke={mix(INK, 60)} strokeWidth={3} />
        {[[2, flip ? 'riverR' : 'riverL'], [6, flip ? 'riverL' : 'riverR']].map(([c, k]) => (
          <text key={k} x={M + c * G} y={M + 4.5 * G} textAnchor="middle" dominantBaseline="central"
            fill={mix(INK, 70)} style={{ font: '600 20px var(--font-display)', letterSpacing: '.3em' }}>
            {t('games.cotuong.' + k)}
          </text>
        ))}

        {last && (() => {
          const [x, y] = pos(last.from)
          return <circle cx={x} cy={y} r={10} fill="none" stroke={mix(INK, 80)} strokeWidth={2} strokeDasharray="4 4" />
        })()}

        {state.board.map((p, i) => {
          if (p == null) return null
          const [x, y] = pos(i)
          const side = colorOf(p)
          let fx
          if (last && i === last.to) {
            const [x0, y0] = pos(last.from)
            fx = { '--game-dx': x0 - x + 'px', '--game-dy': y0 - y + 'px', animation: 'gameSlide var(--dur-slow) var(--ease-standard) both' }
          }
          return (
            <g key={i + p} transform={`translate(${x} ${y})`} pointerEvents="none">
              <g style={fx}>
                {state.check === i && <circle r={29} fill={mix('var(--status-incident)', 30)} style={{ animation: 'gameFlash 700ms var(--ease-standard) infinite alternate' }} />}
                {sel === i && <circle r={29} fill="none" stroke="var(--border-focus-color)" strokeWidth={4} />}
                <circle r={24} fill={mix('var(--navy-950)', 30)} cy={2.5} />
                <circle r={24} fill={`url(#${uid}disc)`} stroke={COLOR[side]} strokeWidth={2.2} />
                <circle r={19} fill="none" stroke={COLOR[side]} strokeWidth={1.2} opacity={0.7} />
                <text textAnchor="middle" dominantBaseline="central" y={1} fill={COLOR[side]}
                  style={{ font: "700 23px/1 'KaiTi', 'STKaiti', 'Noto Serif CJK SC', 'Songti SC', serif" }}>
                  {CHARS[side][typeOf(p)]}
                </text>
              </g>
            </g>
          )
        })}

        {targets.map((i) => {
          const [x, y] = pos(i)
          return state.board[i] != null
            ? <circle key={'t' + i} cx={x} cy={y} r={27} fill="none" stroke="var(--text-accent)" strokeWidth={4} opacity={0.85} pointerEvents="none" />
            : <circle key={'t' + i} cx={x} cy={y} r={9} fill="var(--text-accent)" opacity={0.8} pointerEvents="none" />
        })}

        {canMove && Array.from({ length: POINTS }, (_, i) => {
          const [x, y] = pos(i)
          const target = targets.includes(i)
          const own = mine(i)
          return (
            <rect key={'hit' + i} x={x - G / 2} y={y - G / 2} width={G} height={G} fill="transparent" onClick={() => tap(i)}
              role={target || own ? 'button' : undefined}
              aria-label={target ? t('games.cotuong.toAria') : own ? t('games.cotuong.pieceAria') : undefined}
              style={{ cursor: target || own ? 'pointer' : 'default' }} />
          )
        })}
      </svg>

      <div style={{ ...S.hint, color: state.check != null && canMove ? 'var(--status-incident-fg)' : S.hint.color }}>
        {state.over
          ? t('games.cotuong.reason.' + state.reason)
          : canMove
            ? state.check != null ? t('games.cotuong.inCheck') : sel == null ? t('games.cotuong.pickHint') : t('games.cotuong.moveHint')
            : state.check != null ? t('games.cotuong.check') : ''}
      </div>
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', minHeight: 20 },
}
