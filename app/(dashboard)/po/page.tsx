"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  Radio,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PageHeader, FilterBar } from "@/components/composite";
import { UserAvatar } from "@/components/ui/user-avatar";
import { POCard } from "@/components/po/po-card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { POStatusBadgeWithTooltip } from "@/components/po/po-status-badge";
import { POProgressBar } from "@/components/po/po-progress-bar";
import { PO_STATUS_CONFIG, calculatePOProgress } from "@/lib/utils/po-status";
import { usePaginationParams } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type {
  PurchaseOrder,
  Supplier,
  QMHQ,
  POStatusEnum,
  User as UserType,
} from "@/types/database";

// Extended PO type with joined relations
interface POWithRelations extends PurchaseOrder {
  supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  qmhq?: Pick<QMHQ, "id" | "request_id" | "line_name"> & {
    assigned_to?: string | null;
    assigned_user?: { id: string; full_name: string } | null;
  } | null;
  line_items_aggregate?: {
    total_quantity: number;
    total_invoiced: number;
    total_received: number;
  };
}

// Status group configuration for card view
const statusGroups = [
  {
    key: "active",
    label: "ACTIVE",
    dotClass: "status-dot status-dot-progress",
  },
  {
    key: "completed",
    label: "COMPLETED",
    dotClass: "status-dot status-dot-done",
  },
  {
    key: "cancelled",
    label: "CANCELLED",
    dotClass: "status-dot status-dot-error",
  },
] as const;

export default function POListPage() {
  const router = useRouter();
  const [pos, setPOs] = useState<POWithRelations[]>([]);
  const [suppliers, setSuppliers] = useState<Pick<Supplier, "id" | "name" | "company_name">[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
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

  const handleStatusChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const handleSupplierChange = useCallback(
    (value: string) => {
      setSupplierFilter(value);
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

      const [posRes, suppliersRes, usersRes] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(`
            *,
            supplier:suppliers(id, name, company_name),
            qmhq:qmhq!purchase_orders_qmhq_id_fkey(id, request_id, line_name, assigned_to, assigned_user:users!qmhq_assigned_to_fkey(id, full_name)),
            po_line_items(quantity, invoiced_quantity, received_quantity, is_active)
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("suppliers")
          .select("id, name, company_name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      // Check for errors
      if (posRes.error) {
        console.error('PO query error:', posRes.error);
        throw new Error(posRes.error.message);
      }
      if (suppliersRes.error) {
        console.error('Suppliers query error:', suppliersRes.error);
        throw new Error(suppliersRes.error.message);
      }
      if (usersRes.error) {
        console.error('Users query error:', usersRes.error);
        throw new Error(usersRes.error.message);
      }

      // Process POs with client-side aggregation (much faster than N+1 queries)
      if (posRes.data) {
        const posWithAggregates = (posRes.data as any[]).map((po) => {
          const lineItems = (po.po_line_items || []).filter((item: any) => item.is_active !== false);

          const aggregate = lineItems.reduce(
            (acc: any, item: any) => ({
              total_quantity: acc.total_quantity + (item.quantity || 0),
              total_invoiced: acc.total_invoiced + (item.invoiced_quantity || 0),
              total_received: acc.total_received + (item.received_quantity || 0),
            }),
            { total_quantity: 0, total_invoiced: 0, total_received: 0 }
          );

          // Remove the po_line_items array from the PO object (we only need the aggregate)
          const { po_line_items, ...poData } = po;

          return {
            ...poData,
            line_items_aggregate: aggregate,
          } as POWithRelations;
        });

        setPOs(posWithAggregates);
      }

      if (suppliersRes.data) setSuppliers(suppliersRes.data);
      if (usersRes.data) setUsers(usersRes.data as UserType[]);

    } catch (err) {
      console.error('Error fetching PO data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Purchase Orders';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPOs = useMemo(() => {
    return pos.filter((po) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          po.po_number?.toLowerCase().includes(query) ||
          po.supplier?.name?.toLowerCase().includes(query) ||
          po.supplier?.company_name?.toLowerCase().includes(query) ||
          po.qmhq?.request_id?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (statusFilter === "active" && (po.status === "closed" || po.status === "cancelled")) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && po.status !== statusFilter) return false;
      if (supplierFilter !== "all" && po.supplier_id !== supplierFilter) return false;
      if (assignedFilter !== "all" && po.qmhq?.assigned_to !== assignedFilter) return false;
      return true;
    });
  }, [pos, searchQuery, statusFilter, supplierFilter, assignedFilter]);

  // Pagination calculations
  const totalItems = filteredPOs.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Paginated items
  const paginatedPOs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredPOs.slice(start, end);
  }, [filteredPOs, currentPage, pageSize]);

  // Group POs by status group for card view
  const groupedPOs = useMemo(() => {
    const groups: Record<string, POWithRelations[]> = {
      active: [],
      completed: [],
      cancelled: [],
    };

    paginatedPOs.forEach((po) => {
      const status = po.status || "not_started";
      if (status === "closed") {
        groups.completed.push(po);
      } else if (status === "cancelled") {
        groups.cancelled.push(po);
      } else {
        groups.active.push(po);
      }
    });

    return groups;
  }, [paginatedPOs]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Count active filters
  const activeFilterCount = [
    statusFilter !== "all",
    supplierFilter !== "all",
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
        title="Purchase Orders"
        description={`${totalItems} PO${totalItems !== 1 ? "s" : ""} found${totalItems !== pos.length ? ` (of ${pos.length} total)` : ""}`}
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-purple-500/10 border border-purple-500/20">
            <Radio className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-purple-500">
              Procurement
            </span>
          </div>
        }
        actions={
          <Link href="/po/new">
            <Button className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New PO
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
          placeholder="Search by PO#, supplier, QMHQ..."
        />

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-4">
          <FilterBar.Select
            value={statusFilter}
            onChange={handleStatusChange}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "active", label: "Active (excl. Closed/Cancelled)" },
              ...Object.entries(PO_STATUS_CONFIG).map(([key, config]) => ({
                value: key,
                label: config.label,
              })),
            ]}
            placeholder="Status"
          />
          <FilterBar.Select
            value={supplierFilter}
            onChange={handleSupplierChange}
            options={[
              { value: "all", label: "All Suppliers" },
              ...suppliers.map(s => ({
                value: s.id,
                label: s.company_name || s.name,
              })),
            ]}
            placeholder="Supplier"
          />
          {/* Assigned person filter (via QMHQ join) */}
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
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</p>
                <Select value={statusFilter} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    {Object.entries(PO_STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Supplier</p>
                <Select value={supplierFilter} onValueChange={handleSupplierChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.company_name || s.name}</SelectItem>
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

      {/* Card View - Grouped by Status */}
      {viewMode === "card" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {statusGroups.map((group) => (
            <div key={group.key} className="flex flex-col">
              {/* Column Header */}
              <div className="column-header">
                <div className={group.dotClass} />
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">
                  {group.label}
                </h2>
                <span className="stat-counter ml-auto">
                  {groupedPOs[group.key].length}
                </span>
              </div>

              {/* Column Body */}
              <div className="flex-1 rounded-b-lg border border-t-0 border-slate-700 bg-slate-900/30 p-3 min-h-[400px]">
                <div className="space-y-3">
                  {groupedPOs[group.key].length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700">
                      <p className="text-sm text-slate-400">No POs</p>
                    </div>
                  ) : (
                    groupedPOs[group.key].map((po, index) => (
                      <POCard key={po.id} po={po} animationDelay={index * 50} />
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="command-panel">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    PO#
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Supplier
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    QMHQ
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Amount (EUSD)
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPOs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No Purchase Orders found
                    </td>
                  </tr>
                ) : (
                  paginatedPOs.map((po) => {
                    const progress = calculatePOProgress(
                      po.line_items_aggregate?.total_quantity ?? 0,
                      po.line_items_aggregate?.total_invoiced ?? 0,
                      po.line_items_aggregate?.total_received ?? 0
                    );

                    return (
                      <tr
                        key={po.id}
                        className={cn(
                          "border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer",
                          po.status === "closed" && "opacity-60",
                          po.status === "cancelled" && "opacity-50"
                        )}
                        onClick={() => router.push(`/po/${po.id}`)}
                      >
                        <td className="py-3 px-4">
                          <code className={cn(
                            "text-amber-400 text-sm",
                            po.status === "cancelled" && "line-through text-red-400"
                          )}>
                            {po.po_number}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-200 font-medium">
                            {po.supplier?.company_name || po.supplier?.name || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {po.qmhq ? (
                            <code className="text-slate-400 text-sm">{po.qmhq.request_id}</code>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <CurrencyDisplay
                            amount={po.total_amount}
                            currency={po.currency || "MMK"}
                            amountEusd={po.total_amount_eusd}
                            size="sm"
                            align="right"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1.5">
                            <POStatusBadgeWithTooltip
                              status={(po.status || "not_started") as POStatusEnum}
                              totalQty={po.line_items_aggregate?.total_quantity ?? 0}
                              invoicedQty={po.line_items_aggregate?.total_invoiced ?? 0}
                              receivedQty={po.line_items_aggregate?.total_received ?? 0}
                              size="sm"
                            />
                            {(po.line_items_aggregate?.total_quantity ?? 0) > 0 && (
                              <div className="w-24">
                                <POProgressBar
                                  invoicedPercent={progress.invoicedPercent}
                                  receivedPercent={progress.receivedPercent}
                                  showLabels={false}
                                  size="sm"
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-400 text-sm">{formatDate(po.po_date)}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
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
