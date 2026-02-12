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
      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
      : "bg-amber-500/20 text-amber-400 border border-amber-500/30";

  return (
    <div className="my-3 animate-slide-up" style={{ animationDelay: "200ms" }}>
      <div className="tactical-card corner-accents p-4">
        {/* Scan line effect */}
        <div className="scan-overlay" />

        {/* Header: icon + movement type + status */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20">
              <Warehouse className="h-4 w-4 text-teal-400" />
            </div>
            <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider", movementBadgeColor)}>
              {stock.movement_type.replace("_", " ")}
            </span>
          </div>
          <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-slate-500/20 text-slate-400 border border-slate-500/30">
            {stock.status}
          </span>
        </div>

        {/* Divider */}
        <div className="divider-accent" />

        {/* Details: date */}
        <div className="space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>Transaction: {new Date(stock.transaction_date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
