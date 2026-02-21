/**
 * QMHQ Auto Status Utilities
 *
 * Configuration and helper functions for QMHQ computed auto status.
 *
 * Auto status is derived from child record state for each route type.
 * It coexists alongside the manual status (status_id from status_config)
 * and is shown on detail pages only — not on list views.
 *
 * Nine states total: {Route} × {Pending / Processing / Done}
 */

import type { RouteType } from "@/types/database";

// --- Type Definitions ---

/**
 * Union of all nine QMHQ auto status values.
 * Three states per route type: Pending → Processing → Done
 */
export type QmhqAutoStatus =
  | "item_pending"
  | "item_processing"
  | "item_done"
  | "expense_pending"
  | "expense_processing"
  | "expense_done"
  | "po_pending"
  | "po_processing"
  | "po_done";

// --- Config Object ---

/**
 * Display configuration for each auto status value.
 * Colors follow the consistent scheme:
 *   Pending = amber, Processing = blue, Done = green
 * Icon names reference lucide-react: Package (item), Wallet (expense), ShoppingCart (po)
 */
export const QMHQ_AUTO_STATUS_CONFIG: Record<
  QmhqAutoStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
    iconName: string;
  }
> = {
  item_pending: {
    label: "Item Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    iconName: "Package",
  },
  item_processing: {
    label: "Item Processing",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconName: "Package",
  },
  item_done: {
    label: "Item Done",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconName: "Package",
  },
  expense_pending: {
    label: "Expense Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    iconName: "Wallet",
  },
  expense_processing: {
    label: "Expense Processing",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconName: "Wallet",
  },
  expense_done: {
    label: "Expense Done",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconName: "Wallet",
  },
  po_pending: {
    label: "PO Pending",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    iconName: "ShoppingCart",
  },
  po_processing: {
    label: "PO Processing",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    iconName: "ShoppingCart",
  },
  po_done: {
    label: "PO Done",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    iconName: "ShoppingCart",
  },
};

// --- Parameter Interface ---

/**
 * Parameters for computing the auto status of a QMHQ line.
 * Route-specific fields are optional — only the fields relevant to the given
 * routeType need to be provided.
 */
export interface AutoStatusParams {
  /** The QMHQ line route type — drives which fields are examined */
  routeType: RouteType;

  // Item route fields
  /** True if any L1 or L2 SOR approval exists for this QMHQ */
  hasAnySorApproval?: boolean;
  /** True if every SOR line item is fully executed */
  allSorLineItemsExecuted?: boolean;

  // Expense route fields
  /** True if any non-voided money_in financial transaction exists */
  hasAnyMoneyIn?: boolean;
  /** amount_eusd minus total_money_in_eusd; <= 0 means fully funded */
  yetToReceiveEusd?: number;

  // PO route fields
  /** True if any PO with status != 'cancelled' exists under this QMHQ */
  hasNonCancelledPO?: boolean;
  /** amount_eusd minus total_money_in_eusd (same calculation as expense) */
  yetToReceivePOEusd?: number;
  /** total_money_in_eusd minus total_po_committed_eusd */
  balanceInHandEusd?: number;
}

// --- Main Computation Function ---

/**
 * Compute the auto status for a QMHQ line based on its route type and child
 * record state.
 *
 * **Item route priority:** done > processing > pending
 *   - Done: all SOR line items executed
 *   - Processing: any L1/L2 SOR approval exists
 *   - Pending: no approvals yet
 *
 * **Expense route priority:** done > processing > pending
 *   - Done: yet-to-receive EUSD <= 0 (fully funded)
 *   - Processing: any money-in transaction exists
 *   - Pending: no money received yet
 *
 * **PO route priority:** done > processing > pending
 *   - Done: yet-to-receive EUSD <= 0 AND balance-in-hand <= 0 (fully closed)
 *   - Processing: any non-cancelled PO exists
 *   - Pending: no non-cancelled PO yet
 *
 * @param params - Route type and associated child-record state fields
 * @returns The computed QmhqAutoStatus value
 *
 * @example
 * // Item route with no approvals
 * computeQmhqAutoStatus({ routeType: "item" })
 * // Returns: "item_pending"
 *
 * @example
 * // Expense route fully funded
 * computeQmhqAutoStatus({ routeType: "expense", hasAnyMoneyIn: true, yetToReceiveEusd: -5 })
 * // Returns: "expense_done"
 */
export function computeQmhqAutoStatus(params: AutoStatusParams): QmhqAutoStatus {
  const {
    routeType,
    hasAnySorApproval,
    allSorLineItemsExecuted,
    hasAnyMoneyIn,
    yetToReceiveEusd,
    hasNonCancelledPO,
    yetToReceivePOEusd,
    balanceInHandEusd,
  } = params;

  switch (routeType) {
    case "item": {
      if (allSorLineItemsExecuted === true) {
        return "item_done";
      }
      if (hasAnySorApproval === true) {
        return "item_processing";
      }
      return "item_pending";
    }

    case "expense": {
      if (yetToReceiveEusd !== undefined && yetToReceiveEusd <= 0) {
        return "expense_done";
      }
      if (hasAnyMoneyIn === true) {
        return "expense_processing";
      }
      return "expense_pending";
    }

    case "po": {
      if (
        yetToReceivePOEusd !== undefined &&
        yetToReceivePOEusd <= 0 &&
        balanceInHandEusd !== undefined &&
        balanceInHandEusd <= 0
      ) {
        return "po_done";
      }
      if (hasNonCancelledPO === true) {
        return "po_processing";
      }
      return "po_pending";
    }

    default: {
      // Exhaustive check — TypeScript will warn if a RouteType case is missed
      const _exhaustive: never = routeType;
      void _exhaustive;
      return "item_pending";
    }
  }
}

// --- Helper Functions ---

/**
 * Get the hex color value for an auto status (for use in inline styles or
 * chart libraries that cannot consume Tailwind class names).
 *
 * Color mapping follows the scheme shared across all route types:
 *   Pending = amber-500, Processing = blue-500, Done = emerald-500
 *
 * @param status - The QmhqAutoStatus value
 * @returns Hex color string
 *
 * @example
 * getAutoStatusHexColor("expense_processing")
 * // Returns: "#3b82f6"
 */
export function getAutoStatusHexColor(status: QmhqAutoStatus): string {
  const colorMap: Record<QmhqAutoStatus, string> = {
    item_pending: "#f59e0b",
    item_processing: "#3b82f6",
    item_done: "#10b981",
    expense_pending: "#f59e0b",
    expense_processing: "#3b82f6",
    expense_done: "#10b981",
    po_pending: "#f59e0b",
    po_processing: "#3b82f6",
    po_done: "#10b981",
  };
  return colorMap[status] ?? "#f59e0b";
}
