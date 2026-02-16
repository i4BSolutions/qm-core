"use client";

export interface ItemProgressData {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  requested: number;
  approved: number;
  executed: number;
  rejected: number;
  standardRequested?: number;
  standardApproved?: number;
  standardExecuted?: number;
  standardUnitName?: string;
}

interface ItemsSummaryProgressProps {
  items: ItemProgressData[];
}

export function ItemsSummaryProgress({ items }: ItemsSummaryProgressProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Items Summary
      </h3>
      <div className="space-y-4">
        {items.map((item) => {
          const pending = Math.max(0, item.approved - item.executed);

          // Cap percentages to prevent overflow
          const approvedPercent = item.requested > 0
            ? Math.min(100, (item.approved / item.requested) * 100)
            : 0;
          const executedPercent = item.requested > 0
            ? Math.min(100, (item.executed / item.requested) * 100)
            : 0;
          const rejectedPercent = item.requested > 0
            ? Math.min(100, (item.rejected / item.requested) * 100)
            : 0;

          return (
            <div key={item.itemId} className="space-y-2">
              {/* Item header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  {item.itemSku && (
                    <span className="text-xs font-mono text-amber-400">
                      {item.itemSku}
                    </span>
                  )}
                  <span className="text-sm text-slate-200">{item.itemName}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {item.executed}/{item.requested - item.rejected}
                  {item.rejected > 0 && (
                    <span className="text-red-400 ml-1">
                      (-{item.rejected})
                    </span>
                  )}
                </span>
              </div>

              {/* Stepped progress bar */}
              <div className="h-6 w-full bg-slate-800/50 rounded-lg overflow-hidden relative">
                {/* Requested baseline (full width) */}
                <div
                  className="absolute inset-y-0 left-0 bg-slate-600/30 transition-all duration-500"
                  style={{ width: "100%" }}
                />
                {/* Rejected segment (from right) */}
                {rejectedPercent > 0 && (
                  <div
                    className="absolute inset-y-0 right-0 bg-red-500/40 transition-all duration-500"
                    style={{ width: `${rejectedPercent}%` }}
                  />
                )}
                {/* Approved segment */}
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
                  style={{ width: `${approvedPercent}%` }}
                />
                {/* Executed segment */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                  style={{ width: `${executedPercent}%` }}
                />
              </div>

              {/* Legend row */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-600 inline-block mr-1" />
                  <div>
                    <div>Requested: {item.requested}</div>
                    {item.standardUnitName && item.standardRequested != null && (
                      <div className="text-slate-500 font-mono">
                        {item.standardRequested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
                  <div>
                    <div>Approved: {item.approved}</div>
                    {item.standardUnitName && item.standardApproved != null && (
                      <div className="text-blue-500/60 font-mono">
                        {item.standardApproved.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />
                  <div>
                    <div>Executed: {item.executed}</div>
                    {item.standardUnitName && item.standardExecuted != null && (
                      <div className="text-emerald-500/60 font-mono">
                        {item.standardExecuted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                      </div>
                    )}
                  </div>
                </div>
                {item.rejected > 0 && (
                  <div className="flex items-center text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1" />
                    Rejected: {item.rejected}
                  </div>
                )}
                {pending > 0 && (
                  <div className="flex items-center text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1" />
                    Pending: {pending}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
