"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpFromLine,
  Loader2,
  Package,
  AlertTriangle,
  Save,
  Warehouse,
  ArrowRightLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  STOCK_OUT_REASON_CONFIG,
  getStockOutReasonHexColor,
  requiresDestinationWarehouse,
  formatStockQuantity,
} from "@/lib/utils/inventory";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/use-toast";
import type {
  Item,
  Warehouse as WarehouseType,
  StockOutReason,
} from "@/types/database";

// Extended item type with stock info
interface ItemWithStock extends Item {
  total_stock?: number;
}

// Stock by warehouse
interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_location: string;
  current_stock: number;
}

export default function StockOutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [items, setItems] = useState<ItemWithStock[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);

  // Form state
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<StockOutReason>("consumption");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");

  // Item stock by warehouse
  const [itemWarehouses, setItemWarehouses] = useState<WarehouseStock[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  useEffect(() => {
    fetchReferenceData();
  }, []);

  // Fetch item stock when item is selected
  useEffect(() => {
    if (selectedItemId) {
      fetchItemStock(selectedItemId);
    } else {
      setItemWarehouses([]);
      setSelectedWarehouseId("");
    }
  }, [selectedItemId]);

  const fetchReferenceData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch items with total stock (through the view would be ideal, but using RPC or manual calculation)
    const { data: itemsData } = await supabase
      .from("items")
      .select("id, name, sku, default_unit, wac_amount, wac_currency")
      .eq("is_active", true)
      .order("name");

    if (itemsData) {
      setItems(itemsData as ItemWithStock[]);
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
  };

  const fetchItemStock = async (itemId: string) => {
    setIsLoadingStock(true);
    const supabase = createClient();

    // Get all inventory transactions for this item
    const { data: transactions } = await supabase
      .from("inventory_transactions")
      .select(`
        warehouse_id,
        movement_type,
        quantity,
        warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name, location)
      `)
      .eq("item_id", itemId)
      .eq("is_active", true)
      .eq("status", "completed");

    if (transactions) {
      // Calculate stock by warehouse
      const stockMap = new Map<string, WarehouseStock>();

      transactions.forEach((t) => {
        const wh = t.warehouse as unknown as {
          id: string;
          name: string;
          location: string;
        };
        if (!wh) return;

        if (!stockMap.has(wh.id)) {
          stockMap.set(wh.id, {
            warehouse_id: wh.id,
            warehouse_name: wh.name,
            warehouse_location: wh.location,
            current_stock: 0,
          });
        }

        const stock = stockMap.get(wh.id)!;
        if (t.movement_type === "inventory_in") {
          stock.current_stock += t.quantity;
        } else if (t.movement_type === "inventory_out") {
          stock.current_stock -= t.quantity;
        }
      });

      // Filter to warehouses with positive stock
      const warehousesWithStock = Array.from(stockMap.values()).filter(
        (wh) => wh.current_stock > 0
      );

      setItemWarehouses(warehousesWithStock);

      // Auto-select first warehouse if only one available
      if (warehousesWithStock.length === 1) {
        setSelectedWarehouseId(warehousesWithStock[0].warehouse_id);
      } else {
        setSelectedWarehouseId("");
      }
    }

    setIsLoadingStock(false);
  };

  // Selected item details
  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedItemId);
  }, [items, selectedItemId]);

  // Selected warehouse stock
  const selectedWarehouseStock = useMemo(() => {
    return itemWarehouses.find(
      (wh) => wh.warehouse_id === selectedWarehouseId
    );
  }, [itemWarehouses, selectedWarehouseId]);

  // Available stock for selected warehouse
  const availableStock = useMemo(() => {
    return selectedWarehouseStock?.current_stock ?? 0;
  }, [selectedWarehouseStock]);

  // Total item stock across all warehouses
  const totalItemStock = useMemo(() => {
    return itemWarehouses.reduce((sum, wh) => sum + wh.current_stock, 0);
  }, [itemWarehouses]);

  // Destination warehouses (exclude source warehouse)
  const destinationWarehouses = useMemo(() => {
    return warehouses.filter((wh) => wh.id !== selectedWarehouseId);
  }, [warehouses, selectedWarehouseId]);

  // Validation
  const hasErrors = useMemo(() => {
    if (!selectedItemId) return true;
    if (!selectedWarehouseId) return true;
    if (quantity <= 0) return true;
    if (quantity > availableStock) return true;
    if (reason === "transfer" && !destinationWarehouseId) return true;
    return false;
  }, [
    selectedItemId,
    selectedWarehouseId,
    quantity,
    availableStock,
    reason,
    destinationWarehouseId,
  ]);

  // Handle submit
  const handleSubmit = async () => {
    if (!user || hasErrors) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create stock out transaction
      const { error: insertError } = await supabase
        .from("inventory_transactions")
        .insert({
          movement_type: "inventory_out",
          item_id: selectedItemId,
          warehouse_id: selectedWarehouseId,
          quantity,
          reason,
          destination_warehouse_id:
            reason === "transfer" ? destinationWarehouseId : null,
          transaction_date: transactionDate.toISOString().split("T")[0],
          notes: notes || null,
          status: "completed",
          created_by: user.id,
        });

      if (insertError) throw insertError;

      // If transfer, also create stock in at destination
      if (reason === "transfer" && destinationWarehouseId) {
        // Get the source item's WAC for the transfer
        const item = items.find((i) => i.id === selectedItemId);

        const { error: transferInError } = await supabase
          .from("inventory_transactions")
          .insert({
            movement_type: "inventory_in",
            item_id: selectedItemId,
            warehouse_id: destinationWarehouseId,
            quantity,
            unit_cost: item?.wac_amount ?? null,
            currency: item?.wac_currency ?? "MMK",
            exchange_rate: 1,
            transaction_date: transactionDate.toISOString().split("T")[0],
            notes: `Transfer from ${selectedWarehouseStock?.warehouse_name || "unknown"}${notes ? `: ${notes}` : ""}`,
            status: "completed",
            created_by: user.id,
          });

        if (transferInError) throw transferInError;

        toast({
          title: "Stock Transfer Completed",
          description: `${quantity} ${selectedItem?.default_unit || "units"} transferred to destination warehouse.`,
          variant: "success",
        });
      } else {
        toast({
          title: "Stock Out Recorded",
          description: `${quantity} ${selectedItem?.default_unit || "units"} of ${selectedItem?.name} issued.`,
          variant: "success",
        });
      }

      // Redirect back to warehouse list
      router.push("/warehouse");
    } catch (err) {
      console.error("Error creating stock out:", err);
      setError(
        err instanceof Error ? err.message : "Failed to record stock out"
      );
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
    <div className="space-y-6 relative max-w-3xl mx-auto">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Header */}
      <div className="relative flex items-start justify-between animate-fade-in">
        <div className="flex items-start gap-4">
          <Link href="/warehouse">
            <Button
              variant="ghost"
              size="icon"
              className="mt-1 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-500/10 border border-red-500/20 mb-2 w-fit">
              <ArrowUpFromLine className="h-4 w-4 text-red-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-red-500">
                Stock Out
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              Issue Stock
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Record inventory issued from warehouse
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

      {/* Item Selection */}
      <div className="command-panel corner-accents animate-slide-up">
        <div className="section-header">
          <Package className="h-4 w-4 text-amber-500" />
          <h2>Select Item</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
              Item *
            </label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select item to issue..." />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <div className="flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.sku && (
                        <code className="text-xs text-amber-400">
                          {item.sku}
                        </code>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item Info */}
          {selectedItem && (
            <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-200">
                    {selectedItem.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedItem.sku && (
                      <code className="text-xs text-amber-400">
                        {selectedItem.sku}
                      </code>
                    )}
                    {selectedItem.default_unit && (
                      <span className="text-xs text-slate-500">
                        Unit: {selectedItem.default_unit}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Stock</p>
                  <p className="text-lg font-mono font-bold text-emerald-400">
                    {isLoadingStock ? (
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                    ) : (
                      formatStockQuantity(
                        totalItemStock,
                        selectedItem.default_unit
                      )
                    )}
                  </p>
                </div>
              </div>

              {/* Stock by Warehouse */}
              {!isLoadingStock && itemWarehouses.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                    Stock by Warehouse
                  </p>
                  <div className="space-y-2">
                    {itemWarehouses.map((wh) => (
                      <div
                        key={wh.warehouse_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-300">
                          {wh.warehouse_name}
                          <span className="text-slate-500 ml-1">
                            ({wh.warehouse_location})
                          </span>
                        </span>
                        <span className="font-mono text-emerald-400">
                          {wh.current_stock}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isLoadingStock && itemWarehouses.length === 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm text-amber-400">
                    No stock available in any warehouse.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Warehouse & Quantity */}
      {selectedItemId && itemWarehouses.length > 0 && (
        <div
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "50ms" }}
        >
          <div className="section-header">
            <Warehouse className="h-4 w-4 text-amber-500" />
            <h2>Source Warehouse & Quantity</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Source Warehouse *
              </label>
              <Select
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {itemWarehouses.map((wh) => (
                    <SelectItem key={wh.warehouse_id} value={wh.warehouse_id}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>
                          {wh.warehouse_name}
                          <span className="text-xs text-slate-500 ml-1">
                            ({wh.warehouse_location})
                          </span>
                        </span>
                        <span className="font-mono text-emerald-400">
                          {wh.current_stock}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Quantity *
              </label>
              <Input
                type="number"
                min="1"
                max={availableStock}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                className={`bg-slate-800/50 border-slate-700 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  quantity > availableStock ? "border-red-500" : ""
                }`}
              />
              <p className="text-xs text-slate-500 mt-1">
                Available:{" "}
                <span className="font-mono text-emerald-400">
                  {availableStock}
                </span>
                {quantity > availableStock && (
                  <span className="text-red-400 ml-2">Exceeds available!</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reason Selection */}
      {selectedWarehouseId && (
        <div
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="section-header">
            <Package className="h-4 w-4 text-amber-500" />
            <h2>Reason</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Stock Out Reason *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(
                  Object.keys(STOCK_OUT_REASON_CONFIG) as StockOutReason[]
                ).map((r) => {
                  const config = STOCK_OUT_REASON_CONFIG[r];
                  const isSelected = reason === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? `${config.bgColor} ${config.borderColor}`
                          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      <p
                        className={`font-medium ${isSelected ? config.color : "text-slate-200"}`}
                      >
                        {config.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {config.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Transfer Destination */}
            {reason === "transfer" && (
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="h-4 w-4 text-purple-400" />
                  <p className="text-sm font-medium text-purple-400">
                    Transfer Destination
                  </p>
                </div>
                <Select
                  value={destinationWarehouseId}
                  onValueChange={setDestinationWarehouseId}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="Select destination warehouse..." />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationWarehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                        <span className="text-xs text-slate-500 ml-1">
                          ({wh.location})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400 mt-2">
                  A corresponding Stock In transaction will be created at the
                  destination warehouse.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Details */}
      {selectedWarehouseId && (
        <div
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "150ms" }}
        >
          <div className="section-header">
            <Package className="h-4 w-4 text-amber-500" />
            <h2>Transaction Details</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
                Transaction Date
              </label>
              <DatePicker
                date={transactionDate}
                onDateChange={(date) => date && setTransactionDate(date)}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="bg-slate-800/50 border-slate-700 min-h-[60px]"
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {selectedWarehouseId && (
        <div
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "200ms" }}
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 uppercase tracking-wider mb-1">
                Quantity Out
              </p>
              <p className="text-2xl font-mono font-bold text-red-400">
                {quantity}
              </p>
            </div>

            <div className="text-center p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Reason
              </p>
              <Badge
                style={{
                  backgroundColor: `${getStockOutReasonHexColor(reason)}20`,
                  color: getStockOutReasonHexColor(reason),
                  borderColor: `${getStockOutReasonHexColor(reason)}40`,
                }}
              >
                {STOCK_OUT_REASON_CONFIG[reason].label}
              </Badge>
            </div>

            <div className="text-center p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-400 uppercase tracking-wider mb-1">
                Remaining Stock
              </p>
              <p className="text-2xl font-mono font-bold text-amber-400">
                {Math.max(0, availableStock - quantity)}
              </p>
            </div>
          </div>
        </div>
      )}

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
          className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Record Stock Out
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
