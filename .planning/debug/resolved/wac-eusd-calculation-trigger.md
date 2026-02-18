---
status: resolved
trigger: "wac-eusd-calculation-trigger"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - The 20260218230000 migration correctly computes wac_amount_eusd using EUSD-first weighted average, BUT it still computes and stores wac_amount by mixing raw unit_cost values across different currencies, which is meaningless. The trigger also still updates wac_currency and wac_exchange_rate (both meaningless for multi-currency items). The instructions require wac_amount_eusd to be the ONLY maintained value.
test: Traced through trigger logic with the exact test scenario (100@20USD + 100@30USD + 100@1000MMK@4000)
expecting: wac_amount_eusd = 16.75 EUSD (correct), wac_amount = 350 (meaningless garbage)
next_action: Create new migration that simplifies trigger to ONLY maintain wac_amount_eusd, and update frontend to not use wac_amount for display

## Symptoms

expected: WAC calculated purely in EUSD — each stock-in's unit_cost divided by exchange_rate first, then weighted average applied
actual: WAC value is incorrect for mixed-currency scenarios — trigger computes wac_amount by mixing raw unit_cost values from different currencies (meaningless)
errors: No errors — mathematically wrong for mixed-currency scenarios
reproduction: Create stock-in transactions for same item in different currencies and check WAC
started: Since WAC was first implemented — multi-currency scenario not handled

## Eliminated

- hypothesis: The previous 20260218230000 migration entirely failed to fix wac_amount_eusd
  evidence: Migration correctly computes wac_amount_eusd using (current_qty * current_wac_eusd + new_qty * new_unit_cost_eusd) / total_qty — the EUSD formula is right
  timestamp: 2026-02-18T00:01:00Z

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: 20260218230000_fix_wac_eusd_calculation.sql trigger logic
  found: wac_amount_eusd is computed correctly (per-transaction EUSD conversion then weighted average). BUT wac_amount is still computed by mixing unit_cost values from different currencies (350 from mixing 20USD + 30USD + 1000MMK). wac_currency and wac_exchange_rate also still get updated to last transaction's values.
  implication: The wac_amount_eusd display in UI is correct. But wac_amount is garbage for mixed-currency items. The trigger should be simplified to ONLY maintain wac_amount_eusd.

- timestamp: 2026-02-18T00:01:30Z
  checked: warehouse/[id]/page.tsx and item/[id]/page.tsx
  found: Both pages display wac_amount_eusd for WAC per unit (correct). But item/[id]/page.tsx computes total_value = current_stock * wac_amount (using meaningless local WAC) even though it only displays total_value_eusd. warehouse/[id]/page.tsx also computes total_value using wac_amount but doesn't display it in columns. The display is safe but the wac_amount value itself is misleading.
  implication: UI display is OK since it only shows EUSD values. But the underlying wac_amount stored in DB is wrong/meaningless for mixed-currency items.

## Resolution

root_cause: The WAC trigger in 20260218230000 correctly computes wac_amount_eusd but still updates wac_amount by mixing raw unit_cost values from different currencies (e.g., 100 USD + 1000 MMK averaged = meaningless 510). It also updates wac_currency and wac_exchange_rate to the last transaction's values, which is misleading. Per the design requirement, wac_amount_eusd should be the ONLY maintained WAC value.
fix: |
  1. New migration 20260218240000_wac_eusd_only.sql — replaces update_item_wac() and handle_inventory_transaction_status_change() to ONLY update wac_amount_eusd. wac_amount/wac_currency/wac_exchange_rate are no longer touched by WAC triggers.
  2. warehouse/[id]/page.tsx — removed wac_amount and wac_currency from Supabase select query and WarehouseInventoryItem type. Removed total_value (local currency) computation.
  3. item/[id]/page.tsx — removed wac_amount from WarehouseStock type and computation. Only wac_amount_eusd is used.
  4. inventory/stock-in/page.tsx — removed wac_amount and wac_currency from items select query (they were fetched but unused).
verification: TypeScript type-check passes (exit 0). ESLint passes (exit 0). No new warnings. Math verified: for the test scenario (100@20USD/rate=1 + 100@30USD/rate=1 + 100@1000MMK/rate=4000), the trigger now correctly computes wac_amount_eusd = 16.75 EUSD and no longer stores meaningless wac_amount values.
files_changed:
  - supabase/migrations/20260218240000_wac_eusd_only.sql
  - app/(dashboard)/warehouse/[id]/page.tsx
  - app/(dashboard)/item/[id]/page.tsx
  - app/(dashboard)/inventory/stock-in/page.tsx
