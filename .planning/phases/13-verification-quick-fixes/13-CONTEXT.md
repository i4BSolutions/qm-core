# Phase 13: Verification & Quick Fixes - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify already-deployed attachment deletion and QMHQ item route fulfillment features work correctly, and fix any gaps. This phase confirms existing RLS policies and stock-out functionality meet requirements, with immediate fixes for any issues discovered.

</domain>

<decisions>
## Implementation Decisions

### Attachment Delete Behavior
- Confirmation dialog required before every delete
- Dialog shows filename: "Delete 'report.pdf'?"
- Toast notification on successful delete: "Attachment deleted"
- Hide delete button entirely if user lacks permission (no error state needed)
- Same delete button appearance for admin deleting others' files (no visual distinction)
- Deleted attachments not visible in UI — recovery is admin/DB operation only

### Fulfillment Progress Display
- Progress bar format (visual bar with numbers)
- Placement in both locations: summary in header area, detailed breakdown in stock-out tab
- Per-item breakdown for multi-item QMHQ (each item shows its own progress)
- No aggregated summary needed for multi-item — per-item is sufficient

### Stock-out Access Restriction
- Filter QMHQ items from general stock-out form (general form only shows manual reasons)
- "Issue Stock" button in stock-out tab on QMHQ detail page
- Disable button with tooltip when fully fulfilled ("Fully issued")
- Show max issuable quantity as reference but don't pre-fill input
- Warehouse selection is required (not optional)
- Warehouse selector shows available stock per warehouse: "Warehouse A (15 in stock)"

### Gap Handling Approach
- Fix immediately in this phase (verification + fixes combined)
- Manual testing only (no automated tests)
- All success criteria from ROADMAP.md must pass before phase complete
- Database migrations included if needed for fixes
- Brief verification report documenting what was tested and results

### Claude's Discretion
- Progress bar color scheme (pick based on existing color system)
- Progress bar label text format ("5/10" vs "5 of 10 issued" vs "5 remaining")
- RLS fix approach — diagnose root cause and fix wherever the issue is (DB or client)

</decisions>

<specifics>
## Specific Ideas

- Research indicates RLS policy for attachment delete already exists (migration 036)
- QMHQ stock-out tab already exists (detail page lines 712-837)
- Phase 13 is primarily verification with gap fixes — not building new features

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-verification-quick-fixes*
*Context gathered: 2026-02-02*
