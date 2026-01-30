# Phase 10: Inventory Dashboard - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A dashboard page where users view stock transaction history with KPIs and filters. Users can see paginated transactions, filter by date/warehouse/item, and toggle between All/Stock In/Stock Out views. KPIs show transaction counts and values.

</domain>

<decisions>
## Implementation Decisions

### KPI Presentation
- Horizontal row of cards at top of page
- Show EUSD values only (not MMK)
- Default to all-time totals (no default time filter)
- KPIs include: Stock In count + value, Stock Out count + value, Net movement (EUSD in - EUSD out)
- KPIs update when filters change (date range, warehouse, item)
- Clicking a KPI card filters the table to that transaction type AND switches to corresponding tab

### Negative Value Display
- Claude's discretion for how to style negative net movement values

### Transaction List Layout
- Columns: Date, Item, Warehouse, Quantity, Type, Unit Cost, Total Value, Reference
- Type column shows colored badges: green "IN", red "OUT"
- Clicking a transaction row navigates to source document (Invoice or QMHQ)
- For manual stock-in, Reference column shows "Manual" label
- Values show original currency + EUSD (e.g., "1,000 MMK (0.50 EUSD)")
- Only date column is sortable
- Default sort: newest first
- Page size: Claude's discretion

### Filter Behavior
- Filters in dropdown/popover (filter button opens popover)
- Date range: custom range picker only (no presets)
- Warehouse filter: single selection only
- Item filter: searchable, type to search by item name
- Active filters shown as removable chips below filter button
- "Clear all filters" button when filters are active
- Filters persist across page visits (URL or local storage)

### Tab/Toggle Design
- Tab bar: All | Stock In | Stock Out
- Tabs positioned above the table, below filter controls
- Tabs show transaction counts that reflect active filters: "All (150) | Stock In (80) | Stock Out (70)"
- Clicking KPI card syncs with tab (switches to corresponding tab)
- Switching tabs preserves other filters (date, warehouse, item)
- Default tab: "All"
- URL reflection for tabs: Claude's discretion

### Claude's Discretion
- Page size for pagination
- Negative value styling (red text vs parentheses)
- Whether tab state should be in URL

</decisions>

<specifics>
## Specific Ideas

- KPIs should reflect filter state — when user narrows view, KPIs narrow too
- Transaction rows are clickable to navigate to source document
- Filters should be discoverable but not clutter the interface

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-inventory-dashboard*
*Context gathered: 2026-01-30*
