# Phase 43: PDF Export Infrastructure - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate professional PDF receipts for invoices, stock-out requests, and QMHQ money-out transactions. Three document types, shared template, downloadable from detail pages. Uses @react-pdf/renderer (not Puppeteer).

</domain>

<decisions>
## Implementation Decisions

### PDF Layout & Branding
- Logo + company name in header (use dummy placeholder logo for now — user will provide real logo later)
- Match app theme aesthetic (dark tactical/military style — not traditional white-background invoice)
- A4 portrait paper size
- Footer: "QM System | Generated on: YYYY-MM-DD HH:MM | Page X of Y"

### Financial Display
- Dual display always: every amount shows original currency AND EUSD equivalent (e.g., 500,000 MMK / 250.00 EUSD)
- Exchange rate shown in header area alongside document info
- Money-Out: show original amount and EUSD amounts, no calculation breakdown

### Line Item Tables
- Full detail: item name, SKU, qty, unit price, line total, received qty (where applicable)
- Notes section included conditionally (only when record has notes)

### Status Display
- Prominent status badge/label near document number (e.g., COMPLETED, VOIDED)
- Voided documents: status badge only, no diagonal watermark
- No blocking of PDF export for voided documents

### Progress Summary
- Include received progress summary section on Invoice PDFs (ordered vs invoiced vs received quantities)

### Supplier/Contact Info
- Full supplier block on Invoice PDFs: company name, contact person, email, phone

### Shared Template Architecture
- All 3 PDF types share the same visual template (header, footer, styling)
- Content sections vary per document type
- No per-type accent colors — unified styling

### Invoice PDF Specifics
- Include full PO summary: PO number, supplier, PO total, and how much of the PO this invoice covers

### Stock-Out Receipt Specifics
- SOR-level summary: group by SOR number, show all line items with warehouse, quantities, approval status
- Full approval chain: who requested, who approved, approval date (audit trail)

### Money-Out Receipt Specifics
- Include full parent QMHQ context: request ID, line name, and the financial transaction details

### Export UX
- "Download PDF" button on each detail page (in actions area beside Void/Edit buttons)
- Direct download — no preview modal, immediate browser download on click
- Filename format: `Type_NUMBER_YYYY-MM-DD.pdf` (e.g., `Invoice_INV-2026-00001_2026-02-12.pdf`)
- Toast notification: "Generating PDF..." during generation, then auto-download when ready
- No signature lines on any document type

### Claude's Discretion
- Exact spacing, typography, and dark theme color values
- Table column widths and alignment
- How progress summary is visually presented (bar vs numbers vs table)
- Dummy logo design/placeholder
- Loading/error edge cases

</decisions>

<specifics>
## Specific Ideas

- Dark theme matching the app's tactical/military aesthetic — not a standard white-background business document
- Logo is a placeholder for now; user will provide the real logo later (keep it easy to swap)
- Stock-out approval chain is important for audit purposes
- EUSD must always be visible alongside original currency amounts

</specifics>

<deferred>
## Deferred Ideas

- GRN (Goods Received Note) PDF — noted in v1.9 research as deferred to v2
- Admin-configurable logo upload via settings page — future enhancement
- Batch PDF export (export multiple documents at once) — not in scope

</deferred>

---

*Phase: 43-pdf-export-infrastructure*
*Context gathered: 2026-02-12*
