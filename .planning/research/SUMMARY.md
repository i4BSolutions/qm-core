# Project Research Summary

**Project:** QM System v1.6 - Inventory Workflow & Protection
**Domain:** Internal enterprise inventory/warehouse management system
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

QM System v1.6 adds four critical features to enhance inventory control and data integrity: stock-out approval workflow, entity deletion protection, user deactivation, and context side sliders. Research reveals all features can be implemented using the existing Next.js + Supabase stack with **zero new dependencies**. The codebase already contains proven patterns for each feature—stock-out workflow extends the existing status_config system used by QMRL/QMHQ, deletion protection uses native PostgreSQL foreign key constraints, user deactivation leverages existing `is_active` flags, and context sliders extract the pattern from the 640-line `QmrlContextPanel` component.

The recommended approach is to build on existing architectural patterns rather than introduce new libraries. The status workflow system (status_config table + `update_status_with_note()` RPC) has proven robust across 52 migrations. The audit logging system automatically tracks all state changes. PostgreSQL RESTRICT constraints provide atomic deletion protection superior to application-level checks. The main risk is stock validation race conditions—stock levels may change between request creation and approval time, requiring checks at both stages.

This milestone is low-risk and high-value. All patterns exist in production code. Integration points are well-defined. The architecture supports these features without modification—only additive changes are required.

## Key Findings

### Recommended Stack

**No new dependencies required.** All features leverage existing infrastructure:

**Core technologies:**
- **Next.js 14.2.13 + React 18.3.1**: Server Components for data fetching, Server Actions for mutations, App Router for structure—existing patterns cover all use cases
- **Supabase PostgreSQL**: Native FK constraints with RESTRICT for deletion protection, status_config table extends to stock-out workflow, 52 migrations prove stability
- **Existing RPC Functions**: `update_status_with_note()` (migration 048) handles workflow transitions with audit trail; `create_audit_log()` trigger works for all entity types
- **Radix UI + Tailwind CSS**: Dialog, Toast, Popover primitives already installed; Tailwind transitions sufficient for slide animations (no Framer Motion needed)
- **react-hook-form + Zod**: Form validation patterns proven across codebase; extend schemas for stock-out requests

**Why no new libraries:**
- State machine libraries (XState, Robot) are overkill—PostgreSQL CHECK constraints + status_config table implement state semantics
- ORM delete hooks (Prisma, Drizzle) not needed—native FK constraints are atomic and reliable
- Animation libraries (Framer Motion) unnecessary—existing QmrlContextPanel uses pure Tailwind transitions
- Component libraries (Headless UI, Mantine) would duplicate Radix UI primitives already in use

### Expected Features

**Stock-Out Approval Workflow:**

**Must have (table stakes):**
- Request creation with reason (min 10 characters) and quantity validation
- Approval status tracking (Draft → Pending → Approved/Rejected → Fulfilled)
- Single approver per request (Admin/Quartermaster/Inventory roles only)
- Approval/rejection with mandatory notes for accountability
- Audit trail for all state changes via existing trigger system
- Stock-out executes on approval by creating inventory_out transaction
- Cancel own pending request (requestor only, status must be pending)

**Should have (competitive):**
- Partial approval (approve less than requested if stock insufficient)—HIGH complexity but valuable
- Priority/urgency levels (normal, high, emergency) for queue management
- Admin override/force approve for emergencies with mandatory justification
- Stock validation at both request time AND approval time (prevents race conditions)

**Defer (v2+):**
- Batch approval UI (select multiple, approve all)
- Auto-approval thresholds (quantities <10 auto-approve)
- Multi-level approval (large quantities require multiple approvers)
- Stock reservation on request creation (complex, likely overkill for internal tool)

**Entity Deletion Protection:**

**Must have:**
- Foreign key RESTRICT constraints on master data (items, warehouses, suppliers, categories, departments)
- User-friendly error messages translating database errors ("Cannot delete: 3 purchase orders reference this item")
- "Where used" display showing reference counts before deletion attempt
- Soft delete for master data (is_active flag) to preserve audit history
- Admin-only deletion permissions enforced via RLS
- Confirmation dialog with two-step flow
- Audit log on deactivation

**Should have:**
- Pre-flight RPC (`check_entity_references()`) to check dependencies before showing delete UI
- Deactivation instead of deletion as default for items, suppliers, categories
- Graceful fallback if pre-flight check missed a race condition (FK constraint still enforces)

**User Deactivation:**

**Must have:**
- Deactivate user (set is_active = false) instead of deletion
- Prevent deactivated user login via auth middleware check
- Filter from active user dropdowns (WHERE is_active = true)
- Preserve historical data attribution (created_by, updated_by remain)
- Reactivation option (admin can restore)
- Deactivation timestamp and reason fields for documentation

**Should have:**
- Session invalidation when user deactivated (prevent active sessions)
- Reassignment workflow (show open tasks before deactivation)

**Context Side Sliders:**

**Must have:**
- Slide-in from right with smooth animation (300ms transition)
- Open/close toggle with persistent button
- Responsive behavior (full-width mobile, 30-40% desktop)
- Overlay backdrop on mobile with click-to-close
- Close on ESC key for accessibility
- Scroll within panel (overflow-y-auto)
- Default open on desktop, closed on mobile

**Should have:**
- Focus trap when panel open (accessibility requirement)
- Lazy load panel content on expand (performance optimization)
- Collapsible sections within panel (accordion for dense content)

### Architecture Approach

**Extend existing patterns, don't replace them.** The QM System has mature architectural foundations proven across 37,410 lines of code and 52 database migrations. All v1.6 features fit cleanly into existing structure.

**Major components:**

1. **Status Workflow System** — Extend status_config table to support `stock_out` entity type; reuse `update_status_with_note()` RPC for approval/rejection with atomic transactions; audit trigger automatically logs all state changes following existing pattern

2. **Deletion Protection Layer** — Change CASCADE to RESTRICT on FK constraints for master data; create `check_entity_references()` RPC for pre-flight validation; use existing Dialog + Toast components for warnings; graceful error handling translates FK violation (error 23503) to user-friendly message

3. **Context Slider Component** — Extract reusable `ContextSlider` container from proven `QmrlContextPanel` (640 lines); create entity-specific content components (StockOutContext, ItemContext, WarehouseStockContext); use Tailwind transform transitions (no JavaScript animation library); maintain responsive behavior (mobile drawer, desktop side panel)

4. **Stock-Out Request Table** — New `stock_out_requests` table with polymorphic QMHQ reference (nullable), item/warehouse FKs, quantity fields (requested + approved for partial approval), workflow fields (status_id, approval_notes, approved_by, approved_at, fulfilled_at), audit fields (created_by, updated_by, timestamps, is_active)

### Critical Pitfalls

1. **Stock validation race condition** — Stock levels may change between request creation and approval time; users might request 50 units when 100 available, but by approval time only 30 remain. **Prevention:** Validate stock at BOTH request creation (soft check with warning) AND approval time (hard check that blocks if insufficient). Consider partial approval workflow to handle shortfall gracefully.

2. **Partial approval complicates stock-out form** — When admin approves 30 of 50 requested units, the subsequent stock-out fulfillment form must use approved_qty (30) as the maximum, not requested_qty (50). **Prevention:** Stock-out form fetches approved_qty field; validation schema enforces qty <= approved_qty; UI shows "Approved: 30 units" prominently.

3. **QMHQ item route integration** — Existing QMHQ item route creates inventory_out transaction directly, bypassing approval workflow. Need to intercept and route through stock-out request flow. **Prevention:** Add trigger or application-level check; when QMHQ item route created, auto-create stock-out request in "Approved" status (maintains backward compatibility); alternative: require manual stock-out request with QMHQ link.

4. **Deletion protection vs soft delete confusion** — System uses is_active for soft delete, but deletion protection is about preventing deactivation when references exist. **Prevention:** Rename UI buttons clearly ("Deactivate" not "Delete" for soft delete); pre-flight check queries WHERE is_active = true to count active references; FK constraints enforce regardless of soft delete flag.

5. **User deactivation with active sessions** — Deactivated user may have valid session tokens from before deactivation; they can continue accessing system until token expires. **Prevention:** Enhance auth middleware to check is_active on EVERY request (not just login); add `deactivated_at` timestamp check; consider force-invalidate sessions via Supabase auth API.

6. **Context slider performance (N+1 queries)** — Side sliders that fetch related data on mount can cause performance issues if they query multiple tables sequentially. **Prevention:** Fetch all slider data in parent Server Component with joins; pass as props to slider content; no additional queries inside slider; use Suspense boundary for progressive loading if needed.

7. **RLS on stock_out_requests** — New table needs row-level security policies matching existing inventory role permissions; incorrect policies could leak data or block legitimate access. **Prevention:** Mirror existing inventory_transactions RLS policies; test with all 7 user roles (admin, quartermaster, finance, inventory, proposal, frontline, requester); verify requester can only see own requests.

## Implications for Roadmap

Based on research, this milestone naturally splits into 4 parallel-capable phases followed by 1 integration phase:

### Phase 1: Stock-Out Approval Workflow
**Rationale:** Core new functionality; has most complexity; other features can be built in parallel. Stock-out workflow is the primary value add for v1.6—it establishes the approval pattern that warehouse managers expect from enterprise systems.

**Delivers:**
- `stock_out_requests` table with workflow statuses
- Request creation form with item/warehouse selection and stock validation
- Approval UI for admin/quartermaster roles with partial approval support
- Fulfillment flow creating inventory_out transaction
- Audit trail for all state changes

**Addresses features:**
- Request creation with reason (table stakes)
- Approval status tracking (table stakes)
- Partial approval (should-have, HIGH value)
- Stock validation at request + approval time (prevents race condition pitfall)

**Avoids pitfalls:**
- Stock validation race condition via dual validation points
- QMHQ integration handled by auto-creating approved requests
- Partial approval complicates fulfillment via clear UI cues

**Research needed:** MEDIUM—workflow state transitions are standard (proven by QMRL/QMHQ), but partial approval logic needs careful validation schema design.

### Phase 2: Entity Deletion Protection
**Rationale:** Independent of Phase 1; low complexity; high safety value. Can be built in parallel. Deletion protection is critical for data integrity—prevents accidental loss of master data referenced across system.

**Delivers:**
- FK constraint audit (change CASCADE to RESTRICT on master data)
- `check_entity_references()` RPC for pre-flight validation
- Enhanced delete dialogs with "where used" warnings
- Graceful error handling for FK violations
- Soft delete enforcement for items, suppliers, categories, warehouses

**Addresses features:**
- Foreign key RESTRICT constraints (table stakes)
- User-friendly error messages (table stakes)
- "Where used" display (table stakes)
- Pre-flight validation (should-have)

**Avoids pitfalls:**
- Deletion protection vs soft delete confusion via clear UI labels
- FK violation error 23503 translated to friendly message
- Pre-flight check + fallback FK constraint handles race conditions

**Research needed:** NONE—standard PostgreSQL FK constraint pattern; well-documented.

### Phase 3: User Deactivation
**Rationale:** Independent; low complexity; extends existing is_active pattern. Can be built in parallel. User lifecycle management is table stakes for enterprise tools.

**Delivers:**
- Enhanced users table (deactivated_at, deactivation_reason fields)
- Deactivation UI with reason prompt
- Auth middleware check for is_active on every request
- Filter deactivated users from assignment dropdowns
- Reactivation workflow for admin

**Addresses features:**
- Deactivate user (table stakes)
- Prevent deactivated login (table stakes)
- Preserve historical data (table stakes)
- Session invalidation (should-have)

**Avoids pitfalls:**
- User deactivation with active sessions via middleware check
- Clear separation from deletion (soft delete preserves, deactivation blocks access)

**Research needed:** NONE—existing is_active flag pattern used throughout system.

### Phase 4: Context Side Sliders
**Rationale:** Independent; reuses existing QmrlContextPanel pattern. Can be built in parallel. Enhances UX across multiple features but doesn't block core functionality.

**Delivers:**
- Extracted `ContextSlider` container component
- `StockOutContext` content component (item details, stock levels)
- `ItemContext` content component (for deletion "where used" display)
- `WarehouseStockContext` content component
- Responsive behavior (mobile drawer, desktop side panel)

**Addresses features:**
- Slide-in from right with smooth animation (table stakes)
- Responsive behavior (table stakes)
- Lazy load panel content (should-have)
- Focus trap accessibility (should-have)

**Avoids pitfalls:**
- Context slider N+1 queries via parent Server Component data fetch
- Performance issues by passing data as props (no queries inside slider)

**Research needed:** NONE—QmrlContextPanel provides complete implementation reference (640 lines).

### Phase 5: Integration & Polish
**Rationale:** Requires all 4 features complete; ties everything together; final testing and edge cases. This phase ensures features work cohesively rather than in isolation.

**Delivers:**
- Stock-out request workflow integrated with QMHQ item route
- Context sliders added to stock-out approval UI (show item/warehouse details)
- Deletion protection applied to items referenced in stock-out requests
- User deactivation with reassignment of pending stock-out requests
- End-to-end testing of combined workflows
- Documentation updates

**Addresses:**
- QMHQ integration pitfall (auto-create approved requests)
- Cross-feature interactions (deleted item with pending requests)
- Role-based permission testing across all features
- Mobile responsiveness validation

**Research needed:** NONE—integration of proven patterns.

### Phase Ordering Rationale

**Parallel phases (1-4)** allow independent development:
- No technical dependencies between deletion protection, user deactivation, and context sliders
- Stock-out workflow is most complex; can proceed without waiting for others
- All four phases share common infrastructure (RLS, audit, Supabase client patterns)

**Why this grouping:**
- Phase 1 (workflow) touches database schema, RPC functions, forms, and UI—largest surface area
- Phase 2 (deletion) is pure database layer + error handling—different skillset can work in parallel
- Phase 3 (deactivation) is auth middleware + UI filtering—independent concern
- Phase 4 (sliders) is pure component extraction—front-end focused
- Phase 5 (integration) verifies all features work together and handles edge cases

**Architecture patterns support parallelization:**
- Database migrations are additive (no conflicting table changes)
- Component structure follows established patterns (no shared state)
- RLS policies are entity-scoped (no policy conflicts)
- Audit system handles all entities uniformly (no coordination needed)

**Risk mitigation:**
- Each phase delivers independently testable functionality
- Integration phase catches interaction bugs before deployment
- Parallel development accelerates timeline (4 phases in parallel vs sequential)

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (Deletion Protection):** Well-documented PostgreSQL FK constraints; error code 23503 handling is standard SQL
- **Phase 3 (User Deactivation):** Extends existing is_active pattern used throughout codebase
- **Phase 4 (Context Sliders):** Complete reference implementation exists (QmrlContextPanel, 640 lines)
- **Phase 5 (Integration):** Combines proven patterns; no new research needed

**Phases needing focused research during planning:**
- **Phase 1 (Stock-Out Approval):** MEDIUM research need for partial approval validation logic and stock validation timing strategy. Recommend `/gsd:research-phase` to analyze:
  - Partial approval state machine (how to transition from approved_qty < requested_qty to fulfilled)
  - Stock validation RPC design (atomic check-and-decrement to prevent race conditions)
  - QMHQ integration trigger pattern (auto-create vs manual link)

**Documentation needed (not research):**
- User guides for stock-out request workflow (requester + approver flows)
- Admin guide for deletion protection ("where used" interpretation)
- Migration guide for changing FK constraints (requires careful sequencing)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies required; all patterns exist in production code (52 migrations, 37k+ LOC) |
| Features | HIGH | Stock-out approval workflow is standard warehouse management pattern; deletion protection is database fundamentals; user deactivation is proven HR system pattern; context sliders are ubiquitous UI pattern |
| Architecture | HIGH | All features extend existing patterns without modification; status_config proven by QMRL/QMHQ; audit system handles all entities; RLS policies follow established structure; component patterns well-defined |
| Pitfalls | HIGH | Stock validation race condition is well-documented inventory management issue with known solutions; other pitfalls are standard enterprise system concerns with clear mitigation strategies |

**Overall confidence:** HIGH

All features are well-understood patterns in enterprise software. The QM System codebase already contains reference implementations for every architectural pattern required. Research sources include direct codebase analysis (primary), official PostgreSQL/Next.js documentation (primary), and established enterprise system best practices (secondary).

### Gaps to Address

**Stock validation timing:**
- Research identified "validate at approval time, not just request time" as critical
- Need to determine exact RPC implementation: atomic check-and-reserve vs optimistic validation
- **Resolution:** During Phase 1 planning, prototype two approaches (pessimistic lock vs optimistic check) and choose based on performance testing

**Partial approval state transitions:**
- Research noted "partial approval complicates stock-out form" but didn't specify exact state machine
- Need to clarify: Does partial approval create two records (approved + rejected portions) or one record with two quantity fields?
- **Resolution:** During Phase 1 requirements definition, decide on single record with `requested_qty` + `approved_qty` fields (simpler) vs split records (more auditable)

**QMHQ integration strategy:**
- Research suggested "auto-create approved requests" for backward compatibility
- Need to validate: Should existing QMHQ item routes retroactively create stock-out requests?
- **Resolution:** During Phase 5 integration, decision point: (a) auto-create on-demand when viewing old QMHQ, or (b) one-time migration script, or (c) only apply to new QMHQ item routes

**Session invalidation mechanism:**
- Research identified "user deactivation with active sessions" pitfall
- Supabase auth session invalidation API capabilities need validation
- **Resolution:** During Phase 3 planning, check Supabase auth API documentation for admin.deleteUser() vs middleware-only approach

**Context slider data fetching strategy:**
- Research warned "N+1 queries" but didn't specify exact data structure
- Need to define: Should parent fetch all slider data upfront or use Suspense boundaries?
- **Resolution:** During Phase 4 implementation, profile both approaches (upfront join query vs streamed Suspense) with realistic data volume

**None of these gaps block progress—all can be resolved during phase planning with documentation review and prototyping.**

## Sources

### Primary (HIGH confidence)

**Codebase Analysis (Direct Inspection):**
- `/components/qmhq/qmrl-context-panel.tsx` (640 lines) — Complete reference implementation for context slider pattern; responsive behavior, mobile drawer, body scroll lock, animation timing
- `/supabase/migrations/048_status_update_with_note.sql` (412 lines) — RPC function for status transitions with audit trail; deduplication logic; works with any entity_type
- `/supabase/migrations/003_status_config.sql` (100 lines) — Status system architecture with entity_type ENUM, status_group ENUM, proven by QMRL/QMHQ
- `/supabase/migrations/026_audit_logs.sql` — Audit trigger system handling create/update/delete/status_change/approval actions
- `/supabase/migrations/011_qmhq.sql` — FK constraint patterns; polymorphic references; CASCADE vs RESTRICT usage
- `/package.json` — Dependency versions confirming no state management, animation, or ORM libraries beyond core stack
- `/CLAUDE.md` — Architecture patterns, permission matrix, iteration guide, component structure conventions

**PostgreSQL Official Documentation:**
- Foreign key constraints (ON DELETE RESTRICT, CASCADE, SET NULL)
- Error code 23503 (foreign_key_violation) handling
- CHECK constraints for state validation
- Trigger functions (BEFORE/AFTER, FOR EACH ROW)
- Generated columns (STORED) for calculated fields
- Row-level security (RLS) policies with USING/WITH CHECK

**Next.js Official Documentation:**
- Server Components for data fetching patterns
- Server Actions for mutations with revalidatePath()
- App Router file-system routing
- Metadata API for SEO
- Middleware for auth checks

**Supabase Official Documentation:**
- JavaScript client (supabase-js v2.x) API
- RPC function invocation with type safety
- Real-time subscriptions (not used in this milestone)
- Storage for file uploads (established pattern from file_attachments)

### Secondary (MEDIUM confidence)

**Industry Research (Web Sources from FEATURES.md):**
- Inventory Management Guide 2026 (kissflow.com) — Stock-out approval workflows as standard practice
- Warehouse Management Systems (asapsystems.com) — Transaction approval cycles and workflow patterns
- Microsoft Dynamics 365 (learn.microsoft.com) — Inventory journal approval workflows; multi-level approvals
- Jira Service Management (atlassian.com) — Approval workflow configuration patterns
- SQL DELETE RESTRICT tutorial (datacamp.com) — FK constraint best practices
- Soft Delete vs Hard Delete analysis (dev.to, brandur.org, dolthub.com) — When to use each approach
- User Deactivation Best Practices (workos.com, zendesk.com, wrike.com) — Deactivation vs deletion for user lifecycle
- Drawer UI Design (mobbin.com, patternfly.org) — Side panel/drawer best practices and accessibility
- shadcn/ui documentation — Sheet/Drawer component patterns (not used but referenced for comparison)

**Community Best Practices:**
- Audit trail requirements for compliance (trullion.com, nutrient.io) — What to track and how
- State management in 2026 (nucamp.co) — Redux vs Context API vs Server Components (confirms Server Components approach)
- Cascade delete patterns (Microsoft EF Core docs, Supabase docs) — When to CASCADE vs RESTRICT

### Tertiary (LOW confidence, flagged for validation)

**Speculative Patterns:**
- Auto-approval thresholds (no specific documentation found) — Deferred to v2+ due to accountability concerns
- Stock reservation on request (theoretical, not industry standard for internal tools) — Deferred as over-engineering
- Multi-level approval workflows (exists in enterprise ERP, overkill for QM System) — Deferred to future if needed

**Assumptions requiring validation during implementation:**
- Partial approval workflow specifics (split records vs dual quantity fields) — No direct pattern found; design decision during Phase 1
- Session invalidation API in Supabase auth (documentation exists but implementation details need verification) — Test during Phase 3
- Optimal data fetching for context sliders (upfront join vs Suspense streaming) — Performance testing during Phase 4

---

**Research completed:** 2026-02-09
**Ready for roadmap:** Yes
**Recommended next step:** Proceed to requirements definition for each phase

**Key Success Factors:**
1. Leverage existing patterns (status_config, audit_logs, RLS policies) — don't reinvent
2. Validate stock at both request and approval time — prevent race conditions
3. Use native PostgreSQL constraints for deletion protection — atomic and reliable
4. Extract context slider pattern from QmrlContextPanel — proven in production
5. Test with all 7 user roles during integration phase — permission matrix is complex

**Risk Level:** LOW — All features extend proven patterns; no paradigm shifts; no new dependencies; clear integration points; high research confidence.
