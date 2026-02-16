---
phase: 53-standard-unit-display-refactor
plan: 01
subsystem: ui
tags: [react, components, database, migration, refactor]

# Dependency graph
requires:
  - phase: 52-per-item-standard-unit-assignment
    provides: Items have standard_unit_id FK, per-item unit names available

provides:
  - Presentational StandardUnitDisplay component accepting unitName prop
  - Migration to drop system_config table and all related infrastructure
  - Clean removal of global standard unit configuration

affects: [53-02-warehouse-inventory-consumers, 53-03-all-other-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns: [presentational-component, prop-driven-display]

key-files:
  created:
    - supabase/migrations/20260216300000_drop_system_config.sql
  modified:
    - components/ui/standard-unit-display.tsx
    - lib/hooks/index.ts
    - types/database.ts
    - components/layout/sidebar.tsx
  deleted:
    - lib/hooks/use-standard-unit-name.ts
    - app/(dashboard)/admin/settings/page.tsx

key-decisions:
  - "Refactored StandardUnitDisplay to pure presentational component with unitName prop"
  - "Dropped system_config table entirely - no longer needed with per-item units"
  - "Removed admin settings page and sidebar link"
  - "Deleted useStandardUnitName hook - global config pattern obsolete"

patterns-established:
  - "StandardUnitDisplay now follows pure presentational pattern like CurrencyDisplay"
  - "Per-item unit names flow through props instead of global config fetching"

# Metrics
duration: 2 min
completed: 2026-02-16
---

# Phase 53 Plan 01: Remove Global Standard Unit Infrastructure

**Presentational StandardUnitDisplay component with unitName prop, system_config table dropped, all global config artifacts removed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T17:17:17Z
- **Completed:** 2026-02-16T17:19:48Z
- **Tasks:** 2
- **Files modified:** 7 (4 modified, 2 deleted, 1 created)

## Accomplishments
- StandardUnitDisplay refactored to pure presentational component accepting unitName as prop
- system_config table dropped via migration (policies, triggers, indexes all removed)
- Admin settings page deleted and sidebar link removed
- useStandardUnitName hook deleted and all references cleaned up
- SystemConfig type removed from types/database.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Drop system_config table and remove admin settings page + sidebar link** - `de61689` (chore)
2. **Task 2: Refactor StandardUnitDisplay to presentational and remove useStandardUnitName hook** - `6bae1cf` (refactor)

## Files Created/Modified

**Created:**
- `supabase/migrations/20260216300000_drop_system_config.sql` - Migration to drop system_config table, RLS policies, triggers, and indexes

**Modified:**
- `components/ui/standard-unit-display.tsx` - Added unitName prop, removed hook usage, pure presentational
- `lib/hooks/index.ts` - Removed useStandardUnitName export
- `types/database.ts` - Removed system_config table definition and SystemConfig type alias
- `components/layout/sidebar.tsx` - Removed Settings link from admin navigation

**Deleted:**
- `lib/hooks/use-standard-unit-name.ts` - Global config hook no longer needed
- `app/(dashboard)/admin/settings/page.tsx` - Settings page obsolete

## Decisions Made

None - followed plan exactly as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - clean refactor with no complications.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Foundation for per-item standard unit display is complete. StandardUnitDisplay is now a pure presentational component ready to receive per-item unit names.

**Downstream consumers will have broken imports** until Plans 02 and 03 update them to:
1. Fetch per-item unit names from the database
2. Pass unitName as prop to StandardUnitDisplay

Ready for 53-02: Update warehouse inventory consumers to fetch per-item unit names.

## Self-Check: PASSED

All claims verified:
- ✓ Migration file exists: supabase/migrations/20260216300000_drop_system_config.sql
- ✓ Commit de61689 exists (Task 1)
- ✓ Commit 6bae1cf exists (Task 2)

---
*Phase: 53-standard-unit-display-refactor*
*Completed: 2026-02-16*
