# Phase 52: Per-Item Standard Unit Assignment - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Each item gets assigned a standard unit from the managed list (Phase 51), with required selection on item create/edit and migration of existing items. This phase adds the FK, updates forms, and shows the unit in item views. It does NOT change how standard quantities are displayed (Phase 53 handles that).

</domain>

<decisions>
## Implementation Decisions

### Migration Strategy
- Auto-assign 'pcs' to all existing items during migration
- FK column: standard_unit_id referencing standard_units(id)
- ON DELETE RESTRICT — blocks deleting a unit if any items reference it (matches Phase 51 hard delete protection)
- Migration approach: Claude's discretion (single-step NOT NULL with DEFAULT or nullable + backfill + alter)
- No bulk reassign UI needed — admin edits individual items via item edit form

### Item Form Integration
- Use InlineCreateSelect with `createType: "standard_unit"` (Phase 51 prepared this)
- Position: next to item name in the top section — unit is a core property
- Required on both create AND edit — can't save without a unit
- Inline item creation (from PO/Invoice forms) also includes the unit selector
- No default pre-selected — force explicit selection (empty selector, user must pick)
- Always editable — unit can be changed anytime, even after transactions. Historical transactions keep their own conversion rates.

### Display in Item Views
- Item list table: new "Unit" column showing the unit name (kg, pcs, etc.)
- Item detail page: standard label-value info row ("Standard Unit: kg") in details section, not a badge
- Item selectors in PO/Invoice/Stock-out: keep name only, do NOT show unit in dropdown
- Wire up real item usage count in /admin/standard-units page (replace the Phase 51 placeholder "0")

### Claude's Discretion
- Migration column approach (single-step vs multi-step)
- Exact column position in item list table
- Unit column width and styling
- How to query item count per unit efficiently in admin page

</decisions>

<specifics>
## Specific Ideas

- The InlineCreateSelect for standard_unit was already extended in Phase 51 — this phase just wires it into item forms
- Item usage count in /admin/standard-units should now query real items.standard_unit_id counts
- Follow existing item form layout patterns for the unit selector placement

</specifics>

<deferred>
## Deferred Ideas

- Display refactor to use per-item unit names instead of global setting — Phase 53
- Unit conversion between standard units (e.g., kg to g) — not in current roadmap
- Showing unit name in item selector dropdowns — decided against, keep selectors clean

</deferred>

---

*Phase: 52-per-item-standard-unit-assignment*
*Context gathered: 2026-02-16*
