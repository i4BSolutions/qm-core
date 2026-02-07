"use client";

import { formatCurrency, calculateEUSD } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  formatCompactCurrency,
  ABBREVIATION_THRESHOLDS,
  type DisplayContext,
} from "@/lib/utils/format-compact";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

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
  /** Show dashes when amount is null/undefined (NOT zero) */
  showDashForEmpty?: boolean;
  /** Additional className for container */
  className?: string;
  /** Align text (for table cells) */
  align?: "left" | "right";
  /** Truncate long values with ellipsis and show full value on hover */
  truncate?: boolean;
  /** Display context determines abbreviation threshold */
  context?: DisplayContext;
  /** Enable fluid font scaling with viewport-responsive sizes */
  fluid?: boolean;
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
  context = "detail",
  fluid = false,
}: CurrencyDisplayProps) {
  // Handle empty/null amounts (zero is NOT empty per user decision)
  const displayAmount = amount ?? 0;
  const isEmpty = amount === null || amount === undefined;

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

  // Get threshold from context
  const threshold = ABBREVIATION_THRESHOLDS[context];

  // Format both amounts using compact currency formatter
  const primaryFormatted = formatCompactCurrency(displayAmount, currency, threshold);
  const eusdFormatted = formatCompactCurrency(eusdValue, "EUSD", threshold);

  // Determine if negative
  const isNegative = displayAmount < 0;

  // Size-based styling (fixed sizes vs fluid)
  const sizeStyles = fluid
    ? {
        sm: {
          primary: "text-fluid-amount-sm",
          secondary: "text-[calc(theme(fontSize.fluid-amount-sm)*0.85)]",
        },
        md: {
          primary: "text-fluid-amount-base",
          secondary: "text-fluid-amount-sm",
        },
        lg: {
          primary: "text-fluid-amount-lg font-semibold",
          secondary: "text-fluid-amount-sm",
        },
      }
    : {
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

  // Build the content
  const content = (
    <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
      {/* Original currency - primary line */}
      <span
        className={cn(
          "font-mono",
          isNegative ? "text-red-400" : "text-slate-200",
          styles.primary,
          truncate && "truncate max-w-full",
          primaryFormatted.isAbbreviated && "cursor-help"
        )}
        title={truncate && !primaryFormatted.isAbbreviated ? primaryFormatted.display : undefined}
      >
        {primaryFormatted.display}
      </span>
      {/* EUSD equivalent - secondary line (smaller, muted) */}
      <span
        className={cn(
          "font-mono",
          isNegative ? "text-red-400/70" : "text-slate-400",
          styles.secondary,
          truncate && "truncate max-w-full"
        )}
        title={truncate && !eusdFormatted.isAbbreviated ? eusdFormatted.display : undefined}
      >
        {eusdFormatted.display}
      </span>
    </div>
  );

  // Wrap with tooltip if abbreviated (desktop only per user decision)
  if (primaryFormatted.isAbbreviated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent className="hidden md:block font-mono">
          {primaryFormatted.fullValue}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
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
