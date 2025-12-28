/**
 * Beacon Service for BC04P-MultiBeacon integration
 * Uses Web Bluetooth API for PWA compatibility
 * For full native support, Capacitor plugins would be needed
 */

// Web Bluetooth API types (not all browsers support this)
interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  device: BluetoothDevice;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
}

interface Bluetooth {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
    optionalServices?: string[];
  }): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    bluetooth?: Bluetooth;
  }
}

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
 * Check if Web Bluetooth is supported
 */
export const isWebBluetoothSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
};

/**
 * Check if running in Capacitor (native app)
 */
export const isCapacitorApp = (): boolean => {
  return typeof window !== 'undefined' && 
         'Capacitor' in window && 
         (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
};

/**
 * Scan for nearby Bluetooth devices
 * Note: This requires user interaction and works only on supported browsers
 */
export const scanForBeacons = async (): Promise<BluetoothDevice | null> => {
  if (!isWebBluetoothSupported()) {
    console.warn('Web Bluetooth is not supported in this browser');
    return null;
  }

  try {
    // Request Bluetooth device - this will show the browser's device picker
    const device = await navigator.bluetooth!.requestDevice({
      // Accept all devices for beacon scanning
      acceptAllDevices: true,
      optionalServices: ['battery_service', 'device_information'],
    });

    console.log('Beacon found:', device.name, device.id);
    return device;
  } catch (error) {
    console.error('Beacon scan error:', error);
    return null;
  }
};

/**
 * Estimate distance from RSSI value
 * Uses a simple path loss model
 */
export const estimateDistance = (rssi: number, txPower: number = -59): number => {
  if (rssi === 0) return -1;
  
  const ratio = rssi / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  }
  return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
  if (meters < 0) return 'غير معروف';
  if (meters < 1) return `${Math.round(meters * 100)} سم`;
  if (meters < 10) return `${meters.toFixed(1)} متر`;
  return `${Math.round(meters)} متر`;
};

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
    // Calculate expected exit time
    const entryMinutes = hours * 60 + minutes;
    const minTime = 7 * 60;
    let exitTime24: string;
    
    if (entryMinutes <= minTime) {
      exitTime24 = '15:00';
    } else {
      const exitHours = (hours + 8) % 24;
      exitTime24 = `${exitHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
