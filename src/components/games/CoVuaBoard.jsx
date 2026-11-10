import { useId, useState } from 'react'
import { Button } from '#ds'
import { t } from '#i18n'
import { colorOf, movesFrom, PROMOS, typeOf } from '#lib/games/covua.js'
import { F } from '#components/games/fantasyTone.js'
import { FantasyDefs, FantasyFrame, FantasyGloss } from '#components/games/FantasyFrame.jsx'

// Bàn Cờ vua bằng SVG, kiểu fantasy (fantasyTone.js): khung tím đêm viền vàng đính ngọc, ô đá mặt trăng / thạch anh
// tím, toạ độ a–h / 1–8 chữ vàng. Quân là ký hiệu cờ chuẩn (Unicode) tô chuyển màu: trắng ngà-vàng viền tím sẫm, đen
// hắc diện thạch viền bạc tím — bên nào cũng đọc được trên cả ô sáng lẫn ô tối. Màu giữ nguyên ở hai chế độ sáng / tối.
// Ghế 1 (quân đen) thấy bàn xoay 180° để quân mình luôn ở dưới. Chạm quân → chấm ô đi được → chạm ô.
// Tốt lên hàng cuối thì hiện hàng nút chọn quân phong. Quân vừa đi trượt tới (effects.css: gameSlide).
// Luật: lib/games/covua.js.
// ponytail: quân vẽ bằng ký hiệu Unicode (font hệ thống) — đổi sang SVG path riêng nếu máy nào hiện xấu.

const Q = 60 // cạnh một ô
const M = 30 // lề: khung + toạ độ
const W = Q * 8 + M * 2
const FIELD = { x: M, y: M, w: Q * 8, h: Q * 8 }
// ︎: ép hiện dạng chữ (không phải emoji) trên iOS / Android.
const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
const glyph = (p) => GLYPH[typeOf(p)] + '︎'
const FONT = "'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Apple Symbols', sans-serif"
const EDGE = [F.whiteEdge, F.blackEdge]

export default function CoVuaBoard({ state, mySeat, canMove, onMove }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [picked, setPicked] = useState(null)
  const [promo, setPromo] = useState(null) // { ply, from, to } — đang chờ chọn quân phong
  const flip = mySeat === 1
  const pos = (i) => {
    const k = flip ? 63 - i : i
    return [M + (k & 7) * Q, M + (k >> 3) * Q]
  }
  const mine = (i) => canMove && colorOf(state.board[i]) === mySeat
  const sel = picked != null && mine(picked) ? picked : null
  const moves = sel == null ? [] : movesFrom(state, sel)
  const targets = [...new Set(moves.map((m) => m.to))]
  const asking = promo && promo.ply === state.ply && canMove ? promo : null
  const last = state.last

  const tap = (i) => {
    if (!canMove) return
    if (sel != null && targets.includes(i)) {
      setPicked(null)
      if (moves.some((m) => m.to === i && m.promo)) setPromo({ ply: state.ply, from: sel, to: i })
      else onMove({ from: sel, to: i })
      return
    }
    setPromo(null)
    setPicked(mine(i) && picked !== i ? i : null)
  }
  const choose = (p) => { setPromo(null); onMove({ from: asking.from, to: asking.to, promo: p }) }

  const files = 'abcdefgh'
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${W}`}
        role="group"
        aria-label={t('games.covua.boardAria')}
        style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none' }}
      >
        <defs>
          <FantasyDefs uid={uid} />
          {[[F.white0, F.white1], [F.black0, F.black1]].map(([c0, c1], side) => (
            <linearGradient key={side} id={uid + 'pc' + side} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c0} />
              <stop offset="100%" stopColor={c1} />
            </linearGradient>
          ))}
        </defs>

        <FantasyFrame uid={uid} w={W} h={W} field={FIELD} />
        {state.board.map((_, i) => {
          const [x, y] = pos(i)
          const dark = ((i >> 3) + (i & 7)) % 2 === 1
          const hot = last && (i === last.from || i === last.to)
          return (
            <g key={'sq' + i}>
              <rect x={x} y={y} width={Q} height={Q} fill={dark ? F.sqDark : F.sqLight} />
              {hot && <rect x={x} y={y} width={Q} height={Q} fill={F.glow} opacity={0.32} />}
              {sel === i && <rect x={x + 2} y={y + 2} width={Q - 4} height={Q - 4} fill={F.pick} fillOpacity={0.22} stroke={F.pick} strokeWidth={3.5} />}
              {state.check === i && <circle cx={x + Q / 2} cy={y + Q / 2} r={Q * 0.5} fill={`url(#${uid}chk)`} />}
            </g>
          )
        })}
        <FantasyGloss uid={uid} field={FIELD} />
        {Array.from({ length: 8 }, (_, k) => {
          const col = flip ? 7 - k : k
          const rank = flip ? k + 1 : 8 - k
          return (
            <g key={'lbl' + k} fill={F.gold0} fillOpacity={0.85} style={{ font: '600 12px var(--font-mono)' }}>
              <text x={M + k * Q + Q / 2} y={W - 11} textAnchor="middle">{files[col]}</text>
              <text x={15} y={M + k * Q + Q / 2 + 4} textAnchor="middle">{rank}</text>
            </g>
          )
        })}

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
            <g key={i + p} transform={`translate(${x + Q / 2} ${y + Q / 2})`} pointerEvents="none">
              <g style={fx}>
                {/* Bóng đổ dưới chân quân — quân như đứng trên mặt đá. */}
                <ellipse cy={21} rx={16} ry={4.5} fill={F.shade} opacity={0.38} />
                <text style={{ font: `400 46px/1 ${FONT}` }} textAnchor="middle" dominantBaseline="central" y={2}
                  fill={`url(#${uid}pc${side})`} stroke={EDGE[side]} strokeWidth={side ? 1.1 : 1.6} strokeLinejoin="round" paintOrder="stroke">
                  {glyph(p)}
                </text>
              </g>
            </g>
          )
        })}

        {targets.map((i) => {
          const [x, y] = pos(i)
          return state.board[i] != null
            ? <circle key={'t' + i} cx={x + Q / 2} cy={y + Q / 2} r={Q / 2 - 4} fill="none" stroke={F.glow} strokeWidth={3.5} opacity={0.95} pointerEvents="none" />
            : (
              <g key={'t' + i} pointerEvents="none">
                <circle cx={x + Q / 2} cy={y + Q / 2} r={14} fill={F.glow} opacity={0.25} />
                <circle cx={x + Q / 2} cy={y + Q / 2} r={7.5} fill={F.glow} stroke={F.frame1} strokeOpacity={0.5} strokeWidth={1} />
              </g>
            )
        })}

        {canMove && state.board.map((_, i) => {
          const [x, y] = pos(i)
          const target = targets.includes(i)
          const own = mine(i)
          return (
            <rect key={'hit' + i} x={x} y={y} width={Q} height={Q} fill="transparent" onClick={() => tap(i)}
              role={target || own ? 'button' : undefined}
              aria-label={target ? t('games.covua.toAria', { sq: files[i & 7] + (8 - (i >> 3)) }) : own ? t('games.covua.pieceAria', { sq: files[i & 7] + (8 - (i >> 3)) }) : undefined}
              style={{ cursor: target || own ? 'pointer' : 'default' }} />
          )
        })}
      </svg>

      {asking && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          <span style={S.hint}>{t('games.covua.promoTitle')}</span>
          {PROMOS.map((p) => (
            <Button key={p} size="sm" variant="secondary" onClick={() => choose(p)}>
              <span style={{ font: `400 20px/1 ${FONT}` }}>{glyph(p)}</span> {t('games.covua.promo.' + p)}
            </Button>
          ))}
        </div>
      )}
      <div style={{ ...S.hint, color: state.check != null && canMove ? 'var(--status-incident-fg)' : S.hint.color }}>
        {state.over
          ? t('games.covua.reason.' + state.reason)
          : canMove
            ? state.check != null ? t('games.covua.inCheck') : sel == null ? t('games.covua.pickHint') : t('games.covua.moveHint')
            : state.check != null ? t('games.covua.check') : ''}
      </div>
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center', minHeight: 20 },
}
