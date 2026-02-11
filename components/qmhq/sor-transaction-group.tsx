"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SORTransactionGroupProps {
  sorId: string;
  sorNumber: string;
  sorStatus: string;
  totalQty: number;
  transactions: Array<{
    id: string;
    quantity: number;
    status: string;
    created_at: string;
    transaction_date?: string | null;
    reason?: string | null;
    notes?: string | null;
    item?: { id: string; name: string; sku: string | null } | null;
    warehouse?: { id: string; name: string } | null;
  }>;
}

const sorStatusStyles: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  partially_approved: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  executed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  partially_executed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function SORTransactionGroup({
  sorId,
  sorNumber,
  sorStatus,
  totalQty,
  transactions,
}: SORTransactionGroupProps) {
  const statusStyle = sorStatusStyles[sorStatus] || sorStatusStyles.pending;

  return (
    <div className="space-y-2">
      {/* Compact header */}
      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/inventory/stock-out-requests/${sorId}`}
            className="font-mono text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
          >
            {sorNumber}
            <ExternalLink className="w-3 h-3" />
          </Link>
          <Badge className={cn("border", statusStyle)}>
            {sorStatus.replace(/_/g, " ")}
          </Badge>
        </div>
        <div className="text-slate-400 text-sm">
          Total Qty:{" "}
          <span className="font-mono text-slate-200">{totalQty}</span>
        </div>
      </div>

      {/* Transaction rows */}
      <div className="pl-4 space-y-2">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="p-3 rounded bg-slate-800/20 border border-slate-700/50"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-200">
                    {transaction.item?.name || "Unknown Item"}
                  </span>
                  {transaction.item?.sku && (
                    <span className="text-xs font-mono text-amber-400">
                      {transaction.item.sku}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {transaction.warehouse?.name || "Unknown Warehouse"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-200">
                  {transaction.quantity}
                </span>
                <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                  {transaction.status}
                </Badge>
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-2">
              {new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
