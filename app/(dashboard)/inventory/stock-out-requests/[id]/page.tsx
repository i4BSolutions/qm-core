"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
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
import { HistoryTab } from "@/components/history/history-tab";
import { LineItemTable } from "@/components/stock-out-requests/line-item-table";
import type { LineItemWithApprovals, L1ApprovalData } from "@/components/stock-out-requests/line-item-table";
import { L1ApprovalDialog } from "@/components/stock-out-requests/l1-approval-dialog";
import { L2WarehouseDialog } from "@/components/stock-out-requests/l2-warehouse-dialog";
import { RejectionDialog } from "@/components/stock-out-requests/rejection-dialog";
import { ExecutionConfirmationDialog } from "@/components/stock-out-requests/execution-confirmation-dialog";
import { WarehouseAssignmentsTab } from "@/components/stock-out-requests/warehouse-assignments-tab";
import type { WarehouseAssignment } from "@/components/stock-out-requests/warehouse-assignments-tab";
import { STOCK_OUT_REASON_CONFIG } from "@/lib/utils/inventory";
import { DetailPageLayout } from "@/components/composite";
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
 * Approval record with user relation (extended for two-layer display)
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
  layer: string | null;
  warehouse_id: string | null;
  parent_approval_id: string | null;
  decided_by_user?: Pick<User, "id" | "full_name"> | null;
  line_item?: {
    item_name: string | null;
    item_sku: string | null;
  } | null;
  warehouse?: {
    id: string;
    name: string;
  } | null;
}

/**
 * Status badge colors — updated for two-layer flow terminology
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
    label: "Awaiting Warehouse",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
  },
  approved: {
    label: "Ready to Execute",
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
 *
 * Two-layer approval flow:
 * - L1 (quartermaster): qty-only approval via L1ApprovalDialog — per-row button
 * - L2 (admin): warehouse assignment via L2WarehouseDialog — per-row button on awaiting_admin items
 * - Execution: from Warehouse Assignments tab with before/after stock display
 */
export default function StockOutRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const requestId = params.id as string;

  const [request, setRequest] = useState<StockOutRequestWithRelations | null>(
    null
  );
  const [lineItems, setLineItems] = useState<LineItemWithApprovals[]>([]);
  const [approvals, setApprovals] = useState<ApprovalWithUser[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<any[]>([]);
  const [warehouseAssignments, setWarehouseAssignments] = useState<WarehouseAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("line-items");
  const [isCancelling, setIsCancelling] = useState(false);

  // Per-row dialog state
  const [l1DialogItem, setL1DialogItem] = useState<LineItemWithApprovals | null>(null);
  const [rejectionItem, setRejectionItem] = useState<LineItemWithApprovals | null>(null);

  // L2 dialog state
  const [l2DialogState, setL2DialogState] = useState<{
    lineItem: LineItemWithApprovals;
    l1Approval: { id: string; approved_quantity: number; total_l2_assigned: number };
  } | null>(null);

  // Execution dialog state
  const [executionDialogState, setExecutionDialogState] = useState<{
    open: boolean;
    assignment: WarehouseAssignment;
    currentStock?: number;
    afterStock?: number;
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Permission checks (RBAC-15: stock-out approvals restricted to Admin only)
  const canApprove = user?.role === "admin";
  const isRequester = user?.id === request?.requester_id;
  const canCancel = isRequester && request?.status === "pending";

  // Execute is only available when request is fully_approved or partially_executed/executed (any pending transactions remain)
  // The button per row in WarehouseAssignmentsTab handles this — canExecute just checks admin role
  const canExecute = user?.role === "admin";

  /**
   * Fetch request data with two-layer-aware line item quantities
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

      // Fetch line items with layer-aware approvals (including warehouse info for L2)
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
          item:items(id, name, sku, standard_unit_rel:standard_units!items_standard_unit_id_fkey(name)),
          approvals:stock_out_approvals(
            id,
            approved_quantity,
            decision,
            layer,
            warehouse_id,
            parent_approval_id,
            warehouses:warehouses!stock_out_approvals_warehouse_id_fkey(id, name)
          )
        `
        )
        .eq("request_id", requestId)
        .eq("is_active", true);

      if (lineItemsError) throw lineItemsError;

      // Collect all L2 approval IDs to query executed transactions
      const allL2ApprovalIds: string[] = [];
      (lineItemsData || []).forEach((item: any) => {
        (item.approvals || []).forEach((a: any) => {
          if (a.decision === "approved" && a.layer === "admin") {
            allL2ApprovalIds.push(a.id);
          }
        });
      });

      // Fetch inventory transactions for L2 approvals (both pending and completed)
      let txByApprovalId: Record<string, { status: string; quantity: number }> = {};
      let executedQtyByLineItem: Record<string, number> = {};

      if (allL2ApprovalIds.length > 0) {
        const { data: txData } = await supabase
          .from("inventory_transactions")
          .select("id, stock_out_approval_id, quantity, status, item_id")
          .in("stock_out_approval_id", allL2ApprovalIds)
          .eq("is_active", true);

        // Build map for execution status lookup
        (txData || []).forEach((tx: any) => {
          txByApprovalId[tx.stock_out_approval_id] = {
            status: tx.status,
            quantity: tx.quantity,
          };
        });

        // Map L2 approval ID -> line item ID for aggregation
        const approvalToLineItem: Record<string, string> = {};
        (lineItemsData || []).forEach((item: any) => {
          (item.approvals || []).forEach((a: any) => {
            approvalToLineItem[a.id] = item.id;
          });
        });

        (txData || []).forEach((tx: any) => {
          if (tx.status === "completed") {
            const lineItemId = approvalToLineItem[tx.stock_out_approval_id];
            if (lineItemId) {
              executedQtyByLineItem[lineItemId] =
                (executedQtyByLineItem[lineItemId] || 0) + (tx.quantity || 0);
            }
          }
        });
      }

      // Compute two-layer totals for each line item
      const itemsWithTotals: LineItemWithApprovals[] = (lineItemsData || []).map(
        (item: any) => {
          const approvalList = item.approvals || [];

          // L1: quartermaster layer approved
          const l1Approvals = approvalList.filter(
            (a: any) => a.decision === "approved" && a.layer === "quartermaster"
          );
          // Rejected
          const rejectedApprovals = approvalList.filter(
            (a: any) => a.decision === "rejected"
          );
          // L2: admin layer approved (warehouse assignments)
          const l2Approvals = approvalList.filter(
            (a: any) => a.decision === "approved" && a.layer === "admin"
          );

          const totalApprovedQuantity = l1Approvals.reduce(
            (sum: number, a: any) => sum + (a.approved_quantity || 0),
            0
          );
          const totalRejectedQuantity = rejectedApprovals.reduce(
            (sum: number, a: any) => sum + (a.approved_quantity || 0),
            0
          );
          const l2AssignedQuantity = l2Approvals.reduce(
            (sum: number, a: any) => sum + (a.approved_quantity || 0),
            0
          );
          const executedQuantity = executedQtyByLineItem[item.id] || 0;

          const remainingQuantity =
            item.requested_quantity - totalApprovedQuantity - totalRejectedQuantity;

          // Build L1 approval data with nested L2 assignments
          const l1ApprovalData: L1ApprovalData[] = l1Approvals.map((l1: any) => {
            const l2Children = l2Approvals.filter(
              (l2: any) => l2.parent_approval_id === l1.id
            );
            const totalL2ForThisL1 = l2Children.reduce(
              (sum: number, l2: any) => sum + (l2.approved_quantity || 0),
              0
            );
            return {
              id: l1.id,
              approved_quantity: l1.approved_quantity,
              total_l2_assigned: totalL2ForThisL1,
              l2_assignments: l2Children.map((l2: any) => {
                const tx = txByApprovalId[l2.id];
                return {
                  id: l2.id,
                  warehouse_name: l2.warehouses?.name || "Unknown Warehouse",
                  approved_quantity: l2.approved_quantity,
                  is_executed: tx?.status === "completed",
                };
              }),
            };
          });

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
            l2_assigned_quantity: l2AssignedQuantity,
            executed_quantity: executedQuantity,
            assigned_warehouse_name: null,
            unit_name: item.item?.standard_unit_rel?.name || undefined,
            l1Approvals: l1ApprovalData,
          };
        }
      );

      setLineItems(itemsWithTotals);

      // Build warehouse assignments array for Warehouse Assignments tab
      // Each L2 approval becomes a WarehouseAssignment entry
      const warehouseAssignmentsList: WarehouseAssignment[] = [];

      (lineItemsData || []).forEach((item: any) => {
        const l2Apprs = (item.approvals || []).filter(
          (a: any) => a.decision === "approved" && a.layer === "admin"
        );

        const unitName =
          item.item?.standard_unit_rel?.name || undefined;

        l2Apprs.forEach((l2: any) => {
          const tx = txByApprovalId[l2.id];
          warehouseAssignmentsList.push({
            id: l2.id,
            line_item_id: item.id,
            item_name: item.item_name || "Unknown Item",
            item_sku: item.item_sku || null,
            item_id: item.item_id,
            warehouse_name: l2.warehouses?.name || "Unknown Warehouse",
            warehouse_id: l2.warehouse_id,
            approved_quantity: l2.approved_quantity,
            conversion_rate: item.conversion_rate || 1,
            unit_name: unitName,
            is_executed: tx?.status === "completed",
            inventory_transaction_id: undefined,
          });
        });
      });

      setWarehouseAssignments(warehouseAssignmentsList);

      // Fetch all approvals for Approvals tab (with layer and warehouse info)
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
          layer,
          warehouse_id,
          parent_approval_id,
          decided_by_user:users!stock_out_approvals_decided_by_fkey(id, full_name),
          line_item:stock_out_line_items(item_name, item_sku),
          warehouse:warehouses!stock_out_approvals_warehouse_id_fkey(id, name)
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

      // Fetch all inventory transactions for Transactions tab
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
            items(id, name, sku, standard_unit_rel:standard_units!items_standard_unit_id_fkey(name))
          `
          )
          .in("stock_out_approval_id", approvalIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (!txError && txData) {
          setInventoryTransactions(txData);
        }
      } else {
        setInventoryTransactions([]);
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
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel("qm-stock-out-execution");

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data.type === "APPROVAL_EXECUTED" &&
        event.data.requestId === requestId
      ) {
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
   * Handle successful dialog action — refetch data
   */
  const handleDialogSuccess = async () => {
    await fetchData();
  };

  /**
   * Handle execute from Warehouse Assignments tab — fetch current stock, show confirmation
   */
  const handleExecuteAssignment = async (assignment: WarehouseAssignment) => {
    const supabase = createClient();

    try {
      // Fetch current stock for this item + warehouse
      const { data: transactions } = await supabase
        .from("inventory_transactions")
        .select("movement_type, quantity")
        .eq("item_id", assignment.item_id)
        .eq("warehouse_id", assignment.warehouse_id)
        .eq("status", "completed")
        .eq("is_active", true);

      let currentStock = 0;
      (transactions || []).forEach((tx: any) => {
        if (tx.movement_type === "inventory_in") {
          currentStock += tx.quantity || 0;
        } else if (tx.movement_type === "inventory_out") {
          currentStock -= tx.quantity || 0;
        }
      });

      const afterStock = currentStock - assignment.approved_quantity;

      setExecutionDialogState({
        open: true,
        assignment,
        currentStock,
        afterStock,
      });
    } catch (error: any) {
      console.error("Error fetching stock levels:", error);
      // Still open dialog without stock levels
      setExecutionDialogState({
        open: true,
        assignment,
      });
    }
  };

  /**
   * Confirm and execute the stock-out for a warehouse assignment
   */
  const confirmExecution = async () => {
    if (!executionDialogState) return;

    setIsExecuting(true);
    const { assignment } = executionDialogState;
    const supabase = createClient();

    try {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("inventory_transactions")
        .update({
          status: "completed",
          transaction_date: now,
        })
        .eq("stock_out_approval_id", assignment.id)
        .eq("status", "pending");

      if (updateError) throw updateError;

      toast.success(
        `Stock-out executed: ${assignment.approved_quantity} unit(s) from ${assignment.warehouse_name}`
      );

      if (typeof BroadcastChannel !== "undefined") {
        try {
          const channel = new BroadcastChannel("qm-stock-out-execution");
          channel.postMessage({
            type: "APPROVAL_EXECUTED",
            approvalId: assignment.id,
            requestId,
            qmhqId: request?.qmhq_id,
          });
          channel.close();
        } catch (err) {
          console.warn("BroadcastChannel not supported:", err);
        }
      }

      setExecutionDialogState(null);
      await fetchData();
    } catch (error: any) {
      console.error("Error executing stock-out:", error);
      toast.error(error.message || "Failed to execute stock-out");
    } finally {
      setIsExecuting(false);
    }
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
      const { error: updateError } = await supabase
        .from("stock_out_line_items")
        .update({ status: "cancelled" })
        .eq("request_id", requestId)
        .eq("status", "pending");

      if (updateError) throw updateError;

      toast.success("Request cancelled successfully");
      await fetchData();
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
  const pendingAssignments = warehouseAssignments.filter((a) => !a.is_executed);

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
            lineItems={lineItems.map((li) => ({
              item_name: li.item_name || "Unknown Item",
              item_sku: li.item_sku,
              requested_quantity: li.requested_quantity,
              conversion_rate: li.conversion_rate,
              status: li.status,
              total_approved_quantity: li.total_approved_quantity,
              total_rejected_quantity: li.total_rejected_quantity,
            }))}
            approvals={approvals.map((a) => {
              const lineItem = lineItems.find((li) => li.id === a.line_item_id);
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
      {/* 5-Tab layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="line-items">Line Items</TabsTrigger>
          <TabsTrigger value="warehouse-assignments">
            Warehouse Assignments
            {warehouseAssignments.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {warehouseAssignments.length}
              </Badge>
            )}
          </TabsTrigger>
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

        {/* Line Items Tab */}
        <TabsContent value="line-items" className="space-y-4">
          <div className="command-panel p-6">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">
              Line Items
            </h3>
            <LineItemTable
              items={lineItems}
              canApprove={canApprove}
              onApproveItem={(item) => setL1DialogItem(item)}
              onRejectItem={(item) => setRejectionItem(item)}
              onAssignWarehouse={(item, l1) => setL2DialogState({ lineItem: item, l1Approval: l1 })}
            />
          </div>
        </TabsContent>

        {/* Warehouse Assignments Tab */}
        <TabsContent value="warehouse-assignments" className="space-y-4">
          <div className="command-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">
                Warehouse Assignments
              </h3>
              {pendingAssignments.length > 0 && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs"
                >
                  {pendingAssignments.length} pending
                </Badge>
              )}
            </div>
            <WarehouseAssignmentsTab
              assignments={warehouseAssignments}
              canExecute={canExecute}
              onExecute={handleExecuteAssignment}
              isExecuting={isExecuting}
            />
          </div>
        </TabsContent>

        {/* Approvals Tab — read-only approval history with layer badges */}
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
              <div className="space-y-4">
                {approvals.map((approval) => {
                  const isRejected = approval.decision === "rejected";
                  const isL1 = approval.layer === "quartermaster";
                  const isL2 = approval.layer === "admin";

                  return (
                    <div
                      key={approval.id}
                      className="border border-slate-700 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-wrap">
                          {approval.approval_number && (
                            <div className="font-mono text-sm text-slate-300">
                              {approval.approval_number}
                            </div>
                          )}

                          {/* Layer badge */}
                          {isL1 && (
                            <Badge
                              variant="outline"
                              className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-400"
                            >
                              L1 Qty Approval
                            </Badge>
                          )}
                          {isL2 && (
                            <Badge
                              variant="outline"
                              className="text-xs border-purple-500/30 bg-purple-500/10 text-purple-400"
                            >
                              L2 Warehouse Assignment
                            </Badge>
                          )}

                          {/* Decision badge */}
                          {isRejected ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-red-500/30 bg-red-500/10 text-red-400"
                            >
                              Rejected
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            >
                              Approved
                            </Badge>
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
                            {(() => {
                              const lineItem = lineItems.find(
                                (li) => li.id === approval.line_item_id
                              );
                              return (
                                lineItem?.unit_name && (
                                  <div className="text-xs font-mono text-slate-400 mt-1">
                                    {(
                                      approval.approved_quantity *
                                      (lineItem.conversion_rate || 1)
                                    ).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    {lineItem.unit_name}
                                  </div>
                                )
                              );
                            })()}
                          </div>
                        )}

                        <div>
                          <span className="text-slate-500">Decided by:</span>{" "}
                          <span className="text-slate-300">
                            {approval.decided_by_user?.full_name || "Unknown"}
                          </span>
                        </div>

                        {/* Warehouse name for L2 approvals */}
                        {isL2 && approval.warehouse && (
                          <div>
                            <span className="text-slate-500">Warehouse:</span>{" "}
                            <span className="text-slate-300">
                              {approval.warehouse.name}
                            </span>
                          </div>
                        )}
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
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            tx.status === "completed"
                              ? "bg-emerald-500/20"
                              : "bg-amber-500/20"
                          )}
                        >
                          <ArrowUpFromLine
                            className={cn(
                              "w-5 h-5",
                              tx.status === "completed"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            )}
                          />
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
                            From:{" "}
                            {tx.warehouses?.name || "Unknown Warehouse"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-mono font-bold text-red-400">
                          -{tx.quantity}
                        </div>
                        {(tx.items as any)?.standard_unit_rel?.name && (
                          <div className="text-xs font-mono text-slate-400 mt-1">
                            -
                            {(
                              tx.quantity * (tx.conversion_rate ?? 1)
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            {(tx.items as any).standard_unit_rel.name}
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
                      {new Date(
                        tx.transaction_date || tx.created_at
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

      {/* L1 Approval Dialog — single item, qty-only, no warehouse */}
      {l1DialogItem && (
        <L1ApprovalDialog
          open={!!l1DialogItem}
          onOpenChange={(open) => {
            if (!open) setL1DialogItem(null);
          }}
          lineItem={l1DialogItem}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Rejection Dialog — single item */}
      {rejectionItem && (
        <RejectionDialog
          open={!!rejectionItem}
          onOpenChange={(open) => {
            if (!open) setRejectionItem(null);
          }}
          lineItems={[rejectionItem]}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* L2 Warehouse Assignment Dialog */}
      {l2DialogState && (
        <L2WarehouseDialog
          open={!!l2DialogState}
          onOpenChange={(open) => {
            if (!open) setL2DialogState(null);
          }}
          lineItem={l2DialogState.lineItem}
          l1Approval={l2DialogState.l1Approval}
          requestReason={request.reason}
          qmhqId={request.qmhq_id}
          onSuccess={handleDialogSuccess}
        />
      )}

      {/* Execution Confirmation Dialog */}
      {executionDialogState && (
        <ExecutionConfirmationDialog
          open={executionDialogState.open}
          onOpenChange={(open) => {
            if (!open) setExecutionDialogState(null);
          }}
          itemName={executionDialogState.assignment.item_name}
          quantity={executionDialogState.assignment.approved_quantity}
          warehouseName={executionDialogState.assignment.warehouse_name}
          onConfirm={confirmExecution}
          isExecuting={isExecuting}
          currentStock={executionDialogState.currentStock}
          afterStock={executionDialogState.afterStock}
        />
      )}
    </DetailPageLayout>
  );
}
