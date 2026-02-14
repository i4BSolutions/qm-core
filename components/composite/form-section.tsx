import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const formSectionVariants = cva(
  "command-panel corner-accents animate-slide-up",
  {
    variants: {
      spacing: {
        default: "p-6 space-y-4",
        compact: "p-4 space-y-3",
        relaxed: "p-8 space-y-6",
      },
    },
    defaultVariants: {
      spacing: "default",
    },
  }
);

export interface FormSectionProps
  extends VariantProps<typeof formSectionVariants> {
  /** Section heading. Accepts ReactNode for dynamic titles with counts or required indicators. */
  title: React.ReactNode;
  /** Optional icon displayed next to the title. */
  icon?: React.ReactNode;
  /** Form fields or content within this section. */
  children: React.ReactNode;
  /** Custom animation delay (e.g., "0.1s", "200ms"). Applied to the section container. */
  animationDelay?: string;
  /** Additional CSS classes for the container div. */
  className?: string;
}

export function FormSection({
  title,
  icon,
  children,
  spacing,
  animationDelay,
  className,
}: FormSectionProps) {
  return (
    <div
      className={cn(formSectionVariants({ spacing }), className)}
      style={animationDelay ? { animationDelay } : undefined}
    >
      <div className="section-header">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
