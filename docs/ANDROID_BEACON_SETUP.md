# Android Native Setup for iBeacon Detection

This document provides the complete setup instructions for enabling iBeacon detection on Android devices (Android 8-16).

## ⚠️ تحذير مهم جداً: صلاحية neverForLocation

**يجب عدم استخدام** `android:usesPermissionFlags="neverForLocation"` مع صلاحية `BLUETOOTH_SCAN`.

هذا الفلاج يمنع اكتشاف iBeacons تماماً لأن Android يعتبر بيانات iBeacon بيانات موقع!

## 📋 Google Play Compliance - Location Disclosure

لاجتياز مراجعة Google Play، يجب:

1. **In-app Disclosure**: عرض نافذة إفصاح واضحة قبل طلب أذونات الموقع
2. **Foreground Service Notification**: إشعار دائم يوضح استخدام الموقع مع زر إيقاف
3. **Privacy Policy**: صفحة سياسة خصوصية داخل التطبيق

### النص المقترح لـ Google Play Console:

**الهدف الرئيسي للتطبيق:**
```
تطبيق "بصمتي" هو نظام تسجيل حضور وانصراف للموظفين يستخدم تقنية Bluetooth Beacon للتحقق التلقائي من وجود الموظف في مقر العمل.
```

**الوصول إلى الموقع الجغرافي:**
```
يستخدم التطبيق إذن الموقع في الخلفية (ACCESS_BACKGROUND_LOCATION) لمسح أجهزة Bluetooth Beacon أثناء ساعات الدوام. عندما يفعّل المستخدم خيار "تتبع Beacon"، يقوم التطبيق بالتحقق من قربه من جهاز Beacon موجود في مدخل مقر العمل. لا يتم تتبع الموقع الجغرافي الفعلي للمستخدم - فقط التحقق من القرب من جهاز Beacon محدد. يمكن للمستخدم إيقاف هذه الميزة في أي وقت من الإعدادات أو من الإشعار الدائم.
```

## 1. AndroidManifest.xml Permissions

أضف هذه الصلاحيات في `android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Bluetooth Permissions -->
    <!-- For Android 12+ (API 31+) -->
    <!-- ⚠️⚠️⚠️ لا تضف neverForLocation هنا! ⚠️⚠️⚠️ -->
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    
    <!-- For Android 11 and below -->
    <uses-permission android:name="android.permission.BLUETOOTH" 
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_ADMIN" 
        android:maxSdkVersion="30" />
    
    <!-- Location Permission (مطلوب لـ BLE و iBeacon) -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    
    <!-- Foreground Service Permission -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
    
    <!-- Notifications (Android 13+) -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    
    <!-- Keep CPU awake for background scanning -->
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <!-- Prevent Doze mode from stopping scans -->
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

    <!-- BLE Feature Declaration -->
    <uses-feature 
        android:name="android.hardware.bluetooth_le" 
        android:required="true" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <!-- Main Activity -->
        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:exported="true"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Foreground Service for Background Scanning -->
        <service
            android:name=".BeaconScanService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="location|connectedDevice" />

    </application>

</manifest>
```

## 2. Foreground Service (Java/Kotlin)

Create `android/app/src/main/java/[package]/BeaconScanService.kt`:

```kotlin
package app.lovable.869d11d7b08e4a16821c09d115bc2179

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class BeaconScanService : Service() {

    companion object {
        const val CHANNEL_ID = "BeaconScanChannel"
        const val NOTIFICATION_ID = 1000
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = createNotification()
        startForeground(NOTIFICATION_ID, notification)
        
        // BLE scanning is handled by the Capacitor plugin
        // This service just keeps the app alive in the background
        
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Beacon Scanning",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "مراقبة Beacon للتسجيل التلقائي"
                setShowBadge(false)
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("التسجيل التلقائي قيد التشغيل")
            .setContentText("يتم مراقبة Beacon للتسجيل التلقائي")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
}
```

## 3. Runtime Permission Handling

The app handles permissions at runtime via the Capacitor BLE plugin. When the user enables Beacon tracking:

1. **Android 12+ (API 31+)**: 
   - `BLUETOOTH_SCAN`
   - `BLUETOOTH_CONNECT`

2. **All Android versions**:
   - `ACCESS_FINE_LOCATION` (required for BLE scanning)

3. **Android 13+ (API 33+)**:
   - `POST_NOTIFICATIONS` (for foreground service notification)

## 4. Battery Optimization

For reliable background operation, users should:

### Samsung Devices:
1. Settings → Apps → [App Name] → Battery
2. Select "Unrestricted"
3. Settings → Battery → Background Usage Limits
4. Remove app from "Sleeping apps"
5. Remove app from "Deep sleeping apps"

### Stock Android:
1. Settings → Apps → [App Name] → Battery
2. Select "Unrestricted"

### Xiaomi/MIUI:
1. Settings → Apps → [App Name] → Battery Saver
2. Select "No restrictions"
3. Security → Permissions → Autostart → Enable for app

## 5. Fixed Configuration Values

These values are optimized for maximum detection range:

| Setting | Value | Description |
|---------|-------|-------------|
| UUID | `1B6295D5-4F74-4C58-A2D8-CD83CA26BDF4` | Fixed iBeacon UUID |
| Entry Threshold | **-90 dBm** | RSSI for entering range (expanded) |
| Exit Threshold | **-100 dBm** | RSSI for exiting range (expanded) |
| Immediate Threshold | **-95 dBm** | Instant registration threshold |
| Scan Interval | 1 second | Time between scans (fast) |
| Exit Confirm | 5 minutes | Time before confirming exit |
| Consecutive Reads | 1 | Single reading for entry |

## 5.1 Beacon TX Power Settings

For best detection through pockets and bags, configure your BC04P-MultiBeacon:

| Setting | Recommended Value |
|---------|-------------------|
| TX Power | **+4 dBm** (maximum) |
| Advertising Interval | **100ms** (fastest) |
| Mode | iBeacon |

## 6. Building the App

```bash
# Clone and setup
git clone [your-repo]
cd [your-project]
npm install

# Add Android platform
npx cap add android

# Sync changes
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android

# Build APK
# In Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s)
```

## 7. Testing Checklist

- [ ] App requests Bluetooth permissions on first enable
- [ ] App requests Location permission
- [ ] Beacon is detected when in range
- [ ] Auto check-in triggers on entry
- [ ] Auto check-out triggers after 30s outside range
- [ ] Notification appears when service is running
- [ ] Works with screen locked
- [ ] Works after device restart (with app opened)
- [ ] Sound plays on entry/exit events

## 8. iBeacon Configuration

Your BC04P-MultiBeacon should be configured with:
- **UUID**: `1B6295D5-4F74-4C58-A2D8-CD83CA26BDF4`
- **TX Power**: -59 dBm (at 1 meter)
- **Advertising Interval**: 100-350ms for best detection

Use the KBeaconPro app to configure these settings on your BC04P device.
