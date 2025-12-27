// Notification Service for Push Notifications

export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

export const showNotification = async (
  title: string, 
  options?: NotificationOptions & { vibrate?: number[]; actions?: { action: string; title: string }[] }
): Promise<boolean> => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.warn('Notification permission not granted');
    return false;
  }

  try {
    // Try using Service Worker for persistent notifications
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      dir: 'rtl',
      lang: 'ar',
      ...options,
    } as NotificationOptions);
    return true;
  } catch (error) {
    // Fallback to regular notification
    try {
      new Notification(title, {
        icon: '/icons/icon-192x192.png',
        dir: 'rtl',
        lang: 'ar',
        ...options,
      });
      return true;
    } catch (fallbackError) {
      console.error('Error showing notification:', fallbackError);
      return false;
    }
  }
};

// Schedule a notification check using the Page Visibility API and periodic checks
export const scheduleExitReminder = (
  expectedExitTime: string,
  reminderMinutes: number,
  onReminder: () => void
): (() => void) => {
  const parseTimeToMinutes = (timeStr: string): number => {
    const [time, period] = timeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let h = hours;
    if (period === "م" && hours !== 12) h += 12;
    if (period === "ص" && hours === 12) h = 0;
    return h * 60 + minutes;
  };

  let reminderSent = false;
  let exitConfirmSent = false;

  const checkTime = () => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const expectedMinutes = parseTimeToMinutes(expectedExitTime);
    const diff = expectedMinutes - currentMinutes;

    // Reminder before exit
    if (diff <= reminderMinutes && diff > 0 && !reminderSent) {
      reminderSent = true;
      showNotification('تنبيه الانصراف ⏰', {
        body: `تبقى ${diff} دقائق على وقت الانصراف`,
        tag: 'exit-reminder',
        requireInteraction: true,
      });
    }

    // 5 minutes after expected exit
    if (diff <= -5 && !exitConfirmSent) {
      exitConfirmSent = true;
      showNotification('هل قمت بتسجيل الخروج؟ 🚪', {
        body: 'مضت 5 دقائق على وقت الانصراف المتوقع',
        tag: 'exit-confirm',
        requireInteraction: true,
      });
      onReminder();
    }
  };

  // Check every 30 seconds
  const interval = setInterval(checkTime, 30000);
  checkTime(); // Initial check

  // Return cleanup function
  return () => clearInterval(interval);
};

// Save notification settings
export const saveNotificationSettings = (enabled: boolean): void => {
  localStorage.setItem('notificationsEnabled', JSON.stringify(enabled));
};

export const getNotificationSettings = (): boolean => {
  const saved = localStorage.getItem('notificationsEnabled');
  return saved ? JSON.parse(saved) : false;
};
