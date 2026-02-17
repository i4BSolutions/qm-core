"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Package,
  CheckCircle2,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
} from "lucide-react";
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
import { ExecutionConfirmationDialog } from "@/components/stock-out-requests/execution-confirmation-dialog";
import { useToast } from "@/components/ui/use-toast";
import { usePaginationParams } from "@/lib/hooks";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

interface InventoryTxn {
  id: string;
  status: string;
}

interface Assignment {
  id: string;
  approved_quantity: number;
  warehouse_id: string;
  line_item_id: string;
  parent_approval_id: string | null;
  decided_at: string | null;
  warehouses: { id: string; name: string } | null;
  line_item: {
    id: string;
    item_name: string | null;
    item_sku: string | null;
    item_id: string | null;
    conversion_rate: number | null;
    request: {
      id: string;
      request_number: string | null;
      reason: string | null;
      requester_id: string;
      requester: { id: string; full_name: string } | null;
    } | null;
  } | null;
  inventory_txns: InventoryTxn[];
  // Derived
  executionStatus: "pending_execution" | "executed";
}

interface Warehouse {
  id: string;
  name: string;
}

// -------------------------------------------------------------------------
// Component
// -------------------------------------------------------------------------

export default function StockOutExecutionPage() {
  const { toast } = useToast();

  // ----- State -----
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"pending_execution" | "executed" | "all">(
    "pending_execution"
  );
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  // Execution dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // URL-driven pagination
  const { page: currentPage, pageSize, setPage: setCurrentPage, setPageSize } =
    usePaginationParams(20);

  // ----- Fetch -----

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [assignmentsRes, warehousesRes] = await Promise.all([
        supabase
          .from("stock_out_approvals")
          .select(`
            id,
            approved_quantity,
            warehouse_id,
            line_item_id,
            parent_approval_id,
            decided_at,
            warehouses:warehouses!stock_out_approvals_warehouse_id_fkey(id, name),
            line_item:stock_out_line_items!stock_out_approvals_line_item_id_fkey(
              id, item_name, item_sku, item_id, conversion_rate,
              request:stock_out_requests!stock_out_line_items_request_id_fkey(
                id, request_number, reason, requester_id,
                requester:users!stock_out_requests_requester_id_fkey(id, full_name)
              )
            ),
            inventory_txns:inventory_transactions!inventory_transactions_stock_out_approval_id_fkey(
              id, status
            )
          `)
          .eq("layer", "admin")
          .eq("decision", "approved")
          .eq("is_active", true)
          .order("decided_at", { ascending: false }),

        supabase
          .from("warehouses")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
      ]);

      if (assignmentsRes.error) throw new Error(assignmentsRes.error.message);
      if (warehousesRes.error) throw new Error(warehousesRes.error.message);

      // Derive execution status
      const enriched: Assignment[] = (assignmentsRes.data || []).map((a: any) => {
        const txns: InventoryTxn[] = a.inventory_txns || [];
        const isExecuted = txns.some((tx) => tx.status === "completed");
        return {
          ...a,
          inventory_txns: txns,
          executionStatus: isExecuted ? "executed" : "pending_execution",
        } as Assignment;
      });

      setAssignments(enriched);
      setWarehouses(warehousesRes.data || []);
    } catch (err) {
      console.error("Error fetching execution queue:", err);
      setError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // BroadcastChannel sync: listen for execution events from other tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const channel = new BroadcastChannel("stock-out-execution");
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "executed") {
        fetchData();
      }
    };
    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
    };
  }, [fetchData]);

  // ----- Filtering -----

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter !== "all" && a.executionStatus !== statusFilter) return false;
      if (warehouseFilter !== "all" && a.warehouse_id !== warehouseFilter) return false;
      return true;
    });
  }, [assignments, statusFilter, warehouseFilter]);

  // ----- Pagination -----

  const totalItems = filteredAssignments.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedAssignments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAssignments.slice(start, start + pageSize);
  }, [filteredAssignments, currentPage, pageSize]);

  // Filter change handlers (reset page on filter change)
  const handleStatusFilterChange = useCallback(
    (value: string) => {
      setStatusFilter(value as typeof statusFilter);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const handleWarehouseFilterChange = useCallback(
    (value: string) => {
      setWarehouseFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  // Active filter count for mobile badge
  const activeFilterCount = [
    statusFilter !== "pending_execution",
    warehouseFilter !== "all",
  ].filter(Boolean).length;

  // ----- Execution -----

  const handleExecuteClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setDialogOpen(true);
  };

  const handleExecuteConfirm = async () => {
    if (!selectedAssignment) return;
    setIsExecuting(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase
        .from("inventory_transactions")
        .update({
          status: "completed",
          transaction_date: new Date().toISOString(),
        })
        .eq("stock_out_approval_id", selectedAssignment.id)
        .eq("status", "pending");

      if (updateError) {
        // If error looks like insufficient stock (e.g., trigger failure)
        const isStockError =
          updateError.message.toLowerCase().includes("stock") ||
          updateError.message.toLowerCase().includes("insufficient") ||
          updateError.code === "23514";

        if (isStockError) {
          toast({
            title: "Insufficient Stock",
            description:
              "Insufficient stock — retry later. The assignment will remain for when stock is replenished.",
            variant: "destructive",
          });
        } else {
          throw updateError;
        }
        return;
      }

      // Broadcast to other tabs
      if (typeof window !== "undefined") {
        try {
          const channel = new BroadcastChannel("stock-out-execution");
          channel.postMessage({ type: "executed", approvalId: selectedAssignment.id });
          channel.close();
        } catch {
          // BroadcastChannel not supported — ignore
        }
      }

      toast({
        title: "Execution Recorded",
        description: `Stock-out executed for ${selectedAssignment.line_item?.item_name || "item"}.`,
        variant: "success",
      });

      // Update row in-place
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === selectedAssignment.id
            ? { ...a, executionStatus: "executed" }
            : a
        )
      );

      setDialogOpen(false);
      setSelectedAssignment(null);
    } catch (err) {
      console.error("Execution error:", err);
      toast({
        title: "Execution Failed",
        description:
          err instanceof Error ? err.message : "Failed to record execution",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // ----- Shared filter selects content -----

  const statusSelectContent = (
    <>
      <SelectItem value="pending_execution">Pending Execution</SelectItem>
      <SelectItem value="executed">Executed</SelectItem>
      <SelectItem value="all">All</SelectItem>
    </>
  );

  const warehouseSelectContent = (
    <>
      <SelectItem value="all">All Warehouses</SelectItem>
      {warehouses.map((wh) => (
        <SelectItem key={wh.id} value={wh.id}>
          {wh.name}
        </SelectItem>
      ))}
    </>
  );

  // ----- Loading skeleton -----

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ----- Error state -----

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Stock-Out Execution"
          description="Execute approved warehouse assignments"
        />
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-400">Error Loading Assignments</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-sm text-red-400 underline hover:text-red-300"
            >
              Click to retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Render -----

  return (
    <div className="space-y-6">
      {/* Page Header — no action buttons */}
      <PageHeader
        title="Stock-Out Execution"
        description="Execute approved warehouse assignments"
      />

      {/* Filter Bar */}
      <FilterBar>
        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-4">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>{statusSelectContent}</SelectContent>
          </Select>

          {/* Warehouse filter */}
          <Select value={warehouseFilter} onValueChange={handleWarehouseFilterChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>{warehouseSelectContent}</SelectContent>
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
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </p>
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>{statusSelectContent}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Warehouse
                </p>
                <Select value={warehouseFilter} onValueChange={handleWarehouseFilterChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>{warehouseSelectContent}</SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </FilterBar>

      {/* Content */}
      {paginatedAssignments.length === 0 ? (
        <div className="command-panel corner-accents">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {statusFilter === "pending_execution" ? (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">All Caught Up</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  All assignments have been executed. Check back when new approvals arrive.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">No Assignments Found</h3>
                <p className="text-sm text-slate-400">No assignments match the current filters.</p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="command-panel corner-accents">
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
                    Warehouse
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Qty
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hidden md:table-cell">
                    Requester
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedAssignments.map((assignment) => {
                  const isExecuted = assignment.executionStatus === "executed";
                  const itemName = assignment.line_item?.item_name || "Unknown Item";
                  const itemSku = assignment.line_item?.item_sku;
                  const warehouseName = assignment.warehouses?.name || "Unknown Warehouse";
                  const requesterName =
                    assignment.line_item?.request?.requester?.full_name || "—";
                  const sorId = assignment.line_item?.request?.request_number || "—";

                  return (
                    <tr
                      key={assignment.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors ${
                        isExecuted ? "opacity-75" : ""
                      }`}
                    >
                      {/* SOR ID — display-only text, NOT a link */}
                      <td className="py-3 px-4">
                        <code className="text-sm font-mono text-amber-400">{sorId}</code>
                      </td>

                      {/* Item */}
                      <td className="py-3 px-4">
                        <p className={`text-sm font-medium ${isExecuted ? "text-slate-500" : "text-slate-200"}`}>
                          {itemName}
                        </p>
                        {itemSku && (
                          <code className="text-xs font-mono text-slate-400">{itemSku}</code>
                        )}
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-4">
                        <span className={`text-sm ${isExecuted ? "text-slate-500" : "text-slate-300"}`}>
                          {warehouseName}
                        </span>
                      </td>

                      {/* Qty */}
                      <td className="py-3 px-4">
                        <span className={`text-sm font-mono ${isExecuted ? "text-slate-500" : "text-slate-200"}`}>
                          {assignment.approved_quantity}
                        </span>
                      </td>

                      {/* Requester — hidden on mobile */}
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`text-sm ${isExecuted ? "text-slate-500" : "text-slate-300"}`}>
                          {requesterName}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="py-3 px-4">
                        {isExecuted ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          >
                            Executed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-500/30 bg-amber-500/10 text-amber-400"
                          >
                            Pending Execution
                          </Badge>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4">
                        {!isExecuted && (
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white"
                            onClick={() => handleExecuteClick(assignment)}
                          >
                            Execute
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="command-panel corner-accents mt-6">
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

      {/* Execution Confirmation Dialog */}
      {selectedAssignment && (
        <ExecutionConfirmationDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedAssignment(null);
          }}
          itemName={selectedAssignment.line_item?.item_name || "Unknown Item"}
          quantity={selectedAssignment.approved_quantity}
          warehouseName={selectedAssignment.warehouses?.name || "Unknown Warehouse"}
          onConfirm={handleExecuteConfirm}
          isExecuting={isExecuting}
        />
      )}
    </div>
  );
}
