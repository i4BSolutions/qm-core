'use client';

/**
 * Sibling QMHQ List Component
 *
 * Displays a view-only list of sibling QMHQ lines linked to the same parent QMRL.
 * Shows line name, route type icon, request ID, and status badge.
 */

import { Package, Wallet, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SiblingQmhqListProps {
  siblings: Array<{
    id: string;
    request_id: string;
    line_name: string;
    route_type: 'item' | 'expense' | 'po';
    status?: { name: string; color: string } | null;
  }>;
  isLoading: boolean;
}

// Route type configuration for QMHQ display
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  item: { icon: Package, label: 'Item', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
  expense: { icon: Wallet, label: 'Expense', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  po: { icon: ShoppingCart, label: 'PO', color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
};

/**
 * Sibling QMHQ List
 *
 * View-only list showing other QMHQ lines linked to the same parent QMRL.
 * Provides context for users creating new QMHQ lines.
 */
export function SiblingQmhqList({ siblings, isLoading }: SiblingQmhqListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Empty state
  if (siblings.length === 0) {
    return (
      <p className="text-sm text-slate-500 italic text-center py-8">
        No QMHQ created yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {siblings.map((qmhq) => {
        const RouteIcon = routeConfig[qmhq.route_type]?.icon || Package;
        const routeColors = routeConfig[qmhq.route_type];

        return (
          <div
            key={qmhq.id}
            className="flex items-start gap-3 p-3 rounded bg-slate-900/50 border border-slate-700/50"
          >
            {/* Route type icon */}
            <div className={cn(
              'w-8 h-8 rounded flex items-center justify-center border flex-shrink-0 mt-0.5',
              routeColors?.bgColor
            )}>
              <RouteIcon className={cn('h-4 w-4', routeColors?.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Line name */}
              <p className="text-xs text-slate-200 truncate font-medium">
                {qmhq.line_name}
              </p>

              {/* Request ID */}
              <code className="text-[10px] text-slate-500 block">
                {qmhq.request_id}
              </code>

              {/* Status badge */}
              {qmhq.status && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    borderColor: qmhq.status.color || 'rgb(100, 116, 139)',
                    color: qmhq.status.color || 'rgb(148, 163, 184)',
                  }}
                >
                  {qmhq.status.name}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
