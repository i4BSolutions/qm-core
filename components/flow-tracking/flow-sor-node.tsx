"use client";

import Link from "next/link";
import { PackageCheck, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FlowStockOutRequest } from "@/types/flow-tracking";

interface FlowSORNodeProps {
  sor: FlowStockOutRequest;
}

export function FlowSORNode({ sor }: FlowSORNodeProps) {
  return (
    <div className="my-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
      <Link href="/inventory/stock-out-requests">
        <div className="tactical-card corner-accents p-4 group">
          {/* Scan line effect */}
          <div className="scan-overlay" />

          {/* Header: request badge + status */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded bg-slate-800 border border-orange-500/30 px-3 py-1.5">
              <PackageCheck className="h-4 w-4 text-orange-400" />
              <code className="font-mono text-sm font-semibold tracking-wider text-orange-400">
                {sor.request_number}
              </code>
            </div>
            <Badge variant="outline" className="text-xs font-mono uppercase tracking-wider">
              {sor.status}
            </Badge>
          </div>

          {/* Divider */}
          <div className="divider-accent" />

          {/* Details: date */}
          <div className="space-y-1.5 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Created: {new Date(sor.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
