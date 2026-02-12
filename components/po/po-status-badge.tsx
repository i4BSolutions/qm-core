"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  FileText,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PO_STATUS_CONFIG,
  APPROVAL_STATUS_CONFIG,
  generateStatusTooltip,
} from "@/lib/utils/po-status";
import type { POStatusEnum, ApprovalStatus } from "@/types/database";

const iconMap = {
  Circle,
  FileText,
  Truck,
  PackageCheck,
  CheckCircle2,
  XCircle,
};

interface POStatusBadgeProps {
  status: POStatusEnum;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function POStatusBadge({
  status,
  showIcon = true,
  size = "md",
}: POStatusBadgeProps) {
  const config = PO_STATUS_CONFIG[status];
  if (!config) return null;

  const Icon = iconMap[config.iconName as keyof typeof iconMap] || Circle;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded border font-medium uppercase tracking-wider
        ${config.bgColor} ${config.borderColor} ${config.color}
        ${sizeClasses[size]}
      `}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
    </div>
  );
}

interface POStatusBadgeWithTooltipProps {
  status: POStatusEnum;
  totalQty: number;
  invoicedQty: number;
  receivedQty: number;
  showIcon?: boolean;
  size?: "sm" | "md";
  animate?: boolean;
  cancellationReason?: string;
}

export function POStatusBadgeWithTooltip({
  status,
  totalQty,
  invoicedQty,
  receivedQty,
  showIcon = true,
  size = "md",
  animate = false,
  cancellationReason,
}: POStatusBadgeWithTooltipProps) {
  const [isPulsing, setIsPulsing] = useState(animate);

  useEffect(() => {
    if (animate) {
      setIsPulsing(true);
      const timer = setTimeout(() => {
        setIsPulsing(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  const tooltipText =
    status === "cancelled" && cancellationReason
      ? `This PO has been cancelled\n\nReason: ${cancellationReason}`
      : generateStatusTooltip(status, totalQty, invoicedQty, receivedQty);

  return (
    <div className="inline-flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={isPulsing ? "animate-pulse" : ""}>
              <POStatusBadge status={status} showIcon={showIcon} size={size} />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs font-mono whitespace-pre-wrap">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {status === "closed" && (
        <Lock className="h-3.5 w-3.5 text-emerald-400" />
      )}
    </div>
  );
}

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  size?: "sm" | "md";
}

export function ApprovalStatusBadge({
  status,
  size = "md",
}: ApprovalStatusBadgeProps) {
  const config = APPROVAL_STATUS_CONFIG[status];
  if (!config) return null;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-xs px-2.5 py-1",
  };

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 rounded border font-medium uppercase tracking-wider
        ${config.bgColor} ${config.borderColor} ${config.color}
        ${sizeClasses[size]}
      `}
    >
      <span>{config.label}</span>
    </div>
  );
}
