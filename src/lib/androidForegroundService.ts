/**
 * Android Foreground Service Integration
 * Uses @capawesome-team/capacitor-android-foreground-service plugin
 * for true background operation on Android
 * 
 * Google Play Compliance: Includes "Stop Tracking" button in notification
 */

import { isNativePlatform } from './nativeBleService';

// Service state
let isNativeForegroundServiceRunning = false;
let buttonClickListener: (() => void) | null = null;

// Callback for when user clicks "Stop Tracking" button in notification
let onStopRequestedCallback: (() => Promise<void>) | null = null;

/**
 * Set callback for when user requests to stop tracking from notification
 */
export const setOnStopRequestedCallback = (callback: (() => Promise<void>) | null): void => {
  onStopRequestedCallback = callback;
};

/**
 * Check if native foreground service is available
 */
export const isNativeForegroundServiceAvailable = (): boolean => {
  return isNativePlatform();
};

/**
 * Setup button click listener for the notification
 */
const setupButtonClickListener = async (): Promise<void> => {
  if (buttonClickListener) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    
    // Listen for button clicks
    buttonClickListener = await ForegroundService.addListener('buttonClicked', async (event) => {
      console.log('📱 Notification button clicked:', event.buttonId);
      
      // Button ID 1 = "Stop Tracking" button
      if (event.buttonId === 1) {
        console.log('🛑 User requested to stop tracking from notification');
        
        // Call the stop callback if registered
        if (onStopRequestedCallback) {
          await onStopRequestedCallback();
        }
      }
    }) as unknown as () => void;
    
    console.log('✅ Notification button listener registered');
  } catch (error) {
    console.error('Failed to setup button click listener:', error);
  }
};

/**
 * Remove button click listener
 */
const removeButtonClickListener = async (): Promise<void> => {
  if (!buttonClickListener) return;
  
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.removeAllListeners();
    buttonClickListener = null;
    console.log('🔇 Notification button listener removed');
  } catch (error) {
    console.error('Failed to remove button click listener:', error);
  }
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
    
    // Setup button click listener BEFORE starting service
    await setupButtonClickListener();
    
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
    console.log('✅ Native foreground service started with stop button');
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
    
    // Remove listener before stopping
    await removeButtonClickListener();
    
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
      buttons: [
        {
          title: 'إيقاف التتبع',
          id: 1,
        },
      ],
    });
  } catch (error) {
    console.error('Failed to update foreground notification:', error);
  }
};
