"use client";

import * as React from "react";
import { AmountInput, AmountInputProps } from "@/components/ui/amount-input";

export interface ConversionRateInputProps
  extends Omit<AmountInputProps, "decimalScale"> {}

/**
 * Conversion rate input with 4 decimal places.
 * Wrapper around AmountInput with decimalScale set to 4.
 */
const ConversionRateInput = React.forwardRef<
  HTMLInputElement,
  ConversionRateInputProps
>(({ placeholder = "1.0000", ...props }, ref) => {
  return (
    <AmountInput ref={ref} decimalScale={4} placeholder={placeholder} {...props} />
  );
});
ConversionRateInput.displayName = "ConversionRateInput";

export { ConversionRateInput };
