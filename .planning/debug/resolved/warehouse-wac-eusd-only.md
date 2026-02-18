---
status: resolved
trigger: "WAC on the warehouse detail page should ONLY show EUSD values, not original currency"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:20:00Z
---

## Current Focus

hypothesis: RESOLVED - DB trigger was already correct. UI changed to EUSD-only display on both warehouse and item pages.
test: TypeScript type-check: passed (exit 0). Lint: no new errors in changed files.
expecting: N/A
next_action: Archived

## Symptoms

expected: WAC unit price column shows ONLY EUSD value; Total Value column shows ONLY EUSD value; WAC calculated as sum(qty × eusd_unit_price) / total_qty
actual: Warehouse page showed WAC in original currency (MMK) as primary value, EUSD as secondary line via CurrencyDisplay
errors: No errors — display/logic change required
reproduction: Go to /warehouse/[id] and check WAC and Total Value columns
started: Always been this way; user wants EUSD-only display

## Eliminated

- hypothesis: DB trigger computes EUSD WAC incorrectly
  evidence: Migration 20260218230000_fix_wac_eusd_calculation.sql already replaced the old trigger with a correct weighted-average EUSD formula. wac_amount_eusd is the source of truth.
  timestamp: 2026-02-18T00:05:00Z

## Evidence

- timestamp: 2026-02-18T00:03:00Z
  checked: supabase/migrations/20260218230000_fix_wac_eusd_calculation.sql
  found: update_item_wac() trigger computes wac_amount_eusd = (existing_qty * existing_wac_eusd + new_qty * (unit_cost/exchange_rate)) / total_qty - correct weighted average EUSD formula
  implication: DB side is already correct; only UI needs changing

- timestamp: 2026-02-18T00:04:00Z
  checked: app/(dashboard)/warehouse/[id]/page.tsx lines 302-362
  found: WAC column used CurrencyDisplay with amount=wac_amount (original currency) as primary, amountEusd=wac_amount_eusd as secondary. Total Value column also used original currency as primary.
  implication: Both columns showed original currency as main line; needed to swap to EUSD-only

- timestamp: 2026-02-18T00:05:00Z
  checked: app/(dashboard)/item/[id]/page.tsx
  found: WAC KPI card showed wac_amount + wac_amount_eusd. Total Value KPI showed totalValue + totalValueEusd. WAC Valuation panel showed wac_amount. "Value at WAC" column showed total_value + total_value_eusd.
  implication: Item detail page also needed all WAC/total value displays changed to EUSD-only

- timestamp: 2026-02-18T00:10:00Z
  checked: TypeScript type-check and ESLint
  found: Exit code 0, no new errors in changed files
  implication: Changes are type-safe and lint-clean

## Resolution

root_cause: UI components on warehouse/[id]/page.tsx and item/[id]/page.tsx used CurrencyDisplay with original currency as primary value. The DB wac_amount_eusd calculation was already correct after the 20260218230000 migration.
fix: Changed all WAC and Total Value displays on warehouse and item detail pages to show only wac_amount_eusd (EUSD) using inline formatted text. Removed now-unused CurrencyDisplay, formatWAC, and formatExchangeRate imports.
verification: TypeScript type-check passes (exit 0). No lint errors in changed files. Column headers updated to clarify EUSD ("WAC (EUSD)", "Total Value (EUSD)", "Value at WAC (EUSD)").
files_changed:
  - app/(dashboard)/warehouse/[id]/page.tsx
  - app/(dashboard)/item/[id]/page.tsx
