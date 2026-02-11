"use client";

import { Warehouse, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowStockTransaction } from "@/types/flow-tracking";

interface FlowStockNodeProps {
  stock: FlowStockTransaction;
}

export function FlowStockNode({ stock }: FlowStockNodeProps) {
  const movementBadgeColor =
    stock.movement_type === "inventory_in"
      ? "bg-emerald-900/30 text-emerald-400 border-emerald-900/50"
      : "bg-amber-900/30 text-amber-400 border-amber-900/50";

  return (
    <div className="my-3">
      <div className="border-l-4 border-l-teal-500 rounded-lg bg-slate-900/50 p-3 sm:p-4">
        {/* Header: icon + movement type + status */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20">
              <Warehouse className="h-3 w-3 text-teal-400" />
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                movementBadgeColor
              )}
            >
              {stock.movement_type.replace("_", " ")}
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-700 text-slate-300"
            )}
          >
            {stock.status}
          </span>
        </div>

        {/* Details: date */}
        <div className="mt-2 space-y-1 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>Transaction: {new Date(stock.transaction_date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
