"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Loader2,
  Package,
  Clock,
  AlertTriangle,
  Edit,
  ArrowDownToLine,
  ArrowUpFromLine,
  DollarSign,
  Warehouse,
  Tag,
  ImageIcon,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, DataTableColumnHeader } from "@/components/tables/data-table";
import { formatCurrency } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import {
  MOVEMENT_TYPE_CONFIG,
  STOCK_OUT_REASON_CONFIG,
  formatStockQuantity,
  formatWAC,
  formatExchangeRate,
} from "@/lib/utils/inventory";
import type { ColumnDef } from "@tanstack/react-table";
import { HistoryTab } from "@/components/history";
import { DetailPageLayout } from "@/components/composite";
import type {
  Item,
  Category,
  InventoryTransaction,
  Warehouse as WarehouseType,
  MovementType,
  StockOutReason,
} from "@/types/database";

// Extended types
interface ItemWithCategory extends Item {
  category_rel?: Category | null;
  standard_unit_rel?: { id: string; name: string } | null;
}

interface WarehouseStock {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_location: string;
  current_stock: number;
  total_value: number;
  total_value_eusd: number;
}

interface InventoryTransactionWithWarehouse extends InventoryTransaction {
  warehouse?: Pick<WarehouseType, "id" | "name" | "location"> | null;
  destination_warehouse?: Pick<WarehouseType, "id" | "name"> | null;
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<ItemWithCategory | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransactionWithWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch item details
    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select(`
        *,
        category_rel:categories!items_category_id_fkey(id, name, color),
        standard_unit_rel:standard_units!items_standard_unit_id_fkey(id, name)
      `)
      .eq("id", itemId)
      .single();

    if (itemError) {
      console.error("Error fetching item:", itemError);
      setIsLoading(false);
      return;
    }

    setItem(itemData as unknown as ItemWithCategory);

    // Fetch inventory transactions
    const { data: transactionsData } = await supabase
      .from("inventory_transactions")
      .select(`
        *,
        warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name, location),
        destination_warehouse:warehouses!inventory_transactions_destination_warehouse_id_fkey(id, name)
      `)
      .eq("item_id", itemId)
      .eq("is_active", true)
      .eq("status", "completed")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (transactionsData) {
      setTransactions(transactionsData as InventoryTransactionWithWarehouse[]);

      // Calculate stock by warehouse
      const stockMap = new Map<string, WarehouseStock>();

      transactionsData.forEach((t) => {
        const wh = t.warehouse as unknown as {
          id: string;
          name: string;
          location: string;
        } | null;
        if (!wh) return;

        if (!stockMap.has(wh.id)) {
          stockMap.set(wh.id, {
            warehouse_id: wh.id,
            warehouse_name: wh.name,
            warehouse_location: wh.location,
            current_stock: 0,
            total_value: 0,
            total_value_eusd: 0,
          });
        }

        const stock = stockMap.get(wh.id)!;
        if (t.movement_type === "inventory_in") {
          stock.current_stock += t.quantity;
        } else if (t.movement_type === "inventory_out") {
          stock.current_stock -= t.quantity;
        }
      });

      // Calculate values and filter
      const wac = itemData?.wac_amount || 0;
      const wacEusd = itemData?.wac_amount_eusd || 0;

      const stockList = Array.from(stockMap.values())
        .filter((s) => s.current_stock > 0)
        .map((s) => ({
          ...s,
          total_value: s.current_stock * wac,
          total_value_eusd: s.current_stock * wacEusd,
        }));

      setWarehouseStock(stockList);
    }

    setIsLoading(false);
  }, [itemId]);

  useEffect(() => {
    if (itemId) {
      fetchData();
    }
  }, [itemId, fetchData]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalStock = warehouseStock.reduce((sum, wh) => sum + wh.current_stock, 0);
    const totalValue = warehouseStock.reduce((sum, wh) => sum + wh.total_value, 0);
    const totalValueEusd = warehouseStock.reduce((sum, wh) => sum + wh.total_value_eusd, 0);
    return { totalStock, totalValue, totalValueEusd };
  }, [warehouseStock]);

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Stock by warehouse table columns
  const stockColumns: ColumnDef<WarehouseStock>[] = [
    {
      accessorKey: "warehouse_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Warehouse" />
      ),
      cell: ({ row }) => (
        <Link
          href={`/warehouse/${row.original.warehouse_id}`}
          className="flex items-center gap-2 hover:text-amber-400 transition-colors"
        >
          <Warehouse className="h-4 w-4 text-slate-400" />
          <div>
            <span className="font-medium text-slate-200">
              {row.getValue("warehouse_name")}
            </span>
            <p className="text-xs text-slate-500">
              {row.original.warehouse_location}
            </p>
          </div>
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
          {formatStockQuantity(row.getValue("current_stock"), item?.default_unit)}
        </span>
      ),
    },
    {
      accessorKey: "total_value",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Value at WAC" />
      ),
      cell: ({ row }) => (
        <CurrencyDisplay
          amount={row.getValue("total_value")}
          currency={item?.wac_currency || "USD"}
          amountEusd={row.original.total_value_eusd}
          size="sm"
          align="right"
        />
      ),
    },
  ];

  // Transaction table columns
  const transactionColumns: ColumnDef<InventoryTransactionWithWarehouse>[] = [
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
      accessorKey: "warehouse",
      header: "Warehouse",
      cell: ({ row }) => {
        const wh = row.original.warehouse;
        return (
          <Link
            href={`/warehouse/${wh?.id}`}
            className="text-slate-300 hover:text-amber-400 transition-colors"
          >
            {wh?.name || "—"}
          </Link>
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
          <Badge className={`${config.bgColor} ${config.color}`}>
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
          {row.getValue("unit_cost")
            ? formatCurrency(row.getValue("unit_cost"))
            : "—"}
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
            Loading item data...
          </p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-200">Item Not Found</h2>
        <p className="text-slate-400">The requested item could not be found.</p>
        <Link href="/item">
          <Button variant="outline" className="border-slate-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Items
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <DetailPageLayout
      backHref="/item"
      header={
        <>
          {/* Item Photo */}
          <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-800/50 flex items-center justify-center">
            {item.photo_url ? (
              <Image
                src={item.photo_url}
                alt={item.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-slate-500" />
            )}
          </div>

          <div>
            {/* SKU Badge */}
            {item.sku && (
              <div className="request-id-badge mb-2">
                <code className="text-sm">{item.sku}</code>
              </div>
            )}

            <h1 className="text-2xl font-bold tracking-tight text-slate-200">
              {item.name}
            </h1>

            <div className="flex items-center gap-3 mt-2">
              {item.category_rel && (
                <Badge
                  style={{
                    backgroundColor: `${item.category_rel.color}20`,
                    color: item.category_rel.color || "#9CA3AF",
                    borderColor: `${item.category_rel.color}40`,
                  }}
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {item.category_rel.name}
                </Badge>
              )}
              {item.standard_unit_rel && (
                <span className="text-sm text-slate-500">
                  Unit: {item.standard_unit_rel.name}
                </span>
              )}
            </div>
          </div>
        </>
      }
      actions={
        <>
          <Link href="/inventory/stock-in">
            <Button
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Stock In
            </Button>
          </Link>
          <Link href="/inventory/stock-out">
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
          className="command-panel corner-accents animate-slide-up"
          style={{ animationDelay: "50ms" }}
        >
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">
                Total Stock
              </p>
              <p className="text-2xl font-mono font-bold text-emerald-400">
                {formatStockQuantity(totals.totalStock, item.default_unit)}
              </p>
            </div>

            <div className="text-center p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                Warehouses
              </p>
              <p className="text-2xl font-mono font-bold text-slate-200">
                {warehouseStock.length}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col items-center">
              <p className="text-xs text-amber-400 uppercase tracking-wider mb-2">
                WAC (Per Unit)
              </p>
              <CurrencyDisplay
                amount={item.wac_amount}
                currency={item.wac_currency || "USD"}
                exchangeRate={item.wac_exchange_rate || 1}
                amountEusd={item.wac_amount_eusd}
                size="md"
                showDashForEmpty
              />
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col items-center">
              <p className="text-xs text-blue-400 uppercase tracking-wider mb-2">
                Total Value
              </p>
              <CurrencyDisplay
                amount={totals.totalValue}
                currency={item.wac_currency || "USD"}
                amountEusd={totals.totalValueEusd}
                size="md"
                showDashForEmpty
              />
            </div>
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
            value="details"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value="stock"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Stock by Warehouse ({warehouseStock.length})
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            Transactions ({transactions.length})
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
          >
            History
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="command-panel corner-accents">
              <div className="section-header">
                <Package className="h-4 w-4 text-amber-500" />
                <h2>Item Information</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Name
                    </p>
                    <p className="text-slate-200">{item.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      SKU
                    </p>
                    <code className="text-amber-400">{item.sku || "—"}</code>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Category
                    </p>
                    <p className="text-slate-200">
                      {item.category_rel?.name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Standard Unit
                    </p>
                    <p className="text-slate-200">{item.standard_unit_rel?.name || "—"}</p>
                  </div>
                </div>

                {item.description && (
                  <>
                    <div className="divider-accent" />
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                        Description
                      </p>
                      <p className="text-slate-300">{item.description}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="command-panel corner-accents">
              <div className="section-header">
                <DollarSign className="h-4 w-4 text-amber-500" />
                <h2>WAC Valuation</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                      WAC (Per Unit)
                    </p>
                    <CurrencyDisplay
                      amount={item.wac_amount}
                      currency={item.wac_currency || "USD"}
                      exchangeRate={item.wac_exchange_rate || 1}
                      amountEusd={item.wac_amount_eusd}
                      size="lg"
                      showDashForEmpty
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
                      Exchange Rate
                    </p>
                    <p className="font-mono text-slate-200">
                      {formatExchangeRate(item.wac_exchange_rate)}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30 mt-4">
                  <p className="text-sm text-blue-400">
                    <strong>Note:</strong> WAC (Weighted Average Cost) is
                    automatically updated when stock is received with unit cost.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Stock by Warehouse Tab */}
        <TabsContent value="stock" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Warehouse className="h-4 w-4 text-amber-500" />
              <h2>Stock by Warehouse</h2>
            </div>

            {warehouseStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <Warehouse className="h-8 w-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300 mb-2">
                  No Stock Available
                </h3>
                <p className="text-sm text-slate-400 max-w-md">
                  This item has no stock in any warehouse. Use Stock In to add
                  inventory.
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
                columns={stockColumns}
                data={warehouseStock}
                searchKey="warehouse_name"
                searchPlaceholder="Search warehouses..."
              />
            )}
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          <div className="command-panel corner-accents">
            <div className="section-header">
              <Clock className="h-4 w-4 text-amber-500" />
              <h2>Transaction History</h2>
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
                  No stock movements have been recorded for this item.
                </p>
              </div>
            ) : (
              <DataTable
                columns={transactionColumns}
                data={transactions}
                searchKey="notes"
                searchPlaceholder="Search transactions..."
              />
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <div className="command-panel corner-accents">
            <HistoryTab entityType="items" entityId={itemId} />
          </div>
        </TabsContent>
      </Tabs>
    </DetailPageLayout>
  );
}
