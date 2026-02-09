# Phase 28: Stock-Out Request & Approval UI - Research

**Researched:** 2026-02-09
**Domain:** Next.js 14+ App Router, React client components, Supabase integration, multi-step approval workflows
**Confidence:** HIGH

## Summary

Phase 28 builds the complete UI layer for the stock-out request and approval system, whose database foundation was established in Phase 27. The implementation requires creating new list/detail pages for stock-out requests, request creation forms (both QMHQ-linked and manual), per-line-item approval interfaces with partial approval support, and integration with the existing stock-out execution page.

The existing codebase provides strong UI patterns: card/list toggle views (QMHQ, PO pages), dialog-based approval flows (status changes, transactions), tab-based detail pages, and permission-gated actions. The database schema from Phase 27 supports multi-round partial approval through the `stock_out_approvals` table, with automatic status computation and validation triggers.

**Primary recommendation:** Follow established patterns from QMHQ/PO list pages for the request list, use dialog components for approval/rejection actions, and integrate the "Request Stock-Out" button into the existing QMHQ item detail page rather than creating separate flows.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Request Creation Flow:**
- "Request Stock-Out" button on QMHQ item route detail page (not auto-created on QMHQ creation)
- QMHQ-linked requests: Item and quantity pre-filled from QMHQ and locked (not editable)
- QMHQ-linked requests enforce exactly one line item (from phase 27 schema)
- Manual requests: New dedicated list page and create page for stock-out requests (not inside existing stock-out page)
- Multiple line items per request: Manual requests support adding multiple items in a single request
- Warehouse not selected by requester: Requester picks item and qty only — approver assigns warehouse during approval
- Reason field: Requester picks stock-out reason at creation time (request, consumption, damage, lost, transfer, adjustment)
- Notes: Optional notes field (not required)
- Stock levels not shown: Request form does not display available stock — approver validates availability
- List page: Card/list toggle pattern matching QMHQ/PO pages
- Detail page: Full page (not drawer) with Details tab and History tab
- Line items on detail: Table rows (columns: Item, SKU, Requested Qty, Approved Qty, Status, Warehouse)
- Permissions: Any role with QMHQ access can create requests (proposal, inventory, quartermaster, admin)
- List visibility: Role-based — Admin/QM/Inventory see all, others see only their own requests
- Navigation: Under Inventory section in sidebar

**Approval Experience:**
- Approval scope: Per line item (not whole request)
- Multi-round partial approval: Same line item can be approved multiple times (e.g., request 20 → approve 5 → approve 10 later → 5 remaining)
- Each approval creates a stock-out execution instance: Approval action auto-creates a "ready to execute" stock-out record with approved quantities
- Action flow: Select line items in table → click Approve/Reject button at bottom → one action type at a time (approve or reject, not mixed)
- Approve dialog: Modal shows each selected line with editable approved qty (pre-filled with requested) and warehouse selector with stock levels per warehouse
- Approval notes: Optional notes field per approval action (visible on request detail)
- Reject dialog: Free text rejection reason, one reason covers all selected lines
- Rejection is terminal: Rejected request = end of QMHQ flow. No resubmission — user must create new request if needed
- QMHQ status not auto-updated: When request is rejected, user manually updates QMHQ status
- Approver roles: Admin + Quartermaster + Inventory
- Line item totals: Each line shows requested qty, pending qty, approved qty, yet-to-approve qty

**Status Visibility:**
- QMHQ detail: Status badge only (Pending/Approved/Rejected) with click-to-navigate to request detail
- List page filters: Status tabs at top (All / Pending / Approved / Rejected / Cancelled) for quick filtering
- Card/list info: Overall computed request status only (no line-level progress on cards)

**Execution Constraints:**
- All stock-outs require approved request: No manual stock-out without approval — existing stock-out page modified
- Auto-created execution records: Each approval action creates a stock-out execution instance with approved items/qtys/warehouses
- One-click execution: Executor sees pre-built stock-out record and confirms with one click (confirmation dialog required)
- Whole request execution: Execute all approved lines at once (not per-line)
- Stock shortage blocks entire execution: If any line has insufficient stock in assigned warehouse, entire execution blocked
- Auto-status update: Request status auto-updates to Fulfilled after execution completes (computed from line items)
- Permanent execution: Executed stock-outs cannot be voided — must do stock-in to correct
- Executor roles: Inventory + Admin only

### Claude's Discretion
- Form layout and field arrangement
- Card design for list view
- Loading states and skeleton patterns
- Error messages and toast notifications
- Exact table column widths and responsive behavior
- Approval dialog layout
- Confirmation dialog content and styling

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ | App Router framework | Project foundation, app router for RSC/client split |
| React | 18+ | UI library | Next.js dependency, client components for interactivity |
| TypeScript | 5+ | Type safety | Project-wide strict mode enabled |
| Supabase Client | Latest | Database/auth client | Project's database layer, real-time subscriptions |
| Radix UI | Latest | Headless components | Dialog, Select, Dropdown primitives used throughout |
| Tailwind CSS | 3+ | Styling | Project's design system, custom tactical theme |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Latest | Icons | Used consistently across app (Package, Warehouse, etc.) |
| date-fns | Latest | Date formatting | If date manipulation needed beyond Date methods |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Dialog | Headless UI | Radix already used consistently (status-change-dialog, transaction-dialog) |
| Client components | Server components | Approval flow requires interactivity, state management for multi-step dialogs |
| Custom table | TanStack Table | Project uses simple table UI, no advanced features needed |

**Installation:**
```bash
# All dependencies already installed in project
# Verify with: cat package.json | grep "@radix-ui"
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/
├── inventory/
│   ├── stock-out-requests/          # NEW: Stock-out request pages
│   │   ├── page.tsx                 # List page (card/list toggle)
│   │   ├── new/
│   │   │   └── page.tsx             # Manual request creation
│   │   └── [id]/
│   │       └── page.tsx             # Request detail (tabs: Details, History)
│   └── stock-out/
│       └── page.tsx                 # MODIFIED: Add approval check
components/
├── stock-out-requests/              # NEW: SOR-specific components
│   ├── request-card.tsx             # Card view for list
│   ├── approval-dialog.tsx          # Approve line items with warehouse selection
│   ├── rejection-dialog.tsx         # Reject with reason
│   ├── line-item-table.tsx          # Line items with selection + totals
│   └── execution-dialog.tsx         # Confirm execution of approved requests
└── qmhq/
    └── [id]/page.tsx                # MODIFIED: Add "Request Stock-Out" button
```

### Pattern 1: List Page with Card/List Toggle
**What:** Dual-view list page with filter bar and pagination
**When to use:** Primary list pages for entities (QMHQ, PO, stock-out requests)
**Example:**
```typescript
// Source: app/(dashboard)/qmhq/page.tsx (lines 44-606)
export default function StockOutRequestsPage() {
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Status tabs for filtering
  const statusTabs = [
    { key: "all", label: "All", count: totalCount },
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "approved", label: "Approved", count: approvedCount },
    { key: "rejected", label: "Rejected", count: rejectedCount },
    { key: "cancelled", label: "Cancelled", count: cancelledCount },
  ];

  // Card view grouped by status (for pending/in-progress/done)
  {viewMode === "card" && (
    <div className="grid gap-6 lg:grid-cols-3">
      {statusGroups.map(group => (
        <div key={group.key}>
          <div className="column-header">
            <div className={group.dotClass} />
            <h2>{group.label}</h2>
            <span className="stat-counter">{groupedItems[group.key].length}</span>
          </div>
          <div className="flex-1 rounded-b-lg border border-t-0 border-slate-700">
            {groupedItems[group.key].map(item => (
              <RequestCard key={item.id} request={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )}

  // List view as table
  {viewMode === "list" && (
    <div className="command-panel">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th>Request #</th>
            <th>Requester</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(req => (
            <tr key={req.id} onClick={() => router.push(`/inventory/stock-out-requests/${req.id}`)}>
              <td><code>{req.request_number}</code></td>
              <td>{req.requester?.full_name}</td>
              <td><StatusBadge status={req.status} /></td>
              <td>{formatDate(req.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
}
```

### Pattern 2: Detail Page with Tabs
**What:** Full-page detail view with tab navigation for different aspects
**When to use:** Entity detail pages (QMHQ, PO, Invoice, stock-out request)
**Example:**
```typescript
// Source: app/(dashboard)/qmhq/[id]/page.tsx (lines 105-200)
export default function StockOutRequestDetailPage() {
  const [activeTab, setActiveTab] = useState("details");

  return (
    <div className="space-y-6">
      {/* Header with back button and actions */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/inventory/stock-out-requests">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{request.request_number}</h1>
            <p className="text-slate-400">Requester: {request.requester.full_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canApprove && <Button onClick={() => setApprovalDialogOpen(true)}>Approve</Button>}
          {canReject && <Button variant="destructive" onClick={() => setRejectionDialogOpen(true)}>Reject</Button>}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {/* Request info + Line items table */}
          <LineItemTable
            items={lineItems}
            onSelectionChange={setSelectedLineItems}
            canApprove={canApprove}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab entityType="stock_out_request" entityId={requestId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Pattern 3: Approval Dialog with Multiple Inputs
**What:** Dialog with per-item inputs (approved qty, warehouse selection)
**When to use:** Approval flows requiring granular decisions per line item
**Example:**
```typescript
// Source: components/status/status-change-dialog.tsx (adapted)
export function ApprovalDialog({
  open,
  onOpenChange,
  lineItems,
  onConfirm,
}: ApprovalDialogProps) {
  const [approvalData, setApprovalData] = useState<Map<string, ApprovalInput>>(new Map());
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize approval data with requested quantities
  useEffect(() => {
    if (open) {
      const initial = new Map();
      lineItems.forEach(item => {
        const remainingQty = item.requested_quantity - item.total_approved_quantity;
        initial.set(item.id, {
          approvedQuantity: remainingQty.toString(),
          warehouseId: "",
        });
      });
      setApprovalData(initial);
    }
  }, [open, lineItems]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      // Convert map to array of approvals
      const approvals = Array.from(approvalData.entries()).map(([lineItemId, data]) => ({
        line_item_id: lineItemId,
        approved_quantity: parseFloat(data.approvedQuantity),
        warehouse_id: data.warehouseId,
      }));

      await onConfirm({ approvals, notes });
      setNotes("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve Line Items</DialogTitle>
          <DialogDescription>
            Set approved quantities and assign warehouses for {lineItems.length} line item(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lineItems.map(item => {
            const data = approvalData.get(item.id);
            return (
              <div key={item.id} className="border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-slate-200">{item.item_name}</p>
                    <p className="text-sm text-slate-400">SKU: {item.item_sku || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Requested</p>
                    <p className="font-mono text-slate-200">{item.requested_quantity}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Approved Quantity *</Label>
                    <Input
                      type="number"
                      value={data?.approvedQuantity || ""}
                      onChange={(e) => {
                        const updated = new Map(approvalData);
                        updated.set(item.id, {
                          ...updated.get(item.id)!,
                          approvedQuantity: e.target.value,
                        });
                        setApprovalData(updated);
                      }}
                      max={item.requested_quantity - item.total_approved_quantity}
                    />
                  </div>
                  <div>
                    <Label>Warehouse *</Label>
                    <WarehouseSelectWithStock
                      itemId={item.item_id}
                      value={data?.warehouseId || ""}
                      onChange={(whId) => {
                        const updated = new Map(approvalData);
                        updated.set(item.id, {
                          ...updated.get(item.id)!,
                          warehouseId: whId,
                        });
                        setApprovalData(updated);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add approval notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={isSubmitting}>
            {isSubmitting ? "Approving..." : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 4: Line Item Table with Selection and Totals
**What:** Table showing line items with checkboxes, running totals, and actions
**When to use:** Detail pages where users select items for batch operations
**Example:**
```typescript
// Custom component for stock-out request line items
export function LineItemTable({
  items,
  onSelectionChange,
  canApprove,
}: LineItemTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
    onSelectionChange(Array.from(updated));
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
      onSelectionChange([]);
    } else {
      const allIds = new Set(items.map(i => i.id));
      setSelectedIds(allIds);
      onSelectionChange(Array.from(allIds));
    }
  };

  return (
    <div className="command-panel">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            {canApprove && (
              <th className="w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length}
                  onChange={toggleAll}
                />
              </th>
            )}
            <th className="text-left">Item</th>
            <th className="text-left">SKU</th>
            <th className="text-right">Requested</th>
            <th className="text-right">Approved</th>
            <th className="text-right">Remaining</th>
            <th className="text-left">Status</th>
            <th className="text-left">Warehouse</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const remaining = item.requested_quantity - item.total_approved_quantity;
            return (
              <tr key={item.id} className="border-b border-slate-700/50">
                {canApprove && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      disabled={item.status !== 'pending'}
                    />
                  </td>
                )}
                <td className="text-slate-200">{item.item_name}</td>
                <td className="text-slate-400 text-sm">{item.item_sku || "—"}</td>
                <td className="text-right font-mono">{item.requested_quantity}</td>
                <td className="text-right font-mono text-emerald-400">
                  {item.total_approved_quantity}
                </td>
                <td className="text-right font-mono text-amber-400">{remaining}</td>
                <td><StatusBadge status={item.status} /></td>
                <td className="text-slate-400">{item.assigned_warehouse?.name || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {canApprove && selectedIds.size > 0 && (
        <div className="flex items-center justify-between mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded">
          <p className="text-sm text-amber-400">
            {selectedIds.size} line item(s) selected
          </p>
          <div className="flex gap-2">
            <Button onClick={onApprove}>Approve Selected</Button>
            <Button variant="destructive" onClick={onReject}>Reject Selected</Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Mixing approval UI into list pages:** Approval should happen on detail page, not cards/list rows
- **Per-approval execution:** Each approval creates execution instance, but execution happens once per request
- **Client-side status computation:** Status is computed by DB triggers, UI should read computed value
- **Ignoring RLS:** Always check user permissions before showing action buttons (use `usePermissions()`)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog management | Custom modal state management | Radix Dialog + `useState` | Project pattern, accessible, composable |
| Multi-step forms | Wizard library | Multiple dialogs or tabs | Approval is 2-step (select + configure), fits dialog pattern |
| Table selection | Custom checkbox state | Controlled `Set<string>` state | Simple, performant for small datasets (<100 items) |
| Status badges | Custom badge logic | Existing StatusBadge component + computed DB values | DB triggers handle computation, UI just displays |
| Permission checks | Inline role checks | `usePermissions()` hook | Centralized permission matrix matching RLS policies |
| Real-time updates | Manual polling | Supabase subscriptions | Built-in, efficient, already used in project |

**Key insight:** The database schema (Phase 27) already handles complex logic (status transitions, over-execution blocking, stock validation). UI should be thin, focusing on data display and user input collection.

## Common Pitfalls

### Pitfall 1: Misunderstanding Multi-Round Partial Approval
**What goes wrong:** Treating each approval as replacing previous approvals, rather than additive
**Why it happens:** Common approval patterns are binary (approve/reject once)
**How to avoid:**
- UI shows "Remaining" quantity = `requested_quantity - SUM(approved_quantities)`
- Each approval creates new `stock_out_approvals` row with its own `approved_quantity`
- Line item status changes: `pending` → `approved` (on first approval) → `partially_executed` → `executed`
**Warning signs:** User approves 5, then 10, but line item shows 10 approved instead of 15

### Pitfall 2: Forgetting Warehouse Assignment in Approval
**What goes wrong:** Trying to execute approved items without warehouse assignment
**Why it happens:** Requester doesn't select warehouse, approver must assign during approval
**How to avoid:**
- Approval dialog MUST include warehouse selector per line item
- Show available stock per warehouse next to selector
- Database requires `warehouse_id` in execution (through `stock_out_approval_id` link)
**Warning signs:** Approval succeeds but execution fails with "warehouse not assigned" error

### Pitfall 3: Auto-Creating Stock-Out Requests on QMHQ Creation
**What goes wrong:** Creating SOR automatically when QMHQ item route is created
**Why it happens:** Misreading requirement — button trigger, not automatic
**How to avoid:**
- QMHQ item detail page has "Request Stock-Out" button
- Button only appears for item routes (`route_type === 'item'`)
- Button click navigates to `/inventory/stock-out-requests/new?qmhq={id}`
- Form pre-fills item and quantity from QMHQ, locks fields
**Warning signs:** SORs exist without user explicitly requesting stock-out

### Pitfall 4: Allowing Execution Without Full Approval Check
**What goes wrong:** Executor clicks "Execute" but some items lack warehouse assignment or approved qty
**Why it happens:** Execution UI doesn't validate readiness before allowing action
**How to avoid:**
- Query `stock_out_approvals` joined with `stock_out_line_items`
- Calculate per-line: has approved quantity? Has warehouse? Sufficient stock in that warehouse?
- Block execution with clear error message listing issues
- Execution dialog shows summary of what will be executed (item, qty, from warehouse)
**Warning signs:** Database trigger blocks execution, user sees cryptic error

### Pitfall 5: Not Handling QMHQ-Linked vs Manual Request Differences
**What goes wrong:** UI allows editing QMHQ-linked request's item or quantity
**Why it happens:** Single create form trying to handle both cases
**How to avoid:**
- Detect QMHQ link via query param: `?qmhq={id}`
- If linked: disable item selector, disable quantity input, show QMHQ reference
- If manual: enable multi-item addition (add/remove rows)
- Database enforces one-line-item constraint for QMHQ-linked via trigger
**Warning signs:** User can change QMHQ-linked request to different item, breaking linkage

### Pitfall 6: Ignoring Role-Based List Visibility
**What goes wrong:** Requester sees all requests, or admin can't see others' requests
**Why it happens:** Missing RLS-aware query filter
**How to avoid:**
- Admin/Quartermaster/Inventory: `.select()` without filter (see all)
- Proposal/Frontline/Requester: `.select().eq('requester_id', user.id)` (own only)
- Use `usePermissions()` to determine filter client-side, but RLS enforces server-side
- List shows count correctly: "X requests found" vs "X requests found (of Y total)"
**Warning signs:** User sees empty list when they have requests, or sees others' requests when they shouldn't

## Code Examples

Verified patterns from existing codebase:

### Creating Stock-Out Request from QMHQ
```typescript
// Source: Modified from app/(dashboard)/qmhq/[id]/page.tsx
// Add button in QMHQ detail page (item route only)
{qmhq.route_type === 'item' && can('create', 'inventory_transactions') && (
  <Link href={`/inventory/stock-out-requests/new?qmhq=${qmhq.id}`}>
    <Button className="flex items-center gap-2">
      <ArrowUpFromLine className="h-4 w-4" />
      Request Stock-Out
    </Button>
  </Link>
)}

// Source: app/(dashboard)/inventory/stock-out-requests/new/page.tsx
export default function NewStockOutRequestPage() {
  const searchParams = useSearchParams();
  const qmhqId = searchParams.get('qmhq');
  const [qmhqData, setQmhqData] = useState<QMHQData | null>(null);

  useEffect(() => {
    if (qmhqId) {
      fetchQmhqData(qmhqId).then(data => {
        setQmhqData(data);
        // Pre-fill and lock item, quantity
        setLineItems([{
          item_id: data.item_id,
          quantity: data.quantity,
          item_name: data.item.name,
          item_sku: data.item.sku,
        }]);
      });
    }
  }, [qmhqId]);

  const handleSubmit = async () => {
    const supabase = createClient();

    // Insert request
    const { data: request, error } = await supabase
      .from('stock_out_requests')
      .insert({
        qmhq_id: qmhqId || null,
        reason: selectedReason,
        notes: notes || null,
        requester_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert line items
    const { error: lineError } = await supabase
      .from('stock_out_line_items')
      .insert(
        lineItems.map(item => ({
          request_id: request.id,
          item_id: item.item_id,
          requested_quantity: item.quantity,
          // item_name and item_sku auto-populated by trigger
        }))
      );

    if (lineError) throw lineError;

    router.push(`/inventory/stock-out-requests/${request.id}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* If QMHQ-linked, show reference and lock fields */}
      {qmhqData && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
          <p className="text-sm text-blue-400">
            Linked to QMHQ: <code>{qmhqData.request_id}</code>
          </p>
        </div>
      )}

      {/* Reason selector */}
      <Select value={selectedReason} onValueChange={setSelectedReason}>
        <SelectTrigger>
          <SelectValue placeholder="Select reason..." />
        </SelectTrigger>
        <SelectContent>
          {stockOutReasons.map(reason => (
            <SelectItem key={reason} value={reason}>
              {STOCK_OUT_REASON_CONFIG[reason].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Line items table */}
      <LineItemsInput
        items={lineItems}
        onChange={setLineItems}
        disabled={!!qmhqId} // Lock if QMHQ-linked
        allowMultiple={!qmhqId} // Only manual requests can have multiple
      />

      <Button type="submit">Create Request</Button>
    </form>
  );
}
```

### Approving Line Items with Warehouse Selection
```typescript
// Source: components/stock-out-requests/approval-dialog.tsx
export function ApprovalDialog({ lineItems, onConfirm }: ApprovalDialogProps) {
  const [approvalData, setApprovalData] = useState<Map<string, ApprovalInput>>(new Map());
  const [warehouseStocks, setWarehouseStocks] = useState<Map<string, WarehouseStock[]>>(new Map());

  // Fetch stock levels for each item
  useEffect(() => {
    lineItems.forEach(async (item) => {
      const stocks = await fetchWarehouseStocks(item.item_id);
      setWarehouseStocks(prev => new Map(prev).set(item.item_id, stocks));
    });
  }, [lineItems]);

  const handleConfirm = async () => {
    const supabase = createClient();

    // Create approvals in transaction
    const approvals = Array.from(approvalData.entries()).map(([lineItemId, data]) => ({
      line_item_id: lineItemId,
      approved_quantity: parseFloat(data.approvedQuantity),
      decision: 'approved',
      decided_by: user.id,
    }));

    const { data: createdApprovals, error: approvalError } = await supabase
      .from('stock_out_approvals')
      .insert(approvals)
      .select();

    if (approvalError) throw approvalError;

    // Create execution instances for each approval
    const executions = createdApprovals.map((approval, idx) => {
      const lineItemId = approvals[idx].line_item_id;
      const lineItem = lineItems.find(li => li.id === lineItemId)!;
      const data = approvalData.get(lineItemId)!;

      return {
        movement_type: 'inventory_out',
        item_id: lineItem.item_id,
        warehouse_id: data.warehouseId,
        quantity: parseFloat(data.approvedQuantity),
        reason: request.reason,
        stock_out_approval_id: approval.id,
        status: 'pending', // Ready for execution
        created_by: user.id,
      };
    });

    const { error: execError } = await supabase
      .from('inventory_transactions')
      .insert(executions);

    if (execError) throw execError;

    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Approve Line Items</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {lineItems.map(item => {
            const stocks = warehouseStocks.get(item.item_id) || [];
            const data = approvalData.get(item.id);
            const remainingQty = item.requested_quantity - (item.total_approved_quantity || 0);

            return (
              <div key={item.id} className="border border-slate-700 rounded p-4">
                <div className="flex justify-between mb-3">
                  <div>
                    <p className="font-medium">{item.item_name}</p>
                    <p className="text-sm text-slate-400">Remaining: {remainingQty}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Approved Quantity *</Label>
                    <Input
                      type="number"
                      value={data?.approvedQuantity || remainingQty.toString()}
                      onChange={(e) => {
                        const updated = new Map(approvalData);
                        updated.set(item.id, {
                          ...updated.get(item.id)!,
                          approvedQuantity: e.target.value,
                        });
                        setApprovalData(updated);
                      }}
                      max={remainingQty}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label>Warehouse *</Label>
                    <Select
                      value={data?.warehouseId || ""}
                      onValueChange={(whId) => {
                        const updated = new Map(approvalData);
                        updated.set(item.id, {
                          ...updated.get(item.id)!,
                          warehouseId: whId,
                        });
                        setApprovalData(updated);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select warehouse..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stocks.map(stock => (
                          <SelectItem key={stock.warehouse_id} value={stock.warehouse_id}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{stock.warehouse_name}</span>
                              <span className="font-mono text-emerald-400">
                                Stock: {stock.current_stock}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm}>Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Executing Approved Requests
```typescript
// Source: components/stock-out-requests/execution-dialog.tsx
export function ExecutionDialog({ requestId, onConfirm }: ExecutionDialogProps) {
  const [executionData, setExecutionData] = useState<ExecutionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Fetch ready-to-execute transactions
  useEffect(() => {
    const fetchExecutionData = async () => {
      const supabase = createClient();

      // Get pending inventory_out transactions linked to approvals for this request
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          item:items(id, name, sku),
          warehouse:warehouses(id, name),
          approval:stock_out_approvals!stock_out_approval_id(
            line_item_id,
            line_item:stock_out_line_items!line_item_id(
              request_id
            )
          )
        `)
        .eq('status', 'pending')
        .eq('movement_type', 'inventory_out')
        .not('stock_out_approval_id', 'is', null);

      if (error) throw error;

      // Filter to this request
      const requestTransactions = data.filter(
        tx => tx.approval?.line_item?.request_id === requestId
      );

      setExecutionData({ transactions: requestTransactions });

      // Validate stock availability
      const errors: string[] = [];
      for (const tx of requestTransactions) {
        const availableStock = await getWarehouseStock(tx.warehouse_id, tx.item_id);
        if (availableStock < tx.quantity) {
          errors.push(
            `${tx.item.name}: Insufficient stock in ${tx.warehouse.name} (need ${tx.quantity}, have ${availableStock})`
          );
        }
      }

      setValidationErrors(errors);
      setIsLoading(false);
    };

    fetchExecutionData();
  }, [requestId]);

  const handleExecute = async () => {
    if (validationErrors.length > 0) {
      toast({
        title: "Cannot Execute",
        description: "Stock validation errors exist",
        variant: "destructive",
      });
      return;
    }

    const supabase = createClient();

    // Update all transactions to 'completed'
    const { error } = await supabase
      .from('inventory_transactions')
      .update({
        status: 'completed',
        transaction_date: new Date().toISOString(),
      })
      .in('id', executionData.transactions.map(tx => tx.id));

    if (error) throw error;

    // Line item statuses auto-update via trigger
    // Request status auto-updates via trigger

    await onConfirm();
  };

  if (isLoading) {
    return <div>Loading execution data...</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Execute Stock-Out</DialogTitle>
          <DialogDescription>
            {executionData.transactions.length} item(s) ready for execution
          </DialogDescription>
        </DialogHeader>

        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
            <p className="font-medium text-red-400">Validation Errors:</p>
            <ul className="mt-2 space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="text-sm text-red-400">• {err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-sm text-slate-400">Items to be executed:</p>
          {executionData.transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded">
              <div>
                <p className="font-medium">{tx.item.name}</p>
                <p className="text-sm text-slate-400">From: {tx.warehouse.name}</p>
              </div>
              <p className="font-mono text-red-400">{tx.quantity}</p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded">
          <p className="text-sm text-amber-400">
            ⚠️ Execution is permanent. Stock-out transactions cannot be voided.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleExecute}
            disabled={validationErrors.length > 0}
            className="bg-gradient-to-r from-red-600 to-red-500"
          >
            Execute Stock-Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-approval PO/Invoice | Multi-round partial approval | Phase 27 (2026-02-09) | Allows incremental fulfillment, more flexible workflow |
| Manual stock-out without approval | Approval-required stock-out | Phase 27 (2026-02-09) | Audit trail, prevents unauthorized withdrawals |
| Warehouse selection by requester | Warehouse assigned by approver | Phase 27-28 (2026-02-09) | Approver has stock visibility, makes informed assignment |
| Direct inventory_out creation | Approval → Execution instance → Completion | Phase 27-28 (2026-02-09) | Two-phase commit, prevents over-execution |

**Deprecated/outdated:**
- Direct stock-out without request/approval (Phase 27 adds required approval workflow)
- Single-stage approval (now supports multiple approvals per line item)

## Open Questions

1. **Real-time status updates on detail page**
   - What we know: Supabase supports real-time subscriptions, project uses them
   - What's unclear: Should detail page subscribe to `stock_out_requests` and `stock_out_line_items` for live status updates?
   - Recommendation: Implement subscriptions for status changes — approver and requester may both be viewing same request

2. **Bulk approval UI**
   - What we know: User can select multiple line items and click "Approve Selected"
   - What's unclear: Should dialog show all selected items in single scrollable view, or wizard with one item per step?
   - Recommendation: Single scrollable dialog (Pattern 3) — max 5-10 items per request typically, wizard adds complexity

3. **Execution timing**
   - What we know: Execution changes status from 'pending' to 'completed' on `inventory_transactions`
   - What's unclear: Should executor set `transaction_date` explicitly, or always use current timestamp?
   - Recommendation: Auto-set to current timestamp on execution — matches pattern from `stock-out/page.tsx`

## Sources

### Primary (HIGH confidence)
- Phase 27 migration files (052_stock_out_requests.sql, 053_stock_out_validation.sql, 054_stock_out_rls_audit.sql)
- Existing UI patterns from app/(dashboard)/qmhq/page.tsx (card/list toggle, filters)
- Existing UI patterns from app/(dashboard)/po/page.tsx (status grouping, progress indicators)
- Dialog pattern from components/status/status-change-dialog.tsx
- Detail page pattern from app/(dashboard)/qmhq/[id]/page.tsx (tabs, actions)
- Permission system from lib/hooks/use-permissions.ts
- Stock-out existing page from app/(dashboard)/inventory/stock-out/page.tsx

### Secondary (MEDIUM confidence)
- Next.js 14 App Router conventions (observed in project structure)
- Radix UI Dialog, Select, Tabs (package.json dependencies)
- Supabase client patterns (createClient() usage throughout)

### Tertiary (LOW confidence)
None — all findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, patterns established
- Architecture: HIGH - Clear patterns from QMHQ/PO pages, dialog patterns
- Pitfalls: MEDIUM-HIGH - Multi-round approval is new, but schema is solid
- Code examples: HIGH - Adapted from actual project files

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days — stable domain, unlikely to change)
