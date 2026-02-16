---
phase: 52-per-item-standard-unit-assignment
plan: 01
subsystem: inventory
tags: [database, migration, foreign-key, types]
dependency_graph:
  requires:
    - "51-01: standard_units table exists with 'pcs' seed data"
  provides:
    - "items.standard_unit_id FK column with NOT NULL constraint"
    - "All existing items backfilled with 'pcs' standard unit"
    - "TypeScript types updated for standard_unit_id field"
  affects:
    - "items table schema"
    - "types/database.ts"
tech_stack:
  added: []
  patterns:
    - "FK constraint with ON DELETE RESTRICT for referential integrity"
    - "Backfill pattern: nullable → backfill → NOT NULL → FK"
key_files:
  created:
    - "supabase/migrations/20260216200000_item_standard_unit_fk.sql"
  modified:
    - "types/database.ts"
decisions:
  - id: "items-standard-unit-fk"
    choice: "Add standard_unit_id as FK to standard_units with ON DELETE RESTRICT"
    rationale: "Prevents deletion of standard units that have items assigned, ensuring data integrity"
  - id: "backfill-pcs"
    choice: "Backfill all existing items with 'pcs' standard unit"
    rationale: "Most common unit and safe default for existing items before UI enforcement"
  - id: "not-null-constraint"
    choice: "Set NOT NULL after backfill"
    rationale: "Enforces that all items must have a standard unit going forward"
metrics:
  duration_seconds: 120
  tasks_completed: 1
  files_created: 1
  files_modified: 1
  commits: 1
  completed_at: "2026-02-16T15:52:35Z"
---

# Phase 52 Plan 01: Item Standard Unit FK Summary

**One-liner:** Added standard_unit_id FK column to items table with backfill to 'pcs' and updated TypeScript types.

---

## Objective

Add standard_unit_id foreign key column to the items table, backfill all existing items with 'pcs', and update TypeScript types to support per-item standard unit assignment.

**Purpose:** Enable each item to have its own standard unit assignment, preparing for UI integration where standard units become a required field in item forms.

---

## What Was Built

### 1. Database Migration (20260216200000_item_standard_unit_fk.sql)

**Step-by-step migration pattern:**
- Added nullable `standard_unit_id UUID` column to items table
- Backfilled all existing items with 'pcs' standard unit (looked up by name)
- Set NOT NULL constraint after backfill
- Added FK constraint `items_standard_unit_id_fkey` with ON DELETE RESTRICT
- Created index `idx_items_standard_unit_id` for FK lookups
- Added column comment for documentation

**Key constraint:** ON DELETE RESTRICT prevents deletion of standard units that have items assigned, ensuring referential integrity.

### 2. TypeScript Types Update

Updated `types/database.ts` for items table:
- **Row type:** Added `standard_unit_id: string` (NOT NULL, no optional)
- **Insert type:** Added `standard_unit_id?: string` (optional for inserts)
- **Update type:** Added `standard_unit_id?: string` (optional for updates)
- **Relationships:** Added FK relationship entry for `items_standard_unit_id_fkey` referencing `standard_units`

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Verification Results

**All verification criteria passed:**

- [x] Migration file exists at supabase/migrations/20260216200000_item_standard_unit_fk.sql
- [x] Migration adds standard_unit_id column to items table
- [x] Migration backfills all existing items with 'pcs' standard unit
- [x] Migration adds NOT NULL constraint after backfill
- [x] Migration adds FK constraint with ON DELETE RESTRICT
- [x] Migration adds index on standard_unit_id
- [x] types/database.ts includes standard_unit_id in items Row type as string (not null)
- [x] types/database.ts includes standard_unit_id in items Insert/Update types
- [x] `npm run type-check` passes with no errors

---

## Task Breakdown

| Task | Name | Status | Commit | Duration |
|------|------|--------|--------|----------|
| 1 | Create migration to add standard_unit_id FK to items and update types | Complete | 18b2f1c | 120s |

---

## Key Technical Details

### Migration Pattern

Used the safe backfill pattern for adding NOT NULL FK:
1. Add column as nullable
2. Backfill with default value
3. Set NOT NULL
4. Add FK constraint

This prevents migration failures on tables with existing data.

### FK Constraint Details

```sql
ALTER TABLE public.items
  ADD CONSTRAINT items_standard_unit_id_fkey
  FOREIGN KEY (standard_unit_id)
  REFERENCES public.standard_units(id)
  ON DELETE RESTRICT;
```

**ON DELETE RESTRICT:** Prevents deletion of standard units that have items assigned. If deletion is attempted, the database will raise an error, protecting data integrity.

### Type System

TypeScript types now reflect the schema accurately:
- Row type enforces presence (NOT NULL)
- Insert/Update types allow optional (for flexibility in partial updates)
- Relationship metadata enables type-safe joins

---

## Testing Notes

**Type checking:** Passed with no errors (`npm run type-check`).

**Migration verification:**
- File created with correct timestamp format
- All SQL statements present (ALTER TABLE, UPDATE, FK, INDEX, COMMENT)
- Backfill query uses lookup: `SELECT id FROM standard_units WHERE name = 'pcs'`

---

## Dependencies

**Requires:**
- Phase 51-01: standard_units table must exist
- standard_units must contain 'pcs' seed data

**Enables:**
- Phase 52-02: Item form standard unit selection UI
- Phase 53: Standard unit display refactoring

---

## Impact Summary

**Schema changes:**
- items table: +1 column (standard_unit_id UUID NOT NULL FK)
- items table: +1 index (idx_items_standard_unit_id)
- items table: +1 FK constraint (items_standard_unit_id_fkey)

**Type changes:**
- items Row: +1 field (standard_unit_id: string)
- items Insert: +1 field (standard_unit_id?: string)
- items Update: +1 field (standard_unit_id?: string)
- items Relationships: +1 entry (standard_units FK)

**Data changes:**
- All existing items backfilled with 'pcs' standard unit ID

---

## Next Steps

**Phase 52-02:** Update item forms to display and require standard_unit_id selection.

**Phase 53:** Refactor standard unit display across the application to use per-item standard units instead of global config.

---

## Self-Check: PASSED

**File verification:**
```
FOUND: /home/yaungni/qm-core/supabase/migrations/20260216200000_item_standard_unit_fk.sql
FOUND: /home/yaungni/qm-core/types/database.ts (modified)
```

**Commit verification:**
```
FOUND: 18b2f1c - feat(52-01): add standard_unit_id FK to items table
```

**Type check:**
```
PASSED: npm run type-check (no errors)
```

All artifacts created, all commits present, all verification criteria met.
