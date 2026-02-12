"use client";

import { ArrowRightLeft, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowFinancialTransaction } from "@/types/flow-tracking";

interface FlowFinancialNodeProps {
  transaction: FlowFinancialTransaction;
}

export function FlowFinancialNode({ transaction }: FlowFinancialNodeProps) {
  const voidedClasses = transaction.is_voided ? "opacity-50 [&_*]:line-through" : "";

  const transactionBadgeColor =
    transaction.transaction_type === "money_in"
      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
      : "bg-amber-500/20 text-amber-400 border border-amber-500/30";

  return (
    <div className="my-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
      <div className={cn("tactical-card corner-accents p-4", voidedClasses)}>
        {/* Scan line effect */}
        <div className="scan-overlay" />

        {/* Header: icon + transaction type */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-500/20">
            <ArrowRightLeft className="h-4 w-4 text-lime-400" />
          </div>
          <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider", transactionBadgeColor)}>
            {transaction.transaction_type.replace("_", " ")}
          </span>
        </div>

        {/* Divider */}
        <div className="divider-accent" />

        {/* Details: date */}
        <div className="space-y-1.5 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>Transaction: {new Date(transaction.transaction_date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
