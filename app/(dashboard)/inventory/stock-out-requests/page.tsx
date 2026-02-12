"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Search, LayoutGrid, List as ListIcon, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RequestCard } from "@/components/stock-out-requests/request-card";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { PageHeader } from "@/components/composite";
import type { StockOutReason } from "@/types/database";

interface StockOutRequest {
  id: string;
  request_number: string | null;
  status: string;
  reason: StockOutReason;
  notes: string | null;
  qmhq_id: string | null;
  requester_id: string;
  created_at: string | null;
  requester?: {
    id: string;
    full_name: string;
  } | null;
  qmhq?: {
    id: string;
    request_id: string | null;
    line_name: string | null;
  } | null;
  line_items?: Array<{
    id: string;
    item_name: string | null;
    item_sku: string | null;
    requested_quantity: number;
    status: string;
  }>;
}

// Status tabs configuration
const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
] as const;

// Status group mapping for card view
const STATUS_GROUPS = {
  pending: ["pending"],
  in_progress: ["partially_approved", "approved", "partially_executed"],
  done: ["executed", "rejected", "cancelled"],
} as const;

const GROUP_LABELS = {
  pending: "PENDING",
  in_progress: "IN PROGRESS",
  done: "COMPLETED",
} as const;

export default function StockOutRequestsPage() {
  const [requests, setRequests] = useState<StockOutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  const { can } = usePermissions();

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("stock_out_requests")
        .select(`
          id, request_number, status, reason, notes, qmhq_id, requester_id, created_at,
          requester:users!stock_out_requests_requester_id_fkey(id, full_name),
          qmhq:qmhq!stock_out_requests_qmhq_id_fkey(id, request_id, line_name),
          line_items:stock_out_line_items(id, item_name, item_sku, requested_quantity, status)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching requests:", fetchError);
        throw new Error(fetchError.message);
      }

      setRequests((data as StockOutRequest[]) || []);
    } catch (err) {
      console.error("Error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load stock-out requests";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      // Status filter
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesRequestNumber = request.request_number
          ?.toLowerCase()
          .includes(query);
        const matchesRequester = request.requester?.full_name
          ?.toLowerCase()
          .includes(query);

        if (!matchesRequestNumber && !matchesRequester) {
          return false;
        }
      }

      return true;
    });
  }, [requests, statusFilter, searchQuery]);

  // Group requests by status for card view
  const groupedRequests = useMemo(() => {
    const groups: Record<keyof typeof STATUS_GROUPS, StockOutRequest[]> = {
      pending: [],
      in_progress: [],
      done: [],
    };

    filteredRequests.forEach((request) => {
      if (STATUS_GROUPS.pending.includes(request.status as any)) {
        groups.pending.push(request);
      } else if (STATUS_GROUPS.in_progress.includes(request.status as any)) {
        groups.in_progress.push(request);
      } else if (STATUS_GROUPS.done.includes(request.status as any)) {
        groups.done.push(request);
      }
    });

    return groups;
  }, [filteredRequests]);

  // Count by status for tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: requests.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    };

    requests.forEach((request) => {
      if (request.status === "pending") counts.pending++;
      if (request.status === "approved" || request.status === "partially_approved") {
        counts.approved++;
      }
      if (request.status === "rejected") counts.rejected++;
      if (request.status === "cancelled") counts.cancelled++;
    });

    return counts;
  }, [requests]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-400">Error Loading Requests</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <PageHeader
        title="Stock-Out Requests"
        description="Request items to be issued from warehouse"
        actions={
          can("create", "stock_out_requests") && (
            <Link href="/inventory/stock-out-requests/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </Link>
          )
        }
      />

      {/* Status Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
              ${
                statusFilter === tab.key
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600"
              }
            `}
          >
            {tab.label}
            <Badge
              variant="outline"
              className={`ml-2 ${
                statusFilter === tab.key
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  : "border-slate-600 bg-slate-700/50 text-slate-300"
              }`}
            >
              {statusCounts[tab.key] || 0}
            </Badge>
          </button>
        ))}
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by request number or requester..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("card")}
            className={viewMode === "card" ? "bg-slate-700" : ""}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "bg-slate-700" : ""}
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {filteredRequests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No stock-out requests found</p>
        </div>
      ) : viewMode === "card" ? (
        <div className="space-y-6">
          {(Object.keys(groupedRequests) as Array<keyof typeof STATUS_GROUPS>).map(
            (groupKey) => {
              const groupRequests = groupedRequests[groupKey];
              if (groupRequests.length === 0) return null;

              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-2 mb-4">
                    <span
                      className={`status-dot ${
                        groupKey === "pending"
                          ? "status-dot-todo"
                          : groupKey === "in_progress"
                          ? "status-dot-progress"
                          : "status-dot-done"
                      }`}
                    />
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                      {GROUP_LABELS[groupKey]}
                    </h2>
                    <Badge variant="outline" className="border-slate-600 bg-slate-700/50">
                      {groupRequests.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupRequests.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-800/50 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Request #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Requester
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                  onClick={() =>
                    (window.location.href = `/inventory/stock-out-requests/${request.id}`)
                  }
                >
                  <td className="px-4 py-3">
                    <code className="text-sm font-mono text-amber-400">
                      {request.request_number || "—"}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-200">
                    {request.requester?.full_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className="text-xs border-slate-600 bg-slate-700/50"
                    >
                      {request.reason}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {request.line_items?.length || 0} item(s)
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {request.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {request.created_at
                      ? new Date(request.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
