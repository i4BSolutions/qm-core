# Pitfalls Research: Per-Line-Item Execution Migration

**Project:** QM System - Stock-Out Request Logic Repair
**Domain:** Changing from atomic request execution to per-line-item execution in existing inventory system
**Researched:** 2026-02-11
**Overall Confidence:** HIGH

---

## Executive Summary

Changing execution granularity from atomic (whole-request) to per-line-item in an inventory system with existing computed status aggregation, transaction linking, and audit logging creates specific integration pitfalls. The QM System currently executes all approved items in a request atomically. The planned change introduces per-line-item execution with individual Execute buttons, requiring careful handling of:

1. **Parent Status Computation** - Computed request status aggregates from child line items; stale status if triggers fire in wrong order
2. **Transaction Linking Integrity** - Dual references (SOR + QMHQ) on inventory transactions; orphaned records if links break
3. **Audit Log Explosion** - Per-line execution multiplies audit events; unbounded growth without selective logging
4. **Partial Execution Race Conditions** - Multiple lines executing concurrently; stock depletion conflicts and duplicate execution
5. **UI State Synchronization** - Parent detail page displays aggregated child states; stale display without proper invalidation

**Critical Finding:** The existing system has 3-level status aggregation (inventory_transactions → stock_out_line_items → stock_out_requests) with AFTER triggers computing parent status. Adding per-line-item execution breaks the implicit assumption that all child updates complete atomically, causing status computation timing issues and audit log multiplication.

---

## 1. Parent Status Computation Pitfalls

### Pitfall 1.1: Stale Parent Status from Out-of-Order Trigger Execution

**What goes wrong:**
Parent request status shows incorrect computed value after per-line-item execution because child line item status updates don't fire parent status recomputation trigger, or triggers fire but parent reads stale child data.

**Why it happens:**
- Current system: `inventory_transactions` AFTER INSERT triggers `update_sor_line_item_execution_status()` which updates `stock_out_line_items.status`
- That UPDATE triggers `compute_sor_request_status()` on `stock_out_requests`
- 3-level cascade: inventory_transactions → line_items → requests
- **NEW RISK:** Per-line execution means triggers fire multiple times in rapid succession instead of once
- PostgreSQL trigger execution order within same transaction not guaranteed
- Parent status computation reads aggregated child counts; if multiple children updating simultaneously, aggregation query may see partial state

**Warning signs:**
- Request status stuck at "partially_executed" even after all lines executed
- UI shows "Executed" badge but database has "approved" status
- Refresh/reload fixes status temporarily, then breaks again
- EXPLAIN ANALYZE on status computation query shows varying row counts between calls

**Prevention strategy:**

```sql
-- WRONG: Trigger reads child state during concurrent updates
CREATE OR REPLACE FUNCTION compute_sor_request_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INT;
  executed_count INT;
BEGIN
  -- This query races with other line item updates in same transaction
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'executed')
  INTO total_count, executed_count
  FROM stock_out_line_items
  WHERE request_id = NEW.request_id AND is_active = true;

  -- Status computed from potentially stale counts
  IF executed_count = total_count THEN
    UPDATE stock_out_requests SET status = 'executed' WHERE id = NEW.request_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RIGHT: Use row-level locking + explicit ordering
CREATE OR REPLACE FUNCTION compute_sor_request_status()
RETURNS TRIGGER AS $$
DECLARE
  total_count INT;
  executed_count INT;
  parent_id UUID;
BEGIN
  -- Lock parent row to serialize status computation
  parent_id := COALESCE(NEW.request_id, OLD.request_id);
  PERFORM 1 FROM stock_out_requests WHERE id = parent_id FOR UPDATE;

  -- Now aggregate with guaranteed consistency
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'executed')
  INTO total_count, executed_count
  FROM stock_out_line_items
  WHERE request_id = parent_id AND is_active = true;

  UPDATE stock_out_requests
  SET status = CASE
    WHEN executed_count = 0 THEN 'approved'::sor_request_status
    WHEN executed_count = total_count THEN 'executed'::sor_request_status
    ELSE 'partially_executed'::sor_request_status
  END,
  updated_at = NOW()
  WHERE id = parent_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**Detection:**
- Add logging to status computation trigger: `RAISE NOTICE 'Computing status for request % with counts: total=%, executed=%', parent_id, total_count, executed_count;`
- Query audit_logs for requests with multiple status updates in <1 second intervals
- Automated test: Execute 3 line items concurrently in parallel transactions, assert final status = 'executed'

**Phase to address:** Phase 29 (Per-Line Execution UI) - Must update trigger function BEFORE deploying UI

**Confidence:** HIGH - PostgreSQL trigger behavior documented, existing QM System uses this exact pattern

**Sources:**
- [PostgreSQL Trigger Behavior Documentation](https://www.postgresql.org/docs/current/trigger-definition.html)
- [Aggregation Operations in Distributed SQL](https://medium.com/towards-data-engineering/aggregation-operations-in-distributed-sql-query-engines-516c464e8e19)

---

### Pitfall 1.2: Missing Status Recomputation on Direct Child Updates

**What goes wrong:**
Admin manually updates a line item status (e.g., cancels an executed line) but parent request status doesn't update to reflect the change, showing "executed" when it should be "partially_executed".

**Why it happens:**
- Status computation trigger only fires on inventory_transactions INSERT/UPDATE
- Direct UPDATE to stock_out_line_items.status bypasses trigger
- No trigger on line_items table itself to propagate to parent
- Admin UI or manual SQL updates can modify line item status directly

**Warning signs:**
- Status inconsistencies after admin interventions
- Manual status corrections needed after voiding transactions
- Database constraints allow status combinations that should be impossible (e.g., request='executed' with any line='approved')

**Prevention strategy:**

```sql
-- Add trigger on line_items table itself
CREATE OR REPLACE FUNCTION propagate_line_item_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recompute if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Delegate to existing status computation function
    -- Use a fake NEW/OLD with request_id populated
    PERFORM compute_sor_request_status_for_request(NEW.request_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_li_status ON stock_out_line_items;
CREATE TRIGGER trg_propagate_li_status
  AFTER UPDATE ON stock_out_line_items
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION propagate_line_item_status_change();

-- Extract status computation logic into reusable function
CREATE OR REPLACE FUNCTION compute_sor_request_status_for_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  total_count INT;
  executed_count INT;
  cancelled_count INT;
  new_status sor_request_status;
BEGIN
  -- Lock parent
  PERFORM 1 FROM stock_out_requests WHERE id = p_request_id FOR UPDATE;

  -- Aggregate
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'executed'),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO total_count, executed_count, cancelled_count
  FROM stock_out_line_items
  WHERE request_id = p_request_id AND is_active = true;

  -- Compute new status
  IF cancelled_count = total_count THEN
    new_status := 'cancelled';
  ELSIF executed_count = total_count THEN
    new_status := 'executed';
  ELSIF executed_count > 0 THEN
    new_status := 'partially_executed';
  ELSE
    new_status := 'approved';
  END IF;

  UPDATE stock_out_requests
  SET status = new_status, updated_at = NOW()
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;
```

**Detection:**
- Add CHECK constraint: `ALTER TABLE stock_out_requests ADD CONSTRAINT status_matches_children CHECK (check_status_consistency(id));`
- Periodic batch job: find requests where computed status != stored status, log discrepancies

**Phase to address:** Phase 29 (Per-Line Execution UI) - Add line_items trigger alongside inventory trigger update

**Confidence:** HIGH - Missing trigger is a known pattern in multi-level aggregation systems

**Sources:**
- [PostgreSQL Triggers Performance Impact](https://infinitelambda.com/postgresql-triggers/)

---

## 2. Transaction Linking Integrity Pitfalls

### Pitfall 2.1: Orphaned Inventory Transactions from Missing SOR Reference

**What goes wrong:**
Inventory transaction created during per-line execution but `stock_out_approval_id` remains NULL or points to wrong approval, breaking the lineage chain and preventing status rollup.

**Why it happens:**
- Current atomic execution: UI passes approval_id array, backend loops and inserts transactions with correct `stock_out_approval_id`
- **NEW RISK:** Per-line UI passes single line_item_id, must resolve to approval_id at execution time
- Multiple approvals per line item possible (partial approval workflow)
- UI doesn't know which approval to execute — must query "pending approvals for line_item"
- Race condition: Approval A creates transaction, Approval B queries "pending" and sees A's transaction as pending, executes again

**Warning signs:**
- Inventory transactions exist with NULL `stock_out_approval_id` but non-NULL `qmhq_id`
- Line item status stuck at "approved" despite transactions existing
- Duplicate transactions for same line item and warehouse
- Referential integrity errors: `SELECT COUNT(*) FROM inventory_transactions WHERE stock_out_approval_id NOT IN (SELECT id FROM stock_out_approvals);` returns > 0

**Prevention strategy:**

```sql
-- Validation trigger: block inventory_out without valid SOR link
CREATE OR REPLACE FUNCTION validate_sor_transaction_link()
RETURNS TRIGGER AS $$
DECLARE
  approval_exists BOOLEAN;
  approval_executed BOOLEAN;
BEGIN
  IF NEW.movement_type = 'inventory_out' AND NEW.reason = 'request' THEN
    -- Must have stock_out_approval_id
    IF NEW.stock_out_approval_id IS NULL THEN
      RAISE EXCEPTION 'Stock-out transactions for reason=request must reference stock_out_approval_id';
    END IF;

    -- Approval must exist and be approved
    SELECT
      a.id IS NOT NULL,
      a.line_item_id IS NOT NULL  -- Basic existence check
    INTO approval_exists, approval_executed
    FROM stock_out_approvals a
    WHERE a.id = NEW.stock_out_approval_id
      AND a.decision = 'approved'
      AND a.is_active = true;

    IF NOT approval_exists THEN
      RAISE EXCEPTION 'stock_out_approval_id % does not exist or is not approved', NEW.stock_out_approval_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_sor_link ON inventory_transactions;
CREATE TRIGGER trg_validate_sor_link
  BEFORE INSERT OR UPDATE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_sor_transaction_link();
```

**Application-level prevention:**

```typescript
// WRONG: Execute by line_item_id without approval resolution
async function executeLineItem(lineItemId: string, warehouseId: string) {
  const { data: lineItem } = await supabase
    .from('stock_out_line_items')
    .select('item_id, requested_quantity')
    .eq('id', lineItemId)
    .single();

  // Missing: which approval? Creates orphaned transaction
  await supabase.from('inventory_transactions').insert({
    movement_type: 'inventory_out',
    item_id: lineItem.item_id,
    warehouse_id: warehouseId,
    quantity: lineItem.requested_quantity,
    stock_out_approval_id: null, // ORPHANED!
    reason: 'request',
  });
}

// RIGHT: Execute by approval_id with explicit linking
async function executeApproval(approvalId: string) {
  // Fetch approval with validation
  const { data: approval } = await supabase
    .from('stock_out_approvals')
    .select(`
      id,
      approved_quantity,
      line_item:stock_out_line_items!inner(
        id,
        item_id,
        request:stock_out_requests!inner(id, status)
      )
    `)
    .eq('id', approvalId)
    .eq('decision', 'approved')
    .single();

  if (!approval) throw new Error('Approval not found or not approved');

  // Get warehouse from approval record (stored during approval)
  const { data: approvalWarehouse } = await supabase
    .from('stock_out_approval_warehouses')
    .select('warehouse_id')
    .eq('approval_id', approvalId)
    .single();

  // Create transaction with explicit approval link
  await supabase.from('inventory_transactions').insert({
    movement_type: 'inventory_out',
    item_id: approval.line_item.item_id,
    warehouse_id: approvalWarehouse.warehouse_id,
    quantity: approval.approved_quantity,
    stock_out_approval_id: approvalId, // EXPLICIT LINK
    reason: 'request',
    status: 'completed',
  });
}
```

**Detection:**
- Database view: `CREATE VIEW orphaned_sor_transactions AS SELECT * FROM inventory_transactions WHERE movement_type='inventory_out' AND reason='request' AND stock_out_approval_id IS NULL;`
- Monitoring: Alert if orphaned_sor_transactions count > 0
- Weekly batch: Attempt to reconcile orphans by matching item_id + quantity + timestamp to approvals

**Phase to address:** Phase 29 (Per-Line Execution UI) - Add validation trigger AND refactor execution API

**Confidence:** HIGH - Orphaned records are a documented risk when adding foreign key relationships to existing systems

**Sources:**
- [Referential Integrity Challenges](https://www.acceldata.io/blog/referential-integrity-why-its-vital-for-databases)
- [Why Referential Data Integrity Is Important](https://www.montecarlodata.com/blog-how-to-maintain-referential-data-integrity/)

---

### Pitfall 2.2: Dual Reference Inconsistency (SOR + QMHQ)

**What goes wrong:**
Inventory transaction has both `stock_out_approval_id` (SOR flow) and `qmhq_id` (QMHQ item route), but these point to unrelated records or only one is populated when both should be.

**Why it happens:**
- QMHQ item routes can create SOR (1:1 relationship via `stock_out_requests.qmhq_id`)
- SOR-linked QMHQ execution should populate BOTH `stock_out_approval_id` AND `qmhq_id`
- Manual SOR (not from QMHQ) only populates `stock_out_approval_id`
- **NEW RISK:** Per-line execution UI might not pass QMHQ context to execution API
- Backend must infer QMHQ link by traversing: approval → line_item → request → qmhq

**Warning signs:**
- QMHQ detail page shows "No stock-out transactions" but SOR shows "Executed"
- Inventory transactions with `stock_out_approval_id` but NULL `qmhq_id` when parent SOR has non-NULL `qmhq_id`
- QMHQ status doesn't auto-update after SOR execution
- Query: `SELECT COUNT(*) FROM inventory_transactions it JOIN stock_out_approvals a ON it.stock_out_approval_id = a.id JOIN stock_out_line_items li ON a.line_item_id = li.id JOIN stock_out_requests r ON li.request_id = r.id WHERE r.qmhq_id IS NOT NULL AND it.qmhq_id IS NULL;` returns > 0

**Prevention strategy:**

```sql
-- Trigger: Auto-populate qmhq_id from SOR chain
CREATE OR REPLACE FUNCTION auto_populate_qmhq_from_sor()
RETURNS TRIGGER AS $$
DECLARE
  linked_qmhq_id UUID;
BEGIN
  -- Only for stock-out transactions with approval link
  IF NEW.movement_type = 'inventory_out'
     AND NEW.reason = 'request'
     AND NEW.stock_out_approval_id IS NOT NULL
  THEN
    -- Traverse: approval → line_item → request → qmhq
    SELECT r.qmhq_id INTO linked_qmhq_id
    FROM stock_out_approvals a
    JOIN stock_out_line_items li ON a.line_item_id = li.id
    JOIN stock_out_requests r ON li.request_id = r.id
    WHERE a.id = NEW.stock_out_approval_id;

    -- If SOR is QMHQ-linked, populate qmhq_id
    IF linked_qmhq_id IS NOT NULL THEN
      NEW.qmhq_id := linked_qmhq_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_populate_qmhq ON inventory_transactions;
CREATE TRIGGER trg_auto_populate_qmhq
  BEFORE INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_qmhq_from_sor();

-- Validation constraint: qmhq_id consistency
CREATE OR REPLACE FUNCTION check_qmhq_sor_consistency(txn_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  txn_qmhq_id UUID;
  sor_qmhq_id UUID;
BEGIN
  SELECT it.qmhq_id, r.qmhq_id
  INTO txn_qmhq_id, sor_qmhq_id
  FROM inventory_transactions it
  JOIN stock_out_approvals a ON it.stock_out_approval_id = a.id
  JOIN stock_out_line_items li ON a.line_item_id = li.id
  JOIN stock_out_requests r ON li.request_id = r.id
  WHERE it.id = txn_id;

  -- If SOR has QMHQ, transaction must match
  IF sor_qmhq_id IS NOT NULL THEN
    RETURN txn_qmhq_id = sor_qmhq_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add CHECK constraint (PostgreSQL 12+)
ALTER TABLE inventory_transactions
  ADD CONSTRAINT qmhq_sor_consistency
  CHECK (check_qmhq_sor_consistency(id));
```

**Application-level prevention:**
- Execution API accepts `approvalId` only (not both approvalId + qmhqId)
- Backend resolves QMHQ link automatically via trigger
- UI displays both references: "SOR-2026-00123-A01 (from QMHQ-2026-00456)"

**Detection:**
- Monitoring query: Find transactions with mismatched QMHQ references
- Add to daily data integrity check report
- Automated repair job: `UPDATE inventory_transactions SET qmhq_id = (SELECT r.qmhq_id FROM ...) WHERE ...`

**Phase to address:** Phase 29 (Per-Line Execution UI) - Add auto-populate trigger + validation constraint

**Confidence:** MEDIUM - Dual references are complex, need testing with real data flows

**Sources:**
- [Outbox Pattern for Dual-Write Problem](https://www.enterpriseintegrationpatterns.com/)
- [ERP Integration Patterns](https://roi-consulting.com/erp-integration-patterns-what-they-are-and-why-you-should-care/)

---

## 3. Audit Log Explosion Pitfalls

### Pitfall 3.1: Multiplicative Audit Events from Per-Line Execution

**What goes wrong:**
Audit log table grows 10x faster than before because per-line-item execution fires audit triggers for EACH line instead of once per request, degrading query performance and storage costs.

**Why it happens:**
- Current atomic execution: 1 request with 5 lines → execute all → 5 inventory_transactions INSERTs → 5 audit log entries
- **NEW SYSTEM:** Same 5 lines → execute individually → 5 separate executions → 5 inventory_transactions + 5 line_item UPDATEs + 5 request UPDATEs (status recomputation) → 15 audit log entries
- **Multiplication factor:** 3x audit logs for same business operation
- Generic audit trigger logs EVERY INSERT/UPDATE on tracked tables
- No filtering for "significant" vs "transient" changes

**Warning signs:**
- `audit_logs` table size growing >100MB per month (vs <30MB before)
- History tab pagination becomes slow (>2s load time)
- Database storage alerts triggering weekly instead of monthly
- Queries like "show all changes for request X" timing out

**Prevention strategy:**

```sql
-- Selective audit logging for inventory_transactions
CREATE OR REPLACE FUNCTION audit_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log INSERTs and status changes, not every UPDATE
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO audit_logs (
      entity_type,
      entity_id,
      action,
      old_values,
      new_values,
      changed_by,
      changed_at,
      summary
    ) VALUES (
      'inventory_transaction',
      NEW.id,
      LOWER(TG_OP),
      CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
      row_to_json(NEW),
      NEW.updated_by,
      NOW(),
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Created stock-out for ' || (SELECT item_name FROM items WHERE id = NEW.item_id)
        WHEN TG_OP = 'UPDATE' THEN 'Status changed: ' || OLD.status || ' → ' || NEW.status
      END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Don't audit parent status recomputation (too noisy)
CREATE OR REPLACE FUNCTION audit_sor_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip auto-computed status changes (created by triggers)
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Only log if updated_by is set (user action) not trigger action
    IF NEW.updated_by IS DISTINCT FROM OLD.updated_by THEN
      -- User-initiated status change, log it
      INSERT INTO audit_logs (...) VALUES (...);
    END IF;
    -- Else: trigger-computed status change, skip logging
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (...) VALUES (...);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Alternative: Summary audit entries**

Instead of logging every inventory_transaction separately, log one summary entry per execution:

```sql
-- Create execution summary table
CREATE TABLE stock_out_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES stock_out_requests(id),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES users(id),
  line_items_count INT,
  total_quantity DECIMAL(15,2),
  summary JSONB -- {line_item_id: {item_name, quantity, warehouse}}
);

-- Log execution as single summary entry instead of per-transaction
CREATE OR REPLACE FUNCTION log_execution_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggregate execution details
  INSERT INTO stock_out_execution_logs (request_id, executed_by, line_items_count, total_quantity, summary)
  SELECT
    r.id,
    NEW.created_by,
    COUNT(DISTINCT a.line_item_id),
    SUM(NEW.quantity),
    jsonb_object_agg(li.id, jsonb_build_object(
      'item_name', i.name,
      'quantity', NEW.quantity,
      'warehouse', w.name
    ))
  FROM inventory_transactions it
  JOIN stock_out_approvals a ON it.stock_out_approval_id = a.id
  JOIN stock_out_line_items li ON a.line_item_id = li.id
  JOIN stock_out_requests r ON li.request_id = r.id
  JOIN items i ON li.item_id = i.id
  JOIN warehouses w ON it.warehouse_id = w.id
  WHERE it.id = NEW.id
  GROUP BY r.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Detection:**
- Monitor audit_logs table growth rate: `SELECT pg_size_pretty(pg_total_relation_size('audit_logs'));` weekly
- Identify noisy entities: `SELECT entity_type, COUNT(*) FROM audit_logs WHERE changed_at > NOW() - INTERVAL '7 days' GROUP BY entity_type ORDER BY COUNT(*) DESC;`
- Threshold alert: If audit_logs rows increase >50% week-over-week, investigate

**Phase to address:**
- Phase 29 (Per-Line Execution UI) - Implement selective audit logging
- Phase 30 (Optimization) - Add execution summary logging if needed

**Confidence:** HIGH - Audit log explosion is documented issue with high-frequency operations

**Sources:**
- [Cascade Delete Audit Considerations](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/auditing/delete-audit-data)
- [PostgreSQL Triggers Performance Impact](https://infinitelambda.com/postgresql-triggers/)

---

### Pitfall 3.2: Audit Log Query Performance Degradation

**What goes wrong:**
History tab on request detail page takes >10 seconds to load because audit log query lacks proper indexes for polymorphic queries, and table has millions of rows.

**Why it happens:**
- Query pattern: `SELECT * FROM audit_logs WHERE entity_type = 'stock_out_request' AND entity_id = $1 ORDER BY changed_at DESC LIMIT 50;`
- Polymorphic (entity_type, entity_id) means no foreign key index
- Sequential scan required if no composite index exists
- With 1M+ audit rows, sequential scan = seconds

**Prevention strategy:**

```sql
-- Partial indexes per entity type
CREATE INDEX idx_audit_logs_sor_request
  ON audit_logs(entity_id, changed_at DESC)
  WHERE entity_type = 'stock_out_request' AND deleted_at IS NULL;

CREATE INDEX idx_audit_logs_sor_line_item
  ON audit_logs(entity_id, changed_at DESC)
  WHERE entity_type = 'stock_out_line_item' AND deleted_at IS NULL;

CREATE INDEX idx_audit_logs_inventory_txn
  ON audit_logs(entity_id, changed_at DESC)
  WHERE entity_type = 'inventory_transaction' AND deleted_at IS NULL;

-- Composite index for filtering by entity type first
CREATE INDEX idx_audit_logs_entity_lookup
  ON audit_logs(entity_type, entity_id, changed_at DESC)
  WHERE deleted_at IS NULL;
```

**Application-level optimization:**

```typescript
// Fetch related audit logs efficiently
async function getRequestHistory(requestId: string) {
  // Instead of querying all audit_logs and filtering in app:
  // Query with specific entity_type to use partial index
  const { data: requestLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', 'stock_out_request')
    .eq('entity_id', requestId)
    .order('changed_at', { ascending: false })
    .limit(50);

  // Fetch related line item logs separately (also uses index)
  const { data: lineItemIds } = await supabase
    .from('stock_out_line_items')
    .select('id')
    .eq('request_id', requestId);

  const { data: lineItemLogs } = await supabase
    .from('audit_logs')
    .eq('entity_type', 'stock_out_line_item')
    .in('entity_id', lineItemIds.map(li => li.id))
    .order('changed_at', { ascending: false })
    .limit(200);

  // Merge and sort in application
  return [...requestLogs, ...lineItemLogs].sort((a, b) =>
    new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
  );
}
```

**Detection:**
- EXPLAIN ANALYZE on history queries: If shows "Seq Scan on audit_logs", index missing
- Add slow query logging: `log_min_duration_statement = 1000` (log queries >1s)
- APM tool (e.g., pganalyze) to identify slow audit queries

**Phase to address:** Phase 29 (Per-Line Execution UI) - Add indexes in same migration as execution logic

**Confidence:** HIGH - Polymorphic query performance is well-documented issue

**Sources:**
- [Stale Stats and Query Performance](https://pganalyze.com/docs/explain/insights/stale-stats)

---

## 4. Partial Execution Race Conditions

### Pitfall 4.1: Concurrent Execution Stock Depletion

**What goes wrong:**
Two line items for same item executing simultaneously from different requests deplete warehouse stock below zero, or second execution fails with "insufficient stock" even though stock was available when user clicked Execute.

**Why it happens:**
- Stock validation: `SELECT SUM(quantity) FROM inventory_transactions WHERE item_id = X AND warehouse_id = Y;`
- Line 1 validation: Stock = 100, need 60 → Pass
- Line 2 validation: Stock = 100, need 50 → Pass (reads SAME 100 because Line 1 not committed)
- Line 1 executes: Stock = 40
- Line 2 executes: Stock = -10 (NEGATIVE!)
- Or with CHECK constraint: Line 2 fails with "insufficient stock" error

**Why it happens (root cause):**
- PostgreSQL default isolation level: READ COMMITTED
- Stock calculation is non-serializable: Two transactions can read same stock level
- No row-level locking on warehouse_stock or items table during validation
- Optimistic concurrency control assumes conflicts are rare (wrong for high-volume inventory)

**Warning signs:**
- Intermittent "insufficient stock" errors during execution
- Negative stock levels in warehouse (if no CHECK constraint)
- User reports: "It said stock available, but execution failed"
- Database logs show deadlock errors on inventory_transactions

**Prevention strategy:**

```sql
-- Advisory lock per item+warehouse during stock validation
CREATE OR REPLACE FUNCTION validate_stock_with_lock(
  p_item_id UUID,
  p_warehouse_id UUID,
  p_quantity DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  current_stock DECIMAL;
  lock_key BIGINT;
BEGIN
  -- Generate deterministic lock key from item+warehouse UUIDs
  lock_key := ('x' || substr(md5(p_item_id::text || p_warehouse_id::text), 1, 15))::bit(60)::bigint;

  -- Acquire advisory lock (released at transaction end)
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Now compute stock with exclusive lock held
  SELECT COALESCE(SUM(
    CASE movement_type
      WHEN 'inventory_in' THEN quantity
      WHEN 'inventory_out' THEN -quantity
    END
  ), 0)
  INTO current_stock
  FROM inventory_transactions
  WHERE item_id = p_item_id
    AND warehouse_id = p_warehouse_id
    AND is_active = true
    AND status = 'completed';

  RETURN current_stock >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- Use in execution validation
CREATE OR REPLACE FUNCTION validate_sor_execution()
RETURNS TRIGGER AS $$
DECLARE
  has_stock BOOLEAN;
BEGIN
  IF NEW.movement_type = 'inventory_out' THEN
    has_stock := validate_stock_with_lock(NEW.item_id, NEW.warehouse_id, NEW.quantity);

    IF NOT has_stock THEN
      RAISE EXCEPTION 'Insufficient stock for item % in warehouse %', NEW.item_id, NEW.warehouse_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Alternative: Serializable isolation level**

```sql
-- Set isolation level for execution transactions only
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Perform stock validation and execution
INSERT INTO inventory_transactions (...) VALUES (...);

COMMIT;
-- If serialization conflict occurs, PostgreSQL aborts transaction
-- Application must retry
```

**Application-level handling:**

```typescript
async function executeLineItemWithRetry(approvalId: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Execute with serializable isolation
      const { data, error } = await supabase.rpc('execute_stock_out_approval', {
        p_approval_id: approvalId
      });

      if (error) throw error;
      return data;

    } catch (error) {
      // Check if serialization failure (PostgreSQL error code 40001)
      if (error.code === '40001' && attempt < maxRetries) {
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }
}
```

**Detection:**
- Monitor for serialization failures: `SELECT COUNT(*) FROM pg_stat_database WHERE datname = 'qm_system' AND xact_rollback > 0;`
- Alert on negative stock: `SELECT i.name, w.name, SUM(CASE movement_type WHEN 'inventory_in' THEN quantity ELSE -quantity END) AS stock FROM inventory_transactions it JOIN items i ON it.item_id = i.id JOIN warehouses w ON it.warehouse_id = w.id GROUP BY i.id, w.id HAVING SUM(...) < 0;`
- Load testing: Execute 10 concurrent line items for same item, verify final stock = expected

**Phase to address:** Phase 29 (Per-Line Execution UI) - Implement advisory locks or serializable isolation

**Confidence:** HIGH - Race conditions in stock validation are well-documented in inventory systems

**Sources:**
- [Atomic Updates and Data Consistency](https://medium.com/insiderengineering/atomic-updates-keeping-your-data-consistent-in-a-changing-world-f6aacf38f71a)
- [PostgreSQL Trigger Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html)

---

### Pitfall 4.2: Duplicate Execution from UI Race Condition

**What goes wrong:**
User clicks Execute button, page doesn't disable button immediately, user clicks again, two execution requests sent, same approval executed twice, double stock-out.

**Why it happens:**
- Network latency: First request in flight, button still enabled
- No idempotency key on execution API
- Database allows multiple inventory_transactions for same approval (no UNIQUE constraint)
- UI state doesn't optimistically mark as "executing"

**Prevention strategy:**

```sql
-- Idempotency: One transaction per approval
CREATE UNIQUE INDEX idx_one_execution_per_approval
  ON inventory_transactions(stock_out_approval_id)
  WHERE movement_type = 'inventory_out'
    AND reason = 'request'
    AND is_active = true;

-- This prevents duplicate INSERTs for same approval
-- Second execution attempt fails with "duplicate key value violates unique constraint"
```

**Application-level prevention:**

```typescript
// UI: Optimistic state update
function ExecuteButton({ approvalId }: { approvalId: string }) {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    // Disable button immediately
    setIsExecuting(true);

    try {
      await executeApproval(approvalId);
      // Success: page will re-fetch and button will disappear
    } catch (error) {
      // Re-enable only on error
      setIsExecuting(false);
      toast.error(error.message);
    }
  };

  return (
    <button
      onClick={handleExecute}
      disabled={isExecuting}
      className={isExecuting ? 'opacity-50 cursor-not-allowed' : ''}
    >
      {isExecuting ? 'Executing...' : 'Execute'}
    </button>
  );
}

// API: Idempotency key
async function executeApproval(approvalId: string, idempotencyKey?: string) {
  const key = idempotencyKey || approvalId; // Use approvalId as natural idempotency key

  // Check if already executed
  const { data: existing } = await supabase
    .from('inventory_transactions')
    .select('id')
    .eq('stock_out_approval_id', approvalId)
    .eq('movement_type', 'inventory_out')
    .eq('is_active', true)
    .maybeSingle();

  if (existing) {
    // Already executed, return success (idempotent)
    return { alreadyExecuted: true, transactionId: existing.id };
  }

  // Proceed with execution
  const { data, error } = await supabase.rpc('execute_stock_out_approval', {
    p_approval_id: approvalId
  });

  if (error) throw error;
  return { alreadyExecuted: false, transactionId: data.id };
}
```

**Detection:**
- Query for duplicate executions: `SELECT stock_out_approval_id, COUNT(*) FROM inventory_transactions WHERE movement_type='inventory_out' AND reason='request' AND is_active=true GROUP BY stock_out_approval_id HAVING COUNT(*) > 1;`
- Monitor API logs for 409 Conflict responses (duplicate execution attempts)
- Automated test: Click execute button rapidly 5 times, verify only 1 transaction created

**Phase to address:** Phase 29 (Per-Line Execution UI) - Add UNIQUE constraint + idempotency check

**Confidence:** HIGH - Duplicate request prevention is standard best practice

**Sources:**
- [SQL ON DELETE CASCADE Best Practices](https://www.datacamp.com/tutorial/sql-on-delete-cascade)

---

## 5. UI State Synchronization Pitfalls

### Pitfall 5.1: Stale Aggregated Data on Parent Detail Page

**What goes wrong:**
Request detail page shows "Approved (0/5 executed)" but user just executed 2 lines in another tab/window, display doesn't update until manual refresh, user executes same lines again thinking they're still pending.

**Why it happens:**
- Detail page fetches request + line items + approvals on mount
- Stores in component state
- Per-line execution happens in child component (modal/drawer)
- Child closes after execution, parent state not invalidated
- Parent displays stale aggregated counts

**Prevention strategy:**

```typescript
// Use query invalidation pattern (React Query/SWR)
import { useQuery, useQueryClient } from '@tanstack/react-query';

function RequestDetailPage({ requestId }: { requestId: string }) {
  const queryClient = useQueryClient();

  // Fetch with cache key
  const { data: request, isLoading } = useQuery({
    queryKey: ['stock-out-request', requestId],
    queryFn: async () => {
      const { data } = await supabase
        .from('stock_out_requests')
        .select(`
          *,
          line_items:stock_out_line_items(
            *,
            approvals:stock_out_approvals(*)
          )
        `)
        .eq('id', requestId)
        .single();
      return data;
    },
    // Refetch on window focus to catch external updates
    refetchOnWindowFocus: true,
  });

  // Child component invalidates cache after execution
  const handleExecutionComplete = () => {
    // Invalidate this request's cache
    queryClient.invalidateQueries({ queryKey: ['stock-out-request', requestId] });
    // Also invalidate list page cache
    queryClient.invalidateQueries({ queryKey: ['stock-out-requests'] });
  };

  return (
    <div>
      <RequestHeader request={request} />
      <LineItemsTable
        lineItems={request.line_items}
        onExecutionComplete={handleExecutionComplete}
      />
    </div>
  );
}

// Execution modal
function ExecuteApprovalModal({ approvalId, onComplete }: Props) {
  const handleExecute = async () => {
    await executeApproval(approvalId);
    onComplete(); // Triggers parent cache invalidation
    closeModal();
  };

  return <Modal>...</Modal>;
}
```

**Alternative: Real-time subscriptions**

```typescript
function RequestDetailPage({ requestId }: { requestId: string }) {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    // Initial fetch
    fetchRequest(requestId).then(setRequest);

    // Subscribe to changes
    const channel = supabase
      .channel(`request-${requestId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stock_out_line_items',
        filter: `request_id=eq.${requestId}`,
      }, (payload) => {
        // Re-fetch on any line item change
        fetchRequest(requestId).then(setRequest);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inventory_transactions',
      }, (payload) => {
        // Check if related to this request
        if (payload.new.stock_out_approval_id) {
          fetchRequest(requestId).then(setRequest);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId]);

  return <div>...</div>;
}
```

**Detection:**
- User acceptance testing: Open request in two tabs, execute in tab 1, verify tab 2 updates within 5 seconds
- Automated E2E test: Simulate concurrent access, assert stale data not shown
- Monitor user feedback: "I executed twice by accident" reports

**Phase to address:** Phase 29 (Per-Line Execution UI) - Implement query invalidation from start

**Confidence:** MEDIUM - UI state sync is standard React pattern, but real-time sync adds complexity

**Sources:**
- No specific external sources; standard React/frontend state management pattern

---

### Pitfall 5.2: Optimistic UI Update Rollback Failures

**What goes wrong:**
UI optimistically shows "Executed" status and removes Execute button, but backend execution fails (stock shortage), UI doesn't rollback to previous state, user stuck seeing "Executed" when actually still "Approved".

**Why it happens:**
- Optimistic update pattern: Immediately update local state before API response
- API call fails (validation error, network timeout, server error)
- Error handler doesn't restore previous state
- User sees success UI but database still has old state

**Prevention strategy:**

```typescript
function ExecuteButton({ approval }: { approval: Approval }) {
  const queryClient = useQueryClient();
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);

    // Snapshot current state for rollback
    const previousData = queryClient.getQueryData(['stock-out-request', approval.request_id]);

    // Optimistic update
    queryClient.setQueryData(['stock-out-request', approval.request_id], (old: any) => {
      return {
        ...old,
        line_items: old.line_items.map((li: any) =>
          li.id === approval.line_item_id
            ? { ...li, status: 'executed' }
            : li
        ),
      };
    });

    try {
      // Execute API call
      await executeApproval(approval.id);

      // Success: Refetch to get authoritative state
      await queryClient.invalidateQueries({ queryKey: ['stock-out-request', approval.request_id] });

      toast.success('Execution successful');

    } catch (error) {
      // Rollback optimistic update
      queryClient.setQueryData(['stock-out-request', approval.request_id], previousData);

      toast.error(`Execution failed: ${error.message}`);

    } finally {
      setIsExecuting(false);
    }
  };

  return <button onClick={handleExecute} disabled={isExecuting}>Execute</button>;
}
```

**Alternative: No optimistic updates for critical operations**

For stock execution (high-risk, irreversible), consider NOT using optimistic updates:
- Show loading spinner during API call
- Only update UI after confirmed success
- Reduces complexity and eliminates rollback logic

**Detection:**
- Manual testing: Kill backend server mid-execution, verify UI shows error and reverts
- E2E test: Mock API failure, assert UI state rolled back
- Monitor toast notifications: Track error toast frequency to identify rollback scenarios

**Phase to address:** Phase 29 (Per-Line Execution UI) - Decide optimistic vs pessimistic UI pattern

**Confidence:** MEDIUM - Optimistic UI is useful for perceived performance but adds complexity

**Sources:**
- No specific external sources; standard React/UX pattern

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 29: Per-Line Execution UI** | Stale parent status from race conditions | Add row-level locking in `compute_sor_request_status()` |
| **Phase 29: Per-Line Execution UI** | Orphaned inventory transactions | Add validation trigger requiring `stock_out_approval_id` |
| **Phase 29: Per-Line Execution UI** | Audit log explosion | Implement selective audit logging (skip auto-computed status) |
| **Phase 29: Per-Line Execution UI** | Concurrent stock depletion | Use advisory locks in stock validation function |
| **Phase 29: Per-Line Execution UI** | Duplicate execution | Add UNIQUE index on (stock_out_approval_id) for inventory_transactions |
| **Phase 29: Per-Line Execution UI** | Stale UI after execution | Use query invalidation or real-time subscriptions |
| **Phase 30: QMHQ Integration** | Dual reference inconsistency | Add trigger to auto-populate `qmhq_id` from SOR chain |
| **Phase 30: QMHQ Integration** | QMHQ status not updating | Ensure execution triggers update QMHQ status via qmhq_id link |
| **Phase 31: Performance Optimization** | Audit log query slowness | Add partial indexes per entity_type on audit_logs |
| **Phase 32: Testing & Validation** | Race conditions not caught | Load test: Execute 10 concurrent approvals for same item |

---

## Critical Integration Checklist

Before deploying per-line-item execution:

- [ ] **Status Computation:** Add row-level locking (`FOR UPDATE`) in `compute_sor_request_status()` function
- [ ] **Status Propagation:** Add trigger on `stock_out_line_items` to propagate status changes to parent
- [ ] **Transaction Linking:** Add validation trigger requiring `stock_out_approval_id` for stock-out transactions
- [ ] **Dual Reference:** Add trigger to auto-populate `qmhq_id` from SOR chain (approval → line_item → request → qmhq)
- [ ] **Audit Selectivity:** Modify audit triggers to skip auto-computed status changes
- [ ] **Audit Indexes:** Add partial indexes on `audit_logs(entity_id, changed_at)` per entity_type
- [ ] **Stock Validation:** Add advisory locks to `validate_stock_with_lock()` function
- [ ] **Idempotency:** Add UNIQUE index on `inventory_transactions(stock_out_approval_id)` for executions
- [ ] **UI Cache Invalidation:** Implement query invalidation after execution
- [ ] **Error Handling:** Add try-catch with rollback logic for optimistic UI updates
- [ ] **Load Testing:** Execute 10+ concurrent approvals and verify no negative stock
- [ ] **Data Integrity:** Query for orphaned transactions, mismatched QMHQ references, duplicate executions
- [ ] **Monitoring:** Set up alerts for audit log growth, slow queries, serialization failures

---

## Open Questions for Validation

- **Execution granularity confirmation:** Is per-line-item execution with individual Execute buttons the final decision, or might it change to per-approval execution?
- **QMHQ status update:** Should SOR execution auto-update QMHQ status to "done" group, or remain manual?
- **Audit retention policy:** How long to retain audit logs? Should old logs be archived/partitioned?
- **Stock lock duration:** Advisory locks released at transaction end—is this sufficient, or need application-level locking?
- **Real-time requirements:** Is 5-second refresh acceptable for multi-tab scenarios, or need instant real-time sync?
- **Rollback scenario:** If execution partially succeeds (3/5 lines) then fails, should already-executed lines remain executed or rollback?

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Parent Status Computation | HIGH | Documented PostgreSQL trigger behavior + existing QM System pattern |
| Transaction Linking | HIGH | Referential integrity well-documented, orphaned records common pitfall |
| Audit Log Explosion | HIGH | High-frequency operations known to cause audit growth issues |
| Race Conditions | HIGH | Concurrent stock validation races well-documented in inventory systems |
| Dual Reference Integrity | MEDIUM | Complex pattern, need real-world testing to validate assumptions |
| UI State Sync | MEDIUM | Standard React patterns, but real-time complexity varies by approach |
| Optimistic UI Rollback | MEDIUM | Depends on implementation details, less documentation on inventory-specific scenarios |

---

## Research Methodology

1. **Existing codebase analysis:** Examined QM System migrations (052, 053, 054) to understand current status computation, transaction linking, and audit patterns
2. **Context gathering:** Read Phase 27 and Phase 28 planning documents to understand atomic → per-line-item execution change
3. **Web research:** Searched for granularity changes, partial execution patterns, multi-level aggregation triggers, dual reference linking, audit log management
4. **Pattern identification:** Cross-referenced QM System patterns with documented pitfalls from PostgreSQL docs, ERP integration patterns, inventory system best practices
5. **Mitigation design:** Proposed concrete SQL functions and application code based on PostgreSQL official docs and established patterns

---

## Sources

- [PostgreSQL Trigger Behavior Documentation](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL Triggers Performance Impact](https://infinitelambda.com/postgresql-triggers/)
- [Aggregation Operations in Distributed SQL](https://medium.com/towards-data-engineering/aggregation-operations-in-distributed-sql-query-engines-516c464e8e19)
- [Referential Integrity Challenges](https://www.acceldata.io/blog/referential-integrity-why-its-vital-for-databases)
- [Why Referential Data Integrity Is Important](https://www.montecarlodata.com/blog-how-to-maintain-referential-data-integrity/)
- [Atomic Updates and Data Consistency](https://medium.com/insiderengineering/atomic-updates-keeping-your-data-consistent-in-a-changing-world-f6aacf38f71a)
- [Cascade Delete Audit Considerations](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/auditing/delete-audit-data)
- [Outbox Pattern for Dual-Write Problem](https://www.enterpriseintegrationpatterns.com/)
- [ERP Integration Patterns](https://roi-consulting.com/erp-integration-patterns-what-they-are-and-why-you-should-care/)
- [Stale Stats and Query Performance](https://pganalyze.com/docs/explain/insights/stale-stats)
- [SQL ON DELETE CASCADE Best Practices](https://www.datacamp.com/tutorial/sql-on-delete-cascade)
- [Inventory Management Workflow](https://www.posnation.com/blog/inventory-management-workflow)
- [ER Diagram for Inventory Management System](https://www.kladana.com/blog/inventory-management/er-diagram-for-inventory-management-system/)

---

*Research completed: 2026-02-11*
*Researcher: Claude Sonnet 4.5 (GSD Project Research Agent)*
*Next step: Use findings to inform Phase 29 implementation plan*
