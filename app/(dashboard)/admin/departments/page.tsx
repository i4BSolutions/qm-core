"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2, Code, User, Lock } from "lucide-react";
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
import { DepartmentDialog } from "./department-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { Department, User as UserType } from "@/types/database";

interface DepartmentWithHead extends Department {
  head?: Pick<UserType, "id" | "full_name"> | null;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentWithHead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentWithHead | null>(null);
  const { toast } = useToast();
  const { can } = usePermissions();

  // Permission checks
  const canCreate = can("create", "departments");
  const canUpdate = can("update", "departments");
  const canDelete = can("delete", "departments");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("departments")
      .select(`
        id, name, code, head_id,
        head:users!departments_head_id_fkey(id, full_name)
      `)
      .eq("is_active", true)
      .order("name")
      .limit(200);

    if (data) {
      setDepartments(data as DepartmentWithHead[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("departments")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      const isReferenceError = error.message?.includes("Cannot delete");
      toast({
        title: isReferenceError ? "Cannot Delete" : "Error",
        description: isReferenceError
          ? error.message
          : "Failed to delete department.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Department deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (department: DepartmentWithHead) => {
    setEditingDepartment(department);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingDepartment(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingDepartment(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<DepartmentWithHead>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-200">
            {row.getValue("name")}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => {
        const code = row.getValue("code") as string | null;
        return code ? (
          <code className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-brand-400">
            {code}
          </code>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      accessorKey: "head",
      header: "Department Head",
      cell: ({ row }) => {
        const head = row.original.head as Pick<UserType, "id" | "full_name"> | null;
        return head ? (
          <div className="flex items-center gap-2 text-slate-200">
            <User className="h-3 w-3 text-slate-400" />
            {head.full_name}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const department = row.original;
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
                <DropdownMenuItem onClick={() => handleEdit(department)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => handleDelete(department.id)}
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
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20">
              <Building2 className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
                Admin
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Departments
          </h1>
          <p className="mt-1 text-slate-400">
            {departments.length} department{departments.length !== 1 ? "s" : ""} in system
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Add Department
            </span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
        <DataTable
          columns={columns}
          data={departments}
          searchKey="name"
          searchPlaceholder="Search departments..."
          isLoading={isLoading}
        />
      </div>

      <DepartmentDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        department={editingDepartment}
      />
    </div>
  );
}
