// Nút chọn nhỏ trong các thẻ trang Thống kê cá nhân — một chỗ cho 6 bản chép cũ.
// box: Mùa giải / Elo (Quanh bạn · Mục tiêu đối thủ · Đua mùa) · pill: Tất cả / Nam / Nữ (Đối thủ · Cặp ăn ý).
const VARIANTS = {
  box: {
    wrap: {
      display: 'inline-flex',
      padding: 2,
      borderRadius: 8,
      background: 'var(--surface-inset)',
      border: '1px solid var(--border-subtle)',
      gap: 2,
    },
    btn: {
      background: 'none',
      border: 'none',
      padding: '3px 8px',
      borderRadius: 6,
      font: '600 11px/1 var(--font-sans)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    },
    on: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      padding: '3px 8px',
      borderRadius: 6,
      font: '600 11px/1 var(--font-sans)',
      color: 'var(--text-primary)',
      boxShadow: 'var(--shadow-sm)',
      cursor: 'default',
    },
  },
  pill: {
    wrap: {
      display: 'inline-flex',
      padding: 2,
      borderRadius: 999,
      background: 'var(--surface-inset)',
      border: '1px solid var(--border-subtle)',
      gap: 1.5,
      flexShrink: 0,
    },
    btn: {
      background: 'none',
      border: 'none',
      padding: '3px 7px',
      borderRadius: 999,
      font: '600 11px/1 var(--font-sans)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.15s ease',
      minHeight: 26,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    on: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-default)',
      padding: '3px 7px',
      borderRadius: 999,
      font: '600 11px/1 var(--font-sans)',
      color: 'var(--text-primary)',
      boxShadow: 'var(--shadow-sm)',
      cursor: 'default',
      whiteSpace: 'nowrap',
      minHeight: 26,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
}

/** `options` = [[key, nhãn], ...]; nút có key === `value` là nút đang chọn. */
export default function SegToggle({ variant = 'box', options, value, onChange }) {
  const v = VARIANTS[variant]
  return (
    <div style={v.wrap}>
      {options.map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)} style={value === key ? v.on : v.btn}>
          {label}
        </button>
      ))}
    </div>
  )
}
