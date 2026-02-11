---
phase: 38
plan: 01
subsystem: rbac-infrastructure
tags: [rbac, typescript, permissions, navigation]
dependency_graph:
  requires: [phase-37-database-migration]
  provides: [3-role-typescript-types, 3-role-permission-matrix, 3-role-navigation]
  affects: [all-page-components, auth-provider]
tech_stack:
  added: []
  patterns: [3-role-rbac, permission-matrix, role-based-navigation]
key_files:
  created: []
  modified:
    - types/database.ts
    - lib/hooks/use-permissions.ts
    - components/layout/sidebar.tsx
decisions:
  - "UserRole enum reduced from 7 roles to 3: admin, qmrl, qmhq"
  - "Permission matrix restructured for 15 resources x 3 roles"
  - "QMRL users restricted from QMHQ routes (RBAC-07 enforcement)"
  - "Inventory nav item restricted to admin only (QMHQ accesses via direct URL)"
metrics:
  duration_seconds: 162
  tasks_completed: 2
  files_modified: 3
  lines_changed: ~200
  commits: 2
completed_date: 2026-02-11
---

# Phase 38 Plan 01: RBAC Infrastructure Update Summary

**One-liner:** Updated TypeScript types, permission matrix, and navigation infrastructure to enforce 3-role RBAC model (admin, qmrl, qmhq)

## Overview

Replaced the legacy 7-role permission system with the 3-role model established by Phase 37's database migration. This plan updated the core RBAC infrastructure files that all page-level permission checks depend on.

## Tasks Completed

### Task 1: Update TypeScript types and permission infrastructure
**Commit:** `77e8a63`
**Files:** `types/database.ts`, `lib/hooks/use-permissions.ts`

**Changes:**
1. **types/database.ts** - Reduced `user_role` enum from 7 roles to 3:
   ```typescript
   user_role: "admin" | "qmrl" | "qmhq"
   ```

2. **lib/hooks/use-permissions.ts**:
   - Updated permission matrix comment to reflect 3-role model
   - Replaced `permissionMatrix` object: 15 resources x 3 roles (removed 4 old roles per resource)
   - Updated `roleNavigation`: 3 role keys instead of 7
     - `admin`: All routes including /admin
     - `qmrl`: /dashboard, /qmrl, /item (NO /qmhq, /po, /invoice, /inventory per RBAC-07)
     - `qmhq`: /dashboard, /qmrl, /qmhq, /po, /invoice, /inventory/stock-out-requests, /warehouse, /item
   - Updated `usePermissions()` hook return: replaced 7 role booleans with 3 (isAdmin, isQmrl, isQmhq)

**Permission Matrix Mapping:**
| Resource | Admin | QMRL | QMHQ |
|----------|-------|------|------|
| users | CRUD | - | - |
| qmrl | CRUD | CRU | R |
| qmhq | CRUD | - | CRUD |
| financial_transactions | CRUD | - | CRUD |
| inventory_transactions | CRUD | - | R |
| purchase_orders | CRUD | - | CRUD |
| invoices | CRUD | - | CRUD |
| items | CRUD | R | RU |
| warehouses | CRUD | R | RU |
| suppliers | CRUD | R | CRUD |
| contact_persons | CRUD | CRU | CRUD |
| departments | CRUD | R | R |
| categories | CRUD | R | CR |
| statuses | CRUD | R | CR |
| stock_out_requests | CRUD | R | CR |

### Task 2: Update sidebar navigation role arrays
**Commit:** `78fd5fe`
**Files:** `components/layout/sidebar.tsx`

**Changes:**
Updated `allNavigation` array role restrictions:
- **QMHQ**: Added `roles: ["admin", "qmhq"]` (RBAC-07: hide from QMRL users)
- **Purchase Orders**: Changed from 4 roles to `["admin", "qmhq"]`
- **Invoices**: Changed from 5 roles to `["admin", "qmhq"]`
- **Inventory**: Changed from 3 roles to `["admin"]` (admin-only nav item)
- **Warehouses**: Changed from 4 roles to `["admin", "qmhq"]`
- **Dashboard, QMRL, Items**: No roles (visible to all authenticated users)
- **Admin section**: Kept `["admin"]` (unchanged)

**Navigation Visibility:**
- **QMRL users see:** Dashboard, QMRL, Items (NO QMHQ link)
- **QMHQ users see:** Dashboard, QMRL, QMHQ, Purchase Orders, Invoices, Warehouses, Items
- **Admin sees:** All including Admin section

## Verification Results

✅ **All verification criteria passed:**

1. `npm run type-check` - Infrastructure files are type-safe (other files have expected errors for Plan 02)
2. Old role references removed:
   - `grep -c "quartermaster|frontline|requester|\"finance\"|\"inventory\"|\"proposal\"" [files]` → 0
3. Permission matrix has exactly 15 resources, each with exactly 3 roles
4. roleNavigation has exactly 3 keys (admin, qmrl, qmhq)
5. QMRL roleNavigation includes /qmrl but NOT /qmhq, /po, /invoice, /inventory ✅
6. QMHQ roleNavigation includes /qmrl, /qmhq, /po, /invoice but NOT /inventory ✅

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **RBAC-07 enforcement**: QMRL users are completely blocked from QMHQ routes at navigation level. Server-side guards (Plan 02) will enforce for direct URL access.

2. **Inventory nav restriction**: Changed from `["admin", "quartermaster", "inventory"]` to `["admin"]` only. QMHQ users access stock-out-requests via direct URL in roleNavigation, but don't see Inventory dropdown.

3. **Permission matrix simplification**: Each resource now has exactly 3 role entries instead of 7, reducing complexity by ~57% (from 105 role-resource pairs to 45).

## Impact Analysis

**Breaking Changes:**
- Components using old role booleans (`isQuartermaster`, `isFinance`, etc.) will have TypeScript errors
- Components checking old role strings will have comparison errors
- Expected - Plan 02 will fix all page-level checks

**Non-Breaking:**
- Navigation filtering works immediately (users see correct nav items based on new roles)
- Permission checks using `can(action, resource)` work correctly for new roles
- Database already uses new roles (Phase 37 migration complete)

## Next Steps (Plan 02)

Plan 02 will update all page-level components:
1. Replace old role string comparisons with new role checks
2. Update permission guard patterns
3. Fix TypeScript errors in 7 page files
4. Update role display strings throughout UI

## Self-Check

Verifying created/modified files and commits:

**Files exist:**
```bash
[ -f "types/database.ts" ] && echo "✓ types/database.ts"
[ -f "lib/hooks/use-permissions.ts" ] && echo "✓ lib/hooks/use-permissions.ts"
[ -f "components/layout/sidebar.tsx" ] && echo "✓ components/layout/sidebar.tsx"
```
✓ types/database.ts
✓ lib/hooks/use-permissions.ts
✓ components/layout/sidebar.tsx

**Commits exist:**
```bash
git log --oneline --all | grep "77e8a63\|78fd5fe"
```
77e8a63 feat(38-01): update TypeScript types and permission infrastructure for 3-role RBAC
78fd5fe feat(38-01): update sidebar navigation for 3-role RBAC

## Self-Check: PASSED ✓

All files exist, all commits verified, all verification criteria met.
