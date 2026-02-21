# State: QM System

**Last Updated:** 2026-02-21 (59-01 complete)

---

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core Value:** Users can reliably create purchase orders, receive inventory, and track request status with full documentation and audit trails.

**Current Focus:** v1.13 Permission Matrix & Auto Status — Phase 59 complete, ready for Phase 60 (RLS Rewrite)

---

## Current Position

Phase: 59 of 64 (Permission Schema & Migration)
Plan: 01 — COMPLETE
Status: Phase 59 done — ready for Phase 60
Last activity: 2026-02-21 — Phase 59 plan 01 executed (permission schema + data migration)

Progress: [████████████████████░░░] 59/64 phases complete

---

## Performance Metrics

**Codebase:**
- ~54,047 lines of TypeScript (+ permission types added)
- 77 database migrations (2 new: permission schema + data backfill)
- 100 RLS policies across 22 tables (unchanged — Phase 60 will rewrite)

**Shipped Milestones:**
- 13 milestones shipped (v1.0 through v1.12)
- 59 phases, 147 plans total delivered

**v1.13 Scope:**
- 6 phases (59-64), phase 59 complete
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
- Phase 59 Plan 01 executed: created user_permissions table + permission_resource/level enums
- Data migration backfills all existing users with 16 permission rows based on role
- TypeScript types added: PermissionResource, PermissionLevel, UserPermission, PERMISSION_RESOURCES, PERMISSION_RESOURCE_LABELS, PERMISSION_LEVEL_LABELS
- Commits: bac332e (schema), 117e525 (data migration + types)

**Context for Next Agent (Phase 60 - RLS Rewrite):**
- `user_permissions` table exists with correct schema
- `has_permission(resource, level)` function available for RLS policies (reads auth.uid() automatically)
- Replace `get_user_role() = 'admin'` with `has_permission('admin', 'edit')`
- Replace role-based resource guards with `has_permission('<resource>', 'edit')` or `has_permission('<resource>', 'view')`
- After ALL RLS policies are rewritten, drop users.role column and user_role enum
- 100 policies across 22 tables need rewriting

**Resume at:** Phase 60 (RLS Rewrite)

---

*State last updated: 2026-02-21 after Phase 59 Plan 01 complete*
