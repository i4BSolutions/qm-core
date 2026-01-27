# Architecture Patterns for V1.1 Feature Integration

**Project:** QM System V1.1 Enhancement
**Researched:** 2026-01-27
**Context:** Integrating file storage, dashboard data, and UX improvements into existing Next.js + Supabase architecture

## Executive Summary

This research addresses how to integrate four new feature categories into an existing Next.js 14+ application with Supabase backend: (1) file attachments with RLS-based access control, (2) live dashboard with aggregated data, (3) quick status changes with audit logging, and (4) file metadata storage design. The existing architecture already includes comprehensive RLS policies, database triggers for audit logging, and a well-established pattern for entity management. The recommended approach leverages existing patterns while introducing minimal new architectural components.

**Key Recommendations:**
- **File Storage:** Separate metadata table with RLS policies mirroring existing entity permissions
- **Dashboard Data:** On-demand queries with materialized views for aggregations (NOT real-time subscriptions)
- **Status Changes:** Server Actions with existing audit trigger system (no new logging layer needed)
- **Metadata Storage:** Separate table over JSON fields for queryability and referential integrity

## Recommended Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js 14 App Router                         │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ Client         │  │ Server       │  │ Server Components   │    │
│  │ Components     │──│ Actions      │──│ (Data Fetching)     │    │
│  │ (Interactive)  │  │ (Mutations)  │  │                     │    │
│  └────────────────┘  └──────────────┘  └─────────────────────┘    │
│         │                   │                      │                │
└─────────┼───────────────────┼──────────────────────┼────────────────┘
          │                   │                      │
          ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Supabase Platform                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐   │
│  │  Storage    │  │  Database   │  │  Auth                    │   │
│  │  (Buckets)  │  │  (Postgres) │  │  (Row Level Security)    │   │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘   │
│         │                │                       │                  │
│         │      ┌─────────▼──────────┐           │                  │
│         │      │  Audit System      │◄──────────┘                  │
│         │      │  - audit_logs      │                              │
│         │      │  - Triggers (26)   │                              │
│         │      └────────────────────┘                              │
│         │                                                           │
│  ┌──────▼────────────────────────────────────────────────────┐    │
│  │  File Metadata Table (NEW)                                │    │
│  │  - entity_type, entity_id                                 │    │
│  │  - storage_path, file_name, file_size                     │    │
│  │  - uploaded_by (FK to users)                              │    │
│  │  - RLS policies mirror entity access                      │    │
│  └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────┐    │
│  │  Dashboard Views (NEW - Materialized)                      │    │
│  │  - qmrl_status_counts (refreshed on-demand)               │    │
│  │  - qmhq_status_counts                                      │    │
│  │  - low_stock_items                                         │    │
│  │  - recent_activity (last 5 audit logs)                    │    │
│  └───────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries and Responsibilities

### 1. File Storage System

#### Components

| Component | Responsibility | Layer |
|-----------|---------------|-------|
| **Storage Bucket** | Stores actual file bytes | Supabase Storage |
| **file_attachments Table** | Stores file metadata, entity relationships | Database |
| **RLS Policies on file_attachments** | Control who can insert/select/delete metadata | Database |
| **RLS Policies on storage.objects** | Control who can upload/download/delete files | Supabase Storage |
| **FileUploadForm Client Component** | Handle file selection, validation | Next.js Client |
| **uploadFileAction Server Action** | Coordinate upload (metadata + storage) | Next.js Server |
| **FileList Client Component** | Display files with preview/delete actions | Next.js Client |
| **deleteFileAction Server Action** | Coordinate deletion (storage + metadata) | Next.js Server |

#### Data Flow: File Upload

```
1. User selects file in FileUploadForm (client component)
   │
   ▼
2. Client validates: file size (≤25MB), file type (PDF, Word, Excel, Images)
   │
   ▼
3. Client calls uploadFileAction(formData) server action
   │
   ▼
4. Server Action:
   a. Validates user permissions (can edit entity?)
   b. Generates unique file path: {entity_type}/{entity_id}/{timestamp}_{filename}
   c. Uploads to Supabase Storage: supabase.storage.from('attachments').upload()
   d. Inserts metadata row in file_attachments table
   e. Audit log auto-created via trigger
   │
   ▼
5. Server returns success + file metadata to client
   │
   ▼
6. Client revalidates page to show new file in list
```

**Key Decision: Two-Phase Upload**
- Upload to Storage FIRST, then insert metadata
- If metadata insert fails, delete from storage (cleanup)
- If storage upload fails, no metadata created (atomic)

#### Data Flow: File Download/Preview

```
1. User clicks file in FileList component
   │
   ▼
2. Client checks file type:
   - Image (PNG, JPG, GIF) → Display in-app modal with img tag
   - PDF → Display in iframe or object tag
   - Others → Trigger download
   │
   ▼
3. Client calls getFileUrl server action
   │
   ▼
4. Server Action:
   a. Validates user can access entity (via RLS)
   b. Generates signed URL: supabase.storage.from('attachments').createSignedUrl(path, 60)
   c. Returns URL with 60-second expiration
   │
   ▼
5. Client uses signed URL in img/iframe or downloads
```

**Why Signed URLs:**
- Storage bucket is private
- RLS policies on storage.objects check file_attachments ownership
- Signed URLs provide temporary access without exposing storage key

#### Database Schema: file_attachments Table

```sql
CREATE TABLE file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity relationship (polymorphic)
  entity_type TEXT NOT NULL CHECK (entity_type IN ('qmrl', 'qmhq')),
  entity_id UUID NOT NULL,

  -- File metadata
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- bytes
  file_type TEXT NOT NULL, -- MIME type
  storage_path TEXT NOT NULL UNIQUE, -- Path in storage bucket

  -- Access control
  uploaded_by UUID REFERENCES users(id) NOT NULL,

  -- Soft delete
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_file_attachments_entity ON file_attachments(entity_type, entity_id);
CREATE INDEX idx_file_attachments_uploaded_by ON file_attachments(uploaded_by);
CREATE INDEX idx_file_attachments_created_at ON file_attachments(created_at DESC);
```

#### RLS Policies: file_attachments

**Pattern: Mirror Entity Permissions**

File access should follow the same rules as the entity it's attached to.

```sql
-- SELECT: Can view files if can view entity
CREATE POLICY file_attachments_select ON file_attachments
  FOR SELECT USING (
    CASE entity_type
      WHEN 'qmrl' THEN EXISTS (
        SELECT 1 FROM qmrl
        WHERE id = entity_id
        AND (
          -- Admin/Quartermaster see all
          get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
          -- Requester sees own
          OR (get_user_role() = 'requester' AND requester_id = auth.uid())
        )
      )
      WHEN 'qmhq' THEN EXISTS (
        SELECT 1 FROM qmhq
        WHERE id = entity_id
        AND (
          -- Same as qmhq RLS policy
          get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
          OR (get_user_role() = 'requester' AND owns_qmhq(id))
        )
      )
    END
  );

-- INSERT: Can upload files if can edit entity
CREATE POLICY file_attachments_insert ON file_attachments
  FOR INSERT WITH CHECK (
    CASE entity_type
      WHEN 'qmrl' THEN EXISTS (
        SELECT 1 FROM qmrl
        WHERE id = entity_id
        AND (
          get_user_role() IN ('admin', 'quartermaster', 'proposal', 'frontline')
          OR (get_user_role() = 'requester' AND requester_id = auth.uid())
        )
      )
      WHEN 'qmhq' THEN EXISTS (
        SELECT 1 FROM qmhq
        WHERE id = entity_id
        AND get_user_role() IN ('admin', 'quartermaster', 'proposal', 'finance', 'inventory')
      )
    END
  );

-- DELETE: Can delete own files OR admin/quartermaster can delete any
CREATE POLICY file_attachments_delete ON file_attachments
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR get_user_role() IN ('admin', 'quartermaster')
  );
```

#### RLS Policies: storage.objects

**Pattern: Check file_attachments Ownership**

```sql
-- Upload: Must have insert permission on file_attachments
CREATE POLICY storage_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (
      -- Check that user can create attachment for this path
      -- Path format: {entity_type}/{entity_id}/{filename}
      -- This is validated in server action before upload
      true -- Rely on server action validation
    )
  );

-- Download: Must have select permission on file_attachments
CREATE POLICY storage_download ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM file_attachments
      WHERE storage_path = name
      AND is_active = true
      -- RLS on file_attachments will filter based on entity access
    )
  );

-- Delete: Must have delete permission on file_attachments
CREATE POLICY storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM file_attachments
      WHERE storage_path = name
      AND (
        uploaded_by = auth.uid()
        OR get_user_role() IN ('admin', 'quartermaster')
      )
    )
  );
```

**Important:** Supabase Storage RLS policies are checked AFTER metadata is persisted. The server action pattern (validate → upload → insert metadata) ensures proper authorization.

#### File Size and Type Validation

**Client-Side (Immediate Feedback):**
```typescript
// In FileUploadForm component
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/gif',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 25MB limit' };
  }
  return { valid: true };
}
```

**Server-Side (Security Boundary):**
```typescript
// In uploadFileAction server action
async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File;

  // Re-validate on server
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large');
  }

  // Proceed with upload...
}
```

**File Count Limit:**
```sql
-- Add constraint to file_attachments table
ALTER TABLE file_attachments
ADD CONSTRAINT check_file_count_per_entity
CHECK (
  (SELECT COUNT(*)
   FROM file_attachments
   WHERE entity_type = NEW.entity_type
   AND entity_id = NEW.entity_id
   AND is_active = true) <= 10
);
```

**Note:** Constraint may impact performance. Consider checking count in server action instead.

### 2. Dashboard Data System

#### Components

| Component | Responsibility | Layer |
|-----------|---------------|-------|
| **DashboardPage Server Component** | Fetch all dashboard data on page load | Next.js Server |
| **Dashboard Utility Functions** | Query database for counts/aggregates | Next.js Server |
| **Materialized Views (Optional)** | Cache expensive aggregations | Database |
| **Status Count Aggregates** | COUNT qmrl/qmhq by status_group | Database Query |
| **Recent Activity Query** | Fetch last 5 audit_logs with entity names | Database Query |
| **Low Stock Query** | Items with total inventory < 10 units | Database Query |

#### Data Flow: Dashboard Load

```
1. User navigates to /dashboard
   │
   ▼
2. DashboardPage Server Component renders
   │
   ▼
3. Server Component calls dashboard utility functions in parallel:
   - getQMRLStatusCounts()
   - getQMHQStatusCounts()
   - getRecentActivity()
   - getLowStockItems()
   │
   ▼
4. Each function queries database:
   - Direct queries on qmrl/qmhq/audit_logs tables
   - OR queries on materialized views (if implemented)
   │
   ▼
5. Server Component renders with data (no client-side loading state)
   │
   ▼
6. Page fully rendered on server, sent to client
```

**Key Decision: On-Demand Queries (NOT Real-Time Subscriptions)**

**Rationale:**
- Dashboard is only viewed by Admin/Quartermaster roles (small audience)
- Data changes are infrequent (not a live chat or collaborative editor)
- Real-time subscriptions add complexity: connection management, memory overhead, WebSocket connections
- Each subscription creates a persistent connection → resource intensive for dashboard with 6-8 queries
- Polling at 6s intervals (mentioned in research) is still more overhead than on-demand
- Next.js Server Components already provide fast server-side rendering
- User can manually refresh if they want latest data (F5)

**When to Use Real-Time (NOT for this dashboard):**
- High-frequency updates (multiple times per second)
- Collaborative editing (multiple users updating same data)
- Critical notifications (must appear immediately without refresh)

**Performance Optimization: Materialized Views (Optional)**

If dashboard becomes slow (> 2 seconds load time), create materialized views:

```sql
-- Materialized view for QMRL status counts
CREATE MATERIALIZED VIEW mv_qmrl_status_counts AS
SELECT
  sc.status_group,
  COUNT(*) as count
FROM qmrl q
JOIN status_config sc ON q.status_id = sc.id
WHERE q.is_active = true AND sc.entity_type = 'qmrl'
GROUP BY sc.status_group;

-- Refresh function (called after qmrl updates)
CREATE OR REPLACE FUNCTION refresh_qmrl_status_counts()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_qmrl_status_counts;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh after qmrl changes
CREATE TRIGGER trg_refresh_qmrl_status_counts
AFTER INSERT OR UPDATE OR DELETE ON qmrl
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_qmrl_status_counts();
```

**Trade-off:**
- **Pros:** Faster dashboard queries (pre-computed aggregates)
- **Cons:** Adds trigger overhead on every qmrl change, more database complexity

**Recommendation:** Start with direct queries. Add materialized views only if dashboard load time exceeds 2 seconds.

#### Dashboard Query Patterns

**QMRL Status Counts:**
```sql
-- Query: Count QMRL by status group
SELECT
  sc.status_group,
  COUNT(*) as count
FROM qmrl q
JOIN status_config sc ON q.status_id = sc.id
WHERE q.is_active = true
  AND sc.entity_type = 'qmrl'
GROUP BY sc.status_group;

-- Returns: { to_do: 12, in_progress: 8, done: 45 }
```

**QMHQ Status Counts:**
```sql
-- Same pattern as QMRL
SELECT
  sc.status_group,
  COUNT(*) as count
FROM qmhq q
JOIN status_config sc ON q.status_id = sc.id
WHERE q.is_active = true
  AND sc.entity_type = 'qmhq'
GROUP BY sc.status_group;
```

**Recent Activity:**
```sql
-- Query: Last 5 audit logs with entity details
SELECT
  al.id,
  al.entity_type,
  al.entity_id,
  al.action,
  al.changes_summary,
  al.changed_by_name,
  al.changed_at,
  -- Get entity title based on type
  CASE al.entity_type
    WHEN 'qmrl' THEN (SELECT title FROM qmrl WHERE id = al.entity_id)
    WHEN 'qmhq' THEN (SELECT line_name FROM qmhq WHERE id = al.entity_id)
    WHEN 'purchase_orders' THEN (SELECT po_number FROM purchase_orders WHERE id = al.entity_id)
    WHEN 'invoices' THEN (SELECT invoice_number FROM invoices WHERE id = al.entity_id)
  END as entity_title
FROM audit_logs al
WHERE al.entity_type IN ('qmrl', 'qmhq', 'purchase_orders', 'invoices')
ORDER BY al.changed_at DESC
LIMIT 5;
```

**Low Stock Items:**
```sql
-- Query: Items with total inventory < 10 units
SELECT
  i.id,
  i.name,
  i.item_code,
  SUM(
    CASE it.direction
      WHEN 'in' THEN it.quantity
      WHEN 'out' THEN -it.quantity
    END
  ) as total_quantity
FROM items i
LEFT JOIN inventory_transactions it ON i.id = it.item_id
WHERE i.is_active = true
GROUP BY i.id, i.name, i.item_code
HAVING SUM(
  CASE it.direction
    WHEN 'in' THEN it.quantity
    WHEN 'out' THEN -it.quantity
    ELSE 0
  END
) < 10
ORDER BY total_quantity ASC;
```

**Performance Note:** Low stock query aggregates inventory transactions. Consider adding a `current_stock` field to items table, updated via trigger on inventory_transactions, to avoid aggregation on every dashboard load.

#### Dashboard Utility Functions

**Location:** `/lib/utils/dashboard.ts`

```typescript
// Server-side utility functions
import { createClient } from '@/lib/supabase/server';

export async function getQMRLStatusCounts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('qmrl')
    .select('status_id, status_config(status_group)')
    .eq('is_active', true);

  // Group by status_group
  const counts = { to_do: 0, in_progress: 0, done: 0 };
  data?.forEach(item => {
    counts[item.status_config.status_group]++;
  });
  return counts;
}

export async function getRecentActivity() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .in('entity_type', ['qmrl', 'qmhq', 'purchase_orders', 'invoices'])
    .order('changed_at', { ascending: false })
    .limit(5);

  // Fetch entity titles separately (Supabase doesn't support CASE in select)
  // This is acceptable for 5 records
  const withTitles = await Promise.all(
    data?.map(async (log) => {
      let title = '';
      if (log.entity_type === 'qmrl') {
        const { data: qmrl } = await supabase
          .from('qmrl')
          .select('title')
          .eq('id', log.entity_id)
          .single();
        title = qmrl?.title || '';
      }
      // Repeat for other entity types...
      return { ...log, entity_title: title };
    }) || []
  );

  return withTitles;
}

// Similar functions for other dashboard widgets...
```

#### Refresh Mechanism

**User-Initiated Refresh:**
- User presses F5 to reload page (natural browser behavior)
- No "Refresh" button needed initially

**Automatic Background Refresh (Future Enhancement):**
- If needed, use Next.js `revalidatePath()` in Server Actions that modify data
- Example: After creating QMRL, call `revalidatePath('/dashboard')`
- Next time dashboard is visited, it fetches fresh data

**Not Recommended:**
- Client-side polling (setInterval) → unnecessary overhead
- Real-time subscriptions → too complex for this use case

### 3. Quick Status Change System

#### Components

| Component | Responsibility | Layer |
|-----------|---------------|-------|
| **StatusBadge Client Component** | Clickable badge that opens status picker | Next.js Client |
| **StatusPicker Client Component** | Dropdown/modal with status options | Next.js Client |
| **updateStatusAction Server Action** | Update status_id in database | Next.js Server |
| **Existing Audit Trigger** | Auto-logs status change to audit_logs | Database |

#### Data Flow: Quick Status Change

```
1. User clicks status badge on QMRL/QMHQ card
   │
   ▼
2. StatusPicker modal/dropdown opens with status options
   │
   ▼
3. User selects new status
   │
   ▼
4. Client calls updateStatusAction(entityType, entityId, newStatusId)
   │
   ▼
5. Server Action:
   a. Validates user permissions (can update entity?)
   b. Updates status_id in qmrl/qmhq table
   c. Audit trigger fires automatically (see migration 026)
   d. Audit log created with action='status_change'
   │
   ▼
6. Server returns success
   │
   ▼
7. Client revalidates page/row to show new status
```

**Key Decision: Use Existing Audit System (No New Logging Layer)**

The existing audit trigger (migration 026) already handles status changes:

```sql
-- From migration 026_audit_triggers.sql (lines 107-138)
IF TG_TABLE_NAME IN ('qmrl', 'qmhq', 'purchase_orders', 'invoices') THEN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    audit_action := 'status_change';

    -- Get status names for summary
    DECLARE
      old_status_name TEXT;
      new_status_name TEXT;
    BEGIN
      SELECT name INTO old_status_name FROM public.status_config WHERE id = OLD.status_id;
      SELECT name INTO new_status_name FROM public.status_config WHERE id = NEW.status_id;

      summary := 'Status changed from "' || COALESCE(old_status_name, 'None') ||
                 '" to "' || COALESCE(new_status_name, 'None') || '"';
    END;

    INSERT INTO public.audit_logs (
      entity_type, entity_id, action,
      field_name, old_value, new_value,
      changes_summary,
      changed_by, changed_by_name, changed_at
    ) VALUES (
      TG_TABLE_NAME, NEW.id, audit_action,
      'status_id', OLD.status_id::TEXT, NEW.status_id::TEXT,
      summary,
      audit_user_id, audit_user_name, NOW()
    );
  END IF;
END IF;
```

**What This Means:**
- Server Action just updates `status_id` field
- Trigger detects the change and creates audit log automatically
- No need to manually call audit logging in Server Action
- Audit log includes status names (not just IDs) for human readability

#### Server Action Implementation

**Location:** `/app/actions/status.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateStatusAction(
  entityType: 'qmrl' | 'qmhq',
  entityId: string,
  newStatusId: string
) {
  const supabase = createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  // Update status (RLS policy will check permissions)
  const { error } = await supabase
    .from(entityType)
    .update({
      status_id: newStatusId,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', entityId);

  if (error) {
    if (error.code === '42501') { // RLS policy violation
      throw new Error('You do not have permission to update this status');
    }
    throw new Error(error.message);
  }

  // Revalidate the page to show updated status
  revalidatePath(`/${entityType}`);
  revalidatePath(`/${entityType}/${entityId}`);

  return { success: true };
}
```

**Permission Validation:**
- RLS policies (migration 027) already enforce who can update qmrl/qmhq
- If user lacks permission, Postgres returns 42501 error
- Server Action catches this and returns user-friendly error

**No Explicit Audit Logging:**
- Audit trigger fires automatically on UPDATE
- Server Action doesn't need to call any audit logging functions

#### Status Badge Component

**Location:** `/components/ui/status-badge.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { updateStatusAction } from '@/app/actions/status';

interface StatusBadgeProps {
  entityType: 'qmrl' | 'qmhq';
  entityId: string;
  currentStatusId: string;
  currentStatusName: string;
  currentStatusColor: string;
  availableStatuses: Array<{
    id: string;
    name: string;
    color: string;
    status_group: string;
  }>;
  editable?: boolean; // Only show dropdown if user can edit
}

export function StatusBadge({
  entityType,
  entityId,
  currentStatusId,
  currentStatusName,
  currentStatusColor,
  availableStatuses,
  editable = false,
}: StatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleStatusChange(newStatusId: string) {
    setIsUpdating(true);
    try {
      await updateStatusAction(entityType, entityId, newStatusId);
      setIsOpen(false);
      // Page will refresh automatically via revalidatePath
    } catch (error) {
      alert(error.message);
    } finally {
      setIsUpdating(false);
    }
  }

  if (!editable) {
    // Read-only badge
    return (
      <span
        className="px-3 py-1 rounded-full text-sm font-medium"
        style={{ backgroundColor: currentStatusColor, color: '#fff' }}
      >
        {currentStatusName}
      </span>
    );
  }

  // Editable badge with dropdown
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1 rounded-full text-sm font-medium hover:opacity-80 transition"
        style={{ backgroundColor: currentStatusColor, color: '#fff' }}
      >
        {currentStatusName}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200">
          {availableStatuses.map((status) => (
            <button
              key={status.id}
              onClick={() => handleStatusChange(status.id)}
              disabled={isUpdating || status.id === currentStatusId}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
            >
              <span>{status.name}</span>
              {status.id === currentStatusId && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Editable Prop Logic:**
- Server Component determines if user can edit (based on role + ownership)
- Passes `editable` prop to StatusBadge
- If false, renders static badge (no click handler)

### 4. File Metadata Storage Design

#### Decision: Separate Table (Not JSON Field)

**Rationale:**

| Criterion | Separate Table | JSON Field |
|-----------|---------------|------------|
| **Queryability** | Can filter/search by file_name, file_size, uploaded_by | Must parse JSON in WHERE clause (slow) |
| **Referential Integrity** | FK to users(id) enforced by database | No enforcement, data can become inconsistent |
| **Indexing** | Can index individual columns (entity_id, uploaded_by) | Cannot index inside JSON (Postgres JSONB indexes are limited) |
| **Schema Evolution** | Add columns with ALTER TABLE | Must parse entire JSON, modify, serialize back |
| **Type Safety** | PostgreSQL enforces column types | JSON allows any structure (error-prone) |
| **Join Performance** | Native JOIN on uploaded_by → users | Must extract from JSON before joining |
| **Audit Integration** | Audit triggers see individual field changes | Audit sees entire JSON blob changed |
| **RLS Policies** | Can check columns directly in policy expressions | Must extract from JSON in policies (complex) |

**Conclusion:** Separate table is superior for this use case.

**When JSON Fields Are Appropriate:**
- Truly schemaless data (e.g., custom metadata fields per file type)
- Data that's never queried (only stored and retrieved as blob)
- Highly variable structure that changes frequently

**For File Attachments:**
- File name, size, type, uploaded_by are ALWAYS present
- Need to query by entity_id (show all files for QMRL)
- Need to filter by uploaded_by (show my uploads)
- Need referential integrity with users table

**Hybrid Approach (Optional):**
If additional metadata is needed later (e.g., image dimensions, PDF page count), add a `metadata JSONB` column to file_attachments table for truly variable data.

```sql
ALTER TABLE file_attachments
ADD COLUMN metadata JSONB DEFAULT '{}';

-- Example metadata for images
{
  "width": 1920,
  "height": 1080,
  "format": "PNG"
}

-- Example metadata for PDFs
{
  "pages": 12,
  "hasAnnotations": true
}
```

## Component Integration Map

### How New Components Connect to Existing Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Existing System                              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ QMRL/QMHQ      │  │ Users        │  │ Audit System        │    │
│  │ Entities       │  │ + RLS        │  │ (26 triggers)       │    │
│  └────────────────┘  └──────────────┘  └─────────────────────┘    │
│         │                   │                      │                │
│         │                   │                      │                │
│         ▼                   ▼                      ▼                │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              New V1.1 Components                         │       │
│  │                                                          │       │
│  │  1. file_attachments table                              │       │
│  │     - FKs to qmrl/qmhq (entity_id)                      │       │
│  │     - FK to users (uploaded_by)                         │       │
│  │     - RLS mirrors entity permissions                    │       │
│  │     - Audit trigger auto-applies                        │       │
│  │                                                          │       │
│  │  2. Dashboard queries                                   │       │
│  │     - JOINs qmrl + status_config                        │       │
│  │     - JOINs qmhq + status_config                        │       │
│  │     - Queries audit_logs (no new table)                 │       │
│  │     - Aggregates inventory_transactions                 │       │
│  │                                                          │       │
│  │  3. Status change Server Actions                        │       │
│  │     - UPDATEs qmrl.status_id / qmhq.status_id           │       │
│  │     - Triggers existing audit system                    │       │
│  │     - No new audit logging code                         │       │
│  │                                                          │       │
│  └─────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Integration Points:**

1. **File Attachments → Entities**
   - Polymorphic relationship via `entity_type` + `entity_id`
   - RLS policies use EXISTS subqueries to check entity access
   - No changes to qmrl/qmhq tables

2. **File Attachments → Users**
   - FK `uploaded_by` references users(id)
   - RLS policies allow deletion by uploader or admin
   - Audit logs capture file operations via existing triggers

3. **Dashboard → Multiple Tables**
   - Server Component queries 4 different data sources
   - No new tables (uses qmrl, qmhq, audit_logs, inventory_transactions)
   - Materialized views are optional optimization

4. **Status Changes → Audit System**
   - Server Action updates single field (status_id)
   - Existing audit trigger (lines 107-138 in migration 026) handles logging
   - No new code in audit system

## Build Order and Dependencies

### Phase 1: File Storage Foundation (Days 1-2)

**Deliverables:**
1. Create `file_attachments` table migration
2. Create RLS policies for `file_attachments`
3. Create Supabase Storage bucket `attachments` (private)
4. Create RLS policies for `storage.objects`
5. Write utility functions for file operations (`/lib/utils/files.ts`)

**Dependencies:** None (independent of other V1.1 features)

**Testing:** Upload/download/delete files manually via SQL and Supabase Dashboard

---

### Phase 2: File Upload UI (Days 3-4)

**Deliverables:**
1. Create `uploadFileAction` Server Action
2. Create `FileUploadForm` client component
3. Create `getFileUrl` Server Action (for signed URLs)
4. Integrate upload form into QMRL create/detail pages
5. Integrate upload form into QMHQ create/detail pages

**Dependencies:** Phase 1 (file_attachments table + storage bucket)

**Testing:** Upload files from QMRL/QMHQ forms, verify metadata in database

---

### Phase 3: File Display and Management (Days 5-6)

**Deliverables:**
1. Create `FileList` client component
2. Create `FilePreview` component (modal with image/PDF preview)
3. Create `deleteFileAction` Server Action
4. Display files on QMRL detail page
5. Display files on QMHQ detail page

**Dependencies:** Phase 2 (upload actions)

**Testing:** View, preview, and delete files from entity detail pages

---

### Phase 4: Dashboard Data Queries (Day 7)

**Deliverables:**
1. Create dashboard utility functions (`/lib/utils/dashboard.ts`)
   - `getQMRLStatusCounts()`
   - `getQMHQStatusCounts()`
   - `getRecentActivity()`
   - `getLowStockItems()`
2. Write unit tests for utility functions

**Dependencies:** None (queries existing tables)

**Testing:** Run functions in Node REPL, verify correct counts

---

### Phase 5: Dashboard UI (Day 8)

**Deliverables:**
1. Update `/app/(dashboard)/dashboard/page.tsx`
2. Replace placeholder data with real queries
3. Add loading states (Suspense boundaries)
4. Style stat cards with real data

**Dependencies:** Phase 4 (dashboard utility functions)

**Testing:** Navigate to dashboard, verify correct counts, check loading states

---

### Phase 6: Quick Status Change (Day 9)

**Deliverables:**
1. Create `updateStatusAction` Server Action
2. Create `StatusBadge` client component with dropdown
3. Integrate StatusBadge into QMRL list/detail pages
4. Integrate StatusBadge into QMHQ list/detail pages
5. Add permission checks (editable prop based on user role)

**Dependencies:** None (uses existing audit system)

**Testing:** Change status from badge, verify audit log created, check permissions

---

### Phase 7: Transaction Detail Modal (Day 10)

**Deliverables:**
1. Create `TransactionDetailModal` component
2. Create `updateTransactionAction` Server Action (date + notes only)
3. Add "View Details" button to transaction tables
4. Implement edit functionality (date/notes editable, amount locked)

**Dependencies:** None (uses existing financial_transactions table)

**Testing:** Edit transaction date/notes, verify amount cannot be changed

---

### Phase 8: Integration Testing and Bug Fixes (Days 11-12)

**Deliverables:**
1. Test all features end-to-end
2. Fix PO creation workflow (existing bug)
3. Fix stock-in functionality (existing bug)
4. Verify invoice creation works
5. Verify stock-out functionality
6. Test RLS policies with different user roles

**Dependencies:** All previous phases

**Testing:** Full regression testing with different user roles

---

## Critical Path Analysis

**Longest Path:** File Storage (Phases 1-3) = 6 days

**Parallel Tracks:**
- Dashboard (Phases 4-5) can run parallel to File Display (Phase 3)
- Status Change (Phase 6) can run parallel to Dashboard UI (Phase 5)
- Transaction Modal (Phase 7) is independent

**Optimal Schedule:**
```
Days 1-2:  Phase 1 (File Storage Foundation)
Days 3-4:  Phase 2 (File Upload UI)
Days 5-6:  Phase 3 (File Display) + Phase 4 (Dashboard Queries) [parallel]
Days 7-8:  Phase 5 (Dashboard UI) + Phase 6 (Status Change) [parallel]
Day 9:     Phase 7 (Transaction Modal)
Days 10-12: Phase 8 (Integration Testing)
```

**Total Duration:** 12 days (with parallelization)

## Performance Considerations

### File Storage Performance

**Bottlenecks:**
- Large file uploads (25MB) over slow connections
- Multiple file uploads simultaneously

**Optimizations:**
1. **Client-side compression** for images before upload (optional)
2. **Upload progress indicators** to show status
3. **Chunk uploads** for files > 10MB (Supabase supports multipart upload)
4. **Lazy load file list** (paginate if > 10 files)

**Monitoring:**
- Track average upload time in server action
- Alert if > 10 seconds for files < 5MB

### Dashboard Performance

**Bottlenecks:**
- Aggregation queries (COUNT, SUM) on large tables
- Multiple sequential queries (4 separate fetches)

**Optimizations:**
1. **Parallel queries** using Promise.all() (already recommended)
2. **Indexes** on frequently queried columns:
   - `qmrl(status_id, is_active)`
   - `qmhq(status_id, is_active)`
   - `audit_logs(changed_at DESC)`
3. **Materialized views** if queries exceed 2 seconds (future optimization)
4. **Connection pooling** (already enabled in Supabase)

**Monitoring:**
- Track dashboard load time
- Target: < 1 second for initial render
- Alert if > 2 seconds

**PostgreSQL 17 Benefits (2026):**
- Incremental VACUUM reduces bloat
- Parallel query execution for aggregations
- Bi-directional indexes improve ORDER BY performance

### Status Change Performance

**Bottlenecks:**
- Audit trigger execution time (inserts to audit_logs)
- Revalidation of multiple pages

**Optimizations:**
1. **Audit trigger is already optimized** (SECURITY DEFINER, simple INSERT)
2. **Revalidate only necessary paths** (not entire site)
3. **Optimistic UI updates** (show new status immediately, rollback on error)

**Monitoring:**
- Track server action response time
- Target: < 500ms
- Alert if > 1 second

## Security Considerations

### File Storage Security

**Threats:**
1. **Malicious file uploads** (viruses, malware)
2. **Unauthorized file access** (viewing other users' files)
3. **File type spoofing** (renaming .exe to .pdf)
4. **Storage exhaustion** (uploading many large files)

**Mitigations:**
1. **File type validation:** Check MIME type on server (not just extension)
2. **File size limits:** 25MB per file, 10 files per entity
3. **Virus scanning:** Not in V1.1 scope (consider Supabase Edge Function integration later)
4. **RLS policies:** Enforce entity-level access control
5. **Signed URLs:** Time-limited access (60 seconds) for downloads
6. **Storage quotas:** Monitor total storage usage per organization

**Additional Hardening:**
- Reject files with double extensions (e.g., `file.pdf.exe`)
- Sanitize file names (remove special characters)
- Store files with UUIDs, not user-provided names

### Dashboard Security

**Threats:**
1. **Unauthorized access** (non-admin viewing dashboard)
2. **Data leakage** (seeing other users' activity)

**Mitigations:**
1. **Role check in page component:**
   ```typescript
   // In DashboardPage
   const user = await getUser();
   if (!['admin', 'quartermaster'].includes(user.role)) {
     redirect('/qmrl'); // Redirect to main page
   }
   ```
2. **RLS policies:** Audit logs already filtered by user permissions
3. **Server Components:** Data never sent to client (no client-side filtering)

### Status Change Security

**Threats:**
1. **Unauthorized status changes** (requester changing status to "Completed")
2. **Status manipulation** (skipping approval steps)

**Mitigations:**
1. **RLS policies:** Enforce update permissions (already in place)
2. **Server Actions:** All updates go through server (no direct client queries)
3. **Audit logs:** Every status change is logged with user name
4. **Status transitions:** Consider adding validation (e.g., can only go from Draft → Pending, not Draft → Completed)

**Future Enhancement: Status Transition Rules**
```sql
-- Add constraint to enforce status transitions
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Example: Draft can only go to Pending Review or Rejected
  IF OLD.status_id = (SELECT id FROM status_config WHERE name = 'Draft' AND entity_type = TG_TABLE_NAME)
     AND NEW.status_id NOT IN (
       SELECT id FROM status_config
       WHERE name IN ('Pending Review', 'Rejected')
       AND entity_type = TG_TABLE_NAME
     ) THEN
    RAISE EXCEPTION 'Invalid status transition from Draft';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Anti-Patterns to Avoid

### File Storage Anti-Patterns

**❌ Storing File Bytes in Database**
- **Why Bad:** PostgreSQL BYTEA columns are slower than object storage
- **Why Bad:** Increases database backup size dramatically
- **Why Bad:** No CDN caching for file delivery
- **Do Instead:** Use Supabase Storage (S3-compatible object storage)

**❌ Public Storage Bucket with Client-Side Access Control**
- **Why Bad:** Files are accessible to anyone with URL
- **Why Bad:** RLS policies are bypassed
- **Do Instead:** Private bucket + RLS policies + signed URLs

**❌ Storing Multiple Files in Single JSON Column**
- **Why Bad:** Cannot query individual files
- **Why Bad:** Must download entire JSON to check if file exists
- **Do Instead:** Separate row per file in file_attachments table

**❌ Using File Name as Primary Key**
- **Why Bad:** File names are not unique (different entities can have same file name)
- **Why Bad:** Renaming file breaks references
- **Do Instead:** UUID primary key, file_name as separate column

### Dashboard Anti-Patterns

**❌ Client-Side Data Fetching with Loading States**
- **Why Bad:** Introduces waterfall requests (layout → dashboard → data)
- **Why Bad:** Data fetching logic in client components (harder to test)
- **Why Bad:** More client-side JavaScript = slower initial render
- **Do Instead:** Server Components fetch data before rendering

**❌ Real-Time Subscriptions for Dashboard Aggregates**
- **Why Bad:** Persistent WebSocket connections for infrequent updates
- **Why Bad:** Adds connection management complexity
- **Why Bad:** Each subscription = memory overhead
- **Do Instead:** On-demand queries with manual refresh (F5)

**❌ Polling Every 5 Seconds**
- **Why Bad:** Unnecessary database load
- **Why Bad:** Battery drain on mobile devices
- **Why Bad:** Doesn't scale (10 dashboard viewers = 120 queries/min)
- **Do Instead:** On-demand queries triggered by user action

**❌ N+1 Queries in Dashboard**
- **Example:** Fetch activity logs, then fetch entity name for each log (5 logs = 6 queries)
- **Why Bad:** Multiple round-trips to database
- **Do Instead:** Single query with JOINs or Promise.all() for parallel fetches

**❌ Fetching Full Rows When Only Counts Needed**
- **Example:** `SELECT * FROM qmrl` then count in JavaScript
- **Why Bad:** Transfers unnecessary data over network
- **Why Bad:** Wastes database I/O
- **Do Instead:** `SELECT COUNT(*) FROM qmrl WHERE ...`

### Status Change Anti-Patterns

**❌ Dual Audit Logging (Trigger + Manual)**
- **Why Bad:** Creates duplicate audit records
- **Why Bad:** Manual logging can be inconsistent
- **Do Instead:** Let existing audit trigger handle all logging

**❌ Client-Side Status Updates**
- **Why Bad:** Bypasses RLS policies if using service key
- **Why Bad:** Harder to validate permissions
- **Do Instead:** Server Actions that UPDATE database, letting RLS enforce rules

**❌ Revalidating Entire Site After Status Change**
- **Example:** `revalidatePath('/')`
- **Why Bad:** Clears cache for all pages, not just affected entity
- **Why Bad:** Slower page loads for unrelated pages
- **Do Instead:** `revalidatePath('/qmrl')` and `revalidatePath(`/qmrl/${id}`)`

**❌ Optimistic Updates Without Rollback**
- **Example:** Show new status immediately, ignore server errors
- **Why Bad:** UI shows incorrect state if update fails
- **Do Instead:** Show loading state, update UI only after server confirms

## Migration Path from Existing System

### What Already Exists

The existing system (V1.0) provides:
- ✅ RLS policies on all entities (migration 027)
- ✅ Audit triggers on all entities (migration 026)
- ✅ User authentication and role-based permissions
- ✅ QMRL and QMHQ entities with status_config relationships
- ✅ Audit logs table with comprehensive tracking
- ✅ Server Components and Server Actions patterns
- ✅ Supabase client utilities (browser and server)

### What Needs to Be Added

**Database Layer:**
1. `file_attachments` table (new table)
2. RLS policies for `file_attachments` (new policies)
3. Supabase Storage bucket `attachments` (new bucket)
4. RLS policies for `storage.objects` (new policies)
5. Audit trigger for `file_attachments` (applies existing trigger to new table)

**Application Layer:**
6. File upload/download Server Actions
7. File management UI components
8. Dashboard utility functions (queries only)
9. Status change Server Action
10. StatusBadge client component
11. Transaction detail modal

**No Changes Required:**
- ❌ No modifications to existing tables (qmrl, qmhq, users, audit_logs)
- ❌ No modifications to existing RLS policies
- ❌ No modifications to existing audit triggers
- ❌ No modifications to Supabase client setup

### Backward Compatibility

**V1.0 Features Remain Unchanged:**
- Creating/editing QMRL and QMHQ works identically
- Audit history still visible on all entities
- User permissions unchanged
- Existing Server Actions and pages unaffected

**New Features Are Additive:**
- File attachments are optional (entities without files work fine)
- Dashboard is new page (doesn't replace existing pages)
- Quick status change is alternative to edit form (edit form still works)
- Transaction modal is enhancement (existing transaction view still works)

### Rollback Plan

If V1.1 features need to be rolled back:

1. **Remove file upload UI:** Delete file upload components from pages
2. **Keep file_attachments table:** Files already uploaded remain accessible
3. **Disable dashboard:** Remove route or add role redirect
4. **Disable quick status change:** Remove StatusBadge, use edit form only
5. **Database migrations:** Keep all migrations (no data loss)

**Critical:** Do NOT drop `file_attachments` table if files were uploaded. Mark feature as deprecated, remove UI, but preserve data.

## Confidence Assessment

| Aspect | Confidence Level | Rationale |
|--------|------------------|-----------|
| **File Storage Architecture** | HIGH | Supabase Storage RLS patterns are well-documented; separate metadata table is industry standard |
| **Dashboard Query Patterns** | HIGH | Direct queries over real-time subscriptions is appropriate for infrequent updates; PostgreSQL aggregations are well-optimized |
| **Audit Integration** | HIGH | Existing audit trigger system (migration 026) explicitly handles status changes; no new logging needed |
| **Metadata Storage Design** | HIGH | Separate table over JSON is best practice for queryable, relational data |
| **Build Order** | MEDIUM | Dependencies identified correctly, but integration testing may reveal unexpected interactions |
| **Performance Estimates** | MEDIUM | Based on research and existing system knowledge, but actual performance depends on data volume |
| **Security Mitigations** | MEDIUM | RLS policies and Server Actions provide strong security, but virus scanning not in scope |

**Areas Needing Validation:**
- Dashboard query performance with real data volumes (may need materialized views)
- File upload time with 25MB files over typical network conditions
- Storage quota limits and monitoring strategy

## Gaps and Open Questions

### Technical Gaps

1. **Virus Scanning:** Should uploaded files be scanned for malware?
   - **Recommendation:** Out of scope for V1.1; consider Supabase Edge Function integration in V2.0
   - **Mitigation:** File type validation reduces risk of executable uploads

2. **Storage Quota Management:** How to prevent storage exhaustion?
   - **Recommendation:** Monitor total storage usage via Supabase Dashboard
   - **Future Enhancement:** Add org-level storage quota enforcement

3. **File Versioning:** Should file edits create new versions or replace existing?
   - **Current:** Replacement (delete old, upload new)
   - **Future Enhancement:** Version history with `version_of` FK in file_attachments

4. **Image Optimization:** Should images be compressed/resized on upload?
   - **Recommendation:** Not in V1.1 scope
   - **Future Enhancement:** Edge Function to generate thumbnails

### Dashboard Gaps

1. **Refresh Strategy:** When should dashboard data be refreshed?
   - **Current:** Manual refresh (F5)
   - **Future Enhancement:** revalidatePath() in relevant Server Actions

2. **Materialized Views:** When to implement?
   - **Current:** Direct queries
   - **Trigger:** If dashboard load time > 2 seconds

3. **Dashboard Customization:** Can users configure visible widgets?
   - **Current:** Fixed widget set for all Admin/Quartermaster users
   - **Future Enhancement:** User preferences table

### Status Change Gaps

1. **Status Transition Rules:** Should certain transitions be blocked?
   - **Current:** Any status → any status (if user has permissions)
   - **Future Enhancement:** Status FSM with allowed transitions

2. **Bulk Status Changes:** Can user change status of multiple entities at once?
   - **Current:** One at a time
   - **Future Enhancement:** Checkbox selection + bulk action

## Sources

### Supabase Storage & RLS
- [Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage Helper Functions | Supabase Docs](https://supabase.com/docs/guides/storage/schema/helper-functions)

### Real-Time vs Polling
- [Using Realtime with Next.js | Supabase Docs](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)
- [Best Practices for Supabase | Leanware](https://www.leanware.co/insights/supabase-best-practices)
- [Subscribing to Database Changes | Supabase Docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)

### File Upload Patterns
- [Signed URL file uploads with NextJs and Supabase | Medium](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)
- [Complete Guide to File Uploads with Next.js and Supabase Storage](https://supalaunch.com/blog/file-upload-nextjs-supabase)

### Audit Logging
- [Database Design for Audit Logging | Vertabelo](https://vertabelo.com/blog/database-design-for-audit-logging/)
- [Database Audit Logging - The Practical Guide | Bytebase](https://www.bytebase.com/blog/database-audit-logging/)

### Dashboard Performance
- [Postgres for Analytics Workloads: Capabilities and Performance Tips](https://www.epsio.io/blog/postgres-for-analytics-workloads-capabilities-and-performance-tips)
- [Optimizing Database Performance with Materialized Views](https://support.boldbi.com/kb/article/14344/optimizing-database-performance-with-materialized-views-and-pre-aggregated-tables)
- [PostgreSQL Just Got Its Biggest Upgrade | Medium](https://medium.com/@DevBoostLab/postgresql-17-performance-upgrade-2026-f4222e71f577)

### Metadata Storage Design
- [Building a scalable document management system | InfoWorld](https://www.infoworld.com/article/4092063/building-a-scalable-document-management-system-lessons-from-separating-metadata-and-content.html)
- [Store JSON Documents - SQL Server | Microsoft Learn](https://learn.microsoft.com/en-us/sql/relational-databases/json/store-json-documents-in-sql-tables?view=sql-server-ver16)
