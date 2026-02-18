"use client";

import { useState } from "react";
import { Trash2, Package, Plus, Minus, Plus as PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, handleQuantityKeyDown } from "@/lib/utils";
import { AmountInput } from "@/components/ui/amount-input";
import { ConversionRateInput } from "@/components/ui/conversion-rate-input";
import { StandardUnitDisplay } from "@/components/ui/standard-unit-display";
import { ItemDialog } from "@/app/(dashboard)/item/item-dialog";
import { CategoryItemSelector } from "@/components/forms/category-item-selector";
import type { POLineItem, Item } from "@/types/database";

// For creating/editing - uses local state
interface LineItemFormData {
  id: string;
  category_id: string | null;
  item_id: string | null;
  item_name: string;
  item_sku?: string;
  item_unit?: string;
  item_price_reference?: string;
  item_standard_unit?: string;
  quantity: number;
  unit_price: number;
  conversion_rate: string;
}

interface EditableLineItemsTableProps {
  items: LineItemFormData[];
  availableItems: (Pick<Item, "id" | "name" | "sku" | "default_unit" | "price_reference"> & { standard_unit_rel?: { name: string } | null })[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItemFormData, value: unknown) => void;
  onItemCreated?: (newItem: Item) => void;
  currency?: string;
  disabled?: boolean;
}

export function EditableLineItemsTable({
  items,
  availableItems,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onItemCreated,
  currency = "MMK",
  disabled = false,
}: EditableLineItemsTableProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  // Get IDs of already selected items to filter from dropdown
  const selectedItemIds = new Set(items.map(i => i.item_id).filter(Boolean));

  const handleItemCreated = (newItem: Item) => {
    if (pendingLineId) {
      onUpdateItem(pendingLineId, "item_id", newItem.id);
      onUpdateItem(pendingLineId, "item_name", newItem.name);
      onUpdateItem(pendingLineId, "item_sku", newItem.sku || "");
      onUpdateItem(pendingLineId, "item_unit", newItem.default_unit || "");
    }
    onItemCreated?.(newItem);
    setCreateDialogOpen(false);
    setPendingLineId(null);
  };

  const handleCreateDialogClose = (refresh?: boolean, newItem?: Item) => {
    if (newItem) {
      handleItemCreated(newItem);
    } else {
      setCreateDialogOpen(false);
      setPendingLineId(null);
    }
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3"
        >
          {/* Row 1: Item selector + actions */}
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-slate-500 mt-2.5 shrink-0 w-5">
              {index + 1}.
            </span>
            <div className="flex-1 min-w-0">
              {item.item_id ? (
                <div className="flex items-center gap-2">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm cursor-default">
                          <code className="font-mono text-amber-400 mr-2">
                            {item.item_sku || "---"}
                          </code>
                          <span className="text-slate-400 mr-2">-</span>
                          <span className="text-slate-200">{item.item_name}</span>
                        </div>
                      </TooltipTrigger>
                      {item.item_price_reference && (
                        <TooltipContent side="top" className="max-w-xs">
                          <p className="text-xs">
                            <span className="text-slate-400">Price Ref: </span>
                            <span className="text-slate-200">{item.item_price_reference}</span>
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onUpdateItem(item.id, "category_id", null);
                      onUpdateItem(item.id, "item_id", null);
                      onUpdateItem(item.id, "item_name", "");
                      onUpdateItem(item.id, "item_sku", "");
                      onUpdateItem(item.id, "item_unit", "");
                      onUpdateItem(item.id, "item_price_reference", "");
                    }}
                    disabled={disabled}
                    className="h-8 px-2 text-slate-400 hover:text-slate-200"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <CategoryItemSelector
                      categoryId={item.category_id || ""}
                      itemId=""
                      onCategoryChange={(catId) => {
                        onUpdateItem(item.id, "category_id", catId);
                      }}
                      onItemChange={(itmId) => {
                        const selectedItem = availableItems.find(i => i.id === itmId);
                        if (selectedItem) {
                          onUpdateItem(item.id, "item_id", itmId);
                          onUpdateItem(item.id, "item_name", selectedItem.name);
                          onUpdateItem(item.id, "item_sku", selectedItem.sku || "");
                          onUpdateItem(item.id, "item_unit", selectedItem.default_unit || "");
                          onUpdateItem(item.id, "item_price_reference", selectedItem.price_reference || "");
                          onUpdateItem(item.id, "item_standard_unit", selectedItem.standard_unit_rel?.name || "");
                        }
                      }}
                      disabled={disabled}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setPendingLineId(item.id);
                      setCreateDialogOpen(true);
                    }}
                    disabled={disabled}
                    className="shrink-0 border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/10 self-start"
                    title="Create new item"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveItem(item.id)}
              disabled={disabled || items.length <= 1}
              className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Row 2: Qty, Unit Price, Conv. Rate, Std Qty, Line Total */}
          <div className="flex items-end gap-3 pl-7">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Qty</label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    onUpdateItem(
                      item.id,
                      "quantity",
                      Math.max(1, item.quantity - 1)
                    )
                  }
                  disabled={disabled || item.quantity <= 1}
                  className="h-8 w-8 border-slate-700 hover:bg-slate-700"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={item.quantity === 0 ? "" : item.quantity}
                  onChange={(e) =>
                    onUpdateItem(
                      item.id,
                      "quantity",
                      Math.max(1, Math.floor(parseInt(e.target.value) || 1))
                    )
                  }
                  onKeyDown={handleQuantityKeyDown}
                  disabled={disabled}
                  className="w-16 text-center font-mono bg-slate-800 border-slate-700"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    onUpdateItem(
                      item.id,
                      "quantity",
                      item.quantity + 1
                    )
                  }
                  disabled={disabled}
                  className="h-8 w-8 border-slate-700 hover:bg-slate-700"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Unit Price</label>
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
                className="w-32 text-right bg-slate-800 border-slate-700"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Conv. Rate</label>
              <ConversionRateInput
                value={item.conversion_rate}
                onValueChange={(val) => onUpdateItem(item.id, "conversion_rate", val)}
                className="w-28 text-right bg-slate-800 border-slate-700"
                disabled={disabled}
              />
            </div>
            {item.conversion_rate && parseFloat(item.conversion_rate) > 0 && item.quantity > 0 && (
              <div className="pb-2">
                <span className="text-xs font-mono text-slate-400">
                  = {(item.quantity * parseFloat(item.conversion_rate)).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  {item.item_standard_unit || ""}
                </span>
              </div>
            )}
            <div className="ml-auto text-right">
              <label className="text-xs text-slate-500 block mb-1">Line Total</label>
              <div className="py-2 px-3 font-mono text-emerald-400">
                {formatCurrency(item.quantity * item.unit_price)}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Subtotal */}
      <div className="flex items-center justify-end gap-4 pt-2 border-t border-slate-600">
        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Subtotal ({currency})
        </span>
        <span className="text-lg font-mono font-bold text-emerald-400">
          {formatCurrency(subtotal)}
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onAddItem}
        disabled={disabled}
        className="border-dashed border-slate-600 text-slate-400 hover:border-amber-500/50 hover:text-amber-400"
      >
        + Add Line Item
      </Button>

      <ItemDialog
        open={createDialogOpen}
        onClose={handleCreateDialogClose}
        item={null}
      />
    </div>
  );
}

// POLineItemProgress - stepped segment bar following ItemsSummaryProgress pattern
function POLineItemProgress({ ordered, invoiced, received }: {
  ordered: number;
  invoiced: number;
  received: number;
}) {
  const invoicedPercent = ordered > 0 ? Math.min(100, (invoiced / ordered) * 100) : 0;
  const receivedPercent = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;

  return (
    <div className="space-y-1.5">
      {/* Header: fraction text */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {received}/{ordered}
        </span>
      </div>

      {/* Stepped progress bar — wrapped in tooltip for quantity breakdown */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-5 w-full bg-slate-800/50 rounded-md overflow-hidden relative cursor-default">
              {/* Ordered baseline (full width, gray) */}
              <div
                className="absolute inset-y-0 left-0 bg-slate-600/30 transition-all duration-500"
                style={{ width: "100%" }}
              />
              {/* Invoiced segment (blue) */}
              <div
                className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
                style={{ width: `${invoicedPercent}%` }}
              />
              {/* Received segment (green, overlays invoiced) */}
              <div
                className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                style={{ width: `${receivedPercent}%` }}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
              <span className="text-slate-400">Ordered:</span>
              <span className="font-mono text-slate-200 ml-auto pl-3">{ordered}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span className="text-slate-400">Invoiced:</span>
              <span className="font-mono text-blue-300 ml-auto pl-3">{invoiced}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-400">Received:</span>
              <span className="font-mono text-emerald-300 ml-auto pl-3">{received}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Legend row with colored dots */}
      <div className="flex items-center gap-3 text-[10px]">
        <div className="flex items-center text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block mr-1" />
          {ordered}
        </div>
        <div className="flex items-center text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-1" />
          {invoiced}
        </div>
        <div className="flex items-center text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
          {received}
        </div>
      </div>
    </div>
  );
}

// For display - shows existing line items with progress
interface ReadonlyLineItemsTableProps {
  items: (POLineItem & { item?: Pick<Item, "id" | "name" | "sku"> | null; unit_name?: string })[];
  currency?: string;
  showProgress?: boolean;
}

export function ReadonlyLineItemsTable({
  items,
  currency = "MMK",
  showProgress = true,
}: ReadonlyLineItemsTableProps) {
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
            <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
              Unit Price
            </th>
            <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
              Line Total
            </th>
            {showProgress && (
              <th className="text-center py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-44">
                Progress
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
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
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-amber-400 text-xs">
                        {item.item_sku || item.item?.sku || "---"}
                      </code>
                      <span className="text-slate-500">-</span>
                      <span className="text-slate-200 font-medium">
                        {item.item_name || item.item?.name || "Unknown Item"}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-right">
                  <StandardUnitDisplay
                    quantity={item.quantity}
                    conversionRate={item.conversion_rate ?? 1}
                    unitName={item.unit_name}
                    size="sm"
                    align="right"
                  />
                </td>
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
                {showProgress && (
                  <td className="py-3 px-3">
                    <POLineItemProgress
                      ordered={item.quantity}
                      invoiced={item.invoiced_quantity ?? 0}
                      received={item.received_quantity ?? 0}
                    />
                  </td>
                )}
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
            <td className="py-3 px-3 text-right" colSpan={showProgress ? 2 : 1}>
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Subtotal ({currency})
              </span>
            </td>
            <td className="py-3 px-3 text-right">
              <span className="text-lg font-mono font-bold text-emerald-400">
                {formatCurrency(subtotal)}
              </span>
            </td>
            {showProgress && <td></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
