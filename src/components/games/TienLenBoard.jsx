import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { CARD, G, btn, card } from '#components/games/stage.js'
import { rnd, useFit } from '#components/games/chessUi.js'
import Card, { CardFace } from '#components/games/PlayingCard.jsx'
import tl, { comboOf, deadlineOf, faceOf, hintOf, RANK_FACES, rankOf } from '#lib/games/tienlen.js'
import { t } from '#i18n'

/**
 * Bàn Tiến lên (bản thiết kế "Tien Len", 2026-11-11): mặt bàn nỉ ở giữa, đối thủ ngồi trái / trên / phải (lá úp + số lá
 * còn + vòng đếm giờ lượt), bộ đang trên bàn bay ra từ ghế người đánh, bài trên tay mình xếp quạt ở đáy, nút
 * Gợi ý · Bỏ lượt · "Đánh · <bộ>". Chặt có chớp + chữ đóng dấu; hết ván có màn kết thúc đè lên bàn.
 * Bàn vẽ ở cỡ thiết kế DW × DH rồi co cho vừa (useFit); điện thoại dọc mà co quá nhỏ thì bắt xoay ngang.
 *
 * Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay mình,
 * hết ván trả mọi tay), bài còn lại = bài chia − các lá đã ra bàn (`state.gone`). Luật ở lib/games/tienlen.js; server
 * kiểm lại từng nước (0078 / 0094 / 0106). Đồng hồ lượt (0106): hết giờ máy tự báo { timeout }, server đi thay.
 *
 * Props chung của màn chơi (screens.js) + của sân khấu (GameRoom `stageProps`): `actions` nút dưới bàn, `overActions`
 * nút ở màn kết thúc, `note` { [ghế]: chữ mất kết nối }.
 */

const DW = 860
const DH = 660
const CY = 258 // tâm mặt bàn
const POS = { left: [96, CY], top: [DW / 2, 78], right: [DW - 96, CY], me: [DW / 2, 600] }
const LAY = { 2: ['top'], 3: ['left', 'right'], 4: ['left', 'top', 'right'] }

// Mặt bàn nỉ + lá bài: "vật" có màu riêng, giữ nguyên ở cả sáng / tối (DESIGN.md §2.4). Quanh bàn vẫn dùng token.
const TL = {
  felt: 'radial-gradient(ellipse at 50% 38%, #1d5a63, #103741 58%, #0a2129)',
  rim: '0 0 0 12px #172235, 0 0 0 13px rgba(148,163,184,.22), 0 50px 90px -24px rgba(0,0,0,.6), inset 0 0 60px rgba(0,0,0,.45)',
  dash: 'rgba(94,234,212,.22)',
  ink: '#9fc7c9',
  pill: 'rgba(4,20,26,.78)',
  gold: '#ffd27a',
  teal: '#5eead4',
  hot: '#f87171',
}

const side = (seat) => t('games.tienlen.mark' + seat)
const placeOf = (pos, n) => t(pos === n - 1 ? 'games.tienlen.placeLast' : 'games.tienlen.place' + pos)
const face = (c) => RANK_FACES[rankOf(c)]

/** Tên bộ để in lên bàn / nút: "7♥", "Đôi 7", "Sảnh 5–9", "3 đôi thông". */
function comboName(cards, bac) {
  const k = comboOf(cards, bac)
  if (!k) return ''
  if (k.kind === 'single') return faceOf(k.top)
  if (k.kind === 'straight') return t('games.tienlen.combo.straight', { a: face(Math.min(...cards)), b: face(k.top) })
  if (k.kind === 'pairs') return t('games.tienlen.combo.pairs', { n: k.len })
  return t('games.tienlen.combo.' + k.kind, { r: face(k.top) })
}

/** Đồng hồ máy, nhích 4 lần mỗi giây khi lượt có hạn giờ. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [on])
  return now
}

function usePortrait() {
  const q = '(orientation: portrait)'
  const [p, setP] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return undefined
    const f = () => setP(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return p
}

/** Ảnh người chơi + vòng đếm giờ (khi tới lượt). `pct` 0–100 hoặc null = không đồng hồ. */
function Seat({ name, src, size, active, pct, low, dim }) {
  const tc = low ? TL.hot : G.teal
  const ring = active ? (pct != null ? `conic-gradient(${tc} ${pct}%, ${G.line} 0)` : G.teal) : G.line
  return (
    <div style={{ position: 'relative', width: size + 10, height: size + 10, borderRadius: '50%', background: ring, display: 'grid', placeItems: 'center', boxShadow: active ? '0 0 28px ' + G.tealA(0.5) : 'none', opacity: dim ? 0.55 : 1, transition: 'opacity .3s' }}>
      <div style={{ borderRadius: '50%', border: '3px solid ' + G.card, lineHeight: 0 }}><Avatar name={name} src={src} size={size - 6} /></div>
    </div>
  )
}

export default function TienLenBoard({ state, mySeat, onMove, roomId, result, players, names, stake = 0, actions, overActions, note, hands: given }) {
  const { a, db } = useApp()
  const [ref, k] = useFit(DW)
  const portrait = usePortrait()
  const [dealt, setDealt] = useState(null) // { roomId, hands: { [seat]: cards } } | { roomId, failed }
  const [tries, setTries] = useState(0)
  // Chọn lá theo nước: bàn sang nước khác (ai đó vừa đi) là bỏ chọn, khỏi xoá state trong effect.
  const [pick, setPick] = useState({ ply: -1, cards: [] })
  const [peek, setPeek] = useState(false)
  const sel = pick.ply === state.ply ? pick.cards : []

  const seated = mySeat != null
  // Server chốt kết quả = phòng đã xong → RLS mở mọi tay: nạp lại để lật bài.
  const reveal = !!result
  useEffect(() => {
    if (given || (!seated && !reveal)) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setDealt({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setDealt({ roomId, failed: true }) })
    return () => { live = false }
  }, [a, roomId, seated, reveal, tries, given])

  // Chơi với máy (BotRoom) truyền sẵn `hands` (như game_hands: đang chơi chỉ tay mình, hết ván cả bàn) — khỏi hỏi server.
  const mine = given ? { hands: given } : dealt?.roomId === roomId ? dealt : null
  const left = (seat) => (mine?.hands?.[seat] || []).filter((c) => !state.gone.includes(c)).sort((x, y) => x - y)
  const hand = seated ? left(mySeat) : []
  const toggle = (c) => setPick({ ply: state.ply, cards: sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c] })

  const { table, last, over } = state
  const n = state.counts.length
  const myTurn = seated && !over && state.turn === mySeat
  // Ngoài lượt vẫn được chặt ngang bằng 4 đôi thông — nên ai còn trong ván cũng chọn bài được.
  const canPick = seated && !over && state.started && !state.out[mySeat]
  const move = sel.length ? { play: sel } : null
  const err = move ? tl.validate(state, mySeat, move) : null
  const play = () => { if (move && !err) { setPick({ ply: -1, cards: [] }); onMove(move) } }
  const pass = () => onMove({ pass: true })
  const [hintNone, setHintNone] = useState(-1) // ply mà Gợi ý không tìm được bộ nào
  const hint = () => {
    const h = hintOf(state, hand)
    if (h) setPick({ ply: state.ply, cards: h })
    else setHintNone(state.ply)
  }

  // Đồng hồ lượt → tự báo { timeout }: người tới lượt báo trước, người khác chờ thêm (phòng máy kia đã tắt).
  // Server đo bằng giờ của nó; chưa tới thì im lặng (games.err.notYet), mỗi 4 giây thử lại.
  const due = deadlineOf(state)
  const now = useNow(due != null && !result)
  const sent = useRef('')
  useEffect(() => {
    if (due == null || !seated || result) return
    const at = due + (state.turn === mySeat ? 300 : 2000 + ((mySeat - state.turn + n) % n) * 800)
    if (now < at) return
    const tag = state.ply + ':' + Math.floor((now - at) / 4000)
    if (sent.current === tag) return
    sent.current = tag
    onMove({ timeout: true })
  }, [due, seated, result, now, mySeat, state.turn, n, state.ply, onMove])
  const secs = due != null && !result ? Math.max(0, Math.ceil((due - now) / 1000)) : null
  const pct = secs != null && state.time ? Math.min(100, Math.round(((due - now) / (state.time * 1000)) * 100)) : null
  const low = secs != null && secs <= 5

  const memberOf = (seat) => db.members.find((m) => m.id === players?.find((p) => p.seat === seat)?.memberId)
  const nameOf = (seat) => names?.[seat] || side(seat)
  const who = (seat) => (seat === mySeat ? t('games.tienlen.youCap') : nameOf(seat))

  const tagOf = (seat) => {
    const pos = state.order.indexOf(seat)
    if (state.cong.includes(seat)) return [t('games.tienlen.cong'), 'hot']
    if (state.chot?.includes(seat)) return [t('games.tienlen.chot'), 'hot']
    if (state.left.includes(seat)) return [t('games.tienlen.out'), 'mute']
    if (pos >= 0) return [placeOf(pos, n), 'gold']
    if (!state.started || over) return null
    if (state.counts[seat] === 1) return [t('games.tienlen.oneLeft'), 'hot']
    if (state.passed[seat]) return [t('games.tienlen.pass'), 'mute']
    if (state.turn === seat) return [t('games.tienlen.thinking'), 'teal']
    return null
  }
  const TAG = {
    hot: [G.redA(0.16), G.red], mute: [G.inset, G.muted], gold: [G.goldA(0.14), G.goldHi], teal: [G.tealA(0.14), G.tealHi],
  }

  const base = mySeat ?? 0
  const lay = LAY[n] || []
  const slotOf = (seat) => (seat === base ? 'me' : lay[(seat - base + n) % n - 1])
  const posOf = (seat) => POS[slotOf(seat)] || POS.top
  const scores = (result || tl.result(state))?.scores

  // ── Nút Đánh: tên bộ đang chọn, hoặc lý do chưa đánh được. ──
  let playLabel = t('games.tienlen.play')
  if (sel.length) {
    playLabel = err === 'games.err.badCombo' ? t('games.tienlen.btnBad')
      : err === 'games.err.tooLow' ? t('games.tienlen.btnLow')
        : err ? t('games.tienlen.play')
          : t('games.tienlen.playAs', { combo: comboName(sel, state.bac) })
  }
  const canPlay = !!move && !err
  const canPass = myTurn && !!table

  // ── Dòng trạng thái của mình. ──
  let status
  let statusC = G.muted
  if (!state.started) status = t('games.tienlen.dealing')
  else if (over) status = t('games.tienlen.overState')
  else if (!seated) status = t('games.spectating')
  else if (state.out[mySeat]) status = state.order.includes(mySeat) ? t('games.tienlen.youPlaced', { place: placeOf(state.order.indexOf(mySeat), n) }) : t('games.tienlen.out')
  else if (sel.length && err && err !== 'games.err.badCombo' && err !== 'games.err.tooLow') { status = myTurn ? t(err) : t('games.tienlen.offTurnHint'); statusC = G.goldHi }
  else if (hintNone === state.ply && myTurn) { status = t('games.tienlen.noHint'); statusC = G.goldHi }
  else if (myTurn) { status = secs != null ? t('games.tienlen.myTurnClock', { n: secs }) : t('games.tienlen.myTurn'); statusC = low ? G.red : G.tealHi }
  else if (state.passed[mySeat]) status = t('games.tienlen.youPassed')
  else status = t('games.tienlen.waitFor', { name: state.turn != null ? who(state.turn) : '' })

  // ── Giữa bàn ──
  const chop = !!(last?.chop && table && last.seat === table.seat)
  let center = ''
  if (!table && state.started && !over) {
    center = state.low != null ? t('games.tienlen.firstLead', { side: who(state.turn), card: faceOf(state.low) })
      : state.ply <= 1 ? t('games.tienlen.leadAny', { name: who(state.turn) }) : ''
  }
  const freeNote = !table && state.started && !over && state.ply > 1 && state.turn != null ? t('games.tienlen.freeNote', { name: who(state.turn) }) : ''

  // ── Hiệu ứng (suy từ state, key theo ply — mỗi nước mới tự diễn lại) ──
  const fx = []
  if (state.started && state.ply <= 1 && !over) {
    for (let j = 0; j < 13; j++) {
      for (let s = 0; s < n; s++) {
        const [x, y] = posOf(s)
        fx.push(<span key={`d${roomId}${s}-${j}`} style={{
          position: 'absolute', left: x, top: y, width: 40, height: 56, borderRadius: 6, background: CARD.back, border: '2px solid ' + CARD.backLine,
          boxShadow: '0 6px 14px rgba(0,0,0,.5)', '--fx': DW / 2 - x + 'px', '--fy': CY - y + 'px', '--r': (rnd(j * 7 + s) - 0.5) * 30 + 'deg',
          opacity: 0, animation: `tlDeal .42s cubic-bezier(.3,.7,.2,1) ${((j * n + s) * 0.03).toFixed(2)}s forwards`, zIndex: 6,
        }} />)
      }
    }
  }
  if (chop) {
    const id = 'c' + state.ply
    fx.push(<div key={id + 'f'} style={{ position: 'absolute', left: DW / 2, top: CY, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,200,.95), rgba(245,120,60,.55) 30%, transparent 65%)', opacity: 0, animation: 'chFlash .7s ease-out forwards', zIndex: 6, mixBlendMode: 'screen' }} />)
    fx.push(<div key={id + 's'} style={{ position: 'absolute', left: DW / 2, top: CY, font: '800 64px/1 var(--font-display)', letterSpacing: '.02em', whiteSpace: 'nowrap', color: TL.gold, WebkitTextStroke: '2px #7a1d2a', textShadow: '0 0 30px rgba(245,120,60,.9), 0 6px 0 #5c1420', opacity: 0, animation: 'tlStamp 1.6s ease-out forwards', zIndex: 8 }}>
      {table.kind === 'quad' ? t('games.tienlen.chopQuad') : t('games.tienlen.chopPairs', { n: table.len })}
    </div>)
    for (let j = 0; j < 26; j++) {
      const ang = (j / 26) * Math.PI * 2
      const d = 120 + rnd(j * 5) * 140
      fx.push(<span key={id + 'b' + j} style={{ position: 'absolute', left: DW / 2, top: CY, width: 7, height: 12, background: [TL.gold, TL.hot, '#fde68a'][j % 3], clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d + 'px', opacity: 0, animation: `chBurst ${(0.8 + rnd(j) * 0.5).toFixed(2)}s cubic-bezier(.15,.7,.3,1) .1s forwards`, zIndex: 7 }} />)
    }
  }
  if (over && state.order.length) {
    const [x, y] = posOf(state.order[0])
    for (let j = 0; j < 40; j++) {
      const ang = (j / 40) * Math.PI * 2
      const d = 90 + rnd(j * 3) * 200
      fx.push(<span key={'w' + j} style={{ position: 'absolute', left: x, top: y, width: 8, height: 14, borderRadius: 2, background: [G.teal, G.gold, TL.hot, '#93c5fd'][j % 4], '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d + 'px', opacity: 0, animation: `chBurst ${(1 + rnd(j) * 0.6).toFixed(2)}s cubic-bezier(.15,.7,.3,1) forwards`, zIndex: 9 }} />)
    }
  }

  // ── Bộ đang trên bàn: bay ra từ ghế người đánh. ──
  const pile = []
  if (table) {
    const m = table.cards.length
    const sp = m > 8 ? 26 : 32
    const [ox, oy] = posOf(table.seat)
    table.cards.forEach((c, j) => {
      const off = (j - (m - 1) / 2) * sp
      const r = (rnd(state.ply * 3 + j) - 0.5) * 8
      pile.push(
        <span key={`p${state.ply}-${c}`} style={{
          position: 'absolute', left: DW / 2 + off, top: CY, width: 62, height: 88, borderRadius: 7, boxShadow: '0 10px 22px -6px rgba(0,0,0,.7)',
          transform: `translate(-50%, -50%) rotate(${r}deg)`, '--fx': ox - DW / 2 - off + 'px', '--fy': oy - CY + 'px', '--fr': (ox === DW / 2 ? 0 : 90) + 'deg', '--r': r + 'deg',
          animation: `tlFly .38s cubic-bezier(.3,.7,.2,1) ${(j * 0.035).toFixed(3)}s both`, zIndex: 2,
        }}><CardFace c={c} w={62} h={88} /></span>,
      )
    })
  }

  const ow = over && !peek
  const blocked = portrait && k < 0.6

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div ref={ref} style={{ width: '100%', maxWidth: DW, margin: '0 auto', height: DH * k, position: 'relative' }}>
        <div style={{
          ...card, width: DW, height: DH, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden', borderRadius: 24,
          background: `radial-gradient(700px 360px at 50% 40%, ${G.tealA(0.08)}, transparent 70%), ${G.card}`, userSelect: 'none', touchAction: 'manipulation',
        }}>
          {/* Mặt bàn */}
          <div style={{ position: 'absolute', left: DW / 2, top: CY, width: 500, height: 260, transform: 'translate(-50%, -50%)', borderRadius: 130, background: TL.felt, boxShadow: TL.rim }}>
            <div style={{ position: 'absolute', inset: 16, borderRadius: 114, border: '1px dashed ' + TL.dash }} />
            {center && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '0 60px', textAlign: 'center', font: '600 14px/1.4 var(--font-sans)', color: TL.ink }}>{center}</div>}
          </div>
          {state.bac && <span style={{ position: 'absolute', left: 20, top: 18, padding: '5px 11px', borderRadius: 99, background: G.inset, border: '1px solid ' + G.line, font: '600 12px/1 var(--font-sans)', color: G.muted }}>{t('games.tienlen.variantOpt.bac')}</span>}

          <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {pile}
            {fx}
          </div>

          {table && (
            <span aria-live="polite" style={{ position: 'absolute', left: DW / 2, top: CY + 76, transform: 'translateX(-50%)', display: 'flex', gap: 8, padding: '5px 12px', borderRadius: 99, background: TL.pill, border: '1px solid ' + (chop ? 'rgba(245,176,65,.5)' : 'rgba(148,163,184,.2)'), font: '700 12.5px/1.2 var(--font-sans)', color: chop ? TL.gold : '#cfe3e6', whiteSpace: 'nowrap', zIndex: 3 }}>
              {who(table.seat)} · {comboName(table.cards, state.bac)}
              {state.pot && <span style={{ color: TL.gold }}>{t('games.tienlen.potShort', { n: state.pot.amount })}</span>}
            </span>
          )}
          {freeNote && <span style={{ position: 'absolute', left: DW / 2, top: CY - 104, transform: 'translateX(-50%)', padding: '5px 12px', borderRadius: 99, background: 'rgba(45,212,191,.14)', border: '1px solid rgba(45,212,191,.45)', font: '700 12.5px/1.2 var(--font-sans)', color: TL.teal, whiteSpace: 'nowrap', zIndex: 3 }}>{freeNote}</span>}
          {last?.timeout && !over && <span style={{ position: 'absolute', left: DW / 2, top: CY + 108, transform: 'translateX(-50%)', font: '600 12px/1.2 var(--font-sans)', color: G.muted, whiteSpace: 'nowrap', zIndex: 3 }}>{t('games.tienlen.autoMove', { name: who(last.seat) })}</span>}

          {/* Đối thủ */}
          {Array.from({ length: n }, (_, s) => s).filter((s) => s !== base).map((s) => {
            const [x, y] = posOf(s)
            const cnt = state.counts[s]
            const active = state.started && !over && state.turn === s
            const tag = tagOf(s)
            const m = memberOf(s)
            return (
              <div key={s} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 4, width: 150 }}>
                <Seat name={m?.name || nameOf(s)} src={m?.avatarUrl} size={64} active={active} pct={active ? pct : null} low={low} dim={state.passed[s] && !over} />
                <span style={{ maxWidth: '100%', font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(s)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {cnt > 0 && (
                    <div style={{ display: 'flex', paddingLeft: 12 }}>
                      {[-10, 0, 10].slice(0, Math.min(3, cnt)).map((r) => <span key={r} style={{ marginLeft: -12, width: 20, height: 28, borderRadius: 4, background: CARD.back, border: '1.5px solid ' + CARD.backLine, transform: `rotate(${r}deg)` }} />)}
                    </div>
                  )}
                  <span style={{ font: '700 14px/1 var(--font-mono)', color: cnt <= 1 ? G.red : cnt <= 3 ? G.goldHi : G.sub, whiteSpace: 'nowrap' }}>{t('games.tienlen.nCards', { n: cnt })}</span>
                </div>
                {tag && <span style={{ padding: '3px 10px', borderRadius: 99, font: '700 11.5px/1.3 var(--font-sans)', whiteSpace: 'nowrap', background: TAG[tag[1]][0], color: TAG[tag[1]][1] }}>{tag[0]}</span>}
                {note?.[s] && <span style={{ font: '400 11px/1.2 var(--font-mono)', color: G.goldHi, whiteSpace: 'nowrap' }}>{note[s]}</span>}
              </div>
            )
          })}

          {/* Mình */}
          <div style={{ position: 'absolute', left: 24, top: 446, display: 'flex', alignItems: 'center', gap: 12, zIndex: 4, maxWidth: 300 }} aria-live="polite">
            <Seat name={memberOf(base)?.name || nameOf(base)} src={memberOf(base)?.avatarUrl} size={56} active={state.started && !over && state.turn === base} pct={pct} low={low} />
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nameOf(base)}{seated && <span style={{ fontWeight: 500, fontSize: 11, color: G.tealHi }}> {t('games.wait.youTag')}</span>}
              </span>
              <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: statusC }}>{status}</span>
              {!seated && <span style={{ font: '700 13px/1 var(--font-mono)', color: G.sub }}>{t('games.tienlen.nCards', { n: state.counts[base] ?? 0 })}</span>}
            </div>
          </div>

          {/* Nút */}
          {canPick && (
            <div style={{ position: 'absolute', right: 24, top: 452, display: 'flex', alignItems: 'center', gap: 8, zIndex: 4 }}>
              <button type="button" onClick={hint} disabled={!myTurn || !hand.length} style={{ ...btn('ghost'), padding: '12px 16px', opacity: myTurn ? 1 : 0.45 }}><Icon name="lightbulb" size={15} />{t('games.tienlen.hint')}</button>
              <button type="button" onClick={pass} disabled={!canPass} style={{ ...btn('ghost'), padding: '12px 18px', opacity: canPass ? 1 : 0.45, cursor: canPass ? 'pointer' : 'not-allowed' }}>{t('games.tienlen.pass')}</button>
              <button type="button" onClick={play} disabled={!canPlay} title={err ? t(err) : undefined} style={{
                ...btn('primary'), minWidth: 190, padding: '13px 22px', font: '800 15px/1 var(--font-sans)', transition: 'all .2s',
                ...(canPlay ? { boxShadow: '0 5px 0 ' + G.tealA(0.55) + ', 0 10px 30px -6px ' + G.tealA(0.7) }
                  : { background: G.inset, color: sel.length ? G.goldHi : G.muted, border: '1.5px solid ' + G.line, cursor: 'not-allowed' }),
              }}>{playLabel}</button>
            </div>
          )}

          {/* Bài trên tay */}
          {seated && state.started && (
            mine?.failed
              ? (
                <div style={{ position: 'absolute', left: '50%', bottom: 50, transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', zIndex: 5 }}>
                  <span style={{ font: 'var(--type-caption)', color: G.muted }}>{t('games.tienlen.handFailed')}</span>
                  <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((x) => x + 1)}>{t('games.tienlen.reloadHand')}</Button>
                </div>
              )
              : (
                <div role="group" aria-label={t('games.tienlen.handAria', { n: hand.length })} style={{
                  position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', display: 'flex', paddingLeft: 34, zIndex: 5,
                  animation: state.ply <= 1 ? 'skFade .4s ease-out 1.5s both' : undefined,
                }}>
                  {hand.map((c) => {
                    const on = sel.includes(c)
                    return (
                      <button key={c} type="button" disabled={!canPick} onClick={() => toggle(c)} aria-pressed={on} aria-label={faceOf(c)} style={{
                        position: 'relative', flex: 'none', marginLeft: -34, width: 72, height: 104, padding: 0, border: 0, borderRadius: 8, background: 'none',
                        cursor: canPick ? 'pointer' : 'default', transform: `translateY(${on ? -22 : 0}px)`, transition: 'transform .16s, box-shadow .16s',
                        boxShadow: on ? '0 0 0 2px ' + TL.teal + ', 0 14px 28px -6px rgba(45,212,191,.6)' : '0 8px 18px -8px rgba(0,0,0,.7)',
                      }}><CardFace c={c} w={72} h={104} /></button>
                    )
                  })}
                </div>
              )
          )}

          {/* Màn kết thúc */}
          {ow && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,8,16,.72)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center' }}>
              <div style={{ ...card, width: 460, maxHeight: DH - 40, overflow: 'auto', padding: '24px 24px 20px', borderRadius: 22, display: 'grid', gap: 14, boxShadow: '0 30px 80px -20px rgba(0,0,0,.9)' }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 4, textAlign: 'center' }}>
                  <span style={{ font: '600 11px/1 var(--font-mono)', letterSpacing: '.14em', color: G.muted }}>{t('games.tienlen.overLabel')}</span>
                  <span style={{ font: '800 30px/1.15 var(--font-display)', color: G.goldHi }}>
                    {state.order[0] === mySeat ? t('games.tienlen.overMe') : t('games.tienlen.overWin', { name: nameOf(state.order[0]) })}
                  </span>
                  {last?.white && <span style={{ font: 'var(--type-caption)', color: G.muted }}>{t('games.tienlen.lastWhite', { side: nameOf(last.seat) })}</span>}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {state.order.map((seat, pos) => {
                    const sc = scores?.[seat] ?? 0
                    const rest = left(seat)
                    const v = stake > 0 ? t('games.coins.stakeOpt', { n: (sc > 0 ? '+' : '') + (sc * stake).toLocaleString('vi-VN') }) : t('games.tienlen.points', { n: sc > 0 ? '+' + sc : sc })
                    return (
                      <div key={seat} style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 10, background: pos ? G.inset : G.goldA(0.1) }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto auto', gap: 10, alignItems: 'center' }}>
                          <Avatar name={memberOf(seat)?.name || nameOf(seat)} src={memberOf(seat)?.avatarUrl} size={26} />
                          <span style={{ font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(seat)}{seat === mySeat ? ' ' + t('games.wait.youTag') : ''}</span>
                          <span style={{ font: '400 12px/1.2 var(--font-sans)', color: G.muted, whiteSpace: 'nowrap' }}>
                            {placeOf(pos, n)}{state.counts[seat] > 0 ? ' · ' + t('games.tienlen.nCards', { n: state.counts[seat] }) : ''}{state.cong.includes(seat) ? ' · ' + t('games.tienlen.cong') : ''}
                          </span>
                          <span style={{ font: '700 14px/1 var(--font-mono)', color: sc > 0 ? G.tealHi : sc < 0 ? G.red : G.muted, minWidth: 62, textAlign: 'right' }}>{v}</span>
                        </div>
                        {state.counts[seat] > 0 && rest.length > 0 && <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', paddingLeft: 38 }}>{rest.map((c) => <Card key={c} c={c} w={30} />)}</div>}
                      </div>
                    )
                  })}
                </div>
                <span style={{ font: 'var(--type-caption)', color: G.muted, textAlign: 'center' }}>{t(result ? 'games.tienlen.scoreNote' : 'games.tienlen.scorePending')}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setPeek(true)} style={{ ...btn('ghost'), flex: 1, padding: 13 }}>{t('games.tienlen.viewTable')}</button>
                  {(overActions || []).map((x) => <button key={x.key} type="button" onClick={x.on} style={{ ...btn('primary'), flex: 1.4, padding: 13, font: '800 14px/1 var(--font-sans)' }}>{x.label}</button>)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Điện thoại dọc: bàn co quá nhỏ, không bấm nổi lá → bắt xoay ngang. */}
        {blocked && (
          <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 30, borderRadius: 24 * k, background: G.card, border: '1px solid ' + G.line, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, padding: 20, textAlign: 'center' }}>
            <Icon name="rotate-ccw" size={34} />
            <span style={{ font: '700 16px/1.3 var(--font-sans)' }}>{t('games.tienlen.rotate')}</span>
            <span style={{ font: 'var(--type-caption)', color: G.muted }}>{t('games.tienlen.rotateHint')}</span>
          </div>
        )}
      </div>

      {(actions?.length > 0 || (over && peek)) && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {over && peek && <button type="button" onClick={() => setPeek(false)} style={btn('soft', { sm: true })}>{t('games.tienlen.showResult')}</button>}
          {(actions || []).map((x) => (
            <button key={x.key} type="button" disabled={x.off} onClick={x.on} style={{ ...btn(x.danger ? 'danger' : 'ghost', { sm: true }), opacity: x.off ? 0.45 : 1 }}>
              <Icon name={x.icon} size={14} />{x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
