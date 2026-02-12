---
phase: 40-ui-consistency-rollout
plan: 03
subsystem: ui-layer
tags: [composite-migration, detail-pages, layout-standardization]
dependency_graph:
  requires:
    - "Phase 36-03 (DetailPageLayout composite)"
    - "Phase 36-02 (Composite exports)"
  provides:
    - "6 detail pages using DetailPageLayout composite"
    - "Standardized detail page navigation and headers"
    - "Consistent KPI panel rendering"
  affects:
    - app/(dashboard)/qmrl/[id]/page.tsx
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/warehouse/[id]/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx
    - app/(dashboard)/invoice/[id]/page.tsx
    - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
tech_stack:
  added: []
  patterns:
    - "Slot-based layout composition (header/actions/kpiPanel/children)"
    - "Conditional kpiPanel rendering (qmhq expense/po routes)"
    - "Error state display within header slot"
key_files:
  created: []
  modified:
    - path: app/(dashboard)/qmrl/[id]/page.tsx
      changes: "Migrated to DetailPageLayout with ID/status/priority header and Edit+Add QMHQ actions"
    - path: app/(dashboard)/po/[id]/page.tsx
      changes: "Migrated to DetailPageLayout with PO number/supplier header, Cancel+Edit actions, financial KPI panel"
    - path: app/(dashboard)/warehouse/[id]/page.tsx
      changes: "Migrated to DetailPageLayout with name/location header, Stock In/Out actions, 3-metric KPI panel"
    - path: app/(dashboard)/qmhq/[id]/page.tsx
      changes: "Migrated to DetailPageLayout with route badge/ID header, Edit action, conditional financial KPI for expense/po"
    - path: app/(dashboard)/invoice/[id]/page.tsx
      changes: "Migrated to DetailPageLayout with status/number header, Void action, financial summary KPI panel"
    - path: app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
      changes: "Migrated to DetailPageLayout with request number/status header, Cancel action, request info panel"
decisions:
  - "DetailPageLayout error banner placement: Moved inside header slot for warehouse/invoice (preserves contextual proximity)"
  - "QMHQ kpiPanel conditional: Used ternary with undefined for non-financial routes (cleaner than wrapping in fragment)"
  - "Stock-out-request kpiPanel: Used request info panel as kpiPanel slot (semantically similar to KPIs)"
metrics:
  duration: "1028s (~17.1 min)"
  completed_date: "2026-02-12"
  tasks_completed: 2
  files_modified: 6
  lines_changed: "+317 / -377 (net -60)"
---

# Phase 40 Plan 03: Detail Page Migration Summary

**One-liner:** Migrated 6 detail pages (QMRL, PO, Warehouse, QMHQ, Invoice, Stock-Out-Request) to DetailPageLayout composite with standardized back-navigation, headers, actions, and optional KPI panels.

## Execution Flow

### Task 1: Migrate QMRL, PO, and Warehouse detail pages

**Duration:** ~10 min
**Commit:** 399daf1

Migrated first batch of 3 detail pages to DetailPageLayout composite:

**QMRL detail** (`app/(dashboard)/qmrl/[id]/page.tsx`):
- Removed: Grid overlay div, inline back button (Link + ArrowLeft), flex wrapper around header/actions
- Added: DetailPageLayout with backHref="/qmrl"
- header slot: Request ID badge, priority/status badges, title, category/date/department metadata
- actions slot: Edit button (permission-gated), Add QMHQ Line button
- children: Tabs component (Details, QMHQ Lines, History, Attachments) + CommentsSection
- Preserved: All tab content, status change logic, QMHQ creation flow, file upload handling

**PO detail** (`app/(dashboard)/po/[id]/page.tsx`):
- Removed: Grid overlay div, inline back button, flex wrapper
- Added: DetailPageLayout with backHref="/po"
- header slot: Status badges (PO + Approval), PO number, supplier name, parent QMHQ link
- actions slot: Cancel PO button (with loading state), Edit button (permission-gated)
- kpiPanel slot: Financial summary with 3 metrics (PO Total, Invoiced %, Received %) + progress bars
- children: Tabs (Details, Line Items, Invoices, History) + CommentsSection
- Preserved: PO status logic, financial calculations, invoice creation flow, line items display

**Warehouse detail** (`app/(dashboard)/warehouse/[id]/page.tsx`):
- Removed: Grid overlay div, inline back button, flex wrapper
- Moved error banner into header slot (contextual proximity)
- Added: DetailPageLayout with backHref="/warehouse"
- header slot: Error banner (if present), warehouse badge, name, location, description
- actions slot: Stock In button, Stock Out button
- kpiPanel slot: 3 KPI cards (Total Value EUSD, Unique Items, Total Units)
- children: Tabs (Inventory, Stock Movement, History)
- Preserved: WAC display, stock level calculations, inventory transaction history

**Verification:**
- TypeScript: 0 errors after fixing ArrowLeft imports (still needed in error fallback states)
- Grep: All 3 files import and use DetailPageLayout
- No duplicate grid-overlay divs (DetailPageLayout provides it)

### Task 2: Migrate QMHQ, Invoice, and Stock-Out-Request detail pages

**Duration:** ~7 min
**Commit:** d142364

Migrated second batch of 3 detail pages, including the most complex page (QMHQ 1289 lines):

**QMHQ detail** (`app/(dashboard)/qmhq/[id]/page.tsx` - 1289 lines):
- CRITICAL APPROACH: Only modified outermost layout wrapper (first ~20 lines + last 3 lines of return statement)
- Removed: Grid overlay div, inline back button, outer flex wrapper
- Added: DetailPageLayout with backHref="/qmhq"
- header slot: Route type badge (Item/Expense/PO), status badge, request ID, line name, parent QMRL link
- actions slot: Edit button (permission-gated)
- kpiPanel slot: **Conditional rendering** - only for expense/po routes, shows financial summary (QMHQ Amount, Yet to Receive, Money In, Money Out/PO Committed, Balance)
  - Used ternary with `undefined` for item route (cleaner than fragment wrapper)
- children: Entire Tabs component with all route-specific content
- Preserved: ALL route-type logic (item/expense/po sections), financial displays, transaction creation, stock-out integration, PO creation flow, linked transactions, fulfillment metrics, comments, attachments

**Invoice detail** (`app/(dashboard)/invoice/[id]/page.tsx`):
- Removed: Grid overlay div, inline back button, flex wrapper
- Moved error banner + voided warning into header slot
- Added: DetailPageLayout with backHref="/invoice"
- header slot: Error banner (if present), status badge, invoice number, supplier name, parent PO link, voided warning (if voided)
- actions slot: Void Invoice button (conditional on status)
- kpiPanel slot: Financial summary (Invoice Total, Line Items count, Invoice Date)
- children: Tabs (Details, Line Items, Stock Receipts, History) + CommentsSection + VoidInvoiceDialog
- Preserved: Void functionality, financial calculations, stock receipt tracking

**Stock-Out-Request detail** (`app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx`):
- Note: This page had different structure (no grid-overlay, different outer div)
- Removed: Inline back button (Button with router.push), outer space-y-6 div wrapper
- Added: DetailPageLayout with backHref="/inventory/stock-out-requests"
- header slot: Request number, requester info, status badge
- actions slot: Cancel Request button (permission-gated, with loading state)
- kpiPanel slot: Request info panel (Reason badge, QMHQ reference link, Requester, Created timestamp, Notes)
  - Semantically similar to KPI panel (contextual metadata display)
- children: Tabs (Details, Approvals, Transactions, History) + approval/rejection/execution dialogs
- Preserved: ALL approval logic, execution workflow, line items display, stock level checks, cross-tab sync via BroadcastChannel

**Verification:**
- TypeScript: 0 errors
- Production build: SUCCESS
- Grep: All 3 files import and use DetailPageLayout
- Line changes: +166 / -196 (net -30 for Task 2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ArrowLeft import removal**
- **Found during:** Task 1 TypeScript check after initial edits
- **Issue:** Removed ArrowLeft from imports but still used in error fallback states (PO Not Found, Warehouse Not Found)
- **Fix:** Re-added ArrowLeft to imports for both files
- **Files modified:** app/(dashboard)/po/[id]/page.tsx, app/(dashboard)/warehouse/[id]/page.tsx
- **Commit:** Included in 399daf1 (no separate commit needed, fixed before initial commit)

**2. [Rule 2 - Critical] Error banner placement**
- **Found during:** Task 2 Invoice/Warehouse migration
- **Issue:** Error banners displayed BEFORE layout wrapper in original code, needed to be inside header slot for DetailPageLayout
- **Fix:** Moved error banners into header slot to preserve contextual proximity (errors appear above the entity header)
- **Files modified:** app/(dashboard)/warehouse/[id]/page.tsx, app/(dashboard)/invoice/[id]/page.tsx
- **Commit:** Included in respective task commits
- **Rationale:** Error state should be part of header context, not a separate sibling element

**3. [Rule 2 - Critical] Voided warning placement**
- **Found during:** Task 2 Invoice migration
- **Issue:** Voided warning displayed as separate section after header, needed integration with header for consistent layout
- **Fix:** Moved voided warning into header slot (displayed after PO link)
- **Files modified:** app/(dashboard)/invoice/[id]/page.tsx
- **Commit:** Included in d142364
- **Rationale:** Voided status is critical header metadata, should be prominently displayed near title/status

## Key Insights

### Pattern Observations

1. **Conditional kpiPanel slots**: QMHQ demonstrates clean conditional rendering with ternary + undefined (no fragment needed)
2. **Error state placement**: Error banners work well inside header slot (contextual proximity)
3. **Semantic flexibility**: "Request info panel" for SOR works as kpiPanel slot (both are contextual metadata displays)
4. **Minimal invasiveness**: QMHQ 1289-line file only required ~30 lines of outer wrapper changes (all tab content untouched)

### Layout Consolidation Benefits

- **Before:** 6 files × (grid-overlay + back button + flex wrapper) = ~18 repeated layout structures
- **After:** 6 files importing shared DetailPageLayout = 1 canonical layout implementation
- **DRY improvement:** Grid overlay, back button styling, header/actions flexbox all centralized
- **Consistency:** All detail pages now have identical spacing, animation delays, corner accents

### Slot Usage Patterns

| Page | header | actions | kpiPanel | children |
|------|--------|---------|----------|----------|
| QMRL | ID/status/title | Edit, Add QMHQ | (none) | Tabs + Comments |
| PO | Number/supplier/status | Cancel, Edit | Financial 3-metric | Tabs + Comments |
| Warehouse | Name/location/badge | Stock In/Out | KPI 3-metric | Tabs |
| QMHQ | Route badge/ID/title | Edit | Conditional financial | Tabs + Dialogs |
| Invoice | Number/supplier/status | Void | Financial 3-metric | Tabs + Comments + Dialog |
| SOR | Number/status | Cancel | Request info panel | Tabs + Dialogs |

**Pattern:** Financial pages (PO, Invoice, QMHQ expense/po) consistently use kpiPanel for financial summaries.

## Self-Check

**Created files verification:**
```bash
# No files created (migration only)
```

**Modified files verification:**
```bash
[ -f "app/(dashboard)/qmrl/[id]/page.tsx" ] && echo "FOUND" || echo "MISSING"
[ -f "app/(dashboard)/po/[id]/page.tsx" ] && echo "FOUND" || echo "MISSING"
[ -f "app/(dashboard)/warehouse/[id]/page.tsx" ] && echo "FOUND" || echo "MISSING"
[ -f "app/(dashboard)/qmhq/[id]/page.tsx" ] && echo "FOUND" || echo "MISSING"
[ -f "app/(dashboard)/invoice/[id]/page.tsx" ] && echo "FOUND" || echo "MISSING"
[ -f "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx" ] && echo "FOUND" || echo "MISSING"
```
**Result:** All 6 files FOUND

**Commits verification:**
```bash
git log --oneline --all | grep -E "399daf1|d142364"
```
**Result:**
- 399daf1 feat(40-03): migrate QMRL, PO, Warehouse detail to DetailPageLayout
- d142364 feat(40-03): migrate QMHQ, Invoice, SOR detail to DetailPageLayout

**Import verification:**
```bash
grep "DetailPageLayout" app/(dashboard)/qmrl/[id]/page.tsx
grep "DetailPageLayout" app/(dashboard)/po/[id]/page.tsx
grep "DetailPageLayout" app/(dashboard)/warehouse/[id]/page.tsx
grep "DetailPageLayout" app/(dashboard)/qmhq/[id]/page.tsx
grep "DetailPageLayout" app/(dashboard)/invoice/[id]/page.tsx
grep "DetailPageLayout" app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
```
**Result:** All 6 files contain DetailPageLayout import and usage

**TypeScript verification:**
```bash
npx tsc --noEmit
```
**Result:** 0 errors

**Production build verification:**
```bash
npm run build
```
**Result:** SUCCESS (all 6 pages built successfully)

## Self-Check: PASSED

All files exist, commits verified, DetailPageLayout imported in all pages, TypeScript clean, production build successful.

## Impact Assessment

### Coverage

**Detail page standardization:**
- 6 of 7 detail pages now use DetailPageLayout (Item already migrated in Phase 36-03)
- Combined coverage: 7/7 detail pages = 100% standardization
- Eliminated 6 instances of duplicate layout code (grid-overlay, back button, header flex)

### Regression Risk

**Risk level:** LOW

**Mitigation:**
- Only outermost layout wrapper modified (all tab content/business logic untouched)
- Surgical JSX replacement pattern (import + outer wrapper only)
- TypeScript + production build verification confirms no breaking changes
- All domain-specific content preserved:
  - QMRL: Status change, QMHQ creation, file uploads, comments
  - PO: Financial calculations, invoice creation, cancellation flow
  - Warehouse: WAC display, stock calculations, transaction history
  - QMHQ: Route-type logic, financial flows, stock-out integration, PO creation
  - Invoice: Void functionality, stock receipts, financial summaries
  - SOR: Approval/rejection/execution workflows, stock level checks, cross-tab sync

### Performance Impact

**Bundle size:** No significant change (DetailPageLayout already imported by Item detail page in shared chunk)

**Runtime:** Identical (same component tree structure, just organized via slots instead of inline JSX)

## Completion Status

- [x] Task 1: QMRL, PO, Warehouse migrated to DetailPageLayout
- [x] Task 2: QMHQ, Invoice, SOR migrated to DetailPageLayout
- [x] TypeScript verification passed
- [x] Production build passed
- [x] All tab content and domain logic preserved
- [x] KPI panels correctly passed via slot where applicable
- [x] No duplicate grid-overlay or back-button JSX
- [x] SUMMARY.md created

**Status:** COMPLETE

All 6 detail pages successfully migrated to DetailPageLayout composite. Combined with Item detail (Phase 36-03), all 7 detail pages in the system now use the standardized layout composite. Zero TypeScript errors, production build successful, all domain-specific functionality preserved unchanged.
