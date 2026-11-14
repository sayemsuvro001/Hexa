import {
  AlarmRecord,
  AppUsageRecord,
  ChargingSessionRecord,
  DailyActivitySummary,
  DEFAULT_MODULE_ORDER,
  DEFAULT_SETTINGS,
  getDateKey,
  HexaSettings,
  HexaTask,
  NotificationRecord,
  ScreenSessionRecord,
} from '../types/hexa';

const SETTINGS_KEY = 'hexa_settings_v1';
const DB_NAME = 'hexa_intelligence_db';
const DB_VERSION = 1;

const STORES = {
  notifications: 'notifications',
  tasks: 'tasks',
  alarms: 'alarms',
  chargingSessions: 'charging_sessions',
  screenSessions: 'screen_sessions',
  dailyStats: 'daily_stats',
  appUsage: 'app_usage',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.notifications)) {
        db.createObjectStore(STORES.notifications, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.tasks)) {
        db.createObjectStore(STORES.tasks, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.alarms)) {
        db.createObjectStore(STORES.alarms, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.chargingSessions)) {
        db.createObjectStore(STORES.chargingSessions, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.screenSessions)) {
        db.createObjectStore(STORES.screenSessions, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.dailyStats)) {
        db.createObjectStore(STORES.dailyStats, { keyPath: 'dateKey' });
      }
      if (!db.objectStoreNames.contains(STORES.appUsage)) {
        db.createObjectStore(STORES.appUsage, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await openDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function putToStore<T>(storeName: StoreName, item: T): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Graceful local storage degradation if IDB unavailable
  }
}

async function deleteFromStore(storeName: StoreName, key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

async function clearStore(storeName: StoreName): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

export function loadSettings(): HexaSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<HexaSettings>;
    const mergedOrder = Array.isArray(parsed.dashboard?.moduleOrder)
      ? [
          ...parsed.dashboard.moduleOrder.filter((id) =>
            DEFAULT_MODULE_ORDER.includes(id)
          ),
          ...DEFAULT_MODULE_ORDER.filter(
            (id) => !parsed.dashboard?.moduleOrder?.includes(id)
          ),
        ]
      : DEFAULT_MODULE_ORDER;

    return {
      theme: { ...DEFAULT_SETTINGS.theme, ...parsed.theme },
      dashboard: {
        ...DEFAULT_SETTINGS.dashboard,
        ...parsed.dashboard,
        moduleOrder: mergedOrder,
        visibleModules: {
          ...DEFAULT_SETTINGS.dashboard.visibleModules,
          ...parsed.dashboard?.visibleModules,
        },
        visibleStatCards: {
          ...DEFAULT_SETTINGS.dashboard.visibleStatCards,
          ...parsed.dashboard?.visibleStatCards,
        },
      },
      monitoring: { ...DEFAULT_SETTINGS.monitoring, ...parsed.monitoring },
      tasks: { ...DEFAULT_SETTINGS.tasks, ...parsed.tasks },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: HexaSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota error
  }
}

export function createEmptyDailySummary(dateKey = getDateKey()): DailyActivitySummary {
  return {
    dateKey,
    unlocksCount: 0,
    locksCount: 0,
    screenSessionsCount: 0,
    screenOnMs: 0,
    screenOffMs: 0,
    notificationsCount: 0,
    appsUsedCount: 0,
    firstUnlockAt: null,
    lastScreenOffAt: null,
    chargingSessionsCount: 0,
    hourlyScreenMs: new Array(24).fill(0),
  };
}

export const HexaStorage = {
  // Notifications
  getNotifications: () => getAllFromStore<NotificationRecord>(STORES.notifications),
  saveNotification: (n: NotificationRecord) => putToStore(STORES.notifications, n),
  deleteNotification: (id: string) => deleteFromStore(STORES.notifications, id),
  clearNotifications: () => clearStore(STORES.notifications),

  // Tasks
  getTasks: () => getAllFromStore<HexaTask>(STORES.tasks),
  saveTask: (t: HexaTask) => putToStore(STORES.tasks, t),
  deleteTask: (id: string) => deleteFromStore(STORES.tasks, id),
  clearTasks: () => clearStore(STORES.tasks),

  // Alarms
  getAlarms: () => getAllFromStore<AlarmRecord>(STORES.alarms),
  saveAlarm: (a: AlarmRecord) => putToStore(STORES.alarms, a),
  deleteAlarm: (id: string) => deleteFromStore(STORES.alarms, id),

  // Charging sessions
  getChargingSessions: () => getAllFromStore<ChargingSessionRecord>(STORES.chargingSessions),
  saveChargingSession: (c: ChargingSessionRecord) => putToStore(STORES.chargingSessions, c),
  clearChargingSessions: () => clearStore(STORES.chargingSessions),

  // Screen sessions
  getScreenSessions: () => getAllFromStore<ScreenSessionRecord>(STORES.screenSessions),
  saveScreenSession: (s: ScreenSessionRecord) => putToStore(STORES.screenSessions, s),
  clearScreenSessions: () => clearStore(STORES.screenSessions),

  // Daily summaries
  getDailySummaries: () => getAllFromStore<DailyActivitySummary>(STORES.dailyStats),
  saveDailySummary: (d: DailyActivitySummary) => putToStore(STORES.dailyStats, d),
  clearDailySummaries: () => clearStore(STORES.dailyStats),

  // App Usage per day (keyed by `${dateKey}::${packageName}`)
  getAppUsageRecords: async (dateKey?: string): Promise<AppUsageRecord[]> => {
    const all = await getAllFromStore<AppUsageRecord & { id: string; dateKey: string }>(
      STORES.appUsage
    );
    if (!dateKey) return all;
    return all.filter((r) => r.dateKey === dateKey);
  },
  getAllAppUsageWithDate: () =>
    getAllFromStore<AppUsageRecord & { id: string; dateKey: string }>(STORES.appUsage),
  saveAppUsageRecord: (dateKey: string, record: AppUsageRecord) =>
    putToStore(STORES.appUsage, {
      ...record,
      id: `${dateKey}::${record.packageName}`,
      dateKey,
    }),
  clearAppUsage: () => clearStore(STORES.appUsage),

  async clearDeviceActivityHistory() {
    await Promise.all([
      clearStore(STORES.screenSessions),
      clearStore(STORES.dailyStats),
      clearStore(STORES.appUsage),
      clearStore(STORES.chargingSessions),
    ]);
  },

  async getDatabaseStats() {
    const [notifications, tasks, alarms, charging, screen, daily, apps] = await Promise.all([
      getAllFromStore(STORES.notifications),
      getAllFromStore(STORES.tasks),
      getAllFromStore(STORES.alarms),
      getAllFromStore(STORES.chargingSessions),
      getAllFromStore(STORES.screenSessions),
      getAllFromStore(STORES.dailyStats),
      getAllFromStore(STORES.appUsage),
    ]);
    return {
      notifications: notifications.length,
      tasks: tasks.length,
      alarms: alarms.length,
      chargingSessions: charging.length,
      screenSessions: screen.length,
      dailySummaries: daily.length,
      appUsageEntries: apps.length,
    };
  },

  async exportAllDataJson(): Promise<string> {
    const [notifications, tasks, alarms, chargingSessions, screenSessions, dailyStats, appUsage] =
      await Promise.all([
        this.getNotifications(),
        this.getTasks(),
        this.getAlarms(),
        this.getChargingSessions(),
        this.getScreenSessions(),
        this.getDailySummaries(),
        this.getAllAppUsageWithDate(),
      ]);
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        app: 'HEXA Personal Intelligence System',
        storagePolicy: '100% Local Privacy-First Storage',
        settings: loadSettings(),
        notifications,
        tasks,
        alarms,
        chargingSessions,
        screenSessions,
        dailyStats,
        appUsage,
      },
      null,
      2
    );
  },
};
