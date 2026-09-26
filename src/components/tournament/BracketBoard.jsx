import { useLayoutEffect, useRef, useState } from 'react'
import { Button, Icon } from '#ds'
import { Mono, Overline } from '#ui'
import { canUndo } from '#lib/tournament/advance.js'
import { CHAMP_KEY, flightsOf, hasResult, sideScores, slotKey } from '#lib/tournament/bracketView.js'
import { setWinner } from '#lib/tournament/scoring.js'
import { t } from '#i18n'
import { matchCode, ruleLabel, teamName } from './tourUtils.js'

const EASE = 'cubic-bezier(.2,.8,.2,1)' // DESIGN.md §6
const CARD_W = 242
const ARM = 24 // nửa khoảng giữa hai cột — dài một nhánh đường nối
const SLOT_H = 112 // chiều cao một ô trận ở vòng đầu (thẻ ~94 + khe)
const SWAP_MIME = 'text/x-tour-swap'

/**
 * Nhánh loại trực tiếp (handoff "Nhánh đấu trực tiếp"): cột theo vòng · đường nối · cột Vô địch + trận 3-4.
 * Hiệu ứng (plan §6.2): đội thắng bay lên ô vòng sau, vô địch loé vàng, thẻ hiện dần lần đầu mở.
 * Hàm thuần `flightsOf` quyết định bay từ đâu tới đâu; ở đây chỉ chạy Web Animations.
 */
export default function BracketBoard({ view, tour, db, canEdit, isMobile, onScore, onUndo, onEdit, onQuick, onSwap }) {
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
      const glow = gold ? 'rgba(240, 183, 92, 0.5)' : 'rgba(0, 178, 169, 0.45)'
      b.animate([
        { transform: `translate(${ra.left - rb.left}px, ${ra.top - rb.top}px) scale(1.04)`, boxShadow: `0 12px 30px ${glow}`, zIndex: 5 },
        { transform: 'translate(0, 0) scale(1.06)', offset: 0.8, boxShadow: `0 0 0 2px ${glow}` },
        { transform: 'none', boxShadow: '0 0 0 0 transparent' },
      ], { duration: gold ? 760 : 620, easing: EASE })
      b.animate([{ backgroundColor: gold ? 'rgba(240, 210, 106, 0.35)' : 'rgba(0, 178, 169, 0.35)' }, { backgroundColor: 'transparent' }],
        { duration: 900, delay: gold ? 700 : 480, easing: 'ease-out' })
      if (gold) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' }], { duration: 500, delay: 760, easing: 'ease-out' })
    })
  }, [matches])

  const champion = view.final && hasResult(view.final)
    ? (view.final.winner === 'A' ? view.final.teamAId : view.final.teamBId) : null
  const thirdWinner = view.third && hasResult(view.third)
    ? (view.third.winner === 'A' ? view.third.teamAId : view.third.teamBId) : null
  const card = (m, extra) => (
    <MatchCard key={m.id} m={m} tour={tour} db={db} canEdit={canEdit} onScore={onScore} onUndo={onUndo} onEdit={onEdit} onQuick={onQuick}
      onSwap={extra.round === 0 ? onSwap : null} {...extra} />
  )

  return (
    <div ref={rootRef} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 6 }}>
      <div style={{ display: 'flex', gap: ARM * 2, minWidth: 'min-content', padding: isMobile ? '4px 2px' : '4px 6px' }}>
        {view.rounds.map((rd, ri) => (
          <div key={rd.round} style={{ width: CARD_W, minWidth: CARD_W, maxWidth: CARD_W, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10, alignContent: 'start' }}>
            <RoundHead name={t('tournament.round.' + rd.kind)} sub={t('tournament.bracket.roundSub', { n: rd.matches.filter((m) => m.status !== 'bye').length })}
              rule={ruleLabel(rd.matches[0].rule)} />
            <div style={{ display: 'flex', flexDirection: 'column', height, width: '100%', minWidth: 0 }}>
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
                  <div key={m.id} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                    {!last && <span aria-hidden style={arm(m.slot % 2 === 0)} />}
                    {ri > 0 && <span aria-hidden style={{ position: 'absolute', left: -ARM, width: ARM, top: '50%', borderTop: '2px solid var(--border-default)' }} />}
                    {card(m, { round: ri })}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div style={{ width: CARD_W, minWidth: CARD_W, maxWidth: CARD_W, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10, alignContent: 'start' }}>
          <RoundHead name={t('tournament.bracket.champ')} sub={champion ? '' : t('tournament.bracket.champWait')} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, minHeight: height }}>
            <div data-k={CHAMP_KEY} style={{
              display: 'grid', gap: 8, padding: '24px 16px', borderRadius: 12, textAlign: 'center',
              background: champion ? 'var(--status-delayed-bg)' : 'var(--surface-inset)',
              border: `1.5px ${champion ? 'solid var(--podium-gold)' : 'dashed var(--border-default)'}`,
              boxShadow: champion ? 'var(--shadow-sm)' : 'none',
              transition: 'background .3s, border-color .3s',
            }}>
              <Icon name="trophy" size={32} style={{ color: champion ? 'var(--podium-gold)' : 'var(--text-muted)', justifySelf: 'center', opacity: champion ? 1 : 0.6 }} />
              <div>
                <Overline>{t('tournament.bracket.champKicker')}</Overline>
                <div style={{ font: '700 16px/1.3 var(--font-display)', color: champion ? 'var(--text-primary)' : 'var(--text-secondary)', marginTop: 4 }}>
                  {champion ? teamName(tour, db, champion) : t('tournament.bracket.champWait')}
                </div>
                {!champion && (
                  <div style={{ font: '400 11.5px/1.4 var(--font-sans)', color: 'var(--text-muted)', marginTop: 4 }}>
                    {t('tournament.bracket.champSubtitle')}
                  </div>
                )}
                {thirdWinner && (
                  <div style={{ font: '500 12px/1.4 var(--font-sans)', color: 'var(--text-secondary)', marginTop: 6 }}>
                    {t('tournament.bracket.champThird', { name: teamName(tour, db, thirdWinner) })}
                  </div>
                )}
              </div>
            </div>
            {view.third && (
              <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
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

/**
 * Vòng bảng: mỗi bảng một khối, trận xếp theo lượt (không vẽ nhánh — trận vòng tròn không có trận sau).
 * `locked` = giai đoạn đã chốt: chỉ xem, không sửa / hoàn tác (DB cũng chặn — `stageDone`).
 */
export function GroupBoard({ groups, tour, db, canEdit, locked, isMobile, onScore, onUndo, onEdit, onQuick }) {
  const edit = canEdit && !locked
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, alignItems: 'start' }}>
      {groups.map((g) => {
        const own = tour.matches.filter((m) => m.groupId === g.id)
        const rounds = [...new Set(own.map((m) => m.round))].sort((x, y) => x - y)
        return (
          <section key={g.id} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
            <span style={{ font: '700 14px/1 var(--font-display)', color: 'var(--text-primary)' }}>{t('tournament.standings.groupTitle', { label: g.label })}</span>
            {rounds.map((r) => (
              <div key={r} style={{ display: 'grid', gap: 6 }}>
                <Overline>{t('tournament.bracket.groupRound', { n: r + 1 })}</Overline>
                {own.filter((m) => m.round === r).sort((x, y) => x.slot - y.slot).map((m) => (
                  <MatchCard key={m.id} m={m} tour={tour} db={db} canEdit={edit} onScore={onScore} onUndo={onUndo} onEdit={onEdit} onQuick={onQuick} />
                ))}
              </div>
            ))}
          </section>
        )
      })}
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
function MatchCard({ m, tour, db, canEdit, round, onScore, onUndo, onEdit, onQuick, onSwap }) {
  const [quick, setQuick] = useState(['', ''])
  const [dragOverSide, setDragOverSide] = useState(null)
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
    const isTarget = dragOverSide === side
    // Không có "bấm tên đội = thắng" (plan §6): kết quả chỉ vào qua ô điểm / bảng điểm, có tỷ số thật.
    // Vòng đầu, nhánh chưa đấu trận nào: kéo tên đội thả vào đội khác để đổi chỗ (handoff) — trang cha quyết `onSwap`.
    const dnd = onSwap && teamId ? {
      draggable: true,
      onDragStart: (e) => e.dataTransfer.setData(SWAP_MIME, teamId),
      onDragOver: (e) => { e.preventDefault(); setDragOverSide(side) },
      onDragLeave: () => setDragOverSide(null),
      onDrop: (e) => {
        setDragOverSide(null)
        const from = e.dataTransfer.getData(SWAP_MIME)
        if (from && from !== teamId) { e.preventDefault(); onSwap(from, teamId) }
      },
    } : {}
    return (
      <div data-k={slotKey(m.id, side)} {...dnd} style={{
        display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, padding: '0 8px 0 10px', borderRadius: 6,
        width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden',
        borderTop: side === 'B' ? '1px solid var(--border-subtle)' : 'none', cursor: dnd.draggable ? 'grab' : undefined,
        background: isTarget ? 'rgba(0, 178, 169, 0.16)' : won ? 'var(--surface-accent-soft)' : 'transparent',
        outline: isTarget ? '2px dashed var(--teal-500)' : 'none',
        outlineOffset: -2,
        transition: 'background .15s, outline .15s',
      }}>
        <span style={{ width: 22, font: '600 10.5px/1 var(--font-mono)', color: 'var(--text-muted)', flex: '0 0 auto' }}>{seed}</span>
        <span title={label} style={{
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
              flex: '0 0 auto',
            }}
          />
        )}
        {hasResult(m) && (
          <span style={{ flex: '0 0 auto' }}>
            <Mono size={12} weight={won ? 700 : 500} color={won ? 'var(--status-transit-fg)' : 'var(--text-muted)'}>
              {m.status === 'walkover' ? (won ? 'W' : '—') : sideScores(m.sets, side).join(' ')}
            </Mono>
          </span>
        )}
      </div>
    )
  }

  return (
    <div data-card={m.id} data-round={round} data-slot={m.slot} style={{
      width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden',
      display: 'grid', padding: '6px 4px 4px', borderRadius: 10,
      background: m.status === 'bye' ? 'transparent' : 'var(--surface-card)',
      border: `1px ${m.status === 'bye' ? 'dashed' : 'solid'} ${m.status === 'live' ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
      boxShadow: m.status === 'bye' ? 'none' : 'var(--shadow-xs)', opacity: m.status === 'bye' ? 0.7 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24, padding: '0 6px 4px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
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
        {canEdit && open && (
          <button
            type="button"
            onClick={() => onScore(m)}
            style={{
              height: 22,
              padding: '0 8px',
              borderRadius: 5,
              display: 'flex',
              alignItems: 'center',
              background: 'var(--teal-500)',
              font: '700 10.5px/1 var(--font-sans)',
              letterSpacing: '0.06em',
              color: '#04302C',
              cursor: 'pointer',
              transition: 'opacity .15s',
            }}
          >
            {t('tournament.bracket.score')}
          </button>
        )}
        {canEdit && m.status === 'done' && <Button size="sm" variant="ghost" style={{ height: 24, padding: '0 6px', fontSize: 11 }} onClick={() => onEdit(m)}>{t('tournament.bracket.edit')}</Button>}
        {undoable && <Button size="sm" variant="ghost" style={{ height: 24, padding: '0 6px', fontSize: 11 }} onClick={() => onUndo(m)}>{t('tournament.bracket.undo')}</Button>}
      </div>
      {row('A')}
      {row('B')}
    </div>
  )
}
