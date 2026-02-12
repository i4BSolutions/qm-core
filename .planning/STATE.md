# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current focus:** Phase 43 - PDF Export Infrastructure (in progress)

## Current Position

Phase: 43 of 43 (PDF Export Infrastructure - complete)
Plan: 3 of 3 complete (43-01 ✓, 43-02 ✓, 43-03 ✓)
Status: Phase 43 complete - all PDF documents implemented
Last activity: 2026-02-12 — Plan 43-02 complete (Invoice Receipt PDF)

Progress: [████████████████████████████████████████] 100% (110/~110 total plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 110 (across v1.0-v1.9)
- Total milestones: 9 shipped in 16 days (2026-01-27 → 2026-02-12)
- Phase 43 Plan 02: 1706 seconds, 2 tasks, 4 files (2 created, 2 modified, 1 deviation)
- Phase 43 Plan 03: 1390 seconds, 2 tasks, 8 files (5 created, 3 modified)
- Phase 43 Plan 01: 336 seconds, 2 tasks, 12 files (10 created, 2 modified)

**All Milestones:**
- v1.0 MVP: Phases 1-4, 8 plans (shipped 2026-01-27)
- v1.1 Enhancement: Phases 5-10, 17 plans (shipped 2026-01-28)
- v1.2 Inventory & Financial: Phases 11-16, 14 plans (shipped 2026-01-31)
- v1.3 UX & Bug Fixes: Phases 17-19, 11 plans (shipped 2026-02-02)
- v1.4 UX Enhancements: Phases 20-22, 9 plans (shipped 2026-02-06)
- v1.5 UX Polish: Phases 23-26, 9 plans (shipped 2026-02-09)
- v1.6 Stock-Out Approval: Phases 27-31, 12 plans (shipped 2026-02-10)
- v1.7 Logic Repair: Phases 32-35, 7 plans (shipped 2026-02-11)
- v1.8 UI/RBAC/Flow: Phases 36-40, 15 plans (shipped 2026-02-12)
- v1.9 PO Lifecycle & PDF Export: Phases 41-43, 9 plans (shipped 2026-02-12)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting v1.9:

- **43-02 Implementation**: Separate wrapper file (pdf-download-link-wrapper.tsx) for PDFDownloadLink fixes webpack ESM import error
- **43-03 Implementation**: Wrapper component pattern for all PDF buttons prevents webpack ESM bundling errors
- **43-03 Implementation**: Stock-Out PDF includes full approval chain audit trail (who approved/rejected, dates, reasons)
- **43-03 Implementation**: Money-Out PDF conditional on expense/po routes with transactions.length > 0
- **43-03 Implementation**: Calculate line_total = quantity * unit_price for Invoice PDF (not stored in database)
- **43-01 Implementation**: Dark theme colors (slate-900 bg, slate-50 text, amber accent) match app aesthetic
- **43-01 Implementation**: Simplified SVG logo (no text) to avoid TypeScript errors, easy to swap later
- **43-01 Implementation**: Dynamic import pattern (inner component + wrapper) prevents SSR canvas/fs errors
- **43-01 Implementation**: Courier font for amounts ensures monospace numerical alignment
- **42-03 Implementation**: Use po_line_items aggregate fields for matching tab (leverages DB-maintained invoiced_quantity/received_quantity)
- **42-03 Implementation**: Single table layout with variance columns (more scannable than side-by-side cards)
- **42-03 Implementation**: Separate invoice summary section with voided toggle (invoice-level data distinct from line-item matching)
- **42-02 Implementation**: Simple toast messages without cascade details (cleaner UX, data available in History tab)
- **42-02 Implementation**: Tooltip pattern follows Phase 35 convention (TooltipTrigger asChild > div > Button)
- **42-02 Implementation**: Progress bars inline in table column with stepped segment style
- **42-01 Implementation**: Skip DB-level closed-PO edit protection (UI layer + Server Action validation sufficient)
- **42-01 Implementation**: Fallback to 'partially_received' when unlocking fully-matched PO (allows admin corrections)
- **42-01 Implementation**: Keep detailed cascade data in Server Action returns (toast simplification in UI layer)
- **41-02 Implementation**: Use POStatusBadgeWithTooltip as separate component, preserve existing POStatusBadge unchanged
- **41-02 Implementation**: Integrate mini progress bar INTO Status column to reduce table columns from 7 to 6
- **41-02 Implementation**: Use can("delete", "purchase_orders") for admin-only cancellation check (maps to admin role in RBAC matrix)
- **41-02 Implementation**: Safety-net recompute logs to console.warn only, does NOT override DB status (database is authoritative)
- **41-01 Implementation**: Invoice-first priority in status calculation - show partially_invoiced until ALL items invoiced, even if some received
- **41-01 Implementation**: Use pg_advisory_xact_lock on PO UUID for status calculation to prevent concurrent calculation race conditions
- **41-01 Implementation**: Admin-only cancellation with mandatory reason for financial control
- **v1.9 Design**: Voided invoices do NOT block PO cancellation (only active non-voided invoices count)
- **v1.9 Design**: GRN PDF deferred to v2 (focus on Invoice, Stock-Out, Money-Out receipts)
- **v1.9 Stack**: Use @react-pdf/renderer (not Puppeteer) for PDF generation — lighter weight
- **v1.9 Architecture**: Sequential phases required (Status Engine → Guards → PDF) due to dependencies
- **v1.8**: 3-role RBAC (admin/qmrl/qmhq) simplifies permission model from 7 roles
- **v1.7**: Per-line-item stock-out execution (replaced whole-request atomic pattern)

### Pending Todos

None.

### Blockers/Concerns

**v1.9 Milestone Context:**
- Research completed (2026-02-12) with HIGH confidence across all areas
- Key patterns to follow:
  - Advisory locks for concurrent status calculation (migration 058 pattern)
  - Trigger prefix convention: aa_ (guards) → zz_ (auditors)
  - Guard-then-cascade trigger chain (migration 040-041 pattern)
  - Server Action cascade feedback (existing voidInvoice pattern)

**Known Tech Debt (carried forward):**
- PO Edit page does not exist at /po/[id]/edit (Edit button links to 404) — pre-existing from v1.3
- Context slider deferred for stock-out approval/execution pages (CSLR-02, CSLR-03)
- Flow tracking VIEW performance unknown at production scale (assumes <10K QMRLs)

## Session Continuity

Last session: 2026-02-12
Stopped at: Completed 43-02-PLAN.md (Invoice Receipt PDF) — Phase 43 complete, v1.9 milestone shipped
Resume file: None

---
*State initialized: 2026-01-27*
*Last updated: 2026-02-12 after completing Phase 43 Plan 02 (v1.9 complete)*
