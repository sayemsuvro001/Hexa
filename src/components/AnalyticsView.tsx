import React, { useMemo, useState } from 'react';
import { BarChart2, Cpu, Layers, MemoryStick, Smartphone } from 'lucide-react';
import {
  AppUsageRecord,
  DailyActivitySummary,
  getDateKey,
  HardwareTelemetry,
  HexaSettings,
} from '../types/hexa';
import { formatBytes, formatDurationMs, formatTimeShort } from '../services/telemetry';
import { HexCard } from './HexCard';
import { BarChartSvg, NeonProgressBar, SparklineGraph } from './CyberCharts';
import { AppDetailModal } from './DashboardModals';

interface AnalyticsViewProps {
  settings: HexaSettings;
  todaySummary: DailyActivitySummary;
  allDailySummaries: DailyActivitySummary[];
  appUsageToday: AppUsageRecord[];
  hardware: HardwareTelemetry | null;
  cpuHistory: number[];
  ramHistory: number[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  settings,
  todaySummary,
  allDailySummaries,
  appUsageToday,
  hardware,
  cpuHistory,
  ramHistory,
}) => {
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedApp, setSelectedApp] = useState<AppUsageRecord | null>(null);

  const { accent, borderGlowIntensity, neonGlowIntensity } = settings.theme;
  const use24h = settings.dashboard.clock24Hour;

  const summaryByDate = useMemo(() => {
    const map = new Map<string, DailyActivitySummary>();
    for (const s of allDailySummaries) {
      map.set(s.dateKey, s);
    }
    map.set(todaySummary.dateKey, todaySummary);
    return map;
  }, [allDailySummaries, todaySummary]);

  const chartData = useMemo(() => {
    if (range === 'daily') {
      return todaySummary.hourlyScreenMs.map((ms, h) => ({
        label: h % 2 === 0 ? `${h}h` : '',
        value: Math.round(ms / 60000),
      }));
    }
    const days = range === 'weekly' ? 7 : 30;
    const list: Array<{ label: string; value: number }> = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
      const ts = now - i * 86400000;
      const key = getDateKey(ts);
      const item = summaryByDate.get(key);
      const d = new Date(ts);
      const label =
        range === 'weekly'
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : i % 5 === 0
          ? `${d.getMonth() + 1}/${d.getDate()}`
          : '';
      list.push({
        label,
        value: item ? Math.round(item.screenOnMs / 60000) : 0,
      });
    }
    return list;
  }, [range, todaySummary, summaryByDate]);

  const sortedApps = [...appUsageToday].sort(
    (a, b) => b.totalDurationMs - a.totalDurationMs
  );
  const totalAppMs = sortedApps.reduce((acc, a) => acc + a.totalDurationMs, 0);

  const rangeTotals = useMemo(() => {
    if (range === 'daily') return [todaySummary];
    const days = range === 'weekly' ? 7 : 30;
    const items: DailyActivitySummary[] = [];
    const now = Date.now();
    for (let i = 0; i < days; i++) {
      const key = getDateKey(now - i * 86400000);
      const found = summaryByDate.get(key);
      if (found) items.push(found);
    }
    return items;
  }, [range, todaySummary, summaryByDate]);

  const totalScreenOn = rangeTotals.reduce((acc, d) => acc + d.screenOnMs, 0);
  const totalUnlocks = rangeTotals.reduce((acc, d) => acc + d.unlocksCount, 0);
  const totalNotifications = rangeTotals.reduce((acc, d) => acc + d.notificationsCount, 0);
  const totalCharging = rangeTotals.reduce((acc, d) => acc + d.chargingSessionsCount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24 space-y-4">
      {/* Screen Time Range Selector & Chart */}
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#00DFFF]" />
            <div>
              <h2 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
                SCREEN TIME & DEVICE ANALYTICS
              </h2>
              <p className="text-xs text-[#8496B5]">
                {range === 'daily'
                  ? 'Hourly screen activity minutes today'
                  : range === 'weekly'
                  ? '7-day local screen time minutes'
                  : '30-day local screen time minutes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#050A17] border border-[#1677E8]/30">
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRange(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  range === mode
                    ? 'bg-[#0D1932] text-[#00DFFF]'
                    : 'text-[#8496B5] hover:text-[#EAF4FF]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
          <div className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
            <div className="text-[11px] text-[#8496B5]">Screen Time ({range})</div>
            <div className="font-display text-lg font-bold text-[#00DFFF] mt-0.5 tabular-nums">
              {formatDurationMs(totalScreenOn)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
            <div className="text-[11px] text-[#8496B5]">Unlocks</div>
            <div className="font-display text-lg font-bold text-[#EAF4FF] mt-0.5 tabular-nums">
              {totalUnlocks}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
            <div className="text-[11px] text-[#8496B5]">Notifications</div>
            <div className="font-display text-lg font-bold text-[#B93DBD] mt-0.5 tabular-nums">
              {totalNotifications}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/20">
            <div className="text-[11px] text-[#8496B5]">Charge Sessions</div>
            <div className="font-display text-lg font-bold text-[#1677E8] mt-0.5 tabular-nums">
              {totalCharging}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[#050A17] border border-[#1677E8]/20">
          <BarChartSvg items={chartData} height={150} />
        </div>
      </HexCard>

      {/* Hardware Telemetry Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HexCard
          variant="outer"
          chamferSize={14}
          accent={accent}
          borderGlowIntensity={borderGlowIntensity}
          neonGlowIntensity={neonGlowIntensity}
          innerClassName="p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#8B4DCE]" />
              <h3 className="font-display text-xs font-bold tracking-wider uppercase text-[#EAF4FF]">
                CPU LOAD TIMELINE
              </h3>
            </div>
            <span className="font-mono-tech text-xs text-[#00DFFF]">
              {hardware?.cpu.usagePercent !== null && hardware?.cpu.usagePercent !== undefined
                ? `${hardware.cpu.usagePercent}% current`
                : 'Sampling'}
            </span>
          </div>
          <div className="p-3 rounded bg-[#050A17] border border-[#8B4DCE]/25">
            <SparklineGraph
              values={cpuHistory}
              maxVal={100}
              height={96}
              strokeColor="#8B4DCE"
              fillId="analyticsCpuGrad"
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#8496B5] font-mono-tech">
            <span>{hardware?.cpu.cores ?? '—'} cores · {hardware?.cpu.architecture ?? '—'}</span>
            <span>
              Load: {hardware?.cpu.loadAverage.oneMin ?? 0} / {hardware?.cpu.loadAverage.fiveMin ?? 0} /{' '}
              {hardware?.cpu.loadAverage.fifteenMin ?? 0}
            </span>
          </div>
        </HexCard>

        <HexCard
          variant="outer"
          chamferSize={14}
          accent={accent}
          borderGlowIntensity={borderGlowIntensity}
          neonGlowIntensity={neonGlowIntensity}
          innerClassName="p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MemoryStick className="w-4 h-4 text-[#00DFFF]" />
              <h3 className="font-display text-xs font-bold tracking-wider uppercase text-[#EAF4FF]">
                RAM UTILIZATION TIMELINE
              </h3>
            </div>
            <span className="font-mono-tech text-xs text-[#00DFFF]">
              {hardware ? `${hardware.ram.usagePercent}% (${formatBytes(hardware.ram.usedBytes)})` : '—'}
            </span>
          </div>
          <div className="p-3 rounded bg-[#050A17] border border-[#00DFFF]/25">
            <SparklineGraph
              values={ramHistory}
              maxVal={100}
              height={96}
              strokeColor="#00DFFF"
              fillId="analyticsRamGrad"
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-xs text-[#8496B5] font-mono-tech">
            <span>Total: {hardware ? formatBytes(hardware.ram.totalBytes) : '—'}</span>
            <span>Available: {hardware ? formatBytes(hardware.ram.availableBytes) : '—'}</span>
          </div>
        </HexCard>
      </div>

      {/* Full Application Usage Analytics */}
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00DFFF]" />
            <h3 className="font-display text-sm font-bold tracking-wider uppercase text-[#EAF4FF]">
              FULL APPLICATION USAGE BREAKDOWN
            </h3>
          </div>
          <span className="font-mono-tech text-xs text-[#8496B5]">
            Tap an app for notification-to-usage timeline
          </span>
        </div>

        {sortedApps.length === 0 ? (
          <div className="p-6 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 text-center text-xs text-[#8496B5]">
            <Smartphone className="w-6 h-6 text-[#00DFFF] mx-auto mb-2 opacity-60" />
            No application usage entries recorded today yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedApps.map((app, i) => {
              const share =
                totalAppMs > 0 ? Math.round((app.totalDurationMs / totalAppMs) * 100) : 0;
              return (
                <button
                  key={app.packageName}
                  type="button"
                  onClick={() => setSelectedApp(app)}
                  className="w-full text-left p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/25 hover:border-[#00DFFF]/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-tech text-xs text-[#8496B5] w-5">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#EAF4FF] truncate">
                          {app.appName}
                        </div>
                        <div className="font-mono-tech text-[11px] text-[#8496B5]">
                          {app.sessionsCount} sessions · {app.notificationsCount} notifications · Last active{' '}
                          {formatTimeShort(app.lastUsedAt, use24h)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-tech text-sm font-bold text-[#00DFFF]">
                        {formatDurationMs(app.totalDurationMs)}
                      </div>
                      <div className="font-mono-tech text-[11px] text-[#8496B5]">
                        {share}% of total
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <NeonProgressBar
                      percent={share}
                      accent={i === 0 ? 'cyan' : 'blue'}
                      height={6}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </HexCard>

      <AppDetailModal
        app={selectedApp}
        totalScreenMs={totalAppMs}
        accent={accent}
        use24h={use24h}
        onClose={() => setSelectedApp(null)}
      />
    </div>
  );
};
