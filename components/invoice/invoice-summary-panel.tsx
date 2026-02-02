"use client";

import { DollarSign, ArrowRightLeft, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatExchangeRate } from "@/lib/utils/invoice-status";
import { CurrencyDisplay } from "@/components/ui/currency-display";

interface InvoiceSummaryPanelProps {
  totalAmount: number;
  currency: string;
  exchangeRate: number;
  itemCount: number;
  className?: string;
}

export function InvoiceSummaryPanel({
  totalAmount,
  currency,
  exchangeRate,
  itemCount,
  className = "",
}: InvoiceSummaryPanelProps) {
  const totalEUSD = exchangeRate > 0 ? totalAmount / exchangeRate : 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Card */}
      <div className="tactical-card corner-accents p-4">
        <div className="scan-overlay" />

        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Invoice Summary
        </h4>

        {/* Item Count */}
        <div className="flex items-center justify-between py-2 border-b border-slate-700">
          <div className="flex items-center gap-2 text-slate-400">
            <Calculator className="h-4 w-4" />
            <span className="text-sm">Line Items</span>
          </div>
          <span className="font-mono text-slate-200">{itemCount}</span>
        </div>

        {/* Currency Amount */}
        <div className="flex items-center justify-between py-2 border-b border-slate-700">
          <div className="flex items-center gap-2 text-slate-400">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Total ({currency})</span>
          </div>
          <span className="font-mono text-slate-200">
            {formatCurrency(totalAmount)}
          </span>
        </div>

        {/* Exchange Rate */}
        <div className="flex items-center justify-between py-2 border-b border-slate-700">
          <div className="flex items-center gap-2 text-slate-400">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-sm">Exchange Rate</span>
          </div>
          <span className="font-mono text-slate-300">
            {formatExchangeRate(exchangeRate)}
          </span>
        </div>

        {/* EUSD Total */}
        <div className="flex items-center justify-between py-3 mt-2 bg-emerald-500/10 -mx-4 px-4 rounded-b border-t border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400">
            <DollarSign className="h-5 w-5" />
            <span className="text-sm font-semibold">Total (EUSD)</span>
          </div>
          <span className="font-mono text-lg font-bold text-emerald-400">
            {formatCurrency(totalEUSD)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Compact version for inline display using CurrencyDisplay
interface InvoiceTotalsInlineProps {
  totalAmount: number;
  totalEUSD: number;
  currency: string;
}

export function InvoiceTotalsInline({
  totalAmount,
  totalEUSD,
  currency,
}: InvoiceTotalsInlineProps) {
  return (
    <CurrencyDisplay
      amount={totalAmount}
      currency={currency}
      amountEusd={totalEUSD}
      size="md"
      align="right"
    />
  );
}
