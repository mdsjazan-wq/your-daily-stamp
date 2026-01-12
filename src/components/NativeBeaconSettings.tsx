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
  Smartphone,
  AlertTriangle,
  Settings,
  BatteryWarning,
  Signal,
  Timer,
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
    rssiPresets,

    // Actions
    enableBluetooth,
    toggleBeaconTracking,
    performTestScan,
    performManualCheckIn,
    performManualCheckOut,
    copyUuid,
    openAppSettings,

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

  // Web/PWA View - Show simple message
  if (!isNative) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">التسجيل التلقائي</h2>
          </div>

          <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex flex-col items-center text-center gap-4">
              <Smartphone className="w-12 h-12 text-amber-600 dark:text-amber-400" />
              <div>
                <h3 className="font-semibold text-amber-700 dark:text-amber-300 mb-2 text-lg">
                  متاح في تطبيق الهاتف فقط
                </h3>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  قم بتحميل التطبيق للاستفادة من ميزة التسجيل التلقائي
                </p>
              </div>
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
        <div className={`mb-4 p-3 rounded-xl ${bluetoothOn ? 'bg-muted/50' : 'bg-red-500/10 border border-red-500/30'}`}>
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
                  <span className="text-red-600 dark:text-red-400">البلوتوث غير مفعّل</span>
                </>
              )}
            </div>
            {!bluetoothOn && (
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={enableBluetooth}
                >
                  تفعيل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openAppSettings}
                >
                  الإعدادات
                </Button>
              </div>
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
            <div className="flex items-center justify-between py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تسجيل خروج تلقائي</p>
                <p className="text-xs text-muted-foreground mt-1">
                  عند دخول نطاق Beacon (بعد استيفاء الشروط)
                </p>
              </div>
              <Switch
                checked={settings.autoCheckOut}
                onCheckedChange={(checked) => updateSettings({ autoCheckOut: checked })}
              />
            </div>
          </div>

          {/* Range & Duration Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Signal className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">إعدادات النطاق والمدة</h3>
            </div>

            {/* RSSI Threshold Selection */}
            <div className="py-3 border-b border-border/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">نطاق الكشف</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    المسافة التي يتم عندها التسجيل
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(rssiPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => updateSettings({ rssiThreshold: preset.value })}
                    className={`p-3 rounded-xl text-sm transition-all ${
                      settings.rssiThreshold === preset.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted text-foreground'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                الحالي: {settings.rssiThreshold} dBm
              </p>
            </div>

            {/* Minimum Work Hours */}
            <div className="py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">الحد الأدنى للعمل</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      المدة المطلوبة قبل تسجيل الخروج
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">{settings.minWorkHours} ساعات</span>
              </div>
              <Slider
                value={[settings.minWorkHours]}
                onValueChange={([value]) => updateSettings({ minWorkHours: value })}
                min={1}
                max={8}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 ساعة</span>
                <span>8 ساعات</span>
              </div>
            </div>
          </div>

          {/* Last Events */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">آخر الأحداث</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">آخر تسجيل حضور</p>
                </div>
                <p className="font-medium">{formatTime(rangeState.lastAutoCheckInAt)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">آخر تسجيل انصراف</p>
                </div>
                <p className="font-medium">{formatTime(rangeState.lastAutoCheckOutAt)}</p>
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
              onClick={openAppSettings}
            >
              <Settings className="w-4 h-4 ml-2" />
              فتح إعدادات التطبيق
            </Button>
          </div>

        </>
      )}
    </div>
  );
};

export default NativeBeaconSettings;
