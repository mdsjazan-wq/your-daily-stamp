// Custom Service Worker for Push Notifications

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  
  if (action === 'yes') {
    // User confirmed they checked out - broadcast message to app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: 'checkout-confirmed',
          });
        });
        
        // Focus or open the app
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  } else if (action === 'no') {
    // User hasn't checked out - open app to remind them
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  } else {
    // Default click - open app
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});

// Handle push events (for future server-side push)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const title = data.title || 'بصمتي';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    ...data.options,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
