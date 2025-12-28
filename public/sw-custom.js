// Custom Service Worker for Push Notifications

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  
  // إرسال رسالة لإيقاف صوت الإنذار
  const stopAlarmAndNotify = (clients, messageType) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'STOP_ALARM',
      });
      if (messageType) {
        client.postMessage({
          type: 'NOTIFICATION_ACTION',
          action: messageType,
        });
      }
    });
  };
  
  if (action === 'yes') {
    // User confirmed they checked out
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        stopAlarmAndNotify(clients, 'checkout-confirmed');
        
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  } else if (action === 'no') {
    // User hasn't checked out
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        stopAlarmAndNotify(clients, null);
        
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  } else {
    // Default click
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        stopAlarmAndNotify(clients, null);
        
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
    );
  }
});

// إيقاف الإنذار عند إغلاق الإشعار
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'STOP_ALARM',
        });
      });
    })
  );
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
