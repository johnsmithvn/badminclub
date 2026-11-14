import { useEffect, useRef, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { G, btn } from '#components/games/stage.js'
import { rnd, useFit } from '#components/games/chessUi.js'
import { Seat } from '#components/games/cardTable.jsx'
import bb, { deadlineOf, fits, KINDS, kindOf, mustCall, WIRES } from '#lib/games/baibip.js'

/**
 * Bàn Bài bịp (bản thiết kế "Bài bịp · Bom 6 dây", 2026-11-14): chiếu tím viền gỗ, tối đa 4 ghế (mình ở đáy, cạnh bài trên
 * tay), giữa bàn là lá chủ + chồng lá úp + câu vừa nhận. Mỗi ghế có quả bom nhỏ + 6 vạch dây. Bị tố thua → lớp phủ lật bài
 * rồi quả bom to 6 dây để cắt; cắt xong nổ / "phù" ngay trên ghế. Hai bố cục theo bề rộng khung (như Phỏm): rộng 788 × 760,
 * khung hẹp hơn 560px thì 374 × 560 (đối thủ xếp hàng trên). Co bằng useFit.
 *
 * Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp từ game_hands (RLS chỉ trả tay mình) — server bớt lá khi
 * đánh nên hàng đó luôn là bài còn lại; số lá đổi / sang ván mới là nạp lại. Luật: lib/games/baibip.js · server: 0082.
 */

// Chiếu, lá, bom: "vật" có màu riêng, giữ nguyên ở sáng / tối (DESIGN.md §2.4). Nút dưới bàn dùng token.
const BB = {
  felt: 'radial-gradient(ellipse 60% 45% at 50% 45%, rgba(151,117,250,.22), transparent 70%), radial-gradient(ellipse at 50% 50%, #2a1748 0%, #1c0f33 55%, #100820 100%)',
  rim: (r) => `0 40px 90px -30px rgba(0,0,0,.95), inset 0 0 0 ${r}px #2b1a10, inset 0 0 0 ${r + 3}px #9775fa, inset 0 0 80px rgba(0,0,0,.6)`,
  glass: 'rgba(10,8,24,.66)',
  line: 'rgba(255,255,255,.12)',
  ink: '#E9EFF7',
  sub: '#A8B7CB',
  mute: '#8494AA',
  lilac: '#d0bfff',
  teal: '#2FCCC3',
}
// Dây theo thứ tự 0..5 (server chỉ biết số thứ tự — màu là của máy khách).
const WIRE_INK = ['#ff4d4f', '#ff922b', '#ffd43b', '#51cf66', '#4dabf7', '#b197fc']

// Mặt lá Q / K / A / Joker theo bản thiết kế (khung 60 × 84). [viền, nền, hình]
const FACE = [
  ['#7048e8', '#f3f0ff', '<path d="M18 36 l4-10 4 6 4-9 4 9 4-6 4 10z" fill="#f0b75c" stroke="#5f3dc4" stroke-width="1.2"/><circle cx="30" cy="48" r="9" fill="#ffd8a8"/><path d="M21 47 q9-12 18 0 q-2-9-9-9 q-7 0-9 9z" fill="#5f3dc4"/><circle cx="27" cy="49" r="1.2" fill="#2a1800"/><circle cx="33" cy="49" r="1.2" fill="#2a1800"/><path d="M27.5 53 q2.5 2 5 0" stroke="#c2255c" stroke-width="1.2" fill="none"/><path d="M19 64 q11-9 22 0 v6 h-22z" fill="#9775fa"/>'],
  ['#1971c2', '#e7f5ff', '<path d="M17 34 h26 l-2-10-5 5-6-8-6 8-5-5z" fill="#f0b75c" stroke="#1864ab" stroke-width="1.2"/><circle cx="30" cy="46" r="9" fill="#ffd8a8"/><path d="M22 50 q8 10 16 0 q-1 8-8 8 q-7 0-8-8z" fill="#868e96"/><circle cx="27" cy="45" r="1.2" fill="#2a1800"/><circle cx="33" cy="45" r="1.2" fill="#2a1800"/><path d="M18 66 q12-9 24 0 v4 h-24z" fill="#4dabf7"/>'],
  ['#c92a2a', '#fff5f5', '<path d="M30 22 l5.5 12 13 1.2-9.8 8.8 2.9 12.8-11.6-6.8-11.6 6.8 2.9-12.8-9.8-8.8 13-1.2z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="1.5"/><circle cx="30" cy="42" r="4" fill="#fff"/>'],
  ['#2b8a3e', '#ebfbee', '<path d="M14 40 q8-16 16-6 q8-10 16 6 l-4 2 q-4-8-12-2 q-8-6-12 2z" fill="#f03e3e"/><path d="M30 34 q4-14 14-12 q-6 4-8 14z" fill="#ffd43b"/><path d="M30 34 q-4-14-14-12 q6 4 8 14z" fill="#4dabf7"/><circle cx="44" cy="22" r="2.5" fill="#ffd43b"/><circle cx="16" cy="22" r="2.5" fill="#4dabf7"/><circle cx="30" cy="50" r="8" fill="#ffd8a8"/><path d="M25 52 q5 5 10 0" stroke="#c2255c" stroke-width="1.5" fill="none"/><circle cx="27" cy="48" r="1.2"/><circle cx="33" cy="48" r="1.2"/><circle cx="30" cy="51" r="1.6" fill="#f03e3e"/>'],
]
const BACK_ART = '<defs><pattern id="bbBack" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="6" fill="#3b1d5a"/><rect x="3" width="3" height="6" fill="#2a1442"/></pattern></defs><rect x="1" y="1" width="58" height="82" rx="7" fill="#f3e6cc" stroke="#c9b48a" stroke-width="1.5"/><rect x="5" y="5" width="50" height="74" rx="5" fill="url(#bbBack)"/><text x="30" y="50" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="22" fill="#f0b75c">?</text>'

/** Một lá (kind = 0..3) hoặc lưng lá (kind null). Hình vẽ cố định trong file — không có dữ liệu người dùng. */
function Card({ kind, w }) {
  const art = kind == null ? BACK_ART : (() => {
    const [col, bg, pic] = FACE[kind]
    const lab = KINDS[kind] === 'J' ? 'JOKER' : KINDS[kind]
    const fs = kind === 3 ? 9 : 16
    return `<rect x="1" y="1" width="58" height="82" rx="7" fill="${bg}" stroke="${col}" stroke-width="2"/><text x="5" y="17" font-family="Barlow,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="${col}">${lab}</text>${pic}<text x="55" y="80" text-anchor="end" font-family="Barlow,Arial,sans-serif" font-weight="800" font-size="${kind === 3 ? 9 : 14}" fill="${col}">${lab}</text>`
  })()
  return <svg viewBox="0 0 60 84" width={w} height={Math.round(w * 1.4)} aria-hidden="true" style={{ display: 'block' }} dangerouslySetInnerHTML={{ __html: art }} />
}

/** Bom nhỏ trên ghế. */
function MiniBomb({ size }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', flex: 'none', width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #6c757d, #212529 55%, #000)', boxShadow: 'inset -3px -4px 6px rgba(0,0,0,.6)' }}>
      <span style={{ position: 'absolute', right: size * 0.05, top: -size * 0.18, width: size * 0.12, height: size * 0.3, borderRadius: 2, background: '#c9b48a', transform: 'rotate(30deg)' }} />
    </span>
  )
}

/**
 * Quả bom to 6 dây (khung 380 × 330 của bản thiết kế, co theo `k`). `onCut` có thì các dây còn lại bấm được.
 */
function BigBomb({ cuts, onCut, secs, k }) {
  return (
    <div style={{ width: 380 * k, height: 330 * k }}>
      <div role="img" aria-label={t('games.baibip.bombAria', { n: WIRES - cuts.length })} style={{ position: 'relative', width: 380, height: 330, transform: `scale(${k})`, transformOrigin: '0 0' }}>
        <span aria-hidden="true" style={{ position: 'absolute', left: 80, top: 55, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #868e96 0, #343a40 30%, #121417 65%, #000 100%)', boxShadow: 'inset -18px -22px 40px rgba(0,0,0,.7), 0 20px 50px rgba(0,0,0,.7)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 82, top: 152, width: 216, height: 26, borderRadius: '50%', border: '5px solid #adb5bd', opacity: 0.5, transform: 'translateY(-97px)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 247, top: 29, width: 28, height: 34, borderRadius: 6, background: 'linear-gradient(90deg, #868e96, #495057)', transform: 'rotate(30deg)' }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: 269, top: -7, width: 6, height: 44, borderRadius: 3, background: 'repeating-linear-gradient(0deg, #c9b48a 0 4px, #a0682c 4px 8px)', transform: 'rotate(38deg)', transformOrigin: '50% 100%' }} />
        <span data-game-fx aria-hidden="true" style={{ position: 'absolute', left: 291, top: -37, width: 26, height: 26 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0 20%, #ffd43b 40%, #ff6b00 65%, transparent 72%)', animation: 'gameFlash .5s ease-in-out infinite alternate' }} />
        </span>
        <span aria-hidden="true" style={{ position: 'absolute', left: 262, top: 103, width: 84, height: 124, borderRadius: 12, background: 'linear-gradient(180deg, #343a40, #212529)', border: '2px solid #868e96', boxShadow: '0 8px 20px rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }}>
          <span style={{ padding: '4px 7px', borderRadius: 6, background: '#1a0000', font: '700 18px/1.2 var(--font-mono)', color: '#ff3b3b', textShadow: '0 0 8px #ff3b3b' }}>
            {secs != null ? '00:' + String(secs).padStart(2, '0') : '--:--'}
          </span>
        </span>
        <span aria-hidden="true" style={{ position: 'absolute', left: 22, top: 95, width: 30, height: 140, borderRadius: 8, background: 'linear-gradient(90deg, #adb5bd, #495057)', boxShadow: '0 6px 16px rgba(0,0,0,.6)' }} />
        {WIRE_INK.map((col, w) => {
          const y = 92 + w * 30
          if (cuts.includes(w)) {
            return (
              <span key={w} aria-hidden="true">
                <span style={{ position: 'absolute', left: 48, top: y, width: 115, height: 13, borderRadius: 99, background: col, opacity: 0.5, transformOrigin: '0 50%', transform: 'rotate(16deg)' }} />
                <span style={{ position: 'absolute', left: 183, top: y, width: 115, height: 13, borderRadius: 99, background: col, opacity: 0.5, transformOrigin: '100% 50%', transform: 'rotate(-14deg)' }} />
              </span>
            )
          }
          return (
            <button key={w} type="button" disabled={!onCut} onClick={() => onCut?.(w)}
              aria-label={t('games.baibip.cutAria', { color: t('games.baibip.wire' + w) })}
              style={{ position: 'absolute', left: 48, top: y - 8, width: 250, height: 29, padding: 0, border: 0, background: 'none', cursor: onCut ? 'pointer' : 'default', touchAction: 'manipulation' }}>
              <span style={{ display: 'block', height: 13, borderRadius: 99, background: `linear-gradient(180deg, rgba(255,255,255,.55), ${col} 35%, ${col} 70%, rgba(0,0,0,.35))`, boxShadow: onCut ? `0 3px 6px rgba(0,0,0,.55), 0 0 10px ${col}` : '0 3px 6px rgba(0,0,0,.55)' }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Vị trí theo bản thiết kế. `box` = khung ghế đối thủ [tâm x, đỉnh y, rộng]; `pt` = điểm giữa ghế (cho bay lá, hiệu ứng).
const WIDE = {
  w: 788, h: 760, radius: 34, rim: 10, center: [394, 320], tw: 64, pile: [84, 100], hw: 70, hstep: 74, av: 32, bw: 24, bstep: 10, bomb: 1,
  box: { top: [394, 20, 230], left: [122, 200, 196], right: [666, 200, 196] },
  pt: { top: [394, 90], left: [122, 270], right: [666, 270], me: [394, 680] },
}
const NARROW = {
  w: 374, h: 560, radius: 24, rim: 6, center: [187, 240], tw: 44, pile: [60, 70], hw: 60, hstep: 64, av: 24, bw: 18, bstep: 6, bomb: 0.7,
  box: { left: [63, 8, 118], top: [187, 8, 118], right: [311, 8, 118] },
  pt: { left: [63, 60], top: [187, 60], right: [311, 60], me: [187, 470] },
}
// Người kế tiếp mình theo chiều kim đồng hồ: phải → trên → trái.
const LAY = { 2: ['top'], 3: ['right', 'left'], 4: ['right', 'top', 'left'] }

function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}
const kindName = (k) => t('games.baibip.kind' + KINDS[k])

export default function BaiBipBoard({ state, mySeat, roomId, onMove, result, players, names, actions, overActions, note, hands: given }) {
  const { db, a } = useApp()
  const [ref, k0] = useFit(WIDE.w)
  const narrow = k0 * WIDE.w < 560
  const L = narrow ? NARROW : WIDE
  const k = narrow ? Math.min(1, (k0 * WIDE.w) / NARROW.w) : k0
  const [got, setGot] = useState(null) // { roomId, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [pick, setPick] = useState({ ply: -1, cards: [] })
  const seated = mySeat != null
  const reveal = !!result
  const myCount = seated ? state.counts[mySeat] ?? 0 : 0
  useEffect(() => {
    if (given || (!seated && !reveal)) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setGot({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setGot({ roomId, failed: true }) })
    return () => { live = false }
    // Đánh xong (số lá đổi) hoặc sang ván mới → nạp lại tay.
  }, [a, roomId, seated, reveal, state.round, myCount, tries, given])

  // Chơi với máy (BotRoom) truyền sẵn `hands` (như game_hands) — khỏi hỏi server.
  const mine = given ? { hands: given } : got?.roomId === roomId ? got : null
  // Chờ chia ván mới: tay cũ đã hết hiệu lực (server sẽ chia lại) — không hiện nữa.
  const hand = seated && state.phase !== 'redeal' ? [...(mine?.hands?.[mySeat] || [])].sort((x, y) => x - y) : []
  const sel = pick.ply === state.ply ? pick.cards.filter((c) => hand.includes(c)) : []
  const myTurn = seated && !state.over && state.turn === mySeat && !state.out[mySeat]
  const canPlay = myTurn && state.phase === 'play'
  const forced = canPlay && !!state.lastPlay && mustCall(state, mySeat)
  const canCall = canPlay && bb.validate(state, mySeat, { call: true }) == null
  const toggle = (c) => {
    if (!canPlay || forced) return
    const next = sel.includes(c) ? sel.filter((x) => x !== c) : sel.length < 3 ? [...sel, c] : sel
    setPick({ ply: state.ply, cards: next })
  }
  const { last, reveal: shown, table } = state

  // Hết giờ lượt → tự báo { timeout }: người tới lượt báo trước, người khác chờ thêm (phòng máy kia đã tắt).
  // Server đo bằng giờ của nó; chưa tới thì im lặng, mỗi 4 giây thử lại.
  const due = deadlineOf(state)
  const now = useNow(due != null && !result)
  const sent = useRef('')
  const alive = seated && !state.out[mySeat]
  useEffect(() => {
    if (due == null || !alive || result) return
    const at = due + (state.turn === mySeat ? 300 : 2000 + ((mySeat - state.turn + state.n) % state.n) * 800)
    if (now < at) return
    const tag = state.ply + ':' + Math.floor((now - at) / 4000)
    if (sent.current === tag) return
    sent.current = tag
    onMove({ timeout: true })
  }, [due, alive, result, now, mySeat, state.turn, state.n, state.ply, onMove])
  const secs = due != null && !result ? Math.max(0, Math.ceil((due - now) / 1000)) : null

  const memberOf = (seat) => db.members.find((m) => m.id === players?.find((p) => p.seat === seat)?.memberId)
  const nameOf = (seat) => names?.[seat] || memberOf(seat)?.name || t('games.baibip.mark' + seat)
  const who = (seat) => (seat === mySeat ? t('games.baibip.youCap') : nameOf(seat))
  const base = mySeat ?? 0
  const slotOf = (seat) => (seat === base ? 'me' : (LAY[state.n] || LAY[4])[(seat - base + state.n) % state.n - 1])
  const ptOf = (seat) => L.pt[slotOf(seat)] || L.center
  const wiresLeft = (seat) => WIRES - (state.cuts[seat] || []).length
  const aliveN = state.out.filter((o) => !o).length
  const [cx, cy] = L.center

  // ── Hiệu ứng theo nước vừa đi (khoá theo ply để chạy lại mỗi nước). ──
  const fx = []
  const stamp = (key, [x, y], text, bg, fs, color = '#fff', delay = 0) => fx.push(
    <div key={key} style={{ position: 'absolute', left: x, top: y, padding: '5px 14px', borderRadius: 99, background: bg, color, font: `800 ${fs}px/1.2 var(--font-display)`, whiteSpace: 'nowrap', boxShadow: '0 8px 20px rgba(0,0,0,.5)', opacity: 0, animation: `tlStamp 1.8s ease-out ${delay}s forwards`, zIndex: 60 }}>{text}</div>,
  )
  const burst = (key, [x, y], colors, nb = 26) => {
    for (let j = 0; j < nb; j++) {
      const ang = (j / nb) * Math.PI * 2
      const d = (60 + rnd(j * 5 + 1) * 120) * (narrow ? 0.6 : 1)
      fx.push(<span key={key + j} style={{ position: 'absolute', left: x, top: y, width: 9, height: 9, borderRadius: j % 2 ? 2 : '50%', background: colors[j % colors.length], '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d + 'px', opacity: 0, animation: `chBurst ${(0.8 + rnd(j) * 0.5).toFixed(2)}s cubic-bezier(.15,.7,.3,1) forwards`, zIndex: 58 }} />)
    }
  }
  const ply = state.ply
  const pileAt = [cx + (L.tw + L.pile[0]) / 2 - 8, cy - (narrow ? 30 : 42)]
  if (last?.play != null && state.lastPlay) {
    const [x0, y0] = ptOf(state.lastPlay.seat)
    for (let j = 0; j < state.lastPlay.n; j++) {
      fx.push(
        <span key={'fly' + ply + j} style={{ position: 'absolute', left: pileAt[0] + j * 6, top: pileAt[1], '--fx': x0 - pileAt[0] + 'px', '--fy': y0 - pileAt[1] + 'px', '--fr': '-14deg', '--r': (j - 1) * 8 + 'deg', transform: 'translate(-50%, -50%)', animation: `tlFly .45s cubic-bezier(.3,.6,.3,1) ${(j * 0.08).toFixed(2)}s both`, zIndex: 30 }}>
          <Card kind={null} w={narrow ? 32 : 44} />
        </span>,
      )
    }
  }
  if (last?.call && shown) stamp('call' + ply, [ptOf(shown.caller)[0], ptOf(shown.caller)[1] - 30], t('games.baibip.call'), '#e03131', narrow ? 18 : 26)
  if (last?.cut !== undefined && last.seat != null) {
    const p = ptOf(last.seat)
    if (last.boom) {
      fx.push(<span key={'flash' + ply} style={{ position: 'absolute', left: p[0], top: p[1], width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, #fff 0 15%, #ffd43b 30%, #ff6b00 55%, rgba(200,30,0,.6) 70%, transparent 75%)', opacity: 0, animation: 'chFlash 1s ease-out forwards', zIndex: 57 }} />)
      burst('boom' + ply, p, ['#ffd43b', '#ff6b00', '#ff4d4f', '#495057'])
      stamp('bw' + ply, p, t('games.baibip.boomWord'), '#c92a2a', narrow ? 22 : 34)
    } else {
      stamp('safe' + ply, p, t('games.baibip.safe'), '#2b8a3e', narrow ? 13 : 18)
    }
  }
  if ((last?.deal || last?.cut !== undefined || ply === 0) && state.phase === 'play' && !state.over) stamp('deal' + ply, [cx, cy - (narrow ? 50 : 70)], t('games.baibip.tableBanner', { kind: kindName(table) }), '#7048e8', narrow ? 15 : 22, '#fff', last?.cut !== undefined ? 0.9 : 0)
  if (state.over && state.winner != null) burst('win' + ply, ptOf(state.winner), [BB.teal, '#F0B75C', '#d0bfff', '#ffd43b'], 40)

  const statusOf = (seat) => {
    if (state.over && state.winner === seat) return [t('games.baibip.stWin'), '#E08A00', '#2a1800']
    if (state.blown[seat]) return [t('games.baibip.blownTag'), '#5b6470', '#fff']
    if (state.out[seat]) return [t('games.baibip.outTag'), '#5b6470', '#fff']
    if (state.over) return null
    if (state.phase === 'cut' && state.cutter === seat) return [t('games.baibip.stCut'), 'rgba(255,107,107,.18)', '#ff8787']
    if (state.phase !== 'cut' && state.turn === seat) return [seat === mySeat ? t('games.baibip.stMe') : t('games.baibip.stThink'), 'rgba(47,204,195,.16)', BB.teal]
    return null
  }

  const panel = (seat) => {
    const on = !state.over && state.phase !== 'cut' && state.turn === seat && !state.out[seat]
    const dead = !!state.blown[seat] || !!state.out[seat]
    const m = memberOf(seat)
    const n = state.counts[seat] ?? 0
    const left = wiresLeft(seat)
    const st = statusOf(seat)
    return (
      <div style={{
        position: 'relative', display: 'grid', gap: narrow ? 4 : 5, padding: narrow ? '6px 8px' : '9px 12px', borderRadius: 16, background: BB.glass,
        border: '1.5px solid ' + (dead ? 'rgba(255,255,255,.06)' : on ? BB.teal : BB.line),
        boxShadow: on ? '0 0 0 2px rgba(47,204,195,.35), 0 0 30px -6px ' + BB.teal : 'none', opacity: dead ? 0.45 : 1, transition: 'box-shadow .3s, border-color .3s, opacity .5s',
      }}>
        {state.blown[seat] && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'radial-gradient(circle at 50% 40%, rgba(0,0,0,.5), transparent 70%), repeating-radial-gradient(circle at 30% 60%, rgba(0,0,0,.25) 0 3px, transparent 3px 9px)', pointerEvents: 'none' }} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Seat name={m?.name || nameOf(seat)} src={m?.avatarUrl} size={L.av} active={on} pct={on && secs != null && state.opts?.time ? secs / state.opts.time : undefined} low={on && secs != null && secs <= 5} />
          <div style={{ display: 'grid', minWidth: 0 }}>
            <span style={{ font: `700 ${narrow ? 11.5 : 13.5}px/1.2 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who(seat)}</span>
            <span style={{ font: `400 ${narrow ? 9.5 : 10.5}px/1.3 var(--font-mono)`, color: BB.sub }}>{state.blown[seat] ? t('games.baibip.blownTag') : t('games.baibip.cardsLeft', { n })}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px 8px', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MiniBomb size={narrow ? 18 : 26} />
            {!state.blown[seat] && <span style={{ font: `600 ${narrow ? 9.5 : 11}px/1.2 var(--font-mono)`, color: left <= 2 ? '#ff8787' : BB.sub, whiteSpace: 'nowrap' }}>{t('games.baibip.wiresLeft', { n: left })}</span>}
          </span>
          <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(6, ${narrow ? 4 : 5}px)`, gap: 2 }}>
            {WIRE_INK.map((c, w) => {
              const cut = (state.cuts[seat] || []).includes(w)
              return <span key={w} style={{ height: narrow ? 10 : 13, borderRadius: 3, background: cut ? 'rgba(255,255,255,.18)' : c, opacity: cut ? 0.5 : 1 }} />
            })}
          </span>
        </div>
        {seat !== mySeat && n > 0 && (
          <div aria-hidden="true" style={{ position: 'relative', height: Math.round(L.bw * 1.4), width: (n - 1) * L.bstep + L.bw }}>
            {Array.from({ length: n }, (_, j) => <span key={j} style={{ position: 'absolute', left: j * L.bstep, top: 0, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.45))' }}><Card kind={null} w={L.bw} /></span>)}
          </div>
        )}
        {st && <span style={{ justifySelf: 'start', padding: '1px 8px', borderRadius: 99, background: st[1], color: st[2], font: `800 ${narrow ? 10 : 11}px/1.5 var(--font-sans)`, whiteSpace: 'nowrap' }}>{st[0]}</span>}
        {note?.[seat] && <span style={{ font: '400 10px/1.2 var(--font-mono)', color: '#F0B75C', whiteSpace: 'nowrap' }}>{note[seat]}</span>}
      </div>
    )
  }

  const handRow = hand.length > 0 && (
    <div role="group" aria-label={t('games.baibip.handAria', { n: hand.length })} style={{ position: 'relative', flex: 'none', height: Math.round(L.hw * 1.4) + 20, width: (hand.length - 1) * L.hstep + L.hw }}>
      {hand.map((c, i) => {
        const on = sel.includes(c)
        const ok = fits(c, table)
        return (
          <button key={c} type="button" onClick={canPlay && !forced ? () => toggle(c) : undefined} aria-pressed={on}
            aria-label={kindName(kindOf(c)) + (ok ? t('games.baibip.fitsAria') : '')}
            style={{
              position: 'absolute', left: i * L.hstep, top: 18, padding: 0, border: 0, borderRadius: 8, background: 'none', cursor: canPlay && !forced ? 'pointer' : 'default', touchAction: 'manipulation',
              transform: on ? 'translateY(-16px)' : 'none', transition: 'transform .18s',
              boxShadow: on ? '0 0 0 3px ' + BB.teal + ', 0 10px 22px rgba(0,0,0,.5)' : ok ? '0 0 0 2px rgba(240,183,92,.55), 0 4px 10px rgba(0,0,0,.45)' : '0 4px 10px rgba(0,0,0,.45)',
            }}>
            <Card kind={kindOf(c)} w={L.hw} />
          </button>
        )
      })}
    </div>
  )

  const loser = shown ? (shown.liar ? shown.seat : shown.caller) : null
  let claim
  if (last?.out) claim = t('games.baibip.lastOut', { side: who(last.seat) })
  else if (state.lastPlay && state.phase === 'play') claim = t('games.baibip.lastPlay', { side: who(state.lastPlay.seat), n: state.lastPlay.n, kind: kindName(table) })
  else claim = t('games.baibip.noClaim')

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div ref={ref} style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', justifyItems: 'center' }}>
        <div style={{ width: L.w * k, height: L.h * k, position: 'relative' }}>
          <div style={{ width: L.w, height: L.h, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden', borderRadius: L.radius, background: BB.felt, boxShadow: BB.rim(L.rim), color: BB.ink, userSelect: 'none' }}>
            {/* Đối thủ */}
            {Array.from({ length: state.n }, (_, s) => s).filter((s) => s !== base).map((s) => {
              const [x, y, w] = L.box[slotOf(s)] || L.box.top
              return <div key={s} style={{ position: 'absolute', left: x - w / 2, top: y, width: w, zIndex: 10 }}>{panel(s)}</div>
            })}

            {/* Giữa bàn */}
            <div style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)', display: 'grid', justifyItems: 'center', gap: narrow ? 6 : 8, zIndex: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 16 : 26 }}>
                {table != null && (
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                    <span style={{ font: '600 10px/1.2 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: BB.lilac }}>{t('games.baibip.tableCard')}</span>
                    <span role="img" aria-label={t('games.baibip.tableCard') + ' ' + kindName(table)} style={{ borderRadius: 8, boxShadow: '0 0 0 3px #d0bfff, 0 0 26px #9775fa' }}><Card kind={table} w={L.tw} /></span>
                  </div>
                )}
                <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                  <span aria-hidden="true" style={{ position: 'relative', width: L.pile[0], height: L.pile[1] }}>
                    {Array.from({ length: Math.min(state.pile, 8) }, (_, i) => (
                      <span key={i} style={{ position: 'absolute', left: (L.pile[0] - L.tw) / 2 + (((i * 13) % 20) - 10) * (narrow ? 0.6 : 1), top: 5, transform: `rotate(${((i * 37) % 30) - 15}deg)`, filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.5))' }}><Card kind={null} w={L.tw} /></span>
                    ))}
                  </span>
                  <span style={{ font: `400 ${narrow ? 10.5 : 12}px/1.2 var(--font-mono)`, color: BB.sub }}>{t('games.baibip.pile', { n: state.pile })}</span>
                </div>
              </div>
              <span aria-live="polite" style={{ maxWidth: narrow ? 300 : 320, padding: '5px 14px', borderRadius: 99, background: 'rgba(4,8,20,.6)', border: '1px solid rgba(208,191,255,.4)', font: `700 ${narrow ? 12 : 13}px/1.3 var(--font-sans)`, color: '#e5dbff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{claim}</span>
              <span style={{ font: '600 10px/1.3 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: BB.mute }}>{t('games.baibip.roundTxt', { n: state.round, m: aliveN })}</span>
              {last?.timeout && <span style={{ font: '400 11px/1.3 var(--font-sans)', color: BB.sub }}>{t('games.baibip.autoMove', { side: who(last.seat) })}</span>}
            </div>

            {/* Mình: ghế + bài trên tay */}
            {seated && (
              <div style={narrow
                ? { position: 'absolute', left: 8, right: 8, bottom: 10, display: 'grid', justifyItems: 'center', gap: 2, zIndex: 20 }
                : { position: 'absolute', left: 30, right: 30, bottom: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 22, zIndex: 20 }}>
                <div style={{ width: narrow ? 220 : 200 }}>{panel(mySeat)}</div>
                {handRow}
              </div>
            )}

            <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{fx}</div>

            {/* Tố: lật bài + quả bom của người thua */}
            {state.phase === 'cut' && state.cutter != null && !state.over && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'grid', alignContent: 'center', justifyItems: 'center', gap: narrow ? 8 : 14, background: 'radial-gradient(circle at 50% 50%, rgba(60,0,10,.55), rgba(4,2,10,.85))' }}>
                {shown && (
                  <div style={{ display: 'grid', justifyItems: 'center', gap: narrow ? 6 : 10, padding: narrow ? '10px 14px' : '16px 22px', borderRadius: 20, background: 'rgba(20,12,40,.92)', border: '2px solid #ff6b6b', boxShadow: '0 0 50px -10px #ff6b6b' }}>
                    <span style={{ font: `italic 800 ${narrow ? 18 : 26}px/1.2 var(--font-display)`, color: '#fff' }}>{t('games.baibip.called', { caller: who(shown.caller), side: who(shown.seat) })}</span>
                    <div data-game-fx style={{ display: 'flex', gap: narrow ? 6 : 10 }}>
                      {shown.cards.map((c, i) => {
                        const ok = fits(c, table)
                        return (
                          <span key={c} role="img" aria-label={kindName(kindOf(c))} style={{ position: 'relative', borderRadius: 8, animation: `gameFlip .5s ease-out ${(0.2 + i * 0.2).toFixed(2)}s both` }}>
                            <Card kind={kindOf(c)} w={narrow ? 46 : 70} />
                            <span aria-hidden="true" style={{ position: 'absolute', right: -6, top: -6, width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', background: ok ? '#2b8a3e' : '#e03131', color: '#fff', font: '800 13px/1 var(--font-sans)' }}>{ok ? '✓' : '✕'}</span>
                          </span>
                        )
                      })}
                    </div>
                    <span style={{ font: `800 ${narrow ? 13 : 15}px/1.3 var(--font-sans)`, color: shown.liar ? '#ff8787' : '#9be15d' }}>
                      {t(shown.liar ? 'games.baibip.liar' : 'games.baibip.truth', { side: who(shown.seat), loser: who(loser) })}
                    </span>
                  </div>
                )}
                <div style={{ display: 'grid', justifyItems: 'center', gap: 2, textAlign: 'center' }}>
                  <span style={{ font: `italic 800 ${narrow ? 17 : 24}px/1.2 var(--font-display)`, color: '#fff' }}>
                    {state.cutter === mySeat ? t('games.baibip.cutHint') : t('games.baibip.waitCut', { side: who(state.cutter) })}
                  </span>
                  <span style={{ font: '400 12px/1.3 var(--font-mono)', color: '#ffa8a8' }}>{t('games.baibip.cutOdds', { n: wiresLeft(state.cutter) })}</span>
                </div>
                <BigBomb cuts={state.cuts[state.cutter] || []} secs={secs} k={L.bomb * (narrow ? 0.85 : 1)}
                  onCut={state.cutter === mySeat && myTurn ? (w) => onMove({ cut: w }) : undefined} />
              </div>
            )}

            {/* Hết trận: người sống sót */}
            {state.over && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 75, background: 'rgba(4,2,12,.7)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center' }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 10, padding: '20px 28px', borderRadius: 22, background: 'rgba(20,12,40,.95)', border: '2px solid #ffcf3a', boxShadow: '0 0 60px -10px #ffcf3a', textAlign: 'center', maxWidth: L.w - 32 }}>
                  <span style={{ font: `italic 800 ${narrow ? 24 : 34}px/1.2 var(--font-display)` }}>
                    {state.winner == null ? t('games.scoring') : state.winner === mySeat ? t('games.baibip.winMe') : t('games.baibip.winOther', { side: nameOf(state.winner) })}
                  </span>
                  {state.winner != null && <span style={{ font: '400 14px/1.4 var(--font-sans)', color: '#F0B75C' }}>{t('games.baibip.winSub', { n: wiresLeft(state.winner) })}</span>}
                  {(overActions || []).map((x) => <button key={x.key} type="button" onClick={x.on} style={{ ...btn('primary'), padding: '11px 26px', pointerEvents: 'auto' }}>{x.label}</button>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dưới bàn: nút đánh / tố, chờ, chia lại */}
      <div style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {seated && mine?.failed && !state.over && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={S.hint}>{t('games.baibip.handFailed')}</span>
            <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((x) => x + 1)}>{t('games.tienlen.reloadHand')}</Button>
          </div>
        )}
        {canPlay && (
          <>
            <span style={S.hint}>
              {forced ? t('games.baibip.mustCallHint') : t('games.baibip.fitHint', { kind: kindName(table) }) + (secs != null ? t('games.baibip.secsLeft', { n: secs }) : '')}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {!forced && (
                <button type="button" disabled={!sel.length} onClick={() => onMove({ play: sel })}
                  style={{ ...btn('primary'), flex: 1, minHeight: 48, padding: '0 14px', font: '800 15px/1.2 var(--font-sans)', opacity: sel.length ? 1 : 0.42 }}>
                  {sel.length ? t('games.baibip.play', { n: sel.length, kind: kindName(table) }) : t('games.baibip.pickHint')}
                </button>
              )}
              {canCall && (
                <button type="button" onClick={() => onMove({ call: true })}
                  style={{ flex: forced ? 1 : 'none', minHeight: 48, padding: '0 22px', borderRadius: 12, border: 0, background: '#e03131', color: '#fff', font: '800 19px/1 var(--font-display)', boxShadow: '0 0 24px -6px #ff6b6b', cursor: 'pointer' }}>
                  {t('games.baibip.call')}
                </button>
              )}
            </div>
          </>
        )}
        {seated && mine && !mine.failed && !state.over && !state.out[mySeat] && state.phase === 'play' && !hand.length && <span style={S.hint}>{t('games.baibip.noCards')}</span>}
        {!state.over && state.phase === 'play' && !canPlay && (
          <span style={{ ...S.hint, padding: '10px 0' }}>{seated && state.blown[mySeat] ? t('games.baibip.meBlown') : t('games.baibip.waitFor', { side: who(state.turn) })}</span>
        )}
        {!state.over && state.phase === 'redeal' && (
          myTurn
            ? (
              <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                <span style={S.hint}>{t('games.baibip.redealHint')}</span>
                <Button icon="repeat" onClick={() => onMove({ deal: true })}>{t('games.baibip.redeal')}</Button>
              </div>
            )
            : <span style={{ ...S.hint, padding: '10px 0' }}>{t('games.baibip.waitDeal', { side: who(state.turn) })}</span>
        )}
        {actions?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {actions.map((x) => (
              <button key={x.key} type="button" disabled={x.off} onClick={x.on} style={{ ...btn(x.danger ? 'danger' : 'ghost', { sm: true }), opacity: x.off ? 0.45 : 1 }}>{x.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  hint: { font: '400 12.5px/1.4 var(--font-sans)', color: G.muted, textAlign: 'center' },
}
