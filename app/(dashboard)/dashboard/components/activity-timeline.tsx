'use client';

/**
 * ActivityTimeline Component
 *
 * Displays recent audit log entries in a timeline format.
 * Each entry shows action icon, entity type, changes summary,
 * and relative timestamp.
 */

import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  User,
  Clock,
} from 'lucide-react';

export interface ActivityTimelineProps {
  entries: Array<{
    id: string;
    action: string;
    entity_type: string;
    changes_summary: string | null;
    changed_by_name: string | null;
    changed_at: string;
  }>;
}

const actionIconMap: Record<string, { icon: typeof Plus; colorClass: string }> = {
  create: { icon: Plus, colorClass: 'text-green-400' },
  update: { icon: Pencil, colorClass: 'text-blue-400' },
  delete: { icon: Trash2, colorClass: 'text-red-400' },
  status_change: { icon: CheckCircle, colorClass: 'text-amber-400' },
  void: { icon: XCircle, colorClass: 'text-red-400' },
  cancel: { icon: XCircle, colorClass: 'text-red-400' },
};

const defaultIcon = { icon: User, colorClass: 'text-slate-400' };

function formatActionLabel(action: string): string {
  // Convert snake_case to Title Case
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatEntityType(entityType: string): string {
  // Convert entity_type to display format (e.g., "qmrl" -> "QMRL")
  const specialCases: Record<string, string> = {
    qmrl: 'QMRL',
    qmhq: 'QMHQ',
    po: 'PO',
  };
  return specialCases[entityType.toLowerCase()] || entityType.charAt(0).toUpperCase() + entityType.slice(1);
}

export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400">Recent Activity</h3>
          <Clock className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="h-12 w-12 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-400">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">Recent Activity</h3>
        <Clock className="h-5 w-5 text-slate-500" />
      </div>

      {/* Timeline */}
      <ol className="relative border-l border-slate-700 ml-3">
        {entries.map((entry) => {
          const { icon: Icon, colorClass } =
            actionIconMap[entry.action.toLowerCase()] || defaultIcon;

          return (
            <li key={entry.id} className="mb-4 ml-6 last:mb-0">
              {/* Circle on line */}
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 ring-4 ring-slate-900">
                <Icon className={`h-3 w-3 ${colorClass}`} />
              </span>

              {/* Content card */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-200">
                    {formatActionLabel(entry.action)}{' '}
                    <span className="text-slate-400">
                      {formatEntityType(entry.entity_type)}
                    </span>
                  </p>
                  <time className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(entry.changed_at), {
                      addSuffix: true,
                    })}
                  </time>
                </div>

                {/* Body */}
                <p className="text-xs text-slate-400">
                  {entry.changes_summary || `by ${entry.changed_by_name || 'System'}`}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
