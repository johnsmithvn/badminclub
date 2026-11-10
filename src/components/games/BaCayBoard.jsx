import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { RANK_FACES, SUIT_MARKS, faceOf, rankOf, suitOf } from '#lib/games/phom.js'
import { nutOf, scoreOf } from '#lib/games/bacay.js'

/**
 * Bàn Ba cây: mỗi người một ô 3 lá (úp khi chưa lật, ngửa khi đã lật), ai đang dẫn được đánh dấu; dưới cùng là bài của
 * mình — chạm từng lá để nặn (chỉ máy mình thấy), rồi bấm Lật cho cả bàn xem.
 * Bài trên tay không có trong state trước khi lật (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay
 * mình, hết ván trả mọi tay). Lá đã lật nằm trong log. Luật: lib/games/bacay.js · server: 0092.
 */
const RED = 'var(--status-incident-fg)'

function Card({ c, size = 40, down, pop, onPick, label }) {
  const h = Math.round(size * 1.42)
  const base = {
    width: size, height: h, padding: 0, flexShrink: 0, borderRadius: size >= 40 ? 7 : 5,
    boxShadow: 'var(--shadow-xs)', touchAction: 'manipulation', cursor: onPick ? 'pointer' : 'default',
    animation: pop ? 'gameFlip var(--dur-slow) var(--ease-standard) both' : 'none',
  }
  if (down || c == null) {
    return (
      <button type="button" onClick={onPick} disabled={!onPick} aria-label={label || t('games.bacay.cardDown')}
        style={{ ...base, border: '2px solid var(--surface-card)', background: 'repeating-linear-gradient(45deg, var(--navy-700), var(--navy-700) 4px, var(--navy-600, var(--navy-700)) 4px, var(--navy-600, var(--navy-700)) 8px)' }} />
    )
  }
  return (
    <button type="button" onClick={onPick} disabled={!onPick} aria-label={faceOf(c)}
      style={{
        ...base, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1,
        background: 'var(--surface-card)', border: '1.5px solid var(--border-default)', color: suitOf(c) >= 2 ? RED : 'var(--text-primary)',
        font: (size >= 40 ? '600 15px' : '600 12px') + '/1 var(--font-mono)',
      }}>
      <span>{RANK_FACES[rankOf(c)]}</span>
      <span style={{ fontSize: size >= 40 ? 16 : 12 }}>{SUIT_MARKS[suitOf(c)]}</span>
    </button>
  )
}

const nutText = (cards) => (nutOf(cards) === 0 ? t('games.bacay.bu') : t('games.bacay.nut', { n: nutOf(cards) }))

export default function BaCayBoard({ state, mySeat, onMove, roomId, result, players }) {
  const { db, a } = useApp()
  const isMobile = useMobile(768)
  const [dealt, setDealt] = useState(null) // { roomId, hands } | { roomId, failed }
  const [tries, setTries] = useState(0)
  const [peek, setPeek] = useState({ roomId: null, seen: [] }) // lá mình đã nặn — chỉ máy này

  const seated = mySeat != null
  const reveal = !!result
  useEffect(() => {
    if (!seated && !reveal) return undefined
    let live = true
    a.gameHand(roomId)
      .then((hands) => { if (live) setDealt({ roomId, hands }) })
      .catch((e) => { console.warn('[games] Không nạp được bài:', e?.message || e); if (live) setDealt({ roomId, failed: true }) })
    return () => { live = false }
  }, [a, roomId, seated, reveal, tries])

  const mine = dealt?.roomId === roomId ? dealt : null
  const n = state.n
  const nameOf = (seat) => {
    const id = players?.find((p) => p.seat === seat)?.memberId
    return db.members.find((m) => m.id === id)?.name || t('games.bacay.mark' + seat)
  }
  // Bài của ghế: lá đã lật (log), hết ván thì cả tay đã chia (người rời chưa lật).
  const cardsOf = (seat) => state.cards[seat] || (reveal ? (mine?.hands?.[seat] || []).slice().sort((x, y) => x - y) : null)
  const myHand = seated ? (mine?.hands?.[mySeat] || []).slice().sort((x, y) => x - y) : []
  const seen = peek.roomId === roomId ? peek.seen : []
  const canFlip = seated && !state.over && !state.out[mySeat] && !state.cards[mySeat]
  const waitN = state.cards.filter((h, i) => !h && !state.out[i]).length

  // Người đang dẫn: so các tay đã lật, coi người chưa lật / đã rời như đứng ngoài.
  const lead = !state.over && state.cards.some(Boolean)
    ? scoreOf(state.cards, state.cards.map((h, i) => !h || state.out[i]))?.winners[0] ?? null
    : null
  const winner = result?.winners?.[0] ?? null
  const act = state.act

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={S.table} aria-live="polite">
        <span style={S.label}>
          {state.over
            ? (winner != null ? t('games.bacay.winLine', { side: nameOf(winner), nut: nutText(cardsOf(winner) || []) }) : t('games.scoring'))
            : t('games.bacay.waitFlip', { n: waitN })}
        </span>
        {!state.over && act?.flip && state.cards[act.seat] && (
          <span style={S.caption}>{t('games.bacay.lastFlip', { side: nameOf(act.seat), nut: nutText(state.cards[act.seat]) })}</span>
        )}
        {!state.over && act?.out && <span style={S.caption}>{t('games.bacay.lastOut', { side: nameOf(act.seat) })}</span>}
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(${isMobile ? Math.min(n, 2) : Math.min(n, 4)}, minmax(0, 1fr))` }}>
        {Array.from({ length: n }, (_, seat) => seat).map((seat) => {
          const cards = cardsOf(seat)
          const won = winner === seat
          const sc = result?.scores?.[seat]
          const tag = state.out[seat] ? t('games.bacay.outTag') : won ? t('games.bacay.winTag') : lead === seat ? t('games.bacay.leadTag') : null
          return (
            <div key={seat} style={{
              ...S.seat,
              borderColor: won || lead === seat ? 'var(--status-delivered)' : 'var(--border-subtle)',
              background: won ? 'var(--status-delivered-bg)' : 'var(--surface-card)',
              opacity: state.out[seat] ? 0.6 : 1,
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
                <span style={{ ...S.name, flex: 1 }} title={nameOf(seat)}>{nameOf(seat)}{seat === mySeat ? ' · ' + t('games.bacay.you') : ''}</span>
                {tag && <span style={{ ...S.pill, color: won || lead === seat ? 'var(--status-delivered-fg)' : 'var(--text-muted)' }}>{tag}</span>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map((k) => <Card key={k + (cards ? 'u' : 'd')} c={cards?.[k]} size={isMobile ? 30 : 34} down={!cards} pop={!!state.cards[seat]} />)}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', justifyContent: 'space-between', minWidth: 0 }}>
                <span style={S.mono}>{cards?.length === 3 ? nutText(cards) : t('games.bacay.notFlipped')}</span>
                {sc != null && (
                  <span style={{ ...S.mono, fontWeight: 600, color: sc > 0 ? 'var(--status-delivered-fg)' : sc < 0 ? RED : 'var(--text-muted)' }}>
                    {t('games.bacay.score', { n: sc > 0 ? '+' + sc : sc })}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {canFlip && (
        <div style={S.mineBox}>
          {mine?.failed
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={S.caption}>{t('games.bacay.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.bacay.reloadHand')}</Button>
              </div>
            )
            : (
              <>
                <span style={S.caption}>{t('games.bacay.peekHint')}</span>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {myHand.map((c) => {
                    const open = seen.includes(c)
                    return (
                      <Card key={c + (open ? 'u' : 'd')} c={c} size={isMobile ? 52 : 60} down={!open} pop={open}
                        label={t('games.bacay.peekCard')}
                        onPick={open ? undefined : () => setPeek({ roomId, seen: [...seen, c] })} />
                    )
                  })}
                </div>
                {seen.length === 3 && myHand.length === 3 && <span style={S.label}>{nutText(myHand)}</span>}
                <Button icon="eye" disabled={myHand.length !== 3} onClick={() => onMove({ flip: true })}>{t('games.bacay.flip')}</Button>
              </>
            )}
        </div>
      )}

      {state.over && result?.scores && <span style={{ ...S.mono, textAlign: 'center' }}>{t('games.bacay.scoreNote')}</span>}
    </div>
  )
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 8, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' },
  name: { font: 'var(--type-label)', color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  pill: { flexShrink: 0, font: '600 10.5px/1 var(--font-sans)' },
  table: {
    borderRadius: 12, padding: 12, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 4, placeItems: 'center', textAlign: 'center', gridTemplateColumns: 'minmax(0, 1fr)',
  },
  mineBox: {
    display: 'grid', gap: 10, justifyItems: 'center', padding: 14, borderRadius: 12, gridTemplateColumns: 'minmax(0, 1fr)',
    background: 'var(--surface-card)', border: '1px solid var(--border-focus-color)', boxShadow: 'var(--shadow-sm)',
  },
}
