import { useId, useState } from 'react'
import { t } from '#i18n'
import { colorOf, COLS, movesFrom as moves0, POINTS, typeOf } from '#lib/games/cotuong.js'
import { F } from '#components/games/fantasyTone.js'
import { FantasyDefs, FantasyFrame, FantasyGloss } from '#components/games/FantasyFrame.jsx'

// Bàn Cờ tướng bằng SVG, kiểu fantasy (fantasyTone.js): khung tím đêm viền vàng, mặt bàn ngọc bích sẫm, đường kẻ
// vàng, sông là dải sương ngọc lam, các điểm đặt pháo / tốt có dấu góc như bàn thật. Quân tròn khắc chữ Hán truyền
// thống: đỏ chữ vàng, đen chữ bạc. Màu giữ nguyên ở cả hai chế độ sáng / tối.
// Ghế 1 (quân đen) thấy bàn xoay 180° để quân mình ở dưới — chữ trên quân vẫn đứng thẳng.
// Chạm quân → chấm điểm đi được → chạm điểm. Quân vừa đi trượt tới (effects.css: gameSlide). Luật: lib/games/cotuong.js.
// Cờ úp (CoUpBoard) dùng lại bàn này: truyền `movesFrom` của coup.js; quân úp ('X' / 'x') vẽ mặt lưng, không chữ.

const G = 56 // khoảng cách hai đường
const R = 24 // bán kính quân
const M = 46 // lề: quân ở đường biên (R = 24) còn cách viền mặt bàn 6
const W = G * 8 + M * 2
const H = G * 9 + M * 2
const FIELD = { x: M - R - 6, y: M - R - 6, w: G * 8 + (R + 6) * 2, h: G * 9 + (R + 6) * 2 } // mặt bàn
// Chữ trên quân — ký hiệu của bộ cờ, không phải chữ cần dịch.
const CHARS = [
  { K: '帥', A: '仕', E: '相', H: '傌', R: '俥', C: '炮', P: '兵' },
  { K: '將', A: '士', E: '象', H: '馬', R: '車', C: '砲', P: '卒' },
]
const PALACE = [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]]
// Điểm đặt quân lúc đầu ván có dấu góc: pháo (hàng 2, 7) và tốt (hàng 3, 6). Bộ điểm đối xứng tâm nên xoay bàn vẫn đúng.
const MARKS = [[2, 1], [2, 7], [7, 1], [7, 7], ...[0, 2, 4, 6, 8].flatMap((c) => [[3, c], [6, c]])]
const RIM = [F.gold1, F.silver1] // viền quân: đỏ / đen
const TEXT = [F.gold0, F.silver0] // chữ trên quân

export default function CoTuongBoard({ state, mySeat, canMove, onMove, movesFrom = moves0, reasons = 'games.cotuong.reason.' }) {
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
          <FantasyDefs uid={uid} />
          <linearGradient id={uid + 'jade'} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0%" stopColor={F.jade0} />
            <stop offset="100%" stopColor={F.jade1} />
          </linearGradient>
          <linearGradient id={uid + 'river'} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={F.gem} stopOpacity={0.02} />
            <stop offset="50%" stopColor={F.gem} stopOpacity={0.2} />
            <stop offset="100%" stopColor={F.gem} stopOpacity={0.02} />
          </linearGradient>
          {[[F.red0, F.red1], [F.ink0, F.ink1]].map(([c0, c1], side) => (
            <radialGradient key={side} id={uid + 'disc' + side} cx="38%" cy="30%" r="78%">
              <stop offset="0%" stopColor={c0} />
              <stop offset="100%" stopColor={c1} />
            </radialGradient>
          ))}
        </defs>

        <FantasyFrame uid={uid} w={W} h={H} field={FIELD} />
        <rect x={FIELD.x} y={FIELD.y} width={FIELD.w} height={FIELD.h} fill={`url(#${uid}jade)`} />
        <rect x={M} y={M + 4 * G} width={G * 8} height={G} fill={`url(#${uid}river)`} />

        <g stroke={F.gold1} strokeOpacity={0.75} strokeWidth={1.4} strokeLinecap="round">
          {Array.from({ length: 10 }, (_, r) => line(r, 0, r, 8, 'h' + r))}
          {Array.from({ length: 9 }, (_, c) => (c === 0 || c === 8
            ? line(0, c, 9, c, 'v' + c)
            : [line(0, c, 4, c, 'vt' + c), line(5, c, 9, c, 'vb' + c)]))}
          {PALACE.map(([r1, c1, r2, c2]) => line(r1, c1, r2, c2, 'p' + r1 + c1))}
        </g>
        <rect x={M} y={M} width={G * 8} height={G * 9} fill="none" stroke={F.gold0} strokeOpacity={0.9} strokeWidth={2.2} />
        {/* Dấu góc ở điểm pháo / tốt: bốn chữ L nhỏ quanh giao điểm, bỏ nửa nằm ngoài đường biên. */}
        <g fill="none" stroke={F.gold0} strokeOpacity={0.8} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          {MARKS.map(([r, c]) => {
            const [x, y] = xy(r, c)
            return [-1, 1].flatMap((dx) => (x + dx * G < M || x + dx * G > M + G * 8 ? [] : [-1, 1].map((dy) => (
              <path key={r + '-' + c + dx + dy} d={`M${x + dx * 5} ${y + dy * 12} V${y + dy * 5} H${x + dx * 12}`} />
            ))))
          })}
        </g>
        {[[2, flip ? 'riverR' : 'riverL'], [6, flip ? 'riverL' : 'riverR']].map(([c, k]) => (
          <text key={k} x={M + c * G} y={M + 4.5 * G} textAnchor="middle" dominantBaseline="central"
            fill={F.gold0} fillOpacity={0.85} style={{ font: 'italic 600 19px var(--font-display)', letterSpacing: '.12em' }}>
            {t('games.cotuong.' + k)}
          </text>
        ))}
        <FantasyGloss uid={uid} field={FIELD} />

        {last && (() => {
          const [x, y] = pos(last.from)
          return <circle cx={x} cy={y} r={11} fill="none" stroke={F.glow} strokeOpacity={0.9} strokeWidth={2} strokeDasharray="4 4" />
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
                {state.check === i && <circle r={R + 6} fill={F.danger} fillOpacity={0.6} style={{ animation: 'gameFlash 700ms var(--ease-standard) infinite alternate' }} />}
                {last && i === last.to && <circle r={R + 4} fill="none" stroke={F.glow} strokeOpacity={0.55} strokeWidth={2.5} />}
                {sel === i && <circle r={R + 5} fill="none" stroke={F.pick} strokeWidth={3.5} />}
                <circle r={R} cy={3} fill={F.shade} opacity={0.5} />
                <circle r={R} fill={`url(#${uid}disc${side})`} stroke={RIM[side]} strokeWidth={2.2} />
                <circle r={R - 5} fill="none" stroke={RIM[side]} strokeWidth={1} opacity={0.65} />
                {p === 'X' || p === 'x'
                  ? (
                    <>
                      <circle r={12} fill="none" stroke={RIM[side]} strokeWidth={1.2} strokeDasharray="3 3" />
                      <rect x={-4} y={-4} width={8} height={8} transform="rotate(45)" fill={RIM[side]} opacity={0.75} />
                    </>
                  )
                  : (
                    <text textAnchor="middle" dominantBaseline="central" y={1} fill={TEXT[side]}
                      style={{ font: "700 23px/1 'KaiTi', 'STKaiti', 'Noto Serif CJK SC', 'Songti SC', serif" }}>
                      {CHARS[side][typeOf(p)]}
                    </text>
                  )}
              </g>
            </g>
          )
        })}

        {targets.map((i) => {
          const [x, y] = pos(i)
          return state.board[i] != null
            ? <circle key={'t' + i} cx={x} cy={y} r={R + 4} fill="none" stroke={F.glow} strokeWidth={3.5} opacity={0.95} pointerEvents="none" />
            : (
              <g key={'t' + i} pointerEvents="none">
                <circle cx={x} cy={y} r={13} fill={F.glow} opacity={0.22} />
                <circle cx={x} cy={y} r={7} fill={F.glow} opacity={0.95} />
              </g>
            )
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
          ? t(reasons + state.reason)
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
