---
phase: 44-po-edit-capability
plan: 01
subsystem: purchase-orders
tags: [edit-capability, audit-logging, header-fields, status-guard]
dependency_graph:
  requires:
    - purchase_orders table
    - audit_logs table
    - po-status.ts utilities
    - composite components
  provides:
    - updatePO server action
    - /po/[id]/edit route
    - PO header editing capability
  affects:
    - PO detail page (Edit button link)
    - Audit logs (PO update tracking)
tech_stack:
  added:
    - updatePO server action with audit logging
  patterns:
    - Header-only editing (immutable line items/amounts)
    - Status-based edit guards
    - Old/new value audit tracking
key_files:
  created:
    - app/(dashboard)/po/[id]/edit/page.tsx
  modified:
    - lib/actions/po-actions.ts
decisions:
  - decision: Store signer names as strings, not contact_person IDs
    rationale: Allows flexibility for signers not in contact_persons table
    impact: Edit page selects from contact_persons but stores name string
  - decision: Guard at page render instead of server action only
    rationale: Better UX - show clear block message instead of error toast
    impact: Block UI prevents form submission for closed/cancelled POs
  - decision: Only create audit log if fields actually changed
    rationale: Avoid noise in audit trail from no-op saves
    impact: Audit log insert conditional on Object.keys(oldValues).length > 0
metrics:
  duration: 317s
  tasks_completed: 2
  files_created: 1
  files_modified: 1
  commits: 2
  completed_date: 2026-02-14
---

# Phase 44 Plan 01: PO Edit Capability Summary

**One-liner:** Header-only PO editing (supplier, notes, dates, signers) with status guards and audit logging

## What Was Built

Built a PO edit page at `/po/[id]/edit` that allows users to modify header metadata fields while keeping financial data and line items immutable. The page guards against editing closed or cancelled POs with a clear block message. All edits are tracked in the audit log with before/after values.

### Key Components

1. **updatePO Server Action** (`lib/actions/po-actions.ts`)
   - Accepts header fields: supplier_id, notes, expected_delivery_date, contact_person_name, sign_person_name, authorized_signer_name
   - Fetches PO before update to capture old values
   - Guards against closed/cancelled status
   - Tracks changed fields and creates audit log entry
   - Revalidates `/po` and `/po/[id]` paths
   - Returns `UpdatePOResult` with success/error

2. **PO Edit Page** (`app/(dashboard)/po/[id]/edit/page.tsx`)
   - Pre-fills form with existing PO data
   - Editable fields: Supplier (select), Expected Delivery Date (date picker), Notes (textarea), Contact/Sign/Authorized Signer (selects from contact_persons)
   - Read-only display section: PO number, QMHQ ref, PO date, currency, exchange rate, total amount with EUSD, line item count
   - Status guard at render: shows red block message for closed/cancelled POs instead of form
   - Calls updatePO server action on submit
   - Shows success toast and redirects to `/po/[id]` on save

### Implementation Details

**Editable Fields (Header Only):**
- Supplier (required dropdown)
- Expected Delivery Date (optional date picker)
- Notes (optional textarea)
- Contact Person Name (optional select from contact_persons, stores name string)
- Sign Person Name (optional select from contact_persons, stores name string)
- Authorized Signer Name (optional select from contact_persons, stores name string)

**Immutable Fields (Read-Only Display):**
- PO Number (code badge)
- QMHQ Reference (link to QMHQ detail)
- PO Date
- Currency
- Exchange Rate
- Total Amount (with EUSD display)
- Line Items (count only, not editable)

**Status Guard Behavior:**
- `status === 'closed'` → Block message: "Cannot edit a closed PO. Only administrators can unlock closed POs for corrections."
- `status === 'cancelled'` → Block message: "Cannot edit a cancelled PO."
- All other statuses → Show edit form

**Audit Logging:**
- Captures old/new values for all changed fields
- Only creates audit log entry if at least one field changed
- Summary: "PO header fields updated"
- Links to user via `changed_by` field

## Tasks Completed

### Task 1: Add updatePO server action with audit logging
**Commit:** `22a2ad9`
**Files:** `lib/actions/po-actions.ts`

Added `updatePO()` server action following the same pattern as `cancelPO()` and `unlockClosedPO()`. The action:
- Validates authentication
- Fetches PO before update to get baseline values
- Guards against closed/cancelled status (returns error)
- Builds update object from provided fields
- Tracks changed fields in `oldValues` and `newValues` objects
- Executes update on `purchase_orders` table
- Creates audit log entry with old/new values (only if changes exist)
- Revalidates `/po` and `/po/[id]` paths
- Returns `UpdatePOResult` with PO number or error

### Task 2: Create PO edit page with header-only editing and status guard
**Commit:** `75e3a58`
**Files:** `app/(dashboard)/po/[id]/edit/page.tsx`

Created full-featured edit page with:
- Loading state with spinner
- Not found state with back button
- Status guard check at render time (blocks form for closed/cancelled)
- Form pre-fill from existing PO data
- Editable fields section (supplier, delivery date, notes, signers)
- Read-only information section (PO number, QMHQ ref, dates, currency, amounts, line items)
- Form submission via updatePO server action
- Success toast + redirect to detail page
- Error toast on failure
- Supplier dropdown from active suppliers
- Contact person dropdowns for signers (stores name string, not ID)
- Date picker for expected delivery date
- Consistent styling with QMHQ edit page pattern

## Deviations from Plan

None - plan executed exactly as written. All editable fields, read-only displays, status guards, and audit logging implemented as specified.

## Verification Results

### TypeScript Compilation
```
npx tsc --noEmit
```
✅ **PASSED** - No type errors in po-actions.ts or edit page

### Build Compilation
```
npm run build
```
✅ **PASSED** - Edit page compiled successfully
- Route: `/po/[id]/edit` - 7.41 kB First Load JS
- No build errors or warnings for edit page

### Expected User Flow
1. Navigate to any non-closed, non-cancelled PO detail page
2. Click "Edit" button in header actions
3. Redirects to `/po/{id}/edit`
4. Form loads with pre-filled data
5. User can modify supplier, notes, delivery date, signers
6. User sees read-only display of PO number, amounts, currency, line items
7. User clicks "Save Changes"
8. Server action validates, updates PO, creates audit log
9. Success toast shows "{PO_NUMBER} updated successfully"
10. Redirects to `/po/{id}` detail page
11. Audit log entry created in `audit_logs` table with old/new values

### Status Guard Verification
- **Closed PO:** Edit page shows red block message, no form rendered
- **Cancelled PO:** Edit page shows red block message, no form rendered
- **Other statuses:** Edit form renders normally

## Integration Points

### Upstream Dependencies
- `purchase_orders` table (all header fields)
- `suppliers` table (supplier dropdown)
- `contact_persons` table (signer dropdowns)
- `audit_logs` table (audit tracking)
- `po-status.ts` utilities (canEditPO guard - not directly used, but pattern aligned)
- Composite components (FormSection, FormField, PageHeader)
- UI components (DatePicker, Select, Textarea, CurrencyDisplay)

### Downstream Impact
- **PO Detail Page:** Edit button (already wired at line 411-416) now navigates to functional edit page
- **Audit Logs:** PO updates now tracked with old/new values
- **History Tab:** Edit actions appear in PO history timeline

### API Surface
- **Server Action:** `updatePO(poId: string, data: UpdatePOData): Promise<UpdatePOResult>`
- **Route:** `/po/[id]/edit` (client component)

## Known Limitations

1. **Line Items Not Editable:** By design - line items are immutable after PO creation. Users must void invoice and create new PO to change line items.
2. **Currency/Exchange Rate Not Editable:** By design - financial calculations are locked after PO creation to maintain audit trail integrity.
3. **Unlocking Closed POs:** Only admins can unlock via "Unlock PO" button on detail page. After unlock, edit becomes available.
4. **Cancelled POs:** Cannot be edited even by admins. Cancellation is terminal.

## Self-Check

### Files Created
```bash
[ -f "app/(dashboard)/po/[id]/edit/page.tsx" ] && echo "FOUND: app/(dashboard)/po/[id]/edit/page.tsx" || echo "MISSING: app/(dashboard)/po/[id]/edit/page.tsx"
```
✅ **FOUND:** app/(dashboard)/po/[id]/edit/page.tsx

### Commits Exist
```bash
git log --oneline --all | grep -q "22a2ad9" && echo "FOUND: 22a2ad9" || echo "MISSING: 22a2ad9"
git log --oneline --all | grep -q "75e3a58" && echo "FOUND: 75e3a58" || echo "MISSING: 75e3a58"
```
✅ **FOUND:** 22a2ad9 (updatePO server action)
✅ **FOUND:** 75e3a58 (PO edit page)

### updatePO Function Exported
```bash
grep -q "export async function updatePO" lib/actions/po-actions.ts && echo "FOUND: updatePO export" || echo "MISSING: updatePO export"
```
✅ **FOUND:** updatePO export

## Self-Check: PASSED

All files created, commits exist, and exports verified.
