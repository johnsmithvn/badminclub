// Service Worker for BadminClub PWA
// Phase 1: Minimal Service Worker (Push + Notification Click + App-like installation).
// No offline caching to prevent stale JS bundles and schema desync.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Push notification handler
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? {}
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const visible = clients.find((c) => c.visibilityState === 'visible')
      if (visible) {
        visible.postMessage({ type: 'push-received', payload: data })
        return
      }
      return self.registration.showNotification(data.title || 'BadminClub', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/' },
        tag: data.tag || undefined,
      })
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
