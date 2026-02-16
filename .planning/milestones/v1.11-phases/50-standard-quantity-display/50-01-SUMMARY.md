---
phase: 50-standard-quantity-display
plan: 01
subsystem: ui-components
tags: [standard-quantities, display-components, ui-foundation]
dependency-graph:
  requires: [use-standard-unit-name-hook, system-config-table]
  provides: [standard-unit-display-component]
  affects: [inventory-ui, po-ui, invoice-ui]
tech-stack:
  added: []
  patterns: [two-line-display, conditional-rendering, hook-integration]
key-files:
  created:
    - components/ui/standard-unit-display.tsx
  modified: []
decisions: []
metrics:
  duration: 42 seconds
  tasks: 1
  commits: 1
  files_created: 1
  files_modified: 0
  completed: 2026-02-16
---

# Phase 50 Plan 01: StandardUnitDisplay Component Summary

**One-liner:** Created reusable two-line quantity display component mirroring CurrencyDisplay pattern with admin-configured unit names

---

## What Was Built

Created `StandardUnitDisplay` component that provides a standardized way to display quantities with their standard unit equivalents throughout the system.

### Component Features

**Two-Line Display Pattern:**
- Primary line: Original quantity in `font-mono text-slate-200`
- Secondary line: Standard quantity + unit name in `font-mono text-slate-400` (smaller, muted)
- Mirrors CurrencyDisplay's EUSD pattern exactly

**API:**
```tsx
interface StandardUnitDisplayProps {
  quantity: number | null | undefined;
  conversionRate: number;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  className?: string;
}
```

**Calculation:**
- Standard qty = quantity × conversionRate
- Numbers formatted with thousand separators and 2 decimal places
- Uses `Intl.NumberFormat` for consistent formatting

**Dynamic Unit Names:**
- Uses `useStandardUnitName()` hook to retrieve admin-configured unit name
- Hides second line when unit name not configured or loading
- Defaults to "Standard Units" but can be customized in system config

**Size Variants:**
- `sm`: primary text-sm, secondary text-xs
- `md`: primary text-base, secondary text-sm
- `lg`: primary text-lg font-semibold, secondary text-sm
- Matches CurrencyDisplay size system exactly

**Edge Case Handling:**
- Null/undefined quantities display as "0.00"
- Always shows second line when unit name configured (even with conversion_rate = 1)
- No abbreviation/compact formatting (quantities typically smaller than currency amounts)

---

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create StandardUnitDisplay component | 5824c3a | components/ui/standard-unit-display.tsx |

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Technical Implementation

### Component Structure

The component follows the same architectural pattern as CurrencyDisplay:
1. Client component with "use client" directive
2. Calls hook (`useStandardUnitName`) to get dynamic configuration
3. Performs calculation (standard qty = qty × rate)
4. Formats numbers using Intl.NumberFormat
5. Renders two-line layout with conditional secondary line
6. Supports size variants and alignment props

### Conditional Rendering Logic

Second line only displays when:
- `isLoading` is false (hook has fetched data)
- `unitName` is truthy and non-empty
- This ensures clean UI when admin hasn't configured a custom unit name

### Number Formatting

Uses consistent formatting pattern:
```tsx
const formatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
```

This matches the precision used in financial displays and ensures consistent number presentation.

---

## Integration Points

### Dependencies
- `@/lib/utils` - cn utility for className composition
- `@/lib/hooks/use-standard-unit-name` - Dynamic unit name retrieval

### Usage Pattern
```tsx
<StandardUnitDisplay
  quantity={item.quantity}
  conversionRate={item.conversion_rate}
  size="md"
  align="right"
/>
```

Will be integrated in:
- Phase 50-02: PO and Invoice line item tables
- Phase 50-03: Stock movement tables
- Phase 50-04: Warehouse inventory lists

---

## Verification

**TypeScript Check:**
```bash
npx tsc --noEmit 2>&1 | grep -c "standard-unit-display"
# Result: 0 (no type errors)
```

**File Creation:**
```bash
ls components/ui/standard-unit-display.tsx
# Result: File exists (2.4K)
```

**Exports:**
- `StandardUnitDisplay` (component)
- `StandardUnitDisplayProps` (interface)

---

## Next Steps

**Phase 50-02:** Integrate StandardUnitDisplay into PO and Invoice line item tables
- Replace quantity-only display with two-line format
- Show standard quantities alongside original quantities
- Use per-line-item conversion rates

**Phase 50-03:** Add to stock movement tables
- Stock-in transactions
- Stock-out transactions
- Warehouse transfer displays

**Phase 50-04:** Add to warehouse inventory display
- Current stock levels
- Available quantity displays
- Inventory value calculations

---

## Self-Check

**File existence:**
```bash
[ -f "components/ui/standard-unit-display.tsx" ] && echo "FOUND: components/ui/standard-unit-display.tsx"
```
Result: FOUND: components/ui/standard-unit-display.tsx

**Commit existence:**
```bash
git log --oneline --all | grep -q "5824c3a" && echo "FOUND: 5824c3a"
```
Result: FOUND: 5824c3a

## Self-Check: PASSED

All claimed files and commits exist and are accessible.
