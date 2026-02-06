# Phase 17: Attachment Delete Fixes - Research

**Researched:** 2026-02-06
**Domain:** Supabase RLS, file attachments, soft-delete pattern
**Confidence:** HIGH

## Summary

Research into the attachment delete failures revealed a classic Supabase RLS pattern issue. The bug occurs in the `deleteFile` server action where an UPDATE with a chained SELECT fails due to conflicting RLS policies. The UPDATE itself succeeds, but the subsequent SELECT (used to return `entity_type, entity_id` for path revalidation) fails because the SELECT policy excludes rows where `deleted_at IS NOT NULL`.

Both scenarios (owner deleting own files AND admin/QM deleting any file) fail for the same reason: the soft-delete UPDATE sets `deleted_at`, immediately making the row invisible to the SELECT policy.

**Primary recommendation:** Remove the `.select().single()` chain from the UPDATE operation, or modify the SELECT policy to allow selecting soft-deleted rows for users who can delete them.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Error behavior: On failure after fix, show error toast, keep file visible in UI
- Permission model: Owner should delete own attachments; Admin/Quartermaster should delete any attachment

### Claude's Discretion
- Root cause investigation approach
- Whether to fix RLS policies, storage policies, or both
- Order of operations (delete storage first vs database first)
- Error message wording

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Root Cause Analysis

### The Bug Flow

1. **User clicks delete** in `AttachmentsTab` component
2. **Server action `deleteFile`** is called (`lib/actions/files.ts`)
3. **UPDATE operation** runs:
   ```typescript
   const { data, error } = await supabase
     .from('file_attachments')
     .update({
       deleted_at: new Date().toISOString(),
       deleted_by: user.id,
       updated_at: new Date().toISOString(),
     })
     .eq('id', fileId)
     .select('entity_type, entity_id')  // <-- PROBLEM HERE
     .single();
   ```
4. **UPDATE succeeds** - The row is modified (RLS UPDATE policy passes)
5. **Chained SELECT fails** - After update, `deleted_at` is no longer NULL
6. **SELECT RLS policy blocks** - The policy requires `deleted_at IS NULL`:
   ```sql
   CREATE POLICY file_attachments_select ON public.file_attachments
     FOR SELECT USING (
       deleted_at IS NULL  -- <-- Row now fails this condition
       AND (...)
     );
   ```
7. **`.single()` throws error** - No rows returned, expects exactly 1
8. **Error propagates** to UI as RLS permission error

### Why Both Scenarios Fail

- **Owner deleting own file**: UPDATE policy passes (`uploaded_by = auth.uid()`), but SELECT policy blocks the return
- **Admin/QM deleting any file**: UPDATE policy passes (`get_user_role() IN ('admin', 'quartermaster')`), but same SELECT issue

The root cause is **not** a permission problem - it's a **query pattern** problem where the chained SELECT is evaluated against a row that no longer meets SELECT visibility criteria.

## Current Implementation

### Files Involved

| File | Purpose |
|------|---------|
| `lib/actions/files.ts` | Server action with `deleteFile` function |
| `components/files/attachments-tab.tsx` | UI component calling deleteFile |
| `supabase/migrations/030_file_attachments.sql` | Table schema + RLS policies |
| `supabase/migrations/037_file_attachments_delete_own.sql` | UPDATE policy fix |

### Current RLS Policies (file_attachments)

| Policy | Type | Condition |
|--------|------|-----------|
| `file_attachments_select` | SELECT | `deleted_at IS NULL AND (role check OR owns)` |
| `file_attachments_insert` | INSERT | Role-based permissions |
| `file_attachments_update` | UPDATE | `admin/qm OR uploaded_by = auth.uid()` |
| `file_attachments_delete` | DELETE | `admin` only (for hard delete cleanup) |

### The Problematic Code

```typescript
// lib/actions/files.ts - deleteFile function (lines 167-176)
const { data, error } = await supabase
  .from('file_attachments')
  .update({
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    updated_at: new Date().toISOString(),
  })
  .eq('id', fileId)
  .select('entity_type, entity_id')  // Needs row visibility via SELECT policy
  .single();                          // Fails: no rows returned
```

## Recommended Fix Approach

### Option A: Fix the Server Action (RECOMMENDED)

**Change:** Fetch `entity_type` and `entity_id` BEFORE the update, not after.

```typescript
// Step 1: Fetch entity info first (row is still visible)
const { data: fileData, error: fetchError } = await supabase
  .from('file_attachments')
  .select('entity_type, entity_id')
  .eq('id', fileId)
  .single();

if (fetchError || !fileData) {
  return { success: false, error: 'File not found' };
}

// Step 2: Perform soft delete without returning data
const { error: updateError } = await supabase
  .from('file_attachments')
  .update({
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    updated_at: new Date().toISOString(),
  })
  .eq('id', fileId);

if (updateError) {
  return { success: false, error: `Delete failed: ${updateError.message}` };
}

// Step 3: Use pre-fetched data for revalidation
revalidatePath(`/${fileData.entity_type}/${fileData.entity_id}`);
```

**Pros:**
- No migration needed
- Minimal code change
- Maintains existing RLS security model
- SELECT policy correctly hides soft-deleted files from normal queries

**Cons:**
- Two database round trips instead of one

### Option B: Fix the RLS SELECT Policy

**Change:** Allow users to see soft-deleted files they can modify.

```sql
CREATE POLICY file_attachments_select ON public.file_attachments
  FOR SELECT USING (
    (
      -- Normal visibility: non-deleted files with appropriate access
      deleted_at IS NULL
      AND (
        public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
        OR (public.get_user_role() = 'requester' AND entity_type = 'qmrl' AND public.owns_qmrl(entity_id))
        OR (public.get_user_role() = 'requester' AND entity_type = 'qmhq' AND public.owns_qmhq(entity_id))
      )
    )
    OR (
      -- Also allow selecting soft-deleted files for users who could modify them
      -- This enables UPDATE...SELECT pattern to work
      deleted_at IS NOT NULL
      AND (
        public.get_user_role() IN ('admin', 'quartermaster')
        OR uploaded_by = auth.uid()
      )
    )
  );
```

**Pros:**
- Single database round trip
- Fixes the issue at the RLS level

**Cons:**
- Requires migration
- More complex policy
- Soft-deleted files become visible to those who can delete them (minor security consideration)

### Recommendation

**Use Option A (fix server action)** because:
1. No migration required
2. Cleaner separation of concerns (SELECT policy stays focused on visibility)
3. The extra round trip is negligible for a delete operation
4. Less risk of unintended side effects

## Files to Modify

| File | Change |
|------|--------|
| `lib/actions/files.ts` | Refactor `deleteFile` to fetch entity info before update |

## Migration Needed

**None** - The recommended fix (Option A) only requires code changes.

If Option B is chosen, a migration would be needed:
```
supabase/migrations/048_fix_file_attachments_select_rls.sql
```

## Code Examples

### Fixed deleteFile Function

```typescript
export async function deleteFile(
  fileId: string
): Promise<FileOperationResult<void>> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Fetch entity info BEFORE soft delete (while row is still visible)
    const { data: fileData, error: fetchError } = await supabase
      .from('file_attachments')
      .select('entity_type, entity_id')
      .eq('id', fileId)
      .single();

    if (fetchError) {
      return { success: false, error: 'File not found or access denied' };
    }

    // Perform soft delete without chained select
    const { error: updateError } = await supabase
      .from('file_attachments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', fileId);

    if (updateError) {
      return { success: false, error: `Delete failed: ${updateError.message}` };
    }

    // Use pre-fetched data for revalidation
    revalidatePath(`/${fileData.entity_type}/${fileData.entity_id}`);
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
```

## Common Pitfalls

### Pitfall 1: Chained SELECT After UPDATE with Soft Delete

**What goes wrong:** UPDATE succeeds but chained SELECT fails because SELECT RLS policy excludes the now-soft-deleted row.

**Why it happens:** Supabase evaluates the SELECT portion using SELECT RLS policies, which may have different conditions than UPDATE policies.

**How to avoid:** Either fetch data before the update, or ensure SELECT policy allows visibility of rows the user can modify.

**Warning signs:** "No rows returned" or "Row not found" errors after an UPDATE that should have worked.

### Pitfall 2: Assuming UPDATE Return Behavior

**What goes wrong:** Assuming `.select()` after `.update()` bypasses SELECT RLS policies.

**Why it happens:** Common misconception that the chained select is part of the UPDATE operation.

**How to avoid:** Understand that Supabase always applies the relevant operation's RLS policy, even for chained operations.

## Open Questions

None - root cause is clearly identified and solution is straightforward.

## Sources

### Primary (HIGH confidence)
- `/Users/thihaaung/qm-core/lib/actions/files.ts` - Server action implementation
- `/Users/thihaaung/qm-core/supabase/migrations/030_file_attachments.sql` - RLS policies
- `/Users/thihaaung/qm-core/supabase/migrations/037_file_attachments_delete_own.sql` - UPDATE policy

### Secondary (MEDIUM confidence)
- Supabase documentation on RLS and chained operations

## Metadata

**Confidence breakdown:**
- Root cause: HIGH - Code analysis clearly shows the issue
- Fix approach: HIGH - Standard pattern for this type of bug
- Implementation: HIGH - Minimal code change required

**Research date:** 2026-02-06
**Valid until:** Indefinite (bug fix, not version-dependent)
