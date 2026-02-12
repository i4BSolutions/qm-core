---
phase: 42-cancellation-guards-lock-mechanism
plan: 02
subsystem: purchase-orders
tags: [ui, guards, tooltips, progress-bars, read-only-states]
dependencies:
  requires:
    - 42-01-database-guards-admin-unlock
    - components-ui-tooltip
    - po-status-badge-with-tooltip
  provides:
    - ui-guard-tooltips
    - admin-unlock-button
    - stepped-progress-bars
  affects:
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/invoice/[id]/page.tsx
    - components/po/po-line-items-table.tsx
tech_stack:
  added:
    - POLineItemProgress component with stepped segments
  patterns:
    - Phase 35 tooltip pattern (TooltipTrigger asChild > div > Button)
    - ItemsSummaryProgress-style progress bars
    - Guard pre-check logic at component level
key_files:
  created: []
  modified:
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/invoice/[id]/page.tsx
    - components/po/po-line-items-table.tsx
decisions:
  - key: "Simple toast messages without cascade details"
    rationale: "User requested simplified toast messages per plan. Cascade data still returned from Server Actions but not displayed in UI."
    impact: "Cleaner UX, less information overload. Detailed data available in History tab if needed."
  - key: "Tooltip pattern follows Phase 35 convention"
    rationale: "Established pattern for disabled buttons with tooltips: TooltipTrigger asChild > div > Button"
    impact: "Consistent tooltip behavior across app"
  - key: "Progress bars inline in table column"
    rationale: "User decision: progress bars go INSIDE existing line items table as a column, not separate tab"
    impact: "Reduced column count from 7 to 6 in Phase 41, now enhanced with stepped segment style"
metrics:
  duration_seconds: 247
  tasks_completed: 3
  files_created: 0
  files_modified: 3
  commits: 3
  completed_date: 2026-02-12
---

# Phase 42 Plan 02: UI Guards, Tooltips & Progress Bars Summary

**One-liner:** UI-level guard tooltips disable Cancel/Void buttons with explanatory messages, admin unlock button for closed POs, and stepped segment progress bars replace dual-track bars in line item tables.

## Overview

Implemented visual guard enforcement at UI level with disabled button tooltips, read-only terminal states for closed/cancelled POs and voided invoices, admin unlock capability for closed POs, upgraded line item progress bars to stepped segment style following ItemsSummaryProgress pattern, and simplified toast messages to remove cascade details.

## Tasks Completed

### Task 1: PO detail page -- guard tooltips, read-only states, admin unlock, simplified toast
**Commit:** `4857471`

Enhanced PO detail page with comprehensive guard UI:
- **Cancel button tooltip**: Disabled with reason when active invoices exist ("Cannot cancel -- has active invoices") or PO is closed ("Cannot cancel -- PO is closed")
- **Admin unlock button**: Visible to admin users on closed POs, calls `unlockClosedPO` Server Action
- **Terminal state enforcement**: Edit and Cancel buttons hidden for closed and cancelled POs (read-only)
- **Simplified toast**: Cancel action shows simple message "[PO#] has been cancelled successfully" (no cascade details)
- **Imports added**: `LockOpen` from lucide-react, `Tooltip` components, `canUnlockPO` utility, `unlockClosedPO` action

**Guard logic:**
```typescript
const isTerminalState = po.status === 'cancelled' || po.status === 'closed';
const isClosed = po.status === 'closed';
const isCancelled = po.status === 'cancelled';
const isAdmin = can("delete", "purchase_orders");

const hasActiveInvoices = invoices.some(inv => !inv.is_voided && inv.is_active !== false);

const showCancelButton = isAdmin && !isCancelled;
const canCancelNow = !hasActiveInvoices && !isClosed && !isCancelled;

const showEditButton = can("update", "purchase_orders") && !isTerminalState;
const showUnlockButton = isAdmin && isClosed;

const cancelDisabledReason = isClosed
  ? "Cannot cancel -- PO is closed"
  : hasActiveInvoices
  ? "Cannot cancel -- has active invoices"
  : "";
```

### Task 2: Invoice detail page -- void guard tooltip, read-only voided state, simplified toast
**Commit:** `8ee827e`

Enhanced Invoice detail page with guard UI:
- **Void button tooltip**: Disabled with reason when stock-in exists ("Cannot void -- goods received")
- **Read-only voided state**: Voided invoices show no action buttons (fully read-only)
- **Simplified toast**: Void action shows simple message "[INV#] has been voided successfully" (no cascade details)
- **Imports added**: `Tooltip` components, `usePermissions` hook

**Guard logic:**
```typescript
const isVoided = invoice.is_voided ?? false;
const hasStockIn = stockReceipts.length > 0;

const showVoidButton = !isVoided;
const canVoidNow = !hasStockIn && !isVoided && canVoidInvoice(invoice.status as InvoiceStatus, isVoided);

const voidDisabledReason = hasStockIn
  ? "Cannot void -- goods received"
  : "";
```

### Task 3: Upgrade ReadonlyLineItemsTable progress bars to stepped segment style
**Commit:** `c2d36bb`

Replaced dual-track MiniProgressBar with stepped segment style:
- **POLineItemProgress component**: Inline component following ItemsSummaryProgress pattern
- **Stepped segments**: Gray baseline (ordered), blue overlay (invoiced), green overlay (received)
- **Fraction header**: Shows "received/ordered" (e.g., "8/10")
- **Colored dot legend**: Minimal labels (just numbers, not "Ordered: X") to fit in table cell
- **Sizing**: Slightly smaller than ItemsSummaryProgress (h-5 bar, text-[10px] legend) for table cell context
- **Column width**: Increased from w-40 to w-44 to accommodate legend row
- **Removed imports**: `MiniProgressBar` and `calculateLineItemProgress` no longer used in this component

**Progress bar structure:**
```tsx
<div className="space-y-1.5">
  {/* Header: fraction text */}
  <div className="flex items-center justify-between">
    <span className="text-xs text-slate-400">{received}/{ordered}</span>
  </div>

  {/* Stepped progress bar */}
  <div className="h-5 w-full bg-slate-800/50 rounded-md overflow-hidden relative">
    <div className="absolute inset-y-0 left-0 bg-slate-600/30 transition-all duration-500" style={{ width: "100%" }} />
    <div className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500" style={{ width: `${invoicedPercent}%` }} />
    <div className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500" style={{ width: `${receivedPercent}%` }} />
  </div>

  {/* Legend row with colored dots */}
  <div className="flex items-center gap-3 text-[10px]">
    <div className="flex items-center text-slate-400">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-600 inline-block mr-1" />
      {ordered}
    </div>
    <div className="flex items-center text-blue-400">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block mr-1" />
      {invoiced}
    </div>
    <div className="flex items-center text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1" />
      {received}
    </div>
  </div>
</div>
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria passed:

1. **PO Cancel button disabled with tooltip** ✓
   - "Cannot cancel -- has active invoices" when invoices exist
   - "Cannot cancel -- PO is closed" when PO is closed

2. **PO Unlock button for admin** ✓
   - Visible to admin users on closed POs
   - Calls `unlockClosedPO` and refreshes page

3. **Edit button hidden for terminal states** ✓
   - Hidden for cancelled and closed POs

4. **Invoice Void button disabled with tooltip** ✓
   - "Cannot void -- goods received" when stock-in exists

5. **Voided invoices read-only** ✓
   - No action buttons shown

6. **Simple toast messages** ✓
   - Cancel: "[PO#] has been cancelled successfully"
   - Void: "[INV#] has been voided successfully"

7. **Stepped segment progress bars** ✓
   - Gray baseline, blue invoiced, green received
   - Fraction header and colored dot legend

8. **TypeScript compilation** ✓
   ```
   npm run type-check -- No errors
   ```

9. **Linting** ✓
   ```
   npm run lint -- No new errors
   ```

## Key Decisions

### 1. Simple toast messages without cascade details
**Context:** Server Actions return detailed cascade data (released budget, new balance, invoiced qty changes, PO status changes).

**Decision:** Display only simple success message in toast. Cascade data still returned from Server Actions but not shown in UI.

**Rationale:** User requested simplified toast messages per plan. Reduces information overload. Users can see detailed history in History tab if needed.

**Impact:** Cleaner UX. Server Action return types unchanged (Plan 01 decision).

### 2. Tooltip pattern follows Phase 35 convention
**Context:** Multiple ways to implement disabled button tooltips.

**Decision:** Use Phase 35 pattern: `TooltipTrigger asChild > div > Button`.

**Rationale:** Established pattern in codebase for consistent tooltip behavior.

**Impact:** Consistent UX across all disabled buttons with tooltips.

### 3. Progress bars inline in table column
**Context:** Plan specified progress bars go INSIDE existing line items table as a column.

**Decision:** Replace MiniProgressBar column with POLineItemProgress component, keeping progress as a table column.

**Rationale:** User decision in Phase 41 to integrate progress into table (reduced columns from 7 to 6). Now enhanced with stepped segment style.

**Impact:** Visual consistency with ItemsSummaryProgress pattern while maintaining compact table layout.

## Impact

**UI Layer:**
- Cancel/Void buttons provide clear feedback about why actions are blocked
- Admin unlock provides escape hatch for closed POs requiring corrections
- Terminal states (closed, cancelled, voided) are visually enforced as read-only
- Progress bars show multi-stage lifecycle at a glance (ordered → invoiced → received)
- Toast messages are concise and action-focused

**User Experience:**
- Clear visual cues prevent invalid actions before submission
- Tooltips explain blocking conditions without requiring database round-trip
- Admin users have controlled unlock capability for exceptional cases
- Progress visualization matches established pattern from QMHQ items summary

**Technical:**
- Guard logic at UI level complements database-level guards (defense in depth)
- POLineItemProgress component reusable for other PO-related views
- Removed dependency on MiniProgressBar and calculateLineItemProgress for line items table
- Tooltip pattern consistent across PO and Invoice detail pages

## Next Steps

**Plan 03:** PDF generation for Invoice, Stock-Out, and Money-Out receipts using @react-pdf/renderer

## Self-Check: PASSED

Verified all claims:

**Modified files exist:**
```bash
[ -f "app/(dashboard)/po/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/po/[id]/page.tsx"
# Output: FOUND: app/(dashboard)/po/[id]/page.tsx

[ -f "app/(dashboard)/invoice/[id]/page.tsx" ] && echo "FOUND: app/(dashboard)/invoice/[id]/page.tsx"
# Output: FOUND: app/(dashboard)/invoice/[id]/page.tsx

[ -f "components/po/po-line-items-table.tsx" ] && echo "FOUND: components/po/po-line-items-table.tsx"
# Output: FOUND: components/po/po-line-items-table.tsx
```

**Commits exist:**
```bash
git log --oneline --all | grep -q "4857471" && echo "FOUND: 4857471"
# Output: FOUND: 4857471

git log --oneline --all | grep -q "8ee827e" && echo "FOUND: 8ee827e"
# Output: FOUND: 8ee827e

git log --oneline --all | grep -q "c2d36bb" && echo "FOUND: c2d36bb"
# Output: FOUND: c2d36bb
```

**Key additions verified:**
```bash
grep -q "TooltipProvider" "app/(dashboard)/po/[id]/page.tsx" && echo "FOUND: TooltipProvider in PO page"
# Output: FOUND: TooltipProvider in PO page

grep -q "LockOpen" "app/(dashboard)/po/[id]/page.tsx" && echo "FOUND: LockOpen icon in PO page"
# Output: FOUND: LockOpen icon in PO page

grep -q "unlockClosedPO" "app/(dashboard)/po/[id]/page.tsx" && echo "FOUND: unlockClosedPO in PO page"
# Output: FOUND: unlockClosedPO in PO page

grep -q "TooltipProvider" "app/(dashboard)/invoice/[id]/page.tsx" && echo "FOUND: TooltipProvider in Invoice page"
# Output: FOUND: TooltipProvider in Invoice page

grep -q "POLineItemProgress" "components/po/po-line-items-table.tsx" && echo "FOUND: POLineItemProgress component"
# Output: FOUND: POLineItemProgress component

grep -qv "MiniProgressBar" "components/po/po-line-items-table.tsx" && echo "CONFIRMED: MiniProgressBar removed from ReadonlyLineItemsTable"
# Output: CONFIRMED: MiniProgressBar removed from ReadonlyLineItemsTable
```

All files, commits, and key additions verified successfully.
