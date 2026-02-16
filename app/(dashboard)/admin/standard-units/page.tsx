"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Radio, Tag, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { DataTable, DataTableColumnHeader } from "@/components/tables/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { UnitDialog } from "./unit-dialog";
import { PageHeader } from "@/components/composite";
import type { ColumnDef } from "@tanstack/react-table";
import type { StandardUnit } from "@/types/database";

export default function StandardUnitsPage() {
  const [units, setUnits] = useState<StandardUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<StandardUnit | null>(null);
  const { toast } = useToast();
  const { can } = usePermissions();

  // Permission checks (using categories as admin proxy)
  const canCreate = can("create", "categories");
  const canUpdate = can("update", "categories");
  const canDelete = can("delete", "categories");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("standard_units" as any)
      .select("id, name, display_order, created_at, updated_at, created_by, updated_by")
      .order("display_order");

    if (data) {
      setUnits(data as unknown as StandardUnit[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("standard_units" as any)
      .delete()
      .eq("id", id);

    if (error) {
      const isReferenceError = error.message?.includes("violates foreign key") || error.message?.includes("Cannot delete");
      toast({
        title: isReferenceError ? "Cannot Delete" : "Error",
        description: isReferenceError
          ? "This unit is in use by items and cannot be deleted."
          : "Failed to delete unit.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Unit deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (unit: StandardUnit) => {
    setEditingUnit(unit);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUnit(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingUnit(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<StandardUnit>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <span className="font-medium text-slate-200">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "item_count",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Item Count" />,
      cell: ({ row }) => (
        <span className="text-slate-400" title="Available after item assignment">
          0
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
        (canUpdate || canDelete) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate && (
                <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => handleDelete(row.original.id)}
                  className="text-red-400 focus:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-slate-500 flex items-center gap-1">
            <Lock className="h-3 w-3" />
          </span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standard Units"
        description="Manage units of measurement for items"
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20">
            <Radio className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">
              Admin
            </span>
          </div>
        }
        actions={
          canCreate && (
            <Button onClick={handleCreate} className="group">
              <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
              New Unit
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="command-panel p-4">
        <div className="flex items-center gap-3">
          <Tag className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-2xl font-bold text-slate-200">{units.length}</p>
            <p className="text-xs text-slate-400">Total Units</p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="command-panel">
        <DataTable
          columns={columns}
          data={units}
          isLoading={isLoading}
          searchKey="name"
          searchPlaceholder="Search units..."
        />
      </div>

      {/* Dialog */}
      <UnitDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        unit={editingUnit}
      />
    </div>
  );
}
