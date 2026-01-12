/**
 * Beacon Diagnostics Log Component
 * Displays real-time scan attempts and signal strength
 */

import { useState, useEffect } from 'react';
import {
  Radio,
  Trash2,
  Signal,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DiagnosticEntry,
  subscribeToDiagnostics,
  clearDiagnostics,
  formatDiagnosticTime,
  getEntryColorClass,
  getEntryBgClass,
  getDiagnosticEntries,
} from '@/lib/beaconDiagnostics';
import { formatDistanceArabic, calculateDistanceFromRssi } from '@/lib/beaconConstants';

const BeaconDiagnosticsLog = () => {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Load initial entries
    setEntries(getDiagnosticEntries());

    // Subscribe to updates
    const unsubscribe = subscribeToDiagnostics((newEntries) => {
      setEntries(newEntries);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClear = () => {
    clearDiagnostics();
    setEntries([]);
  };

  const getTypeLabel = (type: DiagnosticEntry['type']): string => {
    switch (type) {
      case 'scan_start': return 'بدء مسح';
      case 'scan_end': return 'انتهاء مسح';
      case 'beacon_found': return 'تم العثور';
      case 'beacon_lost': return 'فقد الإشارة';
      case 'entry': return 'دخول النطاق';
      case 'exit': return 'خروج النطاق';
      case 'check_in': return 'تسجيل حضور';
      case 'check_out': return 'تسجيل انصراف';
      case 'error': return 'خطأ';
      case 'info': return 'معلومة';
      default: return type;
    }
  };

  const getRssiColor = (rssi: number): string => {
    if (rssi >= -50) return 'text-green-500';
    if (rssi >= -70) return 'text-lime-500';
    if (rssi >= -80) return 'text-yellow-500';
    if (rssi >= -90) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-card rounded-3xl shadow-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary" />
          <h3 className="text-md font-bold text-foreground">سجل التشخيص</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={autoScroll ? 'text-primary' : 'text-muted-foreground'}
          >
            <RefreshCw className={`w-4 h-4 ${autoScroll ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-muted/50 rounded-xl p-2 text-center">
          <p className="text-xs text-muted-foreground">إجمالي</p>
          <p className="text-lg font-bold text-foreground">{entries.length}</p>
        </div>
        <div className="bg-green-500/10 rounded-xl p-2 text-center">
          <p className="text-xs text-muted-foreground">تم العثور</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {entries.filter(e => e.type === 'beacon_found').length}
          </p>
        </div>
        <div className="bg-blue-500/10 rounded-xl p-2 text-center">
          <p className="text-xs text-muted-foreground">تسجيلات</p>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {entries.filter(e => e.type === 'check_in' || e.type === 'check_out').length}
          </p>
        </div>
      </div>

      {/* Log Entries */}
      <ScrollArea className="h-[400px] rounded-xl border border-border/50">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Radio className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">لا توجد سجلات حتى الآن</p>
            <p className="text-xs mt-1">سيظهر هنا سجل محاولات المسح</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {entries.map((entry) => (
              <Collapsible
                key={entry.id}
                open={expandedEntries.has(entry.id)}
                onOpenChange={() => toggleExpand(entry.id)}
              >
                <div className={`rounded-lg ${getEntryBgClass(entry.type)} p-2`}>
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between text-right">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Type Badge */}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-background/50 ${getEntryColorClass(entry.type)}`}>
                          {getTypeLabel(entry.type)}
                        </span>
                        
                        {/* Message */}
                        <span className="text-xs text-foreground truncate flex-1">
                          {entry.message}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* RSSI if available */}
                        {entry.rssi !== undefined && entry.rssi !== null && (
                          <div className="flex items-center gap-1">
                            <Signal className={`w-3 h-3 ${getRssiColor(entry.rssi)}`} />
                            <span className={`text-xs font-mono ${getRssiColor(entry.rssi)}`}>
                              {entry.rssi}
                            </span>
                          </div>
                        )}

                        {/* Time */}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs font-mono">
                            {formatDiagnosticTime(entry.timestamp)}
                          </span>
                        </div>

                        {/* Expand indicator */}
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          expandedEntries.has(entry.id) 
                            ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                            : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    {(entry.details || entry.distance !== undefined) && (
                      <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                        {/* Distance */}
                        {entry.rssi !== undefined && entry.rssi !== null && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">المسافة التقريبية:</span>
                            <span className="font-medium">
                              {formatDistanceArabic(calculateDistanceFromRssi(entry.rssi))}
                            </span>
                          </div>
                        )}

                        {/* Details */}
                        {entry.details && Object.entries(entry.details).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono text-foreground">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Legend */}
      <div className="mt-4 p-3 bg-muted/30 rounded-xl">
        <p className="text-xs text-muted-foreground mb-2">دليل قوة الإشارة:</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <Signal className="w-3 h-3 text-green-500" />
            <span>ممتاز (&gt;-50)</span>
          </span>
          <span className="flex items-center gap-1">
            <Signal className="w-3 h-3 text-lime-500" />
            <span>جيد جداً (-50 إلى -70)</span>
          </span>
          <span className="flex items-center gap-1">
            <Signal className="w-3 h-3 text-yellow-500" />
            <span>جيد (-70 إلى -80)</span>
          </span>
          <span className="flex items-center gap-1">
            <Signal className="w-3 h-3 text-orange-500" />
            <span>ضعيف (-80 إلى -90)</span>
          </span>
          <span className="flex items-center gap-1">
            <Signal className="w-3 h-3 text-red-500" />
            <span>ضعيف جداً (&lt;-90)</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default BeaconDiagnosticsLog;
