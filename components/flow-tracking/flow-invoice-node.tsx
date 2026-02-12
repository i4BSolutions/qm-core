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
  const voidedClasses = invoice.is_voided ? "opacity-50 [&_*]:line-through" : "";

  return (
    <div className="my-3 animate-slide-up" style={{ animationDelay: "150ms" }}>
      <Link href={`/invoice/${invoice.id}`}>
        <div className={cn("tactical-card corner-accents p-4 group", voidedClasses)}>
          {/* Scan line effect */}
          <div className="scan-overlay" />

          {/* Header: Invoice badge + status */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded bg-slate-800 border border-cyan-500/30 px-3 py-1.5">
              <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
              <code className="font-mono text-sm font-semibold tracking-wider text-cyan-400">
                {invoice.invoice_number}
              </code>
            </div>
            <Badge variant="outline" className="text-xs font-mono uppercase tracking-wider">
              {invoice.status}
            </Badge>
          </div>

          {/* Divider */}
          <div className="divider-accent" />

          {/* Details: dates */}
          <div className="space-y-1.5 text-xs text-slate-400">
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
