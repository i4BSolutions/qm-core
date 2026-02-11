# Phase 35: Per-Line-Item Execution UI - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Each approved stock-out line item can be executed independently from the approval detail page. Replaces the current whole-request execution pattern. QMHQ item detail shows fulfillment metrics (requested, approved, rejected, executed quantities). One QMHQ maps to one SOR (1:1 relationship for now).

</domain>

<decisions>
## Implementation Decisions

### Execute button placement
- Action column in the line items table on the approval detail page
- Approval detail page only — no execution from request detail page
- Individual execution only — no "Execute All" bulk action
- Confirmation dialog required before execution (shows item name, qty, source warehouse)
- Remove the existing request-level Execute button entirely (clean break)
- Button states: green "Execute" for pending, gray "Executed" badge for completed, red "Rejected" badge for rejected items

### Execution feedback
- Optimistic update + success toast after confirmation
- Rolls back on error
- Client-side pre-check: disable Execute button when insufficient stock, with tooltip showing available vs needed qty
- Server-side validation as safety net (advisory locks from Phase 34)
- Execution cannot proceed when stock is insufficient — button disabled, not error after the fact
- After successful execution, auto-refresh parent request status on the same page

### QMHQ qty metrics display
- Dedicated "Fulfillment" section on QMHQ item detail page
- Position: below item details, above SOR transaction groups
- Numbers only display: Requested | Approved | Rejected | Executed (no progress bar)
- Metrics come from the single linked SOR (1:1 QMHQ-to-SOR relationship)
- When no SOR linked: show empty state message ("No stock-out request linked")
- Cross-page refresh: if QMHQ detail is open and execution happens on approval page, metrics update via cross-tab sync

### Partial fulfillment states
- Color-coded status badges per line item row (green/blue/red) — no summary banner
- New "Partially Fulfilled" status for requests when some but not all line items are executed
- Partially Fulfilled badge color: Claude's discretion (based on existing palette)
- Auto-mark approval as "Fulfilled" when all line items are executed (follows Phase 29 computed status pattern)

### Claude's Discretion
- Partially Fulfilled badge color selection
- Exact confirmation dialog layout and styling
- Stock availability tooltip content formatting
- Cross-tab sync implementation approach (BroadcastChannel exists from Phase 22)

</decisions>

<specifics>
## Specific Ideas

- Execute button disabled (not hidden) when stock insufficient — user should see the button exists but understand why they can't click it
- Confirmation dialog is minimal: item name, quantity, warehouse — no extra detail
- Status computation follows the Phase 29 pattern (trigger computes parent status from child line items)
- Cross-page refresh follows Phase 22 BroadcastChannel pattern for multi-tab sync

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-per-line-item-execution-ui*
*Context gathered: 2026-02-11*
