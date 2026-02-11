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
  const baseClasses =
    "border-l-4 border-l-violet-500 rounded-lg bg-slate-900/50 p-3 sm:p-4 hover:bg-slate-800/50 transition-colors";
  const fadedClasses = po.is_cancelled ? "opacity-50" : "";

  return (
    <div className="my-3">
      <Link href={`/po/${po.id}`}>
        <div className={cn(baseClasses, fadedClasses)}>
          {/* Header: icon + PO number + status */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20">
                <ClipboardCheck className="h-3 w-3 text-violet-400" />
              </div>
              <code className="text-xs font-mono text-violet-400">
                {po.po_number}
              </code>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                po.is_cancelled && "line-through"
              )}
            >
              {po.status}
            </Badge>
          </div>

          {/* Details: supplier + dates */}
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {po.supplier_name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 flex-shrink-0" />
                <span>{po.supplier_name}</span>
              </div>
            )}
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
