"use client";

import { Trash2, Package, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { MiniProgressBar } from "./po-progress-bar";
import { calculateLineItemProgress } from "@/lib/utils/po-status";
import type { POLineItem, Item } from "@/types/database";

// For creating/editing - uses local state
interface LineItemFormData {
  id: string;
  item_id: string | null;
  item_name: string;
  item_sku?: string;
  item_unit?: string;
  quantity: number;
  unit_price: number;
}

interface EditableLineItemsTableProps {
  items: LineItemFormData[];
  availableItems: Pick<Item, "id" | "name" | "sku" | "default_unit">[];
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, field: keyof LineItemFormData, value: unknown) => void;
  currency?: string;
  disabled?: boolean;
}

export function EditableLineItemsTable({
  items,
  availableItems,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  currency = "MMK",
  disabled = false,
}: EditableLineItemsTableProps) {
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
                Qty
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
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-700/50 hover:bg-slate-800/30"
              >
                <td className="py-2 px-3 min-w-[200px]">
                  {item.item_id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm text-slate-200">
                        {item.item_name}
                        {item.item_sku && (
                          <code className="text-xs text-amber-400 ml-2">
                            ({item.item_sku})
                          </code>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onUpdateItem(item.id, "item_id", null);
                          onUpdateItem(item.id, "item_name", "");
                          onUpdateItem(item.id, "item_sku", "");
                          onUpdateItem(item.id, "item_unit", "");
                        }}
                        disabled={disabled}
                        className="h-8 px-2 text-slate-400 hover:text-slate-200"
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const selectedItem = availableItems.find(
                          (i) => i.id === value
                        );
                        if (selectedItem) {
                          onUpdateItem(item.id, "item_id", value);
                          onUpdateItem(item.id, "item_name", selectedItem.name);
                          onUpdateItem(item.id, "item_sku", selectedItem.sku || "");
                          onUpdateItem(item.id, "item_unit", selectedItem.default_unit || "");
                        }
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-full bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Select item..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems.map((avail) => (
                          <SelectItem key={avail.id} value={avail.id}>
                            {avail.name}
                            {avail.sku && ` (${avail.sku})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </td>
                <td className="py-2 px-3">
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
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateItem(
                          item.id,
                          "quantity",
                          Math.max(1, Math.floor(parseInt(e.target.value) || 1))
                        )
                      }
                      disabled={disabled}
                      className="w-16 text-center font-mono bg-slate-800 border-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                </td>
                <td className="py-2 px-3">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      onUpdateItem(
                        item.id,
                        "unit_price",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    disabled={disabled}
                    className="w-32 text-right font-mono bg-slate-800 border-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    disabled={disabled || items.length <= 1}
                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-600">
              <td colSpan={3} className="py-3 px-3 text-right">
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
        </table>
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
    </div>
  );
}

// For display - shows existing line items with progress
interface ReadonlyLineItemsTableProps {
  items: (POLineItem & { item?: Pick<Item, "id" | "name" | "sku"> | null })[];
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
              <th className="text-center py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-40">
                Progress
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const progress = calculateLineItemProgress(
              item.quantity,
              item.invoiced_quantity ?? 0,
              item.received_quantity ?? 0
            );

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
                  <span className="font-mono text-slate-200">
                    {item.quantity}
                  </span>
                  {item.item_unit && (
                    <span className="text-xs text-slate-400 ml-1">
                      {item.item_unit}
                    </span>
                  )}
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
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-8">Inv</span>
                        <MiniProgressBar
                          percent={progress.invoicedPercent}
                          color="amber"
                        />
                        <span className="text-xs font-mono text-amber-400 w-10 text-right">
                          {progress.invoicedPercent}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-8">Rcv</span>
                        <MiniProgressBar
                          percent={progress.receivedPercent}
                          color="emerald"
                        />
                        <span className="text-xs font-mono text-emerald-400 w-10 text-right">
                          {progress.receivedPercent}%
                        </span>
                      </div>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-600">
            <td
              colSpan={showProgress ? 3 : 3}
              className="py-3 px-3 text-right"
            >
              <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                Total ({currency})
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
