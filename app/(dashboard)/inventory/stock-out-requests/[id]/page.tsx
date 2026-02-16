"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Ban,
  ArrowUpFromLine,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useStandardUnitName } from "@/lib/hooks/use-standard-unit-name";
import { HistoryTab } from "@/components/history/history-tab";
import { LineItemTable } from "@/components/stock-out-requests/line-item-table";
import type { LineItemWithApprovals } from "@/components/stock-out-requests/line-item-table";
import { ApprovalDialog } from "@/components/stock-out-requests/approval-dialog";
import { RejectionDialog } from "@/components/stock-out-requests/rejection-dialog";
import { ExecutionConfirmationDialog } from "@/components/stock-out-requests/execution-confirmation-dialog";
import { STOCK_OUT_REASON_CONFIG } from "@/lib/utils/inventory";
import { DetailPageLayout } from "@/components/composite";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Enums, Tables } from "@/types/database";
import { StockOutPDFButton } from "@/components/stock-out-requests/stock-out-pdf-button";

// Type aliases
type SorRequestStatus = Enums<"sor_request_status">;
type SorLineItemStatus = Enums<"sor_line_item_status">;
type StockOutReason = Enums<"stock_out_reason">;
type User = Tables<"users">;
type QMHQ = Tables<"qmhq">;

/**
 * Stock-out request with relations
 */
interface StockOutRequestWithRelations {
  id: string;
  request_number: string;
  status: SorRequestStatus;
  reason: StockOutReason;
  notes: string | null;
  qmhq_id: string | null;
  requester_id: string;
  created_at: string;
  requester?: Pick<User, "id" | "full_name"> | null;
  qmhq?: Pick<QMHQ, "id" | "request_id" | "line_name"> | null;
}

/**
 * Approval record with user relation
 */
interface ApprovalWithUser {
  id: string;
  approval_number: string | null;
  approved_quantity: number;
  decision: string;
  rejection_reason: string | null;
  decided_by: string;
  decided_at: string;
  line_item_id: string;
  decided_by_user?: Pick<User, "id" | "full_name"> | null;
  line_item?: {
    item_name: string | null;
    item_sku: string | null;
  } | null;
}

/**
 * Status badge colors
 */
const REQUEST_STATUS_CONFIG: Record<
  SorRequestStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
  },
  partially_approved: {
    label: "Partially Approved",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
  },
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10 border-slate-500/30",
  },
  partially_executed: {
    label: "Partially Fulfilled",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
  },
  executed: {
    label: "Fulfilled",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
  },
};

/**
 * Stock-Out Request Detail Page
 */
export default function StockOutRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { unitName } = useStandardUnitName();
  const requestId = params.id as string;

  const [request, setRequest] = useState<StockOutRequestWithRelations | null>(
    null
  );
  const [lineItems, setLineItems] = useState<LineItemWithApprovals[]>([]);
  const [approvals, setApprovals] = useState<ApprovalWithUser[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCancelling, setIsCancelling] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [executionDialogState, setExecutionDialogState] = useState<{
    open: boolean;
    approvalId: string;
    itemName: string;
    quantity: number;
    warehouseName: string;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [optimisticExecutedIds, setOptimisticExecutedIds] = useState<Set<string>>(new Set());
  const [approvalStockLevels, setApprovalStockLevels] = useState<Map<string, { available: number; needed: number }>>(new Map());


  // Permission checks (RBAC-15: stock-out approvals restricted to Admin only)
  const canApprove = user?.role === "admin";
  const canExecute = user?.role === "admin";
  const isRequester = user?.id === request?.requester_id;
  const canCancel = isRequester && request?.status === "pending";

  /**
   * Fetch request data with line items
   */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Fetch request with relations
      const { data: requestData, error: requestError } = await supabase
        .from("stock_out_requests")
        .select(
          `
          id,
          request_number,
          status,
          reason,
          notes,
          qmhq_id,
          requester_id,
          created_at,
          requester:users!stock_out_requests_requester_id_fkey(id, full_name),
          qmhq:qmhq!stock_out_requests_qmhq_id_fkey(id, request_id, line_name)
        `
        )
        .eq("id", requestId)
        .eq("is_active", true)
        .single();

      if (requestError) throw requestError;
      if (!requestData) {
        toast.error("Request not found");
        router.push("/inventory/stock-out-requests");
        return;
      }

      setRequest(requestData as StockOutRequestWithRelations);

      // Fetch line items with approvals
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from("stock_out_line_items")
        .select(
          `
          id,
          item_id,
          item_name,
          item_sku,
          requested_quantity,
          conversion_rate,
          status,
          approvals:stock_out_approvals(
            id,
            approved_quantity,
            decision
          )
        `
        )
        .eq("request_id", requestId)
        .eq("is_active", true);

      if (lineItemsError) throw lineItemsError;

      // Compute totals for each line item
      const itemsWithTotals: LineItemWithApprovals[] = (lineItemsData || []).map(
        (item: any) => {
          const approvedApprovals = (item.approvals || []).filter(
            (a: any) => a.decision === "approved"
          );
          const rejectedApprovals = (item.approvals || []).filter(
            (a: any) => a.decision === "rejected"
          );

          const totalApprovedQuantity = approvedApprovals.reduce(
            (sum: number, a: any) => sum + (a.approved_quantity || 0),
            0
          );
          const totalRejectedQuantity = rejectedApprovals.reduce(
            (sum: number, a: any) => sum + (a.approved_quantity || 0),
            0
          );

          const remainingQuantity =
            item.requested_quantity - totalApprovedQuantity - totalRejectedQuantity;

          const assignedWarehouseName: string | null = null;

          return {
            id: item.id,
            item_id: item.item_id,
            item_name: item.item_name,
            item_sku: item.item_sku,
            requested_quantity: item.requested_quantity,
            conversion_rate: item.conversion_rate || 1,
            status: item.status as SorLineItemStatus,
            total_approved_quantity: totalApprovedQuantity,
            total_rejected_quantity: totalRejectedQuantity,
            remaining_quantity: remainingQuantity,
            assigned_warehouse_name: assignedWarehouseName,
          };
        }
      );

      setLineItems(itemsWithTotals);

      // Fetch all approvals for Approvals tab
      const { data: approvalsData, error: approvalsError } = await supabase
        .from("stock_out_approvals")
        .select(
          `
          id,
          approval_number,
          approved_quantity,
          decision,
          rejection_reason,
          decided_by,
          decided_at,
          line_item_id,
          decided_by_user:users!stock_out_approvals_decided_by_fkey(id, full_name),
          line_item:stock_out_line_items(item_name, item_sku)
        `
        )
        .in(
          "line_item_id",
          itemsWithTotals.map((item) => item.id)
        )
        .eq("is_active", true)
        .order("decided_at", { ascending: false });

      if (approvalsError) throw approvalsError;

      setApprovals((approvalsData || []) as ApprovalWithUser[]);

      // Fetch inventory transactions (completed stock-outs)
      const approvalIds = (approvalsData || []).map((a) => a.id);
      if (approvalIds.length > 0) {
        const { data: txData, error: txError } = await supabase
          .from("inventory_transactions")
          .select(
            `
            id,
            movement_type,
            quantity,
            conversion_rate,
            status,
            transaction_date,
            created_at,
            warehouse_id,
            item_id,
            stock_out_approval_id,
            warehouses!inventory_transactions_warehouse_id_fkey(id, name),
            items(id, name, sku)
          `
          )
          .in("stock_out_approval_id", approvalIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (!txError && txData) {
          setInventoryTransactions(txData);

          // Calculate stock levels for each approved approval
          const stockLevelsMap = new Map<string, { available: number; needed: number }>();

          for (const approval of (approvalsData || [])) {
            if (approval.decision === "approved") {
              // Check if this approval has a completed transaction
              const completedTx = txData.find(
                (tx: any) => tx.stock_out_approval_id === approval.id && tx.status === "completed"
              );

              // Skip if already executed
              if (completedTx) continue;

              // Find pending transaction for this approval to get warehouse and item
              const pendingTx = txData.find(
                (tx: any) => tx.stock_out_approval_id === approval.id && tx.status === "pending"
              );

              if (pendingTx) {
                const itemId = pendingTx.item_id;
                const warehouseId = pendingTx.warehouse_id;
                const neededQty = approval.approved_quantity;

                // Calculate available stock for this warehouse + item
                const { data: stockData } = await supabase
                  .from("inventory_transactions")
                  .select("movement_type, quantity")
                  .eq("item_id", itemId)
                  .eq("warehouse_id", warehouseId)
                  .eq("is_active", true)
                  .eq("status", "completed");

                const availableStock = (stockData || []).reduce((sum: number, tx: any) => {
                  if (tx.movement_type === "inventory_in") {
                    return sum + (tx.quantity || 0);
                  } else if (tx.movement_type === "inventory_out") {
                    return sum - (tx.quantity || 0);
                  }
                  return sum;
                }, 0);

                stockLevelsMap.set(approval.id, {
                  available: availableStock,
                  needed: neededQty,
                });
              }
            }
          }

          setApprovalStockLevels(stockLevelsMap);
        }
      }
    } catch (error: any) {
      console.error("Error fetching request data:", error);
      toast.error(error.message || "Failed to load request data");
    } finally {
      setIsLoading(false);
    }
  }, [requestId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * BroadcastChannel listener for cross-tab execution sync
   */
  useEffect(() => {
    // Safari doesn't support BroadcastChannel
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("qm-stock-out-execution");

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "APPROVAL_EXECUTED" && event.data.requestId === requestId) {
        // Refetch data when another tab executes an approval
        fetchData();
      }
    };

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, [requestId, fetchData]);

  /**
   * Handle opening execution confirmation dialog
   */
  const handleExecuteApproval = (approvalId: string) => {
    const approval = approvals.find((a) => a.id === approvalId);
    if (!approval) return;

    // Find the pending transaction for this approval to get warehouse info
    const pendingTx = inventoryTransactions.find(
      (tx: any) => tx.stock_out_approval_id === approvalId && tx.status === "pending"
    );

    if (!pendingTx) {
      toast.error("No pending transaction found for this approval");
      return;
    }

    setExecutionDialogState({
      open: true,
      approvalId,
      itemName: approval.line_item?.item_name || "Unknown Item",
      quantity: approval.approved_quantity,
      warehouseName: pendingTx.warehouses?.name || "Unknown Warehouse",
    });
  };

  /**
   * Confirm and execute the stock-out for a single approval
   */
  const confirmExecution = async () => {
    if (!executionDialogState) return;

    setIsExecuting(true);
    const { approvalId } = executionDialogState;

    // Optimistic update
    setOptimisticExecutedIds((prev) => {
      const next = new Set(prev);
      next.add(approvalId);
      return next;
    });

    const supabase = createClient();

    try {
      const now = new Date().toISOString();

      // Update the pending transaction for this approval to completed
      const { error: updateError } = await supabase
        .from("inventory_transactions")
        .update({
          status: "completed",
          transaction_date: now,
        })
        .eq("stock_out_approval_id", approvalId)
        .eq("status", "pending");

      if (updateError) throw updateError;

      // Success
      toast.success("Stock-out executed successfully");

      // Broadcast to other tabs
      if (typeof BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel("qm-stock-out-execution");
          channel.postMessage({
            type: "APPROVAL_EXECUTED",
            approvalId,
            requestId,
            qmhqId: request?.qmhq_id,
          });
          channel.close();
        } catch (error) {
          // Ignore BroadcastChannel errors (Safari)
          console.warn("BroadcastChannel not supported:", error);
        }
      }

      // Close dialog and refetch
      setExecutionDialogState(null);
      await fetchData();
    } catch (error: any) {
      console.error("Error executing stock-out:", error);
      toast.error(error.message || "Failed to execute stock-out");

      // Rollback optimistic update
      setOptimisticExecutedIds((prev) => {
        const next = new Set(prev);
        next.delete(approvalId);
        return next;
      });
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * Handle opening approval dialog
   */
  const handleApproveClick = () => {
    setIsApprovalDialogOpen(true);
  };

  /**
   * Handle opening rejection dialog
   */
  const handleRejectClick = () => {
    setIsRejectionDialogOpen(true);
  };

  /**
   * Handle successful approval/rejection - refetch data and clear selection
   */
  const handleDialogSuccess = async () => {
    setSelectedIds(new Set());
    await fetchData();
  };

  /**
   * Handle cancel request
   */
  const handleCancelRequest = async () => {
    if (!canCancel) return;

    const confirmed = confirm(
      "Are you sure you want to cancel this request? This action cannot be undone."
    );
    if (!confirmed) return;

    setIsCancelling(true);
    const supabase = createClient();

    try {
      // Update all pending line items to cancelled
      const { error: updateError } = await supabase
        .from("stock_out_line_items")
        .update({ status: "cancelled" })
        .eq("request_id", requestId)
        .eq("status", "pending");

      if (updateError) throw updateError;

      toast.success("Request cancelled successfully");
      await fetchData(); // Refresh data
    } catch (error: any) {
      console.error("Error cancelling request:", error);
      toast.error(error.message || "Failed to cancel request");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <p className="text-slate-400">Request not found</p>
        <Button onClick={() => router.push("/inventory/stock-out-requests")}>
          Back to List
        </Button>
      </div>
    );
  }

  const statusConfig = REQUEST_STATUS_CONFIG[request.status];
  const reasonConfig = STOCK_OUT_REASON_CONFIG[request.reason];

  return (
    <DetailPageLayout
      backHref="/inventory/stock-out-requests"
      header={
        <div>
          <div className="space-y-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-mono font-bold text-slate-100">
                {request.request_number}
              </h1>
              <p className="text-sm text-slate-400">
                Requested by {request.requester?.full_name || "Unknown"}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "border text-sm px-3 py-1",
                statusConfig.bgColor,
                statusConfig.color
              )}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </div>
      }
      actions={
        <>
          <StockOutPDFButton
            request={{
              request_number: request.request_number,
              status: request.status,
              reason: request.reason,
              notes: request.notes,
              requester_name: request.requester?.full_name || "Unknown",
              created_at: request.created_at,
              qmhq_reference: request.qmhq?.request_id || null,
              qmhq_line_name: request.qmhq?.line_name || null,
            }}
            lineItems={lineItems.map(li => ({
              item_name: li.item_name || "Unknown Item",
              item_sku: li.item_sku,
              requested_quantity: li.requested_quantity,
              conversion_rate: li.conversion_rate,
              status: li.status,
              total_approved_quantity: li.total_approved_quantity,
              total_rejected_quantity: li.total_rejected_quantity,
            }))}
            approvals={approvals.map(a => {
              const lineItem = lineItems.find(li => li.id === a.line_item_id);
              return {
                approval_number: a.approval_number,
                item_name: a.line_item?.item_name || "Unknown",
                item_sku: a.line_item?.item_sku,
                approved_quantity: a.approved_quantity,
                conversion_rate: lineItem?.conversion_rate,
                decision: a.decision,
                rejection_reason: a.rejection_reason,
                decided_by_name: a.decided_by_user?.full_name || "Unknown",
                decided_at: a.decided_at,
              };
            })}
            standardUnitName={unitName}
          />
          {canCancel && (
            <Button
              onClick={handleCancelRequest}
              disabled={isCancelling}
              variant="destructive"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4 mr-2" />
                  Cancel Request
                </>
              )}
            </Button>
          )}
        </>
      }
      kpiPanel={
        <div className="command-panel p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Reason
            </div>
            <Badge
              variant="outline"
              className={cn(
                "border text-sm",
                reasonConfig.bgColor,
                reasonConfig.color
              )}
            >
              {reasonConfig.label}
            </Badge>
          </div>

          {request.qmhq_id && request.qmhq && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">
                QMHQ Reference
              </div>
              <Link
                href={`/qmhq/${request.qmhq_id}`}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span className="font-mono text-sm">
                  {request.qmhq.request_id}
                </span>
                {request.qmhq.line_name && (
                  <span className="text-xs text-slate-400">
                    ({request.qmhq.line_name})
                  </span>
                )}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Requester
            </div>
            <div className="text-sm text-slate-300">
              {request.requester?.full_name || "Unknown"}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Created
            </div>
            <div className="text-sm text-slate-300">
              {new Date(request.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        {request.notes && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">
              Notes
            </div>
            <div className="text-sm text-slate-300 whitespace-pre-wrap">
              {request.notes}
            </div>
          </div>
        )}
        </div>
      }
    >
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {approvals.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {approvals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions
            {inventoryTransactions.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {inventoryTransactions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="command-panel p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Line Items
            </h3>
            <LineItemTable
              items={lineItems}
              canApprove={canApprove}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onApproveClick={handleApproveClick}
              onRejectClick={handleRejectClick}
            />
          </div>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="space-y-4">
          <div className="command-panel p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Approval History
            </h3>

            {approvals.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No approvals yet
              </div>
            ) : (
              <TooltipProvider>
                <div className="space-y-4">
                  {approvals.map((approval) => {
                    // Check if this approval is executed
                    const isExecuted =
                      optimisticExecutedIds.has(approval.id) ||
                      inventoryTransactions.some(
                        (tx: any) =>
                          tx.stock_out_approval_id === approval.id &&
                          tx.status === "completed"
                      );

                    const isRejected = approval.decision === "rejected";
                    const stockInfo = approvalStockLevels.get(approval.id);
                    const hasInsufficientStock =
                      stockInfo && stockInfo.available < stockInfo.needed;

                    return (
                      <div
                        key={approval.id}
                        className="border border-slate-700 rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {approval.approval_number && (
                              <div className="font-mono text-sm text-slate-300">
                                {approval.approval_number}
                              </div>
                            )}
                            {/* Status Badge or Execute Button */}
                            {isRejected ? (
                              <Badge
                                variant="outline"
                                className="text-xs border-red-500/30 bg-red-500/10 text-red-400"
                              >
                                Rejected
                              </Badge>
                            ) : isExecuted ? (
                              <Badge
                                variant="outline"
                                className="text-xs border-slate-500/30 bg-slate-500/10 text-slate-400"
                              >
                                Executed
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              >
                                Approved
                              </Badge>
                            )}
                            {/* Execute Button for approved, not-yet-executed approvals */}
                            {canExecute &&
                              approval.decision === "approved" &&
                              !isExecuted && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleExecuteApproval(approval.id)
                                        }
                                        disabled={
                                          hasInsufficientStock || isExecuting
                                        }
                                        className="bg-emerald-600 hover:bg-emerald-500 text-xs"
                                      >
                                        <ArrowUpFromLine className="w-3 h-3 mr-1" />
                                        Execute
                                      </Button>
                                    </span>
                                  </TooltipTrigger>
                                  {hasInsufficientStock && (
                                    <TooltipContent>
                                      Insufficient stock: Need {stockInfo.needed},
                                      Available: {stockInfo.available}
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(approval.decided_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500">Item:</span>{" "}
                            <span className="text-slate-300">
                              {approval.line_item?.item_name || "Unknown"}
                            </span>
                            {approval.line_item?.item_sku && (
                              <span className="text-slate-500 ml-2">
                                ({approval.line_item.item_sku})
                              </span>
                            )}
                          </div>

                          {approval.decision === "approved" && (
                            <div>
                              <span className="text-slate-500">Quantity:</span>{" "}
                              <span className="font-mono text-slate-300">
                                {approval.approved_quantity}
                              </span>
                              {unitName && itemsWithTotals.find(li => li.id === approval.line_item_id) && (
                                <div className="text-xs font-mono text-slate-400 mt-1">
                                  {(approval.approved_quantity * (itemsWithTotals.find(li => li.id === approval.line_item_id)?.conversion_rate || 1)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {unitName}
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <span className="text-slate-500">Decided by:</span>{" "}
                            <span className="text-slate-300">
                              {approval.decided_by_user?.full_name || "Unknown"}
                            </span>
                          </div>
                        </div>

                        {approval.rejection_reason && (
                          <div className="pt-2 border-t border-slate-700">
                            <div className="text-xs text-slate-500 mb-1">
                              Rejection Reason
                            </div>
                            <div className="text-sm text-red-400">
                              {approval.rejection_reason}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="command-panel p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Stock-Out Transactions
            </h3>

            {inventoryTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No inventory transactions yet
              </div>
            ) : (
              <div className="space-y-3">
                {inventoryTransactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="border border-slate-700 rounded-lg p-4 bg-slate-800/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          tx.status === "completed" ? "bg-emerald-500/20" : "bg-amber-500/20"
                        )}>
                          <ArrowUpFromLine className={cn(
                            "w-5 h-5",
                            tx.status === "completed" ? "text-emerald-400" : "text-amber-400"
                          )} />
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">
                            {tx.items?.name || "Unknown Item"}
                          </div>
                          {tx.items?.sku && (
                            <div className="text-sm text-slate-400 font-mono">
                              {tx.items.sku}
                            </div>
                          )}
                          <div className="text-sm text-slate-400">
                            From: {tx.warehouses?.name || "Unknown Warehouse"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-mono font-bold text-red-400">
                          -{tx.quantity}
                        </div>
                        {unitName && (
                          <div className="text-xs font-mono text-slate-400 mt-1">
                            -{(tx.quantity * (tx.conversion_rate ?? 1)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {unitName}
                          </div>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs mt-1",
                            tx.status === "completed"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          )}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {new Date(tx.transaction_date || tx.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="command-panel p-6">
            <HistoryTab
              entityType="stock_out_request"
              entityId={requestId}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <ApprovalDialog
        open={isApprovalDialogOpen}
        onOpenChange={setIsApprovalDialogOpen}
        lineItems={lineItems.filter((item) => selectedIds.has(item.id))}
        requestId={requestId}
        requestReason={request.reason}
        qmhqId={request.qmhq_id}
        onSuccess={handleDialogSuccess}
      />

      {/* Rejection Dialog */}
      <RejectionDialog
        open={isRejectionDialogOpen}
        onOpenChange={setIsRejectionDialogOpen}
        lineItems={lineItems.filter((item) => selectedIds.has(item.id))}
        onSuccess={handleDialogSuccess}
      />

      {/* Execution Confirmation Dialog */}
      {executionDialogState && (
        <ExecutionConfirmationDialog
          open={executionDialogState.open}
          onOpenChange={(open) => {
            if (!open) setExecutionDialogState(null);
          }}
          itemName={executionDialogState.itemName}
          quantity={executionDialogState.quantity}
          warehouseName={executionDialogState.warehouseName}
          onConfirm={confirmExecution}
          isExecuting={isExecuting}
        />
      )}
    </DetailPageLayout>
  );
}
