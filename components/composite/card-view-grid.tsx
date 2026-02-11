"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CardViewGridProps<T> {
  items: T[];
  groups: { key: string; label: string; dotClass: string }[];
  groupBy: (item: T) => string;
  renderCard: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

/**
 * CardViewGrid
 *
 * Generic 3-column grid for displaying items grouped by status or category.
 * Uses the Kanban-style column layout pattern from QMRL and PO list pages.
 *
 * Features:
 * - Automatic item grouping via groupBy function
 * - Column headers with status dots and item counters
 * - Empty state placeholders
 * - Render props pattern for flexible card content
 *
 * Layout:
 * - 3-column grid on lg+ screens
 * - Column header with dot indicator, label, and counter
 * - Column body with min-height and scrollable content
 *
 * @example
 * <CardViewGrid
 *   items={qmrls}
 *   groups={[
 *     { key: "to_do", label: "PENDING", dotClass: "status-dot status-dot-todo" },
 *     { key: "in_progress", label: "IN PROGRESS", dotClass: "status-dot status-dot-progress" },
 *     { key: "done", label: "COMPLETED", dotClass: "status-dot status-dot-done" }
 *   ]}
 *   groupBy={(qmrl) => qmrl.status?.status_group || "to_do"}
 *   renderCard={(qmrl, index) => <QMRLCard qmrl={qmrl} index={index} />}
 * />
 */
export function CardViewGrid<T>({
  items,
  groups,
  groupBy,
  renderCard,
  emptyMessage = "No items",
  className,
}: CardViewGridProps<T>) {
  // Group items by calling groupBy function
  const groupedItems = useMemo(() => {
    const result: Record<string, T[]> = {};

    // Initialize all groups with empty arrays
    groups.forEach((group) => {
      result[group.key] = [];
    });

    // Bucket items into groups
    items.forEach((item) => {
      const groupKey = groupBy(item);
      if (result[groupKey]) {
        result[groupKey].push(item);
      } else {
        // Fallback to first group if groupBy returns unknown key
        const fallbackKey = groups[0]?.key;
        if (fallbackKey && result[fallbackKey]) {
          result[fallbackKey].push(item);
        }
      }
    });

    return result;
  }, [items, groups, groupBy]);

  return (
    <div className={cn("grid gap-6 lg:grid-cols-3", className)}>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col">
          {/* Column Header */}
          <div className="column-header">
            <div className={group.dotClass} />
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">
              {group.label}
            </h2>
            <span className="stat-counter ml-auto">
              {groupedItems[group.key]?.length || 0}
            </span>
          </div>

          {/* Column Body */}
          <div className="flex-1 rounded-b-lg border border-t-0 border-slate-700 bg-slate-900/30 p-3 min-h-[400px]">
            <div className="space-y-3">
              {groupedItems[group.key]?.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700">
                  <p className="text-sm text-slate-400">{emptyMessage}</p>
                </div>
              ) : (
                groupedItems[group.key]?.map((item, index) => (
                  <div key={index}>{renderCard(item, index)}</div>
                ))
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
