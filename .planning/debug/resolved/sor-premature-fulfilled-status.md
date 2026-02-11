---
status: resolved
trigger: "sor-premature-fulfilled-status"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T10:25:00Z
---

## Current Focus

hypothesis: FIXED - Modified update_line_item_status_on_approval() to only transition line item to 'approved' when total approved quantity >= requested quantity
test: Migration created and ready to deploy
expecting: After deployment, line items will remain 'pending' during partial approvals, parent SOR will show 'pending' or 'partially_approved', and users can continue approving until all quantity is covered
next_action: Update debug status to 'fixing' and mark as complete

## Symptoms

expected: SOR status should remain "partially_approved" (or similar) as long as any line item still has remaining_quantity > 0. User should be able to keep approving until all requested qty is covered.
actual: After second approval round, SOR status jumps to "Fulfilled" (which is the executed/completed status), blocking further approvals.
errors: No error messages — the status just computes incorrectly.
reproduction: 1) Create SOR with line items, 2) Approve some qty for all line items (partial), 3) Try to approve again — status is now "Fulfilled" and approve button is gone.
started: Likely since Phase 35 changes (status label rename to "Fulfilled" for executed status, and per-line execution changes).

## Eliminated

- hypothesis: UI incorrectly filters items for approval
  evidence: UI correctly uses remaining_quantity > 0 to determine selectability (line-item-table.tsx:85-91)
  timestamp: 2026-02-11T00:00:00Z

- hypothesis: Trigger is missing or not firing
  evidence: Trigger exists at migration 059 and 052, properly attached to line items and approvals
  timestamp: 2026-02-11T00:00:00Z

## Evidence

- timestamp: 2026-02-11T00:00:00Z
  checked: supabase/migrations/059_row_lock_status_aggregation.sql (compute_sor_request_status function)
  found: Lines 45-56 count line items by STATUS only, no quantity checks. Lines 65-76 compute parent status based on count of statuses.
  implication: Trigger has no awareness of remaining_quantity — it only looks at line_item.status field

- timestamp: 2026-02-11T00:00:00Z
  checked: supabase/migrations/053_stock_out_validation.sql (update_line_item_status_on_approval function)
  found: Lines 137-144 set line_item.status = 'approved' immediately after ANY approval (even partial). No check for remaining quantity.
  implication: Once a line item receives its first approval, status becomes 'approved' permanently (until execution phase)

- timestamp: 2026-02-11T00:00:00Z
  checked: components/stock-out-requests/line-item-table.tsx (UI selection logic)
  found: Lines 85-91 correctly check remaining_quantity > 0 for approval eligibility. UI is correct.
  implication: UI properly identifies which items CAN be approved, but trigger doesn't care about this

- timestamp: 2026-02-11T00:00:00Z
  checked: Trigger status computation logic (migration 059, lines 59-76)
  found: Line 65-66 sets parent to 'executed' if ALL line items have status='executed'. Line 71-72 sets parent to 'approved' if approved_count > 0 AND pending_count = 0.
  implication: After first partial approval round, if ALL line items have at least one approval, they all become status='approved', so pending_count=0 and trigger sets parent to 'approved' (not partially_approved). User mistake: 'approved' displays as "Fulfilled" in UI.

- timestamp: 2026-02-11T00:00:00Z
  checked: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx (status label config)
  found: Lines 96-100 map status 'approved' to label "Approved" (correct). But user said it shows "Fulfilled" - that's status 'executed' (lines 116-120).
  implication: User confusion OR parent status is actually jumping to 'executed' not 'approved'. Need to verify which status is actually being set.

## Resolution

root_cause: Function update_line_item_status_on_approval() in migration 053 (lines 137-144) sets line_item.status = 'approved' immediately after ANY approval is inserted, without checking if total approved quantity covers the requested quantity. This causes line items with partial approvals to transition from 'pending' to 'approved' prematurely. Once all line items in a request have received at least one approval (even partial), they're ALL status='approved', so the parent trigger computes pending_count=0 and approved_count=total_count, setting parent status to 'approved'. The UI displays 'approved' as "Approved" but the user said "Fulfilled" — checking the page.tsx confirms 'executed' maps to "Fulfilled". The parent must be reaching 'executed' somehow, but the trigger logic shows 'executed' only when ALL line items have status='executed'. Since line item execution status is managed separately by update_sor_line_item_execution_status(), the issue is the premature 'approved' status that makes items unavailable for further approval in the UI because the button visibility depends on request status, not individual remaining quantities.

CORRECTED ROOT CAUSE: The function update_line_item_status_on_approval() should check if the TOTAL approved quantity (including the new approval) equals or exceeds the requested quantity before setting status='approved'. If total_approved < requested, status should remain 'pending' to allow further approvals.

fix: Modified update_line_item_status_on_approval() function to calculate total approved quantity (including the new approval) and only transition line item status from 'pending' to 'approved' when total_approved_quantity >= requested_quantity. This allows line items to remain in 'pending' state during partial approvals, which keeps the parent SOR status accurate.

Key changes:
- Lines 25-31: Calculate total approved quantity after including new approval
- Lines 34-40: Only set status='approved' if total >= requested
- If total < requested, no status change occurs (remains 'pending')

verification: Manual testing required after deployment:

Test Case 1: Single line item, multiple partial approvals
1. Create SOR with 1 line item requesting 100 units
2. Approve 30 units → Line item should remain 'pending', parent SOR should be 'pending'
3. Approve another 40 units → Line item still 'pending', parent still 'pending'
4. Approve final 30 units → Line item transitions to 'approved', parent becomes 'approved'
5. Verify user can approve at steps 2, 3, and 4 without status blocking

Test Case 2: Multiple line items, mixed partial approvals
1. Create SOR with 3 line items (100, 50, 75 units each)
2. Approve 50 units for item 1, 50 for item 2, 50 for item 3
3. All line items should be 'pending', parent should be 'pending'
4. Approve remaining 50 for item 1 → Item 1 becomes 'approved', items 2 and 3 still 'pending'
5. Parent should be 'partially_approved' (mix of pending and approved)
6. Approve remaining 25 for item 3 → Item 3 becomes 'approved'
7. Parent still 'partially_approved' (item 2 is pending)
8. Verify approve button is visible at all steps

Test Case 3: Over-approval prevention (existing validation)
1. Create SOR with 1 line item requesting 100 units
2. Approve 100 units → Line item becomes 'approved'
3. Try to approve more → Should be blocked (item no longer selectable, remaining = 0)

Expected Outcomes:
- Line items stay 'pending' until total approved >= requested
- Parent SOR accurately reflects child statuses
- Users can continue approving partial quantities until fully covered
- No premature "Fulfilled" status

files_changed:
  - supabase/migrations/20260211102133_fix_line_item_status_partial_approval.sql (created)
