# QM System

## What This Is

An internal ticket, expense, and inventory management platform serving as a Single Source of Truth (SSOT) for request-to-fulfillment workflows. The system handles QMRL (request letters), QMHQ (headquarters processing with Item/Expense/PO routes), purchase orders, invoices, and inventory with WAC valuation — with per-line-item stock-out approval and execution workflows, deletion protection, team collaboration via comments, and responsive financial displays.

## Core Value

Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## Current State (v1.7 Shipped)

**Tech Stack:**
- Next.js 14+ with App Router, TypeScript strict mode
- Supabase for auth, database, and file storage
- Tailwind CSS with dark theme support
- ~43,976 lines of TypeScript
- 62 database migrations with RLS policies

**Shipped Features:**
- Email OTP authentication with 7-role RBAC
- QMRL/QMHQ with Notion-style status system
- Purchase orders with smart status calculation
- Invoice creation with quantity validation and void cascade
- Inventory stock-in/out with WAC valuation (multi-currency)
- Stock-out request/approval workflow with partial approval and atomic execution
- QMHQ item route integration with stock-out requests (requested/approved/rejected/executed qty display)
- Per-line-item stock-out execution with stock pre-check and confirmation dialog
- SOR-grouped transaction display with stepped progress visualization on QMHQ detail
- Dual reference display (SOR primary + QMHQ secondary) on stock-out transactions
- Database trigger hardening (advisory locks, row-level locking, idempotency constraints)
- Aggregate fulfillment metrics with cross-tab sync (BroadcastChannel)
- File attachments with drag-drop upload, preview, and ZIP download
- File upload in QMRL create form with staged upload pattern
- Live management dashboard with KPIs and alerts
- Inventory dashboard with transaction history and filters
- Warehouse detail with per-item WAC and EUSD values
- Quick status changes via clickable badges with optional notes
- Complete audit logging with cascade effects
- Standardized currency display (original + EUSD)
- Number input with thousand separators (AmountInput/ExchangeRateInput)
- QMHQ fulfillment progress tracking
- Context sliders on QMHQ create and stock-out request pages
- Permission-gated Edit buttons on detail pages
- Item price reference with tooltip in PO line item selector
- Auto-generated SKU codes (SKU-[CAT]-[XXXX] format)
- Inline item creation during PO line item entry
- Multi-tab session handling with cross-tab logout sync
- Contact person validation for Expense and PO routes
- Threaded comments on QMRL, QMHQ, PO, and Invoice detail pages
- Fluid font scaling and K/M/B abbreviation for large amounts
- Two-step category → item selector with search (PO, stock-in, stock-out)
- QMHQ currency inheritance with locked fields and balance warning
- Dual currency display (Org + EUSD) on QMHQ detail and list pages
- Deletion protection for items, statuses, categories, departments, contacts, suppliers
- User deactivation (no delete) with login blocking and admin reactivation

## Requirements

### Validated

<!-- V1.0 Features -->
- ✓ Email OTP authentication with role-based access — v1.0
- ✓ QMRL creation with Notion-style status system — v1.0
- ✓ QMHQ with three routes (Item, Expense, PO) — v1.0
- ✓ Invoice creation with 4-step wizard — v1.0
- ✓ Inventory transactions (stock-in/out) — v1.0
- ✓ WAC valuation for inventory items — v1.0
- ✓ Audit logging with history tabs — v1.0
- ✓ Card/List view toggle for QMHQ, PO, Invoice — v1.0

<!-- V1.1 Features -->
- ✓ PO creation workflow fixed — v1.1
- ✓ Stock-in functionality fixed — v1.1
- ✓ Invoice quantity validation (cannot exceed PO qty) — v1.1
- ✓ File attachments on QMRL/QMHQ detail pages — v1.1
- ✓ In-app image and PDF preview — v1.1
- ✓ Download all files as ZIP — v1.1
- ✓ Live management dashboard with status KPIs — v1.1
- ✓ Low stock alerts (items below 10 units) — v1.1
- ✓ Quick status change via badge click — v1.1
- ✓ DD/MM/YYYY date picker standardization — v1.1

<!-- V1.2 Features -->
- ✓ Transaction date picker consistency — v1.2
- ✓ Number input empty placeholders — v1.2
- ✓ Number input validation (prevent negative/zero) — v1.2
- ✓ Warehouse detail with per-item WAC display — v1.2
- ✓ Inventory dashboard with transaction counts and values — v1.2
- ✓ Inventory dashboard warehouse filter — v1.2
- ✓ Manual stock-in with currency and exchange rate — v1.2
- ✓ Invoice void cascade (PO status, quantities, financials) — v1.2

<!-- V1.3 Features -->
- ✓ Attachment delete UI aligned with RLS policy — v1.3
- ✓ QMHQ fulfillment progress tracking — v1.3
- ✓ Number input preserves typed value on blur — v1.3
- ✓ Currency display standardized (original + EUSD) — v1.3
- ✓ Status change notes captured in audit history — v1.3
- ✓ Permission-gated Edit buttons on detail pages — v1.3

<!-- V1.4 Features -->
- ✓ File upload in QMRL create form — v1.4
- ✓ Attachment delete errors fixed on QMRL/QMHQ detail pages — v1.4
- ✓ Side panel showing QMRL detail during QMHQ creation — v1.4
- ✓ Thousand separators on amount inputs — v1.4
- ✓ Responsive display for large amounts — v1.4
- ✓ Item price reference field with tooltip in PO line item selector — v1.4
- ✓ Auto-generated item codes (SKU-[CAT]-[XXXX] format) — v1.4
- ✓ Inline item creation during PO line item entry — v1.4
- ✓ Multi-tab session handling without auth errors — v1.4
- ✓ Mandatory contact person for Expense and PO routes — v1.4

<!-- V1.5 Features -->
- ✓ Large amount responsiveness on cards with auto-shrinking font — v1.5
- ✓ Comment threads on QMRL/QMHQ/PO/Invoice detail pages — v1.5
- ✓ One level of reply support for comments — v1.5
- ✓ Delete own comments (no edit) — v1.5
- ✓ Two-step PO line item selector (category → item) — v1.5
- ✓ Searchable category and item selectors in PO creation — v1.5
- ✓ QMHQ money-out inherits currency from money-in — v1.5
- ✓ Org + EUSD display on QMHQ detail pages and list cards — v1.5

<!-- V1.6 Features -->
- ✓ Stock-out request and approval workflow for QMHQ item route — v1.6
- ✓ Stock-out request and approval workflow for manual warehouse stock-out — v1.6
- ✓ Admin-only approval with partial approval support — v1.6
- ✓ QMHQ item detail shows requested qty and approved qty — v1.6
- ✓ Deletion protection for referenced entities (item, status, category, department, contact person, supplier) — v1.6
- ✓ User deactivation (no delete) with login blocking — v1.6
- ✓ Context slider on stock-out request and QMHQ create pages — v1.6

<!-- V1.7 Features -->
- ✓ Per-line-item stock-out execution instead of whole-request atomic execution — v1.7
- ✓ QMHQ item detail links stock-out transactions through SOR → execution — v1.7
- ✓ Stock-out transaction reference shows SOR ID (primary) and parent QMHQ ID (secondary) — v1.7
- ✓ QMHQ fulfillment metrics (requested/approved/rejected/executed) with cross-tab sync — v1.7
- ✓ Database advisory locks and idempotency constraints for concurrent execution safety — v1.7
- ✓ Auto-populate QMHQ link from SOR chain with backfill migration — v1.7

### Active

(None — define in next milestone)

### Out of Scope

- Real-time WebSocket dashboard updates — polling sufficient
- Per-item low stock thresholds — global default (10) works
- Transaction editing after creation — audit integrity
- File attachments on PO/Invoice — QMRL/QMHQ scope first
- Multi-level comment threading — visual complexity, harder to follow
- Edit comments — breaks audit integrity
- @mention notifications — requires notification infrastructure
- Manual currency override on money-out — defeats unification purpose
- Multi-level approval chains — single-tier admin approval sufficient for internal tool
- Stock reservation on request creation — adds complexity; internal tool doesn't need overselling prevention
- Approval delegation to non-admin roles — permission complexity; keep admin-only for now
- Real-time notification of approval status — no notification infrastructure yet
- Hard delete of any entity — soft delete (is_active) is established pattern; audit integrity
- Specific reference list in delete error — generic error sufficient; defer detailed view
- Context slider on stock-out approval/execution pages — approval page already shows full context; execution is a dialog
- Whole-request atomic execution — replaced by per-line-item execution in v1.7
- Batch "Execute All" button — per-line-item execution is the goal; batch can be added later
- Advisory lock performance tuning — defer until 10K+ SORs/month
- Real-time subscription for execution status — query invalidation sufficient for internal tool

## Context

**Milestones:**
- v1.0 MVP — Foundation (shipped 2026-01-27)
- v1.1 Enhancement — Bug fixes, files, dashboard, UX (shipped 2026-01-28)
- v1.2 Inventory & Financial Accuracy — WAC, inventory dashboard, void cascade (shipped 2026-01-31)
- v1.3 UX & Bug Fixes — Input behavior, currency display, edit buttons, audit notes (shipped 2026-02-02)
- v1.4 UX Enhancements & Workflow Improvements — Attachments, number formatting, inline creation, multi-tab auth (shipped 2026-02-06)
- v1.5 UX Polish & Collaboration — Comments, responsive typography, two-step selectors, currency unification (shipped 2026-02-09)
- v1.6 Stock-Out Approval & Data Integrity — Stock-out approval, deletion protection, user deactivation, context sliders (shipped 2026-02-10)
- v1.7 Stock-Out Request Logic Repair — Per-line-item execution, QMHQ transaction linking, dual reference display (shipped 2026-02-11)

**Technical Patterns Established:**
- Enhanced Supabase error extraction for PostgresError
- Safe JSONB column access in audit triggers
- Polymorphic file attachments (entity_type + entity_id)
- Storage RLS policies mirroring entity permissions
- Cascade soft-delete with 30-day grace period
- RPC functions for dashboard aggregations
- useInterval hook with ref-based stale closure prevention
- Number input utilities with keydown handlers (no auto-format on blur)
- CurrencyDisplay component for two-line original + EUSD format
- RPC-first pattern for complex mutations with audit trail
- Trigger deduplication via time-window check
- CSS clamp() for fluid font scaling
- Intl.NumberFormat compact notation for K/M/B abbreviation
- CategoryItemSelector for two-step dependent dropdowns with AbortController
- Currency inheritance with Lock icon + Inherited badge
- Warning toast variant (amber) for soft validation
- Stock-out approval workflow (request → line items → approvals → execution)
- Cross-warehouse stock validation at request, approval, and execution time
- Computed parent status from child line items (aggregated status trigger)
- Deletion protection triggers with partial indexes for performance
- Conditional error detection for trigger messages (isReferenceError pattern)
- Dual enforcement for user deactivation (ban_duration + middleware is_active check)
- ContextSlider pattern: structural shell + presentational content components
- Conditional layout pattern (grid only when context is relevant)
- SOR-grouped transaction display with stepped progress visualization
- Dual reference display with circular navigation prevention (currentQmhqId prop)
- Independent nested data fetching (components fetch own data when context allows)
- Transaction-level advisory locks (pg_advisory_xact_lock) for automatic cleanup
- Lock ordering (line item → parent request) to prevent deadlocks
- Auto-populate FK from trigger chain (approval → line_item → request → qmhq_id)
- Partial unique index for idempotency (scoped to specific transaction types)
- Per-approval execution with stock pre-check and optimistic UI with rollback
- BroadcastChannel cross-tab sync pattern (qm-stock-out-execution channel)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Storage for files | Already using Supabase, no new infrastructure | ✓ Good |
| Global low stock threshold (10 units) | Simpler than per-item config | ✓ Good |
| Amount locked after transaction creation | Audit integrity | ✓ Good |
| Full preview for all file types | Better UX than download-only | ✓ Good |
| Dashboard for Admin/Quartermaster only | Other roles have specific workflows | ✓ Good |
| Quick status via badge click | Minimal UI change, intuitive | ✓ Good |
| View-only transaction modal | Audit integrity over editability | ✓ Good |
| Detail page uploads only | Entity must exist to attach files | ✓ Good |
| Attachment delete per-file ownership | Users delete own, admin/quartermaster delete any | ✓ Good |
| String state for number inputs | Preserves typed values, no auto-format on blur | ✓ Good |
| CurrencyDisplay two-line format | Original currency + EUSD equivalent clearly visible | ✓ Good |
| Quartermaster cannot edit PO | Explicit business rule override of permission matrix | ✓ Good |
| Invoice has no Edit button | Void functionality serves as modification mechanism | ✓ Good |
| RPC creates audit before entity update | Enables trigger deduplication to prevent duplicates | ✓ Good |
| 2-second window for audit deduplication | Balances race condition protection vs. usability | ✓ Good |
| Single-level comment threading | DB trigger enforces replies can't have replies — keeps discussions readable | ✓ Good |
| Comments after Tabs (not inside) | Always visible without switching tabs | ✓ Good |
| CSS clamp() for fluid font scaling | Smooth viewport-responsive sizing without breakpoint jumps | ✓ Good |
| Context-dependent abbreviation thresholds | card: 1M, table: 1B, detail: never — respects financial precision | ✓ Good |
| CategoryItemSelector two-step pattern | Category-first filtering reduces item list complexity | ✓ Good |
| Currency inheritance with Lock badge | Prevents accidental currency mismatch in transactions | ✓ Good |
| Balance warning as soft validation | Warns but allows submission — user decides | ✓ Good |
| Admin-only approval via RLS | Database-level enforcement, not just UI guards | ✓ Good |
| Computed request status from line items | Parent always reflects child state, no manual sync | ✓ Good |
| Item snapshot at line item creation | Preserves historical accuracy even if item renamed | ✓ Good |
| Whole-request atomic execution → Per-line-item execution | Originally simpler UX, but per-line granularity needed for partial fulfillment | ✓ Good — replaced in v1.7 |
| Per-item stock pre-check with tooltip | Disabled Execute button + tooltip when insufficient stock | ✓ Good |
| Transaction-level advisory locks | pg_advisory_xact_lock for automatic cleanup, prevents session leak | ✓ Good |
| Lock ordering (line item → parent request) | Prevents deadlocks during concurrent execution | ✓ Good |
| Auto-populate qmhq_id from SOR chain | Trigger traverses approval → line_item → request to set qmhq_id | ✓ Good |
| Partial unique index for idempotency | Scoped to completed+active inventory_out only | ✓ Good |
| Numbers-only metrics display (no progress bar) | Clearer than progress bar for discrete qty values | ✓ Good |
| BroadcastChannel for cross-tab sync | Real-time updates without polling; Safari fallback included | ✓ Good |
| Generic deletion error message | Security — doesn't reveal reference details | ✓ Good |
| Partial indexes for deletion checks | WHERE is_active = true optimizes performance | ✓ Good |
| Dual enforcement for user deactivation | ban_duration prevents token refresh, middleware catches unexpired tokens | ✓ Good |
| Self-deactivation guard | Admin cannot deactivate themselves to prevent lockout | ✓ Good |
| Conditional slider rendering | Slider only when context exists (QMHQ param), clean UX for manual flows | ✓ Good |

## Constraints

- **Storage**: Supabase Storage with 25MB file limit
- **Compatibility**: Must work with existing RLS and audit system
- **Audit**: All status/financial changes must be logged

## Known Tech Debt

- PO Edit page does not exist at /po/[id]/edit (Edit button links to 404)
  - Pre-existing issue discovered during v1.3 audit
  - Either create edit page or document PO as immutable after creation
- Context slider deferred for stock-out approval/execution pages (CSLR-02, CSLR-03)
  - Approval detail page already shows full request context
  - Execution is a dialog modal, not a standalone page

---
*Last updated: 2026-02-11 after v1.7 milestone*
