import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { t } from '#i18n'
import { BauCuaIcon } from '#components/games/BauCuaIcons.jsx'
import bc, { CAP, CHIPS, deadlineOf, SYMS, waitingOf } from '#lib/games/baucua.js'

/**
 * Bàn Bầu cua: ghế (điểm, ai làm cái, ai đã chốt), đồng hồ đặt, bát xúc xắc ván trước, chiếu sáu con.
 * Người đặt: chọn mức, chạm con muốn đặt, Chốt (đặt = chốt, không sửa được). Cả bàn chốt hoặc hết giờ thì máy bất kỳ
 * gửi { roll } — server lắc và chỉ nhận khi đúng là đã đủ / đã hết giờ (0096). Luật: lib/games/baucua.js.
 */
const side = (seat) => t('games.baucua.mark' + seat)
const sym = (k) => t('games.baucua.sym.' + SYMS[k])
const signed = (n) => (n > 0 ? '+' + n : String(n))
const zero = () => SYMS.map(() => 0)

/** Đồng hồ máy, nhích mỗi giây khi có hạn đặt. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

export default function BauCuaBoard({ state, mySeat, onMove, result }) {
  const [chip, setChip] = useState(CHIPS[0])
  // Bản nháp theo ván: sang ván mới là tự bỏ nháp cũ.
  const [draft, setDraft] = useState({ round: -1, bet: zero() })
  const bet = draft.round === state.round ? draft.bet : zero()
  const total = bet.reduce((a, b) => a + b, 0)

  const { started, over, banker, last } = state
  const seated = mySeat != null && started && !state.out[mySeat]
  const live = started && !over && !result
  const canBet = live && seated && mySeat !== banker && !state.ready[mySeat]
  const add = (k) => { if (canBet && total + chip <= CAP) setDraft({ round: state.round, bet: bet.map((v, i) => (i === k ? v + chip : v)) }) }

  // Mở bát: cả bàn chốt thì gửi ngay, không thì chờ hết giờ. Cái gửi trước, người khác chờ thêm (phòng máy cái đã tắt).
  // Server đo bằng giờ của nó; sớm thì im lặng, mỗi 4 giây thử lại.
  const due = deadlineOf(state)
  const now = useNow(live)
  const [again, setAgain] = useState(0)
  const all = live && !waitingOf(state).length
  useEffect(() => {
    if (!live || !seated || due == null) return undefined
    const n = state.n0
    const rank = (mySeat - banker + n) % n
    const wait = (all ? 0 : Math.max(0, due - Date.now())) + (rank === 0 ? 300 : 1500 + rank * 700)
    const fire = setTimeout(() => onMove({ roll: true }), wait)
    const retry = setTimeout(() => setAgain((k) => k + 1), wait + 4000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [live, seated, due, all, mySeat, banker, state.n0, state.ply, again, onMove])
  const secs = live && due != null ? Math.max(0, Math.ceil((due - now) / 1000)) : null

  if (!started) return <div style={S.panel}><span style={S.caption}>{t('games.baucua.waiting')}</span></div>

  const scores = result?.scores || bc.result(state)?.scores || Object.fromEntries(state.scores.map((v, i) => [i, v]))
  const stake = (k) => state.bets.reduce((sum, b, i) => sum + (i === mySeat ? 0 : b[k]), 0)
  const mineOf = (k) => (state.ready[mySeat] ? state.bets[mySeat]?.[k] || 0 : bet[k])
  const statusOf = (seat) => {
    if (state.out[seat]) return t('games.baucua.stOut')
    if (over) return null
    if (seat === banker) return t('games.baucua.stBanker')
    return t(state.ready[seat] ? 'games.baucua.stLocked' : 'games.baucua.stBetting')
  }

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={S.label}>
          {over ? t('games.baucua.final') : t('games.baucua.round', { r: state.round + 1, n: state.rounds }) + ' · ' + t('games.baucua.banker', { side: side(banker) })}
        </span>
        {secs != null && (
          <span role="timer" style={{ ...S.mono, color: secs <= 5 ? 'var(--status-incident-fg)' : S.mono.color }}>
            {all ? t('games.baucua.rolling') : t('games.baucua.timeLeft', { n: secs })}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
        {state.scores.map((_, seat) => {
          const sc = scores?.[seat] ?? 0
          const on = !over && seat === banker
          return (
            <div key={seat} style={{
              ...S.seat, opacity: state.out[seat] ? 0.55 : 1,
              borderColor: on ? 'var(--border-focus-color)' : 'var(--border-subtle)',
              background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
            }}>
              <span style={S.seatName}>{side(seat)}{seat === mySeat ? ' · ' + t('games.baucua.you') : ''}</span>
              <span style={{ ...S.mono, color: sc > 0 ? 'var(--status-delivered-fg)' : sc < 0 ? 'var(--status-incident-fg)' : S.mono.color }}>
                {t('games.baucua.points', { n: signed(sc) })}{statusOf(seat) ? ' · ' + statusOf(seat) : ''}
              </span>
            </div>
          )
        })}
      </div>

      {last?.dice && (
        <div style={S.panel} aria-live="polite">
          <span style={S.caption}>{t('games.baucua.diceTitle', { side: side(last.banker) })}</span>
          <div key={state.ply} style={{ display: 'flex', gap: 10, justifyContent: 'center', animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }}>
            {last.dice.map((d, k) => (
              <div key={k} title={sym(d)} style={S.die}><BauCuaIcon sym={d} size={40} /></div>
            ))}
          </div>
          <span style={S.mono}>{last.dice.map(sym).join(' · ')}</span>
          {mySeat != null && last.won && (
            <span style={S.label}>
              {mySeat === last.banker
                ? t('games.baucua.bankerWon', { n: signed(-last.won.reduce((a, b) => a + b, 0)) })
                : t('games.baucua.youWon', { n: signed(last.won[mySeat] || 0) })}
            </span>
          )}
        </div>
      )}

      {!over && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {SYMS.map((_, k) => {
            const mine = mineOf(k)
            return (
              <button key={k} type="button" onClick={() => add(k)} disabled={!canBet}
                aria-label={sym(k) + (mine ? ' · ' + t('games.baucua.mine', { n: mine }) : '')}
                style={{ ...S.tile, cursor: canBet ? 'pointer' : 'default', borderColor: mine ? 'var(--border-focus-color)' : 'var(--border-subtle)' }}>
                <BauCuaIcon sym={k} size={52} />
                <span style={S.label}>{sym(k)}</span>
                <span style={S.mono}>
                  {mine ? t('games.baucua.mine', { n: mine }) : ' '}
                  {stake(k) ? ' · ' + t('games.baucua.table', { n: stake(k) }) : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {live && seated && (
        mySeat === banker
          ? <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.baucua.youBanker')}</span>
          : state.ready[mySeat]
            ? <span style={{ ...S.caption, textAlign: 'center' }}>{t('games.baucua.locked')}</span>
            : (
              <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                <span style={S.caption}>{t('games.baucua.pickHint', { n: CAP - total })}</span>
                <div role="group" aria-label={t('games.baucua.chip')} style={{ display: 'flex', gap: 6 }}>
                  {CHIPS.map((c) => (
                    <Button key={c} size="sm" variant={chip === c ? 'primary' : 'secondary'} onClick={() => setChip(c)}>{'+' + c}</Button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button icon="check" onClick={() => onMove({ bet })}>
                    {total ? t('games.baucua.lock', { n: total }) : t('games.baucua.lockZero')}
                  </Button>
                  {total > 0 && <Button variant="ghost" onClick={() => setDraft({ round: state.round, bet: zero() })}>{t('games.baucua.clear')}</Button>}
                </div>
              </div>
            )
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
  panel: {
    borderRadius: 12, padding: 14, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 8, placeItems: 'center', textAlign: 'center',
  },
  die: { width: 52, height: 52, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--gray-0)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-sm)' },
  tile: {
    border: '1.5px solid', borderRadius: 12, padding: '10px 6px', background: 'var(--surface-card)', display: 'grid', gap: 4,
    justifyItems: 'center', minWidth: 0, touchAction: 'manipulation', color: 'inherit',
  },
}
