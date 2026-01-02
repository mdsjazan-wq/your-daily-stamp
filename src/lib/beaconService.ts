/**
 * Beacon Service for BC04P-MultiBeacon integration
 * Uses Native BLE for Capacitor apps, Web Bluetooth for PWA
 */

import {
  isNativePlatform,
  isBleSupported,
  initializeBle,
  scanForDevices,
  stopScan,
  BleDevice,
  estimateDistanceFromRssi,
  formatDistanceDisplay,
} from './nativeBleService';

// Beacon configuration interface
export interface BeaconConfig {
  uuid: string;
  major?: number;
  minor?: number;
  name?: string;
  enabled: boolean;
  autoCheckIn: boolean;
  autoCheckOut: boolean;
}

// Beacon detection result
export interface BeaconDetectionResult {
  detected: boolean;
  rssi?: number;
  distance?: number;
  timestamp: Date;
}

// Default BC04P-MultiBeacon UUID (can be customized via KBeaconPro app)
const DEFAULT_BEACON_UUID = 'E2C56DB5-DFFB-48D2-B060-D0F5A71096E0';

// Storage keys
const BEACON_CONFIG_KEY = 'beaconConfig';
const BEACON_HISTORY_KEY = 'beaconHistory';

/**
 * Get beacon configuration from localStorage
 */
export const getBeaconConfig = (): BeaconConfig => {
  const saved = localStorage.getItem(BEACON_CONFIG_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Return default if parsing fails
    }
  }
  return {
    uuid: DEFAULT_BEACON_UUID,
    enabled: false,
    autoCheckIn: true,
    autoCheckOut: false,
    name: 'BC04P-MultiBeacon',
  };
};

/**
 * Save beacon configuration to localStorage
 */
export const saveBeaconConfig = (config: BeaconConfig): void => {
  localStorage.setItem(BEACON_CONFIG_KEY, JSON.stringify(config));
};

/**
 * Check if BLE is supported (native or web)
 */
export const isWebBluetoothSupported = (): boolean => {
  return isBleSupported();
};

/**
 * Check if running in Capacitor (native app)
 */
export const isCapacitorApp = (): boolean => {
  return isNativePlatform();
};

/**
 * Initialize Bluetooth
 */
export const initializeBluetooth = async (): Promise<boolean> => {
  return await initializeBle();
};

/**
 * Scan for nearby Bluetooth devices
 * Uses native BLE for Capacitor, Web Bluetooth for PWA
 */
export const scanForBeacons = async (
  onDeviceFound?: (device: BleDevice) => void
): Promise<BleDevice | null> => {
  if (!isBleSupported()) {
    console.warn('Bluetooth is not supported');
    return null;
  }

  try {
    // Initialize BLE if native
    if (isNativePlatform()) {
      await initializeBle();
    }

    const devices = await scanForDevices(5000, onDeviceFound);
    
    if (devices.length > 0) {
      console.log('Beacon found:', devices[0].name, devices[0].deviceId);
      return devices[0];
    }
    
    return null;
  } catch (error) {
    console.error('Beacon scan error:', error);
    return null;
  }
};

/**
 * Stop scanning for devices
 */
export const stopBeaconScan = async (): Promise<void> => {
  await stopScan();
};

/**
 * Estimate distance from RSSI value
 */
export const estimateDistance = estimateDistanceFromRssi;

/**
 * Format distance for display
 */
export const formatDistance = formatDistanceDisplay;

/**
 * Log beacon detection event
 */
export const logBeaconEvent = (
  event: 'enter' | 'exit' | 'detected',
  details?: Record<string, unknown>
): void => {
  const history = getBeaconHistory();
  history.push({
    event,
    timestamp: new Date().toISOString(),
    ...details,
  });
  
  // Keep only last 100 events
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }
  
  localStorage.setItem(BEACON_HISTORY_KEY, JSON.stringify(history));
};

/**
 * Get beacon detection history
 */
export const getBeaconHistory = (): Array<{
  event: string;
  timestamp: string;
  [key: string]: unknown;
}> => {
  const saved = localStorage.getItem(BEACON_HISTORY_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  }
  return [];
};

/**
 * Clear beacon history
 */
export const clearBeaconHistory = (): void => {
  localStorage.removeItem(BEACON_HISTORY_KEY);
};

/**
 * Check beacon status (for manual check)
 * This simulates beacon detection for PWA
 * In a real native app, this would use proper beacon monitoring
 */
export const checkBeaconPresence = async (): Promise<BeaconDetectionResult> => {
  const config = getBeaconConfig();
  
  if (!config.enabled) {
    return {
      detected: false,
      timestamp: new Date(),
    };
  }

  // For PWA, we can only detect if the user manually initiates scanning
  // Full automatic detection requires native app with Capacitor
  return {
    detected: false,
    timestamp: new Date(),
  };
};

/**
 * Register attendance based on beacon detection
 */
export const registerBeaconAttendance = (type: 'entry' | 'exit'): void => {
  const now = new Date();
  const todayKey = now.toISOString().split('T')[0];
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time24 = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  // Format time in Arabic
  const period = hours >= 12 ? 'م' : 'ص';
  const hour12 = hours % 12 || 12;
  const timeArabic = `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  
  if (type === 'entry') {
    // Calculate expected exit time (capped at 5:00 PM)
    const entryMinutes = hours * 60 + minutes;
    const minTime = 7 * 60;
    const maxExitMinutes = 17 * 60;
    let exitTime24: string;

    if (entryMinutes <= minTime) {
      exitTime24 = '15:00';
    } else {
      const calculatedExitMinutes = entryMinutes + (8 * 60);
      if (calculatedExitMinutes > maxExitMinutes) {
        exitTime24 = '17:00';
      } else {
        const exitHours = Math.floor(calculatedExitMinutes / 60) % 24;
        const exitMinutes = calculatedExitMinutes % 60;
        exitTime24 = `${exitHours.toString().padStart(2, '0')}:${exitMinutes
          .toString()
          .padStart(2, '0')}`;
      }
    }

    // Format expected exit in Arabic
    const exitHour = parseInt(exitTime24.split(':')[0]);
    const exitMinute = parseInt(exitTime24.split(':')[1]);
    const exitPeriod = exitHour >= 12 ? 'م' : 'ص';
    const exitHour12 = exitHour % 12 || 12;
    const exitTimeArabic = `${exitHour12}:${exitMinute.toString().padStart(2, '0')} ${exitPeriod}`;
    
    // Determine status
    const status = entryMinutes > 9 * 60 ? 'متأخر' : 'منتظم';
    
    // Save today's data
    localStorage.setItem(`today_${todayKey}`, JSON.stringify({
      entryTime: timeArabic,
      expectedExitTime: exitTimeArabic,
      status,
      source: 'beacon',
    }));
    
    // Log event
    logBeaconEvent('enter', { time: timeArabic, time24, status });
    
  } else {
    // Update exit time
    const todayData = localStorage.getItem(`today_${todayKey}`);
    if (todayData) {
      const data = JSON.parse(todayData);
      data.actualExitTime = timeArabic;
      data.source = 'beacon';
      localStorage.setItem(`today_${todayKey}`, JSON.stringify(data));
    }
    
    // Log event
    logBeaconEvent('exit', { time: timeArabic, time24 });
  }
  
  // Dispatch event to update UI
  window.dispatchEvent(new CustomEvent('beaconAttendance', { detail: { type, time: timeArabic } }));
};
