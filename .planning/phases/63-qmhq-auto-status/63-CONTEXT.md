# Phase 63: QMHQ Auto Status - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Every QMHQ record exposes a computed status derived from its route type and child record state. Item route reflects SOR progress, Expense route reflects money-in and yet-to-receive, PO route reflects PO existence and financial closure. Nine states total: {Route} × {Pending/Processing/Done}.

</domain>

<decisions>
## Implementation Decisions

### Manual status coexistence
- Auto status coexists alongside the existing manual status (status_id from status_config)
- Manual status remains for user-driven workflow tracking — not replaced or hidden
- Auto status is a separate computed value shown on **detail pages only** — not on list views
- All users who can view a QMHQ detail page see the auto status (no role restriction)

### Status labels
- Keep the "Route Level" naming: Item Pending, Item Processing, Item Done, Expense Pending, Expense Processing, Expense Done, PO Pending, PO Processing, PO Done
- Consistent colors across all route types: Pending = amber, Processing = blue, Done = green
- Badge includes route type icon + text label (e.g., [box icon] Item Pending, [dollar icon] Expense Processing, [file icon] PO Done)
- Every QMHQ always has a route type — no empty/unassigned state needed

### Claude's Discretion
- Detail page placement of auto status badge relative to manual status
- Exact icon choices for each route type
- Computation approach (VIEW, trigger, or on-the-fly)
- Badge component styling details

</decisions>

<specifics>
## Specific Ideas

- User wants icons and colors to make auto status visually clear at a glance
- Route type icons should differentiate Item/Expense/PO visually even before reading the label

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 63-qmhq-auto-status*
*Context gathered: 2026-02-21*
