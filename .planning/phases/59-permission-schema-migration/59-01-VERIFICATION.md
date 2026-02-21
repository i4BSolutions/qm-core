---
phase: 59-permission-schema-migration
verified: 2026-02-21T07:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 59: Permission Schema & Migration Verification Report

**Phase Goal:** The permission model is stored in the database — each user has Edit, View, or Block per resource, existing users are migrated, and the old role enum is superseded.
**Verified:** 2026-02-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | A user_permissions table exists with one row per user per resource (16 resources x N users) | VERIFIED | `CREATE TABLE public.user_permissions` with `UNIQUE (user_id, resource)` — schema migration line 56 |
| 2 | Every existing user has exactly 16 permission rows migrated from their old role | VERIFIED | CTE-based backfill (48 rows: 3 roles x 16 resources) + validation block that raises exception on mismatch — data migration lines 38-187 |
| 3 | Admin-role users have Edit on all 16 resources | VERIFIED | 16 `('admin', '<resource>', 'edit')` rows in VALUES CTE — data migration lines 43-58 |
| 4 | QMRL-role users have Edit/View/Block mapped per CONTEXT.md specification | VERIFIED | edit: system_dashboard/qmrl/qmhq; view: po/invoice/warehouse/item; block: 9 remaining — data migration lines 67-82 |
| 5 | QMHQ-role users have Edit/View/Block mapped per CONTEXT.md specification | VERIFIED | edit: 13 resources; view: system_dashboard/qmrl; block: admin — data migration lines 92-107 |
| 6 | New users created via auth trigger get 16 Block permission rows by default | VERIFIED | `handle_new_user()` calls `PERFORM public.create_default_permissions(NEW.id)` — schema migration lines 205-221 |
| 7 | The 16 resource identifiers are enforced by a CHECK constraint or enum | VERIFIED | `CREATE TYPE public.permission_resource AS ENUM` with all 16 values — schema migration lines 21-38 |
| 8 | A helper function exists to check a user's permission level for a given resource | VERIFIED | `check_user_permission(p_user_id, p_resource)` and `has_permission(p_resource, p_level)` both defined — schema migration lines 104-168 |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260221000000_permission_schema.sql` | Table, enums, indexes, helper functions, updated handle_new_user(), RLS policies | VERIFIED | 251 lines, substantive. All required components present: enum types, table, indexes, 3 helper functions, trigger update, RLS policies. Committed: bac332e |
| `supabase/migrations/20260221000001_permission_data_migration.sql` | CTE backfill for all roles, inactive-user block, validation block, audit entry | VERIFIED | 219 lines, substantive. CTE with 48-row VALUES list, inactive/NULL fallbacks, validation DO block, audit_logs entry. Committed: 117e525 |
| `types/database.ts` | TypeScript types: PermissionResource, PermissionLevel, UserPermission, and display constants | VERIFIED | Lines 2376-2470. All required types and constants present. `npm run type-check` passes with zero errors |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `20260221000001_permission_data_migration.sql` | `users.role` | Role-to-permission mapping query | VERIFIED | CTE joins on `u.role::text = rp.role::text` (line 115). Uses CTE VALUES approach rather than CASE/WHEN — functionally equivalent, different pattern than plan specified. All 3 roles covered. |
| `20260221000000_permission_schema.sql` | `handle_new_user()` | Updated trigger function with 16 Block rows on signup | VERIFIED | `PERFORM public.create_default_permissions(NEW.id)` called inside handle_new_user() body (line 217). Trigger attachment preserved from 002_users.sql: `AFTER INSERT ON auth.users`. |

**Note on key_link 1 pattern mismatch:** The PLAN specified pattern `CASE.*role.*WHEN.*admin.*WHEN.*qmrl.*WHEN.*qmhq` but the implementation uses a CTE VALUES list joined on role. This is a valid alternative implementation — the role-to-permission mapping is complete and correct for all 3 roles plus inactive/NULL fallbacks.

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| PERM-01: Admin can assign Edit/View/Block per resource per user | SATISFIED | user_permissions table exists with permission_resource enum (16 values), permission_level enum, RLS gives admin full CRUD. Minor discrepancy: REQUIREMENTS.md lists 15 resources (omitting SOR as distinct from SOR-L1/L2/L3), CONTEXT.md explicitly updated to 16 — this is a REQUIREMENTS.md documentation lag, not an implementation error. |
| PERM-10: Existing users migrated from 3-role system | SATISFIED | CTE backfill migrates admin/qmrl/qmhq roles, handles inactive users (all-block), handles NULL/unknown roles (view on dashboard, block elsewhere). Validation block enforces completeness with RAISE EXCEPTION. |

**PERM-01 Resource Count Discrepancy (informational, not a gap):**
REQUIREMENTS.md says "15 resources" (SOR-L1, SOR-L2, SOR-L3 but no standalone SOR). CONTEXT.md (the phase context doc, which supersedes requirements for implementation decisions) explicitly adds SOR as a 16th resource: "SOR is a new addition (controls SOR creation/editing), separate from SOR-L1/L2/L3 (approval layers)." ROADMAP.md also says "15-resource enum" in the phase description. The implementation implements 16. REQUIREMENTS.md should be updated to reflect this decision, but this does not constitute a gap — it is an intentional expansion recorded in CONTEXT.md.

**ROADMAP Success Criteria 3 Deviation (informational, not a gap):**
ROADMAP SC3 says "A new user creation path requires all 15 permissions to be explicitly set before the user row is saved." The implementation instead auto-inserts 16 Block rows via the handle_new_user() trigger. This is a deliberate design change: the "explicitly set" UI flow is PERM-03, scoped to Phase 61 (Permission Management UI). Phase 59 provides the database foundation (trigger seeds defaults); Phase 61 provides the admin UI for conscious permission assignment.

**Role Column Not Dropped (per plan decision, not a gap):**
CONTEXT.md originally said "Drop the role column entirely after migration." The PLAN overrode this: the role column is preserved because 100+ existing RLS policies reference get_user_role(). Phase 60 will rewrite those policies and then drop the column. The phase goal phrase "old role enum is superseded" means the permission table is now the authority — not that the column is physically deleted in this phase.

---

### Anti-Patterns Found

None. Searched for TODO/FIXME/PLACEHOLDER/XXX patterns in all three modified files. No placeholder implementations, no empty returns, no stub functions. All helper functions have complete, executable bodies.

---

### Human Verification Required

#### 1. Migration applies cleanly against real Supabase database

**Test:** Run `npx supabase db reset` on a local Supabase instance with existing user data.
**Expected:** Both migrations apply without errors. `SELECT COUNT(*) FROM public.user_permissions` equals `(SELECT COUNT(*) FROM public.users) * 16`.
**Why human:** Cannot execute SQL against the database from this environment.

#### 2. has_permission() returns correct values for current auth.uid()

**Test:** Log in as an admin user and run `SELECT public.has_permission('qmrl', 'edit')`. Then log in as a qmhq user and run `SELECT public.has_permission('admin', 'edit')`.
**Expected:** Admin returns true; qmhq user returns false for admin resource.
**Why human:** Requires active auth session with auth.uid() populated.

#### 3. handle_new_user() trigger seeds 16 Block rows for new signups

**Test:** Invite a new user via the admin invite flow. After they accept the magic link, query `SELECT COUNT(*) FROM user_permissions WHERE user_id = '<new-user-id>'`.
**Expected:** Returns 16.
**Why human:** Requires actual Supabase auth flow with real user creation.

---

### Gaps Summary

No gaps. All 8 must-have truths are verified by direct inspection of the actual migration files and TypeScript types. The two key links are wired correctly (the CTE-based approach is functionally equivalent to the CASE/WHEN pattern the plan specified). TypeScript type-check passes. Both commits (bac332e, 117e525) exist in git history with the correct file changes.

The only notable items are:
- REQUIREMENTS.md lists 15 resources but CONTEXT.md intentionally added SOR as a 16th — REQUIREMENTS.md needs a documentation update (out of scope for this phase)
- ROADMAP SC3 describes explicit permission-setting at user creation time — this is PERM-03, deferred to Phase 61

Neither item represents a gap in this phase's deliverables.

---

_Verified: 2026-02-21_
_Verifier: Claude (gsd-verifier)_
