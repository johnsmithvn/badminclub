// Sidebar: logo + mã CLB · switcher CLB · nav theo quyền · footer user.
// Switcher CLB nằm TRONG sidebar (không ở header) để header không tràn dưới 1390px — xem DESIGN.md §5.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Icon, Select, SidebarNav } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { PUBLIC_PATHS, pathOf } from '#routes'
import { allowedRoutes, roleName } from '#lib/roles.js'
import { adjustRows, advanceRows, duesOf, dueState, monthSessions, sessionOf } from '#lib/money.js'
import { assignableSessions } from '#lib/assign.js'
import { monthOf } from '#utils/dates.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

/** Cấu trúc nav: value = route key, section = nhãn nhóm. Nhãn lấy từ i18n. */
const NAV = [
  { value: 'home', icon: 'layout-dashboard' },
  { section: 'ops' },
  { value: 'calendar', icon: 'calendar-days' },
  { value: 'sessions', icon: 'clipboard-check', badge: 'unclosedSessions' },
  { value: 'assign', icon: 'route', badge: 'assignable' },
  { value: 'schedules', icon: 'repeat' },
  { value: 'members', icon: 'users' },
  { section: 'money' },
  { value: 'debts', icon: 'clock-alert', badge: 'debtPending', alert: 'hasDebt' },
  { value: 'fund', icon: 'wallet' },
  { value: 'shuttles', icon: 'package' },
  { section: 'account' },
  { value: 'profile', icon: 'user-round' },
  { value: 'settings', icon: 'settings', badge: 'pendingJoins' },
]

export default function Sidebar({ route }) {
  const { db } = useApp()
  const { clubs: myClubs, activeClub, setActiveClub, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const role = db.viewAs || 'owner'

  const clubName = db.club.name
  const clubCode = db.club.code
  const clubOptions = myClubs.map((c) => ({ value: c.id, label: c.name }))
  const clubValue = activeClub ? activeClub.id : ''

  const onClub = (e) => {
    setActiveClub(e.target.value)
    navigate('/')
  }

  const meName = (profile && (profile.nick || profile.name)) || t('common.unknown')

  // Đếm đúng toàn bộ công nợ đang chờ xử lý ở các tab:
  // 1. Thu/hoàn theo buổi (khách chưa trả + hội viên đi thêm chưa thu/hoàn)
  const unpaidGuests = (db.sessionGuests || []).filter((sg) => {
    const s = sessionOf(db, sg.sessionId)
    return s && monthOf(s.date) === db.month && !sg.paid
  }).length
  const unpaidAdjusts = adjustRows(db, db.month).filter((r) => !r.paid).length
  const sessionDebtsPending = unpaidGuests + unpaidAdjusts
  // 2. Quỹ tháng còn thiếu
  const unpaidDues = duesOf(db, db.month).filter((x) => dueState(x).remain > 0).length
  // 3. Quỹ nợ thành viên ứng tiền
  const unpaidAdvances = advanceRows(db).filter((x) => !x.repaidAt).length
  const totalDebtPending = sessionDebtsPending + unpaidDues + unpaidAdvances

  const counts = {
    unclosedSessions: monthSessions(db, db.month).filter((s) => s.status !== 'closed').length,
    assignable: assignableSessions(db).length,
    debtPending: totalDebtPending,
    pendingJoins: (db.joinRequests || []).length,
  }
  const flags = { hasDebt: totalDebtPending > 0 }

  const built = NAV.map((it) =>
    it.section
      ? { section: t('nav.section.' + it.section) }
      : {
          value: it.value,
          label: t('nav.' + it.value),
          icon: it.icon,
          count: it.badge ? counts[it.badge] : undefined,
          alert: it.alert ? flags[it.alert] : undefined,
        }
  )
  // Ẩn mục vai hiện tại không được vào; section rỗng cũng ẩn.
  const ok = allowedRoutes(role)
  let items = built
  if (ok) {
    const keep = built.filter((it) => it.section || ok.indexOf(it.value) >= 0)
    items = keep.filter((it, i) => !it.section || (keep[i + 1] && !keep[i + 1].section))
  }

  return (
    <nav style={S.nav}>
      <div style={S.head}>
        <div style={S.logo}><Icon name="volleyball" size={18} /></div>
        <div style={{ minWidth: 0 }}>
          <div style={S.clubName}>{clubName}</div>
          <div style={S.clubCode}>{t('shell.clubPrefix') + clubCode}</div>
        </div>
      </div>

      <div style={{ padding: '10px 12px 2px' }}>
        <Select
          size="sm"
          options={clubOptions}
          value={clubValue}
          onChange={onClub}
          style={{ background: 'rgba(255,255,255,.10)', borderColor: 'rgba(255,255,255,.22)', color: '#fff' }}
        />
      </div>

      <div style={{ padding: '8px 10px 8px 6px', flex: 1, overflowY: 'auto' }}>
        <SidebarNav
          items={items}
          value={route === 'session' ? 'sessions' : route}
          onChange={(v) => navigate(pathOf(v, v === 'session' ? db.sessionId : undefined))}
          style={{ background: 'transparent', border: 0, width: '100%' }}
        />
      </div>

      <div style={S.foot}>
        {/* Nền bắt click ra ngoài để đóng menu — rẻ hơn listener trên document và tự dọn theo render. */}
        {menu && <div style={S.scrim} onClick={() => setMenu(false)} />}
        {menu && (
          <div style={S.menu} role="menu">
            <button type="button" role="menuitem" style={S.item}
              onClick={() => { setMenu(false); navigate(PUBLIC_PATHS.clubs) }}>
              <Icon name="building-2" size={16} />{t('shell.backToClubs')}
            </button>
            <button type="button" role="menuitem" style={S.item} onClick={signOut}>
              <Icon name="circle-x" size={16} />{t('auth.logout')}
            </button>
          </div>
        )}

        <button type="button" style={S.footBtn} onClick={() => setMenu((v) => !v)}
          aria-haspopup="menu" aria-expanded={menu} aria-label={t('shell.userMenu')}>
          <Avatar name={meName} size={30} />
          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <div style={S.footName}>{meName}</div>
            <div style={S.footRole}>{t('shell.footRole', { role: roleName(role), club: clubName })}</div>
          </div>
          <Icon name="chevron-down" size={15} style={{ color: 'rgba(255,255,255,.55)' }} />
        </button>
      </div>
    </nav>
  )
}

const S = {
  nav: {
    width: cfg.ui.sidebarWidth, flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    background: 'var(--surface-nav)', borderRight: '1px solid var(--border-nav)',
  },
  head: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '15px 16px',
    borderBottom: '1px solid var(--border-nav)',
  },
  logo: {
    width: 30, height: 30, flex: '0 0 auto', borderRadius: 8, background: 'var(--teal-500)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#04302C',
  },
  clubName: {
    font: '700 15px/1.15 var(--font-display)', color: '#fff', letterSpacing: '-0.015em',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  clubCode: { font: 'var(--type-mono)', color: 'rgba(255,255,255,.5)', letterSpacing: '.02em' },
  foot: { position: 'relative', padding: '10px 12px', borderTop: '1px solid var(--border-nav)' },
  footBtn: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    padding: 0, border: 0, background: 'transparent', cursor: 'pointer',
  },
  scrim: { position: 'fixed', inset: 0, zIndex: 1 },
  menu: {
    position: 'absolute', zIndex: 2, left: 12, right: 12, bottom: '100%', marginBottom: 6,
    display: 'grid', padding: 4, borderRadius: 9, background: 'var(--surface-card)',
    border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 32,
    padding: '0 8px', border: 0, borderRadius: 6, background: 'transparent', cursor: 'pointer',
    font: 'var(--type-label)', color: 'var(--text-primary)', textAlign: 'left',
  },
  footName: {
    font: 'var(--type-label)', color: '#fff',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  footRole: {
    font: 'var(--type-caption)', color: 'rgba(255,255,255,.5)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
}
