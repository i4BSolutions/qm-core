---
status: resolved
trigger: "parent-selector-lock-on-child-creation"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:05:00Z
---

## Current Focus

hypothesis: Parent selectors in PO/Invoice/Stock-in creation pages receive URL params for pre-selection but lack conditional disabled state
test: Locate all three creation pages and examine selector components
expecting: Find select components that read URL params but don't apply disabled prop conditionally
next_action: Search for creation page files and selector implementation

## Symptoms

expected: When navigating from a parent detail page to create a child entity, the parent selector should be pre-selected and locked/disabled. Applies to:
1. QMHQ detail → Create PO: QMHQ selector should be locked
2. PO detail → Create Invoice: PO selector should be locked
3. Invoice detail → Create Stock-In: Invoice selector should be locked

actual: Parent entity is pre-selected via URL query params (e.g., ?qmhq=xxx, ?po=xxx) but selector remains editable — user can change the parent to a different entity.

errors: No errors — UX issue where parent selector should be read-only/disabled when parent context provided via URL params.

reproduction:
1. Go to any QMHQ detail page
2. Click "Create PO" button (navigates to /po/new?qmhq=xxx)
3. Notice QMHQ selector is pre-filled but can be changed
Same pattern for PO→Invoice and Invoice→Stock-In flows.

started: Always been this way — selectors were never locked

## Eliminated

## Evidence

- timestamp: 2026-02-13T00:01:00Z
  checked: All 3 creation pages for parent selector implementation
  found: All three pages correctly read URL params and apply `disabled` prop to the Select component
  implication: The disabled state is ALREADY implemented correctly

- timestamp: 2026-02-13T00:02:00Z
  checked: PO creation page (lines 56, 69, 337)
  found: `preselectedQmhqId` from URL → `selectedQmhqId` state → `disabled={!!preselectedQmhqId}` on Select
  implication: PO selector is correctly locked when qmhq param exists

- timestamp: 2026-02-13T00:03:00Z
  checked: Invoice creation page (lines 57, 68, 196, no disabled on Select)
  found: `preselectedPoId` from URL → `selectedPOId` state → NO disabled prop on any Select element in PO selection
  implication: Invoice page DOES NOT lock PO selector - this is the bug for invoice flow

- timestamp: 2026-02-13T00:04:00Z
  checked: Stock-in page (lines 91, 108-109, 613)
  found: `preselectedInvoiceId` from URL → `selectedInvoiceId` state → NO disabled prop on invoice selection div
  implication: Stock-in page DOES NOT lock invoice selector - this is the bug for stock-in flow

## Resolution

root_cause: PO creation page correctly implements disabled={!!preselectedQmhqId}, but Invoice creation and Stock-in pages do not disable their parent selectors when URL params are present. The invoice selection uses clickable divs (not Select component), and stock-in also uses clickable divs for invoice selection. Both need disabled state applied.

fix:
1. **Invoice page (app/(dashboard)/invoice/new/page.tsx):**
   - Added Lock icon import
   - Added Lock + "Inherited" badge to FormSection title when preselectedPoId exists
   - Added helper text explaining inheritance
   - Modified PO selection cards: disabled onClick when preselectedPoId, added opacity-70 + cursor-not-allowed styling

2. **Stock-in page (app/(dashboard)/inventory/stock-in/page.tsx):**
   - Added Lock icon import
   - Added Lock + "Inherited" badge to FormSection title when preselectedInvoiceId exists
   - Added helper text explaining inheritance
   - Modified invoice selection cards: disabled onClick when preselectedInvoiceId, added opacity-70 + cursor-not-allowed styling
   - Disabled source mode toggle buttons when preselectedInvoiceId exists

3. **PO page enhancement (app/(dashboard)/po/new/page.tsx):**
   - Added Lock icon import (was missing visual indicator despite having disabled prop)
   - Added Lock + "Inherited" badge to FormField label when preselectedQmhqId exists
   - Added helper text explaining inheritance
   - Enhanced SelectTrigger styling with opacity-70 + cursor-not-allowed when locked

**Pattern used:** Followed existing Lock + "Inherited" badge pattern from v1.5 currency inheritance (components/qmhq/transaction-dialog.tsx lines 380-399)

verification:
✓ TypeScript compilation passes with no errors
✓ Dev server starts successfully
✓ All three pages now follow consistent Lock + "Inherited" visual pattern
✓ Parent selectors are disabled via:
  - PO page: Select component disabled prop + visual styling
  - Invoice page: onClick guard + visual styling on selection cards
  - Stock-in page: onClick guard + visual styling on selection cards + source mode toggle disabled

Manual testing required:
1. QMHQ detail → Create PO: QMHQ selector locked, shows Lock icon + "Inherited" badge
2. PO detail → Create Invoice: PO selection cards locked, shows Lock icon + "Inherited" badge
3. Invoice detail → Create Stock-In: Invoice selection cards locked, shows Lock icon + "Inherited" badge, source mode toggle disabled
4. Creating from navigation menu (no parent context): All selectors unlocked and editable

files_changed: [
  "app/(dashboard)/po/new/page.tsx",
  "app/(dashboard)/invoice/new/page.tsx",
  "app/(dashboard)/inventory/stock-in/page.tsx"
]
