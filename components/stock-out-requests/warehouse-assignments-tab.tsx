"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Warehouse } from "lucide-react";
import { LineItemProgressBar } from "./line-item-progress-bar";

export interface WarehouseAssignment {
  id: string; // L2 approval id
  line_item_id: string;
  item_name: string;
  item_sku: string | null;
  item_id: string;
  warehouse_name: string;
  warehouse_id: string;
  approved_quantity: number;
  conversion_rate: number;
  unit_name?: string;
  is_executed: boolean;
  inventory_transaction_id?: string;
}

/**
 * A single L1 approval record that is awaiting warehouse assignment.
 * Shown in the "Pending Assignment" section of the Warehouse Assignments tab.
 */
export interface PendingL1Approval {
  l1_approval_id: string;
  line_item_id: string;
  item_name: string;
  item_sku: string | null;
  item_id: string;
  l1_approved_quantity: number;
  total_l2_assigned: number;
  remaining_to_assign: number;
  conversion_rate: number;
  unit_name?: string;
}

export interface LineItemProgress {
  requestedQty: number;
  l1ApprovedQty: number;
  l2AssignedQty: number;
  executedQty: number;
}

interface WarehouseAssignmentsTabProps {
  pendingL1Approvals: PendingL1Approval[];
  canAssign: boolean;
  onAssignWarehouse: (pending: PendingL1Approval) => void;
  lineItemProgress?: Record<string, LineItemProgress>;
}

/**
 * Warehouse Assignments Tab — Pure L2 Tab
 *
 * Shows L1 approval records whose L1-approved qty is not yet fully covered
 * by L2 warehouse assignments. Each row has an "Assign Warehouse" button
 * to open the L2WarehouseDialog. This is the ONLY place warehouse
 * assignment is initiated.
 */
export function WarehouseAssignmentsTab({
  pendingL1Approvals,
  canAssign,
  onAssignWarehouse,
  lineItemProgress,
}: WarehouseAssignmentsTabProps) {
  if (pendingL1Approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
          <Warehouse className="h-8 w-8 text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Pending Assignments</h3>
        <p className="text-sm text-slate-400 max-w-md">
          Once quantities are approved, admins can assign warehouses to each approval record here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
          Pending Warehouse Assignment
        </p>
        <Badge
          variant="outline"
          className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs"
        >
          {pendingL1Approvals.length} pending
        </Badge>
      </div>

      {/* Group pending L1 approvals by line item */}
      {(() => {
        const groups = new Map<
          string,
          { item_name: string; item_sku: string | null; items: PendingL1Approval[] }
        >();
        for (const p of pendingL1Approvals) {
          const key = p.line_item_id;
          if (!groups.has(key)) {
            groups.set(key, {
              item_name: p.item_name,
              item_sku: p.item_sku,
              items: [],
            });
          }
          groups.get(key)!.items.push(p);
        }

        return Array.from(groups.entries()).map(([lineItemId, group]) => {
          const progress = lineItemProgress?.[lineItemId];

          return (
            <div key={lineItemId} className="space-y-2">
              {/* Group header with progress bar */}
              <div className="flex items-center gap-3 pb-1 border-b border-slate-700">
                <h5 className="font-medium text-slate-200 flex-shrink-0">
                  {group.item_name || "Unknown Item"}
                </h5>
                {group.item_sku && (
                  <span className="font-mono text-xs text-slate-500 flex-shrink-0">
                    ({group.item_sku})
                  </span>
                )}
                {progress && (
                  <div className="flex-1 min-w-[120px] max-w-[260px]">
                    <LineItemProgressBar
                      requestedQty={progress.requestedQty}
                      l1ApprovedQty={progress.l1ApprovedQty}
                      l2AssignedQty={progress.l2AssignedQty}
                      executedQty={progress.executedQty}
                    />
                  </div>
                )}
              </div>

              {/* One row per L1 approval record */}
              <div className="space-y-2">
                {group.items.map((pending) => (
                  <div
                    key={pending.l1_approval_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800/30 border border-slate-700/50"
                  >
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                      {/* L1 approved qty */}
                      <div className="flex-shrink-0">
                        <div className="text-xs text-slate-500 mb-0.5">L1 Approved</div>
                        <div className="font-mono text-slate-200">
                          {pending.l1_approved_quantity}
                          {pending.unit_name && pending.conversion_rate !== 1 && pending.conversion_rate > 0 && (
                            <span className="text-slate-400 text-xs ml-1">
                              ({(pending.l1_approved_quantity * pending.conversion_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pending.unit_name})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Already assigned */}
                      <div className="flex-shrink-0">
                        <div className="text-xs text-slate-500 mb-0.5">Assigned</div>
                        <div className="font-mono text-purple-400">
                          {pending.total_l2_assigned}
                        </div>
                      </div>

                      {/* Remaining */}
                      <div className="flex-shrink-0">
                        <div className="text-xs text-slate-500 mb-0.5">Remaining</div>
                        <div className="font-mono text-amber-400 font-medium">
                          {pending.remaining_to_assign}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs"
                      >
                        Awaiting Assignment
                      </Badge>

                      {canAssign && (
                        <Button
                          size="sm"
                          onClick={() => onAssignWarehouse(pending)}
                          className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-7 px-3"
                        >
                          <Warehouse className="w-3 h-3 mr-1" />
                          Assign Warehouse
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
