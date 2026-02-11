# Phase 39: End-to-End Flow Tracking - Research

**Researched:** 2026-02-11
**Domain:** Read-only admin dashboard with vertical timeline visualization for QMRL downstream chain
**Confidence:** HIGH

## Summary

Phase 39 builds an admin-only flow tracking page that visualizes the complete downstream chain from QMRL through all linked entities (QMRL → QMHQs → POs → Invoices → Stock). This is a read-only visualization page where admin searches by QMRL ID and sees the full chain. No editing, no new capabilities — just visibility into existing data relationships.

The technical approach centers on server-side data fetching using Next.js 14 App Router server components with sequential data loading, custom vertical timeline UI (no third-party timeline library), and PostgreSQL VIEW for efficient multi-level JOIN queries. The existing codebase already has strong patterns for timeline UI (ActivityTimeline), card-based displays (POCard), and status badges (ClickableStatusBadge) that can be adapted.

**Primary recommendation:** Use PostgreSQL VIEW with LEFT JOINs for the QMRL chain query, Next.js server components for data fetching, and custom timeline components built from existing patterns (no react-vertical-timeline-component library). Admin-only access enforced via RLS and route guard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chain Visualization:**
- Vertical timeline layout with top-to-bottom flow and connecting lines between nodes
- Branching handled with indented sub-timelines under parent nodes (e.g., multiple QMHQs indent under QMRL, multiple POs indent under QMHQ)
- Always fully expanded on load — no collapsible sections
- Clicking any node navigates to that entity's existing detail page (no inline previews)
- Each entity type has color-coded left border AND icon to distinguish node types
- QMHQ cards use different visual variants per route type (Item, Expense, PO) — distinct accent colors per route
- Stock-out request and execution combined into a single node (not separate)

**Search & Entry Point:**
- QMRL ID search only — single search box, exact match (no autocomplete/suggestions)
- Admin types full QMRL ID and hits enter to load the chain
- Empty state before search: clean page with search box and instructions ("Enter a QMRL ID to view its flow")
- Not-found case: inline error message below search box ("No QMRL found with this ID")

**Detail Density:**
- Each node shows: ID, status, all relevant dates, and all relevant people
- No financial amounts on nodes — admin clicks through to detail pages for that
- Dates: created date plus all entity-specific dates (e.g., PO delivery date, invoice due date)
- People: users shown with avatar + name; contact persons and suppliers shown as text names only (no avatars — only users have avatars in the system)
- QMRL root card: ID, title, status, dates, people (key fields, not full summary)
- QMHQ cards: ID, status, route type (via card variant), dates, people
- PO/Invoice cards: ID, status, dates, people (supplier as text name)
- Stock nodes: simple status indicator (Received/Pending/Executed)
- No summary section or aggregate stats at the top — the chain speaks for itself

**Status & Health Signals:**
- Use existing colored status badges from the app (same as list/detail pages) — no simplified indicators
- No warning icons or stalled/overdue alerts — admin interprets the chain
- Voided invoices and cancelled POs shown in the chain with strikethrough/faded styling (visible for audit trail)
- No overall flow status indicator — individual node statuses are sufficient

### Claude's Discretion

- Connector line style between nodes (solid, dashed, etc.)
- Specific color choices per entity type border
- Exact spacing and card sizing within the timeline
- How to handle very long chains (many QMHQs/POs) — scrolling behavior
- Loading state while chain data is fetched

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ | App Router with server components | Already in use, server-first data fetching ideal for read-only pages |
| Supabase | Current | PostgreSQL client and RLS | Existing database with all relationships established |
| PostgreSQL | Via Supabase | Database with VIEW for complex joins | Native support for recursive queries and multi-level JOINs |
| Tailwind CSS | Current | Styling with existing design tokens | Project standard, existing timeline patterns to adapt |
| TypeScript | Current | Type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Current | Icons for entity types | Existing in codebase, consistent icon system |
| date-fns | Current | Date formatting (formatDistanceToNow) | Already used in ActivityTimeline |
| None | N/A | Timeline library | **Don't use** - build custom from existing patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom timeline UI | react-vertical-timeline-component | Library adds dependency for simple vertical layout; existing ActivityTimeline pattern is sufficient |
| Custom timeline UI | React Chrono | Over-engineered for read-only display; existing patterns more maintainable |
| PostgreSQL VIEW | Client-side recursive fetch | VIEW performs multi-level JOINs in single query, reduces round trips |
| Regular VIEW | Materialized VIEW | Data changes frequently (QMRL/QMHQ updates), refresh overhead not justified for admin-only page |

**Installation:**
```bash
# No new packages needed - use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/
├── admin/
│   └── flow-tracking/
│       └── page.tsx                    # Main flow tracking page (server component)
components/
├── flow-tracking/
│   ├── flow-chain-timeline.tsx         # Timeline container (client component)
│   ├── flow-chain-node.tsx             # Base node component
│   ├── flow-qmrl-node.tsx              # QMRL-specific node
│   ├── flow-qmhq-node.tsx              # QMHQ-specific node (route variants)
│   ├── flow-po-node.tsx                # PO-specific node
│   ├── flow-invoice-node.tsx           # Invoice-specific node
│   ├── flow-stock-node.tsx             # Stock transaction node
│   ├── flow-connector-line.tsx         # Connecting line between nodes
│   ├── flow-search.tsx                 # QMRL ID search input
│   └── flow-empty-state.tsx            # Empty state before search
lib/
├── supabase/
│   └── flow-tracking-queries.ts        # Typed query functions
types/
└── flow-tracking.ts                    # Flow chain types
supabase/
└── migrations/
    └── 0XX_flow_tracking_view.sql      # VIEW definition
```

### Pattern 1: PostgreSQL VIEW for Multi-Level JOIN

**What:** Create a database VIEW that pre-joins QMRL → QMHQ → PO → Invoice → Stock relationships with all necessary fields for display.

**When to use:** For complex read-heavy queries where data relationships are fixed and query structure is predictable.

**Example:**
```sql
-- Source: Existing warehouse_inventory VIEW pattern from migration 024
CREATE OR REPLACE VIEW qmrl_flow_chain AS
SELECT
  qmrl.id as qmrl_id,
  qmrl.request_id as qmrl_request_id,
  qmrl.title as qmrl_title,
  qmrl.created_at as qmrl_created_at,
  qmrl.request_date as qmrl_request_date,

  -- QMRL status
  qmrl_status.id as qmrl_status_id,
  qmrl_status.name as qmrl_status_name,
  qmrl_status.color as qmrl_status_color,

  -- QMRL people
  qmrl_requester.id as qmrl_requester_id,
  qmrl_requester.full_name as qmrl_requester_name,
  qmrl_requester.avatar_url as qmrl_requester_avatar,
  qmrl_assigned.id as qmrl_assigned_id,
  qmrl_assigned.full_name as qmrl_assigned_name,
  qmrl_assigned.avatar_url as qmrl_assigned_avatar,

  -- QMHQ level
  qmhq.id as qmhq_id,
  qmhq.request_id as qmhq_request_id,
  qmhq.line_name as qmhq_line_name,
  qmhq.route_type as qmhq_route_type,
  qmhq.created_at as qmhq_created_at,

  -- QMHQ status
  qmhq_status.id as qmhq_status_id,
  qmhq_status.name as qmhq_status_name,
  qmhq_status.color as qmhq_status_color,

  -- QMHQ people
  qmhq_assigned.id as qmhq_assigned_id,
  qmhq_assigned.full_name as qmhq_assigned_name,
  qmhq_assigned.avatar_url as qmhq_assigned_avatar,
  qmhq_contact.name as qmhq_contact_name,

  -- PO level (only for PO route)
  po.id as po_id,
  po.po_number as po_number,
  po.status as po_status,
  po.po_date as po_date,
  po.expected_delivery_date as po_expected_delivery_date,
  po.created_at as po_created_at,
  po_supplier.name as po_supplier_name,

  -- Invoice level (via PO)
  invoice.id as invoice_id,
  invoice.invoice_number as invoice_number,
  invoice.status as invoice_status,
  invoice.invoice_date as invoice_date,
  invoice.due_date as invoice_due_date,
  invoice.is_voided as invoice_is_voided,
  invoice.created_at as invoice_created_at,

  -- Stock transaction (for item route and PO route)
  stock.id as stock_id,
  stock.movement_type as stock_movement_type,
  stock.status as stock_status,
  stock.transaction_date as stock_transaction_date,
  stock.created_at as stock_created_at

FROM qmrl
LEFT JOIN status_config qmrl_status ON qmrl.status_id = qmrl_status.id
LEFT JOIN users qmrl_requester ON qmrl.requester_id = qmrl_requester.id
LEFT JOIN users qmrl_assigned ON qmrl.assigned_to = qmrl_assigned.id

LEFT JOIN qmhq ON qmhq.qmrl_id = qmrl.id AND qmhq.is_active = true
LEFT JOIN status_config qmhq_status ON qmhq.status_id = qmhq_status.id
LEFT JOIN users qmhq_assigned ON qmhq.assigned_to = qmhq_assigned.id
LEFT JOIN contact_persons qmhq_contact ON qmhq.contact_person_id = qmhq_contact.id

LEFT JOIN purchase_orders po ON po.qmhq_id = qmhq.id AND po.is_active = true
LEFT JOIN suppliers po_supplier ON po.supplier_id = po_supplier.id

LEFT JOIN invoices invoice ON invoice.po_id = po.id AND invoice.is_active = true

LEFT JOIN inventory_transactions stock ON
  (stock.qmhq_id = qmhq.id AND qmhq.route_type = 'item') OR
  (stock.invoice_id = invoice.id AND qmhq.route_type = 'po')

WHERE qmrl.is_active = true
ORDER BY qmrl.created_at DESC, qmhq.created_at, po.po_date, invoice.invoice_date, stock.transaction_date;

-- Grant access to authenticated users (RLS policies will further restrict to admin)
GRANT SELECT ON qmrl_flow_chain TO authenticated;
```

**Why this pattern:**
- Single query fetches entire chain (no N+1 problem)
- All JOINs handled by database (optimized query planner)
- Type-safe with Supabase generated types
- Filtered by `is_active` to exclude soft-deleted records
- Includes voided/cancelled records (visible per user constraints)

### Pattern 2: Server Component Sequential Data Fetching

**What:** Use Next.js 14 server components to fetch data on the server, reducing client bundle size and enabling progressive rendering.

**When to use:** For read-only pages where data doesn't change during page view and doesn't depend on client state.

**Example:**
```typescript
// Source: Next.js official docs pattern
// app/(dashboard)/admin/flow-tracking/page.tsx

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FlowSearch } from '@/components/flow-tracking/flow-search';
import { FlowChainTimeline } from '@/components/flow-tracking/flow-chain-timeline';
import { FlowEmptyState } from '@/components/flow-tracking/flow-empty-state';

interface PageProps {
  searchParams: { qmrl_id?: string };
}

export default async function FlowTrackingPage({ searchParams }: PageProps) {
  const supabase = await createClient();

  // Check admin role (server-side auth)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userProfile?.role !== 'admin') {
    redirect('/dashboard'); // Non-admin cannot access
  }

  // If no search query, show empty state
  if (!searchParams.qmrl_id) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Flow Tracking</h1>
        <FlowSearch />
        <FlowEmptyState />
      </div>
    );
  }

  // Fetch flow chain from VIEW
  const { data: chainData, error } = await supabase
    .from('qmrl_flow_chain')
    .select('*')
    .eq('qmrl_request_id', searchParams.qmrl_id.toUpperCase());

  if (error || !chainData || chainData.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Flow Tracking</h1>
        <FlowSearch defaultValue={searchParams.qmrl_id} />
        <div className="mt-4 p-4 border border-red-500/20 bg-red-500/10 rounded-lg">
          <p className="text-red-400">No QMRL found with this ID</p>
        </div>
      </div>
    );
  }

  // Transform flat VIEW rows into nested chain structure
  const flowChain = transformViewToChain(chainData);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Flow Tracking</h1>
      <FlowSearch defaultValue={searchParams.qmrl_id} />
      <FlowChainTimeline chain={flowChain} />
    </div>
  );
}

// Transform flat VIEW rows into nested structure
function transformViewToChain(rows: any[]) {
  // Group by QMRL -> QMHQ -> PO -> Invoice -> Stock
  const qmrl = {
    id: rows[0].qmrl_id,
    request_id: rows[0].qmrl_request_id,
    title: rows[0].qmrl_title,
    status: {
      id: rows[0].qmrl_status_id,
      name: rows[0].qmrl_status_name,
      color: rows[0].qmrl_status_color,
    },
    requester: {
      id: rows[0].qmrl_requester_id,
      full_name: rows[0].qmrl_requester_name,
      avatar_url: rows[0].qmrl_requester_avatar,
    },
    // ... other QMRL fields
    qmhqs: [] as any[],
  };

  // Group QMHQs
  const qmhqMap = new Map();
  for (const row of rows) {
    if (!row.qmhq_id) continue;

    if (!qmhqMap.has(row.qmhq_id)) {
      qmhqMap.set(row.qmhq_id, {
        id: row.qmhq_id,
        request_id: row.qmhq_request_id,
        line_name: row.qmhq_line_name,
        route_type: row.qmhq_route_type,
        status: {
          id: row.qmhq_status_id,
          name: row.qmhq_status_name,
          color: row.qmhq_status_color,
        },
        // ... other QMHQ fields
        pos: [],
        financial_transactions: [],
        stock_transactions: [],
      });
    }

    const qmhq = qmhqMap.get(row.qmhq_id);

    // Add POs (only for PO route)
    if (row.po_id && !qmhq.pos.find((p: any) => p.id === row.po_id)) {
      qmhq.pos.push({
        id: row.po_id,
        po_number: row.po_number,
        status: row.po_status,
        // ... other PO fields
        invoices: [],
      });
    }

    // Add invoices to POs
    if (row.invoice_id) {
      const po = qmhq.pos.find((p: any) => p.id === row.po_id);
      if (po && !po.invoices.find((i: any) => i.id === row.invoice_id)) {
        po.invoices.push({
          id: row.invoice_id,
          invoice_number: row.invoice_number,
          status: row.invoice_status,
          is_voided: row.invoice_is_voided,
          // ... other invoice fields
        });
      }
    }

    // Add stock transactions
    if (row.stock_id && !qmhq.stock_transactions.find((s: any) => s.id === row.stock_id)) {
      qmhq.stock_transactions.push({
        id: row.stock_id,
        movement_type: row.stock_movement_type,
        status: row.stock_status,
        // ... other stock fields
      });
    }
  }

  qmrl.qmhqs = Array.from(qmhqMap.values());
  return qmrl;
}
```

**Why this pattern:**
- Data fetching happens server-side (faster, no client waterfalls)
- Admin auth check runs server-side (more secure than client check)
- Progressive rendering possible with Suspense boundaries
- No client-side data fetching library needed
- Type-safe with TypeScript

### Pattern 3: Custom Timeline UI (No Third-Party Library)

**What:** Build vertical timeline using existing ActivityTimeline pattern from dashboard, adapted for nested branching structure.

**When to use:** When existing patterns are sufficient and third-party library would add unnecessary complexity.

**Example:**
```typescript
// Source: Adapted from app/(dashboard)/dashboard/components/activity-timeline.tsx

'use client';

import { FlowQMRLNode } from './flow-qmrl-node';
import { FlowQMHQNode } from './flow-qmhq-node';
import { FlowPONode } from './flow-po-node';
import { FlowInvoiceNode } from './flow-invoice-node';
import { FlowStockNode } from './flow-stock-node';
import { FlowConnectorLine } from './flow-connector-line';

interface FlowChainTimelineProps {
  chain: {
    id: string;
    request_id: string;
    title: string;
    status: { id: string; name: string; color: string };
    requester: { id: string; full_name: string; avatar_url: string | null };
    assigned_to: { id: string; full_name: string; avatar_url: string | null } | null;
    created_at: string;
    request_date: string;
    qmhqs: Array<{
      id: string;
      request_id: string;
      line_name: string;
      route_type: 'item' | 'expense' | 'po';
      status: { id: string; name: string; color: string };
      assigned_to: { id: string; full_name: string; avatar_url: string | null } | null;
      contact_person: { name: string } | null;
      created_at: string;
      pos: Array<{
        id: string;
        po_number: string;
        status: string;
        po_date: string;
        expected_delivery_date: string | null;
        supplier: { name: string } | null;
        invoices: Array<{
          id: string;
          invoice_number: string;
          status: string;
          is_voided: boolean;
          invoice_date: string;
          due_date: string | null;
        }>;
      }>;
      stock_transactions: Array<{
        id: string;
        movement_type: string;
        status: string;
        transaction_date: string;
      }>;
      financial_transactions: Array<{
        id: string;
        transaction_type: string;
        amount: number;
        currency: string;
        transaction_date: string;
      }>;
    }>;
  };
}

export function FlowChainTimeline({ chain }: FlowChainTimelineProps) {
  return (
    <div className="mt-8">
      {/* Vertical timeline with left border line */}
      <ol className="relative border-l-2 border-slate-700 ml-3">

        {/* QMRL root node */}
        <li className="mb-6 ml-6">
          <FlowQMRLNode qmrl={chain} />
        </li>

        <FlowConnectorLine />

        {/* QMHQ branches */}
        {chain.qmhqs.length === 0 && (
          <li className="ml-6 text-slate-400 text-sm">No linked QMHQs</li>
        )}

        {chain.qmhqs.map((qmhq, qmhqIndex) => (
          <li key={qmhq.id} className="mb-6 ml-6">
            {/* Indent for branching */}
            <div className="ml-8 border-l-2 border-slate-700 pl-6">
              <FlowQMHQNode qmhq={qmhq} />

              {/* Route-specific children */}
              {qmhq.route_type === 'item' && qmhq.stock_transactions.length > 0 && (
                <>
                  <FlowConnectorLine />
                  {qmhq.stock_transactions.map((stock) => (
                    <div key={stock.id} className="mb-4">
                      <FlowStockNode stock={stock} />
                    </div>
                  ))}
                </>
              )}

              {qmhq.route_type === 'expense' && qmhq.financial_transactions.length > 0 && (
                <>
                  <FlowConnectorLine />
                  {qmhq.financial_transactions.map((ft) => (
                    <div key={ft.id} className="mb-4 text-sm text-slate-400">
                      Financial Transaction: {ft.transaction_type} - {ft.amount} {ft.currency}
                    </div>
                  ))}
                </>
              )}

              {qmhq.route_type === 'po' && qmhq.pos.length > 0 && (
                <>
                  <FlowConnectorLine />
                  {qmhq.pos.map((po) => (
                    <div key={po.id} className="mb-6 ml-8 border-l-2 border-slate-700 pl-6">
                      <FlowPONode po={po} />

                      {/* Invoices under PO */}
                      {po.invoices.length > 0 && (
                        <>
                          <FlowConnectorLine />
                          {po.invoices.map((invoice) => (
                            <div key={invoice.id} className="mb-6 ml-8 border-l-2 border-slate-700 pl-6">
                              <FlowInvoiceNode invoice={invoice} />

                              {/* Stock under invoice */}
                              {qmhq.stock_transactions
                                .filter((s) => s.invoice_id === invoice.id)
                                .map((stock) => (
                                  <div key={stock.id} className="mt-4">
                                    <FlowStockNode stock={stock} />
                                  </div>
                                ))}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

**Why this pattern:**
- Leverages existing ActivityTimeline CSS structure
- No third-party dependencies to maintain
- Flexible for custom branching logic
- Consistent with existing codebase patterns

### Pattern 4: Entity Type Node Components with Border Color Variants

**What:** Create distinct node components per entity type with color-coded left borders and icons.

**When to use:** When entity types have different data shapes and display requirements.

**Example:**
```typescript
// components/flow-tracking/flow-qmhq-node.tsx

'use client';

import Link from 'next/link';
import { ClipboardList, User, Building2, Calendar } from 'lucide-react';
import { ClickableStatusBadge } from '@/components/status/clickable-status-badge';
import { cn } from '@/lib/utils';

interface FlowQMHQNodeProps {
  qmhq: {
    id: string;
    request_id: string;
    line_name: string;
    route_type: 'item' | 'expense' | 'po';
    status: { id: string; name: string; color: string };
    assigned_to: { id: string; full_name: string; avatar_url: string | null } | null;
    contact_person: { name: string } | null;
    created_at: string;
  };
}

// Route type variant colors
const routeTypeColors = {
  item: 'border-blue-500',    // Item route: Blue accent
  expense: 'border-green-500', // Expense route: Green accent
  po: 'border-purple-500',     // PO route: Purple accent
};

export function FlowQMHQNode({ qmhq }: FlowQMHQNodeProps) {
  const borderColor = routeTypeColors[qmhq.route_type];

  return (
    <Link
      href={`/qmhq/${qmhq.id}`}
      className="block"
    >
      <div
        className={cn(
          "rounded-lg border-l-4 bg-slate-900/50 p-4 transition-all hover:bg-slate-800/50",
          borderColor
        )}
      >
        {/* Circle on timeline line */}
        <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 ring-4 ring-slate-900">
          <ClipboardList className="h-3 w-3 text-amber-400" />
        </span>

        {/* Header with ID and status */}
        <div className="flex items-center justify-between mb-2">
          <code className="text-xs text-amber-400">{qmhq.request_id}</code>
          <ClickableStatusBadge
            status={qmhq.status}
            entityType="qmhq"
            entityId={qmhq.id}
            isClickable={false}
          />
        </div>

        {/* Line name */}
        <h4 className="text-sm font-medium text-slate-200 mb-2">
          {qmhq.line_name}
        </h4>

        {/* Route type badge */}
        <div className="mb-3">
          <span className={cn(
            "inline-block px-2 py-1 rounded text-xs font-medium uppercase",
            qmhq.route_type === 'item' && "bg-blue-500/10 text-blue-400",
            qmhq.route_type === 'expense' && "bg-green-500/10 text-green-400",
            qmhq.route_type === 'po' && "bg-purple-500/10 text-purple-400"
          )}>
            {qmhq.route_type}
          </span>
        </div>

        {/* People and dates */}
        <div className="space-y-1 text-xs text-slate-400">
          {qmhq.assigned_to && (
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span>Assigned: {qmhq.assigned_to.full_name}</span>
            </div>
          )}
          {qmhq.contact_person && (
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              <span>Contact: {qmhq.contact_person.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span>Created: {new Date(qmhq.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

**Why this pattern:**
- Color-coded borders distinguish entity types at a glance
- Route type variants use distinct accent colors (user constraint)
- Consistent with existing card patterns (POCard, etc.)
- Clicking navigates to detail page (user constraint)

### Pattern 5: RLS Policy for Admin-Only Access

**What:** Create RLS policy on qmrl_flow_chain VIEW to restrict SELECT to admin role only.

**When to use:** When database-level access control is required for views.

**Example:**
```sql
-- Enable RLS on VIEW (requires PostgreSQL 9.5+)
ALTER VIEW qmrl_flow_chain SET (security_invoker = true);

-- Policy: Only admin role can SELECT from flow chain view
CREATE POLICY "Admin can view flow chain"
  ON qmrl_flow_chain
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

**Why this pattern:**
- Database-level enforcement (cannot bypass via API)
- Consistent with existing RLS patterns in codebase
- Admin role check reuses existing users.role column

### Anti-Patterns to Avoid

- **Fetching chain data client-side with multiple queries**: Creates N+1 problem and exposes unnecessary data to client. Use server components with VIEW instead.

- **Using third-party timeline library**: Adds dependency for simple vertical layout. Existing ActivityTimeline pattern is sufficient.

- **Collapsible sections in timeline**: User constraint specifies "always fully expanded on load". Don't build collapse/expand UI.

- **Inline entity editing**: User constraint specifies "clicking any node navigates to detail page". Don't build inline edit forms.

- **Financial amounts on timeline nodes**: User constraint specifies "no financial amounts on nodes". Don't display currency values.

- **Warning icons or health alerts**: User constraint specifies "no warning icons or stalled/overdue alerts". Don't build status interpretation logic.

- **Using Materialized VIEW**: Data changes frequently (QMRL/QMHQ updates), refresh overhead not justified for admin-only read page. Use regular VIEW.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-level database joins | Client-side recursive fetching with multiple queries | PostgreSQL VIEW with LEFT JOINs | Handles complex join logic, query optimization, and reduces round trips |
| Date formatting | Custom date formatter | date-fns (already in codebase) | Handles localization, relative dates ("2 days ago"), edge cases |
| Status badge rendering | Custom badge component | ClickableStatusBadge with isClickable=false | Reuses existing status color/styling logic |
| User avatar display | Custom avatar component | Extract pattern from CommentCard | Already handles null avatar_url, consistent sizing |
| Route protection | Client-side role check | Server-side auth check + RLS | More secure, cannot be bypassed |

**Key insight:** The codebase already has strong patterns for every piece needed (timeline UI, status badges, card displays, server auth). Don't reinvent — adapt existing components with new entity-specific data shapes.

## Common Pitfalls

### Pitfall 1: N+1 Query Problem with Nested Data

**What goes wrong:** Fetching QMRL, then looping QMHQs to fetch POs, then looping POs to fetch invoices creates exponential query count.

**Why it happens:** Natural instinct to fetch parent first, then children sequentially.

**How to avoid:** Use PostgreSQL VIEW to perform all JOINs in single query. VIEW returns flat rows that you transform into nested structure in application code.

**Warning signs:**
- Query count scales with chain depth (1 QMRL + N QMHQs + M POs + K invoices = 1+N+M+K queries)
- Slow page load for QMRLs with many children
- Repeated similar queries in server logs

### Pitfall 2: VIEW Returns NULL-Heavy Flat Rows

**What goes wrong:** LEFT JOINs create cartesian product with many NULL columns. For example, QMRL with 3 QMHQs but only 1 has PO creates 3 rows where 2 have NULL po_id.

**Why it happens:** SQL JOINs create row per combination, not nested structure.

**How to avoid:** Write transformation function that groups rows by primary keys (qmrl_id → qmhq_id → po_id → invoice_id). Use Map to deduplicate.

**Warning signs:**
- Duplicate QMRL data in multiple rows
- Array.find() in tight loops during transformation
- Memory usage scales with chain size

**Solution pattern:**
```typescript
// Use Map for O(1) lookups during grouping
const qmhqMap = new Map<string, any>();
for (const row of rows) {
  if (!row.qmhq_id) continue;

  if (!qmhqMap.has(row.qmhq_id)) {
    qmhqMap.set(row.qmhq_id, {
      id: row.qmhq_id,
      // ... initialize structure
      pos: [],
    });
  }

  const qmhq = qmhqMap.get(row.qmhq_id)!;

  // Add PO only if not already added
  if (row.po_id && !qmhq.pos.find((p: any) => p.id === row.po_id)) {
    qmhq.pos.push({ id: row.po_id, /* ... */ });
  }
}
```

### Pitfall 3: Timeline Rendering Performance with Deep Chains

**What goes wrong:** QMRL with 50 QMHQs, each with 5 POs, each with 3 invoices creates 750+ DOM nodes. Page scrolling becomes janky.

**Why it happens:** React renders entire tree on mount, browser lays out all nodes immediately.

**How to avoid:** Use virtualization for very long chains OR accept performance limitation (admin-only page, rare usage). Consider pagination if chain regularly exceeds 100 nodes.

**Warning signs:**
- Slow initial render (>2 seconds)
- Janky scrolling
- High memory usage in browser DevTools

**Recommended solution:** Accept limitation for MVP. Add virtualization (react-window) only if becomes actual problem.

### Pitfall 4: Voided/Cancelled Entities Not Visually Distinct

**What goes wrong:** Admin cannot distinguish voided invoice from active invoice without reading status carefully.

**Why it happens:** Forgot user constraint "voided invoices and cancelled POs shown with strikethrough/faded styling".

**How to avoid:** Add opacity-50 and line-through classes to voided/cancelled nodes. Test with voided invoice in chain.

**Warning signs:**
- QA feedback: "Hard to see which invoices are voided"
- User confusion about chain state

**Solution pattern:**
```typescript
<div className={cn(
  "rounded-lg border-l-4 bg-slate-900/50 p-4",
  invoice.is_voided && "opacity-50 line-through"
)}>
  {/* ... content */}
</div>
```

### Pitfall 5: Server Component vs Client Component Boundary

**What goes wrong:** Making entire timeline a server component prevents interactive features like hover states, animations.

**Why it happens:** Next.js 14 defaults to server components, easy to forget client interactivity needs.

**How to avoid:** Make page.tsx a server component (fetches data), pass data as props to client component timeline (handles interactivity). Use 'use client' directive only where needed.

**Warning signs:**
- "Cannot use useState in server component" errors
- Hover effects don't work
- Cannot use onClick handlers

**Solution pattern:**
```typescript
// app/(dashboard)/admin/flow-tracking/page.tsx (server component)
export default async function FlowTrackingPage({ searchParams }: PageProps) {
  const chain = await fetchFlowChain(searchParams.qmrl_id);
  return <FlowChainTimeline chain={chain} />; // Pass to client component
}

// components/flow-tracking/flow-chain-timeline.tsx (client component)
'use client';

export function FlowChainTimeline({ chain }: Props) {
  // Can now use useState, onClick, etc.
  return <div>{/* ... */}</div>;
}
```

## Code Examples

Verified patterns from existing codebase:

### Status Badge Rendering (Read-Only)

```typescript
// Source: components/status/clickable-status-badge.tsx
import { Badge } from '@/components/ui/badge';

// Non-clickable status badge (isClickable=false enforced)
<Badge
  variant="outline"
  className="font-mono uppercase tracking-wider text-xs"
  style={{
    borderColor: status.color || undefined,
    color: status.color || undefined,
    backgroundColor: `${status.color}15` || "transparent",
  }}
>
  {status.name}
</Badge>
```

### User Avatar with Name Display

```typescript
// Source: Adapted from components/comments/comment-card.tsx pattern
interface UserDisplayProps {
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

function UserDisplay({ user }: UserDisplayProps) {
  return (
    <div className="flex items-center gap-2">
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.full_name}
          className="h-6 w-6 rounded-full"
        />
      ) : (
        <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center">
          <span className="text-xs text-slate-300">
            {user.full_name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <span className="text-sm text-slate-200">{user.full_name}</span>
    </div>
  );
}
```

### Timeline Connector Line

```typescript
// Source: Adapted from app/(dashboard)/dashboard/components/activity-timeline.tsx
export function FlowConnectorLine() {
  return (
    <div className="relative ml-3 py-2">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-700" />
    </div>
  );
}
```

### QMRL ID Search with URL State

```typescript
// components/flow-tracking/flow-search.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

interface FlowSearchProps {
  defaultValue?: string;
}

export function FlowSearch({ defaultValue = '' }: FlowSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [qmrlId, setQmrlId] = useState(defaultValue);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qmrlId.trim()) return;

    // Update URL with search param
    router.push(`/admin/flow-tracking?qmrl_id=${encodeURIComponent(qmrlId.trim())}`);
  };

  return (
    <form onSubmit={handleSearch} className="mb-6">
      <div className="relative">
        <input
          type="text"
          value={qmrlId}
          onChange={(e) => setQmrlId(e.target.value.toUpperCase())}
          placeholder="Enter QMRL ID (e.g., QMRL-2026-00001)"
          className="w-full px-4 py-3 pl-12 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
      </div>
    </form>
  );
}
```

### Server-Side Admin Role Check

```typescript
// Source: Adapted from existing RLS patterns
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function checkAdminRole() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userProfile?.role !== 'admin') {
    redirect('/dashboard');
  }

  return user;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side data fetching with React Query | Next.js 14 server components | 2023 (Next.js 13 stable) | Faster initial page load, reduced client bundle, better SEO |
| Recursive client-side fetching for nested data | PostgreSQL VIEWs with complex JOINs | Always best practice | Single query instead of N+1, database-optimized joins |
| react-vertical-timeline-component | Custom timeline components | Ongoing | Reduced dependencies, better customization, consistent with codebase patterns |
| Client-side role checks | Server-side + RLS | 2024 (Supabase RLS maturity) | More secure, cannot be bypassed via API |
| Materialized VIEWs for read-heavy queries | Regular VIEWs for frequently updated data | Always best practice | Avoid refresh overhead for data that changes often |

**Deprecated/outdated:**
- **getServerSideProps**: Replaced by server components in Next.js 14 App Router. Don't use for new pages.
- **useEffect for data fetching in server-renderable pages**: Use server components instead. Client-side fetching adds unnecessary client bundle and slows initial render.

## Open Questions

1. **VIEW Performance with Large Chains**
   - What we know: LEFT JOINs create cartesian product, can be slow for QMRLs with many children
   - What's unclear: Performance threshold (how many QMHQs/POs before query becomes slow)
   - Recommendation: Implement VIEW, test with realistic data. Add EXPLAIN ANALYZE to migration. Consider adding LIMIT to VIEW if performance becomes issue.

2. **Stock Transaction Display for Combined Node**
   - What we know: User constraint specifies "stock-out request and execution combined into a single node"
   - What's unclear: If stock_out_approval and inventory_transaction are separate DB records, how to display as single node
   - Recommendation: Query both tables in VIEW, display approval status + execution status in same card. Show "Requested" if approval exists, "Executed" if transaction completed.

3. **Handling Very Long Chains (100+ Nodes)**
   - What we know: Timeline renders all nodes on mount
   - What's unclear: If admin will actually create QMRLs with 100+ downstream entities
   - Recommendation: Start without virtualization. Add react-window if QA reports performance issues. Admin pages have lower performance expectations than user-facing pages.

4. **Financial Transaction Display for Expense Route**
   - What we know: User constraint specifies no financial amounts on nodes
   - What's unclear: If expense route shows financial transaction count or nothing
   - Recommendation: Show simple indicator "X transactions" without amounts. Click to QMHQ detail page for amounts.

## Sources

### Primary (HIGH confidence)
- Next.js 14 official docs: [Data Fetching Patterns](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns)
- Supabase RLS docs: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Supabase PostgreSQL docs: [Querying Joins and Nested tables](https://supabase.com/docs/guides/database/joins-and-nesting)
- Existing codebase: ActivityTimeline component (`app/(dashboard)/dashboard/components/activity-timeline.tsx`)
- Existing codebase: POCard component (`components/po/po-card.tsx`)
- Existing codebase: ClickableStatusBadge component (`components/status/clickable-status-badge.tsx`)
- Existing codebase: warehouse_inventory VIEW (`supabase/migrations/024_inventory_wac_trigger.sql`)

### Secondary (MEDIUM confidence)
- PostgreSQL CTEs: [Stop Spaghetti SQL with Postgres CTEs in Supabase](https://blog.ivankahl.com/stop-spaghetti-sql-simplify-complex-queries-with-postgres-ctes-in-supabase/)
- Next.js 15 patterns: [Advanced Patterns for 2026](https://johal.in/next-js-15-advanced-patterns-app-router-server-actions-and-caching-strategies-for-2026/)
- Supabase RLS best practices: [Production Patterns for Secure Apps](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

### Tertiary (LOW confidence)
- React timeline libraries survey: [npm react-vertical-timeline-component](https://www.npmjs.com/package/react-vertical-timeline-component), [Material UI Timeline](https://mui.com/material-ui/react-timeline/) - reviewed but NOT recommended for use
- PostgreSQL VIEW performance: General knowledge from PostgreSQL docs, not specific to Supabase context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Patterns adapted from existing codebase (ActivityTimeline, warehouse_inventory VIEW)
- Pitfalls: HIGH - Based on verified Supabase/Next.js best practices and existing codebase patterns
- Open questions: MEDIUM - Performance thresholds require testing with production data

**Research date:** 2026-02-11
**Valid until:** 30 days (stable tech stack, no fast-moving dependencies)
