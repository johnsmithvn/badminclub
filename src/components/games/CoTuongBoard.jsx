import { useState } from 'react'
import { t } from '#i18n'
import { colorOf, COLS, movesFrom as moves0, POINTS, ROWS, typeOf } from '#lib/games/cotuong.js'
import { useSkin } from '#components/games/chessSkins.js'
import { overOf, useChessClock } from '#components/games/chessUi.js'
import ChessStage, { ChessFx } from '#components/games/ChessStage.jsx'

// Bàn Cờ tướng (bản thiết kế "Co Tuong"): 3 skin chọn được (chessSkins.js — Ngọc bích / Sơn mài / Mực tàu), khung và
// hiệu ứng ở ChessStage. Mặt bàn cỡ thiết kế 560 × 620 (ChessStage co cho vừa màn hình): đường kẻ, cung có đường chéo,
// sông có dải sáng chảy; quân tròn khắc chữ Hán truyền thống. Ghế 1 (quân đen) thấy bàn xoay 180° — chữ vẫn đứng thẳng.
// Chạm quân → chấm điểm đi được → chạm điểm. Thanh người chơi: quân đã ăn + điểm hơn; cột cán cân theo giá trị quân.
// Đồng hồ tổng + xin hoà: lib/games/chessClock.js. `hint` { from, to } (phòng máy) vẽ mũi tên gợi ý.
// Luật: lib/games/cotuong.js.
// Cờ úp (CoUpBoard) dùng lại bàn này: truyền `movesFrom` của coup.js; quân úp ('X' / 'x') vẽ mặt lưng, không chữ;
// `plain` bỏ quân đã ăn + cán cân (quân còn úp thì chưa biết giá trị).

const G = 60 // khoảng cách hai đường (px thiết kế)
const OFF = 40 // lề từ mép mặt bàn tới đường biên
const D = 52 // đường kính quân
const BOX = { w: OFF * 2 + G * 8, h: OFF * 2 + G * 9, pad: 18, radius: 12 }
// Chữ trên quân — ký hiệu của bộ cờ, không phải chữ cần dịch.
const CHARS = [
  { K: '帥', A: '仕', E: '相', H: '傌', R: '俥', C: '炮', P: '兵' },
  { K: '將', A: '士', E: '象', H: '馬', R: '車', C: '砲', P: '卒' },
]
const FONT = "'Noto Serif TC', 'KaiTi', 'STKaiti', 'Noto Serif CJK SC', 'Songti SC', 'SimSun', serif"
const VAL = { R: 9, C: 4.5, H: 4, E: 2, A: 2, P: 1, K: 0 }
const FULL = { R: 2, C: 2, H: 2, E: 2, A: 2, P: 5 } // số quân lúc đầu ván (thứ tự hiện: quân to trước)
const FILES = 'abcdefghi'
const V_LINES = [1, 2, 3, 4, 5, 6, 7]

export default function CoTuongBoard({
  state, mySeat, canMove, onMove, result, names, tags, note, actions, overActions, hint,
  movesFrom = moves0, reasons = 'games.cotuong.reason.', marks = 'games.cotuong.mark', plain = false,
}) {
  const [, sk] = useSkin('cotuong')
  const [picked, setPicked] = useState(null)
  const clocks = useChessClock(state, mySeat, onMove)
  const me = mySeat === 1 ? 1 : 0 // ghế ngồi phía dưới (người xem nhìn từ phía Đỏ)
  const foe = 1 - me
  const disp = (i) => (me === 1 ? POINTS - 1 - i : i)
  const at = (i) => ({ x: OFF + (disp(i) % COLS) * G, y: OFF + Math.floor(disp(i) / COLS) * G })
  const mine = (i) => canMove && colorOf(state.board[i]) === mySeat
  const sel = picked != null && mine(picked) ? picked : null
  const targets = sel == null ? [] : movesFrom(state, sel).map((m) => m.to)
  const last = state.last
  const over = overOf({ state, result, mySeat, names, reasons })
  const live = !over

  const tap = (i) => {
    if (!canMove) return
    if (sel != null && targets.includes(i)) {
      setPicked(null)
      onMove({ from: sel, to: i })
      return
    }
    setPicked(mine(i) && picked !== i ? i : null)
  }

  /** Một quân tròn cỡ `size`: mặt + viền trong + chữ (quân úp của Cờ úp: mặt lưng). */
  const disc = (p, size, extra) => {
    const side = colorOf(p)
    const ink = side === 0 ? sk.rI : sk.bI
    const ch = CHARS[side][typeOf(p)]
    return (
      <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', background: side === 0 ? sk.rD : sk.bD, boxShadow: sk.dSh, display: 'grid', placeItems: 'center', flexShrink: 0, ...extra }}>
        <span style={{ position: 'absolute', inset: Math.max(2, size * 0.08), borderRadius: '50%', border: `1.5px ${ch ? 'solid' : 'dashed'} ${ink}`, opacity: 0.55 }} />
        {ch
          ? <span style={{ position: 'relative', font: `900 ${Math.round(size * 0.52)}px/1 ${FONT}`, color: ink, textShadow: side === 0 ? sk.rG : sk.bG }}>{ch}</span>
          : <span style={{ position: 'relative', width: size * 0.2, height: size * 0.2, transform: 'rotate(45deg)', background: ink, opacity: 0.75 }} />}
      </div>
    )
  }

  // Quân còn trên bàn → quân đã mất của từng bên + cán cân (điểm hơn của người ngồi dưới).
  const count = [{}, {}]
  let mat = 0
  if (!plain) {
    for (const p of state.board) {
      if (p == null) continue
      const side = colorOf(p)
      count[side][typeOf(p)] = (count[side][typeOf(p)] || 0) + 1
      mat += (side === me ? 1 : -1) * VAL[typeOf(p)]
    }
  }
  const lost = (side) => (plain ? null : Object.entries(FULL).flatMap(([type, n]) => Array.from({ length: Math.max(0, n - (count[side][type] || 0)) }, (_, k) => (
    <span key={type + k} style={{ width: 20, height: 20, borderRadius: '50%', background: side === 0 ? sk.rD : sk.bD, display: 'grid', placeItems: 'center', font: `900 11px/1 ${FONT}`, color: side === 0 ? sk.rI : sk.bI, boxShadow: '0 0 0 1px rgba(0,0,0,.25)' }}>{CHARS[side][type]}</span>
  ))))
  const nameOf = (seat) => names?.[seat] || t(marks + seat)
  const bar = (seat) => ({
    mark: disc(seat === 0 ? 'K' : 'k', 44), name: nameOf(seat), me: seat === mySeat, tag: tags?.[seat] ?? (seat === mySeat ? t('games.wait.youTag') : ''),
    caps: lost(1 - seat), adv: Math.round(seat === me ? mat : -mat), clock: clocks ? clocks[seat] : null,
    alert: live && state.check != null && state.turn === seat,
    status: note?.[seat] ?? (!live ? (seat === me ? over.title : '')
      : state.turn !== seat ? ''
        : seat === mySeat ? t(state.check != null ? 'games.cotuong.inCheck' : 'games.yourTurn')
          : t(state.check != null ? 'games.cotuong.check' : 'games.chess.thinking')),
  })
  const offer = live && state.offer != null ? {
    text: state.offer === mySeat ? t('games.chess.offerSent') : t('games.chess.offerGot', { name: nameOf(state.offer) }),
    answer: mySeat != null && state.offer !== mySeat ? (yes) => onMove({ draw: yes ? 'accept' : 'decline' }) : null,
  } : null
  const done = state.over && (state.reason === 'mate' || state.reason === 'stalemate')
  const acc = `rgba(${sk.rgb},.9)`

  return (
    <ChessStage sk={sk} box={BOX} top={bar(foe)} bottom={bar(me)} turnTop={live && state.turn === foe} turnBottom={live && state.turn === me}
      evalPct={plain ? null : Math.max(4, Math.min(96, 50 + mat * 3))} over={over} overActions={overActions} actions={actions} offer={offer}>
      <div role="group" aria-label={t('games.cotuong.boardAria')} style={{ position: 'absolute', inset: 0, borderRadius: BOX.radius, background: sk.board, backgroundSize: sk.size, boxShadow: `inset 0 0 0 1px ${sk.border}, inset 0 0 50px rgba(0,0,0,.28)`, overflow: 'hidden' }}>
        {/* Sông: dải sáng chảy ngang. */}
        <div style={{ position: 'absolute', left: OFF, top: OFF + 4 * G + 3, width: 8 * G, height: G - 6, background: `linear-gradient(90deg, transparent 0, rgba(${sk.rgb},.22) 40px, transparent 120px)`, backgroundSize: '240px 100%', animation: 'chRiver 3.5s linear infinite', mixBlendMode: sk.blend, opacity: sk.blend === 'multiply' ? 0.25 : 1 }} />
        <svg width={G * 8} height={G * 9} viewBox={`0 0 ${G * 8} ${G * 9}`} style={{ position: 'absolute', left: OFF, top: OFF, overflow: 'visible' }} fill="none" stroke={sk.line} strokeWidth={1.6} strokeLinecap="square" aria-hidden="true">
          <rect x={-7} y={-7} width={G * 8 + 14} height={G * 9 + 14} strokeWidth={3} />
          {Array.from({ length: ROWS }, (_, r) => <line key={'h' + r} x1={0} y1={r * G} x2={G * 8} y2={r * G} />)}
          <line x1={0} y1={0} x2={0} y2={G * 9} /><line x1={G * 8} y1={0} x2={G * 8} y2={G * 9} />
          {V_LINES.map((c) => <line key={'t' + c} x1={c * G} y1={0} x2={c * G} y2={G * 4} />)}
          {V_LINES.map((c) => <line key={'b' + c} x1={c * G} y1={G * 5} x2={c * G} y2={G * 9} />)}
          <line x1={G * 3} y1={0} x2={G * 5} y2={G * 2} /><line x1={G * 5} y1={0} x2={G * 3} y2={G * 2} />
          <line x1={G * 3} y1={G * 7} x2={G * 5} y2={G * 9} /><line x1={G * 5} y1={G * 7} x2={G * 3} y2={G * 9} />
        </svg>
        <div style={{ position: 'absolute', left: OFF, top: OFF + 4 * G, width: 8 * G, height: G, display: 'flex', alignItems: 'center', justifyContent: 'space-around', font: 'italic 700 24px/1 var(--font-display)', letterSpacing: '.18em', color: sk.river, opacity: 0.7, pointerEvents: 'none' }}>
          <span>{t('games.cotuong.' + (me === 1 ? 'riverR' : 'riverL'))}</span><span>{t('games.cotuong.' + (me === 1 ? 'riverL' : 'riverR'))}</span>
        </div>
        {Array.from({ length: COLS }, (_, c) => <span key={'f' + c} style={{ position: 'absolute', left: OFF + c * G, top: BOX.h - 24, transform: 'translateX(-50%)', font: '700 11px/1 var(--font-mono)', color: sk.label }}>{FILES[me === 1 ? COLS - 1 - c : c]}</span>)}
        {Array.from({ length: ROWS }, (_, r) => <span key={'r' + r} style={{ position: 'absolute', left: 12, top: OFF + r * G, transform: 'translateY(-50%)', font: '700 11px/1 var(--font-mono)', color: sk.label }}>{me === 1 ? r : ROWS - 1 - r}</span>)}

        {Array.from({ length: POINTS }, (_, v) => {
          const i = disp(v)
          const p = state.board[i]
          const target = targets.includes(i)
          const own = mine(i)
          const picking = sel === i
          const isTo = last && last.to === i
          let fx
          if (p != null && isTo) {
            const a = at(last.from)
            const b = at(i)
            fx = { '--dx': a.x - b.x + 'px', '--dy': a.y - b.y + 'px', animation: 'chSlide .36s cubic-bezier(.3,.7,.2,1)' }
          }
          return (
            <div key={v} onClick={() => tap(i)}
              role={target || own ? 'button' : undefined}
              aria-label={target ? t('games.cotuong.toAria') : own ? t('games.cotuong.pieceAria') : undefined}
              style={{ position: 'absolute', left: OFF + (v % COLS) * G, top: OFF + Math.floor(v / COLS) * G, width: G, height: G, transform: 'translate(-50%, -50%)', display: 'grid', placeItems: 'center', cursor: target || own ? 'pointer' : 'default', zIndex: fx ? 4 : 1 }}>
              {last && last.from === i && p == null && <span style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', border: '2px dashed ' + acc, opacity: 0.8 }} />}
              {target && p == null && <span style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: acc, boxShadow: '0 0 12px ' + acc }} />}
              {p != null && (
                <div key={p + (fx ? state.ply : '')} style={fx}>
                  {disc(p, D, {
                    boxShadow: sk.dSh + (picking ? `, 0 0 0 3px ${sk.acc}, 0 0 26px rgba(${sk.rgb},.85)` : isTo ? `, 0 0 0 2px rgba(${sk.rgb},.85), 0 0 18px rgba(${sk.rgb},.55)` : ''),
                    transform: picking ? 'translateY(-5px) scale(1.07)' : 'none', transition: 'transform .18s, box-shadow .25s',
                  })}
                </div>
              )}
              {target && p != null && <span style={{ position: 'absolute', width: G, height: G, borderRadius: '50%', border: '3px solid ' + acc, boxShadow: '0 0 14px ' + acc }} />}
            </div>
          )
        })}
      </div>

      <ChessFx sk={sk} w={BOX.w} h={BOX.h} at={at} cell={G * 1.1} ply={state.ply} last={last} motes={sk.motes}
        cap={last?.captured ? { colors: colorOf(last.captured) === 0 ? sk.rC : sk.bC, node: disc(last.captured, D) } : null}
        check={live ? state.check : null} hint={hint && canMove ? hint : null}
        banner={last && (state.check != null || done) ? { text: t(done ? 'games.cotuong.bannerMate' : 'games.cotuong.bannerCheck'), mate: done } : null} />
    </ChessStage>
  )
}
