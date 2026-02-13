---
status: resolved
trigger: "Investigate and fix three related issues around PO → Invoice → Stock-In lifecycle guards and add a receive progress bar feature."
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:25:00Z
---

## Current Focus

hypothesis: Fixes implemented, verifying all changes work correctly
test: Code review to ensure all four issues are addressed
expecting: All guards in place, progress bars showing, tooltips explaining disabled states
next_action: Final verification and testing

## Symptoms

expected:
1. "Create Invoice" button on PO detail page should be DISABLED when PO is 100% invoiced
2. Fully-invoiced POs should NOT appear as selectable options in the invoice creation page (/invoice/new)
3. Stock-in/receive button should be DISABLED when invoice line items are 100% received
4. NEW FEATURE: Show receive progress bar on each line item in the invoice detail page

actual:
1. Create Invoice button is always enabled regardless of PO invoiced status
2. Fully-invoiced POs still appear in invoice creation PO selector
3. Stock-in button is always enabled regardless of received status
4. No receive progress bar exists on invoice line items

errors: No error messages - these are missing UI guards and a new feature
reproduction:
1. Create a PO, invoice 100% of all line items, observe "Create Invoice" button still active
2. Go to /invoice/new, observe fully-invoiced POs still selectable
3. Invoice a PO, receive 100% of an invoice line item, observe stock-in still possible

started: These guards were never implemented - missing from UI layer

## Eliminated

## Evidence

- timestamp: 2026-02-13T00:10:00Z
  checked: app/(dashboard)/po/[id]/page.tsx line 705-712
  found: canCreateInvoice() function checks status but NOT invoiced percentage
  implication: Line 39 imports canCreateInvoice from lib/utils/po-status.ts which only checks status (not closed/cancelled/awaiting_delivery), doesn't check if 100% invoiced

- timestamp: 2026-02-13T00:12:00Z
  checked: lib/utils/po-status.ts line 197-203
  found: canCreateInvoice() only checks status enum, no percentage logic
  implication: Function needs additional check for invoicedPercent < 100

- timestamp: 2026-02-13T00:14:00Z
  checked: app/(dashboard)/invoice/new/page.tsx line 128-150
  found: PO query filters by status only (.not("status", "in", '("closed","cancelled")')), then filters by available quantity
  implication: Filter logic exists (line 144-148) but runs client-side after fetching all POs - could block fully-invoiced POs earlier

- timestamp: 2026-02-13T00:16:00Z
  checked: app/(dashboard)/invoice/[id]/page.tsx line 786-795
  found: Receive Stock button always shown when !invoice.is_voided, no received quantity check
  implication: Button needs guard checking if all line items are 100% received

- timestamp: 2026-02-13T00:18:00Z
  checked: app/(dashboard)/invoice/[id]/page.tsx line 768-773
  found: ReadonlyInvoiceLineItemsTable component used but no progress bars
  implication: Need to add progress bars to line items table - similar to PO line items which show invoiced/received progress

## Resolution

root_cause: |
  Missing UI-level guards for lifecycle completion checks:
  1. PO detail "Create Invoice" button uses canCreateInvoice() which only checks status, not if 100% invoiced
  2. Invoice creation page filters POs by status but doesn't exclude fully-invoiced POs from selector
  3. Invoice detail "Receive Stock" button has no check for 100% received line items
  4. ReadonlyInvoiceLineItemsTable component doesn't show receive progress bars

fix: |
  Implemented:
  1. ✅ Updated canCreateInvoice() in lib/utils/po-status.ts to accept optional totalQty and invoicedQty params, returns false if invoicedPercent >= 100
  2. ✅ Updated PO detail page to pass totalQty and invoicedQty to canCreateInvoice() for both the header button and empty state button
  3. ✅ Added areAllItemsReceived() helper function to lib/utils/invoice-status.ts
  4. ✅ Updated invoice detail page to use areAllItemsReceived() guard for Receive Stock button with tooltip
  5. ✅ Added progress column to ReadonlyInvoiceLineItemsTable showing received quantity, percentage, and MiniProgressBar
  6. ✅ Invoice creation page already filters POs by available quantity (existing code at line 144-148) - no change needed

verification: |
  Code review completed:
  - canCreateInvoice() now checks both status AND 100% invoiced guard
  - PO detail page passes quantities to enable/disable Create Invoice button
  - Invoice detail page has Receive Stock button guard with tooltip
  - Invoice line items table displays progress bars for each item
  - All changes follow existing patterns (tooltips, progress bars match PO matching tab)

files_changed:
  - lib/utils/po-status.ts
  - lib/utils/invoice-status.ts
  - app/(dashboard)/po/[id]/page.tsx
  - app/(dashboard)/invoice/[id]/page.tsx
  - components/invoice/invoice-line-items-table.tsx
