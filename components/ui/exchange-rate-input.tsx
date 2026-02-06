"use client";

import * as React from "react";
import { AmountInput, AmountInputProps } from "@/components/ui/amount-input";

export interface ExchangeRateInputProps
  extends Omit<AmountInputProps, "decimalScale"> {}

/**
 * Exchange rate input with 4 decimal places.
 * Wrapper around AmountInput with decimalScale set to 4.
 */
const ExchangeRateInput = React.forwardRef<
  HTMLInputElement,
  ExchangeRateInputProps
>(({ placeholder = "1.0000", ...props }, ref) => {
  return (
    <AmountInput ref={ref} decimalScale={4} placeholder={placeholder} {...props} />
  );
});
ExchangeRateInput.displayName = "ExchangeRateInput";

export { ExchangeRateInput };
