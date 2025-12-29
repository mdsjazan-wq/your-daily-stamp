import { useState, useEffect, useMemo } from "react";
import { ArrowRight, Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, BarChart2 } from "lucide-react";
import { Link } from "react-router-dom";
import AttendanceCharts from "@/components/AttendanceCharts";

interface AttendanceRecord {
  date: string;
  entryTime: string;
  expectedExitTime: string;
  actualExitTime: string | null;
  status: "منتظم" | "متأخر";
  exitStatus: "خروج نظامي" | "خروج مبكر" | null;
}

const MONTHLY_PERMISSION_HOURS = 11; // 11 ساعات استئذان شهرياً
const FLEXIBLE_START = 7 * 60; // 7:00 AM
const FLEXIBLE_END = 9 * 60; // 9:00 AM
const WORK_HOURS = 8; // 8 ساعات عمل

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
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const time = normalizeArabicNumerals(parts[0]);
  const period = parts[1];
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
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

const Statistics = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  });
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
  }, []);

  const monthlyStats = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthRecords = records.filter((r) => {
      const recordDate = new Date(r.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month;
    });

    let totalLateMinutes = 0; // دقائق التأخير
    let totalEarlyExitMinutes = 0; // دقائق الخروج المبكر
    let totalOvertimeMinutes = 0; // دقائق الساعات الإضافية
    let lateCount = 0;
    let earlyExitCount = 0;
    let regularCount = 0;
    let lateAndEarlyCount = 0; // أيام فيها تأخير وخروج مبكر معاً

    monthRecords.forEach((record) => {
      const entryMinutes = parseTimeToMinutes(record.entryTime);
      const isLate = record.status === "متأخر";
      const isEarlyExit = record.exitStatus === "خروج مبكر";
      
      // حساب دقائق التأخير (الدخول بعد 9:00 ص)
      if (isLate) {
        const lateMinutes = entryMinutes - FLEXIBLE_END;
        totalLateMinutes += Math.max(0, lateMinutes);
      }

      if (record.actualExitTime) {
        const exitMinutes = parseTimeToMinutes(record.actualExitTime);
        const expectedExitMinutes = parseTimeToMinutes(record.expectedExitTime);

        // حساب دقائق الخروج المبكر
        if (isEarlyExit) {
          const earlyMinutes = expectedExitMinutes - exitMinutes;
          totalEarlyExitMinutes += Math.max(0, earlyMinutes);
        }
      }

      // عد الأيام - كل يوم في فئة واحدة فقط
      if (isLate && isEarlyExit) {
        lateAndEarlyCount++; // تأخير + خروج مبكر
      } else if (isLate) {
        lateCount++; // تأخير فقط
      } else if (isEarlyExit) {
        earlyExitCount++; // خروج مبكر فقط
      } else {
        regularCount++; // يوم منتظم
      }

      if (record.actualExitTime) {
        const exitMinutes = parseTimeToMinutes(record.actualExitTime);

        // حساب الساعات الإضافية من البقاء بعد وقت الانصراف المتوقع
        // وقت الخروج المتوقع: إذا حضر 7 أو قبلها = 15:00، غير ذلك = وقت الدخول + 8 ساعات
        let standardExpectedExit: number;
        if (entryMinutes <= FLEXIBLE_START) {
          standardExpectedExit = 15 * 60; // 3:00 PM
        } else {
          standardExpectedExit = entryMinutes + (WORK_HOURS * 60);
        }
        
        // الحد الأقصى لحساب الساعات الإضافية هو 5:00 م
        const maxOvertimeLimit = 17 * 60; // 5:00 PM
        const cappedExitMinutes = Math.min(exitMinutes, maxOvertimeLimit);
        
        // إذا بقي بعد الوقت المتوقع (حتى 5 عصراً كحد أقصى)
        if (cappedExitMinutes > standardExpectedExit) {
          const overtimeFromExit = cappedExitMinutes - standardExpectedExit;
          totalOvertimeMinutes += overtimeFromExit;
        }
      }
    });

    // حساب الرصيد - مع مراعاة إعداد الساعات الإضافية
    const effectiveOvertimeMinutes = overtimeEnabled ? totalOvertimeMinutes : 0;
    const totalDeductedMinutes = totalLateMinutes + totalEarlyExitMinutes;
    const permissionHoursInMinutes = MONTHLY_PERMISSION_HOURS * 60;
    const remainingMinutes = permissionHoursInMinutes - totalDeductedMinutes + effectiveOvertimeMinutes;

    return {
      totalRecords: monthRecords.length,
      lateCount,
      earlyExitCount,
      regularCount,
      lateAndEarlyCount,
      totalLateMinutes,
      totalEarlyExitMinutes,
      totalOvertimeMinutes: effectiveOvertimeMinutes,
      totalDeductedMinutes,
      remainingMinutes,
    };
  }, [records, selectedMonth, overtimeEnabled]);

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    // إضافة 12 شهر مستقبلي (مثل 2026)
    for (let i = 12; i >= 1; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-GB", { year: "numeric", month: "long" });
      options.push({ value, label });
    }
    
    // إضافة الشهر الحالي و 12 شهر ماضي
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const label = date.toLocaleDateString("en-GB", { year: "numeric", month: "long" });
      options.push({ value, label });
    }
    
    return options;
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
          <h1 className="text-xl font-bold">الإحصائيات</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Month Selector */}
        <div className="bg-card rounded-2xl shadow-card p-4">
          <label className="block text-sm font-medium text-foreground mb-2">اختر الشهر</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
          >
            {getMonthOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Main Balance Card */}
        <div className={`rounded-3xl shadow-card p-6 ${
          monthlyStats.remainingMinutes >= 0 
            ? "bg-success/10 border-2 border-success/30" 
            : "bg-destructive/10 border-2 border-destructive/30"
        }`}>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {monthlyStats.remainingMinutes >= 0 ? (
                <CheckCircle className="w-6 h-6 text-success" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-destructive" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                رصيد الاستئذان المتبقي
              </span>
            </div>
            <div className={`text-4xl font-bold ${
              monthlyStats.remainingMinutes >= 0 ? "text-success" : "text-destructive"
            }`}>
              {monthlyStats.remainingMinutes < 0 ? "-" : ""}
              {formatMinutesToHours(monthlyStats.remainingMinutes)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">ساعة : دقيقة</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Permission Hours */}
          <div className="bg-card rounded-2xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">الرصيد الأساسي</span>
            </div>
            <div className="text-2xl font-bold text-foreground">
              {MONTHLY_PERMISSION_HOURS}:00
            </div>
            <p className="text-xs text-muted-foreground">ساعة/شهر</p>
          </div>

          {/* Overtime */}
          <div className="bg-card rounded-2xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <span className="text-xs text-muted-foreground">ساعات إضافية</span>
            </div>
            <div className="text-2xl font-bold text-success">
              +{formatMinutesToHours(monthlyStats.totalOvertimeMinutes)}
            </div>
            <p className="text-xs text-muted-foreground">ساعة</p>
          </div>

          {/* Late Minutes */}
          <div className="bg-card rounded-2xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-warning" />
              <span className="text-xs text-muted-foreground">تأخير</span>
            </div>
            <div className="text-2xl font-bold text-warning">
              -{formatMinutesToHours(monthlyStats.totalLateMinutes)}
            </div>
            <p className="text-xs text-muted-foreground">{monthlyStats.lateCount} مرة</p>
          </div>

          {/* Early Exit */}
          <div className="bg-card rounded-2xl shadow-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-destructive" />
              <span className="text-xs text-muted-foreground">خروج مبكر</span>
            </div>
            <div className="text-2xl font-bold text-destructive">
              -{formatMinutesToHours(monthlyStats.totalEarlyExitMinutes)}
            </div>
            <p className="text-xs text-muted-foreground">{monthlyStats.earlyExitCount} مرة</p>
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-card rounded-3xl shadow-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">ملخص الشهر</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
              <span className="text-muted-foreground">إجمالي أيام العمل</span>
              <span className="font-semibold text-foreground">{monthlyStats.totalRecords} يوم</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
              <span className="text-muted-foreground">أيام منتظمة</span>
              <span className="font-semibold text-success">{monthlyStats.regularCount} يوم</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
              <span className="text-muted-foreground">أيام التأخير فقط</span>
              <span className="font-semibold text-warning">{monthlyStats.lateCount} يوم</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
              <span className="text-muted-foreground">أيام الخروج المبكر فقط</span>
              <span className="font-semibold text-destructive">{monthlyStats.earlyExitCount} يوم</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
              <span className="text-muted-foreground">أيام تأخير + خروج مبكر</span>
              <span className="font-semibold text-orange-500">{monthlyStats.lateAndEarlyCount} يوم</span>
            </div>
          </div>
        </div>

        {/* Interactive Charts */}
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" />
            التحليل البياني
          </h2>
          <AttendanceCharts 
            records={records}
            selectedMonth={selectedMonth}
            chartData={{
              regularCount: monthlyStats.regularCount,
              lateCount: monthlyStats.lateCount,
              earlyExitCount: monthlyStats.earlyExitCount,
              lateAndEarlyCount: monthlyStats.lateAndEarlyCount,
              totalOvertimeMinutes: monthlyStats.totalOvertimeMinutes,
              totalLateMinutes: monthlyStats.totalLateMinutes,
              totalEarlyExitMinutes: monthlyStats.totalEarlyExitMinutes,
            }}
          />
        </div>

        {/* Rules Info */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-primary mb-2">قواعد احتساب الرصيد</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• رصيد الاستئذان الشهري: {MONTHLY_PERMISSION_HOURS} ساعة</li>
            <li>• يُخصم من الرصيد: التأخير + الخروج المبكر</li>
            <li>• يُضاف للرصيد: الساعات الإضافية ضمن الدوام المرن</li>
            <li>• الدوام المرن: من 7:00 ص إلى 9:00 ص</li>
            <li>• مثال: الحضور 7:00 ص والانصراف 4:00 م = ساعة إضافية</li>
          </ul>
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

export default Statistics;
