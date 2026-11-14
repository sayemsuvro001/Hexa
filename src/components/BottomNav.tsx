import React from 'react';
import { BarChart2, Hexagon, History, Home, Settings } from 'lucide-react';
import { AccentTheme, NavTab } from '../types/hexa';
import { HexIconButton } from './HexCard';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unreadNotificationsCount: number;
  pendingTasksCount: number;
  accent: AccentTheme;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadNotificationsCount,
  pendingTasksCount,
  accent,
}) => {
  const navBtnClass = (tab: NavTab) =>
    `relative flex flex-col items-center justify-center min-h-[44px] px-2 sm:px-4 py-1.5 rounded-xl transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#00DFFF] ${
      activeTab === tab
        ? 'bg-[#0D1932] text-[#00DFFF] shadow-[inset_0_0_12px_rgba(0,223,255,0.14)]'
        : 'text-[#8496B5] hover:text-[#EAF4FF]'
    }`;

  return (
    <nav
      aria-label="Primary Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#050A17]/95 backdrop-blur-md border-t border-[#1677E8]/25"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-5 items-center h-16 px-2">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={navBtnClass('home')}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">Home</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('history')}
          className={navBtnClass('history')}
        >
          <div className="relative">
            <History className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#B93DBD] text-[#EAF4FF] font-mono-tech text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(185,61,189,0.75)]">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium mt-0.5">History</span>
        </button>

        {/* Center Elevated Hexagonal HEXA CORE Button */}
        <div className="flex items-center justify-center -mt-4">
          <div className="relative">
            <HexIconButton
              size={56}
              accent={accent}
              elevated
              ariaLabel="HEXA Core Overview"
              onClick={() => onSelectTab('core')}
              className={activeTab === 'core' ? 'scale-105' : ''}
            >
              <div className="relative flex items-center justify-center">
                <Hexagon
                  className={`w-6 h-6 ${
                    activeTab === 'core' ? 'text-[#EAF4FF]' : 'text-[#00DFFF]'
                  }`}
                  strokeWidth={2.2}
                />
                <div className="absolute w-2 h-2 rounded-full bg-[#00DFFF] shadow-[0_0_10px_#00DFFF]" />
              </div>
            </HexIconButton>
            {pendingTasksCount > 0 && (
              <span
                title={`${pendingTasksCount} pending tasks`}
                className="pointer-events-none absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#1677E8] text-[#EAF4FF] font-mono-tech text-[9px] font-bold flex items-center justify-center"
              >
                {pendingTasksCount}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('analytics')}
          className={navBtnClass('analytics')}
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={navBtnClass('settings')}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[11px] font-medium mt-0.5">Settings</span>
        </button>
      </div>
    </nav>
  );
};
