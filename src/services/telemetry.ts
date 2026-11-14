import {
  AlarmRecord,
  BatteryStatus,
  HardwareTelemetry,
  NotificationRecord,
  PermissionItem,
} from '../types/hexa';

// Optional native Android WebView Bridge declaration
export interface HexaAndroidBridgeInterface {
  getDeviceRamInfo?: () => string;
  getStorageInfo?: () => string;
  getBatteryDetails?: () => string;
  getNextAlarmClock?: () => string;
  getUsageStatsToday?: () => string;
  getRecentNotifications?: () => string;
  hasUsageAccessPermission?: () => boolean;
  hasNotificationListenerPermission?: () => boolean;
  hasOverlayPermission?: () => boolean;
  requestUsageAccessPermission?: () => void;
  requestNotificationListenerPermission?: () => void;
  requestOverlayPermission?: () => void;
  openDefaultClockApp?: () => void;
}

declare global {
  interface Window {
    HexaAndroidBridge?: HexaAndroidBridgeInterface;
  }
}

export async function fetchHardwareTelemetry(): Promise<HardwareTelemetry | null> {
  try {
    const res = await fetch('/api/hardware', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as HardwareTelemetry;
  } catch {
    return null;
  }
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<{
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  }>;
}

export async function subscribeBatteryMonitor(
  onUpdate: (status: BatteryStatus) => void
): Promise<() => void> {
  // Check Android native bridge first
  if (window.HexaAndroidBridge?.getBatteryDetails) {
    try {
      const parsed = JSON.parse(window.HexaAndroidBridge.getBatteryDetails());
      onUpdate({
        supported: true,
        levelPercent: typeof parsed.level === 'number' ? parsed.level : null,
        isCharging: typeof parsed.isCharging === 'boolean' ? parsed.isCharging : null,
        chargingTimeSec: null,
        dischargingTimeSec: null,
        temperatureCelsius: parsed.temperatureCelsius ?? null,
        health: parsed.health ?? null,
        technology: parsed.technology ?? null,
        source: 'android-bridge',
        lastUpdated: Date.now(),
      });
    } catch {
      // fall through to browser Battery API
    }
  }

  const nav = navigator as NavigatorWithBattery;
  if (!nav.getBattery) {
    onUpdate({
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
    return () => {};
  }

  try {
    const battery = await nav.getBattery();
    const emit = () => {
      onUpdate({
        supported: true,
        levelPercent: Math.round(battery.level * 100),
        isCharging: battery.charging,
        chargingTimeSec: Number.isFinite(battery.chargingTime) ? battery.chargingTime : null,
        dischargingTimeSec: Number.isFinite(battery.dischargingTime)
          ? battery.dischargingTime
          : null,
        temperatureCelsius: null,
        health: null,
        technology: null,
        source: 'battery-api',
        lastUpdated: Date.now(),
      });
    };

    emit();
    battery.addEventListener('levelchange', emit);
    battery.addEventListener('chargingchange', emit);
    battery.addEventListener('chargingtimechange', emit);
    battery.addEventListener('dischargingtimechange', emit);

    return () => {
      battery.removeEventListener('levelchange', emit);
      battery.removeEventListener('chargingchange', emit);
      battery.removeEventListener('chargingtimechange', emit);
      battery.removeEventListener('dischargingtimechange', emit);
    };
  } catch {
    onUpdate({
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
    return () => {};
  }
}

export function getPermissionStatuses(): PermissionItem[] {
  const bridge = window.HexaAndroidBridge;
  const notifSupported = typeof Notification !== 'undefined';
  const browserNotifStatus: PermissionItem['status'] = !notifSupported
    ? 'unavailable-in-web'
    : Notification.permission === 'granted'
    ? 'granted'
    : Notification.permission === 'denied'
    ? 'denied'
    : 'prompt';

  const nav = navigator as NavigatorWithBattery;
  const batterySupported = typeof nav.getBattery === 'function' || Boolean(bridge?.getBatteryDetails);

  return [
    {
      id: 'browser_notifications',
      title: 'Alert Notifications',
      androidApi: 'POST_NOTIFICATIONS / Web Notification API',
      description: 'Allows HEXA to dispatch task reminders, scheduled alarm alerts, and power notifications.',
      privacyNote: 'Notifications are processed locally on-device and never transmitted externally.',
      status: browserNotifStatus,
    },
    {
      id: 'battery_monitor',
      title: 'Power & Charging Telemetry',
      androidApi: 'BatteryManager / Navigator Battery API',
      description: 'Monitors live battery percentage and detects cable connection transitions for charging session counting.',
      privacyNote: 'Charging history is stored strictly in local IndexedDB.',
      status: batterySupported ? 'granted' : 'unavailable-in-web',
    },
    {
      id: 'usage_access',
      title: 'Application Usage Access',
      androidApi: 'UsageStatsManager (PACKAGE_USAGE_STATS)',
      description: 'Reads foreground app session durations and screen unlock intervals from Android UsageStats.',
      privacyNote: 'In a web browser context, HEXA tracks active HEXA module sessions locally unless paired with the Android Companion Bridge.',
      status: bridge?.hasUsageAccessPermission
        ? bridge.hasUsageAccessPermission()
          ? 'granted'
          : 'denied'
        : 'unavailable-in-web',
    },
    {
      id: 'notification_listener',
      title: 'System Notification Listener',
      androidApi: 'NotificationListenerService',
      description: 'Captures incoming system notifications across installed apps with timestamps and dismissal status.',
      privacyNote: 'All notification bodies remain encrypted/stored locally inside Room / IndexedDB.',
      status: bridge?.hasNotificationListenerPermission
        ? bridge.hasNotificationListenerPermission()
          ? 'granted'
          : 'denied'
        : 'unavailable-in-web',
    },
    {
      id: 'overlay_permission',
      title: 'Floating Task Overlay',
      androidApi: 'SYSTEM_ALERT_WINDOW (Display Over Other Apps)',
      description: 'Displays the compact HEXA Pending Task floating card above active views when explicitly enabled.',
      privacyNote: 'Overlay never captures touches outside its own card bounds.',
      status: bridge?.hasOverlayPermission
        ? bridge.hasOverlayPermission()
          ? 'granted'
          : 'denied'
        : 'granted', // Web in-app floating overlay works natively without blocking viewport
    },
  ];
}

export async function requestSpecificPermission(
  id: PermissionItem['id']
): Promise<'granted' | 'denied' | 'unavailable-in-web'> {
  const bridge = window.HexaAndroidBridge;
  if (id === 'browser_notifications') {
    if (typeof Notification === 'undefined') return 'unavailable-in-web';
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  }
  if (id === 'usage_access' && bridge?.requestUsageAccessPermission) {
    bridge.requestUsageAccessPermission();
    return bridge.hasUsageAccessPermission?.() ? 'granted' : 'denied';
  }
  if (id === 'notification_listener' && bridge?.requestNotificationListenerPermission) {
    bridge.requestNotificationListenerPermission();
    return bridge.hasNotificationListenerPermission?.() ? 'granted' : 'denied';
  }
  if (id === 'overlay_permission' && bridge?.requestOverlayPermission) {
    bridge.requestOverlayPermission();
    return bridge.hasOverlayPermission?.() ? 'granted' : 'denied';
  }
  return 'unavailable-in-web';
}

export function dispatchLocalNotification(
  title: string,
  body: string
): boolean {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function computeNextAlarmOccurrence(alarm: AlarmRecord, nowMs = Date.now()): number | null {
  if (!alarm.enabled || !alarm.time24) return null;
  const [hhStr, mmStr] = alarm.time24.split(':');
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  const now = new Date(nowMs);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + dayOffset,
      hh,
      mm,
      0,
      0
    );
    if (candidate.getTime() <= nowMs) continue;
    if (alarm.repeatDays.length === 0 || alarm.repeatDays.includes(candidate.getDay())) {
      return candidate.getTime();
    }
  }
  return null;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, exp);
  return `${val >= 100 ? val.toFixed(0) : val.toFixed(1)} ${units[exp]}`;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function formatTimeShort(ts: number | null, use24h = false): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24h,
  });
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function createNotificationEntry(
  partial: Omit<NotificationRecord, 'id' | 'receivedAt' | 'dismissed' | 'read'>
): NotificationRecord {
  return {
    ...partial,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    receivedAt: Date.now(),
    dismissed: false,
    read: false,
  };
}
