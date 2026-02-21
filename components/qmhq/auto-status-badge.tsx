"use client";

import { Package, Wallet, ShoppingCart } from "lucide-react";
import {
  QMHQ_AUTO_STATUS_CONFIG,
  type QmhqAutoStatus,
} from "@/lib/utils/qmhq-auto-status";

// Map of icon names to lucide-react icon components
const ICON_MAP = {
  Package,
  Wallet,
  ShoppingCart,
} as const;

type IconName = keyof typeof ICON_MAP;

interface AutoStatusBadgeProps {
  status: QmhqAutoStatus;
  /** Badge size — defaults to "md" */
  size?: "sm" | "md";
}

/**
 * AutoStatusBadge
 *
 * Displays the computed QMHQ auto status as a badge containing a route type
 * icon and a text label. Colors follow the consistent scheme:
 *   Pending = amber, Processing = blue, Done = green
 *
 * @example
 * <AutoStatusBadge status="expense_processing" />
 * <AutoStatusBadge status="po_done" size="sm" />
 */
export function AutoStatusBadge({ status, size = "md" }: AutoStatusBadgeProps) {
  const config = QMHQ_AUTO_STATUS_CONFIG[status];
  const IconComponent = ICON_MAP[config.iconName as IconName] ?? Package;

  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border ${config.bgColor} ${config.borderColor}`}
    >
      <IconComponent className={`${iconSize} ${config.color} shrink-0`} />
      <span className={`${textSize} font-medium ${config.color}`}>
        {config.label}
      </span>
    </span>
  );
}
