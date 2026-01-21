"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Search, Calendar, User, Tag, AlertCircle, Radio, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QMRL, StatusConfig, Category, User as UserType, Department } from "@/types/database";

// Extended QMRL type with joined relations
interface QMRLWithRelations extends QMRL {
  status?: StatusConfig | null;
  category?: Category | null;
  assigned_user?: UserType | null;
  requester?: UserType | null;
  department?: Department | null;
}

// Priority styles - Tactical
const priorityConfig: Record<string, { class: string; label: string }> = {
  low: { class: "priority-tactical priority-tactical-low", label: "LOW" },
  medium: { class: "priority-tactical priority-tactical-medium", label: "MED" },
  high: { class: "priority-tactical priority-tactical-high", label: "HIGH" },
  critical: { class: "priority-tactical priority-tactical-critical", label: "CRIT" },
};

// Status group configuration
const statusGroups = [
  { key: "to_do", label: "PENDING", dotClass: "status-dot status-dot-todo", color: "slate" },
  { key: "in_progress", label: "IN PROGRESS", dotClass: "status-dot status-dot-progress", color: "amber" },
  { key: "done", label: "COMPLETED", dotClass: "status-dot status-dot-done", color: "emerald" },
] as const;

export default function QMRLPage() {
  const [qmrls, setQmrls] = useState<QMRLWithRelations[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data: qmrlData } = await supabase
      .from("qmrl")
      .select(`
        *,
        status:status_config(*),
        category:categories(*),
        assigned_user:users!qmrl_assigned_to_fkey(*),
        requester:users!qmrl_requester_id_fkey(*),
        department:departments(*)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data: statusData } = await supabase
      .from("status_config")
      .select("*")
      .eq("entity_type", "qmrl")
      .eq("is_active", true)
      .order("display_order");

    const { data: categoryData } = await supabase
      .from("categories")
      .select("*")
      .eq("entity_type", "qmrl")
      .eq("is_active", true)
      .order("display_order");

    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("is_active", true)
      .order("full_name");

    if (qmrlData) setQmrls(qmrlData as QMRLWithRelations[]);
    if (statusData) setStatuses(statusData);
    if (categoryData) setCategories(categoryData);
    if (userData) setUsers(userData);

    setIsLoading(false);
  };

  const filteredQmrls = useMemo(() => {
    return qmrls.filter((qmrl) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          qmrl.title?.toLowerCase().includes(query) ||
          qmrl.request_id?.toLowerCase().includes(query) ||
          qmrl.description?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (categoryFilter !== "all" && qmrl.category_id !== categoryFilter) return false;
      if (assignedFilter !== "all" && qmrl.assigned_to !== assignedFilter) return false;
      return true;
    });
  }, [qmrls, searchQuery, categoryFilter, assignedFilter]);

  const groupedQmrls = useMemo(() => {
    const groups: Record<string, QMRLWithRelations[]> = {
      to_do: [],
      in_progress: [],
      done: [],
    };

    filteredQmrls.forEach((qmrl) => {
      const statusGroup = qmrl.status?.status_group || "to_do";
      if (groups[statusGroup]) {
        groups[statusGroup].push(qmrl);
      } else {
        groups.to_do.push(qmrl);
      }
    });

    return groups;
  }, [filteredQmrls]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-50" />

      {/* Page Header */}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20">
              <Radio className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
                Operations
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-200">
            Request Letters
          </h1>
          <p className="mt-1 text-slate-400">
            {filteredQmrls.length} active request{filteredQmrls.length !== 1 ? "s" : ""} in system
          </p>
        </div>
        <Link href="/qmrl/new">
          <Button className="group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              New Request
            </span>
          </Button>
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="command-panel">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by title, ID, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-slate-800/50 border-slate-700">
              <Tag className="mr-2 h-4 w-4 text-slate-400" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assignedFilter} onValueChange={setAssignedFilter}>
            <SelectTrigger className="w-[160px] bg-slate-800/50 border-slate-700">
              <User className="mr-2 h-4 w-4 text-slate-400" />
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Board - Kanban Style */}
      <div className="grid gap-6 lg:grid-cols-3">
        {statusGroups.map((group) => (
          <div key={group.key} className="flex flex-col">
            {/* Column Header */}
            <div className="column-header">
              <div className={group.dotClass} />
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-200">
                {group.label}
              </h2>
              <span className="stat-counter ml-auto">
                {groupedQmrls[group.key].length}
              </span>
            </div>

            {/* Column Body */}
            <div className="flex-1 rounded-b-lg border border-t-0 border-slate-700 bg-slate-900/30 p-3 min-h-[400px]">
              <div className="space-y-3">
                {groupedQmrls[group.key].length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700">
                    <p className="text-sm text-slate-400">No requests</p>
                  </div>
                ) : (
                  groupedQmrls[group.key].map((qmrl, index) => (
                    <Link key={qmrl.id} href={`/qmrl/${qmrl.id}`}>
                      <div
                        className="tactical-card corner-accents p-4 animate-slide-up cursor-pointer"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {/* Scan line effect */}
                        <div className="scan-overlay" />

                        {/* Header Row */}
                        <div className="relative flex items-center justify-between mb-3">
                          <div className="request-id-badge">
                            <code>{qmrl.request_id}</code>
                          </div>
                          {qmrl.priority && (
                            <span className={priorityConfig[qmrl.priority]?.class}>
                              <AlertCircle className="h-3 w-3" />
                              {priorityConfig[qmrl.priority]?.label}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-slate-200 mb-3 line-clamp-2 leading-snug">
                          {qmrl.title}
                        </h3>

                        {/* Category Tag */}
                        {qmrl.category && (
                          <div className="mb-3">
                            <Badge
                              variant="outline"
                              className="text-xs font-medium"
                              style={{
                                borderColor: qmrl.category.color || "rgb(100, 116, 139)",
                                color: qmrl.category.color || "rgb(148, 163, 184)",
                                backgroundColor: `${qmrl.category.color}10` || "transparent",
                              }}
                            >
                              <Tag className="mr-1 h-3 w-3" />
                              {qmrl.category.name}
                            </Badge>
                          </div>
                        )}

                        {/* Divider */}
                        <div className="divider-accent" />

                        {/* Meta Row */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3 text-slate-400">
                            {qmrl.request_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(qmrl.request_date)}
                              </span>
                            )}
                            {qmrl.assigned_user && (
                              <span className="flex items-center gap-1 max-w-[100px] truncate">
                                <User className="h-3 w-3 flex-shrink-0" />
                                {qmrl.assigned_user.full_name.split(" ")[0]}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* Status Badge */}
                        {qmrl.status && (
                          <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <Badge
                              variant="outline"
                              className="text-xs font-mono uppercase tracking-wider"
                              style={{
                                borderColor: qmrl.status.color || undefined,
                                color: qmrl.status.color || undefined,
                              }}
                            >
                              {qmrl.status.name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
