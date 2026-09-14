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

      {/* Card: có animated border đuổi nhau (Cyan #45f3ff & Pink #ff2770) hoặc không */}
      {animated && (
        <style>{`
          @keyframes auth-border-spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .auth-beam {
            position: absolute;
            top: -50%;
            left: -50%;
            width: 100%;
            height: 100%;
            transform-origin: bottom right;
            animation: auth-border-spin 6s linear infinite;
            pointer-events: none;
            z-index: 0;
          }
          .auth-beam-cyan-1 {
            background: linear-gradient(0deg, transparent, transparent, #45f3ff, #45f3ff, #45f3ff);
            animation-delay: 0s;
          }
          .auth-beam-pink-1 {
            background: linear-gradient(0deg, transparent, transparent, #ff2770, #ff2770, #ff2770);
            animation-delay: -1.5s;
          }
          .auth-beam-cyan-2 {
            background: linear-gradient(0deg, transparent, transparent, #45f3ff, #45f3ff, #45f3ff);
            animation-delay: -3s;
          }
          .auth-beam-pink-2 {
            background: linear-gradient(0deg, transparent, transparent, #ff2770, #ff2770, #ff2770);
            animation-delay: -4.5s;
          }
        `}</style>
      )}
      <div style={animated ? S.borderOuter : { width: '100%', maxWidth: 460 }}>
        {animated && (
          <>
            <div className="auth-beam auth-beam-cyan-1" />
            <div className="auth-beam auth-beam-pink-1" />
            <div className="auth-beam auth-beam-cyan-2" />
            <div className="auth-beam auth-beam-pink-2" />
          </>
        )}
        <div style={animated ? { ...S.card, maxWidth: '100%', position: 'relative', zIndex: 1, border: 'none' } : S.card}>
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
    width: '100%', maxWidth: 460, background: '#191925', borderRadius: 12,
    padding: '28px 30px', boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  // Animated border chasing effect
  borderOuter: {
    position: 'relative',
    width: '100%',
    maxWidth: 460,
    borderRadius: 14,
    padding: 3,
    overflow: 'hidden',
    background: '#151522',
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
