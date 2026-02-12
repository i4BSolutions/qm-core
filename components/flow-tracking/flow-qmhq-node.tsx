"use client";

import Link from "next/link";
import { Package, DollarSign, ShoppingCart, Calendar, UserCheck, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FlowQMHQ, FlowPerson } from "@/types/flow-tracking";

interface FlowQMHQNodeProps {
  qmhq: FlowQMHQ;
}

function UserAvatar({ user }: { user: FlowPerson }) {
  return (
    <div className="flex items-center gap-1.5">
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt=""
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] text-slate-300 font-medium">
          {user.full_name.charAt(0).toUpperCase()}
        </div>
      )}
      <span>{user.full_name}</span>
    </div>
  );
}

const routeConfig = {
  item: {
    accentColor: "blue",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    codeColor: "text-blue-400",
    badgeClass: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    icon: Package,
  },
  expense: {
    accentColor: "emerald",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    codeColor: "text-emerald-400",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    icon: DollarSign,
  },
  po: {
    accentColor: "purple",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    codeColor: "text-purple-400",
    badgeClass: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    icon: ShoppingCart,
  },
};

export function FlowQMHQNode({ qmhq }: FlowQMHQNodeProps) {
  const config = routeConfig[qmhq.route_type];
  const Icon = config.icon;

  return (
    <div className="my-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
      <Link href={`/qmhq/${qmhq.id}`}>
        <div className="tactical-card corner-accents p-4 group">
          {/* Scan line effect */}
          <div className="scan-overlay" />

          {/* Header: ID badge + route type + status */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn("inline-flex items-center gap-2 rounded bg-slate-800 border px-3 py-1.5",
                config.accentColor === "blue" ? "border-blue-500/30" :
                config.accentColor === "emerald" ? "border-emerald-500/30" :
                "border-purple-500/30")}>
                <Icon className={cn("h-4 w-4", config.iconColor)} />
                <code className={cn("font-mono text-sm font-semibold tracking-wider", config.codeColor)}>
                  {qmhq.request_id}
                </code>
              </div>
              <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wider", config.badgeClass)}>
                {qmhq.route_type}
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-xs font-mono uppercase tracking-wider"
              style={{
                borderColor: qmhq.status.color,
                color: qmhq.status.color,
                backgroundColor: `${qmhq.status.color}15`,
              }}
            >
              {qmhq.status.name}
            </Badge>
          </div>

          {/* Line name */}
          <h3 className="font-semibold text-slate-200 mb-3 leading-snug">
            {qmhq.line_name}
          </h3>

          {/* Divider */}
          <div className="divider-accent" />

          {/* Details: people + dates */}
          <div className="space-y-1.5 text-xs text-slate-400">
            {qmhq.assigned_to && (
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 flex-shrink-0" />
                <UserAvatar user={qmhq.assigned_to} />
              </div>
            )}
            {qmhq.contact_person_name && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span>{qmhq.contact_person_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Created: {new Date(qmhq.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
