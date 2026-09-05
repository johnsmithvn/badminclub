// Mobile Footer Navigation: 5 slot đổi theo vai (Handoff §1.2 & §B3).
// Mọi màu qua token CSS var(--*), không hard-code hex (tránh phá theme sáng).

import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { footerSlots, can } from '#lib/roles.js'
import { clubDebtCounts, monthSessions, myDebtCounts } from '#lib/money.js'
import { t } from '#i18n'

const SLOT_ICONS = {
  home: 'layout-dashboard',
  sessions: 'clipboard-check',
  debts: 'clock-alert',
  leaderboard: 'trophy',
  profile: 'user-round',
  more: 'ellipsis',
}

export default function MobileFooterNav({ route, isMoreOpen, onToggleMore }) {
  const { db, a } = useApp()
  const role = db.viewAs || 'owner'
  const slots = footerSlots(role)

  const canMoney = can(role, 'money')
  const debtCounts = canMoney ? clubDebtCounts(db, db.month) : myDebtCounts(db, db.month)

  const unclosedSessions = monthSessions(db, db.month).filter((s) => s.status !== 'closed').length
  const debtPending = debtCounts.total
  const pendingJoins = (db.joinRequests || []).length
  const pendingChanges = (db.changes || []).filter((c) => c.status === 'pending').length
  const morePending = pendingJoins + pendingChanges

  const getBadge = (slot) => {
    if (slot === 'sessions') return unclosedSessions > 0 ? unclosedSessions : null
    if (slot === 'debts') return debtPending > 0 ? debtPending : null
    if (slot === 'more') return morePending > 0 ? morePending : null
    return null
  }

  const isSlotActive = (slot) => {
    if (slot === 'more') return isMoreOpen
    if (isMoreOpen) return false
    if (slot === 'home') return route === 'home'
    if (slot === 'sessions') return route === 'sessions' || route === 'session'
    if (slot === 'debts') return route === 'debts'
    if (slot === 'leaderboard') return route === 'leaderboard'
    if (slot === 'profile') return route === 'profile'
    return false
  }

  const handleSlotClick = (slot) => {
    if (slot === 'more') {
      onToggleMore()
      return
    }

    if (isMoreOpen) {
      onToggleMore(false)
    }

    if (isSlotActive(slot)) {
      // Đụng slot đang active: cuộn lên đầu trang (Handoff §1.2)
      if (typeof window !== 'undefined') {
        const mainEl = document.querySelector('main')
        if (mainEl) {
          mainEl.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }
    } else {
      a.go(slot)
    }
  }

  return (
    <nav style={S.nav} aria-label={t('nav.section.ops')}>
      {slots.map((slot) => {
        const active = isSlotActive(slot)
        const badge = getBadge(slot)
        const iconName = SLOT_ICONS[slot] || 'layout-dashboard'
        const label = slot === 'more' ? t('nav.more') : t('nav.' + slot)

        return (
          <button
            key={slot}
            type="button"
            onClick={() => handleSlotClick(slot)}
            style={{
              ...S.slotBtn,
              background: active ? 'var(--surface-nav-active)' : 'transparent',
            }}
          >
            <div style={S.iconBox}>
              <Icon
                name={iconName}
                size={20}
                style={{
                  color: active ? 'var(--action-accent-bg)' : 'var(--text-on-nav)',
                  transition: 'color var(--dur-fast) var(--ease-standard)',
                }}
              />
              {badge != null && (
                <span style={S.badge}>
                  {badge}
                </span>
              )}
            </div>
            <span
              style={{
                ...S.label,
                color: active ? 'var(--text-on-nav-active)' : 'var(--text-on-nav)',
                fontWeight: active ? 600 : 500,
              }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

const S = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    background: 'var(--surface-nav)',
    borderTop: '1px solid var(--border-nav)',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  },
  slotBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '10px 0 2px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    outline: 'none',
    transition: 'background var(--dur-fast) var(--ease-standard)',
  },
  iconBox: {
    position: 'relative',
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    font: '500 10px/1.1 var(--font-sans)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    padding: '0 2px',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 99,
    background: 'var(--status-delayed-fg)',
    color: 'var(--text-inverse)',
    font: '700 9px/16px var(--font-mono)',
    textAlign: 'center',
    boxShadow: '0 0 0 1.5px var(--surface-nav)',
  },
}
