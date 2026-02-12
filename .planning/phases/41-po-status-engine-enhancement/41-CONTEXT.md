# Phase 41: PO Status Engine Enhancement - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

PO status auto-calculates lifecycle position from invoice and stock-in events with database-level consistency guarantees. The 6 states are: not_started, partially_invoiced, awaiting_delivery, partially_received, closed, cancelled. This phase delivers the status engine, display, and recalculation infrastructure. Cancellation guards and lock mechanisms are Phase 42.

</domain>

<decisions>
## Implementation Decisions

### Status Display
- Status badge tooltip shows counts + percentages (e.g., "3/5 invoiced (60%), 1/5 received (20%)")
- PO list page includes mini progress bar under the status badge showing % invoiced and % received (dual track)
- Closed POs: dimmed row with reduced opacity + lock icon next to status badge
- Cancelled POs: strikethrough text on PO number + red "Cancelled" badge
- Status transitions logged in existing audit log (History tab), no separate timeline widget
- PO list filterable by computed status — Claude decides filter UI pattern (chips vs dropdown) based on existing app patterns

### Recalculation Triggers
- Dual approach: database triggers for consistency + recompute on page load as safety net
- Toast notification shown when status changes (e.g., "PO-2025-00012 status updated: Partially Invoiced")
- Badge visually highlights/pulses when status changes on the detail page
- Detailed cascade toast when invoice is voided (e.g., "Invoice voided. PO-2025-00012 status reverted: Partially Invoiced → Not Started (0/5 invoiced)")

### Cancelled State Behavior
- Cancellation requires a mandatory reason (text field in confirmation dialog)
- Cancellation is permanent — no undo, user must create new PO
- Only admin users can cancel POs
- When PO is cancelled, committed budget is immediately released back to QMHQ Balance in Hand, and the release is logged in QMHQ
- Cancelled POs excluded from Balance in Hand calculations

### Priority & Edge Cases
- Invoice takes priority: show "partially_invoiced" until ALL items invoiced, then switch to received-based states
- PO must have at least 1 line item to be created — no empty POs
- Stock-in qty per item capped at invoiced qty — strict invoice-first flow
- Closed status = fully matched: ordered qty = invoiced qty = received qty for ALL line items (3-way match)
- Over-invoicing blocked: system prevents invoice qty > remaining ordered qty
- Voided invoices excluded completely from status calculation — treated as if they never existed

### Claude's Discretion
- Color palette for the 6 PO status states
- PO detail page status display layout (header card vs inline badge)
- Cancel button placement (header vs actions dropdown)
- Storage model choice (regular column + triggers vs computed on read)
- Status filter UI pattern (consistent with existing app patterns)

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants "immediate release" of budget to QMHQ Balance in Hand on cancellation, with the release logged in QMHQ
- Invoice-first flow is strict: can't receive more than invoiced, can't invoice more than ordered
- The 3-way match for "closed" status (ordered = invoiced = received) is the definitive closing criteria

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-po-status-engine-enhancement*
*Context gathered: 2026-02-12*
