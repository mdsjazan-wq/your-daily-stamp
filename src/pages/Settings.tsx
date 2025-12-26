import { useState, useRef } from "react";
import { ArrowRight, Edit3, Plus, Upload, Trash2, Save, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecord, setNewRecord] = useState({
    date: "",
    entryTime: "",
    actualExitTime: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveRecords = (newRecords: AttendanceRecord[]) => {
    localStorage.setItem("attendanceRecords", JSON.stringify(newRecords));
    setRecords(newRecords);
  };

  const formatTimeToArabic = (time24: string): string => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "م" : "ص";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  const calculateExpectedExit = (entryTime: string): string => {
    const [hours, minutes] = entryTime.split(":").map(Number);
    const exitHours = (hours + 8) % 24;
    return `${exitHours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const determineStatus = (entryTime: string): "منتظم" | "متأخر" => {
    const [hours, minutes] = entryTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes > 9 * 60 ? "متأخر" : "منتظم";
  };

  const determineExitStatus = (expectedExit: string, actualExit: string): "خروج نظامي" | "خروج مبكر" => {
    const [expH, expM] = expectedExit.split(":").map(Number);
    const [actH, actM] = actualExit.split(":").map(Number);
    const expMinutes = expH * 60 + expM;
    const actMinutes = actH * 60 + actM;
    return actMinutes < expMinutes - 5 ? "خروج مبكر" : "خروج نظامي";
  };

  const handleAddRecord = () => {
    if (!newRecord.date || !newRecord.entryTime) {
      toast.error("يرجى إدخال التاريخ ووقت الدخول");
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

    const updatedRecords = records.map((r) =>
      r.date === editingRecord.date ? editingRecord : r
    );
    saveRecords(updatedRecords);
    setEditingRecord(null);
    toast.success("تم تحديث السجل بنجاح");
  };

  const handleDeleteRecord = (date: string) => {
    const updatedRecords = records.filter((r) => r.date !== date);
    saveRecords(updatedRecords);
    toast.success("تم حذف السجل بنجاح");
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
      <header className="gradient-primary text-primary-foreground py-4 px-4 shadow-lg">
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

        {/* Import Instructions */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-primary mb-2">تنسيق ملف الاستيراد (CSV)</h3>
          <p className="text-xs text-muted-foreground">
            التاريخ,وقت_الدخول,وقت_الخروج<br />
            2024-01-15,08:30,16:30<br />
            2024-01-16,07:45,15:45
          </p>
        </div>

        {/* Add Form */}
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
                  type="text"
                  value={editingRecord.entryTime}
                  onChange={(e) => setEditingRecord({ ...editingRecord, entryTime: e.target.value })}
                  className="w-full p-3 bg-muted rounded-xl border border-border focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">وقت الخروج</label>
                <input
                  type="text"
                  value={editingRecord.actualExitTime || ""}
                  onChange={(e) => setEditingRecord({ ...editingRecord, actualExitTime: e.target.value || null })}
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
          <h2 className="text-lg font-bold text-foreground mb-4">السجلات ({records.length})</h2>
          
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
                      {new Date(record.date).toLocaleDateString("ar-SA", {
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
      </main>
    </div>
  );
};

export default Settings;
