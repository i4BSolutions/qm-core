# State: QM System

**Last Updated:** 2026-02-21 (60-01 complete)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** v1.13 Permission Matrix & Auto Status — Phase 60 complete, ready for Phase 61 (Permission UI)

---

## Current Position

Phase: 60 of 64 (RLS Policy Rewrite)
Plan: 01 — COMPLETE
Status: Phase 60 done — ready for Phase 61
Last activity: 2026-02-21 — Phase 60 plan 01 executed (RLS rewrite + role column drop)

Progress: [█████████████████████░░] 60/64 phases complete

---

## Performance Metrics

**Codebase:**
- ~54,047 lines of TypeScript (+ role references removed/TODO'd)
- 78 database migrations (1 new: RLS permission matrix rewrite)
- 102 RLS policies across 25 tables (rewritten to use has_permission())

**Shipped Milestones:**
- 13 milestones shipped (v1.0 through v1.12)
- 60 phases, 148 plans total delivered

**v1.13 Scope:**
- 6 phases (59-64), phases 59+60 complete
- 24 requirements (11 PERM, 9 AUTO, 4 DASH)

---

## Accumulated Context

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
- Phase 60 Plan 01 executed: complete RLS rewrite (102 policies), users.role column dropped
- Migration: 20260221100000_rls_permission_matrix_rewrite.sql (861 lines, wrapped in transaction)
- TypeScript User type cleaned of role field; 20+ frontend files updated with TODO Phase 62 markers
- Commits: 328e226 (migration), 2a1e206 (TypeScript types + frontend fixes)

**Context for Next Agent (Phase 61 - Permission Management UI):**
- `user_permissions` table exists with 16 rows per user
- All RLS now enforces via `has_permission(resource, level)` — no more role-based checks
- `UserRole` TypeScript type is now a deprecated alias — do not rely on it
- Frontend `useUserRole()` returns null — sidebar/header role display shows placeholder
- Admin-only routes rely on RLS enforcement (user_permissions table); frontend guards disabled until Phase 62

**Resume at:** Phase 61 (Permission Management UI)

---

*State last updated: 2026-02-21 after Phase 60 Plan 01 complete*
