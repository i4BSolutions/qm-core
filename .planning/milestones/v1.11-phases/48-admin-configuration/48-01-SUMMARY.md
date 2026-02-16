---
phase: 48-admin-configuration
plan: 01
subsystem: admin-settings
tags: [configuration, admin, ui, database]
dependency-graph:
  requires: [47-01-schema-data]
  provides: [system_config-table, useStandardUnitName-hook, admin-settings-page]
  affects: [phase-49-conversion-inputs, phase-50-standard-unit-display]
tech-stack:
  added: [system_config-table, useStandardUnitName-hook]
  patterns: [key-value-config, RLS-admin-only]
key-files:
  created:
    - supabase/migrations/20260214210000_system_config.sql
    - lib/hooks/use-standard-unit-name.ts
    - app/(dashboard)/admin/settings/page.tsx
  modified:
    - types/database.ts
    - lib/hooks/index.ts
    - components/layout/sidebar.tsx
decisions:
  - "Use system_config key-value table (not individual columns) for scalability"
  - "RLS: admin CRUD, all authenticated users read-only"
  - "Default standard_unit_name = 'Standard Units'"
  - "Permission check via can('update', 'statuses') as admin proxy (avoid adding system_config to PermissionResource)"
  - "Hook caches in component state (no global cache needed for lightweight query)"
metrics:
  duration: 227
  tasks: 2
  commits: 2
  completed: 2026-02-14
---

# Phase 48 Plan 01: Admin Configuration Infrastructure Summary

System configuration table and admin settings page for global standard unit name.

**One-liner:** Key-value system_config table with RLS, useStandardUnitName hook, and /admin/settings page for standard unit name configuration.

---

## What Was Built

### 1. Database Infrastructure
- Created `system_config` table with key-value storage pattern
- Columns: `id`, `key` (unique), `value`, `description`, `updated_at`, `updated_by`
- RLS policies: admin full CRUD, all authenticated users SELECT
- Seeded default: `standard_unit_name = 'Standard Units'`
- Updated_at trigger for automatic timestamp management

### 2. TypeScript Types
- Added `system_config` table types to `types/database.ts` (Row, Insert, Update, Relationships)
- Added `SystemConfig` type alias for convenience

### 3. React Hook
- Created `useStandardUnitName()` hook in `lib/hooks/use-standard-unit-name.ts`
- Returns `{ unitName: string, isLoading: boolean }`
- Queries `system_config` table for `key = 'standard_unit_name'`
- Defaults to "Standard Units" on error or missing data
- Exported from `lib/hooks/index.ts`

### 4. Admin Settings UI
- Created `/admin/settings` page with:
  - PageHeader with violet "Admin" badge and Ruler icon
  - "Standard Unit Configuration" card section
  - Input field for standard unit name (max-width constraint)
  - Live preview: "Quantities will display as: 120.00 {unitName}"
  - Save button with loading state and toast notifications
  - Permission check: uses `can("update", "statuses")` as admin proxy
  - Read-only view for non-admin users
- Added "Settings" link to sidebar Admin section (last item)

---

## Deviations from Plan

**None** - Plan executed exactly as written.

---

## Verification Results

### Database
- ✅ Migration file creates `system_config` table
- ✅ RLS policies: admin CRUD, all users SELECT
- ✅ Seed row: `standard_unit_name = 'Standard Units'`
- ✅ Updated_at trigger applied

### Types
- ✅ `types/database.ts` includes `system_config` table types
- ✅ `SystemConfig` type alias added

### Hook
- ✅ `useStandardUnitName` hook created and exported
- ✅ Returns `unitName` and `isLoading`
- ✅ Defaults to "Standard Units"

### UI
- ✅ `/admin/settings` page compiles without errors
- ✅ PageHeader with Admin badge
- ✅ Input field with preview
- ✅ Save functionality implemented
- ✅ Permission check via `can("update", "statuses")`
- ✅ Sidebar includes "Settings" link

### TypeScript Compilation
- ✅ No new type errors introduced
- ⚠️ Expected Phase 47 breaking changes remain (conversion_rate field - will be fixed in Phase 49)

---

## Technical Decisions

### 1. Key-Value Pattern
**Decision:** Use key-value table with `key` column (not individual config columns).

**Rationale:** Scalable pattern for future config additions without schema changes. Follows common configuration management patterns.

### 2. RLS Strategy
**Decision:** Admin full CRUD, all authenticated users read-only SELECT.

**Rationale:** Configuration is global and non-sensitive. All users need to read standard unit name for display, but only admin should modify.

### 3. Permission Check Proxy
**Decision:** Use `can("update", "statuses")` as admin check, avoid adding `system_config` to `PermissionResource`.

**Rationale:** Plan explicitly requested to avoid scope creep. Statuses are admin-only, so update permission implies admin role. Adding new resource would require permission matrix updates across codebase.

### 4. Hook Caching
**Decision:** Cache in component state via `useState`, no global cache.

**Rationale:** Lightweight query, minimal overhead. Global cache would add complexity without significant performance benefit. Components using the hook will cache their own values.

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migrations/20260214210000_system_config.sql` | 68 | Table, RLS, trigger, seed data |
| `lib/hooks/use-standard-unit-name.ts` | 43 | Hook for retrieving standard unit name |
| `app/(dashboard)/admin/settings/page.tsx` | 172 | Admin settings page UI |

**Total:** 283 lines of new code

---

## Files Modified

| File | Changes |
|------|---------|
| `types/database.ts` | Added `system_config` table types + `SystemConfig` alias (35 lines) |
| `lib/hooks/index.ts` | Exported `useStandardUnitName` (1 line) |
| `components/layout/sidebar.tsx` | Added "Settings" to admin navigation (1 line) |

---

## Commits

| Hash | Message |
|------|---------|
| `874f9c8` | feat(48-01): add system_config table, types, and standard unit hook |
| `0cf88ad` | feat(48-01): add admin settings page with standard unit name configuration |

---

## Success Criteria Met

- ✅ **SCONF-01:** Admin can set standard unit name via `/admin/settings` page
- ✅ **SCONF-02 (partial):** `useStandardUnitName` hook exists for Phase 50 display components to consume
- ✅ `system_config` table seeded with default "Standard Units" value
- ✅ Non-admin users can read but not modify settings (RLS enforced)
- ✅ Page follows existing admin page visual patterns (PageHeader, command-panel, toast notifications)

---

## Integration Points

### For Phase 49 (Conversion Rate Inputs)
- No direct dependencies - Phase 49 adds conversion_rate input components to forms

### For Phase 50 (Standard Unit Display)
- **Provides:** `useStandardUnitName()` hook ready for import
- **Usage pattern:** `const { unitName, isLoading } = useStandardUnitName();`
- **Default behavior:** Returns "Standard Units" if config missing or on error

### For Future Phases
- System configuration infrastructure ready for additional settings
- Pattern established: add key to `system_config` table, read via Supabase query
- RLS ensures admin-only modifications

---

## Next Steps

1. Phase 49: Add conversion rate input components to PO, Invoice, Inventory forms
2. Phase 50: Create `StandardUnitDisplay` component and integrate into 4 display locations
3. Test end-to-end: Admin sets "SU" → displays show "120.00 SU" throughout system

---

## Self-Check: PASSED

**Files Verified:**
- ✅ FOUND: supabase/migrations/20260214210000_system_config.sql
- ✅ FOUND: lib/hooks/use-standard-unit-name.ts
- ✅ FOUND: app/(dashboard)/admin/settings/page.tsx
- ✅ FOUND: types/database.ts (modified)
- ✅ FOUND: lib/hooks/index.ts (modified)
- ✅ FOUND: components/layout/sidebar.tsx (modified)

**Commits Verified:**
- ✅ FOUND: 874f9c8
- ✅ FOUND: 0cf88ad

All files and commits exist on disk.
