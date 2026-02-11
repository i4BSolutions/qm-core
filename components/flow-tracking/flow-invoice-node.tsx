"use client";

import Link from "next/link";
import { FileSpreadsheet, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FlowInvoice } from "@/types/flow-tracking";

interface FlowInvoiceNodeProps {
  invoice: FlowInvoice;
}

export function FlowInvoiceNode({ invoice }: FlowInvoiceNodeProps) {
  const baseClasses =
    "border-l-4 border-l-cyan-500 rounded-lg bg-slate-900/50 p-3 sm:p-4 hover:bg-slate-800/50 transition-colors";
  const voidedClasses = invoice.is_voided ? "opacity-50 [&_*]:line-through" : "";

  return (
    <div className="my-3">
      <Link href={`/invoice/${invoice.id}`}>
        <div className={cn(baseClasses, voidedClasses)}>
          {/* Header: icon + Invoice number + status */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20">
                <FileSpreadsheet className="h-3 w-3 text-cyan-400" />
              </div>
              <code className="text-xs font-mono text-cyan-400">
                {invoice.invoice_number}
              </code>
            </div>
            <Badge variant="secondary">
              {invoice.status}
            </Badge>
          </div>

          {/* Details: dates */}
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Invoice Date: {new Date(invoice.invoice_date).toLocaleDateString()}</span>
            </div>
            {invoice.due_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Created: {new Date(invoice.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
