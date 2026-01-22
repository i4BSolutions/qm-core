/**
 * Invoice Status Utilities
 *
 * Configuration and helper functions for Invoice status management
 */

import type { InvoiceStatus } from "@/types/database";

// Status configuration with colors, labels, and icons
export const INVOICE_STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    iconName: string;
  }
> = {
  draft: {
    label: "Draft",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    iconName: "FileEdit",
  },
  received: {
    label: "Received",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconName: "FileCheck",
  },
  partially_received: {
    label: "Partially Received",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    iconName: "FileClock",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconName: "CheckCircle2",
  },
  voided: {
    label: "Voided",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    iconName: "Ban",
  },
};

/**
 * Get status display color (hex value for inline styles)
 */
export function getInvoiceStatusHexColor(status: InvoiceStatus): string {
  const colorMap: Record<InvoiceStatus, string> = {
    draft: "#94a3b8",
    received: "#3b82f6",
    partially_received: "#f59e0b",
    completed: "#10b981",
    voided: "#ef4444",
  };
  return colorMap[status] || "#94a3b8";
}

/**
 * Check if invoice can be voided
 */
export function canVoidInvoice(
  status: InvoiceStatus,
  isVoided: boolean
): boolean {
  // Cannot void if already voided
  if (isVoided) return false;
  // Can void any non-voided invoice
  return status !== "voided";
}

/**
 * Check if invoice can be edited
 */
export function canEditInvoice(
  status: InvoiceStatus,
  isVoided: boolean
): boolean {
  // Cannot edit voided invoices
  if (isVoided) return false;
  // Can only edit draft invoices
  return status === "draft";
}

/**
 * Calculate available quantity for a PO line item
 * @param poQuantity - Total quantity on the PO line
 * @param invoicedQuantity - Already invoiced quantity
 * @returns Available quantity to invoice
 */
export function calculateAvailableQuantity(
  poQuantity: number,
  invoicedQuantity: number
): number {
  return Math.max(0, poQuantity - invoicedQuantity);
}

/**
 * Calculate invoice line item progress
 */
export function calculateLineItemProgress(
  quantity: number,
  receivedQty: number
): {
  receivedPercent: number;
  pendingQty: number;
} {
  if (quantity <= 0) {
    return {
      receivedPercent: 0,
      pendingQty: 0,
    };
  }

  return {
    receivedPercent: Math.min(100, Math.round((receivedQty / quantity) * 100)),
    pendingQty: Math.max(0, quantity - receivedQty),
  };
}

/**
 * Format currency amount with proper decimals
 */
export function formatAmount(amount: number, decimals: number = 2): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format exchange rate with 4 decimals
 */
export function formatExchangeRate(rate: number): string {
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}
