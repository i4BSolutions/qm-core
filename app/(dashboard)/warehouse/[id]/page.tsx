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
  formatWAC,
} from "@/lib/utils/inventory";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  Warehouse as WarehouseType,
  InventoryTransaction,
  Item,
  MovementType,
  StockOutReason,
} from "@/types/database";

// Extended types
interface WarehouseInventoryItem {
  item_id: string;
  item_name: string;
  item_sku: string | null;
  item_unit: string | null;
  current_stock: number;
  wac_amount: number | null;
  wac_currency: string | null;
  wac_amount_eusd: number | null;
  total_value: number;
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
          item:items!inventory_transactions_item_id_fkey(id, name, sku, default_unit, wac_amount, wac_currency, wac_amount_eusd),
          destination_warehouse:warehouses!inventory_transactions_destination_warehouse_id_fkey(id, name)
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
              wac_amount: item.wac_amount,
              wac_currency: item.wac_currency,
              wac_amount_eusd: item.wac_amount_eusd,
              total_value: 0,
              total_value_eusd: 0,
            });
          }

          const inv = inventoryMap.get(item.id)!;
          if (t.movement_type === "inventory_in") {
            inv.current_stock += t.quantity;
          } else if (t.movement_type === "inventory_out") {
            inv.current_stock -= t.quantity;
          }
        });

        // Calculate total values and filter to positive stock
        const inventoryList = Array.from(inventoryMap.values())
          .filter((inv) => inv.current_stock > 0)
          .map((inv) => ({
            ...inv,
            total_value: inv.current_stock * (inv.wac_amount || 0),
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

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalItems = inventoryItems.length;
    const totalUnits = inventoryItems.reduce((sum, item) => sum + item.current_stock, 0);
    const totalValue = inventoryItems.reduce((sum, item) => sum + item.total_value, 0);
    const totalValueEusd = inventoryItems.reduce((sum, item) => sum + item.total_value_eusd, 0);
    return { totalItems, totalUnits, totalValue, totalValueEusd };
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
      accessorKey: "item_sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }) => (
        <code className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-amber-400">
          {row.getValue("item_sku") || "—"}
        </code>
      ),
    },
    {
      accessorKey: "item_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Item" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/item/${row.original.item_id}`}
          className="flex items-center gap-2 hover:text-amber-400 transition-colors"
        >
          <Package className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-200">
            {row.getValue("item_name")}
          </span>
        </Link>
      ),
    },
    {
      accessorKey: "current_stock",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Stock" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-emerald-400">
          {formatStockQuantity(
            row.getValue("current_stock"),
            row.original.item_unit
          )}
        </span>
      ),
    },
    {
      accessorKey: "wac_amount",
      header: "WAC",
      cell: ({ row }) => (
        <span className="font-mono text-slate-300">
          {formatWAC(row.getValue("wac_amount"), row.original.wac_currency)}
        </span>
      ),
    },
    {
      accessorKey: "wac_amount_eusd",
      header: "WAC (EUSD)",
      cell: ({ row }) => (
        <span className="font-mono text-emerald-400">
          {formatCurrency(row.getValue("wac_amount_eusd") ?? 0)}
        </span>
      ),
    },
    {
      accessorKey: "total_value",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total Value" />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-slate-300">
          {formatCurrency(row.getValue("total_value"))}
        </span>
      ),
    },
    {
      accessorKey: "total_value_eusd",
      header: "Total (EUSD)",
      cell: ({ row }) => (
        <span className="font-mono text-emerald-400 font-medium">
          {formatCurrency(row.getValue("total_value_eusd"))}
        </span>
      ),
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
        return (
          <span
            className={`font-mono ${type === "inventory_in" ? "text-emerald-400" : "text-red-400"}`}
          >
            {type === "inventory_in" ? "+" : "-"}
            {qty}
          </span>
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
      cell: ({ row }) => (
        <span className="font-mono text-slate-300">
          {row.getValue("unit_cost") ? formatCurrency(row.getValue("unit_cost")) : "—"}
        </span>
      ),
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
    <div className="space-y-6 relative">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

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
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* KPI Cards */}
      <div
        className="grid grid-cols-4 gap-4 animate-slide-up"
        style={{ animationDelay: "50ms" }}
      >
        <div className="command-panel text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Boxes className="h-5 w-5 text-blue-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Total Items
            </p>
          </div>
          <p className="text-3xl font-mono font-bold text-blue-400">
            {kpis.totalItems}
          </p>
          <p className="text-xs text-slate-500 mt-1">distinct items</p>
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

        <div className="command-panel text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 text-amber-400" />
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Total Value
            </p>
          </div>
          <p className="text-2xl font-mono font-bold text-amber-400">
            {formatCurrency(kpis.totalValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1">at WAC</p>
        </div>

        <div className="command-panel text-center bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <p className="text-xs text-emerald-400 uppercase tracking-wider">
              Total (EUSD)
            </p>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-400">
            {formatCurrency(kpis.totalValueEusd)}
          </p>
          <p className="text-xs text-slate-500 mt-1">equivalent</p>
        </div>
      </div>

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

        {/* History Tab (placeholder) */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Clock className="h-4 w-4 text-amber-500" />
              <h2>Activity History</h2>
            </div>

            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-300 mb-2">
                Audit Log Coming Soon
              </h3>
              <p className="text-sm text-slate-400 max-w-md">
                Activity history and audit trail will be available in Iteration
                10.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
