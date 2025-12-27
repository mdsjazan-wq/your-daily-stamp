import { useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from "recharts";

interface AttendanceRecord {
  date: string;
  entryTime: string;
  expectedExitTime: string;
  actualExitTime: string | null;
  status: "منتظم" | "متأخر";
  exitStatus: "خروج نظامي" | "خروج مبكر" | null;
}

interface ChartData {
  regularCount: number;
  lateCount: number;
  earlyExitCount: number;
  lateAndEarlyCount: number;
  totalOvertimeMinutes: number;
  totalLateMinutes: number;
  totalEarlyExitMinutes: number;
}

interface AttendanceChartsProps {
  records: AttendanceRecord[];
  selectedMonth: string;
  chartData: ChartData;
}

const MONTHLY_PERMISSION_HOURS = 11;
const FLEXIBLE_START = 7 * 60;
const FLEXIBLE_END = 9 * 60;
const WORK_HOURS = 8;

const parseTimeToMinutes = (timeStr: string): number => {
  const [time, period] = timeStr.split(" ");
  const [hours, minutes] = time.split(":").map(Number);
  let h = hours;
  if (period === "م" && hours !== 12) h += 12;
  if (period === "ص" && hours === 12) h = 0;
  return h * 60 + minutes;
};

const COLORS = {
  regular: "hsl(var(--success))",
  late: "hsl(var(--warning))",
  earlyExit: "hsl(var(--destructive))",
  lateAndEarly: "hsl(280, 70%, 50%)",
  overtime: "hsl(var(--success))",
};

const AttendanceCharts = ({ records, selectedMonth, chartData }: AttendanceChartsProps) => {
  // بيانات المخطط الدائري
  const pieData = useMemo(() => {
    const data = [];
    if (chartData.regularCount > 0) {
      data.push({ name: "منتظم", value: chartData.regularCount, color: COLORS.regular });
    }
    if (chartData.lateCount > 0) {
      data.push({ name: "تأخير فقط", value: chartData.lateCount, color: COLORS.late });
    }
    if (chartData.earlyExitCount > 0) {
      data.push({ name: "خروج مبكر فقط", value: chartData.earlyExitCount, color: COLORS.earlyExit });
    }
    if (chartData.lateAndEarlyCount > 0) {
      data.push({ name: "تأخير + خروج مبكر", value: chartData.lateAndEarlyCount, color: COLORS.lateAndEarly });
    }
    return data;
  }, [chartData]);

  // بيانات مخطط الأعمدة
  const barData = useMemo(() => [
    { 
      name: "ساعات إضافية", 
      value: Math.round(chartData.totalOvertimeMinutes / 60 * 10) / 10,
      fill: COLORS.overtime
    },
    { 
      name: "تأخير", 
      value: Math.round(chartData.totalLateMinutes / 60 * 10) / 10,
      fill: COLORS.late
    },
    { 
      name: "خروج مبكر", 
      value: Math.round(chartData.totalEarlyExitMinutes / 60 * 10) / 10,
      fill: COLORS.earlyExit
    },
  ], [chartData]);

  // بيانات تطور الرصيد اليومي
  const balanceEvolutionData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthRecords = records
      .filter((r) => {
        const recordDate = new Date(r.date);
        return recordDate.getFullYear() === year && recordDate.getMonth() + 1 === month;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = MONTHLY_PERMISSION_HOURS * 60;
    const data: { date: string; balance: number; day: number }[] = [];

    monthRecords.forEach((record, index) => {
      const entryMinutes = parseTimeToMinutes(record.entryTime);
      const isLate = record.status === "متأخر";
      const isEarlyExit = record.exitStatus === "خروج مبكر";

      // حساب الخصومات
      if (isLate) {
        const lateMinutes = entryMinutes - FLEXIBLE_END;
        runningBalance -= Math.max(0, lateMinutes);
      }

      if (record.actualExitTime) {
        const exitMinutes = parseTimeToMinutes(record.actualExitTime);
        const expectedExitMinutes = parseTimeToMinutes(record.expectedExitTime);

        if (isEarlyExit) {
          const earlyMinutes = expectedExitMinutes - exitMinutes;
          runningBalance -= Math.max(0, earlyMinutes);
        }

        // حساب الساعات الإضافية
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
          runningBalance += overtimeFromExit;
        }
      }

      const recordDate = new Date(record.date);
      data.push({
        date: record.date,
        day: recordDate.getDate(),
        balance: Math.round(runningBalance / 60 * 10) / 10,
      });
    });

    return data;
  }, [records, selectedMonth]);

  const totalDays = pieData.reduce((acc, d) => acc + d.value, 0);

  if (totalDays === 0) {
    return (
      <div className="bg-card rounded-3xl shadow-card p-6 text-center">
        <p className="text-muted-foreground">لا توجد بيانات كافية لعرض الرسوم البيانية</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* مخطط دائري - توزيع الأيام */}
      <div className="bg-card rounded-3xl shadow-card p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 text-center">توزيع أيام الحضور</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} يوم`, ""]}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  direction: "rtl"
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          {pieData.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* مخطط أعمدة - المقارنة */}
      <div className="bg-card rounded-3xl shadow-card p-6">
        <h3 className="text-lg font-bold text-foreground mb-4 text-center">مقارنة الساعات</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip 
                formatter={(value: number) => [`${value} ساعة`, ""]}
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  direction: "rtl"
                }}
              />
              <Bar 
                dataKey="value" 
                radius={[0, 8, 8, 0]}
                fill="hsl(var(--primary))"
              >
                {barData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* مخطط تطور الرصيد */}
      {balanceEvolutionData.length > 1 && (
        <div className="bg-card rounded-3xl shadow-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 text-center">تطور رصيد الاستئذان</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceEvolutionData}>
                <defs>
                  <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  label={{ value: "اليوم", position: "bottom", offset: -5, fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: "ساعة", angle: -90, position: "insideLeft", fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} ساعة`, "الرصيد"]}
                  labelFormatter={(label) => `يوم ${label}`}
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    direction: "rtl"
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#balanceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            الخط يوضح تغير الرصيد المتبقي مع كل يوم عمل
          </p>
        </div>
      )}
    </div>
  );
};

export default AttendanceCharts;
