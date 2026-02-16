"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  ShoppingCart,
  Building2,
  CalendarDays,
  DollarSign,
  AlertTriangle,
  Save,
  Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POBalancePanel } from "@/components/po/po-balance-panel";
import { EditableLineItemsTable } from "@/components/po/po-line-items-table";
import { formatCurrency } from "@/lib/utils";
import { ExchangeRateInput } from "@/components/ui/exchange-rate-input";
import { useAuth } from "@/components/providers/auth-provider";
import type { QMHQ, Supplier, Item, ContactPerson } from "@/types/database";

// Line item form data
interface LineItemFormData {
  id: string;
  category_id: string | null;
  item_id: string | null;
  item_name: string;
  item_sku?: string;
  item_unit?: string;
  item_price_reference?: string;
  item_standard_unit?: string;
  quantity: number;
  unit_price: number;
  conversion_rate: string;
}

// QMHQ with balance info
interface QMHQWithBalance extends Pick<QMHQ, "id" | "request_id" | "line_name" | "balance_in_hand" | "amount_eusd" | "total_money_in" | "total_po_committed"> {}

function POCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preselectedQmhqId = searchParams.get("qmhq");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [qmhqs, setQmhqs] = useState<QMHQWithBalance[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Pick<Item, "id" | "name" | "sku" | "default_unit" | "price_reference">[]>([]);
  const [contactPersons, setContactPersons] = useState<Pick<ContactPerson, "id" | "name" | "position">[]>([]);

  // Form state
  const [selectedQmhqId, setSelectedQmhqId] = useState<string>(preselectedQmhqId || "");
  const [supplierId, setSupplierId] = useState<string>("");
  const [poDate, setPoDate] = useState<Date>(new Date());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [currency, setCurrency] = useState("");
  const [exchangeRate, setExchangeRate] = useState<string>("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [signPersonName, setSignPersonName] = useState("");
  const [authorizedSignerName, setAuthorizedSignerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([
    { id: crypto.randomUUID(), category_id: null, item_id: null, item_name: "", quantity: 1, unit_price: 0, conversion_rate: "" },
  ]);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [qmhqRes, suppliersRes, itemsRes, contactRes] = await Promise.all([
      // Only fetch QMHQ with PO route and positive balance
      supabase
        .from("qmhq")
        .select("id, request_id, line_name, balance_in_hand, amount_eusd, total_money_in, total_po_committed")
        .eq("route_type", "po")
        .eq("is_active", true)
        .gt("balance_in_hand", 0)
        .order("request_id", { ascending: false }),
      supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("items")
        .select("id, name, sku, default_unit, price_reference, standard_unit_rel:standard_units!items_standard_unit_id_fkey(name)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("contact_persons")
        .select("id, name, position")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (qmhqRes.data) setQmhqs(qmhqRes.data as QMHQWithBalance[]);
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
    if (itemsRes.data) setItems(itemsRes.data);
    if (contactRes.data) setContactPersons(contactRes.data);

    setIsLoading(false);
  };

  // Calculate PO total from line items
  const poTotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const rate = parseFloat(exchangeRate) || 1;
  const poTotalEusd = rate > 0 ? poTotal / rate : 0;

  // Get selected QMHQ info
  const selectedQmhq = qmhqs.find((q) => q.id === selectedQmhqId);
  const availableBalance = selectedQmhq?.balance_in_hand ?? 0;

  // Validation
  const exceedsBalance = poTotalEusd > availableBalance;
  const canSubmit =
    selectedQmhqId &&
    supplierId &&
    currency &&
    lineItems.length > 0 &&
    lineItems.every((li) => li.item_id && li.quantity > 0 && li.unit_price > 0 && li.conversion_rate && parseFloat(li.conversion_rate) > 0) &&
    !exceedsBalance;

  // Line item handlers
  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), category_id: null, item_id: null, item_name: "", quantity: 1, unit_price: 0, conversion_rate: "" },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((li) => li.id !== id));
    }
  };

  const handleUpdateLineItem = (id: string, field: keyof LineItemFormData, value: unknown) => {
    setLineItems((prev) =>
      prev.map((li) =>
        li.id === id ? { ...li, [field]: value } : li
      )
    );
  };

  const handleItemCreated = (newItem: Item) => {
    // Add new item to available items list
    setItems((prev) => [
      ...prev,
      {
        id: newItem.id,
        name: newItem.name,
        sku: newItem.sku || null,
        default_unit: newItem.default_unit || null,
        price_reference: newItem.price_reference || null,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create PO
      const { data: poData, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          qmhq_id: selectedQmhqId,
          supplier_id: supplierId,
          po_date: poDate.toISOString().split("T")[0],
          expected_delivery_date: expectedDeliveryDate?.toISOString().split("T")[0] || null,
          currency,
          exchange_rate: parseFloat(exchangeRate) || 1,
          contact_person_name: contactPersonName || null,
          sign_person_name: signPersonName || null,
          authorized_signer_name: authorizedSignerName || null,
          notes: notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      // Create line items
      const lineItemsToInsert = lineItems
        .filter((li) => li.item_id)
        .map((li) => ({
          po_id: poData.id,
          item_id: li.item_id,
          quantity: li.quantity,
          unit_price: li.unit_price,
          conversion_rate: parseFloat(li.conversion_rate) || 1,
          item_name: li.item_name,
          item_sku: li.item_sku || null,
          item_unit: li.item_unit || null,
        }));

      if (lineItemsToInsert.length > 0) {
        const { error: lineItemsError } = await supabase
          .from("po_line_items")
          .insert(lineItemsToInsert);

        if (lineItemsError) throw lineItemsError;
      }

      // Redirect to PO detail page
      router.push(`/po/${poData.id}`);
    } catch (err) {
      console.error("Error creating PO:", err);

      // Extract detailed Supabase error information for better debugging
      let errorMessage = "Failed to create Purchase Order";

      if (err && typeof err === "object") {
        // Supabase PostgresError has: message, details, hint, code
        const errorObj = err as any;

        if ("message" in errorObj) {
          errorMessage = String(errorObj.message);
        }

        // Append details if available (often contains trigger error specifics)
        if ("details" in errorObj && errorObj.details) {
          errorMessage += `\n\nDetails: ${errorObj.details}`;
        }

        // Append hint if available (database suggestions)
        if ("hint" in errorObj && errorObj.hint) {
          errorMessage += `\n\nHint: ${errorObj.hint}`;
        }

        // Append error code for technical debugging
        if ("code" in errorObj && errorObj.code) {
          errorMessage += `\n\nError Code: ${errorObj.code}`;
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
        <Link href="/po">
          <Button variant="ghost" size="icon" className="mt-1 hover:bg-amber-500/10 hover:text-amber-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader
          title="Create Purchase Order"
          description="Create a new PO from a QMHQ with available balance"
          badge={
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-purple-500/10 border border-purple-500/20">
              <ShoppingCart className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-purple-500">
                New Purchase Order
              </span>
            </div>
          }
          className="mb-0"
        />
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* QMHQ Selection */}
        <FormSection
          title="QMHQ Selection"
          icon={<DollarSign className="h-4 w-4 text-amber-500" />}
        >
          {preselectedQmhqId && (
            <p className="text-xs text-slate-400 mb-3">
              QMHQ is inherited from the parent detail page
            </p>
          )}
          <FormField
            label={
              <span className="flex items-center gap-2">
                Select QMHQ (PO Route with Balance)
                {preselectedQmhqId && (
                  <span className="flex items-center gap-1 text-xs text-amber-500 font-normal">
                    <Lock className="h-3 w-3" />
                    Inherited
                  </span>
                )}
              </span>
            }
            htmlFor="qmhq_id"
            required
          >
            <Select
              value={selectedQmhqId}
              onValueChange={setSelectedQmhqId}
              disabled={!!preselectedQmhqId}
            >
              <SelectTrigger className={`bg-slate-800/50 border-slate-700 ${preselectedQmhqId ? 'opacity-70 cursor-not-allowed' : ''}`}>
                <SelectValue placeholder="Select QMHQ..." />
              </SelectTrigger>
              <SelectContent>
                {qmhqs.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    No QMHQ with available balance found
                  </div>
                ) : (
                  qmhqs.map((qmhq) => (
                    <SelectItem key={qmhq.id} value={qmhq.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>
                          <code className="text-amber-400">{qmhq.request_id}</code>
                          {" - "}
                          {qmhq.line_name}
                        </span>
                        <span className="text-emerald-400 font-mono text-sm">
                          {formatCurrency(qmhq.balance_in_hand ?? 0)} EUSD
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FormField>

            {selectedQmhq && (
              <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Budget</p>
                    <p className="font-mono text-slate-200">{formatCurrency(selectedQmhq.amount_eusd ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Money In</p>
                    <p className="font-mono text-emerald-400">{formatCurrency(selectedQmhq.total_money_in ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PO Committed</p>
                    <p className="font-mono text-amber-400">{formatCurrency(selectedQmhq.total_po_committed ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Available</p>
                    <p className="font-mono text-purple-400 font-bold">{formatCurrency(availableBalance)}</p>
                  </div>
                </div>
              </div>
            )}
        </FormSection>

        {/* PO Header */}
        <FormSection
          title="PO Header"
          icon={<Building2 className="h-4 w-4 text-amber-500" />}
          animationDelay="100ms"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Supplier" htmlFor="supplier" required>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.company_name || supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="PO Date" htmlFor="po_date" required>
              <DatePicker
                date={poDate}
                onDateChange={(date) => date && setPoDate(date)}
              />
            </FormField>

            <FormField label="Expected Delivery Date" htmlFor="expected_delivery_date">
              <DatePicker
                date={expectedDeliveryDate}
                onDateChange={setExpectedDeliveryDate}
                minDate={poDate}
              />
            </FormField>

            <FormField label="Currency" htmlFor="currency" required>
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
            </FormField>

            <FormField label="Exchange Rate (to EUSD)" htmlFor="exchange_rate">
              <ExchangeRateInput
                value={exchangeRate}
                onValueChange={setExchangeRate}
                className="bg-slate-800/50 border-slate-700"
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Contact Person" htmlFor="contact_person">
              <Select
                value={contactPersonName}
                onValueChange={setContactPersonName}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select contact person..." />
                </SelectTrigger>
                <SelectContent>
                  {contactPersons.map((cp) => (
                    <SelectItem key={cp.id} value={cp.name}>
                      {cp.name}
                      {cp.position && <span className="text-slate-400 ml-2">({cp.position})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Sign Person" htmlFor="sign_person">
              <Select
                value={signPersonName}
                onValueChange={setSignPersonName}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select sign person..." />
                </SelectTrigger>
                <SelectContent>
                  {contactPersons.map((cp) => (
                    <SelectItem key={cp.id} value={cp.name}>
                      {cp.name}
                      {cp.position && <span className="text-slate-400 ml-2">({cp.position})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Authorized Signer" htmlFor="authorized_signer">
              <Select
                value={authorizedSignerName}
                onValueChange={setAuthorizedSignerName}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select authorized signer..." />
                </SelectTrigger>
                <SelectContent>
                  {contactPersons.map((cp) => (
                    <SelectItem key={cp.id} value={cp.name}>
                      {cp.name}
                      {cp.position && <span className="text-slate-400 ml-2">({cp.position})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </FormSection>

        {/* Line Items */}
        <FormSection
          title="Line Items"
          icon={<ShoppingCart className="h-4 w-4 text-amber-500" />}
          animationDelay="200ms"
        >
          <EditableLineItemsTable
            items={lineItems}
            availableItems={items}
            onAddItem={handleAddLineItem}
            onRemoveItem={handleRemoveLineItem}
            onUpdateItem={handleUpdateLineItem}
            onItemCreated={handleItemCreated}
            currency={currency}
          />
        </FormSection>

        {/* Balance Validation */}
        {selectedQmhq && (
          <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
            <POBalancePanel
              availableBalance={availableBalance}
              poTotal={poTotalEusd}
              currency="EUSD"
            />
          </div>
        )}

        {/* Notes */}
        <FormSection
          title="Notes"
          icon={<CalendarDays className="h-4 w-4 text-amber-500" />}
          animationDelay="400ms"
        >
          <FormField label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this PO..."
              className="bg-slate-800/50 border-slate-700 min-h-[100px]"
            />
          </FormField>
        </FormSection>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 animate-slide-up" style={{ animationDelay: "500ms" }}>
          <Link href="/po">
            <Button type="button" variant="outline" className="border-slate-700">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Create Purchase Order
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function POCreatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>}>
      <POCreateContent />
    </Suspense>
  );
}
