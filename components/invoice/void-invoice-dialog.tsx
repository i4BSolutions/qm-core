"use client";

import { useState } from "react";
import { AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface VoidInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  onConfirm: (reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function VoidInvoiceDialog({
  open,
  onOpenChange,
  invoiceNumber,
  onConfirm,
  isLoading = false,
}: VoidInvoiceDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError("Please provide a reason for voiding this invoice");
      return;
    }

    setError(null);

    try {
      await onConfirm(reason.trim());
      setReason("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to void invoice");
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setReason("");
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-slate-100">Void Invoice</DialogTitle>
              <DialogDescription className="text-slate-400">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">
              You are about to void invoice{" "}
              <code className="font-mono">{invoiceNumber}</code>. This will:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-300">
              <li className="flex items-center gap-2">
                <Ban className="h-3 w-3" />
                Mark the invoice as voided
              </li>
              <li className="flex items-center gap-2">
                <Ban className="h-3 w-3" />
                Restore the invoiced quantities back to the PO
              </li>
              <li className="flex items-center gap-2">
                <Ban className="h-3 w-3" />
                Update the PO status accordingly
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="void-reason" className="text-slate-300">
              Reason for voiding <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter the reason for voiding this invoice..."
              disabled={isLoading}
              className="min-h-[100px] bg-slate-800 border-slate-700 resize-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Voiding...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Void Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
