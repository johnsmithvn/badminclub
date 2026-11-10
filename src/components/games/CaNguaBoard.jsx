import { useState } from 'react'
import { Button } from '#ds'
import { t } from '#i18n'
import { HOME, LANE, movesOf, squareOf, TRACK } from '#lib/games/cangua.js'

// Bàn Cờ cá ngựa bằng SVG: đường đua vòng tròn 48 ô, 4 chuồng đích xếp theo bán kính vào tâm, chuồng xuất quân ở
// bốn góc, xúc xắc ở giữa. Bàn xoay để màu của mình luôn ở dưới. Ngựa là quân mã tô màu, trượt tới chỗ mới (CSS
// transition). Đến lượt: bấm Đổ xúc xắc (server đổ — chờ log về mới thấy số), rồi chạm con ngựa sáng để đi.
// Luật: lib/games/cangua.js.

const W = 540
const C = W / 2
const R = 196 // bán kính đường đua
const COLORS = ['var(--status-incident)', 'var(--status-delivered)', 'var(--status-delayed)', 'var(--status-scheduled)']
const INK = 'var(--text-secondary)'
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const FONT = "'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Apple Symbols', sans-serif"
// Chấm trên mặt xúc xắc 1..6, toạ độ trong ô 3 × 3.
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }

export default function CaNguaBoard({ state, mySeat, canMove, onMove }) {
  const rot = mySeat != null ? -state.colors[mySeat] * 90 : 0
  const polar = (deg, r) => [C + r * Math.cos(((deg + rot) * Math.PI) / 180), C + r * Math.sin(((deg + rot) * Math.PI) / 180)]
  const angleOf = (a) => 90 + a * (360 / TRACK)
  const trackXY = (a) => polar(angleOf(a), R)
  const laneXY = (color, step) => polar(angleOf(color * 12 - 0.5), R - 34 - step * 25)
  const stableAt = (color) => polar(angleOf(color * 12) + 45, 292)
  const stableXY = (color, k) => {
    const [x, y] = stableAt(color)
    return [x + (k % 2 ? 17 : -17), y + (k < 2 ? -17 : 17)]
  }
  // Đổ xong phải chờ log về mới thấy số: khoá nút tới khi bàn sang nước khác, khỏi bấm hai lần.
  const [asked, setAsked] = useState(-1)
  const horseXY = (seat, k) => {
    const p = state.horses[seat][k]
    const color = state.colors[seat]
    if (p < 0) return stableXY(color, k)
    if (p < TRACK) return trackXY(squareOf(color, p))
    return laneXY(color, p - HOME)
  }

  const rolling = canMove && state.dice == null
  const moves = canMove && state.dice != null ? movesOf(state, mySeat) : []
  const movable = new Set(moves.map((m) => m.horse))
  const last = state.last
  const side = (seat) => t('games.cangua.mark' + seat) + ' · ' + t('games.cangua.color' + state.colors[seat])
  const shown = state.dice ?? last?.dice ?? null

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${W}`}
        role="group"
        aria-label={t('games.cangua.boardAria')}
        style={{ width: '100%', maxWidth: 540, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none' }}
      >
        <rect x={4} y={4} width={W - 8} height={W - 8} rx={28} fill="var(--surface-inset)" stroke="var(--border-subtle)" />
        <circle cx={C} cy={C} r={R + 20} fill="var(--surface-card)" stroke="var(--border-subtle)" />
        <circle cx={C} cy={C} r={R} fill="none" stroke={mix(INK, 25)} strokeWidth={2} />

        {state.colors.map((color) => {
          const [sx, sy] = stableAt(color)
          return (
            <g key={'home' + color}>
              <rect x={sx - 40} y={sy - 40} width={80} height={80} rx={18}
                fill={mix(COLORS[color], 22)} stroke={COLORS[color]} strokeWidth={2} />
              {Array.from({ length: LANE }, (_, step) => {
                const [x, y] = laneXY(color, step)
                return (
                  <g key={step}>
                    <circle cx={x} cy={y} r={11.5} fill={mix(COLORS[color], 18 + step * 10)} stroke={COLORS[color]} strokeWidth={1.5} />
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={INK} style={{ font: '600 10px var(--font-mono)' }}>{step + 1}</text>
                  </g>
                )
              })}
            </g>
          )
        })}

        {Array.from({ length: TRACK }, (_, a) => {
          const [x, y] = trackXY(a)
          const startOf = a % 12 === 0 ? a / 12 : null
          const doorOf = (a + 1) % 12 === 0 ? (a + 1) / 12 % 4 : null
          const tone = startOf != null ? COLORS[startOf] : null
          return (
            <g key={'sq' + a}>
              <circle cx={x} cy={y} r={11.5} fill={tone ? mix(tone, 45) : 'var(--surface-inset)'} stroke={tone || mix(INK, 35)} strokeWidth={tone ? 2 : 1.2} />
              {doorOf != null && <circle cx={x} cy={y} r={5} fill={COLORS[doorOf]} opacity={0.7} />}
            </g>
          )
        })}

        {/* Xúc xắc ở tâm: số vừa đổ (đang chờ đi) hoặc số của lần đổ trước. */}
        <g transform={`translate(${C} ${C})`}>
          <rect x={-34} y={-34} width={68} height={68} rx={14} fill="var(--gray-0)" stroke="var(--border-default)" strokeWidth={2}
            style={{ filter: 'drop-shadow(0 2px 3px rgb(0 0 0 / .18))' }} />
          {shown
            ? PIPS[shown].map((k) => (
              <circle key={k + '-' + state.ply} cx={(k % 3 - 1) * 19} cy={(Math.floor(k / 3) - 1) * 19} r={6.2}
                fill={shown === 1 ? 'var(--status-incident)' : 'var(--navy-950)'}
                style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }} />
            ))
            : <text textAnchor="middle" dominantBaseline="central" fill="var(--gray-500)" style={{ font: '600 22px var(--font-mono)' }}>?</text>}
        </g>

        {state.horses.map((hs, seat) => hs.map((p, k) => {
          if (state.out[seat]) return null
          const [x, y] = horseXY(seat, k)
          const on = movable.has(k) && seat === mySeat
          const color = COLORS[state.colors[seat]]
          const pick = () => { if (on) onMove({ horse: k }) }
          return (
            <g key={seat + '-' + k} onClick={pick} role={on ? 'button' : undefined}
              aria-label={on ? t('games.cangua.horseAria', { n: k + 1 }) : undefined}
              style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform var(--dur-slow) var(--ease-standard)', cursor: on ? 'pointer' : 'default' }}>
              {on && <circle r={17} fill="none" stroke="var(--border-focus-color)" strokeWidth={3}
                style={{ animation: 'gameFlash 800ms var(--ease-standard) infinite alternate' }} />}
              {last?.kicked && last.kicked.seat === seat && last.kicked.horse === k && <circle r={15} fill={mix('var(--status-incident)', 25)} />}
              <circle r={13} fill="var(--gray-0)" stroke={color} strokeWidth={2.5} />
              <text textAnchor="middle" dominantBaseline="central" y={1} fill={color} stroke="var(--navy-950)" strokeWidth={0.6} paintOrder="stroke"
                style={{ font: `400 19px/1 ${FONT}` }}>{'♞︎'}</text>
              {on && <rect x={-22} y={-22} width={44} height={44} fill="transparent" />}
            </g>
          )
        }))}
      </svg>

      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }} aria-live="polite">
        <span style={S.hint}>
          {last?.out
            ? t('games.cangua.lastOut', { side: side(last.seat) })
            : last?.kicked
              ? t('games.cangua.kicked', { side: side(last.seat), foe: side(last.kicked.seat) })
              : last?.pass
                ? t('games.cangua.noMove', { side: side(last.seat), n: last.dice })
                : last?.dice && state.dice == null && last.seat === state.turn && last.dice === 6
                  ? t('games.cangua.again', { side: side(last.seat) })
                  : ''}
        </span>
        {rolling && (
          <Button icon="play" disabled={asked === state.ply} onClick={() => { setAsked(state.ply); setTimeout(() => setAsked(-1), 4000); onMove({ roll: true }) }}>
            {t(asked === state.ply ? 'games.cangua.rolling' : 'games.cangua.roll')}
          </Button>
        )}
        {canMove && state.dice != null && <span style={S.hint}>{t('games.cangua.pickHint', { n: state.dice })}</span>}
        {mySeat != null && !state.over && (
          <span style={{ ...S.hint, color: COLORS[state.colors[mySeat]] }}>{t('games.cangua.youAre', { color: t('games.cangua.color' + state.colors[mySeat]) })}</span>
        )}
      </div>
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', minHeight: 18 },
}
