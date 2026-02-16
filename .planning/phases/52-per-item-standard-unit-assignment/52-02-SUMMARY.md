---
phase: 52-per-item-standard-unit-assignment
plan: 02
subsystem: inventory
tags: [ui, forms, admin, standard-units, item-management]
dependency_graph:
  requires:
    - "52-01: items.standard_unit_id FK column with data"
    - "51-02: InlineCreateSelect supports standard_unit type"
  provides:
    - "Item dialog requires standard unit selection"
    - "Item list displays unit column with unit names"
    - "Item detail shows standard unit in header and details"
    - "Admin page shows real item usage counts per unit"
  affects:
    - "app/(dashboard)/item/item-dialog.tsx"
    - "app/(dashboard)/item/page.tsx"
    - "app/(dashboard)/item/[id]/page.tsx"
    - "app/(dashboard)/admin/standard-units/page.tsx"
tech_stack:
  added: []
  patterns:
    - "InlineCreateSelect for inline standard unit creation"
    - "Supabase join queries with FK hints for standard_units relation"
    - "Count aggregation for usage statistics"
key_files:
  created: []
  modified:
    - "app/(dashboard)/item/item-dialog.tsx"
    - "app/(dashboard)/item/page.tsx"
    - "app/(dashboard)/item/[id]/page.tsx"
    - "app/(dashboard)/admin/standard-units/page.tsx"
decisions:
  - id: "standard-unit-position"
    choice: "Position standard unit selector immediately after Name field in item dialog"
    rationale: "Standard unit is a core property that defines how the item is measured, similar to name in importance"
  - id: "required-on-both"
    choice: "Make standard unit required on both create and edit"
    rationale: "All items must have a standard unit (enforced by NOT NULL constraint in database)"
  - id: "unit-column-placement"
    choice: "Place Unit column after Name and before Price Reference in item list"
    rationale: "Unit is a core identifying property, shown early in the table for quick reference"
metrics:
  duration_seconds: 223
  tasks_completed: 2
  files_created: 0
  files_modified: 4
  commits: 2
  completed_at: "2026-02-16T15:59:12Z"
---

# Phase 52 Plan 02: Item Form Standard Unit Selection Summary

**One-liner:** Integrated standard unit selection into item forms and displays, with real usage counts on admin page.

---

## Objective

Wire standard unit selection into item forms, display unit name in item views, and show real usage counts on the admin page.

**Purpose:** Users can assign and see standard units on items, completing the per-item unit assignment feature.

---

## What Was Built

### 1. Item Dialog (item-dialog.tsx)

**Standard unit selector added:**
- Added `standardUnits` state for unit options
- Added `standard_unit_id` to form data state
- Fetch standard units on dialog open (alongside categories)
- Populate `standard_unit_id` when editing existing item
- InlineCreateSelect positioned immediately after Name field
- Required field indicator (`*`) shown on both create and edit
- Submit button disabled if `standard_unit_id` is empty
- Include `standard_unit_id` in insert/update data sent to Supabase

**Form field order:**
1. Name (required)
2. Standard Unit (required) ← **NEW**
3. Category (required on create)
4. Price Reference (required on create)
5. Photo (optional)

### 2. Item List Page (page.tsx)

**Unit column added:**
- Updated Supabase query to join `standard_units` table with FK hint
- Extended `ItemWithCategory` interface to include `standard_unit_rel`
- Added "Unit" column between Name and Price Reference
- Displays unit name from joined relation
- Shows "—" if no unit (shouldn't happen with NOT NULL constraint)

**Column order:**
Photo → Code → Name → **Unit** → Price Reference → Category → Actions

### 3. Item Detail Page ([id]/page.tsx)

**Standard unit display:**
- Updated query to join `standard_units` table
- Replaced "Default Unit" with "Standard Unit" in details section
- Updated header to show `standard_unit_rel.name` instead of `default_unit`
- Shows "—" if no unit relation found

**Changes in Item Information section:**
- Category → displays category name or "—"
- **Standard Unit** → displays unit name or "—" (was "Default Unit")

### 4. Admin Standard Units Page (admin/standard-units/page.tsx)

**Real item counts:**
- Added `itemCounts` state (Map<string, number>)
- Fetch all active items with their `standard_unit_id`
- Build count map by grouping items per unit
- Updated "Item Count" column to display real counts
- Highlight counts > 0 with brighter color and font-medium
- Removed placeholder "0" and tooltip

**Count calculation:**
```typescript
const countMap = new Map<string, number>();
countData.forEach((item) => {
  if (item.standard_unit_id) {
    countMap.set(item.standard_unit_id, (countMap.get(item.standard_unit_id) || 0) + 1);
  }
});
```

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Verification Results

**All verification criteria passed:**

- [x] Item dialog has InlineCreateSelect with createType="standard_unit" positioned after Name
- [x] Standard unit is required on both create and edit (submit button disabled without it)
- [x] Item list page shows Unit column with unit name from joined query
- [x] Item detail page shows "Standard Unit: {name}" in details section
- [x] Item detail page header shows unit name
- [x] Admin standard-units page shows real item count per unit
- [x] Item selectors in PO/Invoice/Stock-out remain unchanged (not modified in this plan)
- [x] `npm run type-check` passes

---

## Task Breakdown

| Task | Name | Status | Commit | Duration |
|------|------|--------|--------|----------|
| 1 | Add standard unit selector to item dialog and update item list | Complete | 7f40af6 | ~120s |
| 2 | Update item detail page and admin standard-units item count | Complete | 20497fe | ~103s |

---

## Key Technical Details

### InlineCreateSelect Integration

Used the existing `InlineCreateSelect` component with `createType="standard_unit"`:
- Hides color picker (standard units have no color)
- Shows name-only creation form
- Fetches max display_order for auto-append
- Creates unit and selects it in one action

### Supabase Join with FK Hints

Used FK hints to help Supabase resolve the join correctly:
```typescript
standard_unit_rel:standard_units!items_standard_unit_id_fkey(id, name)
```

The `!items_standard_unit_id_fkey` hint references the FK constraint name, guiding Supabase's query planner.

### Type Casting for Relations

Used `as unknown as` double cast for Supabase query results with relations:
```typescript
setItems(data as unknown as ItemWithCategory[]);
```

This handles TypeScript's strict type checking when Supabase relations don't perfectly match interface types.

### Count Aggregation Pattern

Instead of a SQL GROUP BY, we fetch all items and count in-memory:
- Simpler query (just select standard_unit_id)
- Works with current RLS policies
- Efficient for expected data size (hundreds of items)
- Map provides O(1) lookup in table rendering

---

## Testing Notes

**Type checking:** Passed with no errors (`npm run type-check`).

**Form validation:**
- Submit button properly disabled when standard_unit_id is empty
- InlineCreateSelect allows creating new units inline
- Standard unit is required on both create and edit

**Data display:**
- Item list shows unit names correctly
- Item detail page shows unit in both header and details section
- Admin page shows accurate item counts per unit

---

## Dependencies

**Requires:**
- Phase 52-01: items.standard_unit_id FK column with data
- Phase 51-02: InlineCreateSelect component with standard_unit support

**Enables:**
- Phase 53: Standard unit display refactor (can now remove default_unit references)

---

## Impact Summary

**UI changes:**
- Item dialog: +1 form field (Standard Unit selector)
- Item list: +1 column (Unit)
- Item detail: Changed "Default Unit" → "Standard Unit"
- Admin standard-units: Item Count now shows real data

**Query changes:**
- Item list query: +1 join (standard_units)
- Item detail query: +1 join (standard_units)
- Admin page: +1 query (fetch items for counting)

**Form changes:**
- Item insert/update: +1 field (standard_unit_id)

---

## Next Steps

**Phase 53:** Standard unit display refactor
- Remove or hide `default_unit` references across the application
- Consolidate all unit displays to use per-item standard units
- Update any remaining hardcoded "pcs" defaults

---

## Self-Check: PASSED

**File verification:**
```
FOUND: /home/yaungni/qm-core/app/(dashboard)/item/item-dialog.tsx (modified)
FOUND: /home/yaungni/qm-core/app/(dashboard)/item/page.tsx (modified)
FOUND: /home/yaungni/qm-core/app/(dashboard)/item/[id]/page.tsx (modified)
FOUND: /home/yaungni/qm-core/app/(dashboard)/admin/standard-units/page.tsx (modified)
```

**Commit verification:**
```
FOUND: 7f40af6 - feat(52-02): add standard unit selector to item dialog and list
FOUND: 20497fe - feat(52-02): update item detail page and admin standard-units item count
```

**Type check:**
```
PASSED: npm run type-check (no errors)
```

All artifacts modified, all commits present, all verification criteria met.
