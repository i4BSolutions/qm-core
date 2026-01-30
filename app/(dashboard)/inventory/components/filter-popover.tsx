"use client";

import { useState, useMemo } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export interface FilterPopoverProps {
  warehouses: { id: string; name: string }[];
  items: { id: string; name: string; sku: string }[];
  currentFilters: {
    fromDate?: string;
    toDate?: string;
    warehouseId?: string;
    itemId?: string;
  };
  onFiltersChange: (filters: FilterPopoverProps["currentFilters"]) => void;
}

export function FilterPopover({
  warehouses,
  items,
  currentFilters,
  onFiltersChange,
}: FilterPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Local state for filter values
  const [fromDate, setFromDate] = useState<Date | undefined>(
    currentFilters.fromDate ? new Date(currentFilters.fromDate) : undefined
  );
  const [toDate, setToDate] = useState<Date | undefined>(
    currentFilters.toDate ? new Date(currentFilters.toDate) : undefined
  );
  const [warehouseId, setWarehouseId] = useState<string | undefined>(
    currentFilters.warehouseId
  );
  const [itemId, setItemId] = useState<string | undefined>(
    currentFilters.itemId
  );
  const [itemSearchTerm, setItemSearchTerm] = useState("");

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!itemSearchTerm) return items;
    const term = itemSearchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term)
    );
  }, [items, itemSearchTerm]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (currentFilters.fromDate) count++;
    if (currentFilters.toDate) count++;
    if (currentFilters.warehouseId) count++;
    if (currentFilters.itemId) count++;
    return count;
  }, [currentFilters]);

  // Handle apply filters
  const handleApply = () => {
    onFiltersChange({
      fromDate: fromDate ? fromDate.toISOString().split("T")[0] : undefined,
      toDate: toDate ? toDate.toISOString().split("T")[0] : undefined,
      warehouseId: warehouseId || undefined,
      itemId: itemId || undefined,
    });
    setIsOpen(false);
  };

  // Handle clear all
  const handleClearAll = () => {
    setFromDate(undefined);
    setToDate(undefined);
    setWarehouseId(undefined);
    setItemId(undefined);
    setItemSearchTerm("");
  };

  // Get selected item for display
  const selectedItem = items.find((item) => item.id === itemId);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-1 h-5 min-w-5 rounded-full bg-amber-500/20 text-amber-400 border-amber-500/30 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          {/* Date Range Section */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400 font-medium">
              Date Range
            </label>
            <div className="space-y-2">
              <DatePicker
                date={fromDate}
                onDateChange={setFromDate}
                placeholder="From date"
                maxDate={toDate}
              />
              <DatePicker
                date={toDate}
                onDateChange={setToDate}
                placeholder="To date"
                minDate={fromDate}
              />
            </div>
          </div>

          <Separator className="bg-slate-700" />

          {/* Warehouse Section */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400 font-medium">
              Warehouse
            </label>
            <Select value={warehouseId || "all"} onValueChange={(value) => setWarehouseId(value === "all" ? undefined : value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-slate-700" />

          {/* Item Section */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400 font-medium">
              Item
            </label>
            <Input
              placeholder="Search items by name or SKU..."
              value={itemSearchTerm}
              onChange={(e) => setItemSearchTerm(e.target.value)}
              className="mb-2"
            />
            <Select value={itemId || "all"} onValueChange={(value) => setItemId(value === "all" ? undefined : value)}>
              <SelectTrigger>
                <SelectValue placeholder={selectedItem ? `${selectedItem.name} (${selectedItem.sku})` : "All Items"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                {filteredItems.length === 0 && itemSearchTerm ? (
                  <div className="px-2 py-2 text-sm text-slate-400">
                    No items found
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.sku})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-slate-700" />

          {/* Actions Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleClearAll}
              className="text-sm text-slate-400 hover:text-amber-400 transition-colors"
            >
              Clear all
            </button>
            <Button onClick={handleApply} size="sm">
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
