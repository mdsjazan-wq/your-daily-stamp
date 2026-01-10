/**
 * iBeacon Parser - Extract iBeacon data from BLE manufacturer data
 * 
 * iBeacon Format (Apple proprietary):
 * - Company ID: 0x004C (Apple) - 2 bytes
 * - Type: 0x02 (iBeacon) - 1 byte
 * - Length: 0x15 (21 bytes) - 1 byte
 * - UUID: 16 bytes
 * - Major: 2 bytes
 * - Minor: 2 bytes
 * - TX Power: 1 byte (signed)
 */

import { IBEACON_COMPANY_ID, IBEACON_TYPE, IBEACON_LENGTH, normalizeUuid } from './beaconConstants';

export interface ParsedIBeacon {
  uuid: string;
  major: number;
  minor: number;
  txPower: number;
  companyId: number;
}

/**
 * Parse iBeacon data from manufacturer data object
 * @param manufacturerData - Object with company ID keys and byte array values
 * @returns Parsed iBeacon or null if not valid iBeacon
 */
export const parseIBeaconFromManufacturerData = (
  manufacturerData: { [key: string]: number[] } | undefined
): ParsedIBeacon | null => {
  if (!manufacturerData) return null;

  // Apple's company ID is 0x004C = 76 in decimal
  const appleDataKey = String(IBEACON_COMPANY_ID);
  const appleData = manufacturerData[appleDataKey];

  if (!appleData || appleData.length < 23) {
    return null;
  }

  // Check iBeacon identifier (type = 0x02, length = 0x15)
  if (appleData[0] !== IBEACON_TYPE || appleData[1] !== IBEACON_LENGTH) {
    return null;
  }

  // Extract UUID (bytes 2-17, 16 bytes)
  const uuidBytes = appleData.slice(2, 18);
  const uuid = formatUuidFromBytes(uuidBytes);

  // Extract Major (bytes 18-19, big-endian)
  const major = (appleData[18] << 8) | appleData[19];

  // Extract Minor (bytes 20-21, big-endian)
  const minor = (appleData[20] << 8) | appleData[21];

  // Extract TX Power (byte 22, signed 8-bit)
  const txPower = appleData[22] > 127 ? appleData[22] - 256 : appleData[22];

  return {
    uuid,
    major,
    minor,
    txPower,
    companyId: IBEACON_COMPANY_ID,
  };
};

/**
 * Format UUID bytes to standard UUID string format
 */
const formatUuidFromBytes = (bytes: number[]): string => {
  const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  // Format: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32),
  ].join('-').toUpperCase();
};

/**
 * Check if manufacturer data contains a matching iBeacon UUID
 */
export const matchesIBeaconUuid = (
  manufacturerData: { [key: string]: number[] } | undefined,
  targetUuid: string
): boolean => {
  const parsed = parseIBeaconFromManufacturerData(manufacturerData);
  if (!parsed) return false;

  const normalizedTarget = normalizeUuid(targetUuid);
  const normalizedParsed = normalizeUuid(parsed.uuid);

  return normalizedParsed === normalizedTarget;
};

/**
 * Extract iBeacon UUID from manufacturer data if present
 */
export const extractIBeaconUuid = (
  manufacturerData: { [key: string]: number[] } | undefined
): string | null => {
  const parsed = parseIBeaconFromManufacturerData(manufacturerData);
  return parsed?.uuid || null;
};
