"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface WarehouseAssignmentsTabProps {
  assignments: WarehouseAssignment[];
  pendingL1Approvals: PendingL1Approval[];
  canAssign: boolean;
  canExecute: boolean;
  onAssignWarehouse: (pending: PendingL1Approval) => void;
  onExecute: (assignment: WarehouseAssignment) => void;
  isExecuting: boolean;
}

/**
 * Warehouse Assignments Tab
 *
 * Two sections:
 *
 * 1. "Pending Assignment" — L1 approval records whose L1-approved qty is not yet
 *    fully covered by L2 warehouse assignments. Each row has an "Assign Warehouse"
 *    button to open the L2WarehouseDialog. This is the ONLY place warehouse
 *    assignment is initiated.
 *
 * 2. "Warehouse Assignments" — existing L2 approval records (one per warehouse
 *    assignment). Each row shows the assigned warehouse, qty, status, and an
 *    "Execute" button for pending assignments (when canExecute).
 *
 * Both sections are grouped by line item.
 */
export function WarehouseAssignmentsTab({
  assignments,
  pendingL1Approvals,
  canAssign,
  canExecute,
  onAssignWarehouse,
  onExecute,
  isExecuting,
}: WarehouseAssignmentsTabProps) {
  const hasPending = pendingL1Approvals.length > 0;
  const hasAssignments = assignments.length > 0;

  if (!hasPending && !hasAssignments) {
    return (
      <div className="text-center py-12 text-slate-500">
        No warehouse assignments yet. Once quantities are approved, admins can
        assign warehouses to each approval record here.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===================================================================
          SECTION 1: L1 Approvals Pending Warehouse Assignment
          =================================================================== */}
      {hasPending && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Pending Warehouse Assignment
            </h4>
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

            return Array.from(groups.entries()).map(([lineItemId, group]) => (
              <div key={lineItemId} className="space-y-2">
                {/* Group header */}
                <div className="flex items-center gap-2 pb-1 border-b border-slate-700">
                  <h5 className="font-medium text-slate-200 text-sm">
                    {group.item_name || "Unknown Item"}
                  </h5>
                  {group.item_sku && (
                    <span className="font-mono text-xs text-slate-500">
                      ({group.item_sku})
                    </span>
                  )}
                </div>

                {/* One row per L1 approval record */}
                <div className="space-y-2">
                  {group.items.map((pending) => (
                    <div
                      key={pending.l1_approval_id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg bg-amber-950/20 border border-amber-800/30"
                    >
                      <div className="flex items-center gap-6 flex-1 min-w-0">
                        {/* L1 approved qty */}
                        <div className="flex-shrink-0">
                          <div className="text-xs text-slate-500 mb-0.5">L1 Approved</div>
                          <div className="font-mono text-sm text-slate-200">
                            {pending.l1_approved_quantity}
                            {pending.unit_name && pending.conversion_rate > 1 && (
                              <span className="text-slate-400 text-xs ml-1">
                                ({(pending.l1_approved_quantity * pending.conversion_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pending.unit_name})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Already assigned */}
                        <div className="flex-shrink-0">
                          <div className="text-xs text-slate-500 mb-0.5">Assigned</div>
                          <div className="font-mono text-sm text-purple-400">
                            {pending.total_l2_assigned}
                          </div>
                        </div>

                        {/* Remaining */}
                        <div className="flex-shrink-0">
                          <div className="text-xs text-slate-500 mb-0.5">Remaining</div>
                          <div className="font-mono text-sm text-amber-400 font-medium">
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
            ));
          })()}
        </div>
      )}

      {/* ===================================================================
          SECTION 2: Existing L2 Warehouse Assignments
          =================================================================== */}
      {hasAssignments && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Warehouse Assignments
            </h4>
          </div>

          {/* Group existing L2 assignments by line item */}
          {(() => {
            const groups = new Map<
              string,
              { item_name: string; item_sku: string | null; assignments: WarehouseAssignment[] }
            >();
            for (const a of assignments) {
              const key = a.line_item_id;
              if (!groups.has(key)) {
                groups.set(key, {
                  item_name: a.item_name,
                  item_sku: a.item_sku,
                  assignments: [],
                });
              }
              groups.get(key)!.assignments.push(a);
            }

            return Array.from(groups.entries()).map(([lineItemId, group]) => (
              <div key={lineItemId} className="space-y-2">
                {/* Group header */}
                <div className="flex items-center gap-2 pb-1 border-b border-slate-700">
                  <h5 className="font-medium text-slate-200 text-sm">
                    {group.item_name || "Unknown Item"}
                  </h5>
                  {group.item_sku && (
                    <span className="font-mono text-xs text-slate-500">
                      ({group.item_sku})
                    </span>
                  )}
                  <span className="text-xs text-slate-600 ml-auto">
                    {group.assignments.length} assignment{group.assignments.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Assignment rows */}
                <div className="space-y-2">
                  {group.assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/40 border border-slate-700/50"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Warehouse */}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">
                            {assignment.warehouse_name}
                          </div>
                        </div>

                        {/* Qty */}
                        <div className="flex-shrink-0">
                          <div className="font-mono text-sm text-slate-200">
                            {assignment.approved_quantity}
                          </div>
                          {assignment.unit_name && assignment.conversion_rate > 1 && (
                            <div className="text-xs font-mono text-slate-400">
                              {(
                                assignment.approved_quantity * assignment.conversion_rate
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              {assignment.unit_name}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Status badge */}
                        {assignment.is_executed ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs"
                          >
                            Executed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs"
                          >
                            Pending Execution
                          </Badge>
                        )}

                        {/* Execute button — only for pending rows when canExecute */}
                        {!assignment.is_executed && canExecute && (
                          <Button
                            size="sm"
                            onClick={() => onExecute(assignment)}
                            disabled={isExecuting}
                            className={cn(
                              "bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7 px-3",
                              isExecuting && "opacity-60"
                            )}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Execute
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
