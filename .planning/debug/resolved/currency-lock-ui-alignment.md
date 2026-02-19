---
status: resolved
trigger: "After the PO currency lock fix (commit c08ded1), there are UI alignment issues on PO create page. Additionally, Money IN create and Money OUT create pages also need the same currency lock behavior when linked to a QMHQ. The user wants a minimal UI approach: just a lock icon with a tooltip saying 'Inherited from QMHQ' when hovering the lock icon. No extra label text or helper text below the field."
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:10:00Z
---

## Current Focus

hypothesis: RESOLVED
test: type-check passes, both files fixed
expecting: clean minimal lock icon with tooltip
next_action: archive

## Symptoms

expected: |
  1. PO create: Currency field locked when linked to QMHQ, with ONLY a small lock icon next to the currency label. Hovering the lock icon shows tooltip "Inherited from QMHQ". No extra text. Clean alignment.
  2. Money IN create: Same lock behavior with lock icon + tooltip
  3. Money OUT create: Same lock behavior with lock icon + tooltip

actual: |
  PO create (app/(dashboard)/po/new/page.tsx):
  - Label had: "Currency" + Lock icon + "Locked from QMHQ" span
  - After Select had: helper paragraph with Lock icon + "Currency is inherited from the QMHQ and cannot be changed"

  Transaction dialog (components/qmhq/transaction-dialog.tsx):
  - Label had: "Currency" + Lock icon + "Inherited" span
  - After Select had: helper paragraph "Currency is set by the parent QMHQ"

errors: No errors - UI alignment/consistency issue

reproduction: |
  1. Go to PO create linked to a QMHQ - see alignment issues with lock UI
  2. Go to Money IN/OUT dialog - see extra helper text

timeline: Started with commit c08ded1 (PO currency lock fix). Money IN/OUT never had the tooltip.

## Eliminated

(none needed - root cause was immediately visible in the code)

## Evidence

- timestamp: 2026-02-19T00:00:00Z
  checked: app/(dashboard)/po/new/page.tsx lines 468-504
  found: Currency FormField label had extra "Locked from QMHQ" span text AND a helper paragraph after the Select
  implication: Remove both, replace with tooltip-only lock icon on label

- timestamp: 2026-02-19T00:00:00Z
  checked: components/qmhq/transaction-dialog.tsx lines 381-401
  found: Currency Label had "Inherited" span text AND a helper paragraph "Currency is set by the parent QMHQ" after the Select
  implication: Same fix - remove both, replace with tooltip-only lock icon on label

- timestamp: 2026-02-19T00:05:00Z
  checked: type-check output
  found: EXIT_CODE 0 - no TypeScript errors
  implication: Fix is type-safe

## Resolution

root_cause: |
  PO create page had extra "Locked from QMHQ" text in the label span AND a helper <p> below the Select.
  Transaction dialog (Money IN/OUT) had "Inherited" text in the label AND a helper <p> below the Select.
  Both caused visual noise and alignment issues compared to other form fields.

fix: |
  1. app/(dashboard)/po/new/page.tsx:
     - Added Tooltip imports from @/components/ui/tooltip
     - Removed <span> with "Locked from QMHQ" from the currency label
     - Replaced with TooltipProvider/Tooltip/TooltipTrigger/TooltipContent wrapping Lock icon
     - Removed helper <p> after the Select entirely
     - Lock icon only shows when selectedQmhqId is set (conditional)

  2. components/qmhq/transaction-dialog.tsx:
     - Added Tooltip imports from @/components/ui/tooltip
     - Removed "Inherited" span from the currency label
     - Replaced with TooltipProvider/Tooltip/TooltipTrigger/TooltipContent wrapping Lock icon
     - Removed helper <p> "Currency is set by the parent QMHQ" after the Select
     - Lock icon always shows (currency is always inherited in this dialog)

verification: |
  - tsc --noEmit passes with EXIT_CODE 0
  - Both files read back and confirmed correct structure
  - Exchange rate field remains editable (unchanged)
  - Currency Select remains disabled when locked (unchanged)

files_changed:
  - app/(dashboard)/po/new/page.tsx
  - components/qmhq/transaction-dialog.tsx
