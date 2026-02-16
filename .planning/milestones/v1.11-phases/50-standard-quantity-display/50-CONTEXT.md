# Phase 50: Standard Quantity Display - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Standard quantities display alongside every quantity in the system, mirroring the CurrencyDisplay/EUSD two-line pattern. The StandardUnitDisplay component shows converted standard qty below the original quantity everywhere quantities appear — tables, detail pages, PDFs, dashboards, and flow tracking.

</domain>

<decisions>
## Implementation Decisions

### Display format
- Two-line layout mirroring CurrencyDisplay exactly: original qty on top, standard qty below in smaller/muted text
- Result only on the second line (e.g. "250 Standard Units") — no conversion calculation shown
- Number formatting matches the original quantity (thousand separators, same decimal precision)
- Styling mirrors EUSD line exactly: same muted color, smaller font size, same spacing

### Placement & scope
- Standard qty appears in ALL quantity columns across all table/list views (PO line items, invoice line items, inventory transactions, etc.)
- Summary/total rows also show standard qty totals (summed standard quantities alongside original totals)
- PDF exports (invoice receipts, stock-out receipts) include standard quantities matching on-screen display
- Flow tracking page and dashboard KPI cards also show standard quantities — everywhere quantities appear

### Labels & naming
- Use the admin-configured standard unit name (full name, no abbreviation field)
- Label format mirrors whatever CurrencyDisplay uses for EUSD — stay consistent
- If admin has NOT configured a standard unit name: hide the standard qty line entirely (don't show second line until configured)

### Claude's Discretion
- Exact component API design for StandardUnitDisplay
- How to handle conversion_rate = 1 edge case (show or suppress when same unit)
- Column width adjustments for tables with two-line quantity cells
- PDF layout adjustments for the additional standard qty line

</decisions>

<specifics>
## Specific Ideas

- Mirror CurrencyDisplay pattern exactly — this is the EUSD equivalent for quantities
- The `useStandardUnit` hook from Phase 48 provides the configured unit name
- All existing transactions display with standard qty from backfilled conversion_rate = 1

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-standard-quantity-display*
*Context gathered: 2026-02-15*
