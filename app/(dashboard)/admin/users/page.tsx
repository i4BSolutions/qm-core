"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Radio, Users, Shield, Mail } from "lucide-react";
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
import { UserDialog } from "./user-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { User as UserType, Department } from "@/types/database";

type UserWithDepartment = UserType & {
  departments: Pick<Department, "id" | "name"> | null;
};

const roleConfig: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-red-500" },
  quartermaster: { label: "Quartermaster", color: "bg-purple-500" },
  finance: { label: "Finance", color: "bg-emerald-500" },
  inventory: { label: "Inventory", color: "bg-blue-500" },
  proposal: { label: "Proposal", color: "bg-amber-500" },
  frontline: { label: "Frontline", color: "bg-cyan-500" },
  requester: { label: "Requester", color: "bg-slate-500" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDepartment | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [usersRes, deptsRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, full_name, role, department_id, phone, is_active, departments:departments!department_id(id, name)")
        .neq("is_active", false)
        .order("full_name")
        .limit(200),
      supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (usersRes.error) {
      console.error("Error fetching users:", usersRes.error.message, usersRes.error.code, usersRes.error.details);
    }
    if (usersRes.data) {
      setUsers(usersRes.data as UserWithDepartment[]);
    }
    if (deptsRes.data) {
      setDepartments(deptsRes.data as Department[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate user.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "User deactivated.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (user: UserWithDepartment) => {
    setEditingUser(user);
    setIsCreateMode(false);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setIsCreateMode(true);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingUser(null);
    setIsCreateMode(false);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<UserWithDepartment>[] = [
    {
      accessorKey: "full_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-slate-300">
            {row.original.full_name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <p className="font-medium text-slate-200">{row.original.full_name}</p>
            <p className="text-xs text-slate-400">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const role = roleConfig[row.original.role || "requester"];
        return (
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${role?.color || "bg-slate-500"}`} />
            <span className="text-slate-300">{role?.label || row.original.role}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "departments",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => (
        <span className="text-slate-400">
          {row.original.departments?.name || "—"}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => (
        <span className="text-slate-400 font-mono text-sm">
          {row.original.phone || "—"}
        </span>
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
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // Count users by role
  const roleCounts = users.reduce((acc, user) => {
    const role = user.role || "requester";
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
            User Management
          </h1>
          <p className="mt-1 text-slate-400">
            Manage system users and their roles
          </p>
        </div>
        <Button onClick={handleCreate} className="group">
          <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
          New User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">{users.length}</p>
              <p className="text-xs text-slate-400">Total Users</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">{roleCounts.admin || 0}</p>
              <p className="text-xs text-slate-400">Admins</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">{roleCounts.quartermaster || 0}</p>
              <p className="text-xs text-slate-400">Quartermasters</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">
                {(roleCounts.finance || 0) + (roleCounts.inventory || 0) + (roleCounts.proposal || 0)}
              </p>
              <p className="text-xs text-slate-400">Staff</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="command-panel">
        <DataTable
          columns={columns}
          data={users}
          isLoading={isLoading}
          searchKey="full_name"
          searchPlaceholder="Search users..."
        />
      </div>

      {/* Dialog */}
      <UserDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        user={editingUser}
        departments={departments}
        isCreateMode={isCreateMode}
      />
    </div>
  );
}
