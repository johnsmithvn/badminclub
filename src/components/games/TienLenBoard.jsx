import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import tl, { comboOf, faceOf, RANK_FACES, rankOf, SUIT_MARKS, suitOf } from '#lib/games/tienlen.js'

/**
 * Bàn Tiến lên: số lá / hạng từng ghế, bộ đang trên bàn, bài trên tay mình (chạm để chọn, Đánh / Bỏ lượt),
 * hết ván thì bảng hạng + điểm + lật bài còn lại của mọi người.
 * Bài trên tay KHÔNG có trong state (docs/GAMES.md §5.2): nạp riêng từ game_hands (RLS: đang chơi chỉ trả tay mình,
 * hết ván trả mọi tay), bài còn lại = bài chia − các lá đã ra bàn (`state.gone`).
 * Luật nằm ở lib/games/tienlen.js; server kiểm lại từng nước (0078) nên ở đây chỉ cần chặn bấm nhầm.
 *
 * Props chung của mọi màn chơi (components/games/screens.js) + `roomId` để nạp bài, `result` = kết quả server đã chốt
 * (có thối) — null khi chưa chốt.
 */
const RED = 'var(--status-incident-fg)'
const side = (seat) => t('games.tienlen.mark' + seat)
const placeOf = (pos, n) => t(pos === n - 1 ? 'games.tienlen.placeLast' : 'games.tienlen.place' + pos)

function Card({ c, on, small, onPick }) {
  const w = small ? 30 : 42
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-pressed={onPick ? !!on : undefined}
      aria-label={faceOf(c)}
      style={{
        width: w, height: Math.round(w * 1.42), padding: 0, flexShrink: 0, borderRadius: small ? 5 : 7,
        display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1,
        background: 'var(--surface-card)', color: suitOf(c) >= 2 ? RED : 'var(--text-primary)',
        border: '1.5px solid ' + (on ? 'var(--border-focus-color)' : 'var(--border-default)'),
        boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: on ? 'translateY(-10px)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard)',
        font: (small ? '600 12px' : '600 15px') + '/1 var(--font-mono)', cursor: onPick ? 'pointer' : 'default',
        opacity: 1, touchAction: 'manipulation',
      }}
    >
      <span>{RANK_FACES[rankOf(c)]}</span>
      <span style={{ fontSize: small ? 12 : 16 }}>{SUIT_MARKS[suitOf(c)]}</span>
    </button>
  )
}

export default function TienLenBoard({ state, mySeat, onMove, roomId, result }) {
  const { a } = useApp()
  const isMobile = useMobile(768)
  const [dealt, setDealt] = useState(null) // { roomId, hands: { [seat]: cards } } | { roomId, failed }
  const [tries, setTries] = useState(0)
  // Chọn lá theo nước: bàn sang nước khác (ai đó vừa đi) là bỏ chọn, khỏi xoá state trong effect.
  const [pick, setPick] = useState({ ply: -1, cards: [] })
  const sel = pick.ply === state.ply ? pick.cards : []

  const seated = mySeat != null
  // Server chốt kết quả = phòng đã xong → RLS mở mọi tay: nạp lại để lật bài.
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
  const left = (seat) => (mine?.hands?.[seat] || []).filter((c) => !state.gone.includes(c)).sort((x, y) => x - y)
  const hand = seated ? left(mySeat) : []
  const toggle = (c) => setPick({ ply: state.ply, cards: sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c] })

  const { table, last, over } = state
  const n = state.counts.length
  const myTurn = seated && !over && state.turn === mySeat
  // Ngoài lượt vẫn được chặt ngang bằng 4 đôi thông — nên ai còn trong ván cũng chọn bài được.
  const canPick = seated && !over && !state.out[mySeat]
  const move = sel.length ? { play: sel } : null
  const err = move ? tl.validate(state, mySeat, move) : null
  const kind = move && comboOf(sel)?.kind
  const play = () => { if (move && !err) { setPick({ ply: -1, cards: [] }); onMove(move) } }

  const tagOf = (seat) => {
    const pos = state.order.indexOf(seat)
    if (state.cong.includes(seat)) return t('games.tienlen.cong')
    if (state.left.includes(seat)) return over ? placeOf(pos, n) + ' · ' + t('games.tienlen.out') : t('games.tienlen.out')
    if (pos >= 0) return placeOf(pos, n)
    return state.passed[seat] ? t('games.tienlen.passed') : null
  }
  const scores = (result || tl.result(state))?.scores

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(${Math.min(n, isMobile ? 2 : 4)}, minmax(0, 1fr))` }}>
        {state.counts.map((k, seat) => {
          const on = state.turn === seat
          const tag = tagOf(seat)
          return (
            <div key={seat} style={{
              ...S.seat,
              borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)',
              background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
              opacity: state.out[seat] && !over ? 0.6 : 1,
            }}>
              <span style={S.seatName}>{side(seat)}{seat === mySeat ? ' · ' + t('games.tienlen.you') : ''}</span>
              <span style={S.mono}>{t('games.tienlen.cardsLeft', { n: k })}{tag ? ' · ' + tag : ''}</span>
            </div>
          )
        })}
      </div>

      {!over && (
        <div style={S.table} aria-live="polite">
          {table
            ? (
              <>
                <div key={table.cards.join()} style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }}>
                  {table.cards.map((c) => <Card key={c} c={c} small={isMobile} />)}
                </div>
                <span style={S.caption}>
                  {last?.chop ? t('games.tienlen.lastChop', { side: side(table.seat) }) + ' ' : ''}
                  {t('games.tienlen.tableBy', { side: side(table.seat), kind: t('games.tienlen.kind.' + table.kind) })}
                </span>
              </>
            )
            : (
              <span style={S.caption}>
                {state.low != null
                  ? t('games.tienlen.firstLead', { side: side(state.turn), card: faceOf(state.low) })
                  : state.turn != null ? t('games.tienlen.newRound', { side: side(state.turn) }) : ''}
              </span>
            )}
          {state.pot && <span style={{ ...S.mono, color: RED }}>{t('games.tienlen.pot', { n: state.pot.amount })}</span>}
          {last?.pass && <span style={S.mono}>{t('games.tienlen.lastPass', { side: side(last.seat) })}</span>}
          {last?.out && <span style={S.mono}>{t('games.tienlen.lastOut', { side: side(last.seat) })}</span>}
        </div>
      )}

      {over && (
        <div style={{ ...S.table, placeItems: 'stretch', textAlign: 'left' }} aria-live="polite">
          <span style={S.seatName}>{t('games.tienlen.finalTitle')}</span>
          {last?.white && <span style={S.caption}>{t('games.tienlen.lastWhite', { side: side(last.seat) })}</span>}
          {state.order.map((seat, pos) => {
            const rest = left(seat)
            const sc = scores?.[seat] ?? 0
            return (
              <div key={seat} style={{ display: 'grid', gap: 6, paddingTop: 8, borderTop: pos ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={S.label}>{placeOf(pos, n)} · {side(seat)}{seat === mySeat ? ' · ' + t('games.tienlen.you') : ''}</span>
                  <span style={{ ...S.label, color: sc > 0 ? 'var(--status-delivered-fg)' : sc < 0 ? RED : 'var(--text-muted)' }}>
                    {t('games.tienlen.points', { n: sc > 0 ? '+' + sc : sc })}
                  </span>
                </div>
                {state.counts[seat] > 0 && (
                  rest.length
                    ? <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{rest.map((c) => <Card key={c} c={c} small />)}</div>
                    : <span style={S.mono}>{t('games.tienlen.cardsLeft', { n: state.counts[seat] })}</span>
                )}
              </div>
            )
          })}
          <span style={S.mono}>{t(result ? 'games.tienlen.scoreNote' : 'games.tienlen.scorePending')}</span>
        </div>
      )}

      {seated && !over && (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
          {mine?.failed
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={S.caption}>{t('games.tienlen.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.tienlen.reloadHand')}</Button>
              </div>
            )
            : (
              <div role="group" aria-label={t('games.tienlen.handAria', { n: hand.length })}
                style={{ display: 'flex', gap: isMobile ? 4 : 6, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 12, width: isMobile ? undefined : 'max-content', maxWidth: '100%', margin: '0 auto' }}>
                {hand.map((c) => <Card key={c} c={c} small={isMobile} on={sel.includes(c)} onPick={canPick ? () => toggle(c) : undefined} />)}
              </div>
            )}

          {canPick && (
            <>
              <span style={{ ...S.caption, color: err && (myTurn || sel.length >= 8) ? 'var(--status-delayed-fg)' : 'var(--text-muted)', textAlign: 'center' }}>
                {!myTurn && (!sel.length || err)
                  ? t('games.tienlen.offTurnHint')
                  : !sel.length
                    ? t(table ? 'games.tienlen.pickHintBeat' : 'games.tienlen.pickHint')
                    : err ? t(err) : t('games.tienlen.playHint', { n: sel.length, kind: t('games.tienlen.kind.' + kind) })}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button icon="play" disabled={!move || !!err} onClick={play}>{t('games.tienlen.play')}</Button>
                {myTurn && table && <Button variant="secondary" onClick={() => onMove({ pass: true })}>{t('games.tienlen.pass')}</Button>}
                {sel.length > 0 && <Button variant="ghost" onClick={() => setPick({ ply: -1, cards: [] })}>{t('games.tienlen.clear')}</Button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 2, minWidth: 0 },
  seatName: { font: 'var(--type-label)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  table: {
    minHeight: 120, borderRadius: 12, padding: 14, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 8, placeItems: 'center', alignContent: 'center', textAlign: 'center',
  },
}
