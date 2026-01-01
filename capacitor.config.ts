import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.869d11d7b08e4a16821c09d115bc2179',
  appName: 'your-daily-stamp',
  webDir: 'dist',
  plugins: {
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
  },
};

export default config;
