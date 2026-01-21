"use client";

import { cn } from "@/lib/utils";

interface POProgressBarProps {
  invoicedPercent: number;
  receivedPercent: number;
  showLabels?: boolean;
  size?: "sm" | "md";
}

export function POProgressBar({
  invoicedPercent,
  receivedPercent,
  showLabels = true,
  size = "md",
}: POProgressBarProps) {
  const heightClass = size === "sm" ? "h-1.5" : "h-2";

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
        <div className={cn("w-full rounded-full bg-slate-700/50", heightClass)}>
          <div
            className={cn(
              "rounded-full bg-gradient-to-r from-amber-600 to-amber-500 transition-all duration-500",
              heightClass
            )}
            style={{ width: `${invoicedPercent}%` }}
          />
        </div>
      </div>

      {/* Received Progress */}
      <div>
        {showLabels && (
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-400">Received</span>
            <span className="text-emerald-400 font-mono">{receivedPercent}%</span>
          </div>
        )}
        <div className={cn("w-full rounded-full bg-slate-700/50", heightClass)}>
          <div
            className={cn(
              "rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500",
              heightClass
            )}
            style={{ width: `${receivedPercent}%` }}
          />
        </div>
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
