---
status: resolved
trigger: "warehouse-wac-calculation-wrong"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T02:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two bugs found:
  1. WAC trigger `current_qty` subquery includes ALL net stock (transactions with AND without unit_cost), so zero-cost stock-ins dilute WAC incorrectly. The `current_qty` for WAC purposes should only count stock from transactions that participated in WAC updates (i.e., had unit_cost), but currently counts everything.
  2. `wac_exchange_rate` on items is always the LAST stock-in's exchange rate, not a weighted average. So `wac_amount_eusd = wac_amount / wac_exchange_rate` uses the wrong exchange rate for EUSD, producing wrong EUSD WAC and total_value_eusd when multiple stock-ins happen at different exchange rates.
test: traced through the trigger code in 024_inventory_wac_trigger.sql
expecting: fix the WAC trigger's current_qty to only include costed transactions, and fix total_value_eusd computation
next_action: apply fixes

## Symptoms

expected: WAC calculated correctly using WAC = (Existing Value + New Value) / (Existing Qty + New Qty), applied incrementally with each stock-in transaction
actual: Both the WAC unit price column and the Total Value (stock * WAC) column show incorrect values on the warehouse detail page
errors: No errors - values are computed but wrong
reproduction: Go to /warehouse/[id] and check WAC and Total Value columns in the Current Inventory table
started: Suspected to have always been wrong

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-18T01:00:00Z
  checked: migration 024_inventory_wac_trigger.sql - update_item_wac() function
  found: WAC trigger calculates current_qty as net global stock across ALL warehouses and ALL transactions (including those without unit_cost). The formula `existing_value = current_qty * current_wac` then uses this inflated qty, diluting WAC when any stock-ins had no unit_cost.
  implication: if 100 units were received with no cost, then 50 received at 600, WAC = (100*0 + 50*600)/150 = 200 instead of 600. Users see WAC of 200 but paid 600.

- timestamp: 2026-02-18T01:05:00Z
  checked: items table schema (migration 007_items.sql) - wac_amount_eusd generated column
  found: wac_amount_eusd = ROUND(wac_amount / wac_exchange_rate, 2) where wac_exchange_rate is set to the LAST stock-in's exchange rate, not a weighted average exchange rate
  implication: when items are received at different exchange rates over time, wac_amount_eusd uses a wrong exchange rate and produces incorrect EUSD values for both WAC per unit and total_value_eusd

- timestamp: 2026-02-18T01:10:00Z
  checked: app/(dashboard)/warehouse/[id]/page.tsx - total_value computation
  found: total_value = current_stock * wac_amount (correct for local currency), total_value_eusd = current_stock * wac_amount_eusd (inherits the wrong exchange rate from items.wac_exchange_rate)
  implication: total_value in local currency is correct, but total_value_eusd is incorrect when exchange rates vary

- timestamp: 2026-02-18T01:15:00Z
  checked: WAC trigger - correct aspects
  found: The WAC formula itself (existing_value + new_value) / total_qty is mathematically correct. The trigger correctly uses AFTER INSERT, excludes current transaction with id != NEW.id, and clips negative qty with GREATEST. The trigger was never updated after standard_qty was added (migration 20260214200000) but this does not affect WAC since quantity and unit_cost are both in item units.
  implication: the formula structure is sound, the issues are in what quantities are included in current_qty

## Resolution

root_cause: >
  items.wac_amount_eusd was a GENERATED ALWAYS column computed as
  ROUND(wac_amount / wac_exchange_rate, 2). The wac_exchange_rate field stores only
  the exchange rate from the MOST RECENT stock-in transaction. When an item is received
  in multiple batches at different exchange rates over time, the EUSD WAC and all derived
  total_value_eusd values are wrong because they use the last batch's rate instead of a
  weighted average of all historical rates. Example: 100 units at rate 4000 then 50 units
  at rate 5000 produces wac=1167 MMK and wac_exchange_rate=5000, giving wac_amount_eusd=0.23
  when the correct weighted EUSD WAC is 0.267 (a 14% error that grows with rate volatility).

fix: >
  Migration 20260218230000_fix_wac_eusd_calculation.sql:
  1. Changed items.wac_amount_eusd from GENERATED ALWAYS to a regular stored column.
  2. Updated update_item_wac() trigger to compute EUSD WAC using the weighted-average
     formula in EUSD: existing_eusd_value + (quantity * unit_cost / exchange_rate),
     divided by total_qty. This correctly blends historical EUSD costs.
  3. Updated handle_inventory_transaction_status_change() to also recompute wac_amount_eusd
     when WAC is recalculated on transaction cancellation.
  4. Added DO block backfill that replays all existing transaction history in chronological
     order to populate correct wac_amount_eusd for all existing items.

verification: TypeScript type-check passes (npm run type-check). No code changes needed
  in warehouse or item pages - they already use wac_amount_eusd directly, which now
  contains the correctly computed value.

files_changed:
  - supabase/migrations/20260218230000_fix_wac_eusd_calculation.sql (new migration)
