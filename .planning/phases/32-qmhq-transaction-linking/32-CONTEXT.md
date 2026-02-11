# Phase 32: QMHQ Transaction Linking - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Link stock-out transactions to their parent QMHQ via qmhq_id FK propagation. When an admin approves a stock-out request linked to a QMHQ, the created inventory transaction gets qmhq_id populated. The QMHQ item detail page then displays those linked transactions. Manual stock-out requests (no QMHQ parent) create transactions with NULL qmhq_id.

</domain>

<decisions>
## Implementation Decisions

### Transaction grouping on Stock Out tab
- Group transactions by their parent Stock-Out Request (SOR)
- Each SOR group has a compact header: SOR ID + status badge + total qty from that SOR
- SOR group headers link to SOR detail page
- Groups are always expanded (no accordion/collapse interaction)
- Remove the standalone Stock-Out Request Card — SOR info now lives in the group headers

### Items Summary breakdown
- Full qty breakdown per item: Requested → Approved → Executed → Pending
- Display as a stepped progress bar visualization (funnel-style)
- Color-coded segments: gray=requested, blue=approved, green=executed
- Rejected items still appear in the Items Summary with a 'Rejected' badge (full transparency)

### Empty state behavior
- When no linked stock-out transactions exist, show empty state message with 'Request Stock-Out' CTA button
- SOR groups only appear once transactions exist (don't show pending/unapproved SORs without transactions)

### Claude's Discretion
- Exact progress bar segment widths and styling
- Transaction row columns and density within each SOR group
- How to handle the FK propagation mechanism (trigger vs application-level)
- Legacy transaction handling (existing transactions without qmhq_id)
- Navigation link styling between entities

</decisions>

<specifics>
## Specific Ideas

- SOR group header should be compact — let the transactions themselves carry the detail
- The stepped progress bar replaces the current simple fulfillment progress bar with richer stage visibility
- Full pipeline visibility: user should see everything (including rejected items) without leaving the QMHQ page

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-qmhq-transaction-linking*
*Context gathered: 2026-02-11*
