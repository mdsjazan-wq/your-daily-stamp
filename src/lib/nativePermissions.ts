/**
 * Native Permissions - Request all required permissions on first app launch
 * Permissions: Bluetooth (Nearby Devices), Location, Notifications
 * 
 * Google Play Compliance: Location disclosure must be shown before requesting permissions
 */

import { Capacitor } from '@capacitor/core';

const PERMISSIONS_REQUESTED_KEY = 'native_permissions_requested_v1';
const DISCLOSURE_ACCEPTED_KEY = 'location_disclosure_accepted_v1';

/**
 * Check if we're running on a native platform
 */
const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if permissions were already requested
 */
export const wasPermissionsRequested = (): boolean => {
  return localStorage.getItem(PERMISSIONS_REQUESTED_KEY) === 'true';
};

/**
 * Mark permissions as requested
 */
export const markPermissionsRequested = (): void => {
  localStorage.setItem(PERMISSIONS_REQUESTED_KEY, 'true');
};

/**
 * Check if location disclosure was accepted by user
 */
export const wasDisclosureAccepted = (): boolean => {
  return localStorage.getItem(DISCLOSURE_ACCEPTED_KEY) === 'true';
};

/**
 * Mark location disclosure as accepted
 */
export const markDisclosureAccepted = (): void => {
  localStorage.setItem(DISCLOSURE_ACCEPTED_KEY, 'true');
};

/**
 * Reset disclosure state (for testing)
 */
export const resetDisclosureState = (): void => {
  localStorage.removeItem(DISCLOSURE_ACCEPTED_KEY);
};

/**
 * Request all required permissions for the app
 * Called automatically on first app launch
 */
export const requestAllPermissions = async (): Promise<{
  bluetooth: boolean;
  location: boolean;
  notifications: boolean;
}> => {
  const results = {
    bluetooth: false,
    location: false,
    notifications: false,
  };

  if (!isNativePlatform()) {
    console.log('[Permissions] Not a native platform, skipping permission requests');
    return results;
  }

  console.log('[Permissions] Requesting all native permissions...');

  try {
    // 1. Request Bluetooth + Location permissions via BleClient.initialize()
    // IMPORTANT: We do NOT use androidNeverForLocation to ensure iBeacon detection works
    // This will request:
    // - BLUETOOTH_SCAN
    // - BLUETOOTH_CONNECT
    // - ACCESS_FINE_LOCATION
    const { BleClient } = await import('@capacitor-community/bluetooth-le');
    await BleClient.initialize();
    results.bluetooth = true;
    results.location = true;
    console.log('[Permissions] Bluetooth & Location permissions requested');
  } catch (error) {
    console.error('[Permissions] Error requesting Bluetooth/Location:', error);
  }

  try {
    // 2. Request Notification permission
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const notifResult = await LocalNotifications.requestPermissions();
    results.notifications = notifResult.display === 'granted';
    console.log('[Permissions] Notification permission:', notifResult.display);
  } catch (error) {
    console.error('[Permissions] Error requesting Notifications:', error);
  }

  // Mark as requested so we don't ask again
  markPermissionsRequested();
  console.log('[Permissions] All permissions requested, results:', results);

  return results;
};

/**
 * Initialize permissions on app startup
 * Only requests on first launch
 */
export const initializeNativePermissions = async (): Promise<void> => {
  if (!isNativePlatform()) {
    console.log('[Permissions] Web platform detected, skipping');
    return;
  }
  
  // Only request on first launch
  if (wasPermissionsRequested()) {
    console.log('[Permissions] Already requested before, skipping');
    return;
  }

  console.log('[Permissions] First launch detected, requesting permissions...');
  await requestAllPermissions();
};
