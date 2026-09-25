import { Button, Card, Icon } from '#ds'
import { Mono } from '#ui'
import { hubChecklist } from '#lib/tournament/hub.js'
import { progressOf, queueOf } from '#lib/tournament/bracketView.js'
import { t } from '#i18n'
import { matchCode, teamName } from './tourUtils.js'

/**
 * Tổng quan (handoff): khi đã có lịch → trận đang đánh + kế tiếp của CẢ giải (mọi nội dung); luôn có khối
 * "Trước khi bắt đầu" (`ovDraft`): việc nào xong, việc nào thiếu, mỗi dòng một nút tới đúng tab xử lý.
 */
export default function OverviewTab({ tour, db, onGo, canEdit, onOpenBracket }) {
  const list = hubChecklist(tour)
  const label = (c) => (!c.done && c.n ? t('tournament.check.' + c.key + 'Left', { n: c.n }) : t('tournament.check.' + c.key))
  const queue = queueOf(tour.matches)
  const prog = progressOf(tour.matches)
  const live = queue.filter((m) => m.status === 'live')
  const next = queue.filter((m) => m.status !== 'live').slice(0, 5)

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
