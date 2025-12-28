import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, X, Clock } from "lucide-react";

interface AttendanceRecord {
  date: string;
  entryTime: string;
  expectedExitTime: string;
  actualExitTime: string | null;
  status: "منتظم" | "متأخر";
  exitStatus: "خروج نظامي" | "خروج مبكر" | null;
}

const MONTHLY_PERMISSION_HOURS = 11;
const FLEXIBLE_START = 7 * 60;
const FLEXIBLE_END = 9 * 60;
const WORK_HOURS = 8;
const WARNING_THRESHOLD_MINUTES = 120; // ساعتان

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

const formatMinutesToHours = (minutes: number): string => {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
};

const BalanceWarningBanner = () => {
  const [dismissed, setDismissed] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [overtimeEnabled, setOvertimeEnabled] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("attendanceRecords");
    if (saved) {
      setRecords(JSON.parse(saved));
    }

    const overtimeSaved = localStorage.getItem("overtimeEnabled");
    if (overtimeSaved !== null) {
      setOvertimeEnabled(overtimeSaved === "true");
    }

    // التحقق من إغلاق البانر اليوم
    const todayKey = new Date().toISOString().split("T")[0];
    const dismissedKey = localStorage.getItem("balanceWarningDismissed");
    if (dismissedKey === todayKey) {
      setDismissed(true);
    }
  }, []);

  const remainingMinutes = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const monthRecords = records.filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month;
    });

    let totalLateMinutes = 0;
    let totalEarlyExitMinutes = 0;
    let totalOvertimeMinutes = 0;

    monthRecords.forEach((record) => {
      const entryMinutes = parseTimeToMinutes(record.entryTime);
      const isLate = record.status === "متأخر";
      const isEarlyExit = record.exitStatus === "خروج مبكر";

      if (isLate) {
        const lateMinutes = entryMinutes - FLEXIBLE_END;
        totalLateMinutes += Math.max(0, lateMinutes);
      }

      if (record.actualExitTime) {
        const exitMinutes = parseTimeToMinutes(record.actualExitTime);
        const expectedExitMinutes = parseTimeToMinutes(record.expectedExitTime);

        if (isEarlyExit) {
          const earlyMinutes = expectedExitMinutes - exitMinutes;
          totalEarlyExitMinutes += Math.max(0, earlyMinutes);
        }

        let standardExpectedExit: number;
        if (entryMinutes <= FLEXIBLE_START) {
          standardExpectedExit = 15 * 60;
        } else {
          standardExpectedExit = entryMinutes + (WORK_HOURS * 60);
        }

        const maxOvertimeLimit = 17 * 60;
        const cappedExitMinutes = Math.min(exitMinutes, maxOvertimeLimit);

        if (cappedExitMinutes > standardExpectedExit) {
          const overtimeFromExit = cappedExitMinutes - standardExpectedExit;
          totalOvertimeMinutes += overtimeFromExit;
        }
      }
    });

    // مراعاة إعداد الساعات الإضافية
    const effectiveOvertimeMinutes = overtimeEnabled ? totalOvertimeMinutes : 0;
    const totalDeductedMinutes = totalLateMinutes + totalEarlyExitMinutes;
    const permissionHoursInMinutes = MONTHLY_PERMISSION_HOURS * 60;
    return permissionHoursInMinutes - totalDeductedMinutes + effectiveOvertimeMinutes;
  }, [records, overtimeEnabled]);

  const handleDismiss = () => {
    setDismissed(true);
    const todayKey = new Date().toISOString().split("T")[0];
    localStorage.setItem("balanceWarningDismissed", todayKey);
  };

  // لا تعرض البانر إذا كان الرصيد كافي أو تم إغلاقه
  if (dismissed || remainingMinutes > WARNING_THRESHOLD_MINUTES) {
    return null;
  }

  const isNegative = remainingMinutes < 0;
  const isLow = remainingMinutes <= WARNING_THRESHOLD_MINUTES && remainingMinutes >= 0;

  return (
    <div 
      className={`px-4 py-3 animate-slide-up ${
        isNegative 
          ? "bg-destructive/10 border-b border-destructive/20" 
          : "bg-warning/10 border-b border-warning/20"
      }`}
    >
      <div className="max-w-md mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isNegative ? "bg-destructive/20" : "bg-warning/20"
          }`}>
            {isNegative ? (
              <AlertTriangle className={`w-5 h-5 text-destructive`} />
            ) : (
              <Clock className={`w-5 h-5 text-warning`} />
            )}
          </div>
          <div>
            <p className={`text-sm font-semibold ${
              isNegative ? "text-destructive" : "text-warning"
            }`}>
              {isNegative ? "نفد رصيد الاستئذان!" : "رصيد ساعات الاستئذان منخفض"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isNegative 
                ? `تجاوزت الرصيد بـ ${formatMinutesToHours(Math.abs(remainingMinutes))} ساعة`
                : `متبقي ${formatMinutesToHours(remainingMinutes)} ساعة فقط`
              }
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default BalanceWarningBanner;
