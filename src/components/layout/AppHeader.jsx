// Header: tên trang + mô tả · chọn tháng · nút hành động (theo quyền) · menu tài khoản user.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Icon, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { PUBLIC_PATHS, pageOf } from '#routes'
import { can, roleName } from '#lib/roles.js'
import { monthTxt } from '#utils/dates.js'
import { adhocForm, scheduleForm } from '#lib/forms.js'
import { t } from '#i18n'

export default function AppHeader({ route }) {
  const { db, a } = useApp()
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [userMenu, setUserMenu] = useState(false)

  const role = db.myRole || db.viewAs || 'owner'
  const page = pageOf(route)
  const meName = profile?.name || profile?.email || 'User'

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

        {/* Menu tài khoản: Chuyển/Tạo CLB & Đăng xuất */}
        <div style={{ position: 'relative', marginLeft: 4 }}>
          {userMenu && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setUserMenu(false)}
            />
          )}
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 4px',
              borderRadius: 99, border: '1px solid var(--border-subtle)',
              background: 'var(--surface-sunken)', cursor: 'pointer',
            }}
            onClick={() => setUserMenu((v) => !v)}
            title="Tài khoản & Tuỳ chọn"
          >
            <Avatar name={meName} size={28} />
            <Icon name="chevron-down" size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          {userMenu && (
            <div
              style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                minWidth: 210, padding: 6, borderRadius: 10,
                background: 'var(--surface-card)', border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-md)', zIndex: 100, display: 'grid', gap: 2,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ font: 'var(--type-label)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {meName}
                </div>
                <div style={{ font: 'var(--type-caption)', color: 'var(--text-muted)' }}>
                  {roleName(role)} · {db.club?.name}
                </div>
              </div>

              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer',
                  font: 'var(--type-label)', color: 'var(--text-primary)', width: '100%', textAlign: 'left',
                }}
                onClick={() => {
                  setUserMenu(false)
                  navigate(PUBLIC_PATHS.clubs)
                }}
              >
                <Icon name="building-2" size={16} />
                Quản lý / Tạo CLB mới
              </button>

              <button
                type="button"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 6, border: 0, background: 'transparent', cursor: 'pointer',
                  font: 'var(--type-label)', color: 'var(--status-incident)', width: '100%', textAlign: 'left',
                }}
                onClick={() => {
                  setUserMenu(false)
                  signOut()
                }}
              >
                <Icon name="log-out" size={16} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
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
}
