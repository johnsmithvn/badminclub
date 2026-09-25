// Mảnh nhỏ dùng chung của màn Giải đấu. Màu chỉ qua token (docs/TOURNAMENT_PLAN.md §6.1).

import { StatusPill } from '#ds'
import { t } from '#i18n'

// Trạng thái → màu pill của TDMS. Nháp xám, mở đăng ký xanh dương, đang diễn ra teal, xong xanh lá.
const TOUR_PILL = { draft: 'idle', registration: 'scheduled', running: 'transit', finished: 'delivered', cancelled: 'cancelled' }
const EVENT_PILL = { draft: 'scheduled', pairing: 'loading', drawn: 'assigned', running: 'transit', finished: 'delivered' }

export const TourPill = ({ status, size = 'sm' }) => (
  <StatusPill status={TOUR_PILL[status] || 'idle'} label={t('tournament.status.' + status)} size={size} />
)

export const EventPill = ({ status }) => (
  <StatusPill status={EVENT_PILL[status] || 'idle'} label={t('tournament.eventStatus.' + status)} size="sm" />
)

/** Ô mã nội dung (ĐN, ĐNN…) — cùng kiểu ô số của stepper trong handoff. */
export const KindCode = ({ kind, on }) => (
  <span style={{
    minWidth: 34, height: 34, padding: '0 6px', borderRadius: 8, display: 'grid', placeItems: 'center',
    font: '700 11.5px/1 var(--font-mono)', flex: '0 0 auto',
    background: on ? 'var(--action-accent-bg)' : 'var(--surface-inset)',
    color: on ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
    border: `1px solid ${on ? 'transparent' : 'var(--border-default)'}`,
  }}>
    {t('tournament.kindShort.' + kind)}
  </span>
)



/** Hàng nút chọn một (handoff: các hàng tuỳ chọn ở Thể thức, "Cách ghép" ở Ghép cặp). */
export function Seg({ options, value, onChange, disabled, size = 30 }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 3, borderRadius: 8, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => !on && onChange(o.key)}
            style={{
              height: size, padding: '0 11px', borderRadius: 6, border: 'none', whiteSpace: 'nowrap',
              cursor: disabled ? 'default' : 'pointer', font: `${on ? 700 : 600} 12px/1 var(--font-sans)`,
              background: on ? 'var(--action-accent-bg)' : 'transparent',
              color: on ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
              opacity: disabled && !on ? 0.55 : 1,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </span>
  )
}
