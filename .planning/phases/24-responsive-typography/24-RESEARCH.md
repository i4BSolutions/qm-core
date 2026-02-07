# Phase 24: Responsive Typography - Research

**Researched:** 2026-02-07
**Domain:** CSS fluid typography, number abbreviation, responsive currency display
**Confidence:** HIGH

## Summary

This phase addresses responsive typography for currency/amount displays across the QM System. The existing `CurrencyDisplay` component uses fixed font sizes with basic truncation support. This phase enhances it with fluid font scaling using CSS `clamp()`, K/M/B abbreviations for large numbers, and proper tooltip behavior.

The approach centers on enhancing the existing `CurrencyDisplay` component rather than creating new components. CSS `clamp()` provides smooth font scaling between min/max bounds, while the native `Intl.NumberFormat` with `notation: "compact"` handles K/M/B abbreviations. Container query units (`cqi`) can be used for container-responsive scaling, but viewport-based `clamp()` is simpler and sufficient for this use case.

**Primary recommendation:** Enhance `CurrencyDisplay` with fluid typography via CSS `clamp()` in Tailwind config, add a `formatCompactCurrency()` utility for K/M/B abbreviations, and use the existing Radix Tooltip component for hover tooltips (desktop only). Keep the two-line stacked format (original + EUSD) intact.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fluid scaling using CSS clamp() - font shrinks smoothly as number grows or container shrinks
- EUSD line scales in proportion to primary amount (not independently)
- Apply fluid scaling everywhere - cards, summary sections, tables, detail pages
- Use K/M/B abbreviations for large numbers (not ellipsis)
- Context-dependent thresholds: cards abbreviate earlier (M+), tables/details show full numbers longer
- Hover tooltip reveals full value (desktop only)
- Tooltip shows only the truncated value, not both currencies
- Negative amounts: minus sign prefix + red text color
- Zero amounts: display as "0.00" with currency symbol (not dash, not muted)
- Loading states: skeleton placeholder matching expected amount width
- Alignment: keep existing two-line stacked format (CurrencyDisplay), no side-by-side changes

### Claude's Discretion
- Minimum font size before truncation kicks in (accessibility best practices)
- Exact clamp() values and breakpoint calculations
- Mobile touch behavior for tooltips (if needed)

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Intl.NumberFormat | Browser API | Compact number formatting (K/M/B) | Native, zero dependencies, 98%+ browser support |
| CSS clamp() | CSS3 | Fluid font sizing | Native CSS, 91%+ browser support, no JS required |
| Tailwind CSS | ^3.4.13 | Custom fluid font size utilities | Already in project, extends easily |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix UI Tooltip | ^1.1.3 | Hover tooltips for full values | Already installed, accessible by default |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Intl.NumberFormat compact | millify/numeral.js | Extra dependency for native functionality |
| CSS clamp() | JavaScript font scaling | CSS is simpler, no layout thrashing |
| Container queries (cqi) | Viewport clamp (vw) | Container queries add complexity; vw sufficient |

**Installation:**
```bash
# No new dependencies needed - all native or already installed
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
└── utils/
    ├── index.ts                  # Export formatCompactCurrency
    └── format-compact.ts         # NEW: K/M/B abbreviation logic

components/
└── ui/
    ├── currency-display.tsx      # ENHANCE: Add fluid sizing + abbreviation props
    └── currency-skeleton.tsx     # NEW: Amount-width skeleton for loading

tailwind.config.ts                # ADD: fluid font size utilities
```

### Pattern 1: Fluid Typography with CSS clamp()
**What:** Font sizes that scale smoothly between min and max based on viewport/container
**When to use:** All amount displays that may overflow their container
**Example:**
```css
/* Source: MDN clamp() docs, Tailwind config patterns */
fontSize: {
  // Fluid amounts - scales from 0.875rem (14px) at 320px to 1.125rem (18px) at 1280px
  'fluid-sm': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
  'fluid-base': 'clamp(0.875rem, 0.8rem + 0.375vw, 1rem)',
  'fluid-lg': 'clamp(1rem, 0.9rem + 0.5vw, 1.25rem)',
}
```

### Pattern 2: Compact Number Formatting with Intl.NumberFormat
**What:** Abbreviate large numbers to K/M/B format using native API
**When to use:** When displaying amounts that would overflow (context-dependent thresholds)
**Example:**
```typescript
// Source: Intl.NumberFormat MDN docs, freeCodeCamp
function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  });
  return formatter.format(value);
}

formatCompactNumber(1234);          // "1.2K"
formatCompactNumber(1234567);       // "1.2M"
formatCompactNumber(1234567890);    // "1.2B"
formatCompactNumber(1234567890123); // "1.2T"
```

### Pattern 3: Context-Dependent Abbreviation Thresholds
**What:** Different abbreviation thresholds based on display context
**When to use:** Cards abbreviate earlier, tables/details show full numbers longer
**Example:**
```typescript
// Threshold configuration per context
const ABBREVIATION_THRESHOLDS = {
  card: 1_000_000,      // Abbreviate at 1M+ on cards
  table: 1_000_000_000, // Abbreviate at 1B+ in tables
  detail: Infinity,     // Never abbreviate on detail pages (tooltip only)
} as const;

type DisplayContext = keyof typeof ABBREVIATION_THRESHOLDS;

function shouldAbbreviate(value: number, context: DisplayContext): boolean {
  return Math.abs(value) >= ABBREVIATION_THRESHOLDS[context];
}
```

### Pattern 4: Proportional EUSD Scaling
**What:** EUSD line maintains proportional relationship with primary amount
**When to use:** CurrencyDisplay two-line format
**Example:**
```css
/* Primary uses fluid-base, secondary uses proportionally smaller fluid-sm */
.amount-primary { font-size: clamp(0.875rem, 0.8rem + 0.375vw, 1rem); }
.amount-secondary { font-size: clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem); }
```

### Anti-Patterns to Avoid
- **Independent EUSD scaling:** Primary and EUSD should scale together, not independently
- **Ellipsis for numbers:** Users decided K/M/B abbreviations, not "1,234,567..." with ellipsis
- **Tooltip on mobile hover:** Hover doesn't work on touch devices; skip tooltips on mobile
- **Scaling below 12px:** Accessibility violation; use abbreviation instead of tiny fonts
- **Mutating zero display:** Show "0.00 MMK" with normal styling, not dash or muted

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| K/M/B abbreviation | Custom division + suffix | Intl.NumberFormat notation: "compact" | Handles edge cases, localization ready |
| Fluid font sizing | JavaScript resize observers | CSS clamp() | No JS, no layout thrashing |
| Accessible tooltips | Custom hover handlers | Radix UI Tooltip | Handles focus, keyboard, ARIA |
| Number formatting | Custom regex/locale | Intl.NumberFormat | Locale-aware, handles decimals |

**Key insight:** The native Intl.NumberFormat API provides compact notation (K/M/B) out of the box with proper handling of edge cases like negative numbers and decimal precision. CSS clamp() handles fluid typography without JavaScript.

## Common Pitfalls

### Pitfall 1: Font Size Below 12px
**What goes wrong:** Text becomes unreadable; fails WCAG accessibility
**Why it happens:** clamp() minimum set too low
**How to avoid:** Set minimum at 12px (0.75rem) for secondary text, 14px (0.875rem) for primary amounts
**Warning signs:** Text requires zooming to read

### Pitfall 2: Hover Tooltips on Touch Devices
**What goes wrong:** Users can't access full value because hover doesn't exist
**Why it happens:** Assuming desktop-only usage
**How to avoid:** Use touch-detection or just skip tooltips on mobile (abbreviation is sufficient)
**Warning signs:** Mobile users complain about inaccessible values

### Pitfall 3: Abbreviation Precision Loss
**What goes wrong:** 1,234,567 shows as "1M" instead of "1.2M"
**Why it happens:** maximumFractionDigits not set
**How to avoid:** Set `maximumFractionDigits: 1` in Intl.NumberFormat options
**Warning signs:** Important precision differences hidden

### Pitfall 4: Negative Amount Handling
**What goes wrong:** Negative numbers display incorrectly or lose minus sign
**Why it happens:** Not testing with negative values
**How to avoid:** Test with negative amounts; Intl.NumberFormat handles this correctly
**Warning signs:** "-1234567" displays as "1.2M" without minus

### Pitfall 5: Skeleton Width Mismatch
**What goes wrong:** Skeleton placeholder is much wider/narrower than actual content
**Why it happens:** Using fixed skeleton width instead of matching expected content
**How to avoid:** Size skeleton based on expected number of digits + currency code
**Warning signs:** Layout shifts when content loads

### Pitfall 6: Independent Line Scaling
**What goes wrong:** Primary amount shrinks but EUSD stays large (or vice versa)
**Why it happens:** Applying fluid sizing to lines independently
**How to avoid:** Apply proportional sizing classes; both lines scale together
**Warning signs:** Visual hierarchy breaks at certain viewport sizes

## Code Examples

Verified patterns from official sources:

### formatCompactCurrency Utility
```typescript
// Source: Intl.NumberFormat MDN docs
// lib/utils/format-compact.ts
export interface CompactFormatOptions {
  /** Number of decimal places for abbreviated numbers (default: 1) */
  decimalPlaces?: number;
  /** Always show sign for positive numbers */
  signDisplay?: "auto" | "always" | "exceptZero" | "never";
}

export function formatCompactNumber(
  value: number,
  options: CompactFormatOptions = {}
): string {
  const { decimalPlaces = 1, signDisplay = "auto" } = options;

  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: decimalPlaces,
    signDisplay,
  });

  return formatter.format(value);
}

/**
 * Format currency with K/M/B abbreviation when above threshold
 * Returns { display: string, isAbbreviated: boolean, fullValue: string }
 */
export function formatCompactCurrency(
  value: number,
  currency: string,
  threshold: number = 1_000_000,
  decimals: number = 2
): { display: string; isAbbreviated: boolean; fullValue: string } {
  const absValue = Math.abs(value);
  const fullValue = `${new Intl.NumberFormat("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)} ${currency}`;

  if (absValue < threshold) {
    return { display: fullValue, isAbbreviated: false, fullValue };
  }

  const compact = formatCompactNumber(value, { decimalPlaces: 1 });
  return {
    display: `${compact} ${currency}`,
    isAbbreviated: true,
    fullValue
  };
}
```

### Tailwind Fluid Font Size Configuration
```typescript
// Source: Tailwind docs, CSS-Tricks clamp() patterns
// tailwind.config.ts (add to fontSize in theme.extend)
fontSize: {
  // Existing display sizes...

  // Fluid amount sizes - scale with viewport
  // Formula: clamp(min, preferred, max)
  // preferred = min + (max - min) * ((100vw - 320px) / (1280px - 320px))
  'fluid-amount-sm': ['clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)', { lineHeight: '1.25' }],
  'fluid-amount-base': ['clamp(0.875rem, 0.8rem + 0.375vw, 1rem)', { lineHeight: '1.25' }],
  'fluid-amount-lg': ['clamp(1rem, 0.9rem + 0.5vw, 1.25rem)', { lineHeight: '1.25' }],
  'fluid-amount-xl': ['clamp(1.125rem, 1rem + 0.625vw, 1.5rem)', { lineHeight: '1.2' }],
}
```

### Enhanced CurrencyDisplay Component
```typescript
// Source: Existing component + fluid typography patterns
// components/ui/currency-display.tsx (enhanced)
"use client";

import { formatCurrency, calculateEUSD } from "@/lib/utils";
import { formatCompactCurrency } from "@/lib/utils/format-compact";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface CurrencyDisplayProps {
  amount: number | null | undefined;
  currency: string;
  exchangeRate?: number;
  amountEusd?: number | null;
  size?: "sm" | "md" | "lg";
  showDashForEmpty?: boolean;
  className?: string;
  align?: "left" | "right";
  /** Display context affects abbreviation threshold */
  context?: "card" | "table" | "detail";
  /** Enable fluid font scaling */
  fluid?: boolean;
}

const THRESHOLDS = {
  card: 1_000_000,       // 1M+
  table: 1_000_000_000,  // 1B+
  detail: Infinity,      // Never abbreviate
} as const;

export function CurrencyDisplay({
  amount,
  currency,
  exchangeRate = 1,
  amountEusd,
  size = "md",
  showDashForEmpty = false,
  className,
  align = "left",
  context = "detail",
  fluid = false,
}: CurrencyDisplayProps) {
  const displayAmount = amount ?? 0;
  const isEmpty = amount === null || amount === undefined;
  const isZero = displayAmount === 0;
  const isNegative = displayAmount < 0;

  if (isEmpty && showDashForEmpty) {
    return (
      <div className={cn("flex flex-col min-w-0", align === "right" && "items-end", className)}>
        <span className={cn(
          "font-mono text-slate-400",
          fluid ? "text-fluid-amount-base" : sizeStyles[size].primary
        )}>
          -
        </span>
      </div>
    );
  }

  // Calculate EUSD
  const eusdValue = amountEusd ?? calculateEUSD(displayAmount, exchangeRate);

  // Format with abbreviation based on context
  const threshold = THRESHOLDS[context];
  const primary = formatCompactCurrency(displayAmount, currency, threshold);
  const secondary = formatCompactCurrency(eusdValue, "EUSD", threshold);

  // Size-based styling (non-fluid fallback)
  const sizeStyles = {
    sm: { primary: "text-sm", secondary: "text-xs" },
    md: { primary: "text-base", secondary: "text-sm" },
    lg: { primary: "text-lg font-semibold", secondary: "text-sm" },
  };

  // Fluid size classes
  const fluidStyles = {
    sm: { primary: "text-fluid-amount-sm", secondary: "text-fluid-amount-sm" },
    md: { primary: "text-fluid-amount-base", secondary: "text-fluid-amount-sm" },
    lg: { primary: "text-fluid-amount-lg", secondary: "text-fluid-amount-base" },
  };

  const styles = fluid ? fluidStyles[size] : sizeStyles[size];

  const content = (
    <div className={cn(
      "flex flex-col min-w-0",
      align === "right" && "items-end",
      className
    )}>
      <span className={cn(
        "font-mono",
        isNegative ? "text-red-400" : "text-slate-200",
        styles.primary
      )}>
        {primary.display}
      </span>
      <span className={cn(
        "font-mono",
        isNegative ? "text-red-400/70" : "text-slate-400",
        styles.secondary
      )}>
        {secondary.display}
      </span>
    </div>
  );

  // Only show tooltip if abbreviated (desktop only via CSS)
  if (primary.isAbbreviated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent className="hidden md:block">
          <span className="font-mono">{primary.fullValue}</span>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
```

### Currency Skeleton Component
```typescript
// Source: Existing Skeleton component pattern
// components/ui/currency-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CurrencySkeletonProps {
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  className?: string;
}

export function CurrencySkeleton({
  size = "md",
  align = "left",
  className
}: CurrencySkeletonProps) {
  const sizeMap = {
    sm: { primary: "h-4 w-24", secondary: "h-3 w-20" },
    md: { primary: "h-5 w-28", secondary: "h-4 w-24" },
    lg: { primary: "h-6 w-32", secondary: "h-4 w-28" },
  };

  return (
    <div className={cn(
      "flex flex-col gap-1",
      align === "right" && "items-end",
      className
    )}>
      <Skeleton className={sizeMap[size].primary} />
      <Skeleton className={sizeMap[size].secondary} />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JavaScript font sizing | CSS clamp() | Stable since 2020 | No JS, better performance |
| Media query breakpoints | Fluid typography | Stable since 2021 | Smooth scaling, less CSS |
| Custom K/M/B logic | Intl.NumberFormat compact | Stable since ES2020 | Native, handles edge cases |
| Viewport units only | rem + vw combination | Best practice | Respects user zoom preferences |

**Deprecated/outdated:**
- **Fitty/textFit libraries:** Replaced by CSS clamp() for simpler cases
- **Viewport-only font sizing:** Fails WCAG zoom requirements; use rem + vw
- **Hover-only tooltips:** Touch devices need alternative; consider tap or no tooltip

## Open Questions

Things that couldn't be fully resolved:

1. **Container Query Units (cqi) vs Viewport (vw)**
   - What we know: cqi provides container-responsive scaling; vw is viewport-based
   - What's unclear: Whether card containers need true container queries
   - Recommendation: Start with viewport-based clamp(); add cqi later if needed

2. **Mobile Touch Tooltip Behavior**
   - What we know: Hover doesn't work on touch; Radix Tooltip supports touch
   - What's unclear: Whether tap-to-reveal is intuitive for abbreviated numbers
   - Recommendation: Hide tooltips on mobile via CSS `hidden md:block`; abbreviation is sufficient

3. **Exact Abbreviation Thresholds**
   - What we know: Cards should abbreviate earlier than tables
   - What's unclear: Optimal thresholds for specific card widths
   - Recommendation: Start with 1M for cards, 1B for tables; adjust based on testing

## Sources

### Primary (HIGH confidence)
- [MDN clamp()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/clamp) - CSS clamp() syntax and examples
- [Intl.NumberFormat - freeCodeCamp](https://www.freecodecamp.org/news/format-compact-numbers-with-javascript/) - Compact notation usage
- [Tailwind CSS font-size](https://tailwindcss.com/docs/font-size) - Custom font size configuration
- Existing codebase: `/components/ui/currency-display.tsx` - Current implementation
- Existing codebase: `/components/ui/tooltip.tsx` - Radix Tooltip wrapper

### Secondary (MEDIUM confidence)
- [Modern CSS Container Query Units](https://moderncss.dev/container-query-units-and-fluid-typography/) - cqi patterns
- [Smashing Magazine Fluid Typography](https://www.smashingmagazine.com/2022/01/modern-fluid-typography-css-clamp/) - clamp() best practices
- [Tailwind Fluid Typography](https://tryhoverify.com/blog/fluid-typography-tricks-scaling-text-seamlessly-across-devices-with-tailwind-and-css-clamp/) - Tailwind config examples

### Tertiary (LOW confidence)
- [Mayank Tooltips on Touchscreens](https://mayank.co/blog/tooltips-on-touchscreens/) - Touch tooltip patterns
- [WCAG Font Size Guidelines](https://www.a11y-collective.com/blog/wcag-minimum-font-size/) - Accessibility requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Native APIs (Intl, CSS clamp) are well-documented
- Architecture: HIGH - Patterns based on existing codebase + official docs
- Pitfalls: HIGH - Based on documented accessibility requirements and CSS behavior
- Code examples: HIGH - Based on MDN, Tailwind docs, and existing component patterns

**Research date:** 2026-02-07
**Valid until:** 90 days (stable domain, native APIs)
