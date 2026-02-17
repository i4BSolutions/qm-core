"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  Package,
  Wallet,
  ShoppingCart,
  Radio,
  ChevronRight,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PageHeader, FilterBar, CardViewGrid } from "@/components/composite";
import { usePaginationParams } from "@/lib/hooks";
import type { QMHQ, StatusConfig, Category, User as UserType, QMRL } from "@/types/database";

// Extended QMHQ type with joined relations
interface QMHQWithRelations extends QMHQ {
  status?: StatusConfig | null;
  category?: Category | null;
  assigned_user?: UserType | null;
  qmrl?: Pick<QMRL, "id" | "request_id" | "title"> | null;
}

// Route type configuration
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  item: { icon: Package, label: "Item", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  expense: { icon: Wallet, label: "Expense", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  po: { icon: ShoppingCart, label: "PO", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
};

// Status group configuration
const statusGroups = [
  { key: "to_do", label: "PENDING", dotClass: "status-dot status-dot-todo", color: "slate" },
  { key: "in_progress", label: "IN PROGRESS", dotClass: "status-dot status-dot-progress", color: "amber" },
  { key: "done", label: "COMPLETED", dotClass: "status-dot status-dot-done", color: "emerald" },
] as const;

export default function QMHQPage() {
  const router = useRouter();
  const [qmhqs, setQmhqs] = useState<QMHQWithRelations[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

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

  const handleRouteChange = useCallback(
    (value: string) => {
      setRouteFilter(value);
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

  const handleAssignedChange = useCallback(
    (value: string) => {
      setAssignedFilter(value);
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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [qmhqRes, statusRes, categoryRes, userRes] = await Promise.all([
        supabase
          .from("qmhq")
          .select(`
            id, request_id, line_name, description, route_type,
            status_id, category_id, assigned_to, qmrl_id,
            amount, currency, exchange_rate, amount_eusd,
            quantity, item_id, created_at,
            status:status_config(id, name, color, status_group),
            category:categories(id, name, color),
            assigned_user:users!qmhq_assigned_to_fkey(id, full_name),
            qmrl:qmrl!qmhq_qmrl_id_fkey(id, request_id, title)
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("status_config")
          .select("id, name, color, status_group, display_order")
          .eq("entity_type", "qmhq")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("categories")
          .select("id, name, color, display_order")
          .eq("entity_type", "qmhq")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      // Check for errors
      if (qmhqRes.error) {
        console.error('QMHQ query error:', qmhqRes.error);
        throw new Error(qmhqRes.error.message);
      }
      if (statusRes.error) {
        console.error('Status query error:', statusRes.error);
        throw new Error(statusRes.error.message);
      }
      if (categoryRes.error) {
        console.error('Category query error:', categoryRes.error);
        throw new Error(categoryRes.error.message);
      }
      if (userRes.error) {
        console.error('User query error:', userRes.error);
        throw new Error(userRes.error.message);
      }

      // Set data
      if (qmhqRes.data) setQmhqs(qmhqRes.data as QMHQWithRelations[]);
      if (statusRes.data) setStatuses(statusRes.data as StatusConfig[]);
      if (categoryRes.data) setCategories(categoryRes.data as Category[]);
      if (userRes.data) setUsers(userRes.data as UserType[]);

    } catch (err) {
      console.error('Error fetching QMHQ data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load QMHQ data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredQmhqs = useMemo(() => {
    return qmhqs.filter((qmhq) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          qmhq.line_name?.toLowerCase().includes(query) ||
          qmhq.request_id?.toLowerCase().includes(query) ||
          qmhq.qmrl?.request_id?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (routeFilter !== "all" && qmhq.route_type !== routeFilter) return false;
      if (statusFilter !== "all" && qmhq.status_id !== statusFilter) return false;
      if (assignedFilter !== "all" && qmhq.assigned_to !== assignedFilter) return false;
      return true;
    });
  }, [qmhqs, searchQuery, routeFilter, statusFilter, assignedFilter]);

  // Pagination calculations
  const totalItems = filteredQmhqs.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Paginated items
  const paginatedQmhqs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredQmhqs.slice(start, end);
  }, [filteredQmhqs, currentPage, pageSize]);

  const groupedQmhqs = useMemo(() => {
    const groups: Record<string, QMHQWithRelations[]> = {
      to_do: [],
      in_progress: [],
      done: [],
    };

    paginatedQmhqs.forEach((qmhq) => {
      const statusGroup = qmhq.status?.status_group || "to_do";
      if (groups[statusGroup]) {
        groups[statusGroup].push(qmhq);
      } else {
        groups.to_do.push(qmhq);
      }
    });

    return groups;
  }, [paginatedQmhqs]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const RouteIcon = ({ routeType }: { routeType: string }) => {
    const config = routeConfig[routeType];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className={`h-4 w-4 ${config.color}`} />;
  };

  // Count active filters for mobile filter button badge
  const activeFilterCount = [
    routeFilter !== "all",
    statusFilter !== "all",
    assignedFilter !== "all",
  ].filter(Boolean).length;

  // Shared assignee select content
  const assigneeSelectContent = (
    <>
      <SelectItem value="all">All Assignees</SelectItem>
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
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-50" />

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-red-400 underline hover:text-red-300"
          >
            Click to retry
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="QMHQ Lines"
        description={`${totalItems} line${totalItems !== 1 ? "s" : ""} found${totalItems !== qmhqs.length ? ` (of ${qmhqs.length} total)` : ""}`}
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
              Operations
            </span>
          </div>
        }
        actions={
          <Link href="/qmhq/new">
            <Button className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New QMHQ
              </span>
            </Button>
          </Link>
        }
      />

      {/* Filters Bar */}
      <FilterBar>
        {/* Search always visible */}
        <FilterBar.Search
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search by name or ID..."
        />

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-4">
          <Select value={routeFilter} onValueChange={handleRouteChange}>
            <SelectTrigger className="w-[140px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Route" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Routes</SelectItem>
              <SelectItem value="item">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-400" />
                  Item
                </div>
              </SelectItem>
              <SelectItem value="expense">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  Expense
                </div>
              </SelectItem>
              <SelectItem value="po">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-purple-400" />
                  PO
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color || "#94a3b8" }}
                    />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Assigned person filter */}
          <Select value={assignedFilter} onValueChange={handleAssignedChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>{assigneeSelectContent}</SelectContent>
          </Select>
        </div>

        {/* Mobile filters button */}
        <div className="flex md:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-700">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="start">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Route</p>
                <Select value={routeFilter} onValueChange={handleRouteChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Routes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Routes</SelectItem>
                    <SelectItem value="item">Item</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="po">PO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</p>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Assignee</p>
                <Select value={assignedFilter} onValueChange={handleAssignedChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Assignees" />
                  </SelectTrigger>
                  <SelectContent>{assigneeSelectContent}</SelectContent>
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
            <List className="h-4 w-4" />
          </button>
        </div>
      </FilterBar>

      {/* Card View - Kanban Style */}
      {viewMode === "card" && (
        <CardViewGrid
          items={paginatedQmhqs}
          groups={statusGroups.map(g => ({ key: g.key, label: g.label, dotClass: g.dotClass }))}
          groupBy={(qmhq) => qmhq.status?.status_group || "to_do"}
          emptyMessage="No items"
          renderCard={(qmhq, index) => (
            <Link key={qmhq.id} href={`/qmhq/${qmhq.id}`} className="block mb-2">
              <div
                className="tactical-card corner-accents p-4 animate-slide-up cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Scan line effect */}
                <div className="scan-overlay" />

                {/* Header Row */}
                <div className="relative flex items-center justify-between mb-3">
                  <div className="request-id-badge">
                    <code>{qmhq.request_id}</code>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${routeConfig[qmhq.route_type]?.bgColor}`}>
                    <RouteIcon routeType={qmhq.route_type} />
                    <span className={`text-xs font-medium ${routeConfig[qmhq.route_type]?.color}`}>
                      {routeConfig[qmhq.route_type]?.label}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-slate-200 mb-2 line-clamp-2 leading-snug">
                  {qmhq.line_name}
                </h3>

                {/* Parent QMRL */}
                {qmhq.qmrl && (
                  <div className="mb-3 text-xs text-slate-400">
                    <span className="text-slate-500">From:</span>{" "}
                    <code className="text-amber-400">{qmhq.qmrl.request_id}</code>
                  </div>
                )}

                {/* Financial Info for expense/po routes */}
                {(qmhq.route_type === "expense" || qmhq.route_type === "po") && qmhq.amount && (
                  <div className="mb-3 p-2 rounded bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Amount</span>
                      <CurrencyDisplay
                        amount={qmhq.amount}
                        currency={qmhq.currency || "MMK"}
                        amountEusd={qmhq.amount_eusd}
                        size="sm"
                        align="right"
                        context="card"
                        fluid
                      />
                    </div>
                  </div>
                )}

                {/* Category Tag */}
                {qmhq.category && (
                  <div className="mb-3">
                    <Badge
                      variant="outline"
                      className="text-xs font-medium"
                      style={{
                        borderColor: qmhq.category.color || "rgb(100, 116, 139)",
                        color: qmhq.category.color || "rgb(148, 163, 184)",
                        backgroundColor: `${qmhq.category.color}10` || "transparent",
                      }}
                    >
                      {qmhq.category.name}
                    </Badge>
                  </div>
                )}

                {/* Divider */}
                <div className="divider-accent" />

                {/* Meta Row */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-slate-400">
                    <span>{formatDate(qmhq.created_at)}</span>
                    {qmhq.assigned_user && (
                      <span className="truncate max-w-[80px]">
                        {qmhq.assigned_user.full_name?.split(" ")[0]}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>

                {/* Status Badge */}
                {qmhq.status && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                    <Badge
                      variant="outline"
                      className="text-xs font-mono uppercase tracking-wider"
                      style={{
                        borderColor: qmhq.status.color || undefined,
                        color: qmhq.status.color || undefined,
                      }}
                    >
                      {qmhq.status.name}
                    </Badge>
                  </div>
                )}
              </div>
            </Link>
          )}
        />
      )}

      {/* List View */}
      {viewMode === "list" && (
        <TooltipProvider>
          <div className="command-panel">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">ID</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Route</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Parent QMRL</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Amount (EUSD)</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedQmhqs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No QMHQ lines found
                      </td>
                    </tr>
                  ) : (
                    paginatedQmhqs.map((qmhq) => (
                      <tr
                        key={qmhq.id}
                        className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                        onClick={() => router.push(`/qmhq/${qmhq.id}`)}
                      >
                        <td className="py-3 px-4">
                          <code className="text-amber-400 text-sm">{qmhq.request_id}</code>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200 font-medium">{qmhq.line_name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${routeConfig[qmhq.route_type]?.bgColor}`}>
                            <RouteIcon routeType={qmhq.route_type} />
                            <span className={`text-xs font-medium ${routeConfig[qmhq.route_type]?.color}`}>
                              {routeConfig[qmhq.route_type]?.label}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {qmhq.qmrl ? (
                            <code className="text-slate-400 text-sm">{qmhq.qmrl.request_id}</code>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(qmhq.route_type === "expense" || qmhq.route_type === "po") && qmhq.amount ? (
                            <CurrencyDisplay
                              amount={qmhq.amount}
                              currency={qmhq.currency || "MMK"}
                              amountEusd={qmhq.amount_eusd}
                              size="sm"
                              align="right"
                              context="card"
                              fluid
                            />
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qmhq.status ? (
                            <Badge
                              className="text-xs text-white"
                              style={{
                                backgroundColor: qmhq.status.color || "#94a3b8",
                                border: "none",
                              }}
                            >
                              {qmhq.status.name}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {qmhq.assigned_user ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex cursor-default">
                                  <UserAvatar
                                    fullName={qmhq.assigned_user.full_name}
                                    size={28}
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {qmhq.assigned_user.full_name}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TooltipProvider>
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
