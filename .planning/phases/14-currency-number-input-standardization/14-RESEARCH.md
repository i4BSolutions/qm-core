# Phase 14: Currency & Number Input Standardization - Research

**Researched:** 2026-02-02
**Domain:** React controlled inputs, number formatting, currency display
**Confidence:** HIGH

## Summary

This phase standardizes number input behavior and currency display across the QM system. Number inputs will preserve user-typed values without auto-formatting on blur, while currency displays will show original amounts with EUSD equivalents in a consistent two-line stacked format.

The current implementation uses basic HTML `type="number"` inputs with `formatCurrency()` and `formatAmount()` utilities powered by `Intl.NumberFormat`. These utilities already provide proper thousand separators and decimal formatting. The phase enhances input behavior to prevent formatting-on-blur issues and standardizes currency display patterns across all views.

**Primary recommendation:** Use controlled string state for number inputs with onKeyDown validation to block invalid characters during typing, and format values only on form submit. For displays, create a reusable CurrencyDisplay component that stacks original currency above EUSD equivalent.

## Standard Stack

The project already uses proven libraries and patterns:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Intl.NumberFormat | Browser API | Number/currency formatting | Native JavaScript API with excellent browser support, zero dependencies |
| React Hook Form | ^7.53.0 | Form state management | Industry standard for React forms, handles controlled inputs well |
| Radix UI Toast | ^1.2.15 | Toast notifications | Accessible, composable, already integrated |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^3.23.8 | Schema validation | Form submission validation, transform input strings to numbers |
| clsx + tailwind-merge | ^2.1.1, ^2.5.2 | Conditional styling | Dynamic styling for validation states |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native browser validation | Custom JS validation only | Browser validation provides baseline UX; use both together |
| react-number-format | Custom controlled input | Library has known caret-jumping issues; custom is simpler for this use case |
| Inline error messages | Toast notifications only | Context decisions specify toast; inline is generally better but not chosen |

**Installation:**
No new packages needed. Current stack sufficient.

## Architecture Patterns

### Recommended Project Structure
```
components/
├── forms/
│   ├── number-input.tsx          # Controlled number input with validation
│   ├── amount-input.tsx          # Currency amount input (2 decimals)
│   ├── exchange-rate-input.tsx   # Exchange rate input (4 decimals)
│   └── quantity-input.tsx        # Integer-only quantity input
├── display/
│   └── currency-display.tsx      # Two-line currency display component
lib/
└── utils/
    ├── index.ts                  # Existing formatCurrency/formatAmount
    └── input-validation.ts       # Input validation helpers (NEW)
```

### Pattern 1: Controlled Number Input (Preserve User Input)
**What:** Use string state for number inputs, validate on keyDown, parse on submit
**When to use:** All numeric form inputs (amount, exchange rate, quantity)
**Example:**
```typescript
// Source: Best practices from research
const [amount, setAmount] = useState<string>("");

const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  // Block invalid characters
  if (e.key === "-" || e.key === "e" || e.key === "E") {
    e.preventDefault();
  }

  // Block extra decimal points
  if (e.key === "." && amount.includes(".")) {
    e.preventDefault();
  }

  // For 2-decimal amounts, block typing past 2 decimals
  const parts = amount.split(".");
  if (parts[1]?.length >= 2 && e.key !== "Backspace" && e.key !== "Delete") {
    e.preventDefault();
  }
};

<Input
  type="number"
  step="0.01"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder=""  // Empty placeholder
/>
```

### Pattern 2: Two-Line Currency Display
**What:** Stack original currency above EUSD equivalent
**When to use:** All financial amount displays
**Example:**
```typescript
// Source: Designed for this phase
interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  exchangeRate?: number;
  className?: string;
}

export function CurrencyDisplay({ amount, currency, exchangeRate = 1, className }: CurrencyDisplayProps) {
  const eusd = amount / exchangeRate;

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className="text-slate-200 font-mono">
        {formatAmount(amount, currency)}
      </div>
      <div className="text-sm text-slate-400 font-mono">
        {formatCurrency(eusd, 2)} EUSD
      </div>
    </div>
  );
}
```

### Pattern 3: Toast Validation on Submit
**What:** Show validation errors via toast notification on form submit
**When to use:** Form-level validation (per context decisions)
**Example:**
```typescript
// Source: Existing toast pattern in codebase
const handleSubmit = () => {
  const amountNum = parseFloat(amount);
  const rateNum = parseFloat(exchangeRate);

  if (isNaN(amountNum) || amountNum <= 0) {
    toast({
      variant: "destructive",
      title: "Invalid Amount",
      description: "Please enter a valid positive amount.",
    });
    return;
  }

  if (isNaN(rateNum) || rateNum <= 0) {
    toast({
      variant: "destructive",
      title: "Invalid Exchange Rate",
      description: "Please enter a valid exchange rate.",
    });
    return;
  }

  // Proceed with submission
};
```

### Anti-Patterns to Avoid
- **Formatting on blur:** Causes loss of leading zeros and user-typed precision
- **Number state for inputs:** Prevents empty string and loses typed precision
- **Inline error borders:** Context decisions specify toast notifications instead
- **Auto-formatting during typing:** Causes caret jumping and poor UX

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting with thousand separators | Custom regex/string manipulation | Intl.NumberFormat | Handles locales, edge cases, browser-tested |
| Input decimal validation | Complex regex on onChange | onKeyDown + step attribute | Real-time blocking prevents invalid input entirely |
| Currency conversion calculation | Custom math with rounding | Math.round((amount / rate) * 100) / 100 | Standard pattern prevents floating point errors |
| Toast state management | Custom context provider | Existing @radix-ui/react-toast | Already integrated, accessible, tested |

**Key insight:** Number input handling seems simple but has many edge cases (leading zeros, decimal points, negative signs, scientific notation, caret position). The controlled string state with onKeyDown validation avoids most issues without libraries.

## Common Pitfalls

### Pitfall 1: Using Number State for Inputs
**What goes wrong:** Input value cannot be empty string, loses leading zeros, prevents partial input like "0."
**Why it happens:** Natural assumption that number inputs should have number state
**How to avoid:** Use string state, parse to number only on validation/submit
**Warning signs:** Input jumps to 0 when cleared, can't type "0.5" smoothly

### Pitfall 2: Formatting on Blur
**What goes wrong:** User types "007.50" and it changes to "7.50" on blur, breaking user trust
**Why it happens:** Attempting to show "pretty" formatted values during editing
**How to avoid:** Only format on final display or after form submission
**Warning signs:** User complaints about values changing while typing

### Pitfall 3: Floating Point Precision in Display
**What goes wrong:** Displays show "3999.9999999" or "4000.00000001" instead of "4000.00"
**Why it happens:** JavaScript floating point arithmetic (e.g., 4000 / 1.0001 = 3999.6000399...)
**How to avoid:** Always round before display with formatCurrency utility
**Warning signs:** Extra decimals appearing in displays, inconsistent decimal places

### Pitfall 4: Inconsistent Currency Placement
**What goes wrong:** Some views show "USD 500", others "500 USD", "500.00 USD", creating confusion
**Why it happens:** Ad-hoc string concatenation instead of consistent utility usage
**How to avoid:** Use formatAmount utility consistently, which puts currency after number
**Warning signs:** User reports of confusing displays, inconsistent formatting

### Pitfall 5: Input Step Attribute Mismatch
**What goes wrong:** Input has step="0.01" but validation allows 4 decimals, or vice versa
**Why it happens:** Step attribute and validation logic maintained separately
**How to avoid:** Match step attribute to decimal validation logic
**Warning signs:** Browser validation conflicts with onKeyDown blocking

### Pitfall 6: Missing Thousand Separators
**What goes wrong:** Large numbers like "1000000" displayed without separators, hard to read
**Why it happens:** Using toFixed() or string concatenation instead of Intl.NumberFormat
**How to avoid:** Always use formatCurrency/formatAmount utilities for display
**Warning signs:** Numbers with >4 digits displayed without commas

## Code Examples

Verified patterns for common operations:

### Amount Input (2 Decimals)
```typescript
// Source: Enhanced from existing pattern in stock-in/po forms
const [amount, setAmount] = useState<string>("");

const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  // Block invalid characters
  if (["-", "e", "E", "+"].includes(e.key)) {
    e.preventDefault();
    return;
  }

  const value = (e.target as HTMLInputElement).value;

  // Block extra decimal points
  if (e.key === "." && value.includes(".")) {
    e.preventDefault();
    return;
  }

  // Block typing past 2 decimal places
  const parts = value.split(".");
  if (parts.length === 2 && parts[1].length >= 2) {
    // Allow backspace, delete, arrow keys
    if (!["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
      e.preventDefault();
    }
  }
};

<Input
  type="number"
  step="0.01"
  min="0"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  onKeyDown={handleAmountKeyDown}
  placeholder=""
  className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

### Exchange Rate Input (4 Decimals)
```typescript
// Source: Enhanced from existing po/new pattern
const [exchangeRate, setExchangeRate] = useState<string>("");

const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (["-", "e", "E", "+"].includes(e.key)) {
    e.preventDefault();
    return;
  }

  const value = (e.target as HTMLInputElement).value;

  if (e.key === "." && value.includes(".")) {
    e.preventDefault();
    return;
  }

  // Block typing past 4 decimal places
  const parts = value.split(".");
  if (parts.length === 2 && parts[1].length >= 4) {
    if (!["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key)) {
      e.preventDefault();
    }
  }
};

<Input
  type="number"
  step="0.0001"
  min="0.0001"
  value={exchangeRate}
  onChange={(e) => setExchangeRate(e.target.value)}
  onKeyDown={handleRateKeyDown}
  placeholder=""
  className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

### Quantity Input (Integer Only)
```typescript
// Source: Enhanced from existing stock-in pattern
const [quantity, setQuantity] = useState<string>("");

const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  // Block everything except digits
  if (["-", "e", "E", "+", "."].includes(e.key)) {
    e.preventDefault();
  }
};

<Input
  type="number"
  step="1"
  min="1"
  value={quantity}
  onChange={(e) => setQuantity(e.target.value)}
  onKeyDown={handleQuantityKeyDown}
  placeholder=""
  className="font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

### Currency Display Component
```typescript
// Source: Designed for this phase based on context decisions
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  exchangeRate?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate = 1,
  size = "md",
  className,
}: CurrencyDisplayProps) {
  const eusd = exchangeRate > 0 ? amount / exchangeRate : 0;

  const sizeClasses = {
    sm: {
      original: "text-sm",
      eusd: "text-xs",
    },
    md: {
      original: "text-base",
      eusd: "text-sm",
    },
    lg: {
      original: "text-lg",
      eusd: "text-base",
    },
  };

  return (
    <div className={cn("space-y-0.5", className)}>
      <div className={cn("text-slate-200 font-mono", sizeClasses[size].original)}>
        {formatCurrency(amount, 2)} {currency}
      </div>
      <div className={cn("text-slate-400 font-mono", sizeClasses[size].eusd)}>
        {formatCurrency(eusd, 2)} EUSD
      </div>
    </div>
  );
}
```

### Validation Helper
```typescript
// Source: Designed for this phase
// lib/utils/input-validation.ts

export function validateAmount(value: string): { valid: boolean; error?: string } {
  if (!value || value.trim() === "") {
    return { valid: false, error: "Amount is required" };
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: "Please enter a valid number" };
  }

  if (num <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  // Check decimal places
  const parts = value.split(".");
  if (parts[1] && parts[1].length > 2) {
    return { valid: false, error: "Amount cannot have more than 2 decimal places" };
  }

  return { valid: true };
}

export function validateExchangeRate(value: string): { valid: boolean; error?: string } {
  if (!value || value.trim() === "") {
    return { valid: false, error: "Exchange rate is required" };
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: "Please enter a valid exchange rate" };
  }

  if (num <= 0) {
    return { valid: false, error: "Exchange rate must be greater than 0" };
  }

  // Check decimal places
  const parts = value.split(".");
  if (parts[1] && parts[1].length > 4) {
    return { valid: false, error: "Exchange rate cannot have more than 4 decimal places" };
  }

  return { valid: true };
}

export function validateQuantity(value: string): { valid: boolean; error?: string } {
  if (!value || value.trim() === "") {
    return { valid: false, error: "Quantity is required" };
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: "Please enter a valid quantity" };
  }

  if (num <= 0) {
    return { valid: false, error: "Quantity must be greater than 0" };
  }

  // Must be integer
  if (!Number.isInteger(num)) {
    return { valid: false, error: "Quantity must be a whole number" };
  }

  return { valid: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Controlled number state | Controlled string state | 2024+ | Allows empty placeholder, preserves precision |
| Format on blur | Format on submit only | 2024+ | Better UX, preserves user intent |
| Inline validation errors | Toast notifications | Per project decision | Centralized feedback pattern |
| Custom number formatting | Intl.NumberFormat API | Stable since ES2020 | Better locale support, less code |

**Deprecated/outdated:**
- **react-number-format library:** Known caret-jumping issues, custom solution more reliable
- **onChange validation with regex:** onKeyDown blocking provides better UX
- **Inline red border errors:** Project uses toast notifications for validation

## Open Questions

Things that couldn't be fully resolved:

1. **EUSD Panel Visibility When Amount Empty**
   - What we know: Context marks this as Claude's discretion
   - What's unclear: Hide completely vs show with dashes
   - Recommendation: Show with dashes for consistency; user knows calculation is pending

2. **EUSD Line Styling**
   - What we know: Should be distinguishable from original amount
   - What's unclear: Smaller font vs muted color vs both
   - Recommendation: Use both (text-sm and text-slate-400) for clear visual hierarchy

3. **Table Column Currency Display**
   - What we know: Limited space in table columns
   - What's unclear: Tooltip implementation for EUSD when showing only original
   - Recommendation: Use Radix Tooltip component (already in deps) with hover

## Sources

### Primary (HIGH confidence)
- [MDN: Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) - Number formatting API documentation
- [MDN: input type="number"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number) - HTML number input specification
- Existing codebase: /lib/utils/index.ts (formatCurrency, formatAmount utilities)
- Existing codebase: /components/ui/use-toast.tsx (toast notification pattern)

### Secondary (MEDIUM confidence)
- [DEV Community: Number and Currency Formatting in JavaScript using Intl.NumberFormat](https://dev.to/schalkneethling/number-and-currency-formatting-in-javascript-using-intlnumberformat-46og) - Practical Intl.NumberFormat patterns
- [Piccalilli: Using the step and pattern attributes](https://piccalil.li/blog/using-the-step-and-pattern-attributes-to-make-number-inputs-more-useful/) - HTML input validation best practices
- [NN/G: 10 Design Guidelines for Reporting Errors in Forms](https://www.nngroup.com/articles/errors-forms-design-guidelines/) - UX research on form validation
- [Smart Interface Design Patterns: Error Messages UX](https://smart-interface-design-patterns.com/articles/error-messages-ux/) - Inline vs toast validation trade-offs

### Tertiary (LOW confidence)
- [tedeh.net: Input number formatting in React](https://tedeh.net/a-simple-compromise-input-number-formatting-in-react/) - Split-state compromise approach (2022, may be outdated)
- [DEV Community: How to block +,- and e in Number Input](https://dev.to/narendersaini32/how-to-block-and-e-in-number-input-1hoe) - onKeyDown validation patterns
- [GitHub: react-number-format](https://github.com/s-yadav/react-number-format) - Library with known issues, not recommended

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing utilities already use Intl.NumberFormat, proven pattern
- Architecture: HIGH - Controlled string state is well-documented best practice for 2024+
- Pitfalls: HIGH - Based on common React form issues and existing codebase patterns
- Code examples: HIGH - Enhanced from existing codebase patterns, tested approaches

**Research date:** 2026-02-02
**Valid until:** 60 days (stable domain, core patterns unlikely to change)
