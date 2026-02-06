# Phase 21: Item Enhancements - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add price reference notes to items and implement auto-generated item codes based on category. Code format: SKU-[CAT]-[XXXX]. Codes are immutable once generated. Category becomes required for items.

</domain>

<decisions>
## Implementation Decisions

### Price Reference Display
- Free text field, max 100 characters
- Required for new items; existing items without reference can remain until manually edited
- Visible in: PO line item selector (tooltip on hover), Item List page (dedicated column)
- Item List column visible by default

### Code Generation Behavior
- Code generated on form save (not on category select)
- Format: `SKU-[CAT]-[XXXX]` where CAT is category abbreviation and XXXX is random 4-char uppercase alphanumeric
- Sequence is random per item (not sequential numbering)
- If category changes, only the CAT portion updates; random suffix stays the same
- Backfill all existing items during migration (overwrite any existing codes)

### Code Format Details
- Category abbreviation: First letter of each word, uppercase (e.g., "Office Supplies" → OFS, "Equipment" → E)
- Random suffix: 4 characters, uppercase alphanumeric only (A-Z, 0-9)
- Category is now required for item creation (no uncategorized items)

### Code Display & Override
- Code cannot be edited or overridden by users
- Code hidden during item creation; only visible after save
- Code is primary identifier — displayed prominently
- Format in lists/selectors: "SKU-EQP-A7B2 — Laptop Stand" (code first)

### Claude's Discretion
- Collision handling strategy for random codes
- Migration script approach for backfill
- Exact tooltip styling for price reference

</decisions>

<specifics>
## Specific Ideas

- Code should look like a proper SKU that can be used for inventory tracking
- Price reference helps purchasing team make informed decisions without leaving PO form

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-item-enhancements*
*Context gathered: 2026-02-06*
