"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Warehouse,
  MapPin,
  Package,
  Clock,
  AlertTriangle,
  Edit,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Boxes,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, DataTableColumnHeader } from "@/components/tables/data-table";
import { formatCurrency } from "@/lib/utils";
import {
  MOVEMENT_TYPE_CONFIG,
  STOCK_OUT_REASON_CONFIG,
  formatStockQuantity,
} from "@/lib/utils/inventory";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import type { ColumnDef } from "@tanstack/react-table";
import { HistoryTab } from "@/components/history";
import { DetailPageLayout } from "@/components/composite";
import type {
  Warehouse as WarehouseType,
  InventoryTransaction,
  Item,
  MovementType,
  StockOutReason,
} from "@/types/database";

// Constants
const LOW_STOCK_THRESHOLD = 10;

// Extended types
interface WarehouseInventoryItem {
  item_id: string;
  item_name: string;
  item_sku: string | null;
  item_unit: string | null;
  current_stock: number;
  standard_stock: number;
  standard_unit_name: string | null;
  /** Whether this item has a real unit conversion (conversion_rate > 1). False for base/atom items. */
  has_standard_conversion: boolean;
  wac_amount_eusd: number | null;
  total_value_eusd: number;
}

interface InventoryTransactionWithItem extends InventoryTransaction {
  item?: Pick<Item, "id" | "name" | "sku"> | null;
  destination_warehouse?: Pick<WarehouseType, "id" | "name"> | null;
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = params.id as string;

  const [warehouse, setWarehouse] = useState<WarehouseType | null>(null);
  const [inventoryItems, setInventoryItems] = useState<WarehouseInventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionWithItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("inventory");

  const fetchData = useCallback(async () => {
    if (!warehouseId) return;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Fetch warehouse details
      const { data: warehouseData, error: warehouseError } = await supabase
        .from("warehouses")
        .select("*")
        .eq("id", warehouseId)
        .single();

      if (warehouseError) {
        console.error("Error fetching warehouse:", warehouseError);
        throw new Error(warehouseError.message);
      }

      setWarehouse(warehouseData as WarehouseType);

      // Fetch inventory transactions to calculate current stock
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("inventory_transactions")
        .select(`
          *,
          item:items!inventory_transactions_item_id_fkey(id, name, sku, default_unit, wac_amount_eusd, standard_unit_rel:standard_units!items_standard_unit_id_fkey(name)),
          destination_warehouse:warehouses!inventory_transactions_destination_warehouse_id_fkey(id, name),
          conversion_rate,
          standard_qty
        `)
        .eq("warehouse_id", warehouseId)
        .eq("is_active", true)
        .eq("status", "completed")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
        throw new Error(transactionsError.message);
      }

      if (transactionsData) {
        setTransactions(transactionsData as InventoryTransactionWithItem[]);

        // Calculate inventory from transactions
        const inventoryMap = new Map<string, WarehouseInventoryItem>();

        transactionsData.forEach((t) => {
          const item = t.item as unknown as Item | null;
          if (!item) return;

          if (!inventoryMap.has(item.id)) {
            inventoryMap.set(item.id, {
              item_id: item.id,
              item_name: item.name,
              item_sku: item.sku,
              item_unit: item.default_unit,
              current_stock: 0,
              standard_stock: 0,
              standard_unit_name: (item as any).standard_unit_rel?.name || null,
              has_standard_conversion: false, // will be updated below if any transaction has conversion_rate > 1
              wac_amount_eusd: item.wac_amount_eusd,
              total_value_eusd: 0,
            });
          }

          const inv = inventoryMap.get(item.id)!;
          // Track whether any transaction has a real conversion rate (> 1)
          if ((t.conversion_rate ?? 1) > 1) {
            inv.has_standard_conversion = true;
          }
          if (t.movement_type === "inventory_in") {
            inv.current_stock += t.quantity;
            inv.standard_stock += (t.standard_qty ?? t.quantity);
          } else if (t.movement_type === "inventory_out") {
            inv.current_stock -= t.quantity;
            inv.standard_stock -= (t.standard_qty ?? t.quantity);
          }
        });

        // Calculate total values (include all items, even zero-stock)
        const inventoryList = Array.from(inventoryMap.values())
          .map((inv) => ({
            ...inv,
            total_value_eusd: inv.current_stock * (inv.wac_amount_eusd || 0),
          }));

        setInventoryItems(inventoryList);
      }

    } catch (err) {
      console.error('Error fetching warehouse data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load warehouse data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate KPIs (only count items with positive stock)
  const kpis = useMemo(() => {
    const itemsWithStock = inventoryItems.filter((item) => item.current_stock > 0);
    const totalItems = itemsWithStock.length;
    const totalUnits = itemsWithStock.reduce((sum, item) => sum + item.current_stock, 0);
    const totalValueEusd = itemsWithStock.reduce((sum, item) => sum + item.total_value_eusd, 0);
    return { totalItems, totalUnits, totalValueEusd };
  }, [inventoryItems]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Inventory table columns
  const inventoryColumns: ColumnDef<WarehouseInventoryItem>[] = [
    {
      accessorKey: "item_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Item" />
      ),
      cell: ({ row }) => {
        const stock = row.original.current_stock;
        const isZeroStock = stock <= 0;
        return (
          <Link
            href={`/item/${row.original.item_id}`}
            className={`flex items-center gap-2 hover:text-amber-400 transition-colors ${
              isZeroStock ? "opacity-50" : ""
            }`}
          >
            <Package className="h-4 w-4 text-slate-400" />
            <span className={`font-medium ${isZeroStock ? "text-slate-500" : "text-slate-200"}`}>
              {row.getValue("item_name")}
            </span>
          </Link>
        );
      },
    },
    {
      accessorKey: "item_sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }) => {
        const isZeroStock = row.original.current_stock <= 0;
        return (
          <code className={`rounded bg-slate-800 px-2 py-0.5 text-xs font-mono ${
            isZeroStock ? "text-slate-500" : "text-amber-400"
          }`}>
            {row.getValue("item_sku") || "—"}
          </code>
        );
      },
    },
    {
      accessorKey: "item_unit",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Unit" />
      ),
      cell: ({ row }) => {
        const isZeroStock = row.original.current_stock <= 0;
        // Suppress unit text for base items (conversion_rate <= 1 / no real conversion)
        if (!row.original.has_standard_conversion) {
          return <span className="text-slate-500">—</span>;
        }
        return (
          <span className={`text-sm ${isZeroStock ? "text-slate-500" : "text-slate-400"}`}>
            {row.getValue("item_unit") || "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "current_stock",
      meta: { className: "text-right" },
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Stock" className="-ml-0 -mr-3" />
        </div>
      ),
      cell: ({ row }) => {
        const stock = row.getValue("current_stock") as number;
        const standardStock = row.original.standard_stock;
        let colorClass = "text-emerald-400";

        if (stock <= 0) {
          colorClass = "text-slate-500";
        } else if (stock < LOW_STOCK_THRESHOLD) {
          colorClass = "text-amber-400 font-semibold";
        }

        return (
          <div className="text-right">
            <span className={`font-mono ${colorClass}`}>
              {formatStockQuantity(stock)}
            </span>
            {row.original.standard_unit_name && row.original.has_standard_conversion && (
              <div className="text-xs font-mono text-slate-400 mt-1">
                {standardStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {row.original.standard_unit_name}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "wac_amount_eusd",
      meta: { className: "text-right" },
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="WAC (EUSD)" className="-ml-0 -mr-3" />
        </div>
      ),
      cell: ({ row }) => {
        const { wac_amount_eusd, current_stock } = row.original;
        const isZeroStock = current_stock <= 0;

        if (wac_amount_eusd === null || wac_amount_eusd === undefined) {
          return <div className="text-right"><span className="text-slate-500">—</span></div>;
        }

        return (
          <div className={`text-right ${isZeroStock ? "opacity-50" : ""}`}>
            <span className="font-mono text-sm text-slate-200">
              {formatCurrency(wac_amount_eusd)} EUSD
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "total_value_eusd",
      meta: { className: "text-right" },
      header: ({ column }) => (
        <div className="flex justify-end">
          <DataTableColumnHeader column={column} title="Total Value (EUSD)" className="-ml-0 -mr-3" />
        </div>
      ),
      cell: ({ row }) => {
        const { total_value_eusd, current_stock } = row.original;
        const isZeroStock = current_stock <= 0;

        if (total_value_eusd === null || total_value_eusd === undefined || total_value_eusd === 0) {
          return <div className="text-right"><span className="text-slate-500">—</span></div>;
        }

        return (
          <div className={`text-right ${isZeroStock ? "opacity-50" : ""}`}>
            <span className="font-mono text-sm text-slate-200">
              {formatCurrency(total_value_eusd)} EUSD
            </span>
          </div>
        );
      },
    },
  ];

  // Transaction table columns
  const transactionColumns: ColumnDef<InventoryTransactionWithItem>[] = [
    {
      accessorKey: "transaction_date",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Date" />
      ),
      cell: ({ row }) => (
        <span className="text-slate-300">
          {formatDate(row.getValue("transaction_date"))}
        </span>
      ),
    },
    {
      accessorKey: "movement_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("movement_type") as MovementType;
        const config = MOVEMENT_TYPE_CONFIG[type];
        return (
          <Badge
            className={`${config.bgColor} ${config.color} ${config.borderColor}`}
          >
            {type === "inventory_in" ? (
              <ArrowDownToLine className="mr-1 h-3 w-3" />
            ) : (
              <ArrowUpFromLine className="mr-1 h-3 w-3" />
            )}
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "item",
      header: "Item",
      cell: ({ row }) => {
        const item = row.original.item;
        return (
          <div>
            <p className="text-slate-200">{item?.name || row.original.item_name || "—"}</p>
            {(item?.sku || row.original.item_sku) && (
              <code className="text-xs text-amber-400">
                {item?.sku || row.original.item_sku}
              </code>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "quantity",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Qty" />
      ),
      cell: ({ row }) => {
        const type = row.original.movement_type;
        const qty = row.getValue("quantity") as number;
        const conversionRate = row.original.conversion_rate ?? 1;
        const prefix = type === "inventory_in" ? "+" : "-";
        const item = row.original.item as any;
        const standardUnitName = item?.standard_unit_rel?.name || null;
        return (
          <div className={type === "inventory_in" ? "text-emerald-400" : "text-red-400"}>
            <span className="font-mono">{prefix}{qty}</span>
            {standardUnitName && conversionRate > 1 && (
              <div className="text-xs font-mono text-slate-400 mt-1">
                {prefix}{(qty * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {standardUnitName}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "reason",
      header: "Reason",
      cell: ({ row }) => {
        const reason = row.getValue("reason") as StockOutReason | null;
        if (!reason) return <span className="text-slate-500">—</span>;
        const config = STOCK_OUT_REASON_CONFIG[reason];
        return (
          <Badge
            style={{
              backgroundColor: `${config.color.replace("text-", "")}20`,
              color: config.color.replace("text-", "#"),
            }}
            className={`${config.bgColor} ${config.color}`}
          >
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "unit_cost",
      header: "Unit Cost",
      cell: ({ row }) => {
        const unitCost = row.original.unit_cost;
        const currency = row.original.currency;
        const exchangeRate = row.original.exchange_rate;
        const unitCostEusd = row.original.unit_cost_eusd;

        if (!unitCost || !currency) {
          return <span className="text-slate-500">—</span>;
        }

        return (
          <CurrencyDisplay
            amount={unitCost}
            currency={currency}
            exchangeRate={exchangeRate ?? 1}
            amountEusd={unitCostEusd ?? undefined}
            size="sm"
            showDashForEmpty
          />
        );
      },
    },
    {
      accessorKey: "total_cost",
      header: "Total Cost",
      cell: ({ row }) => {
        const totalCost = row.original.total_cost;
        const currency = row.original.currency;
        const exchangeRate = row.original.exchange_rate;
        const totalCostEusd = row.original.total_cost_eusd;

        if (!totalCost || !currency) {
          return <span className="text-slate-500">—</span>;
        }

        return (
          <CurrencyDisplay
            amount={totalCost}
            currency={currency}
            exchangeRate={exchangeRate ?? 1}
            amountEusd={totalCostEusd ?? undefined}
            size="sm"
            showDashForEmpty
          />
        );
      },
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => (
        <span className="text-slate-400 text-sm truncate max-w-[200px] block">
          {row.getValue("notes") || "—"}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading warehouse data...
          </p>
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-200">
          Warehouse Not Found
        </h2>
        <p className="text-slate-400">
          The requested warehouse could not be found.
        </p>
        <Link href="/warehouse">
          <Button variant="outline" className="border-slate-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Warehouses
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <DetailPageLayout
      backHref="/warehouse"
      header={
        <div>
          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <p className="text-red-400">{error}</p>
              </div>
              <button
                onClick={fetchData}
                className="mt-2 text-sm text-red-400 underline hover:text-red-300"
              >
                Click to retry
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 mb-2 w-fit">
            <Warehouse className="h-4 w-4 text-cyan-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-500">
              Warehouse
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-200">
            {warehouse.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-slate-400">
            <MapPin className="h-4 w-4" />
            <span>{warehouse.location}</span>
          </div>
          {warehouse.description && (
            <p className="text-sm text-slate-500 mt-2">
              {warehouse.description}
            </p>
          )}
        </div>
      }
      actions={
        <>
          <Link href={`/inventory/stock-in`}>
            <Button
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Stock In
            </Button>
          </Link>
          <Link href={`/inventory/stock-out`}>
            <Button
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Stock Out
            </Button>
          </Link>
        </>
      }
      kpiPanel={
        <div
          className="grid grid-cols-3 gap-4 animate-slide-up"
          style={{ animationDelay: "50ms" }}
        >
        <div className="command-panel text-center bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Total Value
            </p>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400">
            {formatCurrency(kpis.totalValueEusd)} EUSD
          </p>
          <p className="text-xs text-slate-500 mt-1">EUSD equivalent</p>
        </div>

        <div className="command-panel text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Boxes className="h-5 w-5 text-blue-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Unique Items
            </p>
          </div>
          <p className="text-3xl font-mono font-bold text-blue-400">
            {kpis.totalItems}
          </p>
          <p className="text-xs text-slate-500 mt-1">with stock &gt; 0</p>
        </div>

        <div className="command-panel text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Package className="h-5 w-5 text-emerald-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Total Units
            </p>
          </div>
          <p className="text-3xl font-mono font-bold text-emerald-400">
            {kpis.totalUnits.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-1">units in stock</p>
        </div>
        </div>
      }
    >
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="animate-slide-up"
        style={{ animationDelay: "100ms" }}
      >
        <TabsList className="bg-slate-800/50 border border-slate-700">
          <TabsTrigger
            value="inventory"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Inventory ({inventoryItems.length})
          </TabsTrigger>
          <TabsTrigger
            value="movements"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Stock Movement ({transactions.length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            History
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Package className="h-4 w-4 text-amber-500" />
              <h2>Current Inventory</h2>
            </div>

            {inventoryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  No Items in Stock
                </h3>
                <p className="text-sm text-slate-400 max-w-md">
                  This warehouse has no items with positive stock. Use Stock In
                  to add inventory.
                </p>
                <Link href="/inventory/stock-in" className="mt-4">
                  <Button className="bg-emerald-600 hover:bg-emerald-500">
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                    Add Stock
                  </Button>
                </Link>
              </div>
            ) : (
              <DataTable
                columns={inventoryColumns}
                data={inventoryItems}
                searchKey="item_name"
                searchPlaceholder="Search items..."
              />
            )}
          </div>
        </TabsContent>

        {/* Stock Movement Tab */}
        <TabsContent value="movements" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Clock className="h-4 w-4 text-amber-500" />
              <h2>Stock Movement History</h2>
            </div>

            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  No Transactions
                </h3>
                <p className="text-sm text-slate-400">
                  No stock movements have been recorded for this warehouse.
                </p>
              </div>
            ) : (
              <DataTable
                columns={transactionColumns}
                data={transactions}
                searchKey="item_name"
                searchPlaceholder="Search transactions..."
              />
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <HistoryTab entityType="warehouses" entityId={warehouseId} />
          </div>
        </TabsContent>
      </Tabs>
    </DetailPageLayout>
  );
}
