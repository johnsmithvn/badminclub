// src/components/notification/NotificationBell.jsx
import React, { useState, useMemo, useEffect } from 'react'
import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { myMember } from '#lib/money.js'
import NotificationPanel from './NotificationPanel.jsx'
import { t } from '#i18n'

export default function NotificationBell({ size = 'sm', style = {} }) {
  const { db, a } = useApp()
  const [panelOpen, setPanelOpen] = useState(false)

  const myMem = myMember(db)
  const myId = myMem?.id || null

  const unreadCount = useMemo(() => {
    return (db.notifications || []).filter((n) => (!myId || n.memberId === myId) && !n.readAt).length
  }, [db.notifications, myId])

  // Nạp lại khi quay lại tab. Không dùng Supabase Realtime: gói Free chạy RLS cho TỪNG client
  // đang kết nối trên MỖI dòng insert, mà lúc lưu trận liên tục trong buổi tập thì đó đúng là
  // thứ làm hết CPU database trước khi hết băng thông. Một select 100 dòng mỗi lần quay lại tab
  // rẻ hơn nhiều, và không phải bật gì thêm trên dashboard.
  useEffect(() => {
    if (!a?.reloadNotifications) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') a.reloadNotifications()
    }
    const onSwMessage = (event) => {
      if (event.data?.type === 'push-received') {
        a.reloadNotifications()
      }
    }
    onFocus()
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onSwMessage)
    }
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage)
      }
    }
  }, [a])

  // Cố ý KHÔNG đánh dấu đã đọc ở đây: làm vậy thì panel mở ra khi mọi dòng đã là "đã đọc" —
  // mất sạch chấm xanh, chữ đậm và cả nút "Đã đọc tất cả". Đọc là do người dùng bấm.
  const handleClick = () => {
    setPanelOpen(true)
    if (a?.reloadNotifications) a.reloadNotifications()
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('notification.title')}
        onClick={handleClick}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size === 'sm' ? 32 : 36,
          height: size === 'sm' ? 32 : 36,
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--gray-300, #d1d5db)',
          cursor: 'pointer',
          transition: 'background-color 0.2s, color 0.2s',
          ...style,
        }}
      >
        <Icon name="bell" size={size === 'sm' ? 16 : 18} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              backgroundColor: 'var(--teal-400, #00F5D4)',
              color: '#000',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
