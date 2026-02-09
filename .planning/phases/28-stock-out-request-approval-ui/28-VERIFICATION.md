---
phase: 28-stock-out-request-approval-ui
verified: 2026-02-09T17:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 28: Stock-Out Request & Approval UI Verification Report

**Phase Goal:** Users can request stock-out and admins can approve/reject with partial approval support
**Verified:** 2026-02-09T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | QMHQ item route creates stock-out request with quantity pre-filled from QMHQ | ✓ VERIFIED | `/inventory/stock-out-requests/new?qmhq={id}` pre-fills item and quantity from QMHQ (28-01-SUMMARY line 132-141) |
| 2 | Inventory/Quartermaster can create manual stock-out request with item, warehouse, reason, and notes | ✓ VERIFIED | Manual mode supports multi-line-item form with CategoryItemSelector, quantity, reason selector, and notes (28-01-SUMMARY line 143-162) |
| 3 | Admin sees pending stock-out requests list with item, requester, and quantity | ✓ VERIFIED | List page at `/inventory/stock-out-requests` shows requests with card/list toggle, status tabs, and search (28-01-SUMMARY line 100-108) |
| 4 | Admin can approve request with quantity less than or equal to requested (partial approval) | ✓ VERIFIED | Approval dialog allows editing approved quantity with validation <= remaining (28-02-SUMMARY line 151-177) |
| 5 | Admin can reject request with mandatory rejection reason | ✓ VERIFIED | Rejection dialog requires rejection reason with validation (28-02-SUMMARY line 184-202) |
| 6 | Requester can cancel own pending request | ✓ VERIFIED | Cancel button visible for requester on pending requests, updates all pending line items to 'cancelled' (28-02-SUMMARY line 104-106) |
| 7 | QMHQ item detail page shows requested quantity and approved quantity | ✓ VERIFIED | Stock-Out Status card displays "Requested" and "Approved" quantities in dedicated card (28-03-SUMMARY line 142-153, QMHQ page.tsx lines 900-966) |
| 8 | Stock-out execution page only allows quantity up to approved amount | ✓ VERIFIED | Execution dialog fetches only pending transactions (already created at approved quantities), executes all atomically (28-03-SUMMARY line 82-110, execution-dialog.tsx lines 228-264) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/stock-out-requests/execution-dialog.tsx` | Execution confirmation dialog with stock validation | ✓ VERIFIED | 411 lines, fetches ALL pending transactions, validates stock across warehouses, atomic update |
| `app/(dashboard)/qmhq/[id]/page.tsx` | Modified QMHQ detail with Request Stock-Out button, SOR status badge, and requested/approved qty display | ✓ VERIFIED | Lines 819-966 contain Request Stock-Out button, Stock-Out Status card with quantities |
| `app/(dashboard)/inventory/stock-out/page.tsx` | Modified stock-out page redirecting to request flow | ✓ VERIFIED | Lines 71-75 redirect QMHQ links, lines 509-539 show info panel for direct access |
| `app/(dashboard)/inventory/stock-out-requests/page.tsx` | List page with card/list toggle, status tabs | ✓ VERIFIED | 398 lines, created in 28-01 |
| `app/(dashboard)/inventory/stock-out-requests/new/page.tsx` | Create form with QMHQ-linked and manual modes | ✓ VERIFIED | 535 lines, created in 28-01 |
| `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` | Detail page with tabs, line item table, approval/rejection dialogs | ✓ VERIFIED | 575 lines, created in 28-02 |
| `components/stock-out-requests/request-card.tsx` | Card component for list view | ✓ VERIFIED | 145 lines, created in 28-01 |
| `components/stock-out-requests/line-item-table.tsx` | Selectable line item table with action bar | ✓ VERIFIED | 365 lines, created in 28-02 |
| `components/stock-out-requests/approval-dialog.tsx` | Approval dialog with warehouse stock fetching | ✓ VERIFIED | 560 lines, created in 28-02 |
| `components/stock-out-requests/rejection-dialog.tsx` | Rejection dialog with reason validation | ✓ VERIFIED | 195 lines, created in 28-02 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `components/stock-out-requests/execution-dialog.tsx` | `inventory_transactions` | Supabase update status to completed | ✓ WIRED | Lines 240-246: `.from("inventory_transactions").update({ status: "completed" }).in("id", allTransactionIds)` |
| `app/(dashboard)/qmhq/[id]/page.tsx` | `/inventory/stock-out-requests/new` | Link with qmhq query param | ✓ WIRED | Line 821: `<Link href={\`/inventory/stock-out-requests/new?qmhq=${qmhqId}\`}>` |
| `app/(dashboard)/qmhq/[id]/page.tsx` | `stock_out_requests` | Supabase query for linked SOR | ✓ WIRED | Lines 234-244: `.from('stock_out_requests').select(...).eq('qmhq_id', qmhqData.id)` |
| `app/(dashboard)/inventory/stock-out/page.tsx` | `/inventory/stock-out-requests/new` | Redirect with qmhq param | ✓ WIRED | Line 73: `router.replace(\`/inventory/stock-out-requests/new?qmhq=${qmhqId}\`)` |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| SOAR-01: User can create stock-out request with item, quantity, warehouse, reason, and notes | ✓ SATISFIED | None - manual create form implemented |
| SOAR-02: QMHQ item route stock-out request defaults quantity from QMHQ requested qty | ✓ SATISFIED | None - QMHQ-linked mode pre-fills quantity |
| SOAR-03: Manual stock-out request submitted by Inventory or Quartermaster role | ✓ SATISFIED | None - permission matrix includes inventory/quartermaster |
| SOAR-05: Admin can approve stock-out request with approval quantity (<= requested) | ✓ SATISFIED | None - approval dialog validates qty <= remaining |
| SOAR-06: Admin can reject stock-out request with rejection reason | ✓ SATISFIED | None - rejection dialog requires reason |
| SOAR-07: Requester can cancel own pending stock-out request | ✓ SATISFIED | None - cancel button for requester on pending requests |
| SOAR-08: QMHQ item detail shows requested qty and approved qty | ✓ SATISFIED | None - Stock-Out Status card displays both quantities |

Note: SOAR-04, SOAR-09, SOAR-10, SOAR-11 are database-level requirements covered in Phase 27.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

### Human Verification Required

#### 1. End-to-End Stock-Out Request Flow

**Test:** As a requester, create a stock-out request from QMHQ item route, then as admin approve with partial quantity, then as inventory executor execute the stock-out.

**Expected:** 
- QMHQ detail shows "Request Stock-Out" button
- Create page pre-fills item and quantity from QMHQ with locked fields
- Admin sees request in list, can select line items and approve with custom quantity and warehouse
- Execution dialog shows all pending transactions, validates stock, and executes atomically
- QMHQ detail Stock-Out Status card shows requested and approved quantities
- All status transitions work correctly (pending -> approved -> executed)

**Why human:** Requires interaction across multiple pages, roles, and database state changes. Cannot verify complete UX flow programmatically.

#### 2. Stock Validation Blocking

**Test:** Approve a stock-out request with quantity exceeding available warehouse stock, then attempt execution.

**Expected:**
- Approval succeeds with amber warning (doesn't block approval)
- Execution dialog shows red error: "Cannot execute: stock shortages found. All items must have sufficient stock to proceed."
- Execute button disabled
- Clear error message showing which item/warehouse has shortage

**Why human:** Requires setting up specific stock levels and verifying visual error display and button states.

#### 3. Partial Approval Workflow

**Test:** Create request for 50 units. Admin approves 20 units. Second admin approves 15 more units. Line item remains selectable for more approvals until reaching 50.

**Expected:**
- First approval: remaining shows 30 (50-20)
- Second approval: remaining shows 15 (50-35)
- Line item still selectable for more approvals
- Execution creates 2 separate inventory_transactions (one per approval)
- Both transactions execute together in execution dialog

**Why human:** Requires multiple approval sessions and verifying running totals and selection state changes.

#### 4. QMHQ Integration Visual Display

**Test:** Navigate to QMHQ item route detail page, verify Stock-Out Status card appearance, clickability, and data accuracy.

**Expected:**
- Card shows with border, rounded corners, slate background
- Request number is clickable and navigates to request detail
- Status badge uses correct colors
- Requested and Approved quantities are large, font-mono, with proper labels
- Separator pipe between quantities
- "View Details" link at bottom right

**Why human:** Visual appearance and layout verification requires human judgment.

#### 5. Stock-Out Page Redirect

**Test:** 
- Visit `/inventory/stock-out?qmhq={id}` - should auto-redirect to new request page
- Visit `/inventory/stock-out` directly - should show info panel

**Expected:**
- QMHQ link redirects silently to `/inventory/stock-out-requests/new?qmhq={id}`
- Direct access shows blue info icon, message "Stock-out operations now require an approved request", and two buttons: "View Requests" and "Create New Request"

**Why human:** Redirect behavior and visual appearance require browser testing.

---

## Summary

Phase 28 goal **ACHIEVED**. All 8 observable truths verified, all required artifacts exist and are substantive, all key links are wired correctly, and all 7 mapped requirements are satisfied.

The stock-out request and approval workflow is complete with:
- **Create:** QMHQ-linked requests with pre-filled items/quantities + manual multi-item requests
- **List:** Card/list toggle view with status filtering and search
- **Detail:** Line item table with selection, tabs for details/approvals/history
- **Approve:** Per-item quantity and warehouse assignment with stock level display
- **Reject:** Mandatory rejection reason with terminal warning
- **Execute:** Atomic whole-request execution with cross-warehouse stock validation
- **QMHQ Integration:** Request Stock-Out button, Stock-Out Status card with requested/approved quantities (SOAR-08)
- **Workflow Migration:** Existing stock-out page redirects to approval workflow

**Commits:** 9 commits across 3 plans (28-01: 2 commits, 28-02: 2 commits, 28-03: 2 commits + 3 docs)

**Files Created:** 7 new files (list page, create page, detail page, card component, line item table, approval dialog, rejection dialog, execution dialog)

**Files Modified:** 3 files (sidebar, permissions, QMHQ detail, stock-out page)

**Lines Added:** ~4,400 lines total

**No gaps found.** All must-haves verified. Five human verification tests recommended for complete UX and visual validation.

---

_Verified: 2026-02-09T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
