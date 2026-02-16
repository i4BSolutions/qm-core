"use client";

import { Trash2, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, handleQuantityKeyDown } from "@/lib/utils";
import { AmountInput } from "@/components/ui/amount-input";
import { StandardUnitDisplay } from "@/components/ui/standard-unit-display";
import { calculateAvailableQuantity } from "@/lib/utils/invoice-status";
import { MiniProgressBar } from "@/components/po/po-progress-bar";
import type { InvoiceLineItem, POLineItem, Item } from "@/types/database";

// Type for PO line items with available quantity calculation
export interface POLineItemWithAvailable extends POLineItem {
  available_quantity: number;
  item?: Pick<Item, "id" | "name" | "sku"> | null;
}

// For creating/editing - uses local state
export interface InvoiceLineItemFormData {
  id: string; // Temporary ID for form state
  po_line_item_id: string;
  item_id: string | null;
  item_name: string;
  item_sku?: string;
  item_unit?: string;
  quantity: number;
  unit_price: number;
  po_unit_price: number;
  available_quantity: number;
  conversion_rate: string;
}

interface EditableInvoiceLineItemsTableProps {
  items: InvoiceLineItemFormData[];
  onRemoveItem: (id: string) => void;
  onUpdateItem: (
    id: string,
    field: keyof InvoiceLineItemFormData,
    value: unknown
  ) => void;
  currency?: string;
  disabled?: boolean;
}

export function EditableInvoiceLineItemsTable({
  items,
  onRemoveItem,
  onUpdateItem,
  currency = "MMK",
  disabled = false,
}: EditableInvoiceLineItemsTableProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Item
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
                Available
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
                Qty
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
                PO Price
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
                Unit Price
              </th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
                Line Total
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isOverQuantity = item.quantity > item.available_quantity;

              return (
                <tr
                  key={item.id}
                  className={`border-b border-slate-700/50 hover:bg-slate-800/30 ${
                    isOverQuantity ? "bg-red-500/10" : ""
                  }`}
                >
                  <td className="py-2 px-3 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center">
                        <Package className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-slate-200 font-medium">
                          {item.item_name}
                        </p>
                        {item.item_sku && (
                          <code className="text-xs text-amber-400">
                            {item.item_sku}
                          </code>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span
                      className={`font-mono ${
                        item.available_quantity > 0
                          ? "text-slate-300"
                          : "text-red-400"
                      }`}
                    >
                      {item.available_quantity}
                    </span>
                    {item.item_unit && (
                      <span className="text-xs text-slate-400 ml-1">
                        {item.item_unit}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity === 0 ? "" : item.quantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          onUpdateItem(item.id, "quantity", value);
                        }}
                        onKeyDown={handleQuantityKeyDown}
                        disabled={disabled}
                        className={`w-20 text-right font-mono bg-slate-800 border-slate-700 ${
                          isOverQuantity ? "border-red-500" : ""
                        }`}
                      />
                      {isOverQuantity && (
                        <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                      )}
                    </div>
                    {isOverQuantity && (
                      <p className="text-xs text-red-400 mt-1">
                        Exceeds available
                      </p>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="font-mono text-slate-500">
                      {formatCurrency(item.po_unit_price)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <AmountInput
                      value={item.unit_price === 0 ? "" : String(item.unit_price)}
                      onValueChange={(val) =>
                        onUpdateItem(
                          item.id,
                          "unit_price",
                          parseFloat(val) || 0
                        )
                      }
                      disabled={disabled}
                      className="w-28 text-right bg-slate-800 border-slate-700"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="font-mono text-emerald-400">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={disabled}
                      className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-600">
                <td colSpan={5} className="py-3 px-3 text-right">
                  <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                    Subtotal ({currency})
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-lg font-mono font-bold text-emerald-400">
                    {formatCurrency(subtotal)}
                  </span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {items.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No items added yet</p>
          <p className="text-sm">Select items from the PO to add to this invoice</p>
        </div>
      )}
    </div>
  );
}

// For display - shows existing invoice line items
interface ReadonlyInvoiceLineItemsTableProps {
  items: (InvoiceLineItem & {
    item?: Pick<Item, "id" | "name" | "sku"> | null;
    unit_name?: string;
  })[];
  currency?: string;
  showPOPrice?: boolean;
  showProgress?: boolean;
}

export function ReadonlyInvoiceLineItemsTable({
  items,
  currency = "MMK",
  showPOPrice = true,
  showProgress = true,
}: ReadonlyInvoiceLineItemsTableProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.total_price ?? 0),
    0
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Item
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
              Qty
            </th>
            {showProgress && (
              <th className="text-center py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-40">
                Received
              </th>
            )}
            {showPOPrice && (
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
                PO Price
              </th>
            )}
            <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
              Unit Price
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
              Line Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const qty = item.quantity || 0;
            const received = item.received_quantity || 0;
            const receivedPercent = qty > 0 ? Math.min(100, Math.round((received / qty) * 100)) : 0;

            return (
              <tr
                key={item.id}
                className="border-b border-slate-700/50 hover:bg-slate-800/30"
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-slate-700/50 flex items-center justify-center">
                      <Package className="h-4 w-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium">
                        {item.item_name || item.item?.name || "Unknown Item"}
                      </p>
                      {(item.item_sku || item.item?.sku) && (
                        <code className="text-xs text-amber-400">
                          {item.item_sku || item.item?.sku}
                        </code>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <StandardUnitDisplay
                    quantity={qty}
                    conversionRate={item.conversion_rate ?? 1}
                    unitName={item.unit_name}
                    size="sm"
                    align="right"
                  />
                </td>
                {showProgress && (
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">{received}/{qty}</span>
                        <span className={`font-mono ${receivedPercent === 100 ? "text-emerald-400" : "text-slate-400"}`}>
                          {receivedPercent}%
                        </span>
                      </div>
                      <MiniProgressBar percent={receivedPercent} color="emerald" />
                    </div>
                  </td>
                )}
                {showPOPrice && (
                  <td className="py-3 px-3 text-right">
                    <span className="font-mono text-slate-500">
                      {item.po_unit_price != null
                        ? formatCurrency(item.po_unit_price)
                        : "—"}
                    </span>
                  </td>
                )}
                <td className="py-3 px-3 text-right">
                  <span className="font-mono text-slate-300">
                    {formatCurrency(item.unit_price)}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="font-mono text-emerald-400">
                    {formatCurrency(item.total_price ?? 0)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-600">
            <td className="py-3 px-3 text-right">
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Total
              </span>
            </td>
            <td></td>
            <td colSpan={showPOPrice ? (showProgress ? 3 : 2) : (showProgress ? 2 : 1)} className="py-3 px-3 text-right">
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Subtotal ({currency})
              </span>
            </td>
            <td className="py-3 px-3 text-right">
              <span className="text-lg font-mono font-bold text-emerald-400">
                {formatCurrency(subtotal)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
