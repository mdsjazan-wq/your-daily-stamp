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
}> => {
  if (!isNativePlatform()) {
    return { granted: false, message: 'ميزة Beacon تعمل فقط في النسخة Native' };
  }

  try {
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
    
    // Initialize BLE - this triggers permission requests on Android
    await BleClient.initialize();
    
    // Check if Bluetooth is enabled
    const isEnabled = await BleClient.isEnabled();
    if (!isEnabled) {
      // Try to enable Bluetooth
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
    
    if (errorMsg.includes('permission')) {
      return { 
        granted: false, 
        message: 'يرجى منح صلاحيات البلوتوث والموقع من إعدادات التطبيق' 
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
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
    
    isScanning = true;

    // Start general BLE scan (no service UUID filter for iBeacon)
    await BleClient.requestLEScan(
      {
        // No filters - we filter by manufacturer data ourselves
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
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
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
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
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
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
    await BleClient.requestEnable();
    return true;
  } catch {
    return false;
  }
};
