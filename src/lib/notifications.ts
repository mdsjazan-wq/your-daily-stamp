// Notification Service for Push Notifications

// Notification sound using Web Audio API
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Play notification sound - صوت قوي ومتكرر للتنبيه
export const playNotificationSound = async (): Promise<void> => {
  if (!getNotificationSoundEnabled()) return;
  
  try {
    const ctx = getAudioContext();
    
    // Resume audio context if suspended (required by browsers)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // تشغيل الصوت 3 مرات للتأكد من سماعه
    for (let repeat = 0; repeat < 3; repeat++) {
      const startTime = ctx.currentTime + (repeat * 0.6);
      
      // النغمة الأولى - عالية
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(1200, startTime);
      gain1.gain.setValueAtTime(1.0, startTime); // صوت أقوى
      gain1.gain.exponentialRampToValueAtTime(0.3, startTime + 0.15);
      osc1.start(startTime);
      osc1.stop(startTime + 0.15);

      // النغمة الثانية - أعلى
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(1600, startTime + 0.15);
      gain2.gain.setValueAtTime(1.0, startTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.3, startTime + 0.3);
      osc2.start(startTime + 0.15);
      osc2.stop(startTime + 0.3);

      // النغمة الثالثة - الأعلى
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.setValueAtTime(2000, startTime + 0.3);
      gain3.gain.setValueAtTime(1.0, startTime + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      osc3.start(startTime + 0.3);
      osc3.stop(startTime + 0.5);
    }

    // تفعيل الاهتزاز للجوال (نمط قوي ومتكرر)
    if ('vibrate' in navigator) {
      navigator.vibrate([300, 100, 300, 100, 300, 100, 500, 200, 500]);
    }
  } catch (error) {
    console.warn('Could not play notification sound:', error);
  }
};

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
    // Play sound when notification is shown
    await playNotificationSound();
    
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

    // Get configured exit reminder minutes (default 5)
    const exitReminderMinutes = parseInt(localStorage.getItem("exitReminderMinutes") || "5", 10);

    // Configured minutes after expected exit
    if (diff <= -exitReminderMinutes && !exitConfirmSent) {
      exitConfirmSent = true;
      showNotification('هل قمت بتسجيل الخروج؟ 🚪', {
        body: `مضت ${exitReminderMinutes} دقائق على وقت الانصراف المتوقع`,
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

// Sound settings
export const saveNotificationSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem('notificationSoundEnabled', JSON.stringify(enabled));
};

export const getNotificationSoundEnabled = (): boolean => {
  const saved = localStorage.getItem('notificationSoundEnabled');
  return saved ? JSON.parse(saved) : true; // Default to enabled
};
