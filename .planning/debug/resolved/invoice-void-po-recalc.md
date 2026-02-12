---
status: resolved
trigger: "invoice-void-po-recalc"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - The recalculate_po_on_invoice_void is a BEFORE UPDATE trigger that queries invoices table with i.is_voided = false, but since the UPDATE hasn't completed yet, it still sees the OLD value (is_voided = false), so the subquery INCLUDES the invoice being voided instead of EXCLUDING it
test: Verify the subquery in recalculate_po_on_invoice_void sees the OLD row values, not NEW
expecting: Subquery incorrectly includes the invoice being voided in the SUM
next_action: Fix the trigger to either (1) move to AFTER UPDATE or (2) exclude NEW.id explicitly in the WHERE clause

## Symptoms

expected: Full PO recalculation — PO status, invoiced_quantity on po_line_items, received_quantity, and progress bars should all recalculate excluding the voided invoice's data
actual: Nothing changes. PO metrics remain unchanged after invoice void. Status, quantities, progress all stay as if the invoice still exists.
errors: No errors thrown — the void operation completes successfully but PO metrics are stale
reproduction: Always reproducible. Every time an invoice is voided, the parent PO metrics don't update.
timeline: Likely has never worked — PO status engine was built in Phase 41 and void/recalc integration may have been missed

## Eliminated

## Evidence

- timestamp: 2026-02-12T00:01:00Z
  checked: Invoice void server action (invoice-actions.ts)
  found: Server action only updates invoices table with is_voided = true, status = 'voided'
  implication: Relies entirely on database triggers for cascade effects

- timestamp: 2026-02-12T00:02:00Z
  checked: Migration 022 (invoice_line_items.sql) - recalculate_po_on_invoice_void trigger
  found: BEFORE UPDATE trigger on invoices table recalculates po_line_items.invoiced_quantity when is_voided changes
  implication: PO line items SHOULD be updated correctly when invoice is voided

- timestamp: 2026-02-12T00:03:00Z
  checked: Migration 016 (po_line_items.sql) - trigger_update_po_status function
  found: AFTER INSERT/UPDATE/DELETE trigger on po_line_items calls trigger_update_po_status() which recalculates PO status
  implication: PO status SHOULD be updated when po_line_items.invoiced_quantity changes

- timestamp: 2026-02-12T00:04:00Z
  checked: Migration 041 (invoice_void_cascade_audit.sql)
  found: zz_audit_invoice_void_cascade AFTER UPDATE trigger on invoices - logs cascade effects AFTER they complete
  implication: Audit trigger assumes cascades work (logs PO status changes)

- timestamp: 2026-02-12T00:05:00Z
  checked: Trigger chain flow
  found: invoices BEFORE UPDATE (recalculate_po_on_invoice_void) → UPDATEs po_line_items → po_line_items AFTER UPDATE (po_line_item_update_status) → UPDATEs purchase_orders.status
  implication: Chain should work in theory, but UPDATE inside BEFORE trigger might not fire row-level triggers on po_line_items

- timestamp: 2026-02-12T00:06:00Z
  checked: PostgreSQL trigger behavior with nested UPDATEs
  found: UPDATE statements inside triggers DO fire triggers on the affected table in PostgreSQL
  implication: The trigger chain should work. Need to check if UPDATE actually modifies rows

- timestamp: 2026-02-12T00:07:00Z
  checked: Subquery in recalculate_po_on_invoice_void BEFORE UPDATE trigger
  found: Query filters `i.is_voided = false` but joins to invoices table. Since this is a BEFORE UPDATE trigger, the invoices table hasn't been updated yet, so the JOIN sees is_voided = false (the OLD value) for the invoice being voided
  implication: The SUM incorrectly INCLUDES the invoice being voided, so invoiced_quantity doesn't decrease. Therefore PO status doesn't change.

## Resolution

root_cause: The recalculate_po_on_invoice_void() function is a BEFORE UPDATE trigger on the invoices table. When it runs its subquery to recalculate po_line_items.invoiced_quantity, it filters invoices with `i.is_voided = false`. However, since the trigger fires BEFORE the UPDATE completes, the invoices table still contains the OLD row values (is_voided = false) for the invoice being voided. Therefore, the subquery incorrectly INCLUDES the invoice being voided in the SUM, resulting in no change to invoiced_quantity. Since invoiced_quantity doesn't change, the downstream trigger (po_line_item_update_status) is never fired, and PO status remains unchanged.

fix: Modified the recalculate_po_on_invoice_void() function to explicitly exclude the invoice being voided (NEW.id) from the subquery by adding `AND i.id != NEW.id` to the WHERE clause. This ensures the subquery excludes the invoice being voided even though the BEFORE trigger sees OLD row values.

verification: Fix applied in migration 20260212220000_fix_invoice_void_po_recalc.sql. The migration replaces the function with the corrected version. Once applied to production, when an invoice is voided:
1. recalculate_po_on_invoice_void BEFORE trigger fires
2. It UPDATEs po_line_items.invoiced_quantity, now correctly excluding the voided invoice via NEW.id filter
3. invoiced_quantity decreases (if it was > 0)
4. po_line_item_update_status AFTER trigger fires (because invoiced_quantity changed)
5. trigger_update_po_status calculates new PO status based on updated totals
6. purchase_orders.status is updated
7. zz_audit_invoice_void_cascade logs the cascade effects

files_changed:
- supabase/migrations/20260212220000_fix_invoice_void_po_recalc.sql (new migration)
