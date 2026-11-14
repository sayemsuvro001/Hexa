import React, { useMemo, useState } from 'react';
import {
  Activity,
  Bell,
  CheckCheck,
  Search,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  ChargingSessionRecord,
  HexaSettings,
  NotificationRecord,
  ScreenSessionRecord,
} from '../types/hexa';
import {
  formatDurationMs,
  formatRelativeTime,
  formatTimeShort,
} from '../services/telemetry';
import { HexCard } from './HexCard';

interface HistoryViewProps {
  settings: HexaSettings;
  notifications: NotificationRecord[];
  screenSessions: ScreenSessionRecord[];
  chargingSessions: ChargingSessionRecord[];
  onDismissNotification: (id: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearNotifications: () => void;
  onTriggerTestNotification: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  settings,
  notifications,
  screenSessions,
  chargingSessions,
  onDismissNotification,
  onMarkRead,
  onMarkAllRead,
  onClearNotifications,
  onTriggerTestNotification,
}) => {
  const [subTab, setSubTab] = useState<'notifications' | 'activity'>('notifications');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days'>('all');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [selectedNotif, setSelectedNotif] = useState<NotificationRecord | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const { accent, borderGlowIntensity, neonGlowIntensity } = settings.theme;
  const use24h = settings.dashboard.clock24Hour;

  const uniqueApps = useMemo(() => {
    const set = new Set(notifications.map((n) => n.appName));
    return Array.from(set).sort();
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekAgoMs = now - 7 * 86400000;

    return [...notifications]
      .filter((n) => {
        if (dateFilter === 'today' && n.receivedAt < todayMs) return false;
        if (dateFilter === '7days' && n.receivedAt < weekAgoMs) return false;
        if (appFilter !== 'all' && n.appName !== appFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const match =
            n.title.toLowerCase().includes(q) ||
            n.body.toLowerCase().includes(q) ||
            n.appName.toLowerCase().includes(q) ||
            n.category.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => b.receivedAt - a.receivedAt);
  }, [notifications, dateFilter, appFilter, search]);

  const combinedLogs = useMemo(() => {
    const sLogs = screenSessions.map((s) => ({
      id: s.id,
      kind: 'screen' as const,
      time: s.startTime,
      title: s.type === 'screen_on' ? 'Screen Session Active' : 'Screen Off Interval',
      detail: `Duration: ${formatDurationMs(s.durationMs)} · Trigger: ${s.trigger}`,
    }));
    const cLogs = chargingSessions.map((c) => ({
      id: c.id,
      kind: 'charging' as const,
      time: c.startTime,
      title: 'Charging Session Started',
      detail: `${c.startLevel ?? '?'}% → ${c.endLevel ?? 'Active'}% · ${formatDurationMs(c.durationMs)}`,
    }));
    return [...sLogs, ...cLogs].sort((a, b) => b.time - a.time);
  }, [screenSessions, chargingSessions]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 pb-24 space-y-4">
      <HexCard
        variant="outer"
        chamferSize={14}
        accent={accent}
        borderGlowIntensity={borderGlowIntensity}
        neonGlowIntensity={neonGlowIntensity}
        innerClassName="p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold tracking-wider text-[#EAF4FF]">
              INTELLIGENCE HISTORY
            </h2>
            <p className="text-xs text-[#8496B5]">
              Local notification archive and timestamped device activity logs
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#050A17] border border-[#1677E8]/30">
            <button
              type="button"
              onClick={() => setSubTab('notifications')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                subTab === 'notifications'
                  ? 'bg-[#0D1932] text-[#00DFFF]'
                  : 'text-[#8496B5] hover:text-[#EAF4FF]'
              }`}
            >
              Notifications ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('activity')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                subTab === 'activity'
                  ? 'bg-[#0D1932] text-[#00DFFF]'
                  : 'text-[#8496B5] hover:text-[#EAF4FF]'
              }`}
            >
              Activity Logs ({combinedLogs.length})
            </button>
          </div>
        </div>

        {subTab === 'notifications' ? (
          <div className="mt-4 space-y-3">
            {/* Search & Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-5 relative">
                <Search className="w-4 h-4 text-[#8496B5] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search title, app, category..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/30 text-xs text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
                />
              </div>

              <div className="sm:col-span-3">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | '7days')}
                  className="w-full px-3 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/30 text-xs text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="7days">Last 7 Days</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <select
                  value={appFilter}
                  onChange={(e) => setAppFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/30 text-xs text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
                >
                  <option value="all">All Applications</option>
                  {uniqueApps.map((app) => (
                    <option key={app} value={app}>
                      {app}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="font-mono-tech text-xs text-[#8496B5]">
                Showing {filteredNotifications.length} of {notifications.length} records
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTriggerTestNotification}
                  className="px-3 py-1.5 rounded-lg bg-[#0D1932] border border-[#00DFFF]/30 text-xs text-[#00DFFF] hover:bg-[#00DFFF]/15"
                >
                  + Dispatch Alert
                </button>
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="px-3 py-1.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/30 text-xs text-[#EAF4FF] hover:border-[#00DFFF] flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-[#00DFFF]" />
                  Mark All Read
                </button>
                {!confirmClear ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    disabled={notifications.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-[#0D1932] border border-red-500/30 text-xs text-red-400 hover:bg-red-500/15 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear History
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onClearNotifications();
                        setConfirmClear(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-semibold text-white"
                    >
                      Confirm Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0D1932] text-xs text-[#8496B5]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Notification List */}
            {filteredNotifications.length === 0 ? (
              <div className="p-8 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 text-center">
                <Bell className="w-6 h-6 text-[#00DFFF] mx-auto mb-2 opacity-70" />
                <p className="text-sm font-medium text-[#EAF4FF]">
                  No notifications match the current filter
                </p>
                <p className="text-xs text-[#8496B5] mt-1">
                  Adjust filters or dispatch a local HEXA alert to verify notification capture.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredNotifications.map((notif) => (
                  <HexCard
                    key={notif.id}
                    variant="inner"
                    chamferSize={10}
                    accent="blue"
                    borderGlowIntensity={notif.read ? 35 : 75}
                    neonGlowIntensity={notif.read ? 10 : 35}
                    onClick={() => {
                      onMarkRead(notif.id);
                      setSelectedNotif(notif);
                    }}
                    innerClassName="p-3.5"
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
                            <span className="font-mono-tech text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#8B4DCE]/20 border border-[#8B4DCE]/45 text-[#EAF4FF]">
                              {notif.category}
                            </span>
                            {notif.dismissed && (
                              <span className="font-mono-tech text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#050A17] border border-[#8496B5]/35 text-[#8496B5]">
                                DISMISSED
                              </span>
                            )}
                          </div>
                          <span className="font-mono-tech text-[11px] text-[#8496B5] shrink-0">
                            {new Date(notif.receivedAt).toLocaleDateString()} ·{' '}
                            {formatTimeShort(notif.receivedAt, use24h)}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-[#EAF4FF] mt-0.5">
                          {notif.title}
                        </div>
                        <p className="text-xs text-[#8496B5] mt-0.5">
                          {notif.body || 'No notification body text provided'}
                        </p>
                      </div>
                    </div>
                  </HexCard>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {combinedLogs.length === 0 ? (
              <div className="p-8 rounded-lg bg-[#0D1932] border border-[#1677E8]/20 text-center text-xs text-[#8496B5]">
                No screen or charging activity sessions recorded yet.
              </div>
            ) : (
              combinedLogs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-[#0D1932] border border-[#1677E8]/25 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {log.kind === 'charging' ? (
                      <Zap className="w-4 h-4 text-[#00DFFF] shrink-0" />
                    ) : (
                      <Activity className="w-4 h-4 text-[#8B4DCE] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#EAF4FF]">{log.title}</div>
                      <div className="font-mono-tech text-xs text-[#8496B5] truncate">
                        {log.detail}
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono-tech text-xs text-[#8496B5] shrink-0">
                    <div>{formatTimeShort(log.time, use24h)}</div>
                    <div className="text-[10px]">{formatRelativeTime(log.time)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </HexCard>

      {/* Notification Details Modal */}
      {selectedNotif && (
        <div
          className="fixed inset-0 z-50 bg-[#030714]/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md">
            <HexCard
              variant="outer"
              chamferSize={14}
              accent={accent}
              borderGlowIntensity={90}
              neonGlowIntensity={80}
              innerClassName="p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#00DFFF]">
                    {selectedNotif.appName} · {selectedNotif.category}
                  </span>
                  <h3 className="text-base font-bold text-[#EAF4FF] mt-1">
                    {selectedNotif.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  aria-label="Close notification details"
                  className="w-8 h-8 rounded flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-[#EAF4FF]/90 leading-relaxed">
                {selectedNotif.body || 'No notification body text provided.'}
              </p>
              <div className="mt-4 pt-3 border-t border-[#1677E8]/20 space-y-1 font-mono-tech text-xs text-[#8496B5]">
                <div>Package: {selectedNotif.packageName}</div>
                <div>Received: {new Date(selectedNotif.receivedAt).toLocaleString()}</div>
                <div>Source: {selectedNotif.source}</div>
                <div>Status: {selectedNotif.dismissed ? 'Dismissed' : 'Active'}</div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {!selectedNotif.dismissed && (
                  <button
                    type="button"
                    onClick={() => {
                      onDismissNotification(selectedNotif.id);
                      setSelectedNotif({ ...selectedNotif, dismissed: true });
                    }}
                    className="px-3.5 py-2 rounded-lg bg-[#0D1932] border border-[#00DFFF]/40 text-xs font-medium text-[#00DFFF]"
                  >
                    Mark Dismissed
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedNotif(null)}
                  className="px-3.5 py-2 rounded-lg bg-[#1677E8] text-xs font-semibold text-[#EAF4FF]"
                >
                  Close
                </button>
              </div>
            </HexCard>
          </div>
        </div>
      )}
    </div>
  );
};
