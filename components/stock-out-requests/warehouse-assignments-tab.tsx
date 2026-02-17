"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
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

interface WarehouseAssignmentsTabProps {
  assignments: WarehouseAssignment[];
  canExecute: boolean;
  onExecute: (assignment: WarehouseAssignment) => void;
  isExecuting: boolean;
}

/**
 * Warehouse Assignments Tab
 *
 * Shows all L2 warehouse assignments grouped by line item.
 * Each assignment row shows:
 *   - Warehouse name | Qty | Status badge | Execute button (for pending, if canExecute)
 *
 * Execution opens the ExecutionConfirmationDialog (wired via onExecute in parent).
 */
export function WarehouseAssignmentsTab({
  assignments,
  canExecute,
  onExecute,
  isExecuting,
}: WarehouseAssignmentsTabProps) {
  if (assignments.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No warehouse assignments yet. L2 warehouse assignments will appear here
        once an admin assigns approved quantities to warehouses.
      </div>
    );
  }

  // Group assignments by line item
  const groups: Map<string, { item_name: string; item_sku: string | null; assignments: WarehouseAssignment[] }> = new Map();

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

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([lineItemId, group]) => (
        <div key={lineItemId} className="space-y-2">
          {/* Group header */}
          <div className="flex items-center gap-2 pb-1 border-b border-slate-700">
            <h4 className="font-medium text-slate-200 text-sm">
              {group.item_name || "Unknown Item"}
            </h4>
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
      ))}
    </div>
  );
}
