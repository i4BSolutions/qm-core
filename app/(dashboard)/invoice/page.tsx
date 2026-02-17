"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  FileText,
  Eye,
  EyeOff,
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
import { UserAvatar } from "@/components/ui/user-avatar";
import { InvoiceCard, InvoiceStatusBadge } from "@/components/invoice";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { MiniProgressBar } from "@/components/po/po-progress-bar";
import { INVOICE_STATUS_CONFIG } from "@/lib/utils/invoice-status";
import { PageHeader, FilterBar, CardViewGrid } from "@/components/composite";
import { usePaginationParams } from "@/lib/hooks";
import type {
  Invoice,
  PurchaseOrder,
  Supplier,
  InvoiceStatus,
  User as UserType,
} from "@/types/database";

// Extended Invoice type with joined relations
interface InvoiceWithRelations extends Invoice {
  purchase_order?: Pick<PurchaseOrder, "id" | "po_number" | "supplier_id"> & {
    supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  } | null;
  creator?: { id: string; full_name: string } | null;
  line_items_aggregate?: {
    total_quantity: number;
    total_received: number;
  };
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
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [showVoided, setShowVoided] = useState(false);
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

  const handleAssignedChange = useCallback(
    (value: string) => {
      setAssignedFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const handleShowVoidedChange = useCallback(() => {
    setShowVoided(prev => !prev);
    setCurrentPage(1);
  }, [setCurrentPage]);

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

      const [invoiceRes, usersRes] = await Promise.all([
        supabase
          .from("invoices")
          .select(`
            *,
            purchase_order:purchase_orders!invoices_po_id_fkey(
              id,
              po_number,
              supplier_id,
              supplier:suppliers(id, name, company_name)
            ),
            creator:users!invoices_created_by_fkey(id, full_name),
            invoice_line_items(quantity, received_quantity, is_active)
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      // Check for errors
      if (invoiceRes.error) {
        console.error('Invoice query error:', invoiceRes.error);
        throw new Error(invoiceRes.error.message);
      }
      if (usersRes.error) {
        console.error('Users query error:', usersRes.error);
        throw new Error(usersRes.error.message);
      }

      // Process invoices with client-side aggregation
      if (invoiceRes.data) {
        const invoicesWithAggregates = (invoiceRes.data as any[]).map((inv) => {
          const lineItems = (inv.invoice_line_items || []).filter((li: any) => li.is_active !== false);

          const aggregate = lineItems.reduce(
            (acc: any, li: any) => ({
              total_quantity: acc.total_quantity + (li.quantity || 0),
              total_received: acc.total_received + (li.received_quantity || 0),
            }),
            { total_quantity: 0, total_received: 0 }
          );

          const { invoice_line_items, ...invData } = inv;

          return {
            ...invData,
            line_items_aggregate: aggregate,
          } as InvoiceWithRelations;
        });

        setInvoices(invoicesWithAggregates);
      }

      if (usersRes.data) setUsers(usersRes.data as UserType[]);

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

      if (assignedFilter !== "all" && inv.created_by !== assignedFilter) return false;

      return true;
    });
  }, [invoices, searchQuery, statusFilter, assignedFilter, showVoided]);

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
    assignedFilter !== "all",
    showVoided,
  ].filter(Boolean).length;

  // Shared assignee select content
  const assigneeSelectContent = (
    <>
      <SelectItem value="all">All Creators</SelectItem>
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
        title="Invoices"
        description={`${totalItems} invoice${totalItems !== 1 ? "s" : ""} found${totalItems !== invoices.length ? ` (of ${invoices.length} total)` : ""}${voidedCount > 0 && !showVoided ? ` + ${voidedCount} voided` : ""}`}
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
              Finance
            </span>
          </div>
        }
        actions={
          <Link href="/invoice/new">
            <Button className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New Invoice
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
          placeholder="Search by invoice#, PO#, supplier..."
        />

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-4">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
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

          {/* Creator/Assigned person filter */}
          <Select value={assignedFilter} onValueChange={handleAssignedChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Creator" />
            </SelectTrigger>
            <SelectContent>{assigneeSelectContent}</SelectContent>
          </Select>

          {/* Show Voided Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleShowVoidedChange}
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
                    {Object.entries(INVOICE_STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Creator</p>
                <Select value={assignedFilter} onValueChange={handleAssignedChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Creators" />
                  </SelectTrigger>
                  <SelectContent>{assigneeSelectContent}</SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShowVoidedChange}
                className={`w-full border-slate-700 ${
                  showVoided
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {showVoided ? (
                  <><Eye className="h-4 w-4 mr-2" />Showing Voided</>
                ) : (
                  <><EyeOff className="h-4 w-4 mr-2" />Hide Voided</>
                )}
              </Button>
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
        <CardViewGrid
          items={paginatedInvoices}
          groups={statusGroups.map(g => ({ key: g.key, label: g.label, dotClass: g.dotClass }))}
          groupBy={(inv) => {
            if (inv.is_voided) return "completed";
            const status = inv.status || "draft";
            const group = statusGroups.find((g) => g.statuses.includes(status));
            return group ? group.key : "pending";
          }}
          emptyMessage="No invoices"
          renderCard={(inv, index) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              animationDelay={index * 50}
            />
          )}
        />
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
                {paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No Invoices found
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                        inv.is_voided ? "opacity-60" : ""
                      }`}
                      onClick={() => router.push(`/invoice/${inv.id}`)}
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
                        <CurrencyDisplay
                          amount={inv.total_amount}
                          currency={inv.currency || "MMK"}
                          amountEusd={inv.total_amount_eusd}
                          size="sm"
                          align="right"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <InvoiceStatusBadge
                            status={(inv.status || "draft") as InvoiceStatus}
                            isVoided={inv.is_voided ?? false}
                            size="sm"
                          />
                          {(inv.line_items_aggregate?.total_quantity ?? 0) > 0 && (
                            <div className="w-24">
                              <MiniProgressBar
                                percent={Math.min(100, Math.round(((inv.line_items_aggregate?.total_received ?? 0) / inv.line_items_aggregate!.total_quantity) * 100))}
                                color="emerald"
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-400 text-sm">
                          {formatDate(inv.invoice_date)}
                        </span>
                      </td>
                    </tr>
                  ))
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
