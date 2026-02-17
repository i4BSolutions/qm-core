# Project Research Summary

**Project:** QM System v1.12 — List Views & Approval Workflow
**Domain:** Internal Procurement & Inventory Management — UI Standardization and Workflow Enhancement
**Researched:** 2026-02-17
**Confidence:** HIGH

## Executive Summary

QM System v1.12 is a targeted enhancement milestone for an existing, mature internal tool — not a greenfield build. The codebase already implements card views, a single-layer stock-out approval workflow, an audit history tab with `changed_by_name` cached text, and a fully-built `Pagination` component adopted on five of six list pages. The milestone's job is to close specific gaps: add a list view to QMRL (the only major list page missing one), complete the two-layer approval architecture for stock-out requests with a dedicated execute route, ship a shared `UserAvatar` component, standardize pagination on the stock-out-requests list page, and surface user identity visually in history entries. Every required capability either already exists or requires only one new dependency: `boring-avatars@^2.0.4`.

The recommended implementation approach flows from a single dependency rule: the `UserAvatar` component is foundational and must ship alongside the database migration. History avatars and list-view user columns both depend on it. The two-layer approval schema migration (`063_two_layer_approval.sql`) must precede all UI changes to the approval dialogs. Everything else — QMRL list view, SOR pagination, history avatar — can proceed in parallel once these two anchors are in place. The architecture is already well-structured for these additions; no architectural pivots are required.

The most dangerous risk in this milestone is the two-layer approval state machine migration. Existing `stock_out_approvals` records must be classified and backfilled atomically in the same migration that adds the new schema — failing to do this allows old approval records to silently bypass the new warehouse-assignment gate. A secondary risk is the client-side pagination pattern currently using `.limit(100)` in multiple list pages; copying this pattern to the stock-out-requests page without fixing the fetch architecture propagates a silent data-truncation bug. Both risks are entirely avoidable with disciplined migration sequencing and fetch architecture correction.

---

## Key Findings

### Recommended Stack

One new dependency is warranted for this milestone: `boring-avatars@^2.0.4`. It generates deterministic, colorful SVG avatars from a user's name string — no storage, no network call, no backend dependency. It is a single React component (`<Avatar name="..." variant="beam" />`), ships ESM + CJS, renders pure JSX/SVG with no browser globals, and is SSR-safe in Next.js App Router. All other milestone capabilities use existing packages already in the codebase.

**Core technologies:**
- `boring-avatars@^2.0.4` (NEW): Auto-generated user avatars — single React component, deterministic SVG from name string, no storage cost, SSR-safe, 158K weekly downloads, 10K+ GitHub stars
- Existing `Pagination` (`/components/ui/pagination.tsx`): Already fully implemented with page size selector, ellipsis, first/last/prev/next — needs wiring into SOR list only; no reinstall
- Existing `@tanstack/react-table@^8.21.3`: Already installed; available for `ListViewTable` column definitions without new installation
- PostgreSQL additive migrations: Two-layer approval schema via nullable column addition and `ADD VALUE IF NOT EXISTS` for new enum state — no data loss, backward compatible with existing approval records

**Why NOT alternatives:**
- `@dicebear/core` + style packages: Two packages required; imperative JS API (not a React component); more setup for identical SVG output
- External avatar URL service (UI Avatars, Gravatar): Network dependency per render, API availability risk; sends usernames to external server
- `XState` for approval state machine: Frontend state machines are unnecessary when PostgreSQL triggers enforce state at the database level; application-layer FSM can be bypassed
- `react-paginate`: Redundant — identical pagination component already exists at `/components/ui/pagination.tsx`

### Expected Features

**Must have (table stakes):**
- `UserAvatar` component with initials fallback and deterministic color-per-name — foundational for all user-identity features; currently no shared component exists; avatar logic is duplicated across three-plus files with incompatible styles
- QMRL list view (card/list toggle matching QMHQ/PO/Invoice pattern) — QMRL is the primary entity; its list page is the only major page missing a list view; the gap is visible to every user
- SOR list pagination — the stock-out-requests page renders all records with no Pagination import; performance degrades with volume; renders all records in table view unconditionally
- Two-layer approval hard cap — current `ApprovalDialog` shows only a soft `showStockWarning` that does NOT prevent submission when approved quantity exceeds available warehouse stock; creates phantom pending transactions
- History tab: avatar circle next to `changed_by_name` for every audit entry — history currently shows plain text only; no visual user identity

**Should have (differentiators):**
- Column sorting on list views via client-side `useMemo` — adds scan efficiency for power users once list views are stable; no new dependency required
- View mode persistence in `localStorage` — low-effort quality-of-life improvement; remembered preference across navigation
- `usePagination` shared hook at `/lib/hooks/use-pagination.ts` — reduces boilerplate if two or more new pages need identical pagination state

**Defer (v2+):**
- Avatar upload flow — requires Supabase Storage bucket, upload UI, cropping, admin tooling; not warranted for ~10-50 internal users
- Server-side pagination — only required if per-entity record counts exceed 500+; current volumes do not justify the complexity
- History entry user filter or pagination — applicable only when entities accumulate 100+ history entries
- Partial approval across multiple warehouses for a single line item — requires significant schema change; one line item fulfilled from multiple warehouses; out of scope unless explicitly requested

### Architecture Approach

The existing architecture is well-suited for all milestone features. The system uses a layered structure: Next.js App Router pages own data fetching, composite components (`CardViewGrid`, `FilterBar`, `PageHeader`) handle layout, and Supabase PostgREST handles all data mutations via client-side calls with PostgreSQL triggers enforcing business rules at the database level. The milestone follows the same model without pivots. New `UserAvatar` lands in `/components/ui/`, new `ListViewTable` lands in `/components/composite/`, new `ApprovalLayer2Dialog` lands in `/components/stock-out-requests/`, and the execute route lands under `/app/(dashboard)/inventory/stock-out-requests/[id]/execute/`.

**Major components:**
1. `UserAvatar` (`components/ui/user-avatar.tsx`) — Shared initials plus deterministic color avatar; accepts `fullName: string`, optionally `avatarUrl?: string | null`; data-passive by design (no internal fetch); `size` prop covers `sm`, `md`, `lg` contexts
2. `ListViewTable` (`components/composite/list-view-table.tsx`) — Typed, sortable, onClick-navigable list view table; composes existing `Pagination` at the bottom; replaces per-page inline `<table>` blocks; uses `useRouter().push()` not `window.location.href`
3. `ApprovalLayer2Dialog` (`components/stock-out-requests/approval-layer2-dialog.tsx`) — Admin-only Layer 2 confirmation dialog; reads Layer 1 approval details (qty and warehouse, read-only); captures final admin decision; separate file from `approval-dialog.tsx` to avoid conditional complexity
4. Migration `063_two_layer_approval.sql` — Adds `layer TEXT CHECK (layer IN ('quartermaster', 'admin'))` and `parent_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL` to `stock_out_approvals`; adds `awaiting_admin` to `sor_line_item_status` enum; rewrites `update_line_item_status_on_approval()` trigger to gate line item promotion on `layer = 'admin'` only; updates `sor_approval_insert` RLS to allow quartermasters on Layer 1
5. Execute page (`/inventory/stock-out-requests/[id]/execute/page.tsx`) — Dedicated route for inventory team to execute Layer-2-approved transactions; replaces the inline Execute button in the detail page; reuses `BroadcastChannel("qm-stock-out-execution")` pattern from existing detail page

### Critical Pitfalls

1. **State machine migration without data backfill** — Adding the warehouse/two-layer approval schema leaves existing `approved` records with `layer = NULL` (or defaulting to `'admin'`). Without backfill, old single-layer approvals either bypass the new gate or get blocked incorrectly. Prevention: in migration `063`, write explicit SQL to update all existing `approved` records with `layer = 'admin'` (treating them as already having passed both layers), then add the new constraint. Run verification query (`COUNT of records where decision = 'approved' AND layer IS NULL`) before committing.

2. **Updating enum without updating the transition trigger** — `ALTER TYPE sor_line_item_status ADD VALUE IF NOT EXISTS 'awaiting_admin'` succeeds silently. But `validate_sor_line_item_status_transition()` in migration 053 has a static allowlist that does not include `awaiting_admin`. All new-flow transitions immediately raise exceptions. Prevention: use `CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()` in migration `063` — same function name, new body — which includes the layer check and the `awaiting_admin` intermediate status. New migration, not edit of old migration file.

3. **Row-lock deadlock from competing approval triggers** — Migration 059 uses `SELECT ... FOR UPDATE` on `stock_out_requests` inside `compute_sor_request_status()`. Adding a second trigger chain (Layer 2 insert → line item status → request status rollup) creates a second path to the same row lock. Two concurrent approvals on different line items of the same request deadlock. Prevention: use the advisory lock pattern from migration 058 (`pg_advisory_xact_lock(hashtext(request_id::text))`) exclusively in all new trigger functions; do not add another `FOR UPDATE` on `stock_out_requests`.

4. **Client-side pagination copying the `.limit(100)` pattern** — Multiple existing list pages fetch with `.limit(100)` then slice client-side for pagination display. `totalItems` is capped at the limit regardless of actual database count. Copying this pattern to SOR list propagates the silent truncation bug to another page. Prevention: for SOR list, use Supabase `{ count: 'exact' }` plus `.range(from, to)` before adding the `Pagination` component. Fix the fetch architecture first; then wire the component.

5. **Avatar component with internal user fetch causing N+1 queries** — A `<UserAvatar userId={...} />` that fetches user data independently fires one Supabase query per avatar per row on list pages (20 rows = 20 queries; connection pool saturation). Prevention: design `UserAvatar` as data-passive — it accepts `fullName: string` only, with no internal fetch. For list rows, join user data in the main list query. For history tab, use the cached `changed_by_name` text directly — no additional query needed.

---

## Implications for Roadmap

Based on research, suggested phase structure with 4 phases ordered by dependency chain:

### Phase 1: Database Foundation and UserAvatar Component
**Rationale:** The two-layer approval migration has no UI prerequisites and must be the first artifact deployed — every subsequent approval UI change depends on the `layer` column and `awaiting_admin` enum value existing in the database. `UserAvatar` also has no dependencies and can be built in the same phase. Shipping both here unblocks all downstream work.
**Delivers:** Migration `063_two_layer_approval.sql` (schema additions, trigger rewrite, RLS update, enum extension, backfill of existing records); `UserAvatar` component at `/components/ui/user-avatar.tsx`; `APP_AVATAR_PALETTE` constant at `/lib/constants/avatars.ts`; `boring-avatars` package installed
**Addresses:** Two-layer approval schema (FEATURES.md P1); user avatar foundation (FEATURES.md P1); boring-avatars installation (STACK.md)
**Avoids:** Deadlock risk — choose advisory lock pattern here before writing any trigger code (PITFALLS.md Pitfall 3); state machine backfill — explicit backfill SQL must be in migration `063`, not a follow-up (PITFALLS.md Pitfall 1)

### Phase 2: List View Standardization
**Rationale:** List view work is fully independent of the two-layer approval UI changes. It only needs `UserAvatar` from Phase 1 for user chips in list columns. The QMRL list view and SOR pagination fix are both visible gaps. This phase closes the asymmetry between QMRL (card-only) and all other major entities (card + list).
**Delivers:** `ListViewTable` composite component at `/components/composite/list-view-table.tsx`; QMRL page with card/list toggle and list view table; SOR list page with `Pagination` wired and server-side range + count fetch replacing the current fetch-all pattern; optional `usePagination` hook
**Addresses:** QMRL list view (FEATURES.md P1); SOR pagination (FEATURES.md P1); standardized list columns (FEATURES.md table stakes)
**Avoids:** Client-side pagination truncation — fix SOR fetch architecture before adding `Pagination` component (PITFALLS.md Pitfall 4); `window.location.href` anti-pattern — use `useRouter().push()` inside `ListViewTable` (ARCHITECTURE.md Anti-Pattern 3)

### Phase 3: Two-Layer Approval UI and Execute Route
**Rationale:** Schema from Phase 1 must be deployed and verified before this phase begins. This phase updates the approval dialogs, line item table, and detail page, and adds the dedicated execute route. The execute route replaces the inline Execute button in the existing detail page — a behavioral change that requires both Layer 1 and Layer 2 to be in place.
**Delivers:** Modified `approval-dialog.tsx` (Layer 1, Quartermaster-labeled, hard stock cap error); new `approval-layer2-dialog.tsx` (Layer 2, Admin-only, reads Layer 1 details as read-only); modified `line-item-table.tsx` (two-layer status column: Pending, Awaiting Admin Approval, Approved, Rejected); modified `stock-out-requests/[id]/page.tsx` (full two-layer approval flow with Layer 2 button for Admin); new execute page at `/inventory/stock-out-requests/[id]/execute/`
**Addresses:** Two-layer approval UI (FEATURES.md P1); execution page routing (ARCHITECTURE.md); hard cap enforcement replacing soft warning (FEATURES.md table stakes)
**Avoids:** Ambiguous pending state UX — use distinct badge labels ("Awaiting Qty Approval" vs "Awaiting Admin Approval") not a generic "Pending" badge (PITFALLS.md UX section); missing execute gate check — verify execute is blocked until both Layer 1 AND Layer 2 are in `approved` state (PITFALLS.md checklist)

### Phase 4: History Avatar and Consistency Polish
**Rationale:** This phase depends only on `UserAvatar` from Phase 1. It is last because it is pure UI polish with no behavioral gating. Shipping it after the approval workflow changes means the history tab will correctly display avatar-attributed entries for the new two-layer approval audit events as they begin to accumulate.
**Delivers:** Modified `history-tab.tsx` with `UserAvatar` displayed alongside `changed_by_name` in every `HistoryEntry`; `UserAvatar` applied to `comment-card.tsx` replacing the generic `<User>` icon; audit verification that Layer 1 and Layer 2 approval events appear in entity history with correct actor attribution
**Addresses:** Audit history user display (FEATURES.md P1); consistent avatar rollout across all user-reference contexts (PITFALLS.md UX section)
**Avoids:** N+1 user fetches in history tab — use cached `changed_by_name` text directly; no per-entry join to the users table (PITFALLS.md Pitfall 5); inconsistent avatar rollout — deploy to all callsites in one phase (FEATURES.md anti-features)

### Phase Ordering Rationale

- **Schema before UI**: The two-layer approval is a schema change that introduces new columns and enum values. No approval UI can reference `layer` or `awaiting_admin` until migration `063` is applied and verified. Phases 3 and 4 cannot start until Phase 1 is deployed to the target database.
- **UserAvatar before consumers**: `UserAvatar` is referenced in three subsequent deliverables (list-view user columns in Phase 2, approval actor display in Phase 3, history entries in Phase 4). Building it in Phase 1 allows Phases 2 through 4 to import it without blocking each other.
- **List view independent of approval UI**: The QMRL list view and SOR pagination are entirely independent of the approval workflow changes. Grouping them in Phase 2 creates a natural parallel track — a second engineer can work on Phase 2 while a first engineer works on Phase 3, with no merge conflicts.
- **Polish last**: History avatars add no new capability gating; they do not block any other feature. Shipping them last ensures the history tab shows accurate attribution for all the new events created by the two-layer approval flow.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (migration backfill)**: The exact backfill SQL for existing `stock_out_approvals` records depends on whether any SORs are currently in `approved` or `partially_approved` status in production at migration time. Run `SELECT status, COUNT(*) FROM stock_out_requests GROUP BY status` in production before finalizing migration `063`. If all SORs are in `executed` or `pending` state, the backfill collapses to a simple `UPDATE stock_out_approvals SET layer = 'admin' WHERE layer IS NULL AND decision = 'approved'`.
- **Phase 3 (execute page BroadcastChannel)**: The `BroadcastChannel("qm-stock-out-execution")` is already used in the detail page. The execute page may be open simultaneously with the detail page. Verify channel semantics: both pages should listen and react to execution completion events to keep status displays in sync without a full reload.

Phases with standard patterns (skip deeper research):
- **Phase 2 (list views)**: The QMHQ page (`app/(dashboard)/qmhq/page.tsx`) is a complete, proven reference for card/list toggle plus Pagination plus FilterBar. The QMRL list view is a direct port of this pattern. The PO page is a complete reference for list view column structure. No novel research required.
- **Phase 4 (history avatars)**: The change is minimal — wrap the existing `changed_by_name` span in `HistoryEntry` with `UserAvatar`. Pattern is fully documented in STACK.md integration points with before/after code.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings verified against actual codebase files. `boring-avatars` v2.0.4 confirmed via npm (158K weekly downloads, last published 4 months ago). All existing stack components read directly from source files. |
| Features | HIGH | All feature gaps verified by direct file inspection of `approval-dialog.tsx`, `history-tab.tsx`, `qmrl/page.tsx`, `stock-out-requests/page.tsx`, and `pagination.tsx`. No inference — every gap confirmed from code. |
| Architecture | HIGH | All integration points confirmed from direct codebase inspection (migrations 002, 025, 052-062; composite components; existing page patterns). Build order derived from actual dependency graph, not assumptions. |
| Pitfalls | HIGH | Pitfalls derived from actual codebase patterns: migration 059 `FOR UPDATE` lock identified as deadlock source; `.limit(100)` in `qmrl/page.tsx` line 76 identified as truncation source; soft warning in `approval-dialog.tsx` identified as hard-cap gap. Not from general principles alone. |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact backfill scope for two-layer migration**: Whether any SORs are in `approved` or `partially_approved` status at migration time affects the backfill complexity. Verify in production before finalizing migration `063`. If the gap is non-zero, the backfill needs to distinguish between in-progress approvals (which need a `qty_approved` state created) and completed executions (which need `layer = 'admin'` retroactively applied).
- **Client-side vs server-side pagination decision**: PITFALLS.md is clear that the `.limit(100)` pattern propagates a truncation bug and server-side range + count is the correct fix. ARCHITECTURE.md notes client-side pagination is appropriate for bounded SOR lists. Confirm with the team whether to apply the server-side fix to SOR only (scoped to this milestone) or to all list pages simultaneously. Doing all pages is more correct but widens scope.
- **boring-avatars SSR edge case**: SSR compatibility is confirmed from component analysis (pure JSX/SVG, no browser globals), but no official Vercel/Next.js SSR documentation was found for this library. If hydration mismatches occur in App Router, wrap avatar callsites in a `"use client"` boundary. The fix is well-understood and low-risk.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` — SOR table schemas; `stock_out_approvals` confirmed without `warehouse_id` or `layer` column
- `/home/yaungni/qm-core/supabase/migrations/058_advisory_lock_stock_validation.sql` — Advisory lock pattern; `hashtext()` key for deadlock-safe concurrency
- `/home/yaungni/qm-core/supabase/migrations/059_row_lock_status_aggregation.sql` — `FOR UPDATE` pattern identified as deadlock risk when combined with new trigger chains
- `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` — Confirmed soft warning (not hard error) on stock exceed; confirmed single-layer approval flow
- `/home/yaungni/qm-core/components/ui/pagination.tsx` — Full pagination component confirmed with all required props and page size selector
- `/home/yaungni/qm-core/components/history/history-tab.tsx` — Confirmed no avatar; confirmed `changed_by_name` cached field displayed as plain text only
- `/home/yaungni/qm-core/app/(dashboard)/qmrl/page.tsx` — Confirmed no `viewMode` state; no list view; `.limit(100)` + client-side slice pattern confirmed at line 76
- `/home/yaungni/qm-core/app/(dashboard)/inventory/stock-out-requests/page.tsx` — Confirmed no Pagination import; confirmed `window.location.href` row navigation anti-pattern
- `/home/yaungni/qm-core/app/(dashboard)/qmhq/page.tsx` and `/home/yaungni/qm-core/app/(dashboard)/po/page.tsx` — Reference patterns for card/list toggle, Pagination wiring, list view column structure
- `/home/yaungni/qm-core/types/database.ts` — `avatar_url: string | null` confirmed on users; `changed_by_name TEXT` confirmed in audit_logs
- `/home/yaungni/qm-core/.planning/PROJECT.md` — Milestone requirements
- `/home/yaungni/qm-core/package.json` — Current dependencies confirmed; `boring-avatars` absent; `@tanstack/react-table@^8.21.3` present

### Secondary (MEDIUM confidence — web research)
- [boring-avatars npm](https://www.npmjs.com/package/boring-avatars) — v2.0.4, 158K weekly downloads, last published 4 months ago
- [boring-avatars GitHub](https://github.com/boringdesigners/boring-avatars) — 10K+ stars; pure React SVG component confirmed; beam variant documented
- [DiceBear JS Library docs](https://www.dicebear.com/how-to-use/js-library/) — Two-package setup confirmed as basis for comparison; `@dicebear/core` + style package required

---
*Research completed: 2026-02-17*
*Ready for roadmap: yes*
