# Phase 2: File Storage Foundation - Research

**Researched:** 2026-01-27
**Domain:** Supabase Storage with RLS-based access control
**Confidence:** HIGH

## Summary

This phase implements secure file storage infrastructure for QMRL and QMHQ entities using Supabase Storage. The implementation involves three core components: (1) a `file_attachments` metadata table in the public schema tracking file ownership and soft-delete status, (2) a private Supabase Storage bucket with file type and size restrictions, and (3) RLS policies on both the metadata table and `storage.objects` that mirror entity access permissions.

The architecture follows Supabase's recommended pattern of storing metadata in a custom table while using Storage for actual file content. This separation enables soft-delete with a 30-day grace period before permanent purge, proper audit trails, and flexible querying of file metadata. RLS policies on `storage.objects` will reference the parent entity (QMRL/QMHQ) to determine access, ensuring users who can view an entity can also view its attachments.

**Primary recommendation:** Create a `file_attachments` table that references parent entities, use Supabase Storage with bucket-level restrictions (25MB, allowed MIME types), and implement RLS policies that check parent entity access for file operations.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Storage | Built-in | File storage with RLS | Already integrated, S3-compatible, RLS support |
| @supabase/ssr | ^0.5.x | Server/client SDK | Already in use, provides storage methods |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_cron | Built-in | Scheduled jobs | Cleanup job for expired soft-deleted files |
| pg_net | Built-in | HTTP from SQL | Trigger Edge Functions from scheduled jobs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Storage | AWS S3 directly | Additional infrastructure, loses RLS integration |
| pg_cron cleanup | Edge Function scheduled externally | pg_cron is simpler, no external dependency |

**Installation:**
```bash
# No additional packages needed - Supabase Storage is built-in
# Ensure @supabase/ssr is current version
npm install @supabase/ssr@latest
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/
  migrations/
    030_file_attachments.sql       # Metadata table
    031_storage_bucket.sql         # Bucket creation with restrictions
    032_storage_rls_policies.sql   # RLS on storage.objects
    033_file_cleanup_job.sql       # pg_cron scheduled cleanup

lib/
  utils/
    file-validation.ts             # Extension/size validation utilities

types/
  database.ts                      # Add FileAttachment type
```

### Pattern 1: Metadata Table + Storage Separation
**What:** Store file metadata (owner, entity reference, soft-delete status) in a public table, actual files in Storage bucket
**When to use:** When you need soft-delete, audit trails, or custom querying beyond Storage metadata
**Example:**
```sql
-- Source: Supabase Storage design pattern
CREATE TABLE public.file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity relationship (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq')),
  entity_id UUID NOT NULL,

  -- File metadata
  filename TEXT NOT NULL,              -- Original filename preserved
  storage_path TEXT NOT NULL UNIQUE,   -- Path in storage bucket
  file_size BIGINT NOT NULL,           -- Size in bytes
  mime_type TEXT NOT NULL,             -- Detected MIME type

  -- Ownership/audit
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.users(id),

  -- Standard audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for entity lookups
CREATE INDEX idx_file_attachments_entity
  ON public.file_attachments(entity_type, entity_id)
  WHERE deleted_at IS NULL;
```

### Pattern 2: Storage Path Structure
**What:** Organize files by entity type and ID for logical grouping
**When to use:** Always - provides predictable paths and easy bulk operations
**Example:**
```
attachments/
  qmrl/
    {qmrl_id}/
      document.pdf
      image.png
  qmhq/
    {qmhq_id}/
      receipt.pdf
```

### Pattern 3: RLS Policy Delegation to Parent Entity
**What:** Storage object access determined by checking if user can access parent entity
**When to use:** When file access should mirror entity access (per CONTEXT.md decision)
**Example:**
```sql
-- Source: Supabase Storage access control documentation
CREATE POLICY "Users can view files if they can view parent entity"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND EXISTS (
    SELECT 1 FROM public.file_attachments fa
    WHERE fa.storage_path = name
    AND fa.deleted_at IS NULL
    AND (
      -- Check QMRL access
      (fa.entity_type = 'qmrl' AND EXISTS (
        SELECT 1 FROM public.qmrl
        WHERE id = fa.entity_id
        AND (
          public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
          OR (public.get_user_role() = 'requester' AND requester_id = auth.uid())
        )
      ))
      OR
      -- Check QMHQ access
      (fa.entity_type = 'qmhq' AND EXISTS (
        SELECT 1 FROM public.qmhq q
        JOIN public.qmrl r ON q.qmrl_id = r.id
        WHERE q.id = fa.entity_id
        AND (
          public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
          OR (public.get_user_role() = 'requester' AND r.requester_id = auth.uid())
        )
      ))
    )
  )
);
```

### Anti-Patterns to Avoid
- **Direct storage.objects manipulation via SQL:** All modifications must go through the Storage API to avoid orphaned files
- **Storing file content in database:** Use Storage for actual files, only metadata in tables
- **Hard-coding bucket names in multiple places:** Define bucket name as constant
- **Trusting client-provided MIME type without validation:** Validate extension server-side
- **Deleting storage objects immediately on soft-delete:** Wait for grace period

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File path parsing | Regex for extensions | `storage.extension()`, `storage.filename()` | Built-in SQL functions, handle edge cases |
| Folder organization | Custom path builders | `storage.foldername()` | Returns array, integrates with RLS |
| Scheduled cleanup | Manual cron service | pg_cron + pg_net | Built into Supabase, no external infra |
| File access URLs | Manual URL construction | `supabase.storage.from().getPublicUrl()` | Handles signed URLs, bucket config |

**Key insight:** Supabase Storage provides helper functions specifically for RLS policy writing. Use `storage.extension(name)`, `storage.filename(name)`, and `storage.foldername(name)` instead of parsing paths manually.

## Common Pitfalls

### Pitfall 1: Orphaned Storage Objects
**What goes wrong:** Deleting metadata without removing storage object leaves files you pay for
**Why it happens:** Direct SQL deletion of file_attachments records
**How to avoid:** Always use a transaction that (1) marks metadata as deleted, (2) after grace period, use Storage API to delete actual file
**Warning signs:** Storage usage doesn't decrease after "deletes"

### Pitfall 2: RLS Policy Performance
**What goes wrong:** Complex RLS policies with multiple JOINs cause slow file operations
**Why it happens:** Every storage operation evaluates the policy
**How to avoid:** Create indexes on `file_attachments(storage_path)` and ensure entity access checks are indexed
**Warning signs:** Slow file listing, timeouts on upload

### Pitfall 3: Missing Delete Permission on storage.objects
**What goes wrong:** Users can't delete files even with proper metadata table permissions
**Why it happens:** Forgot that `DELETE` on storage.objects requires both `select` AND `delete` policies
**How to avoid:** Always create both SELECT and DELETE policies for storage.objects
**Warning signs:** "Permission denied" on file deletion despite metadata access

### Pitfall 4: MIME Type Mismatch
**What goes wrong:** Files rejected despite correct extension
**Why it happens:** Browser sends different MIME type than expected (e.g., `application/octet-stream`)
**How to avoid:** Use extension-only validation (per CONTEXT.md decision), let bucket restrictions handle suspicious cases
**Warning signs:** Inconsistent upload failures

### Pitfall 5: Name Collision Silent Failure
**What goes wrong:** File overwritten without warning when same filename uploaded twice
**Why it happens:** Upsert behavior when path already exists
**How to avoid:** Generate unique storage paths with UUID or timestamp suffix, keep original filename in metadata
**Warning signs:** Files mysteriously change content

### Pitfall 6: Service Role Key Bypass
**What goes wrong:** Server operations fail because service key bypasses RLS but expects it
**Why it happens:** Mixing authenticated user context with service role operations
**How to avoid:** Use service role only for cleanup jobs, use user context for uploads/downloads
**Warning signs:** Files uploaded without owner_id, permission errors in cleanup

## Code Examples

Verified patterns from official sources:

### Bucket Creation with Restrictions
```sql
-- Source: Supabase Storage bucket documentation
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,  -- Private bucket, all access via RLS
  26214400,  -- 25MB in bytes
  ARRAY[
    -- Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    -- PDF
    'application/pdf',
    -- Office modern
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  -- .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         -- .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
    -- Office legacy
    'application/msword',                    -- .doc
    'application/vnd.ms-excel',              -- .xls
    'application/vnd.ms-powerpoint'          -- .ppt
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
```

### File Validation Utility (TypeScript)
```typescript
// Source: Custom implementation based on CONTEXT.md decisions

const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  // PDF
  '.pdf',
  // Office modern
  '.docx', '.xlsx', '.pptx',
  // Office legacy
  '.doc', '.xls', '.ppt'
] as const;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

export function validateFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number]);
}

export function validateFileSize(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= MAX_FILE_SIZE;
}

export function generateStoragePath(
  entityType: 'qmrl' | 'qmhq',
  entityId: string,
  filename: string
): string {
  // Add timestamp to prevent collisions while preserving original name
  const timestamp = Date.now();
  const ext = filename.slice(filename.lastIndexOf('.'));
  const baseName = filename.slice(0, filename.lastIndexOf('.'));
  return `${entityType}/${entityId}/${baseName}_${timestamp}${ext}`;
}
```

### Storage Upload (Client-Side)
```typescript
// Source: Supabase JavaScript SDK documentation
import { createClient } from '@/lib/supabase/client';

async function uploadFile(
  file: File,
  entityType: 'qmrl' | 'qmhq',
  entityId: string
): Promise<{ path: string } | { error: Error }> {
  const supabase = createClient();

  // Client-side validation (server also validates)
  if (!validateFileExtension(file.name)) {
    return { error: new Error('File type not allowed') };
  }
  if (!validateFileSize(file.size)) {
    return { error: new Error('File size exceeds 25MB limit') };
  }

  const storagePath = generateStoragePath(entityType, entityId, file.name);

  const { data, error } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false  // Never overwrite - path is unique
    });

  if (error) return { error };
  return { path: data.path };
}
```

### Soft Delete with Cascade (Database Trigger)
```sql
-- Source: Custom implementation based on CONTEXT.md decisions
-- Trigger to soft-delete files when parent entity is soft-deleted

CREATE OR REPLACE FUNCTION public.cascade_soft_delete_files()
RETURNS TRIGGER AS $$
BEGIN
  -- When entity is soft-deleted (is_active = false)
  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.file_attachments
    SET
      deleted_at = NOW(),
      deleted_by = auth.uid(),
      updated_at = NOW()
    WHERE
      entity_type = TG_ARGV[0]  -- 'qmrl' or 'qmhq'
      AND entity_id = NEW.id
      AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to QMRL
CREATE TRIGGER qmrl_cascade_soft_delete_files
AFTER UPDATE OF is_active ON public.qmrl
FOR EACH ROW
EXECUTE FUNCTION public.cascade_soft_delete_files('qmrl');

-- Apply to QMHQ
CREATE TRIGGER qmhq_cascade_soft_delete_files
AFTER UPDATE OF is_active ON public.qmhq
FOR EACH ROW
EXECUTE FUNCTION public.cascade_soft_delete_files('qmhq');
```

### Scheduled Cleanup Job (pg_cron)
```sql
-- Source: Supabase pg_cron documentation
-- Runs daily at 3 AM to purge expired soft-deleted files

-- Create the cleanup function (called by Edge Function)
CREATE OR REPLACE FUNCTION public.get_expired_file_paths()
RETURNS TABLE(storage_path TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT fa.storage_path
  FROM public.file_attachments fa
  WHERE fa.deleted_at IS NOT NULL
    AND fa.deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- After Edge Function deletes from storage, it calls this to clean metadata
CREATE OR REPLACE FUNCTION public.purge_expired_file_metadata()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.file_attachments
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `owner` column in storage.objects | `owner_id` column | 2024 | Use `owner_id` in RLS policies, `owner` is deprecated |
| Manual bucket creation via Dashboard | SQL INSERT into storage.buckets | Stable | Can define in migrations for reproducibility |
| External cron services | pg_cron + pg_net built-in | 2023 | No external dependency for scheduled tasks |

**Deprecated/outdated:**
- `storage.objects.owner`: Use `owner_id` instead (owner is deprecated and will be removed)
- Manual bucket configuration: Use migration-based bucket creation for consistency

## Open Questions

Things that couldn't be fully resolved:

1. **Exact storage.objects column list**
   - What we know: Includes `id`, `bucket_id`, `name`, `owner_id`, `created_at`, `updated_at`, `metadata`, `version`
   - What's unclear: Full list of all columns and their types
   - Recommendation: Query `information_schema.columns` during implementation to verify

2. **Edge Function vs SQL-only cleanup**
   - What we know: pg_cron can trigger Edge Functions via pg_net; Storage API required for file deletion
   - What's unclear: Whether there's a way to delete storage objects from SQL directly (likely not, per docs warning)
   - Recommendation: Implement Edge Function for cleanup, triggered by pg_cron

3. **Batch file operations performance**
   - What we know: `storage.from().remove()` accepts array of paths
   - What's unclear: Practical limits on batch size, whether RLS is evaluated per-file
   - Recommendation: Start with batches of 100, monitor performance

## Sources

### Primary (HIGH confidence)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) - RLS policies on storage.objects
- [Supabase Storage Helper Functions](https://supabase.com/docs/guides/storage/schema/helper-functions) - storage.extension(), filename(), foldername()
- [Supabase Storage Ownership](https://supabase.com/docs/guides/storage/security/ownership) - owner_id field usage
- [Supabase Scheduled Functions](https://supabase.com/docs/guides/functions/schedule-functions) - pg_cron + pg_net pattern

### Secondary (MEDIUM confidence)
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits) - bucket-level file_size_limit
- [Supabase Storage Creating Buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets) - SQL bucket creation
- WebSearch results on storage.buckets table structure (multiple sources agree)

### Tertiary (LOW confidence)
- Full storage.objects column list (inferred from multiple sources, not definitive)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using built-in Supabase features with official documentation
- Architecture: HIGH - Follows documented Supabase patterns for metadata + storage separation
- Pitfalls: MEDIUM - Based on documentation warnings and community issues
- RLS patterns: HIGH - Directly from official access control documentation

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - Supabase Storage API is stable)
