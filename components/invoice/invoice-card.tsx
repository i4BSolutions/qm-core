"use client";

import Link from "next/link";
import { ChevronRight, FileText, CalendarDays, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { Invoice, PurchaseOrder, Supplier } from "@/types/database";

interface InvoiceWithRelations extends Invoice {
  purchase_order?: Pick<
    PurchaseOrder,
    "id" | "po_number" | "supplier_id"
  > & {
    supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  } | null;
}

interface InvoiceCardProps {
  invoice: InvoiceWithRelations;
  animationDelay?: number;
}

export function InvoiceCard({ invoice, animationDelay = 0 }: InvoiceCardProps) {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const supplierName =
    invoice.purchase_order?.supplier?.company_name ||
    invoice.purchase_order?.supplier?.name;

  return (
    <Link href={`/invoice/${invoice.id}`} className="block">
      <div
        className="tactical-card corner-accents p-4 animate-slide-up cursor-pointer"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Scan line effect */}
        <div className="scan-overlay" />

        {/* Header Row */}
        <div className="relative flex items-center justify-between mb-3">
          <div className="request-id-badge">
            <code>{invoice.invoice_number || "—"}</code>
          </div>
          <InvoiceStatusBadge
            status={invoice.status || "draft"}
            isVoided={invoice.is_voided ?? false}
            size="sm"
          />
        </div>

        {/* Supplier Invoice No */}
        {invoice.supplier_invoice_no && (
          <div className="mb-2 text-sm">
            <span className="text-slate-400">Supplier Ref:</span>{" "}
            <code className="text-amber-400">{invoice.supplier_invoice_no}</code>
          </div>
        )}

        {/* Supplier */}
        {supplierName && (
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="text-slate-200 font-medium truncate">
              {supplierName}
            </span>
          </div>
        )}

        {/* Parent PO */}
        {invoice.purchase_order && (
          <div className="mb-3 text-xs text-slate-400">
            <span className="text-slate-500">PO:</span>{" "}
            <code className="text-blue-400">
              {invoice.purchase_order.po_number}
            </code>
          </div>
        )}

        {/* Financial Info */}
        <div className="mb-3 p-2 rounded bg-slate-800/50 border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Amount</span>
            <span className="font-mono text-sm text-emerald-400">
              {formatCurrency(invoice.total_amount_eusd ?? 0)} EUSD
            </span>
          </div>
          {invoice.currency && invoice.currency !== "EUSD" && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">
                ({invoice.currency})
              </span>
              <span className="font-mono text-xs text-slate-400">
                {formatCurrency(invoice.total_amount ?? 0)}
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="divider-accent" />

        {/* Meta Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              <span>{formatDate(invoice.invoice_date)}</span>
            </div>
            {invoice.due_date && (
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>Due: {formatDate(invoice.due_date)}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </Link>
  );
}
