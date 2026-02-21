"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  AlertCircle,
  LayoutGrid,
  List as ListIcon,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader, FilterBar } from "@/components/composite";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RequestCard } from "@/components/stock-out-requests/request-card";
import { useResourcePermissions } from "@/lib/hooks/use-permissions";
import { usePaginationParams } from "@/lib/hooks";
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

// Status color mapping for list view badges
const SOR_STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  partially_approved: "#8b5cf6",
  approved: "#3b82f6",
  partially_executed: "#a855f7",
  executed: "#10b981",
  rejected: "#ef4444",
  cancelled: "#94a3b8",
};

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
  const router = useRouter();
  const [requests, setRequests] = useState<StockOutRequest[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [requesterFilter, setRequesterFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  const { canEdit } = useResourcePermissions();

  // URL-driven pagination
  const {
    page: currentPage,
    pageSize,
    setPage: setCurrentPage,
    setPageSize,
  } = usePaginationParams(20);

  // Filter change handlers that reset page to 1
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const handleRequesterChange = useCallback(
    (value: string) => {
      setRequesterFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  // Responsive auto-switch to card view below md breakpoint
  useEffect(() => {
    const checkBreakpoint = () => {
      if (window.innerWidth < 768) setViewMode("card");
    };
    checkBreakpoint();
    window.addEventListener("resize", checkBreakpoint);
    return () => window.removeEventListener("resize", checkBreakpoint);
  }, []);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [requestsRes, usersRes] = await Promise.all([
        supabase
          .from("stock_out_requests")
          .select(`
            id, request_number, status, reason, notes, qmhq_id, requester_id, created_at,
            requester:users!stock_out_requests_requester_id_fkey(id, full_name),
            qmhq:qmhq!stock_out_requests_qmhq_id_fkey(id, request_id, line_name),
            line_items:stock_out_line_items(id, item_name, item_sku, requested_quantity, status)
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      if (requestsRes.error) {
        console.error("Error fetching requests:", requestsRes.error);
        throw new Error(requestsRes.error.message);
      }
      if (usersRes.error) {
        console.error("Error fetching users:", usersRes.error);
        throw new Error(usersRes.error.message);
      }

      setRequests((requestsRes.data as StockOutRequest[]) || []);
      setUsers(usersRes.data || []);
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

      // Requester filter
      if (requesterFilter !== "all" && request.requester_id !== requesterFilter) {
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
  }, [requests, statusFilter, requesterFilter, searchQuery]);

  // Pagination calculations
  const totalItems = filteredRequests.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Paginated items
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Group paginated requests by status for card view
  const groupedRequests = useMemo(() => {
    const groups: Record<keyof typeof STATUS_GROUPS, StockOutRequest[]> = {
      pending: [],
      in_progress: [],
      done: [],
    };

    paginatedRequests.forEach((request) => {
      if ((STATUS_GROUPS.pending as readonly string[]).includes(request.status)) {
        groups.pending.push(request);
      } else if ((STATUS_GROUPS.in_progress as readonly string[]).includes(request.status)) {
        groups.in_progress.push(request);
      } else if ((STATUS_GROUPS.done as readonly string[]).includes(request.status)) {
        groups.done.push(request);
      }
    });

    return groups;
  }, [paginatedRequests]);

  // Count active filters for mobile filter button badge
  const activeFilterCount = [
    statusFilter !== "all",
    requesterFilter !== "all",
  ].filter(Boolean).length;

  // Shared status select content
  const statusSelectContent = (
    <>
      <SelectItem value="all">All Statuses</SelectItem>
      <SelectItem value="pending">Pending</SelectItem>
      <SelectItem value="approved">Approved</SelectItem>
      <SelectItem value="rejected">Rejected</SelectItem>
      <SelectItem value="cancelled">Cancelled</SelectItem>
    </>
  );

  // Shared requester select content
  const requesterSelectContent = (
    <>
      <SelectItem value="all">All Requesters</SelectItem>
      {users.map((u) => (
        <SelectItem key={u.id} value={u.id}>
          <div className="flex items-center gap-2">
            <UserAvatar fullName={u.full_name} size={20} />
            <span>{u.full_name}</span>
          </div>
        </SelectItem>
      ))}
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-12 w-full" />
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
      <div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-400">Error Loading Requests</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
            <button
              onClick={fetchRequests}
              className="mt-2 text-sm text-red-400 underline hover:text-red-300"
            >
              Click to retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Stock-Out Requests"
        description="Request items to be issued from warehouse"
        actions={
          canEdit("sor") && (
            <Link href="/inventory/stock-out-requests/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </Link>
          )
        }
      />

      {/* Filters Bar */}
      <FilterBar>
        {/* Search always visible */}
        <FilterBar.Search
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search by request number or requester..."
        />

        {/* Desktop filters (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-4">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>{statusSelectContent}</SelectContent>
          </Select>

          {/* Requester filter with avatar */}
          <Select value={requesterFilter} onValueChange={handleRequesterChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Requester" />
            </SelectTrigger>
            <SelectContent>{requesterSelectContent}</SelectContent>
          </Select>
        </div>

        {/* Mobile filters button */}
        <div className="flex md:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700"
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="start">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </p>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>{statusSelectContent}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Requester
                </p>
                <Select value={requesterFilter} onValueChange={handleRequesterChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Requesters" />
                  </SelectTrigger>
                  <SelectContent>{requesterSelectContent}</SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Card/List toggle — pushed right */}
        <div className="ml-auto flex items-center border border-slate-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("card")}
            className={
              viewMode === "card"
                ? "p-2 bg-amber-500/20 text-amber-400"
                : "p-2 bg-slate-800/50 text-slate-400 hover:text-slate-200"
            }
            aria-label="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={
              viewMode === "list"
                ? "p-2 bg-amber-500/20 text-amber-400"
                : "p-2 bg-slate-800/50 text-slate-400 hover:text-slate-200"
            }
            aria-label="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
      </FilterBar>

      {/* Content */}
      {paginatedRequests.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400">No stock-out requests found</p>
        </div>
      ) : viewMode === "card" ? (
        <div className="space-y-6">
          {(Object.keys(groupedRequests) as Array<keyof typeof STATUS_GROUPS>).map(
            (groupKey) => {
              const groupItems = groupedRequests[groupKey];
              if (groupItems.length === 0) return null;

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
                      {groupItems.length}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupItems.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))}
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : (
        <div className="command-panel">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    SOR ID
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Item
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Requester
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Reason
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    QMHQ Ref
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() =>
                      router.push(`/inventory/stock-out-requests/${request.id}`)
                    }
                  >
                    {/* SOR ID */}
                    <td className="py-3 px-4">
                      <code className="text-sm font-mono text-amber-400">
                        {request.request_number || "—"}
                      </code>
                    </td>

                    {/* Item */}
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {request.line_items?.length || 0} item(s)
                    </td>

                    {/* Requester */}
                    <td className="py-3 px-4 text-sm text-slate-200">
                      {request.requester?.full_name || "—"}
                    </td>

                    {/* Reason */}
                    <td className="py-3 px-4">
                      <Badge
                        variant="outline"
                        className="text-xs border-slate-600 bg-slate-700/50"
                      >
                        {request.reason}
                      </Badge>
                    </td>

                    {/* QMHQ Ref */}
                    <td className="py-3 px-4">
                      {request.qmhq ? (
                        <code className="text-amber-400 text-sm">
                          {request.qmhq.request_id}
                        </code>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <Badge
                        className="text-xs text-white"
                        style={{
                          backgroundColor:
                            SOR_STATUS_COLORS[request.status] || "#94a3b8",
                          border: "none",
                        }}
                      >
                        {request.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="command-panel mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
