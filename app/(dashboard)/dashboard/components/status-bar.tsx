'use client';

/**
 * StatusBar Component
 *
 * A stacked horizontal bar visualization showing the distribution
 * of items across to_do, in_progress, and done status groups.
 * Used inside KPICard for QMRL/QMHQ status breakdown.
 */

import { useMemo } from 'react';

export interface StatusBarProps {
  toDo: number;
  inProgress: number;
  done: number;
  onSegmentClick?: (group: 'to_do' | 'in_progress' | 'done') => void;
}

export function StatusBar({ toDo, inProgress, done, onSegmentClick }: StatusBarProps) {
  const { total, percentages } = useMemo(() => {
    const total = toDo + inProgress + done;
    if (total === 0) {
      return { total: 0, percentages: { toDo: 0, inProgress: 0, done: 0 } };
    }
    return {
      total,
      percentages: {
        toDo: (toDo / total) * 100,
        inProgress: (inProgress / total) * 100,
        done: (done / total) * 100,
      },
    };
  }, [toDo, inProgress, done]);

  const segments = [
    {
      key: 'to_do' as const,
      count: toDo,
      percent: percentages.toDo,
      color: 'bg-slate-500',
      label: 'To Do',
    },
    {
      key: 'in_progress' as const,
      count: inProgress,
      percent: percentages.inProgress,
      color: 'bg-blue-500',
      label: 'In Progress',
    },
    {
      key: 'done' as const,
      count: done,
      percent: percentages.done,
      color: 'bg-green-500',
      label: 'Done',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Total count as hero number */}
      <div className="text-3xl font-bold font-mono text-white">{total}</div>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.key}
              className={`${segment.color} transition-all cursor-pointer hover:brightness-110`}
              style={{ width: `${segment.percent}%` }}
              onClick={() => onSegmentClick?.(segment.key)}
              title={`${segment.label}: ${segment.count} (${segment.percent.toFixed(0)}%)`}
            />
          ) : (
            // Zero-count segments shown as thin outlined bar
            <div
              key={segment.key}
              className="w-0.5 border-r border-slate-700"
              title={`${segment.label}: 0`}
            />
          )
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-400">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${segment.color}`} />
            <span>{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
