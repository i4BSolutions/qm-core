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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/ui/amount-input";
import { ConversionRateInput } from "@/components/ui/conversion-rate-input";
import { Loader2, Warehouse, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";
import type { LineItemWithApprovals } from "./line-item-table";

type StockOutReason = Enums<"stock_out_reason">;

interface L2WarehouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem: LineItemWithApprovals;
  l1Approval: {
    id: string;
    approved_quantity: number;
    total_l2_assigned: number; // sum of existing L2 for this L1
  };
  requestReason: StockOutReason;
  qmhqId?: string | null;
  onSuccess: () => void;
}

interface WarehouseOption {
  id: string;
  name: string;
}

/**
 * L2 Warehouse Assignment Dialog
 *
 * Layer 2 (Admin) warehouse assignment dialog.
 * Assigns a capped quantity of the L1-approved qty to a specific warehouse.
 *
 * Hard caps:
 *   - assignedQty <= remaining_to_assign (L1 approved - already L2 assigned)
 *   - assignedQty <= available warehouse stock
 *
 * On submit:
 *   - Inserts stock_out_approvals record with parent_approval_id + warehouse_id
 *   - Inserts pending inventory_transaction (warehouse now known)
 */
export function L2WarehouseDialog({
  open,
  onOpenChange,
  lineItem,
  l1Approval,
  requestReason,
  qmhqId,
  onSuccess,
}: L2WarehouseDialogProps) {
  const { user } = useAuth();

  // Warehouses list
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(false);

  // Selected warehouse
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");

  // Available stock for selected warehouse
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  // Form fields
  const remainingToAssign =
    l1Approval.approved_quantity - l1Approval.total_l2_assigned;

  const [assignedQty, setAssignedQty] = useState<string>(
    remainingToAssign.toString()
  );
  const [conversionRate, setConversionRate] = useState<string>(
    lineItem.conversion_rate.toString()
  );

  // Validation
  const [qtyError, setQtyError] = useState<string | null>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch warehouses on open
  useEffect(() => {
    if (!open) return;

    // Reset form
    setSelectedWarehouseId("");
    setAvailableStock(null);
    setAssignedQty(remainingToAssign.toString());
    setConversionRate(lineItem.conversion_rate.toString());
    setQtyError(null);

    const fetchWarehouses = async () => {
      setIsLoadingWarehouses(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setWarehouses(data);
      }
      setIsLoadingWarehouses(false);
    };

    fetchWarehouses();
  }, [open, remainingToAssign, lineItem.conversion_rate]);

  // Fetch stock when warehouse changes
  useEffect(() => {
    if (!selectedWarehouseId || !lineItem.item_id) {
      setAvailableStock(null);
      return;
    }

    const fetchStock = async () => {
      setIsLoadingStock(true);
      setAvailableStock(null);

      const supabase = createClient();

      const { data: transactions, error } = await supabase
        .from("inventory_transactions")
        .select("movement_type, quantity")
        .eq("item_id", lineItem.item_id)
        .eq("warehouse_id", selectedWarehouseId)
        .eq("status", "completed")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching warehouse stock:", error);
        setAvailableStock(0);
        setIsLoadingStock(false);
        return;
      }

      let stock = 0;
      (transactions || []).forEach((tx: any) => {
        if (tx.movement_type === "inventory_in") {
          stock += tx.quantity || 0;
        } else if (tx.movement_type === "inventory_out") {
          stock -= tx.quantity || 0;
        }
      });

      setAvailableStock(Math.max(0, stock));
      setIsLoadingStock(false);

      // Re-validate qty after stock is fetched
      setQtyError(null);
    };

    fetchStock();
  }, [selectedWarehouseId, lineItem.item_id]);

  // Compute hard max: min(remaining, stock)
  const hardMax =
    availableStock !== null
      ? Math.min(remainingToAssign, availableStock)
      : remainingToAssign;

  const validate = (): boolean => {
    const qty = parseInt(assignedQty, 10);

    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return false;
    }

    if (isNaN(qty) || qty <= 0) {
      setQtyError("Quantity must be greater than 0");
      return false;
    }

    if (qty > remainingToAssign) {
      setQtyError(
        `Cannot exceed remaining approved qty (${remainingToAssign}) or warehouse stock (${availableStock ?? "?"})`
      );
      return false;
    }

    if (availableStock !== null && qty > availableStock) {
      setQtyError(
        `Cannot exceed remaining approved qty (${remainingToAssign}) or warehouse stock (${availableStock})`
      );
      return false;
    }

    const rate = parseFloat(conversionRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Conversion rate must be greater than 0");
      return false;
    }

    setQtyError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!validate()) return;

    const qty = parseInt(assignedQty, 10);
    const rate = parseFloat(conversionRate) || 1;

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Insert L2 approval
      const { data: l2ApprovalData, error: approvalError } = await supabase
        .from("stock_out_approvals")
        .insert({
          line_item_id: lineItem.id,
          approved_quantity: qty,
          decision: "approved",
          parent_approval_id: l1Approval.id,
          warehouse_id: selectedWarehouseId,
          decided_by: user.id,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (approvalError) throw approvalError;
      if (!l2ApprovalData) throw new Error("Failed to create L2 approval");

      // Insert pending inventory_transaction
      const { error: txError } = await supabase
        .from("inventory_transactions")
        .insert({
          movement_type: "inventory_out",
          item_id: lineItem.item_id,
          warehouse_id: selectedWarehouseId,
          quantity: qty,
          conversion_rate: rate,
          reason: requestReason,
          stock_out_approval_id: l2ApprovalData.id,
          qmhq_id: qmhqId || null,
          status: "pending",
          created_by: user.id,
        });

      if (txError) throw txError;

      const selectedWarehouse = warehouses.find(
        (w) => w.id === selectedWarehouseId
      );
      toast.success(
        `Assigned ${qty} unit(s) from ${selectedWarehouse?.name || "warehouse"} to ${lineItem.item_name || "item"}`
      );
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating L2 warehouse assignment:", error);
      toast.error(error.message || "Failed to assign warehouse");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standard unit conversion display
  const assignedQtyNum = parseInt(assignedQty, 10);
  const showConversion =
    lineItem.unit_name &&
    lineItem.conversion_rate > 1 &&
    !isNaN(assignedQtyNum) &&
    assignedQtyNum > 0;

  const convertedQty = showConversion
    ? (assignedQtyNum * lineItem.conversion_rate).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

  // Compute qty error inline for display (re-evaluate without calling validate)
  const qtyNum = parseInt(assignedQty, 10);
  const hasQtyError =
    !isNaN(qtyNum) &&
    qtyNum > 0 &&
    ((qtyNum > remainingToAssign) ||
      (availableStock !== null && qtyNum > availableStock));

  const isSubmitDisabled =
    isSubmitting ||
    isLoadingStock ||
    !selectedWarehouseId ||
    hasQtyError ||
    !assignedQty ||
    parseInt(assignedQty, 10) <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-purple-400" />
            Assign Warehouse
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-2 mt-1">
              <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="font-medium text-slate-300">
                {lineItem.item_name || "Unknown Item"}
              </span>
              {lineItem.item_sku && (
                <span className="font-mono text-xs text-slate-500">
                  ({lineItem.item_sku})
                </span>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quantity Info Summary */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-slate-500 text-xs mb-1">L1 Approved</div>
              <div className="font-mono text-slate-200">
                {l1Approval.approved_quantity}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Already Assigned</div>
              <div className="font-mono text-purple-400">
                {l1Approval.total_l2_assigned}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Remaining</div>
              <div className="font-mono text-amber-400 font-medium">
                {remainingToAssign}
              </div>
            </div>
          </div>

          {/* Warehouse Select */}
          <div className="space-y-2">
            <Label htmlFor="l2-warehouse">Warehouse *</Label>
            {isLoadingWarehouses ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading warehouses...
              </div>
            ) : (
              <Select
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
              >
                <SelectTrigger id="l2-warehouse">
                  <SelectValue placeholder="Select a warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Available stock display */}
            {selectedWarehouseId && (
              <div className="flex items-center gap-2 text-sm">
                {isLoadingStock ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                    <span className="text-slate-400">Checking stock...</span>
                  </>
                ) : availableStock !== null ? (
                  <span
                    className={cn(
                      "font-mono",
                      availableStock > 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    )}
                  >
                    Available: {availableStock} units
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="l2-assigned-qty">Assign Quantity *</Label>
            <AmountInput
              id="l2-assigned-qty"
              value={assignedQty}
              onValueChange={(val) => {
                setAssignedQty(val);
                setQtyError(null);
              }}
              decimalScale={0}
              max={hardMax}
              placeholder="0"
              error={hasQtyError || !!qtyError}
            />

            {/* Help text: both limits */}
            {availableStock !== null && (
              <p className="text-xs text-slate-400">
                Max: min(Remaining: {remainingToAssign}, Stock: {availableStock}) = {hardMax}
              </p>
            )}

            {/* Error message showing BOTH limits */}
            {(hasQtyError || qtyError) && (
              <p className="text-xs text-red-400">
                {qtyError ||
                  `Cannot exceed remaining approved qty (${remainingToAssign}) or warehouse stock (${availableStock ?? "?"})`}
              </p>
            )}

            {/* Standard unit conversion */}
            {showConversion && convertedQty && (
              <p className="text-xs text-slate-400">
                {assignedQtyNum} boxes = {convertedQty} {lineItem.unit_name}
              </p>
            )}
          </div>

          {/* Conversion Rate Input */}
          <div className="space-y-2">
            <Label htmlFor="l2-conversion-rate">
              Conversion Rate
              {lineItem.unit_name && lineItem.conversion_rate > 1 && (
                <span className="text-slate-500 font-normal ml-1 text-xs">
                  (boxes to {lineItem.unit_name})
                </span>
              )}
            </Label>
            <ConversionRateInput
              id="l2-conversion-rate"
              value={conversionRate}
              onValueChange={setConversionRate}
              placeholder="1.0000"
            />
          </div>
        </div>

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
            disabled={isSubmitDisabled}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Warehouse className="w-4 h-4 mr-2" />
                Assign Warehouse
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
