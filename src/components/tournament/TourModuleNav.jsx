import { Button, Select } from '#ds'
import { TabTrack } from '#ui'
import { dd } from '#utils/dates.js'
import { t } from '#i18n'

/**
 * Thanh module của giải (handoff `GiaiDauNav`): tên giải + meta · bước ① Tổng quan & đăng ký → ② Sơ đồ → ③ Nhánh đấu ·
 * số trận đang đánh · chọn nội dung (ở trang nhánh) · nút "Nhập tỷ số" (chỉ khi trang truyền `onScore` — người có quyền).
 * "Link đăng ký", "Màn hình trình chiếu" của handoff chưa có tính năng → không hiện,
 * không để nút chết (plan §6.1).
 * @param {object} [tour]  giải — có thì hiện tên + meta + số trận đang đánh
 * @param {Array<{ id: string, kind: string }>} events  nội dung ĐÃ có lịch (vào được nhánh)
 */
export default function TourModuleNav({ tour, active = 'hub', events = [], eventId, onHub, onFlow, onBracket, onScore, isMobile }) {
  const liveCount = (tour?.matches || []).filter((m) => m.status === 'live').length
  const courts = tour?.courtLabels?.length || 0
  const subMeta = tour ? [
    tour.startsOn ? dd(tour.startsOn) : null,
    tour.events.length ? t('tournament.module.eventsN', { n: tour.events.length }) : null,
    courts ? t('tournament.hero.courts', { n: courts }) : null,
  ].filter(Boolean).join(' · ') : ''

  const steps = [
    { key: 'hub', label: t('tournament.module.hub'), onClick: onHub, off: false },
    // Sơ đồ có nghĩa khi đã chọn thể thức cho ít nhất một nội dung.
    { key: 'flow', label: t('tournament.module.flow'), onClick: onFlow, off: !onFlow || !tour?.stages?.length },
    { key: 'bracket', label: t('tournament.module.bracket'), onClick: () => onBracket(eventId || events[0]?.id), off: events.length === 0 },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap',
      padding: isMobile ? '8px 12px' : '0 20px', minHeight: 52, background: 'var(--surface-nav)',
      borderBottom: '1px solid var(--border-nav)', position: 'relative', zIndex: 10,
      margin: isMobile ? '-14px -14px 14px' : '-20px -22px 16px',
    }}>
      <style>{`
        @keyframes tourLivePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.75); }
        }
      `}</style>

      {tour && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
          <span style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center',
            background: 'var(--teal-500)', color: 'var(--action-accent-fg)', font: '700 11px/1 var(--font-display)',
          }}>
            {t('tournament.module.badge')}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ font: '700 14px/1.2 var(--font-display)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tour.name}
            </span>
            {subMeta && <span style={{ font: '400 10.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{subMeta}</span>}
          </span>
        </div>
      )}

      {!isMobile && <span style={{ width: 1, height: 24, background: 'var(--border-subtle)', flexShrink: 0 }} />}

      <nav style={{
        display: 'flex', alignItems: 'stretch', height: isMobile ? 'auto' : 52, gap: 4,
        overflowX: 'auto', flex: isMobile ? '1 1 100%' : '1 1 auto', minWidth: 0,
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
                display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '8px 10px' : '0 12px',
                border: 'none', background: 'transparent', cursor: on || s.off ? 'default' : 'pointer',
                opacity: s.off ? 0.4 : 1, whiteSpace: 'nowrap',
                font: '600 13px/1 var(--font-sans)', color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: isMobile ? 'none' : `2px solid ${on ? 'var(--teal-500)' : 'transparent'}`,
                marginBottom: isMobile ? 0 : -1,
                transition: 'color var(--dur-fast), border-color var(--dur-fast)',
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center',
                font: '700 10.5px/1 var(--font-mono)',
                background: on ? 'var(--teal-500)' : 'var(--surface-raised)',
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 'auto' }}>
        {liveCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 12px/1 var(--font-sans)', color: 'var(--status-delivered-fg)', whiteSpace: 'nowrap' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--status-delivered-fg)',
              animation: 'tourLivePulse 1.8s infinite ease-in-out',
            }} />
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
            containerStyle={{ minWidth: 130 }}
          />
        )}
        {onScore && (
          <Button size="sm" variant="primary" icon="pencil" onClick={onScore}>
            {t('tournament.module.enterScore')}
          </Button>
        )}
      </div>
    </div>
  )
}

