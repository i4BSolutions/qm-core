# Stack Research: Stock-Out Execution Logic Repair

**Research Date:** 2026-02-11
**Milestone:** v1.7 Stock-Out Execution Fix
**Confidence:** HIGH

## Summary

**Zero new dependencies required.** The existing QM System stack (Next.js 14, Supabase PostgreSQL, React 18, TypeScript, Radix UI) fully supports all three new features:

1. **Per-line-item execution** → Modify existing `ExecutionDialog` component props + query filters
2. **QMHQ-to-transaction linking** → Add nullable FK `qmhq_id` to `inventory_transactions` table
3. **Dual reference display** → Extend SELECT queries with nested join + conditional rendering

**No library upgrades, no new npm packages, no new UI primitives.** This is an architectural refinement using established patterns.

---

## Core Stack (No Changes)

### Framework & Runtime
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| Next.js | 14.2.13 | ✓ Keep | App Router, Server Components stable |
| React | 18.3.1 | ✓ Keep | State management sufficient for per-line actions |
| TypeScript | 5.6.2 | ✓ Keep | Strict mode, types auto-generated from Supabase |

### Database & Backend
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| PostgreSQL | via Supabase | ✓ Keep | 57 migrations, FK constraints, triggers, RLS |
| @supabase/supabase-js | 2.50.0 | ✓ Keep | Client handles FK queries, nested SELECT joins |
| @supabase/ssr | 0.8.0 | ✓ Keep | Server-side rendering integration |

### UI & Styling
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| Tailwind CSS | 3.4.13 | ✓ Keep | Utility classes for dual reference display |
| Radix UI | Various ^1.x-2.x | ✓ Keep | Dialog, Tooltip, Tabs already used |
| lucide-react | 0.447.0 | ✓ Keep | Icons (ExternalLink for QMHQ references) |
| sonner | 2.0.7 | ✓ Keep | Toast notifications for execution feedback |

### Forms & Validation
| Technology | Current Version | Status | Notes |
|------------|----------------|--------|-------|
| react-hook-form | 7.53.0 | ✓ Keep | Not needed (execution is button action, not form) |
| Zod | 3.23.8 | ✓ Keep | Not needed (validation in database triggers) |

---

## Required Stack Additions: NONE

### Why Existing Stack Is Sufficient

**Feature 1: Per-Line-Item Execution**

Current implementation (`ExecutionDialog.tsx`, lines 68-232):
- Accepts `approvalId` prop → filters transactions by `stock_out_approval_id`
- Already handles granular execution (one approval at a time)
- **What changes:** Accept `lineItemId` prop in addition to `approvalId`
- **Why no new library:** React props + Supabase query filters sufficient

**Feature 2: QMHQ-to-Transaction Linking**

Current schema (`inventory_transactions` table):
```sql
-- Existing FKs (migration 023)
qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL  -- Already exists!
stock_out_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL  -- Added in 053
```

**Discovery:** `qmhq_id` FK already exists in `inventory_transactions` (migration 023, line 76). No schema change needed!

**What's missing:** Population logic. Currently, `qmhq_id` is only populated for direct QMHQ fulfillment (item route). Stock-out approvals don't copy the parent `stock_out_requests.qmhq_id` to transactions.

**Fix:** Modify approval creation logic to propagate QMHQ reference:
```typescript
// In approval RPC or client-side transaction creation
const { data: request } = await supabase
  .from('stock_out_requests')
  .select('qmhq_id')
  .eq('id', requestId)
  .single();

// When creating inventory_transaction
await supabase.from('inventory_transactions').insert({
  ...otherFields,
  stock_out_approval_id: approvalId,
  qmhq_id: request?.qmhq_id  // Propagate parent QMHQ link
});
```

**Why no new library:** Simple FK copy operation, no ORM needed.

**Feature 3: Dual Reference Display**

Current pattern (already used in codebase):
```tsx
// Example: QMHQ detail page shows QMRL reference
<Link href={`/qmrl/${qmhq.qmrl_id}`}>
  <span className="font-mono">{qmrl.request_id}</span>
  <ExternalLink className="w-3 h-3" />
</Link>
```

**What changes:** Add conditional secondary reference in transaction lists:
```tsx
// Primary reference (always show)
<div className="font-mono text-slate-200">
  {transaction.stock_out_approval?.approval_number}
</div>

// Secondary reference (show if exists)
{transaction.qmhq?.request_id && (
  <div className="text-xs text-slate-500">
    via {transaction.qmhq.request_id}
  </div>
)}
```

**Why no new library:** Conditional rendering + existing Supabase nested SELECT.

---

## Database Schema Impact

### Existing Schema (Keep)

```sql
-- stock_out_requests (migration 052)
CREATE TABLE stock_out_requests (
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,  -- 1:1 link
  -- ... other fields
);

-- stock_out_approvals (migration 052)
CREATE TABLE stock_out_approvals (
  line_item_id UUID REFERENCES stock_out_line_items(id) ON DELETE CASCADE,
  approval_number TEXT UNIQUE,  -- SOR-YYYY-NNNNN-A01
  -- ... other fields
);

-- inventory_transactions (migration 023)
CREATE TABLE inventory_transactions (
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,  -- Already exists!
  stock_out_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL,  -- Added in 053
  -- ... other fields
);
```

### Required Migration: NONE

The schema already supports dual reference! The FK `qmhq_id` exists in `inventory_transactions` since migration 023 (line 76).

**What's needed:** Logic change, not schema change.

**Verification:**
```bash
# Confirmed in codebase
grep -n "qmhq_id" supabase/migrations/023_inventory_transactions.sql
# Line 76:   qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,
```

---

## Component Modification Strategy

### 1. ExecutionDialog Component

**Current props:**
```typescript
interface ExecutionDialogProps {
  approvalId: string;  // Execute this approval's transactions
  requestId: string;   // Parent request (for navigation)
  // ...
}
```

**New props (backward compatible):**
```typescript
interface ExecutionDialogProps {
  approvalId: string;     // Keep
  lineItemId?: string;    // NEW: Optional line item scope
  requestId: string;      // Keep
  // ...
}
```

**Query change:**
```typescript
// Before: Execute all transactions for one approval
.eq('stock_out_approval_id', approvalId)

// After: Execute transactions for one approval within one line item
.eq('stock_out_approval_id', approvalId)
.eq('line_item_id', lineItemId)  // Filter further if provided
```

**Why no new library:** Existing `useEffect` + `useState` + Supabase client sufficient.

### 2. LineItemTable Component

**Current:** No Execute button (execution is request-level)

**New:** Add Execute button per row

```tsx
// Add to each row
{canExecute && lineItem.status === 'approved' && (
  <Button
    size="sm"
    onClick={() => handleExecuteLineItem(lineItem.id)}
  >
    <ArrowUpFromLine className="w-4 h-4 mr-2" />
    Execute
  </Button>
)}
```

**Why no new library:** Existing Button component + onClick handler pattern.

### 3. Transaction List Cards

**Current display:**
```tsx
<div className="font-mono">
  {transaction.approval?.approval_number}
</div>
```

**New display:**
```tsx
<div>
  <div className="font-mono text-slate-200">
    {transaction.approval?.approval_number}
  </div>
  {transaction.qmhq?.request_id && (
    <div className="text-xs text-slate-500 flex items-center gap-1">
      <span>via {transaction.qmhq.request_id}</span>
      <Link href={`/qmhq/${transaction.qmhq_id}`}>
        <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )}
</div>
```

**Why no new library:** Existing Link, conditional rendering, Tailwind classes.

---

## Type Safety

### Existing Type Generation (Keep)

```bash
# Types auto-generated from Supabase schema
supabase gen types typescript --local > types/database.ts
```

**Current types already include:**
```typescript
// types/database.ts (auto-generated)
export interface Tables {
  inventory_transactions: {
    qmhq_id: string | null;  // Already typed!
    stock_out_approval_id: string | null;
    // ...
  };
}
```

**No manual type changes needed.** The FK `qmhq_id` is already in the schema, so TypeScript types already reflect it.

---

## Data Flow

### Per-Line-Item Execution Flow

```
1. User clicks "Execute" on LineItemTable row
   ↓
2. onClick handler sets lineItemId state
   ↓
3. ExecutionDialog opens with { approvalId, lineItemId }
   ↓
4. Dialog queries:
   SELECT * FROM inventory_transactions
   WHERE stock_out_approval_id = $approvalId
     AND line_item_id = $lineItemId  -- NEW filter
     AND status = 'pending'
   ↓
5. User confirms → UPDATE status = 'completed'
   ↓
6. Trigger: update_sor_line_item_execution_status()
   (already exists, handles partial execution)
```

**Existing patterns reused:**
- State management: `useState` for selected line item
- Query filtering: Supabase `.eq()` chaining
- Status updates: Existing trigger (migration 053, lines 308-370)

### QMHQ Reference Propagation Flow

```
1. Admin approves stock-out request line item
   ↓
2. Approval creates inventory_transactions (status='pending')
   ↓
3. NEW: Copy parent stock_out_requests.qmhq_id → transaction.qmhq_id
   ↓
4. Executor views transaction list
   ↓
5. UI SELECT includes qmhq:qmhq(request_id) join
   ↓
6. Dual reference renders: SOR + via QMHQ
```

**Implementation location:** Approval creation logic (currently in `ApprovalDialog` component or approval RPC if exists).

**Query example:**
```typescript
// When creating transaction during approval
const { data: request } = await supabase
  .from('stock_out_requests')
  .select('qmhq_id')
  .eq('id', requestId)
  .single();

const { error } = await supabase
  .from('inventory_transactions')
  .insert({
    movement_type: 'inventory_out',
    item_id: lineItem.item_id,
    warehouse_id: selectedWarehouseId,
    quantity: approvedQuantity,
    reason: requestReason,
    status: 'pending',
    stock_out_approval_id: approvalId,
    qmhq_id: request?.qmhq_id  // Propagate QMHQ link
  });
```

---

## Anti-Patterns to Avoid

### ❌ Don't Add These

| Anti-Pattern | Why Not |
|--------------|---------|
| Separate "execution queue" table | `inventory_transactions` with `status='pending'` already serves this |
| RPC function for dual reference query | Simple SELECT with nested join sufficient |
| Redux/Zustand for execution state | Component-local `useState` adequate (execution is isolated action) |
| WebSocket for real-time execution status | User manually triggers execution, no live updates needed |
| Database view for dual reference | Nullable FK + JOIN simpler, no materialized view overhead |
| New transaction reference table | Existing FKs (`qmhq_id`, `stock_out_approval_id`) sufficient |

### ✅ Use Existing Patterns

| Pattern | Where Already Used | Why Reuse |
|---------|-------------------|-----------|
| Per-row actions | ApprovalDialog multi-select | Proven pattern for line-item operations |
| Nullable FK for optional relations | `invoice_line_items.po_line_item_id` | Same concept (optional parent link) |
| Nested SELECT joins | `qmhq` detail page queries | Supabase client handles efficiently |
| Conditional secondary info | Fulfillment progress bars | Dual display pattern established |
| Status transition triggers | `compute_sor_request_status()` | Already handles partial execution |

---

## Migration Plan

### Step 1: Verify Schema (No Migration Needed)

```bash
# Confirm qmhq_id FK exists
psql -c "SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = 'inventory_transactions'
         AND column_name = 'qmhq_id';"
```

**Expected:** Column exists (added in migration 023).

### Step 2: Add QMHQ Propagation Logic

**Location:** `components/stock-out-requests/approval-dialog.tsx` (or approval RPC if exists)

**Change:**
```typescript
// Before: Create transaction without qmhq_id
await supabase.from('inventory_transactions').insert({ ... });

// After: Fetch parent qmhq_id and propagate
const { data: request } = await supabase
  .from('stock_out_requests')
  .select('qmhq_id')
  .eq('id', requestId)
  .single();

await supabase.from('inventory_transactions').insert({
  ...transactionData,
  qmhq_id: request?.qmhq_id  // Add this line
});
```

### Step 3: Update Transaction Queries

**Location:** Transaction list pages (inventory dashboard, warehouse detail, etc.)

**Change:**
```typescript
// Before: Basic SELECT
.select('id, quantity, status, ...')

// After: Include QMHQ join
.select(`
  id,
  quantity,
  status,
  stock_out_approval:stock_out_approvals(approval_number),
  qmhq:qmhq(id, request_id)  -- Add this join
`)
```

### Step 4: Modify ExecutionDialog

**Location:** `components/stock-out-requests/execution-dialog.tsx`

**Changes:**
1. Add `lineItemId?: string` to props
2. Add `.eq('line_item_id', lineItemId)` filter if prop provided
3. Update dialog title to show line-item scope

### Step 5: Add Execute Buttons to LineItemTable

**Location:** `components/stock-out-requests/line-item-table.tsx`

**Changes:**
1. Add Execute button column
2. Add `onExecuteLineItem` callback prop
3. Show button only for `status='approved'` line items

### Step 6: Update Transaction Display

**Location:** Transaction cards/lists across app

**Changes:**
1. Add conditional QMHQ reference rendering
2. Use lighter text color for secondary reference
3. Add "via" prefix for clarity
4. Link to QMHQ detail page with ExternalLink icon

---

## Testing Strategy

### Unit Tests (Optional)

Not currently in codebase, but if added:
- Test `qmhq_id` propagation in approval creation
- Test query filters for per-line execution
- Test conditional rendering of dual references

### Manual Testing Checklist

**Per-Line Execution:**
- [ ] Create stock-out request with 3 line items
- [ ] Approve all 3 line items
- [ ] Execute line item 1 → verify only item 1 completes
- [ ] Execute line item 2 → verify item 2 completes, item 3 still pending
- [ ] Verify request status = `partially_executed`

**QMHQ Linking:**
- [ ] Create QMHQ item route with item A, qty 10
- [ ] Click "Request Stock-Out" → creates SOR linked to QMHQ
- [ ] Approve SOR → verify `inventory_transactions.qmhq_id` populated
- [ ] View transaction list → verify QMHQ reference shows

**Dual Reference Display:**
- [ ] Execute stock-out from QMHQ-linked SOR
- [ ] View inventory dashboard → verify shows "SOR-2026-00001" + "via QMHQ-2026-00123"
- [ ] Click QMHQ reference → verify navigates to QMHQ detail
- [ ] Execute stock-out from manual SOR → verify only SOR reference shows (no "via")

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| FK `qmhq_id` doesn't exist | LOW | Already verified in migration 023 |
| QMHQ reference breaks stock-in | LOW | FK is nullable, stock-in doesn't set it |
| Per-line execution breaks status trigger | LOW | Existing trigger handles partial execution |
| Type generation fails after logic change | LOW | No schema change, no type regen needed |
| UI confusion with dual references | MEDIUM | Use "via" prefix, lighter color for secondary |

**Overall risk:** LOW — All changes are additive (props, conditional rendering) or FK population (no schema change).

---

## Success Criteria

### Database Layer
- ✅ FK `qmhq_id` exists in `inventory_transactions` (already verified)
- ✅ Approval creation propagates `stock_out_requests.qmhq_id` → `inventory_transactions.qmhq_id`
- ✅ Existing triggers handle per-line execution without modification

### UI Layer
- ✅ `ExecutionDialog` accepts `lineItemId` prop and filters accordingly
- ✅ `LineItemTable` shows Execute button per row for approved items
- ✅ Transaction lists show dual reference when `qmhq_id` present
- ✅ QMHQ reference links to QMHQ detail page
- ✅ Conditional rendering hides "via QMHQ" when not applicable

### User Experience
- ✅ Admin can execute each approved line item independently
- ✅ Executor sees both SOR and QMHQ references in transaction history
- ✅ Request status accurately reflects per-line execution progress
- ✅ No breaking changes to existing stock-in or manual stock-out flows

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Schema adequacy | HIGH | FK `qmhq_id` already exists, verified in migration 023 |
| Component patterns | HIGH | Per-row actions, nested joins, conditional rendering all established |
| Type safety | HIGH | No schema change, existing types include `qmhq_id` |
| Execution logic | HIGH | Existing trigger handles partial execution, tested in v1.6 |
| Risk | LOW | Additive changes only, no deletions or breaking changes |

**Overall confidence:** HIGH — This is composition of existing patterns, not new paradigm introduction.

---

## Sources

**Verified in codebase:**
- `supabase/migrations/023_inventory_transactions.sql` (line 76: `qmhq_id` FK)
- `supabase/migrations/052_stock_out_requests.sql` (SOR schema, `qmhq_id` 1:1 link)
- `supabase/migrations/053_stock_out_validation.sql` (execution triggers, line 308-370)
- `components/stock-out-requests/execution-dialog.tsx` (current execution logic)
- `package.json` (current dependencies)
- `.planning/phases/28-stock-out-request-approval-ui/28-CONTEXT.md` (v1.6 context)

**Confidence:** HIGH — All capabilities verified in existing code, no external docs consulted
