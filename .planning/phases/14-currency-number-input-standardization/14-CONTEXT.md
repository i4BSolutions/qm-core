# Phase 14: Currency & Number Input Standardization - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Number inputs preserve user-typed values without auto-formatting on blur, and currency displays show original value with EUSD equivalent. Updates apply to all forms, detail pages, lists, and KPI cards across QMRL, QMHQ, PO, Invoice, and Inventory views.

</domain>

<decisions>
## Implementation Decisions

### Input Behavior on Blur
- Keep exactly what user typed (no formatting on blur)
- Keep leading zeros (e.g., "007.50" stays as typed)
- Empty fields stay empty (show placeholder, not "0")
- Block non-numeric characters while typing (only digits, decimal point allowed)
- Block extra decimals while typing (2 for amounts, 4 for exchange rates)
- Exchange rate fields behave same as amount fields (preserve input until submit)
- Quantity fields: block decimals entirely (integers only)
- No negative amounts allowed (no minus sign)

### Empty State Display
- Empty fields show blank (no placeholder text)
- Exchange rate fields also show blank when empty
- Validation errors show via toast notification on submit

### Currency Display Format
- Two lines stacked: original currency on top, EUSD below
- Format: amount after currency code (e.g., "500.00 USD")
- EUSD line always shows, even when original is USD (consistent display)
- Totals/subtotals show both currencies stacked
- Thousand separators always used (e.g., "1,000,000.00 USD")
- In table columns with limited space: show original, EUSD in tooltip

### Scope
- All forms updated at once (not prioritized/phased)
- Read-only displays (detail pages, lists) updated together with forms
- Dashboard KPI cards included
- Modify existing formatCurrency/formatAmount utilities (not replace)

### Claude's Discretion
- EUSD panel visibility when amount is empty (hide vs show dashes)
- EUSD line styling (smaller/muted vs same size)
- Currency placement on detail pages (in-place vs summary section)

</decisions>

<specifics>
## Specific Ideas

- Toast notification for validation rather than inline red borders
- Consistent formatting across all financial views (forms, displays, KPIs)
- Thousand separators for readability in large amounts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-currency-number-input-standardization*
*Context gathered: 2026-02-02*
