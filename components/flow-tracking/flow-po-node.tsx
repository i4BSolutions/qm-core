"use client";

import Link from "next/link";
import { ClipboardCheck, Calendar, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FlowPO } from "@/types/flow-tracking";

interface FlowPONodeProps {
  po: FlowPO;
}

export function FlowPONode({ po }: FlowPONodeProps) {
  const fadedClasses = po.is_cancelled ? "opacity-50" : "";

  return (
    <div className="my-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
      <Link href={`/po/${po.id}`}>
        <div className={cn("tactical-card corner-accents p-4 group", fadedClasses)}>
          {/* Scan line effect */}
          <div className="scan-overlay" />

          {/* Header: PO badge + status */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded bg-slate-800 border border-violet-500/30 px-3 py-1.5">
              <ClipboardCheck className="h-4 w-4 text-violet-400" />
              <code className="font-mono text-sm font-semibold tracking-wider text-violet-400">
                {po.po_number}
              </code>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-mono uppercase tracking-wider",
                po.is_cancelled && "line-through"
              )}
            >
              {po.status}
            </Badge>
          </div>

          {/* Supplier name as title */}
          {po.supplier_name && (
            <h3 className="font-semibold text-slate-200 mb-3 leading-snug flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              {po.supplier_name}
            </h3>
          )}

          {/* Divider */}
          <div className="divider-accent" />

          {/* Details: dates */}
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>PO Date: {new Date(po.po_date).toLocaleDateString()}</span>
            </div>
            {po.expected_delivery_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>Expected: {new Date(po.expected_delivery_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Created: {new Date(po.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
