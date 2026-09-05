// Sheet "Thêm" dán đáy trên mobile (Handoff N1 & §B2).
// Dùng <Dialog sheet>, mọi màu qua token CSS var(--*), giữ đủ mục sidebar và tính năng Chia sân.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Dialog, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { PUBLIC_PATHS, pathOf } from '#routes'
import { allowedRoutes, can, footerSlots, roleName } from '#lib/roles.js'
import { clubDebtCounts, monthSessions, myDebtCounts } from '#lib/money.js'
import { assignableSessions } from '#lib/assign.js'
import { t } from '#i18n'

export default function MoreSheet({ open, onClose, route }) {
  const { db, a } = useApp()
  const { clubs: myClubs, activeClub, setActiveClub } = useAuth()
  const navigate = useNavigate()
  const [clubMenuOpen, setClubMenuOpen] = useState(false)

  const role = db.viewAs || 'owner'
  const currentSlots = footerSlots(role)
  const canMoney = can(role, 'money')
  const debtCounts = canMoney ? clubDebtCounts(db, db.month) : myDebtCounts(db, db.month)

  const counts = {
    unclosedSessions: monthSessions(db, db.month).filter((s) => s.status !== 'closed').length,
    assignable: assignableSessions(db).length,
    debtPending: debtCounts.total,
    pendingJoins: (db.joinRequests || []).length,
    pendingChanges: (db.changes || []).filter((c) => c.status === 'pending').length,
  }

  // Cấu trúc nhóm giữ đúng như sidebar desktop
  const GROUPS = [
    {
      title: t('nav.section.money'),
      items: [
        // Công nợ chỉ hiện khi KHÔNG nằm ở 4 slot dưới
        ...(!currentSlots.includes('debts') ? [{
          value: 'debts',
          icon: 'clock-alert',
          badge: counts.debtPending > 0 ? counts.debtPending : null,
        }] : []),
        { value: 'fund', icon: 'wallet' },
      ],
    },
    {
      title: t('nav.section.ops'),
      items: [
        {
          value: 'members',
          icon: 'users',
          badge: counts.pendingChanges > 0 ? counts.pendingChanges : null,
        },
        {
          value: 'assign',
          icon: 'route',
          badge: counts.assignable > 0 ? counts.assignable : null,
          isAssign: true,
        },
        { value: 'calendar', icon: 'calendar-days' },
        { value: 'schedules', icon: 'repeat' },
        ...(!currentSlots.includes('profile') ? [{
          value: 'profile',
          icon: 'user-round',
        }] : []),
      ],
    },
    {
      title: t('nav.section.account'),
      items: [
        {
          value: 'settings',
          icon: 'settings',
          badge: counts.pendingJoins > 0 ? counts.pendingJoins : null,
        },
        { value: 'schema', icon: 'database' },
        ...(can(role, 'settings') ? [
          {
            value: 'ioExport',
            label: t('settings.ioExport'),
            icon: 'download',
            action: 'exportSettings',
          },
          {
            value: 'ioImport',
            label: t('settings.ioImport'),
            icon: 'upload',
            action: 'importSettings',
          },
        ] : []),
      ],
    },
  ]

  const ok = allowedRoutes(role)
  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => !ok || ok.includes(it.value)),
  })).filter((g) => g.items.length > 0)

  const handleItemClick = (it) => {
    onClose()
    if (it.action === 'exportSettings') {
      a.exportSettings()
      return
    }
    if (it.action === 'importSettings') {
      a.openDialog('importSettings', {})
      return
    }
    if (it.isAssign) {
      // Nhảy thẳng vào buổi khả dụng đầu tiên (Sidebar.jsx:196)
      const firstSession = assignableSessions(db)[0]
      if (firstSession) {
        navigate('/buoi-tap/' + firstSession.id + '?tab=courts')
      } else {
        navigate(pathOf('assign'))
      }
      return
    }
    a.go(it.value)
  }

  const clubName = db.club.name
  const clubValue = activeClub ? activeClub.id : ''

  return (
    <Dialog sheet open={open} onClose={onClose} title={t('nav.more')}>
      <div style={S.sheetBody}>
        {visibleGroups.map((grp) => (
          <div key={grp.title} style={S.group}>
            <div style={S.groupTitle}>{grp.title}</div>
            <div style={S.groupItems}>
              {grp.items.map((it) => {
                const isActive = route === it.value
                return (
                  <button
                    key={it.value}
                    type="button"
                    onClick={() => handleItemClick(it)}
                    style={{
                      ...S.rowBtn,
                      background: isActive ? 'var(--surface-brand-soft)' : 'var(--surface-inset)',
                      border: isActive ? '1px solid var(--border-focus-color)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={S.rowIcon}>
                      <Icon name={it.icon} size={18} style={{ color: isActive ? 'var(--action-accent-bg)' : 'var(--text-secondary)' }} />
                    </div>
                    <span style={{
                      ...S.rowLabel,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 500,
                    }}>
                      {it.label || t('nav.' + it.value)}
                    </span>
                    {it.badge != null && (
                      <span style={S.rowBadge}>
                        {it.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Switcher CLB ở cuối sheet (Handoff N1 §1.2) */}
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setClubMenuOpen((v) => !v)}
            style={S.clubCard}
          >
            {db.club.avatarUrl ? (
              <Avatar name={clubName} src={db.club.avatarUrl} size={30} square style={{ flexShrink: 0 }} />
            ) : (
              <div style={S.clubLogo}>
                <Icon name="volleyball" size={18} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={S.clubName}>{clubName}</div>
              <div style={S.clubRole}>
                {roleName(role)} · {db.club?.code ? t('shell.clubPrefix') + db.club.code : clubName}
              </div>
            </div>
            <Icon
              name="chevrons-up-down"
              size={16}
              style={{
                color: 'var(--text-muted)',
                transform: clubMenuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform var(--dur-fast) var(--ease-standard)',
                flexShrink: 0,
              }}
            />
          </button>

          {clubMenuOpen && (
            <div style={S.clubList}>
              <div style={S.clubListTitle}>{t('shell.myClubs')}</div>
              {myClubs.map((c) => {
                const isCurrent = c.id === clubValue
                return (
                  <button
                    key={c.id}
                    type="button"
                    style={{
                      ...S.clubListItem,
                      background: isCurrent ? 'var(--surface-accent-soft)' : 'transparent',
                      color: isCurrent ? 'var(--status-transit-fg)' : 'var(--text-primary)',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                    onClick={() => {
                      setClubMenuOpen(false)
                      onClose()
                      if (!isCurrent) {
                        setActiveClub(c.id)
                        navigate('/')
                      }
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: isCurrent ? 'var(--action-accent-bg)' : 'var(--surface-sunken)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isCurrent ? 'var(--action-accent-fg)' : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                      </div>
                      {c.code && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {c.code}
                        </div>
                      )}
                    </div>
                    {isCurrent && <Icon name="check" size={16} style={{ color: 'var(--action-accent-bg)', flexShrink: 0 }} />}
                  </button>
                )
              })}
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              <button
                type="button"
                style={S.clubListItem}
                onClick={() => {
                  setClubMenuOpen(false)
                  onClose()
                  navigate(PUBLIC_PATHS.clubs)
                }}
              >
                <Icon name="building-2" size={16} style={{ color: 'var(--text-muted)' }} />
                <span>{t('shell.backToClubs')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

const S = {
  sheetBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: '4px 0 calc(16px + env(safe-area-inset-bottom, 0px))',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  groupTitle: {
    font: '600 11px/1.2 var(--font-sans)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    paddingLeft: 2,
  },
  groupItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  rowBtn: {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 12px',
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)',
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    font: '500 15px/1.2 var(--font-sans)',
  },
  rowBadge: {
    font: '600 11px/1 var(--font-mono)',
    color: 'var(--status-delayed-fg)',
    background: 'var(--status-delayed-bg)',
    padding: '4px 8px',
    borderRadius: 99,
  },
  clubCard: {
    minHeight: 56,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 12px',
    background: 'var(--surface-inset)',
    border: '1px dashed var(--border-default)',
    borderRadius: 8,
    cursor: 'pointer',
    width: '100%',
    outline: 'none',
  },
  clubLogo: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: 'var(--action-accent-bg)',
    color: 'var(--action-accent-fg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  clubName: {
    font: '600 14px/1.2 var(--font-sans)',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  clubRole: {
    font: '400 12px/1.3 var(--font-sans)',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  clubList: {
    marginTop: 6,
    padding: '6px',
    background: 'var(--surface-inset)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 8,
    display: 'grid',
    gap: 2,
    maxHeight: 200,
    overflowY: 'auto',
  },
  clubListTitle: {
    font: '600 11px/1 var(--font-sans)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '6px 8px 4px',
  },
  clubListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 8px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
  },
}
