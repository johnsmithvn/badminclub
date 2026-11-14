import { useEffect, useRef, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { CARD, G, btn } from '#components/games/stage.js'
import { rnd, useFit } from '#components/games/chessUi.js'
import { CardFace } from '#components/games/PlayingCard.jsx'
import { Seat } from '#components/games/cardTable.jsx'
import { RANK_FACES, faceOf } from '#lib/games/phom.js'
import { nutOf, scoreOf, topOf } from '#lib/games/bacay.js'

/**
 * Bàn Ba cây (bản thiết kế "Ba cây · Đêm nặn bài", 2026-11-14): chiếu nhung đỏ bầu dục viền gỗ, tối đa 8 ghế quanh bàn
 * (mình ở giữa đáy), giữa bàn là số người đã lật + dòng trạng thái. Ba lá của mình nằm to DƯỚI bàn: kéo góc phải dưới
 * lên để hé (hoặc chạm để hé dần) — chỉ máy mình thấy — rồi bấm Lật cho cả bàn xem. Người thắng đội vương miện.
 * Bản thiết kế có ô góp cược (ante) nhưng đang tắt (luật hiện tại chơi bằng điểm) — chưa làm.
 * Hai bố cục theo bề rộng khung (như Phỏm): rộng 800 × 560, khung hẹp hơn 560px thì bàn 374 × 400. Co bằng useFit.
 *
 * Bài trên tay không có trong state trước khi lật (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay
 * mình, hết ván trả mọi tay). Lá đã lật nằm trong log. Luật: lib/games/bacay.js · server: 0092.
 */

// Chiếu + lá: "vật" có màu riêng, giữ nguyên ở sáng / tối (DESIGN.md §2.4). Nút dưới bàn dùng token.
const BC = {
  room: 'radial-gradient(ellipse 60% 50% at 50% 48%, rgba(255,214,120,.18), transparent 70%), #0b1730',
  felt: 'radial-gradient(ellipse at 50% 45%, #7a2236, #5a1828 55%, #3a0f1a 100%)',
  rim: (r) => `0 0 0 ${r}px #5a3a1c, 0 0 0 ${r + 3}px #c99a2e, 0 30px 60px rgba(0,0,0,.7), inset 0 0 60px rgba(0,0,0,.5)`,
  glass: 'rgba(10,16,30,.66)',
  line: 'rgba(255,255,255,.12)',
  pill: 'rgba(4,8,20,.6)',
  ink: '#E9EFF7',
  sub: '#A8B7CB',
  mute: '#8494AA',
  gold: '#F0B75C',
  goldHi: '#ffe08a',
  crown: '#ffcf3a',
  teal: '#2FCCC3',
}

// Toạ độ theo bản thiết kế: `seats` 8 chỗ theo chiều kim đồng hồ từ giữa đáy, `oval` mặt bàn [trái, trên, rộng, cao],
// `fw` / `fs` lá nhỏ trên ghế (rộng / bước), `mw` lá to của mình.
const WIDE = {
  w: 800, h: 560, radius: 28, rim: 9, pot: [400, 280], oval: [110, 100, 580, 360], fw: 36, fs: 18, mw: 120, seat: 22,
  seats: [[400, 468], [174, 421], [80, 280], [174, 139], [400, 80], [626, 139], [720, 280], [626, 421]],
}
const NARROW = {
  w: 374, h: 400, radius: 22, rim: 6, pot: [187, 200], oval: [52, 98, 270, 204], fw: 24, fs: 9, mw: 84, seat: 18,
  seats: [[187, 344], [88, 306], [47, 200], [88, 94], [187, 50], [286, 94], [327, 200], [286, 306]],
}
// Ít người thì rải đều quanh bàn (chỗ 0 luôn là mình / ghế đầu).
const RING = { 2: [0, 4], 3: [0, 3, 5], 4: [0, 2, 4, 6], 5: [0, 2, 3, 5, 6], 6: [0, 1, 3, 4, 5, 7], 7: [0, 1, 2, 3, 5, 6, 7], 8: [0, 1, 2, 3, 4, 5, 6, 7] }

const nutText = (cards) => (nutOf(cards) === 0 ? t('games.bacay.bu') : t('games.bacay.nut', { n: nutOf(cards) }))
const nutBg = (cards) => (nutOf(cards) >= 8 ? '#c99a2e' : nutOf(cards) === 0 ? '#5b6470' : '#3a4566')

/**
 * Một lá to để nặn: mặt lá nằm dưới, lưng lá phủ lên và bị cắt mất một tam giác ở góc phải dưới theo `peel` (0 → 1).
 * Kéo góc lên trái để hé, chạm để hé thêm một nấc. Hé quá 85% thì lật hẳn.
 */
function SqueezeCard({ c, w, peel, onPeel, label }) {
  const h = Math.round(w * 1.4)
  const drag = useRef(null)
  const set = (p) => onPeel(p >= 0.85 ? 1 : Math.max(peel, p))
  const cut = peel * (w + h)
  const clip = peel >= 1 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(0 0, 100% 0, 100% ${Math.max(0, h - cut)}px, ${Math.max(0, w - cut)}px 100%, 0 100%)`
  return (
    <button type="button" aria-label={label} disabled={peel >= 1}
      onClick={() => { if (!drag.current?.moved) set(peel + 0.34) }}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId) }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        const dist = Math.max(0, d.x - e.clientX) + Math.max(0, d.y - e.clientY)
        if (dist > 6) { d.moved = true; set(dist / (w + h)) }
      }}
      onPointerUp={() => { setTimeout(() => { drag.current = null }, 0) }}
      style={{ position: 'relative', width: w, height: h, padding: 0, border: 0, borderRadius: 10, background: 'none', cursor: peel >= 1 ? 'default' : 'grab', touchAction: 'none', boxShadow: '0 14px 30px -10px rgba(0,0,0,.8)' }}>
      {c != null && <CardFace c={c} w={w} h={h} faces={RANK_FACES} />}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: CARD.back, border: '3px solid ' + CARD.backLine, clipPath: clip, transition: 'clip-path .18s' }} />
      {peel < 1 && <span aria-hidden="true" style={{ position: 'absolute', right: 6, bottom: 6, width: 18, height: 18, borderRight: '3px solid rgba(255,224,138,.8)', borderBottom: '3px solid rgba(255,224,138,.8)', borderRadius: 3, animation: 'chHint 1.4s ease-in-out infinite' }} />}
    </button>
  )
}

export default function BaCayBoard({ state, mySeat, onMove, roomId, result, players, names, stake = 0, actions, overActions, note, hands: given }) {
  const { db, a } = useApp()
  const [ref, k0] = useFit(WIDE.w)
  const narrow = k0 * WIDE.w < 560
  const L = narrow ? NARROW : WIDE
  const k = narrow ? Math.min(1, (k0 * WIDE.w) / NARROW.w) : k0
  const [dealt, setDealt] = useState(null) // { roomId, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [peel, setPeel] = useState({ roomId: null, p: {} }) // lá mình đã hé bao nhiêu — chỉ máy này

  const seated = mySeat != null
  const reveal = !!result
  useEffect(() => {
    if (given || (!seated && !reveal)) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setDealt({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setDealt({ roomId, failed: true }) })
    return () => { live = false }
  }, [a, roomId, seated, reveal, tries, given])

  // Chơi với máy (BotRoom) truyền sẵn `hands` (như game_hands) — khỏi hỏi server.
  const mine = given ? { hands: given } : dealt?.roomId === roomId ? dealt : null
  const n = state.n
  const memberOf = (seat) => db.members.find((m) => m.id === players?.find((p) => p.seat === seat)?.memberId)
  const nameOf = (seat) => names?.[seat] || memberOf(seat)?.name || t('games.bacay.mark' + seat)
  const who = (seat) => (seat === mySeat ? t('games.bacay.youCap') : nameOf(seat))
  // Bài của ghế: lá đã lật (log), hết ván thì cả tay đã chia (người rời chưa lật).
  const cardsOf = (seat) => state.cards[seat] || (reveal ? (mine?.hands?.[seat] || []).slice().sort((x, y) => x - y) : null)
  const myHand = seated ? (mine?.hands?.[mySeat] || []).slice().sort((x, y) => x - y) : []
  const peeled = peel.roomId === roomId ? peel.p : {}
  const allOpen = myHand.length === 3 && myHand.every((c) => peeled[c] >= 1)
  const canFlip = seated && !state.over && !state.out[mySeat] && !state.cards[mySeat]
  const flipped = state.cards.filter(Boolean).length
  const waitN = state.cards.filter((h, i) => !h && !state.out[i]).length

  // Người đang dẫn: so các tay đã lật, coi người chưa lật / đã rời như đứng ngoài.
  const lead = !state.over && state.cards.some(Boolean)
    ? scoreOf(state.cards, state.cards.map((h, i) => !h || state.out[i]))?.winners[0] ?? null
    : null
  const winner = result?.winners?.[0] ?? null
  const act = state.act

  // Chỗ ngồi: mình ở giữa đáy, người khác theo thứ tự ghế quanh bàn.
  const base = mySeat ?? 0
  const slotOf = (seat) => (RING[n] || RING[8])[(seat - base + n) % n]
  const posOf = (seat) => L.seats[slotOf(seat)] || L.pot

  let banner
  if (state.over) banner = winner != null ? t('games.bacay.winLine', { side: who(winner), nut: nutText(cardsOf(winner) || []) }) : t('games.scoring')
  else if (act?.flip && state.cards[act.seat]) banner = t('games.bacay.lastFlip', { side: who(act.seat), nut: nutText(state.cards[act.seat]) })
  else if (act?.out) banner = t('games.bacay.lastOut', { side: who(act.seat) })
  else banner = t('games.bacay.waitFlip', { n: waitN })

  // ── Hiệu ứng: hết ván — chữ "Nhất" đóng dấu ở người thắng + pháo giấy. ──
  const fx = []
  if (state.over && winner != null) {
    const [x, y] = posOf(winner)
    fx.push(<div key="win" style={{ position: 'absolute', left: x, top: y - (narrow ? 44 : 64), padding: '4px 14px', borderRadius: 99, background: '#c99a2e', color: '#2a1800', font: `800 ${narrow ? 14 : 20}px/1.2 var(--font-display)`, whiteSpace: 'nowrap', boxShadow: '0 8px 18px rgba(0,0,0,.45)', opacity: 0, animation: 'tlStamp 2s ease-out forwards', zIndex: 40 }}>
      {nutText(cardsOf(winner) || [])}
    </div>)
    for (let j = 0; j < 40; j++) {
      const ang = (j / 40) * Math.PI * 2
      const d = (90 + rnd(j * 3) * 200) * (narrow ? 0.6 : 1)
      fx.push(<span key={'w' + j} style={{ position: 'absolute', left: x, top: y, width: 8, height: 14, borderRadius: 2, background: [BC.teal, BC.gold, '#f87171', '#93c5fd'][j % 4], '--dx': Math.cos(ang) * d + 'px', '--dy': Math.sin(ang) * d + 'px', opacity: 0, animation: `chBurst ${(1 + rnd(j) * 0.6).toFixed(2)}s cubic-bezier(.15,.7,.3,1) forwards`, zIndex: 41 }} />)
    }
  }

  const seatBox = (seat) => {
    const cards = cardsOf(seat)
    const won = winner === seat
    const isLead = lead === seat
    const sc = result?.scores?.[seat]
    const m = memberOf(seat)
    const w = L.fw
    const h = Math.round(w * 1.4)
    return (
      <div style={{
        position: 'relative', display: 'grid', justifyItems: 'center', gap: narrow ? 3 : 4, padding: narrow ? '5px 7px' : '7px 10px', borderRadius: 14, background: BC.glass,
        border: '1.5px solid ' + (won ? BC.crown : seat === mySeat ? BC.teal : isLead ? 'rgba(255,207,58,.5)' : BC.line),
        boxShadow: won ? '0 0 0 2px rgba(255,207,58,.5), 0 0 40px -4px ' + BC.crown : 'none', opacity: state.out[seat] ? 0.5 : 1, transition: 'box-shadow .4s, border-color .4s',
      }}>
        {won && (
          <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: narrow ? -16 : -22, transform: 'translateX(-50%)', lineHeight: 0 }}>
            <svg width={narrow ? 24 : 32} height={narrow ? 18 : 24} viewBox="0 0 40 30"><path d="M3 26 L5 8 L13 16 L20 3 L27 16 L35 8 L37 26 Z" fill="#ffd43b" stroke="#8a5a00" strokeWidth="2" strokeLinejoin="round" /><circle cx="20" cy="17" r="3" fill="#e5484d" /></svg>
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <Seat name={m?.name || nameOf(seat)} src={m?.avatarUrl} size={L.seat} active={!state.over && !cards && !state.out[seat]} />
          <div style={{ display: 'grid', minWidth: 0 }}>
            <span style={{ font: `700 ${narrow ? 11 : 12.5}px/1.2 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: narrow ? 62 : 92 }}>{who(seat)}</span>
            {sc != null && <span style={{ font: `400 ${narrow ? 9.5 : 10.5}px/1.3 var(--font-mono)`, color: BC.gold, whiteSpace: 'nowrap' }}>{money(sc)}</span>}
          </div>
        </div>
        <div data-game-fx style={{ position: 'relative', width: w + L.fs * 2, height: h + 4 }}>
          {[0, 1, 2].map((j) => (
            <span key={j + (cards ? 'u' : 'd')} style={{ position: 'absolute', left: j * L.fs, top: 2, width: w, height: h, transform: `rotate(${(j - 1) * 7}deg)`, transformOrigin: '50% 100%' }}>
              <span style={{
                position: 'absolute', inset: 0, borderRadius: 5, boxShadow: '0 3px 6px rgba(0,0,0,.45)', animation: cards ? `gameFlip .5s ease-out ${(j * 0.07).toFixed(2)}s both` : undefined,
                ...(cards ? null : { background: CARD.back, border: '1.5px solid ' + CARD.backLine }),
              }}>
                {cards?.[j] != null && <CardFace c={cards[j]} w={w} h={h} faces={RANK_FACES} />}
              </span>
            </span>
          ))}
        </div>
        {cards?.length === 3 && <span style={{ padding: '1px 8px', borderRadius: 99, background: won ? '#c99a2e' : nutBg(cards), color: '#fff', font: `800 ${narrow ? 10.5 : 12}px/1.5 var(--font-sans)`, whiteSpace: 'nowrap' }}>{nutText(cards)}</span>}
        {state.out[seat] && <span style={{ font: '700 10.5px/1.3 var(--font-sans)', color: BC.sub }}>{t('games.bacay.outTag')}</span>}
        {note?.[seat] && <span style={{ font: '400 10px/1.2 var(--font-mono)', color: BC.gold, whiteSpace: 'nowrap' }}>{note[seat]}</span>}
      </div>
    )
  }
  const money = (sc) => (stake > 0 ? t('games.coins.stakeOpt', { n: (sc > 0 ? '+' : '') + (sc * stake).toLocaleString('vi-VN') }) : t('games.bacay.score', { n: sc > 0 ? '+' + sc : sc }))

  const [ox, oy, ow, oh] = L.oval
  const [px, py] = L.pot
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div ref={ref} style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', justifyItems: 'center' }}>
        <div style={{ width: L.w * k, height: L.h * k, position: 'relative' }}>
          <div style={{ width: L.w, height: L.h, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden', borderRadius: L.radius, background: BC.room, color: BC.ink, userSelect: 'none' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: ox, top: oy, width: ow, height: oh, borderRadius: '50%', background: BC.felt, boxShadow: BC.rim(L.rim) }} />
            <span aria-hidden="true" style={{ position: 'absolute', left: ox + ow * 0.14, top: oy + oh * 0.14, width: ow * 0.72, height: oh * 0.72, borderRadius: '50%', border: '2px dashed rgba(240,183,92,.3)' }} />

            {/* Giữa bàn */}
            <div style={{ position: 'absolute', left: px, top: py, transform: 'translate(-50%, -50%)', display: 'grid', justifyItems: 'center', gap: 4, textAlign: 'center', zIndex: 5 }}>
              <span style={{ font: `700 ${narrow ? 11.5 : 13}px/1.2 var(--font-mono)`, color: BC.goldHi }}>{t('games.bacay.flippedN', { n: flipped, m: n })}</span>
              <span aria-live="polite" style={{ maxWidth: narrow ? 200 : 280, padding: narrow ? '4px 10px' : '5px 14px', borderRadius: 99, background: BC.pill, border: '1px solid rgba(240,183,92,.4)', font: `700 ${narrow ? 11.5 : 13}px/1.3 var(--font-sans)`, color: BC.goldHi, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{banner}</span>
              <span style={{ font: `600 ${narrow ? 9 : 10}px/1.3 var(--font-mono)`, letterSpacing: '.12em', textTransform: 'uppercase', color: BC.mute }}>{t('games.bacay.payRule')}</span>
            </div>

            {Array.from({ length: n }, (_, s) => s).map((s) => {
              const [x, y] = posOf(s)
              return <div key={s} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: s === base ? 20 : 10 }}>{seatBox(s)}</div>
            })}

            <div data-game-fx style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{fx}</div>
          </div>
        </div>
      </div>

      {/* Dưới bàn: nặn 3 lá của mình + Lật */}
      <div style={{ width: '100%', maxWidth: WIDE.w, margin: '0 auto', display: 'grid', gap: 10, justifyItems: 'center', gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {canFlip && (
          mine?.failed
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={S.hint}>{t('games.bacay.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((x) => x + 1)}>{t('games.bacay.reloadHand')}</Button>
              </div>
            )
            : (
              <>
                <span style={S.hint}>{t(allOpen ? 'games.bacay.peekDone' : 'games.bacay.peekHint')}</span>
                <div role="group" aria-label={t('games.bacay.handAria')} style={{ display: 'flex', gap: narrow ? 10 : 16, justifyContent: 'center' }}>
                  {(myHand.length ? myHand : [null, null, null]).map((c, j) => (
                    <SqueezeCard key={c ?? 'x' + j} c={c} w={L.mw} peel={c == null ? 0 : peeled[c] || 0} label={t('games.bacay.peekCard')}
                      onPeel={(p) => c != null && setPeel({ roomId, p: { ...peeled, [c]: Math.min(1, p) } })} />
                  ))}
                </div>
                {allOpen && <span style={{ font: '700 14px/1.3 var(--font-sans)', color: G.goldHi }}>{t('games.bacay.myNut', { nut: nutText(myHand), top: faceOf(topOf(myHand)) })}</span>}
                <button type="button" disabled={myHand.length !== 3} onClick={() => onMove({ flip: true })}
                  style={{ ...btn('primary'), minHeight: 48, padding: '12px 26px', font: '800 15px/1 var(--font-sans)', width: '100%', maxWidth: 420, opacity: myHand.length === 3 ? 1 : 0.45 }}>
                  {t('games.bacay.flipAll')}
                </button>
              </>
            )
        )}
        {seated && !state.over && state.cards[mySeat] && <span style={{ ...S.hint, padding: '8px 0' }}>{t('games.bacay.waitOthers', { n: waitN })}</span>}
        {state.over && result?.scores && <span style={S.hint}>{t('games.bacay.scoreNote')}</span>}
        {((state.over && overActions?.length > 0) || actions?.length > 0) && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {state.over && (overActions || []).map((x) => <button key={x.key} type="button" onClick={x.on} style={{ ...btn('primary'), padding: '11px 22px' }}>{x.label}</button>)}
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
}
