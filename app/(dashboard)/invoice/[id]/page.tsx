"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Building2,
  CalendarDays,
  DollarSign,
  AlertTriangle,
  Ban,
  Clock,
  Package,
  ExternalLink,
  ArrowRightLeft,
  ArrowDownToLine,
  Warehouse as WarehouseIcon,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  InvoiceStatusBadge,
  ReadonlyInvoiceLineItemsTable,
  VoidInvoiceDialog,
} from "@/components/invoice";
import { MiniProgressBar } from "@/components/po/po-progress-bar";
import { formatCurrency } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  canVoidInvoice,
  formatExchangeRate,
} from "@/lib/utils/invoice-status";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { HistoryTab } from "@/components/history";
import { voidInvoice } from "@/lib/actions/invoice-actions";
import { useToast } from "@/components/ui/use-toast";
import { CommentsSection } from "@/components/comments";
import { DetailPageLayout } from "@/components/composite";
import type {
  Invoice,
  InvoiceLineItem,
  PurchaseOrder,
  Supplier,
  User as UserType,
  Item,
  InvoiceStatus,
  InventoryTransaction,
  Warehouse,
} from "@/types/database";

// Stock receipt type
interface StockReceiptWithRelations extends InventoryTransaction {
  item?: Pick<Item, "id" | "name" | "sku"> | null;
  warehouse?: Pick<Warehouse, "id" | "name" | "location"> | null;
}

// Extended types
interface InvoiceWithRelations extends Invoice {
  purchase_order?: PurchaseOrder & {
    supplier?: Supplier | null;
  } | null;
  created_by_user?: Pick<UserType, "id" | "full_name"> | null;
  updated_by_user?: Pick<UserType, "id" | "full_name"> | null;
  voided_by_user?: Pick<UserType, "id" | "full_name"> | null;
}

interface InvoiceLineItemWithItem extends InvoiceLineItem {
  item?: Pick<Item, "id" | "name" | "sku"> | null;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemWithItem[]>([]);
  const [stockReceipts, setStockReceipts] = useState<StockReceiptWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!invoiceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch invoice with relations
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          *,
          purchase_order:purchase_orders!invoices_po_id_fkey(
            *,
            supplier:suppliers(*)
          ),
          created_by_user:users!invoices_created_by_fkey(id, full_name),
          updated_by_user:users!invoices_updated_by_fkey(id, full_name),
          voided_by_user:users!invoices_voided_by_fkey(id, full_name)
        `)
        .eq("id", invoiceId)
        .single();

      if (invoiceError) {
        console.error("Error fetching invoice:", invoiceError);
        throw new Error(invoiceError.message);
      }

      setInvoice(invoiceData as unknown as InvoiceWithRelations);

      // Fetch line items
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .select(`
          *,
          item:items(id, name, sku)
        `)
        .eq("invoice_id", invoiceId)
        .eq("is_active", true)
        .order("created_at");

      if (lineItemsError) {
        console.error("Error fetching line items:", lineItemsError);
        throw new Error(lineItemsError.message);
      }

      if (lineItemsData) {
        setLineItems(lineItemsData as InvoiceLineItemWithItem[]);
      }

      // Fetch stock receipts (inventory transactions linked to this invoice)
      const { data: stockReceiptsData, error: stockReceiptsError } = await supabase
        .from("inventory_transactions")
        .select(`
          *,
          item:items!inventory_transactions_item_id_fkey(id, name, sku),
          warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name, location)
        `)
        .eq("invoice_id", invoiceId)
        .eq("is_active", true)
        .order("transaction_date", { ascending: false });

      if (stockReceiptsError) {
        console.error("Error fetching stock receipts:", stockReceiptsError);
        throw new Error(stockReceiptsError.message);
      }

      if (stockReceiptsData) {
        setStockReceipts(stockReceiptsData as StockReceiptWithRelations[]);
      }

    } catch (err) {
      console.error('Error fetching invoice detail data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load invoice';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVoid = async (reason: string) => {
    if (!invoice || !user) return;
    setIsVoiding(true);

    try {
      const result = await voidInvoice(invoiceId, reason);

      if (!result.success) {
        toast({
          variant: "destructive",
          title: "Void Failed",
          description: result.error,
        });
        setIsVoiding(false);
        return;
      }

      // Simple success toast (per user decision)
      const { data } = result;
      toast({
        title: "Invoice Voided",
        description: `${data.invoiceNumber} has been voided successfully`,
      });

      setIsVoiding(false);
      setShowVoidDialog(false);
      // Data will refresh via revalidatePath, but fetchData for immediate local update
      fetchData();

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Void Failed",
        description: "An unexpected error occurred. Please try again.",
      });
      setIsVoiding(false);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading invoice data...
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-200">
          Invoice Not Found
        </h2>
        <p className="text-slate-400">The requested invoice could not be found.</p>
        <Link href="/invoice">
          <Button variant="outline" className="border-slate-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Invoice List
          </Button>
        </Link>
      </div>
    );
  }

  // Guard pre-check logic
  const isVoided = invoice.is_voided ?? false;
  const hasStockIn = stockReceipts.length > 0;

  // Void button: visible when invoice is not voided (shows disabled state with tooltip)
  const showVoidButton = !isVoided;
  const canVoidNow = !hasStockIn && !isVoided && canVoidInvoice(invoice.status as InvoiceStatus, isVoided);

  // Tooltip reason for disabled void
  const voidDisabledReason = hasStockIn
    ? "Cannot void -- goods received"
    : "";

  return (
    <DetailPageLayout
      backHref="/invoice"
      header={
        <div>
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

          {/* Status Badge */}
          <div className="flex items-center gap-3 mb-2">
            <InvoiceStatusBadge
              status={(invoice.status || "draft") as InvoiceStatus}
              isVoided={invoice.is_voided ?? false}
            />
          </div>

          {/* Invoice Number */}
          <div className="request-id-badge mb-2">
            <code className="text-lg">{invoice.invoice_number}</code>
          </div>

          {/* Supplier */}
          {invoice.purchase_order?.supplier && (
            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              {invoice.purchase_order.supplier.company_name ||
                invoice.purchase_order.supplier.name}
            </h1>
          )}

          {/* Parent PO Link */}
          {invoice.purchase_order && (
            <Link
              href={`/po/${invoice.purchase_order.id}`}
              className="inline-flex items-center gap-2 mt-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
            >
              <span>PO:</span>
              <code className="text-blue-400">
                {invoice.purchase_order.po_number}
              </code>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}

          {/* Voided Warning */}
          {invoice.is_voided && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 mt-4">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">This invoice has been voided</p>
                  {invoice.void_reason && (
                    <p className="text-sm text-red-400/80 mt-1">
                      Reason: {invoice.void_reason}
                    </p>
                  )}
                  {invoice.voided_by_user && (
                    <p className="text-xs text-slate-400 mt-2">
                      Voided by {invoice.voided_by_user.full_name} on{" "}
                      {formatDateTime(invoice.voided_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      }
      actions={
        <>
          {showVoidButton && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      onClick={() => setShowVoidDialog(true)}
                      disabled={!canVoidNow}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Void Invoice
                    </Button>
                  </div>
                </TooltipTrigger>
                {!canVoidNow && voidDisabledReason && (
                  <TooltipContent>
                    <p className="text-xs">{voidDisabledReason}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      }
      kpiPanel={
        <div
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "100ms" }}
        >
        <div className="grid grid-cols-3 gap-4">
          {/* Total Amount with EUSD */}
          <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
              Invoice Total
            </p>
            <CurrencyDisplay
              amount={invoice.total_amount}
              currency={invoice.currency || "MMK"}
              amountEusd={invoice.total_amount_eusd}
              size="lg"
            />
            <p className="text-xs text-slate-400 mt-2">
              Rate: {formatExchangeRate(invoice.exchange_rate ?? 1)}
            </p>
          </div>

          {/* Received Progress */}
          {(() => {
            const totalQty = lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);
            const totalReceived = lineItems.reduce((sum, li) => sum + (li.received_quantity || 0), 0);
            const receivedPercent = totalQty > 0 ? Math.min(100, Math.round((totalReceived / totalQty) * 100)) : 0;
            return (
              <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">
                  Received
                </p>
                <p className="text-xl font-mono font-bold text-emerald-400">
                  {receivedPercent}%
                </p>
                <p className="text-xs text-slate-400 mt-1">{totalReceived} / {totalQty} units</p>
              </div>
            );
          })()}

          {/* Invoice Date */}
          <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">
              Invoice Date
            </p>
            <p className="text-lg font-medium text-blue-400">
              {formatDate(invoice.invoice_date)}
            </p>
          </div>
        </div>

        {/* Received Progress Bar */}
        {(() => {
          const totalQty = lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);
          const totalReceived = lineItems.reduce((sum, li) => sum + (li.received_quantity || 0), 0);
          const receivedPercent = totalQty > 0 ? Math.min(100, Math.round((totalReceived / totalQty) * 100)) : 0;
          return totalQty > 0 ? (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-slate-400">Received</span>
                <span className="text-emerald-400 font-mono">{receivedPercent}%</span>
              </div>
              <MiniProgressBar percent={receivedPercent} color="emerald" />
            </div>
          ) : null;
        })()}
        </div>
      }
    >
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="animate-slide-up"
        style={{ animationDelay: "200ms" }}
      >
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger
            value="details"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value="line-items"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Line Items ({lineItems.length})
          </TabsTrigger>
          <TabsTrigger
            value="stock-receipts"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Stock Receipts ({stockReceipts.length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            History
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Invoice Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <FileText className="h-4 w-4 text-amber-500" />
                <h2>Invoice Information</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Invoice Date
                    </p>
                    <p className="text-slate-200">
                      {formatDate(invoice.invoice_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Currency
                    </p>
                    <p className="text-slate-200">{invoice.currency || "MMK"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Exchange Rate
                    </p>
                    <p className="text-slate-200 font-mono">
                      {formatExchangeRate(invoice.exchange_rate ?? 1)}
                    </p>
                  </div>
                </div>

                {invoice.notes && (
                  <>
                    <div className="divider-accent" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                        Notes
                      </p>
                      <p className="text-slate-300">{invoice.notes}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* PO Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <FileText className="h-4 w-4 text-amber-500" />
                <h2>Purchase Order</h2>
              </div>

              {invoice.purchase_order ? (
                <div className="space-y-4">
                  <Link
                    href={`/po/${invoice.purchase_order.id}`}
                    className="block p-4 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-amber-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <code className="text-amber-400 text-lg">
                          {invoice.purchase_order.po_number}
                        </code>
                        <p className="text-sm text-slate-400 mt-1">
                          {invoice.purchase_order.supplier?.company_name ||
                            invoice.purchase_order.supplier?.name}
                        </p>
                      </div>
                      <ExternalLink className="h-5 w-5 text-slate-400" />
                    </div>
                  </Link>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                        PO Total (EUSD)
                      </p>
                      <p className="font-mono text-emerald-400">
                        {formatCurrency(
                          invoice.purchase_order.total_amount_eusd ?? 0
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                        PO Currency
                      </p>
                      <p className="text-slate-200">
                        {invoice.purchase_order.currency || "MMK"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No PO linked</p>
              )}
            </div>

            {/* Supplier Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <Building2 className="h-4 w-4 text-amber-500" />
                <h2>Supplier</h2>
              </div>

              {invoice.purchase_order?.supplier ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium">
                        {invoice.purchase_order.supplier.company_name ||
                          invoice.purchase_order.supplier.name}
                      </p>
                      {invoice.purchase_order.supplier.company_name && (
                        <p className="text-sm text-slate-400">
                          {invoice.purchase_order.supplier.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {invoice.purchase_order.supplier.email && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                          Email
                        </p>
                        <p className="text-slate-300">
                          {invoice.purchase_order.supplier.email}
                        </p>
                      </div>
                    )}
                    {invoice.purchase_order.supplier.phone && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                          Phone
                        </p>
                        <p className="text-slate-300">
                          {invoice.purchase_order.supplier.phone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">No supplier information</p>
              )}
            </div>

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
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Created
                    </p>
                    <p className="text-slate-200">
                      {formatDateTime(invoice.created_at)}
                    </p>
                    {invoice.created_by_user && (
                      <p className="text-xs text-slate-400">
                        by {invoice.created_by_user.full_name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Last Updated
                    </p>
                    <p className="text-slate-200">
                      {formatDateTime(invoice.updated_at)}
                    </p>
                    {invoice.updated_by_user && (
                      <p className="text-xs text-slate-400">
                        by {invoice.updated_by_user.full_name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Line Items Tab */}
        <TabsContent value="line-items" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Package className="h-4 w-4 text-amber-500" />
              <h2>Line Items</h2>
            </div>

            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  No Line Items
                </h3>
                <p className="text-sm text-slate-400">
                  This invoice has no line items.
                </p>
              </div>
            ) : (
              <ReadonlyInvoiceLineItemsTable
                items={lineItems}
                currency={invoice.currency || "MMK"}
                showPOPrice={true}
              />
            )}
          </div>
        </TabsContent>

        {/* Stock Receipts Tab */}
        <TabsContent value="stock-receipts" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="flex items-center justify-between mb-4">
              <div className="section-header">
                <Package className="h-4 w-4 text-amber-500" />
                <h2>Stock Receipts ({stockReceipts.length})</h2>
              </div>
              {!invoice.is_voided && (
                <Link href={`/inventory/stock-in?invoice=${invoiceId}`}>
                  <Button
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Receive Stock
                  </Button>
                </Link>
              )}
            </div>

            {stockReceipts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  No Stock Received Yet
                </h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Use the "Receive Stock" button to record items received from
                  this invoice.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stockReceipts.map((receipt) => (
                  <div
                    key={receipt.id}
                    className="p-4 rounded-lg border border-slate-700 bg-slate-800/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <ArrowDownToLine className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-200">
                              {receipt.item?.name || receipt.item_name || "Unknown Item"}
                            </p>
                            {(receipt.item?.sku || receipt.item_sku) && (
                              <code className="text-xs text-amber-400">
                                {receipt.item?.sku || receipt.item_sku}
                              </code>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <div className="flex items-center gap-1 text-slate-400">
                              <WarehouseIcon className="h-3 w-3" />
                              <Link
                                href={`/warehouse/${receipt.warehouse?.id}`}
                                className="hover:text-amber-400 transition-colors"
                              >
                                {receipt.warehouse?.name || "—"}
                              </Link>
                            </div>
                            <span className="text-slate-500">
                              {receipt.transaction_date
                                ? new Date(receipt.transaction_date).toLocaleDateString()
                                : "—"}
                            </span>
                          </div>
                          {receipt.notes && (
                            <p className="text-xs text-slate-500 mt-2">
                              {receipt.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-lg font-bold text-emerald-400">
                          +{receipt.quantity}
                        </p>
                        {receipt.unit_cost && (
                          <p className="text-xs text-slate-400 mt-1">
                            @ {formatCurrency(receipt.unit_cost)} {receipt.currency}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <div className="pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-400">
                      Total Received: {stockReceipts.length} transaction(s)
                    </p>
                    <p className="font-mono text-lg text-emerald-400">
                      {stockReceipts.reduce((sum, r) => sum + (r.quantity || 0), 0)} units
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <HistoryTab entityType="invoices" entityId={invoiceId} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Comments Section */}
      <CommentsSection entityType="invoice" entityId={invoiceId} />

      {/* Void Dialog */}
      <VoidInvoiceDialog
        open={showVoidDialog}
        onOpenChange={setShowVoidDialog}
        invoiceNumber={invoice.invoice_number || ""}
        onConfirm={handleVoid}
        isLoading={isVoiding}
      />
    </DetailPageLayout>
  );
}
