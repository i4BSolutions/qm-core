# Phase 15: Edit Capability - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Edit buttons to entity detail pages (QMRL, QMHQ, PO) that route to existing edit forms. Invoice detail page has no Edit button (void functionality exists instead). Button visibility depends on entity state and user permissions.

</domain>

<decisions>
## Implementation Decisions

### Button placement
- Position: Header right side, next to entity title/ID
- Icon: Pencil icon alongside "Edit" text
- Responsive: Icon-only on mobile, full button with text on desktop
- Consistency: Identical position across all entity detail pages (QMRL, QMHQ, PO)
- Scope: Edit button only for now — no Delete/Archive buttons in this phase
- Spacing: Match existing detail page header patterns

### Visibility rules
- **QMRL**: Edit always available regardless of status
- **QMHQ**: Edit always available regardless of status
- **PO**: Edit hidden when status is closed OR cancelled
- **PO with invoices**: Edit still available (form may restrict certain fields)
- **Invoice**: No Edit button at all — void functionality exists separately, no indicator needed

### User feedback
- Navigation: Click Edit goes straight to edit form (no confirmation dialog)
- After save: Return to detail page user came from
- Unsaved warning: Not needed — detail pages are read-only
- No loading state needed for navigation

### Permission display
- Unauthorized users: Hide Edit button completely (not disabled)
- **QMRL permissions**:
  - Requester: Can edit own QMRL (any status)
  - Frontline, Proposal: Can edit any QMRL
  - Quartermaster: Can edit any QMRL
  - Admin: Can edit any QMRL
- **QMHQ permissions**:
  - Proposal: Can edit any QMHQ
  - Quartermaster: Can edit any QMHQ
  - Admin: Can edit any QMHQ
- **PO permissions**:
  - Finance: Can edit PO
  - Proposal: Can edit PO
  - Admin: Can edit PO
  - Quartermaster: Cannot edit PO
- Admin override: Admin sees all Edit buttons (except Invoice)

### Claude's Discretion
- Button style (primary vs secondary) — based on existing page patterns
- Loading state during navigation — based on existing patterns
- Permission check approach — both client-side hiding and server-side redirect recommended
- Direct URL access handling — determine based on existing unauthorized access patterns

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing detail page header patterns for button placement and styling.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-edit-capability*
*Context gathered: 2026-02-02*
