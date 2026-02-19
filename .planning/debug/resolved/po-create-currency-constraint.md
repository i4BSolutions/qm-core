---
status: resolved
trigger: "PO creation fails with purchase_orders_currency_valid check constraint violation"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:05:00Z
---

## Current Focus

hypothesis: RESOLVED
test: Fix applied and verified
expecting: N/A
next_action: Archive

## Symptoms

expected: Users should be able to create purchase orders normally via the PO create page.
actual: PO creation fails with a database check constraint violation on the currency field.
errors: `new row for relation "purchase_orders" violates check constraint "purchase_orders_currency_valid"` Error Code: 23514
reproduction: Go to PO create page after selecting a QMHQ with EUR or SGD currency, fill in details, submit — fails every time.
started: Introduced when migration 20260216400000_usd_exchange_rate_constraints.sql added currency constraints to purchase_orders with a smaller currency set than QMHQ allows.

## Eliminated

## Evidence

- timestamp: 2026-02-19T00:00:30Z
  checked: supabase/migrations/20260216400000_usd_exchange_rate_constraints.sql
  found: purchase_orders_currency_valid constraint only allowed 'USD', 'MMK', 'CNY', 'THB'
  implication: EUR and SGD were NOT permitted in purchase_orders

- timestamp: 2026-02-19T00:00:31Z
  checked: supabase/migrations/20260216400000_usd_exchange_rate_constraints.sql (qmhq section)
  found: qmhq_currency_valid allows 'USD', 'MMK', 'CNY', 'THB', 'EUR', 'SGD'
  implication: QMHQ could be created with EUR or SGD currency — currencies not allowed in purchase_orders

- timestamp: 2026-02-19T00:00:32Z
  checked: app/(dashboard)/qmhq/new/[route]/page.tsx (currencies const)
  found: QMHQ PO-route form offered MMK, USD, EUR, THB, SGD — missing CNY but including EUR and SGD
  implication: Users could create a PO-route QMHQ with EUR or SGD (which the QMHQ DB constraint also allows)

- timestamp: 2026-02-19T00:00:33Z
  checked: app/(dashboard)/po/new/page.tsx (handleSubmit / currency sync)
  found: PO create form inherits currency directly from the selected QMHQ (qmhq.currency || "MMK") — passed verbatim to purchase_orders insert
  implication: QMHQ with EUR or SGD causes purchase_orders insert to fail with 23514 constraint violation

- timestamp: 2026-02-19T00:00:34Z
  checked: app/(dashboard)/po/new/page.tsx (direct currency select — when no QMHQ preselected)
  found: Currency select showed MMK, USD, THB, CNY — no EUR or SGD (also a gap but not the crash path)
  implication: Bug specifically triggered via the QMHQ inheritance path, not via direct currency selection

## Resolution

root_cause: The purchase_orders table's currency constraint (added in migration 20260216400000) only allowed USD/MMK/CNY/THB, but the QMHQ table allowed a wider set including EUR and SGD. The PO create page inherits currency verbatim from the selected QMHQ record, so any QMHQ created with EUR or SGD caused the purchase_orders INSERT to fail with check constraint violation 23514.

fix: |
  1. Added migration 20260219120000_expand_po_currency_constraint.sql to expand purchase_orders and
     invoices currency constraints to match QMHQ: USD, MMK, CNY, THB, EUR, SGD.
  2. Updated QMHQ create form (app/(dashboard)/qmhq/new/[route]/page.tsx) to add CNY to the
     currencies dropdown (was missing despite DB allowing it), making frontend consistent with DB.
  3. Updated PO create form (app/(dashboard)/po/new/page.tsx) to add EUR and SGD to the currency
     dropdown for the non-QMHQ-inherited case.
  4. Updated invoice create form (app/(dashboard)/invoice/new/page.tsx) to add EUR and SGD to the
     currency dropdown, keeping all financial forms consistent.

verification: All currency sets now align — QMHQ DB constraint, purchase_orders DB constraint, invoices DB constraint, and all three frontend currency selects all support: USD, MMK, CNY, THB, EUR, SGD.

files_changed:
  - supabase/migrations/20260219120000_expand_po_currency_constraint.sql (new — expands DB constraints)
  - app/(dashboard)/qmhq/new/[route]/page.tsx (add CNY, keep EUR/SGD)
  - app/(dashboard)/po/new/page.tsx (add EUR, SGD to currency select)
  - app/(dashboard)/invoice/new/page.tsx (add EUR, SGD to currency select)
