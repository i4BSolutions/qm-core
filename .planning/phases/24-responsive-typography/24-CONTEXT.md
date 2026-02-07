# Phase 24: Responsive Typography - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Amount displays adapt to viewport and number size without overflow or loss of precision. Large amounts use fluid font scaling, very large numbers truncate with abbreviations and tooltips, and displays remain readable across all breakpoints.

</domain>

<decisions>
## Implementation Decisions

### Scaling behavior
- Fluid scaling using CSS clamp() — font shrinks smoothly as number grows or container shrinks
- EUSD line scales in proportion to primary amount (not independently)
- Apply fluid scaling everywhere — cards, summary sections, tables, detail pages

### Truncation rules
- Use K/M/B abbreviations for large numbers (not ellipsis)
- Context-dependent thresholds: cards abbreviate earlier (M+), tables/details show full numbers longer
- Hover tooltip reveals full value (desktop only)
- Tooltip shows only the truncated value, not both currencies

### Edge cases
- Negative amounts: minus sign prefix + red text color
- Zero amounts: display as "0.00" with currency symbol (not dash, not muted)
- Loading states: skeleton placeholder matching expected amount width
- Alignment: keep existing two-line stacked format (CurrencyDisplay), no side-by-side changes

### Claude's Discretion
- Minimum font size before truncation kicks in (accessibility best practices)
- Exact clamp() values and breakpoint calculations
- Mobile touch behavior for tooltips (if needed)

</decisions>

<specifics>
## Specific Ideas

- Current system uses CurrencyDisplay with two-line format (original + EUSD stacked) — responsive changes should preserve this pattern
- Existing patterns from v1.3: CurrencyDisplay component for two-line original + EUSD format

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-responsive-typography*
*Context gathered: 2026-02-07*
