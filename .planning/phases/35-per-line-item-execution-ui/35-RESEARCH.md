# Phase 35: Per-Line-Item Execution UI - Research

**Researched:** 2026-02-11
**Domain:** Next.js 14 (App Router), React Server/Client Components, Supabase Realtime
**Confidence:** HIGH

## Summary

Phase 35 replaces the current whole-request execution pattern with per-line-item execution from the approval detail page. Each approved stock-out line item gets its own Execute button, creating a more granular fulfillment workflow. The phase also adds fulfillment metrics to QMHQ item detail pages showing requested, approved, rejected, and executed quantities from the linked SOR.

The existing architecture already has approval-level execution (ExecutionDialog), row-level action patterns (LineItemTable), and cross-tab sync infrastructure (BroadcastChannel in auth-provider). The database layer from Phase 34 provides advisory locks (058_advisory_lock_stock_validation.sql), idempotency constraints (062_idempotency_constraint_execution.sql), and auto-population of qmhq_id (061_auto_populate_qmhq_link.sql).

**Primary recommendation:** Refactor ExecutionDialog to work per-approval instead of per-request. Add Execute button to approval cards in the Approvals tab. Create new FulfillmentMetrics component for QMHQ detail page that queries the linked SOR. Use optimistic updates with BroadcastChannel for cross-page refresh.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Execute button placement:**
- Action column in the line items table on the approval detail page
- Approval detail page only — no execution from request detail page
- Individual execution only — no "Execute All" bulk action
- Confirmation dialog required before execution (shows item name, qty, source warehouse)
- Remove the existing request-level Execute button entirely (clean break)
- Button states: green "Execute" for pending, gray "Executed" badge for completed, red "Rejected" badge for rejected items

**Execution feedback:**
- Optimistic update + success toast after confirmation
- Rolls back on error
- Client-side pre-check: disable Execute button when insufficient stock, with tooltip showing available vs needed qty
- Server-side validation as safety net (advisory locks from Phase 34)
- Execution cannot proceed when stock is insufficient — button disabled, not error after the fact
- After successful execution, auto-refresh parent request status on the same page

**QMHQ qty metrics display:**
- Dedicated "Fulfillment" section on QMHQ item detail page
- Position: below item details, above SOR transaction groups
- Numbers only display: Requested | Approved | Rejected | Executed (no progress bar)
- Metrics come from the single linked SOR (1:1 QMHQ-to-SOR relationship)
- When no SOR linked: show empty state message ("No stock-out request linked")
- Cross-page refresh: if QMHQ detail is open and execution happens on approval page, metrics update via cross-tab sync

**Partial fulfillment states:**
- Color-coded status badges per line item row (green/blue/red) — no summary banner
- New "Partially Fulfilled" status for requests when some but not all line items are executed
- Partially Fulfilled badge color: Claude's discretion (based on existing palette)
- Auto-mark approval as "Fulfilled" when all line items are executed (follows Phase 29 computed status pattern)

### Claude's Discretion

- Partially Fulfilled badge color selection
- Exact confirmation dialog layout and styling
- Stock availability tooltip content formatting
- Cross-tab sync implementation approach (BroadcastChannel exists from Phase 22)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ (App Router) | Frontend framework | Already established in codebase, App Router for RSC |
| React | 18+ | UI library | Required by Next.js |
| TypeScript | 5+ | Type safety | Existing strict mode config |
| Supabase JS Client | ^2.x | Database client | Existing auth and RLS setup |
| shadcn/ui | Latest | UI components | Already used for Dialog, Button, Badge, Tooltip |
| sonner | Latest | Toast notifications | Existing toast library for success/error feedback |
| Lucide React | Latest | Icon library | Already used (ArrowUpFromLine, CheckCircle2, AlertTriangle) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | ^5.x | Data fetching/caching | NOT USED - codebase uses useState + useCallback pattern |
| BroadcastChannel API | Browser native | Cross-tab sync | Already used in auth-provider.tsx, no install needed |
| useSWR | N/A | Data fetching | NOT USED - avoid adding new patterns |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useState + useCallback | React Query | Codebase uses manual state management consistently; adding React Query now would create pattern inconsistency |
| BroadcastChannel | localStorage events | BroadcastChannel is already in use (auth-provider.tsx:90-95) and more explicit for messaging |
| Native tooltip | Radix Tooltip | shadcn/ui already includes Tooltip from Radix Tooltip primitives |

**Installation:**

No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure

```
components/
├── stock-out-requests/
│   ├── approval-card.tsx          # NEW: Per-approval card with Execute button
│   ├── execution-confirmation-dialog.tsx  # NEW: Minimal confirmation (item, qty, warehouse)
│   ├── line-item-table.tsx        # MODIFY: Remove request-level Execute
│   └── execution-dialog.tsx       # DELETE: Replaced by per-approval pattern
├── qmhq/
│   ├── fulfillment-metrics.tsx    # NEW: Requested | Approved | Rejected | Executed
│   └── sor-transaction-group.tsx  # EXISTS: Already displays SOR transactions
app/(dashboard)/
├── inventory/stock-out-requests/[id]/
│   └── page.tsx                   # MODIFY: Replace Approvals tab with approval cards
└── qmhq/[id]/
    └── page.tsx                   # MODIFY: Add FulfillmentMetrics section
```

### Pattern 1: Per-Approval Execution Button

**What:** Each approved stock-out approval record gets its own Execute button in the Approvals tab.

**When to use:** When an approval has `decision = 'approved'` AND no completed inventory_transactions exist with `stock_out_approval_id = approval.id`.

**Example:**

```tsx
// components/stock-out-requests/approval-card.tsx
interface ApprovalCardProps {
  approval: ApprovalWithUser;
  canExecute: boolean;
  onExecute: (approvalId: string) => void;
}

export function ApprovalCard({ approval, canExecute, onExecute }: ApprovalCardProps) {
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isCheckingStock, setIsCheckingStock] = useState(false);

  // Pre-check stock availability (client-side)
  useEffect(() => {
    if (approval.decision !== 'approved') return;

    async function checkStock() {
      setIsCheckingStock(true);
      const supabase = createClient();

      // Check if already executed
      const { count } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('stock_out_approval_id', approval.id)
        .eq('status', 'completed');

      if (count && count > 0) {
        setAvailableStock(0); // Already executed
        setIsCheckingStock(false);
        return;
      }

      // Get warehouse stock
      const { data: txData } = await supabase
        .from('inventory_transactions')
        .select('movement_type, quantity')
        .eq('item_id', approval.line_item.item_id)
        .eq('warehouse_id', approval.warehouse_id) // Assuming warehouse_id on approval
        .eq('status', 'completed');

      const stock = (txData || []).reduce((sum, tx) => {
        if (tx.movement_type === 'inventory_in') return sum + tx.quantity;
        if (tx.movement_type === 'inventory_out') return sum - tx.quantity;
        return sum;
      }, 0);

      setAvailableStock(stock);
      setIsCheckingStock(false);
    }

    checkStock();
  }, [approval]);

  const isExecuted = availableStock === 0 && !isCheckingStock;
  const hasInsufficientStock = availableStock !== null && availableStock < approval.approved_quantity;
  const canExecuteNow = canExecute && !isExecuted && !hasInsufficientStock && !isCheckingStock;

  return (
    <div className="border border-slate-700 rounded-lg p-4">
      {/* Approval details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className={approval.decision === 'approved' ? 'bg-emerald-500/10' : 'bg-red-500/10'}>
            {approval.decision}
          </Badge>
          <span className="font-mono text-sm">{approval.approval_number}</span>
        </div>

        {/* Execute button */}
        {approval.decision === 'approved' && (
          <>
            {isExecuted ? (
              <Badge className="bg-slate-500/10 text-slate-400">Executed</Badge>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => onExecute(approval.id)}
                    disabled={!canExecuteNow}
                    className={cn(
                      "bg-emerald-600 hover:bg-emerald-500",
                      hasInsufficientStock && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Execute
                  </Button>
                </TooltipTrigger>
                {hasInsufficientStock && (
                  <TooltipContent>
                    <p>Insufficient stock</p>
                    <p className="text-xs">Need: {approval.approved_quantity} | Available: {availableStock}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Item details, quantity, etc. */}
    </div>
  );
}
```

### Pattern 2: Optimistic Update with Rollback

**What:** Immediately update UI after user confirms execution, show success toast, then rollback if server request fails.

**When to use:** For execution actions where user expects immediate feedback.

**Example:**

```tsx
// app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
const [approvals, setApprovals] = useState<ApprovalWithUser[]>([]);
const [optimisticExecutedIds, setOptimisticExecutedIds] = useState<Set<string>>(new Set());

const handleExecuteApproval = async (approvalId: string) => {
  const approval = approvals.find(a => a.id === approvalId);
  if (!approval) return;

  // Show confirmation dialog
  const confirmed = await showConfirmationDialog({
    itemName: approval.line_item.item_name,
    quantity: approval.approved_quantity,
    warehouse: approval.warehouse_name,
  });

  if (!confirmed) return;

  // Optimistic update
  setOptimisticExecutedIds(prev => new Set([...prev, approvalId]));
  toast.success('Stock-out executed');

  try {
    const supabase = createClient();

    // Server execution (will trigger Phase 34 advisory locks & idempotency constraint)
    const { error } = await supabase
      .from('inventory_transactions')
      .update({ status: 'completed', transaction_date: new Date().toISOString() })
      .eq('stock_out_approval_id', approvalId)
      .eq('status', 'pending');

    if (error) throw error;

    // Broadcast to other tabs
    const channel = new BroadcastChannel('qm-stock-out-execution');
    channel.postMessage({
      type: 'APPROVAL_EXECUTED',
      approvalId,
      requestId: request.id,
      qmhqId: request.qmhq_id,
    });
    channel.close();

    // Refetch data to update parent status
    await fetchData();

  } catch (error: any) {
    // Rollback optimistic update
    setOptimisticExecutedIds(prev => {
      const next = new Set(prev);
      next.delete(approvalId);
      return next;
    });
    toast.error(error.message || 'Failed to execute stock-out');
  }
};
```

### Pattern 3: QMHQ Fulfillment Metrics Component

**What:** Displays requested/approved/rejected/executed quantities from the linked SOR.

**When to use:** On QMHQ item detail page when `qmhq.route_type = 'item'` and a SOR is linked.

**Example:**

```tsx
// components/qmhq/fulfillment-metrics.tsx
interface FulfillmentMetricsProps {
  qmhqId: string;
}

export function FulfillmentMetrics({ qmhqId }: FulfillmentMetricsProps) {
  const [metrics, setMetrics] = useState<{
    requested: number;
    approved: number;
    rejected: number;
    executed: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Get SOR linked to this QMHQ (1:1 relationship)
    const { data: sorData } = await supabase
      .from('stock_out_requests')
      .select(`
        id,
        line_items:stock_out_line_items(
          id,
          requested_quantity,
          status,
          approvals:stock_out_approvals(
            approved_quantity,
            decision
          )
        )
      `)
      .eq('qmhq_id', qmhqId)
      .eq('is_active', true)
      .single();

    if (!sorData || !sorData.line_items) {
      setMetrics(null);
      setIsLoading(false);
      return;
    }

    // Calculate metrics
    let requested = 0;
    let approved = 0;
    let rejected = 0;

    for (const lineItem of sorData.line_items) {
      requested += lineItem.requested_quantity;

      for (const approval of lineItem.approvals || []) {
        if (approval.decision === 'approved') {
          approved += approval.approved_quantity;
        } else if (approval.decision === 'rejected') {
          rejected += approval.approved_quantity;
        }
      }
    }

    // Get executed qty from inventory transactions
    const { data: txData } = await supabase
      .from('inventory_transactions')
      .select('quantity')
      .eq('qmhq_id', qmhqId)
      .eq('movement_type', 'inventory_out')
      .eq('status', 'completed')
      .eq('is_active', true);

    const executed = (txData || []).reduce((sum, tx) => sum + tx.quantity, 0);

    setMetrics({ requested, approved, rejected, executed });
    setIsLoading(false);
  }, [qmhqId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Listen for cross-tab execution events
  useEffect(() => {
    const channel = new BroadcastChannel('qm-stock-out-execution');

    channel.onmessage = (event) => {
      if (event.data.type === 'APPROVAL_EXECUTED' && event.data.qmhqId === qmhqId) {
        fetchMetrics(); // Refresh metrics
      }
    };

    return () => channel.close();
  }, [qmhqId, fetchMetrics]);

  if (isLoading) {
    return <Loader2 className="w-5 h-5 animate-spin" />;
  }

  if (!metrics) {
    return (
      <div className="text-center py-4 text-slate-500">
        No stock-out request linked
      </div>
    );
  }

  return (
    <div className="command-panel p-6">
      <h3 className="text-lg font-semibold text-slate-200 mb-4">Fulfillment</h3>
      <div className="grid grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">Requested</div>
          <div className="font-mono text-xl text-slate-200">{metrics.requested}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Approved</div>
          <div className="font-mono text-xl text-emerald-400">{metrics.approved}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Rejected</div>
          <div className="font-mono text-xl text-red-400">{metrics.rejected}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-1">Executed</div>
          <div className="font-mono text-xl text-blue-400">{metrics.executed}</div>
        </div>
      </div>
    </div>
  );
}
```

### Pattern 4: Confirmation Dialog (Minimal)

**What:** Simple confirmation showing item name, quantity, and warehouse before execution.

**When to use:** Before executing any stock-out approval.

**Example:**

```tsx
// components/stock-out-requests/execution-confirmation-dialog.tsx
interface ExecutionConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  quantity: number;
  warehouseName: string;
  onConfirm: () => void;
}

export function ExecutionConfirmationDialog({
  open,
  onOpenChange,
  itemName,
  quantity,
  warehouseName,
  onConfirm,
}: ExecutionConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Execute Stock-Out</DialogTitle>
          <DialogDescription>
            Confirm execution of this stock-out approval
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div>
            <div className="text-xs text-slate-500">Item</div>
            <div className="text-sm text-slate-200">{itemName}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Quantity</div>
            <div className="font-mono text-lg text-slate-200">{quantity}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Warehouse</div>
            <div className="text-sm text-slate-200">{warehouseName}</div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5" />
            <p className="text-xs text-amber-400">
              This action is permanent. Stock-out transactions cannot be voided.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirm Execution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Anti-Patterns to Avoid

- **Bulk Execute All button:** User decision explicitly excludes this. Focus on individual approval execution only.
- **Progress bar in QMHQ metrics:** User requested numbers-only display. No progress bar or percentage calculation.
- **Error after execution attempt:** User wants button disabled upfront if insufficient stock. Don't show Execute button that errors when clicked.
- **Manual cross-tab refresh:** Use BroadcastChannel to auto-refresh, don't require user to manually refresh other tabs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tab messaging | Custom localStorage event listeners | BroadcastChannel API | Already in use (auth-provider.tsx), more explicit API, no storage pollution |
| Stock availability check | Custom recursion through inventory tree | `get_total_item_stock(item_id)` function from 053_stock_out_validation.sql | Database function already exists and handles all edge cases |
| Optimistic UI updates | Custom state management library | useState + optimistic ID set | Codebase pattern, simple rollback mechanism, no new dependencies |
| Confirmation dialog | Custom modal component | shadcn/ui Dialog | Already imported and styled consistently |

**Key insight:** The database layer from Phase 34 handles all concurrency/validation concerns (advisory locks, idempotency, over-execution blocking). UI layer just needs to call existing functions and handle optimistic updates. Don't duplicate server-side validation in client code.

## Common Pitfalls

### Pitfall 1: Executing Already-Completed Approval

**What goes wrong:** User clicks Execute button multiple times quickly, creating duplicate inventory transactions.

**Why it happens:** Optimistic update doesn't immediately disable the button, and idempotency constraint (062_idempotency_constraint_execution.sql) only blocks at database level.

**How to avoid:** Add `optimisticExecutedIds` Set to immediately hide/disable Execute button after first click.

**Warning signs:**
- Multiple success toasts for same approval
- Database throws unique constraint violation error
- Button still clickable after execution starts

### Pitfall 2: Not Refreshing Parent Status

**What goes wrong:** After executing one line item, the parent SOR status still shows "approved" instead of "partially_executed".

**Why it happens:** The computed status trigger (compute_sor_request_status in 052) runs server-side, but UI doesn't refetch.

**How to avoid:** After successful execution, call `await fetchData()` to refetch the entire request with updated status.

**Warning signs:**
- Executed line items show correct status
- Request-level badge doesn't update
- Status updates only after page refresh

### Pitfall 3: Stale Stock Availability Check

**What goes wrong:** Execute button shows as enabled, but execution fails due to insufficient stock (another tab executed stock-out in between).

**Why it happens:** Stock check happens once on approval card mount, doesn't listen for changes.

**How to avoid:** Listen to BroadcastChannel events and re-check stock when other tabs execute stock-outs.

**Warning signs:**
- Button enabled but execution fails
- Advisory lock timeout errors from Phase 34
- User sees "insufficient stock" error after clicking Execute

### Pitfall 4: Forgetting 1:1 QMHQ-SOR Relationship

**What goes wrong:** QMHQ metrics component queries all SORs linked to QMHQ, not realizing it's 1:1.

**Why it happens:** Code assumes many-to-many relationship pattern.

**How to avoid:** Use `.single()` in Supabase query for SOR lookup by qmhq_id. Expect exactly one result.

**Warning signs:**
- Multiple SORs appear in metrics calculation
- Metrics show inflated numbers
- Empty state never shows (always finds at least one SOR)

## Code Examples

Verified patterns from codebase:

### Current Approvals Tab Implementation

```tsx
// app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx (line 650-764)
<TabsContent value="approvals" className="space-y-4">
  <div className="command-panel p-6">
    <h3 className="text-lg font-semibold text-slate-200 mb-4">
      Approval History
    </h3>

    {approvals.length === 0 ? (
      <div className="text-center py-8 text-slate-500">
        No approvals yet
      </div>
    ) : (
      <div className="space-y-4">
        {approvals.map((approval) => {
          const hasPendingExecution = approvalPendingStatus.get(approval.id) || false;

          return (
            <div key={approval.id} className="border border-slate-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Approval badge */}
                  <Badge className={approval.decision === 'approved' ? 'text-emerald-400' : 'text-red-400'}>
                    {approval.decision}
                  </Badge>
                  {canExecute && hasPendingExecution && (
                    <Button size="sm" onClick={() => {
                      setExecutingApprovalId(approval.id);
                      setIsExecutionDialogOpen(true);
                    }}>
                      Execute Stock-Out
                    </Button>
                  )}
                </div>
              </div>
              {/* Approval details */}
            </div>
          );
        })}
      </div>
    )}
  </div>
</TabsContent>
```

**Refactor needed:** Replace `hasPendingExecution` check with direct inventory_transactions query. Change button from "Execute Stock-Out" (whole approval) to "Execute" (this specific approval). Add stock availability check.

### BroadcastChannel Usage for Cross-Tab Sync

```tsx
// components/providers/auth-provider.tsx (line 88-95)
// Broadcast to other tabs
try {
  const channel = new BroadcastChannel('qm-auth');
  channel.postMessage({ type: 'SIGNED_OUT' });
  channel.close();
} catch {
  // BroadcastChannel not supported - graceful degradation
}
```

**Pattern to follow:** Create `qm-stock-out-execution` channel for execution events. Post message with `{ type: 'APPROVAL_EXECUTED', approvalId, requestId, qmhqId }`. Listeners refetch data when receiving relevant event.

### Existing Stock Validation Client-Side

```tsx
// components/stock-out-requests/approval-dialog.tsx (line 61-116)
async function fetchWarehouseStockForItem(
  supabase: ReturnType<typeof createClient>,
  itemId: string
): Promise<WarehouseStock[]> {
  const { data: transactions, error } = await supabase
    .from("inventory_transactions")
    .select(`movement_type, warehouse_id, quantity, warehouses!warehouse_id(id, name)`)
    .eq("item_id", itemId)
    .eq("status", "completed");

  const stockMap = new Map<string, WarehouseStock>();

  (transactions || []).forEach((txn: any) => {
    const warehouseId = txn.warehouse_id;
    if (!stockMap.has(warehouseId)) {
      stockMap.set(warehouseId, {
        warehouse_id: warehouseId,
        warehouse_name: txn.warehouses.name,
        available_stock: 0,
      });
    }

    const stock = stockMap.get(warehouseId)!;
    if (txn.movement_type === "inventory_in") {
      stock.available_stock += txn.quantity;
    } else if (txn.movement_type === "inventory_out") {
      stock.available_stock -= txn.quantity;
    }
  });

  return Array.from(stockMap.values())
    .filter((s) => s.available_stock > 0)
    .sort((a, b) => b.available_stock - a.available_stock);
}
```

**Pattern to reuse:** Same logic for Execute button stock check. Calculate available stock for specific warehouse before enabling button. Show in tooltip if insufficient.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Whole-request execution | Per-approval execution | Phase 35 | More granular control, better matches real-world partial fulfillment workflows |
| Pending transactions as execution placeholder | Direct approval execution | Phase 35 | Simpler data model, no pending transaction cleanup needed |
| Stock check at execution time | Stock check at button render | Phase 35 | Better UX (button disabled upfront), prevents error-after-click pattern |
| Manual page refresh | BroadcastChannel auto-refresh | Phase 22 (auth), Phase 35 (execution) | Cross-tab sync feels seamless, no user action needed |

**Deprecated/outdated:**
- ExecutionDialog (`components/stock-out-requests/execution-dialog.tsx`): Replaced by per-approval confirmation dialog. Old version executes ALL pending transactions for an approval at once, new version should be deleted and replaced.
- Request-level Execute button: User decision explicitly removes this. Clean break from old pattern.
- `hasPendingExecution` flag pattern: Old way was checking if pending inventory_transactions exist. New way: check if completed transactions exist for approval_id (if yes, already executed).

## Open Questions

1. **Should approval cards show warehouse stock in real-time?**
   - What we know: Approval dialog (approval-dialog.tsx) fetches warehouse stock on open
   - What's unclear: Whether to show stock levels in approval cards before user clicks Execute
   - Recommendation: YES - show in tooltip on button hover. Prevents user clicking just to find out stock is insufficient. Use same `fetchWarehouseStockForItem` function pattern.

2. **How to handle race condition when two tabs execute different approvals simultaneously?**
   - What we know: Phase 34 advisory locks prevent over-execution at database level (058_advisory_lock_stock_validation.sql)
   - What's unclear: UI behavior when one tab's execution causes another tab's button to become invalid
   - Recommendation: Listen to BroadcastChannel events and re-check stock availability when other tabs execute. If now insufficient, disable button and show "Stock depleted" tooltip.

3. **Should "Partially Fulfilled" status auto-transition to "Fulfilled" when all executed?**
   - What we know: User decision says "Auto-mark approval as 'Fulfilled' when all line items are executed"
   - What's unclear: Whether this refers to request-level or approval-level status
   - Recommendation: Assume request-level (SOR status). The computed status trigger (compute_sor_request_status in 052) already handles this. Just need to ensure UI refetches after execution.

4. **What color for "Partially Fulfilled" badge?**
   - What we know: User decision says "Claude's discretion (based on existing palette)"
   - What's unclear: Whether to match "partially_executed" (purple) or create new color
   - Recommendation: Use purple-400 to match `partially_executed` in line item status (line-item-table.tsx:67-69). Maintains consistency with existing partial execution patterns.

## Sources

### Primary (HIGH confidence)

- Codebase: `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` - SOR schema, line item status enum, computed status trigger
- Codebase: `/home/yaungni/qm-core/supabase/migrations/053_stock_out_validation.sql` - Stock validation functions, over-execution blocking
- Codebase: `/home/yaungni/qm-core/supabase/migrations/058_advisory_lock_stock_validation.sql` - Advisory locks for concurrency (Phase 34)
- Codebase: `/home/yaungni/qm-core/supabase/migrations/062_idempotency_constraint_execution.sql` - Idempotency constraint preventing duplicate execution (Phase 34)
- Codebase: `/home/yaungni/qm-core/supabase/migrations/061_auto_populate_qmhq_link.sql` - Auto-populate qmhq_id in transactions (Phase 34)
- Codebase: `/home/yaungni/qm-core/app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` - Current approval detail page implementation
- Codebase: `/home/yaungni/qm-core/components/stock-out-requests/line-item-table.tsx` - Line item table with status badges
- Codebase: `/home/yaungni/qm-core/components/stock-out-requests/execution-dialog.tsx` - Current execution dialog (to be replaced)
- Codebase: `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` - Stock availability check pattern
- Codebase: `/home/yaungni/qm-core/components/providers/auth-provider.tsx` - BroadcastChannel usage for cross-tab sync
- Codebase: `/home/yaungni/qm-core/app/(dashboard)/qmhq/[id]/page.tsx` - QMHQ detail page structure
- Codebase: `/home/yaungni/qm-core/components/qmhq/sor-transaction-group.tsx` - SOR transaction display pattern

### Secondary (MEDIUM confidence)

- MDN Web Docs: BroadcastChannel API - Standard browser API for cross-tab messaging
- shadcn/ui docs: Tooltip component - Radix Tooltip primitives for hover tooltips

### Tertiary (LOW confidence)

None - all findings verified from codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Existing patterns for approval cards, stock checks, cross-tab sync
- Pitfalls: HIGH - Common patterns from approval-dialog.tsx and execution-dialog.tsx, Phase 34 database constraints documented

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - stable domain, no fast-moving dependencies)
