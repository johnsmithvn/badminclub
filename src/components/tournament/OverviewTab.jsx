import { Button, Card, Icon } from '#ds'
import { Mono } from '#ui'
import { hubChecklist } from '#lib/tournament/hub.js'
import { eventTeams } from '#lib/tournament/pairing.js'
import { hasResult, progressOf, queueOf, sideScores } from '#lib/tournament/bracketView.js'
import { stageGroups } from '#lib/tournament/standings.js'
import cfg from '#config/app.json' with { type: 'json' }
import { t } from '#i18n'
import { matchCode, stageName, teamName } from './tourUtils.js'
import { koRounds } from '#lib/tournament/bracketView.js'
import { estimateOf, koPreviewOf } from '#lib/tournament/canvas.js'
import { TeamNameLines } from './TourBits.jsx'

/**
 * Tab Tổng quan (handoff "Giải đấu · desktop v2"):
 * - Bố cục 2 cột (Trái ~70%, Phải ~30% trên desktop).
 * - Cột Trái:
 *   1. Cụm 4 ô Mini-Stats (CẶP, TRẬN XONG, ĐANG ĐÁNH, CÒN LẠI ƯỚC TÍNH)
 *   2. Thanh Tiến độ Giai đoạn (Stage Pipeline)
 *   3. Bảng xếp hạng vòng bảng (Hiển thị song song Bảng A, Bảng B...)
 * - Cột Phải:
 *   1. Khối "Trận kế tiếp" (Upcoming Matches Timeline)
 *   2. Khối việc cần chuẩn bị (Checklist)
 */
export default function OverviewTab({ tour, db, event, onGo, canEdit, onOpenBracket, onScore, isMobile }) {
  const list = hubChecklist(tour)
  const label = (c) => (!c.done && c.n ? t('tournament.check.' + c.key + 'Left', { n: c.n }) : t('tournament.check.' + c.key))
  const queue = queueOf(tour.matches)
  const prog = progressOf(tour.matches)

  // Lấy các giai đoạn vòng bảng của nội dung hiện tại (hoặc nội dung đầu tiên)
  const curEventId = event?.id || tour.events[0]?.id
  const curEvent = tour.events.find((e) => e.id === curEventId) || tour.events[0]
  const eventMatches = (tour.matches || []).filter((m) => m.eventId === curEventId)

  // Các số đo Mini-Stats — trận bye không ai đánh nên không tính (progressOf).
  const teamsCount = curEvent ? eventTeams(tour, curEvent.id).length : 0
  const { done: evDoneMatches, total: evTotalMatches } = progressOf(eventMatches)
  const liveCount = eventMatches.filter((m) => m.status === 'live').length
  // Ước tính thô (phút sân / số sân — chưa tính đường găng, plan §5.7). Giải chưa khai báo sân → không ước tính.
  const courtsCount = tour.courtLabels.length
  const remainingMatches = evTotalMatches - evDoneMatches
  const estMinutes = courtsCount ? Math.round((remainingMatches * cfg.tournament.estimateMatchMin) / courtsCount) : null

  // Các giai đoạn của nội dung hiện tại
  const curStages = (tour.stages || [])
    .filter((s) => !curEventId || s.eventId === curEventId)
    .sort((x, y) => x.seq - y.seq)
  const rrStages = curStages.filter((s) => s.type === 'round_robin')

  // Đang đánh (đứng đầu hàng chờ) rồi tới các trận kế tiếp — của cả giải, mọi nội dung.
  const upcomingMatches = queue.slice(0, 6)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
      gap: 16,
      alignItems: 'start',
      width: '100%',
    }}>
      {/* CỘT TRÁI (~70% chiều rộng): Mini Stats + Pipeline + Bảng Xếp Hạng */}
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {/* 1. 4 Ô Mini Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 12,
        }}>
          {/* Cặp */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 4,
          }}>
            <span style={{ font: '700 10.5px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {t('tournament.overview.pairs')}
            </span>
            <span style={{ font: '700 24px/1 var(--font-display)', color: 'var(--text-primary)' }}>
              {teamsCount}
            </span>
          </div>

          {/* Trận xong */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 4,
          }}>
            <span style={{ font: '700 10.5px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {t('tournament.overview.matchesDone')}
            </span>
            <span style={{ font: '700 24px/1 var(--font-display)', color: 'var(--text-primary)' }}>
              {evTotalMatches > 0 ? `${evDoneMatches}/${evTotalMatches}` : '0'}
            </span>
          </div>

          {/* Đang đá */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 4,
          }}>
            <span style={{ font: '700 10.5px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {t('tournament.overview.liveMatches')}
            </span>
            <span style={{ font: '700 24px/1 var(--font-display)', color: 'var(--status-delivered-fg)' }}>
              {liveCount}
            </span>
          </div>

          {/* Còn lại ước tính */}
          <div style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            display: 'grid',
            gap: 4,
          }}>
            <span style={{ font: '700 10.5px/1 var(--font-sans)', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {t('tournament.overview.estRemaining')}
            </span>
            <span style={{ font: '700 24px/1 var(--font-display)', color: 'var(--text-primary)' }}>
              {estMinutes == null ? '—' : t('tournament.overview.minutes', { n: estMinutes })}
            </span>
          </div>
        </div>

        {/* 2. Thanh Tiến Độ Giai Đoạn (Stage Timeline Pipeline) chuẩn handoff */}
        {curStages.length > 0 && (
          <div style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            overflowX: 'auto',
          }}>
            {curStages.map((st, i) => {
              const isRunning = st.status === 'running'
              const isDone = st.status === 'done'
              const stageTotal = progressOf((tour.matches || []).filter((m) => m.stageId === st.id)).total

              // Subtext thông tin giai đoạn
              const subInfo = st.type === 'round_robin'
                ? t('tournament.overview.rrStageDesc', { total: stageTotal, groups: stageGroups(tour, st.id).length })
                : t('tournament.overview.koStageDesc', { total: stageTotal })

              return (
                <div key={st.id} style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    flex: '0 0 auto',
                    font: '700 11px/1 var(--font-mono)',
                    background: isRunning ? 'var(--teal-500)' : (isDone ? 'var(--status-delivered-fg)' : 'var(--surface-sunken)'),
                    color: isRunning || isDone ? 'var(--action-accent-fg)' : 'var(--text-muted)',
                    border: isRunning || isDone ? 'none' : '1px solid var(--border-subtle)',
                  }}>
                    {st.seq}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ font: '600 13px/1.2 var(--font-sans)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {stageName(st, curStages)}
                      </span>
                      <span style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        font: '700 9.5px/1 var(--font-sans)',
                        background: isRunning ? 'var(--surface-accent-soft)' : (isDone ? 'var(--status-delivered-bg)' : 'var(--surface-sunken)'),
                        color: isRunning ? 'var(--teal-500)' : (isDone ? 'var(--status-delivered-fg)' : 'var(--text-muted)'),
                        whiteSpace: 'nowrap',
                      }}>
                        {isRunning ? t('tournament.overview.stageRunning') : (isDone ? t('tournament.overview.stageDone') : t('tournament.overview.stagePending'))}
                      </span>
                    </div>
                    <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {subInfo}
                    </span>
                  </div>
                  {i < curStages.length - 1 && (
                    <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)', margin: '0 12px', minWidth: 20 }} />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Khối "Trước khi bắt đầu" (Checklist) nổi bật khi giải ở trạng thái chuẩn bị */}
        {(!evTotalMatches || tour.status === 'draft' || tour.status === 'registration') && (
          <div style={{
            padding: '14px 18px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <span style={{ font: '700 14px/1.2 var(--font-display)', color: 'var(--text-primary)' }}>
              {t('tournament.check.title')}
            </span>
            <div style={{ display: 'grid', gap: 8 }}>
              {list.map((c) => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    flex: '0 0 auto',
                    background: c.done ? 'var(--status-delivered-bg)' : 'var(--surface-sunken)',
                    color: c.done ? 'var(--status-delivered-fg)' : 'var(--text-muted)',
                    border: c.done ? 'none' : '1px dashed var(--border-default)',
                  }}>
                    {c.done && <Icon name="check" size={11} />}
                  </span>
                  <span style={{
                    flex: 1,
                    font: '400 13px/1.3 var(--font-sans)',
                    color: c.done ? 'var(--text-muted)' : 'var(--text-primary)',
                  }}>
                    {label(c)}
                  </span>
                  {!c.done && canEdit && c.tab !== 'overview' && (
                    <button
                      type="button"
                      onClick={() => onGo(c.tab)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--teal-500)',
                        font: '600 12px/1 var(--font-sans)',
                        cursor: 'pointer',
                        padding: '4px 6px',
                      }}
                    >
                      {t('tournament.check.go')} →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Vòng bảng: chỉ tóm tắt tiến độ + mở Nhánh đấu — bảng xếp hạng đầy đủ (xử lý hoà, Chốt giai đoạn,
            Tạo lịch nhánh) đã gộp về GroupBoard ở trang Nhánh đấu, tránh 2 nơi cùng sửa một thứ (2026-09-26). */}
        {rrStages.map((stage) => {
          const groups = stageGroups(tour, stage.id)
          if (!groups.length) return null
          const stMatches = groups.flatMap((g) => tour.matches.filter((m) => m.groupId === g.id))
          const { done, total } = progressOf(stMatches)
          const donePct = total ? Math.round((done / total) * 100) : 0
          const rrDone = total > 0 && done === total
          return (
            <Card key={stage.id} title={stageName(stage, curStages)} icon="table" padding="12px 16px"
              actions={<Button size="sm" variant="secondary" iconAfter="arrow-right" onClick={() => onOpenBracket(stage.eventId)}>{t('tournament.overview.openBracketBtn')}</Button>}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <Mono size={12} color="var(--text-secondary)">{t('tournament.overview.rrStageDesc', { total, groups: groups.length })}</Mono>
                  <Mono size={12} weight={700} color={rrDone ? 'var(--status-delivered-fg)' : 'var(--teal-500)'}>
                    {done}/{total} {t('tournament.overview.matchesDone')}
                  </Mono>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--border-default)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${donePct}%`, borderRadius: 3, transition: 'width .3s ease',
                    background: rrDone ? 'var(--status-delivered-fg)' : 'var(--teal-500)',
                  }} />
                </div>
              </div>
            </Card>
          )
        })}

        {/* 4. Nhánh loại trực tiếp thu nhỏ (handoff): đã có lịch → đội thật; chưa → ô chờ "Nhất A", "Thắng BK1" */}
        {curStages.filter((s) => s.type === 'knockout').map((st) => (
          <MiniBracket key={st.id} tour={tour} db={db} stage={st} stages={curStages} onOpen={() => onOpenBracket(st.eventId)} />
        ))}
      </div>

      {/* CỘT PHẢI (~30% chiều rộng): Trận Kế Tiếp + Checklist */}
      <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
        {/* Khối Trận Đang Đánh & Kế Tiếp (giữ Card chuẩn của handoff để khớp tiến độ và mở nhánh) */}
        {tour.matches && tour.matches.length > 0 && (
          <Card
            title={t('tournament.overview.live')}
            icon="calendar-clock"
            padding="12px 16px"
            subtitle={t('tournament.bracket.progressVal', prog)}
          >
            {upcomingMatches.length === 0 && (
              <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', padding: '10px 0' }}>
                {t('tournament.overview.noneOpen')}
              </div>
            )}
            {upcomingMatches.map((m, idx) => {
              const ev = tour.events.find((e) => e.id === m.eventId)
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minHeight: 44,
                    borderTop: idx ? '1px solid var(--border-subtle)' : 'none',
                    flexWrap: 'wrap',
                    padding: '6px 0',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: 99, flex: '0 0 auto', background: m.status === 'live' ? 'var(--status-delivered-fg)' : 'transparent' }} />
                  <Mono size={11.5} weight={700} color="var(--text-primary)">
                    {matchCode(m)}
                  </Mono>
                  <Mono size={11} color="var(--text-muted)">
                    {ev ? t('tournament.kindShort.' + ev.kind) : ''}
                  </Mono>
                  <span style={{
                    flex: '1 1 140px',
                    minWidth: 0,
                    font: '500 12.5px/1.3 var(--font-sans)',
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {teamName(tour, db, m.teamAId)} – {teamName(tour, db, m.teamBId)}
                  </span>
                  {canEdit && onScore && (
                    <Button size="sm" variant="secondary" onClick={() => onScore(m)}>{t('tournament.module.enterScore')}</Button>
                  )}
                  <Button size="sm" variant="ghost" iconAfter="arrow-right" onClick={() => onOpenBracket(m.eventId)}>
                    {t('tournament.overview.open')}
                  </Button>
                </div>
              )
            })}
          </Card>
        )}

        {/* Khối Checklist Chuẩn Bị (Trước khi bắt đầu) */}
        <Card title={t('tournament.check.title')} icon="clipboard-check" padding="6px 16px 10px">
          {list.map((c, i) => (
            <div key={c.key} style={{
              display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
              borderTop: i ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: 99, display: 'grid', placeItems: 'center', flex: '0 0 auto',
                background: c.done ? 'var(--status-delivered-bg)' : 'var(--surface-inset)',
                color: c.done ? 'var(--status-delivered-fg)' : 'var(--text-muted)',
                border: c.done ? 'none' : '1px dashed var(--border-default)',
              }}>
                {c.done && <Icon name="check" size={12} />}
              </span>
              <span style={{
                flex: 1, font: '500 12.5px/1.3 var(--font-sans)',
                color: c.done ? 'var(--text-muted)' : 'var(--text-primary)',
              }}>
                {label(c)}
              </span>
              {!c.done && canEdit && c.tab !== 'overview' && (
                <Button size="sm" variant="ghost" onClick={() => onGo(c.tab)}>
                  {t('tournament.check.go')}
                </Button>
              )}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

/**
 * Nhánh loại trực tiếp thu nhỏ trong Tổng quan (handoff "BK1 · chờ vòng bảng", "Nhất A", "Thắng BK1").
 * Đã sinh lịch: đội thật từ trận. Chưa: xem trước bằng `koPreviewOf` (cùng hàm canvas dùng — khớp lịch sẽ sinh).
 */
function MiniBracket({ tour, db, stage, stages, onOpen }) {
  const live = stage.status !== 'pending'
  const source = stages.find((s) => s.seq === 1)
  const link = (tour.stageLinks || []).find((l) => l.toStageId === stage.id)
  const ev = tour.events.find((e) => e.id === stage.eventId)
  const n = ev ? estimateOf(tour, ev).teams : 0
  const slot = (x) => {
    if (x.kind === 'slot') {
      const r = Number(x.label.slice(1))
      return t('tournament.overview.rankSlot', { rank: r <= 4 ? t('tournament.overview.rankName.' + r) : t('tournament.flow.rank', { n: r }), g: x.label[0] })
    }
    if (x.kind === 'seed') return t('tournament.canvas.seed', { n: x.n })
    if (x.kind === 'winner') return t('tournament.canvas.won', { n: x.no })
    if (x.kind === 'loser') return t('tournament.canvas.lost', { n: x.no })
    return t('tournament.canvas.bye')
  }
  // Cột: [{ title, cells: [{ a, b, code, m (trận thật, null nếu còn là xem trước) }] }]
  let cols = []
  if (live) {
    const view = koRounds(tour.matches, stage.id)
    const codeOf = new Map(tour.matches.filter((m) => m.stageId === stage.id).map((m) => [m.id, matchCode(m)]))
    const side = (m, s) => {
      const id = s === 'A' ? m.teamAId : m.teamBId
      if (id) return teamName(tour, db, id)
      const src = s === 'A' ? m.sourceA : m.sourceB
      if (src?.kind === 'winner') return t('tournament.canvas.won', { n: codeOf.get(src.match) || '' })
      if (src?.kind === 'loser') return t('tournament.canvas.lost', { n: codeOf.get(src.match) || '' })
      return src?.kind === 'bye' ? t('tournament.canvas.bye') : t('tournament.bracket.tbd')
    }
    const cellOf = (m) => ({ a: side(m, 'A'), b: side(m, 'B'), code: matchCode(m), m })
    cols = view.rounds.map((r) => ({ title: t('tournament.round.' + r.kind), cells: r.matches.filter((m) => m.status !== 'bye').map(cellOf) }))
    if (view.third) cols.push({ title: t('tournament.round.third'), cells: [cellOf(view.third)] })
  } else {
    const pv = koPreviewOf(stage, source, link, n) || []
    cols = pv.map((r) => ({ title: t('tournament.round.' + r.roundKind), cells: r.matches.map((m) => ({ a: slot(m.a), b: slot(m.b), code: '#' + m.no, m: null })) }))
  }
  if (!cols.length) return null
  return (
    <Card title={stageName(stage, stages)} icon="split" padding="12px 16px 14px"
      actions={live && <Button size="sm" variant="secondary" iconAfter="arrow-right" onClick={onOpen}>{t('tournament.overview.openBracketBtn')}</Button>}>
      {!live && <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', paddingBottom: 8 }}>{t('tournament.overview.miniWait')}</div>}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {cols.map((c, ci) => (
          <div key={ci} style={{ display: 'grid', alignContent: 'space-around', gap: 8, minWidth: 158, flex: '0 0 auto' }}>
            <Mono size={10.5} weight={700} color="var(--text-primary)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
              {c.title}
            </Mono>
            {c.cells.map((cell, i) => {
              const done = cell.m && hasResult(cell.m)
              return (
                <div key={i} style={{
                  display: 'grid', gap: 3, padding: '6px 8px', borderRadius: 8,
                  background: done ? 'var(--surface-accent-soft)' : 'var(--surface-inset)',
                  border: `1px solid ${done ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                }}>
                  <Mono size={9.5} color="var(--text-muted)">{cell.code}</Mono>
                  {['A', 'B'].map((s) => {
                    const name = s === 'A' ? cell.a : cell.b
                    const won = done && cell.m.winner === s
                    return (
                      <span key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, minWidth: 0 }}>
                        <TeamNameLines name={name} fontSize={11.5} weight={won ? 700 : 500} color={won ? 'var(--text-primary)' : 'var(--text-secondary)'} />
                        {done && (
                          <Mono size={10} weight={won ? 700 : 500} color={won ? 'var(--status-transit-fg)' : 'var(--text-muted)'} style={{ flex: '0 0 auto' }}>
                            {sideScores(cell.m.sets, s).join(' ')}
                          </Mono>
                        )}
                      </span>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Card>
  )
}
