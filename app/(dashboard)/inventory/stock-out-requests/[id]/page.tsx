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
import { HistoryTab } from "@/components/history/history-tab";
import { LineItemTable } from "@/components/stock-out-requests/line-item-table";
import type { LineItemWithApprovals } from "@/components/stock-out-requests/line-item-table";
import { ApprovalDialog } from "@/components/stock-out-requests/approval-dialog";
import { RejectionDialog } from "@/components/stock-out-requests/rejection-dialog";
import { ExecutionDialog } from "@/components/stock-out-requests/execution-dialog";
import { STOCK_OUT_REASON_CONFIG } from "@/lib/utils/inventory";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Enums, Tables } from "@/types/database";

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
    label: "Partially Executed",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
  },
  executed: {
    label: "Executed",
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
  const requestId = params.id as string;

  const [request, setRequest] = useState<StockOutRequestWithRelations | null>(
    null
  );
  const [lineItems, setLineItems] = useState<LineItemWithApprovals[]>([]);
  const [approvals, setApprovals] = useState<ApprovalWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCancelling, setIsCancelling] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isRejectionDialogOpen, setIsRejectionDialogOpen] = useState(false);
  const [isExecutionDialogOpen, setIsExecutionDialogOpen] = useState(false);
  const [hasPendingExecutions, setHasPendingExecutions] = useState(false);

  // Permission checks
  const canApprove = user?.role === "admin" || user?.role === "quartermaster" || user?.role === "inventory";
  const canExecute = user?.role === "admin" || user?.role === "inventory";
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
          status,
          approvals:stock_out_approvals(
            id,
            approved_quantity,
            decision,
            warehouse_id,
            warehouse:warehouses(id, name)
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

          const totalApprovedQuantity = approvedApprovals.reduce(
            (sum: number, a: any) => sum + (a.approved_quantity || 0),
            0
          );

          const remainingQuantity =
            item.requested_quantity - totalApprovedQuantity;

          // Get latest warehouse (most recent approval)
          const latestApproval = approvedApprovals[approvedApprovals.length - 1];
          const assignedWarehouseName = latestApproval?.warehouse?.name || null;

          return {
            id: item.id,
            item_id: item.item_id,
            item_name: item.item_name,
            item_sku: item.item_sku,
            requested_quantity: item.requested_quantity,
            status: item.status as SorLineItemStatus,
            total_approved_quantity: totalApprovedQuantity,
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

      // Check if there are pending execution records
      // Get all line item IDs
      const allLineItemIds = itemsWithTotals.map((item) => item.id);

      if (allLineItemIds.length > 0) {
        // Get approved approvals
        const { data: approvedApprovalsData } = await supabase
          .from("stock_out_approvals")
          .select("id")
          .in("line_item_id", allLineItemIds)
          .eq("decision", "approved")
          .eq("is_active", true);

        const approvedApprovalIds = (approvedApprovalsData || []).map((a) => a.id);

        if (approvedApprovalIds.length > 0) {
          // Check for pending inventory transactions
          const { count: pendingCount } = await supabase
            .from("inventory_transactions")
            .select("*", { count: "exact", head: true })
            .in("stock_out_approval_id", approvedApprovalIds)
            .eq("status", "pending");

          setHasPendingExecutions((pendingCount ?? 0) > 0);
        } else {
          setHasPendingExecutions(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/inventory/stock-out-requests")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-mono font-bold text-slate-100">
                {request.request_number}
              </h1>
              <p className="text-sm text-slate-400">
                Requested by {request.requester?.full_name || "Unknown"}
              </p>
            </div>
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

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {canExecute && hasPendingExecutions && (
            <Button
              onClick={() => setIsExecutionDialogOpen(true)}
              className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
            >
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Execute Stock-Out
            </Button>
          )}
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
        </div>
      </div>

      {/* Request Info Panel */}
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {approvals.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {approvals.length}
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
              <div className="space-y-4">
                {approvals.map((approval) => (
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
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            approval.decision === "approved"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-red-500/30 bg-red-500/10 text-red-400"
                          )}
                        >
                          {approval.decision === "approved"
                            ? "Approved"
                            : "Rejected"}
                        </Badge>
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
        onSuccess={handleDialogSuccess}
      />

      {/* Rejection Dialog */}
      <RejectionDialog
        open={isRejectionDialogOpen}
        onOpenChange={setIsRejectionDialogOpen}
        lineItems={lineItems.filter((item) => selectedIds.has(item.id))}
        onSuccess={handleDialogSuccess}
      />

      {/* Execution Dialog */}
      <ExecutionDialog
        open={isExecutionDialogOpen}
        onOpenChange={setIsExecutionDialogOpen}
        requestId={requestId}
        onSuccess={fetchData}
      />
    </div>
  );
}
