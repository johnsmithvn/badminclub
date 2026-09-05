// Header: tên trang + mô tả · chọn tháng · nút hành động (theo quyền).

import { Button, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { pageOf } from '#routes'
import { can } from '#lib/roles.js'
import { monthTxt } from '#utils/dates.js'
import { adhocForm, scheduleForm } from '#lib/forms.js'
import { t } from '#i18n'

export default function AppHeader({ route }) {
  const { db, a } = useApp()
  const { isDark, toggleTheme } = useTheme()

  const role = db.myRole || db.viewAs || 'owner'
  const page = pageOf(route)

  return (
    <header style={S.header}>
      <div style={S.left}>
        <h1 style={S.h1}>{page.title}</h1>
        <span style={S.hint}>{page.desc}</span>
      </div>

      <div style={S.right}>
        <div style={S.monthBox}>
          <IconButton icon="chevron-left" size="sm" variant="ghost"
            label={t('common.prevMonth')} onClick={() => a.shiftMonth(-1)} />
          <span style={S.monthLabel}>{monthTxt(db.month)}</span>
          <IconButton icon="chevron-right" size="sm" variant="ghost"
            label={t('common.nextMonth')} onClick={() => a.shiftMonth(1)} />
        </div>

        <IconButton
          icon={isDark ? 'sun' : 'moon'}
          size="sm"
          variant="ghost"
          style={S.themeBtn}
          label={isDark ? t('common.themeLight') : t('common.themeDark')}
          onClick={toggleTheme}
        />

        {can(role, 'sessions') && (
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
}
