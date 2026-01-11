/**
 * Native Beacon Scanner - BLE scanning for iBeacon detection
 * Uses Capacitor BLE plugin for native apps
 * Scan-only approach - NO pairing or connect()
 */

import { isNativePlatform } from './nativeBleService';
import { parseIBeaconFromManufacturerData, ParsedIBeacon, matchesIBeaconUuid } from './iBeaconParser';
import { FIXED_BEACON_UUID, SCAN_DURATION_MS } from './beaconConstants';

// Scanned device with iBeacon data
export interface ScannedBeacon {
  deviceId: string;
  name?: string;
  rssi: number;
  iBeacon: ParsedIBeacon | null;
  matchesTarget: boolean;
  lastSeen: Date;
}

// Scan callback types
export type BeaconScanCallback = (beacon: ScannedBeacon) => void;
export type ScanErrorCallback = (error: Error) => void;

// Scan state
let isScanning = false;
let scanTimeoutId: ReturnType<typeof setTimeout> | null = null;

// BLE init state (Capacitor plugin requires initialize() before most calls)
let bleInitialized = false;

const ensureBleInitialized = async () => {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  if (!bleInitialized) {
    // IMPORTANT: Do NOT use androidNeverForLocation as it can filter iBeacons.
    await BleClient.initialize();
    bleInitialized = true;
  }
  return { BleClient };
};

/**
 * Check if running on Native platform
 */
export const isNativeBeaconSupported = (): boolean => {
  return isNativePlatform();
};

/**
 * Request BLE permissions for Android
 * Handles different permission requirements for different Android versions
 */
export const requestBeaconPermissions = async (): Promise<{
  granted: boolean;
  message?: string;
  needsLocationSettings?: boolean;
  needsAppSettings?: boolean;
}> => {
  if (!isNativePlatform()) {
    return { granted: false, message: 'ميزة Beacon تعمل فقط في النسخة Native' };
  }

  try {
    const { Capacitor } = await import('@capacitor/core');
    const { BleClient } = await ensureBleInitialized();

    // 1. Check location services on Android (required for BLE scanning)
    if (Capacitor.getPlatform() === 'android') {
      try {
        const locationEnabled = await BleClient.isLocationEnabled();
        if (!locationEnabled) {
          return {
            granted: false,
            message: 'يرجى تفعيل خدمات الموقع للبحث عن أجهزة Beacon',
            needsLocationSettings: true,
          };
        }
      } catch (locError) {
        console.log('Location check not supported, continuing...', locError);
      }
    }

    // 2. Check if Bluetooth is enabled
    const isEnabled = await BleClient.isEnabled();
    if (!isEnabled) {
      try {
        await BleClient.requestEnable();
      } catch {
        return { granted: false, message: 'يرجى تفعيل البلوتوث للمتابعة' };
      }
    }

    return { granted: true };
  } catch (error) {
    console.error('Permission request error:', error);
    const errorMsg = error instanceof Error ? error.message : 'خطأ غير معروف';

    if (
      errorMsg.includes('permission') ||
      errorMsg.includes('denied') ||
      errorMsg.includes('Permission')
    ) {
      return {
        granted: false,
        message: 'يرجى منح صلاحيات البلوتوث والموقع من إعدادات التطبيق',
        needsAppSettings: true,
      };
    }

    return { granted: false, message: `خطأ: ${errorMsg}` };
  }
};

/**
 * Start BLE scan for iBeacons
 * Uses general scan without service UUID filter (iBeacons don't use standard BLE services)
 */
export const startBeaconScan = async (
  durationMs: number = SCAN_DURATION_MS,
  onBeaconFound: BeaconScanCallback,
  onError?: ScanErrorCallback
): Promise<void> => {
  if (!isNativePlatform()) {
    onError?.(new Error('ميزة Beacon تعمل فقط في النسخة Native'));
    return;
  }

  if (isScanning) {
    console.log('Scan already in progress');
    return;
  }

  try {
    const { BleClient } = await ensureBleInitialized();

    isScanning = true;

    // Import ScanMode for low latency scanning
    const { ScanMode } = await import('@capacitor-community/bluetooth-le');

    // Start general BLE scan with low latency mode for faster detection
    await BleClient.requestLEScan(
      {
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY, // Fastest response time
      },
      (result) => {
        // Extract manufacturer data
        const manufacturerData: { [key: string]: number[] } = {};

        if (result.manufacturerData) {
          Object.entries(result.manufacturerData).forEach(([key, value]) => {
            if (value instanceof DataView) {
              const arr: number[] = [];
              for (let i = 0; i < value.byteLength; i++) {
                arr.push(value.getUint8(i));
              }
              manufacturerData[key] = arr;
            } else if (Array.isArray(value)) {
              manufacturerData[key] = value;
            }
          });
        }

        // Parse iBeacon data
        const iBeacon = parseIBeaconFromManufacturerData(manufacturerData);
        const matchesTarget = matchesIBeaconUuid(manufacturerData, FIXED_BEACON_UUID);

        const beacon: ScannedBeacon = {
          deviceId: result.device.deviceId,
          name: result.device.name || result.localName,
          rssi: result.rssi ?? -100,
          iBeacon,
          matchesTarget,
          lastSeen: new Date(),
        };

        onBeaconFound(beacon);
      }
    );

    // Auto-stop after duration
    scanTimeoutId = setTimeout(async () => {
      await stopBeaconScan();
    }, durationMs);
  } catch (error) {
    isScanning = false;
    console.error('Beacon scan error:', error);
    onError?.(error instanceof Error ? error : new Error('فشل بدء البحث'));
  }
};

/**
 * Stop current BLE scan
 */
export const stopBeaconScan = async (): Promise<void> => {
  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }

  if (!isScanning) return;

  try {
    const { BleClient } = await ensureBleInitialized();
    await BleClient.stopLEScan();
  } catch (error) {
    console.error('Error stopping scan:', error);
  } finally {
    isScanning = false;
  }
};

/**
 * Check if currently scanning
 */
export const isScanningActive = (): boolean => {
  return isScanning;
};

/**
 * Check if Bluetooth is enabled
 */
export const isBluetoothEnabled = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;

  try {
    const { BleClient } = await ensureBleInitialized();
    return await BleClient.isEnabled();
  } catch {
    return false;
  }
};

/**
 * Request to enable Bluetooth
 */
export const requestEnableBluetooth = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;

  try {
    const { BleClient } = await ensureBleInitialized();
    await BleClient.requestEnable();
    return true;
  } catch {
    return false;
  }
};

/**
 * Open device location settings
 */
export const openLocationSettings = async (): Promise<void> => {
  if (!isNativePlatform()) return;

  try {
    const { BleClient } = await ensureBleInitialized();
    await BleClient.openLocationSettings();
  } catch (error) {
    console.error('Error opening location settings:', error);
  }
};

/**
 * Open app settings for manual permission granting
 */
export const openAppSettings = async (): Promise<void> => {
  if (!isNativePlatform()) return;

  try {
    const { BleClient } = await ensureBleInitialized();
    await BleClient.openAppSettings();
  } catch (error) {
    console.error('Error opening app settings:', error);
  }
};

/**
 * Check if location services are enabled
 */
export const isLocationEnabled = async (): Promise<boolean> => {
  if (!isNativePlatform()) return true;

  try {
    const { BleClient } = await ensureBleInitialized();
    return await BleClient.isLocationEnabled();
  } catch {
    // If not supported, assume enabled
    return true;
  }
};
