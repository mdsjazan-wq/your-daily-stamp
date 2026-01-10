/**
 * Native BLE Service - Unified Bluetooth Low Energy Service
 * Uses Capacitor BLE Plugin for native apps, Web Bluetooth for PWA
 */

// Check if running in Capacitor native app
export const isNativePlatform = (): boolean => {
  return typeof window !== 'undefined' && 
         'Capacitor' in window && 
         (window as unknown as { Capacitor: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
};

// Check if BLE is supported (native or web)
export const isBleSupported = (): boolean => {
  if (isNativePlatform()) {
    return true; // Native always supports BLE
  }
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
};

// Initialize BLE
export const initializeBle = async (): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.initialize();
      return true;
    } catch (error) {
      console.error('Failed to initialize BLE:', error);
      return false;
    }
  }
  return isBleSupported();
};

// Request BLE permissions (native only)
export const requestBlePermissions = async (): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.requestLEScan({}, () => {});
      await BleClient.stopLEScan();
      return true;
    } catch (error) {
      console.error('BLE permission denied:', error);
      return false;
    }
  }
  return true;
};

// Check if Bluetooth is enabled
export const isBluetoothEnabled = async (): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      const enabled = await BleClient.isEnabled();
      return enabled;
    } catch {
      return false;
    }
  }
  return true; // Web Bluetooth handles this during scan
};

// Request to enable Bluetooth
export const requestEnableBluetooth = async (): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.requestEnable();
      return true;
    } catch {
      return false;
    }
  }
  return true;
};

// Scan result interface
export interface BleDevice {
  deviceId: string;
  name?: string;
  rssi?: number;
  txPower?: number;
  serviceUuids?: string[];
  manufacturerData?: { [key: string]: number[] };
}

// Scan for BLE devices (native)
export const scanForDevices = async (
  durationMs: number = 5000,
  onDeviceFound?: (device: BleDevice) => void
): Promise<BleDevice[]> => {
  const devices: BleDevice[] = [];

  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      
      await BleClient.requestLEScan(
        {},
        (result) => {
          // Extract service UUIDs from scan result
          const serviceUuids: string[] = [];
          if (result.uuids) {
            serviceUuids.push(...result.uuids);
          }
          
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
              }
            });
          }
          
          const device: BleDevice = {
            deviceId: result.device.deviceId,
            name: result.device.name || result.localName,
            rssi: result.rssi,
            txPower: result.txPower,
            serviceUuids: serviceUuids.length > 0 ? serviceUuids : undefined,
            manufacturerData: Object.keys(manufacturerData).length > 0 ? manufacturerData : undefined,
          };
          
          // Avoid duplicates - update if exists with newer data
          const existingIndex = devices.findIndex(d => d.deviceId === device.deviceId);
          if (existingIndex >= 0) {
            // Update with latest RSSI
            devices[existingIndex] = { ...devices[existingIndex], ...device };
          } else {
            devices.push(device);
          }
          onDeviceFound?.(device);
        }
      );

      // Stop scan after duration
      await new Promise(resolve => setTimeout(resolve, durationMs));
      await BleClient.stopLEScan();
      
      return devices;
    } catch (error) {
      console.error('BLE scan error:', error);
      return [];
    }
  }

  // Web Bluetooth fallback - uses device picker
  if ('bluetooth' in navigator) {
    try {
      const device = await navigator.bluetooth!.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'device_information'],
      });
      
      if (device) {
        const bleDevice: BleDevice = {
          deviceId: device.id,
          name: device.name,
        };
        devices.push(bleDevice);
        onDeviceFound?.(bleDevice);
      }
    } catch (error) {
      console.error('Web Bluetooth error:', error);
    }
  }

  return devices;
};

// Stop scanning
export const stopScan = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.stopLEScan();
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  }
};

// Connect to a device
export const connectToDevice = async (deviceId: string): Promise<boolean> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.connect(deviceId);
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }
  return true; // Web Bluetooth handles connection differently
};

// Disconnect from a device
export const disconnectFromDevice = async (deviceId: string): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      await BleClient.disconnect(deviceId);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }
};

// Get RSSI from a connected device
export const getDeviceRssi = async (deviceId: string): Promise<number | null> => {
  if (isNativePlatform()) {
    try {
      const { BleClient } = await import('@capacitor-community/bluetooth-le');
      const rssi = await BleClient.readRssi(deviceId);
      return rssi;
    } catch {
      return null;
    }
  }
  return null;
};

// Estimate distance from RSSI
export const estimateDistanceFromRssi = (rssi: number, txPower: number = -59): number => {
  if (rssi === 0) return -1;
  
  const ratio = rssi / txPower;
  if (ratio < 1.0) {
    return Math.pow(ratio, 10);
  }
  return 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
};

// Format distance for display
export const formatDistanceDisplay = (meters: number): string => {
  if (meters < 0) return 'غير معروف';
  if (meters < 1) return `${Math.round(meters * 100)} سم`;
  if (meters < 10) return `${meters.toFixed(1)} متر`;
  return `${Math.round(meters)} متر`;
};
