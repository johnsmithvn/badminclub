import { useState } from 'react'
import { t } from '#i18n'
import { colorOf, COLS, movesFrom as moves0, POINTS, ROWS, typeOf } from '#lib/games/cotuong.js'
import { useSkin } from '#components/games/chessSkins.js'
import { overOf, useChessClock } from '#components/games/chessUi.js'
import ChessStage, { ChessFx } from '#components/games/ChessStage.jsx'
import CutScene, { MateCage, useCloseUp } from '#components/games/CutScene.jsx'
import { XIANGQI_ART } from '#components/games/characters.js'

// Bàn Cờ tướng (bản thiết kế "Co Tuong" + "Cờ · sinh động"): 4 skin chọn được (chessSkins.js — Sinh động / Ngọc bích /
// Sơn mài / Mực tàu), khung và hiệu ứng ở ChessStage. Mặt bàn cỡ thiết kế 560 × 620 (ChessStage co cho vừa màn hình): đường
// kẻ, cung có đường chéo, sông có dải sáng chảy (skin có `water`: dòng nước). Skin có `art` vẽ quân nhân vật (characters.js,
// đầu quân nhô lên trên điểm, không bắt chuột); skin khác vẽ quân tròn khắc chữ Hán. Ghế 1 (quân đen) thấy bàn xoay 180°.
// Chạm quân → chấm điểm đi được → chạm điểm. Thanh người chơi: quân đã ăn + điểm hơn; cột cán cân theo giá trị quân; bong bóng chat.
// Hiệu ứng theo nước vừa đi: nhãn qua sông (Tốt lội sông · Xe rẽ sóng · Mã phi · Pháo sang bè), lồng úp Tướng khi hết cờ;
// bật Cận cảnh thì ăn quân diễn cảnh đấu theo kiểu đòn từng quân, Tốt qua sông diễn cảnh lên cấp (CutScene).
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
// Cận cảnh: kiểu đòn từng quân · chất liệu lồng hết cờ theo quân đi nước cuối · màu nhãn qua sông.
const BLOW = { R: 'charge', C: 'cannon', H: 'leap', E: 'stomp', A: 'fan', K: 'seal', P: 'thrust' }
const MAT = { R: 'stone', C: 'gold', H: 'wood', E: 'vine', A: 'silk', P: 'rope', K: 'jade' }
const CROSS = { P: '#2a6fa8', R: '#1c5f99', H: '#5c4a9a', C: '#a8551a' }
const SPLASH = { P: ['#e6f6ff', '#8fd3ff', '#ffffff'], R: ['#8fd3ff', '#e6f6ff', '#4dabf7'], H: ['#d0ebff', '#ffffff', '#a5d8ff'], C: ['#ffd8a8', '#fff3bf', '#8fd3ff'] }
const SEAL = ['帥', '將']
const COL = ['#ff8a6a', '#7fd6b4']
const BAND = [
  'linear-gradient(100deg,rgba(70,10,6,.97),rgba(150,40,20,.94) 55%,rgba(10,40,34,.95))',
  'linear-gradient(100deg,rgba(6,30,26,.97),rgba(20,90,72,.94) 55%,rgba(80,16,8,.95))',
]
const CUT = 1.7 // giây một cảnh đấu — cảnh sau chờ cảnh trước
const L = (k, o) => t('games.cotuong.live.' + k, o)

export default function CoTuongBoard({
  state, mySeat, canMove, onMove, result, names, tags, note, actions, overActions, hint, bubbles,
  movesFrom = moves0, reasons = 'games.cotuong.reason.', marks = 'games.cotuong.mark', plain = false,
}) {
  const [, sk] = useSkin('cotuong')
  const closeUp = useCloseUp()
  const art = sk.art
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

  /** Quân nhân vật nếu skin có art (quân úp của Cờ úp không có ảnh → vẫn quân tròn). */
  const pic = (p) => art?.[colorOf(p)][typeOf(p)]
  const figure = (p, w, extra) => <img src={pic(p)} alt="" style={{ display: 'block', width: w, height: w * 1.2, pointerEvents: 'none', ...extra }} />

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
    art ? <img key={type + k} src={art[side][type]} alt="" style={{ width: 16, height: 19 }} />
      : <span key={type + k} style={{ width: 20, height: 20, borderRadius: '50%', background: side === 0 ? sk.rD : sk.bD, display: 'grid', placeItems: 'center', font: `900 11px/1 ${FONT}`, color: side === 0 ? sk.rI : sk.bI, boxShadow: '0 0 0 1px rgba(0,0,0,.25)' }}>{CHARS[side][type]}</span>
  ))))
  const nameOf = (seat) => names?.[seat] || t(marks + seat)
  const bar = (seat) => ({
    mark: art
      ? <span style={{ width: 44, height: 44, borderRadius: 12, background: sk.av[seat], display: 'grid', placeItems: 'end center', overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 2px ' + COL[seat] }}>{figure(seat === 0 ? 'K' : 'k', 36)}</span>
      : disc(seat === 0 ? 'K' : 'k', 44),
    name: nameOf(seat), me: seat === mySeat, tag: tags?.[seat] ?? (seat === mySeat ? t('games.wait.youTag') : ''),
    caps: lost(1 - seat), adv: Math.round(seat === me ? mat : -mat), clock: clocks ? clocks[seat] : null, bubble: bubbles?.[seat], glow: art ? COL[seat] : undefined,
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

  // Hiệu ứng của nước vừa đi (suy từ state.last, gắn key theo ply).
  const pills = []
  let duel = null
  let rise = null
  let cage = null
  const mp = last && state.board[last.to]
  if (mp != null) {
    const seat = last.seat
    const moved = typeOf(mp)
    const name = (ty) => L('name.' + ty)
    const side = seat === me ? 0 : 1 // phe dưới đánh thì dải phim đi trái → phải
    if (last.captured && closeUp && XIANGQI_ART[seat][moved]) {
      const ct = typeOf(last.captured)
      duel = (
        <CutScene key={'duel' + state.ply} kind="duel" blow={BLOW[moved]} seal={SEAL[seat]} att={XIANGQI_ART[seat][moved]} vic={XIANGQI_ART[1 - seat][ct]} col={COL[seat]} bg={BAND[seat]} side={side}
          title={L('duel', { a: name(moved), verb: L('verb.' + moved), v: name(ct) })} sub={L('skill.' + moved)} />
      )
    }
    // Qua sông: đỏ (dưới, hàng 5–9) lên hàng 0–4, đen ngược lại.
    const row = (i) => Math.floor(i / COLS)
    if (CROSS[moved] && (seat === 0 ? row(last.from) >= 5 && row(last.to) <= 4 : row(last.from) <= 4 && row(last.to) >= 5)) {
      pills.push({ i: last.to, text: L('cross.' + moved), bg: CROSS[moved], dy: OFF + 4.5 * G - at(last.to).y - 14, delay: duel ? CUT : 0.4, splash: SPLASH[moved] })
      if (moved === 'P' && closeUp) {
        rise = <CutScene key={'rise' + state.ply} kind="rise" att={XIANGQI_ART[seat].P} vic={XIANGQI_ART[seat].P} badge={L('badge')} col="#8fd3ff" bg={BAND[seat]} delay={duel ? CUT : 0} title={L('riseT')} sub={L('riseSub')} />
      }
    }
    if (done) {
      const k = at(state.board.indexOf(seat === 0 ? 'k' : 'K'))
      const mate = state.reason === 'mate'
      cage = {
        x: k.x, y: k.y + 14, mat: MAT[moved], title: mate ? L('mate.' + moved) : L('stale'), sub: L(mate ? 'mateSub' : 'staleSub', { side: L('side' + seat) }),
        delay: Math.max(0.2, (duel ? CUT : 0) + (rise ? 1.9 : 0) - 0.3),
      }
    }
  }

  return (
    <ChessStage sk={sk} box={BOX} top={bar(foe)} bottom={bar(me)} turnTop={live && state.turn === foe} turnBottom={live && state.turn === me}
      evalPct={plain ? null : Math.max(4, Math.min(96, 50 + mat * 3))} over={over} overActions={overActions} actions={actions} offer={offer} overDelay={cage ? cage.delay + 2.7 : undefined}>
      <div role="group" aria-label={t('games.cotuong.boardAria')} style={{ position: 'absolute', inset: 0, borderRadius: BOX.radius, background: sk.board, backgroundSize: sk.size, boxShadow: `inset 0 0 0 1px ${sk.border}, inset 0 0 50px rgba(0,0,0,.28)` }}>
        {/* Sông: dải sáng chảy ngang (skin có `water`: dòng nước). Mặt bàn không cắt tràn — đầu quân nhân vật hàng trên được nhô ra. */}
        {sk.water
          ? <div style={{ position: 'absolute', left: OFF, top: OFF + 4 * G, width: 8 * G, height: G, background: sk.water, animation: 'chRiver 6s linear infinite' }} />
          : <div style={{ position: 'absolute', left: OFF, top: OFF + 4 * G + 3, width: 8 * G, height: G - 6, background: `linear-gradient(90deg, transparent 0, rgba(${sk.rgb},.22) 40px, transparent 120px)`, backgroundSize: '240px 100%', animation: 'chRiver 3.5s linear infinite', mixBlendMode: sk.blend, opacity: sk.blend === 'multiply' ? 0.25 : 1 }} />}
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
                  {pic(p)
                    ? figure(p, 58, {
                      position: 'relative', top: -22, transition: 'transform .18s, filter .25s', transform: picking ? 'translateY(-5px) scale(1.07)' : 'none',
                      filter: picking ? `drop-shadow(0 0 10px rgba(${sk.rgb},.95))` : isTo ? `drop-shadow(0 0 8px rgba(${sk.rgb},.7))` : 'none',
                    })
                    : disc(p, D, {
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

      <ChessFx sk={sk} w={BOX.w} h={BOX.h} at={at} cell={G * 1.1} ply={state.ply} last={last} motes={sk.motes} pills={pills}
        cap={last?.captured ? { colors: colorOf(last.captured) === 0 ? sk.rC : sk.bC, node: pic(last.captured) ? figure(last.captured, 58) : disc(last.captured, D) } : null}
        check={live ? state.check : null} hint={hint && canMove ? hint : null}
        banner={last && state.check != null && !done ? { text: t('games.cotuong.bannerCheck') } : null} />
      {duel}
      {rise}
      {cage && <MateCage key={'cage' + state.ply} {...cage} />}
    </ChessStage>
  )
}
