import { useState, useEffect, useCallback } from "react";
import { Clock, LogIn, LogOut, Calendar, AlertCircle, CheckCircle2, Timer, History, Download, X, Settings, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import BalanceWarningBanner from "@/components/BalanceWarningBanner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { showNotification, getNotificationSettings } from "@/lib/notifications";

// Types
interface AttendanceRecord {
  date: string;
  entryTime: string;
  expectedExitTime: string;
  actualExitTime: string | null;
  status: "منتظم" | "متأخر";
  exitStatus: "خروج نظامي" | "خروج مبكر" | null;
}

interface TodayData {
  entryTime: string | null;
  expectedExitTime: string | null;
  status: "منتظم" | "متأخر" | null;
}

// Helper functions
const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getDateKey = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const normalizeArabicNumerals = (input: string): string => {
  // تحويل الأرقام العربية/الهندية إلى أرقام إنجليزية لتسهيل التحويل إلى Number
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

const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.trim().split(/\s+/);
  if (parts.length < 2) return NaN;

  const time = normalizeArabicNumerals(parts[0]);
  const period = parts[1];
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;

  let h = hours;
  if (period === "م" && hours !== 12) h += 12;
  if (period === "ص" && hours === 12) h = 0;
  return h * 60 + minutes;
};

const addHoursToTime = (timeStr: string, hoursToAdd: number): string => {
  const result = new Date();
  const MAX_EXIT_HOUR = 17; // 5:00 PM max

  const parts = timeStr.trim().split(/\s+/);
  if (parts.length < 2) {
    result.setHours(result.getHours() + hoursToAdd);
    // Cap at 5 PM
    if (result.getHours() > MAX_EXIT_HOUR || (result.getHours() === MAX_EXIT_HOUR && result.getMinutes() > 0)) {
      result.setHours(MAX_EXIT_HOUR, 0, 0, 0);
    }
    return formatTime(result);
  }

  const time = normalizeArabicNumerals(parts[0]);
  const period = parts[1];
  const [h, m] = time.split(":").map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) {
    result.setHours(result.getHours() + hoursToAdd);
    // Cap at 5 PM
    if (result.getHours() > MAX_EXIT_HOUR || (result.getHours() === MAX_EXIT_HOUR && result.getMinutes() > 0)) {
      result.setHours(MAX_EXIT_HOUR, 0, 0, 0);
    }
    return formatTime(result);
  }

  let hour = h;
  if (period === "م" && h !== 12) hour += 12;
  if (period === "ص" && h === 12) hour = 0;

  result.setHours(hour + hoursToAdd, m, 0, 0);
  
  // Cap at 5 PM - الحد الأقصى للدوام
  if (result.getHours() > MAX_EXIT_HOUR || (result.getHours() === MAX_EXIT_HOUR && result.getMinutes() > 0)) {
    result.setHours(MAX_EXIT_HOUR, 0, 0, 0);
  }
  
  return formatTime(result);
};

const Index = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayData, setTodayData] = useState<TodayData>({
    entryTime: null,
    expectedExitTime: null,
    status: null,
  });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [reminderShown, setReminderShown] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [exitConfirmShown, setExitConfirmShown] = useState(false);
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);

  // Beacon auto check-in listener
  useEffect(() => {
    const handleBeaconCheckIn = () => {
      // Use existing check-in logic
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // Skip weekends
      if (dayOfWeek === 5 || dayOfWeek === 6) return;
      
      // Skip if already checked in
      const todayKey = getDateKey(now);
      const savedToday = localStorage.getItem(`today_${todayKey}`);
      if (savedToday) {
        const parsed = JSON.parse(savedToday);
        if (parsed.entryTime) return;
      }
      
      // Perform check-in
      handleCheckIn();
    };
    
    const handleBeaconCheckOut = () => {
      // Use existing check-out logic
      const now = new Date();
      const dayOfWeek = now.getDay();
      
      // Skip weekends
      if (dayOfWeek === 5 || dayOfWeek === 6) return;
      
      // Skip if not checked in or already checked out
      if (!todayData.entryTime) return;
      
      const todayKey = getDateKey(now);
      const existingRecord = records.find((r) => r.date === todayKey);
      if (existingRecord?.actualExitTime) return;
      
      // Perform check-out
      handleCheckOut();
    };
    
    window.addEventListener('beaconAutoCheckIn', handleBeaconCheckIn);
    window.addEventListener('beaconAutoCheckOut', handleBeaconCheckOut);
    
    return () => {
      window.removeEventListener('beaconAutoCheckIn', handleBeaconCheckIn);
      window.removeEventListener('beaconAutoCheckOut', handleBeaconCheckOut);
    };
  }, [todayData, records]);

  // Load data from localStorage
  useEffect(() => {
    const loadData = () => {
      const today = new Date();
      const todayKey = getDateKey(today);
      const dayOfWeek = today.getDay(); // 0 = الأحد, 5 = الجمعة, 6 = السبت

      const savedRecords = localStorage.getItem("attendanceRecords");
      let localRecords: AttendanceRecord[] = savedRecords ? JSON.parse(savedRecords) : [];

      // في أيام الإجازة الأسبوعية لا نعرض/نحفظ حالة اليوم
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        localStorage.removeItem(`today_${todayKey}`);
        localStorage.removeItem(`reminder_${todayKey}`);
        setReminderShown(false);
        setTodayData({
          entryTime: null,
          expectedExitTime: null,
          status: null,
        });
        setRecords(localRecords);
        return;
      }

      // تحميل/تصحيح بيانات اليوم
      const savedToday = localStorage.getItem(`today_${todayKey}`);
      let nextTodayData: TodayData = {
        entryTime: null,
        expectedExitTime: null,
        status: null,
      };

      if (savedToday) {
        const parsed: TodayData = JSON.parse(savedToday);

        // إصلاح بيانات قديمة كانت تُحفظ كـ "Invalid Date" بسبب اختلاف شكل الأرقام
        const expectedIsInvalid =
          !parsed.expectedExitTime || parsed.expectedExitTime === "Invalid Date";

        if (parsed.entryTime && expectedIsInvalid) {
          const expectedExitTime = addHoursToTime(parsed.entryTime, 8);
          nextTodayData = {
            entryTime: parsed.entryTime,
            expectedExitTime,
            status: parsed.status,
          };
          localStorage.setItem(`today_${todayKey}`, JSON.stringify(nextTodayData));
        } else {
          nextTodayData = parsed;
        }
      }

      // ضمان ظهور سجل اليوم حتى لو كانت البيانات قديمة قبل إضافة حفظ السجل عند تسجيل الدخول
      if (nextTodayData.entryTime && nextTodayData.expectedExitTime && nextTodayData.status) {
        const hasTodayRecord = localRecords.some((r) => r.date === todayKey);
        if (!hasTodayRecord) {
          localRecords = [
            {
              date: todayKey,
              entryTime: nextTodayData.entryTime,
              expectedExitTime: nextTodayData.expectedExitTime,
              actualExitTime: null,
              status: nextTodayData.status,
              exitStatus: null,
            },
            ...localRecords,
          ];
          localStorage.setItem("attendanceRecords", JSON.stringify(localRecords));
        }
      }

      setTodayData(nextTodayData);
      setRecords(localRecords);

      const reminderKey = `reminder_${todayKey}`;
      if (localStorage.getItem(reminderKey)) {
        setReminderShown(true);
      }

      const exitConfirmKey = `exitConfirm_${todayKey}`;
      if (localStorage.getItem(exitConfirmKey)) {
        setExitConfirmShown(true);
      }
    };

    loadData();

    // Check if app is already installed
    const checkStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(checkStandalone);

    // Show install banner if not dismissed and not installed
    const bannerDismissed = localStorage.getItem("installBannerDismissed");
    if (!bannerDismissed && !checkStandalone) {
      setShowInstallBanner(true);
    }

    // الاستماع للتغييرات في localStorage من صفحات أخرى
    const handleStorageChange = (e: StorageEvent) => {
      const todayKey = getDateKey(new Date());
      if (e.key === `today_${todayKey}` || e.key === "attendanceRecords") {
        loadData();
      }
    };

    // الاستماع للحدث المخصص عند حذف بيانات اليوم
    const handleTodayDataCleared = () => {
      loadData();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("todayDataCleared", handleTodayDataCleared);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("todayDataCleared", handleTodayDataCleared);
    };
  }, []);

  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem("installBannerDismissed", "true");
  };

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get reminder minutes from settings
  const getReminderMinutes = (): number => {
    const saved = localStorage.getItem("reminderMinutes");
    return saved ? parseInt(saved, 10) : 10;
  };

  // Check for exit reminder
  useEffect(() => {
    if (!todayData.expectedExitTime || reminderShown) return;

    const checkReminder = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const expectedMinutes = parseTimeToMinutes(todayData.expectedExitTime!);
      const diff = expectedMinutes - currentMinutes;
      const reminderMinutes = getReminderMinutes();

      if (diff <= reminderMinutes && diff > 0 && !reminderShown) {
        // Show in-app toast
        toast.info("تنبيه الانصراف", {
          description: `تبقى ${diff} دقائق على وقت الانصراف`,
          duration: 10000,
        });
        
        // Show push notification if enabled
        if (getNotificationSettings()) {
          showNotification('تنبيه الانصراف ⏰', {
            body: `تبقى ${diff} دقائق على وقت الانصراف`,
            tag: 'exit-reminder',
          });
        }
        
        setReminderShown(true);
        const todayKey = getDateKey(new Date());
        localStorage.setItem(`reminder_${todayKey}`, "true");
      }
    };

    const interval = setInterval(checkReminder, 30000);
    checkReminder();
    return () => clearInterval(interval);
  }, [todayData.expectedExitTime, reminderShown]);

  // Save today's data to localStorage
  const saveTodayData = useCallback((data: TodayData) => {
    const todayKey = getDateKey(new Date());
    localStorage.setItem(`today_${todayKey}`, JSON.stringify(data));
    setTodayData(data);
  }, []);

  // Save records to localStorage
  const saveRecords = useCallback((newRecords: AttendanceRecord[]) => {
    localStorage.setItem("attendanceRecords", JSON.stringify(newRecords));
    setRecords(newRecords);
  }, []);

  // Check for exit confirmation after configured minutes past expected exit time
  useEffect(() => {
    // Only check if user has checked in but not checked out
    if (!todayData.entryTime || !todayData.expectedExitTime || exitConfirmShown) return;

    // Check if user already checked out today
    const todayKey = getDateKey(new Date());
    const existingRecord = records.find((r) => r.date === todayKey);
    if (existingRecord?.actualExitTime) return;

    // Get configured exit reminder minutes (default 5)
    const exitReminderMinutes = parseInt(localStorage.getItem("exitReminderMinutes") || "5", 10);

    const checkExitConfirmation = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const expectedMinutes = parseTimeToMinutes(todayData.expectedExitTime!);
      const diff = currentMinutes - expectedMinutes;

      // If configured minutes have passed since expected exit time
      if (diff >= exitReminderMinutes && !exitConfirmShown) {
        // Show push notification if enabled
        if (getNotificationSettings()) {
          showNotification('هل قمت بتسجيل الخروج؟ 🚪', {
            body: `مضت ${exitReminderMinutes} دقائق على وقت الانصراف المتوقع`,
            tag: 'exit-confirm',
            requireInteraction: true,
          });
        }
        
        setShowExitConfirmDialog(true);
        setExitConfirmShown(true);
        localStorage.setItem(`exitConfirm_${todayKey}`, "true");
      }
    };

    const interval = setInterval(checkExitConfirmation, 30000);
    checkExitConfirmation();
    return () => clearInterval(interval);
  }, [todayData.entryTime, todayData.expectedExitTime, exitConfirmShown, records]);

  // Handle auto checkout with expected exit time
  const handleAutoCheckOut = useCallback(() => {
    const todayKey = getDateKey(new Date());
    
    const newRecord: AttendanceRecord = {
      date: todayKey,
      entryTime: todayData.entryTime!,
      expectedExitTime: todayData.expectedExitTime!,
      actualExitTime: todayData.expectedExitTime!, // Use expected exit time as actual
      status: todayData.status!,
      exitStatus: "خروج نظامي",
    };

    const updatedRecords = records.filter((r) => r.date !== todayKey);
    updatedRecords.unshift(newRecord);
    saveRecords(updatedRecords);

    toast.success("تم تسجيل الخروج تلقائياً", {
      description: `وقت الخروج: ${todayData.expectedExitTime}`,
    });

    setShowExitConfirmDialog(false);
  }, [todayData, records, saveRecords]);

  // Check-in handler
  const handleCheckIn = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = الأحد, 5 = الجمعة, 6 = السبت

    // التحقق من يوم الإجازة (الجمعة والسبت)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      toast.error("يوم إجازة", {
        description: "لا يمكن تسجيل الدخول في أيام الجمعة والسبت",
      });
      return;
    }

    if (todayData.entryTime) {
      toast.error("تم تسجيل الدخول مسبقاً", {
        description: "لا يمكن تسجيل الدخول أكثر من مرة في اليوم",
      });
      return;
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Check if within allowed time (7:00 AM - 9:00 AM)
    const minTime = 7 * 60; // 7:00 AM
    const maxTime = 9 * 60; // 9:00 AM

    let status: "منتظم" | "متأخر" = "منتظم";
    if (totalMinutes > maxTime) {
      status = "متأخر";
    }

    const entryTime = formatTime(now);
    
    // حساب وقت الخروج المتوقع مع مراعاة نهاية الدوام المرن (5 عصراً)
    let expectedExitTime: string;
    const maxExitMinutes = 17 * 60; // 5:00 PM - نهاية الدوام المرن
    
    if (totalMinutes <= minTime) {
      // إذا كان الحضور الساعة 7 صباحاً أو قبلها، يكون الخروج الساعة 3 عصراً
      const exitDate = new Date();
      exitDate.setHours(15, 0, 0, 0);
      expectedExitTime = formatTime(exitDate);
    } else {
      // حساب وقت الخروج بإضافة 8 ساعات
      const calculatedExitMinutes = totalMinutes + (8 * 60);
      
      // التأكد من عدم تجاوز الخامسة عصراً
      if (calculatedExitMinutes > maxExitMinutes) {
        const exitDate = new Date();
        exitDate.setHours(17, 0, 0, 0);
        expectedExitTime = formatTime(exitDate);
      } else {
        expectedExitTime = addHoursToTime(entryTime, 8);
      }
    }

    const newTodayData: TodayData = {
      entryTime,
      expectedExitTime,
      status,
    };

    saveTodayData(newTodayData);

    // حفظ السجل مباشرة عند تسجيل الدخول
    const todayKey = getDateKey(new Date());
    const existingRecordIndex = records.findIndex((r) => r.date === todayKey);
    
    const newRecord: AttendanceRecord = {
      date: todayKey,
      entryTime,
      expectedExitTime,
      actualExitTime: null,
      status,
      exitStatus: null,
    };

    let updatedRecords: AttendanceRecord[];
    if (existingRecordIndex >= 0) {
      updatedRecords = [...records];
      updatedRecords[existingRecordIndex] = newRecord;
    } else {
      updatedRecords = [newRecord, ...records];
    }
    saveRecords(updatedRecords);

    toast.success("تم تسجيل الدخول بنجاح", {
      description: `وقت الدخول: ${entryTime}`,
    });
  }, [todayData.entryTime, records, saveTodayData, saveRecords]);

  // Check-out handler
  const handleCheckOut = useCallback(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = الأحد, 5 = الجمعة, 6 = السبت

    // التحقق من يوم الإجازة (الجمعة والسبت)
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      toast.error("يوم إجازة", {
        description: "لا يمكن تسجيل الخروج في أيام الجمعة والسبت",
      });
      return;
    }

    // التحقق من بدء وقت الدوام (7:00 صباحاً)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    const workStartTime = 7 * 60; // 7:00 AM = 420 دقيقة

    if (currentMinutes < workStartTime) {
      toast.error("لم يبدأ الدوام بعد", {
        description: "لا يمكن تسجيل الخروج قبل الساعة 7:00 صباحاً",
      });
      return;
    }

    if (!todayData.entryTime) {
      toast.error("لم يتم تسجيل الدخول", {
        description: "يجب تسجيل الدخول أولاً",
      });
      return;
    }

    const todayKey = getDateKey(new Date());
    const existingRecord = records.find((r) => r.date === todayKey);
    if (existingRecord?.actualExitTime) {
      toast.error("تم تسجيل الخروج مسبقاً", {
        description: "لا يمكن تسجيل الخروج أكثر من مرة في اليوم",
      });
      return;
    }

    const actualExitTime = formatTime(now);
    const expectedMinutes = parseTimeToMinutes(todayData.expectedExitTime!);

    let exitStatus: "خروج نظامي" | "خروج مبكر" = "خروج نظامي";
    if (currentMinutes < expectedMinutes - 5) { // 5 minute grace period
      exitStatus = "خروج مبكر";
    }

    const newRecord: AttendanceRecord = {
      date: todayKey,
      entryTime: todayData.entryTime,
      expectedExitTime: todayData.expectedExitTime!,
      actualExitTime,
      status: todayData.status!,
      exitStatus,
    };

    const updatedRecords = records.filter((r) => r.date !== todayKey);
    updatedRecords.unshift(newRecord);
    saveRecords(updatedRecords);

    toast.success("تم تسجيل الخروج بنجاح", {
      description: exitStatus === "خروج نظامي" 
        ? "خروج نظامي - أحسنت!" 
        : "خروج مبكر - يرجى الالتزام بالدوام",
    });
  }, [todayData, records, saveRecords]);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "منتظم":
      case "خروج نظامي":
        return "text-success bg-success/10 border-success/20";
      case "متأخر":
        return "text-warning bg-warning/10 border-warning/20";
      case "خروج مبكر":
        return "text-destructive bg-destructive/10 border-destructive/20";
      default:
        return "text-muted-foreground bg-muted border-border";
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "منتظم":
      case "خروج نظامي":
        return <CheckCircle2 className="w-4 h-4" />;
      case "متأخر":
      case "خروج مبكر":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Balance Warning Banner */}
      <BalanceWarningBanner />

      {/* Install Banner */}
      {showInstallBanner && !isStandalone && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-3 animate-slide-up">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <Link 
              to="/install" 
              className="flex items-center gap-3 flex-1"
            >
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Download className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">ثبّت التطبيق</p>
                <p className="text-xs text-muted-foreground">للوصول السريع من الشاشة الرئيسية</p>
              </div>
            </Link>
            <button
              onClick={dismissInstallBanner}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="gradient-primary text-primary-foreground pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-6 px-4 shadow-lg">
        <div className="max-w-md mx-auto">
          {/* Top Icons */}
          <div className="flex justify-between items-center mb-3">
            <Link
              to="/statistics"
              className="p-2 hover:bg-primary-foreground/10 rounded-xl transition-colors"
              title="الإحصائيات"
            >
              <BarChart3 className="w-6 h-6" />
            </Link>
            <Link
              to="/settings"
              className="p-2 hover:bg-primary-foreground/10 rounded-xl transition-colors"
              title="الإعدادات"
            >
              <Settings className="w-6 h-6" />
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-center mb-1">بصمتي</h1>
          <p className="text-center text-primary-foreground/80 text-sm">نظام الدوام المرن</p>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Current Date & Time Card */}
        <div className="bg-card rounded-3xl shadow-card p-6 animate-fade-in">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
              <Calendar className="w-5 h-5" />
              <span className="text-sm font-medium">{formatDate(currentTime)}</span>
            </div>
            <div className="text-5xl font-bold text-foreground tracking-tight">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>

        {/* Today's Status Card */}
        <div className="bg-card rounded-3xl shadow-card p-6 animate-fade-in stagger-1">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            حالة اليوم
          </h2>

          <div className="space-y-4">
            {/* Entry Time */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-2xl">
              <span className="text-muted-foreground text-sm">وقت الدخول</span>
              <span className="font-semibold text-foreground">
                {todayData.entryTime || "---"}
              </span>
            </div>

            {/* Expected Exit Time */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-2xl">
              <span className="text-muted-foreground text-sm">وقت الانصراف المتوقع</span>
              <span className="font-semibold text-foreground">
                {todayData.expectedExitTime || "---"}
              </span>
            </div>

            {/* Status Badge */}
            {todayData.status && (
              <div className="flex items-center justify-center pt-2">
                <span className={`status-badge border ${getStatusColor(todayData.status)}`}>
                  {getStatusIcon(todayData.status)}
                  {todayData.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 animate-fade-in stagger-2">
          {/* Check-in Button */}
          <button
            onClick={handleCheckIn}
            disabled={!!todayData.entryTime}
            className={`btn-attendance flex flex-col items-center gap-2 ${
              todayData.entryTime
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "gradient-success text-success-foreground shadow-lg hover:shadow-xl"
            }`}
          >
            <LogIn className="w-8 h-8" />
            <span>تسجيل الدخول</span>
          </button>

          {/* Check-out Button */}
          <button
            onClick={handleCheckOut}
            disabled={!todayData.entryTime}
            className={`btn-attendance flex flex-col items-center gap-2 ${
              !todayData.entryTime
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "gradient-destructive text-destructive-foreground shadow-lg hover:shadow-xl"
            }`}
          >
            <LogOut className="w-8 h-8" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Attendance Rules Info */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 animate-fade-in stagger-3">
          <h3 className="text-sm font-semibold text-primary mb-2">قواعد الدوام</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• وقت الدخول المرن: من 07:00 ص إلى 09:00 ص</li>
            <li>• وقت الخروج المرن: من 03:00 م إلى 05:00 م</li>
            <li>• الدخول بعد 09:00 ص يُعتبر تأخير</li>
            <li>• الخروج قبل 03:00 م يُعتبر انصراف مبكر</li>
            <li>• مدة الدوام: 8 ساعات من وقت الدخول</li>
          </ul>
        </div>

        {/* History Toggle */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-center gap-2 py-3 text-primary font-semibold hover:bg-primary/5 rounded-2xl transition-colors"
        >
          <History className="w-5 h-5" />
          {showHistory ? "إخفاء السجل" : "عرض السجل اليومي"}
        </button>

        {/* History Section */}
        {showHistory && (
          <div className="bg-card rounded-3xl shadow-card p-4 animate-scale-in">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              السجل اليومي
            </h2>

            {records.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا توجد سجلات حتى الآن
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {records.slice(0, 10).map((record, index) => (
                  <div
                    key={record.date}
                    className="p-4 bg-muted/30 rounded-2xl border border-border/50 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">
                        {new Date(record.date).toLocaleDateString("en-GB", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                        {record.exitStatus && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(record.exitStatus)}`}>
                            {record.exitStatus}
                          </span>
                        )}
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
        )}

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

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitConfirmDialog} onOpenChange={setShowExitConfirmDialog}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">تأكيد الخروج</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              هل قمت بعمل بصمة الخروج؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:justify-center">
            <AlertDialogCancel className="flex-1 mt-0">لا</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleAutoCheckOut}
              className="flex-1 gradient-success text-success-foreground"
            >
              نعم
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
