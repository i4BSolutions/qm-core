---
phase: 41-po-status-engine-enhancement
plan: 02
subsystem: po-lifecycle
tags:
  - ui-components
  - status-display
  - cancellation-dialog
  - tooltips
  - visual-feedback
dependency_graph:
  requires:
    - 41-01-po-status-engine-enhancement
    - components-ui-tooltip
    - lib-utils-po-status
    - lib-actions-po-actions
  provides:
    - po-status-badge-with-tooltip
    - po-cancellation-ui
    - po-list-enhanced-display
    - po-detail-enhanced-display
  affects:
    - components-po-po-status-badge
    - components-po-po-card
    - app-dashboard-po-page
    - app-dashboard-po-id-page
tech_stack:
  added:
    - Radix UI Tooltip for status badge tooltips
  patterns:
    - Pulse animation with auto-stop timer
    - Modal dialog for destructive actions with mandatory fields
    - Cascade feedback in toast notifications
    - Safety-net client-side status recompute for debugging
key_files:
  created:
    - none
  modified:
    - components/po/po-status-badge.tsx
    - components/po/po-card.tsx
    - app/(dashboard)/po/page.tsx
    - app/(dashboard)/po/[id]/page.tsx
decisions:
  - decision: Use POStatusBadgeWithTooltip as separate component, keep POStatusBadge unchanged
    rationale: Preserve existing POStatusBadge for other use cases, add new component for enhanced features
    context: Task 1 requirement
  - decision: Integrate mini progress bar INTO Status column in list view
    rationale: Reduce table columns from 7 to 6, keep progress visible without separate column
    context: Task 2 requirement
  - decision: Use modal dialog instead of window.confirm for PO cancellation
    rationale: Allow mandatory reason field, show warning text, better UX consistency
    context: Task 3 requirement
  - decision: Use can("delete", "purchase_orders") for admin-only cancellation check
    rationale: Delete permission in RBAC matrix maps to admin role only
    context: Task 3 requirement
  - decision: Safety-net recompute logs to console.warn, does NOT override DB status
    rationale: Database is authoritative source, client-side calc is for debugging only
    context: Task 3 requirement
metrics:
  duration_seconds: 335
  tasks_completed: 3
  files_created: 0
  files_modified: 4
  commits: 3
  completed_date: 2026-02-12
---

# Phase 41 Plan 02: PO Status Enhancement UI Summary

**One-liner:** Enhanced PO status display with interactive tooltips, visual state indicators, admin-only cancellation dialog with cascade feedback, and safety-net status recompute.

## What Was Built

### Task 1: POStatusBadge Enhancement

1. **POStatusBadgeWithTooltip Component** - New component with enhanced features:
   - Wraps existing POStatusBadge in Radix UI Tooltip
   - Shows hover tooltip with `generateStatusTooltip()` output
   - Displays "X/Y invoiced (Z%), X/Y received (Z%)" for active POs
   - Shows "Fully matched: ordered = invoiced = received" for closed POs
   - Shows "This PO has been cancelled\n\nReason: [reason]" for cancelled POs
   - Pulse animation on badge when `animate={true}`, auto-stops after 3 seconds via useEffect timer
   - Lock icon (h-3.5 w-3.5 text-emerald-400) displayed NEXT TO badge for closed status

2. **POCard Visual Updates**:
   - Switched to POStatusBadgeWithTooltip from POStatusBadge
   - Applied conditional styling using `cn()` utility:
     - `opacity-75` for closed POs (dimmed but readable)
     - `opacity-60` for cancelled POs (more dimmed)
     - `line-through text-red-400` on PO number for cancelled POs

### Task 2: PO List Page Enhancement

1. **List View Table Updates**:
   - Replaced POStatusBadge with POStatusBadgeWithTooltip
   - Removed separate "Progress" column (reduced from 7 to 6 columns)
   - Integrated mini progress bar UNDER status badge in Status column
   - Progress bar only shows when `total_quantity > 0`
   - Width constrained to `w-24` for compact display

2. **Row Visual Treatment**:
   - Applied `opacity-60` to closed PO rows via `cn()` conditional classes
   - Applied `opacity-50` to cancelled PO rows
   - Strikethrough + red color on cancelled PO numbers: `line-through text-red-400`

3. **Filter Enhancement**:
   - Added "Active (excl. Closed/Cancelled)" option in status filter dropdown
   - Inserted as 2nd option after "All Statuses"
   - Filter logic checks `statusFilter === "active"` and excludes closed/cancelled

4. **Card View** - No changes needed, POCard component already updated in Task 1

### Task 3: PO Detail Page Enhancement

1. **Status Badge Replacement**:
   - Replaced POStatusBadge with POStatusBadgeWithTooltip in header
   - Passes `animate={statusJustChanged}` to trigger pulse on status changes
   - Passes `cancellationReason` prop for cancelled PO tooltips
   - Added Lock icon + "Fully Matched" label for closed POs
   - Applied strikethrough to PO number code element for cancelled POs

2. **Cancel Dialog Implementation**:
   - Modal overlay with fixed positioning (`fixed inset-0 z-50`)
   - Black backdrop with blur: `bg-black/60 backdrop-blur-sm`
   - Command panel styled dialog with warning text
   - Mandatory reason textarea (80px min-height, autofocus)
   - Disabled "Confirm Cancellation" button when reason is empty
   - "Go Back" button clears reason and closes dialog
   - Shows loading spinner on confirm button during cancellation

3. **Cancel Flow**:
   - Updated `showCancelButton` to check `can("delete", "purchase_orders")` (admin-only)
   - Cancel button now opens dialog instead of calling handler directly
   - `handleCancelPO()` calls `cancelPO` Server Action with reason
   - On success: shows toast with released budget details and new Balance in Hand
   - Toast message format: `"[PO#] cancelled. Budget released: X.XX EUSD to [QMHQ#]. New Balance in Hand: X.XX EUSD"`
   - On error: shows destructive toast with error message
   - Refreshes page data via `fetchData()` after successful cancellation

4. **Cancellation Details Section**:
   - New panel in Details tab, only visible when `status === "cancelled"`
   - Red-themed styling: `border-red-500/30 bg-red-500/5`
   - Shows cancellation reason, cancelled_at timestamp, cancelled_by user
   - Uses `lg:col-span-2` to span 2 columns in grid layout

5. **Status Change Detection**:
   - Added `previousStatus` state to track status changes
   - Detects status change in `fetchData()` callback
   - Sets `statusJustChanged` state to trigger badge pulse animation
   - Shows toast notification: `"Status Updated: [PO#] status: [label]"`
   - Updates `previousStatus` after each fetch

6. **Safety-Net Recompute**:
   - After line items are fetched, calculates totals (totalQty, invoicedQty, receivedQty)
   - Calls `recomputeStatusFromAggregates()` to calculate expected status
   - Compares expected status with DB status (ignoring if cancelled)
   - Logs mismatch to `console.warn()` for debugging
   - **Does NOT override DB status** - database is authoritative

7. **Type Extensions**:
   - Extended POWithRelations interface with cancellation fields:
     - `cancelled_by_user?: Pick<UserType, "id" | "full_name"> | null`
     - `cancellation_reason?: string | null`
     - `cancelled_at?: string | null`
     - `cancelled_by?: string | null`
   - Added `cancelled_by_user` to PO query SELECT for audit trail display

## Key Technical Details

### Tooltip Implementation Pattern

The tooltip uses Radix UI Tooltip primitives with proper nesting:

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className={isPulsing ? "animate-pulse" : ""}>
        <POStatusBadge ... />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-xs font-mono whitespace-pre-wrap">{tooltipText}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Key details:**
- TooltipTrigger uses `asChild` to avoid wrapper div issues
- Pulse animation applied to wrapper, not badge itself
- `whitespace-pre-wrap` allows multi-line cancellation reason display
- Lock icon rendered OUTSIDE TooltipProvider to avoid tooltip interference

### Pulse Animation Auto-Stop

Uses useEffect with setTimeout to automatically stop pulse after 3 seconds:

```tsx
const [isPulsing, setIsPulsing] = useState(animate);

useEffect(() => {
  if (animate) {
    setIsPulsing(true);
    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [animate]);
```

This prevents the pulse from continuing indefinitely when `animate` prop stays true.

### Admin-Only Cancellation Enforcement

Uses RBAC permission system with "delete" action:

```tsx
const showCancelButton = can("delete", "purchase_orders") && canCancelPO(po.status as POStatusEnum);
```

From permission matrix, only admin role has "delete" permission on purchase_orders resource. This enforces admin-only access at UI level (Server Action also validates).

### Safety-Net Recompute Pattern

Client-side status calculation mirrors database logic for debugging:

```tsx
const recomputedStatus = recomputeStatusFromAggregates(
  totalQty, invoicedQty, receivedQty,
  poData?.status === 'cancelled'
);

if (poData && recomputedStatus !== poData.status && poData.status !== 'cancelled') {
  console.warn(`PO status mismatch: DB=${poData.status}, computed=${recomputedStatus}`);
}
```

**Important:** This is diagnostic only. Database status is authoritative. Mismatches indicate:
- Race condition in trigger execution
- Data inconsistency from manual DB updates
- Bug in status calculation logic

### List View Column Reduction

**Before:** 7 columns (PO#, Supplier, QMHQ, Amount, Status, Progress, Date)

**After:** 6 columns (PO#, Supplier, QMHQ, Amount, Status, Date)

Progress now integrated into Status column as mini dual-track bar below badge.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### TypeScript Compilation
- `npm run type-check` passed with no errors
- Extended POWithRelations interface properly typed with cancellation fields
- All component props correctly typed (POStatusBadgeWithTooltipProps)

### Linting
- `npm run lint` passed with no new errors
- Only pre-existing warnings in unrelated files
- Fixed missing dependencies warning in fetchData useCallback (added previousStatus, toast)

### Code Quality
- Followed existing patterns from POStatusBadge, POCard, POProgressBar components
- Used Radix UI Tooltip consistently with existing UI components
- Modal dialog follows command-panel styling from design system
- Lock icon and styling matches existing emerald-themed closed state indicators

## Integration Points

### Component Dependencies
- POStatusBadgeWithTooltip depends on:
  - POStatusBadge (wraps it)
  - Radix UI Tooltip (TooltipProvider, Tooltip, TooltipTrigger, TooltipContent)
  - generateStatusTooltip() from lib/utils/po-status
  - Lock icon from lucide-react

### Server Action Integration
- PO detail page calls cancelPO() from lib/actions/po-actions
- Receives CancelPOResult discriminated union (success/error)
- Displays cascade feedback data in toast (releasedAmountEusd, qmhqRequestId, newBalanceInHand)

### Future Integration Requirements
For Phase 42 (PO Cancellation Guards) and Phase 43 (PDF Export):
- Cancel dialog already enforces admin-only at UI level
- Cascade feedback toast already shows released budget details
- Status badge tooltips already display current state calculation
- Safety-net recompute already logs mismatches for debugging

## Visual Treatment Summary

| PO State | List Row | Card | PO Number | Status Badge | Lock Icon |
|----------|----------|------|-----------|--------------|-----------|
| Active (not_started, partially_invoiced, etc.) | Normal | Normal | Amber | Normal | No |
| Closed | `opacity-60` | `opacity-75` | Amber | Normal | Yes (emerald) |
| Cancelled | `opacity-50` | `opacity-60` | Red + strikethrough | Normal | No |

**Tooltip Content:**
- **Active states:** "3/5 invoiced (60%), 2/5 received (40%)"
- **Closed:** "Fully matched: ordered = invoiced = received"
- **Cancelled:** "This PO has been cancelled\n\nReason: [reason]"

## Testing Notes

### Manual Testing Required
1. **Tooltip display:** Hover over PO status badges in list and detail views → verify tooltip appears with correct counts
2. **Pulse animation:** Change PO status (e.g., create invoice) → reload detail page → verify badge pulses for 3 seconds
3. **Closed PO:** View closed PO → verify Lock icon appears, row dimmed, tooltip shows "Fully matched"
4. **Cancelled PO:** View cancelled PO → verify strikethrough number, cancellation panel, tooltip shows reason
5. **Cancel dialog:** Click Cancel PO button (as admin) → verify dialog opens, reason required, button disabled when empty
6. **Cancel cascade:** Cancel a PO → verify toast shows released EUSD, QMHQ reference, new Balance in Hand
7. **Admin-only:** Login as qmrl or qmhq user → verify Cancel PO button does NOT appear
8. **Status filter:** Select "Active (excl. Closed/Cancelled)" → verify closed/cancelled POs hidden
9. **Safety-net:** Open browser console on PO detail page → verify no status mismatch warnings (or investigate if warnings appear)

### Scenario Testing
1. **Multi-status progression:** Create PO → create partial invoice → create stock-in → verify badge pulses on each status change
2. **Cancelled with reason:** Cancel PO with long reason text → verify reason wraps properly in tooltip and cancellation panel
3. **Closed then cancel attempt:** Try to cancel closed PO → Server Action should reject (but UI already hides button)
4. **Non-admin cancel attempt:** Try to access cancel dialog as qmhq user → verify no access (button not shown)

## Self-Check: PASSED

### Modified Files Verification
```bash
[ -f "components/po/po-status-badge.tsx" ] && echo "FOUND"
[ -f "components/po/po-card.tsx" ] && echo "FOUND"
[ -f "app/(dashboard)/po/page.tsx" ] && echo "FOUND"
[ -f "app/(dashboard)/po/[id]/page.tsx" ] && echo "FOUND"
```
Result: FOUND, FOUND, FOUND, FOUND

### Commits Verification
```bash
git log --oneline | grep -E "(90bb63b|e386002|b4bf7db)"
```
Result:
- 90bb63b feat(41-02): enhance POStatusBadge with tooltip, lock icon, and pulse animation
- e386002 feat(41-02): update PO list page with enhanced status display and row styling
- b4bf7db feat(41-02): update PO detail page with cancel dialog, cascade toast, and safety-net recompute

### Exports Verification
- POStatusBadgeWithTooltip exported from components/po/po-status-badge.tsx ✓
- POStatusBadge unchanged and still exported ✓
- ApprovalStatusBadge unchanged ✓

All checks passed.

---

**Commits:**
- 90bb63b: feat(41-02): enhance POStatusBadge with tooltip, lock icon, and pulse animation
- e386002: feat(41-02): update PO list page with enhanced status display and row styling
- b4bf7db: feat(41-02): update PO detail page with cancel dialog, cascade toast, and safety-net recompute

**Duration:** 5 minutes 35 seconds (335 seconds)
**Status:** Complete and ready for Phase 42 (PO Cancellation Guards - Database Guards)
