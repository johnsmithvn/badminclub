// Khung cho các trang ngoài app (đăng nhập, đăng ký): nền navy, thẻ trắng ở giữa.
// Khác AppLayout: không sidebar, không header CLB — lúc này chưa biết CLB nào.

import { Icon, IconButton } from '#ds'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { t } from '#i18n'

export default function AuthLayout({ title, sub, children, footer }) {
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

      <div style={S.brand}>
        <div style={S.logo}><Icon name="volleyball" size={22} /></div>
        <div>
          <div style={S.appName}>{t('auth.appName')}</div>
          <div style={S.tagline}>{t('auth.tagline')}</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display: 'grid', gap: 3, marginBottom: 18 }}>
          <h1 style={S.title}>{title}</h1>
          <span style={S.sub}>{sub}</span>
        </div>
        {children}
      </div>

      {footer && <div style={S.footer}>{footer}</div>}
    </div>
  )
}

const S = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 18, padding: '40px 20px',
    background: 'linear-gradient(160deg, var(--navy-800) 0%, var(--navy-700) 45%, var(--teal-800) 100%)',
    font: 'var(--type-body)', color: 'var(--text-primary)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12, color: '#fff' },
  logo: {
    width: 40, height: 40, flex: '0 0 auto', borderRadius: 10, background: 'var(--teal-500)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04302C',
  },
  appName: { font: '700 19px/1.15 var(--font-display)', letterSpacing: '-0.015em' },
  tagline: { font: 'var(--type-caption)', color: 'rgba(255,255,255,.72)' },
  card: {
    width: '100%', maxWidth: 460, background: 'var(--surface-card)', borderRadius: 14,
    padding: '24px 26px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-subtle)',
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
