# Architecture Research

**Domain:** QM System UI Standardization, Flow Tracking, and RBAC Overhaul
**Researched:** 2026-02-11
**Confidence:** HIGH

## Executive Summary

This research examines how three new features (UI component standardization, admin-only end-to-end flow tracking, and RBAC role simplification from 7 to 3 roles) integrate with the existing Next.js 14 + Supabase architecture. The existing codebase has 54 page files, 25+ UI components, 69 client components, and 62 database migrations with comprehensive RLS policies.

**Key Finding:** All three features can integrate cleanly with existing architecture patterns without requiring major refactoring. The RBAC change is the most invasive (affects DB enum, RLS policies, middleware, and UI guards) but follows a well-documented PostgreSQL migration path. Flow tracking benefits from Supabase's automatic join detection. UI standardization can leverage the existing Radix UI + CVA pattern already in place.

## Standard Architecture

### Current System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 14 App Router                     │
│  (Force Dynamic - SSR for all dashboard routes)             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Server  │  │  Server  │  │  Client  │  │  Client  │    │
│  │  Pages   │  │  Layouts │  │  Forms   │  │  Tables  │    │
│  │  (49)    │  │          │  │  (69)    │  │          │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │            │
├───────┴─────────────┴─────────────┴─────────────┴───────────┤
│              Supabase Client (SSR/Browser)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  createServerClient / createClient                  │    │
│  │  - Auth session management                          │    │
│  │  - Query builder with automatic joins               │    │
│  │  - Real-time subscriptions (not currently used)     │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Supabase Backend                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   Auth   │  │ Postgres │  │   RLS    │  │ Storage  │    │
│  │  (Email  │  │  (62     │  │ Policies │  │  Bucket  │    │
│  │   OTP)   │  │ migr.)   │  │          │  │          │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘

Data Flow: QMRL → QMHQ → PO → Invoice → Inventory Transactions
           └──────────────────────────────────────────────────┘
                    (Flow Tracking Target Chain)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Page Components** | Data fetching, auth checks, layout composition | Server Components with Supabase server client |
| **UI Components** | Presentational primitives (Button, Card, Input) | Radix UI primitives + CVA for variants + Tailwind |
| **Form Components** | User input with validation | Client Components with react-hook-form + Zod |
| **Table Components** | Data display with sort/filter | Client Components with @tanstack/react-table |
| **Layout Components** | Sidebar, Header navigation | Client Components with role-based nav filtering |
| **Auth Provider** | User context, role exposure | Client Component wrapping dashboard layout |
| **Middleware** | Session validation, route protection | Edge middleware with Supabase SSR |
| **RLS Policies** | Row-level data access control | PostgreSQL policies referencing user_role enum |

## Current Architecture State

### Database Schema Structure

**Existing Chain:**
```
users (role enum: 7 values)
  ↓
qmrl (request_id: QMRL-YYYY-NNNNN)
  ↓ (1:N)
qmhq (request_id: QMHQ-YYYY-NNNNN, route_type: item|expense|po)
  ↓ (1:N for PO route)
purchase_orders (po_number: PO-YYYY-NNNNN)
  ↓ (1:N)
invoices (invoice_number: INV-YYYY-NNNNN)
  ↓ (1:N via invoice_line_items)
inventory_transactions (transaction_type: in|out)
```

**Key Relationships:**
- `qmhq.qmrl_id` → `qmrl.id` (CASCADE DELETE)
- `purchase_orders.qmhq_id` → `qmhq.id` (RESTRICT)
- `invoices.po_id` → `purchase_orders.id` (RESTRICT)
- `inventory_transactions.invoice_id` → `invoices.id` (nullable)

**Current Role Enum (users.role):**
```sql
CREATE TYPE user_role AS ENUM (
  'admin', 'quartermaster', 'finance',
  'inventory', 'proposal', 'frontline', 'requester'
);
```

### Permission Matrix Pattern

**Current Implementation:**
- Frontend: `/lib/hooks/use-permissions.ts` - 192 lines of TypeScript permission matrix
- Database: `/supabase/migrations/002_users.sql` - `has_role()` function for hierarchical checks
- Middleware: `/lib/supabase/middleware.ts` - Session validation + is_active check
- RLS Policies: `/supabase/migrations/027_rls_policies.sql` - Role-based SELECT/INSERT/UPDATE/DELETE

**Permission Check Flow:**
```
User Action
    ↓
usePermissions().can('create', 'qmrl')
    ↓
permissionMatrix[resource][role].includes(action)
    ↓
Conditional Render (Button/Form)
    ↓ (if rendered)
Supabase Query
    ↓
RLS Policy (get_user_role() IN (...))
    ↓
Row Access Granted/Denied
```

### Component Library Pattern

**Existing Pattern: Radix UI + CVA + Tailwind**

Current components follow shadcn/ui-style pattern (not npm-installed, but same architecture):
- Base primitives from `@radix-ui/*` (Dialog, Select, Tabs, etc.)
- Styled with Tailwind utility classes
- Variants managed with `class-variance-authority`
- Consistent dark theme (slate-900 bg, amber-500 brand)

**Example (Button.tsx):**
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap...",
  {
    variants: {
      variant: { default, destructive, outline, secondary, ghost, link },
      size: { default, sm, lg, icon }
    }
  }
)
```

**Current Component Count:**
- `/components/ui/`: 25 files (Button, Card, Input, Select, Dialog, Tabs, Badge, etc.)
- `/components/forms/`: 2 files (inline-create-select.tsx, category-item-selector.tsx)
- `/components/layout/`: 2 files (sidebar.tsx, header.tsx)
- Feature-specific: `/components/po/`, `/components/qmhq/`, `/components/invoice/`, etc.

## Integration Architecture for New Features

### 1. UI Component Standardization

#### Recommended Approach: Audit + Consolidate Pattern

**Goal:** Identify duplicate patterns, create reusable components, enforce consistent usage.

**Integration Points:**
- **Existing:** 25 base UI components already follow consistent Radix + CVA pattern
- **New:** Component audit script + standardized pattern documentation

**Strategy:**

1. **Audit Phase:**
   - Use `jscpd` or `jsinspect` to detect duplicate component patterns
   - Manual review of `/app` pages for inline styles, repeated JSX structures
   - Document findings in `.planning/research/UI_AUDIT.md`

2. **Consolidation Phase:**
   - Extract common patterns into `/components/ui/` or `/components/common/`
   - Examples of likely duplicates:
     - Status badge displays (found in multiple pages)
     - Currency amount + EUSD display (repeated pattern)
     - Date range filters
     - Loading skeletons
     - Empty state cards

3. **Enforcement Phase:**
   - ESLint rules to prevent inline Tailwind in certain files
   - Component usage guidelines in `CLAUDE.md`
   - Pre-commit hook to flag new duplicates

**New Components to Create:**

| Component | Purpose | Replaces |
|-----------|---------|----------|
| `<StatusBadge>` | Standardized status display | Inline Badge usage with status config |
| `<AmountDisplay>` | Currency + EUSD in consistent format | CurrencyDisplay variations |
| `<EmptyState>` | Empty list/table placeholder | Repeated empty state JSX |
| `<LoadingSkeleton>` | Consistent loading states | Various Skeleton implementations |
| `<FilterBar>` | Search + filter controls | Repeated filter UI patterns |
| `<SectionHeader>` | Page section titles with actions | Repeated header patterns |

**File Structure After Standardization:**
```
/components/ui/
├── primitives/          # Radix-based (existing)
│   ├── button.tsx
│   ├── card.tsx
│   └── input.tsx
├── composite/           # NEW - Combined patterns
│   ├── status-badge.tsx
│   ├── amount-display.tsx
│   ├── empty-state.tsx
│   └── loading-skeleton.tsx
└── layouts/             # NEW - Layout patterns
    ├── filter-bar.tsx
    ├── section-header.tsx
    └── page-container.tsx
```

**Migration Path:**
- Non-breaking: New components created, old patterns deprecated
- Pages updated incrementally (not all at once)
- Use codemod script for mechanical refactors (e.g., Badge → StatusBadge)

**Trade-offs:**
- **Pro:** Consistency, easier maintenance, smaller bundle (deduplication)
- **Pro:** Leverages existing Radix + CVA architecture (no paradigm shift)
- **Con:** Upfront audit time (~2-4 hours for 54 page files)
- **Con:** Incremental migration means old/new patterns coexist temporarily

---

### 2. End-to-End Flow Tracking (Admin Only)

#### Recommended Approach: PostgreSQL VIEW + React Flow Visualization

**Goal:** Admin-only page showing QMRL → QMHQ → PO → Invoice → Inventory chain.

**Integration Points:**
- **New Route:** `/app/(dashboard)/admin/flow-tracker/page.tsx`
- **New DB Migration:** `063_flow_tracking_view.sql` (materialized view or regular view)
- **New Component:** Flow visualization using React Flow library

**Database Architecture:**

**Option A: Regular VIEW (Recommended for MVP)**
```sql
CREATE OR REPLACE VIEW flow_tracking AS
SELECT
  qmrl.id AS qmrl_id,
  qmrl.request_id AS qmrl_request_id,
  qmrl.title AS qmrl_title,
  qmrl.status_id AS qmrl_status_id,

  qmhq.id AS qmhq_id,
  qmhq.request_id AS qmhq_request_id,
  qmhq.route_type AS qmhq_route_type,

  po.id AS po_id,
  po.po_number AS po_number,
  po.status AS po_status,

  inv.id AS invoice_id,
  inv.invoice_number AS invoice_number,
  inv.status AS invoice_status,

  it.id AS inventory_transaction_id,
  it.transaction_type AS inventory_type
FROM qmrl
LEFT JOIN qmhq ON qmhq.qmrl_id = qmrl.id
LEFT JOIN purchase_orders po ON po.qmhq_id = qmhq.id AND qmhq.route_type = 'po'
LEFT JOIN invoices inv ON inv.po_id = po.id
LEFT JOIN inventory_transactions it ON it.invoice_id = inv.id
WHERE qmrl.is_active = true
ORDER BY qmrl.created_at DESC;
```

**Why VIEW not MATERIALIZED VIEW for MVP:**
- Real-time data (no refresh lag)
- Low complexity (5-table join is fast with proper indexes)
- Indexes already exist on FK columns (qmrl_id, qmhq_id, po_id, invoice_id)
- Admin-only feature (low concurrent access)

**When to upgrade to MATERIALIZED VIEW:**
- Data volume > 100K QMRLs
- Query time > 2 seconds
- Concurrent admin users > 5

**React Flow Integration:**

**Component Architecture:**
```
/app/(dashboard)/admin/flow-tracker/
├── page.tsx                    # Server Component - fetch view data
└── components/
    ├── flow-canvas.tsx         # Client Component - React Flow canvas
    ├── node-qmrl.tsx          # Custom node component
    ├── node-qmhq.tsx          # Custom node component
    ├── node-po.tsx            # Custom node component
    ├── node-invoice.tsx       # Custom node component
    └── node-inventory.tsx     # Custom node component
```

**Data Flow:**
```
Server Page Component (page.tsx)
    ↓
const { data } = await supabase.from('flow_tracking').select()
    ↓
<FlowCanvas initialData={data} /> (Client Component)
    ↓
Transform data → React Flow nodes/edges
    ↓
ReactFlow component (from 'reactflow' npm package)
    ↓
Custom node components render with status colors
```

**React Flow Installation:**
```bash
npm install reactflow
# Dependencies: d3-zoom (already transitively included)
```

**Node Transformation Example:**
```typescript
function transformToFlowData(rows: FlowTrackingRow[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  rows.forEach((row, index) => {
    // QMRL node
    nodes.push({
      id: `qmrl-${row.qmrl_id}`,
      type: 'qmrl',
      position: { x: 0, y: index * 200 },
      data: {
        requestId: row.qmrl_request_id,
        title: row.qmrl_title,
        statusId: row.qmrl_status_id
      }
    });

    // QMHQ node (if exists)
    if (row.qmhq_id) {
      nodes.push({
        id: `qmhq-${row.qmhq_id}`,
        type: 'qmhq',
        position: { x: 250, y: index * 200 },
        data: {
          requestId: row.qmhq_request_id,
          routeType: row.qmhq_route_type
        }
      });

      // Edge: QMRL → QMHQ
      edges.push({
        id: `e-qmrl-qmhq-${row.qmrl_id}-${row.qmhq_id}`,
        source: `qmrl-${row.qmrl_id}`,
        target: `qmhq-${row.qmhq_id}`,
        animated: true
      });
    }

    // Continue for PO, Invoice, Inventory...
  });

  return { nodes, edges };
}
```

**Custom Node Component Example:**
```typescript
// /components/flow-tracker/node-qmrl.tsx
"use client";

import { Handle, Position } from 'reactflow';
import { Badge } from '@/components/ui/badge';

export function QMRLNode({ data }: { data: QMRLNodeData }) {
  return (
    <div className="border border-slate-700 bg-slate-900 rounded-lg p-4 min-w-[200px]">
      <Handle type="source" position={Position.Right} />

      <div className="text-xs text-slate-400">QMRL</div>
      <div className="font-semibold text-slate-100">{data.requestId}</div>
      <div className="text-sm text-slate-300 truncate">{data.title}</div>

      <StatusBadge statusId={data.statusId} className="mt-2" />
    </div>
  );
}
```

**Route Protection:**
```typescript
// /app/(dashboard)/admin/flow-tracker/page.tsx
export default async function FlowTrackerPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return <div>Access Denied: Admin Only</div>;
  }

  // Fetch flow data and render...
}
```

**RLS Policy for View:**
```sql
-- Enable RLS on view (requires security definer functions)
CREATE POLICY flow_tracking_admin_only ON flow_tracking
  FOR SELECT USING (public.get_user_role() = 'admin');
```

**Performance Considerations:**

| Data Volume | Query Time (est.) | Optimization |
|-------------|-------------------|--------------|
| 0-10K QMRLs | <500ms | None needed - regular VIEW works |
| 10K-100K | 500ms-2s | Add composite indexes on join columns |
| 100K+ | >2s | Switch to MATERIALIZED VIEW with REFRESH CONCURRENTLY |

**Indexes to verify exist:**
```sql
-- Should already exist from earlier migrations
CREATE INDEX IF NOT EXISTS idx_qmhq_qmrl_id ON qmhq(qmrl_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_qmhq_id ON purchase_orders(qmhq_id);
CREATE INDEX IF NOT EXISTS idx_invoices_po_id ON invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_id ON inventory_transactions(invoice_id);
```

**Trade-offs:**
- **Pro:** Leverages Supabase automatic join detection (no complex query building)
- **Pro:** React Flow is mature, well-documented, Next.js-compatible
- **Pro:** VIEW gives real-time data without refresh complexity
- **Con:** React Flow adds ~150KB to bundle (admin-only route = acceptable)
- **Con:** Complex flows (QMRL with 20+ QMHQs) may need virtualization

**Alternative Considered: D3.js**
- **Why not:** Lower-level, requires more custom code for interactions
- **When to use:** If highly custom visualization needed (not standard node-edge flow)

---

### 3. RBAC Role Simplification (7 → 3 Roles)

#### Recommended Approach: Multi-Step Migration with Backward Compatibility

**Goal:** Change user_role enum from 7 values to 3 values (admin, qmrl, qmhq).

**Integration Points (INVASIVE):**
- Database: `user_role` enum type
- Database: RLS policies (all resources)
- Database: `has_role()` function
- Frontend: `/lib/hooks/use-permissions.ts` (192 lines)
- Frontend: `/components/layout/sidebar.tsx` (roleNavigation)
- Frontend: All pages with permission checks (~30+ files)
- Middleware: No changes needed (role-agnostic session validation)

**PostgreSQL Enum Migration Challenge:**

**Problem:** PostgreSQL does NOT support `ALTER TYPE ... DROP VALUE` ([official docs](https://www.postgresql.org/docs/current/sql-altertype.html) confirm).

**Solution:** Rename-create-migrate-drop pattern ([Updating Enum Values in PostgreSQL - The Safe and Easy Way](https://blog.yo1.dog/updating-enum-values-in-postgresql-the-safe-and-easy-way/)):

```sql
-- Migration 063_rbac_role_simplification.sql

-- Step 1: Rename old enum
ALTER TYPE user_role RENAME TO user_role_old;

-- Step 2: Create new enum with 3 values
CREATE TYPE user_role AS ENUM ('admin', 'qmrl', 'qmhq');

-- Step 3: Add temporary column with new type
ALTER TABLE users ADD COLUMN role_new user_role;

-- Step 4: Migrate data with mapping logic
UPDATE users SET role_new =
  CASE
    WHEN role_old = 'admin' THEN 'admin'::user_role
    WHEN role_old IN ('quartermaster', 'proposal', 'frontline', 'requester') THEN 'qmrl'::user_role
    WHEN role_old IN ('finance', 'inventory') THEN 'qmhq'::user_role
  END;

-- Step 5: Drop old column
ALTER TABLE users DROP COLUMN role;

-- Step 6: Rename new column
ALTER TABLE users RENAME COLUMN role_new TO role;

-- Step 7: Drop old enum type
DROP TYPE user_role_old;

-- Step 8: Recreate NOT NULL constraint
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'qmrl';
```

**Role Mapping Strategy:**

| Old Role | New Role | Rationale |
|----------|----------|-----------|
| admin | admin | Unchanged - full system access |
| quartermaster | qmrl | QMRL-focused approver |
| proposal | qmrl | QMRL-focused processor |
| frontline | qmrl | QMRL-focused validator |
| requester | qmrl | QMRL-focused creator |
| finance | qmhq | QMHQ-focused (PO, Invoice) |
| inventory | qmhq | QMHQ-focused (Stock) |

**Permission Matrix Migration:**

**Before (7 roles × 12 resources = 84 permission sets):**
```typescript
permissionMatrix = {
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    quartermaster: ["create", "read", "update", "delete"],
    finance: ["read"],
    inventory: ["read"],
    proposal: ["read", "update"],
    frontline: ["read", "update"],
    requester: ["create", "read"]
  },
  // ... 11 more resources
}
```

**After (3 roles × 12 resources = 36 permission sets):**
```typescript
permissionMatrix = {
  qmrl: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["create", "read", "update", "delete"], // Union of old QMRL-focused roles
    qmhq: ["read"] // Read-only for QMHQ users
  },
  qmhq: {
    admin: ["create", "read", "update", "delete"],
    qmrl: ["read"], // Read-only for QMRL users
    qmhq: ["create", "read", "update", "delete"] // Union of old QMHQ-focused roles
  },
  purchase_orders: {
    admin: ["create", "read", "update", "delete"],
    qmrl: [],
    qmhq: ["create", "read", "update", "delete"]
  },
  // ... 9 more resources
}
```

**RLS Policy Updates:**

**Pattern: Change role checks from 7 values to 3 values**

Before:
```sql
CREATE POLICY qmrl_select ON qmrl
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline')
    OR requester_id = auth.uid()
  );
```

After:
```sql
CREATE POLICY qmrl_select ON qmrl
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmrl', 'qmhq')
    OR requester_id = auth.uid()
  );
```

**Migration 064_rls_policies_role_update.sql:**
```sql
-- Drop all existing policies
DROP POLICY IF EXISTS qmrl_select ON qmrl;
DROP POLICY IF EXISTS qmrl_insert ON qmrl;
-- ... (all policies for all tables)

-- Recreate with new role values
CREATE POLICY qmrl_select ON qmrl
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'qmrl', 'qmhq')
    OR requester_id = auth.uid()
  );

CREATE POLICY qmrl_insert ON qmrl
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'qmrl')
  );

CREATE POLICY qmrl_update ON qmrl
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'qmrl')
  );

-- ... (all other resources)
```

**Frontend Updates:**

**File Impact Map:**

| File | Change Type | Est. Lines Changed |
|------|-------------|-------------------|
| `/lib/hooks/use-permissions.ts` | Matrix simplification | 150 lines |
| `/components/layout/sidebar.tsx` | Navigation map | 20 lines |
| `/types/database.ts` | Type definitions | 5 lines |
| Pages with `usePermissions()` | None (hook API unchanged) | 0 lines |

**Migration Strategy:**

1. **Database migrations** (063, 064) - MUST run together atomically
2. **Frontend updates** - Deploy after DB migration completes
3. **User communication** - Notify affected users of role changes

**Rollback Plan:**

If migration fails mid-flight:
```sql
-- Rollback script (065_rollback_rbac.sql)
ALTER TYPE user_role RENAME TO user_role_new;
CREATE TYPE user_role AS ENUM ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester');
ALTER TABLE users ADD COLUMN role_old user_role;
-- Reverse mapping logic...
```

**Testing Checklist:**

- [ ] Admin can still access all resources
- [ ] Old 'quartermaster' users (now 'qmrl') can create QMRL
- [ ] Old 'finance' users (now 'qmhq') can create PO/Invoice
- [ ] Old 'requester' users (now 'qmrl') can create own QMRL
- [ ] No 403 errors on previously accessible pages
- [ ] RLS policies correctly restrict rows

**Trade-offs:**
- **Pro:** Simpler mental model (3 roles vs 7)
- **Pro:** Reduced permission matrix complexity (36 vs 84 sets)
- **Pro:** Easier onboarding (clearer role definitions)
- **Con:** Loss of granularity (can't distinguish quartermaster from frontline)
- **Con:** Invasive migration (62 RLS policies need updating)
- **Con:** Zero-downtime deployment requires careful sequencing

**Deployment Sequence:**

1. **Maintenance window** (recommend 15-30min for safety)
2. Run migration 063 (enum change)
3. Run migration 064 (RLS policies)
4. Verify with test queries
5. Deploy frontend changes
6. Smoke test as each role type
7. Open system

**Alternative Considered: Lookup Table Instead of Enum**

Industry best practice 2026: Use lookup tables for evolving values ([Managing Enums in Postgres | Supabase Docs](https://supabase.com/docs/guides/database/postgres/enums) cautions about enum limitations).

**Why not for this migration:**
- Existing system deeply integrated with enum (62 migrations reference it)
- Converting enum → table even more invasive (FK constraints, RLS policy rewrites)
- 3 roles unlikely to change frequently (stable domain)
- Next refactor might consider table pattern

---

## Recommended Project Structure (After Integration)

```
/app/(dashboard)/
├── admin/
│   ├── flow-tracker/          # NEW - Flow visualization
│   │   ├── page.tsx           # Server Component
│   │   └── components/
│   │       └── flow-canvas.tsx
│   ├── users/
│   ├── categories/
│   └── statuses/
├── qmrl/
├── qmhq/
├── po/
├── invoice/
└── inventory/

/components/
├── ui/
│   ├── primitives/            # Existing Radix components
│   ├── composite/             # NEW - Standardized patterns
│   │   ├── status-badge.tsx
│   │   ├── amount-display.tsx
│   │   └── empty-state.tsx
│   └── layouts/               # NEW - Layout components
│       └── filter-bar.tsx
├── forms/
├── layout/
└── flow-tracker/              # NEW - Flow visualization components

/lib/
├── hooks/
│   └── use-permissions.ts     # MODIFIED - 3 roles instead of 7
└── utils/

/supabase/migrations/
├── 063_flow_tracking_view.sql        # NEW
├── 064_rbac_role_simplification.sql  # NEW
└── 065_rls_policies_role_update.sql  # NEW
```

---

## Data Flow Patterns

### Current Pattern (Unchanged)

```
User Action (Browser)
    ↓
Client Component Event Handler
    ↓
Supabase Client Query
    ↓
HTTP Request → Supabase API
    ↓
RLS Policy Check (get_user_role())
    ↓
PostgreSQL Query Execution
    ↓
Response → Browser
    ↓
State Update (useState/useEffect)
    ↓
Re-render
```

### New Flow Tracking Pattern

```
Admin navigates to /admin/flow-tracker
    ↓
Server Page Component (page.tsx)
    ↓
await supabase.from('flow_tracking').select()
    ↓
PostgreSQL VIEW joins 5 tables
    ↓
RLS: check role = 'admin'
    ↓
Return joined rows
    ↓
<FlowCanvas initialData={rows} />
    ↓
Client Component transforms data → nodes/edges
    ↓
React Flow renders interactive graph
    ↓
User pans/zooms (client-side only, no re-fetch)
```

### RBAC Migration Data Flow

```
Migration Script Execution
    ↓
BEGIN TRANSACTION
    ↓
Rename user_role → user_role_old
    ↓
Create new user_role enum (3 values)
    ↓
Migrate users.role (quartermaster → qmrl, finance → qmhq, etc.)
    ↓
Drop old enum
    ↓
Drop + Recreate RLS Policies (with new role values)
    ↓
COMMIT
    ↓
Frontend Deployment (new permissionMatrix)
    ↓
User logs in → get_user_role() returns new value
    ↓
Frontend permission checks use new 3-role matrix
    ↓
RLS policies enforce with new role values
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mixing Server/Client Component Data Fetching

**What people do:** Fetch data in client component with useEffect + Supabase client

```typescript
// ❌ BAD - Client-side data fetching
"use client";
export default function QMRLPage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('qmrl').select().then(({ data }) => setData(data));
  }, []);
}
```

**Why it's wrong:**
- Exposes API keys to browser (even if anon key)
- Slower (client-side fetch after hydration)
- SEO-unfriendly (no SSR data)
- Loading states managed manually

**Do this instead:**
```typescript
// ✅ GOOD - Server Component data fetching
export default async function QMRLPage() {
  const supabase = createServerClient();
  const { data } = await supabase.from('qmrl').select();

  return <QMRLList initialData={data} />; // Pass to client component
}
```

### Anti-Pattern 2: Inline Permission Checks Without RLS

**What people do:** Frontend-only permission gates

```typescript
// ❌ BAD - Frontend-only check
if (user.role === 'admin') {
  await supabase.from('users').delete().eq('id', userId);
}
```

**Why it's wrong:**
- Security theater (API requests can bypass frontend)
- If RLS policy missing, data exposed
- Double maintenance (frontend + backend logic)

**Do this instead:**
```typescript
// ✅ GOOD - Frontend check + RLS enforcement
if (can('delete', 'users')) {
  // Frontend: Hide button if no permission
  await supabase.from('users').delete().eq('id', userId);
  // Backend: RLS policy blocks if get_user_role() != 'admin'
}
```

### Anti-Pattern 3: Enum Migration Without Rename-Create Pattern

**What people do:** Try to ALTER TYPE ... DROP VALUE

```sql
-- ❌ BAD - PostgreSQL does not support this
ALTER TYPE user_role DROP VALUE 'quartermaster';
```

**Why it's wrong:**
- PostgreSQL throws error: "cannot drop enum value"
- Forces complete table rebuild
- Breaks existing foreign key references

**Do this instead:**
```sql
-- ✅ GOOD - Rename-create-migrate-drop
ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('admin', 'qmrl', 'qmhq');
ALTER TABLE users ADD COLUMN role_new user_role;
UPDATE users SET role_new = CASE ... END;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_new TO role;
DROP TYPE user_role_old;
```

### Anti-Pattern 4: MATERIALIZED VIEW Without Refresh Strategy

**What people do:** Create materialized view but never refresh

```sql
-- ❌ BAD - Stale data forever
CREATE MATERIALIZED VIEW flow_tracking AS ...
-- (no REFRESH strategy defined)
```

**Why it's wrong:**
- Data becomes stale immediately
- Users see outdated information
- Defeats purpose of tracking "current" state

**Do this instead:**
```sql
-- ✅ GOOD - Regular VIEW for real-time (if performance OK)
CREATE OR REPLACE VIEW flow_tracking AS ...

-- OR if MATERIALIZED needed, use cron refresh
CREATE MATERIALIZED VIEW flow_tracking AS ...
-- Set up pg_cron job to REFRESH MATERIALIZED VIEW CONCURRENTLY flow_tracking;
```

**For this project:** Use regular VIEW unless query time >2s.

### Anti-Pattern 5: Component Duplication Without Audit

**What people do:** Copy-paste component code across pages

```typescript
// ❌ BAD - Repeated in 5 different pages
<div className="border border-slate-700 bg-slate-900 rounded-lg p-4">
  <Badge color={statusColor}>{statusName}</Badge>
</div>
```

**Why it's wrong:**
- Inconsistent updates (fix in one place, miss others)
- Bundle bloat (repeated code)
- Hard to enforce design system

**Do this instead:**
```typescript
// ✅ GOOD - Extract to /components/ui/composite/status-badge.tsx
<StatusBadge statusId={qmrl.status_id} />
// Single source of truth, consistent rendering
```

---

## Scaling Considerations

| Scale | Current Bottleneck | Mitigation |
|-------|-------------------|------------|
| **0-1K users** | None - current architecture sufficient | Monitor query performance with Supabase dashboard |
| **1K-10K users** | RLS policy evaluation overhead | Add composite indexes, optimize policy logic |
| **10K-100K users** | Flow tracking VIEW query time | Switch to MATERIALIZED VIEW with 5-min refresh |
| **100K+ users** | PostgreSQL connection limits | Enable connection pooling (Supabase PgBouncer) |

### Scaling Priorities

**1. First bottleneck: Complex RLS policies with multiple joins**

**Symptoms:**
- Query time >500ms for list pages
- Slow SELECT on tables with 10K+ rows

**Fix:**
- Simplify policies (fewer subqueries)
- Add functional indexes on computed values
- Use SECURITY DEFINER functions to cache role checks

**2. Second bottleneck: Flow tracking VIEW with 100K+ QMRLs**

**Symptoms:**
- /admin/flow-tracker page load >3s
- Timeout errors on VIEW query

**Fix:**
- Convert to MATERIALIZED VIEW
- Add WHERE filter (date range, status filter)
- Paginate results (show top 100 flows, not all)

**3. Third bottleneck: Real-time updates (not currently used)**

**Symptoms:**
- Users don't see updates without manual refresh

**Fix:**
- Add Supabase Realtime subscriptions for critical tables
- Use optimistic UI updates (update UI before server confirms)
- Implement polling for non-critical updates

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Supabase Auth** | Email OTP via middleware | Already integrated - no changes needed |
| **Supabase Storage** | File attachments on QMRL/QMHQ | Already integrated - RLS policies in place |
| **Vercel Deployment** | Git push → auto-deploy | Already integrated - force-dynamic for SSR |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Page ↔ Supabase** | Direct client/server SDK | Server Components use createServerClient |
| **Client Component ↔ Server Action** | Not used (uses client SDK instead) | Could refactor to Server Actions for mutations |
| **Database ↔ RLS** | Automatic policy enforcement | Every query filtered by RLS |
| **Enum ↔ TypeScript** | Manual type definitions in /types/database.ts | Re-generate after enum migration |

### New Integration Points (Post-Changes)

| Component | Integrates With | Method |
|-----------|----------------|--------|
| **Flow Tracker Page** | `flow_tracking` VIEW | SELECT query in Server Component |
| **React Flow Canvas** | Browser-side rendering | Client Component with reactflow library |
| **Updated Permission Matrix** | RLS policies | Must stay in sync (3 roles) |
| **UI Audit Tool** | Codebase files | jscpd CLI tool (dev dependency) |

---

## Build Order Recommendations

### Phase 1: Foundation (Non-breaking changes)

**Week 1: UI Component Audit**
1. Install jscpd: `npm install -D jscpd`
2. Run audit: `npx jscpd app/ components/ --min-lines 5 --min-tokens 50`
3. Document findings in `.planning/research/UI_AUDIT.md`
4. Create new components in `/components/ui/composite/`
5. Update 2-3 pages as proof-of-concept

**Dependencies:** None
**Risk:** Low (new components, old code still works)

---

### Phase 2: Flow Tracking (Additive feature)

**Week 2: Database + Backend**
1. Create migration `063_flow_tracking_view.sql` (regular VIEW)
2. Add RLS policy for admin-only access
3. Test query performance with real data

**Week 3: Frontend**
1. Install React Flow: `npm install reactflow`
2. Create `/app/(dashboard)/admin/flow-tracker/page.tsx` (Server Component)
3. Create `/components/flow-tracker/flow-canvas.tsx` (Client Component)
4. Implement custom node components
5. Test with admin account

**Dependencies:** Phase 1 complete (for StatusBadge component reuse)
**Risk:** Low (new route, doesn't affect existing functionality)

---

### Phase 3: RBAC Simplification (Breaking change - requires maintenance window)

**Week 4: Preparation**
1. Write migration scripts (063_enum, 064_rls)
2. Write rollback script (065_rollback)
3. Create role mapping documentation
4. Update permission matrix in `/lib/hooks/use-permissions.ts`
5. Test on staging environment

**Week 5: Execution**
1. Schedule maintenance window (Saturday 2am, 30min)
2. Run migrations 063 + 064 atomically
3. Deploy frontend changes
4. Smoke test as admin/qmrl/qmhq users
5. Monitor error logs for 24h

**Dependencies:** Phase 1 + Phase 2 complete (minimize risk of compound failures)
**Risk:** HIGH (affects all users, all resources)

---

## Sources

### Architecture & Patterns
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Official Next.js 14 App Router patterns
- [Data Fetching Patterns and Best Practices](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns) - Server-first data fetching
- [React & Next.js Best Practices in 2026](https://fabwebstudio.com/blog/react-nextjs-best-practices-2026-performance-scale) - Current year best practices

### Database & RLS
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS implementation patterns
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) - Policy optimization
- [PostgreSQL ALTER TYPE Documentation](https://www.postgresql.org/docs/current/sql-altertype.html) - Official enum limitations
- [Updating Enum Values in PostgreSQL - The Safe and Easy Way](https://blog.yo1.dog/updating-enum-values-in-postgresql-the-safe-and-easy-way/) - Rename-create-migrate pattern
- [Managing Enums in Postgres | Supabase Docs](https://supabase.com/docs/guides/database/postgres/enums) - Enum vs table trade-offs

### Query Optimization
- [Querying Joins and Nested tables | Supabase Docs](https://supabase.com/docs/guides/database/joins-and-nesting) - Automatic join detection
- [PostgreSQL View vs Materialized View](https://www.dbvis.com/thetable/view-vs-materialized-view-in-databases-differences-and-use-cases/) - Performance comparison
- [Postgres Materialized Views: Basics, Tutorial, and Optimization Tips](https://www.epsio.io/blog/postgres-materialized-views-basics-tutorial-and-optimization-tips) - Refresh strategies

### Component Libraries
- [React Flow](https://reactflow.dev) - Node-based UI library for flow visualization
- [shadcn/ui - Design System](https://ui.shadcn.com/) - Component architecture pattern (similar to existing setup)
- [Radix UI](https://www.radix-ui.com/) - Primitives already in use

### Code Quality Tools
- [jscpd - npm](https://www.npmjs.com/package/jscpd) - Duplication detection for 150+ languages
- [jsinspect - GitHub](https://github.com/danielstjules/jsinspect) - AST-based structural similarity detection

---

*Architecture research for: QM System UI Standardization, Flow Tracking, and RBAC Overhaul*
*Researched: 2026-02-11*
*Confidence: HIGH (verified against existing codebase structure, official documentation, and 2026 best practices)*
