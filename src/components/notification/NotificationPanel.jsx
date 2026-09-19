// src/components/notification/NotificationPanel.jsx
import React, { useState, useMemo, useEffect } from 'react'
import { Icon, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { myMember } from '#lib/money.js'
import { getPersonalHighlights } from '#lib/activity.js'
import NotificationItem from './NotificationItem.jsx'
import { t } from '#i18n'
import { supabase } from '#supabase'
import {
  isPushSupported,
  getPushPermissionState,
  isPushSubscribed,
  subscribePush,
} from '#lib/pushSubscription.js'

export default function NotificationPanel({ open, onClose }) {
  const { db, a } = useApp()
  const [activeTab, setActiveTab] = useState('notifications') // 'notifications' | 'highlights'
  const [pushState, setPushState] = useState({
    supported: false,
    subscribed: false,
    permission: 'default',
  })
  const [enablingPush, setEnablingPush] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    const checkPush = async () => {
      if (!isPushSupported()) {
        if (active) setPushState({ supported: false, subscribed: false, permission: 'unsupported' })
        return
      }
      const perm = getPushPermissionState()
      // Kiểm cả dòng dưới DB, không chỉ trình duyệt — xem `isPushSubscribed`.
      const subbed = await isPushSubscribed(supabase, db.currentUserId)
      if (active) setPushState({ supported: true, subscribed: subbed, permission: perm })
    }
    checkPush()
    return () => { active = false }
  }, [open, db.currentUserId])

  const handleEnablePush = async () => {
    if (enablingPush) return
    setEnablingPush(true)
    try {
      await subscribePush(supabase, db.currentUserId)
      setPushState((s) => ({ ...s, subscribed: true, permission: 'granted' }))
      a?.toast?.(t('toast.pushEnabled'))
    } catch (err) {
      if (err?.message === 'PERMISSION_DENIED') {
        setPushState((s) => ({ ...s, permission: 'denied', subscribed: false }))
        a?.toast?.(t('toast.pushDenied'))
      } else {
        a?.toast?.(t('toast.pushError'))
      }
    } finally {
      setEnablingPush(false)
    }
  }

  const myMem = myMember(db)
  const myId = myMem?.id || null

  const notifications = useMemo(() => {
    return (db.notifications || [])
      .filter((n) => !myId || n.memberId === myId)
      .slice()
      .sort((x, y) => {
        const tX = x.createdAt ? new Date(x.createdAt).getTime() : 0
        const tY = y.createdAt ? new Date(y.createdAt).getTime() : 0
        return tY - tX
      })
  }, [db.notifications, myId])

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length
  }, [notifications])

  const highlights = useMemo(() => {
    if (!myId) return []
    return getPersonalHighlights(myId, db)
  }, [myId, db])

  const handleItemClick = (item) => {
    if (!item.readAt) {
      a.markNotificationRead(item.id)
    }
    if (item.refType === 'challenge' || item.type?.startsWith('challenge_')) {
      const targetId = item.refId || item.payload?.chalId
      a.go('challenges', targetId)
      onClose()
    } else if (item.refType === 'session' && item.refId) {
      a.openSession(item.refId)
      onClose()
    } else if (item.refType === 'match') {
      a.go('matches')
      onClose()
    } else if (item.refType === 'claim') {
      a.go('fund')
      onClose()
    } else if (item.refType === 'debts') {
      a.setTab('debts', 'sessions')
      a.go('debts')
      onClose()
    } else if (item.refType === 'member') {
      // Yêu cầu CHỜ DUYỆT nằm ở màn Thành viên (nút Duyệt / Từ chối); kết quả duyệt thì người
      // nhận chỉ cần xem hồ sơ của chính mình.
      a.go(item.type === 'member_change_requested' ? 'members' : 'profile')
      onClose()
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          height: '100%',
          backgroundColor: 'var(--surface-card)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg, -4px 0 24px rgba(0, 0, 0, 0.25))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Panel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {t('notification.title')}
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: 'var(--teal-500, #00F5D4)',
                  color: '#000',
                  padding: '2px 8px',
                  borderRadius: 12,
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => a.markAllNotificationsRead()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-accent, #00786F)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: 500,
                  padding: '4px 8px',
                }}
              >
                {t('notification.markAllRead')}
              </button>
            )}
            <IconButton
              icon="x"
              size="sm"
              variant="ghost"
              label="Close"
              onClick={onClose}
            />
          </div>
        </div>

        {/* Tabs switcher: Thông báo vs Dành cho bạn */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-sunken)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === 'notifications' ? 'var(--text-accent, #00786F)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'notifications' ? '2px solid var(--text-accent, #00786F)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t('notification.tabNotifications')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === 'highlights' ? 'var(--text-accent, #00786F)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'highlights' ? '2px solid var(--text-accent, #00786F)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t('notification.tabHighlights')}
          </button>
        </div>

        {/* Banner nhắc bật Web Push (chỉ hiện khi được hỗ trợ, chưa đăng ký và permission là 'default') */}
        {pushState.supported && !pushState.subscribed && pushState.permission === 'default' && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--surface-accent-soft)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <Icon name="bell" size={18} style={{ color: 'var(--text-accent, #00786F)', flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {t('notification.pushBannerText')}
              </div>
            </div>
            <button
              type="button"
              disabled={enablingPush}
              onClick={handleEnablePush}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: 'var(--action-accent-bg, #00786F)',
                color: 'var(--action-accent-fg, #fff)',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {t('notification.pushBannerBtn')}
            </button>
          </div>
        )}

        {/* Nội dung danh sách */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'notifications' ? (
            notifications.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Icon name="bell" size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                <div style={{ fontSize: 14 }}>{t('notification.empty')}</div>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  item={n}
                  onRead={handleItemClick}
                />
              ))
            )
          ) : (
            /* Tab Điểm Nhấn Cá Nhân */
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {highlights.length === 0 ? (
                <div
                  style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Icon name="award" size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ fontSize: 14 }}>{t('highlights.empty')}</div>
                </div>
              ) : (
                highlights.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      backgroundColor: 'var(--surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: 'var(--surface-accent-soft, rgba(0, 178, 169, 0.12))',
                        color: 'var(--text-accent, #00786F)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon
                        name={
                          h.type === 'best_partner'
                            ? 'users'
                            : h.type === 'reliable_partner'
                            ? 'shield'
                            : h.type === 'arch_rival'
                            ? 'swords'
                            : h.type === 'nemesis_beaten'
                            ? 'zap'
                            : 'flame'
                        }
                        size={18}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          lineHeight: 1.4,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {t('highlights.' + h.type, h)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
