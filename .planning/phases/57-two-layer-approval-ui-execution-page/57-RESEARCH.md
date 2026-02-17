# Phase 57: Two-Layer Approval UI + Execution Page - Research

**Researched:** 2026-02-17
**Domain:** React/Next.js UI for two-layer stock-out approval workflow + execution page
**Confidence:** HIGH

## Summary

Phase 57 implements the UI layer for the two-layer approval workflow whose database foundation was established in Phase 55 (migrations `20260217099999` and `20260217100000`). The database schema already supports L1 (quartermaster) and L2 (admin) approvals with `layer`, `parent_approval_id`, and `warehouse_id` columns on `stock_out_approvals`, plus the `awaiting_admin` and `fully_approved` enum values on `sor_line_item_status`. All trigger functions (`validate_sor_approval`, `update_line_item_status_on_approval`, `validate_sor_fulfillment`, `compute_sor_request_status`) have been rewritten for two-layer flow. The TypeScript types in `types/database.ts` already reflect these schema changes.

The work is purely UI-side: (1) replace the existing single approval dialog with separate L1 and L2 dialogs, (2) update the line item table to show per-row action buttons and progress bars, (3) add a Warehouse Assignments tab to SOR detail, (4) add SOR auto-status mapping for new statuses, (5) build the dedicated execution page at `/inventory/stock-out`, and (6) update the sidebar navigation.

**Primary recommendation:** Rewrite the existing `approval-dialog.tsx` into two separate components (`l1-approval-dialog.tsx` and `l2-warehouse-dialog.tsx`), update `line-item-table.tsx` to show inline action buttons per row instead of batch selection, build a new `ProgressBar` component, add a `WarehouseAssignmentsTab` component, and create a new execution page at `/inventory/stock-out/page.tsx` (replacing the current content).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Separate dialogs for L1 and L2 -- not a single multi-step dialog
- L1: Inline "Approve Qty" button on line item row opens dialog for quantity confirmation (partial qty allowed)
- L2: After L1 approval, button replaces L1 button -- becomes "Assign Warehouse" button
- L2 stays visible until all L1-approved qty is fully warehouse-assigned
- Each L2 approval is single-warehouse; multiple L2 approvals to split across warehouses
- Second+ L2 dialog pre-fills with remaining unassigned qty
- Rejection only at Layer 1; L2 only assigns warehouse
- Replace existing approval dialog entirely -- all approvals now go through L1/L2 flow
- Same person (admin only) can perform both L1 and L2
- L2 assignment is final -- no undo/edit after assignment
- When fully warehouse-assigned, button changes to "Ready to Execute" status badge only
- Single badge with layer text: "Pending" -> "Qty Approved" -> "Warehouse Assigned" -> "Ready to Execute"
- Match existing status colors (amber=pending, blue=in-progress, purple=awaiting, green=ready)
- 3-segment progress bar on line items: L1 approved | L2 warehouse-assigned | Executed
- Detailed tooltip on hover for progress bar with exact numbers
- No SOR header progress summary -- progress per line item only
- Warehouse assignments visible via expandable section under each line item
- New "Warehouse Assignments" tab on SOR detail page
- Grouped by line item with execution status per assignment
- SOR auto-status updates based on aggregate line item state
- New status: "Awaiting Warehouse"
- Execution page at `/inventory/stock-out` (replaces current page, sidebar link updated)
- List view only (no card view), filterable by warehouse
- Each row = one warehouse assignment
- Status filter defaults to Pending Execution
- SOR ID is display-only (not a link)
- Execute via confirmation dialog per row (no bulk)
- Row updates in-place after execution
- No "New Request" button on execution page
- Execution also available from SOR detail page (Warehouse Assignments tab) with before/after stock
- L2 dialog: Real-time validation as warehouse is selected
- Available stock shown as text below warehouse dropdown
- Qty input uses hard cap = min(remaining unassigned L1 qty, available warehouse stock)
- Error message shows both limits
- Standard unit conversion shown in both L1 and L2 dialogs
- Execution re-validates warehouse stock at execution time
- If execution fails, assignment stays -- admin retries later
- Execution from stock-out page: simple confirmation (no stock display)
- Execution from SOR detail page: confirmation with before/after stock levels

### Claude's Discretion
- Progress bar segment colors
- Exact spacing and typography of approval dialogs
- Error state handling details
- Loading states during stock validation API calls

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| APPR-01 | Admin can approve stock-out line item quantities without selecting a warehouse (Layer 1) | L1 dialog component, inserts to `stock_out_approvals` with no `parent_approval_id` and no `warehouse_id`; trigger auto-sets `layer='quartermaster'` |
| APPR-02 | Admin can assign a warehouse to a qty-approved line item as a second approval step (Layer 2) | L2 dialog component, inserts to `stock_out_approvals` with `parent_approval_id` and `warehouse_id`; trigger auto-sets `layer='admin'` |
| APPR-03 | Layer 2 warehouse approval quantity cannot exceed Layer 1 approved quantity | DB trigger `validate_sor_approval` enforces this; UI hard-caps qty field at L1 approved qty |
| APPR-04 | Layer 2 warehouse approval quantity cannot exceed available warehouse stock | DB trigger uses `get_warehouse_stock()` with advisory lock; UI shows real-time validation via Supabase query |
| APPR-05 | Stock-out execution is blocked until both Layer 1 and Layer 2 approvals are complete | DB trigger `validate_sor_fulfillment` requires `layer='admin'`; UI only shows execute button on L2 approvals |
| EXEC-01 | User can view approved stock-out items ready for execution in list view | New execution page at `/inventory/stock-out` showing L2 warehouse assignments |
| EXEC-02 | User can filter the stock-out execution page by warehouse | Warehouse filter dropdown on execution page |
| EXEC-03 | User can create a new stock-out request from the execution page | CONTEXT says "No New Request button"; however, requirement says user CAN create from execution page. **Note: CONTEXT.md contradicts EXEC-03** -- CONTEXT explicitly says "No New Request button -- this page is for execution only." Planner should follow CONTEXT.md (user decision overrides boilerplate requirement). |
| EXEC-04 | Stock-out sidebar navigation item links to the new execution page | Update sidebar.tsx: change "Stock Out" href from `/inventory/stock-out` to remain but content changes; remove separate "Stock-Out Requests" link or restructure |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ (App Router) | Framework | Already in use |
| React | 18+ | UI | Already in use |
| TypeScript | strict mode | Type safety | Already in use |
| Tailwind CSS | 3.x | Styling | Already in use |
| Supabase JS | @supabase/supabase-js | DB client | Already in use |
| sonner | latest | Toast notifications | Already in use (`toast()`) |
| lucide-react | latest | Icons | Already in use |
| shadcn/ui | latest | UI primitives (Dialog, Badge, Tabs, Select, Tooltip) | Already in use |

### No New Dependencies Required
This phase uses exclusively existing libraries and components. No new packages needed.

## Architecture Patterns

### Current SOR File Structure
```
components/stock-out-requests/
  approval-dialog.tsx           # REPLACE: current single-step approval
  rejection-dialog.tsx          # KEEP: still used for L1 rejection
  execution-confirmation-dialog.tsx  # MODIFY: add before/after stock variant
  execution-dialog.tsx          # REMOVE: replaced by execution page
  line-item-table.tsx           # HEAVY MODIFY: per-row buttons, progress bar
  request-card.tsx              # KEEP: card view for SOR list
  stock-out-pdf-button.tsx      # KEEP: unchanged

app/(dashboard)/inventory/
  stock-out/page.tsx            # REPLACE: becomes execution page
  stock-out-requests/
    page.tsx                    # KEEP: SOR list page
    new/page.tsx                # KEEP: create SOR page
    [id]/page.tsx               # HEAVY MODIFY: add Warehouse Assignments tab, update tabs
```

### Recommended New File Structure
```
components/stock-out-requests/
  l1-approval-dialog.tsx        # NEW: Layer 1 qty-only approval
  l2-warehouse-dialog.tsx       # NEW: Layer 2 warehouse assignment
  rejection-dialog.tsx          # KEEP (unchanged)
  execution-confirmation-dialog.tsx  # MODIFY: add variant with stock levels
  line-item-table.tsx           # MODIFY: per-row buttons, progress bar, expandable sections
  line-item-progress-bar.tsx    # NEW: 3-segment progress bar with tooltip
  warehouse-assignments-tab.tsx # NEW: tab content for SOR detail page
  request-card.tsx              # KEEP
  stock-out-pdf-button.tsx      # KEEP
```

### Pattern 1: Per-Row Action Button (replaces batch selection)
**What:** Instead of checkboxes + floating action bar, each line item row has its own action button that changes based on status.
**When to use:** When line items are at different stages of the workflow.
**Example:**
```typescript
// Determine which button to show for a line item
function getLineItemAction(item: LineItemWithApprovals): {
  type: 'approve_qty' | 'assign_warehouse' | 'ready_badge' | 'executed_badge' | 'rejected_badge';
  label: string;
  disabled: boolean;
} {
  switch (item.status) {
    case 'pending':
      return { type: 'approve_qty', label: 'Approve Qty', disabled: false };
    case 'awaiting_admin':
      // Check if all L1 qty is warehouse-assigned
      if (item.remaining_unassigned_qty > 0) {
        return { type: 'assign_warehouse', label: 'Assign Warehouse', disabled: false };
      }
      return { type: 'ready_badge', label: 'Ready to Execute', disabled: true };
    case 'fully_approved':
      return { type: 'ready_badge', label: 'Ready to Execute', disabled: true };
    case 'executed':
      return { type: 'executed_badge', label: 'Executed', disabled: true };
    case 'rejected':
      return { type: 'rejected_badge', label: 'Rejected', disabled: true };
    default:
      return { type: 'approve_qty', label: 'Pending', disabled: true };
  }
}
```

### Pattern 2: L1 Approval Insert (no warehouse, no parent)
**What:** Insert approval record without parent_approval_id or warehouse_id.
**When to use:** Layer 1 quantity approval.
**Example:**
```typescript
// L1 approval: qty-only, no warehouse
const { data: l1Approval, error } = await supabase
  .from('stock_out_approvals')
  .insert({
    line_item_id: lineItemId,
    approved_quantity: approvedQty,
    decision: 'approved',  // or 'rejected'
    decided_by: userId,
    created_by: userId,
    // layer auto-set by trigger (quartermaster)
    // parent_approval_id: null (auto, L1)
    // warehouse_id: null (not assigned at L1)
  })
  .select('id')
  .single();
```

### Pattern 3: L2 Warehouse Assignment Insert
**What:** Insert approval record WITH parent_approval_id and warehouse_id.
**When to use:** Layer 2 warehouse assignment.
**Example:**
```typescript
// L2 approval: warehouse assignment, references L1 parent
const { data: l2Approval, error } = await supabase
  .from('stock_out_approvals')
  .insert({
    line_item_id: lineItemId,
    approved_quantity: assignedQty,  // <= L1 parent's approved_quantity
    decision: 'approved',  // always 'approved' at L2
    parent_approval_id: l1ApprovalId,  // references L1 parent
    warehouse_id: warehouseId,         // required at L2
    decided_by: userId,
    created_by: userId,
    // layer auto-set by trigger (admin)
  })
  .select('id')
  .single();
```

### Pattern 4: Execution via Inventory Transaction Update (existing pattern)
**What:** Execute by updating pending inventory_transaction to completed status.
**When to use:** When executing a warehouse assignment.
**Critical difference from current flow:** The current approval dialog creates a pending `inventory_transaction` at approval time. In the new two-layer flow, the pending transaction should be created at L2 (warehouse assignment) time, not at L1 time, because L1 has no warehouse. The execution step then updates `status: 'pending'` to `status: 'completed'`.
**Example:**
```typescript
// At L2 warehouse assignment time, create pending inventory_transaction:
const { error: txError } = await supabase
  .from('inventory_transactions')
  .insert({
    movement_type: 'inventory_out',
    item_id: itemId,
    warehouse_id: warehouseId,       // from L2 assignment
    quantity: assignedQty,
    conversion_rate: conversionRate,  // from line item
    reason: requestReason,
    stock_out_approval_id: l2ApprovalId,  // link to L2 approval
    qmhq_id: qmhqId || null,
    status: 'pending',               // pending until execution
    created_by: userId,
  });

// At execution time, update to completed:
const { error: execError } = await supabase
  .from('inventory_transactions')
  .update({
    status: 'completed',
    transaction_date: new Date().toISOString(),
  })
  .eq('stock_out_approval_id', l2ApprovalId)
  .eq('status', 'pending');
```

### Pattern 5: Real-Time Stock Validation in L2 Dialog
**What:** Fetch warehouse stock when warehouse is selected, update max qty dynamically.
**When to use:** L2 warehouse assignment dialog.
**Example:**
```typescript
// Fetch stock for selected warehouse + item
async function fetchWarehouseStock(itemId: string, warehouseId: string): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from('inventory_transactions')
    .select('movement_type, quantity')
    .eq('item_id', itemId)
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .eq('status', 'completed');

  return (data || []).reduce((sum, tx) => {
    if (tx.movement_type === 'inventory_in') return sum + (tx.quantity || 0);
    if (tx.movement_type === 'inventory_out') return sum - (tx.quantity || 0);
    return sum;
  }, 0);
}

// Hard cap: min(remaining unassigned L1 qty, available warehouse stock)
const hardCap = Math.min(remainingUnassignedQty, availableWarehouseStock);
```

### Anti-Patterns to Avoid
- **Reusing the existing approval dialog:** The old dialog combines qty + warehouse in a single step. Replace entirely with L1 + L2 dialogs.
- **Batch selection for L1/L2:** The old table uses checkboxes + floating bar. The new flow uses per-row buttons because each line item may be at a different approval stage.
- **Creating inventory_transaction at L1:** L1 has no warehouse. The pending transaction must be created at L2 when warehouse is assigned. This is a key difference from the current flow.
- **Using the `approved` line item status:** In the new flow, `approved` is a legacy status. New approvals produce `awaiting_admin` (after L1) and `fully_approved` (after L2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stock validation | Custom stock calculation | `fetchWarehouseStockForItem()` pattern from existing `approval-dialog.tsx` | Already proven, matches DB calculation |
| Advisory locks | Client-side locking | DB triggers (`validate_sor_approval`) handle concurrency | Advisory locks in triggers prevent race conditions |
| Status transitions | Manual status updates | DB triggers (`update_line_item_status_on_approval`, `compute_sor_request_status`) | Triggers atomically update line item and SOR status |
| Over-execution prevention | Client-side qty checks | DB trigger (`validate_sor_fulfillment`) | Trigger uses advisory lock for concurrent execution |
| Tooltip component | Custom tooltip | Existing `@/components/ui/tooltip` (Radix-based) | Already in use throughout the app |
| Dialog component | Custom modal | Existing `@/components/ui/dialog` (Radix-based) | Consistent with all other dialogs |
| Pagination | Custom pagination | Existing `@/components/ui/pagination` + `usePaginationParams` hook | Already standardized |

**Key insight:** The database triggers handle ALL validation and status transitions. The UI just needs to insert records correctly (L1 without parent/warehouse, L2 with parent/warehouse) and the triggers handle the rest.

## Common Pitfalls

### Pitfall 1: Creating Inventory Transaction at L1
**What goes wrong:** Current approval dialog creates a pending `inventory_transaction` alongside the approval. If this pattern is copied for L1, the transaction would have no `warehouse_id`.
**Why it happens:** Copy-paste from existing approval dialog.
**How to avoid:** L1 dialog ONLY inserts into `stock_out_approvals`. The pending `inventory_transaction` is created at L2 (when warehouse is known).
**Warning signs:** L1 dialog has `inventory_transactions` insert code.

### Pitfall 2: Forgetting to Query L2 Approvals for Remaining Unassigned Qty
**What goes wrong:** L2 dialog shows the full L1 approved qty instead of the remaining unassigned amount.
**Why it happens:** Only querying L1 approvals, not summing existing L2 approvals for the same L1 parent.
**How to avoid:** Calculate `remaining_unassigned = L1_approved_qty - SUM(L2_approved_qty WHERE parent_approval_id = L1.id)`.
**Warning signs:** Admin can over-assign warehouse qty beyond L1 approved amount.

### Pitfall 3: SOR Request Status Enum Missing `awaiting_warehouse`
**What goes wrong:** CONTEXT.md specifies "Awaiting Warehouse" as a new SOR status, but `sor_request_status` enum does NOT have this value.
**Why it happens:** Phase 55 only added `awaiting_admin` and `fully_approved` to `sor_line_item_status`, not to `sor_request_status`.
**How to avoid:** The planner has two options: (A) Add `awaiting_warehouse` to `sor_request_status` enum via a new migration, or (B) Map the new status to an existing enum value at the UI display level (e.g., display "Awaiting Warehouse" but store `partially_approved`). Option B is simpler if no backend consumer depends on the exact enum value.
**Warning signs:** UI tries to set SOR status to a value not in the enum.

### Pitfall 4: Mixing L1 and L2 Approval Queries
**What goes wrong:** Queries that count "approved" quantities without filtering by `layer` will double-count (L1 qty + L2 qty).
**Why it happens:** Existing queries in the codebase don't filter by layer.
**How to avoid:** Always filter by `layer = 'quartermaster'` for L1 or `layer = 'admin'` for L2 in queries.
**Warning signs:** "Total approved quantity" appears doubled on the UI.

### Pitfall 5: Execution Page Creates Links to SOR Detail
**What goes wrong:** User clicks SOR ID on execution page expecting navigation.
**Why it happens:** SOR ID column looks clickable in a dark theme (monospace amber text is used for links elsewhere).
**How to avoid:** CONTEXT explicitly says "SOR ID is display-only -- not a link." Use plain text styling, not the `text-amber-400 font-mono` link pattern.
**Warning signs:** SOR IDs look like links but aren't clickable, or worse, ARE clickable.

### Pitfall 6: Not Re-Validating Stock at Execution Time
**What goes wrong:** Stock was available when L2 was approved but was consumed by another transaction before execution.
**Why it happens:** Time gap between L2 approval and execution.
**How to avoid:** The DB trigger `validate_sor_fulfillment` already validates stock with advisory lock at execution time. The UI should catch the DB error gracefully and display "Insufficient stock -- retry later."
**Warning signs:** Execution succeeds despite insufficient stock (only if triggers are bypassed, which shouldn't happen).

### Pitfall 7: Sidebar "Stock Out" Link Behavior
**What goes wrong:** Confusion about which page the "Stock Out" link should go to.
**Why it happens:** Currently there are TWO sidebar items: "Stock Out" (`/inventory/stock-out`) and "Stock-Out Requests" (`/inventory/stock-out-requests`).
**How to avoid:** Per CONTEXT, `/inventory/stock-out` becomes the execution page. The sidebar should have "Stock-Out Requests" (the list/create page) and "Stock-Out Execution" or rename appropriately. The current "Stock Out" label at `/inventory/stock-out` gets its content replaced with the execution page.
**Warning signs:** Two sidebar items pointing to conceptually similar pages.

## Code Examples

### Querying L1 Approvals with Remaining Unassigned Qty
```typescript
// For a line item in 'awaiting_admin' status, find L1 approvals
// and calculate how much qty is unassigned to warehouses
const { data: l1Approvals } = await supabase
  .from('stock_out_approvals')
  .select(`
    id,
    approved_quantity,
    decision,
    layer,
    l2_assignments:stock_out_approvals!stock_out_approvals_parent_approval_id_fkey(
      id,
      approved_quantity,
      warehouse_id,
      warehouses!stock_out_approvals_warehouse_id_fkey(id, name)
    )
  `)
  .eq('line_item_id', lineItemId)
  .eq('layer', 'quartermaster')
  .eq('decision', 'approved')
  .eq('is_active', true);

// Calculate remaining unassigned for each L1 approval
const l1WithRemaining = (l1Approvals || []).map(l1 => {
  const totalAssigned = (l1.l2_assignments || []).reduce(
    (sum: number, l2: any) => sum + (l2.approved_quantity || 0), 0
  );
  return {
    ...l1,
    total_assigned: totalAssigned,
    remaining_unassigned: l1.approved_quantity - totalAssigned,
  };
});
```

### Execution Page Query (All Warehouse Assignments)
```typescript
// Query all L2 (admin) approvals with their execution status
const { data: assignments } = await supabase
  .from('stock_out_approvals')
  .select(`
    id,
    approved_quantity,
    warehouse_id,
    line_item_id,
    parent_approval_id,
    decided_at,
    warehouses!stock_out_approvals_warehouse_id_fkey(id, name),
    line_item:stock_out_line_items!stock_out_approvals_line_item_id_fkey(
      id, item_name, item_sku, item_id, conversion_rate,
      request:stock_out_requests!stock_out_line_items_request_id_fkey(
        id, request_number, reason, requester_id,
        requester:users!stock_out_requests_requester_id_fkey(id, full_name)
      )
    ),
    inventory_txns:inventory_transactions!inventory_transactions_stock_out_approval_id_fkey(
      id, status
    )
  `)
  .eq('layer', 'admin')
  .eq('decision', 'approved')
  .eq('is_active', true)
  .order('decided_at', { ascending: false });

// Determine execution status per assignment
const executionRows = (assignments || []).map(a => {
  const isExecuted = (a.inventory_txns || []).some(
    (tx: any) => tx.status === 'completed'
  );
  return {
    ...a,
    execution_status: isExecuted ? 'executed' : 'pending_execution',
  };
});
```

### 3-Segment Progress Bar Component
```typescript
interface ProgressBarProps {
  requestedQty: number;
  l1ApprovedQty: number;
  l2AssignedQty: number;
  executedQty: number;
}

function LineItemProgressBar({ requestedQty, l1ApprovedQty, l2AssignedQty, executedQty }: ProgressBarProps) {
  const l1Pct = (l1ApprovedQty / requestedQty) * 100;
  const l2Pct = (l2AssignedQty / requestedQty) * 100;
  const execPct = (executedQty / requestedQty) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden flex">
            {/* Executed segment (innermost) */}
            {execPct > 0 && (
              <div className="h-full bg-emerald-500" style={{ width: `${execPct}%` }} />
            )}
            {/* L2 assigned but not executed */}
            {l2Pct - execPct > 0 && (
              <div className="h-full bg-purple-500" style={{ width: `${l2Pct - execPct}%` }} />
            )}
            {/* L1 approved but not L2 assigned */}
            {l1Pct - l2Pct > 0 && (
              <div className="h-full bg-blue-500" style={{ width: `${l1Pct - l2Pct}%` }} />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div>L1 Approved: {l1ApprovedQty}/{requestedQty}</div>
            <div>L2 Assigned: {l2AssignedQty}/{l1ApprovedQty}</div>
            <div>Executed: {executedQty}/{l2AssignedQty}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### Status Badge Mapping
```typescript
// Maps line item status to display label and color per CONTEXT.md decisions
const LINE_ITEM_STATUS_DISPLAY: Record<string, { label: string; color: string; bgColor: string }> = {
  pending:           { label: 'Pending',           color: 'text-amber-400',   bgColor: 'bg-amber-500/10 border-amber-500/30' },
  awaiting_admin:    { label: 'Qty Approved',      color: 'text-blue-400',    bgColor: 'bg-blue-500/10 border-blue-500/30' },
  fully_approved:    { label: 'Ready to Execute',  color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/30' },
  rejected:          { label: 'Rejected',          color: 'text-red-400',     bgColor: 'bg-red-500/10 border-red-500/30' },
  cancelled:         { label: 'Cancelled',         color: 'text-slate-400',   bgColor: 'bg-slate-500/10 border-slate-500/30' },
  partially_executed:{ label: 'Partially Executed', color: 'text-purple-400',  bgColor: 'bg-purple-500/10 border-purple-500/30' },
  executed:          { label: 'Executed',           color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/30' },
};

// CONTEXT says "Warehouse Assigned" should also be shown. This is a sub-state of
// 'awaiting_admin' where some L2 assignments exist but not all qty is covered.
// The badge can check L2 assignment count to show "Warehouse Assigned" vs "Qty Approved".
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single approval dialog with batch selection | Per-row L1/L2 action buttons | Phase 57 | Complete rewrite of approval UX |
| Approval creates pending inventory_transaction | L2 creates pending inventory_transaction | Phase 57 | Inventory transaction only created when warehouse is known |
| `approved` line item status | `awaiting_admin` -> `fully_approved` | Phase 55 DB migration | Triggers already handle the new flow |
| Stock-out execution from SOR detail only | Dedicated execution page + SOR detail | Phase 57 | New `/inventory/stock-out` page |
| Two sidebar items (Stock Out + Stock-Out Requests) | Consolidated navigation | Phase 57 | Sidebar cleanup |

**Deprecated/outdated:**
- `ApprovalDialog` component (`approval-dialog.tsx`): Will be replaced by L1 and L2 dialogs
- `ExecutionDialog` component (`execution-dialog.tsx`): Will be replaced by execution page and confirmation dialog
- Batch checkbox selection in `LineItemTable`: Will be replaced by per-row buttons
- `approved` line item status: Legacy, `awaiting_admin` and `fully_approved` are the new statuses

## Critical Implementation Notes

### 1. DB Schema Already Supports Two-Layer Flow
The following are already in place from Phase 55:
- `stock_out_approvals.layer` column (`'quartermaster'` or `'admin'`)
- `stock_out_approvals.parent_approval_id` column (self-reference for L2 -> L1)
- `stock_out_approvals.warehouse_id` column (required for L2, null for L1)
- `sor_line_item_status` enum has `awaiting_admin` and `fully_approved`
- All trigger functions rewritten for two-layer flow
- TypeScript types generated and available

### 2. SOR Request Status Needs UI-Level Mapping
The `sor_request_status` enum does NOT have `awaiting_warehouse`. The CONTEXT.md status logic maps to existing enum values:
- "Pending" = `pending` (ANY line item pending)
- "Awaiting Warehouse" = `partially_approved` (ALL L1 approved, ANY unassigned to warehouse)
- "Ready to Execute" = `approved` (ALL fully warehouse-assigned)
- "Executed" = `executed` (ALL executed)
- "Rejected" = `rejected` (ALL rejected)

The recommended approach: use the existing enum values in the DB but display custom labels in the UI. The `compute_sor_request_status()` trigger already computes `partially_approved` when items are in `awaiting_admin` state, and `approved` when all items are `fully_approved`. The UI just needs a label mapping layer.

### 3. Conversion Rate Handling
The `conversion_rate` lives on `stock_out_line_items` (per-item). Both L1 and L2 dialogs should display the standard unit conversion using the line item's `conversion_rate` and the item's `standard_unit_rel.name`. The conversion rate is NOT collected in the approval dialogs -- it was set when the line item was created. The L2 dialog passes it through to the `inventory_transaction`.

### 4. Execution Flow Difference: Stock-Out Page vs SOR Detail
- **Stock-out execution page:** Simple confirmation dialog (just item, qty, warehouse, and a warning). No stock display.
- **SOR detail page (Warehouse Assignments tab):** Confirmation with before/after stock levels ("WH-A current: 45 -> After: 5"). Requires fetching current warehouse stock.

### 5. EXEC-03 Contradiction
EXEC-03 requirement says "User can create a new stock-out request from the execution page." However, CONTEXT.md (user's explicit decision) says "No 'New Request' button -- this page is for execution only." **The CONTEXT.md takes precedence** as it represents the user's locked decision. The planner should note this and skip EXEC-03 or mark it as overridden by user decision.

## Open Questions

1. **Sidebar restructuring**
   - What we know: Current sidebar has "Stock Out" and "Stock-Out Requests" as separate items. CONTEXT says execution page replaces Stock Out page.
   - What's unclear: Should "Stock-Out Requests" remain as a separate item? Should both items be kept with updated labels?
   - Recommendation: Keep both items: "Stock-Out Requests" (list/create at `/inventory/stock-out-requests`) and rename "Stock Out" to "Execution Queue" or keep as "Stock Out" pointing to the execution page at `/inventory/stock-out`. The planner should decide exact label.

2. **L1 rejection flow with per-row buttons**
   - What we know: CONTEXT says rejection only at L1. The existing `RejectionDialog` handles batch rejection.
   - What's unclear: Should the "Approve Qty" button on a pending line item have a dropdown with "Approve" and "Reject" options, or should there be a separate reject button?
   - Recommendation: Show both "Approve Qty" (green) and "Reject" (red/outline) buttons on pending items. The reject button opens the existing `RejectionDialog` for that single line item.

3. **Progress bar: "Warehouse Assigned" intermediate state**
   - What we know: CONTEXT says badge changes through "Pending" -> "Qty Approved" -> "Warehouse Assigned" -> "Ready to Execute". But `awaiting_admin` doesn't distinguish between "qty approved, no warehouse" and "qty approved, some warehouse".
   - What's unclear: How to detect "Warehouse Assigned" vs "Qty Approved" for the badge.
   - Recommendation: When status is `awaiting_admin`, check if any L2 approvals exist for that line item. If yes: "Warehouse Assigned". If all L1 qty is covered by L2: badge changes to "Ready to Execute" (status auto-transitions to `fully_approved` via trigger). This is purely a UI display concern.

## Sources

### Primary (HIGH confidence)
- `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` - Base SOR schema
- `/home/yaungni/qm-core/supabase/migrations/20260217100000_two_layer_approval_schema.sql` - Two-layer approval DB foundation
- `/home/yaungni/qm-core/supabase/migrations/20260217099999_two_layer_enum_extension.sql` - Enum extensions
- `/home/yaungni/qm-core/supabase/migrations/053_stock_out_validation.sql` - Stock validation functions
- `/home/yaungni/qm-core/types/database.ts` - TypeScript types (lines 522-620, 2066-2082)
- `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` - Current approval dialog (to be replaced)
- `/home/yaungni/qm-core/components/stock-out-requests/line-item-table.tsx` - Current line item table (to be modified)
- `/home/yaungni/qm-core/app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` - SOR detail page (to be modified)
- `/home/yaungni/qm-core/app/(dashboard)/inventory/stock-out/page.tsx` - Current stock-out page (to be replaced)
- `/home/yaungni/qm-core/components/layout/sidebar.tsx` - Sidebar navigation (lines 67-72)

### Secondary (MEDIUM confidence)
- `/home/yaungni/qm-core/.planning/phases/57-two-layer-approval-ui-execution-page/57-CONTEXT.md` - User decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Existing codebase patterns well-understood, DB schema fully inspected
- Pitfalls: HIGH - Identified from direct codebase analysis comparing old flow vs new requirements
- Code examples: HIGH - Based on actual codebase patterns and DB trigger behavior

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable internal codebase)
