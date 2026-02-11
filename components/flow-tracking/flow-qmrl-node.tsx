"use client";

import Link from "next/link";
import { FileText, Calendar, User, UserCheck, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { FlowQMRL, FlowPerson } from "@/types/flow-tracking";

interface FlowQMRLNodeProps {
  qmrl: FlowQMRL;
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

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    low: "bg-slate-700 text-slate-300",
    medium: "bg-amber-900/30 text-amber-400 border-amber-900/50",
    high: "bg-orange-900/30 text-orange-400 border-orange-900/50",
    critical: "bg-red-900/30 text-red-400 border-red-900/50",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variants[priority] || variants.low
      )}
    >
      {priority}
    </span>
  );
}

export function FlowQMRLNode({ qmrl }: FlowQMRLNodeProps) {
  return (
    <div className="my-3">
      <Link href={`/qmrl/${qmrl.id}`}>
        <div
          className={cn(
            "border-l-4 border-l-amber-500 rounded-lg bg-slate-900/50 p-3 sm:p-4 hover:bg-slate-800/50 transition-colors"
          )}
        >
          {/* Header: icon + ID + status */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20">
                <FileText className="h-3 w-3 text-amber-400" />
              </div>
              <code className="text-xs font-mono text-amber-400">
                {qmrl.request_id}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <PriorityBadge priority={qmrl.priority} />
              <Badge
                style={{
                  borderColor: qmrl.status.color,
                  color: qmrl.status.color,
                  backgroundColor: `${qmrl.status.color}15`,
                }}
                className="border"
              >
                {qmrl.status.name}
              </Badge>
            </div>
          </div>

          {/* Title */}
          <div className="mb-2">
            <h3 className="text-sm font-medium text-slate-200">{qmrl.title}</h3>
          </div>

          {/* Details: people + dates */}
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            {qmrl.requester && (
              <div className="flex items-center gap-1.5">
                <User className="h-3 w-3 flex-shrink-0" />
                <UserAvatar user={qmrl.requester} />
              </div>
            )}
            {qmrl.assigned_to && (
              <div className="flex items-center gap-1.5">
                <UserCheck className="h-3 w-3 flex-shrink-0" />
                <UserAvatar user={qmrl.assigned_to} />
              </div>
            )}
            {qmrl.contact_person_name && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span>{qmrl.contact_person_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Request: {new Date(qmrl.request_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Created: {new Date(qmrl.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
