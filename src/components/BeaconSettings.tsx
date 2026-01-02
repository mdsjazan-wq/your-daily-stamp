import { useState, useEffect } from 'react';
import { Bluetooth, BluetoothOff, Radio, MapPin, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getBeaconConfig,
  saveBeaconConfig,
  isWebBluetoothSupported,
  isCapacitorApp,
  scanForBeacons,
  registerBeaconAttendance,
  initializeBluetooth,
  BeaconConfig,
} from '@/lib/beaconService';
import { BleDevice } from '@/lib/nativeBleService';
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

// Local type for connected device info
interface ConnectedDeviceInfo {
  id: string;
  name?: string;
}

const BeaconSettings = () => {
  const [config, setConfig] = useState<BeaconConfig>(getBeaconConfig);
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothSupported, setBluetoothSupported] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDeviceInfo | null>(null);
  const [bleInitialized, setBleInitialized] = useState(false);

  useEffect(() => {
    const initBle = async () => {
      const isNative = isCapacitorApp();
      setIsNativeApp(isNative);
      
      if (isNative) {
        // Initialize native BLE
        const initialized = await initializeBluetooth();
        setBleInitialized(initialized);
        setBluetoothSupported(initialized);
      } else {
        setBluetoothSupported(isWebBluetoothSupported());
        setBleInitialized(true);
      }
    };
    
    initBle();
  }, []);

  const handleConfigChange = (updates: Partial<BeaconConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    saveBeaconConfig(newConfig);
  };

  const handleScanBeacon = async () => {
    if (!bluetoothSupported) {
      toast.error('البلوتوث غير مدعوم', {
        description: isNativeApp ? 'يرجى تفعيل البلوتوث' : 'هذا المتصفح لا يدعم Web Bluetooth API',
      });
      return;
    }

    setIsScanning(true);
    try {
      const device = await scanForBeacons();
      if (device) {
        // Map BleDevice to ConnectedDeviceInfo
        setConnectedDevice({
          id: device.deviceId,
          name: device.name,
        });
        handleConfigChange({
          name: device.name || 'جهاز Beacon',
          enabled: true,
        });
        toast.success('تم العثور على الجهاز', {
          description: device.name || 'جهاز Beacon',
        });
      } else {
        toast.info('لم يتم اختيار جهاز');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('فشل البحث عن الأجهزة');
    } finally {
      setIsScanning(false);
    }
  };

  const handleManualCheckIn = () => {
    registerBeaconAttendance('entry');
    toast.success('تم تسجيل الدخول بنجاح', {
      description: 'تم تسجيل حضورك عبر Beacon',
    });
  };

  const handleManualCheckOut = () => {
    registerBeaconAttendance('exit');
    toast.success('تم تسجيل الخروج بنجاح', {
      description: 'تم تسجيل انصرافك عبر Beacon',
    });
  };

  return (
    <div className="bg-card rounded-3xl shadow-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Radio className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">إعدادات Beacon</h2>
      </div>

      {/* Beacon Support Status */}
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
        {isNativeApp && (
          <div className="flex items-center gap-2 text-sm mt-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-foreground">يعمل كتطبيق Native - جميع الميزات متاحة</span>
          </div>
        )}
        {!isNativeApp && bluetoothSupported && (
          <p className="text-xs text-muted-foreground mt-2">
            للحصول على تسجيل تلقائي في الخلفية، يُنصح بتحويل التطبيق إلى Native App
          </p>
        )}
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

      {config.enabled && (
        <>
          {/* Connected Device */}
          <div className="py-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {connectedDevice?.name || config.name || 'لم يتم الاتصال'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connectedDevice ? 'متصل' : 'غير متصل'}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleScanBeacon}
                disabled={isScanning || !bluetoothSupported}
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري البحث
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 ml-2" />
                    بحث
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* UUID Configuration */}
          <div className="py-3 border-b border-border/50">
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
            <p className="text-xs text-muted-foreground mt-1">
              يمكنك تخصيص UUID عبر تطبيق KBeaconPro
            </p>
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

          {/* Manual Registration Buttons */}
          <div className="pt-4 space-y-3">
            <p className="text-sm font-medium text-foreground mb-2">تسجيل يدوي</p>
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
        </>
      )}

      {/* Native App Notice */}
      {!isNativeApp && config.enabled && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>ملاحظة:</strong> للحصول على التسجيل التلقائي في الخلفية، تحتاج إلى تحويل التطبيق إلى Native App عبر Capacitor.
            حالياً، يمكنك استخدام التسجيل اليدوي عند الضغط على زر البحث واختيار جهاز Beacon.
          </p>
        </div>
      )}
    </div>
  );
};

export default BeaconSettings;
