import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Database,
  Download,
  Eye,
  EyeOff,
  Lock,
  Palette,
  RefreshCw,
  Shield,
  Sliders,
  Trash2,
} from 'lucide-react';
import {
  AccentTheme,
  FloatingPosition,
  HexaSettings,
  ModuleId,
  PermissionItem,
  TaskPriority,
} from '../types/hexa';
import { HexaStorage } from '../services/storage';
import { getPermissionStatuses, requestSpecificPermission } from '../services/telemetry';
import { HexCard } from './HexCard';
import { PermissionModal } from './PermissionModal';

interface SettingsViewProps {
  settings: HexaSettings;
  onUpdateSettings: (next: HexaSettings) => void;
  onClearNotifications: () => Promise<void>;
  onClearDeviceActivity: () => Promise<void>;
  onImportSampleAndroidSnapshot: () => Promise<void>;
  onPermissionsChanged: () => void;
}

const MODULE_LABELS: Record<ModuleId, string> = {
  daily_activity: 'Daily Phone Activity (6 Stat Cards)',
  screen_time: 'Screen Time Intelligence',
  ram_monitor: 'RAM Monitor',
  rom_monitor: 'ROM / Storage Monitor',
  cpu_monitor: 'CPU Monitor',
  battery_power: 'Power & Charging Intelligence',
  alarm_clock: 'Alarm & Time Intelligence',
  app_usage: 'Application Intelligence',
  recent_notifications: 'Recent Notifications (Latest 5)',
  hexa_tasks: 'HEXA Tasks Manager',
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClearNotifications,
  onClearDeviceActivity,
  onImportSampleAndroidSnapshot,
  onPermissionsChanged,
}) => {
  const [permissions, setPermissions] = useState<PermissionItem[]>(() => getPermissionStatuses());
  const [pendingPermModal, setPendingPermModal] = useState<PermissionItem | null>(null);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { accent, borderGlowIntensity, neonGlowIntensity } = settings.theme;

  const refreshDbStats = async () => {
    const stats = await HexaStorage.getDatabaseStats();
    setDbStats(stats);
  };

  useEffect(() => {
    refreshDbStats();
  }, []);

  const flashStatus = (msg: string) => {
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(null), 3500);
  };

  const moveModule = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    const order = [...settings.dashboard.moduleOrder];
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    onUpdateSettings({
      ...settings,
      dashboard: { ...settings.dashboard, moduleOrder: order },
    });
  };

  const handleExport = async () => {
    const json = await HexaStorage.exportAllDataJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hexa-intelligence-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flashStatus('Exported local HEXA intelligence report (JSON).');
  };

  const handleConfirmPermission = async () => {
    if (!pendingPermModal) return;
    const result = await requestSpecificPermission(pendingPermModal.id);
    setPermissions(getPermissionStatuses());
    onPermissionsChanged();
    setPendingPermModal(null);
    if (result === 'granted') {
      flashStatus(`Permission granted: ${pendingPermModal.title}`);
    } else if (result === 'unavailable-in-web') {
      flashStatus(`${pendingPermModal.title}: Requires native Android Bridge wrapper.`);
    } else {
      flashStatus(`Permission denied: ${pendingPermModal.title}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24 space-y-4">
      {statusMessage && (
        <div className="p-3 rounded-lg bg-[#0D1932] border border-[#00DFFF]/50 text-xs font-medium text-[#00DFFF]">
          {statusMessage}
        </div>
      )}

      {/* 1. Theme Settings */}
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-[#00DFFF]" />
          <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
            THEME SETTINGS (DARK NEXUS)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#8496B5] mb-2">
              Accent Glow Selection
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['cyan', 'blue', 'purple', 'magenta'] as AccentTheme[]).map((item) => {
                const colorMap: Record<AccentTheme, string> = {
                  cyan: '#00DFFF',
                  blue: '#1677E8',
                  purple: '#8B4DCE',
                  magenta: '#B93DBD',
                };
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        theme: { ...settings.theme, accent: item },
                      })
                    }
                    className={`py-2 px-2 rounded-lg border text-xs font-medium capitalize flex items-center justify-center gap-1.5 transition-colors ${
                      settings.theme.accent === item
                        ? 'bg-[#0D1932] border-[#00DFFF] text-[#EAF4FF]'
                        : 'bg-[#050A17] border-[#1677E8]/25 text-[#8496B5]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: colorMap[item] }}
                    />
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#8496B5] mb-1">
                <span>Darkness Intensity</span>
                <span className="font-mono-tech text-[#00DFFF]">
                  {settings.theme.darknessIntensity}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={settings.theme.darknessIntensity}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    theme: { ...settings.theme, darknessIntensity: Number(e.target.value) },
                  })
                }
                className="w-full accent-[#00DFFF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-[#8496B5] mb-1">
                  <span>Neon Glow</span>
                  <span className="font-mono-tech text-[#00DFFF]">
                    {settings.theme.neonGlowIntensity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.theme.neonGlowIntensity}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      theme: { ...settings.theme, neonGlowIntensity: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#00DFFF]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-[#8496B5] mb-1">
                  <span>Border Glow</span>
                  <span className="font-mono-tech text-[#00DFFF]">
                    {settings.theme.borderGlowIntensity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={100}
                  value={settings.theme.borderGlowIntensity}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      theme: { ...settings.theme, borderGlowIntensity: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-[#8B4DCE]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#1677E8]/20 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs text-[#EAF4FF] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.theme.showBackgroundGrid}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  theme: { ...settings.theme, showBackgroundGrid: e.target.checked },
                })
              }
              className="accent-[#00DFFF]"
            />
            Background Technical Grid
          </label>

          <label className="flex items-center gap-2 text-xs text-[#EAF4FF] cursor-pointer">
            <input
              type="checkbox"
              checked={settings.theme.animationsEnabled}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  theme: { ...settings.theme, animationsEnabled: e.target.checked },
                })
              }
              className="accent-[#00DFFF]"
            />
            Ambient Animations
          </label>
        </div>
      </HexCard>

      {/* 2. Home Dashboard Customization */}
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-[#00DFFF]" />
          <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
            HOME DASHBOARD CUSTOMIZATION
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Module Order & Visibility */}
          <div>
            <h3 className="text-xs font-semibold text-[#8496B5] uppercase tracking-wider mb-2">
              Module Visibility & Order
            </h3>
            <div className="space-y-1.5">
              {settings.dashboard.moduleOrder.map((modId, idx) => {
                const visible = settings.dashboard.visibleModules[modId];
                return (
                  <div
                    key={modId}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20"
                  >
                    <span className="text-xs text-[#EAF4FF] truncate">
                      {idx + 1}. {MODULE_LABELS[modId]}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveModule(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move ${MODULE_LABELS[modId]} up`}
                        className="p-1.5 rounded bg-[#050A17] text-[#8496B5] hover:text-[#00DFFF] disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveModule(idx, 1)}
                        disabled={idx === settings.dashboard.moduleOrder.length - 1}
                        aria-label={`Move ${MODULE_LABELS[modId]} down`}
                        className="p-1.5 rounded bg-[#050A17] text-[#8496B5] hover:text-[#00DFFF] disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            dashboard: {
                              ...settings.dashboard,
                              visibleModules: {
                                ...settings.dashboard.visibleModules,
                                [modId]: !visible,
                              },
                            },
                          })
                        }
                        aria-label={`Toggle ${MODULE_LABELS[modId]} visibility`}
                        className={`p-1.5 rounded border ${
                          visible
                            ? 'bg-[#00DFFF]/15 border-[#00DFFF]/40 text-[#00DFFF]'
                            : 'bg-[#050A17] border-[#8496B5]/30 text-[#8496B5]'
                        }`}
                      >
                        {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Clock, Layout Density & Stat Cards */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-[#8496B5] uppercase tracking-wider mb-2">
                Clock & Layout Density
              </h3>
              <div className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 space-y-2.5">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs text-[#EAF4FF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.dashboard.clock24Hour}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          dashboard: { ...settings.dashboard, clock24Hour: e.target.checked },
                        })
                      }
                      className="accent-[#00DFFF]"
                    />
                    24-Hour Clock Format
                  </label>
                  <label className="flex items-center gap-2 text-xs text-[#EAF4FF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.dashboard.clockShowSeconds}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          dashboard: { ...settings.dashboard, clockShowSeconds: e.target.checked },
                        })
                      }
                      className="accent-[#00DFFF]"
                    />
                    Show Live Seconds
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-[#8496B5]">Density:</span>
                  {(['compact', 'detailed'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          dashboard: { ...settings.dashboard, layoutDensity: d },
                        })
                      }
                      className={`px-3 py-1 rounded text-xs capitalize ${
                        settings.dashboard.layoutDensity === d
                          ? 'bg-[#1677E8] text-[#EAF4FF]'
                          : 'bg-[#050A17] text-[#8496B5]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#8496B5] uppercase tracking-wider mb-2">
                Daily Activity Stat Cards
              </h3>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
                {(
                  [
                    ['unlocks', 'Phone Unlocks'],
                    ['locks', 'Phone Locks'],
                    ['sessions', 'Screen Sessions'],
                    ['screenTime', 'Total Screen Time'],
                    ['notifications', 'Notifications'],
                    ['appsUsed', 'Apps Used'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-[#EAF4FF] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.dashboard.visibleStatCards[key]}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          dashboard: {
                            ...settings.dashboard,
                            visibleStatCards: {
                              ...settings.dashboard.visibleStatCards,
                              [key]: e.target.checked,
                            },
                          },
                        })
                      }
                      className="accent-[#00DFFF]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </HexCard>

      {/* 3. Monitoring & Task Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HexCard
          variant="outer"
          chamferSize={14}
          accent={accent}
          borderGlowIntensity={borderGlowIntensity}
          neonGlowIntensity={neonGlowIntensity}
          innerClassName="p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-4 h-4 text-[#00DFFF]" />
            <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
              MONITORING SETTINGS
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            {(
              [
                ['appUsageEnabled', 'Application Usage Monitoring'],
                ['notificationMonitoringEnabled', 'Notification Intelligence Monitoring'],
                ['screenActivityEnabled', 'Screen Activity & Unlock Tracking'],
                ['chargingHistoryEnabled', 'Charging Session Counter & History'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 cursor-pointer"
              >
                <span className="text-[#EAF4FF]">{label}</span>
                <input
                  type="checkbox"
                  checked={settings.monitoring[key]}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      monitoring: { ...settings.monitoring, [key]: e.target.checked },
                    })
                  }
                  className="accent-[#00DFFF]"
                />
              </label>
            ))}

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
              <span className="text-[#EAF4FF]">Hardware Refresh Interval</span>
              <select
                value={settings.monitoring.hardwareRefreshIntervalSec}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    monitoring: {
                      ...settings.monitoring,
                      hardwareRefreshIntervalSec: Number(e.target.value) as 2 | 5 | 10 | 30,
                    },
                  })
                }
                className="px-2.5 py-1 rounded bg-[#050A17] border border-[#1677E8]/35 text-[#00DFFF] font-mono-tech"
              >
                <option value={2}>2 seconds</option>
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
            </div>
          </div>
        </HexCard>

        <HexCard
          variant="outer"
          chamferSize={14}
          accent={accent}
          borderGlowIntensity={borderGlowIntensity}
          neonGlowIntensity={neonGlowIntensity}
          innerClassName="p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-4 h-4 text-[#B93DBD]" />
            <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
              TASK & FLOATING POPUP SETTINGS
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 cursor-pointer">
              <span className="text-[#EAF4FF]">Floating Task Reminder Popup</span>
              <input
                type="checkbox"
                checked={settings.tasks.floatingPopupEnabled}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    tasks: { ...settings.tasks, floatingPopupEnabled: e.target.checked },
                  })
                }
                className="accent-[#00DFFF]"
              />
            </label>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
              <span className="text-[#EAF4FF]">Floating Position</span>
              <select
                value={settings.tasks.floatingPosition}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    tasks: {
                      ...settings.tasks,
                      floatingPosition: e.target.value as FloatingPosition,
                    },
                  })
                }
                className="px-2.5 py-1 rounded bg-[#050A17] border border-[#1677E8]/35 text-[#00DFFF]"
              >
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
              <span className="text-[#EAF4FF]">Floating Card Appearance</span>
              <select
                value={settings.tasks.floatingAppearance}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    tasks: {
                      ...settings.tasks,
                      floatingAppearance: e.target.value as 'compact' | 'expanded',
                    },
                  })
                }
                className="px-2.5 py-1 rounded bg-[#050A17] border border-[#1677E8]/35 text-[#00DFFF]"
              >
                <option value="compact">Compact (Top Priority)</option>
                <option value="expanded">Expanded (Top 3 Tasks)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
              <span className="text-[#EAF4FF]">Default Task Priority</span>
              <select
                value={settings.tasks.defaultPriority}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    tasks: {
                      ...settings.tasks,
                      defaultPriority: e.target.value as TaskPriority,
                    },
                  })
                }
                className="px-2.5 py-1 rounded bg-[#050A17] border border-[#1677E8]/35 text-[#00DFFF]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <label className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 cursor-pointer">
              <span className="text-[#EAF4FF]">Task Reminder Notifications</span>
              <input
                type="checkbox"
                checked={settings.tasks.reminderNotificationsEnabled}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    tasks: {
                      ...settings.tasks,
                      reminderNotificationsEnabled: e.target.checked,
                    },
                  })
                }
                className="accent-[#00DFFF]"
              />
            </label>
          </div>
        </HexCard>
      </div>

      {/* 4. Permissions & Privacy */}
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#00DFFF]" />
          <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
            PERMISSIONS & PRIVACY CONTROLS
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {permissions.map((perm) => (
            <div
              key={perm.id}
              className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/25 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#EAF4FF]">{perm.title}</div>
                <div className="font-mono-tech text-[10px] text-[#00DFFF] truncate">
                  {perm.androidApi}
                </div>
                <div className="text-[11px] text-[#8496B5] mt-0.5 line-clamp-2">
                  {perm.description}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPendingPermModal(perm)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 border ${
                  perm.status === 'granted'
                    ? 'bg-[#10B981]/15 border-[#10B981]/40 text-[#34D399]'
                    : perm.status === 'unavailable-in-web'
                    ? 'bg-[#050A17] border-[#8496B5]/30 text-[#8496B5]'
                    : 'bg-[#1677E8] border-[#00DFFF]/40 text-[#EAF4FF]'
                }`}
              >
                {perm.status === 'granted'
                  ? 'Granted'
                  : perm.status === 'unavailable-in-web'
                  ? 'Android Bridge'
                  : perm.status === 'denied'
                  ? 'Denied · Retry'
                  : 'Request'}
              </button>
            </div>
          ))}
        </div>
      </HexCard>

      {/* 5. Data Management */}
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-[#00DFFF]" />
          <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
            DATA MANAGEMENT & LOCAL DATABASE
          </h2>
        </div>

        <p className="text-xs text-[#8496B5] mb-3">
          Privacy Notice: All notifications, activity logs, charging sessions, tasks, and preferences are stored locally inside your browser IndexedDB / Room database. Zero data is transmitted to external servers.
        </p>

        {dbStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
            {Object.entries(dbStats).map(([key, count]) => (
              <div key={key} className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                <div className="text-[10px] text-[#8496B5] capitalize">
                  {key.replace(/([A-Z])/g, ' $1')}
                </div>
                <div className="font-mono-tech text-sm font-bold text-[#00DFFF] mt-0.5">
                  {count}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            className="px-3.5 py-2 rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export Reports (JSON)
          </button>

          <button
            type="button"
            onClick={async () => {
              await onImportSampleAndroidSnapshot();
              await refreshDbStats();
              flashStatus('Loaded sample Android bridge records for inspection.');
            }}
            className="px-3.5 py-2 rounded-lg bg-[#0D1932] border border-[#8B4DCE]/45 text-xs font-medium text-[#EAF4FF] hover:border-[#00DFFF]"
          >
            Import Android Bridge Sample
          </button>

          <button
            type="button"
            onClick={async () => {
              await onClearNotifications();
              await refreshDbStats();
              flashStatus('Notification history cleared.');
            }}
            className="px-3.5 py-2 rounded-lg bg-[#0D1932] border border-red-500/35 text-xs font-medium text-red-400 hover:bg-red-500/15 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Notification History
          </button>

          <button
            type="button"
            onClick={async () => {
              await onClearDeviceActivity();
              await refreshDbStats();
              flashStatus('Device activity & charging history cleared.');
            }}
            className="px-3.5 py-2 rounded-lg bg-[#0D1932] border border-red-500/35 text-xs font-medium text-red-400 hover:bg-red-500/15 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Device Activity History
          </button>
        </div>
      </HexCard>

      <PermissionModal
        permission={pendingPermModal}
        accent={accent}
        onConfirm={handleConfirmPermission}
        onClose={() => setPendingPermModal(null)}
      />
    </div>
  );
};
