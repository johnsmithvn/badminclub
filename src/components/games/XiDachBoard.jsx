import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import Card from '#components/games/PlayingCard.jsx'
import xd, { deadlineOf, kindOf, MAX_CARDS, pointsOf, standMin } from '#lib/games/xidach.js'

/**
 * Bàn Xì dách: ghế (điểm, cái, ai đang rút / đã dằn / có xì, số lá úp), bài trên tay mình + điểm, Rút / Dằn.
 * Lật bài thì hiện bài cả bàn, loại bài và được / mất từng con. Hết ván máy bất kỳ xin chia ván mới sau vài giây.
 * Bài trên tay nạp riêng từ game_hands (RLS chỉ trả tay mình); server kiểm dằn đủ tuổi (0098). Luật: lib/games/xidach.js.
 */
const side = (seat) => t('games.xidach.mark' + seat)
const signed = (n) => (n > 0 ? '+' + n : String(n))
const NEXT_MS = 5000

function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

export default function XiDachBoard({ state, mySeat, onMove, roomId, result, hands: given }) {
  const { a } = useApp()
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
    const retry = setTimeout(() => setAgain((k) => k + 1), wait + 4000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [live, seated, phase, due, turn, banker, mySeat, state.n0, state.ply, again, onMove])
  const secs = live && due != null ? Math.max(0, Math.ceil((due - now) / 1000)) : null

  if (!started) return <div style={S.panel}><span style={S.caption}>{t('games.xidach.waiting')}</span></div>

  const scores = result?.scores || xd.result(state)?.scores || Object.fromEntries(state.scores.map((v, i) => [i, v]))
  const myTurn = live && seated && phase === 'play' && turn === mySeat
  const pts = mine ? pointsOf(mine) : null
  const canStand = myTurn && pts != null && pts >= standMin(state, mySeat)
  const statusOf = (seat) => {
    if (state.out[seat]) return t('games.xidach.stOut')
    if (phase !== 'play') return null
    if (xi?.[seat]) return t('games.xidach.stXi')
    if (seat === turn) return t('games.xidach.stTurn')
    if (state.stood[seat]) return t('games.xidach.stStood')
    return null
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={S.label}>
          {over ? t('games.xidach.final') : t('games.xidach.round', { r: state.round + 1, n: state.rounds }) + ' · ' + t('games.xidach.banker', { side: side(banker) })}
        </span>
        {secs != null && (
          <span role="timer" style={{ ...S.mono, color: secs <= 5 ? 'var(--status-incident-fg)' : S.mono.color }}>
            {t('games.xidach.timeLeft', { side: side(turn), n: secs })}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {state.scores.map((_, seat) => {
          const sc = scores?.[seat] ?? 0
          const open = show?.[seat] || xi?.[seat]
          const on = phase === 'play' && seat === turn
          const st = statusOf(seat)
          return (
            <div key={seat} style={{
              ...S.seat, opacity: state.out[seat] ? 0.55 : 1,
              borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)',
              background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
            }}>
              <span style={S.seatName}>
                {side(seat)}{seat === banker && !over ? ' · ' + t('games.xidach.stBanker') : ''}{seat === mySeat ? ' · ' + t('games.xidach.you') : ''}
              </span>
              <span style={{ ...S.mono, color: sc > 0 ? 'var(--status-delivered-fg)' : sc < 0 ? 'var(--status-incident-fg)' : S.mono.color }}>
                {t('games.xidach.points', { n: signed(sc) })}{st ? ' · ' + st : ''}
              </span>
              {state.counts[seat] > 0 && (
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {open
                    ? open.map((c) => <Card key={c} c={c} w={30} />)
                    : Array.from({ length: state.counts[seat] }, (_, k) => <Card key={k} back w={30} />)}
                </div>
              )}
              {open && (
                <span style={S.mono}>
                  {t('games.xidach.kind.' + kindOf(open), { n: pointsOf(open) })}
                  {won?.[seat] != null ? ' · ' + (won[seat] ? signed(won[seat]) : t('games.xidach.tie')) : ''}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {phase === 'done' && !over && (
        <div style={S.panel} aria-live="polite">
          <span style={S.label}>{last?.xiBanker ? t('games.xidach.bankerXi', { side: side(banker) }) : show ? t('games.xidach.shown') : t('games.xidach.voided')}</span>
          {live && seated && <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => onMove({ deal: true })}>{t('games.xidach.next')}</Button>}
        </div>
      )}

      {live && seated && phase === 'play' && (
        <div style={{ display: 'grid', gap: 10, justifyItems: 'center' }}>
          {dealt?.key === key && dealt.failed && !mine
            ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={S.caption}>{t('games.tienlen.handFailed')}</span>
                <Button size="sm" variant="secondary" icon="refresh-cw" onClick={() => setTries((k) => k + 1)}>{t('games.tienlen.reloadHand')}</Button>
              </div>
            )
            : mine && (
              <>
                <div role="group" aria-label={t('games.xidach.handAria')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 4 }}>
                  {mine.map((c) => <Card key={c} c={c} />)}
                </div>
                <span style={S.label}>{t('games.xidach.kind.' + kindOf(mine), { n: pts })}</span>
              </>
            )}
          {myTurn
            ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button icon="plus" disabled={state.counts[mySeat] >= MAX_CARDS} onClick={() => onMove({ draw: true })}>{t('games.xidach.draw')}</Button>
                <Button variant="secondary" icon="check" disabled={!canStand} onClick={() => onMove({ stand: true })}>{t('games.xidach.stand')}</Button>
              </div>
            )
            : <span style={S.caption}>{xi?.[mySeat] ? t('games.xidach.youXi') : turn != null ? t('games.xidach.waitTurn', { side: side(turn) }) : ''}</span>}
          {myTurn && !canStand && <span style={S.caption}>{t('games.xidach.needAge', { n: standMin(state, mySeat) })}</span>}
          {last?.timeout && <span style={S.mono}>{t('games.xidach.autoMove', { side: side(last.seat) })}</span>}
        </div>
      )}
    </div>
  )
}

const S = {
  seat: { border: '1px solid', borderRadius: 10, padding: '8px 10px', display: 'grid', gap: 4, minWidth: 0 },
  seatName: { font: 'var(--type-label)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  panel: {
    borderRadius: 12, padding: 14, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 8, placeItems: 'center', textAlign: 'center',
  },
}
