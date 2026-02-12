# Phase 43 Plan 03: Stock-Out & Money-Out PDF Documents - Summary

**One-liner:** Built Stock-Out Receipt PDF with approval audit trail and Money-Out Receipt PDF with dual-currency transaction tracking, plus SSR-safe wrapper components for all three PDF types (Invoice, Stock-Out, Money-Out).

---

## Metadata

```yaml
phase: 43-pdf-export-infrastructure
plan: 03
subsystem: pdf-generation
tags: [pdf, stock-out-receipt, money-out-receipt, dual-currency, approval-audit, ssr-fix]

dependency_graph:
  requires:
    - "Phase 43 Plan 01 (PDF infrastructure)"
  provides:
    - "Stock-Out Receipt PDF with approval chain audit trail"
    - "Money-Out Receipt PDF with dual currency and transaction totals"
    - "SSR-safe wrapper pattern for all PDF downloads"
  affects:
    - "SOR detail page (/inventory/stock-out-requests/[id])"
    - "QMHQ detail page (/qmhq/[id])"
    - "Invoice detail page (/invoice/[id])"

tech_stack:
  added: []
  patterns:
    - "PDF button wrapper components prevent webpack ESM bundling errors"
    - "Wrapper components isolate @react-pdf/renderer imports to client-only code"
    - "Consistent pattern across Invoice, Stock-Out, and Money-Out PDFs"

key_files:
  created:
    - "lib/pdf/documents/stock-out-pdf.tsx"
    - "lib/pdf/documents/money-out-pdf.tsx"
    - "components/stock-out-requests/stock-out-pdf-button.tsx"
    - "components/qmhq/money-out-pdf-button.tsx"
    - "components/invoice/invoice-pdf-button.tsx"
  modified:
    - "app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx"
    - "app/(dashboard)/qmhq/[id]/page.tsx"
    - "app/(dashboard)/invoice/[id]/page.tsx"

decisions:
  - id: "approval-audit-trail"
    summary: "Stock-Out PDF includes full approval history with who approved/rejected, quantities, dates, and rejection reasons"
    rationale: "Critical audit requirement per user decision - approvals are the authoritative record, not just final execution"
  - id: "money-out-dual-currency"
    summary: "Money-Out PDF displays all transactions with original currency + EUSD, summary totals in EUSD only"
    rationale: "EUSD is the normalized comparison unit, but original currency needed for transaction verification"
  - id: "wrapper-component-pattern"
    summary: "All PDF downloads use dedicated wrapper components (e.g., StockOutPDFButton) instead of direct imports"
    rationale: "Prevents webpack ESM bundling errors when @react-pdf/renderer is imported in Next.js server components"
  - id: "conditional-money-out-button"
    summary: "Money-Out PDF button only appears for expense/po routes with transactions.length > 0"
    rationale: "Item route has no financial transactions; empty PDFs provide no value"
  - id: "invoice-line-total-calculation"
    summary: "Calculate line_total = quantity * unit_price (not stored in database)"
    rationale: "Database stores primitives only; totals are computed values"

metrics:
  duration_seconds: 1390
  tasks_completed: 2
  files_created: 5
  files_modified: 3
  commits: 3
  completed_at: "2026-02-12T19:22:12Z"
```

---

## Objective

Build the Stock-Out Receipt PDF and Money-Out Receipt PDF documents, and integrate Download PDF buttons into the SOR detail page and QMHQ detail page respectively.

---

## Tasks Completed

### Task 1: Create Stock-Out Receipt PDF and integrate into SOR detail page

**Status:** ✓ Complete
**Commit:** `e98475b`

**What was done:**

**Part A: Create StockOutPDF component**
- Created `lib/pdf/documents/stock-out-pdf.tsx` with three main sections:
  1. **Request Summary:** Requester, reason (formatted label), created date, QMHQ reference, notes
  2. **Line Items Table:** 6 columns (index, item name/SKU, requested qty, approved qty, rejected qty, status)
     - Status column uses color-coded text: approved=emerald, rejected=red, pending=amber, executed=emerald, cancelled=slate
  3. **Approval History (Audit Trail):** Full approval chain with card-like blocks per approval
     - Shows approval number, decision badge (Approved/Rejected), item name/SKU, quantity
     - "Decided by" user and formatted date
     - Rejection reasons displayed in red when applicable
     - Critical for audit compliance per user decision
- Mapped status values: pending, partially_approved, approved, rejected, cancelled, partially_executed, executed
- Mapped reason values: request, consumption, damage, lost, transfer, adjustment
- Used PDFTable component for line items, manual card layout for approval chain

**Part B: Create wrapper component and integrate**
- Created `components/stock-out-requests/stock-out-pdf-button.tsx`:
  - Wraps StockOutPDF document in PDFDownloadButton
  - Prevents SSR issues by isolating @react-pdf/renderer imports
  - Filename format: `StockOut_${request.request_number}_${YYYY-MM-DD}.pdf`
- Updated `/inventory/stock-out-requests/[id]/page.tsx`:
  - Added StockOutPDFButton import
  - Integrated button in `actions` prop BEFORE Cancel button
  - Button appears for ALL request statuses (per user decision about voided docs)
  - Maps lineItems and approvals data to PDF props

**Files created:**
- lib/pdf/documents/stock-out-pdf.tsx
- components/stock-out-requests/stock-out-pdf-button.tsx

**Files modified:**
- app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx

**Verification:**
- ✓ TypeScript compilation passes
- ✓ Files exist
- ✓ StockOutPDF uses darkThemeStyles.tableCell (not cellText)
- ✓ Approval chain renders as separate card blocks with decision badges

---

### Task 2: Create Money-Out Receipt PDF and integrate into QMHQ detail page

**Status:** ✓ Complete
**Commit:** `4909654`

**What was done:**

**Part A: Create MoneyOutPDF component**
- Created `lib/pdf/documents/money-out-pdf.tsx` with three main sections:
  1. **QMHQ Context:** Request ID (mono), line name (bold), route type badge, category
     - Parent QMRL reference: "QMRL-XXXX - {title}"
     - QMHQ Amount with dual currency display (e.g., "1,000,000 MMK / 500.00 EUSD")
     - Exchange rate display
  2. **Financial Transactions Table:** 7 columns
     - Transaction ID (mono, 15%), Type (Money In/Out with color, 12%), Amount (original currency, 18%)
     - EUSD (15%), Rate (mono, 10%), Date (15%), By (created_by_name, 15%)
     - Money In displayed in emerald (#10B981), Money Out in amber (#F59E0B)
  3. **Summary Section:** Totals in EUSD
     - Total Money In (emerald)
     - Total Money Out (amber)
     - Net Balance (emerald if positive, red if negative)
  4. **Notes Section:** Conditional rendering if qmhq.notes exists
- Route type mapping: expense → "Expense", po → "Purchase Order", item → "Item Request"
- formatAmount helper for comma-separated 2-decimal amounts

**Part B: Create wrapper component and integrate**
- Created `components/qmhq/money-out-pdf-button.tsx`:
  - Wraps MoneyOutPDF document in PDFDownloadButton
  - Filename format: `MoneyOut_${qmhq.request_id}_${YYYY-MM-DD}.pdf`
- Updated `/qmhq/[id]/page.tsx`:
  - Added MoneyOutPDFButton import
  - Integrated button in `actions` prop AFTER Edit button
  - **Conditional rendering:** Only appears for `(route_type === "expense" || route_type === "po") && transactions.length > 0`
  - Maps qmhq, transactions, and parentQmrl data to PDF props
  - Fixed type errors: used `?? undefined` for nullable fields (status_name, status_color, category_name, notes)

**Files created:**
- lib/pdf/documents/money-out-pdf.tsx
- components/qmhq/money-out-pdf-button.tsx

**Files modified:**
- app/(dashboard)/qmhq/[id]/page.tsx

**Verification:**
- ✓ TypeScript compilation passes
- ✓ Files exist
- ✓ Button only renders for expense/po routes with transactions
- ✓ Item route QMHQs do not show button (correct - no money-out transactions)
- ✓ Null coalescing handles optional fields correctly

---

### Bonus Task: Refactor Invoice PDF to use wrapper pattern

**Status:** ✓ Complete
**Commit:** `c936a09`

**What was done:**
- Discovered invoice detail page was directly importing InvoicePDF and PDFDownloadButton, causing webpack ESM bundling errors
- Created `components/invoice/invoice-pdf-button.tsx`:
  - Wraps InvoicePDF document in PDFDownloadButton
  - Calculates line_total = quantity * unit_price (not stored in database)
  - Calculates line_total_eusd = line_total / exchange_rate
  - Filename format: `Invoice_${invoice.invoice_number}_${YYYY-MM-DD}.pdf`
- Updated `/invoice/[id]/page.tsx`:
  - Replaced direct InvoicePDF/PDFDownloadButton imports with InvoicePDFButton
  - Removed unused date-fns import
  - Inline calculation of line totals in map function
- Consistent pattern across all three PDF types (Invoice, Stock-Out, Money-Out)

**Files created:**
- components/invoice/invoice-pdf-button.tsx

**Files modified:**
- app/(dashboard)/invoice/[id]/page.tsx

**Verification:**
- ✓ TypeScript compilation passes
- ✓ Fixes webpack "ESM packages (@react-pdf/renderer) need to be imported" error
- ✓ All three PDF types now use wrapper component pattern

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Webpack ESM bundling error for Invoice PDF**
- **Found during:** Task 1 initial build verification
- **Issue:** Invoice detail page directly imported InvoicePDF component, causing webpack to try bundling @react-pdf/renderer as ESM module
- **Fix:** Created InvoicePDFButton wrapper component following same pattern as Stock-Out and Money-Out PDFs
- **Files modified:** components/invoice/invoice-pdf-button.tsx (created), app/(dashboard)/invoice/[id]/page.tsx
- **Commit:** c936a09

**2. [Rule 1 - Bug] Missing line_total calculation for Invoice PDF**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** InvoiceLineItem database type doesn't include line_total or line_total_eusd (computed values)
- **Fix:** Calculate inline: `line_total = quantity * unit_price`, `line_total_eusd = line_total / exchange_rate`
- **Files modified:** app/(dashboard)/invoice/[id]/page.tsx
- **Commit:** c936a09

**3. [Rule 1 - Bug] TypeScript style property error (cellText doesn't exist)**
- **Found during:** Task 1 TypeScript compilation
- **Issue:** Stock-Out PDF used `darkThemeStyles.cellText` which doesn't exist in darkThemeStyles StyleSheet
- **Fix:** Replace all instances with `darkThemeStyles.tableCell` (correct style name from plan 01)
- **Files modified:** lib/pdf/documents/stock-out-pdf.tsx
- **Commit:** e98475b

**4. [Rule 1 - Bug] Type mismatch for nullable fields in QMHQ**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** qmhq.status?.color is `string | null | undefined` but MoneyOutPDFProps expects `string | undefined`
- **Fix:** Use nullish coalescing `?? undefined` for status_name, status_color, category_name, notes
- **Files modified:** app/(dashboard)/qmhq/[id]/page.tsx
- **Commit:** 4909654

---

## Verification Results

All verification criteria from plan passed:

### Stock-Out PDF (Task 1)
1. ✓ Files exist: `lib/pdf/documents/stock-out-pdf.tsx`, `components/stock-out-requests/stock-out-pdf-button.tsx`
2. ✓ TypeScript compilation succeeds
3. ✓ SOR detail page imports StockOutPDFButton
4. ✓ Download PDF button appears in actions (before Cancel button)
5. ✓ PDF content: request summary, line items table with 6 columns, approval chain with decision badges
6. ✓ Approval history shows: approval number, item, quantity, decided by, date, rejection reason (if rejected)
7. ✓ Filename format: `StockOut_SOR-XXXX-XXXXX_YYYY-MM-DD.pdf`

### Money-Out PDF (Task 2)
1. ✓ Files exist: `lib/pdf/documents/money-out-pdf.tsx`, `components/qmhq/money-out-pdf-button.tsx`
2. ✓ TypeScript compilation succeeds
3. ✓ QMHQ detail page imports MoneyOutPDFButton
4. ✓ Download PDF button appears for expense/po routes with transactions (after Edit button)
5. ✓ Button does NOT appear for item route (correct - no financial transactions)
6. ✓ PDF content: QMHQ context, parent QMRL reference, transactions table with 7 columns, totals summary
7. ✓ Dual currency display: original currency + EUSD for each transaction
8. ✓ Summary shows: Total Money In, Total Money Out, Net Balance (all in EUSD)
9. ✓ Filename format: `MoneyOut_QMHQ-XXXX-XXXXX_YYYY-MM-DD.pdf`

### General
1. ✓ All PDFs use dark theme (slate-900 bg, slate-50 text, amber accent)
2. ✓ All PDFs include footer with timestamp and page numbers (from PDFTemplate)
3. ✓ Company branding (placeholder logo) present in header
4. ✓ Wrapper component pattern prevents SSR errors across all three PDF types

---

## Success Criteria

All success criteria met:

- ✓ **PDF-02 satisfied:** User can download SOR-based Stock-Out Receipt PDF from SOR detail page
- ✓ **PDF-03 satisfied:** User can download Money-Out Receipt PDF from QMHQ money-out transaction detail
- ✓ **PDF-04 fully satisfied:** Both new PDFs match dark theme app styling (slate/amber palette)
- ✓ **PDF-05 fully satisfied:** Both PDFs include company branding and export timestamp (via PDFTemplate)
- ✓ Stock-Out PDF includes full approval chain per user decision (critical audit trail)
- ✓ Money-Out PDF includes parent QMHQ context per user decision (traceability to parent QMRL)
- ✓ All three PDF types (Invoice, Stock-Out, Money-Out) use consistent wrapper pattern
- ✓ No SSR/webpack errors during build

---

## Technical Notes

### Wrapper Component Pattern

The critical pattern for preventing webpack ESM bundling errors:

```typescript
// components/{entity}/{entity}-pdf-button.tsx
"use client";

import { PDFDownloadButton } from "@/components/pdf-export/pdf-download-button";
import { EntityPDF } from "@/lib/pdf/documents/entity-pdf";

export function EntityPDFButton({ data }: Props) {
  return (
    <PDFDownloadButton
      document={<EntityPDF {...data} />}
      fileName={`Entity_${id}_${date}.pdf`}
    />
  );
}
```

This isolates @react-pdf/renderer imports to client-side only code, preventing Next.js from attempting to bundle it during SSR.

### Stock-Out Approval Audit Trail

The approval history section provides critical audit compliance:
- Each approval rendered as separate card with border
- Decision badge with color (approved=emerald, rejected=red)
- Full context: approval number, item, quantity, decided by user, date
- Rejection reasons displayed prominently when present
- Chronological ordering (newest first per database query)

### Money-Out Dual Currency

All transactions displayed with both currencies:
- Original currency amount (as recorded)
- EUSD equivalent (for comparison)
- Summary totals in EUSD only (normalized comparison unit)
- Exchange rate shown in QMHQ context and per transaction

### Status/Reason Label Mapping

Stock-Out PDF maps database enums to human-readable labels:
```typescript
REQUEST_STATUS_LABELS: { pending: "Pending", approved: "Approved", ... }
REASON_LABELS: { request: "Fulfillment Request", damage: "Damaged Goods", ... }
```

Money-Out PDF maps route types:
```typescript
ROUTE_TYPE_LABELS: { expense: "Expense", po: "Purchase Order", item: "Item Request" }
```

---

## Next Steps

**Immediate (Phase 43 complete):**
- All three PDF document types now implemented (Invoice, Stock-Out, Money-Out)
- PDF export infrastructure complete for v1.9 milestone
- GRN PDF deferred to v2 per milestone decision

**Future enhancements (v2+):**
- Add Goods Receipt Note (GRN) PDF for completed inventory_in transactions
- Support custom logo upload (replace placeholder SVG)
- Add PDF email attachment functionality
- Implement batch PDF generation for multiple entities

---

## Self-Check: PASSED

**Files created verification:**
```bash
✓ FOUND: lib/pdf/documents/stock-out-pdf.tsx
✓ FOUND: lib/pdf/documents/money-out-pdf.tsx
✓ FOUND: components/stock-out-requests/stock-out-pdf-button.tsx
✓ FOUND: components/qmhq/money-out-pdf-button.tsx
✓ FOUND: components/invoice/invoice-pdf-button.tsx
```

**Commits verification:**
```bash
✓ FOUND: e98475b (Task 1 - Stock-Out PDF)
✓ FOUND: 4909654 (Task 2 - Money-Out PDF)
✓ FOUND: c936a09 (Bonus - Invoice PDF wrapper)
```

**TypeScript compilation:**
```bash
✓ npx tsc --noEmit passes (excluding missing .next files)
✓ No errors in stock-out-pdf.tsx
✓ No errors in money-out-pdf.tsx
✓ No errors in page integrations
```

All claims verified. Phase 43 PDF Export Infrastructure complete.
