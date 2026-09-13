import { Button, Icon, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useTheme } from '#contexts/ThemeContext.jsx'
import { useMobile } from '#hooks/useMobile.js'
import { pageOf } from '#routes'
import { can, footerSlots } from '#lib/roles.js'
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

  // Màn SessionDetail, Giao dịch (Fund), Bảng xếp hạng (Leaderboard) và Trận đấu (Matches) có header riêng chuẩn thiết kế -> ẩn AppHeader mặc định để tránh 2 header
  if (route === 'session' || route === 'fund' || route === 'leaderboard' || route === 'matches') {
    return null
  }

  if (isMobile) {
    return (
      <MobileUnifiedHeader
        route={route}
        page={page}
        role={role}
        db={db}
        a={a}
        isDark={isDark}
        toggleTheme={toggleTheme}
        isSettings={isSettings}
      />
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

        {!isSettings && can(role, 'sessions') && (
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

function MobileUnifiedHeader({
  route,
  page,
  role,
  db,
  a,
  isDark,
  toggleTheme,
  isSettings,
}) {
  const inMobileNav = footerSlots(role).includes(route)
  const hasTitle = !inMobileNav

  return (
    <header style={S.mobileHeaderH4}>
      {/* Vòng hào quang góc phải theo thiết kế H4 */}
      <div style={S.glowCircleH4} />

      <div style={hasTitle ? S.mobileContentH4Compact : S.mobileContentH4}>
        {/* Tên màn nhỏ ở đầu giống H1 cho các màn không hiện ở sidebar/tabbar mobile */}
        {hasTitle && (
          <span style={S.screenTitleH1} title={page.title}>
            {page.title}
          </span>
        )}

        {/* Cụm chọn tháng (không hiện ở màn Cài đặt) */}
        {!isSettings ? (
          <>
            {/* Nút lùi 1 tháng ‹ */}
            <button
              type="button"
              aria-label={t('common.prevMonth')}
              onClick={() => a.shiftMonth(-1)}
              style={hasTitle ? S.monthArrowBtnCompact : S.monthArrowBtnH4}
            >
              <Icon name="chevron-left" size={hasTitle ? 14 : 16} />
            </button>

            {/* Khối tháng trung tâm: Tháng MM/YYYY + vạch teal */}
            <div style={hasTitle ? S.monthCenterCompact : S.monthCenterH4}>
              <span style={hasTitle ? S.monthTextCompact : S.monthTextH4}>
                {monthTxt(db.month)}
              </span>
              <span style={hasTitle ? S.monthIndicatorCompact : S.monthIndicatorH4} />
            </div>

            {/* Nút tiến 1 tháng › */}
            <button
              type="button"
              aria-label={t('common.nextMonth')}
              onClick={() => a.shiftMonth(1)}
              style={hasTitle ? S.monthArrowBtnCompact : S.monthArrowBtnH4}
            >
              <Icon name="chevron-right" size={hasTitle ? 14 : 16} />
            </button>
          </>
        ) : (
          <div style={{ flex: '1 1 auto' }} />
        )}

        {/* Thanh phân cách */}
        {!isSettings && <span style={hasTitle ? S.dividerCompact : S.dividerH4} />}

        {/* Nút chuyển theme sáng/tối */}
        <button
          type="button"
          aria-label={isDark ? t('common.themeLight') : t('common.themeDark')}
          onClick={toggleTheme}
          style={hasTitle ? S.themeBtnCompact : S.themeBtnH4}
        >
          <Icon name={isDark ? 'sun' : 'moon'} size={hasTitle ? 14 : 15} />
        </button>

        {/* Nút thêm buổi đột xuất tròn teal ở màn Buổi tập */}
        {route === 'sessions' && can(role, 'sessions') && (
          <button
            type="button"
            aria-label={t('shell.adhoc')}
            onClick={() => a.openDialog('adhoc', adhocForm(db))}
            style={hasTitle ? S.actionBtnCompact : S.adhocBtnH4}
          >
            <Icon name="plus" size={hasTitle ? 15 : 16} strokeWidth={2.6} />
          </button>
        )}

        {/* Nút thêm thành viên tròn teal ở màn Thành viên */}
        {route === 'members' && can(role, 'members') && (
          <button
            type="button"
            aria-label={t('common.add')}
            onClick={() => a.openDialog('member', memberForm(db))}
            style={hasTitle ? S.actionBtnCompact : S.adhocBtnH4}
          >
            <Icon name="user-round-plus" size={hasTitle ? 14 : 16} strokeWidth={2.4} />
          </button>
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
  screenTitleH1: {
    font: "700 15.5px/1.2 var(--font-sans, 'IBM Plex Sans', sans-serif)",
    letterSpacing: '-0.015em',
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
    maxWidth: 125,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  mobileContentH4Compact: {
    position: 'relative',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  monthArrowBtnCompact: {
    width: 28,
    height: 28,
    flex: '0 0 auto',
    borderRadius: 7,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #2A3A58',
    color: '#C5D3E6',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  monthCenterCompact: {
    flex: '1 1 auto',
    minWidth: 0,
    height: 28,
    padding: '0 2px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  monthTextCompact: {
    font: "600 13px/1 var(--font-mono, 'IBM Plex Mono', monospace)",
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  monthIndicatorCompact: {
    width: 24,
    height: 2,
    borderRadius: 2,
    background: 'var(--teal-500, #00B2A9)',
    flexShrink: 0,
  },
  dividerCompact: {
    width: 1,
    height: 20,
    flex: '0 0 auto',
    background: '#2A3A58',
    margin: '0 1px',
  },
  themeBtnCompact: {
    width: 28,
    height: 28,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid #3A4C71',
    color: '#C5D3E6',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  actionBtnCompact: {
    width: 28,
    height: 28,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'var(--teal-500, #00B2A9)',
    border: 'none',
    color: '#04221F',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 178, 169, 0.30)',
    padding: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  mobileHeaderH4: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    background: 'linear-gradient(168deg, #12203A 0%, #0D1526 70%)',
    borderBottom: '1px solid #2A3A58',
    overflow: 'hidden',
  },
  glowCircleH4: {
    position: 'absolute',
    top: -56,
    right: -44,
    width: 178,
    height: 178,
    borderRadius: 999,
    background: 'radial-gradient(circle, rgba(0, 178, 169, 0.22), transparent 68%)',
    pointerEvents: 'none',
  },
  mobileContentH4: {
    position: 'relative',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  monthArrowBtnH4: {
    width: 34,
    height: 34,
    flex: '0 0 auto',
    borderRadius: 9,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid #2A3A58',
    color: '#C5D3E6',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  monthCenterH4: {
    flex: '1 1 auto',
    minWidth: 0,
    height: 34,
    padding: '0 4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  monthTextH4: {
    font: "600 15.5px/1 var(--font-mono, 'IBM Plex Mono', monospace)",
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  monthIndicatorH4: {
    width: 34,
    height: 2,
    borderRadius: 2,
    background: 'var(--teal-500, #00B2A9)',
    flexShrink: 0,
  },
  dividerH4: {
    width: 1,
    height: 24,
    flex: '0 0 auto',
    background: '#2A3A58',
    margin: '0 2px',
  },
  themeBtnH4: {
    width: 34,
    height: 34,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid #3A4C71',
    color: '#C5D3E6',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  },
  adhocBtnH4: {
    width: 34,
    height: 34,
    flex: '0 0 auto',
    borderRadius: 999,
    background: 'var(--teal-500, #00B2A9)',
    border: 'none',
    color: '#04221F',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(0, 178, 169, 0.30)',
    padding: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
}

