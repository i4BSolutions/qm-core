---
phase: 32-qmhq-transaction-linking
plan: 01
subsystem: qmhq
tags: [components, ui, progress-visualization, sor-linking]
dependency_graph:
  requires: []
  provides:
    - SORTransactionGroup component for displaying SOR-grouped transactions
    - ItemsSummaryProgress component with multi-segment progress bars
  affects:
    - Future QMHQ detail page Stock Out tab integration
tech_stack:
  added: []
  patterns:
    - Layered progress bar segments (stacked absolute positioning)
    - Color-coded status mapping with inline style objects
    - Always-expanded group pattern (no accordion state management)
key_files:
  created:
    - components/qmhq/sor-transaction-group.tsx
    - components/qmhq/items-summary-progress.tsx
  modified: []
decisions:
  - SOR groups always expanded (no collapse functionality per user decision)
  - Rejected items shown with explicit Rejected badge in Items Summary
  - Three-segment progress bar: gray baseline (requested) + blue overlay (approved) + green overlay (executed)
  - Status colors follow existing project patterns (amber=pending, blue=approved, green=executed, etc.)
metrics:
  duration: 2min
  tasks_completed: 2
  files_created: 2
  completed_date: 2026-02-11
---

# Phase 32 Plan 01: QMHQ Stock Out Tab Components Summary

**One-liner:** Created two presentational components for QMHQ Stock Out tab — SOR transaction group with compact linked header and items summary with stepped progress visualization showing Requested → Approved → Executed pipeline.

## What Was Built

### 1. SOR Transaction Group Component (`components/qmhq/sor-transaction-group.tsx`)

A component that displays inventory transactions grouped by their parent Stock-Out Request (SOR).

**Key features:**
- **Compact header:** SOR request number (monospace amber) linking to `/inventory/stock-out-requests/{sorId}` with ExternalLink icon, status badge, and total quantity display
- **Status color mapping:** 7 SOR states (pending, approved, partially_approved, executed, partially_executed, rejected, cancelled) with consistent dark theme colors
- **Transaction rows:** Always-expanded list (no accordion) showing item name + SKU, warehouse, quantity, transaction status badge, and date
- **Indented layout:** Transactions indented with `pl-4` to show hierarchy under parent SOR

**Props interface:**
```typescript
interface SORTransactionGroupProps {
  sorId: string;
  sorNumber: string;
  sorStatus: string;
  totalQty: number;
  transactions: Array<{
    id: string;
    quantity: number;
    status: string;
    created_at: string;
    transaction_date?: string | null;
    reason?: string | null;
    notes?: string | null;
    item?: { id: string; name: string; sku: string | null } | null;
    warehouse?: { id: string; name: string } | null;
  }>;
}
```

### 2. Items Summary Progress Component (`components/qmhq/items-summary-progress.tsx`)

A component that displays a stepped progress bar per item, showing the complete fulfillment pipeline from request to execution.

**Key features:**
- **Three-segment layered progress bar:**
  - Gray baseline (requested) at 100% width
  - Blue overlay (approved) showing approval progress
  - Green overlay (executed) showing execution progress
  - Segments stacked with absolute positioning for "funnel" effect
- **Item header:** SKU (amber monospace) + item name, with optional Rejected badge if rejected > 0
- **Legend row:** Color-coded dots with counts for Requested, Approved, Executed, and Pending (if pending > 0)
- **Edge case handling:** Caps percentages at 100%, handles zero requested, calculates pending = approved - executed

**Props interface:**
```typescript
interface ItemProgressData {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  requested: number;
  approved: number;
  executed: number;
  rejected: number;
}

interface ItemsSummaryProgressProps {
  items: ItemProgressData[];
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions Made

1. **Always-expanded SOR groups:** No accordion state management, groups always show all transactions (per user decision for simplicity and visibility)
2. **Rejected badge placement:** Rejected items shown in Items Summary header row with explicit `border-red-500/30 text-red-400` badge for full transparency
3. **Layered progress segments:** Used absolute positioning with stacked segments (largest to smallest) to create visual "funnel" effect showing pipeline progression
4. **Status color consistency:** SOR status colors match existing project patterns (amber for pending/in-progress states, blue for approved, green for completed, red for rejected)

## Technical Details

### Component Patterns Used

1. **Color-coded status mapping:** Inline status style objects for maintainability and type safety
2. **Layered absolute positioning:** Progress bar segments overlay each other with decreasing widths for stepped visualization
3. **Percentage capping:** `Math.min(100, ...)` to prevent overflow on all calculated percentages
4. **Null-safe rendering:** Optional chaining for item/warehouse names with fallback strings

### Styling Patterns

- **Dark theme consistency:** `bg-slate-800/30`, `border-slate-700`, `text-slate-400` for backgrounds and borders
- **Amber accents:** Used for IDs (SOR request number, SKU codes) to match project convention
- **Transition animations:** `transition-all duration-500` on progress segments for smooth rendering

## Files Changed

### Created
- `components/qmhq/sor-transaction-group.tsx` (107 lines)
- `components/qmhq/items-summary-progress.tsx` (110 lines)

### Modified
None

## Integration Notes

These components are presentational only and ready for integration into the QMHQ detail page Stock Out tab. They expect:

1. **SORTransactionGroup:** SOR data with grouped transactions (likely from a groupBy transform on inventory_out transactions)
2. **ItemsSummaryProgress:** Aggregated item data showing requested/approved/executed/rejected counts per item (likely from a SQL query with SUM aggregations grouped by item_id)

## Verification Results

- ✅ Both component files exist under `components/qmhq/`
- ✅ `npm run type-check` passes with no errors
- ✅ SORTransactionGroup exports component with correct props interface
- ✅ ItemsSummaryProgress exports component and ItemProgressData type
- ✅ No new dependencies added (all imports from existing project packages)

## Self-Check: PASSED

**Files created:**
- ✅ FOUND: components/qmhq/sor-transaction-group.tsx (3792 bytes)
- ✅ FOUND: components/qmhq/items-summary-progress.tsx (4127 bytes)

**Commits created:**
- ✅ FOUND: ccc88b5 (feat(32-01): create SOR transaction group component)
- ✅ FOUND: 3d4eafc (feat(32-01): create items summary progress component)

## Next Steps

**Immediate next plan (32-02):** Integrate these components into the QMHQ detail page Stock Out tab, fetching real data and rendering the SOR-grouped view with items summary.

**Success criteria met:**
- Two presentational components created and type-safe
- SOR group component renders compact header linking to SOR detail page
- Items summary component renders stepped progress bar with Requested/Approved/Executed segments
- Rejected items display with Rejected badge
- Both components follow existing project styling patterns
