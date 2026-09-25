import { Select } from '#ds'
import { TabTrack } from '#ui'
import { t } from '#i18n'

/**
 * Thanh module của giải (handoff `GiaiDauNav`): bước ① Tổng quan & đăng ký → ② Nhánh đấu, và chọn nội dung.
 * "Sơ đồ thi đấu" của handoff chưa có (Phase 6) nên không hiện — không để nút chết.
 * @param {Array<{ id: string, kind: string }>} events nội dung đã có lịch thi đấu (vào được nhánh)
 */
export default function TourModuleNav({ active, events, eventId, onHub, onBracket, isMobile }) {
  const steps = [
    { key: 'hub', label: t('tournament.module.hub'), onClick: onHub, off: false },
    { key: 'bracket', label: t('tournament.module.bracket'), onClick: () => onBracket(eventId || events[0]?.id), off: events.length === 0 },
  ]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap', padding: '0 14px', minHeight: 52,
      borderRadius: 10, background: 'var(--surface-nav)', border: '1px solid var(--border-nav)',
    }}>
      <TabTrack style={{ flex: '1 1 auto', alignSelf: 'stretch' }}>
        <nav style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
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
                  display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', minHeight: 50, whiteSpace: 'nowrap',
                  border: 'none', background: 'transparent', cursor: on || s.off ? 'default' : 'pointer', opacity: s.off ? 0.45 : 1,
                  font: '600 13px/1 var(--font-sans)', color: on ? 'var(--text-on-nav-active)' : 'var(--text-on-nav)',
                  borderBottom: `2px solid ${on ? 'var(--teal-500)' : 'transparent'}`,
                }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 5, display: 'grid', placeItems: 'center', font: '700 10.5px/1 var(--font-mono)',
                  background: on ? 'var(--action-accent-bg)' : 'var(--surface-nav-active)',
                  color: on ? 'var(--action-accent-fg)' : 'var(--text-on-nav)',
                }}>
                  {i + 1}
                </span>
                {s.label}
              </button>
            )
          })}
        </nav>
      </TabTrack>
      {active === 'bracket' && events.length > 1 && (
        <Select
          size="sm"
          aria-label={t('tournament.bracket.pickEvent')}
          value={eventId}
          onChange={(e) => onBracket(e.target.value)}
          options={events.map((ev) => ({ value: ev.id, label: t('tournament.kind.' + ev.kind) }))}
          containerStyle={{ width: isMobile ? '100%' : 180, paddingBottom: isMobile ? 10 : 0 }}
        />
      )}
    </div>
  )
}
