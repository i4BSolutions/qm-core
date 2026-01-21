"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2, Radio, Layers, Filter } from "lucide-react";
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
import { StatusDialog } from "./status-dialog";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { StatusConfig } from "@/types/database";

const statusGroupLabels: Record<string, { label: string; color: string }> = {
  to_do: { label: "To Do", color: "bg-slate-500" },
  in_progress: { label: "In Progress", color: "bg-amber-500" },
  done: { label: "Done", color: "bg-emerald-500" },
};

const entityTypeLabels: Record<string, string> = {
  qmrl: "QMRL",
  qmhq: "QMHQ",
};

type EntityTypeFilter = "all" | "qmrl" | "qmhq";

export default function StatusesPage() {
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<StatusConfig | null>(null);
  const [entityFilter, setEntityFilter] = useState<EntityTypeFilter>("all");
  const { toast } = useToast();

  // Filter statuses based on selected entity type
  const filteredStatuses = useMemo(() => {
    if (entityFilter === "all") return statuses;
    return statuses.filter((s) => s.entity_type === entityFilter);
  }, [statuses, entityFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("status_config")
      .select("id, name, entity_type, color, status_group, display_order, is_default")
      .eq("is_active", true)
      .order("entity_type")
      .order("display_order");

    if (data) {
      setStatuses(data as StatusConfig[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete a default status.",
        variant: "destructive",
      });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("status_config")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete status.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Status deleted.",
        variant: "success",
      });
      fetchData();
    }
  };

  const handleEdit = (status: StatusConfig) => {
    setEditingStatus(status);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingStatus(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setEditingStatus(null);
    if (refresh) {
      fetchData();
    }
  };

  const columns: ColumnDef<StatusConfig>[] = [
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
          {row.original.is_default && (
            <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">
              Default
            </Badge>
          )}
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
      accessorKey: "status_group",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status Group" />,
      cell: ({ row }) => {
        const group = statusGroupLabels[row.original.status_group];
        return (
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${group?.color || "bg-slate-500"}`} />
            <span className="text-slate-300">{group?.label || row.original.status_group}</span>
          </div>
        );
      },
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
              onClick={() => handleDelete(row.original.id, row.original.is_default || false)}
              className="text-red-400 focus:text-red-400"
              disabled={row.original.is_default || false}
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
            Status Management
          </h1>
          <p className="mt-1 text-slate-400">
            Configure status options for QMRL and QMHQ
          </p>
        </div>
        <Button onClick={handleCreate} className="group">
          <Plus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
          New Status
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-400 mr-2">Filter:</span>
        {(["all", "qmrl", "qmhq"] as EntityTypeFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setEntityFilter(filter)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              entityFilter === filter
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-800 hover:text-slate-200"
            )}
          >
            {filter === "all" ? "All" : entityTypeLabels[filter]}
            <span className="ml-1.5 text-xs opacity-70">
              ({filter === "all"
                ? statuses.length
                : statuses.filter((s) => s.entity_type === filter).length})
            </span>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">
                {statuses.filter((s) => s.entity_type === "qmrl").length}
              </p>
              <p className="text-xs text-slate-400">QMRL</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">
                {statuses.filter((s) => s.entity_type === "qmhq").length}
              </p>
              <p className="text-xs text-slate-400">QMHQ</p>
            </div>
          </div>
        </div>
        <div className="command-panel p-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-slate-200">{statuses.length}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="command-panel">
        <DataTable
          columns={columns}
          data={filteredStatuses}
          isLoading={isLoading}
          searchKey="name"
          searchPlaceholder="Search statuses..."
        />
      </div>

      {/* Dialog */}
      <StatusDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        status={editingStatus}
      />
    </div>
  );
}
