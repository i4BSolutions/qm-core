"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, MoreHorizontal, Pencil, UserX, RotateCcw, Radio, Users, Lock, Eye } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useResourcePermissions } from "@/lib/hooks/use-permissions";
import { useAuth } from "@/components/providers/auth-provider";
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
import { DeactivateUserDialog } from "./deactivate-user-dialog";
import { PageHeader } from "@/components/composite";
import type { ColumnDef } from "@tanstack/react-table";
import type { User as UserType, Department } from "@/types/database";

type UserWithDepartment = UserType & {
  departments: Pick<Department, "id" | "name"> | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDepartment | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState<UserWithDepartment | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const { toast } = useToast();
  const { canEdit } = useResourcePermissions();
  const { user: currentUser } = useAuth();

  // Permission checks — edit on admin resource covers all admin CRUD
  const canCreate = canEdit("admin");
  const canUpdate = canEdit("admin");
  const canDelete = canEdit("admin");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [usersRes, deptsRes] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, full_name, department_id, phone, is_active, departments:departments!department_id(id, name)")
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

  const handleDeactivate = async (reason?: string) => {
    if (!deactivatingUser) return;

    setIsDeactivating(true);

    try {
      const response = await fetch("/api/admin/deactivate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: deactivatingUser.id,
          reason: reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deactivate user");
      }

      toast({
        title: "Success",
        description: "User deactivated successfully.",
        variant: "success",
      });

      setDeactivateDialogOpen(false);
      setDeactivatingUser(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to deactivate user.",
        variant: "destructive",
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async (userId: string, userName: string) => {
    if (!window.confirm(`Reactivate ${userName}? They will be able to log in again.`)) {
      return;
    }

    try {
      const response = await fetch("/api/admin/reactivate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reactivate user");
      }

      toast({
        title: "Success",
        description: "User reactivated successfully.",
        variant: "success",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate user.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (user: UserWithDepartment) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingUser(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<UserWithDepartment>[] = [
    {
      accessorKey: "full_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const isInactive = !row.original.is_active;
        return (
          <Link
            href={`/admin/users/${row.original.id}`}
            className={`flex items-center gap-3 hover:opacity-80 transition-opacity ${isInactive ? "opacity-50" : ""}`}
          >
            <UserAvatar fullName={row.original.full_name || "?"} size={32} />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-200 hover:text-amber-400 transition-colors">{row.original.full_name}</p>
                {isInactive && (
                  <Badge variant="outline" className="text-red-400 border-red-500/30 text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400">{row.original.email}</p>
            </div>
          </Link>
        );
      },
    },
    {
      accessorKey: "departments",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
      cell: ({ row }) => {
        const isInactive = !row.original.is_active;
        return (
          <span className={`text-slate-400 ${isInactive ? "opacity-50" : ""}`}>
            {row.original.departments?.name || "—"}
          </span>
        );
      },
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => {
        const isInactive = !row.original.is_active;
        return (
          <span className={`text-slate-400 font-mono text-sm ${isInactive ? "opacity-50" : ""}`}>
            {row.original.phone || "—"}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const isInactive = !row.original.is_active;
        const isSelf = row.original.id === currentUser?.id;

        return (
          (canUpdate || canDelete) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/users/${row.original.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </DropdownMenuItem>
                {canUpdate && (
                  <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && !isInactive && !isSelf && (
                  <DropdownMenuItem
                    onClick={() => {
                      setDeactivatingUser(row.original);
                      setDeactivateDialogOpen(true);
                    }}
                    className="text-red-400 focus:text-red-400"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </DropdownMenuItem>
                )}
                {canDelete && isInactive && (
                  <DropdownMenuItem
                    onClick={() => handleReactivate(row.original.id, row.original.full_name)}
                    className="text-green-400 focus:text-green-400"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-slate-500 flex items-center gap-1">
              <Lock className="h-3 w-3" />
            </span>
          )
        );
      },
    },
  ];

  const activeCount = users.filter(u => u.is_active).length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage system users and their permissions"
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
            <Link href="/admin/users/new">
              <Button className="group">
                <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
                New User
              </Button>
            </Link>
          )
        }
      />

      {/* Stats — Total Users only (role counts removed in Phase 60) */}
      <div className="command-panel p-4 w-fit">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-2xl font-bold text-slate-200">{users.length}</p>
            <p className="text-xs text-slate-400">
              {activeCount} Active / {inactiveCount} Inactive
            </p>
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

      {/* Edit User Dialog */}
      <UserDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        user={editingUser}
        departments={departments}
        isCreateMode={false}
      />

      <DeactivateUserDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        userName={deactivatingUser?.full_name || ""}
        onConfirm={handleDeactivate}
        isLoading={isDeactivating}
      />
    </div>
  );
}
