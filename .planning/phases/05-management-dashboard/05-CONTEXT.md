# Phase 5: Management Dashboard - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Real-time visibility dashboard for Admin and Quartermaster roles. Displays QMRL/QMHQ status counts, low stock alerts, audit log entries, and stock movements. Non-management roles redirect to their primary workflow page.

</domain>

<decisions>
## Implementation Decisions

### Layout & organization
- Grid layout: KPI cards row at top, 2-column grid below
- KPI row: 2 large cards (QMRL, QMHQ with status breakdown) + 2 small cards (alerts, activity)
- Below KPI: Alerts in left column, Activity in right column
- Auto-refresh every 60 seconds with per-section "last updated" timestamps
- Personalized greeting header: "Good morning, [Name]" with today's date
- KPI cards are clickable — navigate to filtered list views
- Linear-style card design: clean, minimal, subtle shadows

### Status visualization
- Stacked horizontal bars showing to_do | in_progress | done proportions
- Semantic colors: Gray (to_do), Blue (in_progress), Green (done)
- Groups only (3 segments), not individual statuses
- Hover tooltip shows count and percentage: "In Progress: 12 (25%)"
- Clicking a segment filters to that status group (e.g., /qmrl?status_group=in_progress)
- Small inline legend below bar: ● To Do ● In Progress ● Done
- Zero-count segments still shown (thin/outlined) for visual consistency

### Alert presentation
- List with warning badges (one row per item)
- Two severity levels: Warning (5-10 units) amber, Critical (0-4 units) red
- Zero-stock items get distinct "Out of Stock" badge (separate from Critical)
- Sorted by severity (critical first), then alphabetically
- Each row shows: item name • warehouse • stock count
- Section header with count badge: "Low Stock Alerts (3)" — badge turns red if any critical
- Show top 5 items, then "View all X items" link
- Clicking alert row navigates to item detail page (/item/[id])
- "View all" goes to filtered inventory page (/inventory?filter=low_stock)
- Alerts always persist until stock replenished (not dismissible)
- Empty state: "✓ All items well stocked" with green checkmark

### Activity feed design
- Two separate sections: "Recent Activity" (audit) and "Stock Movements"
- Both use timeline style with vertical line, icons per action type, user avatar
- Audit entries show: user + action + entity + human-readable summary
- Stock movements use same timeline style for visual consistency
- In/Out distinguished by colored icons (green up arrow, red down arrow)

### Claude's Discretion
- Total count display styling on KPI cards (hero number vs inline)
- Small KPI card content (count only vs count + mini preview)
- Visual distinction between QMRL and QMHQ cards (identical vs subtle tint)
- Exact refresh timestamp placement and styling
- Number of items to show in activity sections before "View more"

</decisions>

<specifics>
## Specific Ideas

- Cards should feel like Linear's — clean, not cluttered
- Stacked bars provide at-a-glance proportions without needing to read numbers
- Per-section timestamps rather than single global timestamp

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-management-dashboard*
*Context gathered: 2026-01-28*
