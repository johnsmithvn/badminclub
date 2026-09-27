import { TabTrack } from '#ui'
import { t } from '#i18n'

/**
 * Stepper của Hub (handoff: `tabs` — ô số TQ / i / 1…, nhãn, dòng trạng thái phụ).
 * @param {Array<{ key: string, sub: string }>} items
 */
export default function TourStepper({ items, value, onChange, isMobile }) {
  return (
    <TabTrack>
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: 0,
          background: 'var(--surface-card)',
          borderRadius: 12,
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xs)',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        {items.map((it) => {
          const on = it.key === value
          const isCheck = Boolean(it.isDone)
          return (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange(it.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flex: isMobile ? '0 0 auto' : '1 1 0',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: 52,
                padding: '10px 16px',
                border: 'none',
                background: on ? 'var(--surface-accent-soft)' : 'transparent',
                borderBottom: `2px solid ${on ? 'var(--teal-500)' : 'transparent'}`,
                marginBottom: -1,
                transition: 'background var(--dur-fast), border-color var(--dur-fast)',
              }}
            >
              <span style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
                font: '700 11px/1 var(--font-mono)',
                background: on
                  ? 'var(--teal-500)'
                  : (isCheck ? 'var(--status-delivered-bg)' : 'var(--surface-sunken)'),
                color: on
                  ? 'var(--action-accent-fg)'
                  : (isCheck ? 'var(--status-delivered-fg)' : 'var(--text-muted)'),
                border: on ? 'none' : '1px solid var(--border-subtle)',
              }}>
                {isCheck ? '✓' : t('tournament.tabNo.' + it.key)}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{
                  font: `${on ? 700 : 600} 13px/1.2 var(--font-sans)`,
                  whiteSpace: 'nowrap',
                  color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {t('tournament.tab.' + it.key)}
                </span>
                <span style={{ font: '400 10.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {it.sub}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </TabTrack>
  )
}
