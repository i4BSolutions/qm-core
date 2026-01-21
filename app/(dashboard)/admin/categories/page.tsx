"use client";

import { useEffect, useState } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Radio, Tag } from "lucide-react";
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
import { CategoryDialog } from "./category-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { Category } from "@/types/database";

const entityTypeLabels: Record<string, string> = {
  qmrl: "QMRL",
  qmhq: "QMHQ",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("categories")
      .select("id, name, entity_type, description, color, display_order")
      .eq("is_active", true)
      .order("entity_type")
      .order("display_order");

    if (data) {
      setCategories(data as Category[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete category.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Category deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingCategory(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<Category>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: row.original.color }}
            />
          )}
          <span className="font-medium text-slate-200">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "entity_type",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Entity Type" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-slate-300 border-slate-600">
          {entityTypeLabels[row.original.entity_type] || row.original.entity_type}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
      cell: ({ row }) => (
        <span className="text-slate-400 text-sm">
          {row.original.description || "—"}
        </span>
      ),
    },
    {
      accessorKey: "display_order",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => (
        <span className="text-slate-400 font-mono">{row.original.display_order}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row.original.id)}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20">
              <Radio className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">
                Admin
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-200">
            Category Management
          </h1>
          <p className="mt-1 text-slate-400">
            Configure category options for QMRL and QMHQ
          </p>
        </div>
        <Button onClick={handleCreate} className="group">
          <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
          New Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">
                {categories.filter((c) => c.entity_type === "qmrl").length}
              </p>
              <p className="text-xs text-slate-400">QMRL Categories</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">
                {categories.filter((c) => c.entity_type === "qmhq").length}
              </p>
              <p className="text-xs text-slate-400">QMHQ Categories</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Tag className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">{categories.length}</p>
              <p className="text-xs text-slate-400">Total Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="command-panel">
        <DataTable
          columns={columns}
          data={categories}
          isLoading={isLoading}
          searchKey="name"
          searchPlaceholder="Search categories..."
        />
      </div>

      {/* Dialog */}
      <CategoryDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        category={editingCategory}
      />
    </div>
  );
}
