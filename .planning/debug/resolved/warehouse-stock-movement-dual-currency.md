---
status: resolved
trigger: "warehouse-stock-movement-dual-currency - Stock Movement History should show both original currency AND EUSD for each transaction"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:01:00Z
---

## Current Focus

hypothesis: The `unit_cost` column in the Stock Movement History table only shows the raw number without currency label or EUSD equivalent. The `CurrencyDisplay` component exists and handles dual-currency display perfectly.
test: Read the warehouse detail page and check `transactionColumns` definition for unit_cost column
expecting: The fix involves replacing the plain `unit_cost` column cell renderer with `CurrencyDisplay` using the transaction's `currency`, `exchange_rate`, and `unit_cost_eusd` fields
next_action: Apply fix to the `unit_cost` column and add `total_cost` dual-currency column for stock-in transactions

## Symptoms

expected: Stock Movement History table should display both the original currency amount (e.g., "1,000.00 MMK") and the EUSD equivalent (e.g., "0.25 EUSD") for each transaction's unit cost / total cost
actual: The `unit_cost` column shows only a raw number with no currency label and no EUSD equivalent (line 448-456 of warehouse/[id]/page.tsx)
errors: No errors — this is a UI enhancement
reproduction: Go to /warehouse/[id] -> Stock Movement tab -> check Unit Cost column
started: Previous fix (commit 52b5f03) made WAC/Total Value EUSD-only; stock movement history never had dual-currency

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T00:00:00Z
  checked: app/(dashboard)/warehouse/[id]/page.tsx lines 448-456
  found: unit_cost column renders `formatCurrency(row.getValue("unit_cost"))` with no currency code, no EUSD
  implication: Missing currency label and EUSD secondary line

- timestamp: 2026-02-18T00:00:00Z
  checked: types/database.ts for inventory_transactions
  found: Fields available: unit_cost, currency, exchange_rate, unit_cost_eusd, total_cost, total_cost_eusd
  implication: All data needed for dual-currency display is already available in the transaction record

- timestamp: 2026-02-18T00:00:00Z
  checked: components/ui/currency-display.tsx
  found: CurrencyDisplay component takes amount, currency, exchangeRate (or amountEusd) and renders original + EUSD secondary line
  implication: CurrencyDisplay is the right component to use here

- timestamp: 2026-02-18T00:00:00Z
  checked: InventoryTransactionWithItem interface and Supabase query
  found: The select query uses `*` so all fields (unit_cost, currency, exchange_rate, unit_cost_eusd, total_cost, total_cost_eusd) are already fetched
  implication: No query changes needed — just update the column renderer

## Resolution

root_cause: The unit_cost column in transactionColumns rendered only the raw number with no currency label and no EUSD secondary value. The available fields (currency, exchange_rate, unit_cost_eusd) were not being used.
fix: Replaced the plain unit_cost cell renderer with CurrencyDisplay using transaction.currency, transaction.exchange_rate, transaction.unit_cost_eusd. Also added a total_cost column with dual-currency display (total_cost + total_cost_eusd). Imported CurrencyDisplay component.
verification: TypeScript type-check passed with no errors. Fields are all present in the InventoryTransaction Row type and fetched by the existing select * query. CurrencyDisplay shows original currency as primary line and EUSD as secondary line. Stock-out transactions without unit_cost/currency show dashes.
files_changed:
  - app/(dashboard)/warehouse/[id]/page.tsx
