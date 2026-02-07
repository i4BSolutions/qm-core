---
status: resolved
trigger: "build-error-currency-display-props"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:06:00Z
---

## Current Focus

hypothesis: Fix applied and verified
test: Run npm run build
expecting: Clean build with no TypeScript errors
next_action: Archive debug session

## Symptoms

expected: Build should compile successfully
actual: TypeScript error - missing required props
errors: |
  ./app/(dashboard)/qmhq/[id]/page.tsx:456:16
  Type error: Type '{ amountEusd: number; size: "lg"; context: "card"; fluid: true; }' is missing the following properties from type 'CurrencyDisplayProps': amount, currency
reproduction: Run `npm run build`
started: Just broke after the previous fix (commit fdb3130) that replaced formatCurrency with CurrencyDisplay

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:01:00Z
  checked: CurrencyDisplay component interface
  found: Requires `amount: number` and `currency: string` as mandatory props (lines 18-20)
  implication: Cannot pass only amountEusd

- timestamp: 2026-02-07T00:01:30Z
  checked: QMHQ detail page lines 456-513
  found: 5 CurrencyDisplay instances passing only amountEusd, size, context, fluid props
  implication: Missing required amount and currency props on all 5 instances

- timestamp: 2026-02-07T00:02:00Z
  checked: QMHQ schema in types/database.ts (line 772-775)
  found: QMHQ has amount, currency, exchange_rate, amount_eusd fields
  implication: Can use these fields for QMHQ Amount display

- timestamp: 2026-02-07T00:02:30Z
  checked: QMHQ list page usage (app/(dashboard)/qmhq/page.tsx lines 424-428)
  found: Pattern for QMHQ amounts: amount={qmhq.amount}, currency={qmhq.currency || "MMK"}, amountEusd={qmhq.amount_eusd}
  implication: Use this pattern for QMHQ Amount card

- timestamp: 2026-02-07T00:03:00Z
  checked: EUSD-only calculations (Yet to Receive, Money In, Money Out, Balance)
  found: These are aggregated/calculated EUSD values without original currency
  implication: For EUSD-only values, use amount={eusdValue} and currency="EUSD"

- timestamp: 2026-02-07T00:05:00Z
  checked: npm run build after applying fixes
  found: Build completed successfully with no TypeScript errors
  implication: All 5 CurrencyDisplay instances now properly configured

## Resolution

root_cause: CurrencyDisplay instances in financial summary cards (lines 456-513) are missing required `amount` and `currency` props - they only pass `amountEusd` which is optional. The component requires both amount and currency as mandatory props.

fix: Updated all 5 CurrencyDisplay instances with proper props:
1. QMHQ Amount: amount={qmhq.amount}, currency={qmhq.currency || "MMK"}, amountEusd={qmhq.amount_eusd}
2. Yet to Receive: amount={calculated}, currency="EUSD" (EUSD-only aggregate)
3. Money In: amount={moneyInTotal}, currency="EUSD" (EUSD-only aggregate)
4. Money Out/PO Committed: amount={value}, currency="EUSD" (EUSD-only aggregate)
5. Balance in Hand: amount={calculated}, currency="EUSD" (EUSD-only aggregate)

verification: Build completed successfully with no TypeScript errors. All 5 CurrencyDisplay instances now have required props.

files_changed: ["app/(dashboard)/qmhq/[id]/page.tsx"]
