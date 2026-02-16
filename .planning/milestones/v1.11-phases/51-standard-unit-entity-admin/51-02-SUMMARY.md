---
phase: 51
plan: 02
subsystem: standard-units
tags: [admin-ui, crud, sidebar, inline-creation]

dependency_graph:
  requires:
    - standard_units table (51-01)
    - StandardUnit TypeScript type (51-01)
    - categories admin page pattern
    - InlineCreateSelect component
  provides:
    - /admin/standard-units CRUD page
    - UnitDialog component
    - Sidebar nav entry for Standard Units
    - InlineCreateSelect support for standard_unit type
  affects:
    - components/layout/sidebar.tsx (added nav entry)
    - components/forms/inline-create-select.tsx (extended for standard_unit)

tech_stack:
  added:
    - StandardUnitsPage component
    - UnitDialog component
  patterns:
    - DataTable + Dialog CRUD pattern (mirroring categories)
    - Hard delete with FK protection
    - Admin permission proxy via categories
    - Conditional UI rendering for inline creation types

key_files:
  created:
    - app/(dashboard)/admin/standard-units/page.tsx
    - app/(dashboard)/admin/standard-units/unit-dialog.tsx
  modified:
    - components/layout/sidebar.tsx (added Standard Units link)
    - components/forms/inline-create-select.tsx (extended createType)

decisions:
  - decision: Use admin permission proxy via categories can() checks
    rationale: Standard units are admin-only, same security model as categories
    alternatives: [Create dedicated standard_units permission, Use statuses as proxy]
  - decision: Hard delete only with FK error handling
    rationale: Consistent with migration design from 51-01
    alternatives: [Implement soft delete, Block delete unconditionally]
  - decision: Hide color picker for standard_unit in InlineCreateSelect
    rationale: Standard units don't have color property, cleaner UX
    alternatives: [Show disabled color picker, Keep all fields visible]

metrics:
  duration: 262s
  tasks_completed: 2
  files_modified: 4
  completed_at: "2026-02-16T15:22:07Z"
---

# Phase 51 Plan 02: Standard Units Admin UI

Built the complete admin CRUD interface for standard units using the exact same DataTable + Dialog pattern as categories. Extended InlineCreateSelect to support standard_unit creation for Phase 52 readiness.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create standard units admin page and dialog | 17888e2 | app/(dashboard)/admin/standard-units/page.tsx, app/(dashboard)/admin/standard-units/unit-dialog.tsx |
| 2 | Add sidebar nav entry and extend inline-create-select | b047806 | components/layout/sidebar.tsx, components/forms/inline-create-select.tsx |

## Implementation Details

### Standard Units Admin Page

Created `/admin/standard-units` following the exact pattern from `/admin/categories`:

**Page Features:**
- DataTable with columns: Name (font-medium), Item Count (always 0 with tooltip), Display Order (font-mono), Actions (Edit/Delete dropdown)
- Permission checks using categories as admin proxy: `can("create", "categories")`, etc.
- Stats card showing total unit count
- PageHeader with violet Admin badge
- "New Unit" button with rotating Plus icon

**UnitDialog Features:**
- Simple two-field form: Name (required) and Display Order (number input)
- Dialog titles: "Add Standard Unit" / "Edit Standard Unit"
- Dialog descriptions: "Add a new unit of measurement." / "Update the unit details."
- No color picker (unlike categories)
- No entity_type selector (standard units are global)

**Delete Handler:**
- Hard DELETE operation (not soft delete)
- FK constraint error detection
- User-friendly error message: "This unit is in use by items and cannot be deleted."

**Item Count Column:**
- Shows "0" for all units (FK doesn't exist yet)
- Tooltip: "Available after item assignment"
- Slate-400 styling to indicate placeholder status

### Sidebar Navigation

Updated `components/layout/sidebar.tsx`:
- Added "Standard Units" link to Admin children array
- Positioned after "Statuses" and before "Flow Tracking"
- Full admin nav order: Users, Departments, Suppliers, Contacts, Categories, Statuses, **Standard Units**, Flow Tracking, Settings

### InlineCreateSelect Extension

Extended `components/forms/inline-create-select.tsx` to support `createType: "standard_unit"`:

**Type Updates:**
- Changed `createType` from `"category" | "status"` to `"category" | "status" | "standard_unit"`

**Standard Unit Creation Logic:**
```typescript
// Get max display_order for auto-append
const { data: maxOrderData } = await supabase
  .from("standard_units")
  .select("display_order")
  .order("display_order", { ascending: false })
  .limit(1)
  .single();

const nextOrder = (maxOrderData?.display_order ?? 0) + 1;

// Insert new unit
const { data, error } = await supabase
  .from("standard_units")
  .insert({
    name: newName.trim(),
    display_order: nextOrder,
  })
  .select()
  .single();
```

**UI Conditional Rendering:**
- Color picker hidden when `createType === "standard_unit"`
- Display labels updated: "unit" instead of "standard_unit"
- Form title: "Create New Unit"
- Search placeholder: "Search unit..."
- Hint text: "Click [+] button to create new unit"

**Success Toast:**
- Message: `Unit "{name}" created and selected`

### Type Assertions

Used `as any` type assertions for Supabase queries to `standard_units` table since the generated types haven't been updated yet (table was created in 51-01 migration). This is a temporary workaround until types are regenerated.

## Verification

All verification criteria met:
- [x] `npm run type-check` passes with no new errors
- [x] /admin/standard-units page exists and renders DataTable
- [x] UnitDialog opens for create and edit operations
- [x] Delete performs hard DELETE with FK protection error handling
- [x] Sidebar includes "Standard Units" link under Admin
- [x] InlineCreateSelect createType accepts "standard_unit"
- [x] Inline form for standard_unit shows only name input (no color picker)
- [x] Item count column shows 0 for all units

## Deviations from Plan

None - plan executed exactly as written.

## Next Steps

Phase 51 Plan 03 will add the final admin integration touches. Phase 52 will wire the InlineCreateSelect into item forms to enable per-item standard unit assignment.

## Self-Check: PASSED

Verified all artifacts exist:
- FOUND: app/(dashboard)/admin/standard-units/page.tsx
- FOUND: app/(dashboard)/admin/standard-units/unit-dialog.tsx
- FOUND: 17888e2 (Task 1 commit)
- FOUND: b047806 (Task 2 commit)
- FOUND: "Standard Units" in components/layout/sidebar.tsx
- FOUND: `createType: "category" | "status" | "standard_unit"` in inline-create-select.tsx
