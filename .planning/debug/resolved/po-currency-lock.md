---
status: resolved
trigger: "po-currency-lock"
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - PO create form does not fetch QMHQ currency and does not lock currency field when a QMHQ is selected
test: Read QMHQ schema and PO create page
expecting: n/a - root cause confirmed
next_action: Implement fix in /app/(dashboard)/po/new/page.tsx

## Symptoms

expected: Currency field pre-filled and locked (read-only) from QMHQ PO route currency
actual: Currency field is freely editable even when linked to QMHQ with set currency
errors: None - missing constraint/lock behavior
reproduction: Create QMHQ with PO route and set currency, then create PO from that QMHQ - currency is editable
started: Likely never implemented - missed when building PO create flow

## Eliminated

## Evidence

- timestamp: 2026-02-19T00:01:00Z
  checked: supabase/migrations/011_qmhq.sql
  found: QMHQ table has `currency TEXT DEFAULT 'MMK'` and `exchange_rate DECIMAL(10,4) DEFAULT 1.0000` for PO/expense routes
  implication: QMHQ does store currency - it just needs to be fetched and used

- timestamp: 2026-02-19T00:01:30Z
  checked: app/(dashboard)/po/new/page.tsx - QMHQWithBalance interface and qmhq query
  found: Query only selects `id, request_id, line_name, balance_in_hand, amount_eusd, total_money_in, total_po_committed` - currency is NOT fetched
  implication: This is why currency is not pre-filled - it's not in the data

- timestamp: 2026-02-19T00:02:00Z
  checked: app/(dashboard)/po/new/page.tsx - currency state and QMHQ selection handler
  found: Currency state starts as `""` with no QMHQ-selection side effect to set it. No `useEffect` or `onValueChange` handler links QMHQ selection to currency.
  implication: When user selects or has a preselected QMHQ, currency is never updated from QMHQ data

- timestamp: 2026-02-19T00:02:30Z
  checked: app/(dashboard)/po/[id]/edit/page.tsx
  found: Edit page already shows currency as read-only in "Read-Only Information" section and does NOT include currency in the editable formData. Edit flow is already correct.
  implication: Only the create form needs fixing

## Resolution

root_cause: PO create form does not include `currency` in the QMHQ fetch query, and has no logic to pre-fill or lock the currency field when a QMHQ is selected/preselected. The QMHQWithBalance interface and the Supabase select query both omit `currency`, so even though the QMHQ has a currency set in the DB, it is never surfaced to the form.
fix: 1) Added `currency` to QMHQWithBalance interface Pick. 2) Added `currency` to the Supabase QMHQ select query string. 3) Added useEffect that syncs currency (and exchange rate for USD) from the selected QMHQ whenever selectedQmhqId or qmhqs change. 4) Disabled the currency Select with `disabled={!!selectedQmhqId}` and added Lock indicator label + helper text when QMHQ is selected. Edit page already had currency as read-only - no changes needed there.
verification: TypeScript type-check passes with zero errors (npm run type-check). Logic verified: preselected QMHQ case works because useEffect depends on both selectedQmhqId and qmhqs - it fires after fetchReferenceData populates qmhqs.
files_changed: [app/(dashboard)/po/new/page.tsx]
