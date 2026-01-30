# Phase 12: Invoice Void Cascade - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Voiding invoices automatically updates all dependent financial and status calculations — PO status, Balance in Hand, and invoiced quantities. The cascade happens atomically with full audit trail.

</domain>

<decisions>
## Implementation Decisions

### Confirmation Flow
- Simple confirmation dialog (no cascade preview)
- Void reason is required (any non-empty text)
- Admin-only permission to void invoices
- Standard "Are you sure?" with reason input field

### Cascade Feedback
- Immediate inline update after void (no page refresh)
- Detailed success toast: "Invoice voided. PO status updated to X. Balance in Hand +Y."
- Voided invoices visible in list with grey text, strikethrough, and "Voided" badge
- On PO detail page, voided invoices appear in Invoices tab with voided styling
- Brief loading state on related views during cascade (disable invoice creation momentarily)
- Void is permanent — no restore/unvoid capability

### Audit Trail Display
- Single grouped audit entry for cascade (not separate entries)
- Entry appears in both Invoice and PO history tabs
- Before/after values shown (e.g., PO Status: partially_invoiced → not_started)
- Expandable entries — summary visible, click to expand full cascade details
- Audit scope limited to Invoice and PO — not propagated to QMHQ history
- Red/warning styling with distinct icon for void-related entries

### Partial Failure Handling
- Full rollback on any cascade failure — invoice remains not voided
- Simple error message: "Unable to void invoice. Please try again or contact admin."
- Failed attempts logged to system logs (not audit trail)
- Manual retry only — user clicks void button again

### Claude's Discretion
- Void info placement on invoice detail page (banner vs badge)
- Void reason placement in audit (summary vs expanded view)
- Attribution display format (user name + timestamp)

</decisions>

<specifics>
## Specific Ideas

- Toast should show concrete numbers: "Balance in Hand +1,500 EUSD"
- Voided invoice rows should be clearly distinguishable at a glance
- Keep it simple — no complex multi-step confirmation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-invoice-void-cascade*
*Context gathered: 2026-01-31*
