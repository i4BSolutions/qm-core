---
phase: 51
plan: 01
subsystem: standard-units
tags: [database, migration, types, admin-ui]

dependency_graph:
  requires:
    - system_config table (Phase 48)
    - update_updated_at_column() function
    - get_user_role() function
  provides:
    - standard_units table with RLS
    - StandardUnit TypeScript type
    - 9 seeded standard units
  affects:
    - admin/settings page (removed config UI)
    - system_config table (removed standard_unit_name row)

tech_stack:
  added:
    - standard_units database table
    - StandardUnit interface in types/database.ts
  patterns:
    - Entity-managed standard units (replacing key-value config)
    - Admin-only write RLS, all-users read
    - Hard delete (no soft delete/is_active column)

key_files:
  created:
    - supabase/migrations/20260216100000_standard_units.sql
  modified:
    - types/database.ts (added StandardUnit interface)
    - app/(dashboard)/admin/settings/page.tsx (removed unit config UI)

decisions:
  - decision: Use entity table instead of system_config key-value
    rationale: Standard units need CRUD operations, ordering, and potential per-item assignment
    alternatives: [Continue with system_config, Use JSON array in single config row]
  - decision: Hard delete only (no is_active column)
    rationale: Simpler for initial implementation, soft delete can be added if needed later
    alternatives: [Add is_active soft delete, Block delete via FK constraints]
  - decision: Completely remove admin/settings page content
    rationale: No other settings exist yet, cleaner than empty state
    alternatives: [Keep empty state with placeholder, Remove page entirely]

metrics:
  duration: 179s
  tasks_completed: 2
  files_modified: 3
  completed_at: "2026-02-16T15:15:22Z"
---

# Phase 51 Plan 01: Standard Units Table & Type Foundation

Created the standard_units database table with seed data, RLS policies, and TypeScript types. Removed the global standard_unit_name system_config entry and its admin settings UI since standard units are now managed as entities.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create standard_units table migration with seed data and remove global config | 5511ad9 | supabase/migrations/20260216100000_standard_units.sql |
| 2 | Add StandardUnit type and update admin settings page | b951f08 | types/database.ts, app/(dashboard)/admin/settings/page.tsx |

## Implementation Details

### Database Schema

Created `standard_units` table with:
- **Columns**: id (UUID), name (unique text), display_order (integer), audit columns (created_at, updated_at, created_by, updated_by)
- **Triggers**: update_updated_at_column() for automatic timestamp updates
- **Indexes**: display_order for UI sorting
- **RLS Policies**:
  - SELECT: All authenticated users (`USING (true)`)
  - INSERT/UPDATE/DELETE: Admin only (`get_user_role() = 'admin'`)

### Seed Data

9 standard units in priority order:
1. pcs (most common)
2. kg
3. g
4. L
5. mL
6. m
7. cm
8. box
9. pack

All seeded with `ON CONFLICT (name) DO NOTHING` for idempotency.

### TypeScript Types

Added `StandardUnit` interface to `types/database.ts`:
```typescript
export interface StandardUnit {
  id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}
```

### Admin Settings Cleanup

Replaced the entire standard unit configuration UI with a simple info message stating that settings are now entity-managed. Removed:
- `useStandardUnitName` hook usage
- State variables (unitName, isLoading, isSaving)
- fetchConfig/handleSave functions
- All system_config queries
- Standard Unit Configuration card

New page shows minimal placeholder with PageHeader + info card.

## Database Migration

**File**: `supabase/migrations/20260216100000_standard_units.sql`

**Part 1: Create standard_units table**
- CREATE TABLE with proper schema
- RLS policies (4 policies: SELECT, INSERT, UPDATE, DELETE)
- Trigger for updated_at
- Index on display_order
- 9 INSERT statements for seed data
- Table and column COMMENT statements

**Part 2: Remove global config**
- DELETE FROM system_config WHERE key = 'standard_unit_name'

## Verification

All verification criteria met:
- [x] `npm run type-check` passes with no new errors
- [x] Migration file contains CREATE TABLE standard_units with correct columns
- [x] Migration file contains 9 INSERT statements for seed data
- [x] Migration file contains 4 RLS policies (SELECT, INSERT, UPDATE, DELETE)
- [x] Migration file contains DELETE FROM system_config WHERE key = 'standard_unit_name'
- [x] types/database.ts exports StandardUnit type
- [x] Admin settings page compiles without standard unit configuration

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

Phase 51 Plan 02 will build the admin UI for managing standard units:
- List view with display_order sorting
- Create/edit dialog
- Delete with confirmation
- Drag-and-drop reordering

## Self-Check: PASSED

Verified all artifacts exist:
- FOUND: supabase/migrations/20260216100000_standard_units.sql
- FOUND: 5511ad9 (Task 1 commit)
- FOUND: b951f08 (Task 2 commit)
- FOUND: StandardUnit type in types/database.ts
