# Phase 56: List View Standardization - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardize all 6 major list pages (QMRL, QMHQ, PO, Invoice, Items, Stock-out) with consistent columns, a shared pagination component, an assigned person filter, and a card/list toggle. UserAvatar chips appear next to assigned person names. All pages share the same toolbar layout for search, filters, and view toggle.

</domain>

<decisions>
## Implementation Decisions

### Column design & density
- Text overflow: truncate with ellipsis (single line, compact rows)
- Row density: comfortable (medium padding, standard text)
- Status display: colored badge pills (colored background, white text)
- Financial amounts: follow per-page roadmap spec (QMHQ/PO/Invoice show amounts, QMRL/Items do not)
- Row click: whole row clickable to navigate to detail page
- Assigned person in list rows: avatar only (name on hover tooltip) — compact
- Responsive: auto-switch to card view below tablet breakpoint (no horizontal scroll)

### Card/list toggle
- Default view: card view on all pages (including QMRL — gets card + list toggle for full consistency)
- No persistence: always resets to card default on page load
- Toggle position: right side of toolbar, icon toggle

### Pagination style
- Reuse existing `components/ui/pagination.tsx` component across all pages (numbered pages with ellipsis, first/prev/next/last buttons, "Showing X to Y of Z items", page size selector)
- Make pagination URL-driven (?page=N&pageSize=N) — bookmarkable, back button works
- Show total count: "Showing X to Y of Z items"
- Page size: Claude's discretion on default (existing component has 10/20/50/100 options)

### Assigned person filter
- Single select dropdown (one person at a time)
- Dropdown shows avatar + name for each option
- Position: after status filter (Search | Status | Assigned Person | Category | ... | Toggle)
- No "Assigned to me" shortcut button — current user appears in dropdown like everyone else
- Changing any filter resets page to 1

### Toolbar consistency
- Every list page follows the same layout: Search (left, fixed width) | Filter dropdowns (middle) | Card/list toggle (right)
- Search bar: fixed width, same position on every page
- Responsive: filters collapse into a "Filters" button on narrow screens (mobile/tablet)
- Active filter chips below toolbar: Claude's discretion

### Claude's Discretion
- Column widths (fixed vs flex with min/max — decide per column type)
- Default page size
- Active filter chip display below toolbar
- Exact breakpoint for auto-switch to card view
- Exact breakpoint for filter collapse to button

</decisions>

<specifics>
## Specific Ideas

- Existing Pagination component at `components/ui/pagination.tsx` already has the right visual style — reuse and extend with URL sync
- QMRL currently has pagination with default pageSize=20 — extend this pattern to all pages
- Avatar-only columns are compact; tooltip on hover reveals name

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 56-list-view-standardization*
*Context gathered: 2026-02-17*
