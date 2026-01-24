"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Warehouse, MapPin } from "lucide-react";
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
import { WarehouseDialog } from "./warehouse-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { Warehouse as WarehouseType } from "@/types/database";

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("warehouses")
      .select("id, name, location, description, capacity_notes")
      .eq("is_active", true)
      .order("name")
      .limit(50);

    if (data) {
      setWarehouses(data as WarehouseType[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("warehouses")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete warehouse.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Warehouse deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (warehouse: WarehouseType) => {
    setEditingWarehouse(warehouse);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingWarehouse(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingWarehouse(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<WarehouseType>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Warehouse className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-200">
            {row.getValue("name")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-slate-200">
          <MapPin className="h-3 w-3 text-slate-400" />
          {row.getValue("location")}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-slate-200">
          {row.getValue("description") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "capacity_notes",
      header: "Capacity Notes",
      cell: ({ row }) => (
        <span className="text-slate-400 text-sm">
          {row.getValue("capacity_notes") || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const warehouse = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(warehouse)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(warehouse.id)}
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
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-cyan-500/10 border border-cyan-500/20">
              <Warehouse className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                Storage
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Warehouses
          </h1>
          <p className="mt-1 text-slate-400">
            {warehouses.length} location{warehouses.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button onClick={handleCreate} className="group relative overflow-hidden">
          <span className="relative z-10 flex items-center gap-2">
            <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
            Add Warehouse
          </span>
        </Button>
      </div>

      {/* Data Table */}
      <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
        <DataTable
          columns={columns}
          data={warehouses}
          searchKey="name"
          searchPlaceholder="Search warehouses..."
          isLoading={isLoading}
        />
      </div>

      <WarehouseDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        warehouse={editingWarehouse}
      />
    </div>
  );
}
