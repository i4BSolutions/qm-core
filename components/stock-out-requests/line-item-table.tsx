"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ChevronDown, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineItemProgressBar } from "./line-item-progress-bar";
import type { Enums } from "@/types/database";

// Type for line item status
type SorLineItemStatus = Enums<"sor_line_item_status">;

/**
 * L2 assignment data nested inside an L1 approval
 */
export interface L2AssignmentData {
  id: string;
  warehouse_name: string;
  approved_quantity: number;
  is_executed: boolean;
}

/**
 * L1 approval data attached to a line item
 */
export interface L1ApprovalData {
  id: string;
  approved_quantity: number;
  total_l2_assigned: number;
  l2_assignments: L2AssignmentData[];
}

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
  // L1 approvals with their L2 children (for expandable section and L2 dialog)
  l1Approvals?: L1ApprovalData[];
}

interface LineItemTableProps {
  items: LineItemWithApprovals[];
  canApprove: boolean;
  onApproveItem: (item: LineItemWithApprovals) => void;
  onRejectItem: (item: LineItemWithApprovals) => void;
  onAssignWarehouse?: (
    item: LineItemWithApprovals,
    l1Approval: { id: string; approved_quantity: number; total_l2_assigned: number }
  ) => void;
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
  onReject: (item: LineItemWithApprovals) => void,
  onAssignWarehouse?: (
    item: LineItemWithApprovals,
    l1Approval: { id: string; approved_quantity: number; total_l2_assigned: number }
  ) => void
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
    // Find L1 approvals with remaining unassigned qty
    const l1WithRemaining = (item.l1Approvals || []).find(
      (l1) => l1.approved_quantity - l1.total_l2_assigned > 0
    );

    const unassignedL1 = item.total_approved_quantity - item.l2_assigned_quantity;

    if (unassignedL1 > 0 && l1WithRemaining) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 text-xs h-7 px-2"
          onClick={() =>
            onAssignWarehouse?.(item, {
              id: l1WithRemaining.id,
              approved_quantity: l1WithRemaining.approved_quantity,
              total_l2_assigned: l1WithRemaining.total_l2_assigned,
            })
          }
        >
          <Warehouse className="w-3 h-3 mr-1" />
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
 * approval (L1 qty-only), rejection, and L2 warehouse assignment.
 *
 * Rows are expandable to show warehouse assignments per line item.
 *
 * Columns: Item | SKU | Requested | Approved | Rejected | Remaining | Status | Progress | Action
 */
export function LineItemTable({
  items,
  canApprove,
  onApproveItem,
  onRejectItem,
  onAssignWarehouse,
}: LineItemTableProps) {
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const colSpan = canApprove ? 10 : 9;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="pb-3 w-8" />
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
                colSpan={colSpan}
                className="py-8 text-center text-slate-500"
              >
                No line items found
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const config = resolveStatusConfig(item);
              const rowAction = getRowAction(
                item,
                canApprove,
                onApproveItem,
                onRejectItem,
                onAssignWarehouse
              );
              const isExpanded = expandedItemIds.has(item.id);

              // Check if this item has any L2 assignments to show
              const hasL2 =
                (item.l1Approvals || []).some(
                  (l1) => l1.l2_assignments.length > 0
                );

              return (
                <>
                  <tr
                    key={item.id}
                    className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Expand toggle */}
                    <td className="py-4 pr-1 w-8">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
                        aria-label={isExpanded ? "Collapse" : "Expand warehouse assignments"}
                      >
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            isExpanded && "rotate-180"
                          )}
                        />
                      </button>
                    </td>

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

                  {/* Expandable warehouse assignments section */}
                  {isExpanded && (
                    <tr key={`${item.id}-expanded`} className="border-b border-slate-800">
                      <td colSpan={colSpan} className="py-3 px-4 bg-slate-900/40">
                        <div className="pl-6">
                          <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                            Warehouse Assignments
                          </div>
                          {!hasL2 ? (
                            <div className="text-xs text-slate-500 italic">
                              No warehouse assignments yet
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {(item.l1Approvals || []).flatMap((l1) =>
                                l1.l2_assignments.map((l2) => (
                                  <div
                                    key={l2.id}
                                    className="flex items-center gap-3 text-xs text-slate-400"
                                  >
                                    <span className="font-medium text-slate-300">
                                      {l2.warehouse_name}:
                                    </span>
                                    <span className="font-mono">
                                      {l2.approved_quantity} units
                                    </span>
                                    {l2.is_executed ? (
                                      <Badge
                                        variant="outline"
                                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs py-0 px-2"
                                      >
                                        Executed
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs py-0 px-2"
                                      >
                                        Pending
                                      </Badge>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
