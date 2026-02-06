"use client";

import * as React from "react";
import { NumericFormat, NumberFormatValues } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AmountInputProps {
  /** The unformatted value as a string (e.g., "1234.56") */
  value: string;
  /** Called with the unformatted value when it changes */
  onValueChange: (value: string) => void;
  /** Number of decimal places (default: 2) */
  decimalScale?: number;
  /** Whether to always show fixed decimal places (default: false) */
  fixedDecimalScale?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** ID for the input */
  id?: string;
  /** Name for the input */
  name?: string;
  /** Error state */
  error?: boolean;
}

const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      className,
      value,
      onValueChange,
      decimalScale = 2,
      fixedDecimalScale = false,
      placeholder = "0.00",
      disabled,
      id,
      name,
      error,
    },
    ref
  ) => {
    const handleValueChange = (values: NumberFormatValues) => {
      // values.value is the unformatted numeric string (no commas)
      onValueChange(values.value);
    };

    return (
      <NumericFormat
        value={value}
        onValueChange={handleValueChange}
        thousandSeparator=","
        decimalScale={decimalScale}
        fixedDecimalScale={fixedDecimalScale}
        allowNegative={false}
        customInput={Input}
        getInputRef={ref}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        name={name}
        error={error}
        className={cn(
          "font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
      />
    );
  }
);
AmountInput.displayName = "AmountInput";

export { AmountInput };
