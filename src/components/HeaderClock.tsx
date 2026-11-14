import React, { useEffect, useState } from 'react';
import { Hexagon, Settings } from 'lucide-react';
import { AccentTheme } from '../types/hexa';
import { HexCard, HexIconButton } from './HexCard';

interface HeaderClockProps {
  accent: AccentTheme;
  borderGlowIntensity: number;
  neonGlowIntensity: number;
  clock24Hour: boolean;
  clockShowSeconds: boolean;
  animationsEnabled: boolean;
  listenerActive: boolean;
  onOpenCore: () => void;
  onOpenSettings: () => void;
}

export const HeaderClock: React.FC<HeaderClockProps> = ({
  accent,
  borderGlowIntensity,
  neonGlowIntensity,
  clock24Hour,
  clockShowSeconds,
  animationsEnabled,
  listenerActive,
  onOpenCore,
  onOpenSettings,
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dateText = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeParts = (() => {
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    if (!clock24Hour) {
      hours = hours % 12 || 12;
    }
    const hh = String(hours).padStart(clock24Hour ? 2 : 1, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return { hh, mm, ss, ampm };
  })();

  return (
    <header className="w-full pt-3 pb-3 px-4 md:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Hexagonal Emblem + Brand + Subtitle + Live Listener State */}
        <div className="flex items-center gap-3 min-w-0">
          <HexIconButton
            size={48}
            accent={accent}
            ariaLabel="Open HEXA Core Overview"
            onClick={onOpenCore}
          >
            <div className="relative flex items-center justify-center">
              <Hexagon className="w-6 h-6 text-[#00DFFF]" strokeWidth={2.1} />
              <div className="absolute w-2 h-2 rounded-full bg-[#00DFFF] shadow-[0_0_8px_#00DFFF]" />
            </div>
          </HexIconButton>

          <div className="min-w-0">
            <h1
              className="font-display text-xl sm:text-2xl font-bold tracking-[0.14em] text-[#EAF4FF] leading-tight whitespace-nowrap"
              style={{
                textShadow: '0 0 14px rgba(0, 223, 255, 0.35)',
              }}
            >
              HEXA
            </h1>
            <p className="text-xs text-[#8496B5] truncate leading-snug">
              Personal Intelligence System
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  listenerActive
                    ? `bg-[#10B981] shadow-[0_0_8px_#10B981] ${animationsEnabled ? 'animate-pulse' : ''}`
                    : 'bg-[#8496B5]'
                }`}
              />
              <span
                className={`font-mono-tech text-[10px] tracking-[0.12em] uppercase ${
                  listenerActive ? 'text-[#34D399]' : 'text-[#8496B5]'
                }`}
              >
                {listenerActive ? 'LISTENER ACTIVE' : 'MONITORING PAUSED'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Futuristic Chamfered Digital Clock + Hex Settings Button */}
        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          <HexCard
            variant="outer"
            chamferSize={10}
            accent={accent}
            borderGlowIntensity={borderGlowIntensity}
            neonGlowIntensity={neonGlowIntensity}
            innerClassName="px-3.5 py-2 flex flex-col items-end justify-center min-w-[162px] sm:min-w-[186px] bg-gradient-to-br from-[#0A1328] via-[#071022] to-[#0D1932]"
          >
            <span className="font-mono-tech text-[11px] text-[#8496B5] tracking-wide whitespace-nowrap">
              {dateText}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className="font-display text-lg sm:text-xl font-bold tracking-wider text-[#00DFFF] tabular-nums whitespace-nowrap"
                style={{
                  textShadow:
                    '0 0 12px rgba(0, 223, 255, 0.55), 0 0 24px rgba(22, 119, 232, 0.35)',
                }}
              >
                {timeParts.hh}:{timeParts.mm}
                {clockShowSeconds && (
                  <span className="text-[#8B4DCE] ml-0.5 text-sm sm:text-base font-semibold">
                    :{timeParts.ss}
                  </span>
                )}
              </span>
              {!clock24Hour && (
                <span className="font-mono-tech text-xs font-semibold text-[#1677E8] lowercase">
                  {timeParts.ampm}
                </span>
              )}
            </div>
          </HexCard>

          <HexIconButton
            size={46}
            accent={accent}
            ariaLabel="Open Settings"
            onClick={onOpenSettings}
          >
            <Settings className="w-5 h-5 text-[#00DFFF]" />
          </HexIconButton>
        </div>
      </div>
    </header>
  );
};
