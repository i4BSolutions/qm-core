# Phase 7: UX Polish - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Number inputs and date pickers work consistently across all transaction forms. This phase fixes:
- Transaction date picker displays DD/MM/YYYY format
- Number input fields allow direct typing without default value interference
- Number input fields reject negative values and zero where inappropriate

</domain>

<decisions>
## Implementation Decisions

### Date Picker Behavior
- Picker-only input — no manual date typing allowed (prevents format errors)
- Calendar dropdown appears below the input field
- Date displays as DD/MM/YYYY format (e.g., 29/01/2026)
- Week starts on Monday (ISO standard)

### Calendar Dropdown Design
- Keep existing calendar style consistent with QMRL, QMHQ, PO, and Invoice forms
- Click outside calendar to close (standard dismissal behavior)
- Today's date highlighted with ring/outline; selected date is filled
- Month/year navigation via dropdowns (not arrows) — allows jumping to distant dates quickly

### Claude's Discretion
- Number input implementation details (select-all on focus, placeholder approach)
- Validation timing for number fields (blur vs real-time)
- Which specific forms need fixes (Claude to audit transaction forms)
- Error message styling for invalid number inputs

</decisions>

<specifics>
## Specific Ideas

- "Calendar should look just like in QMRL, QMHQ, PO and Invoice" — don't redesign, just fix the format display

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-ux-polish*
*Context gathered: 2026-01-29*
