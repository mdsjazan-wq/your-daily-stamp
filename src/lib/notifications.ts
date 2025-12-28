// Notification Service for Push Notifications

// Notification sound using Web Audio API
let audioContext: AudioContext | null = null;
let activeAlarmInterval: number | null = null;
let isAlarmActive = false;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// إيقاف صوت الإنذار
export const stopAlarmSound = (): void => {
  isAlarmActive = false;
  if (activeAlarmInterval) {
    clearInterval(activeAlarmInterval);
    activeAlarmInterval = null;
  }
  // إيقاف الاهتزاز
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
};

// تشغيل نغمة واحدة
const playAlarmTone = async (): Promise<void> => {
  try {
    const ctx = getAudioContext();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    // نغمة صاعدة قوية
    for (let i = 0; i < 3; i++) {
      const startTime = now + (i * 0.2);
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(800 + (i * 400), startTime);
      gain.gain.setValueAtTime(1.0, startTime);
      gain.gain.exponentialRampToValueAtTime(0.1, startTime + 0.15);
      
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    }

    // اهتزاز قوي
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (error) {
    console.warn('Could not play alarm tone:', error);
  }
};

// تشغيل صوت إنذار مستمر حتى التفاعل
export const startAlarmSound = (): void => {
  if (isAlarmActive) return;
  if (!getNotificationSoundEnabled()) return;
  
  isAlarmActive = true;
  
  // تشغيل الصوت فوراً
  playAlarmTone();
  
  // تكرار الصوت كل ثانية
  activeAlarmInterval = window.setInterval(() => {
    if (isAlarmActive) {
      playAlarmTone();
    } else {
      stopAlarmSound();
    }
  }, 1000);
};

// Play notification sound once (للإشعارات العادية)
export const playNotificationSound = async (): Promise<void> => {
  if (!getNotificationSoundEnabled()) return;
  await playAlarmTone();
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
  options?: NotificationOptions & { vibrate?: number[]; actions?: { action: string; title: string }[]; persistent?: boolean }
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
    // تشغيل صوت مستمر للإشعارات المهمة
    if (options?.persistent) {
      startAlarmSound();
    } else {
      await playNotificationSound();
    }
    
    // Try using Service Worker for persistent notifications
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      dir: 'rtl',
      lang: 'ar',
      requireInteraction: true,
      ...options,
    } as NotificationOptions);
    return true;
  } catch (error) {
    // Fallback to regular notification
    try {
      const notification = new Notification(title, {
        icon: '/icons/icon-192x192.png',
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: true,
        ...options,
      });
      
      // إيقاف الصوت عند إغلاق الإشعار
      notification.onclick = () => {
        stopAlarmSound();
        notification.close();
      };
      notification.onclose = () => {
        stopAlarmSound();
      };
      
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
        persistent: true, // صوت مستمر
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
        persistent: true, // صوت مستمر
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
