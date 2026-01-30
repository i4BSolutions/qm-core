"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  UserPlus,
  Ban,
  Check,
  Lock,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLog, AuditAction } from "@/types/database";

/**
 * Configuration for each action type
 */
const ACTION_CONFIG: Record<
  AuditAction,
  { icon: typeof Plus; color: string; bgColor: string; label: string }
> = {
  create: {
    icon: Plus,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    label: "Created",
  },
  update: {
    icon: Pencil,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    label: "Updated",
  },
  delete: {
    icon: Trash2,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
    label: "Deleted",
  },
  status_change: {
    icon: ArrowRightLeft,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    label: "Status Changed",
  },
  assignment_change: {
    icon: UserPlus,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
    label: "Reassigned",
  },
  void: {
    icon: Ban,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
    label: "Voided",
  },
  approve: {
    icon: Check,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    label: "Approved",
  },
  close: {
    icon: Lock,
    color: "text-slate-400",
    bgColor: "bg-slate-500/10 border-slate-500/30",
    label: "Closed",
  },
  cancel: {
    icon: XCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
    label: "Cancelled",
  },
};

interface HistoryTabProps {
  entityType: string;
  entityId: string;
}

interface HistoryEntryProps {
  log: AuditLog;
  isLast: boolean;
}

/**
 * Parse the old_values JSONB field to extract field changes
 */
function parseChanges(log: AuditLog): { field: string; old: string; new: string }[] {
  if (!log.old_values) return [];

  const changes: { field: string; old: string; new: string }[] = [];

  try {
    const values = log.old_values as Record<string, { old?: unknown; new?: unknown }>;

    for (const [field, change] of Object.entries(values)) {
      if (change && typeof change === "object") {
        changes.push({
          field: formatFieldName(field),
          old: formatValue(change.old),
          new: formatValue(change.new),
        });
      }
    }
  } catch {
    // If parsing fails, return empty array
  }

  return changes;
}

/**
 * Format field name for display
 */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Format value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "string") {
    // Check if it's a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return value.substring(0, 8) + "...";
    }
    // Check if it's a date
    const dateMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Format full timestamp
 */
function formatFullTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Individual history entry component
 */
function HistoryEntry({ log, isLast }: HistoryEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
  const Icon = config.icon;
  const changes = parseChanges(log);
  const hasDetails = changes.length > 0 || log.old_value || log.new_value;

  // Detect void cascade entry
  const isVoidCascade = log.changes_summary?.includes('void of invoice') || false;

  return (
    <div className={cn(
      "relative flex gap-4",
      isVoidCascade && "border-l-2 border-red-500/50 pl-2 -ml-2"
    )}>
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[18px] top-10 bottom-0 w-px bg-slate-700" />
      )}

      {/* Icon */}
      <div
        className={`relative z-10 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border ${config.bgColor}`}
      >
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between">
          <div>
            {/* Action label and summary */}
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${config.color}`}>
                {config.label}
              </span>
              {log.changes_summary && (
                <span className="text-sm text-slate-400">
                  — {log.changes_summary}
                </span>
              )}
              {isVoidCascade && (
                <span className="text-xs text-red-400/70 flex items-center gap-1 ml-1">
                  <ArrowRightLeft className="h-3 w-3" />
                  Cascade effect
                </span>
              )}
            </div>

            {/* User and time */}
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <span className="font-medium text-slate-300">
                  {log.changed_by_name || "System"}
                </span>
              </span>
              <span className="flex items-center gap-1" title={formatFullTime(log.changed_at)}>
                <Clock className="h-3 w-3" />
                {formatRelativeTime(log.changed_at)}
              </span>
            </div>
          </div>

          {/* Expand button */}
          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-2 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Hide
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Details
                </>
              )}
            </button>
          )}
        </div>

        {/* Expanded details */}
        {expanded && hasDetails && (
          <div className={cn(
            "mt-3 rounded-lg border bg-slate-800/50 p-3",
            isVoidCascade ? "border-red-500/30" : "border-slate-700"
          )}>
            {/* Single field change */}
            {log.field_name && (log.old_value || log.new_value) && (
              <div className="text-sm">
                <span className="text-slate-400">
                  {formatFieldName(log.field_name)}:
                  {isVoidCascade && log.field_name === 'invoiced_quantity' && (
                    <span className="ml-2 text-xs text-red-400/70">(Qty restored)</span>
                  )}
                  {isVoidCascade && log.action === 'status_change' && (
                    <span className="ml-2 text-xs text-red-400/70">(Status recalculated)</span>
                  )}
                </span>
                <div className="mt-1 flex items-center gap-2">
                  {log.old_value && (
                    <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 line-through text-xs font-mono">
                      {log.old_value}
                    </span>
                  )}
                  {log.old_value && log.new_value && (
                    <ArrowRightLeft className="h-3 w-3 text-slate-500" />
                  )}
                  {log.new_value && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                      {log.new_value}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Multiple field changes */}
            {changes.length > 0 && (
              <div className="space-y-2">
                {changes.map((change, idx) => (
                  <div key={idx} className="text-sm">
                    <span className="text-slate-400">{change.field}:</span>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 line-through text-xs">
                        {change.old}
                      </span>
                      <ArrowRightLeft className="h-3 w-3 text-slate-500" />
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs">
                        {change.new}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            {log.notes && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <span className="text-xs text-slate-400">Note: </span>
                <span className="text-xs text-slate-300">{log.notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for history entries
 */
function HistoryEntrySkeleton() {
  return (
    <div className="flex gap-4">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2 pb-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

/**
 * HistoryTab component for displaying audit logs
 */
export function HistoryTab({ entityType, entityId }: HistoryTabProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();

    // Use type assertion to access audit_logs table (may not be in generated types yet)
    const client = supabase as ReturnType<typeof createClient> & {
      from: (table: "audit_logs") => ReturnType<ReturnType<typeof createClient>["from"]>;
    };
    const { data, error: fetchError } = await client
      .from("audit_logs")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("changed_at", { ascending: false })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching audit logs:", fetchError);
      setError("Failed to load history");
    } else {
      setLogs((data || []) as AuditLog[]);
    }

    setIsLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="section-header">
          <History className="h-4 w-4 text-amber-500" />
          <h3>Activity History</h3>
        </div>
        <div className="space-y-2">
          <HistoryEntrySkeleton />
          <HistoryEntrySkeleton />
          <HistoryEntrySkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="section-header">
          <History className="h-4 w-4 text-amber-500" />
          <h3>Activity History</h3>
        </div>
        <div className="flex h-40 items-center justify-center border border-dashed border-red-500/30 rounded-lg bg-red-500/5">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={fetchLogs}
              className="mt-2 text-xs text-slate-400 hover:text-slate-200 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="section-header">
          <History className="h-4 w-4 text-amber-500" />
          <h3>Activity History</h3>
        </div>
        <div className="flex h-40 items-center justify-center border border-dashed border-sidebar-border rounded-lg bg-slate-900/30">
          <div className="text-center">
            <History className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No activity recorded</p>
            <p className="text-xs text-slate-400 mt-1">
              Changes to this record will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  // History timeline
  return (
    <div className="space-y-4">
      <div className="section-header">
        <History className="h-4 w-4 text-amber-500" />
        <h3>Activity History</h3>
        <span className="ml-auto text-xs text-slate-400">
          {logs.length} {logs.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      <div className="space-y-0">
        {logs.map((log, index) => (
          <HistoryEntry
            key={log.id}
            log={log}
            isLast={index === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
