# Phase 38: RBAC Permission Enforcement - Research

**Researched:** 2026-02-11
**Domain:** Next.js 14 App Router permission enforcement, React role-based UI rendering, RLS policy alignment
**Confidence:** HIGH

## Summary

Phase 38 enforces the new 3-role RBAC system (`admin`, `qmrl`, `qmhq`) throughout the frontend application following Phase 37's database migration. The codebase already has permission infrastructure (`usePermissions()` hook, `canAccessRoute()` utility, role-based sidebar filtering) but uses the old 7-role enum values. This phase requires updating the permission matrix, navigation guards, and role-based UI conditionals to align with the new role system.

The current implementation already follows Next.js 14 App Router best practices: server-side redirects in page components (e.g., `/dashboard/page.tsx`), client-side permission checks via `usePermissions()` hook, and navigation filtering in the sidebar component. The migration path is straightforward: update the permission matrix in `/lib/hooks/use-permissions.ts`, update role checks in page components, and update the sidebar navigation configuration.

**Primary recommendation:** Update the existing permission infrastructure to use the new 3-role enum. Maintain the same access patterns (server-side redirects for page-level access, client-side `usePermissions()` for UI conditionals) but with simplified role checks. The Phase 37 verification report confirms all RLS policies already enforce the 3-role model at the database level, so frontend changes focus on UI/navigation alignment.

## Standard Stack

### Core (Already in Use)

| Library | Version | Purpose | Current Usage |
|---------|---------|---------|---------------|
| Next.js 14 | 14.x | App Router framework | Server components for page-level access control |
| React | 18.x | UI library | Client components with `usePermissions()` hook |
| TypeScript | 5.x | Type safety | UserRole type from database enum |
| Supabase Client | Latest | Database queries | Server actions fetch user role |

### Existing Permission Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| `usePermissions()` | `/lib/hooks/use-permissions.ts` | Client-side permission checks, returns `can()`, `canAny()`, role booleans |
| `canAccessRoute()` | `/lib/hooks/use-permissions.ts` | Route access validation by role |
| `roleNavigation` | `/lib/hooks/use-permissions.ts` | Role-to-routes mapping object |
| Permission matrix | `/lib/hooks/use-permissions.ts` | Resource-action-role permission definitions |
| Sidebar filtering | `/components/layout/sidebar.tsx` | Navigation items filtered by `item.roles` array |
| `useUserRole()` | `/components/providers/auth-provider.tsx` | Returns current user's role from context |

### No New Dependencies Required

This is a refactoring phase. All tools and patterns already exist - only role values need updating.

## Architecture Patterns

### Pattern 1: Server Component Page Guards (Currently Implemented)

**What:** Page components check user role server-side and redirect unauthorized users before rendering.

**Current implementation:** `/app/(dashboard)/dashboard/page.tsx`

```typescript
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  // OLD: Redirects non-admin/quartermaster users
  if (profile?.role && profile.role !== 'admin' && profile.role !== 'quartermaster') {
    const redirectTo = roleRedirectMap[profile.role] || '/qmrl';
    redirect(redirectTo);
  }
  // ... render dashboard
}
```

**Phase 38 update:** Change to 3-role checks

```typescript
// NEW: Redirect non-admin users (qmrl and qmhq go elsewhere)
if (profile?.role && profile.role !== 'admin') {
  const redirectTo = profile.role === 'qmhq' ? '/qmhq' : '/qmrl';
  redirect(redirectTo);
}
```

**When to use:** Every page that has role-specific access requirements. Server-side redirect prevents unauthorized page render entirely (no flash of content).

**Source:** [Next.js Authorization Guide](https://www.robinwieruch.de/next-authorization/) - Server Component pattern for route protection

### Pattern 2: Client Component Conditional Rendering (Currently Implemented)

**What:** Use `usePermissions()` hook to conditionally show/hide UI elements (buttons, sections, tabs) based on role and resource permissions.

**Current implementation:** `/app/(dashboard)/inventory/stock-out-requests/page.tsx`

```typescript
export default function StockOutRequestsPage() {
  const { can } = usePermissions();

  return (
    <>
      {can('create', 'stock_out_requests') && (
        <Button>
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      )}
    </>
  );
}
```

**Phase 38 update:** Permission matrix in `use-permissions.ts` updated to reflect new roles. The `can()` function continues to work - only the underlying matrix changes.

**When to use:** For fine-grained UI control within pages. Server component guards block page access; client hooks control buttons/forms/sections within accessible pages.

**Source:** [React Role-Based Access Control](https://www.permit.io/blog/implementing-react-rbac-authorization) - Pattern for permission-based component rendering

### Pattern 3: Navigation Sidebar Filtering (Currently Implemented)

**What:** Filter navigation menu items based on role arrays attached to each nav item.

**Current implementation:** `/components/layout/sidebar.tsx`

```typescript
const allNavigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "QMRL", href: "/qmrl", icon: FileText },
  { label: "QMHQ", href: "/qmhq", icon: ClipboardList },
  {
    label: "Purchase Orders",
    href: "/po",
    icon: ShoppingCart,
    roles: ["admin", "quartermaster", "finance", "proposal"], // OLD ROLES
  },
  // ...
];

const visibleNavigation = useMemo(() => {
  return allNavigation.filter((item) => {
    if (!item.roles) return true; // Show to everyone
    if (!userRole) return false;
    return item.roles.includes(userRole);
  });
}, [userRole]);
```

**Phase 38 update:** Update `roles` arrays to use new enum values

```typescript
{
  label: "Purchase Orders",
  href: "/po",
  icon: ShoppingCart,
  roles: ["admin", "qmhq"], // NEW ROLES
},
{
  label: "Inventory",
  icon: Package,
  roles: ["admin"], // Only admin can access inventory management
  children: [
    { label: "Dashboard", href: "/inventory" },
    { label: "Stock In", href: "/inventory/stock-in" },
    { label: "Stock Out", href: "/inventory/stock-out" },
    { label: "Stock-Out Requests", href: "/inventory/stock-out-requests" },
  ],
},
```

**Key insight:** Navigation filtering is **defensive** - it hides links but doesn't replace server-side guards. Determined users could still navigate directly via URL, so page-level checks remain critical.

### Pattern 4: Permission Matrix Resource Mapping (Currently Implemented)

**What:** Central permission matrix maps roles to actions on resources. Client code calls `can('create', 'qmrl')`, matrix returns true/false.

**Current implementation:** `/lib/hooks/use-permissions.ts` (lines 56-192)

```typescript
const permissionMatrix: PermissionMatrix = {
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"], // OLD
    finance: ["read"], // OLD
    inventory: ["read"], // OLD
    proposal: ["read", "update"], // OLD
    frontline: ["read", "update"], // OLD
    requester: ["create", "read"], // OLD
  },
  // ... 12 more resources
};
```

**Phase 38 update:** Replace 7 roles with 3 roles per Phase 37 mapping

```typescript
const permissionMatrix: PermissionMatrix = {
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["create", "read", "update"], // Merged frontline + requester
    qmhq: ["read"], // Merged finance + inventory + proposal
  },
  qmhq: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // View only, no creation
    qmhq: ["create", "read", "update", "delete"], // Full QMHQ operations
  },
  stock_out_requests: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // View own only (RLS handles own-only filter)
    qmhq: ["create", "read", "update"], // QMHQ creates/approves stock-out requests
  },
  // ... remaining resources
};
```

**Role mapping logic from Phase 37:**
- `admin`, `quartermaster` → `admin` (supervisory role)
- `finance`, `inventory`, `proposal` → `qmhq` (HQ operations)
- `frontline`, `requester` → `qmrl` (field operations)

**From requirements:**
- **RBAC-05:** QMRL role can create new QMRLs
- **RBAC-06:** QMRL role can view all QMRLs (read access)
- **RBAC-07:** QMRL role cannot access QMHQ, PO, Invoice, or Inventory pages
- **RBAC-08:** QMHQ role can create new QMHQs
- **RBAC-09:** QMHQ role can view all QMRLs (read-only)
- **RBAC-10:** QMHQ role can view all QMHQs and their details
- **RBAC-11:** QMHQ role can view financial transactions on QMHQs
- **RBAC-12:** QMHQ role can view stock levels per item/warehouse (summary only)
- **RBAC-13:** QMHQ role can view purchase orders and their details
- **RBAC-14:** Admin retains full CRUD access to all entities
- **RBAC-15:** Stock-out approvals remain Admin-only

### Pattern 5: RLS Policy Alignment (Already Complete)

**What:** Database-level Row Level Security policies enforce permissions regardless of frontend checks.

**Status:** Phase 37 completed all RLS updates. Phase 37 verification report confirms:
- 92 policies recreated across 20 tables
- All policies use new role values (`admin`, `qmrl`, `qmhq`)
- Stock-out request policies: Admin/QMHQ can see all, others see own (line 686-688 in migration 20260211120001)
- Stock-out UPDATE restricted to Admin only (line 697)

**Example from Phase 37:** `/supabase/migrations/20260211120001_rbac_rls_policy_recreation.sql`

```sql
-- QMRL table policies
CREATE POLICY qmrl_select ON public.qmrl
  FOR SELECT USING (true); -- All authenticated users can read

CREATE POLICY qmrl_insert ON public.qmrl
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmrl', 'qmhq')
  );

CREATE POLICY qmrl_update ON public.qmrl
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmrl', 'qmhq')
  );

-- Stock-out requests policies
CREATE POLICY sor_update ON public.stock_out_requests
  FOR UPDATE USING (
    public.get_user_role() = 'admin'  -- Admin-only approvals
    OR requester_id = auth.uid()      -- Users can update their own
  );
```

**Phase 38 responsibility:** Frontend must align with RLS policies. RLS is enforcement layer; frontend is UX layer (hide inaccessible features).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission checking | Custom role switch statements in every component | Centralized `usePermissions()` hook | Single source of truth, testable, DRY |
| Navigation filtering | Duplicate role checks in every nav item | Declarative `roles` array on nav items | Easier to audit, less error-prone |
| Route guards | Client-side only checks | Server Component redirects + client checks | Client checks are bypassable; server enforces |
| Role type definitions | String literals like `'admin'` | TypeScript `UserRole` enum from database types | Type safety, autocomplete, refactoring safety |

**Key insight:** Permission systems have two failure modes:
1. **Too permissive** - Security vulnerability (users access restricted data)
2. **Too restrictive** - Usability failure (authorized users blocked)

Centralized permission matrix + RLS policies minimize both risks. Frontend checks improve UX (hide unavailable features), database RLS enforces security (block unauthorized queries).

## Common Pitfalls

### Pitfall 1: Forgetting to Update roleNavigation Map

**What goes wrong:** Developer updates permission matrix but forgets `roleNavigation` object in `use-permissions.ts` (lines 266-328). Sidebar filtering works (uses nav item `roles` arrays), but `canAccessRoute()` function returns incorrect results.

**Current code:**
```typescript
export const roleNavigation: Record<UserRole, string[]> = {
  admin: ["/dashboard", "/qmrl", "/qmhq", "/po", "/invoice", "/inventory", ...],
  quartermaster: [...], // OLD ROLE
  finance: [...],       // OLD ROLE
  inventory: [...],     // OLD ROLE
  proposal: [...],      // OLD ROLE
  frontline: [...],     // OLD ROLE
  requester: [...],     // OLD ROLE
};
```

**Why it happens:** `roleNavigation` is separate from `permissionMatrix` and nav item `roles` arrays. Easy to overlook during refactoring.

**How to avoid:**
1. Update `roleNavigation` to have exactly 3 keys: `admin`, `qmrl`, `qmhq`
2. Map routes based on requirements:
   - `admin`: All routes (full access)
   - `qmrl`: `/dashboard`, `/qmrl`, `/item` (field operations, no HQ pages)
   - `qmhq`: `/dashboard`, `/qmrl` (read-only), `/qmhq`, `/po`, `/invoice`, `/inventory/stock-out-requests`, `/warehouse`, `/item`
3. Test `canAccessRoute()` for each role after changes

**Warning signs:** User can see nav link but gets redirected when clicking. Or vice versa - user redirected despite having permission.

### Pitfall 2: Hardcoded Role Strings in Page Components

**What goes wrong:** Page components have hardcoded role checks like `if (profile.role === 'quartermaster')` that fail after enum migration.

**Current instances found:**
- `/app/(dashboard)/dashboard/page.tsx` line 40: `profile.role !== 'quartermaster'`
- `/app/(dashboard)/admin/users/page.tsx` lines 27-34: `roleConfig` object with 7 old roles

**Why it happens:** TypeScript types updated but runtime checks remain as strings. No compile-time error because `UserRole` is a union type - old values are valid strings until runtime.

**How to avoid:**
1. Use `grep -r "quartermaster\|frontline\|requester\|finance\|inventory\|proposal"` in `/app` directory
2. Replace hardcoded role checks with new enum values
3. Use `usePermissions()` hook instead of direct role comparisons where possible
4. For role display (badges, labels), update role config objects

**Example fix for `/dashboard/page.tsx`:**
```typescript
// OLD
const roleRedirectMap: Record<string, string> = {
  finance: '/po',
  inventory: '/inventory',
  proposal: '/qmhq',
  frontline: '/qmrl',
  requester: '/qmrl',
};

if (profile?.role && profile.role !== 'admin' && profile.role !== 'quartermaster') {
  const redirectTo = roleRedirectMap[profile.role] || '/qmrl';
  redirect(redirectTo);
}

// NEW
const roleRedirectMap: Record<UserRole, string> = {
  admin: '/dashboard',
  qmrl: '/qmrl',
  qmhq: '/qmhq',
};

if (profile?.role && profile.role !== 'admin') {
  redirect(roleRedirectMap[profile.role]);
}
```

**Warning signs:** Runtime errors "Cannot read property of undefined" when accessing role-based configs.

### Pitfall 3: Client-Only Permission Checks

**What goes wrong:** Developer adds permission check with `usePermissions()` hook but no server-side guard. User can bypass by directly navigating to URL or manipulating client state.

**Example vulnerable pattern:**
```typescript
// Client component - NO server guard
export default function SensitivePage() {
  const { can } = usePermissions();

  if (!can('read', 'sensitive_resource')) {
    return <div>Access Denied</div>; // BYPASSED if user disables JavaScript
  }

  return <SensitiveData />;
}
```

**Why it happens:** Next.js App Router blurs server/client boundary. Easy to forget which components are client-side.

**How to avoid:**
1. Page components (`page.tsx`) should be server components by default
2. Add server-side redirect before rendering client components
3. Client `usePermissions()` checks are UX enhancement, not security
4. RLS policies are final enforcement - frontend aligns with RLS, doesn't replace it

**Correct pattern:**
```typescript
// Server component page guard
export default async function SensitivePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    redirect('/unauthorized');
  }

  // Now render client component
  return <SensitiveClientComponent />;
}
```

**Warning signs:** Security audit flags pages with no server-side access checks.

### Pitfall 4: Permission Matrix Inconsistency with RLS Policies

**What goes wrong:** Frontend permission matrix allows action that RLS policy blocks (or vice versa). User sees button, clicks it, gets cryptic database error.

**Example mismatch:**
```typescript
// Frontend: Allows QMRL to update QMHQ
permissionMatrix.qmhq.qmrl = ["read", "update"];

// Database: QMHQ update policy (from Phase 37)
CREATE POLICY qmhq_update ON public.qmhq
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmhq') -- qmrl NOT included
  );
```

**Why it happens:** Permission matrix and RLS policies defined separately. Phase 37 updated RLS, Phase 38 updates frontend - easy for mismatch.

**How to avoid:**
1. Reference Phase 37 RLS migration file as source of truth
2. For each resource in permission matrix, verify against RLS policy
3. Frontend permissions should be **subset** of RLS permissions (more restrictive is safe, less restrictive is broken)
4. Test actual database operations, not just UI rendering

**Verification checklist per resource:**
- [ ] If frontend allows `create`, RLS has INSERT policy for that role
- [ ] If frontend allows `update`, RLS has UPDATE policy for that role
- [ ] If frontend allows `delete`, RLS has DELETE policy for that role
- [ ] If frontend allows `read`, RLS has SELECT policy for that role (or SELECT allows all)

**Warning signs:** Supabase error responses like "new row violates row-level security policy" in production logs.

### Pitfall 5: Stock-Out Approval Admin-Only Enforcement

**What goes wrong:** QMHQ role sees "Approve" button for stock-out requests due to permission check error. Clicks button, RLS policy blocks action with confusing error.

**Requirement:** RBAC-15: Stock-out approvals remain restricted to Admin role only

**RLS enforcement from Phase 37:**
```sql
CREATE POLICY sor_update ON public.stock_out_requests
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
    OR requester_id = auth.uid()  -- Non-admin can only update own requests
  );
```

**Frontend must match:** Show "Approve" button ONLY to admin

```typescript
// Correct implementation
const { can, isAdmin } = usePermissions();

{isAdmin && status === 'pending' && (
  <Button onClick={handleApprove}>Approve</Button>
)}
```

**Why it happens:** Stock-out approval is special case. QMHQ can CREATE requests but cannot APPROVE them. Permission matrix uses generic "update" action; approval is subset of update.

**How to avoid:**
1. Stock-out approval buttons gated by `isAdmin` check, not `can('update', 'stock_out_requests')`
2. Document special case in permission matrix comments
3. Test with QMHQ role user attempting to approve own request

**Warning signs:** QMHQ users report "Permission denied" errors when trying to approve stock-out requests.

## Code Examples

### Example 1: Updated Permission Matrix (Complete 3-Role Matrix)

```typescript
// File: /lib/hooks/use-permissions.ts
// Phase 38 update: Replace 7-role matrix with 3-role matrix

type PermissionMatrix = {
  [resource in PermissionResource]: {
    [role in UserRole]: PermissionAction[];
  };
};

const permissionMatrix: PermissionMatrix = {
  // ============================================
  // QMRL: Field operations requests
  // ============================================
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["create", "read", "update"], // Requester + Frontline merged
    qmhq: ["read"], // HQ can view all QMRLs (read-only)
  },

  // ============================================
  // QMHQ: HQ operations (fulfillment)
  // ============================================
  qmhq: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // Field can view (read-only)
    qmhq: ["create", "read", "update", "delete"], // Proposal + Finance + Inventory merged
  },

  // ============================================
  // Financial Transactions
  // ============================================
  financial_transactions: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [], // No access
    qmhq: ["create", "read", "update", "delete"], // Finance role merged here
  },

  // ============================================
  // Inventory Transactions
  // ============================================
  inventory_transactions: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [], // No access
    qmhq: ["read"], // Can view stock movements (Inventory role merged)
  },

  // ============================================
  // Purchase Orders
  // ============================================
  purchase_orders: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [], // No PO access per RBAC-07
    qmhq: ["create", "read", "update", "delete"], // Finance + Proposal merged
  },

  // ============================================
  // Invoices
  // ============================================
  invoices: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [], // No invoice access per RBAC-07
    qmhq: ["create", "read", "update", "delete"], // Finance role merged
  },

  // ============================================
  // Items (Master Data)
  // ============================================
  items: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // View items for requests
    qmhq: ["read", "update"], // View + update stock levels
  },

  // ============================================
  // Warehouses
  // ============================================
  warehouses: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // View warehouse stock for requests
    qmhq: ["read", "update"], // Manage stock levels (Inventory merged)
  },

  // ============================================
  // Suppliers
  // ============================================
  suppliers: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // View for reference
    qmhq: ["create", "read", "update", "delete"], // Finance + Proposal merged
  },

  // ============================================
  // Contact Persons
  // ============================================
  contact_persons: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["create", "read", "update"], // Frontline merged
    qmhq: ["create", "read", "update", "delete"], // Proposal merged
  },

  // ============================================
  // Departments
  // ============================================
  departments: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["read"],
  },

  // ============================================
  // Categories
  // ============================================
  categories: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["create", "read"], // Proposal merged
  },

  // ============================================
  // Statuses
  // ============================================
  statuses: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"],
    qmhq: ["create", "read"], // Proposal merged
  },

  // ============================================
  // Stock-Out Requests (RBAC-15: Admin-only approvals)
  // ============================================
  stock_out_requests: {
    admin: ["create", "read", "update", "delete"], // Only admin can APPROVE
    qmrl: ["read"], // View own only (RLS filters)
    qmhq: ["create", "read"], // Create requests, view all, but CANNOT approve
  },

  // ============================================
  // Users (Admin Management)
  // ============================================
  users: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [], // No user management
    qmhq: [], // No user management
  },
};
```

**Source:** Derived from Phase 37 RLS policies and Phase 38 requirements (RBAC-03 through RBAC-15)

### Example 2: Updated Navigation Configuration

```typescript
// File: /components/layout/sidebar.tsx
// Phase 38 update: Change nav item role arrays to 3-role system

const allNavigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    // No roles = show to all
  },
  {
    label: "QMRL",
    href: "/qmrl",
    icon: FileText,
    // No roles = show to all (everyone can view QMRLs)
  },
  {
    label: "QMHQ",
    href: "/qmhq",
    icon: ClipboardList,
    // No roles = show to all (everyone can view QMHQs)
  },
  {
    label: "Purchase Orders",
    href: "/po",
    icon: ShoppingCart,
    roles: ["admin", "qmhq"], // UPDATED: Only admin and QMHQ
  },
  {
    label: "Invoices",
    href: "/invoice",
    icon: FileSpreadsheet,
    roles: ["admin", "qmhq"], // UPDATED: Only admin and QMHQ
  },
  {
    label: "Inventory",
    icon: Package,
    roles: ["admin"], // UPDATED: Admin-only for stock-in/stock-out management
    children: [
      { label: "Dashboard", href: "/inventory" },
      { label: "Stock In", href: "/inventory/stock-in" },
      { label: "Stock Out", href: "/inventory/stock-out" },
      { label: "Stock-Out Requests", href: "/inventory/stock-out-requests" },
    ],
  },
  {
    label: "Warehouses",
    href: "/warehouse",
    icon: Warehouse,
    roles: ["admin", "qmhq"], // UPDATED: Admin and QMHQ can view stock levels
  },
  {
    label: "Items",
    href: "/item",
    icon: Box,
    // No roles = show to all
  },
];

const adminNavigation: NavItem[] = [
  {
    label: "Admin",
    icon: Settings,
    roles: ["admin"],
    children: [
      { label: "Users", href: "/admin/users" },
      { label: "Departments", href: "/admin/departments" },
      { label: "Suppliers", href: "/admin/suppliers" },
      { label: "Contacts", href: "/admin/contacts" },
      { label: "Categories", href: "/admin/categories" },
      { label: "Statuses", href: "/admin/statuses" },
    ],
  },
];
```

**Key changes:**
- Purchase Orders: `["admin", "quartermaster", "finance", "proposal"]` → `["admin", "qmhq"]`
- Invoices: `["admin", "quartermaster", "finance", "inventory", "proposal"]` → `["admin", "qmhq"]`
- Inventory: `["admin", "quartermaster", "inventory"]` → `["admin"]` (stock management restricted)
- Warehouses: `["admin", "quartermaster", "inventory", "proposal"]` → `["admin", "qmhq"]`

### Example 3: Updated roleNavigation Map

```typescript
// File: /lib/hooks/use-permissions.ts
// Phase 38 update: Replace 7-role map with 3-role map

export const roleNavigation: Record<UserRole, string[]> = {
  // ============================================
  // Admin: Full system access
  // ============================================
  admin: [
    "/dashboard",
    "/qmrl",
    "/qmhq",
    "/po",
    "/invoice",
    "/inventory",
    "/inventory/stock-in",
    "/inventory/stock-out",
    "/inventory/stock-out-requests",
    "/warehouse",
    "/item",
    "/admin", // Admin pages
  ],

  // ============================================
  // QMRL: Field operations role
  // RBAC-05: Can create QMRLs
  // RBAC-06: Can view all QMRLs
  // RBAC-07: Cannot access QMHQ/PO/Invoice/Inventory pages
  // ============================================
  qmrl: [
    "/dashboard",
    "/qmrl",      // Create + view QMRLs
    "/qmhq",      // View QMHQs (read-only)
    "/item",      // View items for requests
  ],

  // ============================================
  // QMHQ: HQ operations role
  // RBAC-08: Can create QMHQs
  // RBAC-09: Can view all QMRLs (read-only)
  // RBAC-10: Can view all QMHQs
  // RBAC-11: Can view financial transactions
  // RBAC-12: Can view stock levels
  // RBAC-13: Can view purchase orders
  // ============================================
  qmhq: [
    "/dashboard",
    "/qmrl",      // View all QMRLs (read-only)
    "/qmhq",      // Create + manage QMHQs
    "/po",        // View + create POs
    "/invoice",   // Manage invoices
    "/inventory/stock-out-requests", // Create stock-out requests (view stock levels)
    "/warehouse", // View stock levels per warehouse
    "/item",      // View items
  ],
};
```

**Note:** QMHQ does NOT have `/inventory`, `/inventory/stock-in`, `/inventory/stock-out` routes. They can only access `/inventory/stock-out-requests` (create requests, view stock levels summary). Direct stock-in/out management is admin-only.

### Example 4: Server Component Page Guard Pattern

```typescript
// File: /app/(dashboard)/po/page.tsx
// Phase 38 update: Add server-side role check

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  // Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch user role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  // Guard: Only admin and QMHQ can access PO page
  if (!profile?.role || (profile.role !== 'admin' && profile.role !== 'qmhq')) {
    redirect('/dashboard');
  }

  // User authorized - render page
  return <PurchaseOrdersClient />;
}
```

**Pattern applies to:**
- `/po/*` - Admin, QMHQ only
- `/invoice/*` - Admin, QMHQ only
- `/inventory/*` - Admin only (except `/inventory/stock-out-requests` which allows QMHQ)
- `/admin/*` - Admin only

### Example 5: Role Display Configuration Update

```typescript
// File: /app/(dashboard)/admin/users/page.tsx
// Phase 38 update: Replace 7-role config with 3-role config

const roleConfig: Record<string, { label: string; color: string }> = {
  // OLD (7 roles)
  // admin: { label: "Admin", color: "bg-red-500" },
  // quartermaster: { label: "Quartermaster", color: "bg-purple-500" },
  // finance: { label: "Finance", color: "bg-emerald-500" },
  // inventory: { label: "Inventory", color: "bg-blue-500" },
  // proposal: { label: "Proposal", color: "bg-amber-500" },
  // frontline: { label: "Frontline", color: "bg-cyan-500" },
  // requester: { label: "Requester", color: "bg-slate-500" },

  // NEW (3 roles)
  admin: {
    label: "Admin",
    color: "bg-red-500",
  },
  qmrl: {
    label: "QMRL",
    color: "bg-blue-500",
  },
  qmhq: {
    label: "QMHQ",
    color: "bg-amber-500",
  },
};
```

**Used for:** Role badges in user management table, user profile displays, audit log role rendering.

## State of the Art

| Approach | 2024 (Old) | 2026 (Current) | Impact |
|----------|------------|----------------|--------|
| Permission checks | Role-based (`if (role === 'admin')`) | Resource-action based (`can('create', 'qmrl')`) | More flexible, easier to audit |
| Route protection | Client-side only | Server Component guards + client hooks | Security + UX |
| Navigation | Hardcoded role checks | Declarative `roles` arrays | Maintainable, testable |
| Type safety | String literals | TypeScript enum from database | Refactoring safety |

**For this project:** Already using 2026 best practices. Phase 38 is refactoring, not rearchitecting.

## Open Questions

### 1. Stock-Out Request Access for QMHQ

**What we know:** RBAC-12 states "QMHQ role user can view stock levels per item and warehouse (summary only, no individual transaction history)."

**What's unclear:** Can QMHQ users CREATE stock-out requests, or only VIEW them?

**Current RLS policy from Phase 37:**
```sql
CREATE POLICY sor_insert ON public.stock_out_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmhq')  -- QMHQ CAN create
  );
```

**Recommendation:** QMHQ can CREATE stock-out requests (matches RLS policy). Permission matrix should include:
```typescript
stock_out_requests: {
  admin: ["create", "read", "update", "delete"],
  qmrl: ["read"], // View own only
  qmhq: ["create", "read"], // Create + view all, but cannot approve
}
```

**Rationale:** HQ operations role needs to request stock for fulfillment. Admin approves requests (RBAC-15).

### 2. Dashboard Page Access for QMRL and QMHQ

**What we know:** Current `/dashboard/page.tsx` redirects non-admin/quartermaster users to role-specific pages.

**What's unclear:** Should QMRL and QMHQ users be able to access `/dashboard`, or redirect to their primary page?

**Current implementation:**
```typescript
// Redirects finance → /po, inventory → /inventory, proposal → /qmhq, etc.
if (profile?.role !== 'admin' && profile.role !== 'quartermaster') {
  redirect(roleRedirectMap[profile.role]);
}
```

**Recommendation:** Allow all roles to access `/dashboard` with role-specific views:
- Admin: Full metrics (QMRL count, QMHQ count, PO value, inventory levels)
- QMRL: QMRL-focused metrics (own requests, recent QMRLs)
- QMHQ: QMHQ-focused metrics (pending QMHQs, PO status, financial summary)

**Alternative:** Redirect QMRL to `/qmrl`, redirect QMHQ to `/qmhq`. Simpler, matches current pattern.

**Decision needed:** User preference for dashboard access.

### 3. Warehouse Page Access for QMRL

**What we know:**
- RBAC-12: "QMHQ role user can view stock levels per item and warehouse"
- No explicit requirement for QMRL warehouse access
- Permission matrix draft: `warehouses.qmrl = ["read"]`

**What's unclear:** Should QMRL users see warehouse stock levels, or only items without warehouse context?

**Use case for QMRL warehouse access:** Field users creating QMRLs may need to check if items are in stock before requesting.

**Use case against:** Field users should request what they need; HQ checks availability during fulfillment.

**Recommendation:** Grant QMRL read access to warehouses (view stock levels for informed requests). Update navigation:
```typescript
{
  label: "Warehouses",
  href: "/warehouse",
  icon: Warehouse,
  roles: ["admin", "qmhq", "qmrl"], // Add QMRL
}
```

**Decision needed:** Product owner input on field user workflow.

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** - Direct examination of:
  - `/lib/hooks/use-permissions.ts` - Permission matrix structure, `canAccessRoute()` function
  - `/components/layout/sidebar.tsx` - Navigation filtering pattern
  - `/app/(dashboard)/dashboard/page.tsx` - Server component guard pattern
  - `/supabase/migrations/20260211120001_rbac_rls_policy_recreation.sql` - RLS policy source of truth
  - Phase 37 verification report - Confirms 92 policies recreated with 3-role system
- [Next.js Documentation - Authenticating](https://nextjs.org/docs/pages/building-your-application/authentication) - Official Next.js auth patterns
- [Next.js Authorization Guide](https://www.robinwieruch.de/next-authorization/) - Server Component authorization pattern

### Secondary (MEDIUM confidence)

- [Next.js 14 Authentication and RBAC with App Router](https://www.descope.com/blog/post/auth-nextjs14-app-router) - App Router permission patterns
- [Safeguarding User Role-Based Private Routes in Next.js 13 or 14](https://medium.com/@suhag_alamin/safeguarding-user-role-based-private-routes-in-next-js-13-or-14-app-router-a-step-by-step-guide-5ab5d4b4c0fb) - Role-based route protection
- [Understanding Protected Routes in Next.js 14](https://jscrambler.com/blog/understanding-protected-routes-in-next-js-14) - Server vs client protection layers
- [React-admin usePermissions](https://marmelab.com/react-admin/usePermissions.html) - Permission hook pattern
- [Implementing Role Based Access Control (RABC) in React](https://www.permit.io/blog/implementing-react-rbac-authorization) - Resource-based permission checks

### Tertiary (Context)

- [How to implement role-based routing in Next.js 14 with App Router](https://github.com/vercel/next.js/discussions/81357) - Community discussion on role routing
- [Auth.js Protecting Routes](https://authjs.dev/getting-started/session-management/protecting) - Session-based route protection
- Phase 37 research document - RLS policy patterns, role mapping logic

## Metadata

**Confidence breakdown:**
- Permission matrix update: HIGH - Clear mapping from Phase 37 RLS policies and requirements
- Navigation filtering: HIGH - Existing pattern works, only role values need updating
- Server component guards: HIGH - Next.js 14 App Router standard pattern
- Stock-out approval admin-only: HIGH - Explicitly stated in RBAC-15, enforced in RLS
- Dashboard access pattern: MEDIUM - Requires product decision (allow all vs redirect)

**Research date:** 2026-02-11
**Valid until:** 2026-05-11 (90 days - Next.js 14 App Router is stable)

**Phase 38 complexity assessment:** MEDIUM
- Refactoring existing code, not building new infrastructure
- Permission matrix straightforward (3 roles vs 7 roles = simpler)
- Navigation updates declarative (update role arrays)
- Main risk: Missing hardcoded role checks in edge cases
- Testing required: Each role's page access and UI permissions

**Estimated execution time:** 2-4 hours for code updates, 2-3 hours for comprehensive testing (3 roles × 10+ pages).
