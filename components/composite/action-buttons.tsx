import * as React from "react";
import { cn } from "@/lib/utils";

export interface ActionButtonsProps {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function ActionButtons({
  children,
  align = "right",
  className,
}: ActionButtonsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        align === "right" ? "justify-end" : "justify-start",
        className
      )}
    >
      {children}
    </div>
  );
}
