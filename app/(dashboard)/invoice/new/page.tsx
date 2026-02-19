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
  Package,
  CheckCircle2,
  AlertTriangle,
  Save,
  Check,
  Square,
  CheckSquare,
  Lock,
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
  InvoiceSummaryPanel,
  type POForInvoice,
  type InvoiceLineItemFormData,
} from "@/components/invoice";
import { formatCurrency, handleQuantityKeyDown } from "@/lib/utils";
import { AmountInput } from "@/components/ui/amount-input";
import { ExchangeRateInput } from "@/components/ui/exchange-rate-input";
import { ConversionRateInput } from "@/components/ui/conversion-rate-input";
import { StandardUnitDisplay } from "@/components/ui/standard-unit-display";
import { calculateAvailableQuantity } from "@/lib/utils/invoice-status";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/use-toast";
import { FormSection, FormField, PageHeader } from "@/components/composite";

// Step configuration - 3 steps now
const STEPS = [
  { id: 1, label: "Select PO", icon: FileText },
  { id: 2, label: "Line Items", icon: Package },
  { id: 3, label: "Summary", icon: CheckCircle2 },
];

function InvoiceCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const preselectedPoId = searchParams.get("po");

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [purchaseOrders, setPurchaseOrders] = useState<POForInvoice[]>([]);

  // Form state - Step 1: PO Selection + Header
  const [selectedPOId, setSelectedPOId] = useState<string>(preselectedPoId || "");
  const [invoiceDate, setInvoiceDate] = useState<Date>(new Date());
  const [currency, setCurrency] = useState("MMK");
  const [exchangeRate, setExchangeRate] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Form state - Step 2: Line Items (with selection, qty, unit price)
  const [lineItems, setLineItems] = useState<InvoiceLineItemFormData[]>([]);
  const [selectedLineItemIds, setSelectedLineItemIds] = useState<string[]>([]);

  useEffect(() => {
    fetchReferenceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When PO is selected, populate all available line items
  useEffect(() => {
    if (selectedPOId) {
      const selectedPO = purchaseOrders.find((po) => po.id === selectedPOId);
      if (selectedPO) {
        const newLineItems: InvoiceLineItemFormData[] = [];

        selectedPO.line_items.forEach((poLineItem) => {
          const availableQty = calculateAvailableQuantity(
            poLineItem.quantity,
            poLineItem.invoiced_quantity ?? 0
          );

          if (availableQty > 0) {
            newLineItems.push({
              id: poLineItem.id, // Use PO line item ID as the form item ID
              po_line_item_id: poLineItem.id,
              item_id: poLineItem.item_id,
              item_name: poLineItem.item_name || poLineItem.item?.name || "Unknown",
              item_sku: poLineItem.item_sku || poLineItem.item?.sku || undefined,
              item_unit: poLineItem.item_unit || undefined,
              quantity: availableQty, // Default to max available
              unit_price: poLineItem.unit_price,
              po_unit_price: poLineItem.unit_price,
              available_quantity: availableQty,
              conversion_rate: "",
              unit_name: (poLineItem.item as any)?.standard_unit_rel?.name || undefined,
            });
          }
        });

        setLineItems(newLineItems);
        // Select all by default
        setSelectedLineItemIds(newLineItems.map((li) => li.id));
      }
    } else {
      setLineItems([]);
      setSelectedLineItemIds([]);
    }
  }, [selectedPOId, purchaseOrders]);

  const fetchReferenceData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch POs that can accept invoices (not closed/cancelled) with standard units
    const { data: posData } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers(id, name, company_name),
        line_items:po_line_items(
          *,
          item:items!po_line_items_item_id_fkey(id, name, sku, standard_unit_rel:standard_units!items_standard_unit_id_fkey(name))
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

  // Get selected line items only
  const selectedItems = useMemo(() => {
    return lineItems.filter((li) => selectedLineItemIds.includes(li.id));
  }, [lineItems, selectedLineItemIds]);

  // Validation - only check selected items
  const hasQuantityErrors = selectedItems.some(
    (li) => li.quantity > li.available_quantity || li.quantity <= 0
  );

  const hasConversionRateErrors = selectedItems.some(
    (li) => !li.conversion_rate || parseFloat(li.conversion_rate) <= 0
  );

  // Step validation - now 3 steps
  const canProceed = (step: number) => {
    switch (step) {
      case 1:
        return selectedPOId && currency && (parseFloat(exchangeRate) || 1) > 0;
      case 2:
        return selectedLineItemIds.length > 0 && !hasQuantityErrors && !hasConversionRateErrors;
      case 3:
        return true;
      default:
        return false;
    }
  };

  // Handle currency change - auto-set USD rate to 1.0 per database constraint
  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    if (value === 'USD') {
      setExchangeRate('1');
    }
  };

  // Handlers
  const handleSelectPO = (poId: string) => {
    if (poId !== selectedPOId) {
      setSelectedPOId(poId);
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
    if (selectedLineItemIds.length === lineItems.length) {
      setSelectedLineItemIds([]);
    } else {
      setSelectedLineItemIds(lineItems.map((li) => li.id));
    }
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
    if (currentStep < 3 && canProceed(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!user || hasQuantityErrors || selectedItems.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          po_id: selectedPOId,
          invoice_date: invoiceDate.toISOString().split("T")[0],
          currency,
          exchange_rate: parseFloat(exchangeRate) || 1,
          notes: notes || null,
          status: "draft",
          created_by: user.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items - only selected items
      const lineItemsToInsert = selectedItems.map((li) => ({
        invoice_id: invoiceData.id,
        po_line_item_id: li.po_line_item_id,
        item_id: li.item_id,
        quantity: li.quantity,
        unit_price: li.unit_price,
        conversion_rate: parseFloat(li.conversion_rate) || 1,
        item_name: li.item_name,
        item_sku: li.item_sku || null,
        item_unit: li.item_unit || null,
        po_unit_price: li.po_unit_price,
      }));

      const { error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) throw lineItemsError;

      // Show success message
      toast({
        title: "Invoice Created",
        description: `Invoice ${invoiceData.invoice_number} has been created successfully.`,
        variant: "success",
      });

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
      <div className="relative flex items-start gap-4 animate-fade-in">
        <Link href="/invoice">
          <Button
            variant="ghost"
            size="icon"
            className="mt-1 hover:bg-amber-500/10 hover:text-amber-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <PageHeader
            title="Create Invoice"
            description="Create an invoice from a Purchase Order"
            badge={
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 w-fit">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
                  New Invoice
                </span>
              </div>
            }
          />
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
        {/* Step 1: Select PO + Header */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* PO Selection */}
            <FormSection
              title={
                <span className="flex items-center gap-2">
                  Select Purchase Order
                  {preselectedPoId && (
                    <span className="flex items-center gap-1 text-xs text-amber-500 font-normal">
                      <Lock className="h-3 w-3" />
                      Inherited
                    </span>
                  )}
                </span>
              }
              icon={<FileText className="h-4 w-4 text-amber-500" />}
            >
              {preselectedPoId && (
                <p className="text-xs text-slate-400 mb-3">
                  PO is inherited from the parent detail page
                </p>
              )}

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
                <div className="space-y-3">
                  {purchaseOrders.map((po) => {
                    const isSelected = selectedPOId === po.id;
                    const availableItems = po.line_items.filter(
                      (li) => (li.quantity - (li.invoiced_quantity ?? 0)) > 0
                    ).length;

                    return (
                      <div
                        key={po.id}
                        onClick={() => !preselectedPoId && handleSelectPO(po.id)}
                        className={`p-4 rounded-lg border transition-all ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500/50"
                            : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                        } ${preselectedPoId ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? "border-amber-500 bg-amber-500"
                                  : "border-slate-500"
                              }`}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div>
                              <code className="text-amber-400 font-semibold">
                                {po.po_number}
                              </code>
                              <p className="text-sm text-slate-400">
                                {po.supplier?.company_name || po.supplier?.name || "No supplier"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-slate-300">
                              {availableItems} items available
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatCurrency(po.total_amount ?? 0)} {po.currency}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </FormSection>

            {/* Invoice Header - Only show if PO selected */}
            {selectedPOId && (
              <FormSection
                title="Invoice Details"
                icon={<CalendarDays className="h-4 w-4 text-amber-500" />}
              >

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField label="Invoice Date" required>
                    <DatePicker
                      date={invoiceDate}
                      onDateChange={(date) => date && setInvoiceDate(date)}
                    />
                  </FormField>

                  <FormField label="Currency" required>
                    <Select value={currency} onValueChange={handleCurrencyChange}>
                      <SelectTrigger className="bg-slate-800/50 border-slate-700">
                        <SelectValue placeholder="Select currency..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MMK">MMK</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="CNY">CNY</SelectItem>
                        <SelectItem value="THB">THB</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label="Exchange Rate (to EUSD)" required>
                    <ExchangeRateInput
                      value={exchangeRate}
                      onValueChange={setExchangeRate}
                      disabled={currency === 'USD'}
                      className="bg-slate-800/50 border-slate-700"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {currency === 'USD' ? 'USD rate is always 1.0' : `1 EUSD = ${exchangeRate || '1'} ${currency}`}
                    </p>
                  </FormField>
                </div>

                <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                  <p className="text-sm text-blue-400">
                    <strong>Note:</strong> Invoice currency and exchange rate can
                    differ from the PO if the actual invoice values are different.
                  </p>
                </div>
              </FormSection>
            )}
          </div>
        )}

        {/* Step 2: Line Items with Multi-select */}
        {currentStep === 2 && (
          <FormSection
            title="Select Line Items"
            icon={<Package className="h-4 w-4 text-amber-500" />}
          >

            <p className="text-sm text-slate-400">
              Select items to include in this invoice and adjust quantities and prices as needed.
            </p>

            {/* Select All */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <button
                type="button"
                onClick={handleSelectAllLineItems}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-amber-400 transition-colors"
              >
                {selectedLineItemIds.length === lineItems.length ? (
                  <CheckSquare className="h-5 w-5 text-amber-500" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
                Select All ({lineItems.length} items)
              </button>
              <span className="text-sm text-slate-400">
                {selectedLineItemIds.length} of {lineItems.length} selected
              </span>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              {lineItems.map((item) => {
                const isSelected = selectedLineItemIds.includes(item.id);
                const hasError = isSelected && (item.quantity > item.available_quantity || item.quantity <= 0);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border transition-all ${
                      isSelected
                        ? hasError
                          ? "bg-red-500/10 border-red-500/50"
                          : "bg-slate-800/50 border-amber-500/30"
                        : "bg-slate-900/50 border-slate-700/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleLineItem(item.id)}
                        className="mt-1"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-500" />
                        )}
                      </button>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <div>
                          <div>
                            <p className="font-medium text-slate-200">{item.item_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {item.item_sku && (
                                <code className="text-xs text-amber-400">{item.item_sku}</code>
                              )}
                              {item.item_unit && parseFloat(item.conversion_rate) !== 1 && parseFloat(item.conversion_rate) > 0 && (
                                <span className="text-xs text-slate-500">Unit: {item.item_unit}</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Available: <span className="font-mono text-emerald-400">{item.available_quantity}</span>
                              {" · "}PO Price: <span className="font-mono">{formatCurrency(item.po_unit_price)}</span>
                            </p>
                          </div>

                          {/* Quantity & Price Inputs - 2nd row */}
                          {isSelected && (
                            <div className="flex items-end gap-3 mt-3 pt-3 border-t border-slate-700/50">
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Qty</label>
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.quantity === 0 ? "" : item.quantity}
                                  onChange={(e) =>
                                    handleUpdateLineItem(item.id, "quantity", parseInt(e.target.value) || 0)
                                  }
                                  onKeyDown={handleQuantityKeyDown}
                                  className={`w-20 text-right font-mono bg-slate-800 border-slate-700 ${
                                    hasError ? "border-red-500" : ""
                                  }`}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Unit Price</label>
                                <AmountInput
                                  value={item.unit_price === 0 ? "" : String(item.unit_price)}
                                  onValueChange={(val) =>
                                    handleUpdateLineItem(item.id, "unit_price", parseFloat(val) || 0)
                                  }
                                  className="w-28 text-right bg-slate-800 border-slate-700"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Conv. Rate</label>
                                <ConversionRateInput
                                  value={item.conversion_rate}
                                  onValueChange={(val) => handleUpdateLineItem(item.id, "conversion_rate", val)}
                                  className="w-24 text-right bg-slate-800 border-slate-700"
                                />
                              </div>
                              {item.conversion_rate && parseFloat(item.conversion_rate) !== 1 && parseFloat(item.conversion_rate) > 0 && item.quantity > 0 && item.unit_name && (
                                <div className="pb-2">
                                  <span className="text-xs font-mono text-slate-400">
                                    = {(item.quantity * parseFloat(item.conversion_rate)).toLocaleString(undefined, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    {item.unit_name}
                                  </span>
                                </div>
                              )}
                              <div className="ml-auto text-right">
                                <label className="text-xs text-slate-500 block mb-1">Total</label>
                                <div className="py-2 px-3 font-mono text-emerald-400">
                                  {formatCurrency(item.quantity * item.unit_price)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-end pt-4 border-t border-slate-700">
              <div className="text-right">
                <p className="text-sm text-slate-400">Total ({selectedItems.length} items)</p>
                <p className="text-xl font-mono font-bold text-emerald-400">
                  {formatCurrency(selectedItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0))} {currency}
                </p>
              </div>
            </div>

            {(hasQuantityErrors || hasConversionRateErrors) && (
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  <p className="text-sm text-red-400">
                    {hasQuantityErrors && "Some quantities exceed available amounts or are invalid. "}
                    {hasConversionRateErrors && "Conversion rate is required for all items. "}
                    Please correct before proceeding.
                  </p>
                </div>
              </div>
            )}
          </FormSection>
        )}

        {/* Step 3: Summary */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Invoice Details */}
              <div className="lg:col-span-2 space-y-6">
                <FormSection
                  title="Invoice Details"
                  icon={<FileText className="h-4 w-4 text-amber-500" />}
                >

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
                        {(parseFloat(exchangeRate) || 1).toFixed(4)}
                      </p>
                    </div>
                  </div>
                </FormSection>

                {/* Line Items Summary */}
                <FormSection
                  title={`Line Items (${selectedItems.length})`}
                  icon={<Package className="h-4 w-4 text-amber-500" />}
                >

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
                        <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-24">
                          Conv. Rate
                        </th>
                        <th className="text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 w-28">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((li) => (
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
                          <td className="py-2 px-3 text-right">
                            <StandardUnitDisplay
                              quantity={li.quantity}
                              conversionRate={parseFloat(li.conversion_rate) || 1}
                              unitName={li.unit_name}
                              size="sm"
                              align="right"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {formatCurrency(li.unit_price)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {(parseFloat(li.conversion_rate) || 1).toFixed(4)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-400">
                            {formatCurrency(li.quantity * li.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </FormSection>

                {/* Notes */}
                <FormSection
                  title="Notes"
                  icon={<CalendarDays className="h-4 w-4 text-amber-500" />}
                >

                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes for this invoice..."
                    className="bg-slate-800/50 border-slate-700 min-h-[80px]"
                  />
                </FormSection>
              </div>

              {/* Summary Panel */}
              <div>
                <InvoiceSummaryPanel
                  totalAmount={selectedItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0)}
                  currency={currency}
                  exchangeRate={parseFloat(exchangeRate) || 1}
                  itemCount={selectedItems.length}
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

          {currentStep < 3 ? (
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
              disabled={isSubmitting || hasQuantityErrors || selectedItems.length === 0}
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
