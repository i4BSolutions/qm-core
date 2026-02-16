"use client";

import { cn } from "@/lib/utils";
import { useStandardUnitName } from "@/lib/hooks/use-standard-unit-name";

export interface StandardUnitDisplayProps {
  /** Original quantity */
  quantity: number | null | undefined;
  /** Conversion rate for this transaction */
  conversionRate: number;
  /** Size variant matching CurrencyDisplay */
  size?: "sm" | "md" | "lg";
  /** Align text */
  align?: "left" | "right";
  /** Additional className */
  className?: string;
}

export function StandardUnitDisplay({
  quantity,
  conversionRate,
  size = "md",
  align = "left",
  className,
}: StandardUnitDisplayProps) {
  // Get standard unit name from system config
  const { unitName, isLoading } = useStandardUnitName();

  // Handle null/undefined quantities
  const displayQuantity = quantity ?? 0;

  // Calculate standard quantity
  const standardQty = displayQuantity * conversionRate;

  // Format both quantities with thousand separators and 2 decimal places
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedOriginalQty = formatter.format(displayQuantity);
  const formattedStandardQty = formatter.format(standardQty);

  // Size-based styling (matching CurrencyDisplay exactly)
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

  // Determine if we should show the second line
  // Hide if loading or if unit name is empty
  const showSecondLine = !isLoading && unitName && unitName.trim() !== "";

  return (
    <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
      {/* Original quantity - primary line */}
      <span
        className={cn(
          "font-mono text-slate-200",
          styles.primary
        )}
      >
        {formattedOriginalQty}
      </span>
      {/* Standard quantity - secondary line (smaller, muted) */}
      {showSecondLine && (
        <span
          className={cn(
            "font-mono text-slate-400",
            styles.secondary
          )}
        >
          {formattedStandardQty} {unitName}
        </span>
      )}
    </div>
  );
}
