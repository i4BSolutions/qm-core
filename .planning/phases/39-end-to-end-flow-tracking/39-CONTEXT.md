# Phase 39: End-to-End Flow Tracking - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Build an admin-only flow tracking page that displays the complete downstream chain from QMRL through all linked entities (QMRL -> QMHQs -> POs -> Invoices -> Stock). This is a read-only visualization page. Admin searches by QMRL ID and sees the full chain. No editing, no new capabilities — just visibility into existing data relationships.

</domain>

<decisions>
## Implementation Decisions

### Chain Visualization
- Vertical timeline layout with top-to-bottom flow and connecting lines between nodes
- Branching handled with indented sub-timelines under parent nodes (e.g., multiple QMHQs indent under QMRL, multiple POs indent under QMHQ)
- Always fully expanded on load — no collapsible sections
- Clicking any node navigates to that entity's existing detail page (no inline previews)
- Each entity type has color-coded left border AND icon to distinguish node types
- QMHQ cards use different visual variants per route type (Item, Expense, PO) — distinct accent colors per route
- Stock-out request and execution combined into a single node (not separate)

### Search & Entry Point
- QMRL ID search only — single search box, exact match (no autocomplete/suggestions)
- Admin types full QMRL ID and hits enter to load the chain
- Empty state before search: clean page with search box and instructions ("Enter a QMRL ID to view its flow")
- Not-found case: inline error message below search box ("No QMRL found with this ID")

### Detail Density
- Each node shows: ID, status, all relevant dates, and all relevant people
- No financial amounts on nodes — admin clicks through to detail pages for that
- Dates: created date plus all entity-specific dates (e.g., PO delivery date, invoice due date)
- People: users shown with avatar + name; contact persons and suppliers shown as text names only (no avatars — only users have avatars in the system)
- QMRL root card: ID, title, status, dates, people (key fields, not full summary)
- QMHQ cards: ID, status, route type (via card variant), dates, people
- PO/Invoice cards: ID, status, dates, people (supplier as text name)
- Stock nodes: simple status indicator (Received/Pending/Executed)
- No summary section or aggregate stats at the top — the chain speaks for itself

### Status & Health Signals
- Use existing colored status badges from the app (same as list/detail pages) — no simplified indicators
- No warning icons or stalled/overdue alerts — admin interprets the chain
- Voided invoices and cancelled POs shown in the chain with strikethrough/faded styling (visible for audit trail)
- No overall flow status indicator — individual node statuses are sufficient

### Claude's Discretion
- Connector line style between nodes (solid, dashed, etc.)
- Specific color choices per entity type border
- Exact spacing and card sizing within the timeline
- How to handle very long chains (many QMHQs/POs) — scrolling behavior
- Loading state while chain data is fetched

</decisions>

<specifics>
## Specific Ideas

- Timeline should feel like a clear audit trail — admin can trace any QMRL's complete lifecycle at a glance
- Each entity type visually distinct so admin can quickly scan for a specific entity type in the chain
- QMHQ route type variants (Item/Expense/PO) should be immediately recognizable without reading text

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-end-to-end-flow-tracking*
*Context gathered: 2026-02-11*
