---
status: resolved
trigger: "RBAC roles need to be tightened. QMRL role must have ZERO visibility into QMHQ. QMHQ role can CRUD QMHQ but child entities should only be viewable (read-only) within QMHQ detail page tabs."
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - all 5 areas identified and fixed
test: TypeScript type check passes, all changes applied
expecting: QMRL users have zero QMHQ visibility; QMHQ users have read-only child entity access
next_action: archive

## Symptoms

expected: |
  QMRL role: No access to QMHQ data anywhere (no tab, no RLS read)
  Sidebar: Dashboard, QMRL, Items only
  QMHQ role: Can CRUD QMHQ, can VIEW (read-only) transactions/POs/stock in detail tabs
  QMHQ sidebar: Dashboard, QMRL (read), QMHQ, Items only (no /po, /invoice, /inventory, /warehouse)

actual: |
  QMRL role: Can see QMHQ tab on QMRL detail page. RLS allows reading QMHQ data.
  QMHQ role: Has full CRUD on POs, Invoices, Transactions, Inventory. Can navigate to all standalone pages.

errors: No errors - this is RBAC tightening
reproduction: Log in as QMRL user -> see QMHQ tab on QMRL detail. Log in as QMHQ user -> navigate to /po or /invoice directly.
started: Since the 3-role system was implemented.

## Eliminated

(none - symptoms were clear and well-defined)

## Evidence

- timestamp: 2026-02-19T00:30:00Z
  checked: use-permissions.ts permission matrix
  found: |
    - financial_transactions: qmhq had ["create","read","update","delete"]
    - purchase_orders: qmhq had ["create","read","update","delete"]
    - invoices: qmhq had ["create","read","update","delete"]
    - warehouses: qmhq had ["read","update"]
    - suppliers: qmhq had ["create","read","update","delete"]
    - stock_out_requests: qmrl had ["read"], qmhq had ["create","read"]
    - roleNavigation for qmhq included /po, /invoice, /inventory/stock-out-requests, /warehouse
  implication: All these needed to be restricted to read-only for qmhq, removed from qmrl

- timestamp: 2026-02-19T00:35:00Z
  checked: sidebar.tsx nav items
  found: Purchase Orders, Invoices, Warehouses had roles ["admin","qmhq"] - wrong, should be admin only
  implication: qmhq users were seeing these nav items

- timestamp: 2026-02-19T00:40:00Z
  checked: qmrl/[id]/page.tsx
  found: |
    - QMHQ tab trigger was always visible (no permission check)
    - "Add QMHQ" button had no can("create","qmhq") guard
    - fetchQMRL always fetched QMHQ data regardless of user role
    - "Add Line" button in QMHQ tab had no guard
  implication: QMRL users saw QMHQ tab and fetch went through unchecked

- timestamp: 2026-02-19T00:45:00Z
  checked: qmhq/[id]/page.tsx
  found: |
    - "Add Transaction" button had no permission check
    - "Create PO" button had no permission check
  implication: QMHQ role users could create financial transactions and POs

- timestamp: 2026-02-19T00:50:00Z
  checked: supabase/migrations/20260211120001_rbac_rls_policy_recreation.sql
  found: |
    - qmhq_select uses USING (true) - ALL roles including qmrl can read QMHQ
    - financial_transactions: qmhq in INSERT/UPDATE/DELETE
    - purchase_orders: qmhq in INSERT/UPDATE/DELETE
    - invoices: qmhq in INSERT/UPDATE/DELETE
    - inventory_transactions: qmhq in INSERT/UPDATE/DELETE
  implication: RLS does not enforce any of the desired restrictions

- timestamp: 2026-02-19T00:55:00Z
  checked: lib/supabase/middleware.ts
  found: No role-based route protection - only authentication check
  implication: QMHQ users could navigate directly to /po, /invoice, /warehouse URLs

## Resolution

root_cause: |
  Five areas were not enforcing the 3-role RBAC restrictions:
  1. Permission matrix allowed qmhq CRUD on financial/inventory/PO/invoice resources
  2. Sidebar showed POs/Invoices/Warehouses to qmhq role users
  3. QMRL detail page showed QMHQ tab and fetched QMHQ data for all roles
  4. QMHQ detail page showed write action buttons without permission checks
  5. Middleware had no role-based route blocking (allowed direct URL navigation)
  6. RLS policy qmhq_select used USING(true) allowing qmrl to read QMHQ data

fix: |
  1. lib/hooks/use-permissions.ts: Downgraded qmhq role to read-only on financial_transactions,
     purchase_orders, invoices, inventory_transactions, warehouses, suppliers, stock_out_requests.
     Also removed qmrl read from stock_out_requests. Updated roleNavigation to remove
     /po, /invoice, /inventory/stock-out-requests, /warehouse from qmhq.
  2. components/layout/sidebar.tsx: Changed Purchase Orders, Invoices, Warehouses roles from
     ["admin","qmhq"] to ["admin"].
  3. app/(dashboard)/qmrl/[id]/page.tsx: Gated QMHQ tab behind can("read","qmhq"), gated
     "Add QMHQ" button behind can("create","qmhq"), skipped QMHQ data fetch for qmrl users,
     gated "Add Line" button in tab behind can("create","qmhq").
  4. app/(dashboard)/qmhq/[id]/page.tsx: Gated "Add Transaction" button behind
     can("create","financial_transactions"), gated "Create PO" button behind
     can("create","purchase_orders").
  5. lib/supabase/middleware.ts: Added ROLE_BLOCKED_ROUTES config and route protection logic
     redirecting blocked role+route combinations to /dashboard.
  6. supabase/migrations/20260219100000_rbac_role_restrictions.sql: New migration restricting
     qmhq_select to admin+qmhq only, and downgrading qmhq INSERT/UPDATE/DELETE access on
     financial_transactions, purchase_orders, po_line_items, invoices, invoice_line_items,
     inventory_transactions, stock_out_requests, stock_out_line_items, suppliers, warehouses.

verification: TypeScript type check passes (exit code 0). All 5 layers of RBAC enforcement applied.

files_changed:
  - lib/hooks/use-permissions.ts
  - components/layout/sidebar.tsx
  - app/(dashboard)/qmrl/[id]/page.tsx
  - app/(dashboard)/qmhq/[id]/page.tsx
  - lib/supabase/middleware.ts
  - supabase/migrations/20260219100000_rbac_role_restrictions.sql
