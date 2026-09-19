// Service Worker for BadminClub PWA
// Phase 1: Minimal Service Worker (Push + Notification Click + App-like installation).
// No offline caching to prevent stale JS bundles and schema desync.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Push notification handler
// LUÔN hiện notification. Bản trước dò `visibilityState === 'visible'` rồi im lặng, nhưng
// `visibilityState` mà Service Worker thấy KHÔNG đáng tin: app bị đưa xuống nền mà chưa bị kill
// thì client vẫn còn, và giá trị đọng lại từ lúc trang bị đóng băng có thể vẫn là 'visible' —
// SW nuốt notification, người dùng không nhận được gì cho tới khi iOS kill hẳn app.
//
// Mất thông báo tệ hơn nhiều so với hiện trùng một lần. Việc dọn banner thừa giao cho TRANG:
// `document.visibilityState` đọc từ chính trang mới là sự thật (xem NotificationBell).
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  const tag = data.tag || undefined
  e.waitUntil(
    self.registration.showNotification(data.title || 'BadminClub', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
      tag,
    }).then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => {
        // Báo cho mọi trang đang mở để chuông cập nhật, kèm `tag` để trang tự đóng banner
        // nếu nó thật sự đang hiển thị trên màn hình.
        clients.forEach((c) => c.postMessage({ type: 'push-received', payload: data, tag }))
      })
  )
})

// Deep-link handler on notification click
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients[0]
      if (existing) {
        existing.postMessage({ type: 'navigate', url })
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
