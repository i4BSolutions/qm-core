# Phase 53: Standard Unit Display Refactor - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Switch all standard quantity displays from the global standard unit name (system_config) to per-item standard unit names (items → standard_units table). Remove the global setting, admin settings page, system_config table, and all related artifacts. No new input capabilities — display refactor and cleanup only.

</domain>

<decisions>
## Implementation Decisions

### Mixed-unit aggregates
- Remove ALL aggregate/summed standard_qty from the entire system — no totals, no sums anywhere
- Standard qty is strictly per-line-item/per-row display only (like EUSD under amounts)
- Remove "Total Standard Stock" KPI card from warehouse detail page (keep "Total Units")
- Remove aggregate standard qty from inventory dashboard KPIs
- Remove standard qty totals from flow tracking page
- Universal rule: no standard qty totals/sums anywhere in the system
- Per-row standard qty display shows inline unit name: "50 kg", "120 pcs"

### Display label format
- Keep two-line format (same as EUSD pattern): Line 1 = original qty, Line 2 = "25 kg"
- Number first, unit after: "25 kg" (not "kg 25")
- Use standard_units.name as-is (admin controls display name, no separate abbreviation field)
- Apply thousand separators to standard qty values: "1,250 kg"
- Always show both lines, even when redundant (rate=1, unit='pcs' — still show "10 pcs")
- Column headers: generic "Std Qty" (since each row has its own unit)
- PDF exports: keep Std Qty column with per-item units inline ("25 kg"), header stays "Std Qty"

### Conversion rate live preview
- Under conversion rate input in transactional forms (PO, invoice, stock-in, stock-out): show real-time calculated total standard qty as user types
- Format: total only (e.g., "25 kg"), not per-unit breakdown
- Style: same muted/secondary text as EUSD display (smaller, gray)
- Only in transactional forms where conversion rate is entered

### Global config cleanup
- Remove system_config 'standard_unit_name' entry
- Drop system_config table entirely via migration (it only had the standard unit entry)
- Drop RLS policies for system_config in same migration
- Remove admin settings page entirely (/admin/settings)
- Remove sidebar link to settings page
- Remove useStandardUnitName() hook entirely — unit names come from item data in queries
- Clean sweep: remove ALL code referencing global standard unit name (types, API routes, utilities)

### Component data flow
- StandardUnitDisplay component API: Claude's discretion (props vs internal fetch)
- Query strategy for unit names: Claude's discretion (joins vs separate lookup)
- Form data flow: Claude's discretion (from item selector data vs separate fetch)
- PDF data: pre-resolved unit names passed from page to PDF generator (not independent query)
- Database views: Claude's discretion on which views need standard_units joins

### Claude's Discretion
- StandardUnitDisplay component API design (presentational with props vs smart with fetch)
- Query join strategy for getting unit names to display components
- Form item selector data enrichment approach
- Which database views need standard_units joins
- Any intermediate refactoring needed to support the transition

</decisions>

<specifics>
## Specific Ideas

- Live preview under conversion rate input mirrors the EUSD display style — muted secondary text
- Warehouse detail: keep "Total Units" KPI card, remove "Total Standard Stock" KPI card
- Item selectors in transactional forms should make the unit name available for the live preview

</specifics>

<deferred>
## Deferred Ideas

- Add conversion rate input to QMHQ item route form — new capability, belongs in its own phase
- Per-item unit abbreviation field (short_name) on standard_units table — not needed now, admin controls display name

</deferred>

---

*Phase: 53-standard-unit-display-refactor*
*Context gathered: 2026-02-16*
