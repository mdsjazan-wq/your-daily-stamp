/**
 * Native Foreground Service Manager
 * Handles background BLE scanning on Android using Capacitor
 * 
 * Note: True foreground service requires native Android code.
 * This module provides the TypeScript interface and uses available
 * Capacitor plugins for background task management.
 */

import { isNativePlatform } from './nativeBleService';
import { startBeaconScan, stopBeaconScan, ScannedBeacon } from './nativeBeaconScanner';
import { processScanResultNative, recordAutoCheckIn, recordAutoCheckOut, canAutoCheckIn, canAutoCheckOut, isWorkingDay, isExitTimeAllowed, hasMinimumWorkDuration, BeaconRangeState } from './beaconStateManager';
import { SCAN_INTERVAL_SECONDS, SCAN_DURATION_MS, FIXED_BEACON_UUID } from './beaconConstants';
import { playEntrySound, playExitSound, getAudioSettings } from './beaconAudio';
import { showNotification } from './nativeNotifications';
import { logBeaconEvent, registerBeaconAttendance } from './beaconService';
import { addDiagnosticEntry } from './beaconDiagnostics';

// Service state
let isServiceRunning = false;
let scanIntervalId: ReturnType<typeof setInterval> | null = null;
let onStateChangeCallback: ((state: BeaconRangeState) => void) | null = null;

// Storage key for service state
const SERVICE_STATE_KEY = 'beaconServiceEnabled';

/**
 * Check if foreground service is running
 */
export const isBeaconServiceRunning = (): boolean => {
  return isServiceRunning;
};

/**
 * Get stored service enabled state
 */
export const getStoredServiceState = (): boolean => {
  return localStorage.getItem(SERVICE_STATE_KEY) === 'true';
};

/**
 * Save service enabled state
 */
const saveServiceState = (enabled: boolean): void => {
  localStorage.setItem(SERVICE_STATE_KEY, enabled ? 'true' : 'false');
};

/**
 * Set callback for state changes
 */
export const setStateChangeCallback = (callback: ((state: BeaconRangeState) => void) | null): void => {
  onStateChangeCallback = callback;
};

/**
 * Perform a single background scan cycle
 */
const performBackgroundScan = async (): Promise<void> => {
  let targetBeacon: ScannedBeacon | null = null;

  addDiagnosticEntry('scan_start', 'بدء المسح الدوري');

  await startBeaconScan(
    SCAN_DURATION_MS,
    (beacon) => {
      // Only consider beacons that match our target UUID
      if (beacon.matchesTarget) {
        // Keep the strongest signal if multiple detections
        if (!targetBeacon || beacon.rssi > targetBeacon.rssi) {
          targetBeacon = beacon;
          console.log(`📡 Beacon detected: RSSI ${beacon.rssi}`);
          addDiagnosticEntry('beacon_found', `تم اكتشاف Beacon`, { 
            rssi: beacon.rssi,
            details: { deviceId: beacon.deviceId, matchesTarget: beacon.matchesTarget }
          });
        }
      }
    }
  );

  // Wait for scan to complete before stopping
  await new Promise(resolve => setTimeout(resolve, SCAN_DURATION_MS + 200));
  
  // Stop scan after duration
  await stopBeaconScan();

  // Process the result
  const rssi = targetBeacon?.rssi ?? null;
  
  if (rssi === null) {
    addDiagnosticEntry('scan_end', 'انتهى المسح - لم يتم العثور على الجهاز');
  } else {
    addDiagnosticEntry('scan_end', `انتهى المسح - RSSI: ${rssi}`, { rssi });
  }
  
  const { event, state } = processScanResultNative(rssi);
  console.log(`📊 State: inRange=${state.isInRange}, consecutiveIn=${state.consecutiveInRangeCount}`);

  // Notify callback
  onStateChangeCallback?.(state);

  // Handle entry event - determine if check-in or check-out
  if (event === 'enter') {
    console.log(`🚀 Entry event triggered!`);
    addDiagnosticEntry('entry', 'دخول نطاق Beacon', { rssi, details: { state: state.isInRange } });
    await handleRangeEnter();
  }
};

/**
 * Handle entering the beacon range
 * Determines whether to check-in or check-out based on current state
 */
const handleRangeEnter = async (): Promise<void> => {
  // Skip on weekends
  if (!isWorkingDay()) {
    console.log('Beacon range entered: Skipping - weekend day');
    addDiagnosticEntry('info', 'تخطي - يوم إجازة');
    return;
  }

  // Determine action based on today's attendance state
  if (canAutoCheckIn()) {
    // No check-in today yet → perform check-in
    await handleAutoCheckIn();
  } else if (canAutoCheckOut()) {
    // Already checked in today + meets all conditions → perform check-out
    await handleAutoCheckOut();
  } else {
    // Already checked in but conditions not met for check-out
    console.log('Beacon range entered: Check-in already done, check-out conditions not met');
    addDiagnosticEntry('info', 'تم تسجيل الحضور سابقاً - شروط الانصراف غير مستوفاة');
  }
};

/**
 * Handle automatic check-in
 */
const handleAutoCheckIn = async (): Promise<void> => {
  // Skip check-in on weekends
  if (!isWorkingDay()) {
    console.log('Skipping auto check-in: weekend');
    addDiagnosticEntry('info', 'تخطي تسجيل الحضور - يوم إجازة');
    return;
  }

  addDiagnosticEntry('check_in', '✅ تسجيل حضور تلقائي');

  const audioSettings = getAudioSettings();
  
  // Play entry sound
  if (audioSettings.entryEnabled) {
    await playEntrySound(audioSettings.volume);
  }

  // Show notification
  await showNotification({
    title: 'تسجيل الدخول التلقائي',
    body: 'تم الدخول إلى نطاق Beacon - تم تسجيل الحضور',
    id: 1001,
  });

  // Record the check-in in beacon state
  recordAutoCheckIn();
  
  // Register the attendance in the main app data
  registerBeaconAttendance('entry');
  
  // Log event
  logBeaconEvent('enter', { auto: true, uuid: FIXED_BEACON_UUID });
};

/**
 * Handle automatic check-out
 */
const handleAutoCheckOut = async (): Promise<void> => {
  // Check if exit is allowed by business rules
  const exitCheck = isExitTimeAllowed();
  if (!exitCheck.allowed) {
    console.log(`Skipping auto check-out: ${exitCheck.reason}`);
    addDiagnosticEntry('info', `تخطي تسجيل الانصراف - ${exitCheck.reason}`);
    return;
  }

  // Check minimum work duration (4 hours)
  if (!hasMinimumWorkDuration()) {
    console.log('Skipping auto check-out: minimum work duration not met (4 hours required)');
    addDiagnosticEntry('info', 'تخطي تسجيل الانصراف - لم تكتمل المدة المطلوبة');
    return;
  }

  addDiagnosticEntry('check_out', '👋 تسجيل انصراف تلقائي');

  const audioSettings = getAudioSettings();
  
  // Play exit sound
  if (audioSettings.exitEnabled) {
    await playExitSound(audioSettings.volume);
  }

  // Show notification
  await showNotification({
    title: 'تسجيل الخروج التلقائي',
    body: 'تم الدخول إلى نطاق Beacon - تم تسجيل الانصراف',
    id: 1002,
  });

  // Record the check-out in beacon state
  recordAutoCheckOut();
  
  // Register the attendance in the main app data
  registerBeaconAttendance('exit');
  
  // Log event
  logBeaconEvent('exit', { auto: true });
};

/**
 * Start the beacon monitoring service
 */
export const startBeaconService = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.warn('Beacon service is only available on Native platform');
    return false;
  }

  if (isServiceRunning) {
    console.log('Beacon service is already running');
    return true;
  }

  try {
    // Show persistent notification (required for foreground service)
    await showNotification({
      title: 'التسجيل التلقائي قيد التشغيل',
      body: 'يتم مراقبة Beacon للتسجيل التلقائي',
      id: 1000,
      ongoing: true,
      autoCancel: false,
    });

    // Start periodic scanning
    scanIntervalId = setInterval(performBackgroundScan, SCAN_INTERVAL_SECONDS * 1000);
    
    // Perform initial scan
    performBackgroundScan();

    isServiceRunning = true;
    saveServiceState(true);
    
    console.log('Beacon service started');
    return true;
  } catch (error) {
    console.error('Failed to start beacon service:', error);
    return false;
  }
};

/**
 * Stop the beacon monitoring service
 */
export const stopBeaconService = async (): Promise<void> => {
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
  }

  await stopBeaconScan();

  // Cancel persistent notification
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: 1000 }] });
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }

  isServiceRunning = false;
  saveServiceState(false);
  
  console.log('Beacon service stopped');
};

/**
 * Toggle beacon service
 */
export const toggleBeaconService = async (enable: boolean): Promise<boolean> => {
  if (enable) {
    return await startBeaconService();
  } else {
    await stopBeaconService();
    return true;
  }
};

/**
 * Restore service state on app launch
 */
export const restoreBeaconService = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  
  const wasEnabled = getStoredServiceState();
  if (wasEnabled) {
    await startBeaconService();
  }
};
