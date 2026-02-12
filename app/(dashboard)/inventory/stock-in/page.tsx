"use client";

import { Suspense, useEffect, useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownToLine,
  Loader2,
  FileText,
  Package,
  AlertTriangle,
  Save,
  Check,
  Warehouse,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Calculator,
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
import { formatCurrency, handleQuantityKeyDown } from "@/lib/utils";
import { AmountInput } from "@/components/ui/amount-input";
import { ExchangeRateInput } from "@/components/ui/exchange-rate-input";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { MOVEMENT_TYPE_CONFIG } from "@/lib/utils/inventory";
import { CategoryItemSelector } from "@/components/forms/category-item-selector";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/use-toast";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import type {
  Invoice,
  InvoiceLineItem,
  Item,
  Warehouse as WarehouseType,
} from "@/types/database";

// Extended types
interface InvoiceWithPO extends Invoice {
  purchase_order?: {
    po_number: string | null;
    supplier?: { name: string; company_name: string | null } | null;
  } | null;
}

interface InvoiceLineItemWithItem extends InvoiceLineItem {
  item?: Pick<Item, "id" | "name" | "sku" | "default_unit"> | null;
}

// Form data for stock in line items
interface StockInLineItem {
  id: string;
  invoice_line_item_id?: string;
  item_id: string;
  item_name: string;
  item_sku?: string;
  item_unit?: string;
  quantity: number;
  max_quantity: number;
  unit_cost: number;
  selected: boolean;
}

type SourceMode = "invoice" | "manual";

// Currency options aligned with database constraint (Phase 8)
const SUPPORTED_CURRENCIES = [
  { value: 'MMK', label: 'MMK - Myanmar Kyat' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'THB', label: 'THB - Thai Baht' },
];

function StockInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const preselectedInvoiceId = searchParams.get("invoice");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mode selection
  const [sourceMode, setSourceMode] = useState<SourceMode>(
    preselectedInvoiceId ? "invoice" : "manual"
  );

  // Reference data
  const [invoices, setInvoices] = useState<InvoiceWithPO[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  // Invoice mode state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    preselectedInvoiceId || ""
  );
  const [invoiceLineItems, setInvoiceLineItems] = useState<
    InvoiceLineItemWithItem[]
  >([]);
  const [stockInLines, setStockInLines] = useState<StockInLineItem[]>([]);

  // Manual mode state
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [manualItemId, setManualItemId] = useState("");
  const [manualQuantity, setManualQuantity] = useState<string>("");
  const [manualUnitCost, setManualUnitCost] = useState<string>("");

  // Currency and exchange rate for manual mode
  const [currency, setCurrency] = useState('MMK');
  const [exchangeRate, setExchangeRate] = useState('1');

  // Common form state
  const [warehouseId, setWarehouseId] = useState("");
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");

  const fetchReferenceData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch invoices with available items for stock in
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select(
        `
        *,
        purchase_order:purchase_orders!invoices_po_id_fkey(
          po_number,
          supplier:suppliers(name, company_name)
        )
      `
      )
      .eq("is_active", true)
      .eq("is_voided", false)
      .order("created_at", { ascending: false });

    if (invoicesData) {
      setInvoices(invoicesData as InvoiceWithPO[]);
    }

    // Fetch items
    const { data: itemsData } = await supabase
      .from("items")
      .select("id, name, sku, default_unit, wac_amount, wac_currency")
      .eq("is_active", true)
      .order("name");

    if (itemsData) {
      setItems(itemsData as Item[]);
    }

    // Fetch warehouses
    const { data: warehousesData } = await supabase
      .from("warehouses")
      .select("id, name, location")
      .eq("is_active", true)
      .order("name");

    if (warehousesData) {
      setWarehouses(warehousesData as WarehouseType[]);
    }

    setIsLoading(false);
  }, []);

  const fetchInvoiceLineItems = useCallback(async (invoiceId: string) => {
    const supabase = createClient();

    const { data } = await supabase
      .from("invoice_line_items")
      .select(
        `
        *,
        item:items(id, name, sku, default_unit)
      `
      )
      .eq("invoice_id", invoiceId)
      .eq("is_active", true);

    if (data) {
      setInvoiceLineItems(data as InvoiceLineItemWithItem[]);

      // Create stock in line items from invoice line items
      // Filter out lines without valid item_id (required for inventory)
      const lines: StockInLineItem[] = data
        .filter((li) => li.item_id) // Must have item_id for inventory
        .map((li) => {
          const availableQty = Math.max(
            0,
            (li.quantity ?? 0) - (li.received_quantity ?? 0)
          );
          return {
            id: li.id,
            invoice_line_item_id: li.id,
            item_id: li.item_id!,
            item_name: li.item_name || li.item?.name || "Unknown",
            item_sku: li.item_sku || li.item?.sku || undefined,
            item_unit: li.item_unit || li.item?.default_unit || undefined,
            quantity: availableQty,
            max_quantity: availableQty,
            unit_cost: li.unit_price ?? 0,
            selected: availableQty > 0,
          };
        });

      setStockInLines(lines);
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  // Fetch invoice line items when invoice is selected
  useEffect(() => {
    if (selectedInvoiceId && sourceMode === "invoice") {
      fetchInvoiceLineItems(selectedInvoiceId);
    }
  }, [selectedInvoiceId, sourceMode, fetchInvoiceLineItems]);

  // Selected invoice details
  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId);
  }, [invoices, selectedInvoiceId]);

  // Selected items for invoice mode (must have valid item_id)
  const selectedStockInLines = useMemo(() => {
    return stockInLines.filter(
      (line) => line.selected && line.quantity > 0 && line.item_id
    );
  }, [stockInLines]);

  // Selected manual item
  const selectedManualItem = useMemo(() => {
    return items.find((item) => item.id === manualItemId);
  }, [items, manualItemId]);

  // Calculate EUSD for manual mode in real-time
  const calculatedEusd = useMemo(() => {
    const cost = parseFloat(manualUnitCost) || 0;
    const qty = parseFloat(manualQuantity) || 0;
    const rate = parseFloat(exchangeRate) || 1;
    const totalValue = cost * qty;
    if (rate <= 0) return 0;
    return Math.round((totalValue / rate) * 100) / 100;
  }, [manualUnitCost, manualQuantity, exchangeRate]);

  // Total value for display
  const manualTotalValue = useMemo(() => {
    return (parseFloat(manualQuantity) || 0) * (parseFloat(manualUnitCost) || 0);
  }, [manualQuantity, manualUnitCost]);

  // Summary totals for both modes
  const summaryTotals = useMemo(() => {
    if (sourceMode === "invoice") {
      const totalValue = selectedStockInLines.reduce(
        (sum, line) => sum + line.quantity * line.unit_cost,
        0
      );
      const rate = selectedInvoice?.exchange_rate || 1;
      const eusdValue = rate > 0 ? totalValue / rate : 0;
      return {
        currency: selectedInvoice?.currency || "MMK",
        totalValue,
        eusdValue: Math.round(eusdValue * 100) / 100,
        exchangeRate: rate,
      };
    } else {
      const rate = parseFloat(exchangeRate) || 1;
      return {
        currency,
        totalValue: manualTotalValue,
        eusdValue: calculatedEusd,
        exchangeRate: rate,
      };
    }
  }, [sourceMode, selectedStockInLines, selectedInvoice, currency, exchangeRate, manualTotalValue, calculatedEusd]);

  // Validation
  const hasErrors = useMemo(() => {
    if (sourceMode === "invoice") {
      return (
        !warehouseId ||
        selectedStockInLines.length === 0 ||
        selectedStockInLines.some(
          (line) => line.quantity > line.max_quantity || line.quantity <= 0
        )
      );
    } else {
      const qty = parseFloat(manualQuantity) || 0;
      const cost = parseFloat(manualUnitCost) || 0;
      return (
        !warehouseId ||
        !manualItemId ||
        qty <= 0 ||
        cost <= 0
      );
    }
  }, [
    sourceMode,
    warehouseId,
    selectedStockInLines,
    manualItemId,
    manualQuantity,
    manualUnitCost,
  ]);

  // Handlers
  const handleToggleLine = (lineId: string) => {
    setStockInLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, selected: !line.selected } : line
      )
    );
  };

  const handleSelectAll = () => {
    const allSelected = stockInLines.every(
      (line) => line.selected || line.max_quantity === 0
    );
    setStockInLines((prev) =>
      prev.map((line) => ({
        ...line,
        selected: line.max_quantity > 0 ? !allSelected : false,
      }))
    );
  };

  const handleUpdateLineQuantity = (lineId: string, quantity: number) => {
    setStockInLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, quantity: Math.max(0, quantity) } : line
      )
    );
  };

  const handleUpdateLineUnitCost = (lineId: string, unitCost: number) => {
    setStockInLines((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? { ...line, unit_cost: Math.max(0, unitCost) }
          : line
      )
    );
  };

  // Handle currency change - auto-set USD rate to 1.0 per database constraint
  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    if (value === 'USD') {
      setExchangeRate('1');
    }
  };

  const handleSubmit = async () => {
    if (!user || hasErrors) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      if (sourceMode === "invoice" && selectedInvoice) {
        // Create multiple transactions for invoice line items
        // Use invoice's currency and exchange rate
        const transactions = selectedStockInLines.map((line) => ({
          movement_type: "inventory_in" as const,
          item_id: line.item_id,
          warehouse_id: warehouseId,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
          currency: selectedInvoice.currency || "MMK",
          exchange_rate: selectedInvoice.exchange_rate || 1,
          invoice_id: selectedInvoiceId,
          invoice_line_item_id: line.invoice_line_item_id,
          transaction_date: transactionDate.toISOString().split("T")[0],
          notes: notes || null,
          status: "completed" as const,
          created_by: user.id,
        }));

        const { error: insertError } = await supabase
          .from("inventory_transactions")
          .insert(transactions);

        if (insertError) throw insertError;

        toast({
          title: "Stock In Recorded",
          description: `${transactions.length} item(s) received into inventory.`,
          variant: "success",
        });
      } else if (sourceMode === "manual") {
        // Create single manual transaction
        // Default currency to MMK with exchange rate 1.0 for WAC calculation
        const qty = parseFloat(manualQuantity) || 0;
        const cost = parseFloat(manualUnitCost) || 0;
        const { error: insertError } = await supabase
          .from("inventory_transactions")
          .insert({
            movement_type: "inventory_in",
            item_id: manualItemId,
            warehouse_id: warehouseId,
            quantity: qty,
            unit_cost: cost,
            currency: currency,
            exchange_rate: parseFloat(exchangeRate) || 1,
            transaction_date: transactionDate.toISOString().split("T")[0],
            notes: notes || null,
            status: "completed",
            created_by: user.id,
          });

        if (insertError) throw insertError;

        toast({
          title: "Stock In Recorded",
          description: `${qty} ${selectedManualItem?.default_unit || "units"} of ${selectedManualItem?.name} received.`,
          variant: "success",
        });
      }

      // Redirect back to appropriate page
      if (sourceMode === "invoice" && selectedInvoiceId) {
        router.push(`/invoice/${selectedInvoiceId}`);
      } else {
        router.push("/warehouse");
      }
    } catch (err: unknown) {
      console.error("Error creating stock in:", err);
      // Extract detailed error message
      let errorMessage = "Failed to record stock in";
      if (err && typeof err === "object") {
        if ("message" in err && typeof err.message === "string") {
          errorMessage = err.message;
        }
        if ("details" in err && typeof err.details === "string") {
          errorMessage += `: ${err.details}`;
        }
        if ("hint" in err && typeof err.hint === "string") {
          errorMessage += ` (${err.hint})`;
        }
      }
      setError(errorMessage);
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
        <Link href="/warehouse">
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
            title="Receive Stock"
            description="Record inventory receipt from invoice or manual entry"
            badge={
              <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 w-fit">
                <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
                  Stock In
                </span>
              </div>
            }
          />
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

      {/* Source Mode Selection */}
      <FormSection
        title="Source"
        icon={<Package className="h-4 w-4 text-amber-500" />}
      >

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setSourceMode("invoice");
              setManualCategoryId("");
              setManualItemId("");
            }}
            className={`p-4 rounded-lg border text-left transition-all ${
              sourceMode === "invoice"
                ? "bg-amber-500/10 border-amber-500/50"
                : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText
                className={`h-5 w-5 ${sourceMode === "invoice" ? "text-amber-500" : "text-slate-400"}`}
              />
              <div>
                <p
                  className={`font-medium ${sourceMode === "invoice" ? "text-amber-400" : "text-slate-200"}`}
                >
                  From Invoice
                </p>
                <p className="text-xs text-slate-400">
                  Receive items based on invoice
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode("manual")}
            className={`p-4 rounded-lg border text-left transition-all ${
              sourceMode === "manual"
                ? "bg-amber-500/10 border-amber-500/50"
                : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
            }`}
          >
            <div className="flex items-center gap-3">
              <Plus
                className={`h-5 w-5 ${sourceMode === "manual" ? "text-amber-500" : "text-slate-400"}`}
              />
              <div>
                <p
                  className={`font-medium ${sourceMode === "manual" ? "text-amber-400" : "text-slate-200"}`}
                >
                  Manual Entry
                </p>
                <p className="text-xs text-slate-400">
                  Enter stock details manually
                </p>
              </div>
            </div>
          </button>
        </div>
      </FormSection>

      {/* Invoice Mode */}
      {sourceMode === "invoice" && (
        <>
          {/* Invoice Selection */}
          <FormSection
            title="Select Invoice"
            icon={<FileText className="h-4 w-4 text-amber-500" />}
            animationDelay="50ms"
          >

            {invoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Invoices Available</p>
                <p className="text-sm">
                  Create an invoice first to receive stock from it.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {invoices.map((invoice) => {
                  const isSelected = selectedInvoiceId === invoice.id;
                  return (
                    <div
                      key={invoice.id}
                      onClick={() => setSelectedInvoiceId(invoice.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/50"
                          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected
                                ? "border-amber-500 bg-amber-500"
                                : "border-slate-500"
                            }`}
                          >
                            {isSelected && (
                              <Check className="h-2.5 w-2.5 text-white" />
                            )}
                          </div>
                          <div>
                            <code className="text-amber-400 font-semibold">
                              {invoice.invoice_number}
                            </code>
                            <p className="text-xs text-slate-400">
                              {invoice.purchase_order?.supplier?.company_name ||
                                invoice.purchase_order?.supplier?.name ||
                                "No supplier"}
                              {" · "}
                              PO: {invoice.purchase_order?.po_number || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="text-slate-300">
                            {formatCurrency(invoice.total_amount ?? 0)}{" "}
                            {invoice.currency}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>

          {/* Invoice Line Items */}
          {selectedInvoiceId && stockInLines.length > 0 && (
            <FormSection
              title="Items to Receive"
              icon={<Package className="h-4 w-4 text-amber-500" />}
              animationDelay="100ms"
            >

              {/* Select All */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm text-slate-300 hover:text-amber-400 transition-colors"
                >
                  {stockInLines.every(
                    (line) => line.selected || line.max_quantity === 0
                  ) ? (
                    <CheckSquare className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Square className="h-5 w-5" />
                  )}
                  Select All
                </button>
                <span className="text-sm text-slate-400">
                  {selectedStockInLines.length} of{" "}
                  {stockInLines.filter((l) => l.max_quantity > 0).length}{" "}
                  selected
                </span>
              </div>

              {/* Line Items */}
              <div className="space-y-3 mt-4">
                {stockInLines.map((line) => {
                  const hasQtyError =
                    line.selected &&
                    (line.quantity > line.max_quantity || line.quantity <= 0);
                  const isDisabled = line.max_quantity === 0;

                  return (
                    <div
                      key={line.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isDisabled
                          ? "bg-slate-900/30 border-slate-800 opacity-50"
                          : line.selected
                            ? hasQtyError
                              ? "bg-red-500/10 border-red-500/50"
                              : "bg-slate-800/50 border-amber-500/30"
                            : "bg-slate-900/50 border-slate-700/50 opacity-60"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() =>
                            !isDisabled && handleToggleLine(line.id)
                          }
                          disabled={isDisabled}
                          className="mt-1"
                        >
                          {line.selected ? (
                            <CheckSquare className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-500" />
                          )}
                        </button>

                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-slate-200">
                                {line.item_name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {line.item_sku && (
                                  <code className="text-xs text-amber-400">
                                    {line.item_sku}
                                  </code>
                                )}
                                {line.item_unit && (
                                  <span className="text-xs text-slate-500">
                                    Unit: {line.item_unit}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Available:{" "}
                                <span className="font-mono text-emerald-400">
                                  {line.max_quantity}
                                </span>
                                {isDisabled && (
                                  <span className="ml-2 text-amber-400">
                                    (Already received)
                                  </span>
                                )}
                              </p>
                            </div>

                            {/* Quantity & Unit Cost Inputs */}
                            {line.selected && !isDisabled && (
                              <div className="flex items-center gap-4">
                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">
                                    Qty
                                  </label>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={line.quantity}
                                    onChange={(e) =>
                                      handleUpdateLineQuantity(
                                        line.id,
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    onKeyDown={handleQuantityKeyDown}
                                    className={`w-20 text-right font-mono bg-slate-800 border-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                      hasQtyError ? "border-red-500" : ""
                                    }`}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">
                                    Unit Cost
                                  </label>
                                  <AmountInput
                                    value={String(line.unit_cost)}
                                    onValueChange={(val) =>
                                      handleUpdateLineUnitCost(
                                        line.id,
                                        parseFloat(val) || 0
                                      )
                                    }
                                    className="w-28 text-right bg-slate-800 border-slate-700"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-slate-500 block mb-1">
                                    Total
                                  </label>
                                  <div className="w-28 text-right font-mono text-emerald-400 py-2">
                                    {formatCurrency(
                                      line.quantity * line.unit_cost
                                    )}
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
            </FormSection>
          )}
        </>
      )}

      {/* Manual Mode */}
      {sourceMode === "manual" && (
        <FormSection
          title="Item Details"
          icon={<Package className="h-4 w-4 text-amber-500" />}
          animationDelay="50ms"
        >

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <CategoryItemSelector
                categoryId={manualCategoryId}
                itemId={manualItemId}
                onCategoryChange={(catId) => {
                  setManualCategoryId(catId);
                  setManualItemId("");
                }}
                onItemChange={(itmId) => {
                  setManualItemId(itmId);
                }}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Quantity *
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={manualQuantity}
                onChange={(e) => setManualQuantity(e.target.value)}
                onKeyDown={handleQuantityKeyDown}
                className="bg-slate-800/50 border-slate-700 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {selectedManualItem?.default_unit && (
                <p className="text-xs text-slate-500 mt-1">
                  Unit: {selectedManualItem.default_unit}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Unit Cost * (for WAC calculation)
              </label>
              <AmountInput
                value={manualUnitCost}
                onValueChange={setManualUnitCost}
                className="bg-slate-800/50 border-slate-700"
              />
            </div>
          </div>

          {/* Currency and Exchange Rate */}
          <div className="grid gap-4 md:grid-cols-3 mt-4 pt-4 border-t border-slate-700">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Currency *
              </label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Exchange Rate *
              </label>
              <ExchangeRateInput
                value={exchangeRate}
                onValueChange={setExchangeRate}
                disabled={currency === 'USD'}
                className={`bg-slate-800/50 border-slate-700 ${currency === 'USD' ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <p className="text-xs text-slate-500 mt-1">
                {currency === 'USD' ? 'USD rate is always 1.0' : `1 EUSD = ${exchangeRate || '1'} ${currency}`}
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Total Value
              </label>
              <div className="p-2 rounded bg-slate-800/50 border border-slate-700 text-right">
                <span className="font-mono text-lg text-amber-400">
                  {formatCurrency(manualTotalValue)} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* EUSD Calculation Panel */}
          {manualItemId && (parseFloat(manualQuantity) || 0) > 0 && (parseFloat(manualUnitCost) || 0) > 0 && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm text-slate-300">Calculated EUSD Value</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-mono font-bold text-emerald-400">
                    {formatCurrency(calculatedEusd)}
                  </span>
                  <span className="text-emerald-400 font-medium">EUSD</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Formula: {formatCurrency(manualTotalValue)} {currency} / {exchangeRate || '1'} = {formatCurrency(calculatedEusd)} EUSD
              </p>
            </div>
          )}
        </FormSection>
      )}

      {/* Destination Warehouse */}
      <FormSection
        title="Destination Warehouse"
        icon={<Warehouse className="h-4 w-4 text-amber-500" />}
        animationDelay="150ms"
      >

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Warehouse" required>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select warehouse..." />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    <div className="flex items-center gap-2">
                      <span>{wh.name}</span>
                      <span className="text-xs text-slate-500">
                        ({wh.location})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Transaction Date">
            <DatePicker
              date={transactionDate}
              onDateChange={(date) => date && setTransactionDate(date)}
            />
          </FormField>
        </div>

        <FormField label="Notes" className="mt-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="bg-slate-800/50 border-slate-700 min-h-[60px]"
          />
        </FormField>
      </FormSection>

      {/* Summary */}
      <div
        className="command-panel corner-accents animate-slide-up"
        style={{ animationDelay: "200ms" }}
      >
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">
              Items
            </p>
            <p className="text-2xl font-mono font-bold text-emerald-400">
              {sourceMode === "invoice"
                ? selectedStockInLines.length
                : manualItemId
                  ? 1
                  : 0}
            </p>
          </div>

          <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">
              Total Qty
            </p>
            <p className="text-2xl font-mono font-bold text-blue-400">
              {sourceMode === "invoice"
                ? selectedStockInLines.reduce(
                    (sum, line) => sum + line.quantity,
                    0
                  )
                : parseFloat(manualQuantity) || 0}
            </p>
          </div>

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">
              Total Value
            </p>
            <CurrencyDisplay
              amount={summaryTotals.totalValue}
              currency={summaryTotals.currency}
              amountEusd={summaryTotals.eusdValue}
              size="lg"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <Link href="/warehouse">
          <Button type="button" variant="ghost" className="text-slate-400">
            Cancel
          </Button>
        </Link>

        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || hasErrors}
          className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Record Stock In
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function StockInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      }
    >
      <StockInContent />
    </Suspense>
  );
}
