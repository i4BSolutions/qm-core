"use client";

import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface POProgressBarProps {
  invoicedPercent: number;
  receivedPercent: number;
  showLabels?: boolean;
  size?: "sm" | "md";
  /** Optional raw counts for tooltip display */
  totalQty?: number;
  invoicedQty?: number;
  receivedQty?: number;
}

export function POProgressBar({
  invoicedPercent,
  receivedPercent,
  showLabels = true,
  size = "md",
  totalQty,
  invoicedQty,
  receivedQty,
}: POProgressBarProps) {
  const heightClass = size === "sm" ? "h-1.5" : "h-2";
  const hasRawCounts = totalQty !== undefined && invoicedQty !== undefined && receivedQty !== undefined;

  const invoicedBar = (
    <div className={cn("w-full rounded-full bg-slate-700/50", heightClass)}>
      <div
        className={cn(
          "rounded-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-500",
          heightClass
        )}
        style={{ width: `${invoicedPercent}%` }}
      />
    </div>
  );

  const receivedBar = (
    <div className={cn("w-full rounded-full bg-slate-700/50", heightClass)}>
      <div
        className={cn(
          "rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500",
          heightClass
        )}
        style={{ width: `${receivedPercent}%` }}
      />
    </div>
  );

  return (
    <div className="space-y-1.5">
      {/* Invoiced Progress */}
      <div>
        {showLabels && (
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-400">Invoiced</span>
            <span className="text-amber-400 font-mono">{invoicedPercent}%</span>
          </div>
        )}
        {hasRawCounts ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">{invoicedBar}</div>
              </TooltipTrigger>
              <TooltipContent side="top" className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                  <span className="text-slate-400">Ordered:</span>
                  <span className="font-mono text-slate-200 ml-auto pl-3">{totalQty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-slate-400">Invoiced:</span>
                  <span className="font-mono text-amber-300 ml-auto pl-3">{invoicedQty}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          invoicedBar
        )}
      </div>

      {/* Received Progress */}
      <div>
        {showLabels && (
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-400">Received</span>
            <span className="text-emerald-400 font-mono">{receivedPercent}%</span>
          </div>
        )}
        {hasRawCounts ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="cursor-default">{receivedBar}</div>
              </TooltipTrigger>
              <TooltipContent side="top" className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                  <span className="text-slate-400">Ordered:</span>
                  <span className="font-mono text-slate-200 ml-auto pl-3">{totalQty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-400">Received:</span>
                  <span className="font-mono text-emerald-300 ml-auto pl-3">{receivedQty}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          receivedBar
        )}
      </div>
    </div>
  );
}

interface MiniProgressBarProps {
  percent: number;
  color?: "amber" | "emerald" | "blue" | "purple";
}

export function MiniProgressBar({
  percent,
  color = "amber",
}: MiniProgressBarProps) {
  const colorClasses = {
    amber: "from-amber-600 to-amber-500",
    emerald: "from-emerald-600 to-emerald-500",
    blue: "from-blue-600 to-blue-500",
    purple: "from-purple-600 to-purple-500",
  };

  return (
    <div className="w-full h-1 rounded-full bg-slate-700/50">
      <div
        className={cn(
          "h-1 rounded-full bg-gradient-to-r transition-all duration-500",
          colorClasses[color]
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
