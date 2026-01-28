# Domain Pitfalls: Inventory Dashboard & WAC Enhancements

**Domain:** Inventory Management System - Dashboard, WAC, and Cascade Recalculation
**Context:** Adding features to EXISTING QM System with triggers, audit logging, and PO status calculation
**Researched:** 2026-01-28

---

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or major system failures.

### Pitfall 1: Trigger Recursion from Cascade Recalculation

**What goes wrong:** When invoice void triggers WAC recalculation, which triggers audit logging, which references the invoice table, creating circular trigger dependencies. In PostgreSQL, cascading triggers have no depth limit and the system will allow infinite recursion until stack overflow.

**Why it happens:**
- Multiple AFTER triggers on same table fire sequentially
- WAC trigger updates `items` table → fires audit trigger on items
- Invoice void updates `invoices.is_voided` → fires WAC recalculation → fires audit
- If audit trigger queries related tables during CASCADE, it can re-trigger the original operation

**Consequences:**
- Database deadlocks under concurrent operations
- Transaction timeouts (PostgreSQL default: 1 second for deadlock detection)
- Silent data corruption if transactions partially complete
- Stack overflow errors in extreme cases

**Prevention:**
```sql
-- Use pg_trigger_depth() to prevent recursion
CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
BEGIN
  -- Stop if we're already in a nested trigger call
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- WAC calculation logic...
END;
$$ LANGUAGE plpgsql;
```

**Additional safeguards:**
- Use WHEN clause on CREATE TRIGGER to conditionally fire only when specific fields change
- Prefer BEFORE triggers over AFTER triggers where possible (modify row before insert, no recursion)
- Set session variables as recursion guards: `SET LOCAL app.in_trigger = TRUE`
- Monitor with `auto_explain.log_triggers` threshold to catch slow trigger chains

**Detection:**
- `pg_stat_activity` shows multiple processes waiting on ExclusiveLock
- Error messages: "deadlock detected" or "maximum stack depth exceeded"
- Slow queries during invoice void or stock-in operations
- Audit logs show duplicate entries for same timestamp/action

**Phase recommendation:** Phase 1 (Architecture) - Design trigger call graph before implementation

**Sources:**
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [PostgreSQL Understanding deadlocks](https://www.cybertec-postgresql.com/en/postgresql-understanding-deadlocks/)
- [Trigger recursion in PostgreSQL and how to deal with it](https://www.cybertec-postgresql.com/en/dealing-with-trigger-recursion-in-postgresql/)

---

### Pitfall 2: Full-History WAC Recalculation on Every Void

**What goes wrong:** When voiding an invoice, the naive approach recalculates WAC by scanning ALL historical `inventory_in` transactions for that item. For items with 10,000+ transactions, this becomes a 5+ second operation, blocking the entire `items` table row.

**Why it happens:**
- Existing trigger does full table scan: `SELECT SUM(quantity * unit_cost) FROM inventory_transactions WHERE item_id = ... AND status = 'completed'`
- No index on `(item_id, status, movement_type)` compound key
- PostgreSQL row-level locks on `items` table block concurrent dashboard queries
- CROSS JOIN in `warehouse_inventory` view amplifies the problem (warehouses × items)

**Consequences:**
- Dashboard timeout errors during void operations
- 30+ second load times for warehouse detail pages
- Users complain "system freezes when Finance voids invoices"
- Concurrent stock-in operations fail with lock timeout

**Prevention:**

**Phase 1: Proper indexing**
```sql
-- Compound index for WAC recalculation query
CREATE INDEX idx_inventory_transactions_wac_calc
ON inventory_transactions(item_id, status, movement_type, is_active)
WHERE status = 'completed' AND movement_type = 'inventory_in';

-- Include unit_cost in covering index
CREATE INDEX idx_inventory_transactions_wac_calc_covering
ON inventory_transactions(item_id, status)
INCLUDE (quantity, unit_cost, currency, exchange_rate)
WHERE status = 'completed' AND movement_type = 'inventory_in';
```

**Phase 2: Incremental WAC updates instead of full recalculation**
- Store `total_quantity_in` and `total_value_in` on `items` table
- On stock-in: increment counters (O(1) operation)
- On void: decrement counters (O(1) operation)
- Trade-off: Slightly more complex logic, but 1000x faster

**Phase 3: Queue long-running recalculations**
- For items with >1000 transactions, use background job
- Set `wac_recalc_pending = true` flag
- Show "⏳ Recalculating..." badge in dashboard
- Run actual recalculation via Supabase Edge Function or pg_cron

**Detection:**
- `EXPLAIN ANALYZE` shows Seq Scan on inventory_transactions
- `pg_stat_user_tables.seq_scan` increases rapidly
- Lock wait events in `pg_stat_activity`: `relation` lock type
- Dashboard queries timeout with "canceling statement due to statement timeout"

**Phase recommendation:** Phase 1 (Database) - Add indexes; Phase 3 (Optimization) - Implement incremental updates

**Sources:**
- [Weighted Average Inventory Method: Complete Guide](https://www.finaleinventory.com/accounting-and-inventory-software/weighted-average-inventory-method)
- [Cascade Update of Cost on Inventory Transactions](https://ifs-train.westsidecorporation.com/ifsdoc/documentation/en/MaintainInventory/AboutCascadeUpdateofInvTrans.htm)

---

### Pitfall 3: Negative Stock Breaking WAC Calculation

**What goes wrong:** WAC formula divides by total quantity: `WAC = total_value / total_qty`. If inventory goes negative (stock-out before stock-in due to timing issues), division by zero or negative denominators corrupt the WAC value. Existing trigger has `GREATEST(current_qty, 0)` but doesn't handle negative total after new transaction.

**Why it happens:**
- User manually creates stock-in with backdated transaction_date
- System processes stock-out first (completed status), then processes backdated stock-in
- Race condition: Two concurrent stock-outs exceed available stock
- Transfer transactions: Stock-out from warehouse A before stock-in to warehouse B completes
- Invoice void removes stock-in, but related stock-outs remain active

**Consequences:**
- WAC becomes NULL, NaN, or negative value
- Dashboard shows "Invalid value" for item costs
- `wac_amount_eusd` generated column returns NULL, breaking all financial reports
- Cascade failure: All items in same warehouse show invalid costs
- Audit trail shows correct transactions, but valuation is wrong

**Prevention:**

**Phase 1: Strict validation**
```sql
-- Enhance existing validate_stock_out_quantity() trigger
CREATE OR REPLACE FUNCTION validate_stock_out_quantity()
RETURNS TRIGGER AS $$
DECLARE
  available_stock DECIMAL(15,2);
  pending_stock_outs DECIMAL(15,2);
BEGIN
  -- Check not just completed, but also pending stock-outs
  SELECT
    COALESCE(SUM(CASE
      WHEN movement_type = 'inventory_in' THEN quantity
      WHEN movement_type = 'inventory_out' AND status IN ('completed', 'pending') THEN -quantity
      ELSE 0
    END), 0)
  INTO available_stock
  FROM inventory_transactions
  WHERE item_id = NEW.item_id
    AND warehouse_id = NEW.warehouse_id
    AND is_active = true;

  IF NEW.quantity > available_stock THEN
    RAISE EXCEPTION 'Cannot create stock-out: Available stock % (including pending)',
      available_stock;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Phase 2: WAC calculation safety checks**
```sql
-- In update_item_wac() function
IF total_qty <= 0 THEN
  -- Don't update WAC if quantity would go negative
  RAISE WARNING 'Skipping WAC update: total quantity % is non-positive for item %',
    total_qty, NEW.item_id;
  RETURN NEW;
END IF;

-- Sanity check: WAC shouldn't change by >500% in single transaction
IF new_wac > current_wac * 5 OR new_wac < current_wac / 5 THEN
  RAISE WARNING 'WAC changed by >500%: old=%, new=% for item %',
    current_wac, new_wac, NEW.item_id;
  -- Log to audit table for investigation
END IF;
```

**Phase 3: UI warnings**
- Show "⚠️ Negative stock detected" badge on item detail page
- Block backdated transactions unless user has `inventory_admin` role
- Daily cron job to detect and alert on negative stock situations

**Detection:**
- `SELECT * FROM items WHERE wac_amount IS NULL OR wac_amount < 0`
- `SELECT * FROM warehouse_inventory WHERE current_stock < 0`
- Dashboard shows blank cost values
- Financial reports: "Total value EUSD" shows 0 or NULL for items

**Phase recommendation:** Phase 1 (Database) - Add validation; Phase 2 (UI) - Add warnings

**Sources:**
- [Negative Inventory: What is it & How Does it Affect Stock Control?](https://www.unleashedsoftware.com/blog/negative-inventory-affect-inventory-control/)
- [WAC Knowledge Base | Zoho Inventory](https://www.zoho.com/us/inventory/kb/items/inventory-wac-report.html)

---

### Pitfall 4: Invoice Void Doesn't Cascade to PO Status Recalculation

**What goes wrong:** QM System calculates PO status based on `total_invoiced` and `total_received` aggregates. When an invoice is voided (`is_voided = true`), the existing PO status calculation queries don't exclude voided invoices, showing PO as "fully invoiced" when it's actually not.

**Why it happens:**
- Existing PO status calculation: `SELECT SUM(quantity) FROM invoice_line_items WHERE po_line_item_id = ...`
- Missing: `AND invoices.is_voided = false` condition in JOIN
- Voiding sets flag but doesn't trigger PO status recalculation
- Dashboard caches PO status, doesn't detect void events

**Consequences:**
- PO shows status "awaiting_delivery" but actually needs more invoices
- Finance team can't create new invoice (blocked by "PO is closed" check)
- Balance in Hand calculation is wrong (includes voided invoice amounts)
- Cascade failure: QMHQ shows incorrect completion status

**Prevention:**

**Phase 1: Update PO status calculation queries**
```sql
-- Create view that excludes voided invoices
CREATE OR REPLACE VIEW po_line_items_with_invoice_status AS
SELECT
  pli.id,
  pli.po_id,
  pli.quantity as ordered_quantity,
  COALESCE(SUM(
    CASE WHEN i.is_voided = false THEN ili.quantity ELSE 0 END
  ), 0) as invoiced_quantity,
  COALESCE(SUM(
    CASE WHEN i.is_voided = false THEN ili.received_quantity ELSE 0 END
  ), 0) as received_quantity
FROM po_line_items pli
LEFT JOIN invoice_line_items ili ON ili.po_line_item_id = pli.id
LEFT JOIN invoices i ON i.id = ili.invoice_id
GROUP BY pli.id;
```

**Phase 2: Trigger to recalculate PO status on void**
```sql
CREATE OR REPLACE FUNCTION recalculate_po_status_on_void()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when is_voided changes from false to true
  IF NEW.is_voided = true AND OLD.is_voided = false THEN
    -- Call existing PO status calculation function
    PERFORM update_po_status(NEW.po_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_void_update_po ON invoices;
CREATE TRIGGER invoice_void_update_po
  AFTER UPDATE OF is_voided ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_po_status_on_void();
```

**Phase 3: Update Balance in Hand calculation**
```sql
-- In financial_transactions query
SELECT
  SUM(CASE WHEN ft.transaction_type = 'money_in' THEN ft.amount_eusd ELSE 0 END) -
  SUM(CASE
    WHEN ft.transaction_type = 'money_out'
      AND ft.invoice_id IS NOT NULL
      AND i.is_voided = false  -- KEY: exclude voided
    THEN ft.amount_eusd
    ELSE 0
  END) as balance_in_hand
FROM financial_transactions ft
LEFT JOIN invoices i ON i.id = ft.invoice_id
WHERE ft.qmhq_id = ...
```

**Detection:**
- PO detail page shows "closed" but has unmatched quantities
- `SELECT * FROM invoices WHERE is_voided = true` → check related PO status manually
- Finance reports: Balance in Hand doesn't match bank statement
- User report: "Can't create invoice for PO that should be open"

**Phase recommendation:** Phase 1 (Database) - Add trigger; Phase 2 (Testing) - Test cascade thoroughly

**Sources:**
- [Inventory close - Supply Chain Management | Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/cost-management/inventory-close)
- [Voiding an Invoice - Certinia](https://help.certinia.com/main/2024.1/Content/OIM/Features/OrderFulfillment/Invoices/VoidingInvoice.htm)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded performance.

### Pitfall 5: Dashboard N+1 Query Problem

**What goes wrong:** Warehouse dashboard loads list of 50 warehouses, then for each warehouse makes separate query to calculate total inventory value. 50 warehouses × 3 queries each (items count, total units, total value) = 150 database round-trips. Page load: 8-12 seconds.

**Why it happens:**
- Server component fetches warehouses: `const warehouses = await supabase.from('warehouses').select('*')`
- For each warehouse, component calls: `getWarehouseInventoryStats(warehouse.id)`
- Each call is separate RPC or query
- No batching or aggregation at database level
- Next.js Server Components don't automatically batch queries

**Prevention:**

**Phase 1: Use materialized aggregates**
```sql
-- Create summary view with all KPIs
CREATE MATERIALIZED VIEW warehouse_dashboard_stats AS
SELECT
  w.id as warehouse_id,
  w.name,
  w.location,
  COUNT(DISTINCT wi.item_id) as total_items,
  COALESCE(SUM(wi.current_stock), 0) as total_units,
  COALESCE(SUM(wi.total_value), 0) as total_value,
  COALESCE(SUM(wi.total_value_eusd), 0) as total_value_eusd,
  MAX(it.transaction_date) as last_transaction_date
FROM warehouses w
LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id
LEFT JOIN inventory_transactions it ON it.warehouse_id = w.id AND it.status = 'completed'
WHERE w.is_active = true
GROUP BY w.id, w.name, w.location;

-- Refresh on inventory transaction
CREATE OR REPLACE FUNCTION refresh_warehouse_dashboard_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY warehouse_dashboard_stats;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Phase 2: Single query with JSON aggregation**
```typescript
// Instead of N+1 queries, single query with joins
const { data: warehouses } = await supabase
  .rpc('get_warehouse_dashboard_data')

// RPC function returns JSON with all aggregates
```

**Phase 3: Pagination + stale-while-revalidate caching**
- Load 10 warehouses at a time
- Cache dashboard stats for 5 minutes (low staleness tolerance)
- Show "as of [timestamp]" indicator

**Detection:**
- Browser DevTools Network tab shows 100+ requests to Supabase
- `pg_stat_statements` shows same query pattern with different IDs
- Slow page load despite low data volume
- Supabase dashboard shows high RPC call count

**Phase recommendation:** Phase 2 (Dashboard Implementation) - Design queries first, then UI

**Sources:**
- [What is the N+1 Query Problem and How to Solve it?](https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it)
- [Inventory dashboards | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/intelligent-order-management/inventory-dashboards)

---

### Pitfall 6: Multi-Currency Rounding Errors Compound Over Time

**What goes wrong:** Invoice has line items in USD, exchange rate 1850.0000 MMK/USD. Item cost $10.00 becomes 18,500.00 MMK. WAC calculation stores 2 decimals. After 100 transactions with rounding at each step, WAC is off by 2-3% from true value. EUSD display shows incorrect amounts.

**Why it happens:**
- Exchange rate has 4 decimals: `DECIMAL(10,4)`
- Amount has 2 decimals: `DECIMAL(15,2)`
- EUSD generated column: `amount / exchange_rate` → rounds to 2 decimals
- WAC calculation: `(existing_value + new_value) / total_qty` → rounds to 2 decimals
- Each rounding introduces 0.01-0.49 error, compounds over time

**Example compound error:**
```
Transaction 1: 100 units @ $10.00 → WAC = $10.00 (exact)
Transaction 2: 50 units @ $10.45 → True WAC = $10.15, Stored = $10.15 (rounded)
Transaction 3: 75 units @ $9.78 → True WAC = $10.05666..., Stored = $10.06 (rounded +0.00334)
... after 100 transactions ...
Displayed WAC: $10.23, True WAC: $10.01 (2.2% error)
```

**Consequences:**
- Financial reports show incorrect inventory valuation
- Balance in Hand calculation accumulates error
- Auditors flag discrepancy between WAC-based value and sum of transaction values
- Multi-currency items worse than single-currency (error per currency conversion)

**Prevention:**

**Phase 1: Store high-precision intermediate values**
```sql
-- Add high-precision columns for internal calculation
ALTER TABLE items ADD COLUMN wac_amount_precise DECIMAL(20,6);
ALTER TABLE items ADD COLUMN total_value_precise DECIMAL(20,6);
ALTER TABLE items ADD COLUMN total_quantity_precise DECIMAL(20,6);

-- Update WAC trigger to use precise values
CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
DECLARE
  new_wac_precise DECIMAL(20,6);
BEGIN
  -- Calculate with 6 decimal precision
  new_wac_precise := (existing_value_precise + new_value_precise) / total_qty_precise;

  -- Store both precise (for next calculation) and display (for UI)
  UPDATE items SET
    wac_amount_precise = new_wac_precise,
    wac_amount = ROUND(new_wac_precise, 2),  -- Display value
    total_value_precise = existing_value_precise + new_value_precise,
    total_quantity_precise = total_qty_precise;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Phase 2: Periodic WAC reconciliation**
```sql
-- Monthly job to compare stored WAC vs recalculated true WAC
CREATE OR REPLACE FUNCTION audit_wac_accuracy()
RETURNS TABLE(item_id UUID, stored_wac DECIMAL, true_wac DECIMAL, error_pct DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.wac_amount as stored_wac,
    ROUND(SUM(it.quantity * it.unit_cost) / SUM(it.quantity), 2) as true_wac,
    ROUND((i.wac_amount - (SUM(it.quantity * it.unit_cost) / SUM(it.quantity))) / i.wac_amount * 100, 2) as error_pct
  FROM items i
  JOIN inventory_transactions it ON it.item_id = i.id
    AND it.movement_type = 'inventory_in'
    AND it.status = 'completed'
  GROUP BY i.id, i.wac_amount
  HAVING ABS(i.wac_amount - (SUM(it.quantity * it.unit_cost) / SUM(it.quantity))) > 0.05;
END;
$$ LANGUAGE plpgsql;
```

**Phase 3: Exchange rate conventions**
- Always use rates >1.0 (1 USD = 1850 MMK, not 1 MMK = 0.00054 USD)
- Store exchange rates as `source_currency/EUSD` consistently
- Document: "EUSD is always denominator" in code comments

**Detection:**
- Run `audit_wac_accuracy()` monthly
- Compare SUM(inventory_transactions.value) vs items.wac_amount * items.total_stock
- Finance flags: "Inventory value doesn't match transaction history"
- Error >1%: Investigate immediately

**Phase recommendation:** Phase 1 (Database) - Add precise columns; Phase 4 (Maintenance) - Add reconciliation job

**Sources:**
- [Rounding issues when using multi-currency](https://forum.manager.io/t/rounding-issues-when-using-multi-currency/1622)
- [Exchange Differences and Rounding](https://help-sage50.na.sage.com/en-ca/core/2026/Content/Transactions/Multicurrency/ExchangeDifferencesRounding.htm)

---

### Pitfall 7: Dashboard Shows Stale Data After Invoice Void

**What goes wrong:** User voids invoice → refreshes warehouse dashboard → still shows old inventory quantities. WAC has updated in database, but Next.js page cache serves stale data. User reports "System is broken, void didn't work."

**Why it happens:**
- Next.js App Router defaults to `force-cache` for fetch requests
- Server Components cache across requests (production behavior)
- Supabase RPC calls don't invalidate Next.js cache
- No real-time subscription on dashboard page
- Materialized view `warehouse_dashboard_stats` not refreshed

**Prevention:**

**Phase 1: Appropriate cache strategies**
```typescript
// app/(dashboard)/inventory/warehouse/[id]/page.tsx
export const revalidate = 60; // Revalidate every 60 seconds

// For critical data, use no cache
const { data: warehouseStats } = await supabase
  .from('warehouse_inventory')
  .select('*')
  .eq('warehouse_id', id)
  .single();

// Or use dynamic rendering
export const dynamic = 'force-dynamic'; // Opt out of caching entirely
```

**Phase 2: Optimistic updates with revalidation**
```typescript
// When user voids invoice, optimistically update UI
'use server'
async function voidInvoice(invoiceId: string) {
  await supabase
    .from('invoices')
    .update({ is_voided: true, void_reason: '...' })
    .eq('id', invoiceId);

  // Revalidate related pages
  revalidatePath('/inventory/warehouse/[id]', 'page');
  revalidatePath('/po/[id]', 'page');
  revalidatePath('/dashboard');
}
```

**Phase 3: Real-time subscriptions for critical views**
```typescript
// Only for high-value pages (dashboard, warehouse detail)
useEffect(() => {
  const channel = supabase
    .channel('warehouse_updates')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_transactions' },
      (payload) => {
        // Refetch warehouse stats
        queryClient.invalidateQueries(['warehouse', warehouseId]);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [warehouseId]);
```

**Phase 4: User feedback**
```typescript
// Show "as of [timestamp]" on dashboard
<div className="text-sm text-gray-500">
  Last updated: {formatDistanceToNow(lastUpdated)} ago
  <Button onClick={refetch}>Refresh</Button>
</div>
```

**Detection:**
- User reports: "Voided invoice still shows in dashboard"
- Compare database value vs UI display
- Check Next.js cache headers: `X-Next-Cache: HIT` means stale data served
- Materialized view timestamp vs current time

**Phase recommendation:** Phase 2 (Dashboard Implementation) - Configure caching strategy upfront

**Sources:**
- [11 Most Important Inventory Management KPIs in 2026](https://www.mrpeasy.com/blog/inventory-management-kpis/)
- [Inventory dashboards | Microsoft Learn](https://learn.microsoft.com/en-us/dynamics365/intelligent-order-management/inventory-dashboards)

---

### Pitfall 8: Manual Stock-In with Missing Exchange Rate

**What goes wrong:** User creates manual stock-in (not from invoice) for item purchased in foreign currency. Form doesn't require exchange rate input. System defaults to `exchange_rate = 1.0000`. WAC calculation uses wrong rate. Item cost appears 1850x higher than reality (if currency was USD but system treated as MMK).

**Why it happens:**
- Stock-in form has optional exchange rate field (following invoice pattern)
- Invoice form validates exchange rate ≠ 1.0 if currency ≠ base
- Manual stock-in form doesn't have same validation
- User assumes "system will figure it out"
- Existing trigger accepts NULL or 1.0 as valid exchange rate

**Consequences:**
- Item WAC jumps from $10 to $18,500 (1850x error)
- Dashboard flags item as extremely expensive
- Finance team doesn't notice until month-end reconciliation
- Correcting requires manual WAC recalculation for all affected items
- Audit trail shows "what happened" but not "why user did this"

**Prevention:**

**Phase 1: Form validation**
```typescript
// Stock-in form schema (Zod)
const stockInSchema = z.object({
  currency: z.string(),
  exchange_rate: z.number().min(0.0001).max(100000),
  unit_cost: z.number().min(0.01),
}).refine((data) => {
  // If currency is not base currency, require exchange rate ≠ 1.0
  if (data.currency !== 'MMK' && data.exchange_rate === 1.0) {
    return false;
  }
  return true;
}, {
  message: "Exchange rate must reflect actual conversion rate for foreign currency",
  path: ["exchange_rate"],
});
```

**Phase 2: Smart defaults**
```typescript
// Fetch latest exchange rate from financial_transactions
const getDefaultExchangeRate = async (currency: string) => {
  if (currency === 'MMK') return 1.0000;

  // Get most recent exchange rate for this currency
  const { data } = await supabase
    .from('financial_transactions')
    .select('exchange_rate')
    .eq('currency', currency)
    .order('transaction_date', { ascending: false })
    .limit(1)
    .single();

  return data?.exchange_rate ?? null; // Return null to force user input
};

// In form
useEffect(() => {
  if (currency !== 'MMK') {
    const rate = await getDefaultExchangeRate(currency);
    if (rate) {
      setExchangeRate(rate);
      setFieldNote(`Using latest ${currency} rate from ${formatDate(lastTxDate)}`);
    } else {
      setFieldError("No recent exchange rate found. Please enter manually.");
    }
  }
}, [currency]);
```

**Phase 3: Database constraint**
```sql
-- Add check constraint to inventory_transactions
ALTER TABLE inventory_transactions
ADD CONSTRAINT check_exchange_rate_with_currency
CHECK (
  (currency = 'MMK' AND exchange_rate = 1.0000) OR
  (currency != 'MMK' AND exchange_rate != 1.0000 AND exchange_rate IS NOT NULL)
);
```

**Phase 4: Anomaly detection**
```sql
-- Daily cron job to detect suspicious WAC changes
CREATE OR REPLACE FUNCTION detect_wac_anomalies()
RETURNS TABLE(item_id UUID, item_name TEXT, old_wac DECIMAL, new_wac DECIMAL, change_pct DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.name,
    al.old_values->>'wac_amount' as old_wac,
    al.new_values->>'wac_amount' as new_wac,
    ROUND((
      (al.new_values->>'wac_amount')::DECIMAL -
      (al.old_values->>'wac_amount')::DECIMAL
    ) / (al.old_values->>'wac_amount')::DECIMAL * 100, 2) as change_pct
  FROM audit_logs al
  JOIN items i ON i.id = al.entity_id
  WHERE al.entity_type = 'items'
    AND al.field_name = 'wac_amount'
    AND al.changed_at > NOW() - INTERVAL '24 hours'
    AND ABS((
      (al.new_values->>'wac_amount')::DECIMAL -
      (al.old_values->>'wac_amount')::DECIMAL
    ) / (al.old_values->>'wac_amount')::DECIMAL) > 5.0; -- 500% change
END;
$$ LANGUAGE plpgsql;
```

**Detection:**
- WAC changes by >500% in single transaction (see Pitfall 3 warning)
- Item cost suddenly in different order of magnitude
- User submits support ticket: "Why is this item so expensive?"
- Monthly reconciliation: WAC doesn't match purchase history

**Phase recommendation:** Phase 2 (Stock-in Form) - Add validation immediately

**Sources:**
- [Common Issues with Currency and Exchange rate](https://help.sap.com/docs/SUPPORT_CONTENT/erphcm/3354687756.html)
- [Multicurrency Management - Dynamics GP](https://learn.microsoft.com/en-us/dynamics-gp/financials/multicurrencymanagement)

---

## Minor Pitfalls

Mistakes that cause annoyance or UX issues but are easily fixable.

### Pitfall 9: Warehouse Dashboard Shows Items with Zero Stock

**What goes wrong:** Dashboard lists 500 items per warehouse, but only 50 have actual stock. Users scroll through long list of "Current Stock: 0" rows. "Why show items we don't have?"

**Why it happens:**
- `warehouse_inventory` view uses `CROSS JOIN items` (all items × all warehouses)
- HAVING clause filters `current_stock > 0`, but some items have `current_stock = 0.00` exactly
- UI doesn't filter zero-stock items
- Product requirement unclear: "Show all items or only stocked items?"

**Prevention:**
- Update view HAVING clause: `HAVING COALESCE(SUM(...), 0) > 0.001` (account for rounding)
- Add UI toggle: "Show zero-stock items" checkbox (default: off)
- Add filter: "Only show items with recent activity (last 90 days)"

**Phase recommendation:** Phase 2 (Dashboard UI) - Add filter controls

---

### Pitfall 10: PO Status Doesn't Update Until Page Refresh

**What goes wrong:** Finance user voids invoice, sees success toast, clicks back to PO detail page. PO still shows "awaiting_delivery" status. User refreshes page manually → status updates to "partially_invoiced."

**Why it happens:**
- Void action updates invoice but doesn't refetch PO data
- Server Action completes but doesn't return updated PO status
- Client-side React state not invalidated
- Page uses static data fetched at initial load

**Prevention:**
```typescript
// In void invoice Server Action
'use server'
async function voidInvoice(invoiceId: string, poId: string) {
  await supabase.from('invoices').update({ is_voided: true }).eq('id', invoiceId);

  // Refetch updated PO status
  const { data: updatedPO } = await supabase
    .from('purchase_orders')
    .select('*, status')
    .eq('id', poId)
    .single();

  revalidatePath(`/po/${poId}`);

  return { success: true, updatedStatus: updatedPO.status };
}

// In client component
const handleVoid = async () => {
  const result = await voidInvoice(invoiceId, poId);
  toast.success(`Invoice voided. PO status: ${result.updatedStatus}`);
  router.refresh(); // Force page refresh
};
```

**Phase recommendation:** Phase 3 (Polish) - Add refetch logic to mutations

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1: Database Schema | WAC Trigger | Pitfall 1: Trigger recursion | Design trigger call graph, add `pg_trigger_depth()` checks |
| Phase 1: Database Schema | Invoice Void | Pitfall 4: PO status cascade | Add trigger to recalculate PO status on void |
| Phase 1: Database Schema | Indexing | Pitfall 2: Full-history recalc | Add compound indexes BEFORE go-live |
| Phase 2: Dashboard UI | Aggregation Queries | Pitfall 5: N+1 queries | Write single aggregation query first, then build UI |
| Phase 2: Dashboard UI | Stock-in Form | Pitfall 8: Missing exchange rate | Add validation schema with currency/rate rules |
| Phase 2: Dashboard UI | Cache Strategy | Pitfall 7: Stale data | Configure `revalidate` or `dynamic` at page level |
| Phase 3: Testing | Negative Stock | Pitfall 3: WAC breaks | Test backdated transactions, concurrent stock-outs |
| Phase 3: Testing | Invoice Void Cascade | Pitfall 4: Cascade failure | Test void → PO status → Balance in Hand → QMHQ status full chain |
| Phase 4: Optimization | Multi-Currency Rounding | Pitfall 6: Compound errors | Add periodic reconciliation job |
| Phase 4: Optimization | Long-Running Recalc | Pitfall 2: Timeout | Implement background job queue for large items |

---

## Testing Checklist

Before shipping each phase:

**Phase 1: Database**
- [ ] Create item with 1000+ transactions, time WAC recalculation (should be <100ms)
- [ ] Trigger recursive scenario: stock-in → WAC update → audit log → verify no deadlock
- [ ] Create backdated transaction, verify stock doesn't go negative
- [ ] Void invoice, verify PO status updates immediately
- [ ] Check `EXPLAIN ANALYZE` for all dashboard queries (no Seq Scan on large tables)

**Phase 2: Dashboard**
- [ ] Load warehouse with 100+ items, verify <2 second load time
- [ ] Void invoice in one tab, refresh dashboard in another tab, verify WAC updates
- [ ] Create manual stock-in with USD currency and exchange_rate = 1.0, verify form rejects
- [ ] Load warehouse dashboard with 50 warehouses, verify <3 seconds (N+1 test)

**Phase 3: Integration**
- [ ] Void invoice → verify: audit log created, PO status changed, Balance in Hand updated, WAC recalculated
- [ ] Concurrent test: 10 users create stock-outs for same item simultaneously, verify no negative stock
- [ ] Backdate test: Create stock-in dated 2024-01-01, verify doesn't corrupt current WAC

**Phase 4: Production Readiness**
- [ ] Run `audit_wac_accuracy()`, verify all items <1% error
- [ ] Simulate invoice void during dashboard load, verify no user-facing errors
- [ ] Check pg_stat_activity during peak load, verify no long-running locks
- [ ] Monitor trigger execution time: enable `auto_explain.log_triggers`, verify <100ms

---

## Confidence Assessment

| Pitfall Category | Confidence | Source Quality |
|------------------|-----------|----------------|
| Trigger Recursion | HIGH | Official PostgreSQL docs + 2026 production guides |
| Full-History Recalc | HIGH | ERP system documentation + performance benchmarks |
| Negative Stock | MEDIUM | Inventory system blogs + forum discussions |
| Cascade Failure | HIGH | Microsoft Dynamics 365 official docs |
| N+1 Queries | HIGH | PlanetScale blog + performance monitoring tools |
| Rounding Errors | MEDIUM | Multi-currency accounting forums + ERP docs |
| Stale Cache | HIGH | Next.js documentation + production patterns |
| Exchange Rate Validation | MEDIUM | ERP system guides + accounting standards |
| UI/UX Issues | LOW | General UX patterns, not domain-specific |

---

## Open Questions

**Needs investigation during implementation:**

1. **Trigger execution order:** When invoice void fires multiple triggers (audit + WAC + PO status), what is guaranteed execution order in PostgreSQL? Can we rely on trigger names for ordering?

2. **Materialized view refresh performance:** How long does `REFRESH MATERIALIZED VIEW CONCURRENTLY` take with 10,000 items × 20 warehouses? Is it safe to call on every transaction or should it be pg_cron scheduled?

3. **Real-time vs polling:** For dashboard updates, is Supabase real-time subscription (WebSocket) more efficient than 60-second polling for this use case?

4. **WAC precision requirements:** Does accounting standard require specific decimal precision for inventory valuation? Should we use DECIMAL(20,6) or higher?

5. **Audit log growth:** With triggers on inventory_transactions firing on every stock-in/out, how fast does audit_logs table grow? Need partitioning strategy?

---

## Summary

The most critical pitfalls when adding inventory dashboard, WAC display, and cascade recalculation to existing QM System:

1. **Trigger recursion** (Critical) - Design trigger call graph before implementation, use `pg_trigger_depth()` guards
2. **Full-history recalculation** (Critical) - Add proper indexes, consider incremental updates instead
3. **Negative stock breaking WAC** (Critical) - Validate stock-out quantities including pending transactions
4. **Invoice void cascade** (Critical) - Ensure PO status recalculates when invoices voided
5. **N+1 queries** (Moderate) - Use materialized views or single aggregation queries
6. **Multi-currency rounding** (Moderate) - Store high-precision intermediate values
7. **Stale dashboard data** (Moderate) - Configure appropriate Next.js cache strategies
8. **Missing exchange rate** (Moderate) - Validate foreign currency transactions require rate ≠ 1.0

**Key principle:** Integration with existing system means testing CASCADE effects across ALL related tables (invoice → PO → QMHQ → Balance in Hand → Financial reports).

---

**Research confidence:** HIGH for database/trigger pitfalls, MEDIUM for UI/caching issues

**Research complete:** 2026-01-28
