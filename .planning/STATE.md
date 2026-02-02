# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.
**Current focus:** v1.3 UX & Bug Fixes

## Current Position

Phase: 13 — Verification & Quick Fixes
Plan: 01 of 5
Status: In progress
Last activity: 2026-02-02 — Completed 13-01-PLAN.md (Attachment Delete Permission UI Fix)

Progress: [█░░░░░░░░░░░░░░░░░░░░] 5%

## Milestone Overview: v1.3

**Phases:** 4 (Phases 13-16)
**Requirements:** 18 total

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 13 | Verify & fix attachment deletion + QMHQ fulfillment | 5 | In progress (1/5) |
| 14 | Standardize number inputs + currency display | 7 | Pending |
| 15 | Add Edit buttons to detail pages | 4 | Pending |
| 16 | Capture status change notes in audit history | 2 | Pending |

**Research Notes:**
- RLS policy for attachment delete already exists (migration 036)
- QMHQ stock-out tab already exists (lines 712-837)
- Phase 13 is primarily verification with gap fixes
- Phase 16 requires careful trigger deduplication

## Milestone History

### v1.2 Inventory & Financial Accuracy (Shipped 2026-01-31)

**Velocity:**
- Total plans: 14
- Phases: 7 -> 7.1 -> 8 -> 9 -> 10 -> 11 -> 12

**Key Patterns Established:**
- EUSD-only display pattern (dropped MMK columns)
- Cascade audit logging with changes_summary
- Server action for pre-void state capture
- RPC functions for aggregation
- URL search params for filter state

### v1.1 Enhancement (Shipped 2026-01-28)

**Velocity:**
- Total plans: 17
- Average duration: 16 min
- Total execution time: ~5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-critical-bug-fixes | 3/3 | 1h 32m | 31min |
| 02-file-storage-foundation | 2/2 | 17min | 8.5min |
| 03-file-upload-ui | 3/3 | 35min | 11.7min |
| 04-file-preview-download | 3/3 | 1h 24m | 28min |
| 05-management-dashboard | 3/3 | 38min | 13min |
| 06-status-transaction-ux | 3/3 | 13min | 4.3min |

**Key Patterns Established:**
- JSONB pattern for audit triggers
- Polymorphic entity reference for files
- Sequential file upload with retry
- CDN worker for PDF.js
- Server component role check with client refresh

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full log.
Recent decisions affecting v1.2:
- View-only transaction modal — Audit integrity over editability
- Global low stock threshold (10 units) — Simpler than per-item config
- Amount locked after transaction creation — Audit integrity
- String state for number inputs — Allows empty placeholder display
- Calendar buttons-only layout — Simplified to arrows-only navigation per user feedback
- Trigger uses SECURITY DEFINER for system transactions — Bypass RLS for auto-generated inventory
- Idempotency check prevents duplicate stock-outs — Status can toggle, prevent duplicate transactions
- Per-item warehouse selection in junction table — Flexible sourcing for multi-item QMHQ
- Legacy qmhq.item_id preserved — Backward compatibility with existing single-item records
- Attachment delete per-file ownership check — Users can delete own uploads, admin/quartermaster can delete any (Phase 13.01)
- No unit price in item route form — Unit price comes from WAC at stock-out time
- Per-item warehouse selection is optional — User can specify preferred warehouse or leave empty
- Currency codes limited to USD, MMK, CNY, THB — Regional operational requirements
- USD exchange rate must equal 1.0 — Reference currency for EUSD calculations
- SECURITY DEFINER search_path hardening — pg_catalog, public to prevent privilege escalation
- Trigger ordering via alphabetical prefix — aa_ fires first (block), zz_ fires last (audit)
- Balance in Hand unchanged on void — PO commitment preserved, only invoiced qty changes
- EUSD panel conditional display — Only shown when item, quantity, and unit cost are all filled
- RPC function for KPI aggregation — Server-side efficiency over client aggregation (Phase 10.01)
- Tab state in URL search params — Enables sharing filtered views and browser back/forward (Phase 10.01)
- Foreign key hints for ambiguous relationships — Explicit FK names in Supabase queries (Phase 10.01)
- URL search params for filter state — Shareable filtered views with browser navigation support (Phase 10.02)
- Searchable item select pattern — Input filter + dropdown for large item lists (Phase 10.02)
- Shallow routing for filter updates — Prevents page scroll jumps and history pollution (Phase 10.02)
- Global LOW_STOCK_THRESHOLD = 10 units — Simpler than per-item config, matches inventory dashboard pattern (Phase 11.01)
- Zero-stock items in table, excluded from KPI counts — Complete visibility with accurate metrics (Phase 11.01)
- EUSD-only display for warehouse inventory — Removed MMK columns, EUSD sufficient for value tracking (Phase 11.01)
- Dash (—) for null WAC values — Better UX than "0.00 EUSD" for items without cost data (Phase 11.01)
- Right-align numeric columns — Accounting style conventions for better readability (Phase 11.01)
- Server action fetches pre-void state for cascade feedback — Enables accurate old/new qty comparison (Phase 12.01)
- Toast description accepts JSX for multi-line feedback — Structured cascade effects display (Phase 12.01)
- Cascade detection via changes_summary string match — Leverages existing audit infrastructure (Phase 12.01)
- Red border accent for void cascade audit entries — Visual distinction from direct user actions (Phase 12.01)

### Roadmap Evolution

- Phase 7.1 inserted after Phase 7: Attachment & Item Route Fixes (URGENT)
  - Cannot delete attachments in QMRL/QMHQ
  - Date picker should not have month/year dropdowns
  - QMHQ item route needs stock-out capability
  - QMHQ item route needs multi-item selection (no unit price)

### Pending Todos

None yet.

### Blockers/Concerns

**Future Enhancement:** Auto stock-out trigger currently handles only legacy single-item QMHQ. Multi-item trigger enhancement needed for future phase to loop through qmhq_items table.

## Session Continuity

Last session: 2026-02-02
Stopped at: Completed 13-01-PLAN.md
Resume file: .planning/phases/13-verification-quick-fixes/13-02-PLAN.md
Note: Phase 13 Plan 01 complete. Continue with Plan 02 (QMHQ Fulfillment Verification).

---
*State initialized: 2026-01-27*
*Last updated: 2026-02-02 — Completed Phase 13 Plan 01*
