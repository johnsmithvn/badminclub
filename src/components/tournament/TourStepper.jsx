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
                flex: '0 0 auto',
                cursor: 'pointer',
                textAlign: 'left',
                minHeight: isMobile ? 54 : 52,
                padding: '9px 16px 9px 12px',
                borderRadius: 10,
                color: 'inherit',
                background: on ? 'var(--surface-accent-soft)' : 'var(--surface-card)',
                border: `1px solid ${on ? 'var(--teal-500)' : 'var(--border-subtle)'}`,
                boxShadow: on ? '0 0 0 1px var(--teal-500), var(--shadow-xs)' : 'var(--shadow-xs)',
                transition: 'all var(--dur-fast) var(--ease-standard)',
              }}
            >
              <span style={{
                width: 26,
                height: 26,
                borderRadius: 7,
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 auto',
                font: '700 11px/1 var(--font-mono)',
                background: on
                  ? 'var(--action-accent-bg)'
                  : (isCheck ? 'var(--status-delivered-bg)' : 'var(--surface-inset)'),
                color: on
                  ? 'var(--action-accent-fg)'
                  : (isCheck ? 'var(--status-delivered-fg)' : 'var(--text-muted)'),
                border: `1px solid ${on ? 'transparent' : 'var(--border-default)'}`,
              }}>
                {isCheck ? '✓' : t('tournament.tabNo.' + it.key)}
              </span>
              <span style={{ display: 'grid', gap: 3 }}>
                <span style={{
                  font: `${on ? 700 : 600} 13.5px/1.2 var(--font-sans)`,
                  whiteSpace: 'nowrap',
                  color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {t('tournament.tab.' + it.key)}
                </span>
                <span style={{ font: '400 11.5px/1 var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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
