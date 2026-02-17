"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Tag,
  Box,
  ImageIcon,
  AlertCircle,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/use-toast";
import { ItemDialog } from "./item-dialog";
import { PageHeader, FilterBar } from "@/components/composite";
import { usePaginationParams } from "@/lib/hooks";
import type { Item, Category } from "@/types/database";

// Extended item type with category relation
interface ItemWithCategory extends Item {
  category_rel?: Category | null;
  standard_unit_rel?: { id: string; name: string } | null;
}

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [categories, setCategories] = useState<Pick<Category, "id" | "name" | "color">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const viewMode = "list" as const;
  const { toast } = useToast();

  // URL-driven pagination
  const {
    page: currentPage,
    pageSize,
    setPage: setCurrentPage,
    setPageSize,
  } = usePaginationParams(20);

  // Filter change handlers that reset page to 1
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategoryFilter(value);
      setCurrentPage(1);
    },
    [setCurrentPage]
  );


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const [itemsRes, categoriesRes] = await Promise.all([
        supabase
          .from("items")
          .select(`
            id, name, sku, photo_url, category_id, price_reference, standard_unit_id,
            category_rel:categories(id, name, color),
            standard_unit_rel:standard_units!items_standard_unit_id_fkey(id, name)
          `)
          .eq("is_active", true)
          .order("name")
          .limit(200),
        supabase
          .from("categories")
          .select("id, name, color")
          .eq("is_active", true)
          .order("name"),
      ]);

      // Check for errors
      if (itemsRes.error) {
        console.error('Items query error:', itemsRes.error);
        throw new Error(itemsRes.error.message);
      }
      if (categoriesRes.error) {
        console.error('Categories query error:', categoriesRes.error);
        throw new Error(categoriesRes.error.message);
      }

      // Set data
      if (itemsRes.data) {
        setItems(itemsRes.data as unknown as ItemWithCategory[]);
      }
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
      }

    } catch (err) {
      console.error('Error fetching items data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load items';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("items")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      const isReferenceError = error.message?.includes("Cannot delete");
      toast({
        title: isReferenceError ? "Cannot Delete" : "Error",
        description: isReferenceError
          ? error.message
          : "Failed to delete item.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Item deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingItem(null);
    if (refresh) {
      fetchData();
    }
  };

  // Client-side filtering
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          item.name?.toLowerCase().includes(query) ||
          item.sku?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
      return true;
    });
  }, [items, searchQuery, categoryFilter]);

  // Pagination calculations
  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredItems.slice(start, end);
  }, [filteredItems, currentPage, pageSize]);

  // Count active filters
  const activeFilterCount = [categoryFilter !== "all"].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-50" />

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

      <PageHeader
        title="Items"
        description={`${totalItems} item${totalItems !== items.length ? ` (of ${items.length} total)` : totalItems !== 1 ? "s" : ""} in catalog`}
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20">
            <Box className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Inventory
            </span>
          </div>
        }
        actions={
          <Button onClick={handleCreate} className="group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Add Item
            </span>
          </Button>
        }
      />

      {/* Filters Bar */}
      <FilterBar>
        {/* Search always visible */}
        <FilterBar.Search
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search items by name or SKU..."
        />

        {/* Desktop filters */}
        <div className="hidden md:flex items-center gap-4">
          <Select value={categoryFilter} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
              <Tag className="mr-2 h-4 w-4 text-slate-400" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Mobile filters button */}
        <div className="flex md:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-slate-700">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="start">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Category</p>
                <Select value={categoryFilter} onValueChange={handleCategoryChange}>
                  <SelectTrigger className="w-full bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </PopoverContent>
          </Popover>
        </div>

      </FilterBar>

      {/* List View */}
      {viewMode === "list" && (
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Photo
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    SKU
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Category
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Unit
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Price Ref
                  </th>
                  <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400" />
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400 text-sm">
                      No items found
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/item/${item.id}`)}
                    >
                      {/* Photo */}
                      <td className="py-3 px-4">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-800/50 flex items-center justify-center">
                          {item.photo_url ? (
                            <Image
                              src={item.photo_url}
                              alt="Item"
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-3 px-4">
                        <code className="rounded bg-slate-800 px-2 py-1 text-sm font-mono font-semibold text-amber-400">
                          {item.sku || "—"}
                        </code>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          <span className="font-medium text-slate-200">{item.name}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        {item.category_rel ? (
                          <Badge
                            variant="outline"
                            className="border-slate-600"
                            style={{
                              backgroundColor: `${item.category_rel.color}20`,
                              color: item.category_rel.color || "#9CA3AF",
                              borderColor: `${item.category_rel.color}40`,
                            }}
                          >
                            <Tag className="mr-1 h-3 w-3" />
                            {item.category_rel.name}
                          </Badge>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-300">
                          {item.standard_unit_rel?.name || "—"}
                        </span>
                      </td>

                      {/* Price Reference */}
                      <td className="py-3 px-4">
                        {item.price_reference ? (
                          <span
                            className="text-sm text-slate-300 truncate max-w-[200px] block"
                            title={item.price_reference}
                          >
                            {item.price_reference}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(item)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(item.id)}
                              className="text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="command-panel mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      <ItemDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        item={editingItem}
      />
    </div>
  );
}
