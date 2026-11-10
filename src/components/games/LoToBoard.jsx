import { useEffect, useState } from 'react'
import { Button } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { colOf, deadlineOf, marksOf, MAX, rowsOf } from '#lib/games/loto.js'

/**
 * Bàn Lô tô: số vừa xướng, tờ dò của mình (tự đánh dấu số đã xướng, hàng đủ / hàng chờ tô màu), nút Kinh, ai đang chờ,
 * bảng 90 số. Tới nhịp thì máy bất kỳ gửi { call } — server bốc số và chỉ nhận khi đúng là đã tới nhịp (0088).
 * Luật: lib/games/loto.js.
 */
const side = (seat) => t('games.loto.mark' + seat)

function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

export default function LoToBoard({ state, mySeat, onMove, result }) {
  const isMobile = useMobile(768)
  const { started, over, called, last } = state
  const live = started && !over && !result
  const seated = mySeat != null && started && !state.out[mySeat]

  // Xướng số: ghế đầu còn chơi gửi trước, ghế sau chờ thêm (phòng máy kia đã tắt); sớm thì server từ chối, thử lại.
  const due = deadlineOf(state)
  const now = useNow(live)
  const [again, setAgain] = useState(0)
  useEffect(() => {
    if (!live || !seated || due == null || called.length >= MAX) return undefined
    const rank = state.out.slice(0, mySeat).filter((o) => !o).length
    const wait = Math.max(0, due - Date.now()) + (rank === 0 ? 200 : 1500 + rank * 700)
    const fire = setTimeout(() => onMove({ call: true }), wait)
    const retry = setTimeout(() => setAgain((k) => k + 1), wait + 4000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [live, seated, due, called.length, mySeat, state.out, state.ply, again, onMove])

  if (!started) return <div style={S.panel}><span style={S.caption}>{t('games.loto.waiting')}</span></div>

  const got = new Set(called)
  const mine = mySeat != null ? state.tickets[mySeat] || null : null
  const marks = mine ? marksOf(mine, called) : null
  const secs = live && due != null ? Math.max(0, Math.ceil((due - now) / 1000)) : null
  const winner = state.winner

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ ...S.panel, gridTemplateColumns: 'auto minmax(0, 1fr)', justifyItems: 'start', textAlign: 'left' }} aria-live="polite">
        <div key={called.length} style={{ ...S.ball, animation: 'gamePop var(--dur-slow) var(--ease-standard) both' }}>
          {called.length ? called[called.length - 1] : '–'}
        </div>
        <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
          <span style={S.label}>
            {over ? t('games.loto.won', { side: side(winner) }) : called.length ? t('games.loto.called', { k: called.length }) : t('games.loto.first')}
          </span>
          {secs != null && <span role="timer" style={S.mono}>{t('games.loto.next', { n: secs })}</span>}
          {last?.call && called.length > 1 && <span style={S.mono}>{t('games.loto.prev', { list: called.slice(-6, -1).reverse().join(' · ') })}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {state.tickets.map((tk, seat) => {
          const m = marksOf(tk, called)
          return (
            <span key={seat} style={{ ...S.chip, opacity: state.out[seat] ? 0.5 : 1, borderColor: seat === winner ? 'var(--status-delivered-fg)' : m.waiting ? 'var(--status-delayed-fg)' : 'var(--border-subtle)' }}>
              {side(seat)}{seat === mySeat ? ' · ' + t('games.loto.you') : ''}
              {state.out[seat] ? ' · ' + t('games.loto.out') : m.waiting ? ' · ' + t('games.loto.waitingRows', { n: m.waiting }) : ''}
            </span>
          )
        })}
      </div>

      {mine && (
        <div role="table" aria-label={t('games.loto.ticketAria')} style={S.ticket}>
          {rowsOf(mine).map((row, r) => {
            const miss = marks.miss[r]
            const tone = miss === 0 ? 'var(--status-delivered-bg)' : miss === 1 ? 'var(--status-delayed-bg)' : 'transparent'
            const cells = Array(9).fill(null)
            row.forEach((x) => { cells[colOf(x)] = x })
            return (
              <div key={r} role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: 2, background: tone, borderRadius: 6, padding: 2 }}>
                {cells.map((x, c) => (
                  <span key={c} role="cell" style={{
                    ...S.cell, height: isMobile ? 28 : 32,
                    background: x == null ? 'var(--surface-inset)' : got.has(x) ? 'var(--status-incident)' : 'var(--surface-card)',
                    color: got.has(x) ? 'var(--gray-0)' : 'var(--text-primary)',
                    borderRadius: got.has(x) ? 99 : 4,
                  }}>{x ?? ''}</span>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {live && seated && (
        <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
          <Button icon="flag" disabled={!marks.full} onClick={() => onMove({ kinh: true })}>{t('games.loto.kinh')}</Button>
          <span style={S.caption}>{marks.full ? t('games.loto.kinhHint') : marks.waiting ? t('games.loto.waitingRows', { n: marks.waiting }) : t('games.loto.autoMark')}</span>
        </div>
      )}

      <details>
        <summary style={{ ...S.caption, cursor: 'pointer' }}>{t('games.loto.board', { k: called.length })}</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: 2, marginTop: 8 }}>
          {Array.from({ length: MAX }, (_, i) => i + 1).map((x) => (
            <span key={x} style={{ ...S.cell, height: 22, fontSize: 11, background: got.has(x) ? 'var(--surface-accent-soft)' : 'transparent', color: got.has(x) ? 'var(--text-accent)' : 'var(--text-muted)' }}>{x}</span>
          ))}
        </div>
      </details>
    </div>
  )
}

const S = {
  label: { font: 'var(--type-label)', color: 'var(--text-primary)' },
  mono: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-muted)' },
  caption: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  panel: {
    borderRadius: 12, padding: 14, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
    display: 'grid', gap: 12, placeItems: 'center', alignItems: 'center', textAlign: 'center',
  },
  ball: {
    width: 64, height: 64, borderRadius: 99, display: 'grid', placeItems: 'center', background: 'var(--status-incident)',
    color: 'var(--gray-0)', font: '700 26px/1 var(--font-display)', boxShadow: 'var(--shadow-md)',
  },
  chip: { font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--text-primary)', border: '1px solid', borderRadius: 99, padding: '3px 9px' },
  ticket: {
    display: 'grid', gap: 2, padding: 6, borderRadius: 10, border: '2px solid var(--status-incident)', background: 'var(--surface-card)',
    width: '100%', maxWidth: 460, margin: '0 auto',
  },
  cell: { display: 'grid', placeItems: 'center', font: '600 13px/1 var(--font-mono)', minWidth: 0 },
}
