"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Building2, Users, Lock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ContactPersonDialog } from "./contact-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import type { ContactPerson, Department } from "@/types/database";

type ContactPersonWithDepartment = ContactPerson & {
  departments: Pick<Department, "id" | "name"> | null;
};

export default function ContactPersonsPage() {
  const [contacts, setContacts] = useState<ContactPersonWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactPersonWithDepartment | null>(null);
  const { toast } = useToast();
  const { can } = usePermissions();

  // Permission checks
  const canCreate = can("create", "contact_persons");
  const canUpdate = can("update", "contact_persons");
  const canDelete = can("delete", "contact_persons");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [contactsRes, deptsRes] = await Promise.all([
      supabase
        .from("contact_persons")
        .select("id, name, department_id, position, phone, email, departments(id, name)")
        .eq("is_active", true)
        .order("name")
        .limit(200),
      supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (contactsRes.data) {
      setContacts(contactsRes.data as ContactPersonWithDepartment[]);
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
      .from("contact_persons")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      const isReferenceError = error.message?.includes("Cannot delete");
      toast({
        title: isReferenceError ? "Cannot Delete" : "Error",
        description: isReferenceError
          ? error.message
          : "Failed to delete contact person.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Contact person deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (contact: ContactPersonWithDepartment) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingContact(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<ContactPersonWithDepartment>[] = [
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
      accessorKey: "departments",
      header: "Department",
      cell: ({ row }) => {
        const dept = row.original.departments;
        return dept ? (
          <Badge variant="secondary" className="font-normal">
            <Building2 className="mr-1 h-3 w-3" />
            {dept.name}
          </Badge>
        ) : (
          <span className="text-slate-400">—</span>
        );
      },
    },
    {
      accessorKey: "position",
      header: "Position",
      cell: ({ row }) => (
        <span className="text-slate-200">
          {row.getValue("position") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-slate-200">
          {row.getValue("phone") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-slate-200">
          {row.getValue("email") || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const contact = row.original;
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
                <DropdownMenuItem onClick={() => handleEdit(contact)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  onClick={() => handleDelete(contact.id)}
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
              <Users className="h-4 w-4 text-violet-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">
                Admin
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Contact Persons
          </h1>
          <p className="mt-1 text-slate-400">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in system
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Add Contact
            </span>
          </Button>
        )}
      </div>

      {/* Data Table */}
      <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
        <DataTable
          columns={columns}
          data={contacts}
          searchKey="name"
          searchPlaceholder="Search contacts..."
          isLoading={isLoading}
        />
      </div>

      <ContactPersonDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        contact={editingContact}
        departments={departments}
      />
    </div>
  );
}
