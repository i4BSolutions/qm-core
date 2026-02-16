# State: QM System

**Last Updated:** 2026-02-16

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** Phase 50 - Standard Quantity Display

---

## Current Position

Phase: 54 of 54 (USD Exchange Rate Auto-Lock)
Plan: 1 of 1 in current phase
Status: Complete
Last activity: 2026-02-16 — Completed 54-01: USD Exchange Rate Auto-Lock (database + UI)

Progress: [█████████████████████] 129/129 (100%)

---

## Performance Metrics

**Codebase:**
- ~50,000 lines of TypeScript
- 74 database migrations
- 100 RLS policies across 22 tables

**Shipped Milestones:**
- v1.0 MVP (4 phases, 8 plans) - 2026-01-27
- v1.1 Enhancement (6 phases, 17 plans) - 2026-01-28
- v1.2 Inventory & Financial Accuracy (6 phases, 14 plans) - 2026-01-31
- v1.3 UX & Bug Fixes (3 phases, 11 plans) - 2026-02-02
- v1.4 UX Enhancements (3 phases, 9 plans) - 2026-02-06
- v1.5 UX Polish & Collaboration (4 phases, 9 plans) - 2026-02-09
- v1.6 Stock-Out Approval (5 phases, 12 plans) - 2026-02-10
- v1.7 Stock-Out Logic Repair (4 phases, 7 plans) - 2026-02-11
- v1.8 UI Consistency & RBAC (5 phases, 15 plans) - 2026-02-12
- v1.9 PO Lifecycle & PDF Export (3 phases, 8 plans) - 2026-02-13
- v1.10 Tech Debt Cleanup (3 phases, 3 plans) - 2026-02-14

**Total Delivered:**
- 49 phases
- 121 plans
- 11 milestones shipped

**v1.11 Progress:**
- 13/13 plans complete (Phase 50-54 complete)
- Status: v1.11 Complete ✓

**Latest Execution Metrics:**
| Phase | Plan | Duration | Tasks | Files | Commits | Date |
|-------|------|----------|-------|-------|---------|------|
| 53 | 01 | 2 min | 2 | 7 | 2 | 2026-02-16 |
| 53 | 03 | 11 min | 2 | 9 | 1 | 2026-02-16 |
| 53 | 02 | 8 min | 2 | 8 | 2 | 2026-02-16 |
| 54 | 01 | 15 min | 2 | 5 | 2 | 2026-02-16 |

## Accumulated Context

### Roadmap Evolution

- Phase 51 added: Standard Unit Entity & Admin (complete)
- Phase 52 added: Per-Item Standard Unit Assignment (complete)
- Phase 53 added: Standard Unit Display Refactor (complete)
- Phase 54 added: USD Exchange Rate Auto-Lock

### Decisions Made

Decisions archived in PROJECT.md Key Decisions table.

**Recent decisions for v1.11:**
- Mirror EUSD pattern exactly (CurrencyDisplay → StandardUnitDisplay)
- Multiplication formula: standard_qty = qty × conversion_rate (not division)
- Per-transaction conversion rate with required input (no default)
- Backfill existing data with conversion_rate = 1
- Use system_config key-value table for global settings (scalable pattern)
- RLS: admin CRUD, all users read-only for system_config
- Permission check via can('update', 'statuses') as admin proxy
- ConversionRateInput mirrors ExchangeRateInput API for consistency (both use 4 decimal places)
- Conversion rate required for all PO and Invoice line items (validation prevents submit)
- Default conversion_rate to empty string (not 1) to force explicit user input
- Use per-transaction and per-approval conversion rates for accurate standard qty calculations in progress aggregates
- Skip aggregate standard qty display on PO detail page (invoiced/received totals) as they span multiple items with different rates
- Aggregate standard_stock in warehouse inventory by summing standard_qty from transactions
- Show standard qty as second line below original quantity in all displays
- Pass standardUnitName to PDF components to conditionally render columns
- Use admin permission proxy via categories for standard units CRUD
- Hard delete with FK protection for standard units (consistent with migration)
- Hide color picker in InlineCreateSelect for standard_unit type (name-only form)
- Backfill all existing items with 'pcs' as default standard unit
- Use FK constraint with ON DELETE RESTRICT to protect standard units in use
- EUR and SGD currencies supported in financial_transactions and qmhq tables (but not in PO/Invoice)
- Transaction dialog inherits currency from QMHQ and auto-locks USD rate on data load
- Followed exact pattern from stock-in page (Phase 9) for USD auto-lock consistency

### TODOs

**Immediate Next Steps:**
1. Celebrate v1.11 completion (Standard Unit System + USD Auto-Lock)
2. Await next roadmap phase or milestone definition

### Blockers

**None**

---

## Session Continuity

**What Just Happened:**
- Completed Phase 54-01: USD Exchange Rate Auto-Lock
- Added database CHECK constraints enforcing exchange_rate = 1.0 for USD on 4 tables (purchase_orders, invoices, financial_transactions, qmhq)
- Added positive exchange rate and currency validation constraints
- Implemented UI auto-lock across all financial forms (PO create, Invoice create, QMHQ routes, Transaction dialog)
- Auto-sets exchange rate to 1.0 when USD is selected
- Disables ExchangeRateInput for USD with helper text "USD rate is always 1.0"
- Duration: 15 min, 2 tasks, 2 commits (a859b1f, f69518c)

**Context for Next Agent:**
- Phase 50: COMPLETE ✓ (Standard Quantity Display - 4 plans)
- Phase 51: COMPLETE ✓ (Standard Unit Entity & Admin - 3 plans)
- Phase 52: COMPLETE ✓ (Per-Item Standard Unit Assignment - 2 plans)
- Phase 53: COMPLETE ✓ (Standard Unit Display Refactor - 3 plans)
- Phase 54: COMPLETE ✓ (USD Exchange Rate Auto-Lock - 1 plan)
- **v1.11 milestone COMPLETE** (Standard Unit System + USD Auto-Lock)
- All financial forms enforce USD = 1.0 EUSD at both database and UI levels

**Resume at:** Awaiting next milestone or roadmap phase

---

*State last updated: 2026-02-16 after Phase 54-01 completion*
