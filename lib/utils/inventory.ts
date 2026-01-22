/**
 * Inventory Utilities
 *
 * Configuration and helper functions for Inventory Management
 */

import type {
  MovementType,
  StockOutReason,
  InventoryTransactionStatus,
} from "@/types/database";

// Movement type configuration with colors, labels, and icons
export const MOVEMENT_TYPE_CONFIG: Record<
  MovementType,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    iconName: string;
  }
> = {
  inventory_in: {
    label: "Stock In",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconName: "ArrowDownToLine",
  },
  inventory_out: {
    label: "Stock Out",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    iconName: "ArrowUpFromLine",
  },
};

// Stock out reason configuration
export const STOCK_OUT_REASON_CONFIG: Record<
  StockOutReason,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  request: {
    label: "Request",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    description: "Issued to fulfill a QMHQ item request",
  },
  consumption: {
    label: "Consumption",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    description: "Used for internal consumption",
  },
  damage: {
    label: "Damage",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    description: "Item damaged and removed from stock",
  },
  lost: {
    label: "Lost",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/30",
    description: "Item lost or unaccounted for",
  },
  transfer: {
    label: "Transfer",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    description: "Transferred to another warehouse",
  },
  adjustment: {
    label: "Adjustment",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    description: "Inventory adjustment (count correction)",
  },
};

// Transaction status configuration
export const TRANSACTION_STATUS_CONFIG: Record<
  InventoryTransactionStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
};

/**
 * Get hex color for movement type (for inline styles)
 */
export function getMovementTypeHexColor(type: MovementType): string {
  const colorMap: Record<MovementType, string> = {
    inventory_in: "#10b981",
    inventory_out: "#ef4444",
  };
  return colorMap[type] || "#94a3b8";
}

/**
 * Get hex color for stock out reason (for inline styles)
 */
export function getStockOutReasonHexColor(reason: StockOutReason): string {
  const colorMap: Record<StockOutReason, string> = {
    request: "#3b82f6",
    consumption: "#f59e0b",
    damage: "#ef4444",
    lost: "#94a3b8",
    transfer: "#a855f7",
    adjustment: "#06b6d4",
  };
  return colorMap[reason] || "#94a3b8";
}

/**
 * Format stock quantity with unit
 */
export function formatStockQuantity(
  quantity: number | null | undefined,
  unit?: string | null
): string {
  if (quantity === null || quantity === undefined) return "—";
  const formattedQty = quantity.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return unit ? `${formattedQty} ${unit}` : formattedQty;
}

/**
 * Calculate available stock (total in minus total out)
 */
export function calculateAvailableStock(
  totalIn: number,
  totalOut: number
): number {
  return Math.max(0, totalIn - totalOut);
}

/**
 * Validate stock out quantity against available stock
 */
export function validateStockOutQuantity(
  requestedQty: number,
  availableStock: number
): { valid: boolean; message?: string } {
  if (requestedQty <= 0) {
    return { valid: false, message: "Quantity must be greater than 0" };
  }
  if (requestedQty > availableStock) {
    return {
      valid: false,
      message: `Insufficient stock. Available: ${availableStock.toLocaleString()}`,
    };
  }
  return { valid: true };
}

/**
 * Calculate WAC (Weighted Average Cost)
 * WAC = (existing_qty × current_wac + new_qty × new_cost) / total_qty
 */
export function calculateWAC(
  existingQty: number,
  existingWAC: number,
  newQty: number,
  newCost: number
): number {
  const totalQty = existingQty + newQty;
  if (totalQty <= 0) return newCost;

  const existingValue = existingQty * existingWAC;
  const newValue = newQty * newCost;
  return (existingValue + newValue) / totalQty;
}

/**
 * Format WAC with currency
 */
export function formatWAC(
  wacAmount: number | null | undefined,
  currency?: string | null
): string {
  if (wacAmount === null || wacAmount === undefined) return "—";
  const formatted = wacAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Calculate total value from quantity and WAC
 */
export function calculateTotalValue(
  quantity: number,
  wacAmount: number | null | undefined
): number {
  if (wacAmount === null || wacAmount === undefined) return 0;
  return quantity * wacAmount;
}

/**
 * Get stock out reasons as options for select
 */
export function getStockOutReasonOptions(): Array<{
  value: StockOutReason;
  label: string;
  description: string;
}> {
  return (Object.keys(STOCK_OUT_REASON_CONFIG) as StockOutReason[]).map(
    (reason) => ({
      value: reason,
      label: STOCK_OUT_REASON_CONFIG[reason].label,
      description: STOCK_OUT_REASON_CONFIG[reason].description,
    })
  );
}

/**
 * Check if stock out reason requires destination warehouse
 */
export function requiresDestinationWarehouse(reason: StockOutReason): boolean {
  return reason === "transfer";
}

/**
 * Calculate EUSD amount from local currency
 */
export function calculateEUSD(
  amount: number | null | undefined,
  exchangeRate: number | null | undefined
): number | null {
  if (
    amount === null ||
    amount === undefined ||
    exchangeRate === null ||
    exchangeRate === undefined ||
    exchangeRate === 0
  ) {
    return null;
  }
  return amount / exchangeRate;
}

/**
 * Format exchange rate
 */
export function formatExchangeRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return rate.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}
