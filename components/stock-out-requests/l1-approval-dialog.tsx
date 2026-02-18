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
import { AmountInput } from "@/components/ui/amount-input";
import { Loader2, Check, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import type { LineItemWithApprovals } from "./line-item-table";

interface L1ApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem: LineItemWithApprovals;
  onSuccess: () => void;
}

/**
 * L1 Approval Dialog
 *
 * Layer 1 (Quartermaster) qty-only approval dialog for a single line item.
 * Does NOT select a warehouse — warehouse assignment happens at L2.
 * Does NOT create an inventory_transaction — that happens at L2 when warehouse is known.
 *
 * Inserts into stock_out_approvals with decision='approved'.
 * The DB trigger auto-sets layer='quartermaster'.
 */
export function L1ApprovalDialog({
  open,
  onOpenChange,
  lineItem,
  onSuccess,
}: L1ApprovalDialogProps) {
  const { user } = useAuth();
  const [approvedQuantity, setApprovedQuantity] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qtyError, setQtyError] = useState<string | null>(null);

  // Initialize form when dialog opens
  useEffect(() => {
    if (!open) return;
    setApprovedQuantity(lineItem.remaining_quantity.toString());
setQtyError(null);
  }, [open, lineItem]);

  const validate = (): boolean => {
    const qty = parseInt(approvedQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setQtyError("Quantity must be greater than 0");
      return false;
    }
    if (qty > lineItem.remaining_quantity) {
      setQtyError(
        `Cannot exceed remaining quantity (${lineItem.remaining_quantity})`
      );
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

    if (!validate()) {
      toast.error("Please fix validation errors");
      return;
    }

    const qty = parseInt(approvedQuantity, 10);

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Insert L1 approval — no warehouse_id, no parent_approval_id, no inventory_transaction.
      // The DB trigger auto-sets layer='quartermaster'.
      const { error } = await supabase.from("stock_out_approvals").insert({
        line_item_id: lineItem.id,
        approved_quantity: qty,
        decision: "approved",
        decided_by: user.id,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success(`Approved ${qty} unit(s) for ${lineItem.item_name || "item"}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating L1 approval:", JSON.stringify(error));
      const msg = error?.message || error?.details || error?.hint || "Failed to approve quantity";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Standard unit conversion display: e.g., "40 boxes = 480 pieces"
  const approvedQtyNum = parseInt(approvedQuantity, 10);
  const showConversion =
    lineItem.unit_name &&
    lineItem.conversion_rate > 1 &&
    !isNaN(approvedQtyNum) &&
    approvedQtyNum > 0;

  const convertedQty = showConversion
    ? (approvedQtyNum * lineItem.conversion_rate).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve Quantity</DialogTitle>
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
          {/* Quantity Summary */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-500 text-xs mb-1">Requested</div>
              <div className="font-mono text-slate-200">
                {lineItem.requested_quantity}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Already Approved</div>
              <div className="font-mono text-emerald-400">
                {lineItem.total_approved_quantity}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Already Rejected</div>
              <div className="font-mono text-red-400">
                {lineItem.total_rejected_quantity}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-xs mb-1">Remaining</div>
              <div className="font-mono text-amber-400 font-medium">
                {lineItem.remaining_quantity}
              </div>
            </div>
          </div>

          {/* Approved Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="l1-approved-qty">
              Approved Quantity *
            </Label>
            <AmountInput
              id="l1-approved-qty"
              value={approvedQuantity}
              onValueChange={(val) => {
                setApprovedQuantity(val);
                setQtyError(null);
              }}
              decimalScale={0}
              max={lineItem.remaining_quantity}
              placeholder="0"
              error={!!qtyError}
            />
            {qtyError && (
              <p className="text-xs text-red-400">{qtyError}</p>
            )}
            {/* Standard unit conversion display */}
            {showConversion && convertedQty && (
              <p className="text-xs text-slate-400">
                {approvedQtyNum} boxes = {convertedQty} {lineItem.unit_name}
              </p>
            )}
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
            disabled={isSubmitting}
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
                Approve Qty
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
