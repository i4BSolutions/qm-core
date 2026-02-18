"use client";

export interface ItemProgressData {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  requested: number;
  /** L1 (quartermaster) approved quantity */
  approved: number;
  /** L2 (admin) warehouse-assigned quantity */
  l2Assigned?: number;
  executed: number;
  rejected: number;
  standardRequested?: number;
  /** Standard units for L1 approval */
  standardApproved?: number;
  /** Standard units for L2 warehouse assignment */
  standardL2Assigned?: number;
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
          const l2Assigned = item.l2Assigned ?? 0;
          // Pending L2 assignment: L1 approved but not yet warehouse-assigned
          const pendingL2 = Math.max(0, item.approved - l2Assigned);
          // Pending execution: L2 assigned but not yet executed
          const pendingExecution = Math.max(0, l2Assigned - item.executed);

          // Cap percentages to prevent overflow
          const approvedPercent = item.requested > 0
            ? Math.min(100, (item.approved / item.requested) * 100)
            : 0;
          const l2AssignedPercent = item.requested > 0
            ? Math.min(100, (l2Assigned / item.requested) * 100)
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

              {/* 4-layer stepped progress bar: Requested > L1 Approved > L2 Assigned > Executed */}
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
                {/* L1 Approved segment (quartermaster decision) */}
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
                  style={{ width: `${approvedPercent}%` }}
                />
                {/* L2 Assigned segment (admin warehouse assignment) */}
                <div
                  className="absolute inset-y-0 left-0 bg-purple-500/60 transition-all duration-500"
                  style={{ width: `${l2AssignedPercent}%` }}
                />
                {/* Executed segment (L3 execution) */}
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                  style={{ width: `${executedPercent}%` }}
                />
              </div>

              {/* Legend row — shows all 4 layers */}
              <div className="flex flex-wrap items-start gap-x-4 gap-y-1 text-xs">
                {/* Requested */}
                <div className="flex items-start text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-600 inline-block mr-1 mt-0.5 flex-shrink-0" />
                  <div>
                    <div>Requested: {item.requested}</div>
                    {item.standardUnitName && item.standardRequested != null && (
                      <div className="text-slate-500 font-mono">
                        {item.standardRequested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                      </div>
                    )}
                  </div>
                </div>

                {/* L1 Approved (quartermaster) */}
                <div className="flex items-start text-blue-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1 mt-0.5 flex-shrink-0" />
                  <div>
                    <div>L1 Approved: {item.approved}</div>
                    {item.standardUnitName && item.standardApproved != null && (
                      <div className="text-blue-500/60 font-mono">
                        {item.standardApproved.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                      </div>
                    )}
                  </div>
                </div>

                {/* L2 Assigned (admin warehouse) — always shown when approved > 0 */}
                {item.approved > 0 && (
                  <div className="flex items-start text-purple-400">
                    <span className="w-2 h-2 rounded-full bg-purple-500 inline-block mr-1 mt-0.5 flex-shrink-0" />
                    <div>
                      <div>L2 Assigned: {l2Assigned}</div>
                      {item.standardUnitName && item.standardL2Assigned != null && (
                        <div className="text-purple-500/60 font-mono">
                          {item.standardL2Assigned.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Executed (L3) */}
                <div className="flex items-start text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1 mt-0.5 flex-shrink-0" />
                  <div>
                    <div>Executed: {item.executed}</div>
                    {item.standardUnitName && item.standardExecuted != null && (
                      <div className="text-emerald-500/60 font-mono">
                        {item.standardExecuted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {item.standardUnitName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rejected */}
                {item.rejected > 0 && (
                  <div className="flex items-center text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-1 flex-shrink-0" />
                    Rejected: {item.rejected}
                  </div>
                )}

                {/* Pending L2 assignment */}
                {pendingL2 > 0 && (
                  <div className="flex items-center text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block mr-1 flex-shrink-0" />
                    Awaiting Assignment: {pendingL2}
                  </div>
                )}

                {/* Pending execution */}
                {pendingExecution > 0 && (
                  <div className="flex items-center text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block mr-1 flex-shrink-0" />
                    Awaiting Execution: {pendingExecution}
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
