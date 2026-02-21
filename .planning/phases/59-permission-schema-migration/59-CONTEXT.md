# Phase 59: Permission Schema & Migration - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a `user_permissions` table with one row per user per resource (16 resources), migrate all existing users from the 3-role system (admin, qmrl, qmhq) to the new permission matrix, and drop the old role column. The 16 resources use Edit/View/Block access levels.

</domain>

<decisions>
## Implementation Decisions

### Resource List (16 resources, updated from original 15)
- System Dashboard, QMRL, QMHQ, Money Transactions, Inv Transactions, PO, Invoice, Stock In, SOR, SOR-L1, SOR-L2, SOR-L3, Warehouse, Inventory Dashboard, Item, Admin
- SOR is a new addition (controls SOR creation/editing), separate from SOR-L1/L2/L3 (approval layers)
- Resource identifiers codified as an enum or CHECK constraint (no free-text)

### Permission Levels
- Edit = full CRUD (approve/reject for SOR approval layers)
- View = read-only (can see but not act)
- Block = no access (hidden, no rows returned)
- A user can have Edit on multiple SOR layers simultaneously (no one-layer restriction)

### Role Migration Mapping
- **admin** → Edit on all 16 resources
- **qmrl** → Edit on QMRL, QMHQ, Dashboard. View on PO, Invoice, Item, Warehouse. Block on Admin, SOR layers, Stock In, Inv Transactions, Money Transactions, Inventory Dashboard, SOR
- **qmhq** → Edit on QMHQ, PO, Invoice, Money Txns, Stock In, Inv Txns, SOR, SOR-L1, SOR-L2, SOR-L3, Item, Warehouse, Inv Dashboard. View on QMRL, Dashboard. Block on Admin
- **Unknown/NULL role** → View on System Dashboard only, Block on everything else. Admin must explicitly grant permissions after migration

### Old Role Column
- Drop the `role` column entirely after migration — permissions are the sole authority
- Migration is one-way, no down-migration needed
- No backwards-compatibility shims

### New User Defaults
- All 16 permissions default to Block when creating a new user
- Admin must explicitly set each permission (copy-from-user shortcut deferred to Phase 61 UI)

### Database Enforcement
- Database-level enforcement: exactly 16 permission rows per user (trigger or constraint)
- Missing permission row = Block (fail closed, deny access)

### Claude's Discretion
- Whether to drop the role column in Phase 59 or defer to Phase 60 (safest approach given 100 RLS policies reference it)
- How to handle code references to user.role — clean up in this phase or leave for Phase 62
- Migration strategy for the role column drop (whether to stub broken RLS policies temporarily)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for permission table design and migration.

</specifics>

<deferred>
## Deferred Ideas

- Copy-from-user permission shortcut — Phase 61 (Permission Management UI)
- Permission templates/presets — listed as PERM-F02 in future requirements

</deferred>

---

*Phase: 59-permission-schema-migration*
*Context gathered: 2026-02-21*
