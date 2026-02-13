/**
 * PO Status Utilities
 *
 * Configuration and helper functions for Purchase Order smart status
 */

import type { POStatusEnum, ApprovalStatus } from "@/types/database";

// Status configuration with colors, labels, and icons
export const PO_STATUS_CONFIG: Record<
  POStatusEnum,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    iconName: string;
  }
> = {
  not_started: {
    label: "Not Started",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    iconName: "Circle",
  },
  partially_invoiced: {
    label: "Partially Invoiced",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    iconName: "FileText",
  },
  awaiting_delivery: {
    label: "Awaiting Delivery",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconName: "Truck",
  },
  partially_received: {
    label: "Partially Received",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    iconName: "PackageCheck",
  },
  closed: {
    label: "Closed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconName: "CheckCircle2",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    iconName: "XCircle",
  },
};

// Approval status configuration
export const APPROVAL_STATUS_CONFIG: Record<
  ApprovalStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  draft: {
    label: "Draft",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
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
};

/**
 * Calculate progress percentages for a PO
 */
export function calculatePOProgress(
  totalQty: number,
  invoicedQty: number,
  receivedQty: number
): {
  invoicedPercent: number;
  receivedPercent: number;
} {
  if (totalQty <= 0) {
    return { invoicedPercent: 0, receivedPercent: 0 };
  }

  return {
    invoicedPercent: Math.min(100, Math.round((invoicedQty / totalQty) * 100)),
    receivedPercent: Math.min(100, Math.round((receivedQty / totalQty) * 100)),
  };
}

/**
 * Calculate line item progress
 */
export function calculateLineItemProgress(
  quantity: number,
  invoicedQty: number,
  receivedQty: number
): {
  invoicedPercent: number;
  receivedPercent: number;
  availableToInvoice: number;
  availableToReceive: number;
} {
  if (quantity <= 0) {
    return {
      invoicedPercent: 0,
      receivedPercent: 0,
      availableToInvoice: 0,
      availableToReceive: 0,
    };
  }

  return {
    invoicedPercent: Math.min(100, Math.round((invoicedQty / quantity) * 100)),
    receivedPercent: Math.min(100, Math.round((receivedQty / quantity) * 100)),
    availableToInvoice: Math.max(0, quantity - invoicedQty),
    availableToReceive: Math.max(0, quantity - receivedQty),
  };
}

/**
 * Get status display color (hex value for inline styles)
 */
export function getStatusHexColor(status: POStatusEnum): string {
  const colorMap: Record<POStatusEnum, string> = {
    not_started: "#94a3b8",
    partially_invoiced: "#f59e0b",
    awaiting_delivery: "#3b82f6",
    partially_received: "#a855f7",
    closed: "#10b981",
    cancelled: "#ef4444",
  };
  return colorMap[status] || "#94a3b8";
}

/**
 * Get approval status display color (hex value for inline styles)
 */
export function getApprovalStatusHexColor(status: ApprovalStatus): string {
  const colorMap: Record<ApprovalStatus, string> = {
    draft: "#94a3b8",
    approved: "#10b981",
    rejected: "#ef4444",
  };
  return colorMap[status] || "#94a3b8";
}

/**
 * Check if PO can be edited based on status
 */
export function canEditPO(status: POStatusEnum): boolean {
  return status !== "closed" && status !== "cancelled";
}

/**
 * Check if PO can be cancelled based on status
 */
export function canCancelPO(status: POStatusEnum): boolean {
  return status !== "closed" && status !== "cancelled";
}

/**
 * Check if PO can be unlocked (admin-only operation)
 * Only closed POs can be unlocked for corrections
 */
export function canUnlockPO(status: POStatusEnum): boolean {
  return status === "closed";
}

/**
 * Check if invoices can be created for this PO
 * @param status - Current PO status
 * @param totalQty - Total ordered quantity (optional, for 100% check)
 * @param invoicedQty - Total invoiced quantity (optional, for 100% check)
 */
export function canCreateInvoice(
  status: POStatusEnum,
  totalQty?: number,
  invoicedQty?: number
): boolean {
  // Status-based checks
  if (
    status === "closed" ||
    status === "cancelled" ||
    status === "awaiting_delivery"
  ) {
    return false;
  }

  // If quantities provided, check if 100% invoiced
  if (totalQty !== undefined && invoicedQty !== undefined && totalQty > 0) {
    if (invoicedQty >= totalQty) {
      return false; // 100% invoiced, cannot create more invoices
    }
  }

  return true;
}

/**
 * Generate tooltip text for PO status badge
 *
 * Shows progress counts and percentages for invoiced and received quantities.
 * Provides contextual messages for special states (cancelled, closed, empty).
 *
 * @param status - The current PO status
 * @param totalQty - Total ordered quantity across all line items
 * @param invoicedQty - Total invoiced quantity
 * @param receivedQty - Total received quantity
 * @returns Human-readable tooltip text
 *
 * @example
 * generateStatusTooltip("partially_invoiced", 10, 6, 2)
 * // Returns: "6/10 invoiced (60%), 2/10 received (20%)"
 */
export function generateStatusTooltip(
  status: POStatusEnum,
  totalQty: number,
  invoicedQty: number,
  receivedQty: number
): string {
  // Special cases
  if (status === "cancelled") {
    return "This PO has been cancelled";
  }

  if (status === "closed") {
    return "Fully matched: ordered = invoiced = received";
  }

  if (totalQty === 0) {
    return "No line items";
  }

  // Handle division by zero
  const invoicedPercent =
    totalQty > 0 ? Math.round((invoicedQty / totalQty) * 100) : 0;
  const receivedPercent =
    totalQty > 0 ? Math.round((receivedQty / totalQty) * 100) : 0;

  return `${invoicedQty}/${totalQty} invoiced (${invoicedPercent}%), ${receivedQty}/${totalQty} received (${receivedPercent}%)`;
}

/**
 * Recompute PO status from aggregates (client-side mirror of database logic)
 *
 * This function mirrors the database `calculate_po_status()` function for
 * page-load safety net display. It follows the same invoice-first priority
 * logic as the database trigger.
 *
 * **IMPORTANT:** This is for display comparison only, NOT for writing back to DB.
 * The database trigger is the single source of truth for status values.
 *
 * @param totalQty - Total ordered quantity across all line items
 * @param invoicedQty - Total invoiced quantity
 * @param receivedQty - Total received quantity
 * @param isCancelled - Whether the PO is manually cancelled
 * @returns Expected POStatusEnum value based on current quantities
 *
 * @example
 * // PO with 10 items, 6 invoiced, 2 received
 * const expected = recomputeStatusFromAggregates(10, 6, 2, false);
 * // Returns: "partially_invoiced" (invoice-first priority)
 */
export function recomputeStatusFromAggregates(
  totalQty: number,
  invoicedQty: number,
  receivedQty: number,
  isCancelled: boolean
): POStatusEnum {
  // If cancelled, bypass auto-calc
  if (isCancelled) {
    return "cancelled";
  }

  // If no line items
  if (totalQty === 0) {
    return "not_started";
  }

  // Check if fully matched (closed) - 3-way match
  if (receivedQty >= totalQty && invoicedQty >= totalQty) {
    return "closed";
  }

  // INVOICE TAKES PRIORITY: Check if partially invoiced
  // Show partially_invoiced even if some items are received
  if (invoicedQty > 0 && invoicedQty < totalQty) {
    return "partially_invoiced";
  }

  // After fully invoiced, check receiving progress
  // Check if partially received (only after fully invoiced)
  if (
    invoicedQty >= totalQty &&
    receivedQty > 0 &&
    receivedQty < totalQty
  ) {
    return "partially_received";
  }

  // Check if awaiting delivery (fully invoiced but not received)
  if (invoicedQty >= totalQty && receivedQty === 0) {
    return "awaiting_delivery";
  }

  // Default to not_started
  return "not_started";
}
