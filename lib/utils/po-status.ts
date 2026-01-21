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
 * Check if invoices can be created for this PO
 */
export function canCreateInvoice(status: POStatusEnum): boolean {
  return (
    status !== "closed" &&
    status !== "cancelled" &&
    status !== "awaiting_delivery"
  );
}
