import { useLayoutEffect, useRef, useState } from 'react'
import { Button, Icon } from '#ds'
import { Mono, Overline } from '#ui'
import { canUndo } from '#lib/tournament/advance.js'
import { CHAMP_KEY, flightsOf, hasResult, sideScores, slotKey } from '#lib/tournament/bracketView.js'
import { finalRows, groupStandings, swapUpInTie } from '#lib/tournament/standings.js'
import { closeScoreOf, freeSetWinner } from '#lib/tournament/scoring.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'
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
          <RoundHead name={t('tournament.bracket.champ')} sub={champion ? '' : t('tournament.bracket.champWait')} gold />
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
 * Vòng bảng: mỗi bảng một khối hiển thị cả Bảng xếp hạng (xử lý hoà) và danh sách trận theo lượt.
 * "Chốt giai đoạn" / "Tạo lịch nhánh" nằm ở thanh gọn trên đầu trang Nhánh đấu (không phải ở đây) — `manual`
 * (thứ tự BTC tự xếp khi hoà) cũng do trang cha giữ, để dùng chung cho cả hiển thị lẫn lúc tính `ranks` lúc chốt.
 * `locked` = giai đoạn đã chốt: chỉ xem, không sửa / hoàn tác (DB cũng chặn — `stageDone`).
 */
export function GroupBoard({ groups, tour, db, canEdit, locked, isMobile, onScore, onUndo, onEdit, onQuick, stage, manual, onReorder }) {
  const edit = canEdit && !locked
  const toStages = new Set((tour.stageLinks || []).filter((l) => l.fromStageId === stage?.id).map((l) => l.toStageId))
  const advancePerGroup = toStages.size > 0 ? (stage?.config?.advancePerGroup || 2) : 0
  // 1-2 bảng: mỗi thẻ đủ rộng để xếp hạng-trái/tab-phải cạnh nhau, ép đúng số cột (không auto-fit — auto-fit
  // với 1-2 item trên màn rộng có thể kẹt 1 thẻ hẹp lè tè giữa khoảng trống chết, xem chat). 3+ bảng: thẻ hẹp
  // lại (xếp hạng TRÊN, tab DƯỚI trong `GroupCard`) để auto-fit xếp đều nhiều thẻ/hàng mà không vỡ layout.
  const wide = !isMobile && groups.length <= 2

  return (
    <div style={{ display: 'grid', gap: 16, width: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : (wide ? `repeat(${groups.length}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(340px, 1fr))'),
        gap: 16,
        alignItems: 'start',
        width: '100%',
      }}>
        {groups.map((g) => (
          <GroupCard key={g.id} g={g} tour={tour} db={db} canEdit={canEdit} edit={edit} isMobile={isMobile} wide={wide} stage={stage}
            advancePerGroup={advancePerGroup} manual={manual} onReorder={onReorder}
            onScore={onScore} onUndo={onUndo} onEdit={onEdit} onQuick={onQuick} />
        ))}
      </div>
    </div>
  )
}

/**
 * Một bảng: xếp hạng (xử lý hoà) · tab chọn vòng, chỉ hiện đúng 1 vòng tại 1 lúc (thay vì liệt kê hết mọi
 * lượt xuống dưới — đỡ cuộn dài). `wide` (1-2 bảng): xếp hạng-trái/tab-phải cạnh nhau. Không `wide` (3+ bảng,
 * thẻ hẹp hơn để xếp nhiều thẻ/hàng): xếp hạng TRÊN, tab DƯỚI — không đủ chỗ ngang cho 2 cột.
 * Mặc định mở vòng đầu tiên còn trận chưa xong; tab có dấu ✓ khi vòng đó đã đấu hết. Không phải bóng đá —
 * không có "hoà", giữ đúng cột THẮNG/THUA/HS.
 */
function GroupCard({ g, tour, db, canEdit, edit, isMobile, wide, stage, advancePerGroup, manual, onReorder, onScore, onUndo, onEdit, onQuick }) {
  const own = tour.matches.filter((m) => m.groupId === g.id)
  const rounds = [...new Set(own.map((m) => m.round))].sort((x, y) => x - y)
  const roundDone = (r) => own.filter((m) => m.round === r).every((m) => hasResult(m))
  const [activeRound, setActiveRound] = useState(() => rounds.find((r) => !roundDone(r)) ?? rounds[0])
  const round = rounds.includes(activeRound) ? activeRound : rounds[0]
  const st = groupStandings(g, tour.matches)
  const rows = finalRows(stage, g, st, manual?.[g.id])
  const canReorder = canEdit && stage?.status === 'running' && st.isFinished

  return (
    <section style={{
      display: 'grid', gap: 14, padding: isMobile ? 12 : 16, borderRadius: 12,
      background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-xs)', width: '100%', boxSizing: 'border-box',
    }}>
      {/* Tiêu đề Bảng + Trạng thái tiến độ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ font: '700 16px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>
          {t('tournament.standings.groupTitle', { label: g.label })}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {advancePerGroup > 0 && (
            <span style={{
              font: '600 10.5px/1 var(--font-sans)', color: 'var(--teal-500)',
              background: 'var(--surface-accent-soft)', padding: '3px 8px', borderRadius: 99,
              border: '1px solid rgba(0, 178, 169, 0.25)',
            }}>
              {t('tournament.overview.remainingTake', { n: st.matchesCount.total - st.matchesCount.done, k: advancePerGroup })}
            </span>
          )}
          <Mono size={11} color="var(--text-muted)">
            {st.matchesCount.done}/{st.matchesCount.total} {t('tournament.overview.matchesDone')}
          </Mono>
        </div>
      </div>

      {/* Chưa đấu trận nào thì ai cũng hoà 0-0 — đúng toán nhưng chưa có gì để BTC "phân xử", chỉ nhắc
          khi bảng đã đấu xong hết (lúc thật sự cần chốt thứ hạng). */}
      {st.ties.length > 0 && st.isFinished && stage?.status !== 'done' && (
        <div style={{ font: 'var(--type-caption)', color: 'var(--status-delayed-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="alert-circle" size={13} />
          <span>{t(canReorder ? 'tournament.standings.tieReorder' : 'tournament.standings.tieNotice')}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 380px) 1fr', gap: 14, alignItems: 'start', minWidth: 0 }}>
        {/* BẢNG XẾP HẠNG (Standings) */}
        <div style={{
          borderRadius: 8, background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
          padding: '8px 10px', display: 'grid', gap: 4, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '24px 1fr 34px 34px 44px', alignItems: 'center', gap: 6,
            font: '700 10px/1 var(--font-sans)', color: 'var(--text-muted)', padding: '0 4px 6px',
            borderBottom: '1px solid var(--border-subtle)', letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            <span style={{ textAlign: 'center' }}>#</span>
            <span>{t('tournament.overview.pairs')}</span>
            <span style={{ textAlign: 'center' }}>{t('tournament.overview.won')}</span>
            <span style={{ textAlign: 'center' }}>{t('tournament.overview.lost')}</span>
            <span style={{ textAlign: 'right' }}>{t('tournament.overview.diff')}</span>
          </div>

          {rows.map((r) => {
            const advances = advancePerGroup > 0 && r.rank <= advancePerGroup
            const label = teamName(tour, db, r.teamId)
            const up = canReorder && swapUpInTie(rows, st.ties, r.teamId)
            return (
              <div key={r.teamId} style={{
                display: 'grid', gridTemplateColumns: '24px 1fr 34px 34px 44px', alignItems: 'center', gap: 6,
                padding: '5px 4px', borderRadius: 6,
                background: advances ? 'var(--surface-accent-soft)' : 'transparent',
                borderLeft: advances ? '3px solid var(--teal-500)' : '3px solid transparent',
              }}>
                <span style={{
                  textAlign: 'center', font: '700 11px/1 var(--font-mono)',
                  color: r.rank === 1 ? 'var(--podium-gold)' : 'var(--text-secondary)',
                }}>
                  {r.rank}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                  <span title={label} style={{
                    font: advances ? '600 12.5px/1.2 var(--font-sans)' : '500 12.5px/1.2 var(--font-sans)',
                    color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
                  }}>
                    {label}
                  </span>
                  {up && (
                    <button type="button" aria-label={t('tournament.standings.moveUp')} title={t('tournament.standings.moveUp')}
                      onClick={() => onReorder(g.id, up)}
                      style={{ display: 'grid', placeItems: 'center', flex: '0 0 auto', width: 20, height: 20, borderRadius: 5, border: '1px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <Icon name="chevron-up" size={11} />
                    </button>
                  )}
                </span>
                <Mono size={11.5} weight={600} color={r.won > 0 ? 'var(--status-delivered-fg)' : 'var(--text-secondary)'} style={{ textAlign: 'center' }}>
                  {r.won}
                </Mono>
                <Mono size={11.5} color={r.lost > 0 ? 'var(--text-secondary)' : 'var(--text-muted)'} style={{ textAlign: 'center' }}>
                  {r.lost}
                </Mono>
                <Mono size={11.5} weight={600} color={r.pointDiff > 0 ? 'var(--status-delivered-fg)' : (r.pointDiff < 0 ? 'var(--status-incident-fg)' : 'var(--text-muted)')} style={{ textAlign: 'right' }}>
                  {r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}
                </Mono>
              </div>
            )
          })}
        </div>

        {/* TAB CHỌN VÒNG + TRẬN CỦA VÒNG ĐANG CHỌN */}
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <Seg options={rounds.map((r) => ({ key: r, label: t('tournament.bracket.groupRound', { n: r + 1 }) + (roundDone(r) ? ' ✓' : '') }))}
            value={round} onChange={setActiveRound} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6 }}>
            {own.filter((m) => m.round === round).sort((x, y) => x.slot - y.slot).map((m) => (
              <MatchCard key={m.id} m={m} tour={tour} db={db} canEdit={edit} onScore={onScore} onUndo={onUndo} onEdit={onEdit} onQuick={onQuick} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function RoundHead({ name, sub, rule, gold }) {
  return (
    <div style={{ display: 'grid', gap: 6, paddingBottom: 8, borderBottom: `1px solid ${gold ? 'var(--podium-gold)' : 'var(--border-subtle)'}` }}>
      <span style={{
        font: '700 13px/1 var(--font-display)', letterSpacing: '0.05em', textTransform: 'uppercase',
        color: gold ? 'var(--podium-gold)' : 'var(--text-primary)',
      }}>
        {name}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        {sub && <Mono size={11} color="var(--text-muted)">{sub}</Mono>}
        {rule && (
          <span style={{
            font: '600 10.5px/1 var(--font-mono)', color: 'var(--teal-300)', background: 'rgba(0, 178, 169, .12)',
            border: '1px solid var(--teal-500)', padding: '2px 6px', borderRadius: 4,
          }}>
            {rule}
          </span>
        )}
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
    const w = freeSetWinner(a, b) // D11: ô nhập nhanh — bên cao điểm hơn thắng set
    // Sai luật / chưa xong vẫn gửi đi để action báo đúng lý do bằng i18n (applyCommit), không im lặng.
    // Action trả false ĐỒNG BỘ khi kiểm trên máy hỏng, Promise khi đi mạng — bọc lại cho cả hai.
    Promise.resolve(onQuick(m, [[a, b]], w === 'A' || w === 'B' ? w : a > b ? 'A' : 'B')).then((ok) => ok && setQuick(['', '']))
  }
  // Bấm tên đội = thắng nhanh: ô nào chưa gõ thì lấy tỷ số "sát nút" mặc định (điểm thật, qua đúng validation
  // freeSetWinner như submitQuick) — không phải kết quả bịa vô căn cứ, chỉ là tốc ký; sửa lại ở "Sửa điểm" sau.
  const quickWin = (side) => {
    const [hi, lo] = closeScoreOf(m.rule.points)
    const a = quick[0] !== '' ? Number(quick[0]) : (side === 'A' ? hi : lo)
    const b = quick[1] !== '' ? Number(quick[1]) : (side === 'B' ? hi : lo)
    const w = freeSetWinner(a, b)
    Promise.resolve(onQuick(m, [[a, b]], w === 'A' || w === 'B' ? w : side)).then((ok) => ok && setQuick(['', '']))
  }

  const row = (side) => {
    const teamId = side === 'A' ? m.teamAId : m.teamBId
    const src = side === 'A' ? m.sourceA : m.sourceB
    const won = hasResult(m) && m.winner === side
    const lost = hasResult(m) && m.winner && m.winner !== side
    const seed = src?.kind === 'seed' ? String(src.n) : src?.kind === 'draw' ? t('tournament.format.drawNo', { n: src.n }) : ''
    const label = teamId ? teamName(tour, db, teamId) : src?.kind === 'bye' ? t('tournament.bracket.bye') : t('tournament.bracket.tbd')
    // Đôi 2 người: mỗi người 1 dòng riêng (không nhét chung 1 dòng rồi cắt "...") — mỗi dòng tự cắt riêng,
    // tên dài vẫn thấy được gần hết thay vì cả cặp bị cắt cụt ngay từ tên đầu.
    const names = label ? label.split(' / ') : [label]
    const isTarget = dragOverSide === side
    const canQuickWin = inline && teamId
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
        display: 'flex', alignItems: 'center', gap: 8, minHeight: names.length > 1 ? 42 : 32, padding: names.length > 1 ? '4px 8px 4px 10px' : '0 8px 0 10px', borderRadius: 6,
        width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden',
        borderTop: side === 'B' ? '1px solid var(--border-subtle)' : 'none', cursor: dnd.draggable ? 'grab' : undefined,
        background: isTarget ? 'rgba(0, 178, 169, 0.16)' : won ? 'var(--surface-accent-soft)' : 'transparent',
        outline: isTarget ? '2px dashed var(--teal-500)' : 'none',
        outlineOffset: -2,
        transition: 'background .15s, outline .15s',
      }}>
        <span style={{ width: 22, font: '600 10.5px/1 var(--font-mono)', color: 'var(--text-muted)', flex: '0 0 auto' }}>{seed}</span>
        <span
          title={canQuickWin ? t('tournament.bracket.quickWinHint') : label}
          onClick={canQuickWin ? (e) => { e.stopPropagation(); quickWin(side) } : undefined}
          style={{ flex: 1, minWidth: 0, display: 'grid', gap: 1, cursor: canQuickWin ? 'pointer' : undefined }}
        >
          {names.map((n, i) => (
            <span key={i} style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              font: `${won ? 700 : 500} ${names.length > 1 ? 11.5 : 12.5}px/1.25 var(--font-sans)`,
              color: !teamId || lost ? 'var(--text-muted)' : 'var(--text-primary)',
            }}>
              {n}
            </span>
          ))}
        </span>
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
          <Mono size={10.5} color="var(--text-muted)" title={m.resultNote || undefined}
            style={{ maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {/* dừng sớm / bỏ cuộc: hiện đúng ghi chú của trận ("Dừng sớm — …") thay vì nhãn chung "Bỏ cuộc" */}
            {m.status === 'retired' && m.resultNote ? m.resultNote : t('tournament.matchStatus.' + m.status)}
          </Mono>
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
