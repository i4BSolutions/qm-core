"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Package, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatAmount } from "@/lib/utils";
import {
  getInventoryKPIs,
  getInventoryTransactions,
  getWarehousesForFilter,
  getItemsForFilter,
  type InventoryKPIs,
  type InventoryTransaction,
  type WarehouseOption,
  type ItemOption,
} from "@/lib/actions/inventory-dashboard";
import { FilterPopover } from "./components/filter-popover";
import { FilterChips, type FilterChip } from "./components/filter-chips";

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);

  // Tab state from URL
  const activeTab = searchParams.get("tab") || "all";

  // Filter state from URL
  const fromDate = searchParams.get("from") || undefined;
  const toDate = searchParams.get("to") || undefined;
  const warehouseId = searchParams.get("warehouse") || undefined;
  const itemId = searchParams.get("item") || undefined;

  // Fetch warehouses and items on mount
  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const [warehousesData, itemsData] = await Promise.all([
          getWarehousesForFilter(),
          getItemsForFilter(),
        ]);
        setWarehouses(warehousesData);
        setItems(itemsData);
      } catch (error) {
        console.error("Error fetching filter options:", error);
      }
    }
    fetchFilterOptions();
  }, []);

  // Fetch KPIs (with filters)
  useEffect(() => {
    async function fetchKPIs() {
      try {
        const data = await getInventoryKPIs({
          fromDate,
          toDate,
          warehouseId,
          itemId,
        });
        setKpis(data);
      } catch (error) {
        console.error("Error fetching KPIs:", error);
      }
    }
    fetchKPIs();
  }, [fromDate, toDate, warehouseId, itemId]);

  // Fetch transactions (with filters)
  useEffect(() => {
    async function fetchTransactions() {
      setIsLoading(true);
      try {
        const movementType =
          activeTab === "in"
            ? "inventory_in"
            : activeTab === "out"
            ? "inventory_out"
            : "all";

        const result = await getInventoryTransactions({
          movementType: movementType as any,
          fromDate,
          toDate,
          warehouseId,
          itemId,
          page: currentPage,
          pageSize,
        });

        setTransactions(result.transactions);
        setTotalCount(result.totalCount);
      } catch (error) {
        console.error("Error fetching transactions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTransactions();
  }, [activeTab, currentPage, pageSize, fromDate, toDate, warehouseId, itemId]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [fromDate, toDate, warehouseId, itemId, activeTab]);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/inventory?${params.toString()}`, { scroll: false });
  };

  // Handle KPI card click - preserve filters
  const handleKPIClick = (tab: string) => {
    handleTabChange(tab);
  };

  // Handle filter changes
  const handleFiltersChange = (filters: {
    fromDate?: string;
    toDate?: string;
    warehouseId?: string;
    itemId?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    // Update or remove filter params
    if (filters.fromDate) {
      params.set("from", filters.fromDate);
    } else {
      params.delete("from");
    }

    if (filters.toDate) {
      params.set("to", filters.toDate);
    } else {
      params.delete("to");
    }

    if (filters.warehouseId) {
      params.set("warehouse", filters.warehouseId);
    } else {
      params.delete("warehouse");
    }

    if (filters.itemId) {
      params.set("item", filters.itemId);
    } else {
      params.delete("item");
    }

    router.replace(`/inventory?${params.toString()}`, { scroll: false });
  };

  // Handle removing a single filter
  const handleRemoveFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());

    switch (key) {
      case "fromDate":
        params.delete("from");
        break;
      case "toDate":
        params.delete("to");
        break;
      case "warehouseId":
        params.delete("warehouse");
        break;
      case "itemId":
        params.delete("item");
        break;
    }

    router.replace(`/inventory?${params.toString()}`, { scroll: false });
  };

  // Handle clearing all filters
  const handleClearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.delete("warehouse");
    params.delete("item");
    router.replace(`/inventory?${params.toString()}`, { scroll: false });
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Generate filter chips
  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];

    if (fromDate) {
      chips.push({
        key: "fromDate",
        label: `From: ${formatDate(fromDate)}`,
      });
    }

    if (toDate) {
      chips.push({
        key: "toDate",
        label: `To: ${formatDate(toDate)}`,
      });
    }

    if (warehouseId) {
      const warehouse = warehouses.find((w) => w.id === warehouseId);
      if (warehouse) {
        chips.push({
          key: "warehouseId",
          label: `Warehouse: ${warehouse.name}`,
        });
      }
    }

    if (itemId) {
      const item = items.find((i) => i.id === itemId);
      if (item) {
        chips.push({
          key: "itemId",
          label: `Item: ${item.name}`,
        });
      }
    }

    return chips;
  }, [fromDate, toDate, warehouseId, itemId, warehouses, items]);

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold tracking-tight text-foreground">
            Inventory Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Stock transaction history with KPIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/inventory/stock-in">
            <Button variant="outline">
              <ArrowDownToLine className="h-4 w-4" />
              Stock In
            </Button>
          </Link>
          <Link href="/inventory/stock-out">
            <Button variant="outline">
              <ArrowUpFromLine className="h-4 w-4" />
              Stock Out
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3">
        <FilterPopover
          warehouses={warehouses}
          items={items}
          currentFilters={{
            fromDate,
            toDate,
            warehouseId,
            itemId,
          }}
          onFiltersChange={handleFiltersChange}
        />
        <FilterChips
          chips={filterChips}
          onRemove={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stock In KPI */}
        <button
          onClick={() => handleKPIClick("in")}
          className="tactical-card p-6 text-left hover:border-emerald-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock In</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {kpis ? kpis.stock_in_count.toLocaleString() : <Skeleton className="h-9 w-20" />}
              </p>
              <p className="mt-1 text-sm text-emerald-400">
                {kpis ? (
                  `${formatCurrency(kpis.stock_in_value_eusd)} EUSD`
                ) : (
                  <Skeleton className="h-5 w-24" />
                )}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ArrowDownToLine className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
        </button>

        {/* Stock Out KPI */}
        <button
          onClick={() => handleKPIClick("out")}
          className="tactical-card p-6 text-left hover:border-red-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock Out</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {kpis ? kpis.stock_out_count.toLocaleString() : <Skeleton className="h-9 w-20" />}
              </p>
              <p className="mt-1 text-sm text-red-400">
                {kpis ? (
                  `${formatCurrency(kpis.stock_out_value_eusd)} EUSD`
                ) : (
                  <Skeleton className="h-5 w-24" />
                )}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <ArrowUpFromLine className="h-6 w-6 text-red-400" />
            </div>
          </div>
        </button>

        {/* Net Movement KPI */}
        <button
          onClick={() => handleKPIClick("all")}
          className="tactical-card p-6 text-left hover:border-amber-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Net Movement</p>
              <p
                className={`mt-2 text-3xl font-bold ${
                  kpis && kpis.net_movement_eusd < 0 ? "text-red-400" : "text-foreground"
                }`}
              >
                {kpis ? (
                  formatCurrency(kpis.net_movement_eusd)
                ) : (
                  <Skeleton className="h-9 w-24" />
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">EUSD</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              {kpis && kpis.net_movement_eusd < 0 ? (
                <TrendingDown className="h-6 w-6 text-red-400" />
              ) : (
                <TrendingUp className="h-6 w-6 text-amber-400" />
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Tabs and Transaction Table */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">
            All ({kpis ? (kpis.stock_in_count + kpis.stock_out_count).toLocaleString() : "..."})
          </TabsTrigger>
          <TabsTrigger value="in">
            Stock In ({kpis ? kpis.stock_in_count.toLocaleString() : "..."})
          </TabsTrigger>
          <TabsTrigger value="out">
            Stock Out ({kpis ? kpis.stock_out_count.toLocaleString() : "..."})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="command-panel">
            {/* Transaction Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Warehouse
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Reference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {isLoading ? (
                    // Loading skeletons
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-6 w-16" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                      </tr>
                    ))
                  ) : transactions.length === 0 ? (
                    // Empty state
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Package className="h-12 w-12 mb-3 opacity-50" />
                          <p className="text-sm">No transactions found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    // Transaction rows
                    transactions.map((transaction) => {
                      const hasInvoice = transaction.invoice_id && transaction.invoice;
                      const hasQMHQ = transaction.qmhq_id && transaction.qmhq;
                      const isClickable = hasInvoice || hasQMHQ;

                      return (
                        <tr
                          key={transaction.id}
                          onClick={() => {
                            if (hasInvoice) {
                              router.push(`/invoice/${transaction.invoice_id}`);
                            } else if (hasQMHQ) {
                              router.push(`/qmhq/${transaction.qmhq_id}`);
                            }
                          }}
                          className={`${
                            isClickable
                              ? "hover:bg-slate-800/50 cursor-pointer"
                              : ""
                          } transition-colors`}
                        >
                          <td className="px-4 py-4 text-sm text-foreground">
                            {formatDate(transaction.transaction_date)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-foreground">
                              {transaction.item?.name || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {transaction.item?.sku}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-foreground">
                            {transaction.warehouse?.name || "Unknown"}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-foreground">
                            {transaction.quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-4">
                            {transaction.movement_type === "inventory_in" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                IN
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                                OUT
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-foreground">
                            {transaction.unit_cost
                              ? formatAmount(transaction.unit_cost, transaction.currency)
                              : "—"}
                          </td>
                          <td className="px-4 py-4">
                            {transaction.total_cost && transaction.total_cost_eusd ? (
                              <div>
                                <div className="text-sm text-foreground">
                                  {formatAmount(transaction.total_cost, transaction.currency)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ({formatCurrency(transaction.total_cost_eusd)} EUSD)
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm text-foreground">
                            {hasInvoice
                              ? transaction.invoice?.invoice_number
                              : hasQMHQ
                              ? transaction.qmhq?.request_id
                              : transaction.reference_no || "Manual"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!isLoading && transactions.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
