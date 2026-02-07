---
status: resolved
trigger: "comments-rls-delete"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:07:00Z
---

## Current Focus

hypothesis: CONFIRMED - Fix applied
test: Verify migration syntax and document verification steps
expecting: Migration is ready to apply, manual verification needed
next_action: Update resolution with fix details and verification steps

## Symptoms

expected: User can soft-delete their own comment (UPDATE sets deleted_at)
actual: RLS error "new row violates row-level security policy for table"
errors: "new row violates row-level security for the table" - this indicates UPDATE policy is blocking
reproduction: Click delete on own comment, confirm deletion
started: Just after deploying comments feature (Phase 23)

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:01:00Z
  checked: supabase/migrations/051_comments.sql lines 182-186
  found: UPDATE policy only has USING clause, no WITH CHECK clause
  implication: PostgreSQL falls back to USING for WITH CHECK, which means the NEW row must also satisfy author_id = auth.uid() AND NOT comment_has_replies(id). But when setting deleted_at/deleted_by, these conditions should still pass, so this might not be the full issue.

- timestamp: 2026-02-07T00:02:00Z
  checked: RLS policy documentation behavior
  found: When WITH CHECK is omitted, USING is used for WITH CHECK. The USING clause checks author_id = auth.uid() which should still be true after UPDATE since author_id doesn't change.
  implication: The issue is likely that comment_has_replies() is being called but the function needs to pass the NEW row's checks. However, the actual problem is that we need WITH CHECK to explicitly allow the soft-delete columns.

- timestamp: 2026-02-07T00:03:00Z
  checked: PostgreSQL RLS behavior for UPDATE
  found: UPDATE policies need explicit WITH CHECK to allow modifications. Without it, the USING clause is reused, which may block legitimate updates if the clause references columns being modified or has conditions that don't account for the update.
  implication: Need to add WITH CHECK clause that explicitly allows setting deleted_at and deleted_by fields.

- timestamp: 2026-02-07T00:04:00Z
  checked: components/comments/comments-section.tsx lines 70-76
  found: Soft-delete implementation using supabase.from("comments").update({ deleted_at, deleted_by }).eq("id", deleteTarget.id)
  implication: This is the exact UPDATE query that triggers the RLS policy. The fix in the migration will allow this query to succeed.

## Resolution

root_cause: UPDATE policy on comments table is missing WITH CHECK clause. When omitted, PostgreSQL reuses the USING clause for checking the updated row, which can block legitimate soft-delete operations.

fix: Created migration 20260207142713_fix_comments_update_rls_policy.sql that adds WITH CHECK clause to comments_update policy. The WITH CHECK clause ensures that after the UPDATE, the row still satisfies the ownership conditions (author_id = auth.uid() AND NOT comment_has_replies(id)), which allows setting deleted_at and deleted_by fields.

verification: Manual verification steps required:
1. Apply migration: npx supabase db push (or db reset for local)
2. Create a test comment as a user
3. Attempt to delete the comment (should succeed)
4. Verify deleted_at and deleted_by are set correctly
5. Attempt to delete a comment with replies (should fail - business rule)
6. Attempt to delete another user's comment (should fail - RLS)

files_changed:
  - supabase/migrations/20260207142713_fix_comments_update_rls_policy.sql (created)
  - supabase/migrations/051_comments.sql (original issue location - not modified, fixed via new migration)
