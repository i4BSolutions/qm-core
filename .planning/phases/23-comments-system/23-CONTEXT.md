# Phase 23: Comments System - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Threaded comments on QMRL, QMHQ, PO, and Invoice detail pages. Users can add comments, reply to parent comments (one level only), and delete their own comments. Comments follow existing entity RLS visibility rules.

</domain>

<decisions>
## Implementation Decisions

### Comment Layout
- Card-based layout for each comment (bordered card with subtle shadow)
- Replies indented under parent comment with connecting line
- Each comment shows: user avatar, display name, absolute timestamp (not relative like "2 hours ago")
- Plain text only — no markdown or rich text formatting
- Empty state: simple text "No comments yet" with add button

### Reply Interaction
- Reply button visible on each parent comment (not on replies)
- Reply input appears at bottom of thread with "replying to @name" indicator
- Can only reply to parent comments, not to replies
- After submitting: reply appears immediately + success toast notification

### Comment Placement
- Inline section at bottom of detail page content (not in tabs, not in sidebar)
- Always visible — not collapsible
- Section header shows "Comments (5)" with comment count
- Add comment input positioned at bottom of section

### Delete Experience
- Delete button (trash icon) always visible on own comments
- Confirmation dialog before deleting ("Are you sure?")
- Comments with replies cannot be deleted — delete button disabled with tooltip "Cannot delete: has replies"
- Only replies (leaf comments) can be deleted
- Everyone can only delete their own comments (admin/quartermaster cannot delete others)

### Claude's Discretion
- Exact card styling (shadows, borders, spacing)
- Loading skeleton design while fetching comments
- Error state handling
- Exact timestamp format (e.g., "Feb 7, 2026 at 2:30 PM")

</decisions>

<specifics>
## Specific Ideas

No specific product references — open to standard approaches that match existing QM System UI patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-comments-system*
*Context gathered: 2026-02-07*
