/**
 * useNativeBeacon Hook - React hook for Native Beacon functionality
 * Provides state management and actions for iBeacon detection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { isNativePlatform } from '@/lib/nativeBleService';
import { FIXED_BEACON_UUID, TEST_SCAN_DURATION_MS, formatDistanceArabic, calculateDistanceFromRssi, DEFAULT_RSSI_ENTRY_THRESHOLD, DEFAULT_MIN_WORK_DURATION_HOURS, RSSI_PRESETS } from '@/lib/beaconConstants';
import { 
  startBeaconScan, 
  stopBeaconScan, 
  requestBeaconPermissions,
  isBluetoothEnabled,
  requestEnableBluetooth,
  openLocationSettings,
  openAppSettings,
  isLocationEnabled,
  ScannedBeacon,
} from '@/lib/nativeBeaconScanner';
import {
  getBeaconRangeState,
  processScanResultNative,
  resetBeaconRangeState,
  formatTimeArabicNative,
  BeaconRangeState,
  canAutoCheckIn as checkCanAutoCheckIn,
  canAutoCheckOut as checkCanAutoCheckOut,
  recordAutoCheckIn,
  recordAutoCheckOut,
} from '@/lib/beaconStateManager';
import {
  startBeaconService,
  stopBeaconService,
  isBeaconServiceRunning,
  setStateChangeCallback,
  getStoredServiceState,
} from '@/lib/nativeForegroundService';
import {
  playEntrySound,
  playExitSound,
  getAudioSettings,
  saveAudioSettings,
  BeaconAudioSettings,
} from '@/lib/beaconAudio';
import { logBeaconEvent } from '@/lib/beaconService';

// Beacon settings interface for the UI
export interface NativeBeaconSettings {
  enabled: boolean;
  autoCheckIn: boolean;
  autoCheckOut: boolean;
  rssiThreshold: number;        // RSSI threshold for range detection
  minWorkHours: number;         // Minimum work hours before auto check-out
}

// Storage key for settings
const SETTINGS_STORAGE_KEY = 'nativeBeaconSettings';

/**
 * Get settings from localStorage
 */
const getStoredSettings = (): NativeBeaconSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults for backward compatibility
      return {
        enabled: parsed.enabled ?? true, // Default to TRUE (enabled by default)
        autoCheckIn: parsed.autoCheckIn ?? true,
        autoCheckOut: parsed.autoCheckOut ?? true,
        rssiThreshold: parsed.rssiThreshold ?? DEFAULT_RSSI_ENTRY_THRESHOLD,
        minWorkHours: parsed.minWorkHours ?? DEFAULT_MIN_WORK_DURATION_HOURS,
      };
    }
  } catch {
    // Ignore
  }
  return {
    enabled: true, // Default to TRUE (enabled by default)
    autoCheckIn: true,
    autoCheckOut: true,
    rssiThreshold: DEFAULT_RSSI_ENTRY_THRESHOLD,
    minWorkHours: DEFAULT_MIN_WORK_DURATION_HOURS,
  };
};

/**
 * Save settings to localStorage
 */
const saveSettings = (settings: NativeBeaconSettings): void => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const useNativeBeacon = () => {
  // Platform detection
  const [isNative, setIsNative] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [bluetoothOn, setBluetoothOn] = useState(false);

  // Settings
  const [settings, setSettings] = useState<NativeBeaconSettings>(getStoredSettings);
  const [audioSettings, setAudioSettings] = useState<BeaconAudioSettings>(getAudioSettings);

  // State
  const [rangeState, setRangeState] = useState<BeaconRangeState>(getBeaconRangeState);
  const [serviceRunning, setServiceRunning] = useState(false);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [scanResults, setScanResults] = useState<ScannedBeacon[]>([]);

  // Refs
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const native = isNativePlatform();
      setIsNative(native);

      if (native) {
        // Check Bluetooth status
        const btEnabled = await isBluetoothEnabled();
        setBluetoothOn(btEnabled);

        // Check stored service state
        const storedSettings = getStoredSettings();
        const isRunning = isBeaconServiceRunning() || getStoredServiceState();
        setServiceRunning(isRunning);

        // Auto-start service if enabled in settings and Bluetooth is on
        if (storedSettings.enabled && btEnabled && !isRunning) {
          console.log('🚀 Auto-starting Beacon service...');
          const started = await startBeaconService();
          setServiceRunning(started);
          if (started) {
            console.log('✅ Beacon service auto-started successfully');
          }
        }
      }

      setIsLoading(false);
    };

    init();

    // Set up state change callback
    setStateChangeCallback((state) => {
      setRangeState(state);
    });

    return () => {
      setStateChangeCallback(null);
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
      }
    };
  }, []);

  // Handle settings change
  const updateSettings = useCallback((updates: Partial<NativeBeaconSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveSettings(newSettings);
      return newSettings;
    });
  }, []);

  // Handle audio settings change
  const updateAudioSettings = useCallback((updates: Partial<BeaconAudioSettings>) => {
    setAudioSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveAudioSettings(newSettings);
      return newSettings;
    });
  }, []);

  // Check location services
  const checkLocationServices = useCallback(async (): Promise<boolean> => {
    if (!isNative) return true;

    const locationOn = await isLocationEnabled();
    if (!locationOn) {
      toast.error('يرجى تفعيل خدمات الموقع', {
        action: {
          label: 'فتح الإعدادات',
          onClick: () => openLocationSettings(),
        },
      });
      return false;
    }
    return true;
  }, [isNative]);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      toast.error('ميزة Beacon تعمل فقط في النسخة Native');
      return false;
    }

    const result = await requestBeaconPermissions();
    setPermissionsGranted(result.granted);

    if (!result.granted) {
      if (result.needsLocationSettings) {
        toast.error(result.message || 'يرجى تفعيل خدمات الموقع', {
          action: {
            label: 'فتح الإعدادات',
            onClick: () => openLocationSettings(),
          },
        });
      } else if (result.needsAppSettings) {
        toast.error(result.message || 'يرجى منح الصلاحيات من إعدادات التطبيق', {
          action: {
            label: 'فتح الإعدادات',
            onClick: () => openAppSettings(),
          },
        });
      } else {
        toast.error(result.message || 'فشل في الحصول على الصلاحيات');
      }
    }

    return result.granted;
  }, [isNative]);

  // Enable Bluetooth
  const enableBluetooth = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    const enabled = await requestEnableBluetooth();
    setBluetoothOn(enabled);

    if (!enabled) {
      toast.error('يرجى تفعيل البلوتوث يدوياً');
    }

    return enabled;
  }, [isNative]);

  // Open app settings
  const handleOpenAppSettings = useCallback(async (): Promise<void> => {
    await openAppSettings();
  }, []);

  // Open location settings
  const handleOpenLocationSettings = useCallback(async (): Promise<void> => {
    await openLocationSettings();
  }, []);

  // Toggle beacon tracking
  const toggleBeaconTracking = useCallback(async (enable: boolean): Promise<boolean> => {
    if (!isNative) {
      toast.error('ميزة Beacon تعمل فقط في النسخة Native');
      return false;
    }

    if (enable) {
      // 1. Check location services first
      const locationOk = await checkLocationServices();
      if (!locationOk) return false;

      // 2. Request permissions
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) return false;

      // 3. Check Bluetooth
      const btEnabled = await isBluetoothEnabled();
      if (!btEnabled) {
        const enabled = await enableBluetooth();
        if (!enabled) return false;
      }

      // 4. Start service
      const started = await startBeaconService();
      if (started) {
        setServiceRunning(true);
        updateSettings({ enabled: true });
        toast.success('تم تفعيل تتبع Beacon');
        return true;
      } else {
        toast.error('فشل في تشغيل خدمة Beacon');
        return false;
      }
    } else {
      await stopBeaconService();
      setServiceRunning(false);
      updateSettings({ enabled: false });
      toast.success('تم إيقاف تتبع Beacon');
      return true;
    }
  }, [isNative, checkLocationServices, requestPermissions, enableBluetooth, updateSettings]);

  // Test scan
  const performTestScan = useCallback(async () => {
    if (!isNative) {
      toast.error('ميزة Beacon تعمل فقط في النسخة Native');
      return;
    }

    // Check Bluetooth
    const btEnabled = await isBluetoothEnabled();
    if (!btEnabled) {
      toast.error('يرجى تفعيل البلوتوث');
      return;
    }

    setIsScanning(true);
    setScanResults([]);
    setScanProgress(0);
    setRemainingSeconds(TEST_SCAN_DURATION_MS / 1000);

    const startTime = Date.now();
    const foundBeacons = new Map<string, ScannedBeacon>();

    // Progress timer
    scanTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / TEST_SCAN_DURATION_MS) * 100, 100);
      const remaining = Math.max(0, Math.ceil((TEST_SCAN_DURATION_MS - elapsed) / 1000));
      setScanProgress(progress);
      setRemainingSeconds(remaining);
    }, 100);

    try {
      await startBeaconScan(
        TEST_SCAN_DURATION_MS,
        (beacon) => {
          // Update or add beacon
          const existing = foundBeacons.get(beacon.deviceId);
          if (!existing || beacon.rssi > existing.rssi) {
            foundBeacons.set(beacon.deviceId, beacon);
          }

          // Sort by: matching first, then by RSSI
          const sorted = Array.from(foundBeacons.values()).sort((a, b) => {
            if (a.matchesTarget && !b.matchesTarget) return -1;
            if (!a.matchesTarget && b.matchesTarget) return 1;
            return b.rssi - a.rssi;
          });

          setScanResults(sorted);

          // Update range state if target found
          if (beacon.matchesTarget) {
            const { state } = processScanResultNative(beacon.rssi);
            setRangeState(state);
          }
        }
      );

      // Wait for scan to complete
      await new Promise(resolve => setTimeout(resolve, TEST_SCAN_DURATION_MS + 500));
      
    } catch (error) {
      console.error('Test scan error:', error);
      toast.error('فشل البحث عن الأجهزة');
    } finally {
      await stopBeaconScan();
      setIsScanning(false);
      setScanProgress(100);
      setRemainingSeconds(0);
      
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    }
  }, [isNative]);

  // Manual check-in
  const performManualCheckIn = useCallback(async () => {
    if (audioSettings.entryEnabled) {
      await playEntrySound(audioSettings.volume);
    }

    recordAutoCheckIn();
    setRangeState(getBeaconRangeState());
    window.dispatchEvent(new CustomEvent('beaconAutoCheckIn'));
    logBeaconEvent('enter', { manual: true, uuid: FIXED_BEACON_UUID });
    toast.success('تم تسجيل الدخول بنجاح');
  }, [audioSettings]);

  // Manual check-out
  const performManualCheckOut = useCallback(async () => {
    if (audioSettings.exitEnabled) {
      await playExitSound(audioSettings.volume);
    }

    recordAutoCheckOut();
    setRangeState(getBeaconRangeState());
    window.dispatchEvent(new CustomEvent('beaconAutoCheckOut'));
    logBeaconEvent('exit', { manual: true });
    toast.success('تم تسجيل الخروج بنجاح');
  }, [audioSettings]);

  // Reset state
  const resetState = useCallback(() => {
    resetBeaconRangeState();
    setRangeState(getBeaconRangeState());
    toast.success('تم إعادة تعيين الحالة');
  }, []);

  // Copy UUID to clipboard
  const copyUuid = useCallback(() => {
    navigator.clipboard.writeText(FIXED_BEACON_UUID).then(() => {
      toast.success('تم نسخ UUID');
    }).catch(() => {
      toast.error('فشل النسخ');
    });
  }, []);

  return {
    // Platform
    isNative,
    isLoading,
    permissionsGranted,
    bluetoothOn,

    // Settings
    settings,
    updateSettings,
    audioSettings,
    updateAudioSettings,

    // State
    rangeState,
    serviceRunning,

    // Scan
    isScanning,
    scanProgress,
    remainingSeconds,
    scanResults,

    // Constants
    fixedUuid: FIXED_BEACON_UUID,
    rssiPresets: RSSI_PRESETS,

    // Actions
    requestPermissions,
    enableBluetooth,
    toggleBeaconTracking,
    performTestScan,
    performManualCheckIn,
    performManualCheckOut,
    resetState,
    copyUuid,
    openAppSettings: handleOpenAppSettings,
    openLocationSettings: handleOpenLocationSettings,

    // Utilities
    formatTime: formatTimeArabicNative,
    formatDistance: formatDistanceArabic,
    calculateDistance: calculateDistanceFromRssi,
    canAutoCheckIn: checkCanAutoCheckIn,
    canAutoCheckOut: checkCanAutoCheckOut,
  };
};

export default useNativeBeacon;
