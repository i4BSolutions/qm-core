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
  /** Optional: current stock before execution (for before/after display) */
  currentStock?: number;
  /** Optional: stock after execution = currentStock - quantity */
  afterStock?: number;
}

/**
 * Confirmation dialog for per-line-item execution
 *
 * Shows item details and permanent action warning before execution.
 * If currentStock and afterStock are provided, shows a Stock Levels section.
 */
export function ExecutionConfirmationDialog({
  open,
  onOpenChange,
  itemName,
  quantity,
  warehouseName,
  onConfirm,
  isExecuting,
  currentStock,
  afterStock,
}: ExecutionConfirmationDialogProps) {
  const showStockLevels =
    currentStock !== undefined && afterStock !== undefined;

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

          {/* Stock Levels section — only shown when stock data is available */}
          {showStockLevels && (
            <div className="py-2 border-b border-slate-700">
              <div className="text-sm text-slate-400 mb-2">Stock Impact</div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-slate-300">
                  <span className="text-slate-500 text-xs block mb-0.5">Before</span>
                  <span className="font-mono">{currentStock}</span>
                </div>
                <div className="text-slate-600 text-lg">→</div>
                <div className="text-slate-300">
                  <span className="text-slate-500 text-xs block mb-0.5">After</span>
                  <span
                    className={
                      afterStock !== undefined && afterStock < 0
                        ? "font-mono text-red-400"
                        : "font-mono text-emerald-400"
                    }
                  >
                    {afterStock}
                  </span>
                </div>
                <div className="text-xs text-slate-500 ml-auto">
                  in {warehouseName}
                </div>
              </div>
            </div>
          )}
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
