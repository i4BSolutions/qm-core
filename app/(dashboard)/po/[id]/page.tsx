"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShoppingCart,
  Building2,
  CalendarDays,
  DollarSign,
  AlertTriangle,
  Edit,
  XCircle,
  Clock,
  FileText,
  ExternalLink,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POStatusBadge, ApprovalStatusBadge } from "@/components/po/po-status-badge";
import { POProgressBar } from "@/components/po/po-progress-bar";
import { ReadonlyLineItemsTable } from "@/components/po/po-line-items-table";
import { InvoiceStatusBadge } from "@/components/invoice";
import { formatCurrency } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { canCreateInvoice } from "@/lib/utils/po-status";
import { calculatePOProgress, canEditPO, canCancelPO } from "@/lib/utils/po-status";
import { HistoryTab } from "@/components/history";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { CommentsSection } from "@/components/comments";
import { DetailPageLayout } from "@/components/composite";
import type {
  PurchaseOrder,
  POLineItem,
  Supplier,
  QMHQ,
  User as UserType,
  Item,
  POStatusEnum,
  Invoice,
  InvoiceStatus,
} from "@/types/database";

// Extended types
interface POWithRelations extends PurchaseOrder {
  supplier?: Supplier | null;
  qmhq?: Pick<QMHQ, "id" | "request_id" | "line_name" | "amount_eusd"> | null;
  created_by_user?: Pick<UserType, "id" | "full_name"> | null;
  updated_by_user?: Pick<UserType, "id" | "full_name"> | null;
}

interface POLineItemWithItem extends POLineItem {
  item?: Pick<Item, "id" | "name" | "sku"> | null;
}

interface InvoiceForPO extends Invoice {
  line_items_count?: number;
}

export default function PODetailPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = usePermissions();
  const poId = params.id as string;

  const [po, setPO] = useState<POWithRelations | null>(null);
  const [lineItems, setLineItems] = useState<POLineItemWithItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceForPO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch PO with relations
    const { data: poData, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers(*),
        qmhq:qmhq!purchase_orders_qmhq_id_fkey(id, request_id, line_name, amount_eusd),
        created_by_user:users!purchase_orders_created_by_fkey(id, full_name),
        updated_by_user:users!purchase_orders_updated_by_fkey(id, full_name)
      `)
      .eq("id", poId)
      .single();

    if (poError) {
      console.error("Error fetching PO:", poError);
      setIsLoading(false);
      return;
    }

    setPO(poData as unknown as POWithRelations);

    // Fetch line items
    const { data: lineItemsData } = await supabase
      .from("po_line_items")
      .select(`
        *,
        item:items(id, name, sku)
      `)
      .eq("po_id", poId)
      .eq("is_active", true)
      .order("created_at");

    if (lineItemsData) {
      setLineItems(lineItemsData as POLineItemWithItem[]);
    }

    // Fetch invoices for this PO
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("*")
      .eq("po_id", poId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (invoicesData) {
      setInvoices(invoicesData as InvoiceForPO[]);
    }

    setIsLoading(false);
  }, [poId]);

  useEffect(() => {
    if (poId) {
      fetchData();
    }
  }, [poId, fetchData]);

  const handleCancelPO = async () => {
    if (!po || !canCancelPO(po.status as POStatusEnum)) return;

    const confirmed = window.confirm("Are you sure you want to cancel this Purchase Order? This action cannot be undone.");
    if (!confirmed) return;

    setIsCancelling(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "cancelled" })
      .eq("id", poId);

    if (error) {
      console.error("Error cancelling PO:", error);
      alert("Failed to cancel Purchase Order");
    } else {
      fetchData();
    }

    setIsCancelling(false);
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

  // Calculate progress
  const totalQty = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const invoicedQty = lineItems.reduce((sum, li) => sum + (li.invoiced_quantity ?? 0), 0);
  const receivedQty = lineItems.reduce((sum, li) => sum + (li.received_quantity ?? 0), 0);
  const progress = calculatePOProgress(totalQty, invoicedQty, receivedQty);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading PO data...
          </p>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-200">Purchase Order Not Found</h2>
        <p className="text-slate-400">The requested PO could not be found.</p>
        <Link href="/po">
          <Button variant="outline" className="border-slate-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to PO List
          </Button>
        </Link>
      </div>
    );
  }

  // Admin and QMHQ can edit PO (per 3-role permission matrix)
  const showEditButton = can("update", "purchase_orders") && canEditPO(po.status as POStatusEnum);
  const showCancelButton = canCancelPO(po.status as POStatusEnum);

  return (
    <DetailPageLayout
      backHref="/po"
      header={
        <div>
          {/* Status Badges */}
          <div className="flex items-center gap-3 mb-2">
            <POStatusBadge status={(po.status || "not_started") as POStatusEnum} />
            <ApprovalStatusBadge status={po.approval_status || "draft"} />
          </div>

          {/* PO Number */}
          <div className="request-id-badge mb-2">
            <code className="text-lg">{po.po_number}</code>
          </div>

          {/* Supplier */}
          {po.supplier && (
            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              {po.supplier.company_name || po.supplier.name}
            </h1>
          )}

          {/* Parent QMHQ Link */}
          {po.qmhq && (
            <Link href={`/qmhq/${po.qmhq.id}`} className="inline-flex items-center gap-2 mt-2 text-sm text-slate-400 hover:text-amber-400 transition-colors">
              <span>From:</span>
              <code className="text-amber-400">{po.qmhq.request_id}</code>
              <span className="truncate max-w-[200px]">{po.qmhq.line_name}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      }
      actions={
        <>
          {showCancelButton && (
            <Button
              variant="outline"
              onClick={handleCancelPO}
              disabled={isCancelling}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              {isCancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Cancel PO
            </Button>
          )}
          {showEditButton && (
            <Link href={`/po/${poId}/edit`}>
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
                <Edit className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Edit</span>
              </Button>
            </Link>
          )}
        </>
      }
      kpiPanel={
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="grid grid-cols-3 gap-4">
          {/* Total Amount with EUSD */}
          <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">PO Total</p>
            <CurrencyDisplay
              amount={po.total_amount}
              currency={po.currency || "MMK"}
              amountEusd={po.total_amount_eusd}
              size="lg"
            />
            <p className="text-xs text-slate-400 mt-2">Rate: {po.exchange_rate ?? 1}</p>
          </div>

          {/* Invoiced Progress */}
          <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">Invoiced</p>
            <p className="text-xl font-mono font-bold text-amber-400">
              {progress.invoicedPercent}%
            </p>
            <p className="text-xs text-slate-400 mt-1">{invoicedQty} / {totalQty} units</p>
          </div>

          {/* Received Progress */}
          <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <p className="text-xs text-purple-400 uppercase tracking-wider mb-2">Received</p>
            <p className="text-xl font-mono font-bold text-purple-400">
              {progress.receivedPercent}%
            </p>
            <p className="text-xs text-slate-400 mt-1">{receivedQty} / {totalQty} units</p>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="mt-4">
          <POProgressBar
            invoicedPercent={progress.invoicedPercent}
            receivedPercent={progress.receivedPercent}
            showLabels={true}
          />
        </div>
        </div>
      }
    >
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-up" style={{ animationDelay: "200ms" }}>
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="details" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            Details
          </TabsTrigger>
          <TabsTrigger value="line-items" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            Line Items ({lineItems.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
            History
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* PO Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <FileText className="h-4 w-4 text-amber-500" />
                <h2>PO Information</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PO Date</p>
                    <p className="text-slate-200">{formatDate(po.po_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Expected Delivery</p>
                    <p className="text-slate-200">{formatDate(po.expected_delivery_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Currency</p>
                    <p className="text-slate-200">{po.currency || "MMK"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Exchange Rate</p>
                    <p className="text-slate-200 font-mono">{po.exchange_rate ?? 1}</p>
                  </div>
                </div>

                {po.notes && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-slate-300">{po.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Supplier Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <Building2 className="h-4 w-4 text-amber-500" />
                <h2>Supplier</h2>
              </div>

              {po.supplier ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium">
                        {po.supplier.company_name || po.supplier.name}
                      </p>
                      {po.supplier.company_name && (
                        <p className="text-sm text-slate-400">{po.supplier.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {po.supplier.email && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Email</p>
                        <p className="text-slate-300">{po.supplier.email}</p>
                      </div>
                    )}
                    {po.supplier.phone && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Phone</p>
                        <p className="text-slate-300">{po.supplier.phone}</p>
                      </div>
                    )}
                  </div>

                  {po.supplier.address && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Address</p>
                      <p className="text-slate-300">{po.supplier.address}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400">No supplier selected</p>
              )}
            </div>

            {/* Signer Info */}
            <div className="command-panel corner-accents">
              <div className="section-header">
                <FileText className="h-4 w-4 text-amber-500" />
                <h2>Signers</h2>
              </div>

              <div className="space-y-3">
                {po.contact_person_name && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Contact Person</p>
                    <p className="text-slate-200">{po.contact_person_name}</p>
                  </div>
                )}
                {po.sign_person_name && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Sign Person</p>
                    <p className="text-slate-200">{po.sign_person_name}</p>
                  </div>
                )}
                {po.authorized_signer_name && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Authorized Signer</p>
                    <p className="text-slate-200">{po.authorized_signer_name}</p>
                  </div>
                )}
                {!po.contact_person_name && !po.sign_person_name && !po.authorized_signer_name && (
                  <p className="text-slate-400">No signer information</p>
                )}
              </div>
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
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Created</p>
                    <p className="text-slate-200">{formatDateTime(po.created_at)}</p>
                    {po.created_by_user && (
                      <p className="text-xs text-slate-400">by {po.created_by_user.full_name}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Last Updated</p>
                    <p className="text-slate-200">{formatDateTime(po.updated_at)}</p>
                    {po.updated_by_user && (
                      <p className="text-xs text-slate-400">by {po.updated_by_user.full_name}</p>
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
              <ShoppingCart className="h-4 w-4 text-amber-500" />
              <h2>Line Items</h2>
            </div>

            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <ShoppingCart className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">No Line Items</h3>
                <p className="text-sm text-slate-400">This PO has no line items.</p>
              </div>
            ) : (
              <ReadonlyLineItemsTable
                items={lineItems}
                currency={po.currency || "MMK"}
                showProgress={true}
              />
            )}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <FileText className="h-4 w-4 text-amber-500" />
              <h2>Invoices</h2>
              {canCreateInvoice((po?.status || "not_started") as POStatusEnum) && (
                <Link href={`/invoice/new?po=${poId}`} className="ml-auto">
                  <Button size="sm" variant="outline" className="border-slate-700 text-slate-300">
                    <FileText className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                </Link>
              )}
            </div>

            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">No Invoices Yet</h3>
                <p className="text-sm text-slate-400 max-w-md mb-4">
                  No invoices have been created for this PO.
                </p>
                {canCreateInvoice((po?.status || "not_started") as POStatusEnum) && (
                  <Link href={`/invoice/new?po=${poId}`}>
                    <Button variant="outline" className="border-slate-700">
                      <FileText className="mr-2 h-4 w-4" />
                      Create First Invoice
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
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
                    {invoices.map((inv) => (
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
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <HistoryTab entityType="purchase_orders" entityId={poId} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Comments Section */}
      <CommentsSection entityType="po" entityId={poId} />
    </DetailPageLayout>
  );
}
