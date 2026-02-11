"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ItemProgressData {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  requested: number;
  approved: number;
  executed: number;
  rejected: number;
}

interface ItemsSummaryProgressProps {
  items: ItemProgressData[];
}

export function ItemsSummaryProgress({ items }: ItemsSummaryProgressProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Items Summary
      </h3>
      <div className="space-y-4">
        {items.map((item) => {
          const pending = Math.max(0, item.approved - item.executed);

          // Cap percentages to prevent overflow
          const requestedPercent = 100;
          const approvedPercent = item.requested > 0
            ? Math.min(100, (item.approved / item.requested) * 100)
            : 0;
          const executedPercent = item.requested > 0
            ? Math.min(100, (item.executed / item.requested) * 100)
            : 0;

          return (
            <div key={item.itemId} className="space-y-2">
              {/* Item header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {item.itemSku && (
                    <span className="text-xs font-mono text-amber-400">
                      {item.itemSku}
                    </span>
                  )}
                  <span className="text-sm text-slate-200">{item.itemName}</span>
                  {item.rejected > 0 && (
                    <Badge
                      variant="outline"
                      className="border-red-500/30 text-red-400"
                    >
                      Rejected: {item.rejected}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {item.executed}/{item.requested}
                </span>
              </div>

              {/* Stepped progress bar */}
              <div className="h-6 w-full bg-slate-800/50 rounded-lg overflow-hidden relative">
                {/* Requested baseline (full width) */}
                <div
                  className="absolute inset-y-0 left-0 bg-slate-600/30 transition-all duration-500"
                  style={{ width: `${requestedPercent}%` }}
                />
                {/* Approved segment */}
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
                  style={{ width: `${approvedPercent}%` }}
                />
                {/* Executed segment */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                  style={{ width: `${executedPercent}%` }}
                />
              </div>

              {/* Legend row */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-600 inline-block mr-1" />
                  Requested: {item.requested}
                </div>
                <div className="flex items-center text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
                  Approved: {item.approved}
                </div>
                <div className="flex items-center text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />
                  Executed: {item.executed}
                </div>
                {pending > 0 && (
                  <div className="flex items-center text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1" />
                    Pending: {pending}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
