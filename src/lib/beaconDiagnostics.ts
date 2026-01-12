/**
 * Beacon Diagnostics - Real-time logging for scan attempts
 */

export interface DiagnosticEntry {
  id: string;
  timestamp: string;
  type: 'scan_start' | 'scan_end' | 'beacon_found' | 'beacon_lost' | 'entry' | 'exit' | 'check_in' | 'check_out' | 'error' | 'info';
  message: string;
  rssi?: number | null;
  distance?: number | null;
  details?: Record<string, unknown>;
}

// Storage key
const DIAGNOSTICS_STORAGE_KEY = 'beaconDiagnostics';
const MAX_ENTRIES = 100; // Keep last 100 entries

// In-memory log for real-time updates
let diagnosticEntries: DiagnosticEntry[] = [];
let listeners: ((entries: DiagnosticEntry[]) => void)[] = [];

/**
 * Load diagnostics from localStorage
 */
export const loadDiagnostics = (): DiagnosticEntry[] => {
  try {
    const saved = localStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
    if (saved) {
      diagnosticEntries = JSON.parse(saved);
      return diagnosticEntries;
    }
  } catch {
    // Ignore
  }
  return [];
};

/**
 * Save diagnostics to localStorage
 */
const saveDiagnostics = (): void => {
  try {
    localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(diagnosticEntries));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Add a diagnostic entry
 */
export const addDiagnosticEntry = (
  type: DiagnosticEntry['type'],
  message: string,
  options?: {
    rssi?: number | null;
    distance?: number | null;
    details?: Record<string, unknown>;
  }
): void => {
  const entry: DiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type,
    message,
    rssi: options?.rssi,
    distance: options?.distance,
    details: options?.details,
  };

  // Add to beginning (newest first)
  diagnosticEntries.unshift(entry);

  // Trim to max entries
  if (diagnosticEntries.length > MAX_ENTRIES) {
    diagnosticEntries = diagnosticEntries.slice(0, MAX_ENTRIES);
  }

  // Save to localStorage
  saveDiagnostics();

  // Notify listeners
  listeners.forEach(listener => listener([...diagnosticEntries]));

  // Also log to console for debugging
  const icon = getTypeIcon(type);
  console.log(`${icon} [Beacon] ${message}`, options?.details || '');
};

/**
 * Get icon for entry type
 */
const getTypeIcon = (type: DiagnosticEntry['type']): string => {
  switch (type) {
    case 'scan_start': return '🔍';
    case 'scan_end': return '⏹️';
    case 'beacon_found': return '📡';
    case 'beacon_lost': return '📴';
    case 'entry': return '🚪';
    case 'exit': return '🚶';
    case 'check_in': return '✅';
    case 'check_out': return '👋';
    case 'error': return '❌';
    case 'info': return 'ℹ️';
    default: return '📝';
  }
};

/**
 * Subscribe to diagnostic updates
 */
export const subscribeToDiagnostics = (
  listener: (entries: DiagnosticEntry[]) => void
): (() => void) => {
  listeners.push(listener);
  
  // Immediately call with current entries
  listener([...diagnosticEntries]);

  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

/**
 * Get all diagnostic entries
 */
export const getDiagnosticEntries = (): DiagnosticEntry[] => {
  if (diagnosticEntries.length === 0) {
    loadDiagnostics();
  }
  return [...diagnosticEntries];
};

/**
 * Clear all diagnostics
 */
export const clearDiagnostics = (): void => {
  diagnosticEntries = [];
  saveDiagnostics();
  listeners.forEach(listener => listener([]));
};

/**
 * Format time for display (Arabic)
 */
export const formatDiagnosticTime = (isoString: string): string => {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const period = hours >= 12 ? 'م' : 'ص';
  const hour12 = hours % 12 || 12;

  return `${hour12}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${period}`;
};

/**
 * Get color class for entry type
 */
export const getEntryColorClass = (type: DiagnosticEntry['type']): string => {
  switch (type) {
    case 'beacon_found': return 'text-green-600 dark:text-green-400';
    case 'beacon_lost': return 'text-amber-600 dark:text-amber-400';
    case 'entry': return 'text-blue-600 dark:text-blue-400';
    case 'exit': return 'text-purple-600 dark:text-purple-400';
    case 'check_in': return 'text-green-600 dark:text-green-400';
    case 'check_out': return 'text-orange-600 dark:text-orange-400';
    case 'error': return 'text-red-600 dark:text-red-400';
    case 'scan_start': return 'text-cyan-600 dark:text-cyan-400';
    case 'scan_end': return 'text-gray-600 dark:text-gray-400';
    case 'info': return 'text-muted-foreground';
    default: return 'text-foreground';
  }
};

/**
 * Get background color class for entry type
 */
export const getEntryBgClass = (type: DiagnosticEntry['type']): string => {
  switch (type) {
    case 'beacon_found': return 'bg-green-500/10';
    case 'check_in': return 'bg-green-500/10';
    case 'check_out': return 'bg-orange-500/10';
    case 'error': return 'bg-red-500/10';
    case 'entry': return 'bg-blue-500/10';
    case 'exit': return 'bg-purple-500/10';
    default: return 'bg-muted/30';
  }
};

// Initialize on load
loadDiagnostics();
