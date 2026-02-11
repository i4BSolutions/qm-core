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
    borderColor: "border-l-blue-500",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    codeColor: "text-blue-400",
    badgeColor: "bg-blue-900/30 text-blue-400 border-blue-900/50",
    icon: Package,
  },
  expense: {
    borderColor: "border-l-emerald-500",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    codeColor: "text-emerald-400",
    badgeColor: "bg-emerald-900/30 text-emerald-400 border-emerald-900/50",
    icon: DollarSign,
  },
  po: {
    borderColor: "border-l-purple-500",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    codeColor: "text-purple-400",
    badgeColor: "bg-purple-900/30 text-purple-400 border-purple-900/50",
    icon: ShoppingCart,
  },
};

export function FlowQMHQNode({ qmhq }: FlowQMHQNodeProps) {
  const config = routeConfig[qmhq.route_type];
  const Icon = config.icon;

  return (
    <div className="my-3">
      <Link href={`/qmhq/${qmhq.id}`}>
        <div
          className={cn(
            "border-l-4 rounded-lg bg-slate-900/50 p-3 sm:p-4 hover:bg-slate-800/50 transition-colors",
            config.borderColor
          )}
        >
          {/* Header: icon + ID + route type + status */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={cn("flex h-6 w-6 items-center justify-center rounded-full", config.iconBg)}>
                <Icon className={cn("h-3 w-3", config.iconColor)} />
              </div>
              <code className={cn("text-xs font-mono", config.codeColor)}>
                {qmhq.request_id}
              </code>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  config.badgeColor
                )}
              >
                {qmhq.route_type}
              </span>
            </div>
            <Badge
              style={{
                borderColor: qmhq.status.color,
                color: qmhq.status.color,
                backgroundColor: `${qmhq.status.color}15`,
              }}
              className="border"
            >
              {qmhq.status.name}
            </Badge>
          </div>

          {/* Line name */}
          <div className="mb-2">
            <h3 className="text-sm font-medium text-slate-200">{qmhq.line_name}</h3>
          </div>

          {/* Details: people + dates */}
          <div className="mt-2 space-y-1 text-xs text-slate-400">
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
