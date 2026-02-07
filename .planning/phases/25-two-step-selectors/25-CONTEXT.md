# Phase 25: Two-Step Selectors - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

PO line item selection uses category-first filtering to reduce item list complexity. User selects category first, then item selector filters by that category. This pattern applies to ALL item selectors across the app (PO, Invoice, and any other item dropdowns). PO line items are not editable after creation.

</domain>

<decisions>
## Implementation Decisions

### Selector Layout
- Stacked layout: category dropdown above, item dropdown below
- Both dropdowns are full width (same width as each other)
- PO line items cannot be edited after creation (no edit mode for selectors)
- Pattern applies to ALL item selectors across the app, not just PO
- Items display as "Name + SKU" in dropdown (name with SKU code visible)
- Inactive items are hidden from dropdown (not shown grayed out)
- Empty categories show message in dropdown: "No items in this category"

### Category Display
- No item counts shown next to category names
- Color dot shown before category name (using category's assigned color)
- Categories sorted alphabetically (A-Z)
- Empty categories hidden from dropdown (only categories with active items shown)

### Item Filtering Behavior
- Category is required (no "All Categories" option)
- When category changes: clear item selection and close dropdown
- Item dropdown is disabled until category is selected
- Helper text under category field: "Selecting a category will filter items below"

### Search Experience
- Both category and item dropdowns are searchable
- Item search matches both name and SKU
- Search starts immediately on first character (no minimum)
- Full keyboard support: arrow keys to navigate, Enter to select, Escape to close

### Claude's Discretion
- Loading state approach (prefetch vs on-demand with spinner)
- Exact helper text wording
- Dropdown styling and animations
- Search debounce timing if needed

</decisions>

<specifics>
## Specific Ideas

- Two-step pattern should feel natural and reduce cognitive load when many items exist
- The disabled item dropdown should clearly indicate dependency on category selection
- Color dots on categories provide quick visual recognition

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-two-step-selectors*
*Context gathered: 2026-02-07*
