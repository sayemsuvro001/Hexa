export type NavTab = 'home' | 'history' | 'core' | 'analytics' | 'settings';

export type AccentTheme = 'cyan' | 'blue' | 'purple' | 'magenta';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type FloatingPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type ModuleId =
  | 'daily_activity'
  | 'screen_time'
  | 'ram_monitor'
  | 'rom_monitor'
  | 'cpu_monitor'
  | 'battery_power'
  | 'alarm_clock'
  | 'app_usage'
  | 'recent_notifications'
  | 'hexa_tasks';

export interface NotificationRecord {
  id: string;
  appName: string;
  packageName: string;
  title: string;
  body: string;
  category: 'system' | 'message' | 'security' | 'device' | 'reminder' | 'general';
  receivedAt: number;
  dismissed: boolean;
  read: boolean;
  priority: 'normal' | 'high';
  source: 'browser' | 'hexa-internal' | 'android-bridge';
}

export interface AppUsageRecord {
  packageName: string;
  appName: string;
  category: string;
  totalDurationMs: number;
  sessionsCount: number;
  notificationsCount: number;
  lastUsedAt: number;
  hourlyBucketsMs: number[]; // 24 hours
  events: Array<{
    timestamp: number;
    type: 'session_start' | 'session_end' | 'notification';
    label: string;
    durationMs?: number;
  }>;
}

export interface ScreenSessionRecord {
  id: string;
  dateKey: string;
  startTime: number;
  endTime: number | null;
  durationMs: number;
  type: 'screen_on' | 'screen_off';
  trigger: 'visibility' | 'focus' | 'android-bridge';
}

export interface DailyActivitySummary {
  dateKey: string;
  unlocksCount: number;
  locksCount: number;
  screenSessionsCount: number;
  screenOnMs: number;
  screenOffMs: number;
  notificationsCount: number;
  appsUsedCount: number;
  firstUnlockAt: number | null;
  lastScreenOffAt: number | null;
  chargingSessionsCount: number;
  hourlyScreenMs: number[]; // 24 hours
}

export interface HardwareTelemetry {
  timestamp: number;
  ram: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
    source: string;
  };
  storage: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
    mountPoint: string;
    source: string;
  } | null;
  cpu: {
    usagePercent: number | null;
    cores: number;
    architecture: string;
    model: string;
    speedMhz: number | null;
    loadAverage: {
      oneMin: number;
      fiveMin: number;
      fifteenMin: number;
    };
    source: string;
  };
  system: {
    platform: string;
    release: string;
    uptimeSeconds: number;
    hostname: string;
  };
}

export interface BatteryStatus {
  supported: boolean;
  levelPercent: number | null;
  isCharging: boolean | null;
  chargingTimeSec: number | null;
  dischargingTimeSec: number | null;
  temperatureCelsius: number | null;
  health: string | null;
  technology: string | null;
  source: 'battery-api' | 'android-bridge' | 'unavailable';
  lastUpdated: number;
}

export interface ChargingSessionRecord {
  id: string;
  dateKey: string;
  startTime: number;
  endTime: number | null;
  startLevel: number | null;
  endLevel: number | null;
  durationMs: number;
}

export interface AlarmRecord {
  id: string;
  label: string;
  time24: string; // HH:MM
  enabled: boolean;
  repeatDays: number[]; // 0-6 Sun-Sat
  createdAt: number;
  source: 'local' | 'android-bridge';
}

export interface HexaTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD or ''
  reminderTime: string; // HH:MM or ''
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  remindedForKey: string | null;
}

export interface PermissionItem {
  id: 'usage_access' | 'notification_listener' | 'overlay_permission' | 'browser_notifications' | 'battery_monitor';
  title: string;
  androidApi: string;
  description: string;
  privacyNote: string;
  status: 'granted' | 'denied' | 'prompt' | 'unavailable-in-web';
}

export interface HexaSettings {
  theme: {
    darknessIntensity: number; // 0 - 100
    accent: AccentTheme;
    neonGlowIntensity: number; // 0 - 100
    borderGlowIntensity: number; // 0 - 100
    showBackgroundGrid: boolean;
    animationsEnabled: boolean;
  };
  dashboard: {
    moduleOrder: ModuleId[];
    visibleModules: Record<ModuleId, boolean>;
    visibleStatCards: {
      unlocks: boolean;
      locks: boolean;
      sessions: boolean;
      screenTime: boolean;
      notifications: boolean;
      appsUsed: boolean;
    };
    clock24Hour: boolean;
    clockShowSeconds: boolean;
    layoutDensity: 'compact' | 'detailed';
  };
  monitoring: {
    appUsageEnabled: boolean;
    notificationMonitoringEnabled: boolean;
    screenActivityEnabled: boolean;
    chargingHistoryEnabled: boolean;
    hardwareRefreshIntervalSec: 2 | 5 | 10 | 30;
  };
  tasks: {
    floatingPopupEnabled: boolean;
    floatingPosition: FloatingPosition;
    floatingAppearance: 'compact' | 'expanded';
    defaultPriority: TaskPriority;
    reminderNotificationsEnabled: boolean;
  };
}

export const DEFAULT_MODULE_ORDER: ModuleId[] = [
  'daily_activity',
  'screen_time',
  'ram_monitor',
  'rom_monitor',
  'cpu_monitor',
  'battery_power',
  'alarm_clock',
  'app_usage',
  'recent_notifications',
  'hexa_tasks',
];

export const DEFAULT_SETTINGS: HexaSettings = {
  theme: {
    darknessIntensity: 85,
    accent: 'cyan',
    neonGlowIntensity: 65,
    borderGlowIntensity: 75,
    showBackgroundGrid: true,
    animationsEnabled: true,
  },
  dashboard: {
    moduleOrder: DEFAULT_MODULE_ORDER,
    visibleModules: {
      daily_activity: true,
      screen_time: true,
      ram_monitor: true,
      rom_monitor: true,
      cpu_monitor: true,
      battery_power: true,
      alarm_clock: true,
      app_usage: true,
      recent_notifications: true,
      hexa_tasks: true,
    },
    visibleStatCards: {
      unlocks: true,
      locks: true,
      sessions: true,
      screenTime: true,
      notifications: true,
      appsUsed: true,
    },
    clock24Hour: false,
    clockShowSeconds: true,
    layoutDensity: 'detailed',
  },
  monitoring: {
    appUsageEnabled: true,
    notificationMonitoringEnabled: true,
    screenActivityEnabled: true,
    chargingHistoryEnabled: true,
    hardwareRefreshIntervalSec: 5,
  },
  tasks: {
    floatingPopupEnabled: false,
    floatingPosition: 'bottom-right',
    floatingAppearance: 'compact',
    defaultPriority: 'medium',
    reminderNotificationsEnabled: true,
  },
};

export function getDateKey(ts = Date.now()): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayKey(ts = Date.now()): string {
  return getDateKey(ts - 86400000);
}
