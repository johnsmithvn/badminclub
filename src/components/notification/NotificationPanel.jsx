// src/components/notification/NotificationPanel.jsx
import React, { useState, useMemo } from 'react'
import { Icon, IconButton } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { myMember } from '#lib/money.js'
import { getPersonalHighlights } from '#lib/activity.js'
import NotificationItem from './NotificationItem.jsx'
import { t } from '#i18n'

export default function NotificationPanel({ open, onClose }) {
  const { db, a } = useApp()
  const [activeTab, setActiveTab] = useState('notifications') // 'notifications' | 'highlights'

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
          backgroundColor: 'var(--surface-card, #171717)',
          borderLeft: '1px solid var(--gray-800, #262626)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.5)',
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
            borderBottom: '1px solid var(--gray-800, #262626)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-100, #f3f4f6)' }}>
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
                  color: 'var(--teal-400, #00F5D4)',
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
            borderBottom: '1px solid var(--gray-800, #262626)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
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
              color: activeTab === 'notifications' ? 'var(--teal-400, #00F5D4)' : 'var(--gray-400, #9ca3af)',
              borderBottom: activeTab === 'notifications' ? '2px solid var(--teal-400, #00F5D4)' : '2px solid transparent',
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
              color: activeTab === 'highlights' ? 'var(--teal-400, #00F5D4)' : 'var(--gray-400, #9ca3af)',
              borderBottom: activeTab === 'highlights' ? '2px solid var(--teal-400, #00F5D4)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {t('notification.tabHighlights')}
          </button>
        </div>

        {/* Nội dung danh sách */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'notifications' ? (
            notifications.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: 'var(--gray-400, #9ca3af)',
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
                    color: 'var(--gray-400, #9ca3af)',
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
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(0, 245, 212, 0.15)',
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
                        backgroundColor: 'rgba(0, 245, 212, 0.1)',
                        color: 'var(--teal-400, #00F5D4)',
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
                          color: 'var(--gray-100, #f3f4f6)',
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
