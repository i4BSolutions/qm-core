"use client";

import { useEffect, useState } from "react";
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
import { POBalancePanel } from "@/components/po/po-balance-panel";
import { EditableLineItemsTable } from "@/components/po/po-line-items-table";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import type { QMHQ, Supplier, Item, ContactPerson } from "@/types/database";

// Line item form data
interface LineItemFormData {
  id: string;
  item_id: string | null;
  item_name: string;
  item_sku?: string;
  item_unit?: string;
  quantity: number;
  unit_price: number;
}

// QMHQ with balance info
interface QMHQWithBalance extends Pick<QMHQ, "id" | "request_id" | "line_name" | "balance_in_hand" | "amount_eusd" | "total_money_in" | "total_po_committed"> {}

export default function POCreatePage() {
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
  const [items, setItems] = useState<Pick<Item, "id" | "name" | "sku" | "default_unit">[]>([]);
  const [contactPersons, setContactPersons] = useState<Pick<ContactPerson, "id" | "name" | "position">[]>([]);

  // Form state
  const [selectedQmhqId, setSelectedQmhqId] = useState<string>(preselectedQmhqId || "");
  const [supplierId, setSupplierId] = useState<string>("");
  const [poDate, setPoDate] = useState<Date>(new Date());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | undefined>();
  const [currency, setCurrency] = useState("");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [contactPersonName, setContactPersonName] = useState("");
  const [signPersonName, setSignPersonName] = useState("");
  const [authorizedSignerName, setAuthorizedSignerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItemFormData[]>([
    { id: crypto.randomUUID(), item_id: null, item_name: "", quantity: 1, unit_price: 0 },
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
        .select("id, name, sku, default_unit")
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
  const poTotalEusd = exchangeRate > 0 ? poTotal / exchangeRate : 0;

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
    lineItems.every((li) => li.item_id && li.quantity > 0 && li.unit_price > 0) &&
    !exceedsBalance;

  // Line item handlers
  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), item_id: null, item_name: "", quantity: 1, unit_price: 0 },
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
          exchange_rate: exchangeRate,
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
      setError(err instanceof Error ? err.message : "Failed to create Purchase Order");
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
          <Link href="/po">
            <Button variant="ghost" size="icon" className="mt-1 hover:bg-amber-500/10 hover:text-amber-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-purple-500/10 border border-purple-500/20 mb-2 w-fit">
              <ShoppingCart className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-purple-500">
                New Purchase Order
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              Create Purchase Order
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Create a new PO from a QMHQ with available balance
            </p>
          </div>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* QMHQ Selection */}
        <div className="command-panel corner-accents animate-slide-up">
          <div className="section-header">
            <DollarSign className="h-4 w-4 text-amber-500" />
            <h2>QMHQ Selection</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Select QMHQ (PO Route with Balance) *
              </label>
              <Select
                value={selectedQmhqId}
                onValueChange={setSelectedQmhqId}
                disabled={!!preselectedQmhqId}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
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
            </div>

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
          </div>
        </div>

        {/* PO Header */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="section-header">
            <Building2 className="h-4 w-4 text-amber-500" />
            <h2>PO Header</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Supplier */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Supplier *
              </label>
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
            </div>

            {/* PO Date */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                PO Date *
              </label>
              <DatePicker
                date={poDate}
                onDateChange={(date) => date && setPoDate(date)}
              />
            </div>

            {/* Expected Delivery Date */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Expected Delivery Date
              </label>
              <DatePicker
                date={expectedDeliveryDate}
                onDateChange={setExpectedDeliveryDate}
                minDate={poDate}
              />
            </div>

            {/* Currency */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Currency <span className="text-red-400">*</span>
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

            {/* Exchange Rate */}
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Exchange Rate (to EUSD)
              </label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                className="bg-slate-800/50 border-slate-700 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Signer Fields */}
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Contact Person
              </label>
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
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Sign Person
              </label>
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
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Authorized Signer
              </label>
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
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="section-header">
            <ShoppingCart className="h-4 w-4 text-amber-500" />
            <h2>Line Items</h2>
          </div>

          <EditableLineItemsTable
            items={lineItems}
            availableItems={items}
            onAddItem={handleAddLineItem}
            onRemoveItem={handleRemoveLineItem}
            onUpdateItem={handleUpdateLineItem}
            currency={currency}
          />
        </div>

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
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "400ms" }}>
          <div className="section-header">
            <CalendarDays className="h-4 w-4 text-amber-500" />
            <h2>Notes</h2>
          </div>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes for this PO..."
            className="bg-slate-800/50 border-slate-700 min-h-[100px]"
          />
        </div>

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
