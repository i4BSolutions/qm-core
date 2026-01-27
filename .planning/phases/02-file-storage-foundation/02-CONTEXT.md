# Phase 2: File Storage Foundation - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Secure file storage infrastructure with RLS policies, validation rules, and deletion handling. This phase creates the database schema, Supabase Storage bucket, and server-side utilities. UI components and preview features belong in Phases 3-4.

</domain>

<decisions>
## Implementation Decisions

### Entity Attachment Model
- Files attach to QMRL and QMHQ entities only
- Each file belongs to one entity (no sharing/linking)
- Track `uploaded_by` user separately for audit trail
- No description field — filename is sufficient metadata
- No file inheritance when QMRL creates QMHQ
- File access mirrors entity RLS (can see entity = can see files)
- No file versioning — replace overwrites, delete removes
- No file count limit per entity (removed roadmap's 10-file limit)

### File Type & Size Rules
- Allowed types: Images (jpg, png, gif, webp) + PDFs + Office documents
- Office formats: Both modern (.docx, .xlsx, .pptx) and legacy (.doc, .xls, .ppt)
- Maximum size: 25MB per file
- Validation: Extension-only (trust file extension, no MIME/magic byte check)
- No compression — store files exactly as uploaded
- Duplicate content: Warn user but allow upload
- Name collision: Auto-rename with suffix (e.g., "document (1).pdf")
- Preserve original filenames (no sanitization or UUID renaming)

### Deletion Behavior
- Cascade delete: Files deleted when parent entity is soft-deleted
- Delete permission: Admins only (Admin and Quartermaster roles)
- Soft delete first: Mark file as deleted, retain in storage
- Grace period: 30 days before permanent purge from storage
- Need cleanup job/trigger for purging expired soft-deleted files

### Claude's Discretion
- Storage path structure (flat vs nested by entity type)
- Exact file extension allowlist implementation
- Soft delete column naming (`deleted_at` vs `is_deleted`)
- Cleanup job implementation (Edge Function vs database trigger)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard Supabase Storage approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-file-storage-foundation*
*Context gathered: 2026-01-27*
