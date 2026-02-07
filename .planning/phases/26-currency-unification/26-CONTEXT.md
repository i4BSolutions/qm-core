# Phase 26: Currency Unification - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

QMHQ money-in and money-out inherit currency from the parent QMHQ (expense or po route). Balance tracking shows remaining funds, and validation warns when money-out exceeds available balance. All QMHQ amounts display in both org currency and EUSD.

</domain>

<decisions>
## Implementation Decisions

### Currency Inheritance
- Currency for money-in and money-out comes from QMHQ route (expense/po), not from first transaction
- QMHQ expense/po route always has currency defined — no edge case for missing currency
- Money-in currency: locked to QMHQ currency (read-only)
- Money-out currency: locked to QMHQ currency (read-only)
- Money-in exchange rate: editable per transaction (default from QMHQ)
- Money-out exchange rate: editable per transaction (default from QMHQ)
- PO created from QMHQ: currency defaults from QMHQ but user can choose differently
- Show visual indicator (lock icon or label) on form fields to indicate inherited currency

### Balance Display
- No changes from earlier milestone — balance shown in existing "Balance in Hand" card on QMHQ detail page
- Money-out form shows static current balance (no real-time update as user types)
- Balance in Hand card shows both org currency and EUSD (using CurrencyDisplay pattern)
- Zero balance shows as "0.00" with no special visual state

### Validation Behavior
- "Exceeds balance" validation triggers on submit only
- Warning only, not hard block (allows edge cases)
- Detailed message format: "Amount exceeds balance by X (Available: Y)"
- UI validation only, no database constraint

### Dual Currency Display
- Use existing CurrencyDisplay component (two-line format: org primary, EUSD secondary)
- All QMHQ amounts show dual currency: money-in total, money-out total, balance, budget
- Money-in/money-out transaction tables show dual currency per row
- Use compact formatting (K/M/B) from Phase 24 with same thresholds

### Claude's Discretion
- Exact lock icon design and placement
- Precise formatting of warning message
- Table column layout for dual currency in transaction rows

</decisions>

<specifics>
## Specific Ideas

- Currency inheritance follows QMHQ → transactions pattern (not transaction → transaction)
- Balance warning is soft (warning, not block) to handle real-world edge cases
- Reuse CurrencyDisplay component consistently across all QMHQ amounts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-currency-unification*
*Context gathered: 2026-02-08*
