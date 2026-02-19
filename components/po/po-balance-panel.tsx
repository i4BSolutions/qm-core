"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface POBalancePanelProps {
  availableBalance: number;
  poTotal: number;
  currency?: string;
  /** PO total in original currency (before EUSD conversion) */
  originalPoTotal?: number;
  /** Original currency code (e.g., "MMK", "THB") */
  originalCurrency?: string;
}

export function POBalancePanel({
  availableBalance,
  poTotal,
  currency = "EUSD",
  originalPoTotal,
  originalCurrency,
}: POBalancePanelProps) {
  const remainingAfterPO = availableBalance - poTotal;
  const exceedsBalance = poTotal > availableBalance;
  const isValid = poTotal > 0 && !exceedsBalance;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        exceedsBalance
          ? "bg-red-500/10 border-red-500/30"
          : isValid
          ? "bg-emerald-500/10 border-emerald-500/30"
          : "bg-slate-800/50 border-slate-700"
      )}
    >
      <div className="flex items-start gap-3">
        {exceedsBalance ? (
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
        ) : isValid ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
        ) : null}

        <div className="flex-1 space-y-3">
          <h4
            className={cn(
              "font-semibold text-sm",
              exceedsBalance
                ? "text-red-400"
                : isValid
                ? "text-emerald-400"
                : "text-slate-300"
            )}
          >
            {exceedsBalance
              ? "Insufficient Balance"
              : isValid
              ? "Balance Validation Passed"
              : "Balance Check"}
          </h4>

          <div className="grid grid-cols-3 gap-4">
            {/* Available Balance */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Available Balance
              </p>
              <p className="text-lg font-mono font-bold text-purple-400">
                {formatCurrency(availableBalance)}
              </p>
              <p className="text-xs text-slate-500">{currency}</p>
            </div>

            {/* PO Total */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                PO Total
              </p>
              <p
                className={cn(
                  "text-lg font-mono font-bold",
                  exceedsBalance ? "text-red-400" : "text-amber-400"
                )}
              >
                {formatCurrency(poTotal)}
              </p>
              <p className="text-xs text-slate-500">{currency}</p>
              {originalPoTotal != null && originalCurrency && originalCurrency !== "USD" && (
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {formatCurrency(originalPoTotal)} {originalCurrency}
                </p>
              )}
            </div>

            {/* Remaining */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Remaining After PO
              </p>
              <p
                className={cn(
                  "text-lg font-mono font-bold",
                  remainingAfterPO < 0 ? "text-red-400" : "text-emerald-400"
                )}
              >
                {formatCurrency(remainingAfterPO)}
              </p>
              <p className="text-xs text-slate-500">{currency}</p>
            </div>
          </div>

          {exceedsBalance && (
            <p className="text-sm text-red-400/80">
              The PO total exceeds the available balance by{" "}
              <span className="font-mono font-semibold">
                {formatCurrency(Math.abs(remainingAfterPO))} {currency}
              </span>
              . Please reduce line items or add more funds to the QMHQ.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
