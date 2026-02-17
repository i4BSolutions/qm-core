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
  // L1 approvals with their L2 children (for L2 dialog)
  l1Approvals?: L1ApprovalData[];
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
 * Format a unit conversion line, e.g. "= 5,000.00 kg"
 */
function formatConversion(qty: number, rate: number, unitName?: string): string | null {
  if (!unitName || rate <= 1) return null;
  return `${(qty * rate).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${unitName}`;
}

/**
 * Line Item Table Component — Two-Row Compact Layout
 *
 * Each item renders as a card-like row block:
 * Row 1: Item name | Status badge | Progress bar | Action buttons
 * Row 2: SKU · Req: N · App: N · Rej: N · Rem: N [· = X unit]
 */
export function LineItemTable({
  items,
  canApprove,
  onApproveItem,
  onRejectItem,
}: LineItemTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Line Items</h3>
        <p className="text-sm text-slate-400">This request has no line items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const config = resolveStatusConfig(item);
        const conversion = formatConversion(
          item.requested_quantity,
          item.conversion_rate,
          item.unit_name
        );

        return (
          <div
            key={item.id}
            className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 hover:bg-slate-800/50 transition-colors"
          >
            {/* Row 1: Item name + Status + Progress + Actions */}
            <div className="flex items-center gap-3">
              <div className="font-medium text-slate-200 min-w-0 truncate flex-shrink-0 max-w-[280px]">
                {item.item_name || "Unknown Item"}
              </div>

              <Badge
                variant="outline"
                className={cn(
                  "border font-mono text-xs flex-shrink-0",
                  config.bgColor,
                  config.color
                )}
              >
                {config.label}
              </Badge>

              <div className="flex-1 min-w-[120px] max-w-[260px]">
                <LineItemProgressBar
                  requestedQty={item.requested_quantity}
                  l1ApprovedQty={item.total_approved_quantity}
                  l2AssignedQty={item.l2_assigned_quantity}
                  executedQty={item.executed_quantity}
                />
              </div>

              <div className="ml-auto flex-shrink-0">
                {canApprove && item.status === "pending" && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs h-7 px-2"
                      onClick={() => onApproveItem(item)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Approve Qty
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-7 w-7 p-0"
                      onClick={() => onRejectItem(item)}
                      aria-label="Reject"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: SKU + quantity summary */}
            <div className="mt-2 flex items-center gap-1 text-sm text-slate-400 font-mono flex-wrap">
              {item.item_sku && (
                <>
                  <span className="text-slate-500">{item.item_sku}</span>
                  <span className="text-slate-600 mx-1">&middot;</span>
                </>
              )}
              <span>
                Req: <span className="text-slate-300">{item.requested_quantity}</span>
              </span>
              <span className="text-slate-600 mx-1">&middot;</span>
              <span>
                App: <span className="text-slate-300">{item.total_approved_quantity}</span>
              </span>
              <span className="text-slate-600 mx-1">&middot;</span>
              <span>
                Rej: <span className={item.total_rejected_quantity > 0 ? "text-red-400" : "text-slate-500"}>{item.total_rejected_quantity}</span>
              </span>
              <span className="text-slate-600 mx-1">&middot;</span>
              <span>
                Rem: <span className={item.remaining_quantity > 0 ? "text-amber-400" : "text-slate-500"}>{item.remaining_quantity}</span>
              </span>
              {conversion && (
                <>
                  <span className="text-slate-600 mx-1">&middot;</span>
                  <span className="text-slate-500">= {conversion}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
