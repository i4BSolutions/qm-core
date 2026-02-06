# Phase 17: Attachment Delete Fixes - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix attachment deletion on QMRL and QMHQ detail pages. Users currently see RLS/permission errors when attempting to delete attachments. Both file owners and admin/quartermaster roles are affected.

</domain>

<decisions>
## Implementation Decisions

### Error behavior
- Current issue: RLS permission error on delete attempts
- Affects both scenarios: owner deleting own files AND admin/QM deleting any files
- Unknown whether partial deletion occurs (storage vs database) — investigation needed
- On failure after fix: Show error toast, keep file visible in UI

### Permission model (existing, to be fixed)
- Owner should delete own attachments
- Admin/Quartermaster should delete any attachment
- This is the intended behavior from v1.3 — RLS policies exist but aren't working correctly

### Claude's Discretion
- Root cause investigation approach
- Whether to fix RLS policies, storage policies, or both
- Order of operations (delete storage first vs database first)
- Error message wording

</decisions>

<specifics>
## Specific Ideas

- This is a bug fix, not a new feature — the delete UI and permissions were designed in v1.3
- RLS policy for attachments was set up to allow owner OR admin/quartermaster delete
- Something is blocking the actual delete operation despite the policy

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-attachment-delete-fixes*
*Context gathered: 2026-02-06*
