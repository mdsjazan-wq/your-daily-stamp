import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.869d11d7b08e4a16821c09d115bc2179',
  appName: 'your-daily-stamp',
  webDir: 'dist',
  plugins: {
    // Local Notifications configuration
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#1e4a7a',
      sound: 'notification.wav',
    },
    // Bluetooth and location permissions for beacon detection
    Permissions: {
      permissions: [
        'bluetooth',
        'bluetooth-admin',
        'bluetooth-scan',
        'bluetooth-advertise',
        'bluetooth-connect',
        'access-fine-location',
        'access-coarse-location',
        'access-background-location',
      ],
    },
    // Background Task configuration
    BackgroundTask: {
      // Enable background execution on Android
      enabled: true,
    },
  },
};

export default config;
