"use client";

import { useEffect, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Package, Tag, Box, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/tables/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ItemDialog } from "./item-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { Item, Category } from "@/types/database";

// Extended item type with category relation
interface ItemWithCategory extends Item {
  category_rel?: Category | null;
}

export default function ItemsPage() {
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("items")
      .select(`
        id, name, sku, photo_url, category_id,
        category_rel:categories(id, name, color)
      `)
      .eq("is_active", true)
      .order("name")
      .limit(200);

    if (data) {
      setItems(data as ItemWithCategory[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("items")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete item.",
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

  const columns: ColumnDef<ItemWithCategory>[] = [
    {
      accessorKey: "photo_url",
      header: "Photo",
      cell: ({ row }) => {
        const photoUrl = row.getValue("photo_url") as string | null;
        return (
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 bg-slate-800/50 flex items-center justify-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Item"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-4 w-4 text-slate-500" />
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "sku",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="SKU" />
      ),
      cell: ({ row }) => (
        <code className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-brand-400">
          {row.getValue("sku") || "—"}
        </code>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-200">
            {row.getValue("name")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "category_rel",
      header: "Category",
      cell: ({ row }) => {
        const category = row.original.category_rel as Category | null;
        if (!category) {
          return <span className="text-slate-400">—</span>;
        }
        return (
          <Badge
            variant="outline"
            className="border-slate-600"
            style={{
              backgroundColor: `${category.color}20`,
              color: category.color || "#9CA3AF",
              borderColor: `${category.color}40`,
            }}
          >
            <Tag className="mr-1 h-3 w-3" />
            {category.name}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const item = row.original;
        return (
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
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between animate-slide-up">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20">
              <Box className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                Inventory
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Items
          </h1>
          <p className="mt-1 text-slate-400">
            {items.length} item{items.length !== 1 ? "s" : ""} in catalog
          </p>
        </div>
        <Button onClick={handleCreate} className="group relative overflow-hidden">
          <span className="relative z-10 flex items-center gap-2">
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            Add Item
          </span>
        </Button>
      </div>

      {/* Data Table */}
      <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
        <DataTable
          columns={columns}
          data={items}
          searchKey="name"
          searchPlaceholder="Search items..."
          isLoading={isLoading}
        />
      </div>

      <ItemDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        item={editingItem}
      />
    </div>
  );
}
