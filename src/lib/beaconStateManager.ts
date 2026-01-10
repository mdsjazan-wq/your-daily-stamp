/**
 * Beacon State Manager - Handles range state with stability logic
 * Prevents oscillation using hysteresis and consecutive readings
 */

import {
  RSSI_ENTRY_THRESHOLD,
  RSSI_EXIT_THRESHOLD,
  EXIT_CONFIRM_SECONDS,
  SCAN_INTERVAL_SECONDS,
  CONSECUTIVE_READS_REQUIRED,
  DEBOUNCE_DURATION_MS,
  calculateDistanceFromRssi,
  formatDistanceArabic,
} from './beaconConstants';

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

    // Check if RSSI indicates in-range
    const isCurrentlyInRange = state.isInRange
      ? rssi >= RSSI_EXIT_THRESHOLD  // Use exit threshold if already in range (hysteresis)
      : rssi >= RSSI_ENTRY_THRESHOLD; // Use entry threshold if out of range

    if (isCurrentlyInRange) {
      state.consecutiveInRangeCount++;
      state.consecutiveOutRangeCount = 0;

      // Check for entry event
      if (!state.isInRange && state.consecutiveInRangeCount >= CONSECUTIVE_READS_REQUIRED) {
        // Check debounce
        const canEnter = !state.lastEnterAt || 
          (Date.now() - new Date(state.lastEnterAt).getTime()) > DEBOUNCE_DURATION_MS;

        if (canEnter) {
          state.isInRange = true;
          state.lastEnterAt = now;
          event = 'enter';
        }
      }
    } else {
      state.consecutiveOutRangeCount++;
      state.consecutiveInRangeCount = 0;
    }
  } else {
    // No beacon found - treat as out of range
    state.consecutiveOutRangeCount++;
    state.consecutiveInRangeCount = 0;
  }

  // Check for exit event
  const exitReadingsRequired = Math.ceil(EXIT_CONFIRM_SECONDS / SCAN_INTERVAL_SECONDS);
  
  if (state.isInRange && state.consecutiveOutRangeCount >= exitReadingsRequired) {
    // Check debounce
    const canExit = !state.lastExitAt || 
      (Date.now() - new Date(state.lastExitAt).getTime()) > DEBOUNCE_DURATION_MS;

    if (canExit) {
      state.isInRange = false;
      state.lastExitAt = now;
      event = 'exit';
    }
  }

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
 * Check if auto check-out is allowed (checked in today, not checked out)
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
