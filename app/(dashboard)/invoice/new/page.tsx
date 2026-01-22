"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  CalendarDays,
  DollarSign,
  Package,
  CheckCircle2,
  AlertTriangle,
  Save,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InvoicePOSelector,
  EditableInvoiceLineItemsTable,
  InvoiceSummaryPanel,
  type POForInvoice,
  type InvoiceLineItemFormData,
} from "@/components/invoice";
import { formatCurrency } from "@/lib/utils";
import { calculateAvailableQuantity } from "@/lib/utils/invoice-status";
import { useAuth } from "@/components/providers/auth-provider";
import type { PurchaseOrder, POLineItem, Supplier, Item } from "@/types/database";

// Step configuration
const STEPS = [
  { id: 1, label: "Header", icon: CalendarDays },
  { id: 2, label: "Select PO", icon: FileText },
  { id: 3, label: "Line Items", icon: Package },
  { id: 4, label: "Summary", icon: CheckCircle2 },
];

function InvoiceCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preselectedPoId = searchParams.get("po");

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [purchaseOrders, setPurchaseOrders] = useState<POForInvoice[]>([]);

  // Form state - Step 1: Header
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [receivedDate, setReceivedDate] = useState<Date | undefined>();
  const [currency, setCurrency] = useState("MMK");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [notes, setNotes] = useState("");

  // Form state - Step 2: PO Selection
  const [selectedPOId, setSelectedPOId] = useState<string>(preselectedPoId || "");
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<string[]>([]);

  // Form state - Step 3: Line Items
  const [lineItems, setLineItems] = useState<InvoiceLineItemFormData[]>([]);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  // When PO is selected, pre-populate line items
  useEffect(() => {
    if (selectedPOId && selectedLineItemIds.length > 0) {
      const selectedPO = purchaseOrders.find((po) => po.id === selectedPOId);
      if (selectedPO) {
        const newLineItems: InvoiceLineItemFormData[] = [];

        selectedLineItemIds.forEach((liId) => {
          const poLineItem = selectedPO.line_items.find((li) => li.id === liId);
          if (!poLineItem) return;

          const availableQty = calculateAvailableQuantity(
            poLineItem.quantity,
            poLineItem.invoiced_quantity ?? 0
          );

          newLineItems.push({
            id: crypto.randomUUID(),
            po_line_item_id: poLineItem.id,
            item_id: poLineItem.item_id,
            item_name: poLineItem.item_name || poLineItem.item?.name || "Unknown",
            item_sku: poLineItem.item_sku || poLineItem.item?.sku || undefined,
            item_unit: poLineItem.item_unit || undefined,
            quantity: availableQty, // Default to max available
            unit_price: poLineItem.unit_price,
            po_unit_price: poLineItem.unit_price,
            available_quantity: availableQty,
          });
        });

        setLineItems(newLineItems);
      }
    } else {
      setLineItems([]);
    }
  }, [selectedPOId, selectedLineItemIds, purchaseOrders]);

  const fetchReferenceData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch POs that can accept invoices (not closed/cancelled)
    const { data: posData } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers(id, name, company_name),
        line_items:po_line_items(
          *,
          item:items(id, name, sku)
        )
      `)
      .eq("is_active", true)
      .not("status", "in", '("closed","cancelled")')
      .order("created_at", { ascending: false });

    if (posData) {
      // Filter to POs with available quantity
      const posWithAvailable = (posData as POForInvoice[]).filter((po) => {
        return po.line_items.some((li) => {
          const available = li.quantity - (li.invoiced_quantity ?? 0);
          return available > 0;
        });
      });
      setPurchaseOrders(posWithAvailable);

      // If preselected PO, select all available items
      if (preselectedPoId) {
        const preselectedPO = posWithAvailable.find((po) => po.id === preselectedPoId);
        if (preselectedPO) {
          const availableItemIds = preselectedPO.line_items
            .filter((li) => (li.quantity - (li.invoiced_quantity ?? 0)) > 0)
            .map((li) => li.id);
          setSelectedLineItemIds(availableItemIds);
        }
      }
    }

    setIsLoading(false);
  };

  // Selected PO info
  const selectedPO = useMemo(() => {
    return purchaseOrders.find((po) => po.id === selectedPOId);
  }, [purchaseOrders, selectedPOId]);

  // Available line items for selected PO
  const availableLineItems = useMemo(() => {
    if (!selectedPO) return [];
    return selectedPO.line_items.filter(
      (li) => (li.quantity - (li.invoiced_quantity ?? 0)) > 0
    );
  }, [selectedPO]);

  // Calculate totals
  const invoiceTotal = useMemo(() => {
    return lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  }, [lineItems]);

  const invoiceTotalEusd = exchangeRate > 0 ? invoiceTotal / exchangeRate : 0;

  // Validation
  const hasQuantityErrors = lineItems.some(
    (li) => li.quantity > li.available_quantity || li.quantity <= 0
  );

  // Step validation
  const canProceed = (step: number) => {
    switch (step) {
      case 1:
        return currency && exchangeRate > 0;
      case 2:
        return selectedPOId && selectedLineItemIds.length > 0;
      case 3:
        return lineItems.length > 0 && !hasQuantityErrors;
      case 4:
        return true;
      default:
        return false;
    }
  };

  // Handlers
  const handleSelectPO = (poId: string) => {
    if (poId !== selectedPOId) {
      setSelectedPOId(poId);
      setSelectedLineItemIds([]);
    }
  };

  const handleToggleLineItem = (lineItemId: string) => {
    setSelectedLineItemIds((prev) =>
      prev.includes(lineItemId)
        ? prev.filter((id) => id !== lineItemId)
        : [...prev, lineItemId]
    );
  };

  const handleSelectAllLineItems = () => {
    if (selectedLineItemIds.length === availableLineItems.length) {
      setSelectedLineItemIds([]);
    } else {
      setSelectedLineItemIds(availableLineItems.map((li) => li.id));
    }
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleUpdateLineItem = (
    id: string,
    field: keyof InvoiceLineItemFormData,
    value: unknown
  ) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li))
    );
  };

  const handleNext = () => {
    if (currentStep < 4 && canProceed(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || hasQuantityErrors || lineItems.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          po_id: selectedPOId,
          supplier_invoice_no: supplierInvoiceNo || null,
          invoice_date: invoiceDate.toISOString().split("T")[0],
          due_date: dueDate?.toISOString().split("T")[0] || null,
          received_date: receivedDate?.toISOString().split("T")[0] || null,
          currency,
          exchange_rate: exchangeRate,
          notes: notes || null,
          status: "draft",
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lineItemsToInsert = lineItems.map((li) => ({
        invoice_id: invoiceData.id,
        po_line_item_id: li.po_line_item_id,
        item_id: li.item_id,
        quantity: li.quantity,
        unit_price: li.unit_price,
        item_name: li.item_name,
        item_sku: li.item_sku || null,
        item_unit: li.item_unit || null,
        po_unit_price: li.po_unit_price,
      }));

      const { error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      // Redirect to invoice detail page
      router.push(`/invoice/${invoiceData.id}`);
    } catch (err) {
      console.error("Error creating invoice:", err);
      setError(err instanceof Error ? err.message : "Failed to create Invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative max-w-4xl mx-auto">
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
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 mb-2 w-fit">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
                New Invoice
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              Create Invoice
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Create an invoice from a Purchase Order
            </p>
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="command-panel">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted
                        ? "bg-emerald-500 border-emerald-500"
                        : isActive
                        ? "bg-amber-500/20 border-amber-500"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? "text-amber-500" : "text-slate-400"
                        }`}
                      />
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-slate-400 uppercase tracking-wider">
                      Step {step.id}
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        isActive ? "text-amber-400" : "text-slate-300"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      isCompleted ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-medium text-red-400">Error</p>
              <p className="text-sm text-red-400/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="animate-slide-up">
        {/* Step 1: Header */}
        {currentStep === 1 && (
          <div className="command-panel corner-accents space-y-6">
            <div className="section-header">
              <CalendarDays className="h-4 w-4 text-amber-500" />
              <h2>Invoice Header</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Supplier Invoice No
                </label>
                <Input
                  value={supplierInvoiceNo}
                  onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                  placeholder="Enter supplier invoice number..."
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Invoice Date *
                </label>
                <DatePicker
                  date={invoiceDate}
                  onDateChange={(date) => date && setInvoiceDate(date)}
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Due Date
                </label>
                <DatePicker
                  date={dueDate}
                  onDateChange={setDueDate}
                  minDate={invoiceDate}
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Received Date
                </label>
                <DatePicker date={receivedDate} onDateChange={setReceivedDate} />
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Currency *
                </label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="Select currency..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MMK">MMK</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="THB">THB</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                  Exchange Rate (to EUSD) *
                </label>
                <Input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) =>
                    setExchangeRate(parseFloat(e.target.value) || 1)
                  }
                  className="bg-slate-800/50 border-slate-700 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
              <p className="text-sm text-blue-400">
                <strong>Note:</strong> Invoice currency and exchange rate are
                independent from the PO. You can use different values if the
                actual invoice differs.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: PO Selection */}
        {currentStep === 2 && (
          <div className="command-panel corner-accents space-y-6">
            <div className="section-header">
              <FileText className="h-4 w-4 text-amber-500" />
              <h2>Select Purchase Order</h2>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  No Purchase Orders Available
                </p>
                <p className="text-sm">
                  There are no open POs with items available for invoicing.
                </p>
                <Link href="/po/new" className="mt-4 inline-block">
                  <Button variant="outline" className="border-slate-700">
                    Create a PO
                  </Button>
                </Link>
              </div>
            ) : (
              <InvoicePOSelector
                purchaseOrders={purchaseOrders}
                selectedPOId={selectedPOId}
                selectedLineItems={selectedLineItemIds}
                onSelectPO={handleSelectPO}
                onToggleLineItem={handleToggleLineItem}
                onSelectAllLineItems={handleSelectAllLineItems}
              />
            )}
          </div>
        )}

        {/* Step 3: Line Items */}
        {currentStep === 3 && (
          <div className="command-panel corner-accents space-y-6">
            <div className="section-header">
              <Package className="h-4 w-4 text-amber-500" />
              <h2>Invoice Line Items</h2>
            </div>

            <EditableInvoiceLineItemsTable
              items={lineItems}
              onRemoveItem={handleRemoveLineItem}
              onUpdateItem={handleUpdateLineItem}
              currency={currency}
            />

            {hasQuantityErrors && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <p className="text-sm text-red-400">
                    Some quantities exceed available amounts. Please correct before proceeding.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Summary */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Invoice Details */}
              <div className="lg:col-span-2 space-y-6">
                <div className="command-panel corner-accents">
                  <div className="section-header">
                    <FileText className="h-4 w-4 text-amber-500" />
                    <h2>Invoice Details</h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        PO Number
                      </p>
                      <code className="text-amber-400">
                        {selectedPO?.po_number}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        Supplier
                      </p>
                      <p className="text-slate-200">
                        {selectedPO?.supplier?.company_name ||
                          selectedPO?.supplier?.name ||
                          "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        Invoice Date
                      </p>
                      <p className="text-slate-200">
                        {invoiceDate.toLocaleDateString()}
                      </p>
                    </div>
                    {supplierInvoiceNo && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider">
                          Supplier Ref
                        </p>
                        <p className="text-slate-200">{supplierInvoiceNo}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        Currency
                      </p>
                      <p className="text-slate-200">{currency}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        Exchange Rate
                      </p>
                      <p className="text-slate-200 font-mono">
                        {exchangeRate.toFixed(4)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Line Items Summary */}
                <div className="command-panel corner-accents">
                  <div className="section-header">
                    <Package className="h-4 w-4 text-amber-500" />
                    <h2>Line Items ({lineItems.length})</h2>
                  </div>

                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Item
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-20">
                          Qty
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-28">
                          Unit Price
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-28">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((li) => (
                        <tr
                          key={li.id}
                          className="border-b border-slate-700/50"
                        >
                          <td className="py-2 px-3">
                            <p className="text-slate-200">{li.item_name}</p>
                            {li.item_sku && (
                              <code className="text-xs text-amber-400">
                                {li.item_sku}
                              </code>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {li.quantity}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatCurrency(li.unit_price)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-400">
                            {formatCurrency(li.quantity * li.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Notes */}
                <div className="command-panel corner-accents">
                  <div className="section-header">
                    <CalendarDays className="h-4 w-4 text-amber-500" />
                    <h2>Notes</h2>
                  </div>

                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes for this invoice..."
                    className="bg-slate-800/50 border-slate-700 min-h-[80px]"
                  />
                </div>
              </div>

              {/* Summary Panel */}
              <div>
                <InvoiceSummaryPanel
                  totalAmount={invoiceTotal}
                  currency={currency}
                  exchangeRate={exchangeRate}
                  itemCount={lineItems.length}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              className="border-slate-700"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Link href="/invoice">
            <Button type="button" variant="ghost" className="text-slate-400">
              Cancel
            </Button>
          </Link>

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed(currentStep)}
              className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || hasQuantityErrors || lineItems.length === 0}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Invoice
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <InvoiceCreateContent />
    </Suspense>
  );
}
