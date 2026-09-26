/* Golgoth: end-of-rest notifications sent by the push server (loaded by the Workbox service worker). */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'Repos terminé', {
      body: data.body || 'Série suivante.',
      tag: data.tag || 'golgoth-rest',
      renotify: true,
      icon: new URL('icons/pwa-192.png', scope).href,
      badge: new URL('icons/badge-96.png', scope).href,
      timestamp: typeof data.at === 'number' ? data.at : Date.now(),
      data: { url: new URL(data.url || './', scope).href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus()
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url)
    })(),
  )
})
