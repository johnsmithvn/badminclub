import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { CARD, G, btn } from '#components/games/stage.js'
import { rnd, useFit } from '#components/games/chessUi.js'
import { CardFace } from '#components/games/PlayingCard.jsx'
import { Overlay, Seat } from '#components/games/cardTable.jsx'
import xd, { deadlineOf, kindOf, MAX_CARDS, pointsOf, standMin } from '#lib/games/xidach.js'

/**
 * Bàn Xì dách (bản thiết kế "Xì dách · Sòng trăng", 2026-11-14): chiếu nỉ lục viền gỗ, nhà cái ngồi đầu bàn, các con xếp
 * vòng cung quanh mép dưới (mình ở giữa đáy khi làm con), giữa bàn là nọc + dòng trạng thái ván. Lá mới bay ra từ nọc.
 * Nút Rút thêm / Dằn bài (con) · Cái rút / Lật cả bàn (cái) nằm DƯỚI bàn, dùng token. Hết trận: bảng điểm đè lên bàn.
 * Bản thiết kế có ô đặt cược + nút "Xét" nhưng đang tắt (luật hiện tại chơi bằng điểm, cái chỉ lật cả bàn) — chưa làm.
 * Hai bố cục theo bề rộng khung (như Phỏm): rộng 800 × 720, khung hẹp hơn 560px thì bàn 374 × 560. Co bằng useFit.
 *
 * Bài trên tay nạp riêng từ game_hands (RLS chỉ trả tay mình); server kiểm dằn đủ tuổi (0098). Luật: lib/games/xidach.js.
 * Hết ván máy bất kỳ xin chia ván mới sau vài giây. Props sân khấu (GameRoom `stageProps`): `actions`, `overActions`, `note`.
 */
const signed = (n) => (n > 0 ? '+' + n : String(n))
const NEXT_MS = 5000

// Chiếu + lá + kính trên chiếu: "vật" có màu riêng, giữ nguyên ở sáng / tối (DESIGN.md §2.4). Nút dưới bàn dùng token.
const XD = {
  felt: 'radial-gradient(ellipse 70% 55% at 50% 0%, #215e46 0%, #174a37 45%, #0e3226 75%, #0a241c 100%)',
  rim: (r) => `0 40px 90px -30px rgba(0,0,0,.95), inset 0 0 0 ${r}px #5a3a1c, inset 0 0 0 ${r + 3}px #c99a2e, inset 0 0 70px rgba(0,0,0,.55)`,
  glass: 'rgba(10,16,30,.62)',
  dealer: 'linear-gradient(180deg, rgba(60,36,8,.92), rgba(24,16,6,.92))',
  line: 'rgba(255,255,255,.12)',
  pill: 'rgba(4,8,20,.6)',
  ink: '#E9EFF7',
  sub: '#A8B7CB',
  mute: '#8494AA',
  gold: '#F0B75C',
  goldHi: '#ffe08a',
  teal: '#2FCCC3',
}
// Màu nhãn từng loại bài lúc lật.
const KIND_BG = { xiban: '#c99a2e', xidach: '#c99a2e', ngulinh: '#7c5cff', quac: '#c92a2a', du: 'rgba(4,8,20,.6)' }

// Toạ độ theo bản thiết kế: `dealer` / `center` tâm hộp cái / giữa bàn, `spots` 7 chỗ ngồi vòng cung (trái → phải).
// `cw` / `cs` lá con (rộng / bước), `mw` / `ms` lá của mình, `dw` / `ds` lá nhà cái. `arc` = vòng cung trang trí [cỡ, tâm y].
const WIDE = {
  w: 800, h: 720, rim: 8, radius: 30, dealer: [400, 112], center: [400, 318], arc: [1100, -60], mark: 370,
  spots: [[77, 248], [140, 439], [255, 572], [400, 620], [545, 572], [660, 439], [723, 248]],
  cw: 40, cs: 24, mw: 56, ms: 36, dw: 48, ds: 30, seat: 26,
}
const NARROW = {
  w: 374, h: 560, rim: 5, radius: 22, dealer: [187, 70], center: [187, 268], arc: [620, 30], mark: 320,
  spots: [[56, 212], [56, 346], [58, 478], [187, 478], [316, 478], [318, 346], [318, 212]],
  cw: 28, cs: 15, mw: 40, ms: 24, dw: 34, ds: 20, seat: 20,
}
// Chỗ ngồi cho các con khác, theo số người (đối xứng quanh giữa đáy). Mình làm con thì luôn ở chỗ 3.
const SPREAD = { 1: [3], 2: [1, 5], 3: [1, 3, 5], 4: [0, 2, 4, 6], 5: [0, 1, 3, 5, 6], 6: [0, 1, 2, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] }
const AROUND = { 0: [], 1: [1], 2: [1, 5], 3: [0, 1, 5], 4: [0, 1, 5, 6], 5: [0, 1, 2, 5, 6], 6: [0, 1, 2, 4, 5, 6] }

const Pill = ({ children, bg, sm }) => (
  <span style={{ padding: '1px 7px', borderRadius: 99, background: bg || XD.pill, color: '#fff', font: `800 ${sm ? 10.5 : 11.5}px/1.5 var(--font-sans)`, whiteSpace: 'nowrap' }}>{children}</span>
)

function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

export default function XiDachBoard({ state, mySeat, onMove, roomId, result, players, names, stake = 0, actions, overActions, note, hands: given }) {
  const { a, db } = useApp()
  const [ref, k0] = useFit(WIDE.w)
  // Khung hẹp hơn ~560px thì đổi sang bàn hẹp — co bàn rộng xuống đó thì chữ trên ghế không đọc nổi.
  const narrow = k0 * WIDE.w < 560
  const L = narrow ? NARROW : WIDE
  const k = narrow ? Math.min(1, (k0 * WIDE.w) / NARROW.w) : k0
  const [peek, setPeek] = useState(false)

  const { started, phase, banker, turn, over, show, xi, won, last } = state
  const seated = mySeat != null && started && !state.out[mySeat]
  const live = started && !over && !result

  // Bài trên tay: nạp lại mỗi khi sang ván hoặc số lá của mình đổi (vừa rút).
  const key = state.round + ':' + (state.counts[mySeat] ?? 0)
  const [dealt, setDealt] = useState(null) // { key, cards } | { key, failed }
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (given || !seated || !live) return undefined
    let on = true
    a.gameHand(roomId)
      .then((hands) => { if (on) setDealt({ key, cards: (hands?.[mySeat] || []).slice() }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (on) setDealt({ key, failed: true }) })
    return () => { on = false }
  }, [a, roomId, seated, live, mySeat, key, tries, given])
  // Chơi với máy (BotRoom) truyền sẵn `hands` (như game_hands) — khỏi hỏi server.
  const mine = show?.[mySeat] || xi?.[mySeat] || (given ? given[mySeat] || null : dealt?.key === key ? dealt.cards : null)

  // Hết giờ lượt → { timeout }: người tới lượt báo trước, người khác chờ thêm. Hết ván → xin chia ván mới sau NEXT_MS.
  const due = deadlineOf(state)
  const now = useNow(live && due != null)
  const [again, setAgain] = useState(0)
  useEffect(() => {
    if (!live || !seated) return undefined
    const n = state.n0
    const rank = (mySeat - (turn ?? banker) + n) % n
    const stagger = rank === 0 ? 300 : 2000 + rank * 800
    let wait
    if (phase === 'done') wait = NEXT_MS + stagger
    else if (due != null) wait = Math.max(0, due - Date.now()) + stagger
    else return undefined
    const move = phase === 'done' ? { deal: true } : { timeout: true }
    const fire = setTimeout(() => onMove(move), wait)
    const retry = setTimeout(() => setAgain((x) => x + 1), wait + 4000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [live, seated, phase, due, turn, banker, mySeat, state.n0, state.ply, again, onMove])
  const secs = live && due != null ? Math.max(0, Math.ceil((due - now) / 1000)) : null
  const pct = secs != null && state.opts?.time ? Math.min(100, Math.round(((due - now) / (state.opts.time * 1000)) * 100)) : null
  const low = secs != null && secs <= 5

  const memberOf = (seat) => db.members.find((m) => m.id === players?.find((p) => p.seat === seat)?.memberId)
  const nameOf = (seat) => names?.[seat] || memberOf(seat)?.name || t('games.xidach.mark' + seat)
  const who = (seat) => (seat === mySeat ? t('games.xidach.youCap') : nameOf(seat))

  const scores = result?.scores || xd.result(state)?.scores || Object.fromEntries(state.scores.map((v, i) => [i, v]))
  const myTurn = live && seated && phase === 'play' && turn === mySeat
  const meBanker = mySeat === banker
  const pts = mine ? pointsOf(mine) : null
  const canStand = myTurn && pts != null && pts >= standMin(state, mySeat)
  const canDraw = myTurn && state.counts[mySeat] < MAX_CARDS

  // ── Ai ngồi chỗ nào: cái ở đầu bàn, các con theo thứ tự lượt trên vòng cung. ──
  const n = state.n0 || 0
  const cons = Array.from({ length: Math.max(0, n - 1) }, (_, j) => (banker + 1 + j) % n)
  const spotOf = {}
  if (mySeat != null && mySeat !== banker && n) {
    spotOf[mySeat] = 3
    const others = cons.filter((y) => y !== mySeat)
    others.forEach((y, j) => { spotOf[y] = AROUND[others.length][j] })
  } else cons.forEach((y, j) => { spotOf[y] = SPREAD[cons.length][j] })
  const posOf = (seat) => (seat === banker ? L.dealer : L.spots[spotOf[seat]] || L.center)

  // ── Nhãn ghế (như bản thiết kế): lúc lật "+1 · Xì dách" / "−1" / "Hoà"; bài mình hoặc đã lật thì loại bài đặc biệt; đã dằn. ──
  const tagOf = (seat) => {
    if (state.out[seat]) return [t('games.xidach.stOut'), '#3a4566']
    const open = seat === mySeat ? mine : show?.[seat] || xi?.[seat]
    const kd = open?.length ? kindOf(open) : null
    const special = kd && kd !== 'du' ? t('games.xidach.kind.' + kd, { n: pointsOf(open) }) : ''
    const w = phase === 'done' ? won?.[seat] : undefined
    if (w !== undefined) return [(w ? signed(w) : t('games.xidach.tie')) + (special ? ' · ' + special : ''), w > 0 ? '#2b8a3e' : w < 0 ? '#5b6470' : '#3a4566']
    if (special) return [special, kd === 'quac' ? '#c92a2a' : '#c99a2e']
    if (phase === 'play' && state.stood[seat] && !xi?.[seat]) return [t('games.xidach.stStood'), '#3a4566']
    return null
  }

  // ── Bài của một ghế: lá ngửa (mình / đã lật / có xì) hoặc lá úp; lá mới bay ra từ nọc. ──
  const [sx, sy] = L.center
  const hand = (seat, w, step) => {
    const open = seat === mySeat ? mine : show?.[seat] || xi?.[seat]
    const cnt = open ? open.length : state.counts[seat] || 0
    const h = Math.round(w * 1.4)
    const [px, py] = posOf(seat)
    return (
      <div data-game-fx style={{ position: 'relative', height: h, width: cnt ? w + step * (cnt - 1) : w }}>
        {Array.from({ length: cnt }, (_, j) => (
          <span key={state.round + ':' + j + (open ? 'o' : 'b')} style={{
            position: 'absolute', left: j * step + w / 2, top: h / 2, width: w, height: h, borderRadius: 6, boxShadow: '0 3px 8px rgba(0,0,0,.45)',
            transform: 'translate(-50%, -50%)', '--fx': sx - px + 'px', '--fy': sy - py + 'px', '--fr': '0deg', '--r': '0deg',
            animation: open && seat !== mySeat ? 'gameFlip var(--dur-slow) var(--ease-standard) both' : `tlFly .4s cubic-bezier(.3,.7,.2,1) ${(j * 0.06).toFixed(2)}s both`,
            ...(open ? null : { background: CARD.back, border: '2px solid ' + CARD.backLine }),
          }}>
            {open && <CardFace c={open[j]} w={w} h={h} />}
          </span>
        ))}
      </div>
    )
  }

  const pillPts = (seat) => {
    const open = seat === mySeat ? mine : show?.[seat] || xi?.[seat]
    return open ? t('games.xidach.points', { n: pointsOf(open) }) : null
  }

  const seatBox = (seat) => {
    const isMe = seat === mySeat
    const on = phase === 'play' && live && seat === turn
    const tag = tagOf(seat)
    const m = memberOf(seat)
    const sc = scores?.[seat] ?? 0
    const p = pillPts(seat)
    return (
      <div style={{
        display: 'grid', justifyItems: 'center', gap: narrow ? 3 : 5, padding: narrow ? '6px 7px' : '8px 10px', borderRadius: narrow ? 12 : 16, background: XD.glass,
        border: '1.5px solid ' + (on ? XD.teal : isMe ? 'rgba(47,204,195,.45)' : XD.line), boxShadow: on ? '0 0 22px -4px ' + XD.teal : 'none',
        opacity: state.out[seat] ? 0.5 : 1, transition: 'box-shadow .3s, border-color .3s', maxWidth: narrow ? 150 : 230,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', minWidth: 0 }}>
          <Seat name={m?.name || nameOf(seat)} src={m?.avatarUrl} size={L.seat} active={on} pct={on ? pct : null} low={low} />
          <div style={{ minWidth: 0, display: 'grid' }}>
            <span style={{ font: `700 ${narrow ? 11.5 : 13}px/1.2 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: narrow ? 70 : 110 }}>{who(seat)}</span>
            <span style={{ font: `400 ${narrow ? 10 : 11}px/1.3 var(--font-mono)`, color: XD.gold, whiteSpace: 'nowrap' }}>{t('games.xidach.points', { n: signed(sc) })}</span>
          </div>
        </div>
        {hand(seat, isMe ? L.mw : L.cw, isMe ? L.ms : L.cs)}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', minHeight: narrow ? 16 : 20 }}>
          {p && phase === 'play' && <Pill sm={narrow}>{p}</Pill>}
          {tag && <Pill sm={narrow} bg={tag[1]}>{tag[0]}</Pill>}
        </div>
        {note?.[seat] && <span style={{ font: '400 10.5px/1.2 var(--font-mono)', color: XD.gold, whiteSpace: 'nowrap' }}>{note[seat]}</span>}
      </div>
    )
  }

  // ── Dòng giữa bàn ──
  let banner = ''
  if (!started) banner = t('games.xidach.waiting')
  else if (over) banner = t('games.xidach.final')
  else if (phase === 'done') banner = last?.xiBanker ? t('games.xidach.bankerXi', { side: who(banker) }) : show ? t('games.xidach.shown') : t('games.xidach.voided')
  else if (turn != null) {
    banner = turn === mySeat ? t(meBanker ? 'games.xidach.bnMeBanker' : 'games.xidach.bnMe')
      : t(turn === banker ? 'games.xidach.bnBanker' : 'games.xidach.bnTurn', { side: nameOf(turn) })
  }
  const stock = Math.max(0, 52 - state.counts.reduce((x, c) => x + c, 0))

  // ── Hiệu ứng: lật bài thì chữ loại bài đặc biệt đóng dấu trên ghế; hết trận pháo giấy ở người nhất. ──
  const fx = []
  if (phase === 'done' && show) {
    Object.entries(show).forEach(([y, cards]) => {
      const kd = kindOf(cards)
      if (kd === 'du') return
      const [x, yy] = posOf(Number(y))
      fx.push(<div key={'k' + state.round + y} style={{ position: 'absolute', left: x, top: yy - (narrow ? 30 : 46), padding: '4px 12px', borderRadius: 99, background: KIND_BG[kd], color: kd === 'xiban' || kd === 'xidach' ? '#2a1800' : '#fff', font: `800 ${narrow ? 13 : 18}px/1.2 var(--font-display)`, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(0,0,0,.45)', opacity: 0, animation: 'tlStamp 1.8s ease-out forwards', zIndex: 40 }}>
        {t('games.xidach.kind.' + kd, { n: pointsOf(cards) })}
      </div>)
    })
  }
  const ranks = state.scores.map((_, i) => i).sort((x, y) => (scores?.[y] ?? 0) - (scores?.[x] ?? 0))
  if (over && n) {
    const [x, y] = posOf(ranks[0])
    for (let j = 0; j < 40; j++) {
      const ang = (j / 40) * Math.PI * 2
      const d = 90 + rnd(j * 3) * 200
      fx.push(<span key={'w' + j} style={{ position: 'absolute', left: x, top: y, width: 8, height: 14, borderRadius: 2, background: [XD.teal, XD.gold, '#f87171', '#93c5fd'][j % 4], '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d + 'px', opacity: 0, animation: `chBurst ${(1 + rnd(j) * 0.6).toFixed(2)}s cubic-bezier(.15,.7,.3,1) forwards`, zIndex: 41 }} />)
    }
  }

  const failed = dealt?.key === key && dealt.failed && !mine
  const ow = over && !peek
  const money = (sc) => (stake > 0 ? t('games.coins.stakeOpt', { n: (sc > 0 ? '+' : '') + (sc * stake).toLocaleString('vi-VN') }) : t('games.xidach.points', { n: signed(sc) }))
  const waitTxt = !seated || !live || phase !== 'play' || myTurn ? ''
    : xi?.[mySeat] ? t('games.xidach.youXi') : turn != null ? t('games.xidach.waitTurn', { side: nameOf(turn) }) : ''

  const [dx, dy] = L.dealer
  const [cx, cy] = L.center
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div ref={ref} style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', justifyItems: 'center' }}>
        <div style={{ width: L.w * k, height: L.h * k, position: 'relative' }}>
          <div style={{
            width: L.w, height: L.h, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden', borderRadius: L.radius,
            background: XD.felt, boxShadow: XD.rim(L.rim), color: XD.ink, userSelect: 'none', touchAction: 'manipulation',
          }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: L.arc[1], width: L.arc[0], height: L.arc[0], transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '2px solid rgba(240,183,92,.28)', pointerEvents: 'none' }} />
            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: L.arc[1], width: L.arc[0] - 70, height: L.arc[0] - 70, transform: 'translate(-50%, -50%)', borderRadius: '50%', border: '1px dashed rgba(240,183,92,.22)', pointerEvents: 'none' }} />
            <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: L.mark, transform: 'translateX(-50%)', font: `800 ${narrow ? 26 : 40}px/1 var(--font-display)`, letterSpacing: '.08em', color: 'rgba(240,183,92,.13)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>{t('games.xidach.feltMark')}</span>

            {/* Nhà cái */}
            {started && banker != null && (
              <div style={{ position: 'absolute', left: dx, top: dy, transform: 'translate(-50%, -50%)', zIndex: 30 }}>
                <div style={{
                  position: 'relative', display: 'grid', justifyItems: 'center', gap: 5, padding: narrow ? '8px 12px' : '10px 16px', borderRadius: 20, background: XD.dealer,
                  border: '2px solid ' + (phase === 'play' && turn === banker ? XD.teal : '#c99a2e'), boxShadow: phase === 'play' && turn === banker ? '0 0 26px -4px ' + XD.teal : '0 10px 30px -10px rgba(0,0,0,.8)',
                }}>
                  <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', padding: '2px 12px', borderRadius: 99, background: 'linear-gradient(180deg, #ffe08a, #e0a020)', color: '#2a1800', font: '800 12px/1.4 var(--font-display)', letterSpacing: '.06em', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.5)' }}>{t('games.xidach.dealerTag')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Seat name={memberOf(banker)?.name || nameOf(banker)} src={memberOf(banker)?.avatarUrl} size={narrow ? 22 : 28} active={phase === 'play' && live && turn === banker} pct={turn === banker ? pct : null} low={low} />
                    <div style={{ display: 'grid' }}>
                      <span style={{ font: `800 ${narrow ? 12.5 : 14}px/1.2 var(--font-sans)`, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{who(banker)}</span>
                      <span style={{ font: '400 11px/1.3 var(--font-mono)', color: XD.gold, whiteSpace: 'nowrap' }}>{t('games.xidach.points', { n: signed(scores?.[banker] ?? 0) })}</span>
                    </div>
                  </div>
                  {hand(banker, meBanker ? L.mw : L.dw, meBanker ? L.ms : L.ds)}
                  <div style={{ display: 'flex', gap: 4, minHeight: 18, whiteSpace: 'nowrap' }}>
                    {pillPts(banker) && phase === 'play' && <Pill sm={narrow}>{pillPts(banker)}</Pill>}
                    {tagOf(banker) && <Pill sm={narrow} bg={tagOf(banker)[1]}>{tagOf(banker)[0]}</Pill>}
                  </div>
                </div>
              </div>
            )}

            {/* Giữa bàn: nọc + trạng thái ván */}
            <div style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%, -50%)', display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center', zIndex: 5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ position: 'relative', width: narrow ? 30 : 40, height: narrow ? 42 : 56 }}>
                  {[4, 0].map((o) => <span key={o} style={{ position: 'absolute', left: o, top: -o, width: '100%', height: '100%', borderRadius: 5, background: CARD.back, border: '1.5px solid ' + CARD.backLine, opacity: o ? 0.7 : 1 }} />)}
                </span>
                <span style={{ font: '400 12px/1 var(--font-mono)', color: XD.sub }}>{t('games.xidach.stock', { n: stock })}</span>
              </div>
              {banner && (
                <span aria-live="polite" style={{ maxWidth: narrow ? 230 : 340, padding: narrow ? '5px 12px' : '6px 16px', borderRadius: 99, background: XD.pill, border: '1px solid rgba(240,183,92,.4)', font: `700 ${narrow ? 12 : 14}px/1.3 var(--font-sans)`, color: XD.goldHi, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{banner}</span>
              )}
              {started && (
                <span style={{ font: `600 ${narrow ? 9.5 : 10.5}px/1.3 var(--font-mono)`, letterSpacing: '.12em', textTransform: 'uppercase', color: XD.mute }}>
                  {t('games.xidach.round', { r: state.round + 1, n: state.rounds })} · {t('games.xidach.payRule')}
                  {secs != null ? ' · ' + t('games.xidach.secs', { n: secs }) : ''}
                </span>
              )}
              {last?.timeout && live && <span style={{ font: '400 11px/1.2 var(--font-mono)', color: XD.sub }}>{t('games.xidach.autoMove', { side: who(last.seat) })}</span>}
            </div>

            {/* Các con */}
            {cons.map((y) => {
              const [x, yy] = posOf(y)
              return <div key={y} style={{ position: 'absolute', left: x, top: yy, transform: 'translate(-50%, -50%)', zIndex: y === mySeat ? 12 : 10 }}>{seatBox(y)}</div>
            })}

            <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {phase === 'done' && show && <span key={'sw' + state.round} style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,236,170,.22), transparent)', opacity: 0, animation: 'xdSweep 1.2s ease-out' }} />}
              {fx}
            </div>

            {/* Hết trận: bảng điểm cộng dồn */}
            {ow && (
              <Overlay width={narrow ? 340 : 480} maxHeight={L.h - 40}>
                <div style={{ display: 'grid', justifyItems: 'center', gap: 4, textAlign: 'center' }}>
                  <span style={{ font: '600 11px/1 var(--font-mono)', letterSpacing: '.14em', textTransform: 'uppercase', color: G.muted }}>{t('games.xidach.final')}</span>
                  <span style={{ font: `800 ${narrow ? 22 : 28}px/1.2 var(--font-display)`, color: G.goldHi }}>
                    {ranks[0] === mySeat ? t('games.xidach.overMe') : t('games.xidach.overWin', { name: nameOf(ranks[0]) })}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {ranks.map((seat, pos) => {
                    const sc = scores?.[seat] ?? 0
                    return (
                      <div key={seat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: pos ? G.inset : G.goldA(0.1), minWidth: 0 }}>
                        <span style={{ flex: 'none', minWidth: 22, font: '800 15px/1 var(--font-display)', color: G.goldHi }}>{pos + 1}</span>
                        <span style={{ flex: 1, minWidth: 0, font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {nameOf(seat)}{seat === mySeat ? ' ' + t('games.wait.youTag') : ''}{state.out[seat] ? ' · ' + t('games.xidach.stOut') : ''}
                        </span>
                        <span style={{ flex: 'none', font: '700 15px/1 var(--font-mono)', color: sc > 0 ? G.tealHi : sc < 0 ? G.red : G.muted }}>{money(sc)}</span>
                      </div>
                    )
                  })}
                </div>
                <span style={{ font: 'var(--type-caption)', color: G.muted, textAlign: 'center' }}>{t('games.xidach.scoreNote', { n: state.rounds })}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setPeek(true)} style={{ ...btn('ghost'), flex: 1, padding: 13 }}>{t('games.xidach.viewTable')}</button>
                  {(overActions || []).map((x) => <button key={x.key} type="button" onClick={x.on} style={{ ...btn('primary'), flex: 1.4, padding: 13, font: '800 14px/1 var(--font-sans)' }}>{x.label}</button>)}
                </div>
              </Overlay>
            )}
          </div>
        </div>
      </div>

      {/* Nút dưới bàn (token) */}
      <div style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {failed && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={S.hint}>{t('games.tienlen.handFailed')}</span>
            <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((x) => x + 1)}>{t('games.tienlen.reloadHand')}</Button>
          </div>
        )}

        {myTurn && (
          <>
            <span style={{ ...S.hint, color: meBanker ? G.goldHi : G.muted }}>
              {pts != null && t('games.xidach.points', { n: pts }) + ' · '}
              {pts > 21 ? t('games.xidach.hintQuac') : canStand ? t(meBanker ? 'games.xidach.hintBankerStand' : 'games.xidach.hintStand') : t('games.xidach.needAge', { n: standMin(state, mySeat) })}
              {secs != null ? ' · ' + t('games.xidach.secs', { n: secs }) : ''}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {meBanker
                ? (
                  <>
                    <button type="button" disabled={!canDraw} onClick={() => onMove({ draw: true })} style={{ ...btn('ghost'), ...S.big, opacity: canDraw ? 1 : 0.45 }}>{t('games.xidach.bankerDraw')}</button>
                    <button type="button" disabled={!canStand} onClick={() => onMove({ stand: true })} style={{ ...btn('primary'), ...S.big, opacity: canStand ? 1 : 0.45 }}>{t('games.xidach.reveal')}</button>
                  </>
                )
                : (
                  <>
                    <button type="button" disabled={!canDraw} onClick={() => onMove({ draw: true })} style={{ ...btn('primary'), ...S.big, opacity: canDraw ? 1 : 0.45 }}>{t('games.xidach.drawMore')}</button>
                    <button type="button" disabled={!canStand} onClick={() => onMove({ stand: true })} style={{ ...btn('ghost'), ...S.big, opacity: canStand ? 1 : 0.45 }}>{t('games.xidach.standHand')}</button>
                  </>
                )}
            </div>
          </>
        )}

        {waitTxt && <span style={{ ...S.hint, padding: '10px 0' }}>{waitTxt}</span>}

        {live && seated && phase === 'done' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span style={S.hint}>{t('games.xidach.nextSoon')}</span>
            <button type="button" onClick={() => onMove({ deal: true })} style={btn('soft', { sm: true })}>{t('games.xidach.next')}</button>
          </div>
        )}

        {((actions?.length > 0) || (over && peek)) && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {over && peek && <button type="button" onClick={() => setPeek(false)} style={btn('soft', { sm: true })}>{t('games.xidach.showResult')}</button>}
            {(actions || []).map((x) => (
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
  big: { flex: 1, minHeight: 48, padding: '11px 20px', font: '800 15px/1 var(--font-sans)' },
}
