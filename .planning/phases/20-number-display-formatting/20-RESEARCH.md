# Phase 20: Number Display Formatting - Research

**Researched:** 2026-02-06
**Domain:** React number input formatting, responsive currency display, Tailwind CSS
**Confidence:** HIGH

## Summary

This phase addresses two requirements: (1) displaying thousand separators in amount input fields as users type (NUMD-01), and (2) ensuring large amounts display responsively without breaking layouts (NUMD-02).

The project already has a solid foundation with `formatCurrency()` using `Intl.NumberFormat` for display formatting and `handleAmountKeyDown` utilities for input validation. The current inputs use `type="text"` with `inputMode="decimal"` which is correct. The phase adds live formatting during typing and responsive display enhancements.

For input formatting, `react-number-format` (v5.4.4, ~2.4M weekly downloads) is the standard solution. It provides a sophisticated caret engine that prevents cursor jumping issues that plague custom implementations. For display overflow handling, CSS techniques (truncation, responsive font sizing) combined with the existing `CurrencyDisplay` component provide the solution.

**Primary recommendation:** Use `react-number-format` NumericFormat component for amount inputs with thousand separators. Enhance `CurrencyDisplay` component with overflow handling via Tailwind utilities. Strip formatting before form submission using the raw value from NumericFormat's onValueChange.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-number-format | ^5.4.4 | Input formatting with thousand separators | 2.4M weekly downloads, sophisticated caret engine, handles edge cases |
| Intl.NumberFormat | Browser API | Display formatting | Native, zero dependencies, already in use |
| Tailwind CSS | ^3.4.13 | Responsive styling, overflow handling | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge | ^2.1.1, ^2.5.2 | Conditional styling | Dynamic styling for overflow states |
| Radix UI Tooltip | ^1.1.3 | Truncated value tooltips | When showing full value on hover |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-number-format | Custom controlled input | Custom solution has caret-jumping issues; react-number-format handles this |
| react-number-format | react-currency-input-field | Less downloads (315k vs 2.4M), react-number-format more battle-tested |
| Fitty/textFit | CSS font-size utilities | JS libraries add complexity; CSS truncate is simpler for this use case |

**Installation:**
```bash
npm install react-number-format@^5.4.4
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
└── utils/
    ├── index.ts                  # Existing formatCurrency, exports number-input utils
    └── number-input.ts           # Existing keydown handlers (keep for non-formatted inputs)

components/
├── ui/
│   ├── currency-display.tsx      # ENHANCE: Add overflow handling
│   └── amount-input.tsx          # NEW: NumericFormat wrapper for amount inputs
└── forms/
    └── (existing form components use new AmountInput)
```

### Pattern 1: NumericFormat for Amount Inputs
**What:** Wrap react-number-format's NumericFormat for consistent amount input behavior
**When to use:** All amount/currency input fields
**Example:**
```typescript
// Source: react-number-format docs (https://s-yadav.github.io/react-number-format/docs/numeric_format/)
import { NumericFormat, OnValueChange } from 'react-number-format';
import { Input } from '@/components/ui/input';

interface AmountInputProps {
  value: string;
  onValueChange: (value: string) => void;
  decimals?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function AmountInput({
  value,
  onValueChange,
  decimals = 2,
  className,
  ...props
}: AmountInputProps) {
  const handleValueChange: OnValueChange = (values) => {
    // values.value is the unformatted value (e.g., "1234.56")
    // values.formattedValue is the formatted value (e.g., "1,234.56")
    onValueChange(values.value);
  };

  return (
    <NumericFormat
      value={value}
      onValueChange={handleValueChange}
      thousandSeparator=","
      decimalScale={decimals}
      allowNegative={false}
      customInput={Input}
      className={cn(
        "font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  );
}
```

### Pattern 2: Responsive Currency Display
**What:** Handle overflow for large amounts in constrained containers
**When to use:** Card views, table cells, any fixed-width container showing amounts
**Example:**
```typescript
// Source: Tailwind CSS text-overflow utilities
// Enhanced CurrencyDisplay component
export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate = 1,
  amountEusd,
  size = "md",
  showDashForEmpty = false,
  className,
  align = "left",
  truncate = false, // NEW: Enable truncation for tight spaces
}: CurrencyDisplayProps) {
  // ... existing logic ...

  return (
    <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
      <span className={cn(
        "font-mono text-slate-200",
        styles.primary,
        truncate && "truncate max-w-full"
      )} title={truncate ? `${formatCurrency(displayAmount)} ${currency}` : undefined}>
        {formatCurrency(displayAmount)} {currency}
      </span>
      <span className={cn(
        "font-mono text-slate-400",
        styles.secondary,
        truncate && "truncate max-w-full"
      )} title={truncate ? `${formatCurrency(eusdValue)} EUSD` : undefined}>
        {formatCurrency(eusdValue)} EUSD
      </span>
    </div>
  );
}
```

### Pattern 3: Form Integration - Strip Formatting Before Submit
**What:** Use raw values from NumericFormat for form submission
**When to use:** All forms with amount inputs
**Example:**
```typescript
// Source: react-number-format docs
const [amount, setAmount] = useState("");  // Stores unformatted value

// In form render:
<AmountInput
  value={amount}
  onValueChange={setAmount}  // Receives unformatted: "1234.56"
  decimals={2}
/>

// On submit - amount is already clean:
const handleSubmit = () => {
  const amountNum = parseFloat(amount);  // No stripping needed
  // Submit amountNum to API
};
```

### Anti-Patterns to Avoid
- **Manual regex formatting:** Causes caret jumping, react-number-format handles this
- **Formatting then stripping commas:** Unnecessary complexity, use onValueChange
- **Using type="number" with formatting:** Browser validation conflicts with formatted values
- **Font-size scaling for overflow:** Adds complexity; truncation with tooltip is simpler

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thousand separator in inputs | Custom onChange with regex | react-number-format NumericFormat | Caret positioning is incredibly complex; library handles it |
| Strip formatting on submit | Manual regex replacement | NumericFormat onValueChange.value | Already provides unformatted value |
| Decimal place limiting | Custom keydown blocking | NumericFormat decimalScale | Integrated with formatting engine |
| Large number display | CSS font-size scaling | CSS truncate + title tooltip | Simpler, more predictable |

**Key insight:** Input formatting with proper caret positioning is a solved problem. The react-number-format library exists specifically because custom solutions have caret-jumping bugs. For display overflow, CSS truncation is simpler and more maintainable than dynamic font sizing.

## Common Pitfalls

### Pitfall 1: Using formattedValue for State
**What goes wrong:** Storing "1,234.56" in state instead of "1234.56" causes double formatting and submission issues
**Why it happens:** NumericFormat provides both formatted and unformatted values
**How to avoid:** Always use `values.value` (unformatted) from onValueChange, not `values.formattedValue`
**Warning signs:** Commas appearing in database, NaN errors on submit

### Pitfall 2: Mixing type="number" with NumericFormat
**What goes wrong:** Browser validation conflicts, spinner buttons appear, mobile keyboards wrong
**Why it happens:** Assuming number inputs need type="number"
**How to avoid:** Use type="text" with inputMode="decimal" (NumericFormat default)
**Warning signs:** Spinner buttons visible, browser validation errors

### Pitfall 3: Forgetting min-w-0 for Flex Children
**What goes wrong:** Text doesn't truncate in flex containers even with `truncate` class
**Why it happens:** Flex items have `min-width: auto` by default, preventing shrinking
**How to avoid:** Add `min-w-0` to flex children that need truncation
**Warning signs:** Text overflows container despite truncate class

### Pitfall 4: Tooltip on Non-Truncated Content
**What goes wrong:** Title tooltip appears even when text is fully visible
**Why it happens:** Always adding title attribute regardless of overflow
**How to avoid:** Only add title when truncate prop is true, or detect overflow dynamically
**Warning signs:** Unnecessary tooltips cluttering UI

### Pitfall 5: Inconsistent Decimal Handling
**What goes wrong:** Some inputs allow 2 decimals, others 4 (exchange rate), causing confusion
**Why it happens:** Not parameterizing decimal scale consistently
**How to avoid:** AmountInput defaults to 2 decimals, ExchangeRateInput to 4 decimals
**Warning signs:** User complaints about decimal restrictions inconsistency

## Code Examples

Verified patterns from official sources:

### AmountInput Component (NEW)
```typescript
// Source: react-number-format docs
// components/ui/amount-input.tsx
"use client";

import { NumericFormat, NumberFormatValues } from "react-number-format";
import { Input, InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface AmountInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  /** Current value (unformatted, e.g., "1234.56") */
  value: string;
  /** Called with unformatted value when input changes */
  onValueChange: (value: string) => void;
  /** Number of decimal places (default: 2 for amounts, 4 for exchange rates) */
  decimalScale?: number;
  /** Fix decimal scale (add trailing zeros) */
  fixedDecimalScale?: boolean;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  (
    {
      value,
      onValueChange,
      decimalScale = 2,
      fixedDecimalScale = false,
      className,
      ...props
    },
    ref
  ) => {
    const handleValueChange = (values: NumberFormatValues) => {
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
        getInputRef={ref}
        customInput={Input}
        className={cn(
          "font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
        {...props}
      />
    );
  }
);
AmountInput.displayName = "AmountInput";
```

### ExchangeRateInput Component (NEW)
```typescript
// Source: Extends AmountInput pattern
// components/ui/exchange-rate-input.tsx
"use client";

import { AmountInput, AmountInputProps } from "./amount-input";

export interface ExchangeRateInputProps extends Omit<AmountInputProps, "decimalScale"> {}

export function ExchangeRateInput(props: ExchangeRateInputProps) {
  return <AmountInput decimalScale={4} {...props} />;
}
```

### Enhanced CurrencyDisplay with Truncation
```typescript
// Source: Tailwind CSS truncation utilities
// components/ui/currency-display.tsx (enhanced)
"use client";

import { formatCurrency, calculateEUSD } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface CurrencyDisplayProps {
  amount: number | null | undefined;
  currency: string;
  exchangeRate?: number;
  amountEusd?: number | null;
  size?: "sm" | "md" | "lg";
  showDashForEmpty?: boolean;
  className?: string;
  align?: "left" | "right";
  /** Enable truncation for tight spaces (shows full value on hover) */
  truncate?: boolean;
}

export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate = 1,
  amountEusd,
  size = "md",
  showDashForEmpty = false,
  className,
  align = "left",
  truncate = false,
}: CurrencyDisplayProps) {
  const displayAmount = amount ?? 0;
  const isEmpty = amount === null || amount === undefined || amount === 0;

  if (isEmpty && showDashForEmpty) {
    return (
      <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
        <span className={cn(
          "font-mono text-slate-400",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-lg"
        )}>
          —
        </span>
      </div>
    );
  }

  const eusdValue = amountEusd ?? calculateEUSD(displayAmount, exchangeRate);
  const formattedOriginal = `${formatCurrency(displayAmount)} ${currency}`;
  const formattedEusd = `${formatCurrency(eusdValue)} EUSD`;

  const sizeStyles = {
    sm: { primary: "text-sm", secondary: "text-xs" },
    md: { primary: "text-base", secondary: "text-sm" },
    lg: { primary: "text-lg font-semibold", secondary: "text-sm" },
  };

  const styles = sizeStyles[size];

  return (
    <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
      <span
        className={cn(
          "font-mono text-slate-200",
          styles.primary,
          truncate && "truncate max-w-full"
        )}
        title={truncate ? formattedOriginal : undefined}
      >
        {formattedOriginal}
      </span>
      <span
        className={cn(
          "font-mono text-slate-400",
          styles.secondary,
          truncate && "truncate max-w-full"
        )}
        title={truncate ? formattedEusd : undefined}
      >
        {formattedEusd}
      </span>
    </div>
  );
}
```

### Form Migration Example
```typescript
// Before (current pattern):
const [amount, setAmount] = useState("");
<Input
  type="text"
  inputMode="decimal"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  onKeyDown={handleAmountKeyDown}
  className="font-mono ..."
/>
// Display: "1000" (no formatting)
// Submit: parseFloat("1000")

// After (with react-number-format):
const [amount, setAmount] = useState("");
<AmountInput
  value={amount}
  onValueChange={setAmount}
/>
// Display: "1,000" (formatted with separators)
// Submit: parseFloat("1000") (same - onValueChange gives unformatted)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom regex formatting | react-number-format library | Stable since 2020 | Eliminates caret-jumping bugs |
| Format on blur only | Format while typing | Stable | Better UX, immediate feedback |
| Font-size scaling for overflow | CSS truncation + tooltip | Stable | Simpler, more predictable |
| type="number" inputs | type="text" + inputMode="decimal" | ~2023 | Better mobile keyboard, no spinners |

**Deprecated/outdated:**
- **Manual caret position management:** Superseded by react-number-format's caret engine
- **Auto-format on blur:** Confuses users; live formatting is expected now
- **Browser native number validation:** Conflicts with formatted input values

## Open Questions

Things that couldn't be fully resolved:

1. **Existing form migration scope**
   - What we know: QMHQ, PO, Invoice forms use amount inputs
   - What's unclear: Full list of all forms requiring migration
   - Recommendation: Audit all forms in task planning phase

2. **Mobile keyboard behavior**
   - What we know: inputMode="decimal" triggers numeric keyboard
   - What's unclear: Exact behavior across all mobile browsers with react-number-format
   - Recommendation: Test on iOS Safari and Android Chrome during implementation

3. **Very large numbers (billions)**
   - What we know: Truncation handles display overflow
   - What's unclear: Whether scientific notation should be considered for extremely large values
   - Recommendation: CSS truncation is sufficient for expected financial ranges

## Sources

### Primary (HIGH confidence)
- [react-number-format NumericFormat docs](https://s-yadav.github.io/react-number-format/docs/numeric_format/) - Component API, thousandSeparator, decimalScale
- [react-number-format GitHub](https://github.com/s-yadav/react-number-format) - ~2.4M weekly downloads, v5.4.4
- [Tailwind CSS text-overflow](https://tailwindcss.com/docs/text-overflow) - truncate utility
- Existing codebase: `/lib/utils/index.ts` - formatCurrency with Intl.NumberFormat
- Existing codebase: `/components/ui/currency-display.tsx` - CurrencyDisplay component

### Secondary (MEDIUM confidence)
- [Solving Caret Jumping in React Inputs](https://dev.to/kwirke/solving-caret-jumping-in-react-inputs-36ic) - Why custom solutions fail
- [Creating a Localized Currency Input in React](https://levelup.gitconnected.com/creating-a-localized-currency-input-in-react-without-libraries-or-bugs-2f186124aedc) - Alternative approaches and their tradeoffs
- [Fitting Text to a Container | CSS-Tricks](https://css-tricks.com/fitting-text-to-a-container/) - Overflow handling techniques

### Tertiary (LOW confidence)
- [Fitty library](https://rikschennink.github.io/fitty/) - Font-size scaling (not recommended for this use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-number-format is the clear industry standard with 2.4M downloads
- Architecture: HIGH - Patterns based on official library docs and existing codebase patterns
- Pitfalls: HIGH - Based on documented caret-jumping issues and common flex truncation problems
- Code examples: HIGH - Based on official react-number-format documentation

**Research date:** 2026-02-06
**Valid until:** 60 days (stable domain, react-number-format is mature)
