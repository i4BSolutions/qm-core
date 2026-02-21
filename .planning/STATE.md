# State: QM System

**Last Updated:** 2026-02-21 (63-02 complete)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** v1.13 Auto Status — Phase 63 complete (QMHQ Auto Status: utility, badge, and detail page integration)

---

## Current Position

Phase: 63 of 64 (QMHQ Auto Status)
Plan: 02 — COMPLETE
Status: Phase 63 COMPLETE — auto status utility, badge component, and detail page integration shipped
Last activity: 2026-02-21 — Phase 63 plan 02 executed (QMHQ detail page auto status integration)

Progress: [█████████████████████░░] 60/64 phases complete

---

## Performance Metrics

**Codebase:**
- ~54,047 lines of TypeScript (+ role references removed/TODO'd)
- 78 database migrations (1 new: RLS permission matrix rewrite)
- 102 RLS policies across 25 tables (rewritten to use has_permission())

**Shipped Milestones:**
- 13 milestones shipped (v1.0 through v1.12)
- 60 phases, 150 plans total delivered

**v1.13 Scope:**
- 6 phases (59-64), phases 59+60+61 complete
- 24 requirements (11 PERM, 9 AUTO, 4 DASH)

---

## Accumulated Context

### Key Decisions from Phase 63 Plan 02

- **autoStatus useMemo before early returns** — React hooks rules require unconditional invocation; memo returns null when qmhq is null, satisfying the rules safely
- **Local moneyInEusd inside memo** — moneyInTotal is defined after early returns; memo computes locally from transactions state (already a dependency) to avoid restructuring the component
- **Badge ordering: route type -> auto status -> manual status** — makes it visually clear that auto status is computed (route property) while manual status is user-controlled
- **No permission gating on AutoStatusBadge** — all viewers of the detail page see it per user decision; no canEdit/canView check needed

### Key Decisions from Phase 63 Plan 01

- **iconName as string literal in QMHQ_AUTO_STATUS_CONFIG** — config stays JSON-serializable; icon resolved at render time via explicit ICON_MAP, not stored as component reference
- **computeQmhqAutoStatus switch uses never exhaustive check** — TypeScript will surface any future RouteType additions missing handler
- **getAutoStatusHexColor uses ?? fallback** — avoids falsy-string edge cases unlike || operator
- **AutoStatusBadge sm uses text-[11px]** — exact pixel value per design spec, not a Tailwind preset

### Key Decisions from Phase 62 Plan 02

- **canEdit("admin") covers all admin-page entities** — departments, contacts, suppliers, categories, statuses, standard-units, users all map to single admin resource
- **ClickableStatusBadge fixed** — canEdit(entityType as DbPermissionResource) replaces can("update", entityType) which was always false since Phase 60; all users can now click status badges if they have edit on qmrl/qmhq
- **SOR approve/execute restored** — canApprove = canEdit("sor_l1"), canExecute = canEdit("sor"); were hardcoded false since Phase 60
- **Server actions check user_permissions directly** — defense in depth beyond RLS; deactivate-user, reactivate-user, cancelPO, unlockClosedPO all return 403/error if caller lacks edit permission
- **UserRole type fully removed** — types/database.ts and types/index.ts cleaned up; local alias kept in use-permissions.ts for legacy permissionMatrix

### Key Decisions from Phase 62 Plan 01

- **Middleware fetches only matched resource's permission row** — not all 16 — to minimize DB round trips per request
- **system_dashboard block falls back to /qmrl** — avoids infinite redirect loop if /dashboard itself is blocked
- **admin/flow-tracking requires level === 'edit'** — view-only admin access is insufficient for flow tracking operations
- **ROUTE_RESOURCE_MAP placed in use-permissions.ts** — exported for Plan 02 client-side guards to reuse without importing server-only modules

### Key Decisions from Phase 61 Plan 02

- **Partial<Record<...>> accepted by PermissionMatrix** — widened props to allow partial records in create mode; no type cast needed in user-dialog.tsx
- **configuredCount < 16 gates the Create button** — enforces PERM-03 at UI layer before any API call
- **deleteUser rollback on permission upsert failure** — maintains atomicity for PERM-03; user without explicit permissions cannot exist
- **Backward-compatible API** — omitting permissions in request body skips upsert (trigger default Block values stand), enabling safe future callers

### Key Decisions from Phase 61 Plan 01

- **user_permissions table added to Database type** — `types/database.ts` now includes full Row/Insert/Update types and `permission_resource`/`permission_level` enums, enabling typed Supabase client access from the UI
- **Dialog modal (700px) for permissions UI** — no dedicated `/admin/users/[id]` page exists; modal is the equivalent of a "Permissions tab" as noted in the plan objective
- **window.confirm() for Set All** — keeps component complexity minimal; matches existing pattern in codebase (reactivate confirmation)
- **Atomic upsert for all 16 rows** — `onConflict: 'user_id,resource'` ensures idempotent save regardless of existing state

### Key Decisions for v1.13

- Permission matrix is per-user per-resource (16 resources, updated from 15), not role-based groups
- Edit = CRUD, View = read-only, Block = no access
- Admin lockout prevention: admin cannot remove their own Admin resource Edit permission
- Auto status is computed (VIEW or trigger), not stored — derived from child record state
- Dashboard becomes a QMRL list; all existing KPI sections removed entirely
- Phase 60 (RLS rewrite) is the heaviest lift — 100 policies across 22 tables

### Key Decisions from Phase 59

- **users.role column preserved in Phase 59** — NOT dropped until Phase 60 rewrites 100+ RLS policies. Dropping now would break all authorization.
- **Fail-closed default**: missing permission row = block, not an error. Both `check_user_permission()` and `has_permission()` implement this.
- **has_permission(resource, level)** function created for Phase 60 RLS use — takes auth.uid() automatically
- **check_user_permission(user_id, resource)** function for server-side/admin queries
- **create_default_permissions(user_id)** is idempotent (ON CONFLICT DO NOTHING)
- **Inactive users** get all-block permissions for referential integrity
- **Validation block** in data migration raises exception if any user has fewer than 16 rows

### Key Decisions from Phase 60

- **102 RLS policies** across 25 tables rewritten to use `has_permission(resource, level)`
- **Recursion-safe user_permissions policies**: use direct `EXISTS` subquery instead of `has_permission()` to avoid circular dependency
- **Cross-cutting tables** (file_attachments, comments) use `attachment_entity_resource()` and `comment_entity_resource()` IMMUTABLE helpers to map `entity_type` text to `permission_resource` enum
- **stock_out_approvals** uses OR across sor_l1/sor_l2/sor_l3 for SELECT/INSERT/UPDATE; DELETE is admin-only
- **users.role column, user_role enum, get_user_role() dropped** — all RLS now uses permission matrix
- **UserRole TypeScript type kept as deprecated alias** (string union) for Phase 62 compatibility — not removed to avoid 15+ compile errors
- **Frontend role checks disabled with TODO Phase 62** — useUserRole() returns null, middleware role guards commented out, role-based redirects removed

### Phase Dependency Order

```
59 (Schema) → 60 (RLS) → 62 (Frontend enforcement)
59 (Schema) → 61 (Permission UI)
58 (v1.12 done) → 63 (Auto Status)
60 + 61 + 63 → 64 (Dashboard)
```

Note: Phase 63 (Auto Status) can run in parallel with 60-62 if needed.

### Blockers

**None**

---

## Session Continuity

**What Just Happened:**
- Phase 63 Plan 02 executed: QMHQ detail page wired up with auto status computation and badge display
- autoStatus useMemo added before early returns in app/(dashboard)/qmhq/[id]/page.tsx
- All three route types handled: item (SOR approvals), expense (money-in/yet-to-receive), PO (non-cancelled PO + balance)
- AutoStatusBadge rendered in header between route type badge and ClickableStatusBadge
- Commits: 989334f (auto status computation), 91b1392 (badge in header)
- Phase 63 fully complete: utility + badge + detail page integration

**Context for Next Agent (Phase 64 Dashboard):**
- Phase 63 COMPLETE — all 9 auto status states visible on QMHQ detail pages
- lib/utils/qmhq-auto-status.ts, components/qmhq/auto-status-badge.tsx ready for any dashboard use
- Prerequisites for Phase 64: phases 60, 61, 63 all complete

**Resume at:** Phase 64 (Dashboard)

---

*State last updated: 2026-02-21 after Phase 63 Plan 01 complete*
