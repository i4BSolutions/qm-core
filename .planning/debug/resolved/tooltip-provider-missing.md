---
status: resolved
trigger: "tooltip-provider-missing"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - CurrencyDisplay uses Tooltip but TooltipProvider is missing from app layout
test: Add TooltipProvider to root layout
expecting: Error will be resolved, tooltips will work
next_action: Add TooltipProvider to app/layout.tsx

## Symptoms

expected: Page should render without errors
actual: Runtime error - Tooltip must be used within TooltipProvider
errors: |
  Error: Tooltip must be used within TooltipProvider
  at R (...)
reproduction: Visit QMHQ detail page (or any page with CurrencyDisplay that uses tooltips)
started: Just broke after recent CurrencyDisplay additions (commits fdb3130, 4b428b8)

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:01:00Z
  checked: components/ui/currency-display.tsx
  found: Lines 151-161 use Tooltip/TooltipTrigger/TooltipContent when primaryFormatted.isAbbreviated is true
  implication: CurrencyDisplay requires TooltipProvider in parent component tree

- timestamp: 2026-02-07T00:02:00Z
  checked: app/layout.tsx
  found: Only has Toaster provider, no TooltipProvider
  implication: TooltipProvider needs to be added to root layout

- timestamp: 2026-02-07T00:03:00Z
  checked: app/(dashboard)/layout.tsx
  found: Only has AuthProvider, no TooltipProvider
  implication: Root layout is best place for global TooltipProvider

- timestamp: 2026-02-07T00:04:00Z
  checked: components/ui/tooltip.tsx
  found: TooltipProvider is exported and available from Radix UI
  implication: Can import and use TooltipProvider directly

## Resolution

root_cause: CurrencyDisplay component uses Radix UI Tooltip (lines 151-161) when displaying abbreviated currency values. Tooltip components require a TooltipProvider in the parent component tree, but it was missing from the application layout. This broke after recent CurrencyDisplay additions (commits fdb3130, 4b428b8) that added tooltip functionality for abbreviated values.

fix: Added TooltipProvider to the root layout (app/layout.tsx) wrapping all children. This provides global tooltip context for the entire application, allowing any component (including CurrencyDisplay) to use tooltips.

verification: Production build completed successfully with no errors. Application now has TooltipProvider at the root level, which will resolve the "Tooltip must be used within TooltipProvider" runtime error on all pages using CurrencyDisplay with abbreviated values.

files_changed:
  - app/layout.tsx: Added TooltipProvider import and wrapped children with TooltipProvider
