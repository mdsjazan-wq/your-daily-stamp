/**
 * Native Notifications Service - Unified Notification Service
 * Uses Capacitor Local Notifications for native apps, Web Notifications for PWA
 */

// Check if running in Capacitor native app
export const isNativePlatform = (): boolean => {
  return typeof window !== 'undefined' && 
         'Capacitor' in window && 
         (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
};

// Check if notifications are supported
export const isNotificationsSupported = (): boolean => {
  if (isNativePlatform()) {
    return true; // Native always supports notifications
  }
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Initialize notifications
export const initializeNotifications = async (): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permResult = await LocalNotifications.checkPermissions();
      return permResult.display === 'granted';
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }
  return isNotificationsSupported();
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display as 'granted' | 'denied' | 'prompt';
    } catch (error) {
      console.error('Permission request failed:', error);
      return 'denied';
    }
  }

  // Web fallback
  if (!isNotificationsSupported()) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'denied';
  }
};

// Get current permission status
export const getNotificationPermissionStatus = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.checkPermissions();
      return result.display as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'denied';
    }
  }

  if (!isNotificationsSupported()) {
    return 'denied';
  }

  return Notification.permission as 'granted' | 'denied' | 'prompt';
};

// Notification options interface
export interface NotificationOptions {
  id?: number;
  title: string;
  body: string;
  smallIcon?: string;
  largeIcon?: string;
  sound?: string;
  vibrate?: boolean;
  ongoing?: boolean;
  autoCancel?: boolean;
  group?: string;
  tag?: string;
}

// Show a notification
export const showNotification = async (options: NotificationOptions): Promise<boolean> => {
  const notificationId = options.id || Date.now();

  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: options.title,
          body: options.body,
          smallIcon: options.smallIcon || 'ic_stat_icon',
          largeIcon: options.largeIcon,
          sound: options.sound,
          ongoing: options.ongoing || false,
          autoCancel: options.autoCancel !== false,
          group: options.group,
        }],
      });
      return true;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  // Web fallback
  if (!isNotificationsSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(options.title, {
        body: options.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: options.tag,
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: options.ongoing,
      });
    } else {
      new Notification(options.title, {
        body: options.body,
        icon: '/icons/icon-192x192.png',
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: options.ongoing,
      });
    }
    return true;
  } catch (error) {
    console.error('Web notification error:', error);
    return false;
  }
};

// Schedule a notification for a specific time
export const scheduleNotification = async (
  options: NotificationOptions,
  scheduleAt: Date
): Promise<boolean> => {
  const notificationId = options.id || Date.now();

  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: options.title,
          body: options.body,
          smallIcon: options.smallIcon || 'ic_stat_icon',
          schedule: {
            at: scheduleAt,
            allowWhileIdle: true,
          },
          sound: options.sound,
          autoCancel: options.autoCancel !== false,
        }],
      });
      return true;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return false;
    }
  }

  // Web fallback - use setTimeout
  const delay = scheduleAt.getTime() - Date.now();
  if (delay > 0) {
    setTimeout(() => {
      showNotification(options);
    }, delay);
    return true;
  }
  return false;
};

// Cancel a specific notification
export const cancelNotification = async (notificationId: number): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }
};

// Cancel all notifications
export const cancelAllNotifications = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }
};

// Get pending notifications
export const getPendingNotifications = async (): Promise<{ id: number; title?: string }[]> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const pending = await LocalNotifications.getPending();
      return pending.notifications.map(n => ({ id: n.id, title: n.title }));
    } catch {
      return [];
    }
  }
  return [];
};

// Register action listeners for notifications
export const registerNotificationListeners = async (
  onAction: (actionId: string, notificationId: number) => void
): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        onAction(notification.actionId, notification.notification.id);
      });
    } catch (error) {
      console.error('Failed to register notification listeners:', error);
    }
  }
};

// Remove all listeners
export const removeNotificationListeners = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.removeAllListeners();
    } catch (error) {
      console.error('Failed to remove notification listeners:', error);
    }
  }
};
