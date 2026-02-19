"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { FormSection, FormField, PageHeader } from "@/components/composite";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { QmrlContextPanel } from "@/components/qmhq/qmrl-context-panel";
import { CategoryItemSelector } from "@/components/forms/category-item-selector";
import { ItemDialog } from "@/app/(dashboard)/item/item-dialog";
import { formatCurrency, handleQuantityKeyDown } from "@/lib/utils";
import { AmountInput } from "@/components/ui/amount-input";
import { ConversionRateInput } from "@/components/ui/conversion-rate-input";
import { ExchangeRateInput } from "@/components/ui/exchange-rate-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type AvailableItem = {
  id: string;
  name: string;
  sku: string | null;
  default_unit: string | null;
  price_reference: string | null;
  standard_unit_rel?: { name: string } | null;
};

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
  category_id: string | null;
  item_id: string;
  item_name: string;
  item_sku: string;
  item_unit: string;
  item_price_reference: string;
  item_standard_unit: string;
  quantity: number;
  conversion_rate: string;
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

  // Item route state
  const [items, setItems] = useState<AvailableItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([
    { id: crypto.randomUUID(), category_id: null, item_id: '', item_name: '', item_sku: '', item_unit: '', item_price_reference: '', item_standard_unit: '', quantity: 1, conversion_rate: '' }
  ]);
  const [createItemDialogOpen, setCreateItemDialogOpen] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

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
            // Restore with defaults for any missing fields from older sessions
            setSelectedItems(routeData.selectedItems.map((si: SelectedItem) => ({
              category_id: si.category_id ?? null,
              item_id: si.item_id ?? '',
              item_name: si.item_name ?? '',
              item_sku: si.item_sku ?? '',
              item_unit: si.item_unit ?? '',
              item_price_reference: si.item_price_reference ?? '',
              item_standard_unit: si.item_standard_unit ?? '',
              quantity: typeof si.quantity === 'number' ? si.quantity : (parseFloat(si.quantity as unknown as string) || 1),
              conversion_rate: si.conversion_rate ?? '',
              id: si.id,
            })));
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
        .select("id, name, sku, default_unit, price_reference, description, standard_unit_rel:standard_units!items_standard_unit_id_fkey(name)")
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (itemsData) setItems(itemsData as unknown as AvailableItem[]);
    }

    setIsLoading(false);
  };

  // Handle currency change - auto-set USD rate to 1.0 per database constraint
  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    if (value === 'USD') {
      setExchangeRate('1');
    }
  };

  const handleAddItem = () => {
    setSelectedItems([
      ...selectedItems,
      { id: crypto.randomUUID(), category_id: null, item_id: '', item_name: '', item_sku: '', item_unit: '', item_price_reference: '', item_standard_unit: '', quantity: 1, conversion_rate: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (selectedItems.length === 1) return; // Keep at least one
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, field: keyof Omit<SelectedItem, 'id'>, value: unknown) => {
    setSelectedItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleItemCreatedInline = (newItem: Item) => {
    if (pendingLineId) {
      setSelectedItems(prev => prev.map(item =>
        item.id === pendingLineId
          ? {
              ...item,
              item_id: newItem.id,
              item_name: newItem.name,
              item_sku: newItem.sku || '',
              item_unit: newItem.default_unit || '',
              item_price_reference: newItem.price_reference || '',
            }
          : item
      ));
    }
    // Also add to local items list
    setItems(prev => [
      ...prev,
      {
        id: newItem.id,
        name: newItem.name,
        sku: newItem.sku || null,
        default_unit: newItem.default_unit || null,
        price_reference: newItem.price_reference || null,
        standard_unit_rel: null,
      },
    ]);
    setCreateItemDialogOpen(false);
    setPendingLineId(null);
  };

  const handleCreateDialogClose = (_refresh?: boolean, newItem?: Item) => {
    if (newItem) {
      handleItemCreatedInline(newItem);
    } else {
      setCreateItemDialogOpen(false);
      setPendingLineId(null);
    }
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
        item => item.item_id && item.quantity > 0
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

    // Contact person validation for financial routes
    if (route === "expense" || route === "po") {
      if (!draftData.contact_person_id) {
        toast({
          title: "Validation Error",
          description: "Contact person is required for financial routes. Please go back and select one.",
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
          item => item.item_id && item.quantity > 0
        );

        const { error: itemsError } = await supabase
          .from("qmhq_items")
          .insert(
            validItems.map(item => ({
              qmhq_id: qmhqData.id,
              item_id: item.item_id,
              quantity: item.quantity,
              conversion_rate: parseFloat(item.conversion_rate) > 0 ? parseFloat(item.conversion_rate) : 1,
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
            <PageHeader
              title={`${config.label} Details`}
              description={
                draftData?.line_name ? (
                  <>
                    Line: <span className="text-slate-200">{draftData.line_name}</span>
                  </>
                ) : undefined
              }
              badge={
                <div className={`flex items-center gap-2 px-3 py-1 rounded border ${colors.badge}`}>
                  <Icon className={`h-4 w-4 ${colors.icon}`} />
                  <span className="text-xs font-semibold uppercase tracking-widest">
                    Step 2 of 2
                  </span>
                </div>
              }
              className="mb-0"
            />
          </div>

          {/* Route-specific Form */}
          <div className="space-y-6">
            {/* Item Route Form */}
            {route === "item" && (
              <>
                <FormSection
                  title="Item Selection"
                  icon={<Package className={`h-4 w-4 ${colors.icon}`} />}
                  animationDelay="100ms"
                >
                  <div className="space-y-3">
                    {selectedItems.map((selectedItem, index) => (
                      <div
                        key={selectedItem.id}
                        className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3"
                      >
                        {/* Row 1: Item selector + actions */}
                        <div className="flex items-start gap-2">
                          <span className="text-xs font-mono text-slate-500 mt-2.5 shrink-0 w-5">
                            {index + 1}.
                          </span>
                          <div className="flex-1 min-w-0">
                            {selectedItem.item_id ? (
                              <div className="flex items-center gap-2">
                                <TooltipProvider delayDuration={300}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm cursor-default">
                                        <code className="font-mono text-amber-400 mr-2">
                                          {selectedItem.item_sku || "---"}
                                        </code>
                                        <span className="text-slate-400 mr-2">-</span>
                                        <span className="text-slate-200">{selectedItem.item_name}</span>
                                      </div>
                                    </TooltipTrigger>
                                    {selectedItem.item_price_reference && (
                                      <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs">
                                          <span className="text-slate-400">Price Ref: </span>
                                          <span className="text-slate-200">{selectedItem.item_price_reference}</span>
                                        </p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    handleUpdateItem(selectedItem.id, "category_id", null);
                                    handleUpdateItem(selectedItem.id, "item_id", "");
                                    handleUpdateItem(selectedItem.id, "item_name", "");
                                    handleUpdateItem(selectedItem.id, "item_sku", "");
                                    handleUpdateItem(selectedItem.id, "item_unit", "");
                                    handleUpdateItem(selectedItem.id, "item_price_reference", "");
                                    handleUpdateItem(selectedItem.id, "item_standard_unit", "");
                                  }}
                                  className="h-8 px-2 text-slate-400 hover:text-slate-200"
                                >
                                  Change
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <CategoryItemSelector
                                    categoryId={selectedItem.category_id || ""}
                                    itemId=""
                                    onCategoryChange={(catId) => {
                                      handleUpdateItem(selectedItem.id, "category_id", catId);
                                    }}
                                    onItemChange={(itmId) => {
                                      const found = items.find(i => i.id === itmId);
                                      if (found) {
                                        handleUpdateItem(selectedItem.id, "item_id", itmId);
                                        handleUpdateItem(selectedItem.id, "item_name", found.name);
                                        handleUpdateItem(selectedItem.id, "item_sku", found.sku || "");
                                        handleUpdateItem(selectedItem.id, "item_unit", found.default_unit || "");
                                        handleUpdateItem(selectedItem.id, "item_price_reference", found.price_reference || "");
                                        handleUpdateItem(selectedItem.id, "item_standard_unit", found.standard_unit_rel?.name || "");
                                      }
                                    }}
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => {
                                    setPendingLineId(selectedItem.id);
                                    setCreateItemDialogOpen(true);
                                  }}
                                  className="shrink-0 border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/10 self-start"
                                  title="Create new item"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(selectedItem.id)}
                            disabled={selectedItems.length <= 1}
                            className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Row 2: Qty stepper, Conv. Rate, Std Qty display */}
                        <div className="flex items-end gap-3 pl-7">
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Qty</label>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  handleUpdateItem(
                                    selectedItem.id,
                                    "quantity",
                                    Math.max(1, selectedItem.quantity - 1)
                                  )
                                }
                                disabled={selectedItem.quantity <= 1}
                                className="h-8 w-8 border-slate-700 hover:bg-slate-700"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={selectedItem.quantity === 0 ? "" : selectedItem.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    selectedItem.id,
                                    "quantity",
                                    Math.max(1, Math.floor(parseInt(e.target.value) || 1))
                                  )
                                }
                                onKeyDown={handleQuantityKeyDown}
                                className="w-16 text-center font-mono bg-slate-800 border-slate-700"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  handleUpdateItem(
                                    selectedItem.id,
                                    "quantity",
                                    selectedItem.quantity + 1
                                  )
                                }
                                className="h-8 w-8 border-slate-700 hover:bg-slate-700"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 block mb-1">Conv. Rate</label>
                            <ConversionRateInput
                              value={selectedItem.conversion_rate}
                              onValueChange={(val) => handleUpdateItem(selectedItem.id, "conversion_rate", val)}
                              className="w-28 text-right bg-slate-800 border-slate-700"
                            />
                          </div>
                          {selectedItem.conversion_rate && parseFloat(selectedItem.conversion_rate) !== 1 && parseFloat(selectedItem.conversion_rate) > 0 && selectedItem.quantity > 0 && selectedItem.item_standard_unit && (
                            <div className="pb-2">
                              <span className="text-xs font-mono text-slate-400">
                                = {(selectedItem.quantity * parseFloat(selectedItem.conversion_rate)).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                {selectedItem.item_standard_unit}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Subtotal row (item count) */}
                    <div className="flex items-center justify-end gap-4 pt-2 border-t border-slate-600">
                      <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                        Total Items
                      </span>
                      <span className="text-lg font-mono font-bold text-blue-400">
                        {selectedItems.filter(i => i.item_id && i.quantity > 0).length}
                      </span>
                    </div>

                    {/* Add Item Button */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddItem}
                      className="border-dashed border-slate-600 text-slate-400 hover:border-blue-500/50 hover:text-blue-400"
                    >
                      + Add Line Item
                    </Button>
                  </div>
                </FormSection>

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

                {/* Item creation dialog */}
                <ItemDialog
                  open={createItemDialogOpen}
                  onClose={handleCreateDialogClose}
                  item={null}
                />
              </>
            )}

            {/* Expense Route Form */}
            {route === "expense" && (
              <>
                <FormSection
                  title="Expense Details"
                  icon={<Wallet className={`h-4 w-4 ${colors.icon}`} />}
                  animationDelay="100ms"
                >
                  <div className="grid grid-cols-3 gap-6">
                    <FormField label="Amount" htmlFor="amount" required>
                      <AmountInput
                        id="amount"
                        value={amount}
                        onValueChange={setAmount}
                        className="bg-slate-800/50 border-slate-700 focus:border-emerald-500/50 text-slate-200"
                      />
                    </FormField>

                    <FormField label="Currency" htmlFor="currency">
                      <Select value={currency} onValueChange={handleCurrencyChange}>
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
                    </FormField>

                    <FormField
                      label="Exchange Rate"
                      htmlFor="exchange_rate"
                      required
                      hint={`Rate to convert to EUSD (1 EUSD = X ${currency})`}
                    >
                      <ExchangeRateInput
                        id="exchange_rate"
                        value={exchangeRate}
                        onValueChange={setExchangeRate}
                        disabled={currency === 'USD'}
                        className="bg-slate-800/50 border-slate-700 focus:border-emerald-500/50 text-slate-200"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {currency === 'USD' ? 'USD rate is always 1.0' : `1 EUSD = ${exchangeRate || '1'} ${currency}`}
                      </p>
                    </FormField>
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
                </FormSection>

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
                <FormSection
                  title="Budget Allocation"
                  icon={<ShoppingCart className={`h-4 w-4 ${colors.icon}`} />}
                  animationDelay="100ms"
                >
                  <div className="grid grid-cols-3 gap-6">
                    <FormField label="Budget Amount" htmlFor="amount" required>
                      <AmountInput
                        id="amount"
                        value={amount}
                        onValueChange={setAmount}
                        className="bg-slate-800/50 border-slate-700 focus:border-purple-500/50 text-slate-200"
                      />
                    </FormField>

                    <FormField label="Currency" htmlFor="currency">
                      <Select value={currency} onValueChange={handleCurrencyChange}>
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
                    </FormField>

                    <FormField
                      label="Exchange Rate"
                      htmlFor="exchange_rate"
                      required
                      hint="Rate to convert to EUSD"
                    >
                      <ExchangeRateInput
                        id="exchange_rate"
                        value={exchangeRate}
                        onValueChange={setExchangeRate}
                        disabled={currency === 'USD'}
                        className="bg-slate-800/50 border-slate-700 focus:border-purple-500/50 text-slate-200"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {currency === 'USD' ? 'USD rate is always 1.0' : `1 EUSD = ${exchangeRate || '1'} ${currency}`}
                      </p>
                    </FormField>
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
                </FormSection>

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
        />
      </div>
    </div>
  );
}
