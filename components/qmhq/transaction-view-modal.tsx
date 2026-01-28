"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import type { FinancialTransaction } from "@/types/database";

interface TransactionViewModalProps {
  transaction: (FinancialTransaction & {
    created_by_user?: { full_name: string } | null;
  }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionViewModal({
  transaction,
  open,
  onOpenChange,
}: TransactionViewModalProps) {
  if (!transaction) return null;

  const isMoneyIn = transaction.transaction_type === "money_in";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-200">
            {isMoneyIn ? "Money In" : "Money Out"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Amount Section - Prominent Display */}
          <div
            className={`p-4 rounded-lg border ${
              isMoneyIn
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}
          >
            <div className="space-y-2">
              <p
                className={`text-3xl font-mono font-bold ${
                  isMoneyIn ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {formatCurrency(transaction.amount ?? 0)} {transaction.currency}
              </p>
              <p className="text-lg text-slate-300">
                {formatCurrency(transaction.amount_eusd ?? 0)} EUSD
              </p>
            </div>
          </div>

          {/* Exchange Rate */}
          <div className="space-y-2">
            <Label className="text-slate-400">Exchange Rate</Label>
            <p className="text-slate-200 font-mono text-lg">
              {transaction.exchange_rate?.toFixed(4) ?? "1.0000"}
            </p>
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label className="text-slate-400">Date</Label>
            <p className="text-slate-200">
              {transaction.transaction_date
                ? format(new Date(transaction.transaction_date), "dd/MM/yyyy")
                : "—"}
            </p>
          </div>

          {/* Transaction ID */}
          <div className="space-y-2">
            <Label className="text-slate-400">Transaction ID</Label>
            <p className="text-slate-200 font-mono text-sm">
              {transaction.transaction_id || "—"}
            </p>
          </div>

          {/* QMHQ Reference */}
          <div className="space-y-2">
            <Label className="text-slate-400">QMHQ</Label>
            <p className="text-slate-200 font-mono text-sm">
              {transaction.qmhq_id}
            </p>
          </div>

          {/* Notes */}
          {transaction.notes && (
            <div className="space-y-2">
              <Label className="text-slate-400">Notes</Label>
              <p className="text-slate-200 whitespace-pre-wrap">
                {transaction.notes}
              </p>
            </div>
          )}

          {/* Created By */}
          {transaction.created_by_user && (
            <div className="space-y-2">
              <Label className="text-slate-400">Recorded By</Label>
              <p className="text-slate-200">
                {transaction.created_by_user.full_name}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            className="border-slate-700 text-slate-300"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
