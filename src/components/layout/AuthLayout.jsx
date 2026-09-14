// Khung cho các trang ngoài app (đăng nhập, đăng ký): nền navy, thẻ trắng ở giữa.
// Khác AppLayout: không sidebar, không header CLB — lúc này chưa biết CLB nào.

import { IconButton } from '#ds'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { t } from '#i18n'

export default function AuthLayout({ title, sub, children, footer, avatar, animated }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div style={S.page}>
      <div style={S.themeWrap}>
        <IconButton
          icon={isDark ? 'sun' : 'moon'}
          size="sm"
          variant="ghost"
          style={S.themeBtn}
          label={isDark ? t('common.themeLight') : t('common.themeDark')}
          onClick={toggleTheme}
        />
      </div>

      {/* Avatar nằm trên card — chỉ hiện khi được truyền vào */}
      {avatar}

      {/* Card: có animated border hoặc không */}
      {animated && (
        <style>{`
          @keyframes auth-border-spin {
            from { transform: translate(-50%, -50%) rotate(0deg); }
            to   { transform: translate(-50%, -50%) rotate(360deg); }
          }
        `}</style>
      )}
      <div style={animated ? S.borderOuter : { width: '100%', maxWidth: 460 }}>
        {animated && <div style={S.borderSpin} />}
        <div style={animated ? { ...S.card, maxWidth: '100%', position: 'relative', zIndex: 1 } : S.card}>
          {title && (
            <div style={{ display: 'grid', gap: 3, marginBottom: 18 }}>
              <h1 style={S.title}>{title}</h1>
              {sub && <span style={S.sub}>{sub}</span>}
            </div>
          )}
          {children}
        </div>
      </div>

      {footer && <div style={S.footer}>{footer}</div>}
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 18, padding: '40px 20px',
    background: 'linear-gradient(135deg, #0d0d18 0%, #11111f 60%, #0f111a 100%)',
    font: 'var(--type-body)', color: 'var(--text-primary)',
  },
  appName: {},
  tagline: {},
  brand: {},
  logo: {},
  card: {
    width: '100%', maxWidth: 460, background: '#191925', borderRadius: 14,
    padding: '28px 30px', boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  // Animated border
  borderOuter: {
    position: 'relative',
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    padding: 2,
    overflow: 'hidden',
  },
  borderSpin: {
    position: 'absolute',
    width: 700,
    height: 700,
    top: '50%',
    left: '50%',
    background: 'conic-gradient(from 0deg, #ff006a, #c026d3 25%, #0ea5e9 50%, #06d6a0 75%, #ff006a)',
    animation: 'auth-border-spin 5s linear infinite',
    zIndex: 0,
    borderRadius: '50%',
  },
  title: { font: 'var(--type-h2)', color: 'var(--text-primary)', margin: 0 },
  sub: { font: 'var(--type-caption)', color: 'var(--text-muted)' },
  footer: { font: 'var(--type-caption)', color: 'rgba(255,255,255,.75)', textAlign: 'center', maxWidth: 460 },
  themeWrap: { position: 'fixed', top: 16, right: 16, zIndex: 10 },
  themeBtn: {
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 6,
    color: '#fff',
  },
}
