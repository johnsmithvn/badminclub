import { useEffect, useState } from 'react'
import { t } from '#i18n'
import { G, btn, card, mono } from '#components/games/stage.js'
import { SkinPicker } from '#components/games/ChessStage.jsx'
import { useSkin } from '#components/games/chessSkins.js'
import { useFit } from '#components/games/chessUi.js'
import { DOOR, HOME, LANE, movesOf, squareOf, TRACK } from '#lib/games/cangua.js'

// Bàn Cờ cá ngựa theo bản thiết kế "Cờ cá ngựa" (2026-11-12): bàn chữ thập 15 × 15 ô, chuồng xuất quân ở 4 góc, ô xuất
// quân tô màu có mũi tên, cửa chuồng viền màu, chuồng đích 6 bậc vào giữa, xúc xắc 3D ở tâm (chạm để đổ). Bàn xoay cho
// màu của mình nằm góc dưới trái. 3 skin (Cổ điển / Đêm sao / Sơn mài — chessSkins.js, nhớ theo máy).
// Hiệu ứng suy từ state.last, key theo số nước (vào phòng giữa chừng không diễn lại — mountPly): xúc xắc tung + xoay tới
// mặt vừa đổ, ngựa nhảy từng ô, đá ngựa (vòng loang, mảnh bung, chữ ĐÁ!, bàn rung, ngựa bị đá xoay bay về chuồng), ra
// quân, lên chuồng (sao vàng), bảng Lượt của bạn, pháo giấy khi thắng. Bọc `data-game-fx` (giảm chuyển động là tắt).
// Bàn vẽ ở cỡ thiết kế rồi co bằng useFit. Luật: lib/games/cangua.js (đường 48 ô, chuồng 6 bậc — khớp hình ở đây).

const S = 40 // cạnh một ô (px, cỡ thiết kế)
const B = 15 * S
const PAD = 10 // khung quanh bàn
const STEP = 190 // ms mỗi ô ngựa nhảy
// Đường đua 48 ô và chuồng đích theo màu, toạ độ [hàng, cột] khi màu 0 (đỏ) ở góc trên phải — bàn xoay theo màu mình.
const TR = []
for (let r = 0; r <= 5; r++) TR.push([r, 8])
for (let c = 9; c <= 14; c++) TR.push([6, c])
for (let c = 14; c >= 9; c--) TR.push([8, c])
for (let r = 9; r <= 14; r++) TR.push([r, 8])
for (let r = 14; r >= 9; r--) TR.push([r, 6])
for (let c = 5; c >= 0; c--) TR.push([8, c])
for (let c = 0; c <= 5; c++) TR.push([6, c])
for (let r = 5; r >= 0; r--) TR.push([r, 6])
const laneRC = (color, i) => [[i, 7], [7, 14 - i], [14 - i, 7], [7, i]][color]
const BASE = [[0, 9], [9, 9], [9, 0], [0, 0]] // góc trên trái của chuồng xuất quân 6 × 6
const SLOTS = [[2, 2], [2, 4], [4, 2], [4, 4]] // chỗ 4 ngựa trong chuồng (ô, tính từ góc chuồng)
// Xúc xắc: góc xoay để mặt d hướng ra trước · chấm trên mặt (ô 3 × 3) · mặt khối (góc dựng).
const FACE = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] }
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }
const SIDES = [[1, 'rotateY(0deg)'], [2, 'rotateX(-90deg)'], [3, 'rotateY(90deg)'], [4, 'rotateY(-90deg)'], [5, 'rotateX(90deg)'], [6, 'rotateY(180deg)']]
const PARTS = Array.from({ length: 10 }, (_, i) => [Math.cos((i * Math.PI) / 5), Math.sin((i * Math.PI) / 5)])
const STAR = 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'
const CONF = ['#e53935', '#2e9e57', '#f2b705', '#1e6fd9', '#ffffff', '#ffd76a']
const AVATAR = ['#3b7a7a', '#5b6fd6', '#b0527a', '#6f8a3b']

/** Xoay một ô [hàng, cột] q lần 90° theo chiều kim đồng hồ. */
const turn = ([r, c], q) => {
  let p = [r, c]
  for (let k = 0; k < q; k++) p = [p[1], 14 - p[0]]
  return p
}
/** Các ô đi qua của nước vừa đi (vị trí `pos` từng bước), ô cuối là chỗ dừng. */
function pathOf(from, to) {
  if (from === -1) return [0]
  if (from < DOOR) return Array.from({ length: to - from }, (_, i) => from + 1 + i)
  if (from === DOOR) return Array.from({ length: to - HOME + 1 }, (_, i) => HOME + i)
  return [to]
}

/** Quân ngựa (bản thiết kế), khung 40 × 50. */
function Horse({ id, col, dark, hi }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 50" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={col} /><stop offset="1" stopColor={dark} /></linearGradient>
      </defs>
      <ellipse cx="20" cy="47" rx="13" ry="2.6" fill="rgba(0,0,0,.38)" />
      <path d="M7.5 41.5 Q7.5 38 12 37.2 L28 37.2 Q32.5 38 32.5 41.5 L32.5 43 Q32.5 45.6 20 45.6 Q7.5 45.6 7.5 43 Z" fill={`url(#${id})`} stroke={dark} strokeWidth="1.1" />
      <ellipse cx="20" cy="38.6" rx="11" ry="2.3" fill={col} stroke={dark} strokeWidth="1" />
      <path d="M12.2 38.2 C11.4 33.5 12.4 29.6 15 26.6 C12.6 24.8 11.6 21.4 12.6 17.8 C13.6 14 16 11.2 18.6 9.6 L18.2 4.6 L21.6 8.2 L23.6 4 L25.2 9.4 C29 11.4 31.6 15.4 33.4 20.6 L34.6 24.2 C35.1 26 34 27.6 32.2 27.6 L30.6 27.6 C29.4 27.6 28.6 27 27.8 26.2 L25.4 24.4 C24.2 26.4 24.6 29.6 26.6 32.4 C27.8 34.2 28.4 36.2 28.2 38.2 Z"
        fill={`url(#${id})`} stroke={dark} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M18.6 9.8 C15.6 12.2 13.8 15.6 13.6 19.6 C13.4 23 14.6 25.4 16.4 26.8" fill="none" stroke={dark} strokeWidth="2.6" strokeLinecap="round" opacity=".55" />
      <path d="M17 12.6 L14.2 13.4 M15.6 16 L12.8 16.6 M15 19.4 L12.2 20 M15.4 22.8 L12.8 23.6" stroke={dark} strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
      <circle cx="25.4" cy="15.6" r="1.7" fill="#1a1010" />
      <circle cx="25.9" cy="15.1" r=".55" fill="#fff" />
      <ellipse cx="32.4" cy="24.4" rx=".9" ry=".7" fill={dark} />
      <path d="M28.6 27.2 Q30 26.4 31.2 27.4" fill="none" stroke={dark} strokeWidth=".9" strokeLinecap="round" />
      <path d="M19.6 13 C21.4 11.8 24 11.6 26.2 12.8" fill="none" stroke={hi} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.4 28.6 C16.6 31 16.6 33.8 17.2 36.4" fill="none" stroke={hi} strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
      <path d="M11 40.6 Q20 42.4 29 40.6" fill="none" stroke={hi} strokeWidth="1.1" strokeLinecap="round" opacity=".7" />
    </svg>
  )
}

/** Xúc xắc 3D: mặt `d` hướng ra trước; `spin` đổi mỗi lần đổ (xoay thêm vài vòng); `toss` = tung lên (key theo lần đổ). */
function Dice({ d, spin, moving, toss, wobble }) {
  const [bx, by] = FACE[d]
  const face = (n) => (
    <span style={{
      position: 'absolute', inset: 0, borderRadius: 12, padding: 7, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
      background: 'radial-gradient(circle at 30% 25%,#ffffff,#f3eee2 60%,#ddd4c0)', boxShadow: 'inset 0 0 7px rgba(120,100,60,.35)', backfaceVisibility: 'hidden',
      transform: SIDES[n - 1][1] + ' translateZ(30px)',
    }}>
      {Array.from({ length: 9 }, (_, k) => (
        <span key={k} style={{ display: 'grid', placeItems: 'center' }}>
          {PIPS[n].includes(k) && <span style={{ width: 12, height: 12, borderRadius: '50%', background: n === 1 ? '#d32f2f' : '#1b2236', boxShadow: 'inset 0 3px 4px rgba(0,0,0,.55)' }} />}
        </span>
      ))}
    </span>
  )
  return (
    <>
      <span key={'s' + toss} aria-hidden="true" style={{
        position: 'absolute', left: '8%', right: '8%', bottom: -9, height: 12, borderRadius: '50%', background: 'rgba(0,0,0,.45)', filter: 'blur(3px)',
        animation: toss ? 'cnShad .95s ease-in-out' : undefined,
      }} />
      <span key={toss} style={{ position: 'absolute', inset: 0, perspective: 360, animation: toss ? 'cnToss .95s cubic-bezier(.3,.6,.4,1)' : wobble ? 'cnRoll .5s ease-in-out infinite' : undefined }}>
        <span style={{
          position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transition: moving ? 'transform .95s cubic-bezier(.15,.75,.25,1)' : 'none',
          transform: `rotateX(${bx - 20 + spin}deg) rotateY(${by + 20 + spin}deg)`,
        }}>
          {SIDES.map(([n]) => <span key={n}>{face(n)}</span>)}
        </span>
      </span>
    </>
  )
}

/** Hiệu ứng tại ô (r, c) bắt đầu sau `delay` ms: kick · out · home · land · text. */
function Burst({ kind, r, c, col, text, delay }) {
  const kick = kind === 'kick'
  const home = kind === 'home'
  const plain = kind === 'text'
  const em = (kick ? 2.6 : home ? 2 : kind === 'out' ? 1.7 : plain ? 1 : 1.1) * S
  const at = (name, s, ease = 'ease-out') => `${name} ${s}s ${ease} ${delay}ms both`
  const abs = { position: 'absolute', opacity: 0 }
  return (
    <span aria-hidden="true" style={{ position: 'absolute', left: (c + 0.5) * S, top: (r + 0.5) * S, width: 0, height: 0, fontSize: em, pointerEvents: 'none', zIndex: 3500 }}>
      {!plain && (
        <span style={{ ...abs, left: 0, top: 0, width: '2em', height: '2em', borderRadius: '50%', border: '3px solid ' + (home ? '#ffd76a' : col),
          boxShadow: '0 0 14px ' + (home ? '#ffd76a' : col), animation: at(kick ? 'cnRingBig' : 'cnRing', kick ? 0.7 : 0.55) }} />
      )}
      {!plain && kind !== 'land' && PARTS.map(([dx, dy], i) => (
        <span key={i} style={{
          ...abs, left: -5, top: -5, width: home ? 12 : kick ? 9 : 7, height: home ? 12 : kick ? 9 : 7, borderRadius: home ? 0 : '50%', clipPath: home ? STAR : undefined,
          background: home ? (i % 2 ? '#ffd76a' : '#fff6cf') : i % 3 === 0 ? '#ffffff' : col, boxShadow: '0 0 6px ' + (home ? '#ffd76a' : col),
          '--dx': dx + 'em', '--dy': dy + 'em', animation: at('cnPart', kick ? 0.75 : 0.6, 'cubic-bezier(.2,.7,.3,1)'),
        }} />
      ))}
      {text && (
        <span style={{
          ...abs, left: 0, top: 0, padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: '0 6px 16px rgba(0,0,0,.4)', color: '#fff',
          font: `800 ${kick ? 18 : 12}px/1.2 var(--font-display)`, background: kick ? '#e53935' : home ? 'linear-gradient(135deg,#ffd76a,#e0a020)' : col,
          animation: at('cnText', 1.1),
        }}>{text}</span>
      )}
    </span>
  )
}

export default function CaNguaBoard({ state, mySeat, canMove, onMove, names }) {
  const [, K] = useSkin('cangua')
  const [box, k] = useFit(B + 2 * PAD)
  const [asked, setAsked] = useState(-1) // ply đã bấm đổ, chờ server
  const [mountPly] = useState(state.ply)
  const [hop, setHop] = useState({ ply: -1, step: 0 })
  const me = mySeat ?? 0
  const q = (2 - state.colors[me] + 4) % 4 // số lần xoay 90° để màu mình xuống góc dưới trái
  const rc = (cell) => turn(cell, q)
  const last = state.last
  const fresh = state.ply > mountPly

  // Nước vừa đi: ngựa nhảy từng ô (STEP ms mỗi ô), xong mới nổ / đá.
  const moved = fresh && last?.horse != null ? last : null
  const path = moved ? pathOf(moved.from, moved.to) : []
  const steps = path.length
  const step = moved ? (hop.ply === state.ply ? hop.step : 0) : 0
  const landAt = moved ? STEP * (steps - 1) + 80 : 0
  const movePly = moved ? state.ply : -1
  useEffect(() => {
    if (movePly < 0 || steps < 2) return undefined
    let n = 0
    const id = setInterval(() => {
      n += 1
      setHop({ ply: movePly, step: n })
      if (n >= steps - 1) clearInterval(id)
    }, STEP)
    return () => clearInterval(id)
  }, [movePly, steps])
  const landed = !moved || step >= steps - 1

  // Xúc xắc: mặt của lần đổ gần nhất; nước đi ngay sau lần đổ giữ nguyên góc (rollPly).
  const d = state.dice ?? last?.dice ?? 6
  const rollPly = last?.dice ? (last.horse != null ? state.ply - 1 : state.ply) : 0
  const spin = 720 * (1 + (rollPly % 2)) + 360 * (rollPly % 2)
  const freshRoll = fresh && last?.dice && last.horse == null
  const wait = asked === state.ply
  const canRoll = canMove && state.dice == null && !wait && !state.over
  const roll = () => {
    if (!canRoll) return
    setAsked(state.ply)
    setTimeout(() => setAsked(-1), 4000)
    onMove({ roll: true })
  }

  const moves = canMove && state.dice != null && landed ? movesOf(state, mySeat) : []
  const movable = new Map(moves.map((m) => [m.horse, m]))
  const nameOf = (seat) => (seat === mySeat ? t('games.cangua.you') : names?.[seat] || t('games.cangua.mark' + seat))
  const colorName = (seat) => t('games.cangua.color' + state.colors[seat])

  // Ô (đã xoay) của ngựa `seat` ở vị trí `p` — trong chuồng thì chỗ thứ `horse` của chuồng.
  const baseRect = (color) => {
    const [r0, c0] = BASE[color]
    const a = rc([r0, c0])
    const b = rc([r0 + 5, c0 + 5])
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1])]
  }
  const centerOf = (seat, p, horse) => {
    const color = state.colors[seat]
    if (p < 0) {
      const [r, c] = baseRect(color)
      const [a, b] = SLOTS[horse]
      return [(c + b) * S, (r + a) * S]
    }
    const [r, c] = rc(p < TRACK ? TR[squareOf(color, p)] : laneRC(color, p - HOME))
    return [(c + 0.5) * S, (r + 0.5) * S]
  }
  const cellOf = (seat, p) => rc(p < TRACK ? TR[squareOf(state.colors[seat], p)] : laneRC(state.colors[seat], p - HOME))

  // Ô đường đua + chuồng đích.
  const startOf = {}
  const doorOf = {}
  state.colors.forEach((color) => { startOf[squareOf(color, 0)] = color; doorOf[squareOf(color, DOOR)] = color })
  const cells = TR.map((cell, a) => {
    const [r, c] = rc(cell)
    const st = startOf[a]
    let arrow = 0
    if (st != null) {
      const [r2, c2] = rc(TR[(a + 1) % TRACK])
      arrow = (Math.atan2(r2 - r, c2 - c) * 180) / Math.PI
    }
    return { key: 't' + a, r, c, bg: st != null ? K.col[st] : K.cell, txt: st != null ? '➜' : '', rot: arrow, fg: '#fff',
      ring: doorOf[a] != null ? `inset 0 0 0 ${Math.max(2, S * 0.09)}px ${K.col[doorOf[a]]}` : 'none' }
  })
  state.colors.forEach((color) => {
    for (let i = 0; i < LANE; i++) {
      const [r, c] = rc(laneRC(color, i))
      cells.push({ key: 'l' + color + i, r, c, bg: K.col[color], txt: String(i + 1), rot: 0, fg: '#fff', ring: `inset 0 0 0 999px rgba(255,255,255,${(0.2 - i * 0.035).toFixed(3)})` })
    }
  })
  const triangle = (color) => {
    const [r, c] = rc(laneRC(color, LANE - 1))
    return r < 7 ? 'polygon(0 0,100% 0,50% 50%)' : r > 7 ? 'polygon(0 100%,100% 100%,50% 50%)' : c < 7 ? 'polygon(0 0,0 100%,50% 50%)' : 'polygon(100% 0,100% 100%,50% 50%)'
  }

  // Ngựa: vị trí hiển thị (đang nhảy / bị đá chưa bay về) + trạng thái.
  const P = S * 0.9
  const pawns = []
  state.horses.forEach((hs, seat) => {
    if (state.out[seat]) return
    hs.forEach((p, horse) => {
      const isMover = moved && moved.seat === seat && moved.horse === horse
      const isKicked = moved?.kicked && moved.kicked.seat === seat && moved.kicked.horse === horse
      let shown = p
      if (isMover && !landed) shown = path[step]
      if (isKicked && !landed) shown = moved.to // vẫn đứng ở ô bị đá tới lúc ngựa kia đáp xuống
      const [cx, cy] = isKicked && !landed ? centerOf(moved.seat, moved.to) : centerOf(seat, shown, horse)
      const on = seat === mySeat && movable.has(horse)
      const flying = isKicked && landed
      pawns.push({
        key: seat + '-' + horse, seat, horse, cx, cy, on,
        z: Math.round(cy) + (on ? 1000 : 0) + (isMover || flying ? 2000 : 0),
        anim: flying ? 'cnSpin .7s ease-out' : isMover && !landed ? `${step % 2 ? 'cnHopA' : 'cnHopB'} .19s ease-out` : on ? 'cnBob 1.1s ease-in-out infinite' : undefined,
        tr: flying ? 'left .7s cubic-bezier(.3,1.3,.5,1),top .7s cubic-bezier(.2,-0.6,.5,1)' : 'left .18s ease-in-out,top .18s ease-in-out',
      })
    })
  })

  // Hiệu ứng của nước mới.
  const fx = []
  if (moved) {
    const [r, c] = cellOf(moved.seat, moved.to)
    const col = K.col[state.colors[moved.seat]]
    const kind = moved.kicked ? 'kick' : moved.from === -1 ? 'out' : moved.to >= HOME ? 'home' : 'land'
    const text = kind === 'kick' ? t('games.cangua.fxKick') : kind === 'out' ? t('games.cangua.fxOut') : kind === 'home' ? t('games.cangua.fxHome', { n: moved.to - HOME + 1 }) : ''
    fx.push({ kind, r, c, col, text, delay: landAt })
  }
  if (freshRoll && last.dice === 6 && !state.over) fx.push({ kind: 'text', r: 5.4, c: 7, col: K.col[state.colors[last.seat]], text: t('games.cangua.fxSix'), delay: 950 })
  const myTurnNow = fresh && mySeat != null && state.turn === mySeat && state.dice == null && !state.over && last?.seat !== mySeat
  const kicks = moved?.kicked ? state.ply : 0

  const winner = state.winner
  const players = state.horses.map((hs, seat) => {
    const [r, c] = baseRect(state.colors[seat])
    const act = state.turn === seat && !state.over
    const status = state.out[seat] ? t('games.cangua.statusOut') : winner === seat ? t('games.cangua.statusWin') : !act ? ''
      : seat === mySeat ? t(state.dice == null ? 'games.cangua.statusYou' : 'games.cangua.statusPick')
        : t(state.dice == null ? 'games.cangua.statusRolling' : 'games.cangua.statusMoving')
    return { seat, top: r < 7, col: c, act, status, home: hs.filter((p) => p >= HOME).length }
  })
  const rowOf = (top) => players.filter((p) => p.top === top).sort((a, b) => a.col - b.col)

  const hint = state.over ? (winner === mySeat ? t('games.cangua.winMe') : winner != null ? t('games.cangua.winOf', { name: nameOf(winner) }) : '')
    : mySeat == null || state.turn !== mySeat ? t('games.cangua.waitFor', { name: nameOf(state.turn), color: colorName(state.turn) })
      : wait ? t('games.cangua.rolling')
        : state.dice == null ? t('games.cangua.yourRoll')
          : !landed ? t('games.cangua.moving')
            : moves.length ? t('games.cangua.pickHint', { n: state.dice }) : t('games.cangua.noMove', { side: nameOf(mySeat), n: state.dice })
  const lastTxt = last?.out ? t('games.cangua.lastOut', { side: nameOf(last.seat) })
    : last?.kicked && landed ? t('games.cangua.kicked', { side: nameOf(last.seat), foe: nameOf(last.kicked.seat) })
      : last?.pass ? t('games.cangua.noMove', { side: nameOf(last.seat), n: last.dice })
        : last?.dice === 6 && state.dice == null && last.seat === state.turn && !state.over ? t('games.cangua.again', { side: nameOf(last.seat) }) : ''

  const playerCard = (p) => {
    const col = K.col[state.colors[p.seat]]
    return (
      <div key={p.seat} style={{
        ...card, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', opacity: state.out[p.seat] ? 0.5 : 1,
        borderColor: p.act ? col : G.line, boxShadow: p.act ? `0 0 0 1px ${col},0 0 26px -4px ${col}` : 'none', transition: 'box-shadow .3s, border-color .3s',
      }}>
        <span aria-hidden="true" style={{
          flex: 'none', width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: AVATAR[p.seat % 4],
          color: '#fff', font: '700 17px/1 var(--font-sans)', boxShadow: '0 0 0 3px ' + col,
        }}>{nameOf(p.seat).trim().charAt(0).toUpperCase()}</span>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <span style={{ font: '700 14px/1.25 var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nameOf(p.seat)} <span style={{ fontWeight: 500, color: col }}>· {colorName(p.seat)}</span>
          </span>
          <span style={{ ...mono, fontSize: 11.5 }}>{t('games.cangua.homeCount', { n: p.home })}</span>
        </div>
        {p.status && <span style={{ flex: 'none', padding: '3px 8px', borderRadius: 99, font: '700 11px/1.2 var(--font-sans)', background: G.tealA(0.16), color: G.tealHi, whiteSpace: 'nowrap' }}>{p.status}</span>}
      </div>
    )
  }
  const row = (top) => {
    const list = rowOf(top)
    return list.length ? <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: B + 2 * PAD, flexWrap: 'wrap' }}>{list.map(playerCard)}</div> : null
  }

  return (
    <div style={{ display: 'grid', gap: 14, justifyItems: 'center', gridTemplateColumns: 'minmax(0, 1fr)', color: G.text }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', maxWidth: B + 2 * PAD }}><SkinPicker kind="cangua" /></div>
      {row(true)}
      <div ref={box} style={{ width: '100%', maxWidth: B + 2 * PAD, height: (B + 2 * PAD) * k }}>
        <div data-game-fx style={{
          width: B + 2 * PAD, padding: PAD, transform: `scale(${k})`, transformOrigin: '0 0',
          animation: kicks ? `${kicks % 2 ? 'cnShakeA' : 'cnShakeB'} .45s ease-in-out ${landAt}ms` : undefined,
        }}>
          <div role="group" aria-label={t('games.cangua.boardAria')} style={{
            position: 'relative', width: B, height: B, borderRadius: 18, background: K.board,
            boxShadow: `0 0 0 8px ${K.frame},0 0 0 10px rgba(255,255,255,.08),0 30px 70px -20px rgba(0,0,0,.85)`,
          }}>
            {state.colors.map((color, seat) => {
              const [r, c] = baseRect(color)
              const act = state.turn === seat && !state.over
              return (
                <div key={'b' + color} style={{
                  position: 'absolute', left: c * S, top: r * S, width: 6 * S, height: 6 * S, borderRadius: 16, transition: 'box-shadow .3s',
                  background: `radial-gradient(circle at 30% 25%,rgba(255,255,255,.28),transparent 55%),linear-gradient(145deg,${K.col[color]},${K.dark[color]})`,
                  boxShadow: act ? `0 0 0 3px ${K.glow},0 0 ${S}px ${K.col[color]}` : 'none', animation: act ? 'cnBreath 1.6s ease-in-out infinite' : undefined,
                }}>
                  <div style={{ position: 'absolute', left: S, top: S, width: 4 * S, height: 4 * S, borderRadius: 12, background: K.panel, boxShadow: 'inset 0 3px 8px rgba(0,0,0,.28)' }}>
                    {SLOTS.map(([a, b], j) => (
                      <span key={j} style={{
                        position: 'absolute', left: (b - 1) * S - S * 0.62, top: (a - 1) * S - S * 0.62, width: S * 1.24, height: S * 1.24, borderRadius: '50%',
                        background: K.slot, boxShadow: `inset 0 3px 5px rgba(0,0,0,.3),0 0 0 2px ${K.col[color]}`,
                      }} />
                    ))}
                  </div>
                </div>
              )
            })}
            {cells.map((x) => (
              <span key={x.key} style={{
                position: 'absolute', left: x.c * S, top: x.r * S, width: S, height: S, background: x.bg, border: '1px solid ' + K.line, boxShadow: x.ring,
                display: 'grid', placeItems: 'center', font: `700 ${Math.round(S * 0.42)}px/1 var(--font-mono)`, color: x.fg, textShadow: '0 1px 2px rgba(0,0,0,.45)',
              }}><span style={{ display: 'block', rotate: x.rot + 'deg' }}>{x.txt}</span></span>
            ))}
            <div style={{ position: 'absolute', left: 6 * S, top: 6 * S, width: 3 * S, height: 3 * S, background: K.center }}>
              {state.colors.map((color) => <span key={color} style={{ position: 'absolute', inset: 0, background: K.col[color], clipPath: triangle(color) }} />)}
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle,rgba(255,255,255,.35),transparent 62%)' }} />
              <button type="button" onClick={roll} disabled={!canRoll} aria-label={t('games.cangua.roll')} style={{
                position: 'absolute', left: '50%', top: '50%', width: 60, height: 60, margin: '-30px 0 0 -30px', borderRadius: 14, border: 0, padding: 0, background: 'none',
                cursor: canRoll ? 'pointer' : 'default', zIndex: 5, animation: canRoll ? 'cnPulse 1.4s ease-in-out infinite' : undefined,
              }}>
                <Dice d={d} spin={spin} moving={rollPly > mountPly} toss={freshRoll ? state.ply : 0} wobble={wait} />
              </button>
              {canRoll && (
                <span aria-hidden="true" style={{
                  position: 'absolute', left: '50%', bottom: '6%', transform: 'translateX(-50%)', padding: '2px 7px', borderRadius: 99, zIndex: 6, whiteSpace: 'nowrap',
                  background: 'rgba(4,48,44,.85)', color: '#5FDBD3', font: '700 10px/1.2 var(--font-sans)',
                }}>{t('games.cangua.tapRoll')}</span>
              )}
            </div>
            {moves.map((m) => {
              const [r, c] = cellOf(mySeat, m.to)
              return (
                <button key={'go' + m.horse} type="button" onClick={() => onMove({ horse: m.horse })} aria-label={t('games.cangua.targetAria', { n: m.horse + 1 })} style={{
                  position: 'absolute', left: c * S, top: r * S, width: S, height: S, zIndex: 900, borderRadius: '50%', padding: 0, cursor: 'pointer',
                  border: '3px dashed ' + K.glow, background: `radial-gradient(circle,${K.col[state.colors[mySeat]]} 0 28%,transparent 32%)`,
                  animation: 'cnTarget 1s ease-in-out infinite',
                }} />
              )
            })}
            {pawns.map((p) => {
              const color = state.colors[p.seat]
              return (
                <button key={p.key} type="button" disabled={!p.on} onClick={() => onMove({ horse: p.horse })}
                  aria-label={t(p.on ? 'games.cangua.horseAria' : 'games.cangua.horseOf', { n: p.horse + 1, color: colorName(p.seat) })}
                  style={{
                    position: 'absolute', left: p.cx - P / 2, top: p.cy - P * 1.02, width: P, height: P * 1.25, zIndex: p.z, padding: 0, border: 0, background: 'none',
                    cursor: p.on ? 'pointer' : 'default', transition: p.tr,
                  }}>
                  {p.on && (
                    <span aria-hidden="true" style={{
                      position: 'absolute', left: '50%', bottom: '-4%', width: '120%', height: '34%', marginLeft: '-60%', borderRadius: '50%',
                      border: '2.5px solid ' + K.glow, boxShadow: '0 0 10px ' + K.glow, animation: 'cnGlow 1s ease-in-out infinite',
                    }} />
                  )}
                  <span style={{ position: 'absolute', inset: 0, transformOrigin: '50% 92%', animation: p.anim }}>
                    <Horse id={'cn-' + p.key} col={K.col[color]} dark={K.dark[color]} hi={K.pawnHi} />
                  </span>
                </button>
              )
            })}
            {fx.map((f, j) => <Burst key={state.ply + '-' + j} {...f} />)}
            {myTurnNow && (
              <span key={'turn' + state.ply} aria-hidden="true" style={{
                position: 'absolute', left: '50%', top: '50%', zIndex: 3600, padding: '8px 18px', borderRadius: 99, whiteSpace: 'nowrap', opacity: 0,
                background: '#00B2A9', color: '#04302C', font: '800 16px/1.2 var(--font-display)', boxShadow: '0 6px 16px rgba(0,0,0,.4)',
                animation: `cnBanner 1.4s ease-out ${landAt}ms both`,
              }}>{t('games.cangua.bannerTurn')}</span>
            )}
            {state.over && winner != null && (
              <>
                <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', fontSize: B, pointerEvents: 'none', zIndex: 5000, background: 'rgba(5,8,18,.35)' }}>
                  {Array.from({ length: 44 }, (_, i) => (
                    <span key={i} style={{
                      position: 'absolute', top: '-4%', left: ((i * 37) % 100) + '%', width: 6 + (i % 3) * 3, height: 10 + (i % 4) * 3, borderRadius: 2, background: CONF[i % 6],
                      animation: `cnFall ${(2.2 + (i % 5) * 0.35).toFixed(2)}s linear ${((i * 0.071) % 1.4).toFixed(2)}s infinite`,
                    }} />
                  ))}
                </div>
                <div role="status" style={{
                  position: 'absolute', left: '50%', top: '50%', zIndex: 5001, padding: '20px 36px', borderRadius: 20, textAlign: 'center', transform: 'translate(-50%,-50%)',
                  background: 'rgba(10,16,32,.92)', border: '2px solid ' + K.col[state.colors[winner]], boxShadow: '0 0 40px ' + K.col[state.colors[winner]],
                  animation: 'cnWin .5s cubic-bezier(.2,1.4,.4,1) both',
                }}>
                  <div style={{ font: '800 32px/1.2 var(--font-display)', color: '#fff', whiteSpace: 'nowrap' }}>{winner === mySeat ? t('games.cangua.winMe') : t('games.cangua.winOf', { name: nameOf(winner) })}</div>
                  <div style={{ font: '400 13px/1.4 var(--font-sans)', color: '#A8B7CB', marginTop: 4 }}>{t('games.cangua.winSub')}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {row(false)}
      <div aria-live="polite" style={{ width: '100%', maxWidth: B + 2 * PAD, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
          <span style={{ font: '400 14px/1.4 var(--font-sans)', color: G.soft }}>{hint}</span>
          {lastTxt && <span style={{ font: 'var(--type-caption)', color: G.muted }}>{lastTxt}</span>}
        </div>
        {mySeat != null && !state.over && (
          <button type="button" onClick={roll} disabled={!canRoll} style={{ ...btn(canRoll ? 'primary' : 'ghost'), minHeight: 48, padding: '0 26px', fontSize: 15, opacity: canRoll ? 1 : 0.6 }}>
            {t(wait ? 'games.cangua.rolling' : 'games.cangua.roll')}
          </button>
        )}
      </div>
    </div>
  )
}
