"use client";

import Link from "next/link";
import { ChevronRight, Building2, CalendarDays } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { POStatusBadge, ApprovalStatusBadge } from "./po-status-badge";
import { POProgressBar } from "./po-progress-bar";
import { calculatePOProgress } from "@/lib/utils/po-status";
import type { PurchaseOrder, Supplier, QMHQ } from "@/types/database";

interface POWithRelations extends PurchaseOrder {
  supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  qmhq?: Pick<QMHQ, "id" | "request_id" | "line_name"> | null;
  line_items_aggregate?: {
    total_quantity: number;
    total_invoiced: number;
    total_received: number;
  };
}

interface POCardProps {
  po: POWithRelations;
  animationDelay?: number;
}

export function POCard({ po, animationDelay = 0 }: POCardProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate progress from aggregated line items
  const totalQty = po.line_items_aggregate?.total_quantity ?? 0;
  const invoicedQty = po.line_items_aggregate?.total_invoiced ?? 0;
  const receivedQty = po.line_items_aggregate?.total_received ?? 0;
  const progress = calculatePOProgress(totalQty, invoicedQty, receivedQty);

  return (
    <Link href={`/po/${po.id}`} className="block">
      <div
        className="tactical-card corner-accents p-4 animate-slide-up cursor-pointer"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Scan line effect */}
        <div className="scan-overlay" />

        {/* Header Row */}
        <div className="relative flex items-center justify-between mb-3">
          <div className="request-id-badge">
            <code>{po.po_number || "—"}</code>
          </div>
          <POStatusBadge status={po.status || "not_started"} size="sm" />
        </div>

        {/* Supplier */}
        {po.supplier && (
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="text-slate-200 font-medium truncate">
              {po.supplier.company_name || po.supplier.name}
            </span>
          </div>
        )}

        {/* Parent QMHQ */}
        {po.qmhq && (
          <div className="mb-3 text-xs text-slate-400">
            <span className="text-slate-500">From:</span>{" "}
            <code className="text-amber-400">{po.qmhq.request_id}</code>
          </div>
        )}

        {/* Financial Info */}
        <div className="mb-3 p-2 rounded bg-slate-800/50 border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Amount</span>
            <span className="font-mono text-sm text-emerald-400">
              {formatCurrency(po.total_amount_eusd ?? 0)} EUSD
            </span>
          </div>
        </div>

        {/* Progress */}
        {totalQty > 0 && (
          <div className="mb-3">
            <POProgressBar
              invoicedPercent={progress.invoicedPercent}
              receivedPercent={progress.receivedPercent}
              showLabels={false}
              size="sm"
            />
            <div className="flex justify-between mt-1 text-xs text-slate-500">
              <span>Inv: {progress.invoicedPercent}%</span>
              <span>Rcv: {progress.receivedPercent}%</span>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="divider-accent" />

        {/* Meta Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              <span>{formatDate(po.po_date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ApprovalStatusBadge status={po.approval_status || "draft"} size="sm" />
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </Link>
  );
}
