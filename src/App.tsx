import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlarmRecord,
  AppUsageRecord,
  BatteryStatus,
  ChargingSessionRecord,
  DailyActivitySummary,
  getDateKey,
  getYesterdayKey,
  HardwareTelemetry,
  HexaSettings,
  HexaTask,
  NavTab,
  NotificationRecord,
  ScreenSessionRecord,
} from './types/hexa';
import {
  createEmptyDailySummary,
  HexaStorage,
  loadSettings,
  saveSettings,
} from './services/storage';
import {
  createNotificationEntry,
  dispatchLocalNotification,
  fetchHardwareTelemetry,
  subscribeBatteryMonitor,
} from './services/telemetry';
import { HeaderClock } from './components/HeaderClock';
import { BottomNav } from './components/BottomNav';
import { HomeDashboard } from './components/HomeDashboard';
import { HistoryView } from './components/HistoryView';
import { HexaCoreView } from './components/HexaCoreView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { FloatingTaskPopup } from './components/FloatingTaskPopup';

const TAB_APP_MAP: Record<NavTab, { packageName: string; appName: string }> = {
  home: { packageName: 'com.hexa.intelligence.home', appName: 'HEXA Command Center' },
  history: { packageName: 'com.hexa.intelligence.history', appName: 'Notification Archive' },
  core: { packageName: 'com.hexa.intelligence.core', appName: 'HEXA Core Engine' },
  analytics: { packageName: 'com.hexa.intelligence.analytics', appName: 'Analytics Studio' },
  settings: { packageName: 'com.hexa.intelligence.settings', appName: 'System Configuration' },
};

export default function App() {
  const [settings, setSettings] = useState<HexaSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<NavTab>('home');

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [tasks, setTasks] = useState<HexaTask[]>([]);
  const [alarms, setAlarms] = useState<AlarmRecord[]>([]);
  const [chargingSessions, setChargingSessions] = useState<ChargingSessionRecord[]>([]);
  const [screenSessions, setScreenSessions] = useState<ScreenSessionRecord[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyActivitySummary[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailyActivitySummary>(() =>
    createEmptyDailySummary(getDateKey())
  );
  const [appUsageToday, setAppUsageToday] = useState<AppUsageRecord[]>([]);

  const [hardware, setHardware] = useState<HardwareTelemetry | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [battery, setBattery] = useState<BatteryStatus>({
    supported: false,
    levelPercent: null,
    isCharging: null,
    chargingTimeSec: null,
    dischargingTimeSec: null,
    temperatureCelsius: null,
    health: null,
    technology: null,
    source: 'unavailable',
    lastUpdated: Date.now(),
  });

  const [, setPermTick] = useState(0);

  // Refs for accurate session & transition tracking without stale closures
  const prevChargingRef = useRef<boolean | null>(null);
  const lastHiddenAtRef = useRef<number | null>(null);
  const activeScreenSessionRef = useRef<ScreenSessionRecord | null>(null);
  const firedMinuteKeysRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const updateSettings = useCallback((next: HexaSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // 1. Initial load from IndexedDB + initial screen unlock session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const todayKey = getDateKey();
      const [notifs, taskList, alarmList, charges, screens, summaries, apps] =
        await Promise.all([
          HexaStorage.getNotifications(),
          HexaStorage.getTasks(),
          HexaStorage.getAlarms(),
          HexaStorage.getChargingSessions(),
          HexaStorage.getScreenSessions(),
          HexaStorage.getDailySummaries(),
          HexaStorage.getAppUsageRecords(todayKey),
        ]);

      if (!mounted) return;

      setNotifications(notifs);
      setTasks(taskList);
      setAlarms(alarmList);
      setChargingSessions(charges);
      setScreenSessions(screens);
      setDailySummaries(summaries);
      setAppUsageToday(apps);

      const existingToday =
        summaries.find((d) => d.dateKey === todayKey) || createEmptyDailySummary(todayKey);

      // Count initial active unlock/session when user opens HEXA
      const now = Date.now();
      const bootedToday: DailyActivitySummary = {
        ...existingToday,
        unlocksCount: existingToday.unlocksCount + (settingsRef.current.monitoring.screenActivityEnabled ? 1 : 0),
        screenSessionsCount:
          existingToday.screenSessionsCount +
          (settingsRef.current.monitoring.screenActivityEnabled ? 1 : 0),
        firstUnlockAt: existingToday.firstUnlockAt ?? now,
      };
      setTodaySummary(bootedToday);
      await HexaStorage.saveDailySummary(bootedToday);

      if (settingsRef.current.monitoring.screenActivityEnabled) {
        const session: ScreenSessionRecord = {
          id: `scr_${now}`,
          dateKey: todayKey,
          startTime: now,
          endTime: null,
          durationMs: 0,
          type: 'screen_on',
          trigger: 'visibility',
        };
        activeScreenSessionRef.current = session;
        setScreenSessions((prev) => [session, ...prev]);
        await HexaStorage.saveScreenSession(session);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // 1b. Android Native Bridge Sync (Notifications, UsageStats, AlarmManager, System Overlay)
  useEffect(() => {
    const bridge = window.HexaAndroidBridge;
    if (!bridge) return;

    const syncBridgeData = async () => {
      const todayKey = getDateKey();
      try {
        if (bridge.getRecentNotifications && settingsRef.current.monitoring.notificationMonitoringEnabled) {
          const rawNotifs = JSON.parse(bridge.getRecentNotifications()) as NotificationRecord[];
          if (Array.isArray(rawNotifs) && rawNotifs.length > 0) {
            setNotifications((prev) => {
              const map = new Map(prev.map((n) => [n.id, n]));
              for (const rn of rawNotifs) {
                if (!map.has(rn.id)) {
                  map.set(rn.id, rn);
                  HexaStorage.saveNotification(rn);
                }
              }
              return Array.from(map.values()).sort((a, b) => b.receivedAt - a.receivedAt);
            });
          }
        }
        if (bridge.getUsageStatsToday && settingsRef.current.monitoring.appUsageEnabled) {
          const rawApps = JSON.parse(bridge.getUsageStatsToday()) as AppUsageRecord[];
          if (Array.isArray(rawApps) && rawApps.length > 0) {
            setAppUsageToday((prev) => {
              const map = new Map(prev.map((a) => [a.packageName, a]));
              for (const ra of rawApps) {
                const existing = map.get(ra.packageName);
                if (!existing || ra.totalDurationMs >= existing.totalDurationMs) {
                  map.set(ra.packageName, ra);
                  HexaStorage.saveAppUsageRecord(todayKey, ra);
                }
              }
              return Array.from(map.values());
            });
          }
        }
      } catch {
        // ignore bridge parse errors
      }
    };

    syncBridgeData();
    const id = window.setInterval(syncBridgeData, 8000);
    return () => window.clearInterval(id);
  }, []);

  // Sync native Android SYSTEM_ALERT_WINDOW overlay when floating popup setting changes
  useEffect(() => {
    const bridge = window.HexaAndroidBridge;
    if (!bridge?.showFloatingTaskOverlay || !bridge?.hideFloatingTaskOverlay) return;
    const pending = tasks.filter((t) => !t.completed);
    if (settings.tasks.floatingPopupEnabled && pending.length > 0 && bridge.hasOverlayPermission?.()) {
      bridge.showFloatingTaskOverlay(pending[0].title, pending[0].priority.toUpperCase());
    } else {
      bridge.hideFloatingTaskOverlay();
    }
  }, [settings.tasks.floatingPopupEnabled, tasks]);

  // 2. Real Hardware Polling (/api/hardware)
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const data = await fetchHardwareTelemetry();
      if (!active || !data) return;
      setHardware(data);
      if (data.cpu.usagePercent !== null) {
        setCpuHistory((prev) => [...prev.slice(-29), data.cpu.usagePercent as number]);
      }
      setRamHistory((prev) => [...prev.slice(-29), data.ram.usagePercent]);
    };

    poll();
    // Rapid 2nd sample 900ms after first so CPU delta appears right away
    const secondSample = window.setTimeout(poll, 900);
    const intervalId = window.setInterval(
      poll,
      settings.monitoring.hardwareRefreshIntervalSec * 1000
    );

    return () => {
      active = false;
      window.clearTimeout(secondSample);
      window.clearInterval(intervalId);
    };
  }, [settings.monitoring.hardwareRefreshIntervalSec]);

  // 3. Real Battery & Charging Session Counter (disconnected -> connected only)
  useEffect(() => {
    let cleanup = () => {};
    subscribeBatteryMonitor((status) => {
      setBattery(status);
      if (!status.supported || status.isCharging === null) return;
      if (!settingsRef.current.monitoring.chargingHistoryEnabled) {
        prevChargingRef.current = status.isCharging;
        return;
      }

      const prev = prevChargingRef.current;
      const now = Date.now();
      const todayKey = getDateKey(now);

      // Transition: Disconnected (false) -> Connected (true)
      if (prev === false && status.isCharging === true) {
        const newSession: ChargingSessionRecord = {
          id: `chg_${now}`,
          dateKey: todayKey,
          startTime: now,
          endTime: null,
          startLevel: status.levelPercent,
          endLevel: status.levelPercent,
          durationMs: 0,
        };
        setChargingSessions((list) => [newSession, ...list]);
        HexaStorage.saveChargingSession(newSession);

        setTodaySummary((curr) => {
          const updated = {
            ...curr,
            chargingSessionsCount: curr.chargingSessionsCount + 1,
          };
          HexaStorage.saveDailySummary(updated);
          return updated;
        });
      }

      // Transition: Connected (true) -> Disconnected (false)
      if (prev === true && status.isCharging === false) {
        setChargingSessions((list) =>
          list.map((s) => {
            if (s.endTime === null) {
              const closed: ChargingSessionRecord = {
                ...s,
                endTime: now,
                endLevel: status.levelPercent,
                durationMs: now - s.startTime,
              };
              HexaStorage.saveChargingSession(closed);
              return closed;
            }
            return s;
          })
        );
      }

      prevChargingRef.current = status.isCharging;
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => cleanup();
  }, []);

  // 4. Real Screen Visibility + Per-Module App Usage Tracking
  useEffect(() => {
    const handleVisibility = () => {
      if (!settingsRef.current.monitoring.screenActivityEnabled) return;
      const now = Date.now();
      const todayKey = getDateKey(now);

      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = now;
        if (activeScreenSessionRef.current) {
          const finished: ScreenSessionRecord = {
            ...activeScreenSessionRef.current,
            endTime: now,
            durationMs: now - activeScreenSessionRef.current.startTime,
          };
          activeScreenSessionRef.current = null;
          setScreenSessions((prev) =>
            prev.map((s) => (s.id === finished.id ? finished : s))
          );
          HexaStorage.saveScreenSession(finished);
        }
        setTodaySummary((curr) => {
          const updated = {
            ...curr,
            locksCount: curr.locksCount + 1,
            lastScreenOffAt: now,
          };
          HexaStorage.saveDailySummary(updated);
          return updated;
        });
      } else if (document.visibilityState === 'visible') {
        const offDelta =
          lastHiddenAtRef.current !== null ? now - lastHiddenAtRef.current : 0;
        lastHiddenAtRef.current = null;

        const nextSession: ScreenSessionRecord = {
          id: `scr_${now}`,
          dateKey: todayKey,
          startTime: now,
          endTime: null,
          durationMs: 0,
          type: 'screen_on',
          trigger: 'visibility',
        };
        activeScreenSessionRef.current = nextSession;
        setScreenSessions((prev) => [nextSession, ...prev]);
        HexaStorage.saveScreenSession(nextSession);

        setTodaySummary((curr) => {
          const updated = {
            ...curr,
            unlocksCount: curr.unlocksCount + 1,
            screenSessionsCount: curr.screenSessionsCount + 1,
            screenOffMs: curr.screenOffMs + Math.max(0, offDelta),
            firstUnlockAt: curr.firstUnlockAt ?? now,
          };
          HexaStorage.saveDailySummary(updated);
          return updated;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    // 1-second active screen time & app usage accumulator
    const ticker = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      const todayKey = getDateKey(now);
      const hour = new Date(now).getHours();

      if (settingsRef.current.monitoring.screenActivityEnabled) {
        setTodaySummary((curr) => {
          // Handle midnight rollover cleanly
          const base =
            curr.dateKey === todayKey ? curr : createEmptyDailySummary(todayKey);
          const nextHourly = [...base.hourlyScreenMs];
          nextHourly[hour] = (nextHourly[hour] || 0) + 1000;
          const next = {
            ...base,
            screenOnMs: base.screenOnMs + 1000,
            hourlyScreenMs: nextHourly,
          };
          // Persist every 5 seconds to avoid excessive IDB writes
          if (Math.floor(now / 1000) % 5 === 0) {
            HexaStorage.saveDailySummary(next);
          }
          return next;
        });
      }

      if (settingsRef.current.monitoring.appUsageEnabled) {
        const meta = TAB_APP_MAP[activeTabRef.current];
        setAppUsageToday((prev) => {
          const idx = prev.findIndex((a) => a.packageName === meta.packageName);
          let updatedList: AppUsageRecord[];
          let target: AppUsageRecord;
          if (idx === -1) {
            const buckets = new Array(24).fill(0);
            buckets[hour] = 1000;
            target = {
              packageName: meta.packageName,
              appName: meta.appName,
              category: 'Intelligence',
              totalDurationMs: 1000,
              sessionsCount: 1,
              notificationsCount: 0,
              lastUsedAt: now,
              hourlyBucketsMs: buckets,
              events: [
                {
                  timestamp: now,
                  type: 'session_start',
                  label: `Opened ${meta.appName}`,
                },
              ],
            };
            updatedList = [...prev, target];
          } else {
            const existing = prev[idx];
            const buckets = [...existing.hourlyBucketsMs];
            buckets[hour] = (buckets[hour] || 0) + 1000;
            target = {
              ...existing,
              totalDurationMs: existing.totalDurationMs + 1000,
              lastUsedAt: now,
              hourlyBucketsMs: buckets,
            };
            updatedList = prev.map((a, i) => (i === idx ? target : a));
          }

          if (Math.floor(now / 1000) % 5 === 0) {
            HexaStorage.saveAppUsageRecord(todayKey, target);
          }
          return updatedList;
        });
      }
    }, 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(ticker);
    };
  }, []);

  // Helper to record a new notification & attribute to app usage if matching
  const addNotification = useCallback(
    async (
      partial: Omit<NotificationRecord, 'id' | 'receivedAt' | 'dismissed' | 'read'>
    ) => {
      if (!settingsRef.current.monitoring.notificationMonitoringEnabled) return;
      const entry = createNotificationEntry(partial);
      setNotifications((prev) => [entry, ...prev]);
      await HexaStorage.saveNotification(entry);

      const todayKey = getDateKey(entry.receivedAt);
      setTodaySummary((curr) => {
        const next = {
          ...curr,
          notificationsCount: curr.notificationsCount + 1,
        };
        HexaStorage.saveDailySummary(next);
        return next;
      });

      // Attribute notification to matching app record with real timestamp
      setAppUsageToday((prev) => {
        const idx = prev.findIndex((a) => a.packageName === entry.packageName);
        if (idx === -1) return prev;
        const target = prev[idx];
        const updated: AppUsageRecord = {
          ...target,
          notificationsCount: target.notificationsCount + 1,
          events: [
            ...target.events,
            {
              timestamp: entry.receivedAt,
              type: 'notification',
              label: `Alert: ${entry.title}`,
            },
          ],
        };
        HexaStorage.saveAppUsageRecord(todayKey, updated);
        return prev.map((a, i) => (i === idx ? updated : a));
      });

      dispatchLocalNotification(`${entry.appName}: ${entry.title}`, entry.body);
    },
    []
  );

  // 5. Task Reminders & Local Alarm Trigger Loop
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const todayKey = getDateKey(now.getTime());

      // Check alarms
      for (const alarm of alarms) {
        const key = `alarm:${alarm.id}:${todayKey}:${hhmm}`;
        if (alarm.enabled && alarm.time24 === hhmm && !firedMinuteKeysRef.current.has(key)) {
          firedMinuteKeysRef.current.add(key);
          addNotification({
            appName: 'HEXA Alarm',
            packageName: 'com.hexa.intelligence.core',
            title: alarm.label,
            body: `Scheduled alarm triggered for ${alarm.time24}`,
            category: 'reminder',
            priority: 'high',
            source: 'hexa-internal',
          });
        }
      }

      // Check task reminders
      if (settings.tasks.reminderNotificationsEnabled) {
        for (const task of tasks) {
          const key = `task:${task.id}:${todayKey}:${hhmm}`;
          const dateOk = !task.dueDate || task.dueDate === todayKey;
          if (
            !task.completed &&
            task.reminderTime === hhmm &&
            dateOk &&
            task.remindedForKey !== key &&
            !firedMinuteKeysRef.current.has(key)
          ) {
            firedMinuteKeysRef.current.add(key);
            const updatedTask = { ...task, remindedForKey: key };
            setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
            HexaStorage.saveTask(updatedTask);

            addNotification({
              appName: 'HEXA Tasks',
              packageName: 'com.hexa.intelligence.home',
              title: `Task Reminder: ${task.title}`,
              body: task.description || `Priority: ${task.priority.toUpperCase()}`,
              category: 'reminder',
              priority: task.priority === 'critical' || task.priority === 'high' ? 'high' : 'normal',
              source: 'hexa-internal',
            });
          }
        }
      }
    }, 5000);

    return () => window.clearInterval(id);
  }, [alarms, tasks, settings.tasks.reminderNotificationsEnabled, addNotification]);

  // Tab switch records app session count increment
  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    if (!settings.monitoring.appUsageEnabled) return;
    const now = Date.now();
    const todayKey = getDateKey(now);
    const meta = TAB_APP_MAP[tab];
    setAppUsageToday((prev) => {
      const idx = prev.findIndex((a) => a.packageName === meta.packageName);
      if (idx === -1) {
        const buckets = new Array(24).fill(0);
        const created: AppUsageRecord = {
          packageName: meta.packageName,
          appName: meta.appName,
          category: 'Intelligence',
          totalDurationMs: 0,
          sessionsCount: 1,
          notificationsCount: 0,
          lastUsedAt: now,
          hourlyBucketsMs: buckets,
          events: [{ timestamp: now, type: 'session_start', label: `Switched to ${meta.appName}` }],
        };
        HexaStorage.saveAppUsageRecord(todayKey, created);
        return [...prev, created];
      }
      const existing = prev[idx];
      const updated: AppUsageRecord = {
        ...existing,
        sessionsCount: existing.sessionsCount + 1,
        lastUsedAt: now,
        events: [
          ...existing.events.slice(-24),
          { timestamp: now, type: 'session_start', label: `Opened ${meta.appName}` },
        ],
      };
      HexaStorage.saveAppUsageRecord(todayKey, updated);
      return prev.map((a, i) => (i === idx ? updated : a));
    });
  };

  // Notification handlers
  const handleDismissNotification = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dismissed: true, read: true } : n))
    );
    const target = notifications.find((n) => n.id === id);
    if (target) {
      await HexaStorage.saveNotification({ ...target, dismissed: true, read: true });
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    const target = notifications.find((n) => n.id === id);
    if (target && !target.read) {
      await HexaStorage.saveNotification({ ...target, read: true });
    }
  };

  const handleMarkAllRead = async () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    await Promise.all(updated.map((n) => HexaStorage.saveNotification(n)));
  };

  const handleClearNotifications = async () => {
    await HexaStorage.clearNotifications();
    setNotifications([]);
  };

  const handleClearDeviceActivity = async () => {
    await HexaStorage.clearDeviceActivityHistory();
    const freshToday = createEmptyDailySummary(getDateKey());
    setTodaySummary(freshToday);
    setDailySummaries([]);
    setScreenSessions([]);
    setChargingSessions([]);
    setAppUsageToday([]);
  };

  // Task CRUD handlers
  const handleSaveTask = async (
    input: Omit<HexaTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'remindedForKey'> & {
      id?: string;
    }
  ) => {
    const now = Date.now();
    if (input.id) {
      const existing = tasks.find((t) => t.id === input.id);
      if (!existing) return;
      const updated: HexaTask = {
        ...existing,
        ...input,
        id: existing.id,
        updatedAt: now,
      };
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      await HexaStorage.saveTask(updated);
    } else {
      const created: HexaTask = {
        id: `task_${now}_${Math.random().toString(36).slice(2, 6)}`,
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        reminderTime: input.reminderTime,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        remindedForKey: null,
      };
      setTasks((prev) => [created, ...prev]);
      await HexaStorage.saveTask(created);
    }
  };

  const handleToggleTaskComplete = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const now = Date.now();
    const updated: HexaTask = {
      ...target,
      completed: !target.completed,
      completedAt: !target.completed ? now : null,
      updatedAt: now,
    };
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    await HexaStorage.saveTask(updated);
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await HexaStorage.deleteTask(id);
  };

  // Alarm CRUD handlers
  const handleAddAlarm = async (label: string, time24: string) => {
    const created: AlarmRecord = {
      id: `alm_${Date.now()}`,
      label,
      time24,
      enabled: true,
      repeatDays: [],
      createdAt: Date.now(),
      source: 'local',
    };
    setAlarms((prev) => [created, ...prev]);
    await HexaStorage.saveAlarm(created);
  };

  const handleToggleAlarm = async (id: string) => {
    const target = alarms.find((a) => a.id === id);
    if (!target) return;
    const updated = { ...target, enabled: !target.enabled };
    setAlarms((prev) => prev.map((a) => (a.id === id ? updated : a)));
    await HexaStorage.saveAlarm(updated);
  };

  const handleDeleteAlarm = async (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
    await HexaStorage.deleteAlarm(id);
  };

  const handleTriggerTestNotification = () => {
    addNotification({
      appName: 'HEXA System',
      packageName: 'com.hexa.intelligence.home',
      title: 'Telemetry Alert Verified',
      body: `RAM ${hardware ? hardware.ram.usagePercent + '%' : 'monitoring'} · Local intelligence archive active.`,
      category: 'system',
      priority: 'normal',
      source: 'hexa-internal',
    });
  };

  // Explicit user-triggered sample Android Bridge Snapshot importer
  const handleImportSampleAndroidSnapshot = async () => {
    const now = Date.now();
    const todayKey = getDateKey(now);
    const sampleNotifs: NotificationRecord[] = [
      {
        id: `sample_n1_${now}`,
        appName: 'Chrome',
        packageName: 'com.android.chrome',
        title: 'AI Studio',
        body: 'Tap to copy the URL for this app',
        category: 'general',
        receivedAt: now - 120000,
        dismissed: false,
        read: false,
        priority: 'normal',
        source: 'android-bridge',
      },
      {
        id: `sample_n2_${now}`,
        appName: 'Imou Life',
        packageName: 'com.mm.android.lc',
        title: 'Human detected',
        body: 'Security Camera Perimeter Zone 1',
        category: 'security',
        receivedAt: now - 1320000,
        dismissed: true,
        read: true,
        priority: 'high',
        source: 'android-bridge',
      },
      {
        id: `sample_n3_${now}`,
        appName: 'MTP Host',
        packageName: 'com.android.mtp',
        title: 'Accessing files from Android Device',
        body: 'USB file transfer session active',
        category: 'system',
        receivedAt: now - 1800000,
        dismissed: false,
        read: false,
        priority: 'normal',
        source: 'android-bridge',
      },
    ];

    const sampleApps: AppUsageRecord[] = [
      {
        packageName: 'com.google.android.youtube',
        appName: 'YouTube',
        category: 'Media',
        totalDurationMs: 9300000, // 2h 35m
        sessionsCount: 11,
        notificationsCount: 4,
        lastUsedAt: now - 600000,
        hourlyBucketsMs: new Array(24).fill(0).map((_, h) => (h === new Date(now).getHours() ? 4200000 : 300000)),
        events: [
          { timestamp: now - 5400000, type: 'session_start', label: 'Opened YouTube', durationMs: 2400000 },
          { timestamp: now - 1800000, type: 'notification', label: 'New upload notification' },
        ],
      },
      {
        packageName: 'com.android.chrome',
        appName: 'Chrome',
        category: 'Browser',
        totalDurationMs: 4920000, // 1h 22m
        sessionsCount: 18,
        notificationsCount: 3,
        lastUsedAt: now - 120000,
        hourlyBucketsMs: new Array(24).fill(0).map((_, h) => (h === new Date(now).getHours() ? 2200000 : 150000)),
        events: [
          { timestamp: now - 120000, type: 'notification', label: 'AI Studio' },
        ],
      },
    ];

    await Promise.all([
      ...sampleNotifs.map((n) => HexaStorage.saveNotification(n)),
      ...sampleApps.map((a) => HexaStorage.saveAppUsageRecord(todayKey, a)),
    ]);

    setNotifications((prev) => [...sampleNotifs, ...prev]);
    setAppUsageToday((prev) => {
      const merged = [...prev];
      for (const sa of sampleApps) {
        if (!merged.some((m) => m.packageName === sa.packageName)) {
          merged.push(sa);
        }
      }
      return merged;
    });
  };

  const yesterdaySummary =
    dailySummaries.find((d) => d.dateKey === getYesterdayKey()) || null;

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  const darknessAlpha = Math.max(0.4, Math.min(1, settings.theme.darknessIntensity / 100));

  return (
    <div
      className={`min-h-screen relative text-[#EAF4FF] ${
        settings.theme.showBackgroundGrid ? 'hexa-grid-bg' : ''
      }`}
      style={{
        backgroundColor: '#030714',
      }}
    >
      {/* Ambient Deep Navy & Cyan/Purple Atmospheric Layer */}
      <div
        className="pointer-events-none fixed inset-0 hexa-ambient-glow"
        style={{ opacity: 1.2 - darknessAlpha * 0.45 }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <HeaderClock
          accent={settings.theme.accent}
          borderGlowIntensity={settings.theme.borderGlowIntensity}
          neonGlowIntensity={settings.theme.neonGlowIntensity}
          clock24Hour={settings.dashboard.clock24Hour}
          clockShowSeconds={settings.dashboard.clockShowSeconds}
          animationsEnabled={settings.theme.animationsEnabled}
          listenerActive={
            settings.monitoring.notificationMonitoringEnabled ||
            settings.monitoring.screenActivityEnabled
          }
          onOpenCore={() => handleSelectTab('core')}
          onOpenSettings={() => handleSelectTab('settings')}
        />

        <main className="flex-1 pt-1">
          {activeTab === 'home' && (
            <HomeDashboard
              settings={settings}
              todaySummary={todaySummary}
              yesterdaySummary={yesterdaySummary}
              hardware={hardware}
              cpuHistory={cpuHistory}
              battery={battery}
              chargingSessionsToday={chargingSessions.filter(
                (c) => c.dateKey === getDateKey()
              )}
              screenSessionsToday={screenSessions.filter(
                (s) => s.dateKey === getDateKey()
              )}
              appUsageToday={appUsageToday}
              notifications={notifications}
              tasks={tasks}
              alarms={alarms}
              onViewAllNotifications={() => handleSelectTab('history')}
              onDismissNotification={handleDismissNotification}
              onMarkNotificationRead={handleMarkNotificationRead}
              onTriggerTestNotification={handleTriggerTestNotification}
              onSaveTask={handleSaveTask}
              onToggleTaskComplete={handleToggleTaskComplete}
              onDeleteTask={handleDeleteTask}
              onToggleFloatingPopup={() =>
                updateSettings({
                  ...settings,
                  tasks: {
                    ...settings.tasks,
                    floatingPopupEnabled: !settings.tasks.floatingPopupEnabled,
                  },
                })
              }
              onAddAlarm={handleAddAlarm}
              onToggleAlarm={handleToggleAlarm}
              onDeleteAlarm={handleDeleteAlarm}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              settings={settings}
              notifications={notifications}
              screenSessions={screenSessions}
              chargingSessions={chargingSessions}
              onDismissNotification={handleDismissNotification}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllRead}
              onClearNotifications={handleClearNotifications}
              onTriggerTestNotification={handleTriggerTestNotification}
            />
          )}

          {activeTab === 'core' && (
            <HexaCoreView
              settings={settings}
              hardware={hardware}
              battery={battery}
              todaySummary={todaySummary}
              tasks={tasks}
              unreadNotificationsCount={unreadNotificationsCount}
              onNavigate={handleSelectTab}
              onTriggerTestNotification={handleTriggerTestNotification}
              onToggleFloatingPopup={() =>
                updateSettings({
                  ...settings,
                  tasks: {
                    ...settings.tasks,
                    floatingPopupEnabled: !settings.tasks.floatingPopupEnabled,
                  },
                })
              }
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView
              settings={settings}
              todaySummary={todaySummary}
              allDailySummaries={dailySummaries}
              appUsageToday={appUsageToday}
              hardware={hardware}
              cpuHistory={cpuHistory}
              ramHistory={ramHistory}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={updateSettings}
              onClearNotifications={handleClearNotifications}
              onClearDeviceActivity={handleClearDeviceActivity}
              onImportSampleAndroidSnapshot={handleImportSampleAndroidSnapshot}
              onPermissionsChanged={() => setPermTick((t) => t + 1)}
            />
          )}
        </main>

        {/* Non-blocking Floating Task Reminder Popup (only when explicitly enabled by user) */}
        <FloatingTaskPopup
          tasks={tasks}
          enabled={settings.tasks.floatingPopupEnabled}
          position={settings.tasks.floatingPosition}
          appearance={settings.tasks.floatingAppearance}
          accent={settings.theme.accent}
          onCompleteTask={handleToggleTaskComplete}
          onDismissPopup={() =>
            updateSettings({
              ...settings,
              tasks: { ...settings.tasks, floatingPopupEnabled: false },
            })
          }
          onOpenTasksSection={() => handleSelectTab('home')}
        />

        <BottomNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          unreadNotificationsCount={unreadNotificationsCount}
          pendingTasksCount={pendingTasksCount}
          accent={settings.theme.accent}
        />
      </div>
    </div>
  );
}
