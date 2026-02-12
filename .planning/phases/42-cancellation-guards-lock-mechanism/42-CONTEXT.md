# Phase 42: Cancellation Guards & Lock Mechanism - Context

**Gathered:** 2026-02-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce financial integrity via cancellation guards and lock closed POs from editing. Includes: PO cancellation guards, invoice void guards, closed PO lock/unlock, per-line-item progress bars, and PO matching tab. Does NOT include new PDF export or new entity types.

</domain>

<decisions>
## Implementation Decisions

### Progress bars & matching tab
- Per-line-item progress bars go **inside the existing line items table** as a column (not a separate tab)
- **Stacked segments** style (like GitHub language bars) — ordered baseline, invoiced (blue), received (green)
- Follow the **ItemsSummaryProgress pattern** from QMHQ: stepped bar with fraction text header row (`3/5`) and full legend row with colored dots below each bar
- Match existing app color palette — Claude picks consistent colors for invoiced/received/remaining
- Voided invoices **hidden by default** in matching tab, with toggle to reveal them
- Matching tab layout: **Claude's discretion** — pick best approach for clarity and scannability
- Mismatch highlighting (under-invoiced/under-received): **Claude's discretion** — pick what works for quick scanning

### Cancellation & void guards
- **Pre-check approach**: Cancel/Void buttons are **disabled** when dependencies exist (no error dialogs needed)
- Disabled button **tooltip shows reason only** (e.g., "Cannot cancel — has active invoices") without specific counts
- PO cancel reason: **free text** textarea (admin types their own reason)
- Invoice void reason: **free text** textarea (user types their own reason)
- No extra warning when voiding the only invoice on a PO — status engine handles the cascade silently

### Read-only terminal states
- **Cancelled POs** are read-only (no editing allowed)
- **Voided invoices** are read-only (no editing allowed)
- **Closed POs** are read-only (except admin unlock)

### Cascade & error feedback
- **Simple toast** for user actions (e.g., "Invoice voided successfully", "PO cancelled")
- **No detailed cascade info in toast** — cascade effects recorded as **history/audit log entries** on the affected entities (PO history, QMHQ history)
- Balance in Hand updates silently — no visual flash or badge, just the number changes
- Same pattern for PO cancellation cascade and invoice void cascade
- User-initiated vs system-triggered history log distinction: **Claude's discretion** based on existing audit patterns

### Claude's Discretion
- Matching tab layout design (single table vs side-by-side)
- Mismatch highlighting approach (subtle row highlight vs bold variance column)
- Closed PO lock visual appearance and admin unlock button placement
- Confirmation dialog design for cancel/void flows
- History log labeling (user action vs system trigger)
- Progress bar exact color values (must match app palette)

</decisions>

<specifics>
## Specific Ideas

- Progress bars should follow the **exact same pattern** as `components/qmhq/items-summary-progress.tsx` — stepped bar with header row (fraction text) and legend row (colored dots)
- For PO, the segments are: Ordered (gray baseline), Invoiced (blue), Received (green) — analogous to QMHQ's Requested/Approved/Executed
- Keep consistency with existing `FulfillmentProgressBar` and `ItemsSummaryProgress` components

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-cancellation-guards-lock-mechanism*
*Context gathered: 2026-02-12*
