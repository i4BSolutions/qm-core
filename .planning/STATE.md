# State: QM System

**Last Updated:** 2026-02-16

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-14)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** Phase 50 - Standard Quantity Display

---

## Current Position

Phase: 51 of 53 (Standard Unit Entity & Admin)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-16 — Completed 51-02: Standard Units Admin UI

Progress: [████████████████████░░] 123/125 (98%)

---

## Performance Metrics

**Codebase:**
- ~50,000 lines of TypeScript
- 72 database migrations
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
- 48 phases
- 118 plans
- 11 milestones shipped

**v1.11 Progress:**
- 8/9 plans complete
- Status: Phase 50 in progress (3/4 plans complete)

---

## Accumulated Context

### Roadmap Evolution

- Phase 51 added: Standard Unit Entity & Admin
- Phase 52 added: Per-Item Standard Unit Assignment (pending)
- Phase 53 added: Standard Unit Display Refactor (pending)

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

### TODOs

**Immediate Next Steps:**
1. Execute Phase 50-04 (QMHQ detail standard qty and PDF export wiring)
2. Complete v1.11 milestone

### Blockers

**None**

---

## Session Continuity

**What Just Happened:**
- Completed Phase 51-02: Standard Units Admin UI
- Created /admin/standard-units page with DataTable and UnitDialog
- Implemented CRUD operations: create, edit, delete with FK protection
- Added "Standard Units" entry to sidebar admin navigation
- Extended InlineCreateSelect to support standard_unit createType
- Conditional UI: no color picker for standard_unit (name-only form)
- Duration: 262 seconds, 2 tasks, 2 commits (17888e2, b047806)

**Context for Next Agent:**
- Phase 50: COMPLETE ✓ (Standard Quantity Display - 4 plans)
  - System-wide standard qty display integrated across all modules
- Phase 51: Standard Unit Entity & Admin (3 plans) - IN PROGRESS
  - 51-01: Standard Units Table & Type Foundation ✓ COMPLETE
  - 51-02: Standard Units Admin UI ✓ COMPLETE
  - 51-03: Standard Units Admin Integration - NEXT
- Admin UI ready: /admin/standard-units with full CRUD
- InlineCreateSelect ready: supports standard_unit type for Phase 52
- Sidebar navigation includes Standard Units link
- Next: Final admin integration touches (if any)

**Resume at:** Execute Phase 51-03 (Standard Units Admin Integration)

---

*State last updated: 2026-02-16 after Phase 51-02 completion*
