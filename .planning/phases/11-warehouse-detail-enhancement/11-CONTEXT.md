# Phase 11: Warehouse Detail Enhancement - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the warehouse detail page to display per-item WAC (Weighted Average Cost) with EUSD values. Users can see inventory value breakdown by item and total warehouse value. This enhances the existing warehouse inventory tab — no new pages or navigation.

</domain>

<decisions>
## Implementation Decisions

### Table Layout & Columns
- Detailed columns: Item name (linked), Item code/SKU, Unit of measure, Stock quantity, WAC (EUSD), Total Value (EUSD)
- Default sort: By total value (highest first)
- All columns sortable via header click
- Zero-stock items shown with visual distinction (grayed out)
- Search box above table for filtering by item name or code
- Item name is clickable link to /item/[id] — row click does not navigate

### Value Formatting
- **EUSD only** — do not show MMK columns, EUSD is sufficient
- Currency suffix format: "1,234.56 EUSD"
- 2 decimal places for all values (WAC and totals)
- Full numbers with commas — no abbreviation (1,234,567.89 not 1.2M)
- Negative values displayed in red text
- Zero values displayed as em-dash (—)

### Summary Section
- KPI cards above the table (not footer row)
- Three KPIs: Total Warehouse Value (EUSD), Unique Items (with stock > 0), Total Units
- No trend indicators for now

### Empty & Zero States
- Empty warehouse: Show table headers with "No items" row
- Items with no WAC: Show dash (—) for WAC and Total Value columns
- Items without WAC excluded from Total Value calculation
- Zero-stock items not counted in "Unique Items" KPI
- Search includes zero-stock items in results
- Low stock warning: Amber/orange highlight for items below global threshold (10 units)

### Claude's Discretion
- Pagination approach (paginated vs virtual scroll)
- Column header styling (standard vs grouped)
- Number alignment (right-align expected for accounting)
- Visual separation between column groups
- Search empty state message and interaction
- KPI card layout arrangement

</decisions>

<specifics>
## Specific Ideas

- Use existing global low stock threshold (10 units) for warning indicators
- Pattern similar to inventory dashboard but focused on single warehouse view
- Item name links should be the only clickable element in each row

</specifics>

<deferred>
## Deferred Ideas

- Trend indicators on KPI cards (e.g., +5% from last month) — future enhancement
- Per-item configurable low stock thresholds — separate feature

</deferred>

---

*Phase: 11-warehouse-detail-enhancement*
*Context gathered: 2026-01-30*
