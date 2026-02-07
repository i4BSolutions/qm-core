---
status: resolved
trigger: "qmhq-detail-cards-amount-overflow"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:00:03Z
---

## Current Focus

hypothesis: CurrencyDisplay components in QMHQ detail page summary cards are missing context="card" and fluid props
test: Locate all CurrencyDisplay usages in the summary cards and verify they lack the required props
expecting: Finding CurrencyDisplay without context="card" and fluid props in the stat cards
next_action: Read the QMHQ detail page component to locate CurrencyDisplay usages

## Symptoms

expected: Large amounts should abbreviate with K/M/B suffixes in the QMHQ detail page summary cards
actual: Text overflows the card boundaries - no abbreviation happening
errors: No error messages - visual/layout issue
reproduction: View QMHQ detail page (/qmhq/[id]) with large amount values
started: Same issue as was just fixed in QMHQ list page cards - detail page was missed
location: QMHQ detail page - specifically the summary cards showing: QMHQ Amount, Yet to Receive, Money In, Money Out, Balance in Hand

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:00:01Z
  checked: app/(dashboard)/qmhq/[id]/page.tsx lines 448-503
  found: Financial summary cards (lines 452-500) use formatCurrency() instead of CurrencyDisplay component
  implication: Missing context="card" and fluid props means no abbreviation happens, causing overflow

- timestamp: 2026-02-07T00:00:02Z
  checked: Five stat cards in the summary section
  found: QMHQ Amount (line 457), Yet to Receive (line 466), Money In (line 475), Money Out (line 486), Balance in Hand (line 497) all use formatCurrency
  implication: All five cards need to be converted to CurrencyDisplay with proper props

## Resolution

root_cause: Financial summary cards in QMHQ detail page use formatCurrency() directly instead of CurrencyDisplay component with context="card" and fluid props, preventing amount abbreviation
fix: Replace formatCurrency() calls with CurrencyDisplay components using context="card" and fluid props in all five summary cards
verification: View QMHQ detail page with large amounts and verify K/M/B abbreviation appears without overflow
files_changed: ["app/(dashboard)/qmhq/[id]/page.tsx"]
