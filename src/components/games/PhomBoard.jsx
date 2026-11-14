import { useEffect, useState } from 'react'
import { Button, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { CARD, G, btn, card } from '#components/games/stage.js'
import { rnd, useFit } from '#components/games/chessUi.js'
import { CardFace } from '#components/games/PlayingCard.jsx'
import { Overlay, Seat } from '#components/games/cardTable.jsx'
import { phomBot } from '#lib/games/bots/cards.js'
import ph, { bestLay, cover, faceOf, meldOk, pendingOf, pointsOf, RANK_FACES, sendsFor, suitOf, uOf } from '#lib/games/phom.js'

/**
 * Bàn Phỏm (bản thiết kế "Phỏm · Chiếu tá lả", 2026-11-13): chiếu nỉ xanh viền gỗ, đối thủ ngồi quanh bàn (số lá úp,
 * chồng đã đánh, lá đã ăn, phỏm đã hạ), giữa bàn là nọc + lá vừa đánh, bài trên tay mình xếp quạt ở đáy bàn.
 * Nút nằm DƯỚI bàn (không co theo bàn): Ù · Ăn lá này / Bốc nọc · Đánh <lá> + Gợi ý · khung Hạ phỏm ở lượt cuối.
 *   - Ăn chỉ sáng khi lá đó ghép được phỏm với tay mình; lá đang giữ phỏm cho lá đã ăn bị khoá (mờ).
 *   - Khung Hạ phỏm: app xếp sẵn cách ít điểm rác nhất + gợi ý gửi bài; bỏ phỏm bằng ×, hoặc chọn lá rồi Ghép phỏm.
 * Hai bố cục theo bề rộng khung (như Bắn tàu): rộng — bàn 788 × 760, đối thủ trái / trên / phải; hẹp (điện thoại dọc)
 * — bàn 374 × 600, đối thủ xếp một hàng trên cùng. Bàn vẽ ở cỡ thiết kế rồi co bằng useFit.
 *
 * Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay mình, hết
 * ván trả mọi tay để lật bài) — nạp lại sau mỗi nước. Luật: lib/games/phom.js · server kiểm lại từng nước: 0090.
 * Props sân khấu (GameRoom `stageProps`): `actions` nút dưới bàn, `overActions` nút ở màn kết thúc, `note` mất kết nối.
 */

const byNum = (a, b) => a - b
const bySuit = (a, b) => suitOf(a) - suitOf(b) || a - b
const ptsOf = (cards) => cards.reduce((a, c) => a + pointsOf(c), 0)

// Chiếu nỉ + lá bài + kính trên chiếu: "vật" có màu riêng, giữ nguyên ở sáng / tối (DESIGN.md §2.4). Nút dưới bàn dùng token.
const PH = {
  felt: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(240,183,92,.14), transparent 70%), radial-gradient(ellipse at 50% 50%, #1b5e4a 0%, #124536 55%, #0b2c24 100%)',
  rim: (r) => `0 40px 90px -30px rgba(0,0,0,.95), inset 0 0 0 ${r}px #5a3a1c, inset 0 0 0 ${r + 3}px #c99a2e, inset 0 0 80px rgba(0,0,0,.55)`,
  glass: 'rgba(10,16,30,.62)',
  line: 'rgba(255,255,255,.12)',
  pill: 'rgba(4,8,20,.55)',
  ink: '#E9EFF7',
  sub: '#A8B7CB',
  mute: '#8494AA',
  gold: '#F0B75C',
  goldA: 'rgba(240,183,92,.18)',
  teal: '#2FCCC3',
  red: '#FF9A8F',
  meld: 'rgba(155,225,93,.16)',
  meldLine: 'rgba(155,225,93,.45)',
}

// Toạ độ theo bản thiết kế. `pos` = tâm từng chỗ ngồi (lá bay ra từ đó), `mini` = cỡ lá nhỏ trên chiếu, `my` = lá nhỏ của mình.
const WIDE = {
  w: 788, h: 760, rim: 10, radius: 34, hand: 66, mini: 26, my: 30, stock: 64, gap: 40, pad: 40, cy: 342, ew: 388, eh: 212,
  pos: { me: [394, 660], right: [692, 236], top: [394, 70], left: [96, 236] },
}
const NARROW = {
  w: 374, h: 600, rim: 6, radius: 24, hand: 48, mini: 16, my: 22, stock: 50, gap: 24, pad: 10, cy: 262, ew: 320, eh: 170,
  pos: { me: [187, 504], right: [312, 30], top: [187, 30], left: [62, 30] },
}
// Ghế khác xếp theo chiều lượt: người đánh sau mình ngồi bên phải.
const LAY = { 2: ['top'], 3: ['right', 'left'], 4: ['right', 'top', 'left'] }
const COL = { left: 1, top: 2, right: 3 }

/** Lá nhỏ in trên chiếu (không bấm được). */
const Mini = ({ c, w, ring, tag, ml }) => (
  <span style={{ position: 'relative', flex: 'none', width: w, height: Math.round(w * 1.4), borderRadius: 4, boxShadow: ring, marginLeft: ml }}>
    <CardFace c={c} w={w} h={Math.round(w * 1.4)} faces={RANK_FACES} />
    {tag && <span style={{ position: 'absolute', top: -6, right: -6, padding: '1px 4px', borderRadius: 99, background: '#c92a2a', color: '#fff', font: '800 8.5px/1.2 var(--font-sans)' }}>{tag}</span>}
  </span>
)

/** Các phỏm đã hạ — mỗi phỏm một cụm xanh, lá gửi vào vẫn nằm trong cụm. */
const Melds = ({ melds, w, tight }) => (
  <div style={{ display: 'flex', gap: tight ? 4 : 5, flexWrap: tight ? 'nowrap' : 'wrap', overflow: 'hidden', minWidth: 0 }}>
    {melds.map((m) => (
      <div key={m.join()} style={{ flex: 'none', display: 'flex', gap: 1, padding: tight ? '2px 2px 2px 8px' : 3, borderRadius: tight ? 5 : 7, background: PH.meld, border: tight ? 0 : '1px solid ' + PH.meldLine }}>
        {m.map((c) => <Mini key={c} c={c} w={w} ml={tight ? -7 : 0} />)}
      </div>
    ))}
  </div>
)

const Tag = ({ children, tone = 'gold', sm }) => (
  <span style={{ flex: 'none', padding: '1px 7px', borderRadius: 99, whiteSpace: 'nowrap', font: `700 ${sm ? 10 : 11}px/1.4 var(--font-sans)`, background: tone === 'red' ? 'rgba(229,72,77,.2)' : PH.goldA, color: tone === 'red' ? PH.red : PH.gold }}>{children}</span>
)

export default function PhomBoard({ state, mySeat, onMove, roomId, result, players, names, stake = 0, actions, overActions, note, hands: given }) {
  const { db, a } = useApp()
  const [ref, k0] = useFit(WIDE.w)
  // Khung hẹp hơn ~560px (điện thoại dọc) thì đổi sang bàn hẹp — co bàn rộng xuống đó thì lá nhỏ không bấm nổi.
  const narrow = k0 * WIDE.w < 560
  const L = narrow ? NARROW : WIDE
  const k = narrow ? Math.min(1, (k0 * WIDE.w) / NARROW.w) : k0

  const [dealt, setDealt] = useState(null) // { roomId, ply, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [pick, setPick] = useState({ ply: -1, c: null })
  // Khung hạ: phỏm đang chọn + lá đang chọn để ghép + lá gửi bị bỏ chọn — gắn với số nước để sang nước mới tự làm lại.
  const [plan, setPlan] = useState({ ply: -1, melds: null, sel: [], skip: [] })
  const [suitSort, setSuitSort] = useState(false)
  const [peek, setPeek] = useState(false)

  const seated = mySeat != null
  const reveal = !!result
  const ply = state.ply
  useEffect(() => {
    if (given || (!seated && !reveal)) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setDealt({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setDealt({ roomId, failed: true }) })
    return () => { live = false }
  }, [a, roomId, seated, reveal, tries, ply, given])

  // Chơi với máy (BotRoom) truyền sẵn `hands` (như game_hands) — khỏi hỏi server.
  const mine = given ? { hands: given } : dealt?.roomId === roomId ? dealt : null
  const hand = seated ? (mine?.hands?.[mySeat] || []).slice().sort(suitSort ? bySuit : byNum) : []
  const memberOf = (seat) => db.members.find((m) => m.id === players?.find((p) => p.seat === seat)?.memberId)
  const nameOf = (seat) => names?.[seat] || memberOf(seat)?.name || t('games.phom.mark' + seat)
  const who = (seat) => (seat === mySeat ? t('games.phom.youCap') : nameOf(seat))
  const n = state.n
  const myTurn = seated && !state.over && state.turn === mySeat
  const pend = seated ? pendingOf(state, mySeat) : []
  const non = hand.filter((c) => !pend.includes(c))
  // Bài tải về có thể trễ một nhịp so với log — chỉ cho bấm khi số lá khớp.
  const synced = seated && hand.length === state.counts[mySeat]
  const canEat = myTurn && synced && state.step === 'take' && state.last && cover(non, [...pend, state.last.card])
  const uMelds = myTurn && synced && (state.step === 'discard' || state.step === 'lay') && !state.melds[mySeat] ? uOf(hand, pend) : null
  const freeOf = (c) => !pend.includes(c) && cover(non.filter((x) => x !== c), pend)
  const sel = pick.ply === ply ? pick.c : null
  const discarding = myTurn && synced && state.step === 'discard'
  const hint = () => {
    const m = phomBot(state, mySeat, 'hard', Math.random, hand)
    if (m.discard != null) setPick({ ply, c: m.discard })
  }

  // Khung hạ (lượt cuối).
  const laying = myTurn && synced && state.step === 'lay'
  const myPlan = plan.ply === ply ? plan : { ply, melds: laying ? bestLay(hand, pend) || [] : [], sel: [], skip: [] }
  const used = myPlan.melds.flat()
  const rest = hand.filter((c) => !used.includes(c))
  // Lá gửi được (để bật / tắt) và lá sẽ gửi thật: tính lại sau khi bỏ lá đã tắt — dây nối dần (5 rồi 6) bỏ 5 thì 6 tự rơi.
  const canSend = myPlan.melds.length ? sendsFor(rest, state.melds, mySeat) : []
  const sends = myPlan.melds.length ? sendsFor(rest.filter((c) => !myPlan.skip.includes(c)), state.melds, mySeat) : []
  while (used.length + sends.length > hand.length - 1) sends.pop()
  const layMove = { lay: myPlan.melds, send: sends }
  const layErr = laying ? ph.validate(state, mySeat, layMove) : null
  const groupOk = meldOk(myPlan.sel) && myPlan.sel.filter((c) => pend.includes(c)).length <= 1
  const setMine = (p) => setPlan({ ...myPlan, ...p, ply })

  const { last, act } = state
  const base = mySeat ?? 0
  const lay = LAY[n] || []
  const slotOf = (seat) => (seat === base ? 'me' : lay[(seat - base + n) % n - 1] || 'top')
  const tagOf = (seat) => (state.out[seat] ? t('games.phom.outTag') : state.melds[seat] ? (state.mom[seat] ? t('games.phom.momTag') : t('games.phom.laidTag')) : null)
  const onTurn = (seat) => !state.over && state.started !== false && state.turn === seat

  // ── Giữa bàn: nọc + lá vừa đánh (bay ra từ ghế người đánh). ──
  const cx = L.w / 2
  const lastX = cx + (L.stock + L.gap) / 2
  const lastY = L.cy - 14
  const lw = L.stock
  const lh = Math.round(L.stock * 1.4)
  const [fx0, fy0] = last ? L.pos[slotOf(last.seat)] : [0, 0]

  // ── Hiệu ứng (suy từ state, key theo ply — mỗi nước mới tự diễn lại) ──
  const fx = []
  if (act?.eat != null && !state.over) {
    const [x, y] = L.pos[slotOf(act.seat)]
    fx.push(<div key={'s' + ply} style={{ position: 'absolute', left: (x + cx) / 2, top: (y + L.cy) / 2, font: `800 ${narrow ? 30 : 44}px/1 var(--font-display)`, whiteSpace: 'nowrap', color: '#ffd27a', WebkitTextStroke: '1.5px #7a1d2a', textShadow: '0 0 24px rgba(245,120,60,.8), 0 4px 0 #5c1420', opacity: 0, animation: 'tlStamp 1.4s ease-out forwards', zIndex: 8 }}>
      {t(act.chot ? 'games.phom.stampChot' : 'games.phom.stampEat')}
    </div>)
    if (act.chot) fx.push(<div key={'f' + ply} style={{ position: 'absolute', left: x, top: y, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,240,200,.9), rgba(245,120,60,.5) 30%, transparent 65%)', opacity: 0, animation: 'chFlash .7s ease-out forwards', zIndex: 6, mixBlendMode: 'screen' }} />)
  }
  const winner = result?.ranks?.[0] ?? state.u?.seat
  if (state.over && winner != null) {
    const [x, y] = L.pos[slotOf(winner)]
    for (let j = 0; j < 40; j++) {
      const ang = (j / 40) * Math.PI * 2
      const d = 90 + rnd(j * 3) * 200
      fx.push(<span key={'w' + j} style={{ position: 'absolute', left: x, top: y, width: 8, height: 14, borderRadius: 2, background: [PH.teal, PH.gold, '#f87171', '#93c5fd'][j % 4], '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d + 'px', opacity: 0, animation: `chBurst ${(1 + rnd(j) * 0.6).toFixed(2)}s cubic-bezier(.15,.7,.3,1) forwards`, zIndex: 9 }} />)
    }
  }

  // ── Một ghế đối thủ: kính trên chiếu. `tight` = bố cục hẹp. ──
  const panel = (seat, tight) => {
    const on = onTurn(seat)
    const eaten = state.eaten.filter((e) => e.by === seat)
    const tag = tagOf(seat)
    const cnt = state.counts[seat]
    const m = memberOf(seat)
    const w = L.mini
    return (
      <div key={seat} style={{
        position: 'relative', minWidth: 0, padding: tight ? '6px 7px' : '10px 12px', borderRadius: tight ? 12 : 16, background: PH.glass, display: 'grid', gap: tight ? 4 : 7,
        border: '1.5px solid ' + (on ? PH.teal : PH.line), boxShadow: on ? '0 0 22px -4px ' + PH.teal : 'none', opacity: state.out[seat] ? 0.55 : 1, transition: 'box-shadow .3s, border-color .3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tight ? 6 : 8, minWidth: 0 }}>
          <Seat name={m?.name || nameOf(seat)} src={m?.avatarUrl} size={tight ? 20 : 32} active={on} />
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1 }}>
            <span style={{ font: `700 ${tight ? 12 : 14}px/1.25 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(seat)}</span>
            {!tight && (
              <span style={{ display: 'flex', gap: 5, alignItems: 'center', minWidth: 0 }}>
                <span style={{ font: '400 11px/1.3 var(--font-mono)', color: PH.sub, whiteSpace: 'nowrap' }}>{t('games.phom.cards', { n: cnt })}</span>
                {tag && <Tag>{tag}</Tag>}
              </span>
            )}
          </div>
        </div>
        {tight && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', overflow: 'hidden' }}>
            <span style={{ flex: 'none', padding: '1px 6px', borderRadius: 99, background: PH.pill, font: '400 10.5px/1.4 var(--font-mono)', color: PH.sub }}>{t('games.phom.cards', { n: cnt })}</span>
            {tag && <Tag sm>{tag}</Tag>}
          </div>
        )}
        {(on || note?.[seat]) && (
          <span style={{ font: '600 11.5px/1.2 var(--font-sans)', color: note?.[seat] ? PH.gold : PH.teal, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note?.[seat] || t('games.phom.thinking')}</span>
        )}
        {tight
          ? (
            <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 6, height: Math.round(w * 1.4), overflow: 'hidden' }}>
              {state.piles[seat].map((c) => <Mini key={c} c={c} w={w} ml={-6} />)}
              {eaten.length > 0 && <span style={{ flex: 'none', width: 8 }} />}
              {eaten.map((e) => <Mini key={e.card} c={e.card} w={w} ml={-6} ring={'0 0 0 1.5px ' + PH.gold} />)}
            </div>
          )
          : (
            <>
              {cnt > 0 && (
                <div aria-hidden="true" style={{ position: 'relative', height: Math.round(w * 1.4), width: w + Math.min(cnt, 10) * 9 - 9 }}>
                  {Array.from({ length: Math.min(cnt, 10) }, (_, j) => (
                    <span key={j} style={{ position: 'absolute', left: j * 9, top: 0, width: w, height: Math.round(w * 1.4), borderRadius: 4, background: CARD.back, border: '1.5px solid ' + CARD.backLine, boxShadow: '0 2px 3px rgba(0,0,0,.45)' }} />
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, minHeight: Math.round(w * 1.4) }}>
                <span style={{ font: '400 10.5px/1 var(--font-sans)', color: PH.mute, marginRight: 3 }}>{t('games.phom.pileShort')}</span>
                {state.piles[seat].map((c) => <Mini key={c} c={c} w={w} />)}
              </div>
              {eaten.length > 0 && !state.melds[seat] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ font: '400 10.5px/1 var(--font-sans)', color: PH.gold, marginRight: 3 }}>{t('games.phom.eatenShort')}</span>
                  {eaten.map((e) => <Mini key={e.card} c={e.card} w={w} ring={'0 0 0 2px ' + PH.gold} tag={e.chot ? t('games.phom.chotTag') : null} />)}
                </div>
              )}
            </>
          )}
        {state.melds[seat]?.length > 0 && <Melds melds={state.melds[seat]} w={w} tight={tight} />}
      </div>
    )
  }

  // ── Bài trên tay: quạt ở đáy bàn. ──
  const avail = L.w - 2 * L.pad
  const hw = L.hand
  const hh = Math.round(hw * 1.4)
  const step = hand.length > 1 ? Math.min(hw + 4, (avail - hw) / (hand.length - 1)) : 0
  const x0 = (avail - (hw + step * Math.max(0, hand.length - 1))) / 2
  const cardBtn = (c, i) => {
    const eatenMark = pend.includes(c)
    let on = sel === c
    let dim = discarding && !freeOf(c)
    let onPick = discarding && freeOf(c) ? () => setPick({ ply, c: sel === c ? null : c }) : undefined
    if (laying) {
      const inMeld = used.includes(c)
      on = myPlan.sel.includes(c)
      dim = inMeld
      onPick = inMeld ? undefined : () => setMine({ sel: on ? myPlan.sel.filter((x) => x !== c) : [...myPlan.sel, c] })
    }
    return (
      <button key={c} type="button" disabled={!onPick} onClick={onPick} aria-pressed={onPick ? on : undefined}
        aria-label={faceOf(c) + (eatenMark ? ' · ' + t('games.phom.eatenTag') : '')}
        style={{
          position: 'absolute', left: x0 + i * step, top: 18, width: hw, height: hh, padding: 0, border: 0, borderRadius: 8, background: 'none', zIndex: i,
          cursor: onPick ? 'pointer' : 'default', opacity: dim ? 0.45 : 1, transform: `translateY(${on ? -18 : 0}px)`, transition: 'transform .16s, opacity .16s, left .3s',
          boxShadow: on ? '0 0 0 2px ' + PH.teal + ', 0 14px 28px -6px rgba(45,212,191,.6)' : eatenMark ? '0 0 0 2px ' + PH.gold + ', 0 8px 18px -8px rgba(0,0,0,.7)' : '0 8px 18px -8px rgba(0,0,0,.7)',
        }}>
        <CardFace c={c} w={hw} h={hh} faces={RANK_FACES} />
        {eatenMark && <span aria-hidden="true" style={{ position: 'absolute', top: -7, right: -6, padding: '2px 5px', borderRadius: 99, background: PH.gold, color: '#2a1800', font: '800 9.5px/1.2 var(--font-sans)' }}>{t('games.phom.eatenTag')}</span>}
      </button>
    )
  }

  const meTag = tagOf(base)
  const ow = state.over && !peek
  const scoreOf = (seat) => result?.scores?.[seat]
  const money = (sc) => (stake > 0 ? t('games.coins.stakeOpt', { n: (sc > 0 ? '+' : '') + (sc * stake).toLocaleString('vi-VN') }) : t('games.phom.score', { n: sc > 0 ? '+' + sc : sc }))
  const overTitle = state.u ? t(state.u.khan ? 'games.phom.uKhan' : state.u.tron ? 'games.phom.uTron' : 'games.phom.uWin', { side: who(state.u.seat) })
    : winner != null ? (winner === mySeat ? t('games.phom.overMe') : t('games.phom.overWin', { name: nameOf(winner) })) : t('games.phom.finalTitle')

  // Dòng chờ dưới bàn khi chưa tới lượt mình.
  // (Người xem: khung phòng đã in "Đang xem" dưới bàn.)
  const waitTxt = !seated || state.over || myTurn || state.out[mySeat] || state.turn == null ? '' : t('games.phom.waitFor', { name: nameOf(state.turn) })

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div ref={ref} style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', justifyItems: 'center' }}>
        <div style={{ width: L.w * k, height: L.h * k, position: 'relative' }}>
          <div style={{
            width: L.w, height: L.h, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', borderRadius: L.radius, overflow: 'hidden',
            background: PH.felt, boxShadow: PH.rim(L.rim), color: PH.ink, userSelect: 'none', touchAction: 'manipulation',
          }}>
            <span aria-hidden="true" style={{ position: 'absolute', inset: L.rim + 3, borderRadius: L.radius - 10, background: 'repeating-linear-gradient(45deg, rgba(255,255,255,.018) 0 2px, transparent 2px 6px)', pointerEvents: 'none' }} />

            {/* Đối thủ */}
            {narrow
              ? (
                <div style={{ position: 'absolute', left: 10, right: 10, top: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 5, alignItems: 'start', zIndex: 5 }}>
                  {Array.from({ length: n }, (_, s) => s).filter((s) => s !== base).map((s) => (
                    <div key={s} style={{ gridColumn: COL[slotOf(s)], gridRow: 1, minWidth: 0 }}>{panel(s, true)}</div>
                  ))}
                </div>
              )
              : Array.from({ length: n }, (_, s) => s).filter((s) => s !== base).map((s) => {
                const slot = slotOf(s)
                const at = slot === 'top' ? { left: (L.w - 300) / 2, top: 18, width: 300 } : slot === 'left' ? { left: 22, top: 150, width: 156 } : { right: 22, top: 150, width: 156 }
                return <div key={s} style={{ position: 'absolute', zIndex: 5, ...at }}>{panel(s, false)}</div>
              })}

            {/* Giữa bàn */}
            <div style={{
              position: 'absolute', left: cx - L.ew / 2, top: L.cy - L.eh / 2, width: L.ew, height: L.eh, borderRadius: '50%', border: '2px dashed rgba(240,183,92,.35)',
              background: 'radial-gradient(ellipse, rgba(255,255,255,.06), transparent 70%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: L.gap }}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                  <div aria-hidden="true" style={{ position: 'relative', width: lw, height: lh }}>
                    {Array.from({ length: Math.min(5, Math.max(1, Math.ceil(state.stock / 6))) }, (_, j) => (
                      <span key={j} style={{ position: 'absolute', left: -j * 1.5, top: -j * 2, width: lw, height: lh, borderRadius: 8, background: CARD.back, border: '2px solid ' + CARD.backLine, boxShadow: '0 3px 4px rgba(0,0,0,.5)', opacity: state.stock ? 1 : 0.3 }} />
                    ))}
                    <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', padding: '3px 9px', borderRadius: 99, background: 'rgba(4,8,20,.85)', font: '700 14px/1 var(--font-mono)', color: '#fff', zIndex: 2 }}>{state.stock}</span>
                  </div>
                  <span style={{ font: '400 11.5px/1.2 var(--font-sans)', color: PH.sub }}>{t('games.phom.stockShort')}</span>
                </div>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                  <div data-game-fx style={{ position: 'relative', width: lw, height: lh }}>
                    {last && !state.over
                      ? (
                        <span key={ply} style={{
                          position: 'absolute', left: '50%', top: '50%', width: lw, height: lh, borderRadius: 8, '--r': '0deg', '--fr': '0deg',
                          '--fx': fx0 - lastX + 'px', '--fy': fy0 - lastY + 'px', boxShadow: '0 0 0 2px ' + (last.chot ? '#f87171' : PH.gold) + ', 0 10px 22px -6px rgba(0,0,0,.7)',
                          transform: 'translate(-50%, -50%)', animation: 'tlFly .38s cubic-bezier(.3,.7,.2,1) both',
                        }}>
                          <CardFace c={last.card} w={lw} h={lh} faces={RANK_FACES} />
                          {last.chot && <span style={{ position: 'absolute', top: -7, right: -7, padding: '2px 5px', borderRadius: 99, background: '#c92a2a', color: '#fff', font: '800 9.5px/1.2 var(--font-sans)' }}>{t('games.phom.chotTag')}</span>}
                        </span>
                      )
                      : <span style={{ position: 'absolute', inset: 0, borderRadius: 8, border: '2px dashed rgba(255,255,255,.25)' }} />}
                  </div>
                  <span style={{ maxWidth: 150, font: '400 11.5px/1.2 var(--font-sans)', color: PH.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {last ? t('games.phom.lastBy', { side: who(last.seat) }) : t('games.phom.noLast')}
                  </span>
                </div>
              </div>
              {act && !state.over && (
                <span aria-live="polite" style={{ maxWidth: '96%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', font: '600 12.5px/1.3 var(--font-sans)', textAlign: 'center', padding: '4px 12px', borderRadius: 99, background: 'rgba(4,8,20,.45)' }}>
                  {actText(act, who)}
                </span>
              )}
            </div>

            {/* Mình: tên + trạng thái, chồng đã đánh, phỏm đã hạ, bài trên tay */}
            <div style={{ position: 'absolute', left: L.pad, right: L.pad, bottom: narrow ? 6 : 40, display: 'grid', gap: narrow ? 3 : 4, zIndex: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, whiteSpace: 'nowrap' }}>
                <Seat name={memberOf(base)?.name || nameOf(base)} src={memberOf(base)?.avatarUrl} size={narrow ? 20 : 26} active={onTurn(base)} />
                <span style={{ font: `700 ${narrow ? 13 : 14}px/1.2 var(--font-sans)`, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{seated ? t('games.phom.youCap') : nameOf(base)}</span>
                {meTag && <Tag>{meTag}</Tag>}
                {onTurn(base) && <span style={{ font: '700 12px/1.2 var(--font-sans)', color: PH.teal }}>{seated ? t('games.phom.myTurn') : t('games.phom.thinking')}</span>}
                {!seated && <span style={{ font: '400 11px/1.3 var(--font-mono)', color: PH.sub }}>{t('games.phom.cards', { n: state.counts[base] ?? 0 })}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: Math.round(L.my * 1.4) + 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ font: '400 11px/1 var(--font-sans)', color: PH.mute, marginRight: 3 }}>{t('games.phom.myPile', { n: state.piles[base]?.length ?? 0 })}</span>
                  {(state.piles[base] || []).map((c) => <Mini key={c} c={c} w={L.my} />)}
                </div>
                {state.melds[base]?.length > 0 && <Melds melds={state.melds[base]} w={L.my} />}
              </div>
              {seated && !state.over && !state.out[mySeat] && (
                mine?.failed
                  ? (
                    <div style={{ height: hh + 22, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <span style={{ font: 'var(--type-caption)', color: PH.sub }}>{t('games.phom.handFailed')}</span>
                      <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((x) => x + 1)}>{t('games.phom.reloadHand')}</Button>
                    </div>
                  )
                  : (
                    <div role="group" aria-label={t('games.phom.handAria', { n: hand.length, pts: ptsOf(hand) })} style={{ position: 'relative', height: hh + 22 }}>
                      {hand.map(cardBtn)}
                    </div>
                  )
              )}
            </div>

            <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{fx}</div>

            {/* Màn kết thúc */}
            {ow && (
              <Overlay width={narrow ? 340 : 560} maxHeight={L.h - 40}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 4, textAlign: 'center' }}>
                  <span style={{ font: '600 11px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: G.muted }}>{t('games.phom.finalTitle')}</span>
                  <span style={{ font: `800 ${narrow ? 22 : 28}px/1.2 var(--font-display)`, color: G.goldHi }}>{overTitle}</span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(result?.ranks || Array.from({ length: n }, (_, i) => i)).map((seat, pos) => {
                    const sc = scoreOf(seat)
                    const left = (mine?.hands?.[seat] || []).slice().sort(byNum)
                    const flag = state.mom[seat] ? t('games.phom.momTag') : state.out[seat] ? t('games.phom.outTag') : null
                    return (
                      <div key={seat} style={{ display: 'grid', gap: 6, padding: '8px 10px', borderRadius: 10, background: result && !pos ? G.goldA(0.1) : G.inset }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          {result && <span style={{ flex: 'none', minWidth: 40, font: '800 15px/1 var(--font-display)', color: G.goldHi }}>{placeOf(pos, n)}</span>}
                          <span style={{ flex: 1, minWidth: 0, font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {nameOf(seat)}{seat === mySeat ? ' ' + t('games.wait.youTag') : ''}
                          </span>
                          {flag && <span style={{ flex: 'none', padding: '1px 7px', borderRadius: 99, background: G.redA(0.16), color: G.red, font: '700 11px/1.4 var(--font-sans)' }}>{flag}</span>}
                          {sc != null && <span style={{ flex: 'none', font: '700 15px/1 var(--font-mono)', color: sc > 0 ? G.tealHi : sc < 0 ? G.red : G.muted }}>{money(sc)}</span>}
                        </div>
                        {(state.melds[seat]?.length > 0 || left.length > 0) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                            {state.melds[seat]?.length > 0 && <Melds melds={state.melds[seat]} w={narrow ? 20 : 24} />}
                            {left.length > 0 && <span style={{ font: '400 11px/1.2 var(--font-sans)', color: G.muted, marginLeft: 4 }}>{t('games.phom.leftCards', { n: result?.points?.[seat] ?? ptsOf(left) })}</span>}
                            {left.map((c) => <Mini key={c} c={c} w={narrow ? 20 : 24} />)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <span style={{ font: 'var(--type-caption)', color: G.muted, textAlign: 'center' }}>{t(result ? 'games.phom.scoreNote' : 'games.phom.scorePending')}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setPeek(true)} style={{ ...btn('ghost'), flex: 1, padding: 13 }}>{t('games.phom.viewTable')}</button>
                  {(overActions || []).map((x) => <button key={x.key} type="button" onClick={x.on} style={{ ...btn('primary'), flex: 1.4, padding: 13, font: '800 14px/1 var(--font-sans)' }}>{x.label}</button>)}
                </div>
              </Overlay>
            )}
          </div>
        </div>
      </div>

      {/* Nút dưới bàn (token) */}
      <div style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {uMelds && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 14, background: G.goldA(0.12), border: '1.5px solid ' + G.gold }}>
            <span style={{ flex: 1, font: '700 13.5px/1.3 var(--font-sans)', color: G.goldHi }}>{t('games.phom.uHint')}</span>
            <button type="button" onClick={() => onMove({ u: uMelds })} style={{ ...btn('primary'), background: G.gold, borderColor: G.gold, color: '#2a1800', padding: '9px 22px', font: '800 20px/1 var(--font-display)' }}>{t('games.phom.u')}</button>
          </div>
        )}

        {myTurn && synced && state.step === 'take' && (
          <>
            <span style={S.hint}>{last && !canEat ? t('games.phom.cantEatHint') : t('games.phom.takeHint')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={!canEat} onClick={() => onMove({ eat: true })} style={{ ...btn('primary'), ...S.big, opacity: canEat ? 1 : 0.45, cursor: canEat ? 'pointer' : 'not-allowed' }}>{t('games.phom.eatThis')}</button>
              <button type="button" onClick={() => onMove({ draw: true })} style={{ ...btn('ghost'), ...S.big }}>{t('games.phom.drawStock')}</button>
            </div>
          </>
        )}

        {discarding && (
          <>
            <span style={S.hint}>{t(pend.length ? 'games.phom.pickHintEaten' : 'games.phom.pickHint')}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={sel == null} onClick={() => { const c = sel; setPick({ ply: -1, c: null }); onMove({ discard: c }) }}
                style={{ ...btn('primary'), ...S.big, opacity: sel == null ? 0.45 : 1, cursor: sel == null ? 'not-allowed' : 'pointer' }}>
                {sel == null ? t('games.phom.discard') : t('games.phom.discardCard', { card: faceOf(sel) })}
              </button>
              <button type="button" onClick={hint} style={{ ...btn('ghost'), flex: 'none', minHeight: 48 }}><Icon name="lightbulb" size={16} />{t('games.phom.hint')}</button>
            </div>
          </>
        )}

        {laying && (
          <div style={{ ...card, display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 16, borderColor: G.tealA(0.6), boxShadow: '0 0 30px -10px ' + G.tealA(0.6), gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div style={{ display: 'grid', gap: 2 }}>
              <span style={{ font: '800 14px/1.3 var(--font-sans)' }}>{t('games.phom.layTitle')}</span>
              <span style={S.hintL}>{t('games.phom.layHint')}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {myPlan.melds.length
                ? myPlan.melds.map((m, i) => (
                  <div key={m.join()} style={{ display: 'flex', gap: 2, alignItems: 'center', padding: 4, borderRadius: 9, background: PH.meld, border: '1px solid ' + PH.meldLine }}>
                    {m.map((c) => <Mini key={c} c={c} w={32} tag={pend.includes(c) ? t('games.phom.eatenTag') : null} />)}
                    <button type="button" aria-label={t('games.phom.ungroup')} onClick={() => setMine({ melds: myPlan.melds.filter((_, j) => j !== i) })}
                      style={{ width: 24, height: 24, marginLeft: 2, border: 0, borderRadius: 7, background: 'none', color: G.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="x" size={15} /></button>
                  </div>
                ))
                : <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: G.goldHi }}>{t('games.phom.mom')}</span>}
            </div>
            {myPlan.sel.length > 0 && (
              <button type="button" disabled={!groupOk} onClick={() => setMine({ melds: [...myPlan.melds, myPlan.sel.slice().sort(byNum)], sel: [] })}
                style={{ ...btn('ghost', { sm: true }), justifySelf: 'start', opacity: groupOk ? 1 : 0.45 }}><Icon name="plus" size={14} />{t('games.phom.group')}</button>
            )}
            {canSend.map(([to, , c]) => {
              const on = sends.some((x) => x[2] === c)
              return (
                <label key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', font: '400 12.5px/1.3 var(--font-sans)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => setMine({ skip: myPlan.skip.includes(c) ? myPlan.skip.filter((x) => x !== c) : [...myPlan.skip, c] })} />
                  {t('games.phom.sendTo', { card: faceOf(c), side: nameOf(to) })}
                </label>
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, font: '400 12px/1.3 var(--font-mono)', color: G.muted }}>{t('games.phom.leftPts', { n: ptsOf(rest.filter((c) => !sends.some((x) => x[2] === c))) })}</span>
              {layErr && <span role="alert" style={{ font: '400 12px/1.3 var(--font-sans)', color: G.red }}>{t(layErr)}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={!!layErr} onClick={() => onMove(layMove)} style={{ ...btn('primary'), flex: 1, minHeight: 44, opacity: layErr ? 0.45 : 1 }}>{t(myPlan.melds.length ? 'games.phom.lay' : 'games.phom.layMom')}</button>
              <button type="button" onClick={() => setPlan({ ply: -1, melds: null, sel: [], skip: [] })} style={btn('ghost', { sm: true })}>{t('games.phom.suggest')}</button>
            </div>
          </div>
        )}

        {waitTxt && <span style={S.hint}>{waitTxt}</span>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ font: '400 12px/1.3 var(--font-mono)', color: G.muted, whiteSpace: 'nowrap' }}>{seated && hand.length ? t('games.phom.handPts', { n: ptsOf(hand) }) : ''}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {state.over && peek && <button type="button" onClick={() => setPeek(false)} style={btn('soft', { sm: true })}>{t('games.phom.showResult')}</button>}
            {seated && !state.over && hand.length > 0 && (
              <button type="button" onClick={() => setSuitSort((x) => !x)} style={btn('ghost', { sm: true })}>{t(suitSort ? 'games.phom.sortSuit' : 'games.phom.sortRank')}</button>
            )}
            {(actions || []).map((x) => (
              <button key={x.key} type="button" disabled={x.off} onClick={x.on} style={{ ...btn(x.danger ? 'danger' : 'ghost', { sm: true }), opacity: x.off ? 0.45 : 1 }}>
                <Icon name={x.icon} size={14} />{x.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const placeOf = (pos, n) => t(pos === n - 1 ? 'games.phom.placeLast' : 'games.phom.place' + pos)

/** Câu kể nước vừa rồi. */
function actText(act, nameOf) {
  if (!act) return ''
  const side = nameOf(act.seat)
  if (act.out) return t('games.phom.lastOut', { side })
  if (act.draw) return t('games.phom.lastDraw', { side })
  if (act.eat != null) return t(act.chot ? 'games.phom.lastEatChot' : 'games.phom.lastEat', { side, card: faceOf(act.eat), from: nameOf(act.from) })
  if (act.lay) return act.lay.length ? t('games.phom.lastLay', { side, n: act.lay.length, k: act.send.length }) : t('games.phom.lastMom', { side })
  if (act.discard != null) return t('games.phom.lastDiscard', { side, card: faceOf(act.discard) })
  return ''
}

const S = {
  hint: { font: '400 12.5px/1.4 var(--font-sans)', color: G.muted, textAlign: 'center' },
  hintL: { font: '400 11.5px/1.45 var(--font-sans)', color: G.muted },
  big: { flex: 1, minHeight: 48, padding: '11px 20px', font: '800 15px/1 var(--font-sans)' },
}
