import React from 'react';
import {
  BatteryCharging,
  Bell,
  Cpu,
  HardDrive,
  MemoryStick,
  Pin,
  ShieldCheck,
  Smartphone,
  Zap,
} from 'lucide-react';
import {
  BatteryStatus,
  DailyActivitySummary,
  HardwareTelemetry,
  HexaSettings,
  HexaTask,
  NavTab,
} from '../types/hexa';
import { formatBytes, formatDurationMs } from '../services/telemetry';
import { HexCard } from './HexCard';

interface HexaCoreViewProps {
  settings: HexaSettings;
  hardware: HardwareTelemetry | null;
  battery: BatteryStatus;
  todaySummary: DailyActivitySummary;
  tasks: HexaTask[];
  unreadNotificationsCount: number;
  onNavigate: (tab: NavTab) => void;
  onTriggerTestNotification: () => void;
  onToggleFloatingPopup: () => void;
}

export const HexaCoreView: React.FC<HexaCoreViewProps> = ({
  settings,
  hardware,
  battery,
  todaySummary,
  tasks,
  unreadNotificationsCount,
  onNavigate,
  onTriggerTestNotification,
  onToggleFloatingPopup,
}) => {
  const { accent, borderGlowIntensity, neonGlowIntensity, animationsEnabled } = settings.theme;
  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24 space-y-5">
      {/* Central Hexagonal HEXA Core Emblem */}
      <HexCard
        variant="outer"
        chamferSize={18}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-6 sm:p-8 flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="relative w-44 h-44 flex items-center justify-center">
          {/* Outer Rotating Hex Ring */}
          <svg
            viewBox="0 0 200 200"
            className={`w-full h-full ${animationsEnabled ? 'animate-[spin_24s_linear_infinite]' : ''}`}
          >
            <defs>
              <linearGradient id="coreHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00DFFF" />
                <stop offset="45%" stopColor="#1677E8" />
                <stop offset="75%" stopColor="#8B4DCE" />
                <stop offset="100%" stopColor="#B93DBD" />
              </linearGradient>
            </defs>
            <polygon
              points="100,8 180,54 180,146 100,192 20,146 20,54"
              fill="none"
              stroke="url(#coreHexGrad)"
              strokeWidth="2.5"
              strokeDasharray="10 6"
            />
            <polygon
              points="100,24 166,62 166,138 100,176 34,138 34,62"
              fill="rgba(13, 25, 50, 0.72)"
              stroke="#00DFFF"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
          </svg>

          {/* Center Core Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono-tech text-[10px] tracking-[0.2em] text-[#00DFFF]">
              HEXA CORE
            </span>
            <span
              className="font-display text-2xl font-bold text-[#EAF4FF] mt-1"
              style={{ textShadow: '0 0 16px rgba(0,223,255,0.45)' }}
            >
              {hardware?.cpu.usagePercent !== null && hardware?.cpu.usagePercent !== undefined
                ? `${hardware.cpu.usagePercent}%`
                : 'READY'}
            </span>
            <span className="font-mono-tech text-[10px] text-[#8496B5] mt-0.5">
              CPU LOAD
            </span>
          </div>
        </div>

        <h2 className="font-display text-lg font-bold tracking-[0.16em] text-[#EAF4FF] mt-2">
          PERSONAL INTELLIGENCE CORE
        </h2>
        <p className="text-xs text-[#8496B5] max-w-lg mt-1">
          Central telemetry hub combining hardware sensors, screen activity, power sessions, notification archives, and pending tasks.
        </p>

        {/* Quick Core Actions */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] transition-colors"
          >
            Open Command Center
          </button>
          <button
            type="button"
            onClick={onTriggerTestNotification}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-[#0D1932] border border-[#00DFFF]/35 text-xs font-medium text-[#00DFFF] hover:bg-[#00DFFF]/15 flex items-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            Test Local Alert
          </button>
          <button
            type="button"
            onClick={onToggleFloatingPopup}
            className={`px-4 py-2 min-h-[40px] rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
              settings.tasks.floatingPopupEnabled
                ? 'bg-[#8B4DCE]/25 border-[#8B4DCE] text-[#EAF4FF]'
                : 'bg-[#0D1932] border-[#1677E8]/35 text-[#8496B5] hover:text-[#EAF4FF]'
            }`}
          >
            <Pin className="w-3.5 h-3.5 text-[#00DFFF]" />
            {settings.tasks.floatingPopupEnabled ? 'Disable Task Overlay' : 'Enable Task Overlay'}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="px-4 py-2 min-h-[40px] rounded-lg bg-[#0D1932] border border-[#1677E8]/35 text-xs font-medium text-[#EAF4FF] hover:border-[#00DFFF] flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#00DFFF]" />
            Permissions & Settings
          </button>
        </div>
      </HexCard>

      {/* Core Quick Telemetry Matrix */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <HexCard variant="inner" chamferSize={12} accent={accent} innerClassName="p-3.5">
          <div className="flex items-center justify-between text-[#8496B5] text-[11px]">
            <span>RAM USED</span>
            <MemoryStick className="w-4 h-4 text-[#00DFFF]" />
          </div>
          <div className="font-display text-xl font-bold text-[#EAF4FF] mt-2 tabular-nums">
            {hardware ? `${hardware.ram.usagePercent}%` : '—'}
          </div>
          <div className="font-mono-tech text-[10px] text-[#8496B5] mt-1">
            {hardware ? formatBytes(hardware.ram.usedBytes) : 'Sampling'}
          </div>
        </HexCard>

        <HexCard variant="inner" chamferSize={12} accent={accent} innerClassName="p-3.5">
          <div className="flex items-center justify-between text-[#8496B5] text-[11px]">
            <span>STORAGE</span>
            <HardDrive className="w-4 h-4 text-[#1677E8]" />
          </div>
          <div className="font-display text-xl font-bold text-[#EAF4FF] mt-2 tabular-nums">
            {hardware?.storage ? `${hardware.storage.usagePercent}%` : '—'}
          </div>
          <div className="font-mono-tech text-[10px] text-[#8496B5] mt-1">
            {hardware?.storage ? formatBytes(hardware.storage.availableBytes) + ' free' : 'Unavailable'}
          </div>
        </HexCard>

        <HexCard variant="inner" chamferSize={12} accent={accent} innerClassName="p-3.5">
          <div className="flex items-center justify-between text-[#8496B5] text-[11px]">
            <span>CORES</span>
            <Cpu className="w-4 h-4 text-[#8B4DCE]" />
          </div>
          <div className="font-display text-xl font-bold text-[#EAF4FF] mt-2 tabular-nums">
            {hardware?.cpu.cores ?? navigator.hardwareConcurrency}
          </div>
          <div className="font-mono-tech text-[10px] text-[#8496B5] mt-1">
            {hardware?.cpu.architecture || 'x64/arm'}
          </div>
        </HexCard>

        <HexCard variant="inner" chamferSize={12} accent={accent} innerClassName="p-3.5">
          <div className="flex items-center justify-between text-[#8496B5] text-[11px]">
            <span>BATTERY</span>
            <BatteryCharging className="w-4 h-4 text-[#00DFFF]" />
          </div>
          <div className="font-display text-xl font-bold text-[#EAF4FF] mt-2 tabular-nums">
            {battery.supported && battery.levelPercent !== null
              ? `${battery.levelPercent}%`
              : 'N/A'}
          </div>
          <div className="font-mono-tech text-[10px] text-[#8496B5] mt-1">
            {battery.supported ? (battery.isCharging ? 'Charging' : 'On Battery') : 'Browser restricted'}
          </div>
        </HexCard>

        <HexCard variant="inner" chamferSize={12} accent={accent} innerClassName="p-3.5">
          <div className="flex items-center justify-between text-[#8496B5] text-[11px]">
            <span>SCREEN ON</span>
            <Smartphone className="w-4 h-4 text-[#00DFFF]" />
          </div>
          <div className="font-display text-xl font-bold text-[#00DFFF] mt-2 tabular-nums">
            {formatDurationMs(todaySummary.screenOnMs)}
          </div>
          <div className="font-mono-tech text-[10px] text-[#8496B5] mt-1">
            {todaySummary.unlocksCount} unlocks
          </div>
        </HexCard>

        <HexCard variant="inner" chamferSize={12} accent={accent} innerClassName="p-3.5">
          <div className="flex items-center justify-between text-[#8496B5] text-[11px]">
            <span>QUEUE</span>
            <Zap className="w-4 h-4 text-[#B93DBD]" />
          </div>
          <div className="font-display text-xl font-bold text-[#EAF4FF] mt-2 tabular-nums">
            {pendingCount} / {unreadNotificationsCount}
          </div>
          <div className="font-mono-tech text-[10px] text-[#8496B5] mt-1">
            Tasks / Unread
          </div>
        </HexCard>
      </div>
    </div>
  );
};
