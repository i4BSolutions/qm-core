# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.
**Current focus:** Phase 30 - User Deactivation

## Current Position

Phase: 30 of 31 (User Deactivation)
Plan: 1 of 2 complete
Status: In progress
Last activity: 2026-02-10 — Completed 30-01-PLAN.md (2 tasks, 2 commits, 3min)

```
v1.6 Progress: [████████████░░░░░░░░] 80% (5/5 phases in progress)
Overall: [████████████████████] 97% (30/31 phases started)
```

## Milestone History

### v1.5 UX Polish & Collaboration (Shipped 2026-02-09)

**Velocity:**
- Total plans: 9
- Phases: 23 -> 24 -> 25 -> 26
- Duration: 2 days

**Key Patterns Established:**
- Comments system with single-level threading
- Optimistic UI updates for comments
- CSS clamp() for fluid font scaling
- Intl.NumberFormat compact notation for K/M/B
- CategoryItemSelector for two-step selection
- AbortController for request cancellation
- Currency inheritance with Lock + Inherited badge
- Warning toast variant (amber) for soft validation

### v1.4 UX Enhancements & Workflow Improvements (Shipped 2026-02-06)

**Velocity:**
- Total plans: 9
- Phases: 20 -> 21 -> 22
- Duration: 1 day

**Key Patterns Established:**
- Fetch-Before-Update pattern for soft-delete with RLS
- Upload-After-Create pattern with sessionStorage progress tracking
- Context Panel pattern for responsive desktop/mobile layout
- Formatted Input components (react-number-format wrappers)
- Dialog Callback pattern with return value for inline creation
- Cross-Tab Sync with BroadcastChannel and Safari fallback
- Blur Validation pattern with onOpenChange handlers

### v1.3 UX & Bug Fixes (Shipped 2026-02-02)

**Velocity:**
- Total plans: 11
- Phases: 17 -> 18 -> 19
- Duration: 1 day

**Key Patterns Established:**
- Number input utilities (keydown handlers, no auto-format on blur)
- CurrencyDisplay component for two-line original + EUSD format
- RPC-first pattern for complex mutations with audit trail
- Trigger deduplication via time-window check (2-second window)

### v1.2 Inventory & Financial Accuracy (Shipped 2026-01-31)

**Velocity:**
- Total plans: 14
- Phases: 11 -> 12 -> 13 -> 14 -> 15 -> 16
- Duration: 3 days

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

**Key Patterns Established:**
- JSONB pattern for audit triggers
- Polymorphic entity reference for files
- Sequential file upload with retry
- CDN worker for PDF.js
- Server component role check with client refresh

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full log.

Recent decisions affecting current work:
- Phase 30-01: Dual enforcement pattern - ban_duration prevents token refresh, middleware catches unexpired tokens (0-60 min window)
- Phase 30-01: Self-deactivation guard - Admins cannot deactivate themselves at API level to prevent lockout
- Phase 30-01: Best-effort session termination - signOut wrapped in try/catch since user may not have active sessions
- Phase 29-02: Conditional error message pattern - Check error.message for 'Cannot delete' to identify reference errors and display trigger message
- Phase 29-01: Generic error message pattern - All deletion protection triggers use identical 'Cannot delete: this item is in use' message for security (DPRT-07)
- Phase 29-01: Partial indexes for performance - WHERE is_active = true indexes optimize reference checks without bloating full-table indexes
- Phase 27-02: Cross-warehouse stock validation at creation and approval - Hard blocks on insufficient total stock prevent impossible fulfillments
- Phase 27-02: Nullable FK for fulfillment linkage - Simpler than junction table, aligns with existing invoice_id FK pattern
- Phase 27-02: Over-execution prevention with hard block - Sum of fulfillments cannot exceed approved quantity
- Phase 27-01: Request status computed from line items - Ensures parent status always reflects child state
- Phase 27-01: QMHQ-linked requests enforce exactly one line item - Prevents multi-item confusion in single-item QMHQ context
- Phase 27-01: Sequential approval numbering with parent prefix - Provides clear ordering and traceability for audit trail
- Phase 27-01: Item name/SKU snapshotted at line item creation - Preserves historical accuracy even if item renamed/deleted

### Pending Todos

None.

### Blockers/Concerns

**Phase 27: COMPLETE** — 3 migrations (052-054), 3 tables, 12 RLS policies, audit triggers, TypeScript types

**Phase 28: COMPLETE** — 3 plans, 9 commits, 7 new files, 3 modified files, verified 8/8 must-haves

**Phase 29: COMPLETE** — 2 plans, 1 migration (057), 6 trigger functions, 16 reference checks, 15 partial indexes, 6 UI pages updated with trigger error handling

**Phase 30: IN PROGRESS** — Plan 01 complete (API routes + middleware enforcement), Plan 02 pending (UI implementation)

**Phase 31 considerations:**
- Extract reusable pattern from existing QmrlContextPanel (640 lines)
- Avoid N+1 queries by fetching slider data in parent Server Component

**Known Tech Debt:** PO Edit page does not exist at /po/[id]/edit (Edit button links to 404)
- Pre-existing issue discovered during v1.3 audit
- Either create edit page or document PO as immutable after creation

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 30-01-PLAN.md — User deactivation backend API and middleware enforcement
Resume file: None
Next step: Execute 30-02-PLAN.md for user deactivation UI

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Completed |
|-------|------|----------|-------|-------|-----------|
| 27-stock-out-approval-db-foundation | 01 | 2min | 1 | 1 | 2026-02-09 |
| 27-stock-out-approval-db-foundation | 02 | 2min | 1 | 1 | 2026-02-09 |
| 27-stock-out-approval-db-foundation | 03 | 3min | 2 | 2 | 2026-02-09 |
| 28-stock-out-request-approval-ui | 01 | 4min | 2 | 5 | 2026-02-09 |
| 28-stock-out-request-approval-ui | 02 | 5min | 2 | 4 | 2026-02-09 |
| 28-stock-out-request-approval-ui | 03 | 4min | 2 | 4 | 2026-02-09 |
| 29-deletion-protection | 01 | 2min | 2 | 1 | 2026-02-10 |
| 29-deletion-protection | 02 | 1min | 1 | 6 | 2026-02-10 |
| 30-user-deactivation | 01 | 3min | 2 | 3 | 2026-02-10 |

---
*State initialized: 2026-01-27*
*Last updated: 2026-02-10 - Phase 30 Plan 01 complete, user deactivation backend API and middleware enforcement*
| Phase 30-user-deactivation P01 | 3 | 2 tasks | 3 files |

