'use client';

/**
 * AlertList Component
 *
 * Displays low stock alerts sorted by severity with colored badges.
 * Links each alert item to its detail page for quick navigation.
 * Shows empty state when all items are well stocked.
 */

import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface AlertListProps {
  alerts: Array<{
    item_id: string;
    item_name: string;
    item_sku: string;
    warehouse_id: string;
    warehouse_name: string;
    current_stock: number;
    severity: 'out_of_stock' | 'critical' | 'warning';
  }>;
}

const severityConfig = {
  out_of_stock: {
    label: 'Out of Stock',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
  critical: {
    label: 'Critical',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
  warning: {
    label: 'Low',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
};

export function AlertList({ alerts }: AlertListProps) {
  // Determine header badge color based on severity levels present
  const hasCritical = alerts.some(
    (a) => a.severity === 'out_of_stock' || a.severity === 'critical'
  );
  const headerBadgeClass = hasCritical
    ? 'bg-red-500/20 text-red-400'
    : alerts.length > 0
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-green-500/20 text-green-400';

  // Show only top 5 alerts
  const displayedAlerts = alerts.slice(0, 5);
  const remainingCount = alerts.length - 5;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-slate-400">Low Stock Alerts</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${headerBadgeClass}`}
          >
            {alerts.length}
          </span>
        </div>
        <AlertTriangle className="h-5 w-5 text-slate-500" />
      </div>

      {/* Empty state */}
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
          <p className="text-sm font-medium text-slate-300">All items well stocked</p>
          <p className="text-xs text-slate-500 mt-1">
            No items are below the low stock threshold
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Alert list */}
          {displayedAlerts.map((alert) => {
            const config = severityConfig[alert.severity];
            return (
              <Link
                key={`${alert.item_id}-${alert.warehouse_id}`}
                href={`/item/${alert.item_id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                {/* Severity badge */}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.badgeClass}`}
                >
                  {config.label}
                </span>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {alert.item_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {alert.warehouse_name}
                  </p>
                </div>

                {/* Stock count */}
                <span className="text-sm font-mono text-slate-400">
                  {alert.current_stock}
                </span>
              </Link>
            );
          })}

          {/* View all link */}
          {remainingCount > 0 && (
            <Link
              href="/inventory?filter=low_stock"
              className="block text-center text-xs text-blue-400 hover:text-blue-300 pt-3"
            >
              View all {alerts.length} items
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
