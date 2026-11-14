import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, Layers, X } from 'lucide-react';
import { AccentTheme, FloatingPosition, HexaTask, TaskPriority } from '../types/hexa';
import { HexCard } from './HexCard';

interface FloatingTaskPopupProps {
  tasks: HexaTask[];
  enabled: boolean;
  position: FloatingPosition;
  appearance: 'compact' | 'expanded';
  accent: AccentTheme;
  onCompleteTask: (id: string) => void;
  onDismissPopup: () => void;
  onOpenTasksSection: () => void;
}

const PRIORITY_DOT: Record<TaskPriority, { color: string; label: string }> = {
  critical: { color: '#EF4444', label: 'CRIT' },
  high: { color: '#B93DBD', label: 'HIGH' },
  medium: { color: '#00DFFF', label: 'MED' },
  low: { color: '#8496B5', label: 'LOW' },
};

const POSITION_CLASSES: Record<FloatingPosition, string> = {
  'top-left': 'top-20 left-4',
  'top-right': 'top-20 right-4',
  'bottom-left': 'bottom-20 left-4',
  'bottom-right': 'bottom-20 right-4',
};

export const FloatingTaskPopup: React.FC<FloatingTaskPopupProps> = ({
  tasks,
  enabled,
  position,
  appearance,
  accent,
  onCompleteTask,
  onDismissPopup,
  onOpenTasksSection,
}) => {
  const [minimized, setMinimized] = useState(false);

  const pendingTasks = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const rank: Record<TaskPriority, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      return rank[b.priority] - rank[a.priority];
    });

  if (!enabled || pendingTasks.length === 0) return null;

  const topTask = pendingTasks[0];
  const prio = PRIORITY_DOT[topTask.priority];

  return (
    <div
      className={`fixed z-50 ${POSITION_CLASSES[position]} max-w-[290px] w-[calc(100vw-2rem)] sm:w-[280px] pointer-events-auto`}
    >
      <HexCard
        variant="inner"
        chamferSize={10}
        accent={accent}
        borderGlowIntensity={90}
        neonGlowIntensity={85}
        innerClassName="p-3 bg-[#050A17]/95 backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenTasksSection}
            className="flex items-center gap-1.5 text-left min-w-0"
          >
            <Layers className="w-3.5 h-3.5 text-[#00DFFF] shrink-0" />
            <span className="font-mono-tech text-[10px] tracking-[0.12em] uppercase text-[#00DFFF] truncate">
              HEXA TASK OVERLAY ({pendingTasks.length})
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMinimized((m) => !m)}
              aria-label={minimized ? 'Expand task popup' : 'Minimize task popup'}
              className="w-6 h-6 rounded flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF] hover:bg-[#0A1328]"
            >
              {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onDismissPopup}
              aria-label="Hide floating task popup"
              className="w-6 h-6 rounded flex items-center justify-center text-[#8496B5] hover:text-[#EAF4FF] hover:bg-[#0A1328]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="mt-2.5 space-y-2">
            {(appearance === 'expanded' ? pendingTasks.slice(0, 3) : [topTask]).map((task) => {
              const taskPrio = PRIORITY_DOT[task.priority];
              return (
                <div
                  key={task.id}
                  className="flex items-start justify-between gap-2.5 p-2 rounded bg-[#0A1328]/90 border border-[#1677E8]/25"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: taskPrio.color,
                          boxShadow: `0 0 6px ${taskPrio.color}`,
                        }}
                      />
                      <span className="font-mono-tech text-[10px] text-[#8496B5]">
                        {taskPrio.label}
                      </span>
                      {task.reminderTime && (
                        <span className="font-mono-tech text-[10px] text-[#00DFFF] flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {task.reminderTime}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#EAF4FF] truncate mt-0.5">
                      {task.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onCompleteTask(task.id)}
                    aria-label={`Complete task ${task.title}`}
                    className="w-7 h-7 rounded bg-[#0D1932] border border-[#00DFFF]/40 flex items-center justify-center text-[#00DFFF] hover:bg-[#00DFFF]/20 shrink-0 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
            {pendingTasks.length > 1 && appearance === 'compact' && (
              <div className="flex items-center justify-between text-[11px] text-[#8496B5] pt-0.5">
                <span>+{pendingTasks.length - 1} more pending</span>
                <span className="font-mono-tech text-[#00DFFF]">{prio.label}</span>
              </div>
            )}
          </div>
        )}
      </HexCard>
    </div>
  );
};
