"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check, AlertTriangle, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LineItemWithApprovals } from "./line-item-table";

interface ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItems: LineItemWithApprovals[];
  requestId: string;
  requestReason: string;
  onSuccess: () => void;
}

/**
 * Warehouse stock information
 */
interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  available_stock: number;
}

/**
 * Per-item approval data
 */
interface ApprovalData {
  approvedQuantity: string;
  warehouseId: string;
}

/**
 * Fetch warehouse stock levels for an item
 */
async function fetchWarehouseStockForItem(
  supabase: ReturnType<typeof createClient>,
  itemId: string
): Promise<WarehouseStock[]> {
  try {
    // Query inventory_transactions to calculate stock by warehouse
    const { data: transactions, error } = await supabase
      .from("inventory_transactions")
      .select(
        `
        movement_type,
        warehouse_id,
        quantity,
        warehouse:warehouses(id, name)
      `
      )
      .eq("item_id", itemId)
      .eq("status", "completed");

    if (error) throw error;

    // Group by warehouse and sum quantities
    const stockMap = new Map<string, WarehouseStock>();

    (transactions || []).forEach((txn: any) => {
      if (!txn.warehouse_id || !txn.warehouse) return;

      const warehouseId = txn.warehouse_id;
      const warehouseName = txn.warehouse.name;

      if (!stockMap.has(warehouseId)) {
        stockMap.set(warehouseId, {
          warehouse_id: warehouseId,
          warehouse_name: warehouseName,
          available_stock: 0,
        });
      }

      const stock = stockMap.get(warehouseId)!;

      if (txn.movement_type === "inventory_in") {
        stock.available_stock += txn.quantity;
      } else if (txn.movement_type === "inventory_out") {
        stock.available_stock -= txn.quantity;
      }
    });

    // Filter to only positive stock and sort by stock descending
    return Array.from(stockMap.values())
      .filter((s) => s.available_stock > 0)
      .sort((a, b) => b.available_stock - a.available_stock);
  } catch (error) {
    console.error("Error fetching warehouse stock:", error);
    return [];
  }
}

/**
 * Handle quantity input with number-only validation
 */
function handleQuantityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  // Allow: backspace, delete, tab, escape, enter, decimal point
  if (
    [46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    (e.keyCode === 65 && e.ctrlKey === true) ||
    (e.keyCode === 67 && e.ctrlKey === true) ||
    (e.keyCode === 86 && e.ctrlKey === true) ||
    (e.keyCode === 88 && e.ctrlKey === true) ||
    // Allow: home, end, left, right
    (e.keyCode >= 35 && e.keyCode <= 39)
  ) {
    return;
  }
  // Ensure that it is a number and stop the keypress if not
  if (
    (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
    (e.keyCode < 96 || e.keyCode > 105)
  ) {
    e.preventDefault();
  }
}

/**
 * Approval Dialog Component
 *
 * Allows approver to set approved quantities and assign warehouses for selected line items.
 */
export function ApprovalDialog({
  open,
  onOpenChange,
  lineItems,
  requestId,
  requestReason,
  onSuccess,
}: ApprovalDialogProps) {
  const { user } = useAuth();
  const [approvalData, setApprovalData] = useState<Map<string, ApprovalData>>(
    new Map()
  );
  const [warehouseStocks, setWarehouseStocks] = useState<
    Map<string, WarehouseStock[]>
  >(new Map());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(
    new Map()
  );

  /**
   * Initialize approval data and fetch warehouse stocks when dialog opens
   */
  useEffect(() => {
    if (!open) return;

    const initializeData = async () => {
      setIsLoadingStocks(true);
      const supabase = createClient();

      // Initialize approval data for each line item
      const initialData = new Map<string, ApprovalData>();
      lineItems.forEach((item) => {
        initialData.set(item.id, {
          approvedQuantity: item.remaining_quantity.toString(),
          warehouseId: "",
        });
      });
      setApprovalData(initialData);

      // Fetch warehouse stocks for each unique item
      const uniqueItemIds = Array.from(
        new Set(lineItems.map((item) => item.item_id))
      );

      const stocksMap = new Map<string, WarehouseStock[]>();
      for (const itemId of uniqueItemIds) {
        const stocks = await fetchWarehouseStockForItem(supabase, itemId);
        stocksMap.set(itemId, stocks);
      }
      setWarehouseStocks(stocksMap);

      setIsLoadingStocks(false);
    };

    initializeData();
    setNotes("");
    setValidationErrors(new Map());
  }, [open, lineItems]);

  /**
   * Update approval data for a specific line item
   */
  const updateApprovalData = (
    lineItemId: string,
    field: keyof ApprovalData,
    value: string
  ) => {
    setApprovalData((prev) => {
      const newData = new Map(prev);
      const current = newData.get(lineItemId) || {
        approvedQuantity: "",
        warehouseId: "",
      };
      newData.set(lineItemId, { ...current, [field]: value });
      return newData;
    });

    // Clear validation error for this field
    setValidationErrors((prev) => {
      const newErrors = new Map(prev);
      newErrors.delete(`${lineItemId}-${field}`);
      return newErrors;
    });
  };

  /**
   * Validate all approval data before submission
   */
  const validateApprovalData = (): boolean => {
    const errors = new Map<string, string>();

    lineItems.forEach((item) => {
      const data = approvalData.get(item.id);
      if (!data) return;

      // Validate approved quantity
      const qty = parseInt(data.approvedQuantity, 10);
      if (isNaN(qty) || qty <= 0) {
        errors.set(
          `${item.id}-approvedQuantity`,
          "Must be greater than 0"
        );
      } else if (qty > item.remaining_quantity) {
        errors.set(
          `${item.id}-approvedQuantity`,
          `Cannot exceed remaining quantity (${item.remaining_quantity})`
        );
      }

      // Validate warehouse selection
      if (!data.warehouseId) {
        errors.set(`${item.id}-warehouseId`, "Warehouse is required");
      }
    });

    setValidationErrors(errors);
    return errors.size === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!validateApprovalData()) {
      toast.error("Please fix validation errors");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Process each line item sequentially
      for (const item of lineItems) {
        const data = approvalData.get(item.id);
        if (!data) continue;

        const approvedQty = parseInt(data.approvedQuantity, 10);
        const warehouseId = data.warehouseId;

        // 1. Insert approval record
        const { data: approvalRecord, error: approvalError } = await supabase
          .from("stock_out_approvals")
          .insert({
            line_item_id: item.id,
            approved_quantity: approvedQty,
            decision: "approved",
            decided_by: user.id,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (approvalError) throw approvalError;

        // 2. Insert pending inventory transaction
        const { error: transactionError } = await supabase
          .from("inventory_transactions")
          .insert({
            movement_type: "inventory_out",
            item_id: item.item_id,
            warehouse_id: warehouseId,
            quantity: approvedQty,
            reason: requestReason,
            stock_out_approval_id: approvalRecord.id,
            status: "pending",
            created_by: user.id,
          });

        if (transactionError) throw transactionError;
      }

      toast.success(`Approved ${lineItems.length} line item(s)`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error approving line items:", error);
      toast.error(error.message || "Failed to approve line items");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve Line Items</DialogTitle>
          <DialogDescription>
            Set approved quantities and assign warehouses for {lineItems.length}{" "}
            line item{lineItems.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoadingStocks ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span className="ml-2 text-slate-400">Loading warehouse stocks...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {lineItems.map((item) => {
              const data = approvalData.get(item.id);
              const stocks = warehouseStocks.get(item.item_id) || [];
              const selectedWarehouse = stocks.find(
                (s) => s.warehouse_id === data?.warehouseId
              );
              const approvedQty = parseInt(data?.approvedQuantity || "0", 10);

              // Show warning if approved qty exceeds available stock
              const showStockWarning =
                selectedWarehouse &&
                !isNaN(approvedQty) &&
                approvedQty > selectedWarehouse.available_stock;

              return (
                <div
                  key={item.id}
                  className="border border-slate-700 rounded-lg p-4 space-y-3"
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-slate-200 flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        {item.item_name || "Unknown Item"}
                      </div>
                      {item.item_sku && (
                        <div className="text-sm text-slate-400 font-mono ml-6">
                          {item.item_sku}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm space-y-1">
                      <div className="text-slate-400">
                        Requested:{" "}
                        <span className="font-mono text-slate-200">
                          {item.requested_quantity}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Already Approved:{" "}
                        <span className="font-mono text-slate-200">
                          {item.total_approved_quantity}
                        </span>
                      </div>
                      <div className="text-amber-400 font-medium">
                        Remaining:{" "}
                        <span className="font-mono">
                          {item.remaining_quantity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Approved Quantity */}
                    <div className="space-y-2">
                      <Label htmlFor={`qty-${item.id}`}>
                        Approved Quantity *
                      </Label>
                      <Input
                        id={`qty-${item.id}`}
                        type="number"
                        min="1"
                        max={item.remaining_quantity}
                        value={data?.approvedQuantity || ""}
                        onChange={(e) =>
                          updateApprovalData(
                            item.id,
                            "approvedQuantity",
                            e.target.value
                          )
                        }
                        onKeyDown={handleQuantityKeyDown}
                        className={cn(
                          "font-mono",
                          validationErrors.has(`${item.id}-approvedQuantity`) &&
                            "border-red-500"
                        )}
                      />
                      {validationErrors.has(`${item.id}-approvedQuantity`) && (
                        <p className="text-xs text-red-400">
                          {validationErrors.get(`${item.id}-approvedQuantity`)}
                        </p>
                      )}
                    </div>

                    {/* Warehouse Selection */}
                    <div className="space-y-2">
                      <Label htmlFor={`warehouse-${item.id}`}>
                        Warehouse *
                      </Label>
                      <Select
                        value={data?.warehouseId || ""}
                        onValueChange={(value) =>
                          updateApprovalData(item.id, "warehouseId", value)
                        }
                      >
                        <SelectTrigger
                          id={`warehouse-${item.id}`}
                          className={cn(
                            validationErrors.has(`${item.id}-warehouseId`) &&
                              "border-red-500"
                          )}
                        >
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {stocks.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-slate-500">
                              No warehouses with stock available
                            </div>
                          ) : (
                            stocks.map((stock) => (
                              <SelectItem
                                key={stock.warehouse_id}
                                value={stock.warehouse_id}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span>{stock.warehouse_name}</span>
                                  <Badge
                                    variant="secondary"
                                    className="font-mono text-xs text-emerald-400"
                                  >
                                    {stock.available_stock}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      {validationErrors.has(`${item.id}-warehouseId`) && (
                        <p className="text-xs text-red-400">
                          {validationErrors.get(`${item.id}-warehouseId`)}
                        </p>
                      )}

                      {/* Stock Warning */}
                      {showStockWarning && (
                        <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>
                            Approved quantity ({approvedQty}) exceeds available
                            stock ({selectedWarehouse.available_stock})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Optional Notes */}
            <div className="space-y-2">
              <Label htmlFor="approval-notes">Notes (Optional)</Label>
              <Textarea
                id="approval-notes"
                placeholder="Add any notes about this approval..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isLoadingStocks}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Approve {lineItems.length} Item{lineItems.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
