"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Radio,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POCard } from "@/components/po/po-card";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { POStatusBadge } from "@/components/po/po-status-badge";
import { POProgressBar } from "@/components/po/po-progress-bar";
import { PO_STATUS_CONFIG, calculatePOProgress } from "@/lib/utils/po-status";
import type {
  PurchaseOrder,
  Supplier,
  QMHQ,
  POStatusEnum,
} from "@/types/database";

// Extended PO type with joined relations
interface POWithRelations extends PurchaseOrder {
  supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  qmhq?: Pick<QMHQ, "id" | "request_id" | "line_name"> | null;
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
  const [pos, setPOs] = useState<POWithRelations[]>([]);
  const [suppliers, setSuppliers] = useState<Pick<Supplier, "id" | "name" | "company_name">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [posRes, suppliersRes] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(`
            *,
            supplier:suppliers(id, name, company_name),
            qmhq:qmhq!purchase_orders_qmhq_id_fkey(id, request_id, line_name),
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, supplierFilter]);

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
      if (statusFilter !== "all" && po.status !== statusFilter) return false;
      if (supplierFilter !== "all" && po.supplier_id !== supplierFilter) return false;
      return true;
    });
  }, [pos, searchQuery, statusFilter, supplierFilter]);

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

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-purple-500/10 border border-purple-500/20">
              <Radio className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-purple-500">
                Procurement
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-200">
            Purchase Orders
          </h1>
          <p className="mt-1 text-slate-400">
            {totalItems} PO{totalItems !== 1 ? "s" : ""} found
            {totalItems !== pos.length && (
              <span className="text-slate-500"> (of {pos.length} total)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("card")}
              className={`p-2 transition-colors ${
                viewMode === "card"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Link href="/po/new">
            <Button className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New PO
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="command-panel">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by PO#, supplier, QMHQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(PO_STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          key === "not_started"
                            ? "#94a3b8"
                            : key === "partially_invoiced"
                            ? "#f59e0b"
                            : key === "awaiting_delivery"
                            ? "#3b82f6"
                            : key === "partially_received"
                            ? "#a855f7"
                            : key === "closed"
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.company_name || supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
                  <th className="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 w-32">
                    Progress
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPOs.map((po) => {
                  const progress = calculatePOProgress(
                    po.line_items_aggregate?.total_quantity ?? 0,
                    po.line_items_aggregate?.total_invoiced ?? 0,
                    po.line_items_aggregate?.total_received ?? 0
                  );

                  return (
                    <tr
                      key={po.id}
                      className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => (window.location.href = `/po/${po.id}`)}
                    >
                      <td className="py-3 px-4">
                        <code className="text-amber-400 text-sm">{po.po_number}</code>
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
                        <POStatusBadge
                          status={(po.status || "not_started") as POStatusEnum}
                          size="sm"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-24 mx-auto">
                          <POProgressBar
                            invoicedPercent={progress.invoicedPercent}
                            receivedPercent={progress.receivedPercent}
                            showLabels={false}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-400 text-sm">{formatDate(po.po_date)}</span>
                      </td>
                    </tr>
                  );
                })}
                {paginatedPOs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No Purchase Orders found
                    </td>
                  </tr>
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
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
