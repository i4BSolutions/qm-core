"use client";

import { useEffect, useState } from "react";
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
  Edit,
  Ban,
  Clock,
  Package,
  ExternalLink,
  ArrowRightLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InvoiceStatusBadge,
  ReadonlyInvoiceLineItemsTable,
  VoidInvoiceDialog,
} from "@/components/invoice";
import { formatCurrency } from "@/lib/utils";
import {
  canVoidInvoice,
  canEditInvoice,
  formatExchangeRate,
} from "@/lib/utils/invoice-status";
import { useAuth } from "@/components/providers/auth-provider";
import type {
  Invoice,
  InvoiceLineItem,
  PurchaseOrder,
  Supplier,
  User as UserType,
  Item,
  InvoiceStatus,
} from "@/types/database";

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
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      fetchData();
    }
  }, [invoiceId]);

  const fetchData = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
      return;
    }

    setInvoice(invoiceData as unknown as InvoiceWithRelations);

    // Fetch line items
    const { data: lineItemsData } = await supabase
      .from("invoice_line_items")
      .select(`
        *,
        item:items(id, name, sku)
      `)
      .eq("invoice_id", invoiceId)
      .eq("is_active", true)
      .order("created_at");

    if (lineItemsData) {
      setLineItems(lineItemsData as InvoiceLineItemWithItem[]);
    }

    setIsLoading(false);
  };

  const handleVoid = async (reason: string) => {
    if (!invoice || !user) return;

    setIsVoiding(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("invoices")
      .update({
        is_voided: true,
        void_reason: reason,
        voided_by: user.id,
        status: "voided",
      })
      .eq("id", invoiceId);

    if (error) {
      console.error("Error voiding invoice:", error);
      throw new Error("Failed to void invoice");
    }

    setIsVoiding(false);
    setShowVoidDialog(false);
    fetchData();
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

  const showVoidButton = canVoidInvoice(
    invoice.status as InvoiceStatus,
    invoice.is_voided ?? false
  );
  const showEditButton = canEditInvoice(
    invoice.status as InvoiceStatus,
    invoice.is_voided ?? false
  );

  return (
    <div className="space-y-6 relative">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Header */}
      <div className="relative flex items-start justify-between animate-fade-in">
        <div className="flex items-start gap-4">
          <Link href="/invoice">
            <Button
              variant="ghost"
              size="icon"
              className="mt-1 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
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
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showVoidButton && (
            <Button
              variant="outline"
              onClick={() => setShowVoidDialog(true)}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Ban className="mr-2 h-4 w-4" />
              Void Invoice
            </Button>
          )}
          {showEditButton && (
            <Link href={`/invoice/${invoiceId}/edit`}>
              <Button
                variant="outline"
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Voided Warning */}
      {invoice.is_voided && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 animate-slide-up">
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

      {/* Financial Summary Panel */}
      <div
        className="command-panel corner-accents animate-slide-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="grid grid-cols-4 gap-4">
          {/* Total Amount */}
          <div className="text-center p-4 rounded-lg bg-slate-800/30 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
              Invoice Total
            </p>
            <p className="text-xl font-mono font-bold text-slate-200">
              {formatCurrency(invoice.total_amount ?? 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {invoice.currency || "MMK"}
            </p>
          </div>

          {/* Total EUSD */}
          <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2">
              Total (EUSD)
            </p>
            <p className="text-xl font-mono font-bold text-emerald-400">
              {formatCurrency(invoice.total_amount_eusd ?? 0)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Rate: {formatExchangeRate(invoice.exchange_rate ?? 1)}
            </p>
          </div>

          {/* Line Items */}
          <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">
              Line Items
            </p>
            <p className="text-xl font-mono font-bold text-amber-400">
              {lineItems.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">items</p>
          </div>

          {/* Invoice Date */}
          <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">
              Invoice Date
            </p>
            <p className="text-lg font-medium text-blue-400">
              {formatDate(invoice.invoice_date)}
            </p>
            {invoice.due_date && (
              <p className="text-xs text-slate-400 mt-1">
                Due: {formatDate(invoice.due_date)}
              </p>
            )}
          </div>
        </div>
      </div>

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
            Stock Receipts
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
                <div className="grid grid-cols-2 gap-4">
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
                      Due Date
                    </p>
                    <p className="text-slate-200">
                      {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Received Date
                    </p>
                    <p className="text-slate-200">
                      {formatDate(invoice.received_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Supplier Ref
                    </p>
                    <p className="text-slate-200">
                      {invoice.supplier_invoice_no || "—"}
                    </p>
                  </div>
                </div>

                <div className="divider-accent" />

                <div className="grid grid-cols-2 gap-4">
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
            <div className="section-header">
              <Package className="h-4 w-4 text-amber-500" />
              <h2>Stock Receipts</h2>
            </div>

            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                Stock In Coming Soon
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                Stock receipts linked to this invoice will be displayed here once
                the Inventory module is implemented (Iteration 9).
              </p>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Clock className="h-4 w-4 text-amber-500" />
              <h2>Activity History</h2>
            </div>

            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                Audit Log Coming Soon
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                Activity history and audit trail will be available in a future
                update (Iteration 10).
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Void Dialog */}
      <VoidInvoiceDialog
        open={showVoidDialog}
        onOpenChange={setShowVoidDialog}
        invoiceNumber={invoice.invoice_number || ""}
        onConfirm={handleVoid}
        isLoading={isVoiding}
      />
    </div>
  );
}
