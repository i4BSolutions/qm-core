"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// Type definitions for the component
interface CategoryOption {
  id: string;
  name: string;
  color: string | null;
}

interface ItemOption {
  id: string;
  name: string;
  sku: string | null;
  default_unit: string | null;
  price_reference: string | null;
}

interface CategoryItemSelectorProps {
  /** Currently selected category ID */
  categoryId: string;
  /** Currently selected item ID */
  itemId: string;
  /** Callback when category selection changes */
  onCategoryChange: (categoryId: string) => void;
  /** Callback when item selection changes */
  onItemChange: (itemId: string) => void;
  /** Whether the entire selector is disabled */
  disabled?: boolean;
  /** Optional: preloaded categories (skips initial fetch) */
  initialCategories?: CategoryOption[];
  /** Optional: preloaded items for selected category (skips initial fetch) */
  initialItems?: ItemOption[];
}

/**
 * CategoryItemSelector - Two-step category-first item selection
 *
 * This component implements a dependent dropdown pattern where:
 * 1. User selects a category from a searchable dropdown
 * 2. Item dropdown becomes enabled and shows only items in that category
 * 3. Changing category clears the item selection
 *
 * Used across PO, Invoice, and Inventory pages for item selection.
 */
export function CategoryItemSelector({
  categoryId,
  itemId,
  onCategoryChange,
  onItemChange,
  disabled = false,
  initialCategories,
  initialItems,
}: CategoryItemSelectorProps) {
  // Categories state
  const [categories, setCategories] = useState<CategoryOption[]>(
    initialCategories || []
  );
  const [categoriesLoading, setCategoriesLoading] = useState(!initialCategories);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Items state
  const [items, setItems] = useState<ItemOption[]>(initialItems || []);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  // Abort controller for cancelling in-flight requests
  const itemsAbortController = useRef<AbortController | null>(null);

  // Load categories on mount (only categories with active items)
  useEffect(() => {
    if (!initialCategories) {
      loadCategories();
    }
    // Cleanup on unmount
    return () => {
      if (itemsAbortController.current) {
        itemsAbortController.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load items when category changes
  useEffect(() => {
    if (categoryId) {
      loadItems(categoryId);
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  /**
   * Fetch categories that have at least one active item
   */
  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);

    try {
      const supabase = createClient();

      // Fetch categories with entity_type = 'item'
      const { data: cats, error: catsError } = await supabase
        .from("categories")
        .select("id, name, color")
        .eq("entity_type", "item")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (catsError) throw catsError;

      // Get all active items to filter categories
      const { data: allItems, error: itemsError } = await supabase
        .from("items")
        .select("category_id")
        .eq("is_active", true);

      if (itemsError) throw itemsError;

      // Build set of category IDs that have items
      const categoryIdsWithItems = new Set(
        (allItems || [])
          .map((i) => i.category_id)
          .filter((id): id is string => id !== null)
      );

      // Filter to only categories with items
      const categoriesWithItems = (cats || []).filter((c) =>
        categoryIdsWithItems.has(c.id)
      );

      setCategories(categoriesWithItems);
    } catch (error) {
      console.error("Failed to load categories:", error);
      setCategoriesError("Failed to load categories");
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  /**
   * Fetch items for a specific category
   */
  const loadItems = useCallback(async (catId: string) => {
    // Cancel any in-flight request
    if (itemsAbortController.current) {
      itemsAbortController.current.abort();
    }

    // Create new abort controller for this request
    itemsAbortController.current = new AbortController();

    setItemsLoading(true);
    setItemsError(null);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("items")
        .select("id, name, sku, default_unit, price_reference")
        .eq("category_id", catId)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .abortSignal(itemsAbortController.current.signal);

      if (error) {
        // Ignore abort errors
        if (error.message?.includes("aborted")) return;
        throw error;
      }

      setItems(data || []);
    } catch (error: unknown) {
      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") return;

      console.error("Failed to load items:", error);
      setItemsError("Failed to load items");
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }, []);

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const query = categorySearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(query));
  }, [categories, categorySearch]);

  // Filter items by search (matches name AND sku)
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const query = itemSearch.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(query) ||
        i.sku?.toLowerCase().includes(query)
    );
  }, [items, itemSearch]);

  // Get selected options for display
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedItem = items.find((i) => i.id === itemId);

  // Item dropdown is disabled until category is selected
  const isItemDisabled = disabled || !categoryId;

  // Handlers
  const handleCategorySelect = (catId: string) => {
    onCategoryChange(catId);
    onItemChange(""); // Clear item selection per user decision
    setCategoryOpen(false);
    setCategorySearch("");
  };

  const handleItemSelect = (itmId: string) => {
    onItemChange(itmId);
    setItemOpen(false);
    setItemSearch("");
  };

  const handleCategoryOpenChange = (open: boolean) => {
    setCategoryOpen(open);
    if (!open) setCategorySearch("");
  };

  const handleItemOpenChange = (open: boolean) => {
    setItemOpen(open);
    if (!open) setItemSearch("");
  };

  return (
    <div className="space-y-3">
      {/* Category Selector */}
      <div>
        <Popover open={categoryOpen} onOpenChange={handleCategoryOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={categoryOpen}
              aria-label="Select category"
              disabled={disabled || categoriesLoading}
              className={cn(
                "w-full justify-between bg-slate-800/50 border-slate-700",
                "hover:bg-slate-800 hover:border-amber-500/50",
                !categoryId && "text-slate-400"
              )}
            >
              {categoriesLoading ? (
                <span className="text-slate-400">Loading categories...</span>
              ) : categoriesError ? (
                <span className="text-red-400">Error loading categories</span>
              ) : selectedCategory ? (
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: selectedCategory.color || "#6B7280",
                    }}
                  />
                  <span className="text-slate-200">{selectedCategory.name}</span>
                </div>
              ) : (
                <span>Select category...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-900 border-slate-700"
            align="start"
          >
            {/* Search Input */}
            <div className="flex items-center border-b border-slate-700 px-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search category..."
                className="flex h-10 w-full bg-transparent py-3 px-2 text-sm text-slate-200 placeholder:text-slate-400 outline-none"
                autoFocus
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch("")}
                  className="text-slate-400 hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {filteredCategories.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  {categorySearch ? "No categories match search" : "No categories available"}
                </div>
              ) : (
                filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={cn(
                      "relative flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                      "hover:bg-slate-800 hover:text-slate-100",
                      categoryId === cat.id
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-300"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        categoryId === cat.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span
                      className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: cat.color || "#6B7280" }}
                    />
                    <span>{cat.name}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-slate-400 mt-1">
          Selecting a category will filter items below
        </p>
      </div>

      {/* Item Selector */}
      <div>
        <Popover open={itemOpen} onOpenChange={handleItemOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={itemOpen}
              aria-label="Select item"
              disabled={isItemDisabled || itemsLoading}
              className={cn(
                "w-full justify-between bg-slate-800/50 border-slate-700",
                "hover:bg-slate-800 hover:border-amber-500/50",
                !itemId && "text-slate-400",
                isItemDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {itemsLoading ? (
                <span className="text-slate-400">Loading items...</span>
              ) : itemsError ? (
                <span className="text-red-400">Error loading items</span>
              ) : selectedItem ? (
                <span className="flex items-center gap-2">
                  <span className="text-slate-200">{selectedItem.name}</span>
                  {selectedItem.sku && (
                    <code className="text-amber-400 text-xs font-mono">
                      {selectedItem.sku}
                    </code>
                  )}
                </span>
              ) : isItemDisabled ? (
                <span>Select category first...</span>
              ) : (
                <span>Select item...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-900 border-slate-700"
            align="start"
          >
            {/* Search Input */}
            <div className="flex items-center border-b border-slate-700 px-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="flex h-10 w-full bg-transparent py-3 px-2 text-sm text-slate-200 placeholder:text-slate-400 outline-none"
                autoFocus
              />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch("")}
                  className="text-slate-400 hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {items.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No items in this category
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No items match search
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item.id)}
                    className={cn(
                      "relative flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                      "hover:bg-slate-800 hover:text-slate-100",
                      itemId === item.id
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-300"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        itemId === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-slate-200">{item.name}</span>
                    {item.sku && (
                      <code className="ml-2 text-amber-400 text-xs font-mono">
                        {item.sku}
                      </code>
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
