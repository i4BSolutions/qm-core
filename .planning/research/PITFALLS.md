# Domain Pitfalls: PO Smart Lifecycle & Three-Way Matching

**Domain:** Purchase Order lifecycle management for existing QM System
**Researched:** 2026-02-03
**Focus:** Adding three-way matching status calculation, visual matching panels, progress bars, and lock mechanisms to existing PO system

## Executive Summary

This research identifies critical pitfalls when **adding** PO smart lifecycle features to an **existing system** with:
- Existing PO status calculation (`calculate_po_status` function)
- Invoice void cascade mechanisms
- Inventory WAC triggers
- Supabase RLS policies
- Real-time UI updates

The features being added:
1. Enhanced three-way match status calculation (PO qty ↔ Invoice qty ↔ Stock-in qty)
2. Visual matching panel (side-by-side comparison)
3. Progress bar (% toward "Closed")
4. Lock mechanism (block edits when Closed, except Admin)

**Key insight:** Most pitfalls arise from **integration with existing triggers**, not the new features themselves.

---

## Critical Pitfalls

Mistakes that cause data corruption, trigger recursion, or security vulnerabilities.

### Pitfall 1: Trigger Cascade Infinite Loops

**What goes wrong:**
Adding new triggers that update `po_line_items.invoiced_quantity` or `received_quantity` creates infinite recursion with **existing triggers** that already maintain these fields.

**Why it happens:**
The system **already has** these triggers:
- `update_po_line_invoiced_quantity()` fires AFTER invoice line changes
- `update_invoice_line_received_quantity()` fires AFTER inventory_in
- `trigger_update_po_status()` fires AFTER po_line_items changes

Adding a **new** trigger that updates `po_line_items` creates:
```
Invoice change → update_po_line_invoiced_quantity → UPDATE po_line_items
  → trigger_update_po_status → UPDATE purchase_orders
  → NEW trigger updates po_line_items → LOOP BACK
```

**Consequences:**
- PostgreSQL kills transaction after 32 recursion levels
- Error: "maximum recursion depth exceeded"
- All PO/invoice operations fail
- Database becomes unusable until trigger is dropped

**Prevention:**
1. **Never add new triggers that UPDATE the same tables existing triggers already update**
2. Use `pg_trigger_depth()` to detect recursion levels:
   ```sql
   -- Check trigger depth before updating
   IF pg_trigger_depth() > 1 THEN
     RETURN NEW; -- Prevent nested trigger execution
   END IF;
   ```
3. Use session variables as guards:
   ```sql
   -- Set guard before risky operation
   PERFORM set_config('app.recursion_guard', 'true', true);

   -- Check guard in trigger
   IF current_setting('app.recursion_guard', true) = 'true' THEN
     RETURN NEW;
   END IF;
   ```
4. **Prefer VIEWS over triggers** for status calculations that read-only aggregate data

**Detection:**
- Warning sign: `UPDATE` statements inside triggers on the same table
- Warning sign: Trigger fires on `AFTER UPDATE OF invoiced_quantity` and then updates `invoiced_quantity`
- Test: Create invoice, void invoice, create another invoice → should complete instantly

**Which phase:**
- Phase 1: Status calculation enhancement (HIGH RISK)
- Phase 4: Lock mechanism (MEDIUM RISK if lock updates trigger recalculation)

**Sources:**
- [PostgreSQL Triggers in 2026: Performance considerations](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Trigger recursion in PostgreSQL and how to deal with it](https://www.cybertec-postgresql.com/en/dealing-with-trigger-recursion-in-postgresql/)

---

### Pitfall 2: Race Conditions in Concurrent Status Calculation

**What goes wrong:**
Two simultaneous operations (e.g., creating invoice + receiving stock) both read current `po_line_items` state, calculate status, and UPDATE, causing last-write-wins data loss.

**Why it happens:**
The existing `calculate_po_status(p_po_id)` function uses:
```sql
SELECT SUM(quantity), SUM(invoiced_quantity), SUM(received_quantity)
FROM po_line_items WHERE po_id = p_po_id;
```

This is a **time-of-check, time-of-use (TOCTOU)** vulnerability. Between SELECT and UPDATE, another transaction can modify the same rows.

**Consequences:**
- Invoice quantity = 50, stock-in quantity = 50 arrive simultaneously
- Transaction A: reads invoiced=50, received=0 → status="awaiting_delivery"
- Transaction B: reads invoiced=0, received=50 → status="partially_received"
- Final status depends on which transaction commits last
- **Business rule violated:** "Partially Invoiced takes priority over Partially Received" ignored

**Prevention:**
1. **Use row-level locking when reading data for status calculation:**
   ```sql
   SELECT SUM(quantity), SUM(invoiced_quantity), SUM(received_quantity)
   FROM po_line_items
   WHERE po_id = p_po_id
   FOR UPDATE; -- Locks rows until transaction completes
   ```

2. **Use statement-level triggers instead of row-level** for aggregate calculations:
   ```sql
   -- WRONG: Row-level fires N times for N-row invoice
   CREATE TRIGGER update_status AFTER INSERT ON invoice_line_items
   FOR EACH ROW EXECUTE FUNCTION trigger_update_po_status();

   -- BETTER: Statement-level fires once with transition tables
   CREATE TRIGGER update_status AFTER INSERT ON invoice_line_items
   FOR EACH STATEMENT EXECUTE FUNCTION trigger_update_po_status_batch();
   ```

3. **Make status updates atomic within single transaction:**
   ```sql
   -- In recalculate_po_on_invoice_void, the UPDATE of po_line_items
   -- and subsequent status recalculation should happen in same transaction
   -- (already the case, but verify new triggers don't break this)
   ```

4. **Use Serializable Isolation Level for critical operations:**
   ```sql
   BEGIN ISOLATION LEVEL SERIALIZABLE;
   -- Perform multi-step three-way match
   COMMIT;
   ```

**Detection:**
- Warning sign: Flaky tests where status is sometimes correct, sometimes wrong
- Warning sign: Logs show two status updates to same PO within milliseconds
- Test: Use `pgbench` or similar to create 10 concurrent invoices for same PO
- Monitoring: Track `pg_stat_database.xact_commit` vs `xact_rollback` for serialization failures

**Which phase:**
- Phase 1: Status calculation (CRITICAL)
- Phase 3: Progress bar calculation (MEDIUM - read-only but depends on accurate status)

**Sources:**
- [Database Race Conditions: A System Security Guide](https://blog.doyensec.com/2024/07/11/database-race-conditions.html)
- [How To Prevent Race Conditions in Database](https://medium.com/@doniantoro34/how-to-prevent-race-conditions-in-database-3aac965bf47b)
- [Handling Race Conditions in Payment Systems](https://medium.com/@ankurnitp/handling-race-conditions-in-idempotent-operations-a-practical-guide-for-payment-systems-eb045b9ca7c4)

---

### Pitfall 3: Lock Mechanism Bypassed by Direct Database Updates

**What goes wrong:**
Implementing lock checks only in **UI/API layer** allows direct database updates to bypass locks, violating business rules.

**Why it happens:**
- Developer adds lock check: `if (po.status === 'closed' && userRole !== 'admin') throw error`
- Works in UI, but Supabase allows direct database access via PostgREST
- Triggers can also update locked records (e.g., invoice void cascade)
- Edge Functions or batch scripts bypass UI validation

**Consequences:**
- "Closed" PO modified by non-admin via API call
- Audit trail shows Admin locked PO, but changes still happened
- Financial reconciliation broken (three-way match no longer matches)

**Prevention:**
1. **Implement lock checks as database triggers (NOT just UI):**
   ```sql
   CREATE OR REPLACE FUNCTION block_closed_po_edits()
   RETURNS TRIGGER AS $$
   DECLARE
     user_role TEXT;
   BEGIN
     -- Check if PO is closed
     IF NEW.status = 'closed' AND OLD.status = 'closed' THEN
       -- Get current user role from Supabase auth
       user_role := (SELECT role FROM users WHERE id = auth.uid());

       -- Only admin can edit closed PO
       IF user_role != 'admin' THEN
         RAISE EXCEPTION 'Cannot modify closed Purchase Order (only Admin)';
       END IF;
     END IF;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER block_closed_po_edits
     BEFORE UPDATE ON purchase_orders
     FOR EACH ROW
     EXECUTE FUNCTION block_closed_po_edits();
   ```

2. **Add RLS policy for closed POs:**
   ```sql
   -- Prevent updates to closed POs except by admin
   CREATE POLICY po_closed_admin_only ON purchase_orders
     FOR UPDATE
     USING (status != 'closed' OR get_user_role() = 'admin')
     WITH CHECK (status != 'closed' OR get_user_role() = 'admin');
   ```

3. **Whitelist legitimate bypass scenarios:**
   - Invoice void cascade needs to update `invoiced_quantity` even when closed
   - Solution: Use `SECURITY DEFINER` function that sets session variable before update:
     ```sql
     PERFORM set_config('app.allow_closed_po_update', 'true', true);
     UPDATE po_line_items SET invoiced_quantity = ... WHERE ...;
     PERFORM set_config('app.allow_closed_po_update', 'false', true);
     ```

4. **Document ALL paths that modify locked records:**
   - UI → Server Action → Database
   - Invoice void → Trigger cascade → PO line items
   - Stock-in → Trigger → `received_quantity` update
   - Admin override → Bypass lock check

**Detection:**
- Warning sign: Lock works in UI but can be bypassed via Supabase API explorer
- Warning sign: Trigger updates fail with "Cannot modify closed PO" errors
- Test: Set PO to "closed", call PostgREST API directly to modify → should fail
- Audit: Query `audit_logs` for `entity_type='purchase_orders' AND field_name='status'` after close → should have no subsequent changes except admin

**Which phase:**
- Phase 4: Lock mechanism (CRITICAL)
- Phase 5: Admin override (verification that locks work correctly)

**Sources:**
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [PostgreSQL Advisory Locks for Application-Level Concurrency Control](https://medium.com/@erkanyasun/postgresql-advisory-locks-a-powerful-tool-for-application-level-concurrency-control-8a147c06ec39)

---

### Pitfall 4: Voided Invoice Exclusion Not Applied Consistently

**What goes wrong:**
New status calculation logic includes voided invoices in totals, breaking the existing invariant: "voided invoices don't count toward three-way match."

**Why it happens:**
Existing system has `i.is_voided = false` check in `update_po_line_invoiced_quantity()`:
```sql
SELECT COALESCE(SUM(ili.quantity), 0)
FROM invoice_line_items ili
JOIN invoices i ON i.id = ili.invoice_id
WHERE ili.po_line_item_id = target_po_line_id
  AND ili.is_active = true
  AND i.is_voided = false; -- CRITICAL: exclude voided
```

New developer adds visual matching panel query **without this check**:
```sql
-- WRONG: Includes voided invoices
SELECT SUM(quantity) FROM invoice_line_items WHERE po_line_item_id = ?
```

**Consequences:**
- UI shows invoice qty = 100 (includes voided invoice)
- Database `invoiced_quantity` = 50 (excludes voided)
- Progress bar shows 100% matched, but PO status = "partially_invoiced"
- User confusion: "Why is this not closed? The numbers match!"

**Prevention:**
1. **Create database VIEW for three-way match calculations:**
   ```sql
   CREATE VIEW po_three_way_match AS
   SELECT
     pl.id AS po_line_id,
     pl.po_id,
     pl.quantity AS po_qty,
     COALESCE(SUM(CASE
       WHEN i.is_voided = false THEN ili.quantity
       ELSE 0
     END), 0) AS invoiced_qty,
     pl.received_quantity AS received_qty,
     -- Calculate match percentage
     LEAST(
       (invoiced_qty / NULLIF(pl.quantity, 0)) * 100,
       (received_qty / NULLIF(pl.quantity, 0)) * 100
     ) AS match_percentage
   FROM po_line_items pl
   LEFT JOIN invoice_line_items ili ON ili.po_line_item_id = pl.id AND ili.is_active = true
   LEFT JOIN invoices i ON i.id = ili.invoice_id
   WHERE pl.is_active = true
   GROUP BY pl.id, pl.po_id, pl.quantity, pl.received_quantity;
   ```

   Then **all queries** (UI, status calculation, progress bar) use this VIEW instead of ad-hoc queries.

2. **Add database constraint to enforce voided exclusion:**
   ```sql
   -- Ensure invoiced_quantity never includes voided amounts
   -- (This is defensive; triggers should already enforce this)
   ALTER TABLE po_line_items ADD CONSTRAINT check_invoiced_quantity_valid
     CHECK (
       invoiced_quantity <= quantity AND
       invoiced_quantity >= 0
     );
   ```

3. **Add integration test for voided invoice scenario:**
   ```typescript
   test('voided invoice excluded from three-way match', async () => {
     const po = await createPO({ items: [{ qty: 100 }] });
     const invoice = await createInvoice(po, { qty: 100 });

     // Before void: should be awaiting_delivery
     expect(await getPOStatus(po.id)).toBe('awaiting_delivery');

     // Void invoice
     await voidInvoice(invoice.id);

     // After void: should be not_started
     const status = await getPOStatus(po.id);
     expect(status).toBe('not_started');

     // Visual panel should also show 0 invoiced
     const panel = await getMatchingPanel(po.id);
     expect(panel.invoicedQty).toBe(0);
   });
   ```

**Detection:**
- Warning sign: `is_voided` check present in triggers but missing in UI queries
- Warning sign: Frontend calculates totals differently than backend
- Test: Create invoice → void invoice → check UI vs database values
- Code review: Search for `invoice_line_items` queries without `is_voided = false` join

**Which phase:**
- Phase 1: Status calculation enhancement (CRITICAL - must use voided exclusion)
- Phase 2: Matching panel (CRITICAL - must show accurate numbers)
- Phase 3: Progress bar (CRITICAL - calculation must match status)

**Sources:**
- [Three-Way Matching: Edge Cases for Split and Partial Deliveries](https://www.stampli.com/blog/invoice-management/3-way-invoice-matching/)
- [Invoice Matching Automation Best Practices 2026](https://www.rillion.com/ap-automation-software/3-way-po-matching/)

---

## Moderate Pitfalls

Mistakes that cause delays, performance issues, or technical debt.

### Pitfall 5: RLS Policy Performance Degradation on Complex Status Queries

**What goes wrong:**
Adding visual matching panel with side-by-side comparison causes N+1 queries or slow page loads due to RLS policy re-evaluation for every row.

**Why it happens:**
Supabase RLS policies are evaluated **per-row** when querying data. Complex policies like:
```sql
CREATE POLICY po_line_items_read ON po_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN qmhq q ON q.id = po.qmhq_id
      JOIN qmrl r ON r.id = q.qmrl_id
      WHERE po.id = po_line_items.po_id
        AND (
          r.requester_id = auth.uid() OR
          q.assigned_to = auth.uid() OR
          get_user_role() IN ('admin', 'finance', 'quartermaster')
        )
    )
  );
```

For a PO with 10 line items, this subquery runs **10 times** (once per row). Visual matching panel fetches:
- PO line items (10 rows × RLS check)
- Invoice line items (20 rows × RLS check)
- Inventory transactions (30 rows × RLS check)
= 60 RLS policy evaluations per page load

**Consequences:**
- Matching panel takes 2-3 seconds to load
- Database CPU spikes to 80%+ on production
- `EXPLAIN ANALYZE` shows sequential scans instead of index usage
- Other users experience slowdown (shared database pool exhausted)

**Prevention:**
1. **Index columns used in RLS policies:**
   ```sql
   -- If RLS policy checks auth.uid() = requester_id
   CREATE INDEX idx_qmrl_requester_id ON qmrl(requester_id);

   -- If policy checks user role via JOIN
   CREATE INDEX idx_users_id_role ON users(id, role);
   ```

2. **Use SECURITY DEFINER functions to bypass nested RLS checks:**
   ```sql
   -- Instead of RLS policy with subquery, create view with SECURITY DEFINER
   CREATE OR REPLACE FUNCTION get_accessible_po_line_items(p_po_id UUID)
   RETURNS TABLE(id UUID, quantity DECIMAL, invoiced_quantity DECIMAL, received_quantity DECIMAL)
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = pg_catalog, public
   AS $$
   BEGIN
     -- Check permission once, then return all rows
     IF NOT (
       EXISTS (SELECT 1 FROM purchase_orders WHERE id = p_po_id AND ...) OR
       get_user_role() = 'admin'
     ) THEN
       RAISE EXCEPTION 'Permission denied';
     END IF;

     -- No RLS re-check per row
     RETURN QUERY
     SELECT pl.id, pl.quantity, pl.invoiced_quantity, pl.received_quantity
     FROM po_line_items pl
     WHERE pl.po_id = p_po_id;
   END;
   $$;
   ```

3. **Use `IN` or `ANY` instead of joins in RLS WHERE clause:**
   ```sql
   -- SLOW: Joins in RLS policy
   WHERE po_id IN (SELECT id FROM purchase_orders WHERE ...)

   -- FASTER: Pre-compute accessible PO IDs in array
   WHERE po_id = ANY(
     (SELECT array_agg(id) FROM purchase_orders WHERE ...)::UUID[]
   )
   ```

4. **Wrap functions in SELECT to cache results:**
   ```sql
   -- SLOW: Function called per row
   WHERE created_by = auth.uid()

   -- FASTER: Function called once, result cached
   WHERE created_by = (SELECT auth.uid())
   ```

5. **Use `EXPLAIN (ANALYZE, BUFFERS)` to profile queries:**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT * FROM po_line_items WHERE po_id = 'uuid';

   -- Look for:
   -- - "Seq Scan" instead of "Index Scan" → missing index
   -- - High "Execution Time" → slow RLS policy
   -- - "SubPlan" executed thousands of times → nested loop
   ```

**Detection:**
- Warning sign: `EXPLAIN` shows "SubPlan" or "InitPlan" with high loop counts
- Warning sign: Query time increases linearly with number of line items (10 items = 1s, 100 items = 10s)
- Monitoring: Enable `auto_explain.log_min_duration = 1000` in Supabase dashboard
- Test: Load matching panel with 100-line-item PO → should complete <500ms

**Which phase:**
- Phase 2: Matching panel (HIGH RISK - complex queries)
- Phase 3: Progress bar (MEDIUM RISK - if calculated per-request vs cached)

**Sources:**
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Optimizing RLS Performance with Supabase](https://medium.com/@antstack/optimizing-rls-performance-with-supabase-postgres-fa4e2b6e196d)
- [Supabase Performance Advisors](https://supabase.com/docs/guides/database/database-advisors)

---

### Pitfall 6: Partial Delivery / Split Invoice Tolerance Not Handled

**What goes wrong:**
Three-way match requires **exact** quantity match (PO qty = Invoice qty = Stock-in qty) but business reality allows:
- Partial deliveries (100 ordered, 95 delivered, supplier says "5 backorder")
- Split invoices (100 ordered, invoice for 50 now, 50 later)
- Over-delivery (100 ordered, 105 delivered)
- Rounding differences (10.5 units on PO, 10 units delivered)

**Why it happens:**
Existing `calculate_po_status` uses strict equality:
```sql
IF total_received >= total_ordered AND total_invoiced >= total_ordered THEN
  RETURN 'closed'::po_status;
END IF;
```

Real-world scenario:
- PO qty = 100.00
- Invoiced qty = 100.00
- Received qty = 99.50 (warehouse counts 99.5 units)
- Status = "partially_received" (never reaches "closed")
- Accountant cannot close PO manually

**Consequences:**
- POs stuck in "partially_received" forever
- Manual intervention required for every PO
- User frustration: "This is basically complete, why can't I close it?"

**Prevention:**
1. **Add configurable tolerance threshold:**
   ```sql
   -- Create settings table
   CREATE TABLE system_settings (
     key TEXT PRIMARY KEY,
     value JSONB,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   INSERT INTO system_settings (key, value) VALUES
     ('po_matching_tolerance', '{"percentage": 2.0, "absolute": 1.0}');

   -- Use in status calculation
   CREATE OR REPLACE FUNCTION calculate_po_status(p_po_id UUID)
   RETURNS po_status AS $$
   DECLARE
     total_ordered DECIMAL(15,2);
     total_invoiced DECIMAL(15,2);
     total_received DECIMAL(15,2);
     tolerance_pct DECIMAL(5,2);
     tolerance_abs DECIMAL(15,2);
   BEGIN
     -- Get tolerance settings
     SELECT
       (value->>'percentage')::DECIMAL,
       (value->>'absolute')::DECIMAL
     INTO tolerance_pct, tolerance_abs
     FROM system_settings
     WHERE key = 'po_matching_tolerance';

     -- Get totals
     SELECT SUM(quantity), SUM(invoiced_quantity), SUM(received_quantity)
     INTO total_ordered, total_invoiced, total_received
     FROM po_line_items WHERE po_id = p_po_id;

     -- Check if matched within tolerance
     IF (
       ABS(total_received - total_ordered) <= GREATEST(
         total_ordered * tolerance_pct / 100,
         tolerance_abs
       ) AND
       ABS(total_invoiced - total_ordered) <= GREATEST(
         total_ordered * tolerance_pct / 100,
         tolerance_abs
       )
     ) THEN
       RETURN 'closed'::po_status;
     END IF;

     -- ... rest of status logic
   END;
   $$;
   ```

2. **Add admin UI to configure tolerance:**
   - Settings page: `/admin/settings`
   - Fields: "Matching tolerance (%)", "Matching tolerance (absolute units)"
   - Default: 2% or 1.0 unit, whichever is greater

3. **Add manual override for edge cases:**
   ```sql
   ALTER TABLE purchase_orders ADD COLUMN manual_close_reason TEXT;
   ALTER TABLE purchase_orders ADD COLUMN manual_close_by UUID REFERENCES users(id);

   -- Admin can force close with reason
   UPDATE purchase_orders
   SET status = 'closed',
       manual_close_reason = 'Supplier confirmed backorder of 5 units',
       manual_close_by = auth.uid()
   WHERE id = ? AND get_user_role() = 'admin';
   ```

4. **Document business rules for tolerance:**
   - Tolerance applies to **total PO**, not per line item
   - Over-delivery within tolerance is acceptable (warn user, don't block)
   - Under-delivery within tolerance requires approval note
   - Tolerance does NOT apply to financial amounts (invoice total must match exactly or be less than PO)

**Detection:**
- Warning sign: High percentage of POs stuck in "partially_received" status
- Warning sign: Support tickets about "can't close PO with 99.5/100 received"
- Monitoring: Query POs where `ABS(received_qty - ordered_qty) < 2` and `status != 'closed'`
- User feedback: "This is good enough, let me close it!"

**Which phase:**
- Phase 1: Status calculation (MEDIUM RISK - add tolerance logic)
- Phase 2: Matching panel (LOW RISK - just display variance)
- Phase 4: Lock mechanism (MEDIUM RISK - should tolerance prevent lock?)

**Sources:**
- [Three-Way Matching Tolerance Settings (SAP)](https://community.sap.com/t5/enterprise-resource-planning-q-a/three-way-match-tolerance-settings/qaq-p/12590792)
- [Handling Partial Deliveries in 3-Way Match](https://www.bill.com/learning/3-way-matching)
- [Accounts Payable Variance Handling Best Practices 2026](https://learn.microsoft.com/en-us/dynamics365/finance/accounts-payable/accounts-payable-invoice-matching)

---

### Pitfall 7: Real-Time State Sync Fails During Concurrent Updates

**What goes wrong:**
User viewing matching panel sees stale data when another user creates invoice or receives stock in parallel, because Supabase Realtime subscription doesn't update fast enough.

**Why it happens:**
Supabase Realtime uses WebSocket connections that can:
- Drop connections temporarily (network issues)
- Have subscription delays (messages queued)
- Experience race conditions (WebSocket connects but handlers not registered yet)
- Fail to reconnect after page sleep/wake

User A views matching panel → subscribes to `po_line_items` changes
User B creates invoice → `invoiced_quantity` updates
User A sees old value for 2-5 seconds (or never updates if connection dropped)

**Consequences:**
- User sees "0/100 invoiced" but database shows "50/100 invoiced"
- User creates duplicate invoice thinking first one didn't work
- Progress bar shows wrong percentage until page refresh
- Loss of confidence in system accuracy

**Prevention:**
1. **Implement subscription lifecycle management:**
   ```typescript
   // components/po/matching-panel.tsx
   useEffect(() => {
     const channel = supabase
       .channel(`po_${poId}`)
       .on('postgres_changes', {
         event: 'UPDATE',
         schema: 'public',
         table: 'po_line_items',
         filter: `po_id=eq.${poId}`
       }, (payload) => {
         // Update local state
         setLineItems(prev => /* merge payload */);
       })
       .subscribe((status) => {
         if (status === 'SUBSCRIBED') {
           setIsConnected(true);
         }
         if (status === 'CHANNEL_ERROR') {
           // Retry with exponential backoff
           retrySubscription();
         }
       });

     // CRITICAL: Clean up on unmount
     return () => {
       channel.unsubscribe();
     };
   }, [poId]);
   ```

2. **Add optimistic UI updates with reconciliation:**
   ```typescript
   async function createInvoice(data) {
     // 1. Optimistic update (instant UI feedback)
     setLineItems(prev =>
       prev.map(item =>
         data.items.includes(item.id)
           ? { ...item, invoiced_quantity: item.invoiced_quantity + data.qty }
           : item
       )
     );

     // 2. Actual API call
     const result = await supabase.from('invoices').insert(data);

     // 3. Reconcile with server state
     if (result.error) {
       // Revert optimistic update
       fetchLineItems(); // Re-fetch from database
     }
   }
   ```

3. **Show connection status indicator:**
   ```tsx
   {!isConnected && (
     <Banner variant="warning">
       Live updates paused. <button onClick={refetch}>Refresh now</button>
     </Banner>
   )}
   ```

4. **Add manual refresh button:**
   ```tsx
   <Button onClick={() => refetch()} icon={RefreshIcon}>
     Refresh data
   </Button>
   ```

5. **Use polling as fallback for critical data:**
   ```typescript
   // Poll every 10 seconds if Realtime fails
   useEffect(() => {
     if (!isConnected) {
       const interval = setInterval(() => {
         refetch();
       }, 10000);
       return () => clearInterval(interval);
     }
   }, [isConnected]);
   ```

**Detection:**
- Warning sign: `console.log` shows "WebSocket connection closed" errors
- Warning sign: Subscription status goes `SUBSCRIBED → CLOSED → SUBSCRIBED` repeatedly
- Test: Open matching panel, create invoice in another tab → should update within 1s
- Test: Put laptop to sleep for 1 min, wake → subscription should reconnect
- Monitoring: Track Realtime connection failures in Supabase dashboard

**Which phase:**
- Phase 2: Matching panel (HIGH RISK - users rely on real-time updates)
- Phase 3: Progress bar (MEDIUM RISK - can show stale percentage)

**Sources:**
- [Production-ready listener for Supabase Realtime Postgres changes](https://medium.com/@dipiash/supabase-realtime-postgres-changes-in-node-js-2666009230b0)
- [WebSocket Race Condition in Supabase JS Client](https://github.com/supabase/supabase-js/issues/1559)
- [Supabase Realtime: Managing Subscriptions Best Practices](https://app.studyraid.com/en/read/8395/231602/managing-real-time-subscriptions)

---

### Pitfall 8: Audit Trail Gaps When Status Auto-Changes

**What goes wrong:**
PO status changes from "not_started" → "partially_invoiced" → "closed" but audit log only shows user actions (create invoice, create stock-in), not the **resulting status changes**.

**Why it happens:**
Existing `audit_triggers.sql` logs changes to `purchase_orders` table, but status changes happen via **trigger** (`trigger_update_po_status`), not user UPDATE.

Existing audit trigger fires AFTER UPDATE:
```sql
CREATE TRIGGER audit_purchase_orders
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();
```

But this captures the UPDATE that sets `status`, not the **context** of why it changed (invoice creation? stock-in?).

**Consequences:**
- Audit log shows: "PO-2025-00001 status changed to 'closed'" with `changed_by = NULL`
- Missing context: Which invoice caused the closure?
- Compliance issue: Cannot trace why PO was closed
- User confusion: "I didn't close this, who did?"

**Prevention:**
1. **Enhance audit logging to capture cascade context:**
   ```sql
   -- Similar to existing invoice_void_cascade_audit.sql (041)
   CREATE OR REPLACE FUNCTION audit_po_status_change()
   RETURNS TRIGGER AS $$
   DECLARE
     trigger_context TEXT;
     context_user_id UUID;
     context_user_name TEXT;
   BEGIN
     -- Only log status changes
     IF NEW.status != OLD.status THEN

       -- Determine what triggered the status change
       -- Check if there's a recent invoice creation
       SELECT
         'Invoice ' || invoice_number || ' created',
         created_by
       INTO trigger_context, context_user_id
       FROM invoices
       WHERE po_id IN (SELECT id FROM purchase_orders WHERE id = NEW.id)
       ORDER BY created_at DESC
       LIMIT 1;

       -- If no invoice, check for stock-in
       IF trigger_context IS NULL THEN
         SELECT
           'Stock-in completed',
           created_by
         INTO trigger_context, context_user_id
         FROM inventory_transactions
         WHERE invoice_id IN (
           SELECT id FROM invoices WHERE po_id IN (SELECT id FROM purchase_orders WHERE id = NEW.id)
         )
         ORDER BY created_at DESC
         LIMIT 1;
       END IF;

       -- Get user name
       IF context_user_id IS NOT NULL THEN
         SELECT full_name INTO context_user_name FROM users WHERE id = context_user_id;
       END IF;

       -- Insert audit log with context
       INSERT INTO audit_logs (
         entity_type, entity_id, action,
         field_name, old_value, new_value,
         changes_summary,
         changed_by, changed_by_name, changed_at
       ) VALUES (
         'purchase_orders',
         NEW.id,
         'status_change',
         'status',
         OLD.status::TEXT,
         NEW.status::TEXT,
         'PO ' || NEW.po_number || ' status changed from "' ||
           OLD.status::TEXT || '" to "' || NEW.status::TEXT || '"' ||
           COALESCE(' due to: ' || trigger_context, ''),
         context_user_id,
         context_user_name,
         NOW()
       );
     END IF;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER zz_audit_po_status_change
     AFTER UPDATE ON purchase_orders
     FOR EACH ROW
     EXECUTE FUNCTION audit_po_status_change();
   ```

2. **Use session variables to pass context through trigger chain:**
   ```sql
   -- Before creating invoice, set context
   PERFORM set_config('app.audit_context', 'creating_invoice', true);
   INSERT INTO invoices ...;

   -- Trigger can read context
   audit_context := current_setting('app.audit_context', true);
   ```

3. **Add timeline view to show causal chain:**
   ```
   15:30:00 - User "John" created Invoice INV-2025-00123
   15:30:01 - PO-2025-00001 status changed to "partially_invoiced" (due to invoice creation)
   15:35:00 - User "Jane" completed stock-in for INV-2025-00123
   15:35:01 - PO-2025-00001 status changed to "closed" (due to stock-in completion)
   ```

**Detection:**
- Warning sign: Audit logs for `purchase_orders` show `changed_by = NULL`
- Warning sign: Status change events without corresponding user action
- Test: Create invoice → check audit log for PO status change with invoice context
- Audit: Query `SELECT * FROM audit_logs WHERE entity_type='purchase_orders' AND changed_by IS NULL`

**Which phase:**
- Phase 1: Status calculation (MEDIUM RISK - status changes but no audit)
- Phase 4: Lock mechanism (LOW RISK - lock event should be audited with reason)

**Sources:**
- Existing implementation: `supabase/migrations/041_invoice_void_cascade_audit.sql`
- [Love, Death & Triggers: Audit Logging Best Practices](https://blog.gitguardian.com/love-death-triggers/)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

### Pitfall 9: Progress Bar Calculation Mismatch with Status Logic

**What goes wrong:**
Progress bar shows "95% complete" but PO status is "partially_invoiced" (not "closed"), confusing users about when PO actually closes.

**Why it happens:**
Developer calculates progress bar percentage using simple average:
```typescript
const progress = (
  (invoicedQty / orderedQty) * 100 +
  (receivedQty / orderedQty) * 100
) / 2; // Average of two percentages
```

But status calculation uses **different logic** (business rule: "Partially Invoiced takes priority"):
```sql
-- Status calculation prioritizes invoiced over received
IF total_invoiced > 0 AND total_invoiced < total_ordered THEN
  RETURN 'partially_invoiced';
END IF;
```

Result:
- Invoiced: 50/100 (50%)
- Received: 100/100 (100%)
- Progress bar: (50% + 100%) / 2 = **75%**
- Status: "partially_invoiced" (not 75% toward "closed")

**Consequences:**
- User sees 75% complete, expects PO to close soon
- But PO won't close until invoiced reaches 100%
- Support tickets: "Why is this stuck at 75%?"

**Prevention:**
1. **Match progress calculation to status logic:**
   ```typescript
   // Progress should reflect MINIMUM of invoice/received progress
   // (because both must reach 100% to close)
   const invoiceProgress = (invoicedQty / orderedQty) * 100;
   const receiveProgress = (receivedQty / orderedQty) * 100;
   const progress = Math.min(invoiceProgress, receiveProgress);
   ```

2. **Show breakdown instead of single progress bar:**
   ```tsx
   <div>
     <Label>Invoice Progress</Label>
     <ProgressBar value={invoiceProgress} />

     <Label>Receiving Progress</Label>
     <ProgressBar value={receiveProgress} />

     <Label>Overall Match</Label>
     <ProgressBar value={Math.min(invoiceProgress, receiveProgress)} />
   </div>
   ```

3. **Add tooltip explaining calculation:**
   ```tsx
   <Tooltip>
     Progress shows minimum of invoice and receiving completion.
     PO closes when BOTH reach 100%.
   </Tooltip>
   ```

4. **Use same calculation function for status AND progress:**
   ```typescript
   // lib/utils/po-calculations.ts
   export function calculatePOProgress(po: PO): {
     invoiceProgress: number;
     receiveProgress: number;
     overallProgress: number;
     nextMilestone: string;
   } {
     const invoiceProgress = (po.invoicedQty / po.orderedQty) * 100;
     const receiveProgress = (po.receivedQty / po.orderedQty) * 100;

     return {
       invoiceProgress,
       receiveProgress,
       overallProgress: Math.min(invoiceProgress, receiveProgress),
       nextMilestone: invoiceProgress < 100
         ? 'Create invoice'
         : 'Receive stock'
     };
   }
   ```

**Detection:**
- Warning sign: Progress bar reaches 100% but status is not "closed"
- Warning sign: User reports mismatch between progress bar and status
- Test: Create PO, invoice 50%, receive 100% → progress should be 50% (not 75%)

**Which phase:**
- Phase 3: Progress bar (MEDIUM RISK - user-facing confusion)

---

### Pitfall 10: Lock UI Indicator Not Synced with Database Lock State

**What goes wrong:**
UI shows lock icon and "Closed - No edits allowed" but form fields are still editable (or vice versa), confusing users.

**Why it happens:**
- Lock check happens on form submit, not on field interaction
- Or: Lock state fetched once on page load, not updated when status changes
- Or: Optimistic UI shows locked state before database confirms

**Consequences:**
- User spends 5 minutes editing closed PO, clicks Save → error "Cannot edit closed PO"
- Wasted time, user frustration
- Support tickets: "Why can I type if it's locked?"

**Prevention:**
1. **Disable fields immediately based on lock state:**
   ```tsx
   const isLocked = po.status === 'closed' && userRole !== 'admin';

   <Input
     disabled={isLocked}
     value={quantity}
     onChange={setQuantity}
   />

   {isLocked && (
     <Tooltip>
       This PO is closed. Only admins can edit.
     </Tooltip>
   )}
   ```

2. **Show prominent lock banner:**
   ```tsx
   {isLocked && (
     <Banner variant="info" icon={LockIcon}>
       This Purchase Order is closed and cannot be modified.
       {userRole === 'admin' && (
         <Button onClick={enableEdit}>Override (Admin)</Button>
       )}
     </Banner>
   )}
   ```

3. **Re-check lock state before save:**
   ```typescript
   async function savePO() {
     // Re-fetch current status (in case another user closed it)
     const { data: currentPO } = await supabase
       .from('purchase_orders')
       .select('status')
       .eq('id', poId)
       .single();

     if (currentPO.status === 'closed' && userRole !== 'admin') {
       showError('This PO was closed by another user. Refresh to see changes.');
       return;
     }

     // Proceed with save
   }
   ```

4. **Use consistent lock state source:**
   ```typescript
   // WRONG: Different lock checks in different places
   const isLocked = po.status === 'closed'; // Header
   const canEdit = po.status !== 'closed'; // Form

   // RIGHT: Single source of truth
   const lockState = usePOLockState(po);
   const isLocked = lockState.isLocked;
   const canEdit = lockState.canEdit;
   const lockReason = lockState.reason; // "Closed by system" or "Admin override"
   ```

**Detection:**
- Warning sign: Fields editable but submit fails with lock error
- Warning sign: Lock icon shows but no actual validation
- Test: Close PO → immediately try to edit → fields should be disabled

**Which phase:**
- Phase 4: Lock mechanism (LOW RISK - UI polish issue, not data integrity)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Phase 1: Status Calculation Enhancement** | Trigger recursion (Pitfall 1), Race conditions (Pitfall 2), Voided exclusion (Pitfall 4) | Use `pg_trigger_depth()`, add `FOR UPDATE` locks, create VIEW with voided exclusion |
| **Phase 2: Matching Panel** | RLS performance (Pitfall 5), Realtime sync (Pitfall 7) | Index RLS columns, use SECURITY DEFINER functions, implement subscription cleanup |
| **Phase 3: Progress Bar** | Calculation mismatch (Pitfall 9) | Use same logic as status calculation, show breakdown, add tooltips |
| **Phase 4: Lock Mechanism** | Lock bypass (Pitfall 3), Audit gaps (Pitfall 8), UI sync (Pitfall 10) | Database triggers for lock, cascade audit logging, disable fields when locked |
| **Phase 5: Admin Override** | Verify all previous phases work correctly, audit override actions | Integration tests, audit logs with reason |

---

## Integration Testing Checklist

Before deploying to production, verify these scenarios:

### Concurrent Operations
- [ ] Create invoice + receive stock simultaneously → status calculates correctly
- [ ] Two users void two invoices for same PO → both succeed, status recalculates once
- [ ] Close PO while another user is editing → lock prevents edit

### Cascade Scenarios
- [ ] Void invoice → `invoiced_quantity` decreases → status recalculates → audit logs cascade
- [ ] Cancel stock-in → `received_quantity` decreases → status recalculates
- [ ] Delete invoice line item → PO totals update → status changes

### Lock Mechanism
- [ ] Close PO → cannot edit PO header, line items, or linked invoices (except admin)
- [ ] Admin override → edit works, audit log records override with reason
- [ ] Void invoice for closed PO → allowed (whitelisted bypass)

### Performance
- [ ] Load matching panel with 100 line items → <500ms
- [ ] Create invoice with 50 line items → status updates within 1s
- [ ] Realtime subscription updates within 2s of database change

### Edge Cases
- [ ] PO with 99.5/100 received → closes if within tolerance
- [ ] Voided invoice → excluded from all calculations (status, progress, matching panel)
- [ ] Partial delivery + split invoice → status reflects partial state correctly

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Trigger recursion prevention | HIGH | Well-documented patterns, existing codebase uses similar patterns |
| Race condition prevention | MEDIUM | PostgreSQL locking is robust, but testing concurrent scenarios is hard |
| Lock mechanism security | HIGH | Database triggers + RLS provide defense in depth |
| RLS performance optimization | MEDIUM | Context7 docs are comprehensive, but query profiling needed per deployment |
| Tolerance handling | LOW | Business rules for tolerance not fully specified in project context |
| Realtime sync reliability | MEDIUM | Supabase Realtime is generally stable, but edge cases (network issues) need handling |
| Audit completeness | HIGH | Existing audit system is comprehensive, just needs extension |

---

## Sources

**Three-Way Matching Implementation:**
- [The Pitfalls of 3-Way Matching in AP](https://fiscaltec.com/pitfalls-of-3-way-matching-in-ap/)
- [Most Common Issues Associated with Three-Way Invoice Matching Process](https://www.linkedin.com/pulse/most-common-issues-associated-three-way-invoice-fataneh-farhadzadeh)
- [3-Way Invoice Matching: How to Build a Bulletproof Workflow](https://www.stampli.com/blog/invoice-management/3-way-invoice-matching/)
- [Three-Way Matching Tolerance Settings](https://community.sap.com/t5/enterprise-resource-planning-q-a/three-way-match-tolerance-settings/qaq-p/12590792)

**Database Locking and Concurrency:**
- [PostgreSQL Advisory Locks: A Powerful Tool for Application-Level Concurrency Control](https://medium.com/@erkanyasun/postgresql-advisory-locks-a-powerful-tool-for-application-level-concurrency-control-8a147c06ec39)
- [Database Lock Best Practices 2025](https://www.shadecoder.com/topics/database-locking-a-comprehensive-guide-for-2025)
- [Database Race Conditions: A System Security Guide](https://blog.doyensec.com/2024/07/11/database-race-conditions.html)
- [How To Prevent Race Conditions in Database](https://medium.com/@doniantoro34/how-to-prevent-race-conditions-in-database-3aac965bf47b)

**PostgreSQL Triggers:**
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Trigger recursion in PostgreSQL and how to deal with it](https://www.cybertec-postgresql.com/en/dealing-with-trigger-recursion-in-postgresql/)
- [More on Postgres trigger performance](https://www.cybertec-postgresql.com/en/more-on-postgres-trigger-performance/)
- [Love, Death & Triggers](https://blog.gitguardian.com/love-death-triggers/)

**Supabase RLS Performance:**
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)
- [Optimizing RLS Performance with Supabase](https://medium.com/@antstack/optimizing-rls-performance-with-supabase-postgres-fa4e2b6e196d)
- [Performance and Security Advisors](https://supabase.com/docs/guides/database/database-advisors)
- [Debugging performance issues](https://supabase.com/docs/guides/database/debugging-performance)

**Supabase Realtime:**
- [Production-ready listener for Supabase Realtime Postgres changes](https://medium.com/@dipiash/supabase-realtime-postgres-changes-in-node-js-2666009230b0)
- [WebSocket Race Condition in Supabase JS Client](https://github.com/supabase/supabase-js/issues/1559)
- [Supabase Realtime: Managing Subscriptions](https://app.studyraid.com/en/read/8395/231602/managing-real-time-subscriptions)
