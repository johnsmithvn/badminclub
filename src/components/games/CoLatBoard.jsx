import { useId, useState } from 'react'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { flipsOf, movesOf } from '#lib/games/colat.js'

// Bàn Cờ lật bằng SVG: khung xanh thẫm, mặt nỉ xanh có 4 điểm sao, quân tròn đen / trắng có khối.
// Ô đặt được hiện chấm; rê chuột (máy tính) hoặc Tab tới ô thì xem trước quân sẽ lật. Quân mới đặt nở ra
// (gamePop), quân bị kẹp lật lần lượt theo khoảng cách tới quân mới: mặt cũ co lại (gameFlipOut) rồi mặt mới
// nở ra (gameFlip) — effects.css. Bàn đối xứng nên không xoay; dải dưới luôn là phe mình. Luật: lib/games/colat.js.

const C = 60 // cạnh một ô
const M = 16 // khung quanh mặt nỉ
const BAND = 44 // dải đếm quân trên / dưới
const W = C * 8 + M * 2
const H = W + BAND * 2
const R = 23 // bán kính quân
const FELT = 'var(--status-delivered)'
const INK = 'var(--navy-950)'
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
// Màu quân lấy từ bảng màu gốc (không đổi theo sáng / tối): quân nhìn như nhau ở cả hai chế độ.
const FACE = [
  ['color-mix(in srgb, var(--gray-950) 72%, var(--gray-0))', 'var(--gray-950)', INK],
  ['var(--gray-0)', 'var(--gray-50)', 'var(--gray-300)'],
]
const FLIP = { transformBox: 'fill-box', transformOrigin: 'center' }
const STARS = [[2, 2], [2, 6], [6, 2], [6, 6]]

const center = (i) => [M + (i % 8) * C + C / 2, BAND + M + Math.floor(i / 8) * C + C / 2]
/** Khoảng cách (theo bước vua) giữa hai ô — quân xa quân mới lật sau. */
const dist = (a, b) => Math.max(Math.abs(Math.floor(a / 8) - Math.floor(b / 8)), Math.abs((a % 8) - (b % 8)))

function Disc({ seat, uid, ghost }) {
  return (
    <g opacity={ghost ? 0.55 : 1}>
      {!ghost && <circle cy={3} r={R} fill={mix(INK, 40)} />}
      <circle r={R} fill={`url(#${uid}f${seat})`} stroke={seat ? mix(INK, 22) : 'none'} strokeWidth={1} />
      <circle r={R - 6} fill="none" stroke={seat ? mix(INK, 8) : mix('var(--gray-0)', 9)} strokeWidth={2} />
    </g>
  )
}

export default function CoLatBoard({ state, mySeat, canMove, onMove }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isMobile = useMobile(768)
  const [hover, setHover] = useState(null)
  const { board, last } = state
  const legal = canMove ? movesOf(board, mySeat) : []
  const preview = hover != null && legal.includes(hover) ? flipsOf(board, hover, mySeat) : []
  const flipped = new Map((last?.flipped || []).map((i) => [i, dist(i, last.cell)]))
  const count = [0, 1].map((p) => board.filter((v) => v === p).length)
  const bottom = mySeat ?? 0
  const put = (i) => { setHover(null); onMove({ cell: i }) }

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {last?.skipped != null && !state.over && (
        <div style={S.notice} aria-live="polite">{t('games.colat.skipped', { side: t('games.colat.side' + last.skipped) })}</div>
      )}

      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.colat.boardAria')}
        style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none' }}
      >
        <defs>
          {FACE.map(([hi, mid, lo], n) => (
            <radialGradient key={n} id={uid + 'f' + n} cx="36%" cy="30%" r="78%">
              <stop offset="0%" style={{ stopColor: hi }} />
              <stop offset="50%" style={{ stopColor: mid }} />
              <stop offset="100%" style={{ stopColor: lo }} />
            </radialGradient>
          ))}
          <radialGradient id={uid + 'felt'} cx="40%" cy="35%" r="80%">
            <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${FELT} 84%, var(--gray-0))` }} />
            <stop offset="60%" style={{ stopColor: FELT }} />
            <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${FELT} 72%, ${INK})` }} />
          </radialGradient>
        </defs>

        {[1 - bottom, bottom].map((seat, row) => {
          const y = row ? H - BAND / 2 : BAND / 2
          const on = state.turn === seat && !state.over
          return (
            <g key={seat}>
              <g transform={`translate(${M + 14} ${y})`}>
                {on && <circle r={17} fill="none" stroke="var(--text-accent)" strokeWidth={2.5} />}
                <g transform="scale(0.52)"><Disc seat={seat} uid={uid} /></g>
              </g>
              <text x={M + 40} y={y + 6} fontSize={16} fill={on ? 'var(--text-primary)' : 'var(--text-secondary)'} fontWeight={on ? 600 : 400}>
                {t('games.colat.mark' + seat)}
              </text>
              <text x={W - M} y={y + 7} textAnchor="end" fontSize={20} fontWeight={600} fill="var(--text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>
                {count[seat]}
                <tspan dx={6} fontSize={14} fontWeight={400} fill="var(--text-muted)" style={{ fontFamily: 'var(--font-sans)' }}>{t('games.colat.pieces')}</tspan>
              </text>
            </g>
          )
        })}

        <rect x={4} y={BAND + 4} width={W - 8} height={W - 8} rx={18} fill={`color-mix(in srgb, ${FELT} 42%, ${INK})`} />
        <rect x={M} y={BAND + M} width={C * 8} height={C * 8} rx={6} fill={`url(#${uid}felt)`} />
        <g stroke={mix(INK, 38)} strokeWidth={1.5}>
          {Array.from({ length: 7 }, (_, k) => {
            const p = (k + 1) * C
            return [
              <line key={'v' + k} x1={M + p} y1={BAND + M} x2={M + p} y2={BAND + M + C * 8} />,
              <line key={'h' + k} x1={M} y1={BAND + M + p} x2={M + C * 8} y2={BAND + M + p} />,
            ]
          })}
        </g>
        {STARS.map(([r, c]) => <circle key={r + '-' + c} cx={M + c * C} cy={BAND + M + r * C} r={5} fill={mix(INK, 55)} />)}

        {legal.map((i) => {
          if (i === hover) return null
          const [x, y] = center(i)
          return <circle key={'m' + i} cx={x} cy={y} r={8} fill={mySeat ? mix('var(--gray-0)', 60) : mix(INK, 45)} pointerEvents="none" />
        })}

        {board.map((v, i) => {
          if (v == null) return null
          const [x, y] = center(i)
          const d = flipped.get(i)
          if (d != null) {
            const delay = 120 + (d - 1) * 70
            return (
              <g key={i + '-' + v} transform={`translate(${x} ${y})`}>
                <g style={{ ...FLIP, animation: `gameFlipOut var(--dur-fast) var(--ease-in) ${delay}ms both` }}><Disc seat={1 - v} uid={uid} /></g>
                <g style={{ ...FLIP, animation: `gameFlip var(--dur-fast) var(--ease-out) calc(${delay}ms + var(--dur-fast)) both` }}><Disc seat={v} uid={uid} /></g>
              </g>
            )
          }
          const pop = last && i === last.cell
          return (
            <g key={i + '-' + v} transform={`translate(${x} ${y})`}>
              <g style={pop ? { ...FLIP, animation: 'gamePop var(--dur-base) var(--ease-standard) both' } : undefined}><Disc seat={v} uid={uid} /></g>
            </g>
          )
        })}

        {last && (() => {
          const [x, y] = center(last.cell)
          return <circle cx={x} cy={y} r={5} fill="var(--status-incident)" pointerEvents="none" style={{ ...FLIP, animation: 'gamePop var(--dur-base) var(--ease-standard) both' }} />
        })()}

        {preview.length > 0 && (
          <g pointerEvents="none">
            {(() => {
              const [x, y] = center(hover)
              return <g transform={`translate(${x} ${y})`}><Disc seat={mySeat} uid={uid} ghost /></g>
            })()}
            {preview.map((i) => {
              const [x, y] = center(i)
              return <circle key={'p' + i} cx={x} cy={y} r={R + 4} fill="none" stroke={mix('var(--gray-0)', 85)} strokeWidth={2.5} strokeDasharray="5 4" />
            })}
          </g>
        )}

        {canMove && board.map((_, i) => {
          const ok = legal.includes(i)
          const [x, y] = center(i)
          return (
            <rect key={'hit' + i} x={x - C / 2} y={y - C / 2} width={C} height={C} fill="transparent"
              role={ok ? 'button' : undefined}
              tabIndex={ok ? 0 : undefined}
              aria-label={ok ? t('games.colat.cellAria', { r: Math.floor(i / 8) + 1, c: (i % 8) + 1, n: flipsOf(board, i, mySeat).length }) : undefined}
              style={{ cursor: ok ? 'pointer' : 'default', outline: 'none' }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(i) }}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((h) => (h === i ? null : h))}
              onKeyDown={(e) => { if (ok && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); put(i) } }}
              onClick={() => { if (ok) put(i) }} />
          )
        })}
      </svg>

      {canMove && <div style={{ ...S.hint, minHeight: isMobile ? 40 : 24 }}>{t('games.colat.pickHint')}</div>}
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  notice: {
    justifySelf: 'center', padding: '6px 12px', borderRadius: 99, textAlign: 'center',
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', font: 'var(--type-caption)',
  },
}
