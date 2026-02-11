# Project Research Summary

**Project:** QM System v1.8 - UI/UX Standardization, Flow Tracking, RBAC Overhaul
**Domain:** Internal ticket, expense, and inventory management system
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

QM System v1.8 introduces three complementary features: UI component consistency audit/standardization, admin-only end-to-end flow tracking (QMRL→QMHQ→PO→Invoice→Stock), and RBAC simplification from 7 roles to 3 (Admin, QMRL, QMHQ). All three features integrate cleanly with the existing Next.js 14 + Supabase architecture without requiring major refactoring or new external dependencies.

**The recommended approach** is a phased rollout prioritizing non-breaking changes first. UI standardization leverages the existing shadcn/ui + Radix + Tailwind pattern already in place—no new libraries needed, just composition of reusable components from existing primitives. Flow tracking uses native PostgreSQL VIEWs (not complex graph libraries) since the data model is a linear chain, not a complex DAG. The RBAC migration is the most invasive change, requiring a PostgreSQL enum migration using the safe rename-create-migrate-drop pattern, followed by comprehensive RLS policy updates.

**Key risks:** (1) RBAC enum migration requires careful sequencing—PostgreSQL doesn't support dropping enum values directly, so we must use the expand-and-contract pattern with full verification before column swap. (2) RLS policy recreation must happen atomically to avoid windows where tables are unprotected or over-protected. (3) UI component refactoring can break working forms if not done incrementally with feature flags. All risks are mitigatable with proper testing, atomic transactions, and phased rollouts.

## Key Findings

### Recommended Stack

**Zero new dependencies required.** All three features can be implemented using the existing stack: Next.js 14, Supabase PostgreSQL, shadcn/ui components, Tailwind CSS, @tanstack/react-table, and react-hook-form.

**Core technologies (already in stack):**
- **PostgreSQL VIEWs** (not MATERIALIZED): Real-time flow tracking with 5-table JOIN across QMRL→QMHQ→PO→Invoice→Stock. Performance sufficient for admin-only access with proper indexing.
- **Native CSS + existing components**: Flow visualization as horizontal timeline/card layout using existing Card, Badge, ChevronRight icons—no React Flow, D3.js, or graph libraries needed.
- **PostgreSQL enum migration**: Safe rename-create-migrate-drop pattern for changing user_role from 7 values to 3 values without dropping references.
- **shadcn/ui + CVA pattern**: Already established—UI standardization is composition of existing primitives (Button, Input, Card, Badge), not new framework.

**Why no new libraries:**
- Flow tracking is a **linear chain**, not a complex node-graph requiring React Flow's dragging/zooming.
- UI primitives (Radix + Tailwind) already cover all standardization needs—creating reusable patterns, not importing new frameworks.
- RBAC migration uses raw SQL (safer than ORM for enum changes) and auto-generated TypeScript types from Supabase CLI.

### Expected Features

**Must have (table stakes for v1.8):**

*UI Standardization:*
- Consistent button styles, spacing, colors across all 54 page files
- Uniform form inputs (height, border, focus states)
- Standardized loading states (skeletons), empty states, error messages
- Icon usage consistency (Lucide throughout)

*Flow Tracking:*
- Search by QMRL ID → show full chain QMRL→QMHQ→PO→Invoice→Stock
- Status indicators at each level (QMRL status, QMHQ status, PO smart status)
- Route-specific downstream display (Item route shows stock-out, PO route shows invoices)
- Admin-only access (permission check + RLS policy)

*RBAC Consolidation:*
- 7 roles → 3 roles: Admin, QMRL, QMHQ
- Clear role mapping: (admin, quartermaster → Admin), (finance, inventory, proposal → QMHQ), (frontline, requester → QMRL)
- Migration preserves all existing user permissions
- Simplified permission matrix (36 sets vs 84 sets)

**Should have (competitive differentiators):**
- UI: Automated duplication detection (jscpd tool), component usage guidelines in docs
- Flow Tracking: Expandable/collapsible nodes, progress percentages, financial/inventory summaries
- RBAC: Role simulation for admins to test permissions before assigning

**Defer (v2+ enhancements):**
- UI: Visual regression testing (Percy/Chromatic), Storybook documentation, strict linting enforcement
- Flow Tracking: Interactive tree visualization with React Flow, real-time updates via WebSockets, historical snapshots
- RBAC: Granular permission overrides (attribute-based), temporary elevated access workflows

### Architecture Approach

**Integration with existing architecture:** All features extend current patterns without breaking changes. The system uses Next.js 14 Server Components with force-dynamic SSR, Supabase client for queries, and comprehensive RLS policies (132+ references across 62 migrations). New features integrate at three levels: database (VIEW + enum migration), middleware (role checks), and UI (component composition).

**Major components:**

1. **UI Standardization Layer** — Extract duplicate patterns into `/components/ui/composite/` (StatusBadge, AmountDisplay, EmptyState, FilterBar). Use existing Radix primitives + CVA for variants. Incremental migration with feature flags to avoid breaking working forms.

2. **Flow Tracking System** — PostgreSQL VIEW joining 5 tables (QMRL→QMHQ→PO→Invoice→Inventory). Server Component fetches data, Client Component renders card-based layout (not tree/graph—simpler for MVP). RLS policy restricts to admin-only. Indexes already exist on FK columns.

3. **RBAC Migration Pipeline** — Rename old enum to `user_role_old`, create new enum with 3 values, add temporary column, migrate data with CASE mapping, swap columns, drop old enum. RLS policies recreated atomically in same transaction. Frontend permission matrix simplified from 84 to 36 permission sets.

### Critical Pitfalls

1. **Enum Migration Without Data Remapping Strategy** — PostgreSQL doesn't support `ALTER TYPE ... DROP VALUE`. Must use expand-and-contract pattern: create new enum, add temp column, map old roles to new roles (quartermaster→admin, finance→qmhq, requester→qmrl), verify 100% coverage, swap columns, drop old enum. Skipping verification leaves users with invalid roles (locked out). **Solution:** Write mapping function, run verification query before swap, include rollback script.

2. **RLS Policy Cascade Failures After Role Change** — Recreating 132+ RLS policies without atomic transaction creates window where tables are unprotected (data breach) or over-protected (empty results). Dropping policies out of dependency order causes cascade delete conflicts with foreign keys. **Solution:** Single transaction: drop children first, recreate parents first, add verification query to ensure all RLS-enabled tables have policies.

3. **Flow Tracking Query Becomes N+1 Performance Nightmare** — Building UI with component-per-level data fetching creates 2000+ queries for 100 QMRLs with nested QMHQ/PO/Invoice. System already has N+1 patterns and force-dynamic (no caching). **Solution:** Single denormalized JOIN query fetching all data, client-side grouping, proper indexes on FK columns, pagination (20 QMRLs per page).

4. **Middleware Authorization Breaking on Deployment** — CVE-2025-29927 header injection bypass, session refresh race conditions, or Edge runtime incompatibilities cause random logouts or auth failures. Works locally, breaks in Vercel preview. **Solution:** Add `x-middleware-subrequest` header check, explicit session refresh, test in Vercel preview before production, monitor error logs.

5. **UI Standardization Breaking Working Pages** — Refactoring 50+ files with find-replace changes props, removes custom validation, breaks edge cases. Invoice form loses currency formatting, stock-out form loses warehouse filtering. **Solution:** Parallel implementation (FormInputV2), incremental migration with feature flags, scope boundaries (simple forms first, complex forms last), maintain API compatibility layer.

## Implications for Roadmap

Based on research, suggested phase structure with **minimal dependencies** and **incremental risk**:

### Phase 1: UI Component Standardization (Non-Breaking, Foundation)
**Rationale:** Establishes reusable patterns for Flow Tracking page and prepares consistent UI for RBAC role changes. No breaking changes—new components coexist with old patterns during migration. Reduces risk of compound failures by stabilizing UI foundation first.

**Delivers:**
- Reusable layout components (PageShell, FilterBar, DataTableShell)
- Composite components (StatusBadge, AmountDisplay, EmptyState, LoadingSkeleton)
- Component usage guidelines documentation
- 2-3 pilot pages migrated to validate patterns

**Addresses:**
- Feature: Consistent button styles, spacing, form inputs (table stakes)
- Architecture: Composition from existing Radix + CVA primitives
- Pitfall: "UI standardization breaking working pages" avoided via incremental approach with feature flags

**Avoids:**
- Find-replace refactoring across all 54 pages (high breakage risk)
- New UI framework overhead (leverages existing stack)

**Research Flag:** Standard patterns—no additional research needed. Well-documented component composition.

---

### Phase 2: RBAC Overhaul (Breaking Change, Maintenance Window)
**Rationale:** Must complete before Flow Tracking page (which uses admin-only check on new role system). Most invasive change—affects database enum, 132+ RLS policies, permission matrix, sidebar navigation. Requires maintenance window. Complete this before adding new admin features to avoid testing complexity.

**Delivers:**
- PostgreSQL enum migration (7 roles → 3 roles) with expand-and-contract pattern
- Updated RLS policies (atomic transaction, dependency-ordered recreation)
- Simplified permission matrix (84 → 36 sets)
- Sidebar navigation updated to new roles
- Role mapping verification: 100% users migrated correctly

**Uses:**
- Stack: PostgreSQL enum migration, Supabase RLS policies
- Pattern: Expand-and-contract (avoid unsafe DROP TYPE)

**Implements:**
- Architecture: RBAC Migration Pipeline with temp columns, mapping function, verification queries

**Addresses:**
- Feature: Clear role definitions, migration path for existing users (table stakes)
- Pitfall: "Enum migration without data remapping" avoided via verification queries
- Pitfall: "RLS policy cascade failures" avoided via atomic transaction + dependency ordering

**Avoids:**
- Unsafe `ALTER TYPE ... DROP VALUE` (PostgreSQL rejects)
- Non-atomic policy recreation (data breach window)

**Research Flag:** Needs testing—complex migration. Consider `/gsd:research-phase` for RLS policy dependency mapping if uncertainty arises during implementation.

---

### Phase 3: End-to-End Flow Tracking (Additive, Admin-Only)
**Rationale:** Depends on Phase 2 (uses new admin role check). Additive feature—doesn't touch existing pages, only creates new admin route. Low risk to existing functionality. Benefits from Phase 1 standardized components (StatusBadge, FilterBar).

**Delivers:**
- `/admin/flow-tracker` route with admin-only access
- PostgreSQL VIEW joining QMRL→QMHQ→PO→Invoice→Stock
- Card-based layout (not tree/graph) with route-specific downstream display
- Search by QMRL ID with status filters
- Performance validated with EXPLAIN ANALYZE (indexed JOINs)

**Uses:**
- Stack: PostgreSQL VIEW (not MATERIALIZED), existing Card/Badge/ChevronRight components
- Pattern: Single denormalized query, client-side grouping, pagination

**Implements:**
- Architecture: Flow Tracking System (Server Component query + Client Component layout)

**Addresses:**
- Feature: Search by QMRL ID, status indicators, route-specific display (table stakes)
- Pitfall: "N+1 query performance nightmare" avoided via single JOIN query + indexes
- Pitfall: "Materialized view without refresh" avoided by using regular VIEW (real-time data)

**Avoids:**
- React Flow library (300KB+ for simple linear chain)
- Component-per-level data fetching (N+1 queries)
- MATERIALIZED VIEW (adds refresh complexity for no benefit at current scale)

**Research Flag:** Standard patterns—JOIN query + card layout. No additional research needed unless performance issues arise (then consider `/gsd:research-phase` for query optimization).

---

### Phase 4: UI Consistency Rollout (Incremental, Low-Risk)
**Rationale:** Uses standardized components from Phase 1 to migrate remaining pages incrementally. Prioritizes simple pages first (low risk), complex forms last (high risk). Doesn't block Phases 2-3—can run in parallel with other work or post-v1.8.

**Delivers:**
- 80%+ pages migrated to standardized components
- Reduced duplicate code (improved bundle size)
- Consistent UX across all pages
- Feature flag removed after full validation

**Addresses:**
- Feature: Uniform spacing, consistent loading/empty states, standardized error messages (table stakes)
- Pitfall: "UI standardization breaking pages" avoided via scope boundaries (simple → complex) and feature flags

**Avoids:**
- All-at-once migration (high breakage risk)
- Breaking custom validation in complex forms (migration checklist includes validation transfer)

**Research Flag:** No research needed—uses patterns established in Phase 1.

---

### Phase Ordering Rationale

**Why this sequence:**
1. **Phase 1 first (UI patterns):** Non-breaking foundation. Creates reusable components for Phase 3 (Flow Tracking page). Validates composition approach before high-risk RBAC changes.
2. **Phase 2 second (RBAC):** Most invasive change—requires maintenance window. Must complete before Phase 3 (which uses new admin role). Separating from UI changes reduces compound failure risk.
3. **Phase 3 third (Flow Tracking):** Additive feature depending on Phase 2 admin role. Benefits from Phase 1 reusable components. No risk to existing pages.
4. **Phase 4 last (UI rollout):** Incremental cleanup. Can run in parallel with other work or defer to v1.9 if timeline tight.

**Why this grouping:**
- Phases 1+4 = UI consistency (can run together if using feature flags)
- Phase 2 = RBAC (isolated, breaking change)
- Phase 3 = Flow Tracking (isolated, additive)
- No circular dependencies—each phase builds on previous

**How this avoids pitfalls:**
- Enum migration completed (Phase 2) before adding admin features (Phase 3)—avoids testing new features with unstable role system
- UI patterns established (Phase 1) before building Flow Tracking page (Phase 3)—reuses components, consistent UX
- RLS policies stabilized (Phase 2) before incremental UI rollout (Phase 4)—reduces moving parts during testing

### Research Flags

**Needs deeper research during planning:**
- **Phase 2 (RBAC):** RLS policy dependency mapping if verification query reveals unexpected policy interdependencies. Consider `/gsd:research-phase` if policy recreation order is unclear.
- **Phase 3 (Flow Tracking):** Query optimization if EXPLAIN ANALYZE shows sequential scans or JOIN cost >1000. Consider `/gsd:research-phase` for materialized view strategy if performance unacceptable.

**Standard patterns (skip research-phase):**
- **Phase 1 (UI Standardization):** Well-documented component composition. Existing Radix + CVA pattern already proven.
- **Phase 4 (UI Rollout):** Uses Phase 1 patterns—no new unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Zero new dependencies. Verified existing Radix + Tailwind + PostgreSQL sufficient. No React Flow, D3.js, or new UI framework needed. |
| Features | **HIGH** | Clear table stakes identified from internal tools research. MVP scoped appropriately—defer complex visualizations and advanced RBAC to v2. |
| Architecture | **HIGH** | Existing Next.js 14 + Supabase patterns extend cleanly. PostgreSQL enum migration pattern well-documented (Supabase official docs). Flow tracking uses standard JOIN query (no exotic patterns). |
| Pitfalls | **MEDIUM-HIGH** | Enum migration risks well-understood (expand-and-contract pattern validated). RLS policy recreation requires careful sequencing but transaction boundary clear. Main uncertainty: production database scale (100K+ rows?) may affect query performance—verification needed during Phase 3. |

**Overall confidence:** HIGH

### Gaps to Address

**Database scale unknown:** Research assumes <10K QMRLs (regular VIEW sufficient). If production has 100K+ rows, Flow Tracking query may timeout—requires materialized view + refresh strategy. **Handle during Phase 3:** Add query performance testing with production-scale data before deploying.

**RLS policy interdependencies not mapped:** Migration assumes policies can be dropped/recreated in parent-first order, but foreign key cascades might conflict. **Handle during Phase 2:** Run dependency query to map actual policy relationships before writing migration script.

**Custom validation in forms not catalogued:** UI standardization assumes most validation is generic (required, min/max), but some forms may have complex business logic (exchange rate bounds, warehouse-item compatibility). **Handle during Phase 1:** Audit pilot pages for custom validation patterns, create migration checklist for Phase 4.

**Session refresh timing in production:** Middleware changes tested locally and Vercel preview, but production traffic patterns may reveal edge cases (multiple tabs, long-lived sessions). **Handle during Phase 2 rollout:** Monitor auth error rates for 24h after deployment, prepare rollback script.

## Sources

### Primary (HIGH confidence)
- [Supabase Enum Management](https://supabase.com/docs/guides/database/postgres/enums) — Official enum handling guidance, expand-and-contract pattern
- [PostgreSQL ALTER TYPE Documentation](https://www.postgresql.org/docs/current/sql-altertype.html) — Confirms enum value removal not supported
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS policy patterns and performance
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — Official App Router patterns
- [Querying Joins and Nested tables | Supabase Docs](https://supabase.com/docs/guides/database/joins-and-nesting) — Automatic join detection for flow tracking query

### Secondary (MEDIUM confidence)
- [CVE-2025-29927: Next.js Middleware Authorization Bypass](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) — Middleware security hardening
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) — Component composition patterns (existing pattern)
- [Design System Checklist | Figma](https://www.figma.com/community/file/875222888436956377/design-system-checklist) — UI audit methodology
- [Freshservice: Parent-Child ticket tracking](https://support.freshservice.com/support/solutions/articles/50000010738) — Flow tracking UI patterns
- [RBAC Implementation Best Practices](https://www.osohq.com/learn/rbac-best-practices) — Role consolidation strategies

### Tertiary (Context)
- QM System codebase: 54 page files, 25+ UI components, 69 client components, 62 database migrations, 132+ RLS policy references
- Existing architecture: Next.js 14 force-dynamic SSR, Supabase client, shadcn/ui + Radix + CVA pattern, @tanstack/react-table, react-hook-form
- Known concerns: N+1 query patterns, no pagination on large lists, force-dynamic on all pages (no caching)

---
*Research completed: 2026-02-11*
*Ready for roadmap: **yes***
*Next step: Orchestrator proceeds to requirements definition*
