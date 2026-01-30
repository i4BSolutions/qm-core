"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  FileText,
  Eye,
  EyeOff,
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
import { formatCurrency } from "@/lib/utils";
import { InvoiceCard, InvoiceStatusBadge } from "@/components/invoice";
import { INVOICE_STATUS_CONFIG } from "@/lib/utils/invoice-status";
import type {
  Invoice,
  PurchaseOrder,
  Supplier,
  InvoiceStatus,
} from "@/types/database";

// Extended Invoice type with joined relations
interface InvoiceWithRelations extends Invoice {
  purchase_order?: Pick<PurchaseOrder, "id" | "po_number" | "supplier_id"> & {
    supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  } | null;
}

// Status group configuration for card view
const statusGroups = [
  {
    key: "pending",
    label: "PENDING",
    dotClass: "status-dot status-dot-todo",
    statuses: ["draft", "received"] as InvoiceStatus[],
  },
  {
    key: "in_progress",
    label: "IN PROGRESS",
    dotClass: "status-dot status-dot-progress",
    statuses: ["partially_received"] as InvoiceStatus[],
  },
  {
    key: "completed",
    label: "COMPLETED",
    dotClass: "status-dot status-dot-done",
    statuses: ["completed"] as InvoiceStatus[],
  },
] as const;

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showVoided, setShowVoided] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: queryError } = await supabase
        .from("invoices")
        .select(`
          *,
          purchase_order:purchase_orders!invoices_po_id_fkey(
            id,
            po_number,
            supplier_id,
            supplier:suppliers(id, name, company_name)
          )
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(200);

      // Check for errors
      if (queryError) {
        console.error('Invoice query error:', queryError);
        throw new Error(queryError.message);
      }

      // Set data
      if (data) {
        setInvoices(data as InvoiceWithRelations[]);
      }

    } catch (err) {
      console.error('Error fetching invoice data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load invoices';
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
  }, [searchQuery, statusFilter, showVoided]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Filter out voided unless showing voided
      if (!showVoided && inv.is_voided) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          inv.invoice_number?.toLowerCase().includes(query) ||
          inv.supplier_invoice_no?.toLowerCase().includes(query) ||
          inv.purchase_order?.po_number?.toLowerCase().includes(query) ||
          inv.purchase_order?.supplier?.name?.toLowerCase().includes(query) ||
          inv.purchase_order?.supplier?.company_name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (statusFilter !== "all") {
        if (statusFilter === "voided") {
          if (!inv.is_voided) return false;
        } else if (inv.status !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchQuery, statusFilter, showVoided]);

  // Pagination calculations
  const totalItems = filteredInvoices.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Paginated items
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredInvoices.slice(start, end);
  }, [filteredInvoices, currentPage, pageSize]);

  // Group invoices by status group for card view
  const groupedInvoices = useMemo(() => {
    const groups: Record<string, InvoiceWithRelations[]> = {
      pending: [],
      in_progress: [],
      completed: [],
    };

    paginatedInvoices.forEach((inv) => {
      // Put voided invoices in completed column (they are "done" in terms of workflow)
      if (inv.is_voided) {
        groups.completed.push(inv);
        return;
      }

      const status = inv.status || "draft";
      const group = statusGroups.find((g) => g.statuses.includes(status));
      if (group) {
        groups[group.key].push(inv);
      }
    });

    return groups;
  }, [paginatedInvoices]);

  // Count voided invoices
  const voidedCount = useMemo(() => {
    return invoices.filter((inv) => inv.is_voided).length;
  }, [invoices]);

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
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
                Finance
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-200">
            Invoices
          </h1>
          <p className="mt-1 text-slate-400">
            {totalItems} invoice{totalItems !== 1 ? "s" : ""} found
            {totalItems !== invoices.length && (
              <span className="text-slate-500"> (of {invoices.length} total)</span>
            )}
            {voidedCount > 0 && !showVoided && (
              <span className="text-slate-500"> + {voidedCount} voided</span>
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
          <Link href="/invoice/new">
            <Button className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New Invoice
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
              placeholder="Search by invoice#, PO#, supplier..."
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
              {Object.entries(INVOICE_STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          key === "draft"
                            ? "#94a3b8"
                            : key === "received"
                            ? "#3b82f6"
                            : key === "partially_received"
                            ? "#f59e0b"
                            : key === "completed"
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

          {/* Show Voided Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVoided(!showVoided)}
            className={`border-slate-700 ${
              showVoided
                ? "bg-red-500/10 text-red-400 border-red-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {showVoided ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Showing Voided
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Voided
              </>
            )}
          </Button>
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
                  {groupedInvoices[group.key].length}
                </span>
              </div>

              {/* Column Body */}
              <div className="flex-1 rounded-b-lg border border-t-0 border-slate-700 bg-slate-900/30 p-3 min-h-[400px]">
                <div className="space-y-3">
                  {groupedInvoices[group.key].length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700">
                      <p className="text-sm text-slate-400">No invoices</p>
                    </div>
                  ) : (
                    groupedInvoices[group.key].map((inv, index) => (
                      <InvoiceCard
                        key={inv.id}
                        invoice={inv}
                        animationDelay={index * 50}
                      />
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
                    Invoice#
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Supplier Ref
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    PO#
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Supplier
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
                {paginatedInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                      inv.is_voided ? "opacity-60" : ""
                    }`}
                    onClick={() => (window.location.href = `/invoice/${inv.id}`)}
                  >
                    <td className="py-3 px-4">
                      <code className="text-amber-400 text-sm">
                        {inv.invoice_number}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-300 text-sm">
                        {inv.supplier_invoice_no || "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {inv.purchase_order ? (
                        <code className="text-blue-400 text-sm">
                          {inv.purchase_order.po_number}
                        </code>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-200 font-medium">
                        {inv.purchase_order?.supplier?.company_name ||
                          inv.purchase_order?.supplier?.name ||
                          "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono text-emerald-400">
                        {formatCurrency(inv.total_amount_eusd ?? 0)} EUSD
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <InvoiceStatusBadge
                        status={(inv.status || "draft") as InvoiceStatus}
                        isVoided={inv.is_voided ?? false}
                        size="sm"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-400 text-sm">
                        {formatDate(inv.invoice_date)}
                      </span>
                    </td>
                  </tr>
                ))}
                {paginatedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No Invoices found
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
