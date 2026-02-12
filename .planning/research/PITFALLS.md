# Domain Pitfalls

**Domain:** Purchase Order Lifecycle Management (Adding to Existing System)
**Researched:** 2026-02-12

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: PO Status Calculation Race Conditions Under Concurrent Load
**What goes wrong:** Multiple concurrent invoice creations or stock-in transactions for the same PO result in incorrect status calculations, causing POs to show wrong state (e.g., "awaiting_delivery" when actually "partially_received"). Real-world case: PrestaShop documented doubled invoices and quadrupled payments from concurrent order status updates without locking.

**Why it happens:** PostgreSQL default READ COMMITTED isolation allows phantom reads during status calculation. Two transactions simultaneously:
1. Read current `total_invoiced` = 100
2. Both calculate `total_ordered` = 200, conclude status = "partially_invoiced"
3. Both write status = "partially_invoiced" even though after both commits, actual invoiced = 200 (should be "awaiting_delivery")

**Consequences:**
- PO shows incorrect lifecycle state in UI
- Business decisions made on wrong data (e.g., don't order more when PO shows "partially_invoiced" but is actually fully invoiced)
- Audit trail becomes unreliable
- Customer trust eroded when PO state doesn't match reality

**Prevention:**
```sql
-- OPTION A: Advisory locks (already used in system for stock validation)
CREATE OR REPLACE FUNCTION calculate_po_status(po_id UUID)
RETURNS po_status AS $$
DECLARE
  lock_key BIGINT;
  calculated_status po_status;
BEGIN
  -- Serialize status calculation per PO
  lock_key := hashtext(po_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Now safe to read and calculate
  -- [status calculation logic]
  RETURN calculated_status;
END;
$$ LANGUAGE plpgsql;

-- OPTION B: SERIALIZABLE isolation for status calculation transaction
BEGIN ISOLATION LEVEL SERIALIZABLE;
-- status calculation and update
COMMIT; -- May throw serialization_failure, app must retry
```

Prefer OPTION A (advisory locks) for consistency with existing pattern in migration 058.

**Detection:**
- Monitor for PO status audit logs showing rapid back-and-forth status changes (thrashing)
- Test: Run concurrent invoice creation script (5+ workers, same PO) and verify status stays consistent
- pg_stat_activity shows multiple sessions with `state = 'active'` and matching `query` on same PO

**Phase assignment:** Phase addressing PO status calculation overhaul must implement advisory locks BEFORE any status calculation logic.

---

### Pitfall 2: Void Cascade Trigger Ordering Creates Inconsistent State
**What goes wrong:** Invoice void triggers fire in wrong order, causing PO status to update before guard checks run, resulting in voided invoices with orphaned stock-in records or incorrect PO status.

**Why it happens:** PostgreSQL fires triggers alphabetically within same timing (BEFORE/AFTER). System already uses trigger name prefixes for ordering:
- `aa_block_invoice_void_stockin` (migration 040) - BEFORE UPDATE, blocks void if stock-in exists
- `invoice_void_recalculate` - BEFORE UPDATE, updates PO line item quantities
- `audit_invoices` - AFTER UPDATE, logs void action
- `zz_audit_invoice_void_cascade` (migration 041) - AFTER UPDATE, logs cascade effects

If new PO cancellation adds triggers without prefix discipline, cascade becomes unpredictable.

**Consequences:**
- Data corruption: PO shows "closed" but has voided invoice still counted
- Guard bypassed: Invoice voided despite having stock-in (if guard trigger fires after quantity update)
- Audit gaps: CASCADE EFFECTS logged before they happen, timestamps wrong

**Prevention:**
```sql
-- Maintain trigger naming convention:
-- BEFORE: aa_ (guards), bb_ (validation), [default], yy_ (last BEFORE)
-- AFTER: [default], yy_ (late), zz_ (absolute last)

-- Example for PO cancellation guard:
CREATE TRIGGER aa_block_po_cancel_if_invoiced
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION block_po_cancel_with_invoices();

-- Example for PO cancellation cascade audit:
CREATE TRIGGER zz_audit_po_cancel_cascade
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION audit_po_cancel_cascade();
```

Document trigger dependency graph in migration header:
```sql
-- ============================================
-- Trigger ordering:
-- - 'aa_' prefix ensures this trigger fires FIRST (alphabetically)
-- - Must fire before calculate_po_status which may lock record
-- - Sequence: aa_guard -> calculate_status -> audit -> zz_cascade_audit
-- ============================================
```

**Detection:**
- Review migration diffs manually (AI-generated migrations can miss trigger ordering)
- Test void operation, check audit_logs timestamps: guard log MUST precede cascade logs
- Query trigger order: `SELECT tgname FROM pg_trigger WHERE tgrelid = 'invoices'::regclass ORDER BY tgname;`

**Phase assignment:** ANY phase adding PO lifecycle triggers must document ordering requirements and follow prefix convention.

---

### Pitfall 3: Soft Delete + Foreign Key Cascade = Silent Data Loss
**What goes wrong:** PO cancellation implemented as soft delete (`is_active = false`) but foreign key constraints have `ON DELETE CASCADE`, causing soft-deleted PO to leave orphaned child records when constraint misfire occurs during hard delete operations.

**Why it happens:** System uses `is_active` soft delete pattern but database foreign keys expect hard deletes. When combining:
```sql
-- Table with soft delete
ALTER TABLE purchase_orders ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Child table with CASCADE (expects hard delete)
ALTER TABLE po_line_items
  ADD CONSTRAINT fk_po
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
```

If PO accidentally hard deleted (migration cleanup, admin action), CASCADE fires and permanently deletes line items even though soft delete pattern intended to preserve them.

**Consequences:**
- Audit trail destroyed: line items vanished, no history
- Financial reporting broken: totals don't reconcile, missing committed amounts
- Legal risk: procurement records required for compliance, now gone
- Cannot un-cancel: soft delete supposed to be reversible, but child data lost

**Prevention:**
```sql
-- OPTION A: Use RESTRICT for soft-delete tables (recommended for QM System)
ALTER TABLE po_line_items
  ADD CONSTRAINT fk_po
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT;
-- Hard delete blocked, forces application-level cleanup

-- OPTION B: Soft delete child records via trigger
CREATE TRIGGER cascade_soft_delete_po_lines
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION soft_delete_po_line_items();
-- Updates line items is_active = false when PO cancelled

-- OPTION C: Application-enforced RLS filters
CREATE POLICY rls_po_line_items ON po_line_items
  USING (EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = po_id AND is_active = true
  ));
-- UI/queries never see line items for inactive POs
```

System uses RESTRICT pattern (e.g., `qmhq_id UUID NOT NULL REFERENCES qmhq(id) ON DELETE RESTRICT` in purchase_orders). Continue this pattern for new tables.

**Detection:**
- Code review: Search migrations for `ON DELETE CASCADE` on tables with `is_active`
- Test: Soft-delete PO, verify line items still in database with `is_active = true`
- Test: Attempt hard delete of PO, verify `RESTRICT` blocks it

**Phase assignment:** Phase adding PO cancellation MUST verify foreign key constraints use RESTRICT, NOT CASCADE.

---

### Pitfall 4: State Machine Transitions Not Validated at Database Level
**What goes wrong:** PO transitions from `not_started` directly to `closed` bypassing intermediate states, or transitions backwards (closed → partially_invoiced), violating business logic. Application code enforces transitions but database doesn't, allowing:
- Direct SQL updates bypass validation
- Concurrent updates race and overwrite valid state with invalid state
- Migration scripts accidentally set invalid transitions

**Why it happens:** Status stored as enum but no CHECK constraint or trigger validates transition legality. Valid transitions:
```
not_started → partially_invoiced → awaiting_delivery → partially_received → closed
                                  → cancelled (from any state except closed)
```

But database allows:
```sql
UPDATE purchase_orders SET status = 'closed' WHERE status = 'not_started'; -- Should be blocked
```

**Consequences:**
- Business logic violated: PO marked closed without any invoices/receipts
- Reporting broken: KPIs show impossible states, analytics teams lose trust
- Audit compliance failed: cannot prove status changes followed approval workflow
- Support nightmare: "How did this PO get to closed state?" → "No idea, database allowed it"

**Prevention:**
```sql
-- OPTION A: Transition validation trigger (recommended for complex state machines)
CREATE OR REPLACE FUNCTION validate_po_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions TEXT[][];
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Define valid transitions as array of [from, to] pairs
    valid_transitions := ARRAY[
      ARRAY['not_started', 'partially_invoiced'],
      ARRAY['not_started', 'cancelled'],
      ARRAY['partially_invoiced', 'awaiting_delivery'],
      ARRAY['partially_invoiced', 'cancelled'],
      ARRAY['awaiting_delivery', 'partially_received'],
      ARRAY['awaiting_delivery', 'cancelled'],
      ARRAY['partially_received', 'closed'],
      ARRAY['partially_received', 'cancelled']
      -- closed is terminal, no transitions out
    ];

    -- Check if transition is valid
    IF NOT ARRAY[OLD.status::TEXT, NEW.status::TEXT] = ANY(valid_transitions) THEN
      RAISE EXCEPTION 'Invalid PO status transition from % to %',
        OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_po_transition
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_po_status_transition();

-- OPTION B: Use a transitions table (for user-configurable workflows)
CREATE TABLE po_status_transitions (
  from_status po_status,
  to_status po_status,
  is_allowed BOOLEAN DEFAULT true,
  PRIMARY KEY (from_status, to_status)
);
-- Then trigger queries this table
```

OPTION A recommended for fixed PO lifecycle. Reserve OPTION B for future if workflows become customizable.

**Detection:**
- Test suite: Try all invalid transitions, expect exception
- Audit log review: Check for status_change actions that skip states
- pg_stat_statements: Monitor for UPDATE purchase_orders WHERE status = 'X' patterns

**Phase assignment:** Phase implementing 6-state PO status engine MUST add transition validation trigger in same migration as status calculation logic.

---

## Moderate Pitfalls

### Pitfall 5: PDF Generation Memory Leak in Serverless Environment
**What goes wrong:** PDF export for PO/invoice works in dev (Node 500MB heap) but fails in production Vercel serverless (1GB limit reached, function times out after 10-60s). Browser tabs in Puppeteer consume increasing memory and don't release, causing progressive slowdown.

**Why it happens:**
- Puppeteer launches full Chromium browser (~100-200MB base memory)
- Each PDF render creates new page (~50-100MB depending on content)
- Browser instance reused across requests (singleton pattern) accumulates memory
- Vercel serverless cold start adds 15s overhead just loading Chromium

Real-world data: Vercel functions 4-8x slower than local dev, basic CPU takes ~50s vs 10s on Performance CPU tier.

**Consequences:**
- User-facing timeout errors during PDF download
- Increased Vercel costs (longer function execution time)
- Degraded UX: users retry, creating more load
- Memory exhaustion crashes entire function container, affecting other requests

**Prevention:**
```typescript
// BAD: Singleton browser reused indefinitely
let browser: Browser | null = null;
export async function generatePDF() {
  if (!browser) browser = await puppeteer.launch();
  const page = await browser.newPage(); // Memory leak: pages accumulate
  // ... render PDF
}

// GOOD: Close page after each render
export async function generatePDF() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' }); // Use 'load' not 'networkidle2'
    const pdf = await page.pdf({ format: 'A4' });
    return pdf;
  } finally {
    await browser.close(); // CRITICAL: Always close
  }
}

// BETTER: Use @react-pdf/renderer server-side (no browser needed)
import { renderToStream } from '@react-pdf/renderer';
export async function generatePDF(data) {
  const stream = await renderToStream(<PODocument {...data} />);
  return stream; // ~10MB memory vs 200MB for Puppeteer
}

// BEST: Offload to Supabase Edge Function for heavy PDFs
// - Edge Function calls pdf-lib or @react-pdf/renderer
// - Stores result in Supabase Storage
// - Returns signed URL to client
// - Avoids Next.js serverless limits entirely
```

For QM System: Recommend @react-pdf/renderer for structured documents (PO, invoice). Reserve Puppeteer for complex HTML rendering if needed, but use dedicated Edge Function.

**Detection:**
- Monitor Vercel function metrics: execution time, memory usage
- Load test: Generate 10 PDFs sequentially, measure memory trend
- Heap snapshot: Compare heap before/after PDF generation, check for retained browser objects

**Phase assignment:** Phase adding PDF export must implement memory-safe pattern and load test BEFORE merging.

---

### Pitfall 6: Cancellation Guard Doesn't Account for Partially Voided Invoices
**What goes wrong:** Business rule "Cannot cancel PO if invoices exist" blocks cancellation even when all invoices are voided. User voids all invoices expecting to unlock PO cancellation, but guard still prevents it. Escalates to support, requires manual database intervention.

**Why it happens:** Guard checks for invoice existence, not invoice validity:
```sql
-- WRONG: Blocks cancellation even if all invoices voided
CREATE FUNCTION block_po_cancel_with_invoices() AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM invoices WHERE po_id = NEW.id) THEN
    RAISE EXCEPTION 'Cannot cancel PO: invoices exist';
  END IF;
END;
$$;

-- CORRECT: Only blocks if ACTIVE, NON-VOIDED invoices exist
CREATE FUNCTION block_po_cancel_with_invoices() AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM invoices
    WHERE po_id = NEW.id
      AND is_active = true
      AND (is_voided = false OR is_voided IS NULL)
  ) THEN
    RAISE EXCEPTION 'Cannot cancel PO: active non-voided invoices exist';
  END IF;
END;
$$;
```

**Consequences:**
- User frustration: "I voided the invoices, why can't I cancel?"
- Support burden: Requires manual SQL to bypass guard
- Workaround culture: Users learn to soft-delete instead of following workflow
- Data integrity risk: Manual interventions bypass other guards

**Prevention:**
- Always filter guards by `is_active = true` AND `is_voided = false`
- Test matrix: PO with [no invoices, voided invoices, active invoices, mix] × cancellation attempt
- Document in guard function: "Only blocks for ACTIVE, NON-VOIDED invoices"

Example comprehensive guard:
```sql
CREATE OR REPLACE FUNCTION block_po_cancel_with_active_invoices()
RETURNS TRIGGER AS $$
DECLARE
  active_invoice_count INTEGER;
  active_stockin_count INTEGER;
BEGIN
  -- Only check when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN

    -- Count active, non-voided invoices
    SELECT COUNT(*) INTO active_invoice_count
    FROM invoices
    WHERE po_id = NEW.id
      AND is_active = true
      AND (is_voided = false OR is_voided IS NULL);

    IF active_invoice_count > 0 THEN
      RAISE EXCEPTION 'Cannot cancel PO: % active invoice(s) exist. Void invoices first.',
        active_invoice_count;
    END IF;

    -- Count active stock-in transactions (even if invoice voided, stock received)
    SELECT COUNT(*) INTO active_stockin_count
    FROM inventory_transactions
    WHERE po_id = NEW.id
      AND movement_type = 'inventory_in'
      AND is_active = true;

    IF active_stockin_count > 0 THEN
      RAISE EXCEPTION 'Cannot cancel PO: % stock-in transaction(s) recorded. Physical inventory received.',
        active_stockin_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Detection:**
- Test: Create PO, invoice it, void invoice, attempt cancel → should succeed
- Test: Create PO, invoice it, receive stock, void invoice, attempt cancel → should fail (stock received)
- Code review: Search for guard functions, verify all check `is_voided`

**Phase assignment:** Phase adding PO cancellation must test void scenarios in guard logic.

---

### Pitfall 7: Concurrent Status Calculation + Audit Logging = Duplicate Audit Entries
**What goes wrong:** PO status recalculated from `partially_invoiced` to `awaiting_delivery` twice concurrently. Audit trigger fires twice, creating two audit_logs entries with identical timestamps and changes_summary, confusing history timeline.

**Why it happens:**
1. Invoice A and Invoice B created concurrently for same PO
2. Both trigger `update_po_status()` function
3. Both read current status = `partially_invoiced`
4. Both calculate new status = `awaiting_delivery` (after their invoice quantities)
5. Both execute UPDATE purchase_orders SET status = 'awaiting_delivery'
6. Audit trigger fires twice (once per UPDATE)

Even with advisory locks preventing wrong status, duplicate UPDATEs still occur because both transactions conclude same status is correct.

**Consequences:**
- Cluttered audit history: users see duplicate "Status changed to awaiting_delivery" entries
- Confusion in timeline: "Why did status change twice at same time?"
- Report inaccuracy: status_change count doubled
- Not critical but degrades audit quality

**Prevention:**
```sql
-- OPTION A: Check if status actually changing in audit trigger
CREATE OR REPLACE FUNCTION create_audit_log() AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'purchase_orders' THEN
    -- Only log if status ACTUALLY changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO audit_logs (...);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
-- Already implemented in migration 026 (line 142: "IF OLD.status IS DISTINCT FROM NEW.status")

-- OPTION B: Idempotent status update (skip UPDATE if no change)
CREATE OR REPLACE FUNCTION update_po_status() AS $$
DECLARE
  calculated_status po_status;
BEGIN
  -- Calculate status
  calculated_status := calculate_po_status(NEW.id);

  -- Only update if changed (prevents no-op UPDATE)
  IF calculated_status != OLD.status THEN
    NEW.status := calculated_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

System already has OPTION A (audit trigger checks IS DISTINCT FROM). Add OPTION B for efficiency: avoid triggering audit at all if status unchanged.

**Detection:**
- Query audit_logs for duplicate status_change entries:
  ```sql
  SELECT entity_id, changes_summary, COUNT(*)
  FROM audit_logs
  WHERE action = 'status_change'
  GROUP BY entity_id, changes_summary, DATE_TRUNC('second', changed_at)
  HAVING COUNT(*) > 1;
  ```
- Load test: Concurrent invoice creation, check audit log count matches actual status changes

**Phase assignment:** Phase implementing status calculation should add idempotency check to avoid no-op UPDATEs.

---

## Minor Pitfalls

### Pitfall 8: PDF Export Generates Stale Data Without Transaction Isolation
**What goes wrong:** User clicks "Export PO PDF", invoice gets created during PDF generation, exported PDF shows old status/quantities that were already outdated when download completed.

**Why it happens:** PDF generation queries database multiple times (PO details, line items, invoices, stock-in) without transaction wrapper. Between queries, concurrent updates occur:
1. Query PO: status = "partially_invoiced"
2. → New invoice created, status updated to "awaiting_delivery"
3. Query line items: shows NEW invoiced_quantity (after update)
4. Generated PDF: Status says "partially_invoiced" but quantities show fully invoiced (inconsistent snapshot)

**Consequences:**
- User confusion: PDF doesn't match screen
- Compliance risk: exported documents have inconsistent data
- Cannot reproduce: re-export shows different data, no audit trail

**Prevention:**
```typescript
// BAD: Multiple unrelated queries
async function generatePOPDF(poId: string) {
  const po = await supabase.from('purchase_orders').select().eq('id', poId).single();
  // ← Invoice created here by another user
  const lineItems = await supabase.from('po_line_items').select().eq('po_id', poId);
  // Inconsistent: PO status old, line items new
}

// GOOD: Single query with joins (atomic snapshot)
async function generatePOPDF(poId: string) {
  const { data } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      po_line_items(*),
      invoices(*),
      qmhq(*)
    `)
    .eq('id', poId)
    .single();
  // All data from same snapshot
}

// BETTER: Use RPC with REPEATABLE READ isolation
// supabase/functions/get_po_for_pdf.sql
CREATE OR REPLACE FUNCTION get_po_for_pdf(p_po_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Explicit isolation ensures consistent snapshot
  SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

  SELECT json_build_object(
    'po', row_to_json(po.*),
    'line_items', (SELECT json_agg(row_to_json(pl.*)) FROM po_line_items pl WHERE pl.po_id = p_po_id),
    'invoices', (SELECT json_agg(row_to_json(i.*)) FROM invoices i WHERE i.po_id = p_po_id)
  ) INTO result
  FROM purchase_orders po
  WHERE po.id = p_po_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

// TypeScript
const { data } = await supabase.rpc('get_po_for_pdf', { p_po_id: poId });
```

Recommend single-query approach for QM System (simpler, adequate for PDF snapshot needs).

**Detection:**
- Test: Open PO in two tabs, export PDF in Tab A while updating status in Tab B, verify PDF matches pre-update state
- Code review: PDF generation functions must use single snapshot query

**Phase assignment:** Phase adding PDF export must use atomic snapshot query pattern.

---

### Pitfall 9: Cancellation Doesn't Release Balance in Hand Commitment
**What goes wrong:** User cancels PO expecting to free up budget for new PO, but Balance in Hand remains depleted. QMHQ still shows `total_po_committed` includes cancelled PO amount. User believes budget exhausted, doesn't create needed PO.

**Why it happens:** Existing trigger `update_qmhq_po_committed()` (migration 015) correctly excludes cancelled POs:
```sql
SELECT COALESCE(SUM(total_amount_eusd), 0)
FROM purchase_orders
WHERE qmhq_id = target_qmhq_id
  AND is_active = true
  AND status != 'cancelled'; -- ✓ Cancelled POs excluded
```

But if cancellation implemented as soft delete (`is_active = false`) instead of status change, logic breaks:
```sql
-- If cancellation does:
UPDATE purchase_orders SET is_active = false WHERE id = ?;
-- Then SUM excludes it (is_active = true filter)

-- But if cancellation does:
UPDATE purchase_orders SET status = 'cancelled' WHERE id = ?;
-- Then SUM correctly excludes it (status != 'cancelled' filter)
```

Pitfall occurs if implementation inconsistent: cancellation sets `is_active = false` OR `status = 'cancelled'` but not both/correctly.

**Consequences:**
- Budget appears unavailable when actually free
- Users abandon valid PO creation
- Finance team gets "we're out of budget" questions when data shows availability

**Prevention:**
- Decide: Is cancellation a status (`status = 'cancelled'`) or deletion (`is_active = false`)?
- Recommendation: Use status (preserves record, clearer semantics, follows existing PO status enum)
- Ensure trigger filters match cancellation method
- Test: Cancel PO, verify `balance_in_hand` increases immediately

```sql
-- If using status approach (recommended):
UPDATE purchase_orders SET status = 'cancelled', updated_by = ? WHERE id = ?;
-- Trigger already handles this correctly

-- If using soft delete (NOT recommended):
UPDATE purchase_orders SET is_active = false WHERE id = ?;
-- Must update trigger to also filter is_active:
AND (status != 'cancelled' OR is_active = true) -- Overkill, just use status
```

**Detection:**
- Test: Create PO for $1000, verify balance_in_hand decreases by $1000, cancel PO, verify increases by $1000
- Check trigger logic matches cancellation implementation

**Phase assignment:** Phase adding PO cancellation must verify balance_in_hand calculation updates correctly.

---

### Pitfall 10: RLS Policy Recursion When Checking PO Permissions Based on Related Entity
**What goes wrong:** RLS policy on `purchase_orders` checks if user has access to parent QMHQ, but QMHQ RLS policy checks if user has access to parent QMRL, which checks department, which checks users table, creating infinite recursion. Query times out with "stack depth exceeded" or "query takes too long".

**Why it happens:**
```sql
-- PO RLS: Can view if user can view QMHQ
CREATE POLICY po_select ON purchase_orders USING (
  EXISTS (SELECT 1 FROM qmhq WHERE qmhq.id = purchase_orders.qmhq_id)
);

-- QMHQ RLS: Can view if user can view QMRL
CREATE POLICY qmhq_select ON qmhq USING (
  EXISTS (SELECT 1 FROM qmrl WHERE qmrl.id = qmhq.qmrl_id)
);

-- QMRL RLS: Can view if user in same department
CREATE POLICY qmrl_select ON qmrl USING (
  department_id IN (SELECT department_id FROM users WHERE id = auth.uid())
);

-- Users RLS: Can view self
CREATE POLICY users_select ON users USING (id = auth.uid());
```

Circular dependency: PO → QMHQ → QMRL → Users → (RLS checks on users) → infinite loop.

Real-world case: GitHub issue #1138 documents infinite recursion in Supabase RLS when users table used to specify role for other table policies.

**Consequences:**
- Query timeout: 30s+ for simple PO select
- Application hangs waiting for database
- Cannot load PO list in UI
- pg_stat_activity shows queries stuck in "active" state

**Prevention:**
```sql
-- OPTION A: Security definer function (breaks recursion)
CREATE OR REPLACE FUNCTION user_can_view_po(p_po_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM purchase_orders po
    JOIN qmhq ON qmhq.id = po.qmhq_id
    JOIN qmrl ON qmrl.id = qmhq.qmrl_id
    WHERE po.id = p_po_id
      AND (
        qmrl.requester_id = p_user_id
        OR qmrl.assigned_to = p_user_id
        OR p_user_id IN (SELECT id FROM users WHERE role IN ('admin', 'quartermaster', 'finance'))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY po_select ON purchase_orders USING (
  user_can_view_po(id, auth.uid())
);

-- OPTION B: Denormalize (cache department_id on QMHQ/PO)
ALTER TABLE purchase_orders ADD COLUMN department_id UUID;
-- Update via trigger when QMHQ changes
-- RLS becomes simple:
CREATE POLICY po_select ON purchase_orders USING (
  department_id IN (SELECT department_id FROM users WHERE id = auth.uid())
);
-- No joins, no recursion
```

OPTION A recommended for QM System (leverages existing RBAC logic, no schema changes). Migration 039 already uses SECURITY DEFINER pattern for complex checks.

**Detection:**
- Query slow log: SELECT queries on purchase_orders taking >1s
- Test: Log in as requester role, load /po page, verify loads <500ms
- EXPLAIN ANALYZE: Should see "Index Scan" not "Seq Scan on users" (indicates recursion)

**Phase assignment:** Phase adding PO RLS policies must test for recursion and use security definer functions for complex permission checks.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| PO Status Calculation Overhaul | Pitfall #1 (Race Conditions) | Implement advisory locks using hashtext(po_id) pattern from migration 058 |
| PO Cancellation Feature | Pitfall #2 (Trigger Ordering), #3 (Soft Delete Cascade), #6 (Void Edge Cases) | Follow aa_/zz_ prefix convention, use ON DELETE RESTRICT, test voided invoice scenarios |
| PDF Export Implementation | Pitfall #5 (Memory Leak), #8 (Stale Data) | Use @react-pdf/renderer or Supabase Edge Function, atomic snapshot queries |
| PO Lifecycle Audit Logging | Pitfall #7 (Duplicate Audits) | Add idempotency check in status update function to skip no-op UPDATEs |
| RLS Policy for POs | Pitfall #10 (Recursion) | Use SECURITY DEFINER functions, avoid EXISTS on RLS-protected tables |
| State Transition Validation | Pitfall #4 (Invalid Transitions) | Add BEFORE UPDATE trigger validating allowed transitions array |

---

## Sources

### PostgreSQL Isolation & Concurrency
- [PostgreSQL: Documentation: 18: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) — Authoritative isolation level documentation
- [Preventing Postgres SQL Race Conditions with SELECT FOR UPDATE](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/) — Concurrency patterns
- [PostgreSQL Advisory Locks (2026)](https://oneuptime.com/blog/post/2026-01-25-use-advisory-locks-postgresql/view) — Advisory lock best practices
- [Race condition in Order::setInvoiceDetails · Issue #23356](https://github.com/PrestaShop/PrestaShop/issues/23356) — Real-world PO status race condition case

### PostgreSQL Triggers & State Machines
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) — Current trigger best practices
- [Implementing State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) — State transition validation patterns
- [PostgreSQL: Documentation: 18: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) — Locking mechanisms and deadlock prevention

### PostgreSQL Foreign Keys & Soft Deletes
- [Soft Deletion Probably Isn't Worth It](https://brandur.org/soft-deletion) — Pitfalls of soft delete with foreign keys
- [Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes) — CASCADE behavior documentation
- [Cascade Delete - EF Core](https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete) — Foreign key cascade patterns

### Supabase RLS & Performance
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — Avoiding recursion, performance optimization
- [Infinite recursion when using users table for RLS · Discussion #1138](https://github.com/orgs/supabase/discussions/1138) — Real-world RLS recursion case
- [Supabase Row Level Security (RLS): Complete Guide (2026)](https://designrevision.com/blog/supabase-row-level-security) — Current RLS patterns

### PDF Generation in Serverless
- [Optimizing Puppeteer PDF generation](https://www.codepasta.com/2024/04/19/optimizing-puppeteer-pdf-generation) — Memory and performance optimization
- [Generate HTML as PDF using Next.js & Puppeteer on Serverless](https://medium.com/@martin_danielson/generate-html-as-pdf-using-next-js-puppeteer-running-on-serverless-vercel-aws-lambda-ed3464f7a9b7) — Vercel serverless PDF patterns
- [7 Tips for Generating PDFs with Puppeteer](https://apitemplate.io/blog/tips-for-generating-pdfs-with-puppeteer/) — Production best practices
- [Best practice for PDF generation from Supabase Edge Functions · Discussion #38327](https://github.com/orgs/supabase/discussions/38327) — Supabase Edge Function PDF approach

### Database Idempotency & Deduplication
- [PostgreSQL Triggers in 2026: Idempotency](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) — Idempotent trigger design
- [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) — Idempotency patterns for financial operations
- [Idempotency: Building Reliable & Predictable Systems (2026)](https://medium.com/@tnusraddinov/idempotency-building-reliable-predictable-systems-especially-for-financial-transactions-98e5e775d896) — Financial transaction idempotency

### Void/Cancel Cascades in ERP Systems
- [Void transactions in Payables Management - Dynamics GP](https://learn.microsoft.com/en-us/troubleshoot/dynamics/gp/void-transactions-payables-management) — Void cascade patterns
- [Difference between void and delete in Purchase Order Entry](https://learn.microsoft.com/en-us/troubleshoot/dynamics/gp/difference-between-void-and-delete-in-purchase-order-entry-windows) — Void vs delete semantics
- [Dynamics GP SOP Orphaned Transactions](https://www.encorebusiness.com/blog/dynamics-gp-sop-orphaned-transactions-and-allocated-items/) — Orphaned records from improper cascades

### Next.js & React PDF Server-Side
- [We had a leak! Identifying and fixing Memory Leaks in Next.js](https://medium.com/john-lewis-software-engineering/we-had-a-leak-identifying-and-fixing-memory-leaks-in-next-js-622977876697) — Production memory leak patterns
- [Memory Leak Prevention in Next.js](https://medium.com/@nextjs101/memory-leak-prevention-in-next-js-47b414907a43) — Prevention strategies
- [Using React for Server-Side PDF Report Generation](https://medium.com/@sepehr.sabour/using-react-for-server-side-pdf-report-generation-de594015f19a) — @react-pdf/renderer patterns
