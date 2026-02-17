"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineItemProgressBar } from "./line-item-progress-bar";
import type { Enums } from "@/types/database";

// Type for line item status
type SorLineItemStatus = Enums<"sor_line_item_status">;

/**
 * Extended line item type with computed totals from approvals (two-layer aware)
 */
export interface LineItemWithApprovals {
  id: string;
  item_id: string;
  item_name: string | null;
  item_sku: string | null;
  requested_quantity: number;
  conversion_rate: number;
  status: SorLineItemStatus;
  // L1 (quartermaster layer) totals:
  total_approved_quantity: number;
  total_rejected_quantity: number;
  remaining_quantity: number; // requested - L1 approved - rejected
  // L2 (admin layer) totals:
  l2_assigned_quantity: number; // total qty assigned to warehouses via L2
  executed_quantity: number;    // total qty executed (completed inventory_transactions)
  // Legacy / info fields:
  assigned_warehouse_name: string | null;
  unit_name?: string;
}

interface LineItemTableProps {
  items: LineItemWithApprovals[];
  canApprove: boolean;
  onApproveItem: (item: LineItemWithApprovals) => void;
  onRejectItem: (item: LineItemWithApprovals) => void;
}

/**
 * Status badge configuration for all sor_line_item_status enum values
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
    // Legacy backward-compat entry
    label: "Approved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
  },
  awaiting_admin: {
    // Dynamic: "Qty Approved" when l2_assigned_quantity === 0, "Warehouse Assigned" when > 0
    // Default label set here; rendering logic overrides it
    label: "Qty Approved",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
  },
  fully_approved: {
    label: "Ready to Execute",
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
 * Resolve dynamic badge label and colors for awaiting_admin status.
 * When L2 warehouse has been assigned, show "Warehouse Assigned" (purple).
 * When no L2 assignment yet, show "Qty Approved" (blue).
 */
function resolveStatusConfig(item: LineItemWithApprovals): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (
    item.status === "awaiting_admin" &&
    item.l2_assigned_quantity > 0
  ) {
    return {
      label: "Warehouse Assigned",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/30",
    };
  }
  return STATUS_CONFIG[item.status];
}

/**
 * Determine the action button to render for a row.
 * Returns null if no action is available.
 */
function getRowAction(
  item: LineItemWithApprovals,
  canApprove: boolean,
  onApprove: (item: LineItemWithApprovals) => void,
  onReject: (item: LineItemWithApprovals) => void
): React.ReactNode {
  if (!canApprove) return null;

  if (item.status === "pending") {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs h-7 px-2"
          onClick={() => onApprove(item)}
        >
          <Check className="w-3 h-3 mr-1" />
          Approve Qty
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-7 w-7 p-0"
          onClick={() => onReject(item)}
          aria-label="Reject"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (item.status === "awaiting_admin" && canApprove) {
    // Check if there's remaining L1 qty not yet covered by L2
    const unassignedL1 = item.total_approved_quantity - item.l2_assigned_quantity;
    if (unassignedL1 > 0) {
      // Plan 02 will wire the L2 dialog; for now render a placeholder disabled button
      return (
        <Button
          size="sm"
          variant="outline"
          disabled
          className="border-purple-500/50 text-purple-400 text-xs h-7 px-2 opacity-60"
          title="Warehouse assignment coming in next plan"
        >
          Assign WH
        </Button>
      );
    }
    // All L1 qty covered by L2 — show a static badge
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono"
      >
        Ready to Execute
      </Badge>
    );
  }

  if (item.status === "fully_approved") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono"
      >
        Ready to Execute
      </Badge>
    );
  }

  if (item.status === "executed") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono"
      >
        Executed
      </Badge>
    );
  }

  if (item.status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono"
      >
        Rejected
      </Badge>
    );
  }

  return null;
}

/**
 * Line Item Table Component
 *
 * Shows stock-out request line items with per-row action buttons for
 * approval (L1 qty-only) and rejection. Batch checkbox selection and
 * floating action bar have been removed entirely.
 *
 * Columns: Item | SKU | Requested | Approved | Rejected | Remaining | Status | Progress | Action
 */
export function LineItemTable({
  items,
  canApprove,
  onApproveItem,
  onRejectItem,
}: LineItemTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
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
            <th className="pb-3 text-left font-medium text-sm text-slate-400 min-w-[120px]">
              Progress
            </th>
            {canApprove && (
              <th className="pb-3 text-left font-medium text-sm text-slate-400">
                Action
              </th>
            )}
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
              const config = resolveStatusConfig(item);
              const rowAction = getRowAction(item, canApprove, onApproveItem, onRejectItem);

              return (
                <tr
                  key={item.id}
                  className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                >
                  {/* Item Name */}
                  <td className="py-4">
                    <div className="font-medium text-slate-200">
                      {item.item_name || "Unknown Item"}
                    </div>
                  </td>

                  {/* SKU */}
                  <td className="py-4">
                    <div className="font-mono text-sm text-slate-400">
                      {item.item_sku || "—"}
                    </div>
                  </td>

                  {/* Requested */}
                  <td className="py-4 text-right">
                    <div className="font-mono text-slate-200">
                      {item.requested_quantity}
                    </div>
                    {item.unit_name && (
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        {(
                          item.requested_quantity * item.conversion_rate
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {item.unit_name}
                      </div>
                    )}
                  </td>

                  {/* Approved (L1) */}
                  <td className="py-4 text-right">
                    <div className="font-mono text-slate-200">
                      {item.total_approved_quantity}
                    </div>
                    {item.unit_name && (
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        {(
                          item.total_approved_quantity * item.conversion_rate
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {item.unit_name}
                      </div>
                    )}
                  </td>

                  {/* Rejected */}
                  <td className="py-4 text-right">
                    <div
                      className={cn(
                        "font-mono",
                        item.total_rejected_quantity > 0
                          ? "text-red-400"
                          : "text-slate-500"
                      )}
                    >
                      {item.total_rejected_quantity}
                    </div>
                    {item.unit_name && (
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        {(
                          item.total_rejected_quantity * item.conversion_rate
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {item.unit_name}
                      </div>
                    )}
                  </td>

                  {/* Remaining */}
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
                        {(
                          item.remaining_quantity * item.conversion_rate
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {item.unit_name}
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
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

                  {/* Progress Bar */}
                  <td className="py-4 min-w-[120px] pr-4">
                    <LineItemProgressBar
                      requestedQty={item.requested_quantity}
                      l1ApprovedQty={item.total_approved_quantity}
                      l2AssignedQty={item.l2_assigned_quantity}
                      executedQty={item.executed_quantity}
                    />
                  </td>

                  {/* Action Column (only when canApprove) */}
                  {canApprove && (
                    <td className="py-4">
                      {rowAction}
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
