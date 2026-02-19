"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Package } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { POLineItem, Item, Invoice } from "@/types/database";

interface MatchingLineItem {
  id: string;
  itemId: string | null;
  itemName: string;
  itemSku: string | null;
  ordered: number;
  invoiced: number;
  received: number;
  unit: string | null;
  conversionRate: number;
}

interface POMatchingTabProps {
  lineItems: (POLineItem & { item?: Pick<Item, "id" | "name" | "sku"> | null })[];
  invoices: Invoice[];
}

export function POMatchingTab({ lineItems, invoices }: POMatchingTabProps) {
  const [showVoided, setShowVoided] = useState(false);

  // Filter invoices
  const visibleInvoices = showVoided
    ? invoices
    : invoices.filter(inv => !inv.is_voided);

  const voidedCount = invoices.filter(inv => inv.is_voided).length;

  // Compute matching data from po_line_items (already has invoiced_quantity, received_quantity)
  const matchingData: MatchingLineItem[] = lineItems.map(li => ({
    id: li.id,
    itemId: li.item_id,
    itemName: li.item_name || li.item?.name || "Unknown Item",
    itemSku: li.item_sku || li.item?.sku || null,
    ordered: li.quantity,
    invoiced: li.invoiced_quantity ?? 0,
    received: li.received_quantity ?? 0,
    unit: li.item_unit || null,
    conversionRate: li.conversion_rate ?? 1,
  }));

  return (
    <div className="space-y-6">
      {/* Line Item Matching Table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
          Line Item Matching
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Item</th>
                <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-20">Ordered</th>
                <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-20">Invoiced</th>
                <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-20">Received</th>
                <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">Inv Variance</th>
                <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">Rcv Variance</th>
                <th className="text-center py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {matchingData.map(row => {
                const invVariance = row.invoiced - row.ordered;
                const rcvVariance = row.received - row.ordered;
                const isFullyMatched = row.ordered === row.invoiced && row.ordered === row.received;
                const isUnderInvoiced = row.invoiced < row.ordered;
                const isUnderReceived = row.received < row.ordered;

                return (
                  <tr key={row.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-slate-700/50 flex items-center justify-center">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div className="flex items-center gap-2">
                          {row.itemSku && (
                            <code className="font-mono text-amber-400 text-xs">{row.itemSku}</code>
                          )}
                          <span className="text-slate-200 text-sm">{row.itemName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono text-slate-200">{row.ordered}</span>
                      {row.unit && row.conversionRate !== 1 && row.conversionRate > 0 && <span className="text-xs text-slate-400 ml-1">{row.unit}</span>}
                    </td>
                    <td className={cn(
                      "py-3 px-3 text-right font-mono",
                      isUnderInvoiced ? "text-amber-400" : "text-slate-200"
                    )}>
                      {row.invoiced}
                    </td>
                    <td className={cn(
                      "py-3 px-3 text-right font-mono",
                      isUnderReceived ? "text-amber-400" : "text-slate-200"
                    )}>
                      {row.received}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {invVariance !== 0 && (
                        <span className={cn(
                          "font-mono text-sm",
                          invVariance < 0 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {invVariance > 0 ? "+" : ""}{invVariance}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {rcvVariance !== 0 && (
                        <span className={cn(
                          "font-mono text-sm",
                          rcvVariance < 0 ? "text-amber-400" : "text-emerald-400"
                        )}>
                          {rcvVariance > 0 ? "+" : ""}{rcvVariance}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isFullyMatched ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 inline-block" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-400 inline-block" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Summary footer */}
            <tfoot>
              <tr className="border-t border-slate-600">
                <td className="py-3 px-3 text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Total
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                  {matchingData.reduce((s, r) => s + r.ordered, 0)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                  {matchingData.reduce((s, r) => s + r.invoiced, 0)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                  {matchingData.reduce((s, r) => s + r.received, 0)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Invoice Summary with voided toggle */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Linked Invoices
          </h3>
          {voidedCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500/30"
              />
              Show voided ({voidedCount})
            </label>
          )}
        </div>

        <div className="space-y-2">
          {visibleInvoices.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No invoices linked to this PO</p>
          ) : (
            visibleInvoices.map(inv => (
              <div
                key={inv.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  inv.is_voided
                    ? "border-slate-700/50 bg-slate-800/20 opacity-60"
                    : "border-slate-700 bg-slate-800/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <code className={cn(
                    "text-sm",
                    inv.is_voided ? "text-slate-500 line-through" : "text-amber-400"
                  )}>
                    {inv.invoice_number}
                  </code>
                  {inv.is_voided && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                      VOID
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">
                    {inv.supplier_invoice_no || "—"}
                  </span>
                  <span className="font-mono text-emerald-400">
                    {formatCurrency(inv.total_amount_eusd ?? 0)} EUSD
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
