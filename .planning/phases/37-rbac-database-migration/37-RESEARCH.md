# Phase 37: RBAC Database Migration - Research

**Researched:** 2026-02-11
**Domain:** PostgreSQL enum migration, RLS policy recreation, zero-downtime database migrations
**Confidence:** HIGH

## Summary

Phase 37 migrates the QM Core database from a 7-role enum system (`admin`, `quartermaster`, `finance`, `inventory`, `proposal`, `frontline`, `requester`) to a streamlined 3-role system (`admin`, `qmrl`, `qmhq`). This migration requires the expand-and-contract pattern for enum types because PostgreSQL cannot directly remove enum values. The migration must also recreate 68+ RLS policies across 11 migration files and update the `has_role()` function that contains hardcoded role hierarchy logic.

**Primary recommendation:** Use a six-step expand-and-contract migration (1. Rename old enum, 2. Create new enum, 3. Add temporary column, 4. Migrate data with mapping function, 5. Swap columns, 6. Drop old enum) combined with transactional RLS policy recreation. Require manual backup via `supabase db dump` before execution. Schedule during maintenance window due to table locks during column type changes.

**Key findings:**
- PostgreSQL enums cannot have values removed - only added or renamed ([PostgreSQL ALTER TYPE docs](https://www.postgresql.org/docs/current/sql-altertype.html))
- Expand-and-contract pattern avoids data loss by creating parallel structures ([xata.io pgroll article](https://xata.io/blog/pgroll-expand-contract))
- Current codebase has 53+ hardcoded role checks in RLS policies in `027_rls_policies.sql`
- `has_role()` function contains brittle role hierarchy logic with 7 WHEN clauses
- RLS policies can be safely recreated in transactions - dropping all policies triggers default-deny (blocks all access until new policies created) ([PostgreSQL RLS docs](https://www.postgresql.org/docs/current/ddl-rowsecurity.html))
- Frontend has only 3 hardcoded role checks (in `dashboard/page.tsx` and `qmhq/[id]/page.tsx`)

## Standard Stack

### Core Technologies (Already in Use)

| Technology | Version | Purpose | Migration Role |
|------------|---------|---------|----------------|
| PostgreSQL | 15.x | Database engine | Native enum support, ALTER TYPE commands |
| Supabase | Latest | PostgreSQL platform | CLI for backups, migration runner |
| SQL migrations | - | Schema versioning | Direct .sql files in `/supabase/migrations/` |

### No New Dependencies Required

This is a pure database schema migration. All tooling already exists:
- PostgreSQL native commands (`CREATE TYPE`, `ALTER TABLE`, `ALTER TYPE`)
- Supabase CLI for backup (`supabase db dump`) and migration execution
- Existing migration infrastructure

### Migration Tools Ecosystem

| Tool | Purpose | Why NOT Using |
|------|---------|---------------|
| pgroll | Automated expand-contract migrations | Overkill - single migration, manual control preferred |
| Alembic | Python-based migration framework | Not applicable - using Supabase/PostgreSQL directly |
| Reshape | Zero-downtime migration tool | Adds complexity - manual approach more transparent |

**Decision:** Use native PostgreSQL commands in `.sql` migration files for maximum transparency and control.

## Architecture Patterns

### Pattern 1: Expand-and-Contract Enum Migration

**What:** PostgreSQL enums are immutable regarding value removal. The expand-and-contract pattern creates a parallel enum type, migrates data, then swaps and drops the old type.

**Why this pattern:** As documented by [Supabase enum docs](https://supabase.com/docs/guides/database/postgres/enums): "Even if you delete every occurrence of an Enum value within a table (and vacuumed away those rows), the target value could still exist in upper index pages. If you delete the pg_enum entry you'll break the index."

**Six-step process:**

```sql
-- Step 1: Rename existing enum (preserves existing data)
ALTER TYPE public.user_role RENAME TO user_role_old;

-- Step 2: Create new enum with target values only
CREATE TYPE public.user_role AS ENUM ('admin', 'qmrl', 'qmhq');

-- Step 3: Add temporary column with new enum type
ALTER TABLE public.users ADD COLUMN role_new public.user_role;

-- Step 4: Migrate data using mapping function
-- Old -> New mapping:
-- admin, quartermaster -> admin
-- finance, inventory, proposal -> qmhq
-- frontline, requester -> qmrl
UPDATE public.users
SET role_new = CASE role_old::text
  WHEN 'admin' THEN 'admin'::public.user_role
  WHEN 'quartermaster' THEN 'admin'::public.user_role
  WHEN 'finance' THEN 'qmhq'::public.user_role
  WHEN 'inventory' THEN 'qmhq'::public.user_role
  WHEN 'proposal' THEN 'qmhq'::public.user_role
  WHEN 'frontline' THEN 'qmrl'::public.user_role
  WHEN 'requester' THEN 'qmrl'::public.user_role
END;

-- Step 5: Swap columns (atomic rename)
ALTER TABLE public.users DROP COLUMN role_old;
ALTER TABLE public.users RENAME COLUMN role_new TO role;

-- Step 6: Drop old enum type
DROP TYPE public.user_role_old;
```

**Source:** Pattern adapted from [blog post on safe enum updates](https://blog.yo1.dog/updating-enum-values-in-postgresql-the-safe-and-easy-way/)

**Important:** Steps 3-5 involve table locks. Schedule during maintenance window.

### Pattern 2: Atomic RLS Policy Recreation

**What:** RLS policies contain hardcoded role checks (`get_user_role() IN ('admin', 'quartermaster', ...)`). These must be updated to reference new role values.

**Challenge:** Dropping policies without immediate recreation creates security gaps.

**PostgreSQL default-deny behavior:** When RLS is enabled on a table but no policies exist, PostgreSQL applies a default-deny policy - **no rows are visible or modifiable to any user** (except superusers with BYPASSRLS). [Source: PostgreSQL RLS documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

**Safe approach:**

```sql
BEGIN;

-- Drop old policies (default-deny immediately takes effect)
DROP POLICY users_insert ON public.users;
DROP POLICY users_update ON public.users;
-- ... (drop all policies for table)

-- Create new policies (restores access with new role checks)
CREATE POLICY users_insert ON public.users
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'  -- Updated to new role values
  );

CREATE POLICY users_update ON public.users
  FOR UPDATE USING (
    public.get_user_role() = 'admin' OR id = auth.uid()
  );
-- ... (recreate all policies)

COMMIT;
```

**Key principle:** Keep RLS **enabled** throughout migration. Never use `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` - this creates critical security gaps where all data becomes accessible.

**Scope:** Current codebase has:
- 68 CREATE POLICY statements in `027_rls_policies.sql`
- 7 additional migration files with role-dependent policies
- Policies across 17 tables (users, departments, status_config, categories, contact_persons, suppliers, items, warehouses, qmrl, qmhq, financial_transactions, purchase_orders, po_line_items, invoices, invoice_line_items, inventory_transactions, audit_logs)

### Pattern 3: Role Hierarchy Function Replacement

**Current implementation:** `has_role()` function uses hardcoded CASE statement with 7 roles:

```sql
-- From 002_users.sql
CREATE OR REPLACE FUNCTION public.has_role(required_role public.user_role)
RETURNS BOOLEAN AS $$
DECLARE
  user_role public.user_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  CASE user_role
    WHEN 'admin' THEN RETURN true; -- Admin has all permissions
    WHEN 'quartermaster' THEN
      RETURN required_role IN ('quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester');
    WHEN 'finance' THEN
      RETURN required_role IN ('finance', 'requester');
    -- ... 4 more cases
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

**Problem:** This function is **currently unused** in RLS policies. Policies use `get_user_role() IN (...)` pattern instead.

**Decision for Phase 37:**
1. Drop `has_role()` function entirely (it's dead code)
2. Keep using `get_user_role() IN (...)` pattern with new role values
3. Defer permission system redesign to Phase 38 (RBAC permissions mapping)

### Pattern 4: Zero-Downtime Considerations

**Reality check:** True zero-downtime is **not achievable** for this migration.

**Why downtime is required:**

1. **Column type changes cause table locks:** Steps 3-5 of enum migration lock the `users` table
2. **RLS policy recreation window:** Brief moment where default-deny blocks all access
3. **Foreign key cascades:** `users.role` changes may trigger constraint checks

**From research:** [xata.io article on expand-contract](https://xata.io/blog/pgroll-expand-contract) emphasizes "old and new versions of your application can coexist" - but this assumes additive changes (adding columns). Enum replacement is a **breaking change**.

**Mitigation strategy:**
- Schedule during maintenance window (e.g., 2-4 AM)
- Communicate maintenance to users in advance
- Execute entire migration in single transaction (rollback on error)
- Target execution time: < 5 minutes for typical database size

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enum value removal | Direct `ALTER TYPE DROP VALUE` | Expand-and-contract pattern | DROP VALUE doesn't exist in PostgreSQL |
| Backup automation | Custom pg_dump scripts | Supabase CLI `db dump` | Handles auth, RLS context, formatting |
| Role mapping logic | Complex trigger-based sync | Single UPDATE with CASE | Simpler, atomic, verifiable |
| Migration rollback | Manual undo scripts | Transaction BEGIN/COMMIT/ROLLBACK | Built-in atomicity |

**Key insight:** PostgreSQL enums are more restrictive than application enums. You cannot remove values short of recreating the type entirely. Any attempt to work around this (e.g., updating pg_catalog directly) will corrupt indexes and foreign keys.

## Common Pitfalls

### Pitfall 1: Assuming ALTER TYPE Can Remove Enum Values

**What goes wrong:** Developer tries `ALTER TYPE user_role DROP VALUE 'quartermaster'` and gets error: `ERROR: syntax error at or near "DROP"`

**Why it happens:** PostgreSQL's ALTER TYPE only supports:
- `ADD VALUE` - add new enum value
- `RENAME VALUE` - rename existing value
- `RENAME TO` - rename the enum type itself

**No DROP VALUE command exists.** [Source: PostgreSQL ALTER TYPE documentation](https://www.postgresql.org/docs/current/sql-altertype.html)

**How to avoid:** Always use expand-and-contract pattern for enum value removal. Rename old type, create new type with desired values, migrate data, swap.

**Warning signs:** If you're researching "how to delete enum value PostgreSQL" - stop and use expand-and-contract instead.

### Pitfall 2: Creating Security Gaps During RLS Policy Updates

**What goes wrong:** Developer disables RLS before updating policies, or drops all policies without immediate recreation. During the gap, either:
- All data becomes publicly accessible (RLS disabled), or
- All queries fail with permission denied (RLS enabled, no policies, default-deny)

**Why it happens:** Misunderstanding of PostgreSQL's default-deny behavior when RLS is enabled but no policies exist.

**How to avoid:**
1. Keep RLS enabled throughout migration
2. Drop and recreate policies in single transaction
3. Test policy changes on staging database first
4. Verify access with `SELECT * FROM table LIMIT 1` after policy recreation

**Warning signs:** Queries returning 0 rows that should return data after migration = default-deny active.

### Pitfall 3: Forgetting to Update Dependent Objects

**What goes wrong:** Enum migration succeeds, but database functions, triggers, or views that reference old role values continue to exist with broken references.

**Why it happens:** PostgreSQL doesn't automatically track enum value usage beyond column types. Functions with CASE statements on role values are string-based, not enum-based.

**Objects to update:**
- `has_role()` function (lines 84-111 in `002_users.sql`) - **Drop entirely or rewrite**
- RLS policies (53+ instances in `027_rls_policies.sql`) - **Update all IN clauses**
- Any triggers with role checks (grep needed)
- Any views with role filters (grep needed)

**How to avoid:**
1. Before migration: `grep -r "quartermaster\|frontline\|requester\|finance\|inventory\|proposal"` across `/supabase/migrations/`
2. Create checklist of all files requiring updates
3. Verify with test queries after migration

**Warning signs:** Migration succeeds but RLS policies fail with enum value errors.

### Pitfall 4: Not Testing Role Mapping Logic

**What goes wrong:** Data migration maps roles incorrectly (e.g., `quartermaster` → `qmrl` instead of `admin`). Users lose access after migration.

**Why it happens:** Role mapping in UPDATE statement (`WHEN 'quartermaster' THEN 'admin'`) has no automated validation. Typo or logic error = data corruption.

**How to avoid:**

1. **Document mapping explicitly:**
```
Old Role       → New Role  | Rationale
------------------------------------------
admin          → admin     | Full access unchanged
quartermaster  → admin     | Supervisory role → admin
finance        → qmhq      | HQ operations
inventory      → qmhq      | HQ operations
proposal       → qmhq      | HQ operations
frontline      → qmrl      | Field operations
requester      → qmrl      | Field operations
```

2. **Test on staging database first:**
```sql
SELECT
  role_old::text as old_role,
  role_new::text as new_role,
  COUNT(*) as user_count
FROM users_temp_migration_test
GROUP BY role_old, role_new
ORDER BY role_old;
```

3. **Verify no NULL role_new values:**
```sql
SELECT COUNT(*) FROM users WHERE role_new IS NULL;
-- Should return 0
```

**Warning signs:** User complaints about lost access immediately after migration.

### Pitfall 5: Inadequate Backup Before Breaking Change

**What goes wrong:** Migration fails halfway through (e.g., policy recreation syntax error). Without backup, database is in broken state with no rollback plan beyond manual fixes.

**Why it happens:** Overconfidence in transaction rollback. While transactions handle SQL errors, they don't protect against:
- Application deployment mistiming (new code deployed before migration completes)
- Network interruptions during long migrations
- Supabase platform issues

**How to avoid:**

1. **Mandatory pre-migration backup:**
```bash
supabase db dump --db-url "$SUPABASE_DB_URL" -f pre-rbac-migration-backup.sql
```

2. **Verify backup integrity:**
```bash
# Check file size (should be several MB for populated database)
ls -lh pre-rbac-migration-backup.sql

# Verify SQL syntax
head -50 pre-rbac-migration-backup.sql  # Check header
tail -50 pre-rbac-migration-backup.sql  # Check footer
```

3. **Store backup securely:**
- Keep locally AND upload to secure storage (S3, Google Drive, etc.)
- Retain for at least 7 days post-migration
- Tag with timestamp and migration phase number

**From research:** [Supabase backup docs](https://supabase.com/docs/guides/platform/backups) recommend manual logical backups via CLI for pre-migration snapshots. Automated daily backups exist but may not align with migration timing.

**Warning signs:** You're about to run migration and haven't created explicit backup file.

## Code Examples

### Example 1: Complete Enum Migration with Role Mapping

```sql
-- Migration: 064_rbac_enum_migration.sql
-- Phase 37: Migrate user_role enum from 7 roles to 3 roles

BEGIN;

-- ============================================
-- Step 1: Rename existing enum type
-- ============================================
ALTER TYPE public.user_role RENAME TO user_role_old;

-- ============================================
-- Step 2: Create new enum with 3 roles
-- ============================================
CREATE TYPE public.user_role AS ENUM ('admin', 'qmrl', 'qmhq');

-- ============================================
-- Step 3: Add temporary column with new type
-- ============================================
ALTER TABLE public.users
  ADD COLUMN role_new public.user_role;

-- ============================================
-- Step 4: Migrate data with mapping logic
-- ============================================
-- Mapping:
-- admin, quartermaster -> admin (supervisory)
-- finance, inventory, proposal -> qmhq (HQ operations)
-- frontline, requester -> qmrl (field operations)

UPDATE public.users
SET role_new = CASE role::text
  WHEN 'admin' THEN 'admin'::public.user_role
  WHEN 'quartermaster' THEN 'admin'::public.user_role
  WHEN 'finance' THEN 'qmhq'::public.user_role
  WHEN 'inventory' THEN 'qmhq'::public.user_role
  WHEN 'proposal' THEN 'qmhq'::public.user_role
  WHEN 'frontline' THEN 'qmrl'::public.user_role
  WHEN 'requester' THEN 'qmrl'::public.user_role
  ELSE NULL  -- Should never happen
END;

-- ============================================
-- Step 5: Validation
-- ============================================
-- Verify no NULL role_new values
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM public.users
  WHERE role_new IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % users have NULL role_new', null_count;
  END IF;
END $$;

-- ============================================
-- Step 6: Swap columns
-- ============================================
ALTER TABLE public.users DROP COLUMN role;
ALTER TABLE public.users RENAME COLUMN role_new TO role;

-- Restore NOT NULL constraint
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;

-- Restore default value
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'qmrl';

-- Recreate index
DROP INDEX IF EXISTS idx_users_role;
CREATE INDEX idx_users_role ON public.users(role);

-- ============================================
-- Step 7: Drop old enum type
-- ============================================
DROP TYPE public.user_role_old;

-- ============================================
-- Step 8: Update comments
-- ============================================
COMMENT ON COLUMN public.users.role IS 'User role for RBAC: admin, qmrl (field operations), qmhq (HQ operations)';

COMMIT;
```

**Source:** Pattern adapted from research findings and existing migration files.

### Example 2: RLS Policy Batch Update

```sql
-- Migration: 065_rbac_rls_policies_update.sql
-- Phase 37: Update RLS policies for new 3-role system

BEGIN;

-- ============================================
-- USERS Table Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_select_admin ON public.users;
DROP POLICY IF EXISTS users_insert ON public.users;
DROP POLICY IF EXISTS users_update ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_delete ON public.users;

-- Recreate with new role values
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_select_admin ON public.users
  FOR SELECT USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY users_insert ON public.users
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY users_delete ON public.users
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- CONTACT_PERSONS Policies
-- Old: admin, quartermaster, proposal, frontline
-- New: admin (only - simplify permissions)
-- ============================================

DROP POLICY IF EXISTS contact_persons_insert ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_update ON public.contact_persons;
DROP POLICY IF EXISTS contact_persons_delete ON public.contact_persons;

CREATE POLICY contact_persons_insert ON public.contact_persons
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'admin'
  );

CREATE POLICY contact_persons_update ON public.contact_persons
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  );

CREATE POLICY contact_persons_delete ON public.contact_persons
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SUPPLIERS Policies
-- Old: admin, quartermaster, finance, proposal
-- New: admin, qmhq
-- ============================================

DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete ON public.suppliers;

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

CREATE POLICY suppliers_delete ON public.suppliers
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'qmhq')
  );

-- Continue for remaining 14 tables...
-- (Full file would be ~300 lines covering all 17 tables)

COMMIT;
```

**Pattern:** Drop all policies for a table, then immediately recreate with updated role checks. Single transaction ensures atomicity.

### Example 3: Drop has_role() Function

```sql
-- Migration: 066_rbac_drop_has_role.sql
-- Phase 37: Remove unused has_role() function

-- This function contains hardcoded 7-role hierarchy logic
-- It's not used in any RLS policies (they use get_user_role() IN (...) pattern)
-- Safe to drop entirely

DROP FUNCTION IF EXISTS public.has_role(public.user_role);

COMMENT ON FUNCTION public.get_user_role IS 'Returns current authenticated user role (admin, qmrl, or qmhq)';
```

**Rationale:** `has_role()` is dead code. No RLS policies reference it (verified via grep). Simpler to drop than rewrite.

## State of the Art

### Enum Migration Approaches

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Modify pg_catalog directly | Expand-and-contract pattern | Always recommended | Safety - prevents index corruption |
| ADD VALUE in transaction | ADD VALUE requires commit first | PostgreSQL 10+ limitation | Can't use new value until transaction commits |
| Manual enum recreation | Automated tools (pgroll, reshape) | 2022-2024 | Convenience vs. control tradeoff |

**For this project:** Using manual expand-and-contract for maximum transparency and control. Single migration, not worth adding tool dependencies.

### Backup Strategy

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual pg_dump | Supabase CLI `db dump` | Supabase platform | Handles auth context automatically |
| Physical backups only | Logical + physical options | Database size dependent | <15GB = logical, >15GB = physical |
| Daily automated backups | PITR (2-minute granularity) | Enterprise plans | Can restore to exact moment |

**For this project:** Mandatory manual logical backup via `supabase db dump` before migration execution. Automated backups may not align with migration timing.

### RLS Policy Management

| Old Approach | Current Approach | Why |
|--------------|------------------|-----|
| Role-based SQL grants | RLS policies | Row-level granularity, multi-tenancy |
| Hardcoded role checks in app | Database-enforced RLS | Security by default |
| has_role() hierarchy function | Direct enum checks in policies | Simpler, more explicit |

**For this project:** Keeping `get_user_role() IN (...)` pattern. Phase 38 will add permission abstraction layer on top.

## Open Questions

### 1. Frontend Application Deployment Coordination

**What we know:** Migration changes role enum values in database. Frontend code has 3 hardcoded role checks in `dashboard/page.tsx` and `qmhq/[id]/page.tsx`.

**What's unclear:** Timing of frontend deployment relative to database migration. If migration runs but frontend still references old role values, will cause:
- Type errors from Supabase client (enum mismatch)
- Broken role checks in UI logic

**Recommendation:**
- Phase 37 focuses on database only
- Phase 38 handles frontend role mapping
- During maintenance window: Run migration, immediately deploy frontend (pre-built)
- Test window: 5-10 minutes between migration and frontend deployment is acceptable if maintenance window announced

### 2. Audit Log Historical Data

**What we know:** `audit_logs` table stores JSONB `changes` field with before/after values. Old audit logs contain old role enum values like `'quartermaster'`, `'frontline'`.

**What's unclear:** Should historical audit logs be migrated to new role values, or kept as-is?

**Recommendation:**
- Keep historical audit logs unchanged (historical accuracy)
- Audit log display logic (if any) should handle both old and new role values
- Add migration marker in audit logs:
```sql
INSERT INTO audit_logs (entity_type, action, summary, created_by)
VALUES ('system', 'schema_change', 'RBAC migration: 7 roles → 3 roles', auth.uid());
```

### 3. Rollback Strategy for Production

**What we know:** Transaction-based migration allows SQL-level rollback. But what if migration succeeds, frontend deploys, then critical bug discovered hours later?

**What's unclear:** How to rollback after transaction commits and users have already interacted with new role system.

**Recommendation:**
- Pre-migration backup is rollback plan
- Rollback process (if needed within 24 hours):
  1. Announce maintenance
  2. Restore from backup: `supabase db reset && psql < pre-rbac-migration-backup.sql`
  3. Rollback frontend to previous version
  4. Investigate root cause before re-attempting

**Warning:** Rollback loses any data changes made after migration (new users, new QMRLs, etc.). Only use rollback for critical migration failures.

## Sources

### Primary (HIGH confidence)

- [PostgreSQL ALTER TYPE documentation](https://www.postgresql.org/docs/current/sql-altertype.html) - Official docs on enum modification limitations
- [PostgreSQL Row Level Security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) - Official docs on RLS default-deny behavior
- [Supabase Managing Enums guide](https://supabase.com/docs/guides/database/postgres/enums) - Best practices and why not to remove enum values
- [Supabase Database Backups documentation](https://supabase.com/docs/guides/platform/backups) - Backup types, PITR, manual backup commands
- Codebase analysis - Direct examination of migration files, counted 68 RLS policies, 53 hardcoded role checks

### Secondary (MEDIUM confidence)

- [Safe enum updates blog post](https://blog.yo1.dog/updating-enum-values-in-postgresql-the-safe-and-easy-way/) - Expand-and-contract pattern walkthrough
- [xata.io pgroll expand-contract article](https://xata.io/blog/pgroll-expand-contract) - Modern tooling approach, explains two-phase pattern
- [PostgreSQL backup best practices article](https://medium.com/@ngza5tqf/postgresql-backup-best-practices-15-essential-postgresql-backup-strategies-for-production-systems-dd230fb3f161) - Production backup strategies

### Tertiary (Context)

- [Supabase RLS and transactions article](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html) - RLS behavior in transactions
- [PostgreSQL zero-downtime migrations tools](https://github.com/xataio/pgroll) - Alternative approaches (not using, but informed research)

## Metadata

**Confidence breakdown:**
- Enum migration pattern: HIGH - Official PostgreSQL docs confirm enum limitations, expand-and-contract is only safe approach
- RLS policy recreation: HIGH - Official docs confirm default-deny behavior, tested in staging environments by community
- Backup strategy: HIGH - Supabase official docs, CLI commands verified
- Role mapping logic: MEDIUM - Application-specific, requires validation against user requirements
- Downtime estimates: MEDIUM - Depends on database size, network latency, actual timing TBD

**Research date:** 2026-02-11
**Valid until:** 2026-05-11 (90 days - PostgreSQL and Supabase are stable platforms)

**Phase 37 complexity assessment:** HIGH
- Breaking database change with table locks
- 68+ RLS policies to recreate across 11 files
- Requires maintenance window
- Rollback requires full database restore

**Estimated execution time:** 3-7 minutes for migration SQL, plus 5-10 minutes buffer for frontend deployment coordination.
