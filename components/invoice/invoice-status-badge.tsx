"use client";

import {
  FileEdit,
  FileCheck,
  FileClock,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { INVOICE_STATUS_CONFIG } from "@/lib/utils/invoice-status";
import type { InvoiceStatus } from "@/types/database";

const iconMap = {
  FileEdit,
  FileCheck,
  FileClock,
  CheckCircle2,
  Ban,
};

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  showIcon?: boolean;
  size?: "sm" | "md";
  isVoided?: boolean;
}

export function InvoiceStatusBadge({
  status,
  showIcon = true,
  size = "md",
  isVoided = false,
}: InvoiceStatusBadgeProps) {
  // If voided, always show voided status
  const displayStatus = isVoided ? "voided" : status;
  const config = INVOICE_STATUS_CONFIG[displayStatus];
  if (!config) return null;

  const Icon = iconMap[config.iconName as keyof typeof iconMap] || FileEdit;

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
