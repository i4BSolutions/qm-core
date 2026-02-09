import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { STOCK_OUT_REASON_CONFIG } from "@/lib/utils/inventory";
import { Package } from "lucide-react";
import type { StockOutReason } from "@/types/database";

interface RequestCardProps {
  request: {
    id: string;
    request_number: string | null;
    status: string;
    reason: StockOutReason;
    created_at: string | null;
    qmhq_id: string | null;
    requester?: {
      id: string;
      full_name: string;
    } | null;
    line_items?: Array<{
      id: string;
      item_name: string | null;
    }>;
  };
}

// Status configuration
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  partially_approved: {
    label: "Partially Approved",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  approved: {
    label: "Approved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
  },
  partially_executed: {
    label: "Partially Executed",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  executed: {
    label: "Executed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
};

export function RequestCard({ request }: RequestCardProps) {
  const statusConfig = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const reasonConfig = STOCK_OUT_REASON_CONFIG[request.reason];
  const itemCount = request.line_items?.length || 0;

  return (
    <Link href={`/inventory/stock-out-requests/${request.id}`}>
      <div className="group relative bg-slate-900/50 border border-slate-800 rounded-lg p-4 hover:border-amber-500/30 transition-all duration-200 cursor-pointer command-panel">
        {/* Corner accents */}
        <div className="corner-accent top-0 left-0" />
        <div className="corner-accent top-0 right-0" />
        <div className="corner-accent bottom-0 left-0" />
        <div className="corner-accent bottom-0 right-0" />

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-amber-400">
              {request.request_number || "—"}
            </code>
            {request.qmhq_id && (
              <Badge
                variant="outline"
                className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-400"
              >
                QMHQ
              </Badge>
            )}
          </div>
          <Badge
            variant="outline"
            className={`${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.color}`}
          >
            {statusConfig.label}
          </Badge>
        </div>

        {/* Requester */}
        <div className="mb-3">
          <p className="text-sm text-slate-400">Requester</p>
          <p className="text-sm text-slate-200 font-medium">
            {request.requester?.full_name || "—"}
          </p>
        </div>

        {/* Reason */}
        <div className="mb-3">
          <Badge
            variant="outline"
            className={`${reasonConfig.bgColor} ${reasonConfig.borderColor} ${reasonConfig.color}`}
          >
            {reasonConfig.label}
          </Badge>
        </div>

        {/* Item count */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Package className="h-4 w-4" />
          <span>{itemCount} item(s)</span>
        </div>

        {/* Created date */}
        {request.created_at && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              {new Date(request.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}
