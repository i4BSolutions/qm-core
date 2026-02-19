"use client";

import { useState } from "react";
import { Check, Package, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { POStatusBadge } from "@/components/po/po-status-badge";
import { calculateAvailableQuantity } from "@/lib/utils/invoice-status";
import type { PurchaseOrder, POLineItem, Supplier, Item } from "@/types/database";

// PO with relations for display
export interface POForInvoice extends PurchaseOrder {
  supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  line_items: (POLineItem & {
    item?: Pick<Item, "id" | "name" | "sku"> | null;
  })[];
}

// Line item with calculated available quantity
export interface POLineItemForInvoice extends POLineItem {
  available_quantity: number;
  item?: Pick<Item, "id" | "name" | "sku"> | null;
}

interface InvoicePOSelectorProps {
  purchaseOrders: POForInvoice[];
  selectedPOId: string | null;
  selectedLineItems: string[];
  onSelectPO: (poId: string) => void;
  onToggleLineItem: (lineItemId: string) => void;
  onSelectAllLineItems: () => void;
  disabled?: boolean;
}

export function InvoicePOSelector({
  purchaseOrders,
  selectedPOId,
  selectedLineItems,
  onSelectPO,
  onToggleLineItem,
  onSelectAllLineItems,
  disabled = false,
}: InvoicePOSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter POs by search
  const filteredPOs = purchaseOrders.filter((po) => {
    const search = searchTerm.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(search) ||
      po.supplier?.name?.toLowerCase().includes(search) ||
      po.supplier?.company_name?.toLowerCase().includes(search)
    );
  });

  const selectedPO = purchaseOrders.find((po) => po.id === selectedPOId);

  // Calculate available quantities for line items
  const getLineItemsWithAvailable = (
    lineItems: POLineItem[]
  ): POLineItemForInvoice[] => {
    return lineItems.map((item) => ({
      ...item,
      available_quantity: calculateAvailableQuantity(
        item.quantity,
        item.invoiced_quantity ?? 0
      ),
    }));
  };

  const lineItemsWithAvailable = selectedPO
    ? getLineItemsWithAvailable(selectedPO.line_items)
    : [];

  // Items that have available quantity
  const availableLineItems = lineItemsWithAvailable.filter(
    (item) => item.available_quantity > 0
  );

  return (
    <div className="space-y-6">
      {/* PO Selection */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search POs by number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>

        {/* PO List */}
        <div className="max-h-64 overflow-y-auto space-y-2 rounded border border-slate-700 p-2 bg-slate-900/50">
          {filteredPOs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No open Purchase Orders found</p>
              <p className="text-sm">
                Only POs with status not_started, partially_invoiced, or
                partially_received can be invoiced
              </p>
            </div>
          ) : (
            filteredPOs.map((po) => {
              const isSelected = po.id === selectedPOId;
              const supplierName =
                po.supplier?.company_name || po.supplier?.name || "No Supplier";

              // Count available items
              const availableCount = po.line_items.filter(
                (li) => (li.quantity - (li.invoiced_quantity ?? 0)) > 0
              ).length;

              return (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => onSelectPO(po.id)}
                  disabled={disabled}
                  className={`w-full text-left p-3 rounded border transition-all ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected
                            ? "border-amber-500 bg-amber-500"
                            : "border-slate-600"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <div>
                        <code className="text-amber-400">{po.po_number}</code>
                        <p className="text-sm text-slate-300">{supplierName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <POStatusBadge status={po.status || "not_started"} size="sm" />
                      <p className="text-xs text-slate-400 mt-1">
                        {availableCount} item{availableCount !== 1 ? "s" : ""}{" "}
                        available
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Line Item Selection */}
      {selectedPO && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Select Items to Invoice
            </h4>
            {availableLineItems.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSelectAllLineItems}
                disabled={disabled}
                className="border-slate-700 text-slate-400 hover:text-slate-200"
              >
                {selectedLineItems.length === availableLineItems.length
                  ? "Deselect All"
                  : "Select All Available"}
              </Button>
            )}
          </div>

          <div className="rounded border border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="w-10"></th>
                  <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Item
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
                    PO Qty
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
                    Invoiced
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
                    Available
                  </th>
                  <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-28">
                    Unit Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineItemsWithAvailable.map((item) => {
                  const isSelected = selectedLineItems.includes(item.id);
                  const isAvailable = item.available_quantity > 0;

                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-slate-700/50 ${
                        !isAvailable
                          ? "opacity-50"
                          : isSelected
                          ? "bg-amber-500/5"
                          : "hover:bg-slate-800/30"
                      }`}
                    >
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => onToggleLineItem(item.id)}
                          disabled={disabled || !isAvailable}
                          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-amber-500 bg-amber-500"
                              : "border-slate-600 hover:border-slate-500"
                          } ${!isAvailable ? "cursor-not-allowed" : ""}`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </button>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-slate-200 font-medium">
                              {item.item_name || item.item?.name || "Unknown"}
                            </p>
                            {(item.item_sku || item.item?.sku) && (
                              <code className="text-xs text-amber-400">
                                {item.item_sku || item.item?.sku}
                              </code>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-mono text-slate-300">
                          {item.quantity}
                        </span>
                        {item.item_unit && (item.conversion_rate ?? 1) !== 1 && (item.conversion_rate ?? 1) > 0 && (
                          <span className="text-xs text-slate-400 ml-1">
                            {item.item_unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-mono text-slate-500">
                          {item.invoiced_quantity ?? 0}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`font-mono ${
                            isAvailable ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {item.available_quantity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="font-mono text-slate-300">
                          {formatCurrency(item.unit_price)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {availableLineItems.length === 0 && (
            <div className="text-center py-4 text-amber-400 bg-amber-500/10 rounded border border-amber-500/30">
              <p>All items from this PO have been fully invoiced</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
