import * as React from "react";
import { AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  /** Field label. Accepts ReactNode for labels with inline indicators (e.g., lock icons in po/new and qmhq/new). Most usages pass plain strings. */
  label: React.ReactNode;
  /** HTML ID of the input element this label refers to. */
  htmlFor?: string;
  /** If true, displays a red asterisk (*) after the label. */
  required?: boolean;
  /** Error message to display below the field. Takes precedence over hint. */
  error?: string;
  /** Help text displayed below the field when no error is present. */
  hint?: string;
  /** Form input element (Input, Select, Textarea, etc.). */
  children: React.ReactNode;
  /** Additional CSS classes for the container div. */
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-slate-300 font-medium">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}
