# Phase 60: RLS Policy Rewrite - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all existing RLS policies across 22+ tables with permission-matrix-aware policies using the `has_permission()` function from Phase 59. Old role-based policies (get_user_role()) are completely removed. Edit=CRUD, View=read-only, Block=no access. Admin users retain full access.

</domain>

<decisions>
## Implementation Decisions

### Table-to-resource mapping
- Child tables inherit the parent's permission resource: po_line_items → 'po', invoice_line_items → 'invoice', qmhq_items → 'qmhq', stock_out_line_items → 'sor'
- Cross-cutting tables (file_attachments, comments, audit_logs) inherit the parent entity's permission — e.g., an attachment on a PO requires 'po' permission, a comment on QMRL requires 'qmrl' permission
- Reference/config tables (departments, status_config, categories, contact_persons, suppliers, standard_units, system_config) are universally readable by all authenticated users; only admin can write/edit
- 'users' table is controlled by the 'admin' resource — admin edit = manage all users
- 'user_permissions' table is admin-only for both read and write — users cannot read their own permission rows directly
- 'inventory_transactions' uses the single 'inv_transactions' resource regardless of transaction type (stock-in or stock-out)
- stock_out_approvals uses layer-specific permissions: sor_l1 edit = approve/reject L1 only, sor_l2 edit = L2 only, sor_l3 edit = L3 only. View on any layer = can see that layer's approvals.

### Own-records logic
- View = view ALL records for that resource, not just own records
- No per-record ownership filtering at the RLS level — the old "requester sees only their own QMRLs" pattern is removed
- Uniform model across all resources: Edit=CRUD all, View=read all, Block=nothing
- No exceptions for users table — even own profile access goes through the 'admin' resource permission

### Migration strategy
- Clean slate approach: DROP all existing policies on all tables, then CREATE fresh permission-matrix policies
- No verification block in the migration — keep it simple, verification through testing
- Migration file structure: Claude's discretion (single file vs grouped)
- Role column (users.role) and get_user_role(): Claude decides whether to drop in this phase or keep until Phase 62

### Service/system access
- All trigger functions should be SECURITY DEFINER to bypass RLS — triggers are internal operations that should always succeed
- service_role: Keep default RLS bypass, but add database-level guard functions that Edge Functions must call for permission enforcement
- has_permission() behavior when auth.uid() is null: Claude's discretion

### Claude's Discretion
- Migration file structure (single file vs grouped by domain)
- Whether to drop users.role and get_user_role() in this phase or defer
- has_permission() behavior when auth.uid() is null (service_role context)
- Exact policy naming conventions

</decisions>

<specifics>
## Specific Ideas

- Phase 59 summary confirms `has_permission(resource, level)` is ready — use it as the single authorization gate
- The pattern is: replace `get_user_role() = 'admin'` with `has_permission('admin', 'edit')` and role-based guards with resource-specific `has_permission()` calls
- Fail-closed: missing permission row = block (already implemented in has_permission())

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 60-rls-policy-rewrite*
*Context gathered: 2026-02-21*
