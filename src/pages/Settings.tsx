import { useState, useRef, useEffect } from "react";
import { ArrowRight, Edit3, Plus, Upload, Trash2, Save, X, Bell, AlertTriangle, Calculator, Info, RefreshCw, BellRing } from "lucide-react";
import { APP_VERSION, APP_BUILD_ID, APP_NAME } from "@/lib/version";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  showNotification,
  getNotificationSoundEnabled,
  saveNotificationSoundEnabled,
  playNotificationSound,
} from "@/lib/notifications";
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
} from "@/components/ui/alert-dialog";

interface AttendanceRecord {
  date: string;
  entryTime: string;
  expectedExitTime: string;
  actualExitTime: string | null;
  status: "منتظم" | "متأخر";
  exitStatus: "خروج نظامي" | "خروج مبكر" | null;
}

const Settings = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem("attendanceRecords");
    return saved ? JSON.parse(saved) : [];
  });
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editTimes, setEditTimes] = useState<{ entryTime24: string; actualExitTime24: string }>(
    {
      entryTime24: "",
      actualExitTime24: "",
    }
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: "",
    entryTime: "",
    actualExitTime: "",
  });
  const [reminderMinutes, setReminderMinutes] = useState(10);
  const [exitReminderMinutes, setExitReminderMinutes] = useState(5);
  const [overtimeEnabled, setOvertimeEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("reminderMinutes");
    if (saved) {
      setReminderMinutes(parseInt(saved, 10));
    }

    const exitReminderSaved = localStorage.getItem("exitReminderMinutes");
    if (exitReminderSaved) {
      setExitReminderMinutes(parseInt(exitReminderSaved, 10));
    }

    const overtimeSaved = localStorage.getItem("overtimeEnabled");
    if (overtimeSaved !== null) {
      setOvertimeEnabled(overtimeSaved === "true");
    }

    // Load notification settings
    setNotificationsEnabled(getNotificationSettings());
    setNotificationSoundEnabled(getNotificationSoundEnabled());
    setNotificationPermission(getNotificationPermission());
  }, []);

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!isNotificationSupported()) {
        toast.error("الإشعارات غير مدعومة", {
          description: "متصفحك لا يدعم الإشعارات",
        });
        return;
      }

      const permission = await requestNotificationPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        setNotificationsEnabled(true);
        saveNotificationSettings(true);
        toast.success("تم تفعيل الإشعارات", {
          description: "ستتلقى إشعارات تذكيرية بوقت الانصراف",
        });
      } else if (permission === "denied") {
        toast.error("تم رفض الإذن", {
          description: "يرجى السماح بالإشعارات من إعدادات المتصفح",
        });
      }
    } else {
      setNotificationsEnabled(false);
      saveNotificationSettings(false);
      toast.success("تم تعطيل الإشعارات");
    }
  };

  const handleReminderChange = (value: number) => {
    setReminderMinutes(value);
    localStorage.setItem("reminderMinutes", value.toString());
    toast.success(`تم تعيين التنبيه قبل ${value} دقيقة من الانصراف`);
  };

  const saveRecords = (newRecords: AttendanceRecord[]) => {
    localStorage.setItem("attendanceRecords", JSON.stringify(newRecords));
    setRecords(newRecords);
  };

  const normalizeArabicNumerals = (input: string): string => {
    const map: Record<string, string> = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
    };
    return input.replace(/[٠-٩]/g, (d) => map[d] ?? d);
  };

  const arabicTimeTo24 = (timeStr: string): string | null => {
    const raw = normalizeArabicNumerals(timeStr).trim();

    // Already 24h (HH:MM)
    if (/^\d{1,2}:\d{2}$/.test(raw) && !raw.includes(" ")) {
      const [h, m] = raw.split(":");
      return `${h.padStart(2, "0")}:${m}`;
    }

    // Arabic with period: "7:05 ص" / "3:00 م"
    const parts = raw.split(/\s+/);
    if (parts.length < 2) return null;
    const time = parts[0];
    const period = parts[1];

    const [hh, mm] = time.split(":").map((n) => Number(n));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

    let h = hh;
    if (period === "م" && hh !== 12) h += 12;
    if (period === "ص" && hh === 12) h = 0;

    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const isValidTime24 = (value: string) => /^\d{2}:\d{2}$/.test(value);

  const formatTimeToArabic = (time24: string): string => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "م" : "ص";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const calculateExpectedExit = (entryTime: string): string => {
    const [hours, minutes] = entryTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    const minTime = 7 * 60; // 7:00 AM

    // إذا كان الحضور الساعة 7 صباحاً أو قبلها، يكون الخروج الساعة 3 عصراً
    if (totalMinutes <= minTime) {
      return "15:00";
    }

    const exitHours = (hours + 8) % 24;
    return `${exitHours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  };

  const determineStatus = (entryTime: string): "منتظم" | "متأخر" => {
    const [hours, minutes] = entryTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes > 9 * 60 ? "متأخر" : "منتظم";
  };

  const determineExitStatus = (
    expectedExit: string,
    actualExit: string
  ): "خروج نظامي" | "خروج مبكر" => {
    const [expH, expM] = expectedExit.split(":").map(Number);
    const [actH, actM] = actualExit.split(":").map(Number);
    const expMinutes = expH * 60 + expM;
    const actMinutes = actH * 60 + actM;
    return actMinutes < expMinutes - 5 ? "خروج مبكر" : "خروج نظامي";
  };

  // Sync edit form fields when selecting a record
  useEffect(() => {
    if (!editingRecord) return;
    setEditTimes({
      entryTime24: arabicTimeTo24(editingRecord.entryTime) ?? "",
      actualExitTime24: editingRecord.actualExitTime
        ? arabicTimeTo24(editingRecord.actualExitTime) ?? ""
        : "",
    });
  }, [editingRecord]);

  const handleAddRecord = () => {
    if (!newRecord.date || !newRecord.entryTime) {
      toast.error("يرجى إدخال التاريخ ووقت الدخول");
      return;
    }

    // التحقق من يوم الإجازة (الجمعة والسبت)
    const selectedDate = new Date(newRecord.date);
    const dayOfWeek = selectedDate.getDay(); // 0 = الأحد, 5 = الجمعة, 6 = السبت
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      toast.error("يوم إجازة", {
        description: "لا يمكن إضافة سجل في أيام الجمعة والسبت",
      });
      return;
    }

    // التحقق من وجود سجل مسبق لهذا اليوم
    const existingRecord = records.find((r) => r.date === newRecord.date);
    if (existingRecord) {
      toast.error("سجل موجود مسبقاً", {
        description: "يوجد سجل لهذا اليوم بالفعل. يمكنك تعديله أو حذفه من قائمة السجلات",
      });
      return;
    }

    const expectedExitTime = calculateExpectedExit(newRecord.entryTime);
    const status = determineStatus(newRecord.entryTime);
    const exitStatus = newRecord.actualExitTime
      ? determineExitStatus(expectedExitTime, newRecord.actualExitTime)
      : null;

    const record: AttendanceRecord = {
      date: newRecord.date,
      entryTime: formatTimeToArabic(newRecord.entryTime),
      expectedExitTime: formatTimeToArabic(expectedExitTime),
      actualExitTime: newRecord.actualExitTime
        ? formatTimeToArabic(newRecord.actualExitTime)
        : null,
      status,
      exitStatus,
    };

    const existingIndex = records.findIndex((r) => r.date === newRecord.date);
    let updatedRecords: AttendanceRecord[];
    if (existingIndex >= 0) {
      updatedRecords = [...records];
      updatedRecords[existingIndex] = record;
    } else {
      updatedRecords = [record, ...records];
    }

    updatedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    saveRecords(updatedRecords);
    setNewRecord({ date: "", entryTime: "", actualExitTime: "" });
    setShowAddForm(false);
    toast.success("تم إضافة السجل بنجاح");
  };

  const handleUpdateRecord = () => {
    if (!editingRecord) return;

    if (!isValidTime24(editTimes.entryTime24)) {
      toast.error("وقت دخول غير صالح", {
        description: "اختر وقت الدخول بصيغة صحيحة (HH:MM)",
      });
      return;
    }

    if (editTimes.actualExitTime24 && !isValidTime24(editTimes.actualExitTime24)) {
      toast.error("وقت خروج غير صالح", {
        description: "اختر وقت الخروج بصيغة صحيحة (HH:MM)",
      });
      return;
    }

    const expectedExit24 = calculateExpectedExit(editTimes.entryTime24);
    const status = determineStatus(editTimes.entryTime24);
    const exitStatus = editTimes.actualExitTime24
      ? determineExitStatus(expectedExit24, editTimes.actualExitTime24)
      : null;

    const updatedRecord: AttendanceRecord = {
      ...editingRecord,
      entryTime: formatTimeToArabic(editTimes.entryTime24),
      expectedExitTime: formatTimeToArabic(expectedExit24),
      actualExitTime: editTimes.actualExitTime24
        ? formatTimeToArabic(editTimes.actualExitTime24)
        : null,
      status,
      exitStatus,
    };

    const updatedRecords = records.map((r) => (r.date === updatedRecord.date ? updatedRecord : r));
    saveRecords(updatedRecords);

    // إذا كان هذا سجل اليوم الحالي، نحدّث بيانات اليوم في الصفحة الرئيسية أيضاً
    const todayKey = new Date().toISOString().split("T")[0];
    if (updatedRecord.date === todayKey) {
      localStorage.setItem(
        `today_${todayKey}`,
        JSON.stringify({
          entryTime: updatedRecord.entryTime,
          expectedExitTime: updatedRecord.expectedExitTime,
          status: updatedRecord.status,
        })
      );
      window.dispatchEvent(new CustomEvent("todayDataCleared"));
    }

    setEditingRecord(null);
    toast.success("تم تحديث السجل بنجاح");
  };

  const handleDeleteRecord = (date: string) => {
    const updatedRecords = records.filter((r) => r.date !== date);
    saveRecords(updatedRecords);
    
    // إذا كان السجل المحذوف هو سجل اليوم الحالي، نمسح بيانات اليوم أيضاً
    const todayKey = new Date().toISOString().split("T")[0];
    if (date === todayKey) {
      localStorage.removeItem(`today_${todayKey}`);
      // إرسال حدث مخصص لتحديث الصفحة الرئيسية
      window.dispatchEvent(new CustomEvent("todayDataCleared"));
    }
    
    toast.success("تم حذف السجل بنجاح");
  };

  const handleDeleteAllRecords = () => {
    // مسح جميع السجلات
    saveRecords([]);
    
    // مسح بيانات اليوم الحالي
    const todayKey = new Date().toISOString().split("T")[0];
    localStorage.removeItem(`today_${todayKey}`);
    window.dispatchEvent(new CustomEvent("todayDataCleared"));
    
    toast.success("تم حذف جميع السجلات بنجاح");
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      const importedRecords: AttendanceRecord[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length >= 3) {
          const [date, entryTime, actualExitTime] = parts;
          
          if (date && entryTime) {
            const expectedExitTime = calculateExpectedExit(entryTime);
            const status = determineStatus(entryTime);
            const exitStatus = actualExitTime
              ? determineExitStatus(expectedExitTime, actualExitTime)
              : null;

            importedRecords.push({
              date,
              entryTime: entryTime.includes(":") && !entryTime.includes(" ")
                ? formatTimeToArabic(entryTime)
                : entryTime,
              expectedExitTime: formatTimeToArabic(expectedExitTime),
              actualExitTime: actualExitTime
                ? (actualExitTime.includes(":") && !actualExitTime.includes(" ")
                    ? formatTimeToArabic(actualExitTime)
                    : actualExitTime)
                : null,
              status,
              exitStatus,
            });
          }
        }
      }

      if (importedRecords.length > 0) {
        const mergedRecords = [...records];
        importedRecords.forEach((imp) => {
          const existingIndex = mergedRecords.findIndex((r) => r.date === imp.date);
          if (existingIndex >= 0) {
            mergedRecords[existingIndex] = imp;
          } else {
            mergedRecords.push(imp);
          }
        });
        mergedRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        saveRecords(mergedRecords);
        toast.success(`تم استيراد ${importedRecords.length} سجل بنجاح`);
      } else {
        toast.error("لم يتم العثور على سجلات صالحة في الملف");
      }
    } catch {
      toast.error("حدث خطأ أثناء قراءة الملف");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 px-4 shadow-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link
            to="/"
            className="p-2 hover:bg-primary-foreground/10 rounded-xl transition-colors"
          >
            <ArrowRight className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">إعدادات السجلات</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 p-4 bg-primary text-primary-foreground rounded-2xl font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            إضافة سجل
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 p-4 bg-secondary text-secondary-foreground rounded-2xl font-semibold hover:bg-secondary/80 transition-colors"
          >
            <Upload className="w-5 h-5" />
            استيراد ملف
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileImport}
            className="hidden"
          />
        </div>

        {/* Add Form - يظهر مباشرة تحت الأزرار */}
        {showAddForm && (
          <div className="bg-card rounded-3xl shadow-card p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">إضافة سجل جديد</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">التاريخ</label>
                <input
                  type="date"
                  value={newRecord.date}
                  onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })}
                  className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">وقت الدخول</label>
                <input
                  type="time"
                  value={newRecord.entryTime}
                  onChange={(e) => setNewRecord({ ...newRecord, entryTime: e.target.value })}
                  className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">وقت الخروج (اختياري)</label>
                <input
                  type="time"
                  value={newRecord.actualExitTime}
                  onChange={(e) => setNewRecord({ ...newRecord, actualExitTime: e.target.value })}
                  className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <button
                onClick={handleAddRecord}
                className="w-full flex items-center justify-center gap-2 p-3 gradient-success text-success-foreground rounded-xl font-semibold"
              >
                <Save className="w-5 h-5" />
                حفظ السجل
              </button>
            </div>
          </div>
        )}

        {/* Reminder Settings */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">إعدادات التنبيه</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              التنبيه قبل الانصراف بـ (دقيقة)
            </label>
            <select
              value={reminderMinutes}
              onChange={(e) => handleReminderChange(parseInt(e.target.value, 10))}
              className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
            >
              <option value={5}>5 دقائق</option>
              <option value={10}>10 دقائق</option>
              <option value={15}>15 دقيقة</option>
              <option value={20}>20 دقيقة</option>
              <option value={30}>30 دقيقة</option>
              <option value={45}>45 دقيقة</option>
              <option value={60}>ساعة</option>
            </select>
          </div>

          {/* Exit Reminder Minutes Setting */}
          <div className="mt-4 pt-4 border-t border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              تنبيه نسيان بصمة الخروج بعد (دقيقة)
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              سيتم تنبيهك إذا لم تسجل الخروج بعد مرور هذه المدة من وقت الانصراف المتوقع
            </p>
            <select
              value={exitReminderMinutes}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setExitReminderMinutes(value);
                localStorage.setItem("exitReminderMinutes", value.toString());
                toast.success(`تم تغيير وقت تنبيه نسيان الخروج إلى ${value} دقائق`);
              }}
              className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
            >
              <option value={3}>3 دقائق</option>
              <option value={5}>5 دقائق</option>
              <option value={10}>10 دقائق</option>
              <option value={15}>15 دقيقة</option>
              <option value={20}>20 دقيقة</option>
              <option value={30}>30 دقيقة</option>
            </select>
          </div>

          {/* Push Notifications Setting */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">إشعارات Push</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  تلقي إشعارات حتى عندما يكون التطبيق مغلقاً
                </p>
                {notificationPermission === 'denied' && (
                  <p className="text-xs text-destructive mt-1">
                    تم رفض الإذن. يرجى السماح من إعدادات المتصفح
                  </p>
                )}
                {notificationPermission === 'unsupported' && (
                  <p className="text-xs text-warning mt-1">
                    الإشعارات غير مدعومة في هذا المتصفح
                  </p>
                )}
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleNotificationToggle}
                disabled={notificationPermission === 'unsupported' || notificationPermission === 'denied'}
              />
            </div>
            
            {/* Notification Sound Toggle */}
            {notificationsEnabled && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">صوت التنبيه</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    تشغيل صوت عند وصول الإشعارات
                  </p>
                </div>
                <Switch
                  checked={notificationSoundEnabled}
                  onCheckedChange={(checked) => {
                    setNotificationSoundEnabled(checked);
                    saveNotificationSoundEnabled(checked);
                    if (checked) {
                      playNotificationSound();
                      toast.success("تم تفعيل صوت التنبيه");
                    } else {
                      toast.success("تم تعطيل صوت التنبيه");
                    }
                  }}
                />
              </div>
            )}
            
            {/* Test Notification Button */}
            {notificationsEnabled && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={async () => {
                  const sent = await showNotification('إشعار تجريبي 🔔', {
                    body: 'الإشعارات تعمل بشكل صحيح!',
                    tag: 'test-notification',
                  });
                  if (sent) {
                    toast.success("تم إرسال الإشعار التجريبي");
                  } else {
                    toast.error("فشل إرسال الإشعار");
                  }
                }}
              >
                <BellRing className="w-4 h-4 ml-2" />
                إرسال إشعار تجريبي
              </Button>
            )}
          </div>
        </div>

        {/* Calculation Settings */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">إعدادات الحساب</h2>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">حساب الساعات الإضافية</p>
              <p className="text-xs text-muted-foreground mt-1">
                عند التفعيل، تُضاف ساعات البقاء بعد وقت الانصراف لرصيد الاستئذان
              </p>
            </div>
            <Switch
              checked={overtimeEnabled}
              onCheckedChange={(checked) => {
                setOvertimeEnabled(checked);
                localStorage.setItem("overtimeEnabled", checked.toString());
                toast.success(checked ? "تم تفعيل حساب الساعات الإضافية" : "تم تعطيل حساب الساعات الإضافية");
              }}
            />
          </div>
        </div>

        {/* Import Instructions */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-primary mb-2">تنسيق ملف الاستيراد (CSV)</h3>
          <p className="text-xs text-muted-foreground">
            التاريخ,وقت_الدخول,وقت_الخروج<br />
            2024-01-15,08:30,16:30<br />
            2024-01-16,07:45,15:45
          </p>
        </div>

        {/* Edit Form */}
        {editingRecord && (
          <div className="bg-card rounded-3xl shadow-card p-6 animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">تعديل السجل</h2>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">التاريخ</label>
                <input
                  type="text"
                  value={editingRecord.date}
                  disabled
                  className="w-full p-3 bg-muted/50 rounded-xl border border-border text-muted-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">وقت الدخول</label>
                <input
                  type="time"
                  value={editTimes.entryTime24}
                  onChange={(e) =>
                    setEditTimes((prev) => ({ ...prev, entryTime24: e.target.value }))
                  }
                  className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">وقت الخروج المتوقع</label>
                <input
                  type="text"
                  value={
                    isValidTime24(editTimes.entryTime24)
                      ? formatTimeToArabic(calculateExpectedExit(editTimes.entryTime24))
                      : ""
                  }
                  disabled
                  className="w-full p-3 bg-muted/50 rounded-xl border border-border text-muted-foreground"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">وقت الخروج</label>
                <input
                  type="time"
                  value={editTimes.actualExitTime24}
                  onChange={(e) =>
                    setEditTimes((prev) => ({
                      ...prev,
                      actualExitTime24: e.target.value,
                    }))
                  }
                  className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <button
                onClick={handleUpdateRecord}
                className="w-full flex items-center justify-center gap-2 p-3 gradient-primary text-primary-foreground rounded-xl font-semibold"
              >
                <Save className="w-5 h-5" />
                حفظ التعديلات
              </button>
            </div>
          </div>
        )}

        {/* Records List */}
        <div className="bg-card rounded-3xl shadow-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">السجلات ({records.length})</h2>
            {records.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-1 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                    حذف الكل
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm">
                  <AlertDialogHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                      <AlertDialogTitle>تأكيد حذف جميع السجلات</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>
                      هل أنت متأكد من حذف جميع السجلات ({records.length} سجل)؟ لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllRecords}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      حذف الكل
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          
          {records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد سجلات</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {records.map((record) => (
                <div
                  key={record.date}
                  className="p-4 bg-muted/30 rounded-2xl border border-border/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      {new Date(record.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingRecord(record)}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecord(record.date)}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block text-foreground/60">الدخول</span>
                      <span className="font-medium text-foreground">{record.entryTime}</span>
                    </div>
                    <div>
                      <span className="block text-foreground/60">المتوقع</span>
                      <span className="font-medium text-foreground">{record.expectedExitTime}</span>
                    </div>
                    <div>
                      <span className="block text-foreground/60">الفعلي</span>
                      <span className="font-medium text-foreground">{record.actualExitTime || "---"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* App Info */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">معلومات التطبيق</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">اسم التطبيق</span>
              <span className="text-sm font-semibold text-foreground">{APP_NAME} – نظام الدوام المرن</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">رقم الإصدار</span>
              <span className="text-sm font-mono font-semibold text-primary">{APP_VERSION}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">معرف البناء</span>
              <span className="text-sm font-mono font-medium text-muted-foreground">{APP_BUILD_ID}</span>
            </div>
            <button
              onClick={async () => {
                try {
                  toast.info("جاري تحديث التطبيق...");

                  // إلغاء تسجيل جميع Service Workers
                  if ("serviceWorker" in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                      await registration.unregister();
                    }
                  }

                  // مسح caches فقط (localStorage لن يتأثر)
                  if ("caches" in window) {
                    const cacheNames = await caches.keys();
                    for (const cacheName of cacheNames) {
                      await caches.delete(cacheName);
                    }
                  }

                  toast.success("تم مسح الملفات المؤقتة، جاري إعادة التحميل...");

                  // إعادة تحميل مع كسر كاش المتصفح (بدون لمس السجلات)
                  setTimeout(() => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("v", Date.now().toString());
                    window.location.replace(url.toString());
                  }, 800);
                } catch (error) {
                  toast.error("حدث خطأ أثناء التحديث");
                  console.error("Update error:", error);
                }
              }}
              className="w-full flex items-center justify-center gap-2 p-3 mt-2 bg-primary/10 text-primary rounded-xl font-medium hover:bg-primary/20 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث التطبيق الآن
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-4 space-y-1">
          <p className="text-xs text-muted-foreground">
            نظام بصمتي للدوام المرن © 2026
          </p>
          <p className="text-xs text-muted-foreground/70">
            تصميم: علي حريصي
          </p>
        </footer>
      </main>
    </div>
  );
};

export default Settings;
