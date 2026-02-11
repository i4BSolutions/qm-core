"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ExecutionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  quantity: number;
  warehouseName: string;
  onConfirm: () => void;
  isExecuting: boolean;
}

/**
 * Minimal confirmation dialog for per-line-item execution
 *
 * Shows item details and permanent action warning before execution.
 */
export function ExecutionConfirmationDialog({
  open,
  onOpenChange,
  itemName,
  quantity,
  warehouseName,
  onConfirm,
  isExecuting,
}: ExecutionConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Execute Stock-Out</DialogTitle>
          <DialogDescription>
            Confirm stock-out execution for this approval
          </DialogDescription>
        </DialogHeader>

        {/* Detail Fields */}
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-between py-2 border-b border-slate-700">
            <span className="text-sm text-slate-400">Item</span>
            <span className="text-sm text-slate-200 font-medium">{itemName}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-700">
            <span className="text-sm text-slate-400">Quantity</span>
            <span className="text-sm text-slate-200 font-mono font-semibold">{quantity}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-slate-700">
            <span className="text-sm text-slate-400">Warehouse</span>
            <span className="text-sm text-slate-200 font-medium">{warehouseName}</span>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-400/90">
              <p className="font-medium">This action is permanent</p>
              <p className="mt-1">Stock-out transactions cannot be voided.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isExecuting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Execution
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
