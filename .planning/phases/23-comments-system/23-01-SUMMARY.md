---
phase: 23-comments-system
plan: 01
subsystem: database-foundation
tags: [database, migration, rls, typescript, comments, threading]

# Dependency Graph
requires:
  - 027_rls_policies.sql (helper functions: owns_qmrl, owns_qmhq, get_user_role)
  - 030_file_attachments.sql (polymorphic pattern reference)
provides:
  - comments table with single-level threading
  - RLS policies mirroring parent entity access
  - comment_has_replies helper function
  - TypeScript Comment types
affects:
  - 23-02 (will use Comment types and RLS policies)
  - 23-03 (will use CommentWithAuthor for UI display)

# Tech Stack
tech-stack:
  added:
    - comment_has_replies() SECURITY DEFINER function
  patterns:
    - Polymorphic entity relationship (entity_type + entity_id)
    - Single-level threading via trigger constraint
    - Soft delete with deleted_at (no delete if has replies)
    - RLS policies mirroring parent entity visibility

# File Tracking
key-files:
  created:
    - supabase/migrations/051_comments.sql
  modified:
    - types/database.ts

# Decisions
decisions:
  - id: comments-single-level-threading
    decision: "Enforce single-level threading (comments can have replies, but replies cannot have replies)"
    rationale: "Simplifies UI complexity, matches common comment patterns (GitHub, Linear, etc.)"
    alternatives: "Multi-level threading rejected due to UX complexity"
    date: 2026-02-07

  - id: comments-soft-delete-with-replies-check
    decision: "Users can only soft-delete their own comments if they have no replies"
    rationale: "Prevents orphaning replies while allowing users to remove their own content"
    alternatives: "Cascade delete rejected (would lose reply context), hard block rejected (too restrictive)"
    date: 2026-02-07

  - id: comments-rls-follows-entity-access
    decision: "Comment visibility exactly matches parent entity visibility"
    rationale: "If you can see the QMRL/QMHQ/PO/Invoice, you can see its comments. Consistent with file_attachments pattern."
    alternatives: "Separate comment permissions rejected (adds complexity without clear benefit)"
    date: 2026-02-07

  - id: comments-finance-inventory-full-access
    decision: "Finance and Inventory roles can comment on any entity (including PO/Invoice)"
    rationale: "These roles need to discuss financial and procurement matters across all entities"
    alternatives: "Restricting to only their domain entities rejected (hinders cross-functional collaboration)"
    date: 2026-02-07

# Metrics
metrics:
  duration: "2 minutes"
  completed: "2026-02-07"
---

# Phase 23 Plan 01: Comments Database Foundation Summary

**One-liner:** Polymorphic comments table with single-level threading, soft delete protection for comments with replies, and RLS mirroring parent entity access.

## What Was Built

### 1. Comments Table (051_comments.sql)

**Schema:**
- `id`: UUID primary key
- `entity_type`: TEXT CHECK (qmrl, qmhq, po, invoice) - polymorphic entity reference
- `entity_id`: UUID - polymorphic, no FK constraint
- `parent_id`: UUID FK to comments(id) ON DELETE RESTRICT - for single-level threading
- `content`: TEXT NOT NULL CHECK (char_length > 0)
- `author_id`: UUID FK to users(id)
- `deleted_at`: TIMESTAMPTZ (soft delete)
- `deleted_by`: UUID FK to users(id)
- `created_at`, `updated_at`: TIMESTAMPTZ (auto-managed)

**Indexes:**
- `idx_comments_entity`: (entity_type, entity_id) WHERE deleted_at IS NULL
- `idx_comments_parent`: (parent_id) WHERE deleted_at IS NULL
- `idx_comments_author`: (author_id)

**Constraints:**
- Single-level threading enforced via `enforce_single_level_reply()` trigger
- Prevents replies to replies (raises exception if parent_id points to a comment that itself has a parent_id)

**Helper Functions:**
- `comment_has_replies(comment_id UUID)`: Returns BOOLEAN, checks if comment has non-deleted replies
- `update_comments_updated_at()`: Auto-updates updated_at timestamp on UPDATE

### 2. RLS Policies

Following `file_attachments` pattern exactly:

**SELECT Policy:**
- Privileged roles (admin, quartermaster, finance, inventory, proposal, frontline): see all non-deleted comments
- Requester role:
  - Can see comments on QMRL they own (`entity_type = 'qmrl' AND owns_qmrl(entity_id)`)
  - Can see comments on QMHQ linked to their QMRL (`entity_type = 'qmhq' AND owns_qmhq(entity_id)`)
  - Cannot see PO or Invoice comments (no access to those entities per existing RLS)

**INSERT Policy:**
- Admin, Quartermaster: can comment on any entity
- Finance, Inventory: can comment on any entity (need to discuss PO/Invoice)
- Proposal, Frontline: can comment on qmrl and qmhq only
- Requester: can only comment on their own QMRL (`entity_type = 'qmrl' AND owns_qmrl(entity_id)`)

**UPDATE Policy (soft delete):**
- Users can soft-delete their own comments (`author_id = auth.uid()`)
- Only if comment has no replies (`NOT comment_has_replies(id)`)
- Prevents orphaning replies

**DELETE Policy (hard delete):**
- Admin only (for cleanup/maintenance)

### 3. TypeScript Types (types/database.ts)

```typescript
export type CommentEntityType = 'qmrl' | 'qmhq' | 'po' | 'invoice';

export interface Comment {
  id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  parent_id: string | null;
  content: string;
  author_id: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<User, 'id' | 'full_name' | 'avatar_url'>;
}

export interface CommentWithReplies extends CommentWithAuthor {
  replies: CommentWithAuthor[];
}
```

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1-2 | Create comments table migration with RLS | 054857c | supabase/migrations/051_comments.sql |
| 3 | Add Comment TypeScript types | ae32c37 | types/database.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Implementation Notes

### Polymorphic Pattern Consistency

Followed exact pattern from `030_file_attachments.sql`:
- No FK constraints on entity_id (polymorphic relationship)
- Partial indexes with `WHERE deleted_at IS NULL` for performance
- RLS policies use existing helper functions (`owns_qmrl`, `owns_qmhq`, `get_user_role`)

### Single-Level Threading Enforcement

Used trigger-based constraint (not CHECK constraint) because CHECK cannot reference other rows:

```sql
CREATE OR REPLACE FUNCTION public.enforce_single_level_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.comments WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Replies cannot have nested replies (single-level threading only)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Trigger fires `BEFORE INSERT`, preventing invalid data from entering the table.

### Soft Delete Protection

`comment_has_replies()` function used in UPDATE policy to prevent soft-deleting comments with replies:

```sql
CREATE POLICY comments_update ON public.comments
  FOR UPDATE USING (
    author_id = auth.uid()
    AND NOT public.comment_has_replies(id)
  );
```

This prevents orphaning replies while still allowing users to remove their own content when appropriate.

## Next Phase Readiness

### For Phase 23-02 (Comment Queries):
- comments table ready for querying
- RLS policies enforce access control automatically
- Indexes optimize common query patterns (by entity, by parent)

### For Phase 23-03 (Comment UI Components):
- `CommentWithAuthor` and `CommentWithReplies` types ready for UI
- Soft delete behavior defined (UPDATE only if no replies)
- Single-level threading constraint enforced at database level

### Known Limitations:
- No real-time subscriptions defined yet (Plan 23-02 scope)
- No audit logging for comment changes (could be added in future phase if needed)
- No edit history (content changes overwrite, no versioning)

## Verification

- TypeScript type-check passes (`npm run type-check`)
- Migration file syntax validated against existing pattern
- RLS policies follow established permission matrix from PRD
- All helper functions granted execute permissions to `authenticated` role

## Self-Check: PASSED

Created files:
- supabase/migrations/051_comments.sql ✓
- (types/database.ts modified, not created) ✓

Commits:
- 054857c ✓
- ae32c37 ✓
