import { TabTrack } from '#ui'
import { t } from '#i18n'

/**
 * Stepper của Hub (handoff: `tabs` — ô số TQ / i / 1…, nhãn, dòng trạng thái phụ).
 * @param {Array<{ key: string, sub: string }>} items
 */
export default function TourStepper({ items, value, onChange, isMobile }) {
  return (
    <TabTrack>
      <div role="tablist" style={{ display: 'flex', gap: 8 }}>
        {items.map((it) => {
          const on = it.key === value
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(it.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', cursor: 'pointer', textAlign: 'left',
                minHeight: isMobile ? 52 : 50, padding: '8px 14px 8px 10px', borderRadius: 9, color: 'inherit',
                background: on ? 'var(--surface-card)' : 'transparent',
                border: `1px solid ${on ? 'var(--border-default)' : 'transparent'}`,
                boxShadow: on ? 'var(--shadow-xs)' : 'none',
                transition: 'background var(--dur-base) var(--ease-standard)',
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', flex: '0 0 auto',
                font: '700 11px/1 var(--font-mono)',
                background: on ? 'var(--action-accent-bg)' : 'var(--surface-inset)',
                color: on ? 'var(--action-accent-fg)' : 'var(--text-muted)',
                border: `1px solid ${on ? 'transparent' : 'var(--border-default)'}`,
              }}>
                {t('tournament.tabNo.' + it.key)}
              </span>
              <span style={{ display: 'grid', gap: 4 }}>
                <span style={{
                  font: `${on ? 700 : 600} 13px/1 var(--font-sans)`, whiteSpace: 'nowrap',
                  color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {t('tournament.tab.' + it.key)}
                </span>
                <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{it.sub}</span>
              </span>
            </button>
          )
        })}
      </div>
    </TabTrack>
  )
}
