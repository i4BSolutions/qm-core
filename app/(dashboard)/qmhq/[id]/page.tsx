"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Package,
  Wallet,
  ShoppingCart,
  Edit,
  Plus,
  DollarSign,
  Clock,
  User,
  Building2,
  CalendarDays,
  FileText,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Paperclip,
  ArrowUpFromLine,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { TransactionDialog } from "@/components/qmhq/transaction-dialog";
import { TransactionViewModal } from "@/components/qmhq/transaction-view-modal";
import { POStatusBadge } from "@/components/po/po-status-badge";
import { POProgressBar } from "@/components/po/po-progress-bar";
import { calculatePOProgress } from "@/lib/utils/po-status";
import { HistoryTab } from "@/components/history";
import { AttachmentsTab } from "@/components/files/attachments-tab";
import type { FileAttachmentWithUploader } from "@/lib/actions/files";
import { ClickableStatusBadge } from "@/components/status/clickable-status-badge";
import { FulfillmentProgressBar } from "@/components/qmhq/fulfillment-progress-bar";
import { CommentsSection } from "@/components/comments";
import type {
  QMHQ,
  StatusConfig,
  Category,
  User as UserType,
  QMRL,
  Item,
  ContactPerson,
  FinancialTransaction,
  PurchaseOrder,
  Supplier,
  POStatusEnum,
  QMHQItem,
  Warehouse,
  InventoryTransaction,
} from "@/types/database";

// Extended types
interface QMHQWithRelations extends QMHQ {
  status?: StatusConfig | null;
  category?: Category | null;
  assigned_user?: UserType | null;
  created_by_user?: UserType | null;
  qmrl?: Pick<QMRL, "id" | "request_id" | "title"> | null;
  item?: Item | null;
  contact_person?: ContactPerson | null;
}

interface FinancialTransactionWithUser extends FinancialTransaction {
  created_by_user?: Pick<UserType, "id" | "full_name"> | null;
}

interface POWithRelations extends PurchaseOrder {
  supplier?: Pick<Supplier, "id" | "name" | "company_name"> | null;
  line_items_aggregate?: {
    total_quantity: number;
    total_invoiced: number;
    total_received: number;
  };
}

type QMHQItemWithRelations = QMHQItem & {
  item?: { id: string; name: string; sku: string | null; default_unit: string | null } | null;
  warehouse?: { id: string; name: string } | null;
};

interface StockOutTransaction extends InventoryTransaction {
  item?: { id: string; name: string; sku: string | null } | null;
  warehouse?: { id: string; name: string } | null;
}

// Route type configuration
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  item: { icon: Package, label: "Item", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  expense: { icon: Wallet, label: "Expense", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  po: { icon: ShoppingCart, label: "PO", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
};

export default function QMHQDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { can } = usePermissions();
  const qmhqId = params.id as string;

  // Track updated param to trigger refetch after stock-out
  const updatedParam = searchParams.get("updated");

  // Per-file delete permission check matching RLS policy
  const canDeleteFile = useCallback((file: FileAttachmentWithUploader) => {
    if (!user) return false;
    // Admin and quartermaster can delete any file
    if (user.role === 'admin' || user.role === 'quartermaster') return true;
    // Users can delete their own uploads
    return file.uploaded_by === user.id;
  }, [user]);

  const [qmhq, setQmhq] = useState<QMHQWithRelations | null>(null);
  const [qmhqItems, setQmhqItems] = useState<QMHQItemWithRelations[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransactionWithUser[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<POWithRelations[]>([]);
  const [stockOutTransactions, setStockOutTransactions] = useState<StockOutTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [viewingTransaction, setViewingTransaction] = useState<FinancialTransactionWithUser | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch QMHQ with relations
    const { data: qmhqData, error: qmhqError } = await supabase
      .from("qmhq")
      .select(`
        *,
        status:status_config(id, name, color, status_group),
        category:categories(id, name, color),
        assigned_user:users!qmhq_assigned_to_fkey(id, full_name, email),
        created_by_user:users!qmhq_created_by_fkey(id, full_name),
        qmrl:qmrl!qmhq_qmrl_id_fkey(id, request_id, title),
        item:items!qmhq_item_id_fkey(id, name, sku, default_unit),
        contact_person:contact_persons!qmhq_contact_person_id_fkey(id, name, position)
      `)
      .eq("id", qmhqId)
      .single();

    if (qmhqError) {
      console.error("Error fetching QMHQ:", qmhqError);
      setIsLoading(false);
      return;
    }

    setQmhq(qmhqData as unknown as QMHQWithRelations);

    // Fetch qmhq_items if route_type is 'item'
    if (qmhqData && qmhqData.route_type === 'item') {
      const { data: itemsData } = await supabase
        .from('qmhq_items')
        .select(`
          *,
          item:items(id, name, sku, default_unit),
          warehouse:warehouses(id, name)
        `)
        .eq('qmhq_id', qmhqData.id);

      if (itemsData && itemsData.length > 0) {
        setQmhqItems(itemsData as unknown as QMHQItemWithRelations[]);
      } else if (qmhqData.item_id) {
        // Fallback for legacy single-item QMHQ
        const { data: legacyItem } = await supabase
          .from('items')
          .select('id, name, sku, default_unit')
          .eq('id', qmhqData.item_id)
          .single();

        const { data: legacyWarehouse } = qmhqData.warehouse_id
          ? await supabase
              .from('warehouses')
              .select('id, name')
              .eq('id', qmhqData.warehouse_id)
              .single()
          : { data: null };

        if (legacyItem) {
          setQmhqItems([{
            id: 'legacy',
            qmhq_id: qmhqData.id,
            item_id: qmhqData.item_id,
            quantity: qmhqData.quantity || 0,
            warehouse_id: qmhqData.warehouse_id,
            created_at: qmhqData.created_at || new Date().toISOString(),
            created_by: qmhqData.created_by,
            item: legacyItem,
            warehouse: legacyWarehouse,
          }]);
        }
      }

      // Fetch stock-out transactions for this QMHQ
      // Use explicit FK hint for warehouse since table has two FK to warehouses
      const { data: stockOutData, error: stockOutError } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          item:items(id, name, sku),
          warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name)
        `)
        .eq('qmhq_id', qmhqData.id)
        .eq('movement_type', 'inventory_out')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      console.log('[QMHQ Debug] Fetching stock-out for qmhq_id:', qmhqData.id);
      console.log('[QMHQ Debug] Stock-out data:', stockOutData);
      console.log('[QMHQ Debug] Stock-out error:', stockOutError);

      if (stockOutData) {
        setStockOutTransactions(stockOutData as unknown as StockOutTransaction[]);
      }
    }

    // Fetch file count for attachments tab badge
    const { count: filesCount } = await supabase
      .from("file_attachments")
      .select("*", { count: 'exact', head: true })
      .eq("entity_type", "qmhq")
      .eq("entity_id", qmhqId)
      .is("deleted_at", null);

    setFileCount(filesCount ?? 0);

    // Fetch financial transactions for expense/po routes
    if (qmhqData && (qmhqData.route_type === "expense" || qmhqData.route_type === "po")) {
      const { data: txData } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          created_by_user:users!financial_transactions_created_by_fkey(id, full_name)
        `)
        .eq("qmhq_id", qmhqId)
        .eq("is_active", true)
        .eq("is_voided", false)
        .order("transaction_date", { ascending: false });

      if (txData) setTransactions(txData as FinancialTransactionWithUser[]);
    }

    // Fetch purchase orders for PO route
    if (qmhqData && qmhqData.route_type === "po") {
      const { data: posData } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          supplier:suppliers(id, name, company_name)
        `)
        .eq("qmhq_id", qmhqId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (posData) {
        // Fetch line item aggregates for each PO
        const posWithAggregates = await Promise.all(
          posData.map(async (po) => {
            const { data: lineItems } = await supabase
              .from("po_line_items")
              .select("quantity, invoiced_quantity, received_quantity")
              .eq("po_id", po.id)
              .eq("is_active", true);

            const aggregate = lineItems?.reduce(
              (acc, item) => ({
                total_quantity: acc.total_quantity + (item.quantity || 0),
                total_invoiced: acc.total_invoiced + (item.invoiced_quantity || 0),
                total_received: acc.total_received + (item.received_quantity || 0),
              }),
              { total_quantity: 0, total_invoiced: 0, total_received: 0 }
            );

            return {
              ...po,
              line_items_aggregate: aggregate,
            };
          })
        );
        setPurchaseOrders(posWithAggregates as POWithRelations[]);
      }
    }

    setIsLoading(false);
  }, [qmhqId]);

  useEffect(() => {
    if (qmhqId) {
      fetchData();
    }
  }, [qmhqId, fetchData, updatedParam]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate if all items are fully issued (for item route)
  // Must be before early returns per React hooks rules
  const allItemsFullyIssued = useMemo(() => {
    if (qmhqItems.length === 0) return false;
    return qmhqItems.every((item) => {
      const issuedQty = stockOutTransactions
        .filter(t => t.item_id === item.item_id)
        .reduce((sum, t) => sum + (t.quantity || 0), 0);
      return issuedQty >= item.quantity;
    });
  }, [qmhqItems, stockOutTransactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading QMHQ data...
          </p>
        </div>
      </div>
    );
  }

  if (!qmhq) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-200">QMHQ Not Found</h2>
        <p className="text-slate-400">The requested QMHQ line could not be found.</p>
        <Link href="/qmhq">
          <Button variant="outline" className="border-slate-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to QMHQ List
          </Button>
        </Link>
      </div>
    );
  }

  const RouteIcon = routeConfig[qmhq.route_type]?.icon || Package;
  const routeColors = routeConfig[qmhq.route_type];

  // Calculate totals for financial tab
  const moneyInTotal = transactions
    .filter((t) => t.transaction_type === "money_in")
    .reduce((sum, t) => sum + (t.amount_eusd ?? 0), 0);

  const moneyOutTotal = transactions
    .filter((t) => t.transaction_type === "money_out")
    .reduce((sum, t) => sum + (t.amount_eusd ?? 0), 0);

  return (
    <div className="space-y-6 relative">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Header */}
      <div className="relative flex items-start justify-between animate-fade-in">
        <div className="flex items-start gap-4">
          <Link href="/qmhq">
            <Button variant="ghost" size="icon" className="mt-1 hover:bg-amber-500/10 hover:text-amber-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            {/* Route Type Badge */}
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex items-center gap-2 px-3 py-1 rounded border ${routeColors?.bgColor}`}>
                <RouteIcon className={`h-4 w-4 ${routeColors?.color}`} />
                <span className={`text-xs font-semibold uppercase tracking-widest ${routeColors?.color}`}>
                  {routeColors?.label} Route
                </span>
              </div>
              {qmhq.status && (
                <ClickableStatusBadge
                  status={qmhq.status}
                  entityType="qmhq"
                  entityId={qmhq.id}
                  onStatusChange={fetchData}
                />
              )}
            </div>

            {/* Request ID */}
            <div className="request-id-badge mb-2">
              <code className="text-lg">{qmhq.request_id}</code>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              {qmhq.line_name}
            </h1>

            {/* Parent QMRL Link */}
            {qmhq.qmrl && (
              <Link href={`/qmrl/${qmhq.qmrl.id}`} className="inline-flex items-center gap-2 mt-2 text-sm text-slate-400 hover:text-amber-400 transition-colors">
                <span>From:</span>
                <code className="text-amber-400">{qmhq.qmrl.request_id}</code>
                <span className="truncate max-w-[200px]">{qmhq.qmrl.title}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {can("update", "qmhq") && (
            <Link href={`/qmhq/${qmhqId}/edit`}>
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
                <Edit className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Edit</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Financial Summary for expense/po routes */}
      {(qmhq.route_type === "expense" || qmhq.route_type === "po") && (
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="grid grid-cols-5 gap-4">
            {/* QMHQ Amount (Budget) */}
            <div className="text-center p-4 rounded-lg bg-slate-800/30 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                QMHQ Amount
              </p>
              <CurrencyDisplay
                amount={qmhq.amount ?? 0}
                currency={qmhq.currency || "MMK"}
                amountEusd={qmhq.amount_eusd ?? 0}
                size="lg"
                context="card"
                fluid
              />
            </div>

            {/* Yet to Receive */}
            <div className="text-center p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <p className="text-xs text-cyan-400 uppercase tracking-wider mb-2">Yet to Receive</p>
              <CurrencyDisplay
                amount={Math.max(0, (qmhq.amount_eusd ?? 0) - moneyInTotal)}
                currency="EUSD"
                size="lg"
                context="card"
                fluid
                className="text-cyan-400"
              />
            </div>

            {/* Money In */}
            <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">Money In</p>
              <CurrencyDisplay
                amount={moneyInTotal}
                currency="EUSD"
                size="lg"
                context="card"
                fluid
                className="text-emerald-400"
              />
            </div>

            {/* Money Out */}
            <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">
                {qmhq.route_type === "po" ? "PO Committed" : "Money Out"}
              </p>
              <CurrencyDisplay
                amount={qmhq.route_type === "po" ? (qmhq.total_po_committed ?? 0) : moneyOutTotal}
                currency="EUSD"
                size="lg"
                context="card"
                fluid
                className="text-amber-400"
              />
            </div>

            {/* Balance in Hand */}
            <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-purple-400 uppercase tracking-wider mb-2">
                Balance in Hand
              </p>
              <CurrencyDisplay
                amount={moneyInTotal - (qmhq.route_type === "po" ? (qmhq.total_po_committed ?? 0) : moneyOutTotal)}
                currency="EUSD"
                size="lg"
                context="card"
                fluid
                className="text-purple-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up" style={{ animationDelay: "200ms" }}>
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="details" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            Details
          </TabsTrigger>
          {qmhq.route_type === "item" && (
            <TabsTrigger value="stock-out" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Stock Out ({stockOutTransactions.length})
            </TabsTrigger>
          )}
          {(qmhq.route_type === "expense" || qmhq.route_type === "po") && (
            <TabsTrigger value="transactions" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              Transactions ({transactions.length})
            </TabsTrigger>
          )}
          {qmhq.route_type === "po" && (
            <TabsTrigger value="purchase-orders" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              Purchase Orders
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            History
          </TabsTrigger>
          <TabsTrigger value="attachments" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            <Paperclip className="mr-2 h-4 w-4" />
            Attachments ({fileCount})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Basic Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <FileText className="h-4 w-4 text-amber-500" />
                <h2>Basic Information</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Category</p>
                    {qmhq.category ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: qmhq.category.color || undefined,
                          color: qmhq.category.color || undefined,
                        }}
                      >
                        {qmhq.category.name}
                      </Badge>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Status</p>
                    {qmhq.status ? (
                      <ClickableStatusBadge
                        status={qmhq.status}
                        entityType="qmhq"
                        entityId={qmhq.id}
                        onStatusChange={fetchData}
                      />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </div>
                </div>

                {qmhq.description && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Description</p>
                    <p className="text-slate-200">{qmhq.description}</p>
                  </div>
                )}

                {qmhq.notes && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-slate-300">{qmhq.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Assignment Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <User className="h-4 w-4 text-amber-500" />
                <h2>Assignment</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Assigned To</p>
                    <p className="text-slate-200 font-medium">
                      {qmhq.assigned_user?.full_name || "Unassigned"}
                    </p>
                  </div>
                </div>

                {qmhq.contact_person && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Contact Person</p>
                      <p className="text-slate-200 font-medium">{qmhq.contact_person.name}</p>
                      {qmhq.contact_person.position && (
                        <p className="text-xs text-slate-400">{qmhq.contact_person.position}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Route-specific Info */}
            {qmhq.route_type === "item" && qmhqItems.length > 0 && (
              <div className="command-panel corner-accents lg:col-span-2">
                <div className="section-header">
                  <Package className="h-4 w-4 text-blue-400" />
                  <h2>Requested Items ({qmhqItems.length})</h2>
                </div>

                <div className="space-y-3">
                  {qmhqItems.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-slate-500 w-6">#{index + 1}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            {item.item?.sku && (
                              <code className="text-amber-400 text-xs">{item.item.sku}</code>
                            )}
                            <span className="text-slate-200 font-medium">{item.item?.name || 'Unknown Item'}</span>
                          </div>
                          {item.warehouse && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              From: {item.warehouse.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-mono text-blue-400">{item.quantity}</span>
                        {item.item?.default_unit && (
                          <span className="text-xs text-slate-400 ml-1">{item.item.default_unit}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fulfillment Progress for item route */}
            {qmhq.route_type === "item" && qmhqItems.length > 0 && (
              <div className="command-panel corner-accents lg:col-span-2">
                <div className="section-header">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h2>Fulfillment Progress</h2>
                </div>
                <div className="space-y-3">
                  {qmhqItems.map((item) => {
                    const issuedQty = stockOutTransactions
                      .filter(t => t.item_id === item.item_id)
                      .reduce((sum, t) => sum + (t.quantity || 0), 0);
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">{item.item?.name || 'Unknown Item'}</span>
                          {item.item?.sku && <code className="text-amber-400 text-xs">{item.item.sku}</code>}
                        </div>
                        <FulfillmentProgressBar
                          issuedQty={issuedQty}
                          requestedQty={item.quantity}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Financial Info for expense/po */}
            {(qmhq.route_type === "expense" || qmhq.route_type === "po") && (
              <div className="command-panel corner-accents">
                <div className="section-header">
                  <DollarSign className={`h-4 w-4 ${qmhq.route_type === "expense" ? "text-emerald-400" : "text-purple-400"}`} />
                  <h2>Financial Details</h2>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">QMHQ Amount</p>
                      <CurrencyDisplay
                        amount={qmhq.amount}
                        currency={qmhq.currency || "MMK"}
                        amountEusd={qmhq.amount_eusd}
                        size="lg"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Exchange Rate</p>
                      <p className="text-lg font-mono text-slate-200">{qmhq.exchange_rate ?? 1}</p>
                      <p className="text-xs text-slate-400 mt-1">1 EUSD = {qmhq.exchange_rate ?? 1} {qmhq.currency || "MMK"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2>Timeline</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Created</p>
                    <p className="text-slate-200">{formatDateTime(qmhq.created_at)}</p>
                    {qmhq.created_by_user && (
                      <p className="text-xs text-slate-400">by {qmhq.created_by_user.full_name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Last Updated</p>
                    <p className="text-slate-200">{formatDateTime(qmhq.updated_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Stock Out Tab */}
        {qmhq.route_type === "item" && (
          <TabsContent value="stock-out" className="mt-6">
            <div className="command-panel corner-accents">
              <div className="flex items-center justify-between mb-6">
                <div className="section-header mb-0">
                  <ArrowUpFromLine className="h-4 w-4 text-red-400" />
                  <h2>Stock Out Transactions</h2>
                </div>
{allItemsFullyIssued ? (
                  <Button
                    disabled
                    className="bg-slate-600 cursor-not-allowed"
                    title="All items have been fully issued"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Fully Issued
                  </Button>
                ) : (
                  <Link href={`/inventory/stock-out?qmhq=${qmhqId}`}>
                    <Button
                      className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Issue Items
                    </Button>
                  </Link>
                )}
              </div>

              {/* Items Summary */}
              <div className="mb-6 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Requested Items Summary</p>
                <div className="space-y-2">
                  {qmhqItems.map((item) => {
                    const issuedQty = stockOutTransactions
                      .filter(t => t.item_id === item.item_id)
                      .reduce((sum, t) => sum + (t.quantity || 0), 0);
                    const pendingQty = Math.max(0, item.quantity - issuedQty);
                    const isFullyIssued = pendingQty === 0;

                    return (
                      <div key={item.id} className="p-2 rounded bg-slate-800/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {isFullyIssued ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Package className="h-4 w-4 text-slate-400" />
                            )}
                            <div>
                              <span className="text-slate-200">{item.item?.name || 'Unknown'}</span>
                              {item.item?.sku && (
                                <code className="text-amber-400 text-xs ml-2">{item.item.sku}</code>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-400">
                              Requested: <span className="font-mono text-blue-400">{item.quantity}</span>
                            </span>
                            <span className="text-slate-400">
                              Issued: <span className="font-mono text-emerald-400">{issuedQty}</span>
                            </span>
                            {!isFullyIssued && (
                              <span className="text-slate-400">
                                Pending: <span className="font-mono text-amber-400">{pendingQty}</span>
                              </span>
                            )}
                            {isFullyIssued && (
                              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                Complete
                              </span>
                            )}
                          </div>
                        </div>
                        <FulfillmentProgressBar
                          issuedQty={issuedQty}
                          requestedQty={item.quantity}
                          size="sm"
                          showLabel={false}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {stockOutTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <ArrowUpFromLine className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Items Issued Yet</h3>
                  <p className="text-sm text-slate-400 max-w-md mb-4">
                    Issue items from warehouse inventory using the button above.
                    Stock will be deducted from the selected warehouse.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockOutTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-4 rounded-lg border bg-red-500/5 border-red-500/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/20">
                            <ArrowUpFromLine className="h-5 w-5 text-red-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200 font-medium">
                                {tx.item?.name || 'Unknown Item'}
                              </span>
                              {tx.item?.sku && (
                                <code className="text-xs text-amber-400">{tx.item.sku}</code>
                              )}
                            </div>
                            <p className="text-sm text-slate-400">
                              From: {tx.warehouse?.name || 'Unknown Warehouse'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono font-bold text-red-400">
                            -{tx.quantity}
                          </p>
                          <p className="text-xs text-slate-400">
                            {tx.reason === 'request' ? 'Request Fulfillment' : tx.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span>{new Date(tx.transaction_date || tx.created_at || '').toLocaleDateString()}</span>
                        {tx.notes && <span className="truncate max-w-[200px]">{tx.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Transactions Tab */}
        {(qmhq.route_type === "expense" || qmhq.route_type === "po") && (
          <TabsContent value="transactions" className="mt-6">
            <div className="command-panel corner-accents">
              <div className="flex items-center justify-between mb-6">
                <div className="section-header mb-0">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <h2>Financial Transactions</h2>
                </div>
                <Button
                  onClick={() => setIsTransactionDialogOpen(true)}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Transaction
                </Button>
              </div>

              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <DollarSign className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Transactions Yet</h3>
                  <p className="text-sm text-slate-400 max-w-md">
                    Record Money In or Money Out transactions for this QMHQ line.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`p-4 rounded-lg border ${
                        tx.transaction_type === "money_in"
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-amber-500/5 border-amber-500/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tx.transaction_type === "money_in"
                              ? "bg-emerald-500/20"
                              : "bg-amber-500/20"
                          }`}>
                            {tx.transaction_type === "money_in" ? (
                              <TrendingUp className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <code className={`text-sm font-mono ${
                                tx.transaction_type === "money_in"
                                  ? "text-emerald-400"
                                  : "text-amber-400"
                              }`}>
                                {tx.transaction_id || "—"}
                              </code>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                tx.transaction_type === "money_in"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}>
                                {tx.transaction_type === "money_in" ? "IN" : "OUT"}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 mt-1">{tx.notes || "No notes"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className={`text-lg font-mono font-bold ${
                              tx.transaction_type === "money_in"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}>
                              {tx.transaction_type === "money_in" ? "+" : "-"}{formatCurrency(tx.amount_eusd ?? 0)} EUSD
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatCurrency(tx.amount ?? 0)} {tx.currency}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setViewingTransaction(tx);
                              setIsViewModalOpen(true);
                            }}
                            className="text-slate-400 hover:text-slate-200"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span>{formatDate(tx.transaction_date)}</span>
                        {tx.created_by_user && (
                          <span>by {tx.created_by_user.full_name}</span>
                        )}
                        {tx.attachment_url && (
                          <a
                            href={tx.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300"
                          >
                            View Attachment
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* Purchase Orders Tab */}
        {qmhq.route_type === "po" && (
          <TabsContent value="purchase-orders" className="mt-6">
            <div className="command-panel corner-accents">
              <div className="flex items-center justify-between mb-6">
                <div className="section-header mb-0">
                  <ShoppingCart className="h-4 w-4 text-amber-500" />
                  <h2>Purchase Orders ({purchaseOrders.length})</h2>
                </div>
{(qmhq.balance_in_hand ?? 0) > 0 ? (
                  <Link href={`/po/new?qmhq=${qmhqId}`}>
                    <Button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400">
                      <Plus className="mr-2 h-4 w-4" />
                      Create PO
                    </Button>
                  </Link>
                ) : (
                  <Button
                    disabled
                    className="bg-slate-600 cursor-not-allowed"
                    title="Balance in Hand is 0"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create PO
                  </Button>
                )}
              </div>

              {(qmhq.balance_in_hand ?? 0) <= 0 && purchaseOrders.length === 0 && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-400">Insufficient Balance</p>
                      <p className="text-sm text-slate-400">
                        You need to add Money In transactions before creating Purchase Orders.
                        Current Balance in Hand: {formatCurrency(qmhq.balance_in_hand ?? 0)} EUSD
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {purchaseOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <ShoppingCart className="h-8 w-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No Purchase Orders Yet</h3>
                  <p className="text-sm text-slate-400 max-w-md">
                    Purchase Orders will be listed here once created. Add Money In transactions first to fund POs.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {purchaseOrders.map((po) => {
                    const progress = calculatePOProgress(
                      po.line_items_aggregate?.total_quantity ?? 0,
                      po.line_items_aggregate?.total_invoiced ?? 0,
                      po.line_items_aggregate?.total_received ?? 0
                    );

                    return (
                      <Link key={po.id} href={`/po/${po.id}`}>
                        <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-purple-500/30 transition-colors cursor-pointer">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="request-id-badge">
                                <code>{po.po_number}</code>
                              </div>
                              <POStatusBadge status={(po.status || "not_started") as POStatusEnum} size="sm" />
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-emerald-400">{formatCurrency(po.total_amount_eusd ?? 0)} EUSD</p>
                              <p className="text-xs text-slate-400">{formatCurrency(po.total_amount ?? 0)} {po.currency || "MMK"}</p>
                            </div>
                          </div>
                          {po.supplier && (
                            <p className="text-sm text-slate-300 mb-3">
                              {po.supplier.company_name || po.supplier.name}
                            </p>
                          )}
                          <div className="w-full">
                            <POProgressBar
                              invoicedPercent={progress.invoicedPercent}
                              receivedPercent={progress.receivedPercent}
                              showLabels={false}
                              size="sm"
                            />
                            <div className="flex justify-between mt-1 text-xs text-slate-500">
                              <span>Invoiced: {progress.invoicedPercent}%</span>
                              <span>Received: {progress.receivedPercent}%</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <HistoryTab entityType="qmhq" entityId={qmhqId} />
          </div>
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments" className="mt-6">
          <div className="command-panel corner-accents">
            <AttachmentsTab
              entityType="qmhq"
              entityId={qmhqId}
              entityDisplayId={qmhq.request_id}
              canDeleteFile={canDeleteFile}
              canUpload={true}
              onFileCountChange={setFileCount}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Comments Section */}
      <CommentsSection entityType="qmhq" entityId={qmhq.id} />

      {/* Transaction Dialog */}
      {(qmhq.route_type === "expense" || qmhq.route_type === "po") && user && (
        <TransactionDialog
          open={isTransactionDialogOpen}
          onOpenChange={setIsTransactionDialogOpen}
          qmhqId={qmhqId}
          routeType={qmhq.route_type as "expense" | "po"}
          userId={user.id}
          onSuccess={fetchData}
        />
      )}

      {/* Transaction View Modal */}
      <TransactionViewModal
        transaction={viewingTransaction}
        open={isViewModalOpen}
        onOpenChange={setIsViewModalOpen}
      />
    </div>
  );
}
