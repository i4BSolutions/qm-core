import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface CurrencySkeletonProps {
  /** Size variant matching CurrencyDisplay proportions */
  size?: "sm" | "md" | "lg";
  /** Alignment of skeleton lines */
  align?: "left" | "right";
  /** Additional className for container */
  className?: string;
}

/**
 * Loading skeleton for CurrencyDisplay component.
 * Shows two-line placeholder matching expected amount width.
 */
export function CurrencySkeleton({
  size = "md",
  align = "left",
  className,
}: CurrencySkeletonProps) {
  // Size-based dimensions matching CurrencyDisplay proportions
  const sizeMap = {
    sm: {
      primary: "h-4 w-24",
      secondary: "h-3 w-20",
    },
    md: {
      primary: "h-5 w-28",
      secondary: "h-4 w-24",
    },
    lg: {
      primary: "h-6 w-32",
      secondary: "h-4 w-28",
    },
  };

  const dimensions = sizeMap[size];

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        align === "right" && "items-end",
        className
      )}
    >
      <Skeleton className={dimensions.primary} />
      <Skeleton className={dimensions.secondary} />
    </div>
  );
}
