/**
 * Android Foreground Service Integration
 * Uses @capawesome-team/capacitor-android-foreground-service plugin
 * for true background operation on Android
 */

import { isNativePlatform } from './nativeBleService';

// Service state
let isNativeForegroundServiceRunning = false;

/**
 * Check if native foreground service is available
 */
export const isNativeForegroundServiceAvailable = (): boolean => {
  return isNativePlatform();
};

/**
 * Start the native Android foreground service
 * This keeps the app running in background even with screen locked
 */
export const startNativeForegroundService = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('Native foreground service only available on Android');
    return false;
  }

  if (isNativeForegroundServiceRunning) {
    console.log('Native foreground service already running');
    return true;
  }

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    
    await ForegroundService.startForegroundService({
      id: 1000,
      title: 'بصمتي: تتبع Beacon قيد التشغيل',
      body: 'يتم مراقبة موقعك لتسجيل الحضور والانصراف تلقائياً',
      smallIcon: 'ic_stat_icon',
      buttons: [
        {
          title: 'إيقاف التتبع',
          id: 1,
        },
      ],
    });

    isNativeForegroundServiceRunning = true;
    console.log('✅ Native foreground service started');
    return true;
  } catch (error) {
    console.error('Failed to start native foreground service:', error);
    return false;
  }
};

/**
 * Stop the native Android foreground service
 */
export const stopNativeForegroundService = async (): Promise<void> => {
  if (!isNativePlatform() || !isNativeForegroundServiceRunning) {
    return;
  }

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    isNativeForegroundServiceRunning = false;
    console.log('⏹️ Native foreground service stopped');
  } catch (error) {
    console.error('Failed to stop native foreground service:', error);
  }
};

/**
 * Check if native foreground service is currently running
 */
export const isNativeForegroundServiceActive = (): boolean => {
  return isNativeForegroundServiceRunning;
};

/**
 * Update the foreground service notification
 */
export const updateForegroundNotification = async (title: string, body: string): Promise<void> => {
  if (!isNativePlatform() || !isNativeForegroundServiceRunning) {
    return;
  }

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.updateForegroundService({
      id: 1000,
      title,
      body,
      smallIcon: 'ic_stat_icon',
    });
  } catch (error) {
    console.error('Failed to update foreground notification:', error);
  }
};
