# Architecture Patterns: Stock-Out Per-Line-Item Execution

**Domain:** Existing stock-out request approval system modifications
**Researched:** 2026-02-11

## Executive Summary

The existing stock-out architecture uses **batch atomic execution** via approval-level pending transactions. All approved line items in a request execute together atomically through an RPC-style pattern. The NEW requirement shifts to **per-line-item execution** where each line item can be executed independently.

This requires architectural changes in three integration layers:

1. **Execution Model:** Shift from request-level batch to line-item-level individual execution
2. **QMHQ Linking:** Enable QMHQ item detail to query stock-out transactions through the request relationship (QMHQ → SOR → Approvals → Transactions)
3. **Reference Display:** Show both SOR number and QMHQ number in transaction records for dual traceability

**Key Integration Points:**
- Execution component: NEW execution dialog per line item (replaces per-approval batch)
- QMHQ detail page: JOIN query to fetch stock-out transactions via `stock_out_requests.qmhq_id`
- Transaction reference: Populate both `reference_no` and maintain FK links for dual display
- Status computation: Line item status must track per-line execution (not per-approval)

## Current Architecture (v1.6 Baseline)

### Execution Flow

```
Stock-Out Request (SOR)
  └── Line Item 1 (requested_qty: 20)
       ├── Approval A01 (approved_qty: 5, warehouse: WH-A) → inventory_transaction (pending, stock_out_approval_id=A01)
       ├── Approval A02 (approved_qty: 10, warehouse: WH-B) → inventory_transaction (pending, stock_out_approval_id=A02)
       └── Remaining: 5 units (not yet approved)
  └── Line Item 2 (requested_qty: 15)
       └── Approval A03 (approved_qty: 15, warehouse: WH-A) → inventory_transaction (pending, stock_out_approval_id=A03)

Current Execution Pattern:
- User clicks "Execute Stock-Out" button on request detail page
- ExecutionDialog fetches ALL pending transactions for ALL approvals in the request
- User confirms → RPC updates ALL pending transactions to 'completed' atomically
- Trigger updates line item statuses based on sum of executed transactions
```

**Source:**
- `supabase/migrations/053_stock_out_validation.sql` (lines 309-370): Auto-update line item status trigger
- `components/stock-out-requests/execution-dialog.tsx` (lines 109-114): Batch execution query
- `.planning/phases/28-stock-out-request-approval-ui/28-03-PLAN.md` (line 113): `in('stock_out_approval_id', approvalIds)` batch query

### Data Flow Relationships

```
inventory_transactions
  ├── stock_out_approval_id (FK to stock_out_approvals) [NULLABLE]
  ├── qmhq_id (FK to qmhq) [NULLABLE]
  └── reference_no (TEXT) [FREE TEXT FIELD]

stock_out_approvals
  └── line_item_id (FK to stock_out_line_items)

stock_out_line_items
  └── request_id (FK to stock_out_requests)

stock_out_requests
  └── qmhq_id (FK to qmhq) [NULLABLE, 1:1 via unique index]
```

**Current Linking Patterns:**

| Transaction Type | stock_out_approval_id | qmhq_id | reference_no | Query Path |
|-----------------|----------------------|---------|--------------|------------|
| SOR-initiated stock-out | SET (FK link) | SET (copied from SOR) | SOR-YYYY-NNNNN | Direct FK |
| Legacy QMHQ auto-stock-out | NULL | SET | "Auto stock-out from {qmhq_id}" | Direct FK |

**Issue Discovered:** Approval dialog creates transactions with `stock_out_approval_id` but did NOT set `qmhq_id`, making transactions invisible on QMHQ detail page (which filters by `qmhq_id`).

**Source:** `.planning/debug/resolved/sor-approval-reselect-and-transactions.md` (lines 45, 63)

### Status Computation Logic

```sql
-- Trigger: update_sor_line_item_execution_status (migration 053, lines 309-370)
-- Fires on inventory_transactions INSERT/UPDATE

1. Get approval.line_item_id from stock_out_approval_id
2. SUM approved_quantity for ALL approvals on that line item
3. SUM executed quantity for ALL inventory_transactions linked to those approvals
4. IF total_executed >= total_approved THEN status = 'executed'
   ELSIF total_executed > 0 THEN status = 'partially_executed'
```

**Key Constraint:** Status is computed from ALL approvals and ALL transactions for a line item. The trigger aggregates across approvals, not per-approval.

## New Architecture Requirements

### 1. Per-Line-Item Execution Model

**Current:** One execution action processes all approved line items (batch atomic).

**New:** Each line item can be executed independently.

**Architectural Changes:**

```
BEFORE (v1.6 — Per-Request Execution):
  ExecutionDialog
    ├── Fetches: ALL pending transactions for request
    ├── Displays: Aggregated list by approval
    └── Executes: Single RPC updates ALL transactions → status='completed'

AFTER (NEW — Per-Line-Item Execution):
  LineItemExecutionDialog (NEW COMPONENT)
    ├── Fetches: Pending transactions for ONE line item only
    ├── Displays: Transactions grouped by approval for THIS line item
    └── Executes: Updates transactions for THIS line item only
```

**Component Changes:**

| Component | Status | Changes |
|-----------|--------|---------|
| `components/stock-out-requests/execution-dialog.tsx` | MODIFY | Add `lineItemId?: string` prop. Filter query by line item if provided. Keep request-level execution as fallback. |
| `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` | MODIFY | Add "Execute" button per line item row (not just request-level). Pass `lineItemId` to dialog. |
| Line item table | MODIFY | Add action column with "Execute" button (enabled when `status IN ('approved', 'partially_executed')`). |

**Query Change:**

```typescript
// CURRENT (v1.6 — batch all approvals):
.select('*')
.in('stock_out_approval_id', approvalIds) // ALL approvals in request
.eq('status', 'pending')

// NEW (per-line-item):
.select('*')
.in('stock_out_approval_id', approvalIdsForLineItem) // Filter approvals by line_item_id FIRST
.eq('status', 'pending')
```

**Database Impact:** NONE. Existing triggers already handle per-line-item status computation. The trigger aggregates by `line_item_id`, so executing a subset of transactions will correctly update that line's status.

**Source:** `supabase/migrations/053_stock_out_validation.sql` (line 332): `WHERE a.line_item_id = li_id` — trigger already scoped to line item.

### 2. QMHQ → Stock-Out Transaction Linking

**Current Problem:** QMHQ detail page cannot see stock-out transactions because:
- Transactions have `stock_out_approval_id` (links to approval)
- Approvals link to `line_item_id` (links to line item)
- Line items link to `request_id` (links to request)
- Requests link to `qmhq_id` (links back to QMHQ)
- **BUT:** QMHQ page filters transactions by `qmhq_id` directly (which may be NULL if not copied during approval)

**Existing Query (QMHQ Detail Page):**

```typescript
// app/(dashboard)/qmhq/[id]/page.tsx (lines 212-222)
.from('inventory_transactions')
.select('*, item:items(id, name, sku), warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name)')
.eq('qmhq_id', qmhqData.id)  // Direct FK filter
.eq('movement_type', 'inventory_out')
.eq('is_active', true)
```

**Problem:** This only works for:
1. Legacy auto-stock-outs (created by trigger, qmhq_id is set)
2. Manual stock-outs where qmhq_id was set

It does NOT work for SOR-initiated stock-outs unless `qmhq_id` is explicitly copied during approval.

**Architectural Solutions (3 Options):**

#### Option A: Copy qmhq_id During Approval (RECOMMENDED)

**Pattern:** When creating pending transaction in approval dialog, copy `qmhq_id` from request to transaction.

**Implementation:**

```typescript
// components/stock-out-requests/approval-dialog.tsx (line 322 area)
const { data: sorData } = await supabase
  .from('stock_out_requests')
  .select('qmhq_id')
  .eq('id', requestId)
  .single();

const { error: txError } = await supabase
  .from('inventory_transactions')
  .insert({
    movement_type: 'inventory_out',
    item_id: item.item_id,
    warehouse_id: item.warehouse_id,
    quantity: item.approved_quantity,
    reason: requestReason,
    stock_out_approval_id: approvalRecord.id,
    qmhq_id: sorData?.qmhq_id,  // COPY from request
    status: 'pending',
    created_by: user.id,
  });
```

**Pros:**
- No database schema changes
- No query changes on QMHQ page
- Maintains existing direct FK filter pattern
- Simple one-line code change

**Cons:**
- Data redundancy (qmhq_id stored in 3 tables: requests, line_items implicit via FK, transactions)
- Must be copied consistently across all transaction creation points

#### Option B: JOIN Query Through Relationship Chain

**Pattern:** QMHQ page queries through the FK chain.

**Implementation:**

```typescript
// NEW query for QMHQ detail page
const { data: stockOutData } = await supabase
  .from('inventory_transactions')
  .select(`
    *,
    item:items(id, name, sku),
    warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name),
    approval:stock_out_approvals!stock_out_approval_id(
      id,
      line_item:stock_out_line_items!line_item_id(
        id,
        request:stock_out_requests!request_id(
          id,
          qmhq_id
        )
      )
    )
  `)
  .eq('movement_type', 'inventory_out')
  .eq('is_active', true);

// Filter in JS:
const filtered = stockOutData?.filter(tx =>
  tx.approval?.line_item?.request?.qmhq_id === qmhqData.id
);
```

**Pros:**
- No data redundancy
- No schema changes
- Follows relational model strictly

**Cons:**
- Complex nested JOIN (4 levels deep)
- Filtering happens in JS, not database (performance concern for large datasets)
- Supabase PostgREST may not optimize nested filters well
- More verbose query

**Source:** Supabase nested JOIN pattern from [Supabase Joins Documentation](https://supabase.com/docs/guides/database/joins-and-nesting)

#### Option C: Database View

**Pattern:** Create a database view that pre-joins the relationship.

**Implementation:**

```sql
-- NEW migration: 0XX_inventory_transaction_qmhq_view.sql
CREATE OR REPLACE VIEW inventory_transactions_with_qmhq AS
SELECT
  it.*,
  sor.qmhq_id AS resolved_qmhq_id
FROM inventory_transactions it
LEFT JOIN stock_out_approvals soa ON it.stock_out_approval_id = soa.id
LEFT JOIN stock_out_line_items soli ON soa.line_item_id = soli.id
LEFT JOIN stock_out_requests sor ON soli.request_id = sor.id;

-- TypeScript query becomes:
.from('inventory_transactions_with_qmhq')
.select('*, item:items(...), warehouse:warehouses(...)')
.eq('resolved_qmhq_id', qmhqData.id)
.eq('movement_type', 'inventory_out')
```

**Pros:**
- Database-level filter (performant)
- Simple query in application code
- View handles complexity

**Cons:**
- Adds database object (view)
- RLS policies must be applied to view separately
- View must be regenerated if schema changes

**Recommendation:** **Option A (Copy qmhq_id)** for v1.7 because:
1. Minimal code change (one line in approval dialog)
2. No schema migration needed
3. Maintains existing query patterns
4. Performance optimal (direct indexed FK lookup)
5. Follows existing pattern (transactions already have qmhq_id for legacy auto-stock-outs)

### 3. Dual Reference Display (SOR + QMHQ)

**Current:** `inventory_transactions.reference_no` is free-text field, inconsistently populated.

**Requirement:** Transaction records should show BOTH:
- SOR number (e.g., SOR-2026-00001)
- QMHQ number (e.g., QMHQ-2026-00042) if linked

**Architectural Pattern:**

```typescript
// Format: "{SOR_NUMBER} (QMHQ: {QMHQ_NUMBER})" or just SOR_NUMBER if standalone

// During approval (approval-dialog.tsx):
const { data: requestData } = await supabase
  .from('stock_out_requests')
  .select('request_number, qmhq_id, qmhq:qmhq(request_id)')
  .eq('id', requestId)
  .single();

const reference = requestData.qmhq_id
  ? `${requestData.request_number} (QMHQ: ${requestData.qmhq.request_id})`
  : requestData.request_number;

await supabase.from('inventory_transactions').insert({
  // ... other fields
  reference_no: reference,
  stock_out_approval_id: approvalRecord.id,
  qmhq_id: requestData.qmhq_id,  // Option A implementation
});
```

**Display Components:**

| Page | Component | Display Format |
|------|-----------|---------------|
| QMHQ Detail | Transaction table | "SOR-2026-00001" (linked to SOR detail) |
| SOR Detail | Transaction tab | "SOR-2026-00001 (QMHQ: QMHQ-2026-00042)" (QMHQ linked) |
| Inventory Dashboard | Transaction list | "SOR-2026-00001 (QMHQ: QMHQ-2026-00042)" |

**Reference Component Pattern:**

```typescript
// NEW: components/inventory/transaction-reference.tsx
interface TransactionReferenceProps {
  referenceNo: string | null;
  sorId?: string | null;
  qmhqId?: string | null;
}

export function TransactionReference({ referenceNo, sorId, qmhqId }: TransactionReferenceProps) {
  // Parse reference_no: "SOR-2026-00001 (QMHQ: QMHQ-2026-00042)"
  const sorMatch = referenceNo?.match(/SOR-\d{4}-\d{5}/);
  const qmhqMatch = referenceNo?.match(/QMHQ: (QMHQ-\d{4}-\d{5})/);

  return (
    <div className="flex gap-2">
      {sorMatch && sorId && (
        <Link href={`/inventory/stock-out-requests/${sorId}`}>
          <code className="text-blue-400 hover:underline">{sorMatch[0]}</code>
        </Link>
      )}
      {qmhqMatch && qmhqId && (
        <span className="text-slate-400">
          (QMHQ: <Link href={`/qmhq/${qmhqId}`}>
            <code className="text-blue-400 hover:underline">{qmhqMatch[1]}</code>
          </Link>)
        </span>
      )}
      {!sorMatch && !qmhqMatch && referenceNo && (
        <code className="text-slate-400">{referenceNo}</code>
      )}
    </div>
  );
}
```

**Database Impact:** NONE. `reference_no` is already TEXT. No migration needed.

## Integration Points Summary

### 1. NEW Components

| Component | Path | Purpose | Dependencies |
|-----------|------|---------|--------------|
| LineItemExecutionDialog | `components/stock-out-requests/line-item-execution-dialog.tsx` | Execute specific line item | ExecutionDialog (copy/modify) |
| TransactionReference | `components/inventory/transaction-reference.tsx` | Display dual reference with links | None |

### 2. MODIFIED Components

| Component | Modification | Reason |
|-----------|-------------|--------|
| `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx` | Add "Execute" button per line item row | Per-line-item execution trigger |
| `components/stock-out-requests/line-item-table.tsx` | Add action column with Execute button | UI entry point for per-line execution |
| `components/stock-out-requests/approval-dialog.tsx` | Copy `qmhq_id` to transaction, format `reference_no` | Option A implementation + dual reference |
| `components/stock-out-requests/execution-dialog.tsx` | Add `lineItemId` prop, filter query | Support both line-item and request-level execution |
| `app/(dashboard)/qmhq/[id]/page.tsx` | Use TransactionReference component | Dual reference display |

### 3. Database Schema Changes

**NONE REQUIRED.** All changes are application-level query and data population logic.

Existing schema already supports:
- `inventory_transactions.stock_out_approval_id` (FK for execution tracking)
- `inventory_transactions.qmhq_id` (FK for QMHQ linking)
- `inventory_transactions.reference_no` (TEXT for dual display)
- Triggers for line item status computation (already scoped to line_item_id)

### 4. Data Flow Changes

```
BEFORE (v1.6):
  User approves → Approval created → Pending transaction created (stock_out_approval_id=X, qmhq_id=NULL, reference_no=NULL)
  User executes request → ALL pending transactions updated to completed
  QMHQ page → Queries inventory_transactions WHERE qmhq_id=Y (finds nothing)

AFTER (v1.7):
  User approves → Approval created → Pending transaction created (stock_out_approval_id=X, qmhq_id=Y, reference_no="SOR-2026-00001 (QMHQ: QMHQ-2026-00042)")
  User executes line item → FILTERED pending transactions for that line item updated to completed
  QMHQ page → Queries inventory_transactions WHERE qmhq_id=Y (finds transactions)
```

## Build Order (Recommended Sequence)

### Phase 1: QMHQ Linking Fix (Quick Win)
**Goal:** Make existing transactions visible on QMHQ page.

1. Modify `components/stock-out-requests/approval-dialog.tsx`:
   - Fetch `qmhq_id` from request
   - Copy `qmhq_id` to transaction insert
   - Format `reference_no` as "SOR-YYYY-NNNNN (QMHQ: QMHQ-YYYY-NNNNN)"

2. Test: Approve stock-out request → Verify transaction appears on QMHQ detail page

**Dependencies:** None
**Risk:** Low (single file change, no schema migration)
**Value:** Unblocks QMHQ → transaction visibility immediately

### Phase 2: Dual Reference Display
**Goal:** Show clickable SOR/QMHQ references in transaction lists.

1. Create `components/inventory/transaction-reference.tsx`:
   - Parse `reference_no` for SOR and QMHQ numbers
   - Render as linked code blocks

2. Integrate into:
   - QMHQ detail transaction table
   - SOR detail transaction tab
   - Inventory dashboard transaction list

3. Test: Verify links navigate correctly, handle NULL cases

**Dependencies:** Phase 1 (reference_no must be populated)
**Risk:** Low (display-only component, no data mutations)
**Value:** Improved UX, bidirectional navigation

### Phase 3: Per-Line-Item Execution
**Goal:** Enable independent line item execution.

1. Copy `components/stock-out-requests/execution-dialog.tsx` to `line-item-execution-dialog.tsx`:
   - Add `lineItemId` prop (required)
   - Modify query: Filter approvals by `line_item_id` BEFORE fetching transactions
   - Update title: "Execute Line Item Stock-Out"

2. Modify `components/stock-out-requests/line-item-table.tsx`:
   - Add "Actions" column
   - Add "Execute" button per row (enabled when `status IN ('approved', 'partially_executed')`)
   - Pass `lineItemId` to dialog

3. Modify `app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx`:
   - Import LineItemExecutionDialog
   - Pass to line item table component

4. Test:
   - Execute single line item → Verify only that line's transactions completed
   - Verify other line items remain pending
   - Verify line item status updates correctly

**Dependencies:** Phase 1 (for qmhq_id linking)
**Risk:** Medium (execution logic, must not break batch execution)
**Value:** Core feature delivery

### Phase 4: Fallback Request-Level Execution (Optional)
**Goal:** Preserve ability to execute all line items at once.

1. Modify `execution-dialog.tsx`:
   - Make `lineItemId` optional
   - If `lineItemId` provided: Filter by line item (new behavior)
   - If `lineItemId` NULL: Execute all (existing behavior)

2. Keep request-level "Execute All" button alongside per-line buttons

**Dependencies:** Phase 3
**Risk:** Low (optional enhancement, existing pattern still works)
**Value:** Power user feature, bulk operations

## Testing Checklist

### Integration Tests

- [ ] Approve stock-out request → Transaction has `qmhq_id` set
- [ ] Approve stock-out request → `reference_no` contains both SOR and QMHQ numbers
- [ ] QMHQ detail page → Displays transactions for linked requests
- [ ] SOR detail page → TransactionReference links work
- [ ] Execute single line item → Only that line's transactions completed
- [ ] Execute single line item → Other line items remain pending
- [ ] Execute line item → Status updates to 'executed' when all approvals fulfilled
- [ ] Execute line item → Status updates to 'partially_executed' when only some approvals fulfilled
- [ ] Request status computed correctly after per-line execution

### Edge Cases

- [ ] Standalone SOR (no QMHQ link) → reference_no has only SOR number
- [ ] QMHQ-linked SOR → reference_no has both SOR and QMHQ numbers
- [ ] Line item with multiple approvals → All approvals listed in execution dialog
- [ ] Execute line item with insufficient stock → Error blocks execution
- [ ] Execute already-executed line item → Button disabled

## Anti-Patterns to Avoid

### 1. Client-Side Filtering of Nested JOINs
**Why bad:** Poor performance, doesn't scale, bypasses database indexes.

**Example (BAD):**
```typescript
const allTransactions = await supabase
  .from('inventory_transactions')
  .select('*, approval:stock_out_approvals(line_item:stock_out_line_items(request:stock_out_requests(*)))')
  .eq('movement_type', 'inventory_out');

// Filter in JS
const filtered = allTransactions.filter(tx => tx.approval.line_item.request.qmhq_id === qmhqId);
```

**Instead (GOOD):** Copy qmhq_id during approval creation (Option A) and filter at database level.

### 2. Inconsistent reference_no Population
**Why bad:** Creates data quality issues, breaks dual display.

**Prevention:** Centralize reference_no formatting in a utility function.

```typescript
// lib/utils/transaction-reference.ts
export function formatTransactionReference(
  sorNumber: string,
  qmhqNumber?: string | null
): string {
  return qmhqNumber
    ? `${sorNumber} (QMHQ: ${qmhqNumber})`
    : sorNumber;
}
```

### 3. Modifying Existing Trigger Logic
**Why bad:** Existing triggers already handle per-line-item status computation correctly.

**Prevention:** DO NOT modify `update_sor_line_item_execution_status()` trigger. It already aggregates by `line_item_id`, so per-line execution will work without changes.

## Scalability Considerations

| Concern | At 100 SORs/month | At 1000 SORs/month | At 10K SORs/month |
|---------|-------------------|--------------------|--------------------|
| Query Performance | Direct FK lookup (fast) | Same (indexed) | Same (indexed) |
| Transaction Volume | ~500 transactions/month | ~5K transactions/month | ~50K transactions/month |
| reference_no Parsing | Client-side regex (negligible) | Same | Consider indexed GENERATED columns for SOR/QMHQ parts |
| JOIN Query Depth | N/A (using Option A) | N/A | N/A |

**At 10K+ SORs/month:** Consider database-level reference extraction:

```sql
ALTER TABLE inventory_transactions
  ADD COLUMN sor_number TEXT GENERATED ALWAYS AS (
    SUBSTRING(reference_no FROM 'SOR-\d{4}-\d{5}')
  ) STORED;

CREATE INDEX idx_inventory_transactions_sor_number
  ON inventory_transactions(sor_number) WHERE sor_number IS NOT NULL;
```

This enables fast filtering by SOR number without regex in queries.

## Sources

- [PostgreSQL Transactions Documentation](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgREST Functions as RPC](https://docs.postgrest.org/en/v12/references/api/functions.html)
- [Massive Data Updates in PostgreSQL: How We Processed 80M Records](https://medium.com/@nikhil.srivastava944/massive-data-updates-in-postgresql-how-we-processed-80m-records-with-minimal-impact-20babd2cfe6f)
- [Supabase Querying Joins and Nested Tables](https://supabase.com/docs/guides/database/joins-and-nesting)
- [PostgreSQL Foreign Key Constraints Documentation](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [Supabase Multiple Foreign Keys Guide](https://www.restack.io/docs/supabase-knowledge-supabase-multiple-foreign-keys)
- [Foreign Key with Null Values in PostgreSQL](https://www.geeksforgeeks.org/postgresql/foreign-key-with-a-null-value-in-postgresql/)
