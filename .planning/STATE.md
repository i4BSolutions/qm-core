# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.
**Current focus:** Phase 34 - Database Trigger Hardening

## Current Position

Phase: 34 of 35 (Database Trigger Hardening)
Plan: 01 of 02 complete
Status: Phase 34 in progress
Last activity: 2026-02-11 — Completed 34-01 (Advisory locks and row-level locking)

Progress: [████████████████████████████████████████████████████████░] 94% (33 of 35 phases)

## Milestone History

### v1.6 Stock-Out Approval & Data Integrity (Shipped 2026-02-10)

**Velocity:**
- Total plans: 12
- Phases: 27 -> 28 -> 29 -> 30 -> 31
- Duration: 2 days
- Feat commits: 21

**Key Patterns Established:**
- Stock-out approval workflow (request → line items → approvals → execution)
- Cross-warehouse stock validation at request, approval, and execution time
- Computed parent status from child line items (aggregated status trigger)
- Deletion protection triggers with partial indexes
- Conditional error detection for trigger messages (isReferenceError)
- Dual enforcement for user deactivation (ban_duration + middleware)
- ContextSlider pattern: structural shell + presentational content components
- Conditional layout pattern (grid only when context relevant)

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

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full log.
Recent decisions affecting v1.7:

- [Phase 28]: Admin-only approval via RLS (Database-level enforcement for stock-out requests)
- [Phase 29]: Computed request status from line items (Parent always reflects child state, no manual sync)
- [Phase 30]: Whole-request atomic execution (⚠️ CHANGING in v1.7 to per-line-item execution)
- [Phase 31]: Conditional slider rendering (Slider only when context exists, clean UX for manual flows)
- [Phase 32]: SOR groups always expanded with no accordion for visibility and simplicity
- [Phase 32]: Stepped progress bar uses layered absolute positioning for funnel visualization
- [Phase 33]: Dual reference display with circular navigation prevention (Suppress self-links via currentQmhqId prop)
- [Phase 33]: Independent nested data fetching (Components fetch own data when context allows, reduces coupling)
- [Phase 34]: Transaction-level advisory locks for automatic cleanup (pg_advisory_xact_lock prevents session lock leaks)
- [Phase 34]: Lock ordering prevents deadlocks (line item trigger context -> parent request FOR UPDATE)
- [Phase 34]: Data migration before CHECK constraint (fixes orphaned records to prevent deployment failures)

### Pending Todos

None.

### Blockers/Concerns

**From v1.7 Planning:**
- ✓ Advisory lock patterns implemented in Phase 34-01 (transaction-level locks for stock and approval validation)
- Concurrent execution threshold testing needed (target: 10+ concurrent executions with <100ms lock wait time) — to be monitored in Phase 35
- Real-time subscription vs query invalidation decision needed for Phase 35 (depends on multi-tab usage patterns)

**Known Tech Debt:**
- PO Edit page does not exist at /po/[id]/edit (Edit button links to 404) — pre-existing from v1.3
- Context slider deferred for stock-out approval/execution pages (CSLR-02, CSLR-03)

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 34-01 (Advisory locks and row-level locking for trigger hardening)
Resume file: None
Next action: Execute 34-02 (QMHQ auto-population and idempotency constraints)

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
| 30-user-deactivation | 02 | 5min | 3 | 5 | 2026-02-10 |
| 31-context-sliders | 01 | 5min | 2 | 4 | 2026-02-10 |
| 31-context-sliders | 02 | 6min | 2 | 2 | 2026-02-10 |
| 32-qmhq-transaction-linking | 01 | 2min | 2 | 2 | 2026-02-11 |
| 32-qmhq-transaction-linking | 02 | 5min | 2 | 1 | 2026-02-11 |
| 33-dual-reference-display | 01 | 6min | 2 | 3 | 2026-02-11 |
| 34-database-trigger-hardening | 01 | 1min | 2 | 3 | 2026-02-11 |

---
*State initialized: 2026-01-27*
*Last updated: 2026-02-11 - Completed 34-01 (Advisory locks and row-level locking for trigger hardening)*

