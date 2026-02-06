"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Package,
  Wallet,
  ShoppingCart,
  Plus,
  Minus,
  Calculator,
  AlertTriangle,
  Info,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { QmrlContextPanel } from "@/components/qmhq/qmrl-context-panel";
import {
  formatCurrency,
  handleQuantityKeyDown,
  handleAmountKeyDown,
  handleExchangeRateKeyDown,
} from "@/lib/utils";
import type { Item } from "@/types/database";

// Route configuration
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string }> = {
  item: { icon: Package, label: "Item Route", color: "blue" },
  expense: { icon: Wallet, label: "Expense Route", color: "emerald" },
  po: { icon: ShoppingCart, label: "PO Route", color: "purple" },
};

// Currency options
const currencies = [
  { value: "MMK", label: "MMK - Myanmar Kyat" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "THB", label: "THB - Thai Baht" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
];

type DraftData = {
  line_name: string;
  description: string;
  notes: string;
  qmrl_id: string;
  category_id: string;
  status_id: string;
  contact_person_id: string;
  assigned_to: string;
  route_type: string;
};

type SelectedItem = {
  id: string;  // Client-side key (crypto.randomUUID())
  item_id: string;
  quantity: string;  // String for controlled input
};

export default function QMHQRouteDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const route = params.route as string;
  const config = routeConfig[route];

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftData, setDraftData] = useState<DraftData | null>(null);

  // Panel state: starts visible on desktop (>= 768px), closed on mobile
  // No sessionStorage persistence - resets per step per user decision
  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  // Item route state
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([
    { id: crypto.randomUUID(), item_id: '', quantity: '' }
  ]);

  // Expense/PO route state
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MMK");
  const [exchangeRate, setExchangeRate] = useState("1");

  // Calculate EUSD with proper rounding to avoid floating point issues
  const calculatedEusd = useMemo(() => {
    const amountNum = parseFloat(amount) || 0;
    const rateNum = parseFloat(exchangeRate) || 1;
    if (rateNum <= 0) return 0;
    // Round to 2 decimal places to avoid floating point precision issues
    return Math.round((amountNum / rateNum) * 100) / 100;
  }, [amount, exchangeRate]);

  useEffect(() => {
    // Check for valid route
    if (!config) {
      toast({
        title: "Invalid Route",
        description: "Please select a valid route type.",
        variant: "destructive",
      });
      router.push("/qmhq/new");
      return;
    }

    // Retrieve draft data from sessionStorage
    const draft = sessionStorage.getItem("qmhq_draft");
    if (!draft) {
      toast({
        title: "Session Expired",
        description: "Please start from the beginning.",
        variant: "destructive",
      });
      router.push("/qmhq/new");
      return;
    }

    const parsedDraft = JSON.parse(draft) as DraftData;
    if (parsedDraft.route_type !== route) {
      toast({
        title: "Route Mismatch",
        description: "Route type doesn't match. Redirecting...",
        variant: "destructive",
      });
      router.push("/qmhq/new");
      return;
    }

    setDraftData(parsedDraft);

    // Load any saved route-specific data (when navigating back from preview or re-entering)
    const savedRouteData = sessionStorage.getItem("qmhq_route_data");
    if (savedRouteData) {
      try {
        const routeData = JSON.parse(savedRouteData);
        if (routeData.route === route) {
          // Restore item route data
          if (route === "item" && routeData.selectedItems) {
            setSelectedItems(routeData.selectedItems);
          }
          // Restore expense/po route data
          if (route === "expense" || route === "po") {
            setAmount(routeData.amount || "");
            setCurrency(routeData.currency || "MMK");
            setExchangeRate(routeData.exchangeRate || "1");
          }
        }
      } catch (e) {
        // Invalid data, ignore
      }
    }

    fetchRouteData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, router, toast, config]);

  const fetchRouteData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    if (route === "item") {
      const { data: itemsData } = await supabase
        .from("items")
        .select("id, name, sku, default_unit, description")
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (itemsData) setItems(itemsData as Item[]);
    }

    setIsLoading(false);
  };

  const handleAddItem = () => {
    setSelectedItems([
      ...selectedItems,
      { id: crypto.randomUUID(), item_id: '', quantity: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (selectedItems.length === 1) return; // Keep at least one
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof Omit<SelectedItem, 'id'>, value: string) => {
    setSelectedItems(selectedItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    if (!draftData || !user?.id) {
      toast({
        title: "Error",
        description: "Missing required data. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Validation based on route
    if (route === "item") {
      // Validate at least one item with quantity
      const validItems = selectedItems.filter(
        item => item.item_id && parseFloat(item.quantity) > 0
      );
      if (validItems.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please add at least one item with quantity.",
          variant: "destructive",
        });
        return;
      }
    }

    if (route === "expense" || route === "po") {
      if (!amount || parseFloat(amount) <= 0) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid amount.",
          variant: "destructive",
        });
        return;
      }
      if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid exchange rate.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Build base data
      const baseData = {
        line_name: draftData.line_name,
        description: draftData.description || null,
        notes: draftData.notes || null,
        qmrl_id: draftData.qmrl_id,
        category_id: draftData.category_id || null,
        status_id: draftData.status_id || null,
        contact_person_id: draftData.contact_person_id || null,
        assigned_to: draftData.assigned_to || null,
        route_type: route as "item" | "expense" | "po",
        created_by: user.id,
      };

      if (route === "item") {
        // Create QMHQ without legacy item fields
        const { data: qmhqData, error: qmhqError } = await supabase
          .from("qmhq")
          .insert({
            ...baseData,
            // Legacy fields set to null for multi-item
            item_id: null,
            quantity: null,
            warehouse_id: null,
          })
          .select()
          .single();

        if (qmhqError) throw qmhqError;

        // Insert items into junction table
        const validItems = selectedItems.filter(
          item => item.item_id && parseFloat(item.quantity) > 0
        );

        const { error: itemsError } = await supabase
          .from("qmhq_items")
          .insert(
            validItems.map(item => ({
              qmhq_id: qmhqData.id,
              item_id: item.item_id,
              quantity: parseFloat(item.quantity),
              created_by: user.id,
            }))
          );

        if (itemsError) throw itemsError;

        // Clear draft and redirect
        sessionStorage.removeItem("qmhq_draft");
        sessionStorage.removeItem("qmhq_route_data");

        toast({
          title: "Success",
          description: "QMHQ line created successfully.",
          variant: "success",
        });

        router.push(`/qmhq/${qmhqData.id}`);
        return;
      }

      // Expense/PO routes (existing logic)
      const insertData = {
        ...baseData,
        amount: parseFloat(amount),
        currency: currency,
        exchange_rate: parseFloat(exchangeRate),
      };

      const { data, error } = await supabase
        .from("qmhq")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Clear all draft data
      sessionStorage.removeItem("qmhq_draft");
      sessionStorage.removeItem("qmhq_route_data");

      toast({
        title: "Success",
        description: "QMHQ line created successfully.",
        variant: "success",
      });

      router.push(`/qmhq/${data.id}`);
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create QMHQ line.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    // Save route-specific data before going back
    const routeData = {
      route,
      // Item route data
      selectedItems,
      // Expense/PO route data
      amount,
      currency,
      exchangeRate,
    };
    sessionStorage.setItem("qmhq_route_data", JSON.stringify(routeData));

    router.push("/qmhq/new");
  };

  if (!config) {
    return null;
  }

  const Icon = config.icon;
  const colorClasses = {
    blue: {
      badge: "bg-blue-500/10 border-blue-500/20 text-blue-400",
      icon: "text-blue-400",
      iconBg: "bg-blue-500/20",
    },
    emerald: {
      badge: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      icon: "text-emerald-400",
      iconBg: "bg-emerald-500/20",
    },
    purple: {
      badge: "bg-purple-500/10 border-purple-500/20 text-purple-400",
      icon: "text-purple-400",
      iconBg: "bg-purple-500/20",
    },
  };

  const colors = colorClasses[config.color as keyof typeof colorClasses];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading systems...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Main layout: form + panel */}
      <div className="md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px] gap-6">
        {/* Form Section */}
        <div className="space-y-8">
          {/* Header */}
          <div className="relative flex items-start gap-4 animate-fade-in">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="mt-1 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex items-center gap-2 px-3 py-1 rounded border ${colors.badge}`}>
                  <Icon className={`h-4 w-4 ${colors.icon}`} />
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Step 2 of 2
                  </span>
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-200">
                {config.label} Details
              </h1>
              <p className="mt-1 text-slate-400">
                {draftData?.line_name && (
                  <>
                    Line: <span className="text-slate-200">{draftData.line_name}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Route-specific Form */}
          <div className="space-y-6">
            {/* Item Route Form */}
            {route === "item" && (
              <>
                <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
                  <div className="section-header">
                    <Package className={`h-4 w-4 ${colors.icon}`} />
                    <h2>Item Selection</h2>
                  </div>

                  <div className="space-y-4">
                    {selectedItems.map((selectedItem, index) => (
                      <div key={selectedItem.id} className="grid grid-cols-12 gap-3 p-4 rounded-lg bg-slate-800/30 border border-slate-700/50">
                        {/* Item Number */}
                        <div className="col-span-12 sm:col-span-1 flex items-center">
                          <span className="text-xs font-mono text-slate-500 uppercase">#{index + 1}</span>
                        </div>

                        {/* Item Select */}
                        <div className="col-span-12 sm:col-span-7 space-y-1">
                          <Label className="data-label text-xs">Item</Label>
                          <Select
                            value={selectedItem.item_id}
                            onValueChange={(value) => handleUpdateItem(selectedItem.id, 'item_id', value)}
                          >
                            <SelectTrigger className="bg-slate-800/50 border-slate-700">
                              <SelectValue placeholder="Select item" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((item) => (
                                <SelectItem key={item.id} value={item.id}>
                                  <div className="flex items-center gap-2">
                                    {item.sku && (
                                      <code className="text-amber-400 text-xs">{item.sku}</code>
                                    )}
                                    <span className="text-slate-200">{item.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-6 sm:col-span-3 space-y-1">
                          <Label className="data-label text-xs">Quantity</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={selectedItem.quantity}
                            onChange={(e) => handleUpdateItem(selectedItem.id, 'quantity', e.target.value)}
                            onKeyDown={handleQuantityKeyDown}
                            className="bg-slate-800/50 border-slate-700 focus:border-blue-500/50 text-slate-200 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        {/* Remove Button */}
                        <div className="col-span-6 sm:col-span-1 flex items-end justify-end sm:justify-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(selectedItem.id)}
                            disabled={selectedItems.length === 1}
                            className="h-9 w-9 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Add Item Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddItem}
                      className="w-full border-dashed border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-blue-500/5"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Another Item
                    </Button>
                  </div>
                </div>

                {/* Info Panel */}
                <div className="command-panel animate-slide-up bg-blue-500/5 border-blue-500/20" style={{ animationDelay: "200ms" }}>
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-slate-200 mb-1">Item Route Info</h3>
                      <p className="text-sm text-slate-400">
                        This is an item request. Select the items and quantities needed.
                        Stock out will be processed separately from the QMHQ detail page.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Expense Route Form */}
            {route === "expense" && (
              <>
                <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
                  <div className="section-header">
                    <Wallet className={`h-4 w-4 ${colors.icon}`} />
                    <h2>Expense Details</h2>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="amount" className="data-label">
                          Amount <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          id="amount"
                          type="text"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onKeyDown={handleAmountKeyDown}
                          className="bg-slate-800/50 border-slate-700 focus:border-emerald-500/50 text-slate-200 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="currency" className="data-label">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="bg-slate-800/50 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="exchange_rate" className="data-label">
                          Exchange Rate <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          id="exchange_rate"
                          type="text"
                          inputMode="decimal"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          onKeyDown={handleExchangeRateKeyDown}
                          className="bg-slate-800/50 border-slate-700 focus:border-emerald-500/50 text-slate-200 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <p className="text-xs text-slate-400">Rate to convert to EUSD (1 EUSD = X {currency})</p>
                      </div>
                    </div>

                    {/* EUSD Calculation */}
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-emerald-400" />
                          <span className="text-sm text-slate-300">Calculated EUSD Amount</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-2xl font-mono font-bold text-emerald-400">
                            {formatCurrency(calculatedEusd)}
                          </span>
                          <span className="text-emerald-400 font-medium">EUSD</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Formula: {formatCurrency(parseFloat(amount) || 0)} {currency} / {exchangeRate || "1"} = {formatCurrency(calculatedEusd)} EUSD
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info Panel */}
                <div className="command-panel animate-slide-up bg-emerald-500/5 border-emerald-500/20" style={{ animationDelay: "200ms" }}>
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-emerald-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-slate-200 mb-1">Expense Route Info</h3>
                      <p className="text-sm text-slate-400">
                        The Expense route tracks direct money transactions (Money In / Money Out).
                        All amounts are converted to EUSD for standardized reporting.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* PO Route Form */}
            {route === "po" && (
              <>
                <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
                  <div className="section-header">
                    <ShoppingCart className={`h-4 w-4 ${colors.icon}`} />
                    <h2>Budget Allocation</h2>
                  </div>

                  <div className="space-y-5">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="grid gap-2">
                        <Label htmlFor="amount" className="data-label">
                          Budget Amount <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          id="amount"
                          type="text"
                          inputMode="decimal"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          onKeyDown={handleAmountKeyDown}
                          className="bg-slate-800/50 border-slate-700 focus:border-purple-500/50 text-slate-200 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="currency" className="data-label">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                          <SelectTrigger className="bg-slate-800/50 border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {currencies.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="exchange_rate" className="data-label">
                          Exchange Rate <span className="text-red-400">*</span>
                        </Label>
                        <Input
                          id="exchange_rate"
                          type="text"
                          inputMode="decimal"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          onKeyDown={handleExchangeRateKeyDown}
                          className="bg-slate-800/50 border-slate-700 focus:border-purple-500/50 text-slate-200 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <p className="text-xs text-slate-400">Rate to convert to EUSD</p>
                      </div>
                    </div>

                    {/* EUSD Calculation */}
                    <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-purple-400" />
                          <span className="text-sm text-slate-300">Budget in EUSD</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-2xl font-mono font-bold text-purple-400">
                            {formatCurrency(calculatedEusd)}
                          </span>
                          <span className="text-purple-400 font-medium">EUSD</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Preview */}
                    <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                      <div className="text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Money In</p>
                        <p className="text-lg font-mono text-emerald-400">0.00 EUSD</p>
                      </div>
                      <div className="text-center border-x border-slate-700">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PO Committed</p>
                        <p className="text-lg font-mono text-amber-400">0.00 EUSD</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Balance in Hand</p>
                        <p className="text-lg font-mono text-purple-400">0.00 EUSD</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Panel */}
                <div className="command-panel animate-slide-up bg-purple-500/5 border-purple-500/20" style={{ animationDelay: "200ms" }}>
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-purple-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-slate-200 mb-1">PO Route Info</h3>
                      <p className="text-sm text-slate-400">
                        The PO route is for procurement via Purchase Orders. You&apos;ll set a budget here,
                        then create Money In transactions and Purchase Orders. The system tracks Balance in Hand
                        (Money In - PO Committed).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <div className="command-panel animate-slide-up bg-amber-500/5 border-amber-500/20" style={{ animationDelay: "300ms" }}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-slate-200 mb-1">Important</h3>
                      <p className="text-sm text-slate-400">
                        You cannot create Purchase Orders until Money In transactions have been recorded.
                        Balance in Hand must be sufficient to cover PO amounts.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 animate-slide-up" style={{ animationDelay: "400ms" }}>
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`min-w-[160px] ${
                  config.color === "blue"
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                    : config.color === "emerald"
                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
                    : "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create QMHQ
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* QMRL Context Panel */}
        <QmrlContextPanel
          qmrlId={draftData?.qmrl_id || null}
          isOpen={isPanelOpen}
          onToggle={() => setIsPanelOpen(prev => !prev)}
        />
      </div>
    </div>
  );
}
