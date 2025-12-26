import { useState, useEffect, useMemo } from "react";
import { ArrowRight, Clock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

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

const parseTimeToMinutes = (timeStr: string): number => {
  const [time, period] = timeStr.split(" ");
  const [hours, minutes] = time.split(":").map(Number);
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

  useEffect(() => {
    const saved = localStorage.getItem("attendanceRecords");
    if (saved) {
      setRecords(JSON.parse(saved));
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

    monthRecords.forEach((record) => {
      const entryMinutes = parseTimeToMinutes(record.entryTime);
      
      // حساب التأخير (الدخول بعد 9:00 ص)
      if (record.status === "متأخر") {
        const lateMinutes = entryMinutes - FLEXIBLE_END;
        totalLateMinutes += Math.max(0, lateMinutes);
        lateCount++;
      }

      // حساب الساعات الإضافية (الدخول قبل 7:00 ص)
      if (entryMinutes < FLEXIBLE_START) {
        const overtimeFromEntry = FLEXIBLE_START - entryMinutes;
        totalOvertimeMinutes += overtimeFromEntry;
      }

      if (record.actualExitTime) {
        const exitMinutes = parseTimeToMinutes(record.actualExitTime);
        const expectedExitMinutes = parseTimeToMinutes(record.expectedExitTime);

        // حساب الخروج المبكر
        if (record.exitStatus === "خروج مبكر") {
          const earlyMinutes = expectedExitMinutes - exitMinutes;
          totalEarlyExitMinutes += Math.max(0, earlyMinutes);
          earlyExitCount++;
        } else {
          regularCount++;
        }

        // حساب الساعات الإضافية من البقاء بعد وقت الانصراف
        // لكن فقط إذا كان الدخول من 7:00 ص وضمن الدوام المرن
        if (entryMinutes >= FLEXIBLE_START && entryMinutes <= FLEXIBLE_END) {
          // وقت الانصراف المتوقع بناءً على 8 ساعات عمل
          const standardExpectedExit = entryMinutes + (WORK_HOURS * 60);
          
          // إذا بقي بعد الوقت المتوقع
          if (exitMinutes > standardExpectedExit) {
            const overtimeFromExit = exitMinutes - standardExpectedExit;
            totalOvertimeMinutes += overtimeFromExit;
          }
        }
      }
    });

    // حساب الرصيد
    const totalDeductedMinutes = totalLateMinutes + totalEarlyExitMinutes;
    const permissionHoursInMinutes = MONTHLY_PERMISSION_HOURS * 60;
    const remainingMinutes = permissionHoursInMinutes - totalDeductedMinutes + totalOvertimeMinutes;

    return {
      totalRecords: monthRecords.length,
      lateCount,
      earlyExitCount,
      regularCount,
      totalLateMinutes,
      totalEarlyExitMinutes,
      totalOvertimeMinutes,
      totalDeductedMinutes,
      remainingMinutes,
    };
  }, [records, selectedMonth]);

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
      const label = date.toLocaleDateString("ar-SA", { year: "numeric", month: "long" });
      options.push({ value, label });
    }
    return options;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-primary text-primary-foreground py-4 px-4 shadow-lg">
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
              <span className="text-muted-foreground">أيام التأخير</span>
              <span className="font-semibold text-warning">{monthlyStats.lateCount} يوم</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
              <span className="text-muted-foreground">أيام الخروج المبكر</span>
              <span className="font-semibold text-destructive">{monthlyStats.earlyExitCount} يوم</span>
            </div>
          </div>
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
      </main>
    </div>
  );
};

export default Statistics;
