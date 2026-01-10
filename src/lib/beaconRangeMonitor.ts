/**
 * Beacon Range Monitor Service
 * Handles RSSI-based range detection with hysteresis and stability logic
 */

import {
  isNativePlatform,
  initializeBle,
  BleDevice,
} from './nativeBleService';

// Range preset types
export type RangePreset = 'veryClose' | 'close' | 'medium' | 'far' | 'custom';

// Range settings interface
export interface BeaconRangeSettings {
  preset: RangePreset;
  customRssiThreshold: number; // -95 to -40
  customExitThreshold?: number; // Custom exit threshold (optional)
  useCustomExitThreshold?: boolean; // Whether to use custom exit threshold
  exitConfirmSeconds: number; // How long to wait before confirming exit
  scanIntervalSeconds: number; // How often to scan
  requiredConsecutiveReadings: number; // Required consecutive readings for entry
}

// Range state interface
export interface RangeState {
  isInRange: boolean;
  lastEnterEventAt: string | null;
  lastExitEventAt: string | null;
  lastAutoCheckInAt: string | null;
  lastAutoCheckOutAt: string | null;
  consecutiveInRangeCount: number;
  consecutiveOutRangeCount: number;
  lastRssi: number | null;
  lastSeen: string | null;
}

// Scan result with extended info
export interface BeaconScanResult extends BleDevice {
  uuid?: string;
  major?: number;
  minor?: number;
  lastSeen: Date;
  isInRange: boolean;
  rangeStatus: 'inside' | 'outside' | 'unknown';
}

// Storage keys
const RANGE_SETTINGS_KEY = 'beaconRangeSettings';
const RANGE_STATE_KEY = 'beaconRangeState';

// Preset RSSI thresholds
export const PRESET_RSSI_VALUES: Record<Exclude<RangePreset, 'custom'>, number> = {
  veryClose: -60,
  close: -70,
  medium: -80,
  far: -90,
};

// Preset labels in Arabic
export const PRESET_LABELS: Record<Exclude<RangePreset, 'custom'>, string> = {
  veryClose: 'قريب جداً',
  close: 'قريب',
  medium: 'متوسط',
  far: 'بعيد',
};

// Hysteresis offset (dB difference between entry and exit thresholds)
const HYSTERESIS_OFFSET = 8;

// Debounce duration in milliseconds (5 minutes)
const DEBOUNCE_DURATION_MS = 5 * 60 * 1000;

/**
 * Get range settings from localStorage
 */
export const getRangeSettings = (): BeaconRangeSettings => {
  const saved = localStorage.getItem(RANGE_SETTINGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Return default if parsing fails
    }
  }
  return {
    preset: 'medium',
    customRssiThreshold: -75,
    exitConfirmSeconds: 15,
    scanIntervalSeconds: 5,
    requiredConsecutiveReadings: 3,
  };
};

/**
 * Save range settings to localStorage
 */
export const saveRangeSettings = (settings: BeaconRangeSettings): void => {
  localStorage.setItem(RANGE_SETTINGS_KEY, JSON.stringify(settings));
};

/**
 * Get range state from localStorage
 */
export const getRangeState = (): RangeState => {
  const saved = localStorage.getItem(RANGE_STATE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Return default if parsing fails
    }
  }
  return {
    isInRange: false,
    lastEnterEventAt: null,
    lastExitEventAt: null,
    lastAutoCheckInAt: null,
    lastAutoCheckOutAt: null,
    consecutiveInRangeCount: 0,
    consecutiveOutRangeCount: 0,
    lastRssi: null,
    lastSeen: null,
  };
};

/**
 * Save range state to localStorage
 */
export const saveRangeState = (state: RangeState): void => {
  localStorage.setItem(RANGE_STATE_KEY, JSON.stringify(state));
};

/**
 * Get current RSSI threshold based on settings
 */
export const getCurrentRssiThreshold = (settings?: BeaconRangeSettings): number => {
  const s = settings || getRangeSettings();
  if (s.preset === 'custom') {
    return s.customRssiThreshold;
  }
  return PRESET_RSSI_VALUES[s.preset];
};

/**
 * Get entry threshold (same as RSSI threshold)
 */
export const getEntryThreshold = (settings?: BeaconRangeSettings): number => {
  return getCurrentRssiThreshold(settings);
};

/**
 * Get exit threshold (with hysteresis or custom value)
 */
export const getExitThreshold = (settings?: BeaconRangeSettings): number => {
  const s = settings || getRangeSettings();
  // Use custom exit threshold if enabled and preset is custom
  if (s.preset === 'custom' && s.useCustomExitThreshold && s.customExitThreshold !== undefined) {
    return s.customExitThreshold;
  }
  return getCurrentRssiThreshold(s) - HYSTERESIS_OFFSET;
};

/**
 * Check if device matches target UUID
 */
export const matchesBeaconUuid = (
  device: BleDevice,
  targetUuid: string
): boolean => {
  if (!targetUuid || targetUuid.trim() === '') {
    return false;
  }
  
  const normalizedTarget = targetUuid.toLowerCase().replace(/-/g, '');
  
  // Check service UUIDs
  if (device.serviceUuids) {
    const match = device.serviceUuids.some(uuid => 
      uuid.toLowerCase().replace(/-/g, '').includes(normalizedTarget) ||
      normalizedTarget.includes(uuid.toLowerCase().replace(/-/g, ''))
    );
    if (match) return true;
  }
  
  // Check iBeacon manufacturer data (Apple's company ID: 0x004C)
  if (device.manufacturerData) {
    const appleData = device.manufacturerData['76']; // 0x004C in decimal
    if (appleData && appleData.length >= 23) {
      // iBeacon format: type (1) + length (1) + UUID (16) + major (2) + minor (2) + txPower (1)
      if (appleData[0] === 0x02 && appleData[1] === 0x15) {
        const uuidBytes = appleData.slice(2, 18);
        const extractedUuid = uuidBytes.map(b => b.toString(16).padStart(2, '0')).join('');
        if (extractedUuid.includes(normalizedTarget) || normalizedTarget.includes(extractedUuid)) {
          return true;
        }
      }
    }
  }
  
  return false;
};

/**
 * Check if device matches target by name (fallback)
 */
export const matchesBeaconName = (
  device: BleDevice,
  targetName?: string
): boolean => {
  const name = device.name?.toLowerCase() || '';
  
  // If specific target name provided
  if (targetName && targetName.trim() !== '') {
    return name.includes(targetName.toLowerCase());
  }
  
  // Default beacon name patterns
  return name.includes('beacon') || name.includes('bc04');
};

/**
 * Unified device matching function
 */
export const matchesBeaconIdentifier = (
  device: BleDevice,
  uuid?: string,
  name?: string
): { matches: boolean; matchType: 'uuid' | 'name' | 'none' } => {
  // Try UUID match first (more secure)
  if (uuid && uuid.trim() !== '') {
    if (matchesBeaconUuid(device, uuid)) {
      return { matches: true, matchType: 'uuid' };
    }
  }
  
  // Fallback to name match
  if (matchesBeaconName(device, name)) {
    return { matches: true, matchType: 'name' };
  }
  
  return { matches: false, matchType: 'none' };
};

/**
 * Check if RSSI indicates device is in range
 */
export const isRssiInRange = (rssi: number, settings?: BeaconRangeSettings): boolean => {
  const state = getRangeState();
  const entryThreshold = getEntryThreshold(settings);
  const exitThreshold = getExitThreshold(settings);
  
  // If already in range, use exit threshold (hysteresis)
  if (state.isInRange) {
    return rssi >= exitThreshold;
  }
  
  // If not in range, use entry threshold
  return rssi >= entryThreshold;
};

/**
 * Process a scan result and update state
 * Returns true if a state change occurred (enter/exit event)
 */
export const processScanResult = (
  rssi: number | null,
  settings?: BeaconRangeSettings
): { event: 'enter' | 'exit' | null; state: RangeState } => {
  const s = settings || getRangeSettings();
  const state = getRangeState();
  const now = new Date().toISOString();
  
  let event: 'enter' | 'exit' | null = null;
  
  if (rssi !== null) {
    // Update last seen
    state.lastRssi = rssi;
    state.lastSeen = now;
    
    const inRange = isRssiInRange(rssi, s);
    
    if (inRange) {
      state.consecutiveInRangeCount++;
      state.consecutiveOutRangeCount = 0;
      
      // Check for entry event
      if (!state.isInRange && state.consecutiveInRangeCount >= s.requiredConsecutiveReadings) {
        // Check debounce
        if (!state.lastEnterEventAt || 
            (Date.now() - new Date(state.lastEnterEventAt).getTime()) > DEBOUNCE_DURATION_MS) {
          state.isInRange = true;
          state.lastEnterEventAt = now;
          event = 'enter';
        }
      }
    } else {
      state.consecutiveOutRangeCount++;
      state.consecutiveInRangeCount = 0;
    }
  } else {
    // No beacon found
    state.consecutiveOutRangeCount++;
    state.consecutiveInRangeCount = 0;
  }
  
  // Check for exit event (either weak signal or no detection)
  const exitReadingsRequired = Math.ceil(s.exitConfirmSeconds / s.scanIntervalSeconds);
  if (state.isInRange && state.consecutiveOutRangeCount >= exitReadingsRequired) {
    // Check debounce
    if (!state.lastExitEventAt || 
        (Date.now() - new Date(state.lastExitEventAt).getTime()) > DEBOUNCE_DURATION_MS) {
      state.isInRange = false;
      state.lastExitEventAt = now;
      event = 'exit';
    }
  }
  
  saveRangeState(state);
  return { event, state };
};

/**
 * Reset range state (for manual override or testing)
 */
export const resetRangeState = (): void => {
  saveRangeState({
    isInRange: false,
    lastEnterEventAt: null,
    lastExitEventAt: null,
    lastAutoCheckInAt: null,
    lastAutoCheckOutAt: null,
    consecutiveInRangeCount: 0,
    consecutiveOutRangeCount: 0,
    lastRssi: null,
    lastSeen: null,
  });
};

/**
 * Update auto check-in timestamp
 */
export const updateAutoCheckInTime = (): void => {
  const state = getRangeState();
  state.lastAutoCheckInAt = new Date().toISOString();
  saveRangeState(state);
};

/**
 * Update auto check-out timestamp
 */
export const updateAutoCheckOutTime = (): void => {
  const state = getRangeState();
  state.lastAutoCheckOutAt = new Date().toISOString();
  saveRangeState(state);
};

/**
 * Check if auto check-in is allowed (not done today)
 */
export const canAutoCheckIn = (): boolean => {
  const state = getRangeState();
  if (!state.lastAutoCheckInAt) return true;
  
  const lastDate = new Date(state.lastAutoCheckInAt).toDateString();
  const today = new Date().toDateString();
  return lastDate !== today;
};

/**
 * Check if auto check-out is allowed (checked in today, not checked out)
 */
export const canAutoCheckOut = (): boolean => {
  const state = getRangeState();
  if (!state.lastAutoCheckInAt) return false;
  
  const lastCheckInDate = new Date(state.lastAutoCheckInAt).toDateString();
  const today = new Date().toDateString();
  
  // Must have checked in today
  if (lastCheckInDate !== today) return false;
  
  // Must not have already checked out today
  if (state.lastAutoCheckOutAt) {
    const lastCheckOutDate = new Date(state.lastAutoCheckOutAt).toDateString();
    if (lastCheckOutDate === today) return false;
  }
  
  return true;
};

/**
 * Format time for display in Arabic
 */
export const formatTimeArabic = (isoString: string | null): string => {
  if (!isoString) return 'غير متوفر';
  
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'م' : 'ص';
  const hour12 = hours % 12 || 12;
  
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Initialize BLE for scanning
 */
export const initializeRangeMonitor = async (): Promise<boolean> => {
  if (isNativePlatform()) {
    return await initializeBle();
  }
  return true;
};
