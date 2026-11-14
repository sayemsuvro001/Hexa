import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlarmClock,
  ArrowRight,
  BatteryCharging,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Edit3,
  ExternalLink,
  HardDrive,
  Layers,
  Lock,
  MemoryStick,
  Monitor,
  Pencil,
  Pin,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlock,
  Zap,
} from 'lucide-react';
import {
  AlarmRecord,
  AppUsageRecord,
  BatteryStatus,
  ChargingSessionRecord,
  DailyActivitySummary,
  HardwareTelemetry,
  HexaSettings,
  HexaTask,
  ModuleId,
  NotificationRecord,
  ScreenSessionRecord,
  TaskPriority,
} from '../types/hexa';
import {
  computeNextAlarmOccurrence,
  formatBytes,
  formatDurationMs,
  formatRelativeTime,
  formatTimeShort,
} from '../services/telemetry';
import { HexCard } from './HexCard';
import { BarChartSvg, NeonProgressBar, SparklineGraph } from './CyberCharts';
import { AlarmEditorModal, AppDetailModal, TaskEditorModal } from './DashboardModals';

interface HomeDashboardProps {
  settings: HexaSettings;
  todaySummary: DailyActivitySummary;
  yesterdaySummary: DailyActivitySummary | null;
  hardware: HardwareTelemetry | null;
  cpuHistory: number[];
  battery: BatteryStatus;
  chargingSessionsToday: ChargingSessionRecord[];
  screenSessionsToday: ScreenSessionRecord[];
  appUsageToday: AppUsageRecord[];
  notifications: NotificationRecord[];
  tasks: HexaTask[];
  alarms: AlarmRecord[];
  onViewAllNotifications: () => void;
  onDismissNotification: (id: string) => void;
  onMarkNotificationRead: (id: string) => void;
  onTriggerTestNotification: () => void;
  onSaveTask: (
    task: Omit<HexaTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'remindedForKey'> & {
      id?: string;
    }
  ) => void;
  onToggleTaskComplete: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleFloatingPopup: () => void;
  onAddAlarm: (label: string, time24: string) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
}

const PRIORITY_STYLE: Record<TaskPriority, { text: string; border: string; label: string }> = {
  critical: { text: 'text-red-400', border: 'border-red-500/40', label: 'CRITICAL' },
  high: { text: 'text-[#B93DBD]', border: 'border-[#B93DBD]/40', label: 'HIGH' },
  medium: { text: 'text-[#00DFFF]', border: 'border-[#00DFFF]/40', label: 'MEDIUM' },
  low: { text: 'text-[#8496B5]', border: 'border-[#8496B5]/30', label: 'LOW' },
};

function renderYesterdayDelta(
  todayVal: number,
  yesterdayVal: number | undefined,
  formatter?: (diff: number) => string
): string {
  if (yesterdayVal === undefined) return 'Today baseline';
  const diff = todayVal - yesterdayVal;
  if (diff === 0) return 'Same as yesterday';
  const sign = diff > 0 ? '+' : '-';
  const abs = Math.abs(diff);
  return `${sign}${formatter ? formatter(abs) : abs} vs yesterday`;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  settings,
  todaySummary,
  yesterdaySummary,
  hardware,
  cpuHistory,
  battery,
  chargingSessionsToday,
  screenSessionsToday,
  appUsageToday,
  notifications,
  tasks,
  alarms,
  onViewAllNotifications,
  onDismissNotification,
  onMarkNotificationRead,
  onTriggerTestNotification,
  onSaveTask,
  onToggleTaskComplete,
  onDeleteTask,
  onToggleFloatingPopup,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm,
}) => {
  const [selectedApp, setSelectedApp] = useState<AppUsageRecord | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HexaTask | null>(null);
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { accent, borderGlowIntensity, neonGlowIntensity } = settings.theme;
  const isCompact = settings.dashboard.layoutDensity === 'compact';
  const use24h = settings.dashboard.clock24Hour;

  // Compute Screen Time metrics
  const avgSessionMs =
    todaySummary.screenSessionsCount > 0
      ? Math.round(todaySummary.screenOnMs / todaySummary.screenSessionsCount)
      : 0;

  // Compute Next Alarm
  const nextAlarmInfo = (() => {
    let best: { alarm: AlarmRecord; triggerAt: number } | null = null;
    for (const alarm of alarms) {
      const nextTs = computeNextAlarmOccurrence(alarm, nowTick);
      if (nextTs && (!best || nextTs < best.triggerAt)) {
        best = { alarm, triggerAt: nextTs };
      }
    }
    return best;
  })();

  const alarmRemainingText = (() => {
    if (!nextAlarmInfo) return null;
    const diff = Math.max(0, nextAlarmInfo.triggerAt - nowTick);
    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  })();

  // Active charging session duration
  const activeChargingSession = chargingSessionsToday.find((s) => s.endTime === null);
  const lastCompletedCharging = [...chargingSessionsToday]
    .filter((s) => s.endTime !== null)
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))[0];
  const lastStartedCharging = [...chargingSessionsToday].sort(
    (a, b) => b.startTime - a.startTime
  )[0];

  // Sorted apps by most used
  const sortedApps = [...appUsageToday].sort(
    (a, b) => b.totalDurationMs - a.totalDurationMs
  );
  const totalTrackedAppMs = sortedApps.reduce((acc, a) => acc + a.totalDurationMs, 0);

  // Latest 5 notifications
  const latestNotifications = [...notifications]
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .slice(0, 5);

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  const renderModule = (moduleId: ModuleId) => {
    if (!settings.dashboard.visibleModules[moduleId]) return null;

    switch (moduleId) {
      case 'daily_activity': {
        const cards = [
          settings.dashboard.visibleStatCards.unlocks && {
            key: 'unlocks',
            label: 'PHONE UNLOCKS TODAY',
            value: String(todaySummary.unlocksCount),
            delta: renderYesterdayDelta(
              todaySummary.unlocksCount,
              yesterdaySummary?.unlocksCount
            ),
            icon: <Unlock className="w-4 h-4 text-[#00DFFF]" />,
          },
          settings.dashboard.visibleStatCards.locks && {
            key: 'locks',
            label: 'PHONE LOCKS TODAY',
            value: String(todaySummary.locksCount),
            delta: renderYesterdayDelta(
              todaySummary.locksCount,
              yesterdaySummary?.locksCount
            ),
            icon: <Lock className="w-4 h-4 text-[#8B4DCE]" />,
          },
          settings.dashboard.visibleStatCards.sessions && {
            key: 'sessions',
            label: 'SCREEN-ON SESSIONS',
            value: String(todaySummary.screenSessionsCount),
            delta: renderYesterdayDelta(
              todaySummary.screenSessionsCount,
              yesterdaySummary?.screenSessionsCount
            ),
            icon: <Monitor className="w-4 h-4 text-[#1677E8]" />,
          },
          settings.dashboard.visibleStatCards.screenTime && {
            key: 'screenTime',
            label: 'TOTAL SCREEN TIME',
            value: formatDurationMs(todaySummary.screenOnMs),
            delta: renderYesterdayDelta(
              todaySummary.screenOnMs,
              yesterdaySummary?.screenOnMs,
              formatDurationMs
            ),
            icon: <Clock className="w-4 h-4 text-[#00DFFF]" />,
          },
          settings.dashboard.visibleStatCards.notifications && {
            key: 'notifications',
            label: 'NOTIFICATIONS TODAY',
            value: String(todaySummary.notificationsCount),
            delta: renderYesterdayDelta(
              todaySummary.notificationsCount,
              yesterdaySummary?.notificationsCount
            ),
            icon: <Bell className="w-4 h-4 text-[#B93DBD]" />,
          },
          settings.dashboard.visibleStatCards.appsUsed && {
            key: 'appsUsed',
            label: 'APPLICATIONS USED',
            value: String(sortedApps.length),
            delta: renderYesterdayDelta(
              sortedApps.length,
              yesterdaySummary?.appsUsedCount
            ),
            icon: <Smartphone className="w-4 h-4 text-[#1677E8]" />,
          },
        ].filter(Boolean) as Array<{
          key: string;
          label: string;
          value: string;
          delta: string;
          icon: React.ReactNode;
        }>;

        if (cards.length === 0) return null;

        return (
          <section key={moduleId} className="lg:col-span-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {cards.map((c) => (
                <HexCard
                  key={c.key}
                  variant="outer"
                  chamferSize={12}
                  accent={accent}
                  borderGlowIntensity={borderGlowIntensity}
                  neonGlowIntensity={neonGlowIntensity}
                  innerClassName={isCompact ? 'p-3' : 'p-3.5'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tech text-[10px] tracking-[0.08em] text-[#8496B5] uppercase leading-tight">
                      {c.label}
                    </span>
                    <span className="shrink-0">{c.icon}</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#00DFFF] mt-2 tabular-nums">
                    {c.value}
                  </div>
                  {!isCompact && (
                    <div className="text-[11px] text-[#8496B5] mt-1 truncate">
                      {c.delta}
                    </div>
                  )}
                </HexCard>
              ))}
            </div>
          </section>
        );
      }

      case 'screen_time': {
        const hourlyBars = todaySummary.hourlyScreenMs.map((ms, h) => ({
          label: h % 3 === 0 ? `${h}` : '',
          value: Math.round(ms / 1000),
        }));

        return (
          <section key={moduleId} className="lg:col-span-12">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName={isCompact ? 'p-3.5' : 'p-4 sm:p-5'}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00DFFF]" />
                  <h2 className="font-display text-xs sm:text-sm font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                    SCREEN TIME INTELLIGENCE
                  </h2>
                </div>
                <span className="font-mono-tech text-[11px] text-[#8496B5]">
                  Avg Session: <strong className="text-[#00DFFF]">{formatDurationMs(avgSessionMs)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                    <div className="text-[11px] text-[#8496B5]">Screen-On Today</div>
                    <div className="font-mono-tech text-base font-bold text-[#00DFFF] mt-0.5">
                      {formatDurationMs(todaySummary.screenOnMs)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                    <div className="text-[11px] text-[#8496B5]">Screen-Off Measured</div>
                    <div className="font-mono-tech text-base font-bold text-[#EAF4FF] mt-0.5">
                      {formatDurationMs(todaySummary.screenOffMs)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                    <div className="text-[11px] text-[#8496B5]">Unlocks / Sessions</div>
                    <div className="font-mono-tech text-base font-bold text-[#EAF4FF] mt-0.5">
                      {todaySummary.unlocksCount} / {todaySummary.screenSessionsCount}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                    <div className="text-[11px] text-[#8496B5]">First Unlock</div>
                    <div className="font-mono-tech text-sm font-semibold text-[#EAF4FF] mt-0.5">
                      {formatTimeShort(todaySummary.firstUnlockAt, use24h)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                    <div className="text-[11px] text-[#8496B5]">Last Screen-Off</div>
                    <div className="font-mono-tech text-sm font-semibold text-[#EAF4FF] mt-0.5">
                      {formatTimeShort(todaySummary.lastScreenOffAt, use24h)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-[#0D1932] border border-[#1677E8]/20">
                    <div className="text-[11px] text-[#8496B5]">Active Windows</div>
                    <div className="font-mono-tech text-sm font-semibold text-[#8B4DCE] mt-0.5">
                      {screenSessionsToday.length} logged
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 p-3 rounded bg-[#050A17] border border-[#1677E8]/20">
                  <div className="flex items-center justify-between text-[11px] text-[#8496B5] mb-1.5">
                    <span>24-Hour Activity Distribution</span>
                    <span className="font-mono-tech text-[#00DFFF]">Live</span>
                  </div>
                  <BarChartSvg items={hourlyBars} height={92} />
                </div>
              </div>
            </HexCard>
          </section>
        );
      }

      case 'ram_monitor': {
        const ram = hardware?.ram;
        const pct = ram?.usagePercent ?? 0;
        return (
          <section key={moduleId} className="lg:col-span-4">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-[#00DFFF]" />
                    <h2 className="font-display text-xs font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                      RAM MONITOR
                    </h2>
                  </div>
                  <span className="font-mono-tech text-sm font-bold text-[#00DFFF]">
                    {ram ? `${pct}%` : '—'}
                  </span>
                </div>

                <div className="mt-3">
                  <NeonProgressBar percent={pct} accent="cyan" height={8} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3.5 text-xs">
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Total</div>
                    <div className="font-mono-tech font-semibold text-[#EAF4FF] mt-0.5">
                      {ram ? formatBytes(ram.totalBytes) : 'Reading...'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Used</div>
                    <div className="font-mono-tech font-semibold text-[#00DFFF] mt-0.5">
                      {ram ? formatBytes(ram.usedBytes) : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Available</div>
                    <div className="font-mono-tech font-semibold text-[#34D399] mt-0.5">
                      {ram ? formatBytes(ram.availableBytes) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#1677E8]/15 flex items-center justify-between text-[10px] text-[#8496B5] font-mono-tech">
                <span>Source: {ram?.source || 'ActivityManager.MemoryInfo'}</span>
                <span>Live</span>
              </div>
            </HexCard>
          </section>
        );
      }

      case 'rom_monitor': {
        const storage = hardware?.storage;
        const pct = storage?.usagePercent ?? 0;
        return (
          <section key={moduleId} className="lg:col-span-4">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-[#1677E8]" />
                    <h2 className="font-display text-xs font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                      ROM / STORAGE
                    </h2>
                  </div>
                  <span className="font-mono-tech text-sm font-bold text-[#1677E8]">
                    {storage ? `${pct}%` : '—'}
                  </span>
                </div>

                <div className="mt-3">
                  <NeonProgressBar percent={pct} accent="blue" height={8} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3.5 text-xs">
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Total</div>
                    <div className="font-mono-tech font-semibold text-[#EAF4FF] mt-0.5">
                      {storage ? formatBytes(storage.totalBytes) : 'Unavailable'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Used</div>
                    <div className="font-mono-tech font-semibold text-[#1677E8] mt-0.5">
                      {storage ? formatBytes(storage.usedBytes) : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Free</div>
                    <div className="font-mono-tech font-semibold text-[#34D399] mt-0.5">
                      {storage ? formatBytes(storage.availableBytes) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#1677E8]/15 flex items-center justify-between text-[10px] text-[#8496B5] font-mono-tech">
                <span>Source: {storage?.source || 'StatFs'}</span>
                <span>Mount: {storage?.mountPoint || '/'}</span>
              </div>
            </HexCard>
          </section>
        );
      }

      case 'cpu_monitor': {
        const cpu = hardware?.cpu;
        const cpuPct = cpu?.usagePercent;
        return (
          <section key={moduleId} className="lg:col-span-4">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#8B4DCE]" />
                    <h2 className="font-display text-xs font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                      CPU MONITOR
                    </h2>
                  </div>
                  <span className="font-mono-tech text-sm font-bold text-[#00DFFF]">
                    {cpuPct !== null && cpuPct !== undefined ? `${cpuPct}%` : 'Sampling...'}
                  </span>
                </div>

                <div className="mt-2.5 p-2 rounded bg-[#050A17] border border-[#8B4DCE]/25">
                  <SparklineGraph
                    values={cpuHistory}
                    maxVal={100}
                    height={52}
                    strokeColor="#8B4DCE"
                    fillId="cpuSparkGrad"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2.5 text-xs">
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Cores</div>
                    <div className="font-mono-tech font-semibold text-[#EAF4FF]">
                      {cpu?.cores ?? navigator.hardwareConcurrency ?? '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Arch</div>
                    <div className="font-mono-tech font-semibold text-[#EAF4FF] truncate">
                      {cpu?.architecture || '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Load (1m)</div>
                    <div className="font-mono-tech font-semibold text-[#00DFFF]">
                      {cpu ? cpu.loadAverage.oneMin.toFixed(2) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#1677E8]/15 text-[10px] text-[#8496B5] font-mono-tech truncate">
                {cpu?.model || 'Reading processor information...'}
              </div>
            </HexCard>
          </section>
        );
      }

      case 'battery_power': {
        return (
          <section key={moduleId} className="lg:col-span-6">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BatteryCharging className="w-4 h-4 text-[#00DFFF]" />
                    <h2 className="font-display text-xs sm:text-sm font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                      POWER INTELLIGENCE
                    </h2>
                  </div>
                  <span className="font-mono-tech text-xs px-2 py-0.5 rounded bg-[#0D1932] border border-[#00DFFF]/30 text-[#00DFFF]">
                    CHARGING SESSIONS TODAY: {chargingSessionsToday.length}
                  </span>
                </div>

                {!battery.supported ? (
                  <div className="mt-3 p-3 rounded-lg bg-[#0D1932] border border-[#8496B5]/25 text-xs text-[#8496B5]">
                    Battery status API is restricted or unavailable in this browser environment. Connect the HEXA Android Bridge to inspect live cell temperature, health, and voltage.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-display text-2xl font-bold text-[#EAF4FF] tabular-nums">
                          {battery.levelPercent !== null ? `${battery.levelPercent}%` : '—'}
                        </div>
                        <div className="text-xs text-[#8496B5] mt-0.5">
                          Status:{' '}
                          <span className={battery.isCharging ? 'text-[#34D399] font-semibold' : 'text-[#EAF4FF]'}>
                            {battery.isCharging ? 'Charging Connected' : 'Discharging'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono-tech text-xs text-[#8496B5] space-y-0.5">
                        <div>
                          Temp:{' '}
                          <span className="text-[#EAF4FF]">
                            {battery.temperatureCelsius !== null ? `${battery.temperatureCelsius}°C` : 'Android only'}
                          </span>
                        </div>
                        <div>
                          Health:{' '}
                          <span className="text-[#EAF4FF]">
                            {battery.health || 'Android only'}
                          </span>
                        </div>
                        <div>
                          Tech:{' '}
                          <span className="text-[#EAF4FF]">
                            {battery.technology || 'Li-ion'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <NeonProgressBar
                      percent={battery.levelPercent ?? 0}
                      accent={battery.isCharging ? 'cyan' : 'purple'}
                      height={8}
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Last Started</div>
                    <div className="font-mono-tech text-[#EAF4FF] mt-0.5">
                      {lastStartedCharging ? formatTimeShort(lastStartedCharging.startTime, use24h) : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Last Ended</div>
                    <div className="font-mono-tech text-[#EAF4FF] mt-0.5">
                      {lastCompletedCharging?.endTime
                        ? formatTimeShort(lastCompletedCharging.endTime, use24h)
                        : activeChargingSession
                        ? 'Active'
                        : '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-[#0D1932]">
                    <div className="text-[10px] text-[#8496B5]">Current Charge</div>
                    <div className="font-mono-tech text-[#00DFFF] mt-0.5">
                      {activeChargingSession
                        ? formatDurationMs(nowTick - activeChargingSession.startTime)
                        : '0m'}
                    </div>
                  </div>
                </div>
              </div>

              {chargingSessionsToday.length > 0 && !isCompact && (
                <div className="mt-3 pt-2.5 border-t border-[#1677E8]/15 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#8496B5]">
                    Charging History Timeline Today
                  </div>
                  {chargingSessionsToday.slice(0, 3).map((cs) => (
                    <div
                      key={cs.id}
                      className="flex items-center justify-between text-[11px] font-mono-tech text-[#EAF4FF]/90"
                    >
                      <span className="flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-[#00DFFF]" />
                        {formatTimeShort(cs.startTime, use24h)} →{' '}
                        {cs.endTime ? formatTimeShort(cs.endTime, use24h) : 'Charging'}
                      </span>
                      <span className="text-[#8496B5]">
                        {cs.startLevel ?? '?'}% → {cs.endLevel ?? battery.levelPercent ?? '?'}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </HexCard>
          </section>
        );
      }

      case 'alarm_clock': {
        return (
          <section key={moduleId} className="lg:col-span-6">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlarmClock className="w-4 h-4 text-[#B93DBD]" />
                    <h2 className="font-display text-xs sm:text-sm font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                      ALARM & TIME INTELLIGENCE
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlarmModalOpen(true)}
                    className="text-xs font-medium text-[#00DFFF] hover:underline flex items-center gap-1"
                  >
                    Manage
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                {nextAlarmInfo ? (
                  <div className="mt-3 p-3.5 rounded-lg bg-[#0D1932] border border-[#8B4DCE]/35 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-[#8496B5]">{nextAlarmInfo.alarm.label}</div>
                      <div className="font-display text-2xl font-bold text-[#EAF4FF] mt-0.5 tabular-nums">
                        {formatTimeShort(nextAlarmInfo.triggerAt, use24h)}
                      </div>
                      <div className="font-mono-tech text-xs text-[#00DFFF] mt-1">
                        In {alarmRemainingText}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded bg-[#00DFFF]/15 border border-[#00DFFF]/40 font-mono-tech text-[10px] text-[#00DFFF] uppercase">
                        Armed
                      </span>
                      <div className="text-[10px] text-[#8496B5] mt-1.5">
                        {alarms.filter((a) => a.enabled).length} active total
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 p-3.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[#EAF4FF]">No Next Alarm Scheduled</div>
                      <div className="text-xs text-[#8496B5] mt-0.5">
                        Android <span className="font-mono-tech">AlarmManager.getNextAlarmClock()</span> is unavailable for third-party alarms in browser mode.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlarmModalOpen(true)}
                      className="px-3 py-2 rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] shrink-0 transition-colors"
                    >
                      Set Alarm
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-[#1677E8]/15 flex items-center justify-between text-[11px] text-[#8496B5]">
                <span>Local HEXA Clock Engine</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.HexaAndroidBridge?.openDefaultClockApp) {
                      window.HexaAndroidBridge.openDefaultClockApp();
                    } else {
                      setAlarmModalOpen(true);
                    }
                  }}
                  className="text-[#00DFFF] hover:underline font-medium"
                >
                  Open Clock Shortcut →
                </button>
              </div>
            </HexCard>
          </section>
        );
      }

      case 'app_usage': {
        return (
          <section key={moduleId} className="lg:col-span-6">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 h-full"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#00DFFF]" />
                  <h2 className="font-display text-xs sm:text-sm font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                    APPLICATION INTELLIGENCE
                  </h2>
                </div>
                <span className="font-mono-tech text-[11px] text-[#8496B5]">
                  {sortedApps.length} apps today
                </span>
              </div>

              {sortedApps.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 text-xs text-[#8496B5]">
                  No application sessions recorded yet today. Switching HEXA tabs or connecting Android UsageStats will populate sorted usage analytics.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sortedApps.slice(0, 5).map((app, index) => {
                    const sharePct =
                      totalTrackedAppMs > 0
                        ? Math.round((app.totalDurationMs / totalTrackedAppMs) * 100)
                        : 0;
                    const isTop = index === 0;
                    return (
                      <HexCard
                        key={app.packageName}
                        variant="inner"
                        chamferSize={10}
                        accent={isTop ? 'cyan' : 'blue'}
                        borderGlowIntensity={isTop ? 90 : 50}
                        neonGlowIntensity={isTop ? 55 : 20}
                        onClick={() => setSelectedApp(app)}
                        ariaLabel={`Inspect usage details for ${app.appName}`}
                        innerClassName="p-3 hover:bg-[#112040] transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-display text-xs font-bold shrink-0 ${
                                isTop
                                  ? 'bg-[#00DFFF]/20 text-[#00DFFF] border border-[#00DFFF]/50'
                                  : 'bg-[#050A17] text-[#8496B5] border border-[#1677E8]/30'
                              }`}
                            >
                              {app.appName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[#EAF4FF] truncate">
                                  {app.appName}
                                </span>
                                {isTop && (
                                  <span className="font-mono-tech text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00DFFF]/15 text-[#00DFFF]">
                                    TOP USED
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#8496B5] font-mono-tech">
                                {app.sessionsCount} sessions · {app.notificationsCount} alerts · Last {formatTimeShort(app.lastUsedAt, use24h)}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono-tech text-xs font-bold text-[#00DFFF]">
                              {formatDurationMs(app.totalDurationMs)}
                            </div>
                            <div className="font-mono-tech text-[10px] text-[#8496B5]">
                              {sharePct}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <NeonProgressBar
                            percent={sharePct}
                            accent={isTop ? 'cyan' : 'purple'}
                            height={5}
                          />
                        </div>
                      </HexCard>
                    );
                  })}
                </div>
              )}
            </HexCard>
          </section>
        );
      }

      case 'recent_notifications': {
        return (
          <section key={moduleId} className="lg:col-span-6">
            {/* Preserves the exact NEXUS Recent Notifications outer container & inner notification cards */}
            <HexCard
              variant="outer"
              chamferSize={16}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 sm:p-5 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#00DFFF]" />
                    <h2 className="text-base font-semibold text-[#EAF4FF]">
                      Recent Notifications
                    </h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onTriggerTestNotification}
                      className="text-[11px] font-mono-tech text-[#8496B5] hover:text-[#00DFFF] transition-colors"
                    >
                      + Test Alert
                    </button>
                    <button
                      type="button"
                      onClick={onViewAllNotifications}
                      className="flex items-center gap-1 text-xs font-semibold tracking-wider text-[#00DFFF] hover:text-[#EAF4FF] transition-colors whitespace-nowrap"
                    >
                      VIEW ALL
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {latestNotifications.length === 0 ? (
                  <div className="p-5 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 text-center">
                    <p className="text-sm text-[#EAF4FF] font-medium">
                      Notification stream ready
                    </p>
                    <p className="text-xs text-[#8496B5] mt-1">
                      Incoming local alerts, task reminders, and Android Listener notifications will appear here.
                    </p>
                    <button
                      type="button"
                      onClick={onTriggerTestNotification}
                      className="mt-3 px-4 py-2 rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] transition-colors"
                    >
                      Dispatch Local Alert
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {latestNotifications.map((notif) => (
                      <HexCard
                        key={notif.id}
                        variant="inner"
                        chamferSize={10}
                        accent="blue"
                        borderGlowIntensity={notif.read ? 40 : 75}
                        neonGlowIntensity={notif.read ? 15 : 40}
                        onClick={() => onMarkNotificationRead(notif.id)}
                        innerClassName="p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#050A17] border border-[#00DFFF]/30 flex items-center justify-center font-display text-xs font-bold text-[#00DFFF] shrink-0">
                            {notif.appName.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-[#00DFFF] truncate">
                                  {notif.appName}
                                </span>
                                <span className="font-mono-tech text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#8B4DCE]/20 border border-[#8B4DCE]/45 text-[#EAF4FF]/90 shrink-0">
                                  {notif.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono-tech text-[11px] text-[#8496B5]">
                                  {formatTimeShort(notif.receivedAt, use24h)}
                                </span>
                                {!notif.read && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-[#EF4444] shadow-[0_0_6px_#EF4444]"
                                    aria-label="Unread notification"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="text-sm font-semibold text-[#EAF4FF] truncate mt-0.5">
                              {notif.title}
                            </div>
                            <p className="text-xs text-[#8496B5] line-clamp-2 mt-0.5">
                              {notif.body || 'No notification body text provided'}
                            </p>

                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                {notif.dismissed ? (
                                  <span className="font-mono-tech text-[10px] uppercase px-1.5 py-0.5 rounded bg-[#050A17] border border-[#8496B5]/35 text-[#8496B5]">
                                    DISMISSED
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDismissNotification(notif.id);
                                    }}
                                    className="font-mono-tech text-[10px] uppercase text-[#8496B5] hover:text-[#00DFFF]"
                                  >
                                    Dismiss
                                  </button>
                                )}
                              </div>
                              <span className="font-mono-tech text-[10px] text-[#8496B5]">
                                {formatRelativeTime(notif.receivedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </HexCard>
                    ))}
                  </div>
                )}
              </div>
            </HexCard>
          </section>
        );
      }

      case 'hexa_tasks': {
        return (
          <section key={moduleId} className="lg:col-span-12">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={borderGlowIntensity}
              neonGlowIntensity={neonGlowIntensity}
              innerClassName="p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00DFFF]" />
                  <h2 className="font-display text-xs sm:text-sm font-bold tracking-[0.12em] uppercase text-[#EAF4FF]">
                    HEXA TASKS
                  </h2>
                  <span className="font-mono-tech text-xs text-[#8496B5]">
                    {pendingTasks.length} pending · {completedTasks.length} completed
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleFloatingPopup}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                      settings.tasks.floatingPopupEnabled
                        ? 'bg-[#00DFFF]/15 border-[#00DFFF]/50 text-[#00DFFF]'
                        : 'bg-[#0D1932] border-[#1677E8]/30 text-[#8496B5] hover:text-[#EAF4FF]'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {settings.tasks.floatingPopupEnabled ? 'Floating Popup On' : 'Enable Floating Popup'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(null);
                      setTaskModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Task
                  </button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 text-center text-xs text-[#8496B5]">
                  No tasks created yet. Add a pending task to track reminders or pin it to the Floating Task Popup.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[...pendingTasks, ...completedTasks].map((task) => {
                    const pStyle = PRIORITY_STYLE[task.priority];
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg bg-[#0D1932] border transition-colors flex items-start justify-between gap-3 ${
                          task.completed
                            ? 'border-[#8496B5]/15 opacity-65'
                            : 'border-[#1677E8]/30'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => onToggleTaskComplete(task.id)}
                            aria-label={`Toggle task ${task.title}`}
                            className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              task.completed
                                ? 'bg-[#00DFFF] border-[#00DFFF] text-[#030714]'
                                : 'border-[#00DFFF]/50 text-transparent hover:border-[#00DFFF]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  task.completed
                                    ? 'line-through text-[#8496B5]'
                                    : 'text-[#EAF4FF]'
                                }`}
                              >
                                {task.title}
                              </span>
                              <span
                                className={`font-mono-tech text-[9px] px-1.5 py-0.5 rounded border ${pStyle.text} ${pStyle.border}`}
                              >
                                {pStyle.label}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-xs text-[#8496B5] mt-0.5 line-clamp-1">
                                {task.description}
                              </p>
                            )}
                            {(task.dueDate || task.reminderTime) && (
                              <div className="font-mono-tech text-[10px] text-[#00DFFF] mt-1">
                                {task.dueDate && `Due ${task.dueDate}`}
                                {task.dueDate && task.reminderTime ? ' · ' : ''}
                                {task.reminderTime && `Remind ${task.reminderTime}`}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTask(task);
                              setTaskModalOpen(true);
                            }}
                            aria-label={`Edit task ${task.title}`}
                            className="p-1.5 rounded text-[#8496B5] hover:text-[#00DFFF]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            aria-label={`Delete task ${task.title}`}
                            className="p-1.5 rounded text-[#8496B5] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </HexCard>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {settings.dashboard.moduleOrder.map((id) => renderModule(id))}
      </div>

      <AppDetailModal
        app={selectedApp}
        totalScreenMs={totalTrackedAppMs}
        accent={accent}
        use24h={use24h}
        onClose={() => setSelectedApp(null)}
      />

      <TaskEditorModal
        open={taskModalOpen}
        editingTask={editingTask}
        defaultPriority={settings.tasks.defaultPriority}
        accent={accent}
        onSave={onSaveTask}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
      />

      <AlarmEditorModal
        open={alarmModalOpen}
        alarms={alarms}
        accent={accent}
        onAddAlarm={onAddAlarm}
        onToggleAlarm={onToggleAlarm}
        onDeleteAlarm={onDeleteAlarm}
        onClose={() => setAlarmModalOpen(false)}
      />
    </div>
  );
};
