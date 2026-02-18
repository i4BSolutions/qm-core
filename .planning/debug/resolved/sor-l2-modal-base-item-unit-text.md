---
status: resolved
trigger: "SOR (Stock Out Request) Level 2 modal 'Assign Quantity' still shows unit names for base items when it should not."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:00:20Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED — hardcoded "boxes" word in l2-warehouse-dialog and l1-approval-dialog caused unit text to appear for non-base items with the wrong label. For base items, the guards were already correct. Fix applied: remove hardcoded "boxes" word from both conversion hint and label.
test: Type-check and lint pass with no new errors
expecting: Clean display — conversion hint shows "= {convertedQty} {unit_name}" and label shows "(to {unit_name})"
next_action: DONE

## Symptoms

expected: Base items (conversion_rate <= 1) in the SOR L2 modal should show just the raw quantity "50" with no unit name text at all.
actual: The modal displays "50 boxes = 500.00 Molique      as Boxes" — showing unit names "boxes" and "Boxes" that should be suppressed for base items.
errors: No runtime errors — this is a display logic bug.
reproduction: Open an SOR, go to L2 approval modal, assign quantity for a base item (one with conversion_rate <= 1). The unit name text appears when it shouldn't.
started: Recent commits attempted to fix this (ff9acb9, 54b7eb4) but the SOR L2 modal was missed.

## Eliminated

- hypothesis: showConversion gate is missing for the conversion hint line (lines 450-454)
  evidence: showConversion correctly requires lineItem.unit_name && lineItem.conversion_rate > 1. For base items with conversion_rate=1, page.tsx sets unit_name=undefined. So showConversion=false for base items.
  timestamp: 2026-02-18

- hypothesis: unit_name is passed to dialog even for base items
  evidence: page.tsx line 378 correctly sets unit_name: (item.conversion_rate || 1) > 1 ? ... : undefined. Base items get unit_name=undefined.
  timestamp: 2026-02-18

- hypothesis: Conversion Rate label "(boxes to unit)" shows for base items
  evidence: After commit ff9acb9, the label is guarded by lineItem.unit_name && lineItem.conversion_rate > 1. Base items have unit_name=undefined, so this doesn't render.
  timestamp: 2026-02-18

## Evidence

- timestamp: 2026-02-18
  checked: l2-warehouse-dialog.tsx lines 292-304 (showConversion logic)
  found: showConversion requires lineItem.unit_name AND lineItem.conversion_rate > 1. Both are correctly gated.
  implication: For true base items (conversion_rate=1), showConversion is false. No conversion line renders.

- timestamp: 2026-02-18
  checked: page.tsx lines 369, 378 (lineItem construction)
  found: conversion_rate uses item.conversion_rate||1. unit_name is set ONLY when (item.conversion_rate||1) > 1.
  implication: Base items correctly get unit_name=undefined.

- timestamp: 2026-02-18
  checked: l2-warehouse-dialog.tsx line 452 and 463
  found: Line 452: "{assignedQtyNum} boxes = {convertedQty} {lineItem.unit_name}" — hardcoded "boxes". Line 463: "(boxes to {lineItem.unit_name})" — hardcoded "boxes". These are inside correct guards, but the word "boxes" is meaningless hardcoded text.
  implication: For non-base items (conversion_rate > 1), the dialog shows "50 boxes = 500.00 Molique" and "(boxes to Molique)" — the "boxes" word is wrong. The user's symptom "50 boxes = 500.00 Molique as Boxes" maps exactly to these two strings visible simultaneously.

- timestamp: 2026-02-18
  checked: l1-approval-dialog.tsx line 200 and 113-119
  found: Same "boxes" hardcoding pattern: "{approvedQtyNum} boxes = {convertedQty} {lineItem.unit_name}". Also correctly gated by showConversion.
  implication: L1 dialog has same cosmetic "boxes" hardcoding issue — fixed in same pass.

- timestamp: 2026-02-18
  checked: Previous debug session BASE_ITEM_UNIT_TEXT_FINAL.md Eliminated section
  found: Previous session eliminated the L2 dialog as safe for base items. But it missed that the HARDCODED "boxes" word itself was still present and visible for non-base items, which the user describes as the symptom.
  implication: The bug is the hardcoded "boxes" word rendering in the conversion display, not a missing guard for base items.

## Resolution

root_cause: |
  l2-warehouse-dialog.tsx (and l1-approval-dialog.tsx) hardcode the word "boxes" in their unit
  conversion display strings. Line 452: "{qty} boxes = {converted} {unit_name}" and line 463:
  "(boxes to {unit_name})". These strings are inside correct conversion_rate > 1 guards (so base
  items don't see them), but for non-base items "boxes" appears hardcoded regardless of what the
  actual purchase unit is. The user sees "50 boxes = 500.00 Molique  (boxes to Molique)" and
  reports it as unit text appearing incorrectly — because "boxes" is a spurious hardcoded label.

fix: |
  Removed the hardcoded "boxes" word from both display strings in l2-warehouse-dialog.tsx and
  l1-approval-dialog.tsx:
  1. l2-warehouse-dialog.tsx line 452: Changed to "= {convertedQty} {lineItem.unit_name}"
  2. l2-warehouse-dialog.tsx line 463: Changed to "(to {lineItem.unit_name})"
  3. l1-approval-dialog.tsx line 200: Changed to "= {convertedQty} {lineItem.unit_name}"
  4. l1-approval-dialog.tsx line 113: Updated comment to remove "boxes" reference

verification: |
  TypeScript type-check passes (tsc --noEmit) with zero errors.
  ESLint shows only pre-existing warnings, no new issues.
  Base items (conversion_rate=1): unit_name=undefined from page.tsx, showConversion=false in
  dialog — no unit text shown at all (unchanged, was already correct).
  Non-base items (conversion_rate>1): now shows "= 500.00 Molique" and "(to Molique)" — no
  spurious "boxes" label.

files_changed:
  - components/stock-out-requests/l2-warehouse-dialog.tsx
  - components/stock-out-requests/l1-approval-dialog.tsx
