import { useState } from 'react'
import { Button, Card, Icon } from '#ds'
import { Mono } from '#ui'
import { hubChecklist } from '#lib/tournament/hub.js'
import { progressOf, queueOf } from '#lib/tournament/bracketView.js'
import { groupStandings, orderedRows, stageGroups, swapUpInTie } from '#lib/tournament/standings.js'
import { t } from '#i18n'
import { matchCode, teamName } from './tourUtils.js'

/**
 * Tổng quan (handoff): khi đã có lịch → trận đang đánh + kế tiếp của CẢ giải (mọi nội dung); luôn có khối
 * "Trước khi bắt đầu" (`ovDraft`): việc nào xong, việc nào thiếu, mỗi dòng một nút tới đúng tab xử lý.
 * Phase 4: hiển thị Bảng xếp hạng vòng bảng (dạng lưới 2 cột) + nút Chốt giai đoạn / Tạo nhánh Knockout.
 */
export default function OverviewTab({ tour, db, a, event, onGo, canEdit, onOpenBracket, isMobile }) {
  const list = hubChecklist(tour)
  const label = (c) => (!c.done && c.n ? t('tournament.check.' + c.key + 'Left', { n: c.n }) : t('tournament.check.' + c.key))
  const queue = queueOf(tour.matches)
  const prog = progressOf(tour.matches)
  const live = queue.filter((m) => m.status === 'live')
  const next = queue.filter((m) => m.status !== 'live').slice(0, 5)

  // Thứ tự BTC tự xếp cho các đội hoà (bốc thăm / chọn tay), theo bảng: { [groupId]: teamId[] }. Chỉ trên máy
  // này tới lúc bấm "Chốt giai đoạn" — lúc đó mới ghi `final_rank`.
  const [manual, setManual] = useState({})

  // Giai đoạn vòng bảng
  const rrStages = (tour.stages || [])
    .filter((s) => s.type === 'round_robin' && (!event || s.eventId === event.id))
    .sort((x, y) => x.seq - y.seq)

  // Đã chốt: hiện đúng thứ hạng đã ghi (`final_rank`), không tính lại — plan §2.1.
  const rowsOf = (stage, g, st) => (stage.status === 'done'
    ? orderedRows(st.rows, [...g.teams].sort((x, y) => (x.finalRank ?? 99) - (y.finalRank ?? 99)).map((x) => x.teamId))
    : orderedRows(st.rows, manual[g.id]))

  const handleCloseStage = (stage, groups) => {
    if (!a?.tourCloseStage) return
    const ranks = groups.flatMap((g) => rowsOf(stage, g, groupStandings(g, tour.matches))
      .map((r) => ({ groupId: g.id, teamId: r.teamId, finalRank: r.rank })))
    a.tourCloseStage(stage.id, ranks)
  }

  return (
    <>
      {tour.matches.length > 0 && (
        <Card title={t('tournament.overview.live')} icon="calendar-clock" padding="6px 18px 10px"
          subtitle={t('tournament.bracket.progressVal', prog)}>
          {queue.length === 0 && <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)', padding: '10px 0' }}>{t('tournament.overview.noneOpen')}</div>}
          {[...live, ...next].map((m, i) => {
            const ev = tour.events.find((e) => e.id === m.eventId)
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48, borderTop: i ? '1px solid var(--border-subtle)' : 'none', flexWrap: 'wrap' }}>
                {m.status === 'live'
                  ? <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--teal-500)', flex: '0 0 auto' }} />
                  : <span style={{ width: 8, flex: '0 0 auto' }} />}
                <Mono size={11.5} weight={700} color="var(--text-primary)" style={{ minWidth: 40 }}>{matchCode(m)}</Mono>
                <Mono size={11} color="var(--text-muted)">{ev ? t('tournament.kindShort.' + ev.kind) : ''}</Mono>
                <span style={{ flex: '1 1 180px', minWidth: 0, font: '500 13px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>
                  {teamName(tour, db, m.teamAId)} – {teamName(tour, db, m.teamBId)}
                </span>
                {m.courtLabel && <Mono size={11} color="var(--text-secondary)">{m.courtLabel}</Mono>}
                <Button size="sm" variant="ghost" iconAfter="arrow-right" onClick={() => onOpenBracket(m.eventId)}>{t('tournament.overview.open')}</Button>
              </div>
            )
          })}
        </Card>
      )}

      {rrStages.map((stage) => {
        const groups = stageGroups(tour, stage.id)
        if (!groups.length) return null
        const targets = targetStagesOf(tour, stage)
        const advancePerGroup = targets.length ? stage.config?.advancePerGroup || 2 : 0
        const ev = (tour.events || []).find((e) => e.id === stage.eventId)
        const allFinished = groups.every((g) => groupStandings(g, tour.matches).isFinished)

        return (
          <Card
            key={stage.id}
            title={t('tournament.standings.title') + (ev ? ` · ${t('tournament.kind.' + ev.kind)}` : '')}
            icon="trophy"
            padding="12px 18px 14px"
          >
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {groups.map((g) => {
                const st = groupStandings(g, tour.matches)
                const rows = rowsOf(stage, g, st)
                const canReorder = canEdit && stage.status === 'running' && st.isFinished
                const remaining = st.matchesCount.total - st.matchesCount.done
                return (
                  <div key={g.id} style={{ display: 'grid', gap: 8, background: 'var(--surface-inset)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ font: '700 13.5px/1.2 var(--font-sans)', color: 'var(--text-primary)' }}>
                        {t('tournament.standings.groupTitle', { label: g.label })}
                      </span>
                      <Mono size={11} color="var(--text-muted)">
                        {remaining > 0 ? t('tournament.standings.remaining', { n: remaining, k: advancePerGroup }) : t('tournament.standings.finished')}
                      </Mono>
                    </div>

                    {st.ties.length > 0 && stage.status !== 'done' && (
                      <div style={{ font: 'var(--type-caption)', color: 'var(--status-delayed-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="alert-circle" size={13} />
                        <span>{t(canReorder ? 'tournament.standings.tieReorder' : 'tournament.standings.tieNotice')}</span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '600 11px/1 var(--font-sans)', color: 'var(--text-muted)', padding: '0 4px 4px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ width: 20, textAlign: 'center' }}>{t('tournament.standings.rank')}</span>
                        <span style={{ flex: 1 }}>{t('tournament.standings.team')}</span>
                        <span style={{ width: 22, textAlign: 'center' }}>{t('tournament.standings.played')}</span>
                        <span style={{ width: 22, textAlign: 'center' }}>{t('tournament.standings.won')}</span>
                        <span style={{ width: 22, textAlign: 'center' }}>{t('tournament.standings.lost')}</span>
                        <span style={{ width: 34, textAlign: 'right' }}>{t('tournament.standings.diff')}</span>
                      </div>
                      {rows.map((r) => {
                        const advances = r.rank <= advancePerGroup
                        const up = canReorder && swapUpInTie(rows, st.ties, r.teamId)
                        return (
                          <div
                            key={r.teamId}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, minHeight: 30, padding: '2px 4px',
                              borderRadius: 4,
                              background: advances ? 'var(--surface-accent-soft)' : 'transparent',
                              borderLeft: advances ? '3px solid var(--teal-500)' : '3px solid transparent',
                            }}
                          >
                            <Mono size={11.5} weight={advances ? 700 : 500} color={advances ? 'var(--teal-500)' : 'var(--text-muted)'} style={{ width: 20, textAlign: 'center' }}>
                              {r.rank}
                            </Mono>
                            <span style={{ flex: 1, font: advances ? '600 12.5px/1.2 var(--font-sans)' : '500 12.5px/1.2 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {teamName(tour, db, r.teamId)}
                            </span>
                            {up && (
                              <button type="button" aria-label={t('tournament.standings.moveUp')} title={t('tournament.standings.moveUp')}
                                onClick={() => setManual((x) => ({ ...x, [g.id]: up }))}
                                style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-default)', background: 'var(--surface-raised)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <Icon name="chevron-up" size={12} />
                              </button>
                            )}
                            <Mono size={11} color="var(--text-secondary)" style={{ width: 22, textAlign: 'center' }}>{r.played}</Mono>
                            <Mono size={11} weight={600} color="var(--status-delivered-fg)" style={{ width: 22, textAlign: 'center' }}>{r.won}</Mono>
                            <Mono size={11} color="var(--status-incident-fg)" style={{ width: 22, textAlign: 'center' }}>{r.lost}</Mono>
                            <Mono size={11} color="var(--text-secondary)" style={{ width: 34, textAlign: 'right' }}>{r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</Mono>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
              {stage.status === 'running' && (
                <>
                  {allFinished ? (
                    canEdit && (
                      <Button icon="circle-check" onClick={() => handleCloseStage(stage, groups)}>
                        {t('tournament.standings.closeStage')}
                      </Button>
                    )
                  ) : (
                    <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                      {t('tournament.standings.closeStageHint')}
                    </span>
                  )}
                </>
              )}
              {stage.status === 'done' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ font: '600 12.5px/1 var(--font-sans)', color: 'var(--status-delivered-fg)' }}>
                    ✓ {t('tournament.standings.closed')}
                  </span>
                  {canEdit && targets.filter((x) => x.status === 'pending').map((x) => (
                    <Button key={x.id} icon="calendar-plus" onClick={() => a?.tourGenerate(stage.eventId, x.seq)}>
                      {t('tournament.standings.generateStage', { name: t(targets.length > 1 ? (x.seq === 2 ? 'tournament.stage.main' : 'tournament.stage.plate') : 'tournament.format.koStage') })}
                    </Button>
                  ))}
                  {targets.some((x) => x.status !== 'pending') && (
                    <Button variant="secondary" iconAfter="arrow-right" onClick={() => onOpenBracket(stage.eventId)}>
                      {t('tournament.standings.openBracket')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        )
      })}

      <Card title={t('tournament.check.title')} icon="clipboard-check" padding="6px 18px 10px">
        {list.map((c, i) => (
          <div key={c.key} style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 52,
            borderTop: i ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 99, display: 'grid', placeItems: 'center', flex: '0 0 auto',
              background: c.done ? 'var(--status-delivered-bg)' : 'var(--surface-inset)',
              color: c.done ? 'var(--status-delivered-fg)' : 'var(--text-muted)',
              border: c.done ? 'none' : '1px dashed var(--border-default)',
            }}>
              {c.done && <Icon name="check" size={14} />}
            </span>
            <span style={{
              flex: 1, font: '500 13.5px/1.35 var(--font-sans)',
              color: c.done ? 'var(--text-muted)' : 'var(--text-primary)',
            }}>
              {label(c)}
            </span>
            {!c.done && canEdit && c.tab !== 'overview' && (
              <Button size="sm" variant="secondary" iconAfter="chevron-right" onClick={() => onGo(c.tab)}>
                {t('tournament.check.go')}
              </Button>
            )}
          </div>
        ))}
      </Card>
    </>
  )
}

/** Các giai đoạn nhận đội từ vòng bảng qua link (nhánh chính, nhánh phụ), theo seq; rỗng = vòng tròn kết thúc ở đây. */
function targetStagesOf(tour, stage) {
  const to = new Set((tour.stageLinks || []).filter((l) => l.fromStageId === stage.id).map((l) => l.toStageId))
  return (tour.stages || []).filter((s) => to.has(s.id)).sort((x, y) => x.seq - y.seq)
}
