"use client";

import Link from "next/link";
import { FileText, Calendar, User, UserCheck, Phone, AlertCircle } from "lucide-react";
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

const priorityConfig: Record<string, { class: string; label: string }> = {
  low: { class: "priority-tactical priority-tactical-low", label: "LOW" },
  medium: { class: "priority-tactical priority-tactical-medium", label: "MED" },
  high: { class: "priority-tactical priority-tactical-high", label: "HIGH" },
  critical: { class: "priority-tactical priority-tactical-critical", label: "CRIT" },
};

export function FlowQMRLNode({ qmrl }: FlowQMRLNodeProps) {
  return (
    <div className="my-3 animate-slide-up">
      <Link href={`/qmrl/${qmrl.id}`}>
        <div className="tactical-card corner-accents p-4 group">
          {/* Scan line effect */}
          <div className="scan-overlay" />

          {/* Header: ID badge + priority + status */}
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="request-id-badge">
                <FileText className="h-4 w-4 text-amber-400" />
                <code>{qmrl.request_id}</code>
              </div>
              {qmrl.priority && (
                <span className={priorityConfig[qmrl.priority]?.class || priorityConfig.low.class}>
                  <AlertCircle className="h-3 w-3" />
                  {priorityConfig[qmrl.priority]?.label || qmrl.priority.toUpperCase()}
                </span>
              )}
            </div>
            <Badge
              variant="outline"
              className="text-xs font-mono uppercase tracking-wider"
              style={{
                borderColor: qmrl.status.color,
                color: qmrl.status.color,
                backgroundColor: `${qmrl.status.color}15`,
              }}
            >
              {qmrl.status.name}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-slate-200 mb-3 leading-snug">
            {qmrl.title}
          </h3>

          {/* Divider */}
          <div className="divider-accent" />

          {/* Details: people + dates */}
          <div className="space-y-1.5 text-xs text-slate-400">
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
