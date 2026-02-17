"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LineItemProgressBarProps {
  requestedQty: number;
  l1ApprovedQty: number;
  l2AssignedQty: number;
  executedQty: number;
}

/**
 * LineItemProgressBar
 *
 * 3-segment horizontal progress bar showing the approval lifecycle:
 * - Blue: L1 approved but not yet L2 assigned
 * - Purple: L2 assigned but not yet executed
 * - Emerald: Executed
 *
 * Tooltip shows exact numbers per layer on hover.
 */
export function LineItemProgressBar({
  requestedQty,
  l1ApprovedQty,
  l2AssignedQty,
  executedQty,
}: LineItemProgressBarProps) {
  // Guard against division by zero
  if (requestedQty <= 0) {
    return (
      <div className="h-2 w-full rounded-full bg-slate-700" />
    );
  }

  // Clamp negative values to 0
  const safeL1 = Math.max(0, l1ApprovedQty);
  const safeL2 = Math.max(0, Math.min(l2AssignedQty, safeL1));
  const safeExecuted = Math.max(0, Math.min(executedQty, safeL2));

  // Calculate segment widths as percentages
  const executedPct = (safeExecuted / requestedQty) * 100;
  const l2NotExecutedPct = ((safeL2 - safeExecuted) / requestedQty) * 100;
  const l1NotL2Pct = ((safeL1 - safeL2) / requestedQty) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden flex cursor-default">
            {/* L1 approved but not L2 assigned: blue */}
            {l1NotL2Pct > 0 && (
              <div
                className="h-full bg-blue-500 flex-shrink-0"
                style={{ width: `${l1NotL2Pct}%` }}
              />
            )}
            {/* L2 assigned but not executed: purple */}
            {l2NotExecutedPct > 0 && (
              <div
                className="h-full bg-purple-500 flex-shrink-0"
                style={{ width: `${l2NotExecutedPct}%` }}
              />
            )}
            {/* Executed: emerald */}
            {executedPct > 0 && (
              <div
                className="h-full bg-emerald-500 flex-shrink-0"
                style={{ width: `${executedPct}%` }}
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-slate-300">
              L1 Approved: {safeL1}/{requestedQty}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
            <span className="text-slate-300">
              L2 Assigned: {safeL2}/{safeL1}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-slate-300">
              Executed: {safeExecuted}/{safeL2}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
