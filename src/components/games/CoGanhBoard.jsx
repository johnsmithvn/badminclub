import { useState } from 'react'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cg, { forcedFrom, NEIGHBORS } from '#lib/games/coganh.js'
import { overOf, rnd } from '#components/games/chessUi.js'
import ChessStage from '#components/games/ChessStage.jsx'
import CutScene, { useCloseUp } from '#components/games/CutScene.jsx'
import { VILLAGERS } from '#components/games/characters.js'

// Bàn Cờ gánh · Ruộng làng (bản "Cờ · sinh động", 2026-11-14): mặt ruộng lúa, đường kẻ là bờ đất + bờ cỏ, quân là dân
// Làng Lúa (ghế 0) / Làng Sen (ghế 1). Khung, thanh người chơi, cán cân, màn kết thúc, nút: ChessStage (bàn 612 cỡ thiết
// kế, co cho vừa màn hình). Ghế 1 thấy bàn xoay 180° (điểm i vẽ ở chỗ 24 − i) để làng mình luôn ở dưới.
// Chạm người → điểm đi được sáng lên → chạm điểm. Hiệu ứng suy từ state.last (key theo số nước, không giữ state):
// người vừa đi nhảy tới · người bị ăn lật sang làng mình · đòn gánh hiện trên hai người bị gánh · chữ Gánh / Vây ·
// điểm bị "mở" nháy vàng · bật Cận cảnh thì có thêm dải phim (CutScene). Luật: lib/games/coganh.js.
// Màu viết cứng (một "vật" — DESIGN.md §2.4); thanh người chơi / nút quanh bàn vẫn theo token (ChessStage).

const GAP = 118 // khoảng cách hai điểm (px thiết kế)
const PAD = 70 // lề quanh lưới
const FIELD = GAP * 4 + PAD * 2 // 612
const BOX = { w: FIELD, h: FIELD, pad: 18, radius: 20 }
const SK = { frame: 'linear-gradient(180deg,#3e6b2c,#2a4a1e)', border: '#8a6a3a', acc: '#ffe7a0', rgb: '255,231,160', page: 'rgba(90,160,70,.2)', gem: false }
// Theo ghế: nền ô ảnh đại diện · vòng · màu nhấn cận cảnh · nền dải cận cảnh · màu chữ Gánh.
const SIDE = [
  { bg: 'linear-gradient(145deg,#c8f5a0,#3f9b4a)', ring: '#9be15d', col: '#c8f5a0', tag: '#3f9b4a', band: 'linear-gradient(100deg,rgba(20,50,16,.97),rgba(60,120,40,.94) 55%,rgba(90,30,60,.95))' },
  { bg: 'linear-gradient(145deg,#ffc0d8,#d23a78)', ring: '#ff7aa8', col: '#ffc0d8', tag: '#d23a78', band: 'linear-gradient(100deg,rgba(70,14,40,.97),rgba(160,50,100,.94) 55%,rgba(30,60,20,.95))' },
]
const VAY = '#e8c48a'
const HOP = 0.38 // giây người vừa đi nhảy tới — các hiệu ứng ăn quân chạy sau nhịp này
const CUT = 1.8 // giây một dải cận cảnh
// Đường chéo: hai đường chéo lớn + hình thoi nối trung điểm bốn cạnh (đúng các điểm có hàng + cột chẵn).
const DIAGS = [[0, 24], [4, 20], [2, 10], [10, 22], [22, 14], [14, 2]]
const LINES = [0, 1, 2, 3, 4].flatMap((k) => [[k * 5, k * 5 + 4], [k, 20 + k]]).concat(DIAGS)
const rc = (i) => [Math.floor(i / 5), i % 5]

/** Nước vừa đi tách thành các cặp bị gánh (đứng hai bên điểm đến, thẳng hàng) và phần còn lại là bị vây. */
function splitCaps(last) {
  if (!last?.flipped?.length) return { poles: [], vay: [] }
  const f = new Set(last.flipped)
  const [r, c] = rc(last.to)
  const poles = []
  for (const a of NEIGHBORS[last.to]) {
    const [ra, ca] = rc(a)
    const b = (2 * r - ra) * 5 + (2 * c - ca)
    if (a < b && f.has(a) && f.has(b) && NEIGHBORS[last.to].includes(b)) poles.push([a, b])
  }
  const inPole = new Set(poles.flat())
  return { poles, vay: last.flipped.filter((i) => !inPole.has(i)) }
}

/** Mảnh bung tròn quanh một điểm (chBurst). */
const burst = (key, x, y, cols, delay) => Array.from({ length: 10 }, (_, j) => {
  const a = (j / 10) * Math.PI * 2
  const d = 34 + rnd(j * 3.7 + x) * 26
  return (
    <span key={key + j} style={{
      position: 'absolute', left: x, top: y, width: 8, height: 8, borderRadius: '50%', background: cols[j % cols.length], boxShadow: '0 0 6px ' + cols[j % cols.length],
      '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', opacity: 0, animation: `chBurst .7s cubic-bezier(.2,.7,.3,1) ${delay}s forwards`, zIndex: 40,
    }} />
  )
})

/** Chữ nổi kiểu nhãn thuốc (Gánh · Vây · Mở) — chBanner. */
const banner = (key, x, y, text, bg, delay, color = '#fff', size = 20) => (
  <span key={key} style={{
    position: 'absolute', left: x, top: y, padding: '5px 12px', borderRadius: 99, background: bg, color, whiteSpace: 'nowrap', zIndex: 42,
    font: `800 ${size}px/1.1 var(--font-display)`, letterSpacing: '.02em', boxShadow: '0 8px 20px rgba(0,0,0,.45)', opacity: 0,
    animation: `chBanner 1.5s ease-out ${delay}s forwards`,
  }}>{text}</span>
)

export default function CoGanhBoard({ state, mySeat, canMove, onMove, result, names, note, clock, actions, overActions, hint, bubbles }) {
  const isMobile = useMobile(768)
  const closeUp = useCloseUp()
  const [picked, setPicked] = useState(null)
  const flip = mySeat === 1
  const bottom = flip ? 1 : 0
  const top = 1 - bottom
  const pos = (i) => {
    const k = flip ? 24 - i : i
    return [PAD + (k % 5) * GAP, PAD + Math.floor(k / 5) * GAP]
  }
  const ok = (from, to) => cg.validate(state, mySeat, { from, to }) == null
  const movable = (i) => canMove && state.board[i] === mySeat && NEIGHBORS[i].some((to) => ok(i, to))
  const sel = picked != null && movable(picked) ? picked : null
  const targets = sel == null ? [] : NEIGHBORS[sel].filter((to) => ok(sel, to))
  const forced = canMove ? forcedFrom(state, mySeat) : []
  const { last, ply } = state
  const flipped = new Set(last?.flipped || [])
  const { poles, vay } = splitCaps(last)
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

  const vil = (seat) => t('games.coganh.village' + seat)
  const bar = (seat) => {
    const turn = !state.over && !result && state.turn === seat
    const mine = seat === mySeat
    const sz = isMobile ? 38 : 46
    const n = count[seat]
    return {
      me: mine,
      name: names?.[seat] || vil(seat),
      tag: '· ' + vil(seat),
      mark: (
        <span style={{ width: sz, height: sz, borderRadius: '50%', background: SIDE[seat].bg, boxShadow: '0 0 0 2px ' + SIDE[seat].ring, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <img src={VILLAGERS[seat]} alt="" style={{ width: sz * 0.85, height: sz * 1.03, marginTop: sz * 0.18 }} />
        </span>
      ),
      caps: <span style={{ font: '400 12px/1.3 var(--font-mono)', color: 'var(--text-muted)' }}>{t(n > 8 ? 'games.coganh.folkWon' : 'games.coganh.folk', { n, won: n - 8 })}</span>,
      // Lượt mình: bàn tự nói (bị mở / chọn điểm đến); bên kia: dòng phòng truyền (mất kết nối, máy đang nghĩ) trước.
      status: turn && mine ? t(forced.length ? 'games.coganh.mustShort' : sel != null ? 'games.coganh.pickTo' : 'games.yourTurn')
        : note?.[seat] || (turn ? t('games.coganh.thinking') : ''),
      alert: mine && turn && forced.length > 0,
      clock: clock && clock.seat === seat ? clock.left * 1000 : null,
      bubble: bubbles?.[seat],
      glow: SIDE[seat].ring,
    }
  }
  const loser = count[0] === 0 ? 0 : count[1] === 0 ? 1 : null
  const over = overOf({ state: { ...state, reason: loser != null ? 'wipe' : 'count' }, result, mySeat, names: names || { 0: vil(0), 1: vil(1) }, reasons: 'games.coganh.end.' })

  // Hiệu ứng của nước vừa đi (key theo số nước → mỗi nước diễn một lần).
  const fx = []
  if (last) {
    const [x, y] = pos(last.to)
    const k = 'p' + ply
    fx.push(<span key={k + 'land'} style={{ position: 'absolute', left: x, top: y + 18, width: 52, height: 52, borderRadius: '50%', border: '3px solid ' + SIDE[last.seat].col, boxShadow: '0 0 14px ' + SIDE[last.seat].col, opacity: 0, animation: `chRipple .6s ease-out ${HOP - 0.06}s forwards`, zIndex: 30 }} />)
    last.flipped.forEach((i) => {
      const [fx0, fy0] = pos(i)
      fx.push(...burst(k + 'b' + i + '-', fx0, fy0 - 40, ['#ffe7a0', '#ffffff', SIDE[last.seat].col], HOP))
    })
    if (poles.length) {
      fx.push(banner(k + 'ganh', x, y - 70, poles.length > 1 ? t('games.coganh.fx.ganh2', { n: poles.length * 2 }) : t('games.coganh.fx.ganh'), SIDE[last.seat].tag, HOP, '#fff', 22))
      poles.forEach(([a, b]) => {
        const [x0, y0] = pos(a)
        const [x1, y1] = pos(b)
        const len = Math.hypot(x1 - x0, y1 - y0) + 40
        fx.push(
          <span key={k + 'pole' + a} style={{ position: 'absolute', left: (x0 + x1) / 2, top: (y0 + y1) / 2 - 64, width: len, height: 14, margin: `-7px 0 0 ${-len / 2}px`, transform: `rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`, zIndex: 35 }}>
            <span style={{ position: 'absolute', inset: 0, borderRadius: 7, background: 'linear-gradient(180deg,#e2b46a,#8a5a2a)', boxShadow: '0 4px 10px rgba(0,0,0,.45)', opacity: 0, animation: `cgPole .9s ease-out ${HOP}s forwards` }} />
          </span>,
        )
      })
    }
    if (vay.length) {
      const gx = vay.reduce((s, i) => s + pos(i)[0], 0) / vay.length
      const gy = vay.reduce((s, i) => s + pos(i)[1], 0) / vay.length
      fx.push(banner(k + 'vay', gx, gy - 40, t('games.coganh.fx.vay', { n: vay.length }), '#8a5a2a', HOP + (poles.length ? 0.3 : 0)))
    }
  }
  if (forced.length && state.open != null) {
    const [x, y] = pos(state.open)
    fx.push(banner('open' + ply, x, y - 54, t('games.coganh.fx.open'), '#c99a2e', HOP + 0.5, '#2a1800', 16))
  }

  // Cận cảnh: gánh trước, vây sau (nối tiếp nhau).
  const cut = []
  if (closeUp && last?.flipped?.length) {
    const s = last.seat
    const base = { att: VILLAGERS[s], vic: VILLAGERS[1 - s], vic2: VILLAGERS[s], bg: SIDE[s].band }
    if (poles.length) {
      cut.push(<CutScene key={'cg' + ply} kind="ganh" {...base} n={poles.length > 1 ? 2 : 1} col={SIDE[s].col} delay={HOP}
        title={t(poles.length > 1 ? 'games.coganh.cut.ganh2' : 'games.coganh.cut.ganh', { n: poles.length * 2 })} sub={t('games.coganh.cut.ganhSub')} />)
    }
    if (vay.length) {
      cut.push(<CutScene key={'cv' + ply} kind="vay" {...base} col={VAY} delay={HOP + (poles.length ? CUT : 0)}
        title={t('games.coganh.cut.vay', { n: vay.length })} sub={t('games.coganh.cut.vaySub')} />)
    }
  }

  // Mũi tên gợi ý (phòng máy): từ người tới điểm nên đi.
  let tip = null
  if (hint && canMove) {
    const [x0, y0] = pos(hint.from)
    const [x1, y1] = pos(hint.to)
    tip = (
      <>
        <span style={{ position: 'absolute', left: x0, top: y0 - 20, width: Math.max(0, Math.hypot(x1 - x0, y1 - y0) - 16), height: 8, marginTop: -4, borderRadius: 4, transformOrigin: '0 50%', transform: `rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`, background: 'linear-gradient(90deg,rgba(47,204,195,.15),#2FCCC3)', boxShadow: '0 0 14px #2FCCC3', zIndex: 38, animation: 'chHint 1.1s ease-in-out infinite' }} />
        <span style={{ position: 'absolute', left: x1, top: y1 - 20, width: 30, height: 30, margin: '-15px 0 0 -15px', borderRadius: '50%', border: '4px solid #2FCCC3', boxShadow: '0 0 16px #2FCCC3', zIndex: 38, animation: 'chHint 1.1s ease-in-out infinite' }} />
      </>
    )
  }

  return (
    <ChessStage sk={SK} box={BOX} top={bar(top)} bottom={bar(bottom)} turnTop={!state.over && !result && state.turn === top} turnBottom={!state.over && !result && state.turn === bottom}
      evalPct={(count[bottom] / 16) * 100} over={over} overActions={overActions} actions={actions}>
      <div role="group" aria-label={t('games.coganh.boardAria')} style={{
        position: 'absolute', inset: 0, borderRadius: BOX.radius, overflow: 'hidden',
        background: 'radial-gradient(circle at 30% 25%,rgba(255,255,255,.25),transparent 40%),repeating-linear-gradient(0deg,rgba(255,255,255,0) 0 13px,rgba(160,210,120,.28) 13px 15px),repeating-linear-gradient(90deg,rgba(90,150,70,0) 0 9px,rgba(120,190,90,.35) 9px 11px),linear-gradient(160deg,#7fc2b0,#4f9a8a 55%,#3c7f72)',
      }}>
        {/* Bóng mây trôi trên mặt ruộng */}
        <span aria-hidden="true" style={{ position: 'absolute', inset: -30, background: 'radial-gradient(ellipse 80px 18px at 20% 30%,rgba(255,255,255,.18),transparent 70%),radial-gradient(ellipse 60px 14px at 70% 60%,rgba(255,255,255,.15),transparent 70%),radial-gradient(ellipse 90px 20px at 45% 85%,rgba(255,255,255,.14),transparent 70%)', animation: 'cgDrift 7s ease-in-out infinite alternate' }} />
        {/* Đường kẻ: bờ đất · bờ cỏ · vệt chấm sáng; giao điểm là cọc tròn */}
        <svg aria-hidden="true" width={FIELD} height={FIELD} style={{ position: 'absolute', inset: 0 }}>
          {[['#6b4a24', 16, 0.55], ['#a8c86a', 9, 1], ['#d7ea9a', 2, 0.9, '2 9']].map(([c, w, o, dash]) => (
            <g key={c} stroke={c} strokeWidth={w} strokeLinecap="round" opacity={o} strokeDasharray={dash}>
              {LINES.map(([a, b]) => {
                const [x1, y1] = pos(a)
                const [x2, y2] = pos(b)
                return <line key={a + '-' + b} x1={x1} y1={y1} x2={x2} y2={y2} />
              })}
            </g>
          ))}
          {state.board.map((_, i) => {
            const [x, y] = pos(i)
            return <circle key={i} cx={x} cy={y} r={11} fill="#8a6a3a" stroke="#d7ea9a" strokeWidth={2} />
          })}
        </svg>

        {/* Điểm bấm (một nút mỗi giao điểm, phủ cả người đứng trên đó) */}
        {state.board.map((v, i) => {
          const [x, y] = pos(i)
          const target = targets.includes(i)
          const mine = movable(i)
          return (
            <button key={'pt' + i} type="button" onClick={() => tap(i)} disabled={!canMove}
              aria-label={target ? t('games.coganh.toAria') : mine ? t('games.coganh.pieceAria') : t('games.coganh.pointAria', { r: Math.floor(i / 5) + 1, c: (i % 5) + 1 })}
              style={{
                position: 'absolute', left: x - 42, top: y - 60, width: 84, height: 84, borderRadius: '50%', border: 0, padding: 0, background: 'transparent', zIndex: 1,
                cursor: target || mine ? 'pointer' : 'default',
                boxShadow: sel === i ? '0 0 0 4px #ffe7a0, 0 0 26px #ffe7a0' : sel == null && forced.includes(i) ? '0 0 0 3px #c99a2e' : 'none',
              }} />
          )
        })}

        {/* Điểm bị mở — bắt buộc đi vào */}
        {forced.length > 0 && state.open != null && (() => {
          const [x, y] = pos(state.open)
          return <span aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 70, height: 70, borderRadius: '50%', border: '4px dashed #ffcf3a', boxShadow: '0 0 22px #ffcf3a', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 15, animation: 'chAura 1s ease-in-out infinite' }} />
        })()}
        {/* Điểm đi được */}
        {targets.map((i) => {
          const [x, y] = pos(i)
          return <span key={'t' + i} aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle,#fff6c8,#ffe07a 55%,rgba(255,224,122,0) 72%)', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 12, animation: 'chAura 1s ease-in-out infinite' }} />
        })}

        {/* Dân làng: ai vừa đi thì nhảy tới, ai vừa bị ăn thì lật sang làng mới, làng mình nhún chờ lượt */}
        {state.board.map((v, i) => {
          if (v == null) return null
          const [x, y] = pos(i)
          const row = Math.floor((flip ? 24 - i : i) / 5)
          const mover = last && i === last.to
          const turned = flipped.has(i)
          let anim
          if (mover) {
            const [x0, y0] = pos(last.from)
            anim = { '--dx': x0 - x + 'px', '--dy': y0 - y + 'px', animation: `cgHop ${HOP}s ease-out both` }
          } else if (sel === i) anim = { animation: 'cgBob .6s ease-in-out infinite' }
          else if (canMove && v === mySeat) anim = { animation: `cgBob 2.6s ease-in-out ${((i % 5) * 0.2).toFixed(1)}s infinite` }
          const img = { position: 'absolute', inset: 0, width: '100%', height: '100%', transformOrigin: '50% 90%' }
          return (
            <span key={i + '-' + v + (mover || turned ? '-' + ply : '')} aria-hidden="true" style={{ position: 'absolute', left: x - 42, top: y - 86, width: 84, height: 101, zIndex: row * 10 + 10 + (mover ? 5 : 0), pointerEvents: 'none', perspective: 400 }}>
              {turned ? (
                <>
                  <img src={VILLAGERS[1 - v]} alt="" style={{ ...img, opacity: 0, animation: `cgOut .7s ease-in-out ${HOP}s both` }} />
                  <img src={VILLAGERS[v]} alt="" style={{ ...img, animation: `cgIn .7s ease-in-out ${HOP}s both` }} />
                </>
              ) : <img src={VILLAGERS[v]} alt="" style={{ ...img, ...anim }} />}
            </span>
          )
        })}

        {tip}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60 }}>{fx}</div>
        {cut}
      </div>
    </ChessStage>
  )
}
