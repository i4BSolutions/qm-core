"use client";

import { useState } from "react";
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
import { Loader2, X, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
 * Allows approver to reject selected line items with a mandatory reason.
 */
export function RejectionDialog({
  open,
  onOpenChange,
  lineItems,
  onSuccess,
}: RejectionDialogProps) {
  const { user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate rejection reason
   */
  const isValid = rejectionReason.trim().length > 0;

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!user) {
      toast.error("User not authenticated");
      return;
    }

    if (!isValid) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Insert rejection records for each selected line item
      const insertPromises = lineItems.map((item) =>
        supabase.from("stock_out_approvals").insert({
          line_item_id: item.id,
          approved_quantity: 0,
          decision: "rejected",
          rejection_reason: rejectionReason.trim(),
          decided_by: user.id,
          created_by: user.id,
        })
      );

      const results = await Promise.all(insertPromises);

      // Check for errors
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(
          errors[0].error?.message || "Failed to reject line items"
        );
      }

      toast.success(`Rejected ${lineItems.length} line item(s)`);
      onSuccess();
      onOpenChange(false);
      setRejectionReason(""); // Reset form
    } catch (error: any) {
      console.error("Error rejecting line items:", error);
      toast.error(error.message || "Failed to reject line items");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Reset form when dialog closes
   */
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setRejectionReason("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject Line Items</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting {lineItems.length} line item
            {lineItems.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* List of items being rejected */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-2">
            <div className="text-xs font-medium text-slate-400 uppercase mb-2">
              Items to Reject
            </div>
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <div className="text-slate-200 font-medium">
                    {item.item_name || "Unknown Item"}
                  </div>
                  {item.item_sku && (
                    <div className="text-xs text-slate-400 font-mono">
                      {item.item_sku}
                    </div>
                  )}
                </div>
                <div className="font-mono text-slate-400">
                  Qty: {item.requested_quantity}
                </div>
              </div>
            ))}
          </div>

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
              rows={4}
              className={cn(
                !isValid && rejectionReason.length > 0 && "border-red-500"
              )}
            />
            {!isValid && rejectionReason.length > 0 && (
              <p className="text-xs text-red-400">
                Rejection reason cannot be empty
              </p>
            )}
          </div>

          {/* Warning Message */}
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200">
              <div className="font-medium mb-1">Warning</div>
              <div className="text-amber-300/80">
                Rejection is terminal. The requester will need to create a new
                request if they still need these items.
              </div>
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
            disabled={isSubmitting || !isValid}
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
