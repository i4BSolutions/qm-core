"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Calendar, User, Tag, AlertCircle, Radio, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { PageHeader, FilterBar, CardViewGrid } from "@/components/composite";
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
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Parallel fetching for better performance
      const [qmrlRes, statusRes, categoryRes, userRes] = await Promise.all([
        supabase
          .from("qmrl")
          .select(`
            id, request_id, title, priority, request_date, description,
            status_id, category_id, assigned_to, requester_id, department_id,
            created_at,
            status:status_config(id, name, color, status_group),
            category:categories(id, name, color),
            assigned_user:users!qmrl_assigned_to_fkey(id, full_name),
            requester:users!qmrl_requester_id_fkey(id, full_name),
            department:departments(id, name)
          `)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("status_config")
          .select("id, name, color, status_group, display_order")
          .eq("entity_type", "qmrl")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("categories")
          .select("id, name, color, display_order")
          .eq("entity_type", "qmrl")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("users")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      // Check for errors
      if (qmrlRes.error) {
        console.error('QMRL query error:', qmrlRes.error);
        throw new Error(qmrlRes.error.message);
      }
      if (statusRes.error) {
        console.error('Status query error:', statusRes.error);
        throw new Error(statusRes.error.message);
      }
      if (categoryRes.error) {
        console.error('Category query error:', categoryRes.error);
        throw new Error(categoryRes.error.message);
      }
      if (userRes.error) {
        console.error('User query error:', userRes.error);
        throw new Error(userRes.error.message);
      }

      // Set data
      if (qmrlRes.data) setQmrls(qmrlRes.data as QMRLWithRelations[]);
      if (statusRes.data) setStatuses(statusRes.data as StatusConfig[]);
      if (categoryRes.data) setCategories(categoryRes.data as Category[]);
      if (userRes.data) setUsers(userRes.data as UserType[]);

    } catch (err) {
      console.error('Error fetching QMRL data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load QMRL data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, assignedFilter]);

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

  // Pagination calculations
  const totalItems = filteredQmrls.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Paginated items
  const paginatedQmrls = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredQmrls.slice(start, end);
  }, [filteredQmrls, currentPage, pageSize]);

  const groupedQmrls = useMemo(() => {
    const groups: Record<string, QMRLWithRelations[]> = {
      to_do: [],
      in_progress: [],
      done: [],
    };

    paginatedQmrls.forEach((qmrl) => {
      const statusGroup = qmrl.status?.status_group || "to_do";
      if (groups[statusGroup]) {
        groups[statusGroup].push(qmrl);
      } else {
        groups.to_do.push(qmrl);
      }
    });

    return groups;
  }, [paginatedQmrls]);

  // Handle page size change
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

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

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="mt-2 text-sm text-red-400 underline hover:text-red-300"
          >
            Click to retry
          </button>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        title="Request Letters"
        description={`${totalItems} request${totalItems !== 1 ? "s" : ""} found${totalItems !== qmrls.length ? ` (of ${qmrls.length} total)` : ""}`}
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20">
            <Radio className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-500">
              Operations
            </span>
          </div>
        }
        actions={
          <Link href="/qmrl/new">
            <Button className="group relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                New Request
              </span>
            </Button>
          </Link>
        }
      />

      {/* Filters Bar */}
      <FilterBar>
        <FilterBar.Search
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by title, ID, or description..."
        />
        <FilterBar.Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: "all", label: "All Categories" },
            ...categories.map(cat => ({ value: cat.id, label: cat.name })),
          ]}
          placeholder="Category"
          icon={<Tag className="h-4 w-4 text-slate-400" />}
          width="w-[160px]"
        />
        <FilterBar.Select
          value={assignedFilter}
          onChange={setAssignedFilter}
          options={[
            { value: "all", label: "All Assignees" },
            ...users.map(u => ({ value: u.id, label: u.full_name })),
          ]}
          placeholder="Assignee"
          icon={<User className="h-4 w-4 text-slate-400" />}
          width="w-[160px]"
        />
      </FilterBar>

      {/* Status Board - Kanban Style */}
      <CardViewGrid
        items={paginatedQmrls}
        groups={statusGroups.map(g => ({ key: g.key, label: g.label, dotClass: g.dotClass }))}
        groupBy={(qmrl) => qmrl.status?.status_group || "to_do"}
        emptyMessage="No requests"
        renderCard={(qmrl, index) => (
          <Link key={qmrl.id} href={`/qmrl/${qmrl.id}`} className="block mb-2">
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
        )}
      />

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="command-panel mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
