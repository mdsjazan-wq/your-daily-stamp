/**
 * Beacon State Manager - Handles range state with stability logic
 * Prevents oscillation using hysteresis and consecutive readings
 */

import {
  DEFAULT_RSSI_ENTRY_THRESHOLD,
  RSSI_EXIT_THRESHOLD,
  CONSECUTIVE_READS_REQUIRED,
  DEBOUNCE_DURATION_MS,
  DEFAULT_MIN_WORK_DURATION_HOURS,
  WORK_START_HOUR,
  WEEKEND_DAYS,
  IMMEDIATE_RSSI_THRESHOLD,
  calculateDistanceFromRssi,
  formatDistanceArabic,
} from './beaconConstants';

// Settings storage key (shared with hook)
const SETTINGS_STORAGE_KEY = 'nativeBeaconSettings';

/**
 * Get user-configured RSSI threshold (or default)
 */
const getRssiThreshold = (): number => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      return settings.rssiThreshold ?? DEFAULT_RSSI_ENTRY_THRESHOLD;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_RSSI_ENTRY_THRESHOLD;
};

/**
 * Get user-configured minimum work hours (or default)
 */
const getMinWorkHours = (): number => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      return settings.minWorkHours ?? DEFAULT_MIN_WORK_DURATION_HOURS;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_MIN_WORK_DURATION_HOURS;
};

// Range state interface
export interface BeaconRangeState {
  isInRange: boolean;
  lastEnterAt: string | null;
  lastExitAt: string | null;
  lastAutoCheckInAt: string | null;
  lastAutoCheckOutAt: string | null;
  lastSeen: string | null;
  lastRssi: number | null;
  lastDistance: number | null;
  consecutiveInRangeCount: number;
  consecutiveOutRangeCount: number;
}

// Event types
export type RangeEvent = 'enter' | 'exit' | null;

// Storage key
const STATE_STORAGE_KEY = 'nativeBeaconState';

/**
 * Get current range state from localStorage
 */
export const getBeaconRangeState = (): BeaconRangeState => {
  try {
    const saved = localStorage.getItem(STATE_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }

  return {
    isInRange: false,
    lastEnterAt: null,
    lastExitAt: null,
    lastAutoCheckInAt: null,
    lastAutoCheckOutAt: null,
    lastSeen: null,
    lastRssi: null,
    lastDistance: null,
    consecutiveInRangeCount: 0,
    consecutiveOutRangeCount: 0,
  };
};

/**
 * Save range state to localStorage
 */
export const saveBeaconRangeState = (state: BeaconRangeState): void => {
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
};

/**
 * Process a scan result and update state
 * Returns the event type if a state change occurred
 */
export const processScanResultNative = (
  rssi: number | null
): { event: RangeEvent; state: BeaconRangeState } => {
  const state = getBeaconRangeState();
  const now = new Date().toISOString();
  let event: RangeEvent = null;

  if (rssi !== null) {
    // Update last seen info
    state.lastRssi = rssi;
    state.lastSeen = now;
    state.lastDistance = calculateDistanceFromRssi(rssi);

    // Check if RSSI indicates in-range (use user-configured threshold)
    const rssiThreshold = getRssiThreshold();
    const isCurrentlyInRange = rssi >= rssiThreshold;
    
    // Check for very strong signal (immediate registration)
    const isVeryStrongSignal = rssi >= IMMEDIATE_RSSI_THRESHOLD;

    if (isCurrentlyInRange) {
      state.consecutiveInRangeCount++;
      state.consecutiveOutRangeCount = 0;

      // Immediate registration for very strong signals (when not already in range)
      if (isVeryStrongSignal && !state.isInRange) {
        const canEnter = !state.lastEnterAt || 
          (Date.now() - new Date(state.lastEnterAt).getTime()) > DEBOUNCE_DURATION_MS;

        if (canEnter) {
          state.isInRange = true;
          state.lastEnterAt = now;
          event = 'enter';
          console.log(`⚡ Immediate entry: RSSI ${rssi} >= ${IMMEDIATE_RSSI_THRESHOLD}`);
        }
      }
      // Check for entry event (used for both check-in AND check-out at entrance)
      else if (!state.isInRange && state.consecutiveInRangeCount >= CONSECUTIVE_READS_REQUIRED) {
        // Check debounce
        const canEnter = !state.lastEnterAt || 
          (Date.now() - new Date(state.lastEnterAt).getTime()) > DEBOUNCE_DURATION_MS;

        if (canEnter) {
          state.isInRange = true;
          state.lastEnterAt = now;
          event = 'enter'; // Always 'enter' - attendance type determined later
          console.log(`✅ Consecutive entry: ${state.consecutiveInRangeCount} reads, RSSI ${rssi}`);
        }
      }
    } else {
      state.consecutiveOutRangeCount++;
      state.consecutiveInRangeCount = 0;
      
      // Reset in-range status after leaving (allow next entry detection)
      // Using a short count to quickly reset for next pass-by
      if (state.consecutiveOutRangeCount >= 3) {
        state.isInRange = false;
      }
    }
  } else {
    // No beacon found - treat as out of range
    state.consecutiveOutRangeCount++;
    state.consecutiveInRangeCount = 0;
    
    // Reset in-range status
    if (state.consecutiveOutRangeCount >= 3) {
      state.isInRange = false;
    }
  }

  // NOTE: We no longer generate 'exit' events based on signal loss
  // Both check-in and check-out happen when ENTERING the beacon range
  // (because the beacon is at the entrance, not inside the workplace)

  saveBeaconRangeState(state);
  return { event, state };
};

/**
 * Record auto check-in time
 */
export const recordAutoCheckIn = (): void => {
  const state = getBeaconRangeState();
  state.lastAutoCheckInAt = new Date().toISOString();
  saveBeaconRangeState(state);
};

/**
 * Record auto check-out time
 */
export const recordAutoCheckOut = (): void => {
  const state = getBeaconRangeState();
  state.lastAutoCheckOutAt = new Date().toISOString();
  saveBeaconRangeState(state);
};

/**
 * Check if auto check-in is allowed (not done today)
 */
export const canAutoCheckIn = (): boolean => {
  const state = getBeaconRangeState();
  if (!state.lastAutoCheckInAt) return true;

  const lastDate = new Date(state.lastAutoCheckInAt).toDateString();
  const today = new Date().toDateString();
  return lastDate !== today;
};

/**
 * Check if current day is a working day (not weekend)
 */
export const isWorkingDay = (): boolean => {
  const dayOfWeek = new Date().getDay();
  return !WEEKEND_DAYS.includes(dayOfWeek);
};

/**
 * Check if exit time is allowed based on business rules
 * - Must not be a weekend
 * - Must be after WORK_START_HOUR (7 AM)
 */
export const isExitTimeAllowed = (): { allowed: boolean; reason: string } => {
  const now = new Date();
  const hours = now.getHours();
  const dayOfWeek = now.getDay();
  
  // No check-out on weekends
  if (WEEKEND_DAYS.includes(dayOfWeek)) {
    return { allowed: false, reason: 'يوم إجازة' };
  }
  
  // No check-out before work start hour (7 AM)
  if (hours < WORK_START_HOUR) {
    return { allowed: false, reason: 'لم يبدأ الدوام بعد' };
  }
  
  return { allowed: true, reason: '' };
};

/**
 * Check if minimum work duration has passed since check-in
 * Prevents accidental early check-outs
 */
export const hasMinimumWorkDuration = (): boolean => {
  const state = getBeaconRangeState();
  if (!state.lastAutoCheckInAt) return false;
  
  const checkInTime = new Date(state.lastAutoCheckInAt);
  const now = new Date();
  const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
  
  // Use user-configured minimum work hours
  const minHours = getMinWorkHours();
  return hoursSinceCheckIn >= minHours;
};

/**
 * Check if auto check-out is allowed (checked in today, not checked out, and meets all business rules)
 */
export const canAutoCheckOut = (): boolean => {
  const state = getBeaconRangeState();
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

  // Must meet exit time requirements
  if (!isExitTimeAllowed().allowed) return false;

  // Must have worked minimum duration
  if (!hasMinimumWorkDuration()) return false;

  return true;
};

/**
 * Reset range state (for testing)
 */
export const resetBeaconRangeState = (): void => {
  saveBeaconRangeState({
    isInRange: false,
    lastEnterAt: null,
    lastExitAt: null,
    lastAutoCheckInAt: null,
    lastAutoCheckOutAt: null,
    lastSeen: null,
    lastRssi: null,
    lastDistance: null,
    consecutiveInRangeCount: 0,
    consecutiveOutRangeCount: 0,
  });
};

/**
 * Format time for Arabic display
 */
export const formatTimeArabicNative = (isoString: string | null): string => {
  if (!isoString) return 'غير متوفر';

  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'م' : 'ص';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Get formatted distance from current state
 */
export const getFormattedDistance = (): string => {
  const state = getBeaconRangeState();
  if (state.lastDistance === null) return 'غير معروف';
  return formatDistanceArabic(state.lastDistance);
};

/**
 * Get status text in Arabic
 */
export const getStatusText = (isInRange: boolean): string => {
  return isInRange ? 'داخل النطاق' : 'خارج النطاق';
};
