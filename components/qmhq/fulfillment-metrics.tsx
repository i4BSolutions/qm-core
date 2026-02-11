"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FulfillmentMetricsProps {
  qmhqId: string;
}

interface Metrics {
  requested: number;
  approved: number;
  rejected: number;
  executed: number;
}

export function FulfillmentMetrics({ qmhqId }: FulfillmentMetricsProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Fetch stock-out request with nested line items and approvals
      const { data: sorData, error: sorError } = await supabase
        .from("stock_out_requests")
        .select(`
          id,
          line_items:stock_out_line_items(
            id,
            requested_quantity,
            status,
            approvals:stock_out_approvals(
              approved_quantity,
              decision
            )
          )
        `)
        .eq("qmhq_id", qmhqId)
        .eq("is_active", true)
        .single();

      // If no SOR found or error, set metrics to null
      if (sorError || !sorData) {
        setMetrics(null);
        setIsLoading(false);
        return;
      }

      // Calculate requested: sum of all line_item.requested_quantity
      let requested = 0;
      let approved = 0;
      let rejected = 0;

      if (sorData.line_items && Array.isArray(sorData.line_items)) {
        for (const lineItem of sorData.line_items) {
          requested += lineItem.requested_quantity || 0;

          // Calculate approved and rejected from approvals
          if (lineItem.approvals && Array.isArray(lineItem.approvals)) {
            for (const approval of lineItem.approvals) {
              if (approval.decision === "approved") {
                approved += approval.approved_quantity || 0;
              } else if (approval.decision === "rejected") {
                rejected += approval.approved_quantity || 0;
              }
            }
          }
        }
      }

      // Calculate executed: sum of completed inventory_out transactions
      const { data: txData } = await supabase
        .from("inventory_transactions")
        .select("quantity")
        .eq("qmhq_id", qmhqId)
        .eq("movement_type", "inventory_out")
        .eq("status", "completed")
        .eq("is_active", true);

      const executed = txData?.reduce((sum, tx) => sum + (tx.quantity || 0), 0) || 0;

      setMetrics({
        requested,
        approved,
        rejected,
        executed,
      });
    } catch (error) {
      console.error("Error fetching fulfillment metrics:", error);
      setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [qmhqId]);

  // Fetch metrics on mount and when qmhqId changes
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // BroadcastChannel listener for cross-tab sync
  useEffect(() => {
    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel("qm-stock-out-execution");

      channel.onmessage = (event) => {
        if (event.data.type === "APPROVAL_EXECUTED" && event.data.qmhqId === qmhqId) {
          fetchMetrics();
        }
      };
    } catch (error) {
      // BroadcastChannel not supported (Safari) - graceful degradation
      console.warn("BroadcastChannel not supported:", error);
    }

    return () => {
      try {
        channel?.close();
      } catch (error) {
        // Ignore errors on cleanup
      }
    };
  }, [qmhqId, fetchMetrics]);

  // Loading state
  if (isLoading) {
    return (
      <div className="command-panel p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Empty state - no SOR linked
  if (metrics === null) {
    return (
      <div className="command-panel p-6">
        <div className="flex items-center justify-center py-4">
          <p className="text-slate-500 text-sm">No stock-out request linked</p>
        </div>
      </div>
    );
  }

  // Render metrics
  const effectiveTarget = metrics.requested - metrics.rejected;

  return (
    <div className="command-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-200">Fulfillment</h3>
        <span className="text-sm text-slate-400 font-mono">
          {metrics.executed}/{effectiveTarget}
          {metrics.rejected > 0 && (
            <span className="text-red-400 ml-1">(-{metrics.rejected})</span>
          )}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {/* Requested */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Requested</p>
          <p className="font-mono text-xl text-slate-200">{metrics.requested}</p>
        </div>

        {/* Approved */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Approved</p>
          <p className="font-mono text-xl text-emerald-400">{metrics.approved}</p>
        </div>

        {/* Rejected */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Rejected</p>
          <p className="font-mono text-xl text-red-400">{metrics.rejected}</p>
        </div>

        {/* Executed */}
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Executed</p>
          <p className="font-mono text-xl text-blue-400">{metrics.executed}</p>
        </div>
      </div>
    </div>
  );
}
