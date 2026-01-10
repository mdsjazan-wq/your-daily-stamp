import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bluetooth, 
  BluetoothOff, 
  Radio, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Volume2,
  VolumeX,
  Signal,
  Settings2,
  TestTube2,
  Clock,
  Gauge
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  getBeaconConfig,
  saveBeaconConfig,
  isWebBluetoothSupported,
  isCapacitorApp,
  initializeBluetooth,
  BeaconConfig,
  logBeaconEvent,
} from '@/lib/beaconService';
import { 
  scanForDevices, 
  stopScan,
  BleDevice 
} from '@/lib/nativeBleService';
import {
  getRangeSettings,
  saveRangeSettings,
  getRangeState,
  processScanResult,
  resetRangeState,
  canAutoCheckIn,
  canAutoCheckOut,
  updateAutoCheckInTime,
  updateAutoCheckOutTime,
  formatTimeArabic,
  getCurrentRssiThreshold,
  getEntryThreshold,
  getExitThreshold,
  PRESET_LABELS,
  PRESET_RSSI_VALUES,
  RangePreset,
  BeaconRangeSettings,
  RangeState,
} from '@/lib/beaconRangeMonitor';
import {
  getAudioSettings,
  saveAudioSettings,
  playEntrySound,
  playExitSound,
  playTestSound,
  resumeAudioContext,
  isAudioSupported,
  BeaconAudioSettings,
} from '@/lib/beaconAudio';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// Extended scan result interface
interface ExtendedScanResult extends BleDevice {
  lastSeen: Date;
  isInRange: boolean;
}

const BeaconSettings = () => {
  // Core config
  const [config, setConfig] = useState<BeaconConfig>(getBeaconConfig);
  const [rangeSettings, setRangeSettings] = useState<BeaconRangeSettings>(getRangeSettings);
  const [audioSettings, setAudioSettings] = useState<BeaconAudioSettings>(getAudioSettings);
  const [rangeState, setRangeState] = useState<RangeState>(getRangeState);
  
  // UI states
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [bleInitialized, setBleInitialized] = useState(false);
  const [scanResults, setScanResults] = useState<ExtendedScanResult[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  
  // Refs
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backgroundScanRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initBle = async () => {
      const isNative = isCapacitorApp();
      setIsNativeApp(isNative);
      
      if (isNative) {
        const initialized = await initializeBluetooth();
        setBleInitialized(initialized);
        setBluetoothSupported(initialized);
      } else {
        setBluetoothSupported(isWebBluetoothSupported());
        setBleInitialized(true);
      }
    };
    
    initBle();
    
    // Resume audio context on first interaction
    const handleInteraction = () => {
      resumeAudioContext();
      window.removeEventListener('click', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    
    return () => {
      window.removeEventListener('click', handleInteraction);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (backgroundScanRef.current) clearInterval(backgroundScanRef.current);
    };
  }, []);

  // Background scanning for auto check-in/out
  useEffect(() => {
    if (!config.enabled || !bluetoothSupported || !isNativeApp) return;
    
    const runBackgroundScan = async () => {
      try {
        const devices = await scanForDevices(3000);
        const targetDevice = devices.find(d => 
          d.name?.toLowerCase().includes('beacon') || 
          d.name?.toLowerCase().includes('bc04')
        );
        
        const rssi = targetDevice?.rssi ?? null;
        const { event, state } = processScanResult(rssi, rangeSettings);
        setRangeState(state);
        
        if (event === 'enter' && config.autoCheckIn && canAutoCheckIn()) {
          // Trigger check-in through existing system
          handleAutoCheckIn();
        } else if (event === 'exit' && config.autoCheckOut && canAutoCheckOut()) {
          // Trigger check-out through existing system
          handleAutoCheckOut();
        }
      } catch (error) {
        console.error('Background scan error:', error);
      }
    };
    
    backgroundScanRef.current = setInterval(runBackgroundScan, rangeSettings.scanIntervalSeconds * 1000);
    
    return () => {
      if (backgroundScanRef.current) clearInterval(backgroundScanRef.current);
    };
  }, [config.enabled, config.autoCheckIn, config.autoCheckOut, bluetoothSupported, isNativeApp, rangeSettings]);

  const handleAutoCheckIn = useCallback(async () => {
    // Play entry sound if enabled
    if (audioSettings.entryEnabled) {
      const played = await playEntrySound(audioSettings.volume);
      if (!played) {
        toast.info('تم تسجيل الدخول', { description: 'دخول منطقة Beacon' });
      }
    }
    
    // Dispatch event to trigger existing check-in logic
    window.dispatchEvent(new CustomEvent('beaconAutoCheckIn'));
    updateAutoCheckInTime();
    logBeaconEvent('enter', { auto: true, rssi: rangeState.lastRssi });
    
    toast.success('تم تسجيل الدخول تلقائياً', {
      description: 'تم الكشف عن Beacon',
    });
  }, [audioSettings, rangeState.lastRssi]);

  const handleAutoCheckOut = useCallback(async () => {
    // Play exit sound if enabled
    if (audioSettings.exitEnabled) {
      const played = await playExitSound(audioSettings.volume);
      if (!played) {
        toast.info('تم تسجيل الخروج', { description: 'خروج من منطقة Beacon' });
      }
    }
    
    // Dispatch event to trigger existing check-out logic
    window.dispatchEvent(new CustomEvent('beaconAutoCheckOut'));
    updateAutoCheckOutTime();
    logBeaconEvent('exit', { auto: true });
    
    toast.success('تم تسجيل الخروج تلقائياً', {
      description: 'خروج من منطقة Beacon',
    });
  }, [audioSettings]);

  const handleConfigChange = (updates: Partial<BeaconConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveBeaconConfig(newConfig);
  };

  const handleRangeSettingsChange = (updates: Partial<BeaconRangeSettings>) => {
    const newSettings = { ...rangeSettings, ...updates };
    setRangeSettings(newSettings);
    saveRangeSettings(newSettings);
  };

  const handleAudioSettingsChange = (updates: Partial<BeaconAudioSettings>) => {
    const newSettings = { ...audioSettings, ...updates };
    setAudioSettings(newSettings);
    saveAudioSettings(newSettings);
  };

  const handleTestScan = async () => {
    if (!bluetoothSupported) {
      toast.error('البلوتوث غير مدعوم');
      return;
    }

    setIsScanning(true);
    setScanResults([]);
    setScanProgress(0);

    const duration = 12000; // 12 seconds
    const startTime = Date.now();
    const foundDevices = new Map<string, ExtendedScanResult>();

    // Progress timer
    scanIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setScanProgress(progress);
    }, 100);

    try {
      await scanForDevices(duration, (device) => {
        const rssi = device.rssi ?? -100;
        const threshold = getCurrentRssiThreshold(rangeSettings);
        const isInRange = rssi >= threshold;
        
        const extendedDevice: ExtendedScanResult = {
          ...device,
          lastSeen: new Date(),
          isInRange,
        };
        
        foundDevices.set(device.deviceId, extendedDevice);
        setScanResults(Array.from(foundDevices.values()));
      });
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('فشل البحث عن الأجهزة');
    } finally {
      setIsScanning(false);
      setScanProgress(100);
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      await stopScan();
    }
  };

  const handleManualCheckIn = async () => {
    // Play sound if enabled
    if (audioSettings.entryEnabled) {
      await playEntrySound(audioSettings.volume);
    }
    
    window.dispatchEvent(new CustomEvent('beaconAutoCheckIn'));
    updateAutoCheckInTime();
    setRangeState(getRangeState());
    logBeaconEvent('enter', { manual: true });
    
    toast.success('تم تسجيل الدخول بنجاح');
  };

  const handleManualCheckOut = async () => {
    // Play sound if enabled
    if (audioSettings.exitEnabled) {
      await playExitSound(audioSettings.volume);
    }
    
    window.dispatchEvent(new CustomEvent('beaconAutoCheckOut'));
    updateAutoCheckOutTime();
    setRangeState(getRangeState());
    logBeaconEvent('exit', { manual: true });
    
    toast.success('تم تسجيل الخروج بنجاح');
  };

  const handleTestSound = async (type: 'entry' | 'exit') => {
    const played = await playTestSound(type, audioSettings.volume);
    if (!played) {
      toast.error('فشل تشغيل الصوت', {
        description: 'تأكد من أن الصوت غير مكتوم',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Card */}
      <div className="bg-card rounded-3xl shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">إعدادات Beacon</h2>
        </div>

        {/* Bluetooth Support Status */}
        <div className="mb-4 p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-2 text-sm">
            {bluetoothSupported ? (
              <>
                <Bluetooth className="w-4 h-4 text-primary" />
                <span className="text-foreground">
                  {isNativeApp ? 'Bluetooth BLE مدعوم (Native)' : 'Web Bluetooth مدعوم'}
                </span>
              </>
            ) : (
              <>
                <BluetoothOff className="w-4 h-4 text-destructive" />
                <span className="text-muted-foreground">
                  {isNativeApp ? 'يرجى تفعيل البلوتوث' : 'Web Bluetooth غير مدعوم'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Enable Beacon */}
        <div className="flex items-center justify-between py-3 border-b border-border/50">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">تفعيل Beacon</p>
            <p className="text-xs text-muted-foreground mt-1">
              استخدام جهاز BC04P للتسجيل التلقائي
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => {
              handleConfigChange({ enabled: checked });
              toast.success(checked ? 'تم تفعيل Beacon' : 'تم تعطيل Beacon');
            }}
            disabled={!bluetoothSupported}
          />
        </div>
      </div>

      {config.enabled && (
        <>
          {/* Beacon Identification */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">تعريف Beacon</h3>
            </div>

            {/* UUID */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                معرف Beacon (UUID)
              </label>
              <input
                type="text"
                value={config.uuid}
                onChange={(e) => handleConfigChange({ uuid: e.target.value })}
                placeholder="E2C56DB5-DFFB-48D2-B060-D0F5A71096E0"
                className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none text-xs font-mono"
                dir="ltr"
              />
            </div>

            {/* Last Detection Info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">آخر اكتشاف</p>
                <p className="font-medium">{formatTimeArabic(rangeState.lastSeen)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">قوة الإشارة</p>
                <p className="font-medium" dir="ltr">
                  {rangeState.lastRssi !== null ? `${rangeState.lastRssi} dBm` : 'غير متوفر'}
                </p>
              </div>
            </div>
          </div>

          {/* Range Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Signal className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">إعداد المدى</h3>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              المدى يُحدد عبر قوة الإشارة (RSSI) داخل التطبيق. لا حاجة لتعديل إعدادات الجهاز نفسه.
            </p>

            {/* Preset Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                المدى المُعد مسبقاً
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PRESET_LABELS) as Array<Exclude<RangePreset, 'custom'>>).map((preset) => (
                  <Button
                    key={preset}
                    variant={rangeSettings.preset === preset ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleRangeSettingsChange({ preset })}
                    className="w-full"
                  >
                    {PRESET_LABELS[preset]}
                    <span className="text-xs opacity-70 mr-1" dir="ltr">
                      ({PRESET_RSSI_VALUES[preset]} dBm)
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Threshold */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  مخصص (متقدم)
                </label>
                <Switch
                  checked={rangeSettings.preset === 'custom'}
                  onCheckedChange={(checked) => 
                    handleRangeSettingsChange({ preset: checked ? 'custom' : 'medium' })
                  }
                />
              </div>
              {rangeSettings.preset === 'custom' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">حساس (بعيد)</span>
                    <span className="font-mono" dir="ltr">{rangeSettings.customRssiThreshold} dBm</span>
                    <span className="text-muted-foreground">دقيق (قريب)</span>
                  </div>
                  <Slider
                    value={[rangeSettings.customRssiThreshold]}
                    onValueChange={([value]) => handleRangeSettingsChange({ customRssiThreshold: value })}
                    min={-95}
                    max={-40}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <Separator className="my-4" />

            {/* Thresholds Display */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-green-500/10 rounded-xl">
                <p className="text-xs text-green-600 dark:text-green-400">عتبة الدخول</p>
                <p className="font-mono font-medium" dir="ltr">
                  ≥ {getEntryThreshold(rangeSettings)} dBm
                </p>
              </div>
              <div className="p-3 bg-red-500/10 rounded-xl">
                <p className="text-xs text-red-600 dark:text-red-400">عتبة الخروج</p>
                <p className="font-mono font-medium" dir="ltr">
                  &lt; {getExitThreshold(rangeSettings)} dBm
                </p>
              </div>
            </div>
          </div>

          {/* Stability Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">إعداد الاستقرار</h3>
            </div>

            {/* Scan Interval */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  فترة المسح (ثواني)
                </label>
                <span className="text-sm font-mono">{rangeSettings.scanIntervalSeconds}s</span>
              </div>
              <Slider
                value={[rangeSettings.scanIntervalSeconds]}
                onValueChange={([value]) => handleRangeSettingsChange({ scanIntervalSeconds: value })}
                min={3}
                max={15}
                step={1}
                className="w-full"
              />
            </div>

            {/* Exit Confirm Seconds */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  تأكيد الخروج (ثواني)
                </label>
                <span className="text-sm font-mono">{rangeSettings.exitConfirmSeconds}s</span>
              </div>
              <Slider
                value={[rangeSettings.exitConfirmSeconds]}
                onValueChange={([value]) => handleRangeSettingsChange({ exitConfirmSeconds: value })}
                min={5}
                max={60}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                المدة المطلوبة لتأكيد الخروج من النطاق
              </p>
            </div>

            {/* Required Readings */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">
                  قراءات الدخول المتتالية
                </label>
                <span className="text-sm font-mono">{rangeSettings.requiredConsecutiveReadings}</span>
              </div>
              <Slider
                value={[rangeSettings.requiredConsecutiveReadings]}
                onValueChange={([value]) => handleRangeSettingsChange({ requiredConsecutiveReadings: value })}
                min={2}
                max={5}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                عدد القراءات المتتالية المطلوبة لتأكيد الدخول
              </p>
            </div>
          </div>

          {/* Audio Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Volume2 className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">إعدادات الصوت</h3>
            </div>

            {!isAudioSupported() && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  الصوت غير مدعوم في هذا المتصفح
                </p>
              </div>
            )}

            {/* Entry Sound Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تنبيه صوتي عند الدخول</p>
                <p className="text-xs text-muted-foreground mt-1">تشغيل صوت عند دخول النطاق</p>
              </div>
              <Switch
                checked={audioSettings.entryEnabled}
                onCheckedChange={(checked) => handleAudioSettingsChange({ entryEnabled: checked })}
              />
            </div>

            {/* Exit Sound Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تنبيه صوتي عند الخروج</p>
                <p className="text-xs text-muted-foreground mt-1">تشغيل صوت عند الخروج من النطاق</p>
              </div>
              <Switch
                checked={audioSettings.exitEnabled}
                onCheckedChange={(checked) => handleAudioSettingsChange({ exitEnabled: checked })}
              />
            </div>

            {/* Volume Control */}
            <div className="py-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">مستوى الصوت</label>
                <span className="text-sm">{audioSettings.volume}%</span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-4 h-4 text-muted-foreground" />
                <Slider
                  value={[audioSettings.volume]}
                  onValueChange={([value]) => handleAudioSettingsChange({ volume: value })}
                  min={0}
                  max={100}
                  step={10}
                  className="flex-1"
                />
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>

            {/* Test Sounds */}
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestSound('entry')}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 ml-2 text-green-500" />
                اختبار صوت الدخول
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestSound('exit')}
                className="flex-1"
              >
                <XCircle className="w-4 h-4 ml-2 text-red-500" />
                اختبار صوت الخروج
              </Button>
            </div>
          </div>

          {/* Auto Registration Settings */}
          <div className="bg-card rounded-3xl shadow-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="w-5 h-5 text-primary" />
              <h3 className="text-md font-bold text-foreground">التسجيل التلقائي</h3>
            </div>

            {/* Auto Check-in */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تسجيل دخول تلقائي</p>
                <p className="text-xs text-muted-foreground mt-1">
                  تسجيل الحضور عند دخول منطقة Beacon
                </p>
              </div>
              <Switch
                checked={config.autoCheckIn}
                onCheckedChange={(checked) => handleConfigChange({ autoCheckIn: checked })}
              />
            </div>

            {/* Auto Check-out */}
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">تسجيل خروج تلقائي</p>
                <p className="text-xs text-muted-foreground mt-1">
                  تسجيل الانصراف عند مغادرة منطقة Beacon
                </p>
              </div>
              <Switch
                checked={config.autoCheckOut}
                onCheckedChange={(checked) => handleConfigChange({ autoCheckOut: checked })}
              />
            </div>

            {/* Last Events */}
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">آخر دخول نطاق</p>
                </div>
                <p className="font-medium">{formatTimeArabic(rangeState.lastEnterEventAt)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">آخر خروج نطاق</p>
                </div>
                <p className="font-medium">{formatTimeArabic(rangeState.lastExitEventAt)}</p>
              </div>
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
                {rangeState.lastRssi !== null && (
                  <span className="text-sm font-mono" dir="ltr">
                    {rangeState.lastRssi} dBm
                  </span>
                )}
              </div>
            </div>

            {/* Scan Button */}
            <Button
              variant="default"
              className="w-full mb-4"
              onClick={handleTestScan}
              disabled={isScanning || !bluetoothSupported}
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري البحث ({Math.round(scanProgress)}%)
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
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground mb-2">
                  الأجهزة المكتشفة ({scanResults.length})
                </p>
                {scanResults.map((device) => (
                  <div
                    key={device.deviceId}
                    className={`p-3 rounded-xl border ${
                      device.isInRange 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-muted/50 border-border/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">
                        {device.name || 'جهاز غير معروف'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        device.isInRange 
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {device.isInRange ? 'داخل النطاق' : 'خارج النطاق'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono" dir="ltr">
                      <span>ID: {device.deviceId.substring(0, 17)}...</span>
                      {device.rssi && (
                        <span className="mr-3">RSSI: {device.rssi} dBm</span>
                      )}
                    </div>
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
                      هل تريد تسجيل حضورك الآن عبر Beacon؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleManualCheckIn}>
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
                      هل تريد تسجيل انصرافك الآن عبر Beacon؟
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleManualCheckOut}>
                      تسجيل الخروج
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Native App Notice */}
          {!isNativeApp && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-4">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>ملاحظة:</strong> للحصول على التسجيل التلقائي في الخلفية، تحتاج إلى تحويل التطبيق إلى Native App عبر Capacitor.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BeaconSettings;
