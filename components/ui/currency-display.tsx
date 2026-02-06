"use client";

import { formatCurrency, calculateEUSD } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface CurrencyDisplayProps {
  /** The amount in original currency */
  amount: number | null | undefined;
  /** The currency code (USD, MMK, THB, CNY) */
  currency: string;
  /** Exchange rate to EUSD (amount / exchangeRate = EUSD). Default 1 for USD */
  exchangeRate?: number;
  /** Pre-calculated EUSD amount (if available, skips calculation) */
  amountEusd?: number | null;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Show dashes when amount is null/undefined/0 */
  showDashForEmpty?: boolean;
  /** Additional className for container */
  className?: string;
  /** Align text (for table cells) */
  align?: "left" | "right";
  /** Truncate long values with ellipsis and show full value on hover */
  truncate?: boolean;
}

export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate = 1,
  amountEusd,
  size = "md",
  showDashForEmpty = false,
  className,
  align = "left",
  truncate = false,
}: CurrencyDisplayProps) {
  // Handle empty/null amounts
  const displayAmount = amount ?? 0;
  const isEmpty = amount === null || amount === undefined || amount === 0;

  if (isEmpty && showDashForEmpty) {
    return (
      <div className={cn("flex flex-col", align === "right" && "items-end", className)}>
        <span className={cn(
          "font-mono text-slate-400",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-lg"
        )}>
          —
        </span>
      </div>
    );
  }

  // Calculate EUSD if not pre-calculated
  const eusdValue = amountEusd ?? calculateEUSD(displayAmount, exchangeRate);

  // Size-based styling
  const sizeStyles = {
    sm: {
      primary: "text-sm",
      secondary: "text-xs",
    },
    md: {
      primary: "text-base",
      secondary: "text-sm",
    },
    lg: {
      primary: "text-lg font-semibold",
      secondary: "text-sm",
    },
  };

  const styles = sizeStyles[size];

  const primaryText = `${formatCurrency(displayAmount)} ${currency}`;
  const secondaryText = `${formatCurrency(eusdValue)} EUSD`;

  return (
    <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
      {/* Original currency - primary line */}
      <span
        className={cn(
          "font-mono text-slate-200",
          styles.primary,
          truncate && "truncate max-w-full"
        )}
        title={truncate ? primaryText : undefined}
      >
        {primaryText}
      </span>
      {/* EUSD equivalent - secondary line (smaller, muted) */}
      <span
        className={cn(
          "font-mono text-slate-400",
          styles.secondary,
          truncate && "truncate max-w-full"
        )}
        title={truncate ? secondaryText : undefined}
      >
        {secondaryText}
      </span>
    </div>
  );
}

/**
 * Compact inline version for table columns with limited space.
 * Shows original currency only, EUSD available via tooltip (to be added by parent).
 */
export interface CurrencyInlineProps {
  amount: number | null | undefined;
  currency: string;
  className?: string;
  /** Truncate long values with ellipsis and show full value on hover */
  truncate?: boolean;
}

export function CurrencyInline({
  amount,
  currency,
  className,
  truncate = false,
}: CurrencyInlineProps) {
  const displayAmount = amount ?? 0;
  const text = `${formatCurrency(displayAmount)} ${currency}`;

  return (
    <span
      className={cn(
        "font-mono text-slate-200",
        truncate && "truncate block max-w-full",
        className
      )}
      title={truncate ? text : undefined}
    >
      {text}
    </span>
  );
}
