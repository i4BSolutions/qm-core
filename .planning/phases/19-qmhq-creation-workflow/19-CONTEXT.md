# Phase 19: QMHQ Creation Workflow Enhancement - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Display QMRL context in a side panel during QMHQ creation so users can reference the source request without switching tabs or remembering details. The panel shows QMRL information and existing QMHQ lines, supports collapse/expand, and adapts to mobile with a slide-in drawer.

</domain>

<decisions>
## Implementation Decisions

### Panel Layout
- Position: Right side of form (QMRL context on right, form on left)
- Width: Claude's discretion (pick appropriate width based on content)
- Responsive: Hide panel on smaller screens, show toggle button to open
- Mobile: Slide-in drawer from right when toggled open

### QMRL Content Display
- Show all major QMRL fields:
  - Core info: ID, title, status, category, priority, request date
  - Description & notes (truncate with "Show more" after 3-4 lines)
  - Department & contact person details
  - Attachments with thumbnails (clickable for preview)
- Show existing QMHQ count/list under this QMRL (helps avoid duplicates)
- Attachments open in preview modal (same behavior as detail page)

### Panel Interactions
- Collapse: Panel hides completely, floating button to bring it back
- Toggle button: Claude's discretion (fixed corner icon or inline in form header)
- State: Reset per step (panel starts visible/expanded on each QMHQ creation step)
- No keyboard shortcut

### Visual Treatment
- Visual separation: Claude's discretion (match existing app patterns)
- Header: Yes, shows QMRL ID (e.g., "QMRL-2025-00001") with close button
- Status/category badges: Same colored badges as detail page (consistency)
- Dark mode: Claude's discretion (check if dark mode exists elsewhere)

### Claude's Discretion
- Panel width (fixed px vs percentage)
- Toggle button placement and style
- Visual separation method (background, border, shadow)
- Dark mode support based on existing app implementation

</decisions>

<specifics>
## Specific Ideas

- Panel should feel like a reference card — always there but not demanding attention
- QMHQ count helps users see "oh, there are already 2 lines for this QMRL"
- Truncate description to keep panel compact, expand on demand

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-qmhq-creation-workflow*
*Context gathered: 2026-02-06*
