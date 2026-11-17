import { useEffect, useRef, useState } from 'react'
import { Avatar, Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { CARD, G, btn } from '#components/games/stage.js'
import { rnd, useFit } from '#components/games/chessUi.js'
import Card, { CardFace } from '#components/games/PlayingCard.jsx'
import { Overlay, Seat } from '#components/games/cardTable.jsx'
import tl, { comboOf, deadlineOf, faceOf, groupsOf, hintOf, isBomb, isHeo, playsOf, RANK_FACES, rankOf } from '#lib/games/tienlen.js'
import { t } from '#i18n'

/**
 * Bàn Tiến lên (bản thiết kế "Tien Len", 2026-11-11): mặt bàn nỉ ở giữa, đối thủ ngồi trái / trên / phải (lá úp + số lá
 * còn + vòng đếm giờ lượt), bộ đang trên bàn bay ra từ ghế người đánh, bài trên tay mình xếp quạt ở đáy, nút
 * Gợi ý · Bỏ lượt · "Đánh · <bộ>". Chặt có chớp + chữ đóng dấu; hết ván có màn kết thúc đè lên bàn.
 * Cả 3 bố cục là chiếu nỉ xanh viền gỗ nguyên khối (bản thiết kế). Rộng — bàn 788 × 760, đối thủ hộp kính trái / trên / phải,
 * quạt bài xoè cong, hàng [Bỏ lượt][Đánh][Gợi ý] + dòng trạng thái DƯỚI bàn; khung
 * hẹp hơn 560px (điện thoại dọc) — bàn 374 × 480, đối thủ một hàng trên cùng, nút xuống dưới bàn. Co bằng useFit.
 * `land` (khung xoay ngang của GameRoom) — 844 × 390: đối thủ thẻ ngang, quạt bài giữa đáy, nút + xin thua cột phải.
 *
 * Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay mình,
 * hết ván trả mọi tay), bài còn lại = bài chia − các lá đã ra bàn (`state.gone`). Luật ở lib/games/tienlen.js; server
 * kiểm lại từng nước (0078 / 0094 / 0106). Đồng hồ lượt (0106): hết giờ máy tự báo { timeout }, server đi thay.
 *
 * Props chung của màn chơi (screens.js) + của sân khấu (GameRoom `stageProps`): `actions` nút dưới bàn, `overActions`
 * nút ở màn kết thúc, `note` { [ghế]: chữ mất kết nối }.
 */

// `cy` tâm mặt bàn, `pos` tâm từng chỗ ngồi (lá chia / lá đánh bay từ đó), `pill` / `free` / `auto` chữ trên / dưới mặt bàn.
// Bàn rộng = bản thiết kế "Tiến lên · máy tính": cả chiếu 788 × 760, đối thủ hộp kính (`at`), quạt bài xoè cong (`fan`).
const WIDE = {
  w: 788, h: 760, rim: 10, radius: 34, cy: 320, pos: { left: [98, 300], top: [394, 86], right: [690, 300], me: [394, 640] },
  seat: 34, me: 32, hand: [74, 104], pile: [56, 78], gap: [30, 22], pill: 58, auto: 92,
  at: { top: { left: 394, top: 22, transform: 'translateX(-50%)' }, left: { left: 26, top: 230 }, right: { right: 26, top: 230 } },
  fan: { x: 38, top: 568, W: 712, max: 58, gap: 12, da: 2.2, drop: 0.55, y0: 40, lift: 22 },
}
const NARROW = {
  w: 374, h: 480, rim: 6, radius: 24, cy: 215, pos: { left: [62, 62], top: [187, 62], right: [312, 62], me: [187, 430] },
  seat: 30, ow: 116, me: 36, hand: [52, 74], pile: [44, 62], gap: [22, 18], pill: 56, auto: 80,
}
// Điện thoại xoay ngang (bản "Tiến lên · điện thoại xoay ngang"): 844 × 390 — đối thủ trên / hai bên dạng thẻ ngang (`at`),
// mình góc trái dưới, quạt bài một hàng giữa đáy (`handX` / `handW`), nút cột phải.
const LAND = {
  w: 844, h: 390, rim: 6, radius: 18, cy: 176, pos: { left: [84, 120], top: [422, 52], right: [760, 120], me: [422, 330] },
  seat: 28, ow: 150, me: 28, hand: [52, 73], pile: [40, 56], gap: [22, 18], pill: 42, auto: 64, handX: 168, handW: 470,
  at: { left: { left: 12, top: 96 }, top: { left: 422, top: 30, transform: 'translateX(-50%)' }, right: { right: 12, top: 96 } },
}
const LAY = { 2: ['top'], 3: ['left', 'right'], 4: ['left', 'top', 'right'] }

// Mặt bàn nỉ + lá bài: "vật" có màu riêng, giữ nguyên ở cả sáng / tối (DESIGN.md §2.4). Quanh bàn vẫn dùng token.
// Chiếu nỉ xanh viền gỗ (cả 3 bản thiết kế): "vật" có màu riêng, giữ nguyên ở sáng / tối (DESIGN.md §2.4).
const TL = {
  table: 'radial-gradient(ellipse 60% 45% at 50% 45%, rgba(240,183,92,.16), transparent 70%), radial-gradient(ellipse at 50% 50%, #1b5e4a 0%, #124536 55%, #0b2c24 100%)',
  rim: (r) => `0 40px 90px -30px rgba(0,0,0,.95), inset 0 0 0 ${r}px #5a3a1c, inset 0 0 0 ${r + 3}px #c99a2e, inset 0 0 80px rgba(0,0,0,.55)`,
  glass: 'rgba(10,16,30,.66)',
  line: 'rgba(255,255,255,.12)',
  ink: '#E9EFF7',
  sub: '#A8B7CB',
  goldHi: '#ffe08a',
  pill: 'rgba(4,8,20,.6)',
  gold: '#ffd27a',
  teal: '#2FCCC3',
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

export default function TienLenBoard({ state, mySeat, onMove, roomId, result, players, names, stake = 0, actions, overActions, note, bubbles, land, hands: given }) {
  const { a, db } = useApp()
  const [ref, k0] = useFit(land ? LAND.w : WIDE.w)
  // Khung hẹp hơn ~560px thì đổi sang bàn hẹp — co bàn rộng xuống đó thì lá trên tay không bấm nổi.
  // `land` (khung xoay ngang của GameRoom): cỡ chữ gọn như bản hẹp, toạ độ riêng (LAND), nút nằm trong bàn.
  const narrow = land || k0 * WIDE.w < 560
  const L = land ? LAND : narrow ? NARROW : WIDE
  const k = land ? k0 : narrow ? Math.min(1, (k0 * WIDE.w) / NARROW.w) : k0
  const { w: DW, h: DH, cy: CY, pos: POS } = L
  const [dealt, setDealt] = useState(null) // { roomId, hands: { [seat]: cards } } | { roomId, failed }
  const [tries, setTries] = useState(0)
  // Chọn lá theo nước: bàn sang nước khác (ai đó vừa đi) là bỏ chọn, khỏi xoá state trong effect.
  const [pick, setPick] = useState({ ply: -1, cards: [] })
  const [peek, setPeek] = useState(false)
  const sel = pick.ply === state.ply ? pick.cards : []
  const [sortBy, setSortBy] = useState('rank') // "Xếp: số" | "Xếp: bộ" (groupsOf)
  const [drag, setDrag] = useState(null) // vuốt trên tay: { a, b, moved } = chỉ số lá đầu / cuối trong `order`

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
  // Thứ tự lá trên tay: tăng dần, hoặc gom bộ — bàn rộng hở một khe giữa các nhóm (`gapAt` = chỉ số lá đầu nhóm).
  const groups = sortBy === 'combo' ? groupsOf(hand) : [hand]
  const order = groups.flat()
  const gapAt = new Set(groups.slice(0, -1).map((_, j) => groups.slice(0, j + 1).flat().length))

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
  // Chạm một lá (bản thiết kế): đang chọn thì thêm / bớt lá đó; chưa chọn gì mà tới lượt thì tự chọn bộ nhỏ nhất chứa
  // lá đó chặn được bàn (không phí hàng, trừ khi bàn là hàng / heo), mở vòng thì cả nhóm "Xếp: bộ" chứa lá đó.
  const tap = (c) => {
    if (!canPick) return
    if (sel.includes(c)) { setPick({ ply: state.ply, cards: sel.filter((x) => x !== c) }); return }
    if (sel.length) { setPick({ ply: state.ply, cards: [...sel, c] }); return }
    let cards = [c]
    if (myTurn && table) {
      const tk = comboOf(table.cards, state.bac)
      const ok = playsOf(state, hand).filter(({ cs, k }) => cs.includes(c) && (!isBomb(k) || isBomb(tk) || isHeo(tk)))
      ok.sort((x, y) => x.cs.length - y.cs.length || x.k.top - y.k.top)
      if (ok.length) cards = ok[0].cs
    } else if (myTurn && sortBy === 'combo') {
      const g = groups.find((x) => x.length > 1 && x.includes(c) && comboOf(x, state.bac))
      if (g && (state.low == null || g.includes(state.low))) cards = g
    }
    setPick({ ply: state.ply, cards })
  }
  // Vuốt ngang trên tay chọn cả dải lá; giữ ngón thì kính lúp phóng lá đang chạm. Dò lá dưới ngón bằng elementFromPoint
  // (đúng cả khi quạt xoay / bàn co), nhả tay mà chưa rê sang lá khác = chạm.
  const cardAt = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-card]')
    return el ? order.indexOf(Number(el.dataset.card)) : -1
  }
  const hDown = (e) => { const i = canPick ? cardAt(e) : -1; if (i >= 0) setDrag({ a: i, b: i, moved: false }) }
  const hMove = (e) => { if (!drag) return; const i = cardAt(e); if (i >= 0 && i !== drag.b) setDrag({ ...drag, b: i, moved: true }) }
  const hUp = () => {
    if (!drag) return
    setDrag(null)
    if (drag.moved) setPick({ ply: state.ply, cards: order.slice(Math.min(drag.a, drag.b), Math.max(drag.a, drag.b) + 1) })
    else if (order[drag.a] != null) tap(order[drag.a])
  }
  const swiped = drag?.moved ? order.slice(Math.min(drag.a, drag.b), Math.max(drag.a, drag.b) + 1) : null
  // Tới lượt mà bàn đang có bộ: lá không nằm trong bộ nào chặn được thì mờ đi.
  const playable = myTurn && table ? new Set(playsOf(state, hand).flatMap((x) => x.cs)) : null

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
    hot: ['rgba(201,42,42,.85)', '#fff'], mute: [TL.pill, TL.sub], gold: ['rgba(240,183,92,.22)', TL.goldHi], teal: ['rgba(0,178,169,.3)', '#7fe3d8'],
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
  // Bàn rộng: dòng trạng thái nằm dưới bàn (nền trang → token); bàn hẹp / ngang: cạnh tên mình trên nỉ (màu cố định).
  const C = narrow ? { muted: TL.sub, gold: TL.goldHi, teal: TL.teal, red: TL.hot } : { muted: G.muted, gold: G.goldHi, teal: G.tealHi, red: G.red }
  let status
  let statusC = C.muted
  if (!state.started) status = t('games.tienlen.dealing')
  else if (over) status = t('games.tienlen.overState')
  else if (!seated) status = t('games.spectating')
  else if (state.out[mySeat]) status = state.order.includes(mySeat) ? t('games.tienlen.youPlaced', { place: placeOf(state.order.indexOf(mySeat), n) }) : t('games.tienlen.out')
  else if (sel.length && err && err !== 'games.err.badCombo' && err !== 'games.err.tooLow') { status = myTurn ? t(err) : t('games.tienlen.offTurnHint'); statusC = C.gold }
  else if (hintNone === state.ply && myTurn) { status = t('games.tienlen.noHint'); statusC = C.gold }
  else if (myTurn) { status = secs != null ? t('games.tienlen.myTurnClock', { n: secs }) : t('games.tienlen.myTurn'); statusC = low ? C.red : C.teal }
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
    fx.push(<div key={id + 'f'} style={{ position: 'absolute', left: DW / 2, top: CY, width: narrow ? 340 : 520, height: narrow ? 340 : 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,200,.95), rgba(245,120,60,.55) 30%, transparent 65%)', opacity: 0, animation: 'chFlash .7s ease-out forwards', zIndex: 6, mixBlendMode: 'screen' }} />)
    fx.push(<div key={id + 's'} style={{ position: 'absolute', left: DW / 2, top: CY, font: `800 ${narrow ? 40 : 64}px/1 var(--font-display)`, letterSpacing: '.02em', whiteSpace: 'nowrap', color: TL.gold, WebkitTextStroke: '2px #7a1d2a', textShadow: '0 0 30px rgba(245,120,60,.9), 0 6px 0 #5c1420', opacity: 0, animation: 'tlStamp 1.6s ease-out forwards', zIndex: 8 }}>
      {table.kind === 'quad' ? t('games.tienlen.chopQuad') : t('games.tienlen.chopPairs', { n: table.len })}
    </div>)
    for (let j = 0; j < 26; j++) {
      const ang = (j / 26) * Math.PI * 2
      const d = (120 + rnd(j * 5) * 140) * (narrow ? 0.6 : 1)
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
    const sp = m > 8 ? L.gap[1] : L.gap[0]
    const [ox, oy] = posOf(table.seat)
    table.cards.forEach((c, j) => {
      const off = (j - (m - 1) / 2) * sp
      const r = (rnd(state.ply * 3 + j) - 0.5) * 8
      pile.push(
        <span key={`p${state.ply}-${c}`} style={{
          position: 'absolute', left: DW / 2 + off, top: CY, width: L.pile[0], height: L.pile[1], borderRadius: 7, boxShadow: '0 10px 22px -6px rgba(0,0,0,.7)',
          transform: `translate(-50%, -50%) rotate(${r}deg)`, '--fx': ox - DW / 2 - off + 'px', '--fy': oy - CY + 'px', '--fr': (ox === DW / 2 ? 0 : 90) + 'deg', '--r': r + 'deg',
          animation: `tlArc .45s cubic-bezier(.3,.7,.2,1) ${(j * 0.035).toFixed(3)}s both`, zIndex: 2,
        }}><CardFace c={c} w={L.pile[0]} h={L.pile[1]} /></span>,
      )
    })
  }

  const ow = over && !peek

  // ── Nút đi bài (bản thiết kế): dưới bàn — [Bỏ lượt][Đánh · <bộ>][Gợi ý]. Màn ngang: cột 176 góc phải dưới —
  // [Gợi ý | Bỏ lượt] rồi nút Đánh trải ngang.
  const hintBtn = (
    <button type="button" onClick={hint} disabled={!myTurn || !hand.length} aria-label={t('games.tienlen.hint')} title={t('games.tienlen.hint')} style={{ ...btn('ghost'), flex: 'none', minHeight: land ? 44 : 48, padding: land ? 12 : '0 16px', opacity: myTurn ? 1 : 0.45 }}>
      <Icon name="lightbulb" size={15} />{!narrow && t('games.tienlen.hint')}
    </button>
  )
  const controls = canPick && (
    <div style={{ display: 'flex', gap: 7, ...(land ? { flexWrap: 'wrap' } : null) }}>
      {land && hintBtn}
      <button type="button" onClick={pass} disabled={!canPass} style={{ ...btn('ghost'), flex: 1, minHeight: land ? 44 : 48, padding: land ? 12 : '0 18px', font: `800 ${land ? 14 : 15}px/1 var(--font-sans)`, opacity: canPass ? 1 : 0.45, cursor: canPass ? 'pointer' : 'not-allowed' }}>{t('games.tienlen.pass')}</button>
      <button type="button" onClick={play} disabled={!canPlay} title={err ? t(err) : undefined} style={{
        ...btn('primary'), ...(land ? { width: '100%', minHeight: 44, whiteSpace: 'normal' } : { flex: 1.6, minWidth: 0, minHeight: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
        padding: land ? '10px 12px' : '0 18px', font: `800 ${land ? 14 : 15}px/1.15 var(--font-sans)`, transition: 'all .2s',
        ...(canPlay ? { boxShadow: '0 5px 0 ' + G.tealA(0.55) + ', 0 10px 30px -6px ' + G.tealA(0.7) }
          : { background: G.inset, color: sel.length ? G.goldHi : G.muted, border: '1.5px solid ' + G.line, cursor: 'not-allowed' }),
      }}>{playLabel}</button>
      {!land && hintBtn}
    </div>
  )
  // Bài trên tay: lá chồng nhau, mỗi lá lộ tối đa 38px (bàn rộng = như cũ), bàn hẹp tự khít lại cho vừa 13 lá.
  const [hw, hh] = L.hand
  const nh = order.length
  // Bàn rộng: quạt xoè cong như bản thiết kế — lá i lệch (i − giữa) × da độ, tụt xuống (i − giữa)² × drop; "Xếp: bộ" hở
  // F.gap giữa các nhóm. Bàn hẹp / ngang: một hàng thẳng, mỗi lá lộ tối đa 38px, tự khít lại cho vừa 13 lá.
  const F = L.fan
  const step = F
    ? (nh > 1 ? Math.min(F.max, (F.W - hw - (gapAt.size * F.gap)) / (nh - 1)) : 0)
    : nh > 1 ? Math.min(38, ((L.handW ?? DW - 20) - hw) / (nh - 1)) : 38
  const xs = []
  order.forEach((_, i) => { xs.push(i ? xs[i - 1] + step + (F && gapAt.has(i) ? F.gap : 0) : 0) })
  const rowW = nh ? xs[nh - 1] + hw : hw
  const x0 = F ? (F.W - rowW) / 2 : 0
  const mid = (nh - 1) / 2
  const mw = F ? 96 : land ? 60 : 72 // kính lúp
  const magI = drag ? drag.b : -1
  const myTag = tagOf(base)
  // Vương miện nhấp nhô trên người về Nhất (bản thiết kế).
  const crown = <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: -20, color: TL.gold, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))', animation: 'crownBob 1.2s ease-in-out infinite', zIndex: 2 }}><Icon name="crown" size={20} /></span>
  const pillBtn = { padding: '6px 11px', borderRadius: 9, border: '1px solid #2E3E5C', background: TL.pill, color: TL.sub, font: '700 12.5px/1 var(--font-sans)', whiteSpace: 'nowrap', cursor: 'pointer' }
  const sortBtn = seated && hand.length > 1 && (
    <button type="button" onClick={() => { setSortBy(sortBy === 'combo' ? 'rank' : 'combo'); setPick({ ply: -1, cards: [] }) }} style={pillBtn}>
      {t(sortBy === 'combo' ? 'games.tienlen.sortCombo' : 'games.tienlen.sortRank')}
    </button>
  )
  // Nút dưới bàn: hiện lại kết quả (đang xem bàn) · xin thua. Màn ngang đặt trong cột nút.
  const actionRow = (actions?.length > 0 || (over && peek)) && (
    <div style={{ display: 'flex', gap: land ? 6 : 8, justifyContent: land ? 'flex-end' : 'center', flexWrap: 'wrap' }}>
      {over && peek && <button type="button" onClick={() => setPeek(false)} style={btn('soft', { sm: true })}>{t('games.tienlen.showResult')}</button>}
      {(actions || []).map((x) => (
        <button key={x.key} type="button" disabled={x.off} onClick={x.on} style={{ ...btn(x.danger ? 'danger' : 'ghost', { sm: true }), opacity: x.off ? 0.45 : 1 }}>
          <Icon name={x.icon} size={14} />{x.label}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Khung đo luôn rộng tối đa bằng bàn rộng — để biết khi nào đổi bố cục; bàn đang dùng nằm giữa khung. */}
      <div ref={ref} style={{ width: '100%', maxWidth: land ? LAND.w : WIDE.w, margin: '0 auto', display: 'grid', justifyItems: 'center' }}>
      <div style={{ width: DW * k, height: DH * k, position: 'relative' }}>
        <div style={{
          width: DW, height: DH, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden', borderRadius: L.radius,
          background: TL.table, boxShadow: TL.rim(L.rim), color: TL.ink, userSelect: 'none', touchAction: 'manipulation',
        }}>
          {/* Giữa chiếu: chưa có bộ thì ô "Vòng mới" viền đứt (bản thiết kế), lời nhắc nằm dưới ô như dòng bộ trên bàn. */}
          {!table && state.started && !over && (
            <span style={{ position: 'absolute', left: DW / 2, top: CY, transform: 'translate(-50%, -50%)', width: narrow ? 64 : 86, height: narrow ? 58 : 78, display: 'grid', placeItems: 'center', padding: 4, borderRadius: 10, border: '2px dashed rgba(240,183,92,.35)', font: '600 11px/1.2 var(--font-sans)', color: 'rgba(240,183,92,.7)', textAlign: 'center' }}>{t('games.tienlen.newRound')}</span>
          )}
          {center && <span style={{ position: 'absolute', left: DW / 2, top: CY + L.pill, transform: 'translateX(-50%)', maxWidth: DW - (narrow ? 80 : 240), padding: '6px 14px', borderRadius: 99, background: TL.pill, border: '1px solid rgba(240,183,92,.4)', font: `700 ${narrow ? 12.5 : 13.5}px/1.35 var(--font-sans)`, color: TL.goldHi, textAlign: 'center', zIndex: 3 }}>{center}</span>}
          {state.bac && <span style={{ position: 'absolute', ...(land ? { left: 12, top: 46 } : narrow ? { right: 12, top: 330 } : { left: 20, top: 18 }), padding: '5px 11px', borderRadius: 99, background: TL.pill, border: '1px solid ' + TL.line, font: '600 12px/1 var(--font-sans)', color: TL.sub }}>{t('games.tienlen.variantOpt.bac')}</span>}

          <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {pile}
            {fx}
          </div>

          {table && (
            <span aria-live="polite" style={{ position: 'absolute', left: DW / 2, top: CY + L.pill, transform: 'translateX(-50%)', display: 'flex', gap: 8, padding: '5px 12px', borderRadius: 99, background: TL.pill, border: '1px solid ' + (chop ? 'rgba(245,176,65,.5)' : 'rgba(148,163,184,.2)'), font: '700 12.5px/1.2 var(--font-sans)', color: chop ? TL.gold : '#cfe3e6', whiteSpace: 'nowrap', zIndex: 3 }}>
              {who(table.seat)} · {comboName(table.cards, state.bac)}
              {state.pot && <span style={{ color: TL.gold }}>{t('games.tienlen.potShort', { n: state.pot.amount })}</span>}
            </span>
          )}
          {freeNote && <span style={{ position: 'absolute', left: DW / 2, top: CY + L.pill, transform: 'translateX(-50%)', padding: '5px 12px', borderRadius: 99, background: 'rgba(45,212,191,.14)', border: '1px solid rgba(45,212,191,.45)', font: '700 12.5px/1.2 var(--font-sans)', color: TL.teal, whiteSpace: 'nowrap', zIndex: 3 }}>{freeNote}</span>}
          {last?.timeout && !over && <span style={{ position: 'absolute', left: DW / 2, top: CY + L.auto, transform: 'translateX(-50%)', font: '600 12px/1.2 var(--font-sans)', color: TL.sub, whiteSpace: 'nowrap', zIndex: 3 }}>{t('games.tienlen.autoMove', { name: who(last.seat) })}</span>}

          {/* Đối thủ: hộp kính (ảnh · tên / số lá + nhãn); bàn rộng thêm hàng lá úp như bản thiết kế. */}
          {Array.from({ length: n }, (_, s) => s).filter((s) => s !== base).map((s) => {
            const [x, y] = posOf(s)
            const cnt = state.counts[s]
            const active = state.started && !over && state.turn === s
            const tag = tagOf(s)
            const m = memberOf(s)
            return (
              <div key={s} style={{
                position: 'absolute', zIndex: 4, display: 'grid', justifyItems: 'center', gap: 6, maxWidth: land ? 170 : narrow ? L.ow : 220, padding: narrow ? '6px 8px' : '9px 12px', borderRadius: 16,
                background: TL.glass, border: '1.5px solid ' + (active ? TL.teal : TL.line), boxShadow: active ? '0 0 22px -4px ' + TL.teal : 'none',
                opacity: state.passed[s] && !over ? 0.6 : 1, transition: 'opacity .3s, border-color .3s, box-shadow .3s',
                ...(L.at ? L.at[slotOf(s)] : { left: x, top: y, transform: 'translate(-50%, -50%)' }),
              }}>
                {state.order[0] === s && crown}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, maxWidth: '100%' }}>
                  <Seat name={m?.name || nameOf(s)} src={m?.avatarUrl} size={L.seat} active={active} pct={active ? pct : null} low={low} bubble={bubbles?.[s]} />
                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <span style={{ font: `700 ${narrow ? 12 : 13.5}px/1.2 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: narrow ? 90 : 110 }}>{nameOf(s)}</span>
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '1px 7px', borderRadius: 99, background: TL.pill, font: '700 10.5px/1.4 var(--font-mono)', color: cnt <= 1 ? TL.hot : cnt <= 3 ? TL.goldHi : TL.sub }}>{t('games.tienlen.nCards', { n: cnt })}</span>
                      {tag && <span style={{ padding: '1px 7px', borderRadius: 99, font: '800 10.5px/1.4 var(--font-sans)', background: TAG[tag[1]][0], color: TAG[tag[1]][1] }}>{tag[0]}</span>}
                    </span>
                    {note?.[s] && <span style={{ font: '400 10px/1.2 var(--font-mono)', color: TL.goldHi, whiteSpace: 'nowrap' }}>{note[s]}</span>}
                  </div>
                </div>
                {!narrow && cnt > 0 && (
                  <div style={{ position: 'relative', height: 36, width: 26 + (cnt - 1) * 6 }}>
                    {Array.from({ length: cnt }, (_, j) => <span key={j} style={{ position: 'absolute', left: j * 6, top: 0, width: 26, height: 36, borderRadius: 4, background: CARD.back, border: '1.5px solid ' + CARD.backLine, boxShadow: '0 2px 3px rgba(0,0,0,.45)' }} />)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Mình (bàn hẹp / ngang): ảnh · tên · trạng thái */}
          {narrow && (
          <div style={{ position: 'absolute', ...(land ? { left: 12, bottom: 12, gap: 8, width: 150 } : { left: 12, top: 318, gap: 10, maxWidth: 260 }), display: 'flex', alignItems: 'center', zIndex: 4 }} aria-live="polite">
            <Seat name={memberOf(base)?.name || nameOf(base)} src={memberOf(base)?.avatarUrl} size={L.me} active={state.started && !over && state.turn === base} pct={pct} low={low} bubble={bubbles?.[base]} up />
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nameOf(base)}{seated && <span style={{ fontWeight: 500, fontSize: 11, color: TL.teal }}> {t('games.wait.youTag')}</span>}
              </span>
              <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: statusC }}>{status}</span>
              {!seated && <span style={{ font: '700 13px/1 var(--font-mono)', color: TL.sub }}>{t('games.tienlen.nCards', { n: state.counts[base] ?? 0 })}</span>}
              {sortBtn && <div style={{ display: 'flex' }}>{sortBtn}</div>}
            </div>
            {state.order[0] === base && <span style={{ position: 'absolute', left: L.me / 2, top: 0 }}>{crown}</span>}
          </div>
          )}
          {/* Mình (bàn rộng, bản thiết kế): hàng ảnh · tên · số lá · nhãn ngay trên quạt bài, nút Bỏ chọn bên phải. */}
          {!narrow && (
            <div style={{ position: 'absolute', left: 38, right: 38, top: 532, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, zIndex: 6 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, whiteSpace: 'nowrap' }}>
                {state.order[0] === base && <span style={{ position: 'absolute', left: L.me / 2, top: 0 }}>{crown}</span>}
                <Seat name={memberOf(base)?.name || nameOf(base)} src={memberOf(base)?.avatarUrl} size={L.me} active={state.started && !over && state.turn === base} pct={pct} low={low} bubble={bubbles?.[base]} up />
                <span style={{ font: '700 14px/1.2 var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nameOf(base)}{seated && <span style={{ fontWeight: 500, fontSize: 11, color: TL.teal }}> {t('games.wait.youTag')}</span>}
                </span>
                <span style={{ padding: '1px 8px', borderRadius: 99, background: TL.pill, font: '400 11.5px/1.5 var(--font-mono)', color: TL.sub }}>{t('games.tienlen.nCards', { n: seated ? hand.length : state.counts[base] ?? 0 })}</span>
                {myTag && <span style={{ padding: '1px 8px', borderRadius: 99, font: '800 11px/1.5 var(--font-sans)', background: TAG[myTag[1]][0], color: TAG[myTag[1]][1] }}>{myTag[0]}</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {sortBtn}
                {canPick && <button type="button" onClick={() => setPick({ ply: -1, cards: [] })} disabled={!sel.length} style={{ ...pillBtn, cursor: sel.length ? 'pointer' : 'default', opacity: sel.length ? 1 : 0.5 }}>{t('games.tienlen.clearSel')}</button>}
              </div>
            </div>
          )}

          {/* Nút (màn ngang) */}
          {land && (controls || actionRow) && (
            <div style={{ position: 'absolute', right: 12, bottom: 12, width: 176, display: 'grid', gap: 7, zIndex: 6 }}>
              {controls}
              {actionRow}
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
                <div role="group" aria-label={t('games.tienlen.handAria', { n: nh })} onPointerDown={hDown} onPointerMove={hMove} onPointerUp={hUp} onPointerCancel={hUp} onPointerLeave={hUp}
                  style={{
                    position: 'absolute', zIndex: 5, touchAction: 'none', animation: state.ply <= 1 ? 'skFade .4s ease-out 1.5s both' : undefined,
                    ...(F ? { left: F.x, top: F.top, width: F.W, height: DH - F.top }
                      : { left: land ? L.handX + L.handW / 2 : '50%', bottom: land ? 6 : 12, width: rowW, height: hh, transform: 'translateX(-50%)' }),
                  }}>
                  {order.map((c, i) => {
                    const on = swiped ? swiped.includes(c) : sel.includes(c)
                    const d = i - mid
                    const lift = on ? (F ? F.lift : land ? 14 : 22) : 0
                    return (
                      <button key={c} type="button" data-card={c} disabled={!canPick} onClick={(e) => { if (e.detail === 0) tap(c) }} aria-pressed={on} aria-label={faceOf(c)} style={{
                        position: 'absolute', left: x0 + xs[i], top: F ? F.y0 + d * d * F.drop : 0, width: hw, height: hh, padding: 0, border: 0, borderRadius: 8, background: 'none',
                        zIndex: on ? 100 + i : i + 1, cursor: canPick ? 'pointer' : 'default', opacity: playable && !playable.has(c) && !on ? 0.55 : 1,
                        transform: `rotate(${F ? (d * F.da).toFixed(2) : 0}deg) translateY(${-lift}px)`, transformOrigin: '50% 140%', transition: 'transform .16s, box-shadow .16s, left .25s, top .25s, opacity .2s',
                        boxShadow: on ? '0 0 0 ' + (F ? 3 : 2) + 'px ' + TL.teal + ', 0 14px 28px -6px rgba(45,212,191,.6)'
                          : c === state.low && myTurn ? '0 0 0 3px ' + TL.gold + ', 0 0 16px ' + TL.gold : '0 8px 18px -8px rgba(0,0,0,.7)',
                      }}><CardFace c={c} w={hw} h={hh} /></button>
                    )
                  })}
                  {magI >= 0 && order[magI] != null && (
                    <span aria-hidden="true" style={{ position: 'absolute', left: Math.max(0, Math.min((F ? F.W : rowW) - mw, x0 + xs[magI] + hw / 2 - mw / 2)), top: -Math.round(mw * 1.4) - 14, width: mw, height: Math.round(mw * 1.4), zIndex: 400, pointerEvents: 'none', borderRadius: 12, boxShadow: '0 0 0 3px ' + TL.teal + ', 0 18px 40px rgba(0,0,0,.7)', animation: 'skFade .15s ease-out' }}>
                      <CardFace c={order[magI]} w={mw} h={Math.round(mw * 1.4)} />
                    </span>
                  )}
                </div>
              )
          )}

          {/* Màn kết thúc */}
          {ow && (
            <Overlay width={narrow ? 340 : 460} maxHeight={DH - 40}>
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
            </Overlay>
          )}
        </div>

      </div>
      </div>

      {/* Dưới bàn (bản thiết kế): dòng trạng thái (bàn rộng) · nút đi bài · hàng nút phụ (Ván mới · Xin thua…). */}
      {!land && (
        <div style={{ width: '100%', maxWidth: DW * k, margin: '0 auto', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {!narrow && <span aria-live="polite" style={{ minHeight: 18, font: '700 12.5px/1.4 var(--font-sans)', color: statusC, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</span>}
          {controls}
          {actionRow}
        </div>
      )}
    </div>
  )
}
