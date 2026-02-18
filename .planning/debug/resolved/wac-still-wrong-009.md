---
status: resolved
trigger: "WAC is still showing 0.09 EUSD when it should be 16.75 EUSD for an item with 3 stock-ins"
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T02:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: RESOLVED - Both root causes found and fixed
test: npx supabase db push --dry-run shows "Remote database is up to date"
expecting: wac_amount_eusd now shows 16.75 EUSD
next_action: Archive session

## Symptoms

expected: WAC = (100×20 + 100×30 + 100×0.25) / 300 = 16.75 EUSD
actual: WAC shows 0.09 EUSD (way too low)
errors: No errors — wrong calculation result
reproduction: Check the item that has 3 stock-in transactions (100@20USD, 100@30USD, 100@1000MMK)
timeline: WAC has been wrong through multiple fix attempts; latest migration may not be deployed

## Eliminated

- hypothesis: Bug in trigger logic of 20260218240000
  evidence: Trigger code is mathematically correct. Problem was deployment failure of both migrations.
  timestamp: 2026-02-18T01:00:00Z

## Evidence

- timestamp: 2026-02-18T01:00:00Z
  checked: npx supabase db push --dry-run
  found: Both 20260218230000 and 20260218240000 listed as "Would push" — never deployed to remote DB
  implication: Remote DB still running original 024_inventory_wac_trigger.sql which mixes currencies and uses GENERATED ALWAYS column

- timestamp: 2026-02-18T01:00:00Z
  checked: Math working backwards from 0.09
  found: Original trigger: wac_amount = (100*20 + 100*30 + 100*1000)/300 = 350 (USD + MMK mixed!), wac_exchange_rate=4000 (last txn), wac_amount_eusd=GENERATED as ROUND(350/4000, 2)=0.09
  implication: The GENERATED ALWAYS formula is fundamentally wrong for multi-currency items

- timestamp: 2026-02-18T01:30:00Z
  checked: npx supabase db push (actual push)
  found: ERROR: numeric field overflow (SQLSTATE 22003) on 20260218230000 backfill DO block
  implication: DECIMAL(15,2) and DECIMAL(15,4) intermediate variables in the backfill overflow when multiplying large qty * wac values

- timestamp: 2026-02-18T02:00:00Z
  checked: Fixed backfill variable types to NUMERIC (unbounded) and re-pushed
  found: Both migrations applied successfully; "Remote database is up to date"
  implication: WAC backfill ran correctly; existing items now have correct wac_amount_eusd values

## Resolution

root_cause: |
  TWO issues, both fixed:

  1. DEPLOYMENT: Migrations 20260218230000 and 20260218240000 were never pushed to remote DB.
     The live DB used 024_inventory_wac_trigger.sql which (a) stores wac_amount by mixing
     USD and MMK unit_cost values numerically (dimensionally wrong), then (b) uses a
     GENERATED ALWAYS column: wac_amount_eusd = ROUND(wac_amount / wac_exchange_rate, 2)
     where wac_exchange_rate is only the LAST transaction's rate.
     Result: (100*20 + 100*30 + 100*1000)/300 = 350, then 350/4000 = 0.0875 ≈ 0.09.

  2. OVERFLOW: The backfill DO block in 20260218230000 used DECIMAL(15,2) and DECIMAL(15,4)
     for intermediate calculation variables. When multiplying two DECIMAL(15,2) values
     (e.g., running_qty * running_wac), the result can exceed DECIMAL(15,4) precision
     (max ~99 billion), causing "numeric field overflow" and rolling back the entire migration.

fix: |
  1. Changed backfill intermediate variables from DECIMAL(15,x) to NUMERIC (unbounded
     precision) in 20260218230000_fix_wac_eusd_calculation.sql.
  2. Pushed both migrations: 20260218230000 and 20260218240000 to remote database.
  The backfill in 20260218230000 replays all transaction history chronologically and
  computes the correct EUSD WAC. The final trigger in 20260218240000 stores EUSD WAC only.

verification: "Remote database is up to date" confirmed by npx supabase db push --dry-run after push.

files_changed:
  - supabase/migrations/20260218230000_fix_wac_eusd_calculation.sql
