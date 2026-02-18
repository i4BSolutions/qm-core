# State: QM System

**Last Updated:** 2026-02-18 (58-01)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** v1.12 Avatar Integration — Phase 58 plan 01 complete (final v1.12 phase)

---

## Current Position

Phase: 58 (History Avatars & Comment Avatars)
Plan: 01 complete — Phase 58 all plans done
Status: Phase 58 complete — history entry avatars (UserAvatar + Bot system indicator) delivered, AVTR-02 confirmed pre-satisfied
Last activity: 2026-02-18 — 58-01 executed (UserAvatar in HistoryEntry + system Bot indicator)

Progress: [████████████████░░░░] Phase 55+56+57+58 complete

---

## Performance Metrics

**Codebase:**
- ~45,200 lines of TypeScript
- 75 database migrations
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
- v1.11 Standard Unit System (8 phases, 17 plans) - 2026-02-16

**Total Delivered:**
- 57 phases (1-57)
- 137 plans
- 12 milestones shipped

**v1.12 Complete:**
- 4 phases delivered (55-58)
- 25 requirements mapped
- Phase 55 complete, Phase 56 complete (all 3 plans), Phase 57 complete (all 3 plans), Phase 58 complete (1 plan)

---

## Accumulated Context

### Decisions Made

All decisions archived in PROJECT.md Key Decisions table.

**v1.12 Key Decisions (58-01 additions):**
- History avatar detection uses changed_by UUID null check (authoritative), not changed_by_name string comparison (fragile)
- System indicator is a hand-crafted slate-700 circle with Bot icon — visually distinct from colorful boring-avatars output
- HistoryEntrySkeleton not modified — 20px avatar too small to warrant a dedicated skeleton placeholder

**v1.12 Key Decisions:**
- UserAvatar is data-passive: accepts `fullName: string` only, no internal fetch — prevents N+1 queries on list pages
- Phase 55 must deploy before any approval UI changes — `layer` column and `awaiting_admin` enum must exist in DB first
- Two-layer approval backfill: existing `approved` records get `layer = 'admin'` in the same migration that adds the schema (063)
- Advisory lock pattern (pg_advisory_xact_lock) used in new trigger functions — not `SELECT ... FOR UPDATE` — to avoid deadlock with existing migration 059 row locks
- boring-avatars@^2.0.4 chosen over dicebear (two packages) and external URL services (network dependency)
- Phase 56 and Phase 57 are independent after Phase 55 ships — list views do not depend on approval UI changes
- boring-avatars Beam variant with default color palette and circle shape (square=false) — no custom colors, no border ring
- Invoice assigned filter uses created_by field (invoices have no assigned_to column)
- PO assigned filter reads qmhq.assigned_to via extended QMHQ join — no Assigned Person column in PO list view (LIST-03 does not require it)
- Items has no person association — no assigned filter on Items page (no person field in data model)
- UserAvatar size defaults to 28px for list row inline usage; callers pass 32 for comment cards, 40 for header
- usePaginationParams reads ?page and ?pageSize from URL; setPageSize automatically resets to page 1
- Assignee filter uses raw Shadcn Select (not FilterBar.Select) in QMRL page to support avatar JSX in option labels
- Card/list toggle placed inside FilterBar as last child with ml-auto, per toolbar order decision
- Toolbar order for pages without status filter dropdown: Search | Assignee | Category | [toggle]
- Status badges in list view: colored background + white text (solid style, not outline variant)
- Stock-out requests uses status dropdown (not tabs) in FilterBar — consistent with other 5 list pages
- Card view groups paginatedRequests (not filteredRequests) — ensures card groups respect pagination boundary
- L1 approval dialog inserts into stock_out_approvals without warehouse_id/parent_approval_id — layer auto-set by DB trigger to quartermaster
- L1 dialog does not create inventory_transaction — warehouse unknown at L1; transaction created at L2
- awaiting_admin badge shows "Qty Approved" (blue) when l2_assigned_quantity=0, or "Warehouse Assigned" (purple) when l2_assigned_quantity>0
- Batch checkbox selection and floating action bar removed from SOR line item table — replaced with per-row action buttons
- Approvals tab in SOR detail is now read-only history with L1/L2 layer badges — execute buttons deferred to Plan 02/03
- REQUEST_STATUS_CONFIG: partially_approved renamed "Awaiting Warehouse", approved renamed "Ready to Execute"
- L2 hard cap: AmountInput max = min(remaining_to_assign, availableWarehouseStock) — enforced via isAllowed callback
- Pending inventory_transaction inserted at L2 time (warehouse now known); execution updates status to completed
- warehouseAssignments array built from L2 approvals in fetchData, grouped by line_item_id in WarehouseAssignmentsTab
- handleExecuteAssignment fetches current stock before opening dialog to show before/after impact
- SOR detail page "Details" tab renamed to "Line Items"; new 5th tab "Warehouse Assignments" added between Line Items and Approvals
- SOR ID is display-only plain text on execution page (not a link) — per CONTEXT.md decision
- Sidebar "Stock Out" renamed to "Execution Queue" at same URL /inventory/stock-out — label reflects new page purpose
- Execution page default filter is "Pending Execution" — shows task queue of what needs to be done
- Insufficient stock on execution: assignment stays pending, user gets descriptive toast message

### TODOs

**Immediate Next Steps:**
1. v1.12 complete — all 4 phases (55-58) delivered. Plan next milestone.

### Blockers

**None**

---

## Session Continuity

**What Just Happened:**
- Phase 58 plan 01 executed:
  - Modified `components/history/history-tab.tsx` — added `UserAvatar` import and `Bot` lucide icon import; replaced static user name span in HistoryEntry with conditional rendering: non-null `changed_by` UUID shows 20px UserAvatar + name, null `changed_by` shows Bot icon in slate-700 circle with muted "System" text.
  - Verified `components/comments/comment-card.tsx` — AVTR-02 already satisfied: `UserAvatar fullName={comment.author.full_name} size={32}` on line 36.
  - Requirements completed: HIST-01, HIST-02, AVTR-02

**Context for Next Agent:**
- v1.12 is fully complete: Phase 55 (schema), Phase 56 (list avatars), Phase 57 (approval UI + execution), Phase 58 (history + comment avatars)
- History tab avatar detection uses `changed_by` UUID null check — not name string comparison
- approval-dialog.tsx still exists but is no longer imported — can be deleted in future cleanup

**Resume at:** Next milestone planning (v1.12 complete)

---

*State last updated: 2026-02-18 after Phase 58 plan 01 (history entry UserAvatar + system Bot indicator) complete*
