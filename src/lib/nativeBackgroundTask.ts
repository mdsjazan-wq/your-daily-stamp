/**
 * Native Background Task Manager
 * Uses @capawesome/capacitor-background-task for true background operation
 * Works with foreground service to keep BLE scanning running
 */

import { Capacitor } from '@capacitor/core';

let isBackgroundTaskActive = false;
let currentTaskId: string | null = null;

/**
 * Check if native background task is available
 */
export const isNativeBackgroundTaskAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Start background task when app goes to background
 * This keeps the JavaScript context alive for a longer period
 */
export const startBackgroundTask = async (
  onBackground: () => Promise<void>
): Promise<void> => {
  if (!isNativeBackgroundTaskAvailable()) {
    console.log('Background task not available on this platform');
    return;
  }

  try {
    const { BackgroundTask } = await import('@capawesome/capacitor-background-task');
    const { App } = await import('@capacitor/app');

    // Listen for app state changes
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        // App came to foreground - finish any background task
        if (currentTaskId) {
          console.log('🔄 App foreground - finishing background task');
          await BackgroundTask.finish({ taskId: currentTaskId });
          currentTaskId = null;
          isBackgroundTaskActive = false;
        }
        return;
      }

      // App went to background - start background task
      console.log('📱 App background - starting background task');
      isBackgroundTaskActive = true;
      
      currentTaskId = await BackgroundTask.beforeExit(async () => {
        console.log('🔋 Background task started');
        
        // Run the background work
        await onBackground();
        
        // Note: On Android with foreground service, this task can run indefinitely
        // The finish() call will be made when app comes back to foreground
      });
    });

    console.log('✅ Background task listener registered');
  } catch (error) {
    console.error('Failed to setup background task:', error);
  }
};

/**
 * Stop background task listener
 */
export const stopBackgroundTask = async (): Promise<void> => {
  if (!isNativeBackgroundTaskAvailable()) return;

  try {
    const { BackgroundTask } = await import('@capawesome/capacitor-background-task');
    const { App } = await import('@capacitor/app');

    // Remove listener
    await App.removeAllListeners();

    // Finish any active task
    if (currentTaskId) {
      await BackgroundTask.finish({ taskId: currentTaskId });
      currentTaskId = null;
    }

    isBackgroundTaskActive = false;
    console.log('⏹️ Background task stopped');
  } catch (error) {
    console.error('Failed to stop background task:', error);
  }
};

/**
 * Check if background task is currently active
 */
export const isBackgroundTaskRunning = (): boolean => {
  return isBackgroundTaskActive;
};
