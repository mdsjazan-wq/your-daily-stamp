/**
 * Native Beacon Settings Component
 * Simplified UI for Native-first iBeacon integration
 * UUID is fixed, settings are minimal, works only on Native
 */

import { useState, useEffect } from 'react';
import {
  Radio,
  Bluetooth,
  BluetoothOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Volume2,
  VolumeX,
  TestTube2,
  Clock,
  Copy,
  Smartphone,
  AlertTriangle,
  Settings,
  BatteryWarning,
  MapPin,
  Info,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import useNativeBeacon from '@/hooks/useNativeBeacon';
import { 
  RSSI_ENTRY_THRESHOLD, 
  RSSI_EXIT_THRESHOLD,
  SCAN_INTERVAL_SECONDS,
  EXIT_CONFIRM_SECONDS,
  CONSECUTIVE_READS_REQUIRED,
} from '@/lib/beaconConstants';
import { playTestSound } from '@/lib/beaconAudio';

const NativeBeaconSettings = () => {
  const {
    // Platform
    isNative,
    isLoading,
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
    fixedUuid,

    // Actions
    enableBluetooth,
    toggleBeaconTracking,
    performTestScan,
    performManualCheckIn,
    performManualCheckOut,
    copyUuid,

    // Utilities
    formatTime,
    formatDistance,
  } = useNativeBeacon();

  const [showBatteryGuide, setShowBatteryGuide] = useState(false);

  // Show battery optimization guide on first enable
  useEffect(() => {
    if (settings.enabled && !localStorage.getItem('batteryGuideShown')) {
      setShowBatteryGuide(true);
      localStorage.setItem('batteryGuideShown', 'true');
    }
  }, [settings.enabled]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Web/PWA View - Show warning
  if (!isNative) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">إعدادات Beacon</h2>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <Smartphone className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-2">
                  ميزة Beacon تعمل فقط في النسخة Native
                </h3>
                <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                  للاستفادة من التسجيل التلقائي عبر Beacon، يجب تثبيت التطبيق كتطبيق Native على جهاز Android.
                </p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1">
                  <li>• يتطلب تصدير المشروع إلى Capacitor</li>
                  <li>• يعمل على Android 8 وأحدث</li>
                  <li>• يدعم العمل في الخلفية مع قفل الشاشة</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Show UUID for reference */}
          <div className="mt-4 p-3 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">UUID الثابت (للمرجعية)</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-foreground flex-1 truncate" dir="ltr">
                {fixedUuid}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={copyUuid}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Native View
  return (
    <div className="space-y-6">
      {/* Main Card */}
      <div className="bg-card rounded-3xl shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">إعدادات Beacon</h2>
        </div>

        {/* Bluetooth Status */}
        <div className="mb-4 p-3 rounded-xl bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {bluetoothOn ? (
                <>
                  <Bluetooth className="w-4 h-4 text-primary" />
                  <span className="text-foreground">البلوتوث مفعّل</span>
                </>
              ) : (
                <>
                  <BluetoothOff className="w-4 h-4 text-destructive" />
                  <span className="text-muted-foreground">البلوتوث غير مفعّل</span>
                </>
              )}
            </div>
            {!bluetoothOn && (
              <Button
                variant="outline"
                size="sm"
                onClick={enableBluetooth}
              >
                تفعيل
              </Button>
            )}
          </div>
        </div>

        {/* Enable Beacon Tracking */}
        <div className="flex items-center justify-between py-3 border-b border-border/50">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">تفعيل تتبع Beacon</p>
            <p className="text-xs text-muted-foreground mt-1">
              التسجيل التلقائي عند دخول/خروج نطاق الجهاز
            </p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(checked) => toggleBeaconTracking(checked)}
            disabled={!bluetoothOn}
          />
        </div>

        {/* Scan-based notice */}
        {settings.enabled && (
          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                يتم الاعتماد على المسح (Scan) وليس الاتصال المباشر. لا حاجة لإقران الجهاز.
              </p>
            </div>
          </div>
        )}

        {/* Service Status */}
        {settings.enabled && (
          <div className={`mt-3 p-3 rounded-xl ${
            serviceRunning 
              ? 'bg-green-500/10 border border-green-500/30' 
              : 'bg-amber-500/10 border border-amber-500/30'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              {serviceRunning ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-700 dark:text-green-400">خدمة Beacon تعمل</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700 dark:text-amber-400">خدمة Beacon متوقفة</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {settings.enabled && (
        <>
          {/* UUID Display (Read-only) */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">معرف Beacon</h3>
            </div>

            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">UUID (ثابت)</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-foreground flex-1 truncate" dir="ltr">
                  {fixedUuid}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={copyUuid}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Detection Info */}
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">آخر اكتشاف</p>
                <p className="font-medium">{formatTime(rangeState.lastSeen)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">المسافة التقريبية</p>
                <p className="font-medium">
                  {rangeState.lastDistance !== null 
                    ? formatDistance(rangeState.lastDistance)
                    : 'غير معروف'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">تقديرية</p>
              </div>
            </div>
          </div>

          {/* Auto Registration Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">التسجيل التلقائي</h3>
            </div>

            {/* Auto Check-in */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تسجيل دخول تلقائي</p>
                <p className="text-xs text-muted-foreground mt-1">
                  عند دخول نطاق Beacon
                </p>
              </div>
              <Switch
                checked={settings.autoCheckIn}
                onCheckedChange={(checked) => updateSettings({ autoCheckIn: checked })}
              />
            </div>

            {/* Auto Check-out */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تسجيل خروج تلقائي</p>
                <p className="text-xs text-muted-foreground mt-1">
                  عند الخروج من نطاق Beacon
                </p>
              </div>
              <Switch
                checked={settings.autoCheckOut}
                onCheckedChange={(checked) => updateSettings({ autoCheckOut: checked })}
              />
            </div>

            {/* Last Events */}
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">آخر دخول نطاق</p>
                </div>
                <p className="font-medium">{formatTime(rangeState.lastEnterAt)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">آخر خروج نطاق</p>
                </div>
                <p className="font-medium">{formatTime(rangeState.lastExitAt)}</p>
              </div>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">إعدادات الصوت</h3>
            </div>

            {/* Entry Sound */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تنبيه عند الدخول</p>
              </div>
              <Switch
                checked={audioSettings.entryEnabled}
                onCheckedChange={(checked) => updateAudioSettings({ entryEnabled: checked })}
              />
            </div>

            {/* Exit Sound */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تنبيه عند الخروج</p>
              </div>
              <Switch
                checked={audioSettings.exitEnabled}
                onCheckedChange={(checked) => updateAudioSettings({ exitEnabled: checked })}
              />
            </div>

            {/* Volume */}
            <div className="py-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">مستوى الصوت</label>
                <span className="text-sm">{audioSettings.volume}%</span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[audioSettings.volume]}
                  onValueChange={([value]) => updateAudioSettings({ volume: value })}
                  min={0}
                  max={100}
                  step={10}
                  className="flex-1"
                />
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Test Sounds */}
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => playTestSound('entry', audioSettings.volume)}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 ml-2 text-green-500" />
                اختبار الدخول
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => playTestSound('exit', audioSettings.volume)}
                className="flex-1"
              >
                <XCircle className="w-4 h-4 ml-2 text-red-500" />
                اختبار الخروج
              </Button>
            </div>
          </div>

          {/* Test & Scan Section */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TestTube2 className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">الاختبار والبحث</h3>
            </div>

            {/* Current Status */}
            <div className={`mb-4 p-4 rounded-xl ${
              rangeState.isInRange 
                ? 'bg-green-500/10 border border-green-500/30' 
                : 'bg-muted/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {rangeState.isInRange ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="font-medium">
                    {rangeState.isInRange ? 'داخل النطاق' : 'خارج النطاق'}
                  </span>
                </div>
                {rangeState.lastDistance !== null && (
                  <span className="text-sm text-muted-foreground">
                    ~{formatDistance(rangeState.lastDistance)}
                  </span>
                )}
              </div>
            </div>

            {/* Scan Button */}
            <Button
              variant="default"
              className="w-full mb-4"
              onClick={performTestScan}
              disabled={isScanning || !bluetoothOn}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري البحث ({remainingSeconds} ثانية)
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4 ml-2" />
                  بحث عن الأجهزة (12 ثانية)
                </>
              )}
            </Button>

            {/* Scan Progress */}
            {isScanning && (
              <div className="mb-4">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Scan Results */}
            {scanResults.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium text-foreground">
                  الأجهزة المكتشفة ({scanResults.length})
                </p>
                {scanResults.slice(0, 10).map((beacon) => (
                  <div
                    key={beacon.deviceId}
                    className={`p-3 rounded-xl border ${
                      beacon.matchesTarget
                        ? 'bg-green-500/10 border-green-500/30'
                        : beacon.iBeacon
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-muted/50 border-border/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {beacon.name || 'جهاز غير معروف'}
                      </span>
                      {beacon.matchesTarget && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                          مطابق
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                      RSSI: {beacon.rssi} dBm
                      {beacon.iBeacon && (
                        <span className="mr-2">| UUID: {beacon.iBeacon.uuid.substring(0, 8)}...</span>
                      )}
                    </div>
                    {beacon.iBeacon && (
                      <div className="text-xs text-muted-foreground mt-1">
                        المسافة: ~{formatDistance((10 ** ((-59 - beacon.rssi) / (10 * 2.2))))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Manual Registration */}
            <Separator className="my-4" />
            <p className="text-sm font-medium text-foreground mb-3">تسجيل يدوي</p>
            <div className="grid grid-cols-2 gap-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <CheckCircle2 className="w-4 h-4 ml-2 text-green-500" />
                    تسجيل دخول
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد تسجيل الدخول</AlertDialogTitle>
                    <AlertDialogDescription>
                      هل تريد تسجيل حضورك الآن؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={performManualCheckIn}>
                      تسجيل الدخول
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <XCircle className="w-4 h-4 ml-2 text-destructive" />
                    تسجيل خروج
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد تسجيل الخروج</AlertDialogTitle>
                    <AlertDialogDescription>
                      هل تريد تسجيل انصرافك الآن؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={performManualCheckOut}>
                      تسجيل الخروج
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Battery Optimization Guide */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <BatteryWarning className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">تحسين البطارية</h3>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                لضمان عمل التسجيل أثناء قفل الشاشة، يُنصح بتعديل إعدادات البطارية للتطبيق.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">1.</span>
                <p className="text-foreground">اذهب إلى إعدادات البطارية للتطبيق</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">2.</span>
                <p className="text-foreground">اختر "غير مقيّد" أو "Unrestricted"</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary font-bold">3.</span>
                <p className="text-foreground">لأجهزة Samsung: أزل التطبيق من "التطبيقات النائمة"</p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                toast.info('افتح إعدادات الجهاز > التطبيقات > هذا التطبيق > البطارية');
              }}
            >
              <Settings className="w-4 h-4 ml-2" />
              عرض التعليمات
            </Button>
          </div>

          {/* Fixed Settings Info */}
          <div className="bg-muted/50 rounded-3xl p-4">
            <p className="text-xs text-muted-foreground text-center mb-2">
              إعدادات ثابتة للاستقرار
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-background/50 rounded-lg">
                <p className="text-muted-foreground">فترة المسح</p>
                <p className="font-medium">{SCAN_INTERVAL_SECONDS}s</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <p className="text-muted-foreground">تأكيد الخروج</p>
                <p className="font-medium">{EXIT_CONFIRM_SECONDS}s</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <p className="text-muted-foreground">قراءات الدخول</p>
                <p className="font-medium">{CONSECUTIVE_READS_REQUIRED}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs mt-2">
              <div className="p-2 bg-background/50 rounded-lg">
                <p className="text-muted-foreground">عتبة الدخول</p>
                <p className="font-medium font-mono" dir="ltr">≥ {RSSI_ENTRY_THRESHOLD} dBm</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <p className="text-muted-foreground">عتبة الخروج</p>
                <p className="font-medium font-mono" dir="ltr">&lt; {RSSI_EXIT_THRESHOLD} dBm</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NativeBeaconSettings;
