# Phase 31: Context Sliders - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Right-side context sliders on stock-out request create page (when linked to QMHQ) and QMHQ create page. Sliders show QMRL and QMHQ details to give users context while working. Replaces the existing QmrlContextPanel on QMHQ create page.

**Scope reduction from ROADMAP.md:** Approval and execution page sliders deferred — this phase covers request create and QMHQ create only.

</domain>

<decisions>
## Implementation Decisions

### Slider content
- Full detail view for both QMRL and QMHQ — not summarized, show all fields
- Slider uses tabs for sub-sections (QMHQ lines, attachments, comments) — mini detail page feel
- QMHQ create slider shows QMRL data + sibling QMHQ lines (simple list: line name, route type, status badge)
- QMRL tab shows QMHQ lines count badge at the bottom
- Sibling QMHQ lines are view-only — no navigation links, keeps focus on create form

### Context chain depth
- Stock-out request create page shows both QMRL and QMHQ in tabs (QMRL | QMHQ)
- Slider only appears when stock-out request originates from QMHQ item route — manual requests have no slider
- QMHQ create page shows QMRL detail + sibling QMHQ list

### Slider interaction
- Push content layout — main form shrinks to make room, both visible simultaneously, no overlap
- Toggle via icon button in page header
- Default open on desktop each time page loads (no persistent state across navigations)
- Open by default on desktop, closed on mobile, toggleable

### Claude's Discretion
- Slider width (likely fixed ~400px or responsive percentage — pick based on content)
- Animation/transition style
- Mobile experience (bottom sheet vs overlay vs slide-from-right)
- Exact tab organization within slider content

</decisions>

<specifics>
## Specific Ideas

- Build the QMHQ create slider fresh — do NOT refactor the existing QmrlContextPanel (~640 lines). Retire the old panel.
- Consistent tab pattern: QMRL | QMHQ on stock-out pages; QMRL (with sibling list) on QMHQ create page

</specifics>

<deferred>
## Deferred Ideas

- Stock-out approval page slider — not in this phase
- Stock-out execution page slider — not in this phase
- Clickable sibling QMHQ navigation — view-only for now

</deferred>

---

*Phase: 31-context-sliders*
*Context gathered: 2026-02-10*
