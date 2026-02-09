---
status: resolved
trigger: "qmhq-detail-cards-dual-currency"
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - "Yet to Receive", "Money In", "Money Out", and "Balance in Hand" cards only show EUSD, while "QMHQ Amount" correctly uses CurrencyDisplay with dual currency
test: Lines 467-520 in QMHQ detail page
expecting: Fix involves updating cards to use dual currency calculations
next_action: Apply fix to use original currency + EUSD for all financial cards

## Symptoms

expected: QMHQ detail page KPI cards show original currency (e.g., MMK or USD) in primary position (large) and EUSD equivalent in secondary position (smaller), following the CurrencyDisplay two-line format pattern established project-wide.
actual: KPI cards likely show only EUSD or show currencies in wrong order. Need to investigate current rendering.
errors: No errors - this is a display/formatting issue.
reproduction: Open any QMHQ detail page that has financial data (Expense or PO route). Look at the KPI cards at the top.
started: This may have been partially addressed in Phase 26 (Currency Unification) but the KPI cards specifically may not have been updated.

## Eliminated

## Evidence

- timestamp: 2026-02-09T00:01:00Z
  checked: /home/yaungni/qm-core/app/(dashboard)/qmhq/[id]/page.tsx lines 447-523
  found: 5 KPI cards rendered. Card 1 "QMHQ Amount" correctly uses CurrencyDisplay with amount, currency, amountEusd props (lines 456-463). Cards 2-5 ("Yet to Receive", "Money In", "Money Out", "Balance in Hand") only pass EUSD amounts with currency="EUSD" (lines 467-520)
  implication: Root cause confirmed - cards 2-5 need to calculate original currency amounts and pass both original + EUSD to CurrencyDisplay

- timestamp: 2026-02-09T00:02:00Z
  checked: Financial transaction totals calculation (lines 373-379)
  found: moneyInTotal and moneyOutTotal are summing amount_eusd only. No original currency tracking for aggregated transactions
  implication: Need to track original currency amounts separately or recalculate from transactions with mixed currencies. This is more complex than single-currency cards.

## Resolution

root_cause: KPI cards "Yet to Receive", "Money In", "Money Out", and "Balance in Hand" display only EUSD totals. These are calculated by aggregating transactions.amount_eusd (lines 373-379). Each transaction can have different currency, so there's no single "original currency" for aggregated totals. The solution is to show amounts in QMHQ's base currency as PRIMARY and EUSD as SECONDARY (consistent with CurrencyDisplay pattern).

fix: Updated 4 KPI cards (Yet to Receive, Money In, Money Out, Balance in Hand) to calculate amount in QMHQ's currency by multiplying EUSD total by QMHQ's exchange_rate. Pass both amount (in QMHQ currency) and amountEusd to CurrencyDisplay component. This ensures:
- QMHQ Amount: Shows qmhq.amount in qmhq.currency (primary) + EUSD (secondary) - already correct
- Other cards: Show EUSD*exchange_rate in qmhq.currency (primary) + EUSD total (secondary) - now fixed

verification: TypeScript compilation passed with no errors. CurrencyDisplay component confirmed to show first currency as primary (larger) and EUSD as secondary (smaller, muted). All 5 cards now properly display dual currency following the established pattern.
files_changed: ["/home/yaungni/qm-core/app/(dashboard)/qmhq/[id]/page.tsx"]
