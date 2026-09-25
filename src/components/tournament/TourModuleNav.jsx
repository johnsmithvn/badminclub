import { Button, Select } from '#ds'
import { TabTrack } from '#ui'
import { dd } from '#utils/dates.js'
import { t } from '#i18n'

/**
 * Thanh module của giải (handoff `GiaiDauNav`): tên giải + meta · bước ① Tổng quan & đăng ký → ② Nhánh đấu ·
 * số trận đang đánh · chọn nội dung (ở trang nhánh) · nút "Nhập tỷ số" (chỉ khi trang truyền `onScore` — người có quyền).
 * "Sơ đồ thi đấu", "Link đăng ký", "Màn hình trình chiếu" của handoff chưa có tính năng (Phase 6) → không hiện,
 * không để nút chết (plan §6.1).
 * @param {object} [tour]  giải — có thì hiện tên + meta + số trận đang đánh
 * @param {Array<{ id: string, kind: string }>} events  nội dung ĐÃ có lịch (vào được nhánh)
 */
export default function TourModuleNav({ tour, active = 'hub', events = [], eventId, onHub, onBracket, onScore, isMobile }) {
  const liveCount = (tour?.matches || []).filter((m) => m.status === 'live').length
  const courts = tour?.courtLabels?.length || 0
  const subMeta = tour ? [
    tour.startsOn ? dd(tour.startsOn) : null,
    tour.events.length ? t('tournament.module.eventsN', { n: tour.events.length }) : null,
    courts ? t('tournament.hero.courts', { n: courts }) : null,
  ].filter(Boolean).join(' · ') : ''

  const steps = [
    { key: 'hub', label: t('tournament.module.hub'), onClick: onHub, off: false },
    { key: 'bracket', label: t('tournament.module.bracket'), onClick: () => onBracket(eventId || events[0]?.id), off: events.length === 0 },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: isMobile ? 'wrap' : 'nowrap',
      padding: '8px 16px', minHeight: 56, borderRadius: 12, background: 'var(--surface-nav)', border: '1px solid var(--border-nav)',
    }}>
      {tour && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: 'var(--action-accent-bg)', color: 'var(--action-accent-fg)', font: '700 12px/1 var(--font-mono)', letterSpacing: '0.05em',
          }}>
            {t('tournament.module.badge')}
          </span>
          <span style={{ display: 'grid', gap: 3, minWidth: 0 }}>
            <span style={{ font: '700 14px/1.2 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tour.name}
            </span>
            {subMeta && <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{subMeta}</span>}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: tour ? 'center' : 'flex-start', flex: '1 1 auto', minWidth: 0 }}>
        <TabTrack>
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: 3, borderRadius: 10,
            background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)',
          }}>
            {steps.map((s, i) => {
              const on = s.key === active
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={s.off}
                  aria-current={on ? 'page' : undefined}
                  onClick={on ? undefined : s.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 7, whiteSpace: 'nowrap',
                    border: `1px solid ${on ? 'var(--teal-500)' : 'transparent'}`,
                    background: on ? 'var(--surface-accent-soft)' : 'transparent',
                    cursor: on || s.off ? 'default' : 'pointer', opacity: s.off ? 0.45 : 1,
                    font: '600 12.5px/1 var(--font-sans)', color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'background var(--dur-fast), border-color var(--dur-fast)',
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', display: 'grid', placeItems: 'center', font: '700 10px/1 var(--font-mono)',
                    background: on ? 'var(--action-accent-bg)' : 'transparent',
                    color: on ? 'var(--action-accent-fg)' : 'var(--text-muted)',
                    border: on ? 'none' : '1px solid var(--border-default)',
                  }}>
                    {i + 1}
                  </span>
                  {s.label}
                </button>
              )
            })}
          </nav>
        </TabTrack>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        {liveCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--font-sans)', color: 'var(--status-delivered-fg)', whiteSpace: 'nowrap' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--status-delivered-fg)' }} />
            {t('tournament.module.liveCount', { n: liveCount })}
          </span>
        )}
        {active === 'bracket' && events.length > 1 && (
          <Select
            size="sm"
            aria-label={t('tournament.bracket.pickEvent')}
            value={eventId}
            onChange={(e) => onBracket(e.target.value)}
            options={events.map((ev) => ({ value: ev.id, label: t('tournament.kind.' + ev.kind) }))}
            containerStyle={{ minWidth: 150, width: isMobile ? '100%' : undefined }}
          />
        )}
        {onScore && <Button size="sm" icon="pencil" onClick={onScore}>{t('tournament.module.enterScore')}</Button>}
      </div>
    </div>
  )
}
