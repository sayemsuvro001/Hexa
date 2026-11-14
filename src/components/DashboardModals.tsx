import React, { useState } from 'react';
import { Bell, Clock, Layers, Plus, Trash2, X } from 'lucide-react';
import {
  AccentTheme,
  AlarmRecord,
  AppUsageRecord,
  HexaTask,
  TaskPriority,
} from '../types/hexa';
import { formatDurationMs, formatTimeShort } from '../services/telemetry';
import { HexCard } from './HexCard';
import { BarChartSvg } from './CyberCharts';

interface AppDetailModalProps {
  app: AppUsageRecord | null;
  totalScreenMs: number;
  accent: AccentTheme;
  use24h: boolean;
  onClose: () => void;
}

export const AppDetailModal: React.FC<AppDetailModalProps> = ({
  app,
  totalScreenMs,
  accent,
  use24h,
  onClose,
}) => {
  if (!app) return null;

  const pct =
    totalScreenMs > 0
      ? Math.round((app.totalDurationMs / totalScreenMs) * 1000) / 10
      : 0;

  const hourlyData = app.hourlyBucketsMs.map((ms, h) => ({
    label: h % 4 === 0 ? `${h}h` : '',
    value: Math.round(ms / 1000),
  }));

  const sortedEvents = [...app.events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#030714]/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <HexCard
          variant="outer"
          chamferSize={14}
          accent={accent}
          borderGlowIntensity={85}
          neonGlowIntensity={75}
          innerClassName="p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono-tech text-[11px] uppercase tracking-[0.12em] text-[#00DFFF]">
                Application Intelligence
              </p>
              <h2 className="font-display text-lg font-bold text-[#EAF4FF] mt-0.5">
                {app.appName}
              </h2>
              <p className="font-mono-tech text-xs text-[#8496B5]">{app.packageName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close app details"
              className="w-9 h-9 rounded-lg bg-[#0D1932] flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            <div className="p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/25">
              <div className="text-[11px] text-[#8496B5]">Usage</div>
              <div className="font-mono-tech text-sm font-bold text-[#00DFFF] mt-0.5">
                {formatDurationMs(app.totalDurationMs)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/25">
              <div className="text-[11px] text-[#8496B5]">Share</div>
              <div className="font-mono-tech text-sm font-bold text-[#EAF4FF] mt-0.5">
                {pct}%
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/25">
              <div className="text-[11px] text-[#8496B5]">Sessions</div>
              <div className="font-mono-tech text-sm font-bold text-[#EAF4FF] mt-0.5">
                {app.sessionsCount}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/25">
              <div className="text-[11px] text-[#8496B5]">Alerts</div>
              <div className="font-mono-tech text-sm font-bold text-[#B93DBD] mt-0.5">
                {app.notificationsCount}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-[#050A17] border border-[#1677E8]/20">
            <div className="flex items-center justify-between text-xs text-[#8496B5] mb-2">
              <span>Hourly Usage Activity (seconds)</span>
              <span className="font-mono-tech">
                Last active: {formatTimeShort(app.lastUsedAt, use24h)}
              </span>
            </div>
            <BarChartSvg items={hourlyData} height={96} />
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8496B5] mb-2">
              Timestamped Usage & Notification Timeline
            </h3>
            {sortedEvents.length === 0 ? (
              <p className="text-xs text-[#8496B5] py-3">
                No timestamped session or notification events recorded yet for this app today.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {sortedEvents.slice(0, 20).map((ev, idx) => (
                  <div
                    key={`${ev.timestamp}-${idx}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded bg-[#0D1932]/80 border border-[#1677E8]/20 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {ev.type === 'notification' ? (
                        <Bell className="w-3.5 h-3.5 text-[#B93DBD] shrink-0" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-[#00DFFF] shrink-0" />
                      )}
                      <span className="text-[#EAF4FF] truncate">{ev.label}</span>
                    </div>
                    <div className="font-mono-tech text-[11px] text-[#8496B5] shrink-0">
                      {formatTimeShort(ev.timestamp, use24h)}
                      {ev.durationMs ? ` · ${formatDurationMs(ev.durationMs)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </HexCard>
      </div>
    </div>
  );
};

interface TaskEditorModalProps {
  open: boolean;
  editingTask: HexaTask | null;
  defaultPriority: TaskPriority;
  accent: AccentTheme;
  onSave: (task: Omit<HexaTask, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'remindedForKey'> & { id?: string }) => void;
  onClose: () => void;
}

export const TaskEditorModal: React.FC<TaskEditorModalProps> = ({
  open,
  editingTask,
  defaultPriority,
  accent,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(editingTask?.title || '');
  const [description, setDescription] = useState(editingTask?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(
    editingTask?.priority || defaultPriority
  );
  const [dueDate, setDueDate] = useState(editingTask?.dueDate || '');
  const [reminderTime, setReminderTime] = useState(editingTask?.reminderTime || '');

  React.useEffect(() => {
    if (open) {
      setTitle(editingTask?.title || '');
      setDescription(editingTask?.description || '');
      setPriority(editingTask?.priority || defaultPriority);
      setDueDate(editingTask?.dueDate || '');
      setReminderTime(editingTask?.reminderTime || '');
    }
  }, [open, editingTask, defaultPriority]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      id: editingTask?.id,
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate,
      reminderTime,
      completed: editingTask?.completed ?? false,
    });
    onClose();
  };

  return (
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
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#EAF4FF]">
              {editingTask ? 'Edit HEXA Task' : 'New HEXA Task'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close task editor"
              className="w-8 h-8 rounded flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-xs text-[#8496B5] mb-1">Task Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Audit security camera alerts"
                className="w-full px-3 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-sm text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#8496B5] mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional task notes..."
                className="w-full px-3 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-sm text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-[#8496B5] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-2.5 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-xs text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#8496B5] mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-xs text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8496B5] mb-1">Reminder</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-2 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-xs text-[#EAF4FF] focus:outline-none focus:border-[#00DFFF]"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-[#8496B5]/30 text-xs text-[#8496B5] hover:text-[#EAF4FF]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] transition-colors"
              >
                {editingTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </form>
        </HexCard>
      </div>
    </div>
  );
};

interface AlarmEditorModalProps {
  open: boolean;
  alarms: AlarmRecord[];
  accent: AccentTheme;
  onAddAlarm: (label: string, time24: string) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onClose: () => void;
}

export const AlarmEditorModal: React.FC<AlarmEditorModalProps> = ({
  open,
  alarms,
  accent,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm,
  onClose,
}) => {
  const [label, setLabel] = useState('Morning Brief');
  const [time24, setTime24] = useState('07:00');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time24) return;
    onAddAlarm(label.trim() || 'HEXA Alarm', time24);
  };

  return (
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00DFFF]" />
              <h2 className="font-display text-base font-bold text-[#EAF4FF]">
                HEXA Scheduled Alarms
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close alarms manager"
              className="w-8 h-8 rounded flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] text-[#8496B5] mb-1">Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-xs text-[#EAF4FF]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#8496B5] mb-1">Time</label>
              <input
                type="time"
                value={time24}
                onChange={(e) => setTime24(e.target.value)}
                className="px-2.5 py-2 rounded-lg bg-[#050A17] border border-[#1677E8]/35 text-xs text-[#EAF4FF]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-[#1677E8] hover:bg-[#00DFFF] hover:text-[#030714] text-xs font-semibold text-[#EAF4FF] flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </form>

          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
            {alarms.length === 0 ? (
              <p className="text-xs text-[#8496B5] py-3 text-center">
                No local alarms scheduled yet.
              </p>
            ) : (
              alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D1932] border border-[#1677E8]/25"
                >
                  <div>
                    <div className="font-display text-sm font-bold text-[#EAF4FF] tabular-nums">
                      {alarm.time24}
                    </div>
                    <div className="text-xs text-[#8496B5]">{alarm.label}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleAlarm(alarm.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                        alarm.enabled
                          ? 'bg-[#00DFFF]/20 text-[#00DFFF] border border-[#00DFFF]/40'
                          : 'bg-[#050A17] text-[#8496B5] border border-[#8496B5]/30'
                      }`}
                    >
                      {alarm.enabled ? 'Armed' : 'Off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAlarm(alarm.id)}
                      aria-label={`Delete alarm ${alarm.label}`}
                      className="p-1.5 text-[#8496B5] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </HexCard>
      </div>
    </div>
  );
};
