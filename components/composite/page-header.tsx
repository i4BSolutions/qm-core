import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader component for consistent page header layout
 *
 * Spacing documentation:
 * - Bottom margin: mb-6 (24px)
 * - Title/description gap: mt-1 (4px)
 * - Action button gap: gap-2 (8px)
 * - Badge margin: mb-2 (8px)
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div className="flex-1">
        {badge && (
          <div className="flex items-center gap-3 mb-2">
            {badge}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-slate-200">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-slate-400">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 ml-4">
          {actions}
        </div>
      )}
    </div>
  );
}
