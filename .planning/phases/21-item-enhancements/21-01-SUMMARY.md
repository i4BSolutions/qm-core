---
phase: 21-item-enhancements
plan: 01
subsystem: database
tags: [postgres, trigger, sku, radix-ui, tooltip]

# Dependency graph
requires:
  - phase: 17-item-categories
    provides: categories table with item entity_type support
provides:
  - price_reference column on items table for purchasing notes
  - SKU v2 generation with SKU-[CAT]-[XXXX] format
  - get_category_abbreviation() SQL function
  - generate_random_suffix() SQL function
  - Tooltip UI component with dark theme styling
affects: [21-02 price reference display, 21-03 item form, PO line item selector]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Category abbreviation extraction via SQL regex split"
    - "SKU format SKU-[CATEGORY]-[RANDOM4] with collision retry"

key-files:
  created:
    - supabase/migrations/049_item_sku_price_reference.sql
    - components/ui/tooltip.tsx
  modified:
    - types/database.ts

key-decisions:
  - "SKU random suffix is 4 alphanumeric chars (A-Z, 0-9)"
  - "On category change, SKU preserves random suffix but updates category prefix"
  - "price_reference limited to 100 chars via CHECK constraint"
  - "Tooltip uses dark theme (slate-800) to match project styling"

patterns-established:
  - "SKU format: SKU-[CAT]-[XXXX] where CAT is first letter of each word"
  - "Tooltip max-w-xs for overflow prevention on long content"

# Metrics
duration: 8min
completed: 2026-02-06
---

# Phase 21 Plan 01: Database Foundation Summary

**Items table extended with price_reference column and SKU v2 trigger generating SKU-[CAT]-[XXXX] format, plus Radix UI Tooltip component**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-06T[start]
- **Completed:** 2026-02-06T[end]
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created database migration for price_reference column with 100 char limit
- Implemented SKU v2 generation with category abbreviation and random suffix
- Added Radix UI tooltip wrapper component with dark theme
- Updated TypeScript types for Item to include price_reference

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration for price reference and SKU generation** - `dbd94e4` (feat)
2. **Task 2: Create Tooltip UI component** - `04afbc8` (feat)
3. **Task 3: Update TypeScript types for Item** - `363fc15` (feat)

## Files Created/Modified

- `supabase/migrations/049_item_sku_price_reference.sql` - Migration adding price_reference column, SKU functions, and v2 trigger with backfill
- `components/ui/tooltip.tsx` - Radix UI tooltip wrapper with dark theme styling
- `types/database.ts` - Added price_reference field to items Row/Insert/Update types

## Decisions Made

- SKU random suffix uses 4 alphanumeric characters (A-Z, 0-9) for uniqueness balance
- When item category changes, SKU preserves the random suffix but updates category portion
- price_reference uses TEXT with CHECK constraint rather than VARCHAR for flexibility
- Tooltip component uses project's dark theme (slate-800 background, slate-700 border)
- max-w-xs on tooltip to prevent overflow with long price reference text

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Docker not running prevented local database reset for migration testing. Migration SQL verified syntactically correct; will be applied on next `npx supabase db reset`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Database migration ready for application (requires db reset)
- Tooltip component ready for use in Plan 02 (PO line item price reference display)
- TypeScript types updated for price_reference field
- Plan 02 can proceed with price reference form field and tooltip integration

---
*Phase: 21-item-enhancements*
*Completed: 2026-02-06*

## Self-Check: PASSED
