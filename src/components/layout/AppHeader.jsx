import { Button, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { pageOf } from '#routes'
import { can } from '#lib/roles.js'
import { monthTxt } from '#utils/dates.js'
import { adhocForm, scheduleForm, memberForm } from '#lib/forms.js'
import { t } from '#i18n'

export default function AppHeader({ route }) {
  const { db, a } = useApp()
  const { isDark, toggleTheme } = useTheme()
  const isMobile = useMobile(768)

  const role = db.myRole || db.viewAs || 'owner'
  const page = pageOf(route)

  const isSettings = route === 'settings'
  const canEditSettings = can(db.viewAs || 'owner', 'settings')

  if (isMobile) {
    return (
      <header style={S.mobileHeader}>
        <div style={S.mobileLeft}>
          <div style={S.mobileTitle}>{page.title}</div>
          <div style={S.mobileSubtitle}>
            {db.club.name} · {monthTxt(db.month)}
          </div>
        </div>

        <div style={S.mobileRight}>
          <IconButton
            icon={isDark ? 'sun' : 'moon'}
            size="sm"
            variant="ghost"
            style={S.themeBtn}
            label={isDark ? t('common.themeLight') : t('common.themeDark')}
            onClick={toggleTheme}
          />
          {route === 'sessions' && can(role, 'sessions') && (
            <Button
              variant="primary"
              size="sm"
              icon="calendar-plus"
              onClick={() => a.openDialog('adhoc', adhocForm(db))}
            >
              {t('shell.adhoc')}
            </Button>
          )}
          {route === 'members' && can(role, 'members') && (
            <Button
              variant="primary"
              size="sm"
              icon="user-round-plus"
              onClick={() => a.openDialog('member', memberForm(db))}
            >
              {t('common.add')}
            </Button>
          )}
        </div>
      </header>
    )
  }

  return (
    <header style={S.header}>
      <div style={S.left}>
        <h1 style={S.h1}>{page.title}</h1>
        <span style={S.hint}>{page.desc}</span>
      </div>

      <div style={S.right}>
        {!isSettings && (
          <div style={S.monthBox}>
            <IconButton icon="chevron-left" size="sm" variant="ghost"
              label={t('common.prevMonth')} onClick={() => a.shiftMonth(-1)} />
            <span style={S.monthLabel}>{monthTxt(db.month)}</span>
            <IconButton icon="chevron-right" size="sm" variant="ghost"
              label={t('common.nextMonth')} onClick={() => a.shiftMonth(1)} />
          </div>
        )}

        <IconButton
          icon={isDark ? 'sun' : 'moon'}
          size="sm"
          variant="ghost"
          style={S.themeBtn}
          label={isDark ? t('common.themeLight') : t('common.themeDark')}
          onClick={toggleTheme}
        />

        {isSettings
          ? canEditSettings && (
            <>
              <Button variant="secondary" icon="upload"
                onClick={() => a.openDialog('importSettings', {})}>
                {t('settings.ioImport')}
              </Button>
              <Button variant="secondary" icon="download"
                onClick={a.exportSettings}>
                {t('settings.ioExport')}
              </Button>
            </>
          )
          : can(role, 'sessions') && (
            <>
              <Button variant="secondary" icon="calendar-plus"
                onClick={() => a.openDialog('adhoc', adhocForm(db))}>
                {t('shell.adhoc')}
              </Button>
              <Button variant="primary" icon="repeat"
                onClick={() => a.openDialog('schedule', scheduleForm(db))}>
                {t('shell.bulkSchedule')}
              </Button>
            </>
          )}
      </div>
    </header>
  )
}

const S = {
  header: {
    minHeight: 60, flex: '0 0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
    gap: '10px 12px', padding: '11px 22px', background: 'var(--surface-card)',
    borderBottom: '1px solid var(--border-subtle)',
  },
  left: { display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0, flex: '1 1 220px', overflow: 'hidden' },
  h1: { font: 'var(--type-h2)', color: 'var(--text-primary)', whiteSpace: 'nowrap', margin: 0, flex: '0 0 auto' },
  hint: {
    flex: 1, minWidth: 0, font: 'var(--type-caption)', color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  // phải co và wrap được — đừng dùng flex:0 0 auto, header sẽ tràn dưới 1390px
  right: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end',
    gap: 8, flex: '1 1 auto', minWidth: 0,
  },
  monthBox: {
    display: 'flex', alignItems: 'center', gap: 6, padding: 3,
    border: '1px solid var(--border-subtle)', borderRadius: 6,
  },
  monthLabel: { font: '600 13px/1 var(--font-mono)', color: 'var(--text-primary)', minWidth: 78, textAlign: 'center' },
  themeBtn: {
    width: 34, height: 34,
    border: '1px solid var(--border-subtle)', borderRadius: 6,
    color: 'var(--text-secondary)',
  },
  mobileHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    minHeight: 'var(--topbar-h, 60px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    background: 'var(--surface-nav)',
    borderBottom: '1px solid var(--border-nav)',
  },
  mobileLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  mobileTitle: {
    font: '600 17px/1.2 var(--font-display, Barlow, sans-serif)',
    color: 'var(--text-on-nav-active, #FFFFFF)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mobileSubtitle: {
    font: '400 12px/1.3 var(--font-mono)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mobileRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
}

