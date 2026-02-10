"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Phone, Mail, Truck, Lock } from "lucide-react";
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
import { SupplierDialog } from "./supplier-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { Supplier } from "@/types/database";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const { can } = usePermissions();

  // Permission checks
  const canCreate = can("create", "suppliers");
  const canUpdate = can("update", "suppliers");
  const canDelete = can("delete", "suppliers");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("suppliers")
      .select("id, name, phone, email")
      .eq("is_active", true)
      .order("name")
      .limit(200);

    if (data) {
      setSuppliers(data as Supplier[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      const isReferenceError = error.message?.includes("Cannot delete");
      toast({
        title: isReferenceError ? "Cannot Delete" : "Error",
        description: isReferenceError
          ? error.message
          : "Failed to delete supplier.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Supplier deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingSupplier(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="font-medium text-slate-200">
          {row.getValue("name")}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.getValue("email") as string | null;
        return email ? (
          <div className="flex items-center gap-1 text-slate-200">
            <Mail className="h-3 w-3 text-slate-400" />
            {email}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string | null;
        return phone ? (
          <div className="flex items-center gap-1 text-slate-200 font-mono">
            <Phone className="h-3 w-3 text-slate-400" />
            {phone}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const supplier = row.original;
        if (!canUpdate && !canDelete) {
          return (
            <span className="text-slate-500 flex items-center gap-1">
              <Lock className="h-3 w-3" />
            </span>
          );
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canUpdate && (
                <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => handleDelete(supplier.id)}
                  className="text-red-400 focus:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
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
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Truck className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                Admin
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Suppliers
          </h1>
          <p className="mt-1 text-slate-400">
            {suppliers.length} vendor{suppliers.length !== 1 ? "s" : ""} in system
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Add Supplier
            </span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
        <DataTable
          columns={columns}
          data={suppliers}
          searchKey="name"
          searchPlaceholder="Search suppliers..."
          isLoading={isLoading}
        />
      </div>

      <SupplierDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        supplier={editingSupplier}
      />
    </div>
  );
}
