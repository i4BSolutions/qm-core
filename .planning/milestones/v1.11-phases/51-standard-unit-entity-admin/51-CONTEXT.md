# Phase 51: Standard Unit Entity & Admin - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can manage a list of standard units (kg, liters, meters, etc.) with full CRUD, and inline creation is available in forms. This phase creates the entity, admin page, and extends the inline-create-select component. It does NOT assign units to items (Phase 52) or refactor displays (Phase 53).

</domain>

<decisions>
## Implementation Decisions

### Unit Data Model
- Flat list of units — no category/type grouping (no Weight/Volume/Length groups)
- Name only — single field, no separate abbreviation or description (e.g., just "kg")
- Hard delete with protection — block deletion if any items reference the unit (DB constraint), no soft delete/is_active pattern
- display_order field for custom sorting in dropdowns and admin list
- Standard audit fields (created_at, updated_at, created_by, updated_by)

### Admin UI
- Own page at `/admin/standard-units` — NOT on /admin/settings
- Remove the global standard unit name setting from /admin/settings (the system_config entry). Existing StandardUnitDisplay hook can fall back to its default until Phase 53 rewires per-item display.
- Follow DataTable + Dialog pattern (same as /admin/categories, /admin/statuses)
- Dialog has single field: name (required). Display order auto-managed or editable in dialog.
- Show item usage count column — query count of items referencing each unit (useful after Phase 52 adds FK; show 0 for now)
- Add sidebar nav entry under Admin section
- Permission: admin-only (same as other admin pages)

### Inline Creation
- Extend `inline-create-select.tsx` to support `createType: "standard_unit"`
- Inline form: just name input + Create & Select button
- Auto-append display_order (max + 1) for inline-created units
- Do NOT wire into any forms yet — Phase 52 will add the unit selector to item create/edit forms
- Prepare the component extension so Phase 52 can use it directly

### Seed Data Migration
- Seed 9 common units via database migration: pcs, kg, g, L, mL, m, cm, box, pack
- Do NOT add FK from items table — Phase 52 handles that
- Do NOT scan existing items.default_unit values — Phase 52 handles mapping

### Claude's Discretion
- Exact table column layout and widths
- Dialog validation UX details
- RLS policy implementation (follow existing admin-only patterns)
- Migration numbering

</decisions>

<specifics>
## Specific Ideas

- Follow the exact same component structure as /admin/categories: page.tsx + unit-dialog.tsx
- Item count column prepares for delete protection UX ("Cannot delete: used by 5 items")
- Seed data ordered sensibly: pcs first (most common), then weight, volume, length, packaging

</specifics>

<deferred>
## Deferred Ideas

- Per-item standard unit assignment (FK + item form selector) — Phase 52
- Display refactor to use per-item unit names — Phase 53
- Unit conversion between standard units (e.g., kg to g) — not in current roadmap

</deferred>

---

*Phase: 51-standard-unit-entity-admin*
*Context gathered: 2026-02-16*
