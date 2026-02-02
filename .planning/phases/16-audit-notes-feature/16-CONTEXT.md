# Phase 16: Audit Notes Feature - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture user-entered notes during status changes on QMRL and QMHQ entities, store them in the audit log, and display them in the History tab. Invoice void_reason remains a separate system. PO status changes do not get notes.

</domain>

<decisions>
## Implementation Decisions

### Note Input UX
- Expandable toggle ("Add note" link that expands textarea when clicked)
- Notes are always optional for all status changes
- Maximum length: 256 characters (short, commit-message style)
- Toggle placement: Claude's discretion based on existing UI patterns

### Note Display in History
- Expandable/collapsible display ("View note" link that expands to show full text)
- Icon indicator for entries that have notes (small note/comment icon)
- Expanded note styling: Claude's discretion based on existing History tab styling
- No filtering or search capability for notes

### Entity Scope
- QMRL and QMHQ only (not PO, not Invoice)
- All status changes can have notes (any status → any status)
- Detail pages vs list pages: Claude's discretion based on existing status change patterns
- Invoice void_reason stays separate, not unified with this system

### Deduplication Behavior
- Deduplication approach: Claude's discretion (app bypass vs trigger detection)
- Rapid changes: Both recorded as separate entries (no debounce/merge)
- Note passing mechanism: Claude's discretion based on existing update patterns
- Conflict resolution: Entry with note wins over entry without note

### Claude's Discretion
- Where exactly to place the "Add note" toggle in the UI
- Styling of expanded notes in History tab
- Whether list pages also support notes or detail pages only
- Technical approach to prevent duplicate audit entries
- How note is passed from UI to audit log (separate call vs single payload)

</decisions>

<specifics>
## Specific Ideas

- Notes should feel lightweight — not a required form field, just a quick option
- 256 char limit keeps notes focused and prevents walls of text in History
- Icon indicator makes it scannable to see which entries have notes without expanding each

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-audit-notes-feature*
*Context gathered: 2026-02-02*
