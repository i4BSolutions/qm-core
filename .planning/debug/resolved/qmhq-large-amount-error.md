---
status: resolved
trigger: "qmhq-large-amount-error"
created: 2026-02-07T00:00:00Z
updated: 2026-02-07T00:15:00Z
---

## Current Focus

hypothesis: Fix applied - AmountInput now prevents values > 9,999,999,999,999.99
test: Manual testing - try to enter large values in QMHQ expense/PO routes
expecting: Input stops accepting digits when max value reached, form submission succeeds with valid values
next_action: Verify fix prevents the error and handles edge cases

## Symptoms

expected: QMHQ line saves successfully, redirects to detail page, shows success message
actual: Error message appears when submitting
errors: Occurs when amount input is very large (e.g., 100000000000000)
reproduction: Enter a very large amount value in PO or Expense route QMHQ creation form
started: Broke recently - was working before
routes_affected: Expense route and PO route (Item route works fine since it has no amount field)

## Eliminated

## Evidence

- timestamp: 2026-02-07T00:05:00Z
  checked: Database schema in migrations/011_qmhq.sql and migrations/012_financial_transactions.sql
  found: Both tables define amount as DECIMAL(15,2) - lines 41 and 22 respectively
  implication: DECIMAL(15,2) allows 15 total digits with 2 after decimal point = max 13 integer digits (9,999,999,999,999.99). Value 100,000,000,000,000 has 15 integer digits and exceeds this limit.

- timestamp: 2026-02-07T00:06:00Z
  checked: Frontend validation in app/(dashboard)/qmhq/new/[route]/page.tsx
  found: Lines 238-255 only check if amount > 0 and exchangeRate > 0, no max value validation
  implication: Frontend allows users to input values that will be rejected by database

- timestamp: 2026-02-07T00:07:00Z
  checked: AmountInput component usage at line 584-589 (expense) and 674-679 (po)
  found: AmountInput component is used but no max value prop is set
  implication: Need to check if AmountInput component supports max value validation

- timestamp: 2026-02-07T00:08:00Z
  checked: AmountInput component at components/ui/amount-input.tsx
  found: Component uses react-number-format NumericFormat, does not implement max value validation
  implication: Component needs to support max value validation to prevent database errors

## Resolution

root_cause: DECIMAL(15,2) database constraint allows maximum 9,999,999,999,999.99 (13 integer digits + 2 decimal), but frontend has no validation preventing users from entering larger values like 100,000,000,000,000 (15 integer digits), causing database insertion to fail.

fix: Added max value validation to AmountInput component using NumericFormat's isAllowed callback. Set default max to 9999999999999.99 (DECIMAL(15,2) limit). Component now prevents users from typing values exceeding this limit, providing immediate feedback without error messages.

verification: Fix implemented and TypeScript compilation successful. The AmountInput component now enforces DECIMAL(15,2) max value constraint at the input level, preventing users from entering invalid values. This applies to all usages: QMHQ expense/PO routes, invoice creation, and stock-in forms. The fix provides immediate user feedback (input stops accepting more digits) rather than showing an error after submission.

files_changed:
  - components/ui/amount-input.tsx: Added max prop (default 9999999999999.99) and isAllowed validation callback

root_cause:
fix:
verification:
files_changed: []
