# Phase 8: Database Foundation - Research

**Researched:** 2026-01-30
**Domain:** PostgreSQL trigger-based database automation for inventory WAC calculation and invoice void cascades
**Confidence:** HIGH

## Summary

Phase 8 implements database-layer automation for two critical domains: (1) currency-aware WAC (Weighted Average Cost) calculation for manual stock-in operations, and (2) cascading updates when invoices are voided. Both domains are well-understood PostgreSQL trigger patterns with established best practices from 2026.

The existing codebase already implements significant infrastructure:
- WAC calculation triggers for inventory_in transactions (migration 024)
- Invoice void handling for invoiced quantities (migration 022)
- PO status recalculation based on invoiced/received quantities (migration 016)
- Balance in Hand as a generated column (migration 011)
- Audit log infrastructure with JSONB pattern (migrations 025-026)

**What's missing:**
1. Manual stock-in must pass currency/exchange rate to WAC calculation (STCK-04)
2. Invoice void must trigger PO status recalculation (VOID-01)
3. Invoice void must recalculate Balance in Hand via total_po_committed update (VOID-02)
4. Invoice void must recalculate invoiced quantities (VOID-03) — **ALREADY EXISTS**
5. All void cascade effects must be logged to audit trail (VOID-04)

**Primary recommendation:** Extend existing trigger infrastructure with minimal new code. The pattern is cascading AFTER UPDATE triggers with idempotency checks and audit logging.

## Standard Stack

### Core (Already in Use)

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| PostgreSQL | 14+ | RDBMS with advanced triggers | Supabase requirement, robust trigger system |
| PL/pgSQL | Current | Trigger function language | Native PostgreSQL, optimal performance |
| JSONB | Current | Audit log storage | Flexible schema, native PostgreSQL type |

### Supporting Patterns (Existing)

| Pattern | Purpose | Current Usage |
|---------|---------|---------------|
| GENERATED ALWAYS AS | Derived columns | `balance_in_hand`, `wac_amount_eusd`, `total_price` |
| AFTER UPDATE triggers | Cascading recalculations | PO status, invoiced quantities, money totals |
| BEFORE UPDATE triggers | Data validation/modification | Invoice void timestamp, snapshots |
| SECURITY DEFINER | RLS bypass for system operations | Auto stock-out trigger (migration 034) |
| Idempotency checks | Prevent duplicate operations | Auto stock-out uses `NOT EXISTS` check |

### Installation

No new packages required. All functionality uses built-in PostgreSQL features.

## Architecture Patterns

### Recommended Trigger Structure

Based on existing codebase patterns and 2026 best practices:

```
Trigger Type Hierarchy:
1. BEFORE UPDATE triggers - Modify data (e.g., set voided_at timestamp)
2. AFTER UPDATE triggers - Cascading recalculations (e.g., update PO status)
3. AFTER UPDATE triggers (later) - Audit logging (fires last)
```

### Pattern 1: Currency-Aware WAC Calculation

**What:** Extend existing `update_item_wac()` function to accept currency/exchange rate from manual stock-in

**Current implementation (migration 024):**
```sql
-- Existing WAC calculation
UPDATE items
SET
  wac_amount = new_wac,
  wac_currency = NEW.currency,
  wac_exchange_rate = NEW.exchange_rate,
  updated_at = NOW()
WHERE id = NEW.item_id;
```

**What's needed:**
- Ensure manual stock-in UI passes `currency` and `exchange_rate` to `inventory_transactions`
- Existing trigger already handles these fields correctly
- **No database changes required** — this is a UI/validation task

**Source:** Existing codebase (migration 024_inventory_wac_trigger.sql, lines 64-71)

### Pattern 2: Invoice Void Cascading Updates

**What:** Chain of triggers that fire when `invoices.is_voided` changes from `false` to `true`

**Cascade sequence:**
```
1. Invoice UPDATE (is_voided = true)
   ↓
2. BEFORE UPDATE: Set voided_at timestamp (ALREADY EXISTS - migration 022, line 235)
   ↓
3. BEFORE UPDATE: Recalculate po_line_items.invoiced_quantity (ALREADY EXISTS - migration 022, lines 211-247)
   ↓
4. AFTER UPDATE (on po_line_items): Trigger PO status recalculation (ALREADY EXISTS - migration 016, lines 185-190)
   ↓
5. AFTER UPDATE (on po_line_items): Trigger total_po_committed update (NEEDED - NEW)
   ↓
6. AFTER UPDATE (generated): balance_in_hand auto-recalculates (AUTOMATIC via GENERATED column)
   ↓
7. AFTER UPDATE: Log all cascade effects to audit trail (NEEDED - NEW)
```

**What already works:**
- ✅ VOID-03: Invoice void → invoiced quantities recalculated (migration 022, `recalculate_po_on_invoice_void`)
- ✅ VOID-01 (partial): PO status recalculation trigger exists, just needs to fire from void cascade

**What's missing:**
- VOID-02: Update `qmhq.total_po_committed` when PO total changes
- VOID-04: Audit trail for void cascade effects

**Source:** Existing migrations 022_invoice_line_items.sql, 016_po_line_items.sql, 015_purchase_orders.sql

### Pattern 3: Total PO Committed Recalculation

**What:** When PO amounts change (due to void), update parent QMHQ's `total_po_committed`

**Existing pattern to follow (migration 015, lines 128-168):**
```sql
CREATE OR REPLACE FUNCTION update_qmhq_po_committed()
RETURNS TRIGGER AS $$
DECLARE
  target_qmhq_id UUID;
  new_total DECIMAL(15,2);
BEGIN
  -- Determine the QMHQ to update
  IF TG_OP = 'DELETE' THEN
    target_qmhq_id := OLD.qmhq_id;
  ELSE
    target_qmhq_id := NEW.qmhq_id;
  END IF;

  -- Calculate total from all active, non-cancelled POs
  SELECT COALESCE(SUM(total_amount_eusd), 0)
  INTO new_total
  FROM purchase_orders
  WHERE qmhq_id = target_qmhq_id
    AND is_active = true
    AND status != 'cancelled';

  -- Update QMHQ
  UPDATE qmhq
  SET total_po_committed = new_total,
      updated_at = NOW()
  WHERE id = target_qmhq_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Currently triggers on:** INSERT, UPDATE, DELETE of `purchase_orders`

**Problem:** When invoice is voided:
1. Invoice void → PO line items invoiced_quantity changes
2. PO status recalculates
3. But PO `total_amount_eusd` doesn't change (it's based on line item prices, not invoiced quantities)
4. So `total_po_committed` doesn't recalculate

**Solution:** `total_po_committed` already recalculates correctly! The void cascade doesn't change PO amounts, only status. Balance in Hand is:
```sql
balance_in_hand = total_money_in - total_po_committed
```

When invoice is voided:
- `total_po_committed` stays same (PO commitment unchanged)
- Balance in Hand stays same
- Only PO status changes (e.g., from 'awaiting_delivery' back to 'partially_invoiced')

**Conclusion:** VOID-02 is a **misunderstanding**. Voiding an invoice doesn't change Balance in Hand because the PO commitment remains. Only voiding the PO itself would change Balance in Hand.

**Clarification needed:** Is VOID-02 asking about voiding the PO itself, or voiding invoices? Based on context (Phase 8 deals with invoice void), assume VOID-02 means: "Balance in Hand correctly reflects PO commitments even after invoice void" — which it does automatically.

### Pattern 4: Audit Trail for Void Cascades

**What:** Log all cascade effects when invoice is voided

**Existing audit infrastructure (migration 026):**
```sql
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB;
  summary TEXT;
BEGIN
  -- Build JSONB with old/new values
  changes := jsonb_build_object(
    'old', to_jsonb(OLD),
    'new', to_jsonb(NEW)
  );

  -- Generate human-readable summary
  -- ... (complex logic)

  INSERT INTO audit_logs (
    entity_type,
    entity_id,
    action,
    old_values,
    new_values,
    changes_summary,
    changed_by,
    changed_by_name
  ) VALUES (
    TG_TABLE_NAME,
    NEW.id,
    TG_OP::TEXT::audit_action,
    to_jsonb(OLD),
    to_jsonb(NEW),
    summary,
    NEW.updated_by,
    get_user_name_for_audit(NEW.updated_by)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**What's needed for VOID-04:**

1. **Invoice void action:** Log the void itself
   ```sql
   INSERT INTO audit_logs (
     entity_type, entity_id, action,
     old_values, new_values,
     changes_summary, changed_by, changed_by_name
   ) VALUES (
     'invoices', invoice_id, 'void',
     old_invoice_jsonb, new_invoice_jsonb,
     'Invoice voided: ' || void_reason,
     voided_by, user_name
   );
   ```

2. **PO line item recalculation:** Log each PO line item's invoiced_quantity change
   ```sql
   INSERT INTO audit_logs (
     entity_type, entity_id, action,
     field_name, old_value, new_value,
     changes_summary, changed_by, changed_by_name
   ) VALUES (
     'po_line_items', po_line_item_id, 'update',
     'invoiced_quantity', old_qty::TEXT, new_qty::TEXT,
     'Invoiced quantity adjusted due to invoice void',
     voided_by, user_name
   );
   ```

3. **PO status change:** Log PO status recalculation
   ```sql
   INSERT INTO audit_logs (
     entity_type, entity_id, action,
     field_name, old_value, new_value,
     changes_summary, changed_by, changed_by_name
   ) VALUES (
     'purchase_orders', po_id, 'status_change',
     'status', old_status::TEXT, new_status::TEXT,
     'Status recalculated due to invoice void',
     voided_by, user_name
   );
   ```

**Pattern to use:** Create a dedicated `audit_invoice_void_cascade()` trigger function that:
1. Captures the user who voided the invoice
2. Logs all affected entities in a single transaction
3. Uses `AFTER UPDATE` trigger on `invoices` table
4. Fires after `recalculate_po_on_invoice_void` completes

**Source:** Existing migration 026_audit_triggers.sql, enhanced with void-specific logic

### Pattern 5: Idempotency and Trigger Ordering

**What:** Ensure triggers fire in correct order and don't create duplicates

**PostgreSQL trigger ordering (official docs):**
> "Triggers are fired in alphabetical order by trigger name when multiple triggers are defined for the same event and timing."

**Best practice from 2026:**
> "When reviewing triggers, a key question is 'Is it idempotent when possible? If re-run during retry, does it behave correctly?'"

**Current idempotency pattern (migration 034, auto stock-out):**
```sql
AND NOT EXISTS (
  SELECT 1 FROM inventory_transactions
  WHERE qmhq_id = NEW.id
  AND movement_type = 'inventory_out'
  AND reason = 'request'
  AND is_active = true
)
```

**Trigger naming convention for ordering:**
```
aa_invoice_void_set_timestamp        -- Fires first (BEFORE UPDATE)
recalculate_po_on_invoice_void       -- Fires second (BEFORE UPDATE, existing)
zz_audit_invoice_void_cascade        -- Fires last (AFTER UPDATE)
```

**Source:** [PostgreSQL Official Docs](https://www.postgresql.org/docs/current/trigger-definition.html), [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted average calculation | Custom moving average logic | PostgreSQL aggregate functions with window functions | Edge cases: zero quantities, negative stock, concurrent updates |
| Audit trail JSONB generation | Manual JSON string building | `to_jsonb()`, `jsonb_build_object()` | Type safety, null handling, automatic escaping |
| Trigger cascade coordination | Application-level updates | PostgreSQL native trigger chains | Atomicity, performance, impossible to bypass |
| Idempotency checks | Custom flags/status fields | `NOT EXISTS` subqueries, `pg_trigger_depth()` | Built-in, well-tested, no extra columns |

**Key insight from 2026:** "Triggers remain the closest thing to a database interrupt: they fire synchronously, see the row state, and can take action before or after the core statement commits, making them perfect for invariants the application must never bypass—cross-row totals, audit trails, and guardrails against data drift."

**Source:** [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

## Common Pitfalls

### Pitfall 1: Infinite Recursion in Cascading Triggers

**What goes wrong:** Trigger A updates table B, which fires trigger B that updates table A, creating infinite loop

**Why it happens:** Not checking if update is necessary before executing

**How to avoid:**
1. Check if values actually changed: `IF OLD.field IS DISTINCT FROM NEW.field`
2. Use `pg_trigger_depth()` to detect recursive calls
3. Design triggers to only fire on specific conditions (e.g., only when `is_voided` changes from false to true)

**Warning signs:**
- Database CPU spikes
- Transaction timeouts
- "stack depth limit exceeded" errors

**Example from codebase (migration 022, line 215):**
```sql
-- Only act when is_voided changes to true
IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN
  -- Recalculation logic
END IF;
```

**Source:** [PostgreSQL Official Docs](https://www.postgresql.org/docs/current/trigger-definition.html)

### Pitfall 2: SECURITY DEFINER Without search_path Protection

**What goes wrong:** Malicious user exploits SECURITY DEFINER to execute arbitrary code with elevated privileges

**Why it happens:** SECURITY DEFINER functions run with creator's privileges and can be tricked into calling malicious functions if `search_path` is not set

**How to avoid:**
```sql
CREATE OR REPLACE FUNCTION my_trigger()
RETURNS TRIGGER AS $$
-- First line MUST be:
SET search_path = pg_catalog, public;
BEGIN
  -- Function logic
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Warning signs:**
- SECURITY DEFINER function without explicit `SET search_path`
- 2026 linting tools will flag this automatically

**Current codebase status:** Migration 034 (auto stock-out) uses `SECURITY DEFINER` but doesn't set `search_path` — should be added

**Source:** [Let's Build Production-Ready Audit Logs in PostgreSQL](https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8), [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

### Pitfall 3: Incorrect Trigger Timing (BEFORE vs AFTER)

**What goes wrong:** Using AFTER UPDATE to modify the row being updated (doesn't work), or using BEFORE UPDATE for side effects (inefficient)

**Why it happens:** Misunderstanding when NEW/OLD are writable

**How to avoid:**
- **Use BEFORE UPDATE to modify the row:** Return modified `NEW` record
- **Use AFTER UPDATE for side effects:** Log, cascade updates to other tables
- **AFTER UPDATE can't modify NEW:** Return value is ignored

**Warning signs:**
- Modifications in AFTER trigger don't persist
- Performance issues from unnecessary row refetching

**Current codebase pattern:**
- ✅ BEFORE UPDATE: Set `voided_at` timestamp (migration 022)
- ✅ AFTER UPDATE: Recalculate totals in other tables (migrations 012, 015, 016)

**Source:** [PostgreSQL BEFORE UPDATE vs AFTER UPDATE](https://www.postgresql.org/docs/current/plpgsql-trigger.html)

### Pitfall 4: Not Excluding Voided Records from Aggregations

**What goes wrong:** Voided invoices still count toward totals, breaking financial accuracy

**Why it happens:** Forgetting `AND i.is_voided = false` in JOIN conditions

**How to avoid:**
Every query that aggregates from invoices or invoice_line_items MUST check:
```sql
JOIN invoices i ON i.id = ili.invoice_id
WHERE ili.is_active = true
  AND i.is_voided = false  -- CRITICAL
```

**Warning signs:**
- Balance in Hand doesn't match manual calculation
- PO status incorrect after invoice void
- Totals don't decrease when invoice is voided

**Current codebase status:** ✅ All existing aggregations correctly exclude voided invoices (migrations 015, 016, 022)

**Source:** Existing codebase pattern, financial data integrity best practices

### Pitfall 5: WAC Recalculation Race Conditions

**What goes wrong:** Two concurrent stock-in operations calculate WAC based on stale data, resulting in incorrect final WAC

**Why it happens:** WAC calculation reads current stock quantity, calculates new WAC, then writes — not atomic

**How to avoid:**
1. Use row-level locking: `SELECT ... FROM items WHERE id = NEW.item_id FOR UPDATE`
2. OR: Use statement-level triggers with transition tables for bulk operations
3. Current implementation is safe because:
   - Trigger is AFTER INSERT (not concurrent updates)
   - Each transaction sees consistent snapshot
   - PostgreSQL MVCC handles concurrency

**Warning signs:**
- WAC values don't match manual recalculation
- WAC decreases when stock-in occurs (should only increase or stay same)

**Current codebase status:** ✅ Safe — AFTER INSERT trigger with MVCC isolation

**Source:** [PostgreSQL Triggers in 2026 - Performance section](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

## Code Examples

### Example 1: Currency-Aware Manual Stock-In (UI Layer)

**Location:** `app/(dashboard)/inventory/stock-in/page.tsx` (or similar form component)

```typescript
// Ensure currency and exchange_rate are submitted with manual stock-in
const stockInData = {
  movement_type: 'inventory_in',
  item_id: selectedItem.id,
  warehouse_id: selectedWarehouse.id,
  quantity: quantity,
  unit_cost: unitCost,
  currency: selectedCurrency || 'MMK',        // REQUIRED for WAC
  exchange_rate: exchangeRate || 1.0000,      // REQUIRED for WAC
  transaction_date: transactionDate,
  notes: notes,
  status: 'completed'
};

const { data, error } = await supabase
  .from('inventory_transactions')
  .insert(stockInData);
```

**No database changes needed** — existing trigger (migration 024) already handles these fields correctly.

**Source:** Existing migration 024_inventory_wac_trigger.sql

### Example 2: Audit Log for Invoice Void Cascade

```sql
-- New trigger function for VOID-04
CREATE OR REPLACE FUNCTION audit_invoice_void_cascade()
RETURNS TRIGGER AS $$
DECLARE
  voiding_user_id UUID;
  voiding_user_name TEXT;
  affected_po_ids UUID[];
  po_rec RECORD;
  po_line_rec RECORD;
BEGIN
  -- Only act when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN

    -- Get user who voided the invoice
    voiding_user_id := NEW.voided_by;
    voiding_user_name := get_user_name_for_audit(voiding_user_id);

    -- Log the void action itself
    INSERT INTO audit_logs (
      entity_type, entity_id, action,
      old_values, new_values,
      changes_summary, changed_by, changed_by_name
    ) VALUES (
      'invoices', NEW.id, 'void',
      to_jsonb(OLD), to_jsonb(NEW),
      'Invoice voided: ' || COALESCE(NEW.void_reason, 'No reason provided'),
      voiding_user_id, voiding_user_name
    );

    -- Get all affected PO line items
    FOR po_line_rec IN
      SELECT DISTINCT pl.id, pl.po_id, pl.invoiced_quantity
      FROM invoice_line_items il
      JOIN po_line_items pl ON pl.id = il.po_line_item_id
      WHERE il.invoice_id = NEW.id
    LOOP
      -- Log PO line item invoiced_quantity change
      INSERT INTO audit_logs (
        entity_type, entity_id, action,
        field_name, old_value, new_value,
        changes_summary, changed_by, changed_by_name
      ) VALUES (
        'po_line_items', po_line_rec.id, 'update',
        'invoiced_quantity',
        po_line_rec.invoiced_quantity::TEXT,
        (SELECT invoiced_quantity::TEXT FROM po_line_items WHERE id = po_line_rec.id),
        'Invoiced quantity recalculated due to invoice ' || NEW.invoice_number || ' void',
        voiding_user_id, voiding_user_name
      );

      -- Collect affected PO IDs
      affected_po_ids := array_append(affected_po_ids, po_line_rec.po_id);
    END LOOP;

    -- Log PO status changes
    FOR po_rec IN
      SELECT DISTINCT id, po_number, status
      FROM purchase_orders
      WHERE id = ANY(affected_po_ids)
    LOOP
      INSERT INTO audit_logs (
        entity_type, entity_id, action,
        field_name, old_value, new_value,
        changes_summary, changed_by, changed_by_name
      ) VALUES (
        'purchase_orders', po_rec.id, 'status_change',
        'status',
        po_rec.status::TEXT,
        (SELECT status::TEXT FROM purchase_orders WHERE id = po_rec.id),
        'PO status recalculated due to invoice ' || NEW.invoice_number || ' void',
        voiding_user_id, voiding_user_name
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger (fires AFTER existing recalculation triggers)
DROP TRIGGER IF EXISTS zz_audit_invoice_void_cascade ON invoices;
CREATE TRIGGER zz_audit_invoice_void_cascade
  AFTER UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION audit_invoice_void_cascade();
```

**Key points:**
- Trigger name starts with `zz_` to fire last (alphabetical ordering)
- Uses `AFTER UPDATE` so it sees the completed recalculations
- Captures current state from tables (not OLD/NEW) to get recalculated values
- Uses SECURITY DEFINER to bypass RLS for audit writes

**Source:** Pattern derived from existing migration 026_audit_triggers.sql and 2026 best practices

### Example 3: Set search_path for SECURITY DEFINER Functions

```sql
-- Fix for migration 034 and new audit function
CREATE OR REPLACE FUNCTION auto_stockout_on_qmhq_fulfilled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- Add this line
AS $$
DECLARE
  status_is_done BOOLEAN;
BEGIN
  -- Existing function body
  ...
END;
$$;

CREATE OR REPLACE FUNCTION audit_invoice_void_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public  -- Add this line
AS $$
BEGIN
  -- Function body from Example 2
  ...
END;
$$;
```

**Why:** Prevents security vulnerability where attacker could create malicious functions in a schema on the search_path and trick the SECURITY DEFINER function into calling them.

**Source:** [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/), [Production-Ready Audit Logs](https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8)

### Example 4: Idempotent Trigger Pattern

```sql
-- Pattern to prevent duplicate operations
CREATE OR REPLACE FUNCTION some_cascade_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if operation already completed
  IF EXISTS (
    SELECT 1 FROM target_table
    WHERE source_id = NEW.id
    AND operation_flag = true
  ) THEN
    -- Already processed, skip
    RETURN NEW;
  END IF;

  -- Check if actual change occurred
  IF OLD.critical_field IS NOT DISTINCT FROM NEW.critical_field THEN
    -- No change, skip
    RETURN NEW;
  END IF;

  -- Perform operation
  INSERT INTO target_table (...) VALUES (...);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Built-in PostgreSQL helper:**
```sql
-- Use PostgreSQL's built-in function to skip redundant updates
CREATE TRIGGER suppress_redundant
  BEFORE UPDATE ON my_table
  FOR EACH ROW
  EXECUTE FUNCTION suppress_redundant_updates_trigger();
```

**Source:** [PostgreSQL Built-in Trigger Functions](https://fluca1978.github.io/2021/06/03/PostgreSQLUpdateTrigger), [Idempotency patterns](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|------------------------|--------------|--------|
| Per-row AFTER triggers for all operations | Statement-level triggers with transition tables | PostgreSQL 15+ | 10-100x faster for bulk operations |
| Manual JSON building for audit | `to_jsonb()`, `jsonb_build_object()` | Always available | Type-safe, automatic null handling |
| Application-layer cascade updates | Database trigger chains | Always preferred | Atomic, impossible to bypass |
| Ad-hoc idempotency flags | `NOT EXISTS` checks, `pg_trigger_depth()` | 2020+ | Cleaner, no schema pollution |
| Hope-based concurrency | Explicit locking, MVCC understanding | Always critical | Prevents data corruption |
| SECURITY DEFINER without protection | `SET search_path` required | 2026 linting standard | Prevents privilege escalation |

**Deprecated/outdated:**
- `TG_RELNAME` variable: Use `TG_TABLE_NAME` instead (deprecated in PostgreSQL 9.2+)
- Row-level triggers for heavy work: Use statement-level with transition tables or job queues
- Manual trigger ordering with numbered prefixes: Use alphabetical naming (e.g., `aa_`, `zz_`)

**Source:** [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/), [PostgreSQL Official Docs](https://www.postgresql.org/docs/current/plpgsql-trigger.html)

## Open Questions

### 1. VOID-02 Interpretation

**What we know:** Balance in Hand is `total_money_in - total_po_committed`. When invoice is voided, PO commitment (total_amount_eusd) doesn't change — only status and invoiced quantities change.

**What's unclear:** Does VOID-02 expect Balance in Hand to change when invoice is voided? Or just verify it stays consistent?

**Recommendation:** Assume VOID-02 means "Balance in Hand remains accurate" which it does automatically via generated column. No action needed unless requirement is to void the PO itself (separate from voiding invoice).

### 2. Audit Granularity for Cascades

**What we know:** VOID-04 requires logging cascade effects

**What's unclear:** Should each PO line item change be logged separately (verbose but complete), or summarized (e.g., "3 PO line items recalculated")?

**Recommendation:** Log separately for full auditability. Audit table is append-only and indexed — performance impact is minimal. Summary can be generated in UI layer.

### 3. Manual Stock-In Currency Validation

**What we know:** WAC calculation requires valid currency and exchange rate

**What's unclear:** Should database validate currency codes (e.g., only allow 'MMK', 'USD', 'EUSD')? Or trust UI layer?

**Recommendation:** Add CHECK constraint for valid currencies in migration. Fail fast at database layer rather than corrupt WAC with invalid exchange rates.

```sql
ALTER TABLE inventory_transactions
ADD CONSTRAINT check_valid_currency
CHECK (currency IN ('MMK', 'USD', 'EUR', 'THB', 'SGD', 'EUSD'));

ALTER TABLE inventory_transactions
ADD CONSTRAINT check_positive_exchange_rate
CHECK (exchange_rate > 0);
```

## Sources

### Primary (HIGH confidence)

- [PostgreSQL Official Docs - Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [PostgreSQL Official Docs - Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL Official Docs - CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- Existing codebase migrations (024_inventory_wac_trigger.sql, 022_invoice_line_items.sql, 016_po_line_items.sql, 015_purchase_orders.sql, 026_audit_triggers.sql, 034_qmhq_auto_stockout.sql)

### Secondary (MEDIUM confidence)

- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) - Comprehensive 2026 perspective
- [Let's Build Production-Ready Audit Logs in PostgreSQL](https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8) - SECURITY DEFINER best practices
- [Supabase Postgres Triggers](https://supabase.com/docs/guides/database/postgres/triggers) - Supabase-specific guidance
- [PostgreSQL Audit Trigger Wiki](https://wiki.postgresql.org/wiki/Audit_trigger) - Community patterns

### Tertiary (LOW confidence)

- [Weighted Average Cost Method](https://www.finaleinventory.com/accounting-and-inventory-software/weighted-average-inventory-method) - Accounting concept, not database implementation
- [PostgreSQL Trigger Optimization](https://dev.to/bhanufyi/optimizing-postgresql-trigger-execution-balancing-precision-with-control-ibh) - General patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All PostgreSQL built-in features, well-documented
- Architecture: HIGH - Existing codebase provides clear patterns, official docs authoritative
- Pitfalls: HIGH - Verified with official docs and 2026 industry practices
- Code examples: HIGH - Derived from existing migrations and official PostgreSQL documentation

**Research date:** 2026-01-30
**Valid until:** 90 days (PostgreSQL stable, slow-moving; codebase patterns established)

**Key findings:**
1. Most requirements already implemented — phase is mostly verification and audit additions
2. VOID-02 (Balance in Hand update) is automatic via generated column, no action needed
3. VOID-04 (audit trail) requires new trigger function but follows existing patterns
4. STCK-04 (currency-aware WAC) requires UI validation, database already supports it
5. SECURITY DEFINER functions should add `SET search_path` for 2026 security standards
