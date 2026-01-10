/**
 * Beacon Constants - Fixed values for Native iBeacon integration
 * These values are not user-configurable to ensure stability
 */

// Fixed iBeacon UUID - DO NOT allow user modification
export const FIXED_BEACON_UUID = '1B6295D5-4F74-4C58-A2D8-CD83CA26BDF4';

// iBeacon detection constants
export const IBEACON_COMPANY_ID = 0x004C; // Apple's company ID (76 in decimal)
export const IBEACON_TYPE = 0x02;
export const IBEACON_LENGTH = 0x15; // 21 bytes

// RSSI thresholds (defaults - can be overridden by user settings)
export const DEFAULT_RSSI_ENTRY_THRESHOLD = -80; // dBm - device is "in range" when RSSI >= this
export const RSSI_EXIT_THRESHOLD = -90;  // dBm - device is "out of range" when RSSI < this

// Range presets for user selection
export const RSSI_PRESETS = {
  veryClose: { value: -60, label: 'قريب جداً (~1 متر)' },
  close: { value: -70, label: 'قريب (~3 متر)' },
  medium: { value: -80, label: 'متوسط (~5 متر)' },
  far: { value: -90, label: 'بعيد (~10 متر)' },
} as const;

// Timing constants (fixed for stability)
export const SCAN_INTERVAL_SECONDS = 5;      // How often to scan
export const SCAN_DURATION_MS = 3000;        // Each scan duration
export const EXIT_CONFIRM_SECONDS = 300;     // 5 minutes wait time before confirming exit (prevents accidental exits)
export const CONSECUTIVE_READS_REQUIRED = 3; // Required consecutive in-range readings for entry
export const DEBOUNCE_DURATION_MS = 30 * 60 * 1000; // 30 minutes debounce between events (allows check-out after check-in)

// Business rules constants (defaults - can be overridden by user settings)
export const DEFAULT_MIN_WORK_DURATION_HOURS = 4;    // Minimum hours before allowing auto check-out
export const WORK_START_HOUR = 7;            // No check-out before this hour (7 AM)
export const WEEKEND_DAYS = [5, 6];          // Friday (5) and Saturday (6) are weekends

// For backward compatibility
export const RSSI_ENTRY_THRESHOLD = DEFAULT_RSSI_ENTRY_THRESHOLD;
export const MIN_WORK_DURATION_HOURS = DEFAULT_MIN_WORK_DURATION_HOURS;

// Distance calculation constants
export const TX_POWER_AT_1M = -59; // RSSI at 1 meter (calibrated for iBeacon)
export const PATH_LOSS_EXPONENT = 2.2; // Environmental factor (2.0-4.0)

// Test scan duration
export const TEST_SCAN_DURATION_MS = 12000; // 12 seconds for user-initiated scan

/**
 * Calculate approximate distance from RSSI
 * Note: This is an approximation and depends on environment
 */
export const calculateDistanceFromRssi = (rssi: number): number => {
  if (rssi === 0) return -1;
  
  const ratio = (TX_POWER_AT_1M - rssi) / (10 * PATH_LOSS_EXPONENT);
  return Math.pow(10, ratio);
};

/**
 * Format distance for Arabic display
 */
export const formatDistanceArabic = (meters: number): string => {
  if (meters < 0) return 'غير معروف';
  if (meters < 1) return `${Math.round(meters * 100)} سم`;
  if (meters < 10) return `${meters.toFixed(1)} متر`;
  return `${Math.round(meters)} متر`;
};

/**
 * Normalize UUID for comparison (remove dashes, lowercase)
 */
export const normalizeUuid = (uuid: string): string => {
  return uuid.toLowerCase().replace(/-/g, '');
};
