import { useState } from 'react'
import { Alert, Button, Dialog } from '#ds'
import { Mono } from '#ui'
import { PRIORITIES, recommend } from '#lib/tournament/recommend.js'
import { t } from '#i18n'
import { Seg } from './TourBits.jsx'

/**
 * Gợi ý thể thức cho cả giải (README handoff §5.7). BTC KHÔNG nhập gì: số đội, sân, giờ, luật đọc từ giải —
 * chỉ chọn một ưu tiên rồi "Áp dụng" một lần cho mọi nội dung chưa có lịch.
 */
export default function RecommendDialog({ tour, onClose, onApply }) {
  const [priority, setPriority] = useState('balanced')
  const [busy, setBusy] = useState(false)
  const res = recommend(tour, priority)
  const locked = new Set(tour.stages.filter((s) => s.status !== 'pending').map((s) => s.eventId))
  const todo = res.events.filter((e) => e.pick && !locked.has(e.eventId))

  const apply = async () => {
    setBusy(true)
    if (await onApply(todo)) onClose()
    else setBusy(false)
  }
  const label = (p) => [
    t('tournament.format.tpl.' + p.tpl),
    p.numGroups > 1 ? t('tournament.format.groupCount', { n: p.numGroups }) : null,
    p.advance ? t('tournament.recommend.take', { n: p.advance }) : null,
  ].filter(Boolean).join(' · ')

  return (
    <Dialog
      open
      width={560}
      title={t('tournament.recommend.title')}
      description={t('tournament.recommend.hint')}
      onClose={busy ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
          <Button loading={busy} disabled={!todo.length} onClick={apply}>{t('tournament.recommend.apply', { n: todo.length })}</Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <Seg options={PRIORITIES.map((k) => ({ key: k, label: t('tournament.recommend.priority.' + k) }))} value={priority} onChange={setPriority} />
          <span style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>{t('tournament.recommend.priorityHint.' + priority)}</span>
        </div>

        <div style={{ display: 'grid' }}>
          {res.events.map((e) => {
            const ev = tour.events.find((x) => x.id === e.eventId)
            return (
              <div key={e.eventId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 4, padding: '10px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ font: '600 13px/1.3 var(--font-sans)', color: 'var(--text-primary)' }}>
                  {t('tournament.kind.' + ev.kind)}
                  <Mono size={11} color="var(--text-muted)" style={{ marginLeft: 8 }}>
                    {t(e.estimated ? 'tournament.recommend.teamsEst' : 'tournament.recommend.teams', { n: e.n })}
                  </Mono>
                </span>
                {e.pick && <Mono size={11.5} color="var(--text-secondary)">{t('tournament.recommend.cost', { n: e.pick.matches, m: e.pick.minutes })}</Mono>}
                <span style={{ gridColumn: '1 / -1', font: 'var(--type-caption)', color: locked.has(e.eventId) ? 'var(--text-muted)' : 'var(--status-transit-fg)' }}>
                  {!e.pick ? t('tournament.recommend.none')
                    : locked.has(e.eventId) ? t('tournament.recommend.locked') : label(e.pick)}
                </span>
              </div>
            )
          })}
        </div>

        {res.capacity == null
          ? <Alert tone="info">{t('tournament.recommend.noWindow')}</Alert>
          : (
            <Alert tone={res.fits ? 'success' : 'warning'}>
              {t(res.fits ? 'tournament.recommend.fits' : 'tournament.recommend.over', { finish: res.finish, end: tour.endTime?.slice(0, 5) })}
            </Alert>
          )}
      </div>
    </Dialog>
  )
}
