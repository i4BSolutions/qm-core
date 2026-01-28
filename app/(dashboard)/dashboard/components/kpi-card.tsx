'use client';

/**
 * KPICard Component
 *
 * A Linear-style KPI card that displays a title and status breakdown bar.
 * Clicking the card navigates to the entity list page.
 * Clicking a segment navigates with a status_group filter.
 */

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { StatusBar } from './status-bar';

export interface KPICardProps {
  title: string;
  stats: { status_group: string; count: number }[];
  href: string;
  icon?: LucideIcon;
}

export function KPICard({ title, stats, href, icon: Icon }: KPICardProps) {
  // Convert stats array to toDo/inProgress/done counts
  const toDo = stats.find((s) => s.status_group === 'to_do')?.count ?? 0;
  const inProgress = stats.find((s) => s.status_group === 'in_progress')?.count ?? 0;
  const done = stats.find((s) => s.status_group === 'done')?.count ?? 0;

  const handleSegmentClick = (group: 'to_do' | 'in_progress' | 'done') => {
    // Navigate to href with status_group filter
    window.location.href = `${href}?status_group=${group}`;
  };

  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-800 bg-slate-900/50 p-6 cursor-pointer hover:border-slate-700 transition"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        {Icon && <Icon className="h-5 w-5 text-slate-500" />}
      </div>

      {/* Body with StatusBar */}
      <div onClick={(e) => e.preventDefault()}>
        <StatusBar
          toDo={toDo}
          inProgress={inProgress}
          done={done}
          onSegmentClick={handleSegmentClick}
        />
      </div>
    </Link>
  );
}
