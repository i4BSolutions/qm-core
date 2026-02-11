import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DetailPageLayoutProps {
  backHref: string;
  backLabel?: string;
  header: React.ReactNode;
  actions?: React.ReactNode;
  kpiPanel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * DetailPageLayout
 *
 * Standardized layout for detail pages with back navigation, header, optional KPI panel, and content area.
 *
 * Layout Structure:
 * - Grid overlay (fixed background)
 * - Header row: back button + header content + actions
 * - Optional KPI panel
 * - Main content area (typically tabs)
 *
 * Spacing:
 * - Container: space-y-6 (24px vertical gaps)
 * - Header items: gap-4 (16px between back button and header)
 * - Actions: gap-2 (8px between action buttons)
 */
export function DetailPageLayout({
  backHref,
  backLabel = "Back",
  header,
  actions,
  kpiPanel,
  children,
  className,
}: DetailPageLayoutProps) {
  return (
    <div className={cn("space-y-6 relative", className)}>
      {/* Grid overlay — matches existing pattern */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Header row */}
      <div className="relative flex items-start justify-between animate-fade-in">
        <div className="flex items-start gap-4">
          {/* Back button */}
          <Link href={backHref} aria-label={backLabel}>
            <Button
              variant="ghost"
              size="icon"
              className="mt-1 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          {/* Header content slot */}
          {header}
        </div>
        {/* Actions slot */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Optional KPI panel */}
      {kpiPanel}

      {/* Main content */}
      {children}
    </div>
  );
}
