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
    <div className="my-3">
      <Link href="/inventory/stock-out-requests">
        <div className="border-l-4 border-l-orange-500 rounded-lg bg-slate-900/50 p-3 sm:p-4 hover:bg-slate-800/50 transition-colors">
          {/* Header: icon + request number + status */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20">
                <PackageCheck className="h-3 w-3 text-orange-400" />
              </div>
              <code className="text-xs font-mono text-orange-400">
                {sor.request_number}
              </code>
            </div>
            <Badge variant="secondary">
              {sor.status}
            </Badge>
          </div>

          {/* Details: date */}
          <div className="mt-2 space-y-1 text-xs text-slate-400">
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
