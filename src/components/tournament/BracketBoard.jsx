import { useLayoutEffect, useRef, useState } from 'react'
import { Button, Icon } from '#ds'
import { Mono, Overline } from '#ui'
import { canUndo } from '#lib/tournament/advance.js'
import { CHAMP_KEY, flightsOf, hasResult, sideScores, slotKey } from '#lib/tournament/bracketView.js'
import { setWinner } from '#lib/tournament/scoring.js'
import { t } from '#i18n'
import { matchCode, ruleLabel, teamName } from './tourUtils.js'

const EASE = 'cubic-bezier(.2,.8,.2,1)' // DESIGN.md §6
const CARD_W = 232
const ARM = 20 // nửa khoảng giữa hai cột — dài một nhánh đường nối
const SLOT_H = 108 // chiều cao một ô trận ở vòng đầu (thẻ ~92 + khe)

/**
 * Nhánh loại trực tiếp (handoff "Nhánh đấu trực tiếp"): cột theo vòng · đường nối · cột Vô địch + trận 3-4.
 * Hiệu ứng (plan §6.2): đội thắng bay lên ô vòng sau, vô địch loé vàng, thẻ hiện dần lần đầu mở.
 * Hàm thuần `flightsOf` quyết định bay từ đâu tới đâu; ở đây chỉ chạy Web Animations.
 */
export default function BracketBoard({ view, tour, db, canEdit, isMobile, onScore, onUndo, onEdit, onQuick }) {
  const rootRef = useRef(null)
  const prevRef = useRef(null)
  const matches = tour.matches
  const firstCount = view.rounds[0]?.matches.length || 1
  const height = firstCount * SLOT_H

  useLayoutEffect(() => {
    const root = rootRef.current
    const prev = prevRef.current
    prevRef.current = matches
    if (!root || typeof root.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (!prev) {
      root.querySelectorAll('[data-card]').forEach((el) => {
        const r = Number(el.dataset.round) || 0
        const s = Number(el.dataset.slot) || 0
        el.animate([{ opacity: 0, transform: 'translateY(14px) scale(.97)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, delay: r * 140 + s * 45, easing: EASE, fill: 'backwards' })
      })
      return
    }
    flightsOf(prev, matches).forEach(({ from, to, gold }) => {
      const a = root.querySelector(`[data-k="${from}"]`)
      const b = root.querySelector(`[data-k="${to}"]`)
      if (!a || !b) return
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const glow = gold ? 'var(--podium-gold)' : 'var(--teal-500)'
      b.animate([
        { transform: `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px) scale(1.04)`, boxShadow: `0 12px 30px ${glow}`, zIndex: 5 },
        { transform: 'translate(0, 0) scale(1.06)', offset: 0.8, boxShadow: `0 0 0 2px ${glow}` },
        { transform: 'none', boxShadow: '0 0 0 0 transparent' },
      ], { duration: gold ? 760 : 620, easing: EASE })
      b.animate([{ backgroundColor: gold ? 'var(--status-delayed-bg)' : 'var(--surface-accent-soft)' }, { backgroundColor: 'transparent' }],
        { duration: 900, delay: gold ? 700 : 480, easing: 'ease-out' })
      if (gold) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }], { duration: 500, delay: 760, easing: 'ease-out' })
    })
  }, [matches])

  const champion = view.final && hasResult(view.final)
    ? (view.final.winner === 'A' ? view.final.teamAId : view.final.teamBId) : null
  const card = (m, extra) => (
    <MatchCard key={m.id} m={m} tour={tour} db={db} canEdit={canEdit} onScore={onScore} onUndo={onUndo} onEdit={onEdit} onQuick={onQuick} {...extra} />
  )

  return (
    <div ref={rootRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6 }}>
      <div style={{ display: 'flex', gap: ARM * 2, minWidth: 'min-content', padding: isMobile ? '4px 2px' : '4px 6px' }}>
        {view.rounds.map((rd, ri) => (
          <div key={rd.round} style={{ width: CARD_W, flex: '0 0 auto', display: 'grid', gap: 10, alignContent: 'start' }}>
            <RoundHead name={t('tournament.round.' + rd.kind)} sub={t('tournament.bracket.roundSub', { n: rd.matches.filter((m) => m.status !== 'bye').length })}
              rule={ruleLabel(rd.matches[0].rule)} />
            <div style={{ display: 'flex', flexDirection: 'column', height }}>
              {rd.matches.map((m) => {
                const last = ri === view.rounds.length - 1
                const lit = hasResult(m) || m.status === 'bye'
                const arm = (top) => ({
                  position: 'absolute', right: -ARM, width: ARM, ...(top ? { top: '50%', bottom: 0 } : { top: 0, bottom: '50%' }),
                  [top ? 'borderTop' : 'borderBottom']: `2px solid ${lit ? 'var(--teal-500)' : 'var(--border-default)'}`,
                  borderRight: `2px solid ${lit ? 'var(--teal-500)' : 'var(--border-default)'}`,
                  [top ? 'borderTopRightRadius' : 'borderBottomRightRadius']: 6, transition: 'border-color .4s',
                })
                return (
                  <div key={m.id} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {!last && <span aria-hidden style={arm(m.slot % 2 === 0)} />}
                    {ri > 0 && <span aria-hidden style={{ position: 'absolute', left: -ARM, width: ARM, top: '50%', borderTop: '2px solid var(--border-default)' }} />}
                    {card(m, { round: ri })}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{ width: CARD_W, flex: '0 0 auto', display: 'grid', gap: 10, alignContent: 'start' }}>
          <RoundHead name={t('tournament.bracket.champ')} sub={champion ? '' : t('tournament.bracket.champWait')} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, minHeight: height }}>
            <div data-k={CHAMP_KEY} style={{
              display: 'grid', gap: 6, padding: '14px 14px 16px', borderRadius: 10, textAlign: 'center',
              background: champion ? 'var(--status-delayed-bg)' : 'var(--surface-inset)',
              border: `1px ${champion ? 'solid' : 'dashed'} ${champion ? 'var(--podium-gold)' : 'var(--border-default)'}`,
            }}>
              <Icon name="trophy" size={22} style={{ color: champion ? 'var(--podium-gold)' : 'var(--text-muted)', justifySelf: 'center' }} />
              <Overline>{t('tournament.bracket.champKicker')}</Overline>
              <span style={{ font: '700 16px/1.25 var(--font-display)', color: champion ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {champion ? teamName(tour, db, champion) : t('tournament.bracket.champWait')}
              </span>
            </div>
            {view.third && (
              <div style={{ display: 'grid', gap: 8 }}>
                <RoundHead name={t('tournament.round.third')} rule={ruleLabel(view.third.rule)} />
                {card(view.third, { round: view.rounds.length })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RoundHead({ name, sub, rule }) {
  return (
    <div style={{ display: 'grid', gap: 4, paddingBottom: 2 }}>
      <span style={{ font: '700 13px/1 var(--font-sans)', color: 'var(--text-primary)' }}>{name}</span>
      <span style={{ display: 'flex', gap: 8, font: '400 11px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {sub && <span>{sub}</span>}
        {rule && <span>{rule}</span>}
      </span>
    </div>
  )
}

/** Thẻ một trận: mã, trạng thái, nút GHI ĐIỂM / Hoàn tác / Sửa điểm; hai dòng đội (ô `data-k` cho hiệu ứng). */
function MatchCard({ m, tour, db, canEdit, round, onScore, onUndo, onEdit, onQuick }) {
  const [quick, setQuick] = useState(['', ''])
  const open = m.status === 'ready' || m.status === 'live'
  const inline = canEdit && open && m.rule?.sets === 1
  const undoable = canEdit && hasResult(m) && canUndo(tour.matches, m.id).ok
  const submitQuick = () => {
    const a = Number(quick[0])
    const b = Number(quick[1])
    if (quick[0] === '' || quick[1] === '') return
    const w = setWinner(a, b, m.rule)
    // Sai luật / chưa xong vẫn gửi đi để action báo đúng lý do bằng i18n (applyCommit), không im lặng.
    // Action trả false ĐỒNG BỘ khi kiểm trên máy hỏng, Promise khi đi mạng — bọc lại cho cả hai.
    Promise.resolve(onQuick(m, [[a, b]], w === 'A' || w === 'B' ? w : a > b ? 'A' : 'B')).then((ok) => ok && setQuick(['', '']))
  }

  const row = (side) => {
    const teamId = side === 'A' ? m.teamAId : m.teamBId
    const src = side === 'A' ? m.sourceA : m.sourceB
    const won = hasResult(m) && m.winner === side
    const lost = hasResult(m) && m.winner && m.winner !== side
    const seed = src?.kind === 'seed' ? String(src.n) : src?.kind === 'draw' ? t('tournament.format.drawNo', { n: src.n }) : ''
    const label = teamId ? teamName(tour, db, teamId) : src?.kind === 'bye' ? t('tournament.bracket.bye') : t('tournament.bracket.tbd')
    return (
      <div data-k={slotKey(m.id, side)} style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, padding: '0 8px 0 10px', borderRadius: 6,
        borderTop: side === 'B' ? '1px solid var(--border-subtle)' : 'none',
        background: won ? 'var(--surface-accent-soft)' : 'transparent', transition: 'background .15s',
      }}>
        <span style={{ width: 22, font: '600 10.5px/1 var(--font-mono)', color: 'var(--text-muted)', flex: '0 0 auto' }}>{seed}</span>
        <span style={{
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          font: `${won ? 700 : 500} 12.5px/1.2 var(--font-sans)`,
          color: !teamId || lost ? 'var(--text-muted)' : 'var(--text-primary)',
        }}>{label}</span>
        {inline && (
          <input
            type="number" inputMode="numeric" min={0} aria-label={t('tournament.bracket.inlineHint')}
            value={quick[side === 'A' ? 0 : 1]}
            onChange={(e) => setQuick((q) => (side === 'A' ? [e.target.value, q[1]] : [q[0], e.target.value]))}
            onKeyDown={(e) => e.key === 'Enter' && submitQuick()}
            placeholder="–"
            style={{
              width: 42, height: 26, borderRadius: 5, textAlign: 'center', font: '700 13px/1 var(--font-mono)',
              background: 'var(--surface-inset)', color: 'var(--text-primary)', border: '1px solid var(--border-default)',
            }}
          />
        )}
        {hasResult(m) && (
          <Mono size={12} weight={won ? 700 : 500} color={won ? 'var(--status-transit-fg)' : 'var(--text-muted)'}>
            {m.status === 'walkover' ? (won ? 'W' : '—') : sideScores(m.sets, side).join(' ')}
          </Mono>
        )}
      </div>
    )
  }

  return (
    <div data-card={m.id} data-round={round} data-slot={m.slot} style={{
      width: '100%', display: 'grid', padding: '6px 4px 4px', borderRadius: 10,
      background: m.status === 'bye' ? 'transparent' : 'var(--surface-card)',
      border: `1px ${m.status === 'bye' ? 'dashed' : 'solid'} ${m.status === 'live' ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
      boxShadow: m.status === 'bye' ? 'none' : 'var(--shadow-xs)', opacity: m.status === 'bye' ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24, padding: '0 6px 4px' }}>
        <Mono size={11} weight={700} color="var(--text-secondary)">{matchCode(m)}</Mono>
        {m.status === 'live' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '700 10px/1 var(--font-sans)', color: 'var(--status-transit-fg)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--teal-500)' }} />{t('tournament.bracket.live')}
          </span>
        )}
        {m.courtLabel && <Mono size={10.5} color="var(--text-muted)">{m.courtLabel}</Mono>}
        {(m.status === 'walkover' || m.status === 'retired' || m.status === 'bye') && (
          <Mono size={10.5} color="var(--text-muted)">{t('tournament.matchStatus.' + m.status)}</Mono>
        )}
        <span style={{ flex: 1 }} />
        {canEdit && open && <Button size="sm" variant="primary" style={{ height: 24, padding: '0 8px', fontSize: 10.5 }} onClick={() => onScore(m)}>{t('tournament.bracket.score')}</Button>}
        {canEdit && m.status === 'done' && <Button size="sm" variant="ghost" style={{ height: 24, padding: '0 6px', fontSize: 11 }} onClick={() => onEdit(m)}>{t('tournament.bracket.edit')}</Button>}
        {undoable && <Button size="sm" variant="ghost" style={{ height: 24, padding: '0 6px', fontSize: 11 }} onClick={() => onUndo(m)}>{t('tournament.bracket.undo')}</Button>}
      </div>
      {row('A')}
      {row('B')}
    </div>
  )
}
