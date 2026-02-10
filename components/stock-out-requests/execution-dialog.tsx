"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, ArrowUpFromLine } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Enums } from "@/types/database";

type TransactionStatus = Enums<"inventory_transaction_status">;

interface ExecutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  onSuccess: () => void;
}

/**
 * Item details for execution display
 */
interface ExecutionItem {
  id: string;
  item_id: string;
  warehouse_id: string;
  quantity: number;
  reason: string;
  status: TransactionStatus;
  item: {
    id: string;
    name: string;
    sku: string | null;
  };
  warehouse: {
    id: string;
    name: string;
  };
}

/**
 * Warehouse stock availability
 */
interface WarehouseStock {
  warehouse_id: string;
  item_id: string;
  available_stock: number;
}

/**
 * Execution Dialog Component
 *
 * CRITICAL: This dialog executes ALL pending inventory_transactions for the ENTIRE request
 * in a single atomic operation. There is NO selective per-line or per-approval execution.
 *
 * The user clicks "Execute Stock-Out" and either ALL pending transactions execute together,
 * or none do (if any validation fails).
 */
export function ExecutionDialog({
  open,
  onOpenChange,
  requestId,
  onSuccess,
}: ExecutionDialogProps) {
  const [executionItems, setExecutionItems] = useState<ExecutionItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  /**
   * Fetch ALL pending inventory_transactions for this entire request
   * and validate stock availability for ALL items
   */
  useEffect(() => {
    if (!open) {
      setExecutionItems([]);
      setValidationErrors([]);
      return;
    }

    const fetchAndValidate = async () => {
      setIsLoading(true);
      const supabase = createClient();

      try {
        // Step 1: Get all line items for this request
        const { data: lineItemsData, error: lineItemsError } = await supabase
          .from("stock_out_line_items")
          .select("id")
          .eq("request_id", requestId);

        if (lineItemsError) throw lineItemsError;

        const lineItemIds = (lineItemsData || []).map((li) => li.id);

        if (lineItemIds.length === 0) {
          setValidationErrors(["No line items found for this request"]);
          setIsLoading(false);
          return;
        }

        // Step 2: Get all approved approvals for these line items
        const { data: approvalsData, error: approvalsError } = await supabase
          .from("stock_out_approvals")
          .select("id")
          .in("line_item_id", lineItemIds)
          .eq("decision", "approved");

        if (approvalsError) throw approvalsError;

        const approvalIds = (approvalsData || []).map((a) => a.id);

        if (approvalIds.length === 0) {
          setValidationErrors([
            "No approved approvals found. Nothing to execute.",
          ]);
          setIsLoading(false);
          return;
        }

        // Step 3: Get ALL pending inventory_transactions for these approvals
        const { data: transactionsData, error: transactionsError } =
          await supabase
            .from("inventory_transactions")
            .select(
              `
              id,
              item_id,
              warehouse_id,
              quantity,
              reason,
              status,
              stock_out_approval_id,
              item:items!inventory_transactions_item_id_fkey(id, name, sku),
              warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name)
            `
            )
            .in("stock_out_approval_id", approvalIds)
            .eq("status", "pending");

        if (transactionsError) throw transactionsError;

        const items = (transactionsData || []) as unknown as ExecutionItem[];

        if (items.length === 0) {
          setValidationErrors([
            "No pending transactions found. All may have already been executed.",
          ]);
          setIsLoading(false);
          return;
        }

        setExecutionItems(items);

        // Step 4: Validate stock availability for ALL items across ALL warehouses
        const errors: string[] = [];

        // Group items by warehouse_id + item_id
        const warehouseItemMap = new Map<string, ExecutionItem[]>();
        items.forEach((item) => {
          const key = `${item.warehouse_id}:${item.item_id}`;
          if (!warehouseItemMap.has(key)) {
            warehouseItemMap.set(key, []);
          }
          warehouseItemMap.get(key)!.push(item);
        });

        // Validate each warehouse+item combination
        for (const [key, itemGroup] of Array.from(warehouseItemMap.entries())) {
          const [warehouse_id, item_id] = key.split(":");
          const totalRequired = itemGroup.reduce(
            (sum, item) => sum + item.quantity,
            0
          );

          // Calculate current available stock
          const { data: txData } = await supabase
            .from("inventory_transactions")
            .select("movement_type, quantity")
            .eq("item_id", item_id)
            .eq("warehouse_id", warehouse_id)
            .eq("is_active", true)
            .eq("status", "completed");

          const availableStock = (txData || []).reduce((sum, tx) => {
            if (tx.movement_type === "inventory_in") {
              return sum + (tx.quantity || 0);
            } else if (tx.movement_type === "inventory_out") {
              return sum - (tx.quantity || 0);
            }
            return sum;
          }, 0);

          // If insufficient stock, add error
          if (availableStock < totalRequired) {
            const itemName = itemGroup[0].item.name;
            const warehouseName = itemGroup[0].warehouse.name;
            errors.push(
              `${itemName}: Insufficient stock in ${warehouseName} (need ${totalRequired}, have ${availableStock})`
            );
          }
        }

        setValidationErrors(errors);
      } catch (error: any) {
        console.error("Error fetching execution items:", error);
        setValidationErrors([
          error.message || "Failed to fetch execution items",
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndValidate();
  }, [open, requestId]);

  /**
   * Execute ALL pending transactions in a single atomic update
   */
  const handleExecute = async () => {
    if (validationErrors.length > 0) return;
    if (executionItems.length === 0) return;

    setIsExecuting(true);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      const allTransactionIds = executionItems.map((item) => item.id);

      // Update ALL pending transactions to completed in a single operation
      const { error: updateError } = await supabase
        .from("inventory_transactions")
        .update({
          status: "completed" as TransactionStatus,
          transaction_date: now,
        })
        .in("id", allTransactionIds);

      if (updateError) throw updateError;

      // Success
      toast.success(
        `Stock-out executed successfully for ${executionItems.length} ${
          executionItems.length === 1 ? "item" : "items"
        }`
      );

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error executing stock-out:", error);
      toast.error(error.message || "Failed to execute stock-out");
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Execute Stock-Out</DialogTitle>
          <DialogDescription>
            Execute ALL {executionItems.length > 0 ? executionItems.length : ""}{" "}
            pending item(s) for this request
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        )}

        {/* Validation Errors */}
        {!isLoading && validationErrors.length > 0 && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-red-400 mb-2">
                  Cannot execute: stock shortages found
                </p>
                <p className="text-sm text-red-400/80 mb-3">
                  All items must have sufficient stock to proceed. The entire
                  execution is blocked until all issues are resolved:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-400/80">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Items to Execute */}
        {!isLoading && validationErrors.length === 0 && executionItems.length > 0 && (
          <>
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800/80 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Item
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Warehouse
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {executionItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {item.item.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.item.sku ? (
                            <code className="text-amber-400 text-xs">
                              {item.item.sku}
                            </code>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {item.warehouse.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-red-400 font-semibold">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-400/90">
                  <p className="font-medium mb-1">
                    Execution is permanent and covers all pending items in this
                    request
                  </p>
                  <p>
                    Stock-out transactions cannot be voided. Use stock-in to
                    correct any mistakes.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            disabled={
              isLoading ||
              isExecuting ||
              validationErrors.length > 0 ||
              executionItems.length === 0
            }
            className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <ArrowUpFromLine className="mr-2 h-4 w-4" />
                Execute Stock-Out
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
