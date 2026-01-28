'use client';

/**
 * StockTimeline Component
 *
 * Displays recent inventory movements in a timeline format.
 * Shows stock in (green up arrow) and stock out (red down arrow)
 * with item name, warehouse, quantity, and relative timestamp.
 */

import { formatDistanceToNow } from 'date-fns';
import { ArrowUpCircle, ArrowDownCircle, Package } from 'lucide-react';

export interface StockTimelineProps {
  movements: Array<{
    id: string;
    movement_type: 'inventory_in' | 'inventory_out';
    item_name: string | null;
    quantity: number;
    warehouse_name: string;
    transaction_date: string;
    created_by_name: string;
  }>;
}

const movementConfig = {
  inventory_in: {
    icon: ArrowUpCircle,
    colorClass: 'text-green-400',
    sign: '+',
    label: 'Stock In',
  },
  inventory_out: {
    icon: ArrowDownCircle,
    colorClass: 'text-red-400',
    sign: '-',
    label: 'Stock Out',
  },
};

export function StockTimeline({ movements }: StockTimelineProps) {
  if (movements.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-400">Stock Movements</h3>
          <Package className="h-5 w-5 text-slate-500" />
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Package className="h-12 w-12 text-slate-600 mb-3" />
          <p className="text-sm font-medium text-slate-400">No recent stock movements</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-400">Stock Movements</h3>
        <Package className="h-5 w-5 text-slate-500" />
      </div>

      {/* Timeline */}
      <ol className="relative border-l border-slate-700 ml-3">
        {movements.map((movement) => {
          const config = movementConfig[movement.movement_type];
          const Icon = config.icon;

          return (
            <li key={movement.id} className="mb-4 ml-6 last:mb-0">
              {/* Circle on line */}
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 ring-4 ring-slate-900">
                <Icon className={`h-3 w-3 ${config.colorClass}`} />
              </span>

              {/* Content card */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-200">
                    <span className={`font-mono ${config.colorClass}`}>
                      {config.sign}{movement.quantity}
                    </span>{' '}
                    <span className="text-slate-300">
                      {movement.item_name || 'Unknown Item'}
                    </span>
                  </p>
                  <time className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(movement.transaction_date), {
                      addSuffix: true,
                    })}
                  </time>
                </div>

                {/* Body */}
                <p className="text-xs text-slate-400">
                  {movement.warehouse_name} - by {movement.created_by_name}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
