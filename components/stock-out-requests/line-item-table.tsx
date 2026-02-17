"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

// Type for line item status
type SorLineItemStatus = Enums<"sor_line_item_status">;

/**
 * Extended line item type with computed totals from approvals
 */
export interface LineItemWithApprovals {
  id: string;
  item_id: string;
  item_name: string | null;
  item_sku: string | null;
  requested_quantity: number;
  conversion_rate: number;
  status: SorLineItemStatus;
  // Computed from joined approvals:
  total_approved_quantity: number;
  total_rejected_quantity: number;
  remaining_quantity: number; // requested - total_approved - total_rejected
  // Latest warehouse assignment (from most recent approval):
  assigned_warehouse_name: string | null;
  unit_name?: string;
}

interface LineItemTableProps {
  items: LineItemWithApprovals[];
  canApprove: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onApproveClick: () => void;
  onRejectClick: () => void;
}

/**
 * Status badge colors for line item statuses
 */
const STATUS_CONFIG: Record<
  SorLineItemStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
  },
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
  },
  awaiting_admin: {
    label: "Awaiting Admin",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
  },
  fully_approved: {
    label: "Fully Approved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10 border-slate-500/30",
  },
  partially_executed: {
    label: "Partially Executed",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
  },
  executed: {
    label: "Executed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
  },
};

/**
 * Determine if a line item can be selected for approval
 *
 * A line item can be approved if:
 * - It has remaining quantity to approve (requested > already approved)
 * - AND it's not cancelled or fully executed
 */
function canSelectForApproval(item: LineItemWithApprovals): boolean {
  return (
    item.remaining_quantity > 0 &&
    item.status !== "cancelled" &&
    item.status !== "executed"
  );
}

/**
 * Determine if a line item can be selected for rejection
 * Same logic as approval: has remaining qty and not cancelled/executed
 */
function canSelectForRejection(item: LineItemWithApprovals): boolean {
  return (
    item.remaining_quantity > 0 &&
    item.status !== "cancelled" &&
    item.status !== "executed"
  );
}

/**
 * Line Item Table Component
 *
 * Shows stock-out request line items with selection checkboxes, status badges,
 * and action buttons for approval/rejection.
 */
export function LineItemTable({
  items,
  canApprove,
  selectedIds,
  onSelectionChange,
  onApproveClick,
  onRejectClick,
}: LineItemTableProps) {
  // Determine selectable items
  const selectableForApproval = items.filter(canSelectForApproval);
  const selectableForRejection = items.filter(canSelectForRejection);

  // Check if all selectable items are selected
  const allSelected =
    selectableForApproval.length > 0 &&
    selectableForApproval.every((item) => selectedIds.has(item.id));

  // Handle select all toggle
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelection = new Set<string>();
      selectableForApproval.forEach((item) => newSelection.add(item.id));
      onSelectionChange(newSelection);
    } else {
      onSelectionChange(new Set());
    }
  };

  // Handle individual item selection
  const handleItemSelect = (itemId: string, checked: boolean) => {
    const newSelection = new Set(selectedIds);
    if (checked) {
      newSelection.add(itemId);
    } else {
      newSelection.delete(itemId);
    }
    onSelectionChange(newSelection);
  };

  // Check if selected items can be approved (all have remaining > 0)
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const canApproveSelected = selectedItems.every(
    (item) => item.remaining_quantity > 0
  );

  // Check if selected items can be rejected (all have remaining qty)
  const canRejectSelected = selectedItems.every(
    (item) => item.remaining_quantity > 0
  );

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              {canApprove && (
                <th className="pb-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    disabled={selectableForApproval.length === 0}
                    aria-label="Select all items"
                    className="h-4 w-4 rounded border-slate-600 accent-amber-500"
                  />
                </th>
              )}
              <th className="pb-3 text-left font-medium text-sm text-slate-400">
                Item
              </th>
              <th className="pb-3 text-left font-medium text-sm text-slate-400">
                SKU
              </th>
              <th className="pb-3 text-right font-medium text-sm text-slate-400">
                Requested
              </th>
              <th className="pb-3 text-right font-medium text-sm text-slate-400">
                Approved
              </th>
              <th className="pb-3 text-right font-medium text-sm text-slate-400">
                Rejected
              </th>
              <th className="pb-3 text-right font-medium text-sm text-slate-400">
                Remaining
              </th>
              <th className="pb-3 text-left font-medium text-sm text-slate-400">
                Status
              </th>
              <th className="pb-3 text-left font-medium text-sm text-slate-400">
                Warehouse
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={canApprove ? 9 : 8}
                  className="py-8 text-center text-slate-500"
                >
                  No line items found
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const config = STATUS_CONFIG[item.status];
                const isSelectable =
                  canSelectForApproval(item) || canSelectForRejection(item);
                const isSelected = selectedIds.has(item.id);

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-slate-800 hover:bg-slate-800/30 transition-colors",
                      isSelected && "bg-amber-500/5"
                    )}
                  >
                    {canApprove && (
                      <td className="py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            handleItemSelect(item.id, e.target.checked)
                          }
                          disabled={!isSelectable}
                          aria-label={`Select ${item.item_name}`}
                          className="h-4 w-4 rounded border-slate-600 accent-amber-500"
                        />
                      </td>
                    )}
                    <td className="py-4">
                      <div className="font-medium text-slate-200">
                        {item.item_name || "Unknown Item"}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="font-mono text-sm text-slate-400">
                        {item.item_sku || "—"}
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <div className="font-mono text-slate-200">
                        {item.requested_quantity}
                      </div>
                      {item.unit_name && (
                        <div className="text-xs font-mono text-slate-400 mt-1">
                          {(item.requested_quantity * item.conversion_rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.unit_name}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div className="font-mono text-slate-200">
                        {item.total_approved_quantity}
                      </div>
                      {item.unit_name && (
                        <div className="text-xs font-mono text-slate-400 mt-1">
                          {(item.total_approved_quantity * item.conversion_rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.unit_name}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div className={cn(
                        "font-mono",
                        item.total_rejected_quantity > 0
                          ? "text-red-400"
                          : "text-slate-500"
                      )}>
                        {item.total_rejected_quantity}
                      </div>
                      {item.unit_name && (
                        <div className="text-xs font-mono text-slate-400 mt-1">
                          {(item.total_rejected_quantity * item.conversion_rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.unit_name}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div
                        className={cn(
                          "font-mono",
                          item.remaining_quantity > 0
                            ? "text-amber-400"
                            : "text-slate-500"
                        )}
                      >
                        {item.remaining_quantity}
                      </div>
                      {item.unit_name && (
                        <div className="text-xs font-mono text-slate-400 mt-1">
                          {(item.remaining_quantity * item.conversion_rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.unit_name}
                        </div>
                      )}
                    </td>
                    <td className="py-4">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border font-mono text-xs",
                          config.bgColor,
                          config.color
                        )}
                      >
                        {config.label}
                      </Badge>
                    </td>
                    <td className="py-4">
                      <div className="text-sm text-slate-400">
                        {item.assigned_warehouse_name || "—"}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Action Bar (shown when items are selected) */}
      {canApprove && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-6 py-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <div className="text-sm text-amber-200 font-medium">
                {selectedIds.size} line item{selectedIds.size !== 1 ? "s" : ""}{" "}
                selected
              </div>
              <div className="flex items-center gap-3">
                {canApproveSelected && (
                  <Button
                    onClick={onApproveClick}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve Selected
                  </Button>
                )}
                {canRejectSelected && (
                  <Button
                    onClick={onRejectClick}
                    variant="destructive"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject Selected
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
