# Phase 33: Dual Reference Display - Research

**Researched:** 2026-02-11
**Domain:** UI enhancement for transaction reference display and cross-entity navigation
**Confidence:** HIGH

## Summary

Phase 33 enhances stock-out transaction reference display by showing both the SOR approval number (primary reference) and parent QMHQ ID (secondary reference) on transaction rows and in the QMHQ item detail view. This is purely a UI presentation enhancement building on the qmhq_id FK link established in Phase 32.

The core integration points are:
1. `components/qmhq/sor-transaction-group.tsx` — Individual transaction rows need to show approval number prominently
2. `app/(dashboard)/qmhq/[id]/page.tsx` — Stock Out tab query already fetches approval.approval_number (Phase 32)
3. QMHQ item detail page needs a dedicated "Linked Transactions" table showing stock-out executions

No database schema changes required. All necessary data relationships exist: inventory_transaction → stock_out_approval → line_item → request + qmhq_id FK.

**Primary recommendation:** Enhance transaction rows to display approval_number as primary reference badge, add QMHQ ID as secondary "via QMHQ-XXXX" text with clickable link, and implement a new component for QMHQ item detail showing linked transactions table.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ (App Router) | Frontend framework | Project standard per CLAUDE.md |
| React | 18+ | UI library | Next.js dependency |
| TypeScript | 5+ | Type safety | Project standard |
| Supabase | Latest | Database client | Project standard for PostgreSQL access |
| Tailwind CSS | 3+ | Styling | Project standard per CLAUDE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | 0.447.0 | Icons (ExternalLink, Package, etc.) | Already in use project-wide |
| cn (class-variance-authority) | Latest | Conditional classes | Already in @/lib/utils |
| Next.js Link | 14+ | Client-side navigation | Standard for internal links |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline approval number display | Separate modal/tooltip | User decision: show directly on transaction row for scanability |
| Custom link component | Plain anchor tags | Next.js Link provides prefetching and better performance |
| Manual badge styling | react-badge library | Project already has standardized Badge component from shadcn/ui |

**Installation:**
```bash
# No new dependencies required — all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure

```
app/(dashboard)/qmhq/[id]/
  └── page.tsx                          # MODIFY: Add qmhq_id to query for reverse lookup

components/qmhq/
  └── sor-transaction-group.tsx         # MODIFY: Show approval_number and QMHQ link
  └── qmhq-linked-transactions.tsx      # NEW: Table for QMHQ item detail

app/(dashboard)/inventory/stock-out-requests/[id]/
  └── page.tsx                          # Already queries approval_number (no changes)
```

### Pattern 1: Approval Number Display on Transaction Rows

**What:** Show stock_out_approval.approval_number (e.g., "SOR-2026-00001-A01") as a primary reference badge on each transaction row.

**When to use:** In QMHQ Stock Out tab transaction lists and anywhere inventory_out transactions are displayed.

**Current State:**
```typescript
// Phase 32 query already fetches approval_number
const { data: stockOutData } = await supabase
  .from('inventory_transactions')
  .select(`
    *,
    stock_out_approval:stock_out_approvals(
      id,
      approval_number,      // ✓ Already fetched
      line_item:stock_out_line_items(...)
    )
  `)
```

**Enhancement Needed:**
```typescript
// components/qmhq/sor-transaction-group.tsx
<div className="flex items-baseline gap-2">
  {/* Primary reference: Approval number */}
  <Badge variant="outline" className="font-mono text-xs border-amber-500/30 text-amber-400">
    {transaction.approval_number || "No Approval"}
  </Badge>

  {/* Item details */}
  <span className="text-sm text-slate-200">
    {transaction.item?.name}
  </span>

  {transaction.item?.sku && (
    <span className="text-xs font-mono text-slate-400">
      {transaction.item.sku}
    </span>
  )}
</div>
```

**Source:** Adapted from existing Badge usage in sor-transaction-group.tsx (line 57).

**Confidence:** HIGH — Badge component already in use, approval_number already fetched.

### Pattern 2: Secondary QMHQ Reference with Clickable Link

**What:** Show "via QMHQ-YYYY-NNNNN" as secondary reference below approval number, with Link to QMHQ detail page.

**When to use:** On transaction rows where qmhq_id is NOT NULL (QMHQ-linked stock-outs, not manual ones).

**Implementation Pattern:**
```typescript
// Add qmhq lookup to query (Phase 32 query modification)
const { data: stockOutData } = await supabase
  .from('inventory_transactions')
  .select(`
    *,
    item:items(id, name, sku),
    warehouse:warehouses(id, name),
    stock_out_approval:stock_out_approvals(
      approval_number,
      line_item:stock_out_line_items(
        request:stock_out_requests(request_number, status)
      )
    ),
    qmhq:qmhq!inventory_transactions_qmhq_id_fkey(id, request_id)  // NEW
  `)
  .eq('qmhq_id', qmhqData.id)
  .eq('movement_type', 'inventory_out');

// Render in transaction row
{transaction.qmhq && (
  <div className="text-xs text-slate-400 mt-1">
    via{" "}
    <Link
      href={`/qmhq/${transaction.qmhq.id}`}
      className="text-blue-400 hover:text-blue-300 font-mono"
    >
      {transaction.qmhq.request_id}
      <ExternalLink className="inline w-3 h-3 ml-1" />
    </Link>
  </div>
)}
```

**Source:** Pattern derived from existing QMHQ detail page parent QMRL link (app/(dashboard)/qmhq/[id]/page.tsx lines 554-560).

**Confidence:** HIGH — Follows established link pattern from codebase.

### Pattern 3: QMHQ Item Detail Linked Transactions Table

**What:** New component showing stock-out transactions linked to this QMHQ in a dedicated table on QMHQ item detail view.

**When to use:** In QMHQ detail page to satisfy LINK-02 requirement ("QMHQ item detail shows linked stock-out transactions").

**Visual Structure:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ Linked Stock-Out Transactions                                           │
├───────────────────────┬─────────────────┬──────────┬──────────┬────────┤
│ Reference             │ Item            │ Qty      │ Status   │ Date   │
├───────────────────────┼─────────────────┼──────────┼──────────┼────────┤
│ SOR-2026-00001-A01    │ Widget A (W001) │ 10       │ ✓ Done   │ Jan 15 │
│ via QMHQ-2026-00042   │                 │          │          │        │
├───────────────────────┼─────────────────┼──────────┼──────────┼────────┤
│ SOR-2026-00002-A01    │ Widget B (W002) │ 5        │ ⏳ Pending│ Jan 16 │
│ via QMHQ-2026-00042   │                 │          │          │        │
└───────────────────────┴─────────────────┴──────────┴──────────┴────────┘
```

**Implementation Pattern:**
```typescript
// components/qmhq/qmhq-linked-transactions.tsx (NEW)
interface QmhqLinkedTransactionsProps {
  qmhqId: string;
  qmhqRequestId: string;
}

export function QmhqLinkedTransactions({ qmhqId, qmhqRequestId }: QmhqLinkedTransactionsProps) {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('inventory_transactions')
        .select(`
          id,
          quantity,
          status,
          transaction_date,
          created_at,
          item:items(name, sku),
          warehouse:warehouses(name),
          stock_out_approval:stock_out_approvals(
            approval_number,
            line_item:stock_out_line_items(
              request:stock_out_requests(id, request_number)
            )
          )
        `)
        .eq('qmhq_id', qmhqId)
        .eq('movement_type', 'inventory_out')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setTransactions(data || []);
    };

    fetchTransactions();
  }, [qmhqId]);

  return (
    <div className="command-panel">
      <h3 className="text-lg font-semibold mb-4">Linked Stock-Out Transactions</h3>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          No stock-out transactions linked to this QMHQ yet
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 text-xs text-slate-400">Reference</th>
              <th className="text-left py-2 text-xs text-slate-400">Item</th>
              <th className="text-right py-2 text-xs text-slate-400">Qty</th>
              <th className="text-left py-2 text-xs text-slate-400">Status</th>
              <th className="text-left py-2 text-xs text-slate-400">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-b border-slate-700/50">
                <td className="py-3">
                  {/* Primary: Approval number */}
                  <div className="font-mono text-sm text-amber-400">
                    {tx.stock_out_approval?.approval_number || "—"}
                  </div>
                  {/* Secondary: QMHQ ID */}
                  <div className="text-xs text-slate-400 mt-1">
                    via{" "}
                    <span className="font-mono text-blue-400">
                      {qmhqRequestId}
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  <div className="text-sm text-slate-200">{tx.item?.name}</div>
                  {tx.item?.sku && (
                    <div className="text-xs font-mono text-slate-400">{tx.item.sku}</div>
                  )}
                </td>
                <td className="py-3 text-right font-mono text-slate-200">{tx.quantity}</td>
                <td className="py-3">
                  <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                    {tx.status}
                  </Badge>
                </td>
                <td className="py-3 text-sm text-slate-400">
                  {new Date(tx.transaction_date || tx.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

**Source:** Table structure inspired by existing line item tables in po-detail, invoice-detail, and line-item-table.tsx.

**Confidence:** MEDIUM — New component but follows established table patterns from PO/Invoice modules.

### Anti-Patterns to Avoid

- **Showing QMHQ link on manual stock-outs:** Don't render "via QMHQ-XXX" when qmhq_id is NULL (manual requests have no parent QMHQ).
- **Hardcoding QMHQ URL construction:** Use qmhq.id for link href, not request_id. ID is the database PK, request_id is just display.
- **Fetching QMHQ data when not needed:** Transaction row only needs qmhq.request_id for display. Don't join full QMHQ entity unless displaying detail page.
- **Duplicate transaction display:** QMHQ detail already shows transactions in Stock Out tab (SOR-grouped). New linked transactions table is for item detail view ONLY, not QMHQ detail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table styling | Custom table CSS | Existing command-panel + Tailwind table classes | Consistency with PO/Invoice tables |
| Link hover states | Custom :hover styles | Existing link pattern (text-blue-400 hover:text-blue-300) | Project-wide consistency |
| Badge styling | Hardcoded colors | Existing Badge component with variants | Already handles status colors |
| Empty state messaging | Hardcoded strings | Follow pattern from QMHQ Stock Out empty state | Consistent UX |

**Key insight:** The project has strong established patterns for:
- Reference display (font-mono + color coding)
- Entity linking (Next.js Link + ExternalLink icon)
- Status badges (Badge component with conditional classes)
- Empty states (icon + heading + message structure)

Reuse these patterns rather than creating new visual language.

## Common Pitfalls

### Pitfall 1: approval_number NULL for Legacy Transactions

**What goes wrong:** Transactions created before Phase 27 (SOR implementation) have NULL stock_out_approval_id, so approval_number doesn't exist.

**Why it happens:** Approval workflow was added later. Historical transactions were created via old auto-stock-out trigger (migration 034, now deprecated).

**How to avoid:**
1. Always handle NULL case: `approval_number || "Manual Stock-Out"`
2. Don't crash UI when approval join returns NULL
3. Show fallback badge with different styling for legacy transactions

**Warning signs:** Transaction rows show blank space where approval number should be; console errors about NULL property access.

**Verification:**
```sql
-- Check for transactions without approval link
SELECT COUNT(*)
FROM inventory_transactions
WHERE movement_type = 'inventory_out'
  AND stock_out_approval_id IS NULL
  AND qmhq_id IS NOT NULL;
```

**Confidence:** HIGH — Known legacy data issue from Phase 32 research.

### Pitfall 2: Circular Navigation (QMHQ → SOR → QMHQ)

**What goes wrong:** User navigates QMHQ detail → clicks SOR link → clicks "via QMHQ-XXX" link → back to same QMHQ detail → infinite loop UX.

**Why it happens:** Both entities link to each other, creating natural circular reference.

**How to avoid:**
1. Make "via QMHQ-XXX" link visually distinct (secondary/muted styling)
2. On QMHQ detail page, suppress "via QMHQ-XXX" link (since user is already there)
3. Use `useParams()` to detect current page context and conditionally render link

**Warning signs:** User feedback about confusing navigation; link points to current page.

**Implementation:**
```typescript
// In sor-transaction-group.tsx
interface SORTransactionGroupProps {
  currentQmhqId?: string;  // NEW: Optional context
  // ... other props
}

// Only show link if not on the QMHQ's own detail page
{transaction.qmhq && transaction.qmhq.id !== currentQmhqId && (
  <Link href={`/qmhq/${transaction.qmhq.id}`}>
    via {transaction.qmhq.request_id}
  </Link>
)}
```

**Confidence:** MEDIUM — Common navigation pattern issue; conditional rendering is standard solution.

### Pitfall 3: Stale Transaction List After Execution

**What goes wrong:** User executes stock-out from SOR detail page → navigates to QMHQ detail → linked transactions table doesn't show new execution.

**Why it happens:** QMHQ detail page was loaded before execution, component doesn't refetch on navigation.

**How to avoid:**
1. Use URL param `?updated=timestamp` pattern (already used in QMHQ detail page line 131)
2. Refetch transactions on param change via useEffect dependency
3. Or: use React Query / SWR for automatic cache invalidation

**Warning signs:** User reports "transaction not showing" immediately after execution; requires page refresh to see update.

**Existing Solution:**
```typescript
// app/(dashboard)/qmhq/[id]/page.tsx already implements this
const updatedParam = searchParams.get("updated");

useEffect(() => {
  if (qmhqId) {
    fetchData();  // Refetches when updatedParam changes
  }
}, [qmhqId, fetchData, updatedParam]);  // updatedParam in deps
```

**Confidence:** HIGH — Pattern already implemented in Phase 32; just extend to new component.

### Pitfall 4: Missing ExternalLink Icon Causes Layout Shift

**What goes wrong:** Link text jumps/shifts when ExternalLink icon loads or on hover.

**Why it happens:** Icon added inline without reserving space; hover state changes dimensions.

**How to avoid:**
1. Use fixed icon size: `className="w-3 h-3"`
2. Reserve space with inline-flex: `className="inline-flex items-center gap-1"`
3. Don't change icon size on hover

**Warning signs:** Links visibly shift when hovering; layout "jumps" on first render.

**Correct Implementation:**
```typescript
<Link
  href={`/qmhq/${qmhqId}`}
  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
>
  <span className="font-mono">{qmhq.request_id}</span>
  <ExternalLink className="w-3 h-3" />
</Link>
```

**Source:** Existing pattern in sor-transaction-group.tsx (line 50-55).

**Confidence:** HIGH — Common React layout issue; established fix in codebase.

### Pitfall 5: Table Column Misalignment on Small Screens

**What goes wrong:** Linked transactions table columns overflow or break alignment on mobile/tablet.

**Why it happens:** Fixed column widths don't adapt to smaller screens; too many columns for narrow viewport.

**How to avoid:**
1. Use responsive grid instead of table on mobile: `hidden md:table` + alternate card view
2. Truncate/hide less critical columns (e.g., warehouse) on small screens
3. Make table horizontally scrollable: `overflow-x-auto`

**Warning signs:** Table extends beyond screen width; horizontal scrollbar appears; columns squished unreadably.

**Implementation:**
```typescript
// Desktop: table view
<div className="hidden md:block overflow-x-auto">
  <table className="w-full">{/* ... */}</table>
</div>

// Mobile: card view
<div className="md:hidden space-y-3">
  {transactions.map((tx) => (
    <div key={tx.id} className="border rounded-lg p-3">
      {/* Card layout */}
    </div>
  ))}
</div>
```

**Source:** Responsive pattern from existing table components in project.

**Confidence:** MEDIUM — Standard responsive design approach; may need user feedback on mobile UX.

## Code Examples

Verified patterns from official sources and existing codebase:

### Example 1: Enhanced Transaction Row with Dual References

```typescript
// components/qmhq/sor-transaction-group.tsx (ENHANCED)
interface Transaction {
  id: string;
  quantity: number;
  status: string;
  created_at: string;
  transaction_date?: string | null;
  item?: { id: string; name: string; sku: string | null } | null;
  warehouse?: { id: string; name: string } | null;
  approval_number?: string | null;  // NEW: from stock_out_approval
  qmhq?: { id: string; request_id: string } | null;  // NEW: from qmhq FK
}

export function SORTransactionGroup({
  sorId,
  sorNumber,
  sorStatus,
  totalQty,
  transactions,
  currentQmhqId,  // NEW: Optional context to suppress circular link
}: SORTransactionGroupProps) {
  return (
    <div className="space-y-2">
      {/* Compact header (unchanged) */}
      <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 flex items-center justify-between">
        {/* ... existing header code ... */}
      </div>

      {/* Transaction rows (ENHANCED) */}
      <div className="pl-4 space-y-2">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="p-3 rounded bg-slate-800/20 border border-slate-700/50"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Primary reference: Approval number */}
                {transaction.approval_number && (
                  <div className="mb-2">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/10"
                    >
                      {transaction.approval_number}
                    </Badge>
                  </div>
                )}

                {/* Item details */}
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-slate-200">
                    {transaction.item?.name || "Unknown Item"}
                  </span>
                  {transaction.item?.sku && (
                    <span className="text-xs font-mono text-amber-400">
                      {transaction.item.sku}
                    </span>
                  )}
                </div>

                {/* Warehouse */}
                <div className="text-xs text-slate-400 mt-0.5">
                  {transaction.warehouse?.name || "Unknown Warehouse"}
                </div>

                {/* Secondary reference: QMHQ link (only if not on QMHQ's own page) */}
                {transaction.qmhq && transaction.qmhq.id !== currentQmhqId && (
                  <div className="text-xs text-slate-400 mt-1">
                    via{" "}
                    <Link
                      href={`/qmhq/${transaction.qmhq.id}`}
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono"
                    >
                      {transaction.qmhq.request_id}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Quantity and status (unchanged) */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-200">
                  {transaction.quantity}
                </span>
                <Badge variant={transaction.status === "completed" ? "default" : "secondary"}>
                  {transaction.status}
                </Badge>
              </div>
            </div>

            {/* Date (unchanged) */}
            <div className="text-xs text-slate-400 mt-2">
              {new Date(transaction.transaction_date || transaction.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Source:** Enhanced version of existing sor-transaction-group.tsx from Phase 32.

**Confidence:** HIGH — Direct enhancement of existing component.

### Example 2: Enhanced QMHQ Detail Query with qmhq FK Join

```typescript
// app/(dashboard)/qmhq/[id]/page.tsx (ENHANCED QUERY)
// Fetch stock-out transactions for this QMHQ
const { data: stockOutData, error: stockOutError } = await supabase
  .from('inventory_transactions')
  .select(`
    *,
    item:items(id, name, sku),
    warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name),
    stock_out_approval:stock_out_approvals(
      id,
      approval_number,                   // ✓ Already fetched in Phase 32
      approved_quantity,
      line_item:stock_out_line_items(
        id,
        requested_quantity,
        status,
        request:stock_out_requests(
          id,
          request_number,
          status
        )
      )
    ),
    qmhq:qmhq!inventory_transactions_qmhq_id_fkey(id, request_id)  // NEW for Phase 33
  `)
  .eq('qmhq_id', qmhqData.id)
  .eq('movement_type', 'inventory_out')
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```

**Note:** This query is for QMHQ's own Stock Out tab. For external reference (showing linked transactions from a different QMHQ), the qmhq FK join is needed. For QMHQ viewing its own transactions, the join is technically redundant but harmless (self-reference).

**Source:** Enhanced version of Phase 32 query (app/(dashboard)/qmhq/[id]/page.tsx lines 229-253).

**Confidence:** HIGH — Straightforward FK join addition.

### Example 3: QMHQ Item Detail Linked Transactions Component

```typescript
// components/qmhq/qmhq-linked-transactions.tsx (NEW)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

interface LinkedTransaction {
  id: string;
  quantity: number;
  status: string;
  transaction_date: string | null;
  created_at: string;
  item?: { name: string; sku: string | null } | null;
  warehouse?: { name: string } | null;
  stock_out_approval?: {
    approval_number: string | null;
    line_item?: {
      request?: {
        id: string;
        request_number: string;
      } | null;
    } | null;
  } | null;
}

interface QmhqLinkedTransactionsProps {
  qmhqId: string;
  qmhqRequestId: string;
}

export function QmhqLinkedTransactions({ qmhqId, qmhqRequestId }: QmhqLinkedTransactionsProps) {
  const [transactions, setTransactions] = useState<LinkedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          id,
          quantity,
          status,
          transaction_date,
          created_at,
          item:items(name, sku),
          warehouse:warehouses(name),
          stock_out_approval:stock_out_approvals(
            approval_number,
            line_item:stock_out_line_items(
              request:stock_out_requests(id, request_number)
            )
          )
        `)
        .eq('qmhq_id', qmhqId)
        .eq('movement_type', 'inventory_out')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching linked transactions:', error);
      } else {
        setTransactions((data as LinkedTransaction[]) || []);
      }

      setIsLoading(false);
    };

    fetchTransactions();
  }, [qmhqId]);

  if (isLoading) {
    return (
      <div className="command-panel corner-accents p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-sm text-slate-400">Loading transactions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="command-panel corner-accents p-6">
      <div className="section-header mb-4">
        <Package className="h-4 w-4 text-amber-500" />
        <h2>Linked Stock-Out Transactions</h2>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No stock-out transactions linked to this QMHQ yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Reference
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Item
                </th>
                <th className="text-right py-2 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="py-3 px-2">
                    {/* Primary reference: Approval number */}
                    {tx.stock_out_approval?.approval_number ? (
                      <div>
                        <Link
                          href={`/inventory/stock-out-requests/${tx.stock_out_approval.line_item?.request?.id}`}
                          className="inline-flex items-center gap-1 font-mono text-sm text-amber-400 hover:text-amber-300"
                        >
                          {tx.stock_out_approval.approval_number}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {/* Secondary reference: QMHQ ID */}
                        <div className="text-xs text-slate-400 mt-1">
                          via <span className="font-mono text-blue-400">{qmhqRequestId}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">No approval</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <div className="text-slate-200">{tx.item?.name || "Unknown"}</div>
                    {tx.item?.sku && (
                      <div className="text-xs font-mono text-slate-400">{tx.item.sku}</div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-slate-200">
                    {tx.quantity}
                  </td>
                  <td className="py-3 px-2">
                    <Badge
                      variant={tx.status === "completed" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {tx.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-slate-400">
                    {new Date(tx.transaction_date || tx.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Source:** Table structure inspired by existing line-item-table.tsx (components/stock-out-requests/line-item-table.tsx) and PO line items table.

**Confidence:** MEDIUM — New component but follows established table patterns.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic transaction ID | Approval number as primary reference | Phase 33 (v1.7) | Better traceability to approval workflow |
| Single-context reference | Dual reference (SOR + QMHQ) | Phase 33 (v1.7) | Full visibility into transaction origin |
| No QMHQ → transaction reverse lookup | Dedicated linked transactions table | Phase 33 (v1.7) | QMHQ can see all executions against it |
| Manual qmhq_id checks | Automatic FK join for QMHQ context | Phase 32-33 (v1.7) | Cleaner queries, less application logic |

**Deprecated/outdated:**
- **Generic "Transaction ID" display:** Previously transactions might show their UUID or generic reference. Now approval_number is the canonical reference for stock-outs.
- **Hidden QMHQ relationship:** Before Phase 32, qmhq_id link existed but wasn't surfaced in UI. Now prominently displayed as secondary reference.

## Open Questions

1. **Approval Number Display for Manual Stock-Outs**
   - What we know: Manual stock-outs (reason="request" with no QMHQ parent) still go through approval workflow, so they have approval_number
   - What's unclear: Should display logic differ between QMHQ-linked and manual stock-outs?
   - Recommendation: Treat identically. Approval number is primary reference regardless of QMHQ link. QMHQ link is optional secondary reference.

2. **SOR Reference Link from Transaction Row**
   - What we know: Approval number should be clickable link to SOR detail page
   - What's unclear: Link to SOR detail or to specific approval on that page?
   - Recommendation: Link to SOR detail page (not approval-specific anchor). SOR detail Approvals tab shows all approvals; user can find specific one. Approval-specific anchors would require URL fragment handling.

3. **Empty State on QMHQ with No Executions**
   - What we know: QMHQ may have stock-out request created but not approved/executed yet
   - What's unclear: Should linked transactions table show "pending" SOR even when no transactions exist?
   - Recommendation: Only show executed transactions (matching requirement "linked stock-out transactions"). Pending approvals don't create transactions yet. User sees pending status in Stock Out tab's Items Summary progress bar.

4. **Mobile Responsive Strategy**
   - What we know: Linked transactions table has 5 columns, may be tight on mobile
   - What's unclear: Card view or horizontal scroll for mobile?
   - Recommendation: Horizontal scroll for MVP (simpler implementation). Card view can be added later if user feedback indicates need.

## Sources

### Primary (HIGH confidence)

- `/home/yaungni/qm-core/supabase/migrations/023_inventory_transactions.sql` - Transaction table with qmhq_id FK (line 76)
- `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` - SOR schema with approval_number generation (lines 206-231)
- `/home/yaungni/qm-core/supabase/migrations/053_stock_out_validation.sql` - stock_out_approval_id FK on transactions (line 236)
- `/home/yaungni/qm-core/components/qmhq/sor-transaction-group.tsx` - Existing SOR group component from Phase 32
- `/home/yaungni/qm-core/app/(dashboard)/qmhq/[id]/page.tsx` - Existing QMHQ detail page query pattern (lines 229-253)
- `/home/yaungni/qm-core/components/stock-out-requests/line-item-table.tsx` - Table component pattern reference
- `/home/yaungni/qm-core/.planning/phases/32-qmhq-transaction-linking/32-RESEARCH.md` - Phase 32 foundation
- `/home/yaungni/qm-core/.planning/phases/32-qmhq-transaction-linking/32-VERIFICATION.md` - Phase 32 implementation verification
- `/home/yaungni/qm-core/.planning/REQUIREMENTS.md` - Requirements REF-01, REF-02, LINK-02

### Secondary (MEDIUM confidence)

- [Next.js Link Component](https://nextjs.org/docs/pages/api-reference/components/link) - Official navigation API
- [Lucide React Icons](https://lucide.dev/) - Icon library documentation
- [Tailwind CSS Tables](https://tailwindcss.com/docs/table-layout) - Table styling patterns

### Tertiary (LOW confidence)

None — all findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - FK relationships exist, queries verified in Phase 32, UI patterns established
- Pitfalls: HIGH - Legacy data handling, circular navigation, and stale data are well-documented patterns

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days for stable project)

---

## Additional Notes

### Phase 32 Foundation

Phase 32 already implemented:
- qmhq_id FK propagation in approval dialog (approval-dialog.tsx line 323)
- SOR-grouped transaction display on QMHQ Stock Out tab
- Query with approval.approval_number (already fetched)

Phase 33 builds on this by:
- Surfacing approval_number in UI (primary reference)
- Adding QMHQ link in transaction rows (secondary reference)
- Creating dedicated linked transactions table for QMHQ item detail view

### No Database Changes

All necessary FK relationships exist:
- `inventory_transactions.qmhq_id` (migration 023, line 76)
- `inventory_transactions.stock_out_approval_id` (migration 053, line 236)
- `stock_out_approvals.line_item_id` → `stock_out_line_items.request_id` → `stock_out_requests.qmhq_id`

Queries can traverse the full relationship graph without schema changes.

### Component Reuse Opportunities

Existing components that can be reused:
- Badge component for approval_number display
- Next.js Link for navigation
- ExternalLink icon for external entity links
- command-panel, section-header styling classes
- Badge variants for status display

The new linked transactions component follows the same pattern as existing entity detail tabs (PO line items, Invoice line items).

### Performance Consideration

Query joins for dual reference display:
1. `inventory_transactions → stock_out_approvals`: Already indexed (migration 053, line 239)
2. `inventory_transactions → qmhq`: Already indexed (migration 023, line 125-126)
3. Deep join (transaction → approval → line_item → request): Only for approval_number display, not for filtering

Performance should be acceptable for typical QMHQ with <100 transactions. If performance becomes issue, consider:
- Materializing approval_number directly on inventory_transactions (denormalization)
- Paginating transaction lists
- Adding composite index on (qmhq_id, movement_type, is_active)

Current approach (normalized with joins) is correct for MVP. Optimize only if metrics show slowness.
