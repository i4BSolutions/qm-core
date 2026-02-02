"use client";

import { cn } from "@/lib/utils";

interface FulfillmentProgressBarProps {
  issuedQty: number;
  requestedQty: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function FulfillmentProgressBar({
  issuedQty,
  requestedQty,
  showLabel = true,
  size = "md",
}: FulfillmentProgressBarProps) {
  const percent = requestedQty > 0
    ? Math.min(100, Math.round((issuedQty / requestedQty) * 100))
    : 0;
  const heightClass = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-400">Fulfilled</span>
          <span className="text-emerald-400 font-mono">
            {issuedQty}/{requestedQty}
          </span>
        </div>
      )}
      <div className={cn("w-full rounded-full bg-slate-700/50", heightClass)}>
        <div
          className={cn(
            "rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500",
            heightClass
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
