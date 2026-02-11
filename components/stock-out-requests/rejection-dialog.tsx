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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, X, AlertTriangle, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { AmountInput } from "@/components/ui/amount-input";
import type { LineItemWithApprovals } from "./line-item-table";

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItems: LineItemWithApprovals[];
  onSuccess: () => void;
}

/**
 * Rejection Dialog Component
 *
 * Allows approver to reject selected line items with per-item qty and a mandatory reason.
 * Mirrors the approval flow: select items → set qty to reject → provide reason.
 */
export function RejectionDialog({
  open,
  onOpenChange,
  lineItems,
  onSuccess,
}: RejectionDialogProps) {
  const { user } = useAuth();
  const [rejectedQuantities, setRejectedQuantities] = useState<Map<string, string>>(new Map());
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map());

  // Initialize rejected quantities when dialog opens
  useEffect(() => {
    if (!open) return;
    const initial = new Map<string, string>();
    lineItems.forEach((item) => {
      initial.set(item.id, item.remaining_quantity.toString());
    });
    setRejectedQuantities(initial);
    setRejectionReason("");
    setValidationErrors(new Map());
  }, [open, lineItems]);

  const updateRejectedQty = (lineItemId: string, value: string) => {
    setRejectedQuantities((prev) => {
      const next = new Map(prev);
      next.set(lineItemId, value);
      return next;
    });
    setValidationErrors((prev) => {
      const next = new Map(prev);
      next.delete(lineItemId);
      return next;
    });
  };

  const validate = (): boolean => {
    const errors = new Map<string, string>();

    lineItems.forEach((item) => {
      const qtyStr = rejectedQuantities.get(item.id) || "0";
      const qty = parseInt(qtyStr, 10);
      if (isNaN(qty) || qty <= 0) {
        errors.set(item.id, "Must be greater than 0");
      } else if (qty > item.remaining_quantity) {
        errors.set(item.id, `Cannot exceed remaining quantity (${item.remaining_quantity})`);
      }
    });

    if (rejectionReason.trim().length === 0) {
      errors.set("reason", "Rejection reason is required");
    }

    setValidationErrors(errors);
    return errors.size === 0;
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

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      for (const item of lineItems) {
        const rejectedQty = parseInt(rejectedQuantities.get(item.id) || "0", 10);

        const { error } = await supabase.from("stock_out_approvals").insert({
          line_item_id: item.id,
          approved_quantity: rejectedQty,
          decision: "rejected",
          rejection_reason: rejectionReason.trim(),
          decided_by: user.id,
          created_by: user.id,
        });

        if (error) throw error;
      }

      toast.success(`Rejected ${lineItems.length} line item(s)`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error rejecting line items:", error);
      toast.error(error.message || "Failed to reject line items");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setRejectionReason("");
      setValidationErrors(new Map());
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reject Line Items</DialogTitle>
          <DialogDescription>
            Set rejected quantities and provide a reason for {lineItems.length} line item
            {lineItems.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lineItems.map((item) => {
            const qtyStr = rejectedQuantities.get(item.id) || "0";

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
                    <div className="text-slate-400">
                      Already Rejected:{" "}
                      <span className="font-mono text-red-400">
                        {item.total_rejected_quantity}
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

                {/* Rejected Quantity Input */}
                <div className="space-y-2">
                  <Label htmlFor={`reject-qty-${item.id}`}>
                    Quantity to Reject *
                  </Label>
                  <AmountInput
                    id={`reject-qty-${item.id}`}
                    value={qtyStr}
                    onValueChange={(val) => updateRejectedQty(item.id, val)}
                    decimalScale={0}
                    max={item.remaining_quantity}
                    placeholder="0"
                    error={validationErrors.has(item.id)}
                  />
                  {validationErrors.has(item.id) && (
                    <p className="text-xs text-red-400">
                      {validationErrors.get(item.id)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Rejection Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">
              Rejection Reason *
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Enter rejection reason..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
            {validationErrors.has("reason") && (
              <p className="text-xs text-red-400">
                {validationErrors.get("reason")}
              </p>
            )}
          </div>

          {/* Warning Message */}
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              Rejected quantities cannot be stocked out. The requester will need
              to create a new request for rejected quantities.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <X className="w-4 h-4 mr-2" />
                Reject {lineItems.length} Item{lineItems.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
