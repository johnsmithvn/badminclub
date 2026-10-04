import { t } from '#i18n'

/**
 * Bộ lọc giới tính Tất cả / Nam / Nữ kèm số người — chung cho tab Elo sự nghiệp và tab Đua mùa.
 * `counts` = { all, nam, nu }. `allActiveBg`: màu nút Tất cả khi đang chọn ở chế độ sáng (mỗi tab một màu riêng).
 */
export default function GenderFilterTabs({ value, onChange, counts, isDark, allActiveBg }) {
  const options = [
    ['all', '', t('gender.all'), isDark ? 'var(--navy-700)' : allActiveBg, counts.all],
    ['nam', '♂ ', t('gender.nam'), '#1D50A0', counts.nam],
    ['nu', '♀ ', t('gender.nu'), '#D946EF', counts.nu],
  ]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: 3,
          gap: 2,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        {options.map(([key, icon, label, activeBg, count]) => {
          const on = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange && onChange(key)}
              style={{
                font: "600 12px/1 'IBM Plex Sans', sans-serif",
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: on ? activeBg : 'transparent',
                color: on ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: on ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{icon}{label}</span>
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "'IBM Plex Mono', monospace",
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: on ? 'rgba(255,255,255,.22)' : 'var(--surface-inset)',
                  color: on ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
