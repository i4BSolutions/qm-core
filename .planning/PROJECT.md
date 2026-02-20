# QM System

## What This Is

An internal ticket, expense, and inventory management platform serving as a Single Source of Truth (SSOT) for request-to-fulfillment workflows. The system handles QMRL (request letters), QMHQ (headquarters processing with Item/Expense/PO routes), purchase orders, invoices, and inventory with WAC valuation — with smart PO lifecycle management (6-state status engine, cancellation/void guards, admin unlock), two-layer stock-out approval (qty approval + warehouse assignment) with dedicated execution page, per-item standard unit management with conversion rate tracking, standardized list views with consistent columns and URL-driven pagination across all entity pages, auto-generated user avatars (boring-avatars), deletion protection, team collaboration via comments, responsive financial displays, standardized UI via composite components, streamlined 3-role RBAC (Admin/QMRL/QMHQ), admin-only end-to-end flow tracking, and professional PDF receipt export.

## Core Value

Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

## Current State (v1.12 Shipped)

**Tech Stack:**
- Next.js 14+ with App Router, TypeScript strict mode
- Supabase for auth, database, and file storage
- Tailwind CSS with dark theme support
- ~54,047 lines of TypeScript
- 75 database migrations with RLS policies (100 policies across 22 tables)

**Shipped Features:**
- Email OTP authentication with 3-role RBAC (Admin/QMRL/QMHQ)
- QMRL/QMHQ with Notion-style status system
- Purchase orders with smart status calculation
- Invoice creation with quantity validation and void cascade
- Inventory stock-in/out with WAC valuation (multi-currency)
- Stock-out request/approval workflow with partial approval and per-line-item execution
- QMHQ item route integration with stock-out requests (requested/approved/rejected/executed qty display)
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
- 7 composite UI components (PageHeader, FilterBar, ActionButtons, FormField, FormSection, DetailPageLayout, CardViewGrid)
- 32 pages migrated to standardized composites
- Admin-only end-to-end flow tracking (QMRL → QMHQ → PO → Invoice → Stock chain)
- Server-side layout guards for role-based route protection
- PO smart status engine with 6-state auto-calculation triggered by invoice/stock-in events
- PO cancellation guard (blocks when active invoices exist) at DB trigger and UI level
- Invoice void guard (blocks when stock-in exists) at DB trigger and UI level
- Admin-only closed PO unlock with automatic re-lock on recalculation
- PO Matching tab with side-by-side PO vs Invoice vs Stock-In comparison
- Per-line-item stepped progress bars (ordered/invoiced/received)
- Professional dark-themed PDF receipt export (Invoice, Stock-Out, Money-Out)
- PO header editing with status guards and audit logging (line items immutable)
- Flow tracking VIEW optimized with 8 partial indexes and Suspense loading
- JSDoc-annotated composite component prop interfaces (24 props documented)
- Standard unit entity management with CRUD admin page and inline creation
- Per-item standard unit assignment (items → standard_units FK)
- Per-transaction conversion rate input on PO, Invoice, stock-in, and stock-out forms
- Standard quantity display (qty x rate) on all detail pages, tables, and PDF exports
- USD exchange rate auto-lock at database (CHECK constraints) and UI levels
- Two-layer stock-out approval (L1 qty approval + L2 warehouse assignment with stock validation)
- Dedicated stock-out execution page at /inventory/stock-out with warehouse/status filters
- Auto-generated user avatars (boring-avatars Beam variant) across list views, comments, and history
- Standardized list views with defined columns across QMRL, QMHQ, PO, Invoice, Items, Stock-out pages
- URL-driven pagination (usePaginationParams hook) with responsive card/list toggle
- Assigned person filter on all applicable list pages
- UserAvatar in audit history entries with system Bot indicator for automated actions

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

<!-- V1.8 Features -->
- ✓ Standardized UI via 7 composite components (PageHeader, FilterBar, ActionButtons, FormField, FormSection, DetailPageLayout, CardViewGrid) — v1.8
- ✓ 32 pages migrated to composite components with consistent headers, filters, forms, and detail layouts — v1.8
- ✓ RBAC overhauled from 7 roles to 3 (admin, qmrl, qmhq) with expand-and-contract database migration — v1.8
- ✓ 92 RLS policies recreated for 3-role model across 20 tables — v1.8
- ✓ Server-side layout guards for role-based route protection — v1.8
- ✓ Admin-only end-to-end flow tracking page with QMRL chain visualization — v1.8
- ✓ Navigation sidebar filtered by user role — v1.8

<!-- V1.9 Features -->
- ✓ PO smart status engine (6-state auto-calculation with advisory lock concurrency) — v1.9
- ✓ Per-line-item stepped progress bars on PO detail (ordered/invoiced/received) — v1.9
- ✓ Matching tab on PO detail (PO vs Invoice vs Stock-In with variance highlighting) — v1.9
- ✓ Lock mechanism on Closed POs with admin-only unlock capability — v1.9
- ✓ PO cancellation guard (blocked when active invoices exist, DB + UI enforcement) — v1.9
- ✓ Invoice void guard (blocked when stock-in exists, DB + UI enforcement) — v1.9
- ✓ PDF receipt export for invoices (with PO reference and receiving progress) — v1.9
- ✓ PDF receipt export for QMHQ money-out transactions (dual currency) — v1.9
- ✓ PDF receipt export for SOR-based stock-out transactions (with approval audit trail) — v1.9

<!-- V1.10 Features -->
- ✓ PO Edit page at /po/[id]/edit for header fields (supplier, notes, dates) — line items and amounts immutable — v1.10
- ✓ Flow tracking VIEW performance optimization with 8 partial indexes — v1.10
- ✓ Composite component prop types documented with JSDoc annotations — v1.10

<!-- V1.11 Features -->
- ✓ Standard unit entity management with admin CRUD page — v1.11
- ✓ Per-item standard unit assignment with FK and inline creation — v1.11
- ✓ Per-transaction conversion rate input on all quantity forms (PO, Invoice, stock-in, stock-out) — v1.11
- ✓ Standard qty display (qty × rate) on all detail pages, tables, and PDF exports — v1.11
- ✓ Backfill existing transactions with conversion_rate = 1 and items with 'pcs' unit — v1.11
- ✓ USD exchange rate auto-lock enforcement (DB constraints + UI) — v1.11

<!-- V1.12 Features -->
- ✓ QMRL list view with table columns (ID, Title, Status, Assigned Person, Request Date) — v1.12
- ✓ Two-layer stock-out approval: Layer 1 approves qty, Layer 2 assigns warehouse — v1.12
- ✓ Dedicated stock-out execution page with list view and warehouse filter — v1.12
- ✓ Audit history shows user avatar + name on each action — v1.12
- ✓ Standardized list view columns across QMRL, QMHQ, PO, Invoice, Items, Stock-out — v1.12
- ✓ Consistent pagination UI and assigned person filter on all list/card pages — v1.12
- ✓ Auto-generated user profile avatars shown everywhere users appear — v1.12

### Active

#### Current Milestone: v1.13 Permission Matrix & Auto Status

**Goal:** Replace fixed 3-role RBAC with per-user permission matrix across 15 resources, add computed QMHQ auto status by route type, and redesign dashboard as a permission-filtered QMRL list with auto status.

**Target features:**
- Per-user permission matrix (Edit/View/Block) across 15 resource areas
- Full RLS policy rewrite for permission-matrix enforcement
- Permission management UI (admin sets per-user, required at creation)
- Sidebar navigation filtered by user permissions (Block = hidden)
- QMHQ route-based auto status (Item/Expense/PO × Pending/Processing/Done)
- Dashboard redesign: QMRL list with QMHQ auto status column (permission-filtered)

### Out of Scope

- Real-time WebSocket dashboard updates — polling sufficient
- Per-item low stock thresholds — global default (10) works
- Transaction editing after creation — audit integrity
- File attachments on PO/Invoice — QMRL/QMHQ scope first
- Multi-level comment threading — visual complexity, harder to follow
- Edit comments — breaks audit integrity
- @mention notifications — requires notification infrastructure
- Manual currency override on money-out — defeats unification purpose
- Multi-level approval chains — two-layer (qty + warehouse) is sufficient; three+ layers adds complexity
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
- WAC per standard unit display — deferred, no user request yet
- Aggregate standard units on dashboards — deferred, per-item units make aggregation less meaningful
- Custom profile photo upload — deterministic boring-avatars sufficient for internal tool
- Column sorting by header click in list views — deferred, filtering sufficient for now
- View mode preference persistence (localStorage) — deferred, card default works
- Server-side pagination — client-side sufficient for <500 records per entity
- Configurable/hideable list view columns — low value for internal tool
- Card view on execution page — list-only per user decision (task queue is better as list)

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
- v1.8 UI Consistency, Flow Tracking & RBAC — Composite UI components, 3-role RBAC, flow tracking (shipped 2026-02-12)
- v1.9 PO Lifecycle, Cancellation Guards & PDF Export — PO smart status, matching panel, void guards, PDF receipts (shipped 2026-02-13)
- v1.10 Tech Debt Cleanup — PO edit page, flow tracking performance, type safety (shipped 2026-02-14)
- v1.11 Standard Unit System — Per-item standard units, conversion rates, standard qty display, USD auto-lock (shipped 2026-02-16)
- v1.12 List Views & Approval Workflow — Standardized list views, two-layer approval, execution page, user avatars (shipped 2026-02-20)

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
- Invoice-first priority in PO status calculation (partially_invoiced over partially_received)
- Guard-before-cascade trigger pattern (aa_ prefix fires before zz_ audit)
- Dynamic import with SSR-safe wrapper for client-side PDF generation (@react-pdf/renderer)
- PDF button wrapper components to prevent webpack ESM bundling errors
- Independent nested data fetching (components fetch own data when context allows)
- Transaction-level advisory locks (pg_advisory_xact_lock) for automatic cleanup
- Lock ordering (line item → parent request) to prevent deadlocks
- Auto-populate FK from trigger chain (approval → line_item → request → qmhq_id)
- Partial unique index for idempotency (scoped to specific transaction types)
- Per-approval execution with stock pre-check and optimistic UI with rollback
- BroadcastChannel cross-tab sync pattern (qm-stock-out-execution channel)
- Header-only entity editing with immutable financial fields
- Status-based edit guards at both page render and server action level
- Conditional audit logging (only when fields actually changed)
- Partial indexes for VIEW optimization (WHERE is_active = true matches VIEW filter)
- OR join elimination via split LEFT JOINs + COALESCE merge
- Next.js loading.tsx + inline Suspense for dual loading state patterns
- JSDoc annotations on composite component props for IDE type guidance
- ConversionRateInput mirroring ExchangeRateInput API (4-decimal, thousand separators)
- StandardUnitDisplay presentational component (unitName prop, no hooks)
- Per-item standard unit via FK join (items → standard_units) for display
- Generated columns for standard_qty (qty × conversion_rate) in transaction tables
- Entity-managed standard units replacing key-value config pattern
- InlineCreateSelect extension for new entity types (standard_unit with no color picker)
- USD exchange rate CHECK constraints on financial tables (rate = 1.0 when currency = USD)
- Two-layer approval schema: L1 (quartermaster) auto-sets layer via trigger, L2 (admin) references parent_approval_id
- Data-passive UserAvatar component (accepts fullName string, no internal fetch — prevents N+1)
- boring-avatars Beam variant deterministic SVG (pure function of name string, no server state)
- usePaginationParams hook for URL-driven pagination (?page=N&pageSize=N) with router.push
- Responsive card/list toggle with auto-switch below 768px via useEffect + window.innerWidth
- Filter collapse to Popover on mobile (hidden md:flex desktop, md:hidden mobile)
- History avatar detection via changed_by UUID null check (not name string comparison)
- System Bot indicator: slate-700 circle with Bot icon for null changed_by entries

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
| Composite UI components | 7 composites for consistent UI without big-bang refactor | ✓ Good |
| Expand-and-contract RBAC migration | Safe enum migration from 7 to 3 roles, no data loss | ✓ Good |
| 3-role RBAC (admin/qmrl/qmhq) | Simplified from 7 roles — clearer boundaries | ✓ Good |
| Server-side layout guards | Route protection at layout level, not just navigation filtering | ✓ Good |
| PostgreSQL VIEW for flow tracking | Real-time data, simpler than materialized view for <10K QMRLs | ✓ Good |
| Card-based flow tracking (no graph library) | Linear chain doesn't need React Flow — card layout sufficient | ✓ Good |
| Surgical JSX replacement for UI migration | Preserve business logic, only replace visual wrapper | ✓ Good |
| Invoice-first priority in PO status | Show partially_invoiced until ALL items invoiced, even if some received | ✓ Good |
| Advisory locks for PO status calculation | pg_advisory_xact_lock prevents concurrent calculation race conditions | ✓ Good |
| Admin-only PO cancellation with mandatory reason | Financial control — only admin can cancel, must explain why | ✓ Good |
| Voided invoices don't block PO cancellation | Only active non-voided invoices count for guard check | ✓ Good |
| Skip DB-level closed-PO edit protection | UI layer + Server Action validation sufficient | ✓ Good |
| Fallback to partially_received when unlocking | Allows admin corrections on fully-matched POs | ✓ Good |
| @react-pdf/renderer over Puppeteer | Lighter weight, client-side PDF generation, no server-side headless browser | ✓ Good |
| Dynamic import wrapper for PDF components | Prevents webpack ESM bundling errors and SSR canvas/fs errors | ✓ Good |
| Dark theme PDF styling (slate-900, amber accents) | Matches app aesthetic, professional appearance | ✓ Good |
| Single table layout for PO Matching tab | More scannable than side-by-side cards, variance columns built in | ✓ Good |
| PO edit header-only (line items immutable) | Financial integrity — amounts locked after creation | ✓ Good |
| Signer names as strings (not FK) | Flexibility for signers not in contact_persons table | ✓ Good |
| Partial indexes (WHERE is_active = true) for flow tracking | Match VIEW filter conditions for optimal index usage | ✓ Good |
| Split OR join into two LEFT JOINs | Enables index usage on inventory_transactions; COALESCE merges columns | ✓ Good |
| JSDoc documentation only (no type changes) for composites | All composite props have legitimate ReactNode usages; document rather than break | ✓ Good |
| Multiplication formula for standard qty | standard_qty = qty × conversion_rate (not division like exchange rate) | ✓ Good |
| Per-transaction conversion rate (no per-item default) | Mirrors exchange rate pattern — user enters every time, no assumptions | ✓ Good |
| Entity-managed standard units over key-value config | Full CRUD, FK references, usage counts — better than simple config string | ✓ Good |
| Per-item standard unit assignment | Each item has a unit (kg, liters, pcs) — more precise than global setting | ✓ Good |
| Global config → entity migration path | Started with system_config, evolved to standard_units table, then dropped config | ✓ Good |
| Hard delete with FK protection for standard units | ON DELETE RESTRICT prevents removing units in use; consistent with entity pattern | ✓ Good |
| USD exchange rate CHECK constraints | Database-level enforcement (rate = 1.0 when USD) — cannot be bypassed | ✓ Good |
| ConversionRateInput mirrors ExchangeRateInput | Same API, same decimal precision, consistent UX across financial and unit inputs | ✓ Good |
| Skip aggregate standard qty on PO totals | Different items have different units — aggregating is meaningless | ✓ Good |
| Data-passive UserAvatar (fullName only) | Prevents N+1 queries on list pages — caller provides name | ✓ Good |
| boring-avatars Beam variant (no custom colors) | Deterministic, visually distinct, zero configuration | ✓ Good |
| Two-layer approval (L1 qty + L2 warehouse) | Separates quantity decision from warehouse allocation | ✓ Good |
| L2 hard cap at min(remaining, stock) | Prevents over-allocation and over-commitment | ✓ Good |
| Pending inventory_transaction at L2 time | Warehouse known at L2, execution just updates status | ✓ Good |
| Execution page list-only (no card view) | Task queue is clearer as list; user decision override | ✓ Good |
| No new request button on execution page | Execution-only page; creation stays at SOR list | ✓ Good |
| URL-driven pagination (usePaginationParams) | Browser back works, shareable state, consistent UX | ✓ Good |
| Responsive auto-switch to card below 768px | Tables don't work on mobile; automatic fallback | ✓ Good |
| History avatar UUID null check (not name) | Authoritative detection; name strings are fragile | ✓ Good |
| System Bot indicator (slate-700 + Bot icon) | Visually distinct from colorful boring-avatars output | ✓ Good |

## Constraints

- **Storage**: Supabase Storage with 25MB file limit
- **Compatibility**: Must work with existing RLS and audit system
- **Audit**: All status/financial changes must be logged

## Known Tech Debt

- Context slider deferred for stock-out approval/execution pages (CSLR-02, CSLR-03)
  - Approval detail page already shows full request context
  - Execution is a dialog modal, not a standalone page
- Orphaned file: `components/stock-out-requests/approval-dialog.tsx` (old pre-v1.12 dialog, not imported anywhere)
- Local `UserAvatar` definitions in flow-tracking components (shadow the boring-avatars component; pre-existing)

---
*Last updated: 2026-02-20 after v1.12 milestone shipped*
