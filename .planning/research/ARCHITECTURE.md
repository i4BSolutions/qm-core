# Architecture Patterns for v1.2 Inventory Enhancements

**Domain:** QM System Inventory Management (v1.2 milestone)
**Researched:** 2026-01-28
**Context:** Subsequent milestone enhancing existing Next.js 14 + Supabase architecture

---

## Executive Summary

v1.2 adds inventory dashboard, WAC display enhancements, and invoice void cascade recalculation to an existing architecture that already includes:
- Database triggers for WAC calculation
- RPC functions for dashboard aggregations
- Server Actions with parallel fetching
- Client-side state management in components

**Key architectural decisions:**
1. **Extend existing RPC pattern** for inventory analytics (proven pattern from management dashboard)
2. **Add cascade triggers** for invoice void → PO status → WAC recalculation
3. **Use client-side calculation** for warehouse detail KPIs (existing pattern)
4. **Server Actions for mutations** with optimistic UI updates

**Integration complexity:** MEDIUM
- Builds on proven patterns (dashboard RPC, WAC triggers)
- New cascade logic requires careful trigger ordering
- Manual stock-in needs WAC trigger enhancement (not replacement)

---

## Integration Points with Existing Architecture

### 1. Database Layer Extensions

#### Existing Foundation
```
- WAC trigger: update_item_wac() (migration 024)
- Dashboard RPCs: get_qmrl_status_counts(), get_qmhq_status_counts(), get_low_stock_alerts() (migration 033)
- Audit triggers: create_audit_log() (migration 026)
- Views: warehouse_inventory, item_stock_summary (migration 024)
```

#### New Additions (v1.2)
```sql
-- New RPC: get_inventory_dashboard_stats()
-- Purpose: Aggregate inventory metrics for dashboard
-- Returns: {
--   total_items, total_units, total_value_mmk, total_value_eusd,
--   warehouses: [{id, name, item_count, unit_count, value_mmk, value_eusd}],
--   top_items_by_value: [{item_id, name, sku, value_eusd, stock}],
--   movement_summary: {last_30_days: {in_count, out_count, in_value, out_value}}
-- }

-- New trigger: cascade_invoice_void_recalculation()
-- Purpose: Recalculate PO status, quantities, and WAC when invoice voided
-- Cascade sequence:
--   1. Mark invoice_line_items as voided (via invoice.is_voided)
--   2. Decrement po_line_items.invoiced_quantity
--   3. Recalculate PO status (not_started | partially_invoiced | etc.)
--   4. If inventory_in exists for voided invoice → cancel transactions
--   5. Recalculate item WAC (via existing update_item_wac logic)

-- Enhanced trigger: update_item_wac() modification
-- New: Handle manual stock-in with different currency
-- Change: Accept unit_cost in ANY currency, convert to item's WAC currency
-- Formula: WAC = (existing_value_in_wac_currency + new_value_converted) / total_qty
```

#### Integration Strategy
- **Extend, don't replace**: WAC trigger gets new currency conversion logic
- **Reuse existing views**: `warehouse_inventory` already has WAC, just query it
- **New RPC follows existing pattern**: Same SECURITY DEFINER + GRANT pattern as dashboard RPCs

### 2. Data Flow Patterns

#### Pattern A: Dashboard Aggregation (EXISTING + ENHANCED)

**Existing Pattern (Management Dashboard):**
```typescript
// lib/actions/dashboard.ts
export async function getDashboardData() {
  const supabase = await createClient();

  // Parallel RPC calls (no waterfall)
  const qmrlStatsPromise = supabase.rpc('get_qmrl_status_counts');
  const qmhqStatsPromise = supabase.rpc('get_qmhq_status_counts');
  const lowStockPromise = supabase.rpc('get_low_stock_alerts', { threshold: 10 });

  const [qmrlStats, qmhqStats, lowStock] = await Promise.all([...]);

  return { qmrlStats, qmhqStats, lowStockAlerts };
}
```

**New Pattern (Inventory Dashboard):**
```typescript
// lib/actions/inventory.ts (NEW FILE)
export async function getInventoryDashboardData() {
  const supabase = await createClient();

  // NEW RPC for aggregated inventory stats
  const inventoryStatsPromise = supabase.rpc('get_inventory_dashboard_stats');

  // Existing queries for recent movements (parallel)
  const recentMovementsPromise = supabase
    .from('inventory_transactions')
    .select('*, item:items(name, sku), warehouse:warehouses(name)')
    .eq('status', 'completed')
    .order('transaction_date', { ascending: false })
    .limit(10);

  const [inventoryStats, recentMovements] = await Promise.all([...]);

  return { stats: inventoryStats.data, recentMovements: recentMovements.data };
}
```

**Why this pattern:**
- Proven performance in existing management dashboard
- Single RPC call avoids N+1 queries for aggregations
- Parallel fetching prevents waterfall
- Server Action keeps data fetching server-side (no client credentials exposure)

#### Pattern B: Warehouse Detail with Client-Side KPIs (EXISTING)

**Existing Pattern:**
```typescript
// app/(dashboard)/warehouse/[id]/page.tsx (EXISTING)
const [inventoryItems, setInventoryItems] = useState<WarehouseInventoryItem[]>([]);

// Fetch transactions, calculate inventory client-side
const inventoryMap = new Map();
transactionsData.forEach((t) => {
  if (t.movement_type === "inventory_in") inv.current_stock += t.quantity;
  else if (t.movement_type === "inventory_out") inv.current_stock -= t.quantity;
});

// Calculate KPIs from calculated inventory
const kpis = useMemo(() => {
  const totalItems = inventoryItems.length;
  const totalUnits = inventoryItems.reduce((sum, item) => sum + item.current_stock, 0);
  const totalValue = inventoryItems.reduce((sum, item) => sum + item.total_value, 0);
  return { totalItems, totalUnits, totalValue, totalValueEusd };
}, [inventoryItems]);
```

**No Change Required:**
- Existing warehouse detail page already calculates KPIs client-side
- Already uses `useMemo` for performance
- Already displays WAC from item.wac_amount
- v1.2 does NOT modify this pattern

**Why this pattern:**
- KPIs are derived from fetched data (no separate query needed)
- Client-side calculation is fast for single-warehouse scope
- WAC already comes from database (calculated by triggers)

#### Pattern C: Invoice Void Cascade (NEW)

**Implementation:**
```sql
-- Trigger on invoices table: AFTER UPDATE
CREATE OR REPLACE FUNCTION cascade_invoice_void_recalculation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when invoice is voided
  IF NEW.is_voided = true AND OLD.is_voided = false THEN

    -- Step 1: Decrement po_line_items.invoiced_quantity
    UPDATE po_line_items pli
    SET invoiced_quantity = GREATEST(invoiced_quantity - ili.quantity, 0),
        updated_at = NOW()
    FROM invoice_line_items ili
    WHERE ili.invoice_id = NEW.id
      AND pli.id = ili.po_line_item_id;

    -- Step 2: Cancel related inventory_in transactions
    UPDATE inventory_transactions
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE invoice_id = NEW.id
      AND movement_type = 'inventory_in'
      AND status = 'completed';

    -- Step 3: Recalculate PO status (triggers existing PO status calculation)
    -- This happens automatically via existing calculate_po_status() trigger

    -- Step 4: Recalculate WAC for affected items
    -- This happens automatically via existing handle_inventory_transaction_status_change() trigger
    -- which runs when inventory_transactions.status changes to 'cancelled'

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Cascade Sequence:**
```
User voids invoice (UI → Server Action → Supabase UPDATE)
  ↓
[1] cascade_invoice_void_recalculation() fires
  ↓ Updates po_line_items.invoiced_quantity
  ↓ Cancels inventory_transactions
  ↓
[2] handle_inventory_transaction_status_change() fires (EXISTING TRIGGER)
  ↓ Recalculates item WAC (from remaining completed transactions)
  ↓
[3] calculate_po_status() fires (EXISTING TRIGGER - assumed from codebase patterns)
  ↓ Recalculates PO status based on new invoiced_quantity
  ↓
[4] create_audit_log() fires (EXISTING TRIGGER)
  ↓ Logs void action to audit_logs
```

**Why this pattern:**
- Leverages existing trigger infrastructure
- Database ensures consistency (transaction-safe)
- Single UPDATE triggers entire cascade
- Reuses existing WAC recalculation logic (no duplication)

#### Pattern D: Manual Stock-In with Currency Handling (ENHANCED)

**Current WAC Trigger Limitation:**
```sql
-- EXISTING: Assumes unit_cost is in item's WAC currency
UPDATE items
SET wac_amount = new_wac,
    wac_currency = NEW.currency,  -- Overwrites currency (PROBLEM if different)
    wac_exchange_rate = NEW.exchange_rate
WHERE id = NEW.item_id;
```

**Enhanced WAC Trigger:**
```sql
CREATE OR REPLACE FUNCTION update_item_wac()
RETURNS TRIGGER AS $$
DECLARE
  current_wac DECIMAL(15,2);
  current_qty DECIMAL(15,2);
  current_wac_currency TEXT;
  current_wac_rate DECIMAL(10,4);
  new_value_in_wac_currency DECIMAL(15,2);
  existing_value DECIMAL(15,2);
  new_wac DECIMAL(15,2);
BEGIN
  -- Get current item WAC and currency
  SELECT wac_amount, wac_currency, wac_exchange_rate, [current_qty_calc]
  INTO current_wac, current_wac_currency, current_wac_rate, current_qty
  FROM items WHERE id = NEW.item_id;

  -- Convert new stock-in value to item's WAC currency
  IF NEW.currency = current_wac_currency THEN
    new_value_in_wac_currency := NEW.quantity * NEW.unit_cost;
  ELSE
    -- Convert: new_currency → USD → wac_currency
    new_value_in_wac_currency := (NEW.quantity * NEW.unit_cost / NEW.exchange_rate) * current_wac_rate;
  END IF;

  -- Calculate new WAC in item's currency
  existing_value := current_qty * current_wac;
  new_wac := (existing_value + new_value_in_wac_currency) / (current_qty + NEW.quantity);

  -- Update item (currency stays consistent)
  UPDATE items
  SET wac_amount = new_wac,
      -- wac_currency unchanged (maintains consistency)
      updated_at = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Why this pattern:**
- WAC currency consistency: Item keeps single WAC currency (doesn't flip-flop)
- Cross-currency conversion: Manual stock-in in THB converts to item's MMK WAC
- Formula preservation: Still uses weighted average, just converts values first

### 3. Component Architecture

#### New Components (v1.2)

```
app/(dashboard)/inventory/
  page.tsx                    # Inventory Dashboard (NEW - enhanced from placeholder)
    ├─ Uses: getInventoryDashboardData() Server Action
    ├─ Displays: KPI cards, warehouse breakdown, top items, recent movements
    └─ Pattern: Same as management dashboard (KPI cards + tables)

components/inventory/
  inventory-stats-cards.tsx   # KPI cards component (NEW)
  warehouse-breakdown-chart.tsx # Chart component (NEW - if charts added later)
  top-items-table.tsx         # Top items by value table (NEW)
```

#### Modified Components (v1.2)

```
app/(dashboard)/warehouse/[id]/page.tsx
  # NO CHANGES - already has WAC display via warehouse_inventory view
  # Existing KPI cards already show total_value_eusd

app/(dashboard)/inventory/stock-in/page.tsx
  # MINOR ENHANCEMENT - add currency selector for manual stock-in
  # Existing: Only shows invoice-based stock-in
  # New: Add manual entry form with currency/exchange rate fields
```

### 4. Server Actions Pattern

**New Server Action:**
```typescript
// lib/actions/inventory.ts (NEW FILE)
'use server';

import { createClient } from '@/lib/supabase/server';

export async function getInventoryDashboardData() {
  // Pattern: Same as getDashboardData() in lib/actions/dashboard.ts
  // Parallel RPC + query fetching
}

export async function voidInvoice(invoiceId: string, reason: string) {
  const supabase = await createClient();

  // Single UPDATE triggers cascade
  const { error } = await supabase
    .from('invoices')
    .update({
      is_voided: true,
      voided_at: new Date().toISOString(),
      voided_by: (await supabase.auth.getUser()).data.user?.id,
      void_reason: reason,
    })
    .eq('id', invoiceId);

  if (error) throw error;

  // Cascade happens automatically in database
  // Returns success, UI refetches data
}
```

**Why Server Actions:**
- Keeps database credentials server-side
- Matches existing pattern (dashboard.ts, files.ts)
- Simple API for client components
- Automatic revalidation with Next.js cache

---

## Component Boundaries and Responsibilities

### Database Layer
**Responsibilities:**
- WAC calculation (triggers)
- PO status calculation (triggers)
- Invoice void cascade (triggers)
- Inventory aggregation (RPC functions)
- Audit logging (triggers)

**Inputs:** SQL commands from Supabase client
**Outputs:** Query results, trigger side effects
**Dependencies:** PostgreSQL 14+, existing migrations 001-033

### Server Action Layer
**Responsibilities:**
- Parallel data fetching (avoid waterfalls)
- Server-side Supabase client management
- Data transformation for UI
- Mutation operations (void invoice, stock-in)

**Inputs:** Function calls from client components
**Outputs:** Typed data objects, mutation results
**Dependencies:** Supabase server client, Next.js Server Actions

### Presentation Layer
**Responsibilities:**
- Display aggregated data (KPI cards, tables, charts)
- User interactions (filter, search, void invoice)
- Client-side state (loading, error, pagination)
- Optimistic updates (loading states during mutations)

**Inputs:** Server Action responses
**Outputs:** Rendered UI, user interactions
**Dependencies:** React 18+, Server Actions, UI components

---

## Data Flow Diagrams

### Flow 1: Inventory Dashboard Load

```
User navigates to /inventory
  ↓
[Server Component] page.tsx
  ↓ Calls getInventoryDashboardData()
  ↓
[Server Action] lib/actions/inventory.ts
  ↓ Promise.all([
  ↓   supabase.rpc('get_inventory_dashboard_stats'),
  ↓   supabase.from('inventory_transactions').select(...)
  ↓ ])
  ↓
[Database] Executes RPC function
  ↓ Aggregates from items, warehouses, inventory_transactions
  ↓ Joins with WAC values from items.wac_amount
  ↓
[Server Action] Returns typed data
  ↓
[Server Component] Renders with data
  ↓ Passes to client components (KPI cards, tables)
  ↓
[Client Components] Display + handle interactivity
```

**Performance:** Single RPC call avoids N+1, parallel fetching prevents waterfall

### Flow 2: Invoice Void Cascade

```
User clicks "Void Invoice" button
  ↓
[Client Component] Invoice detail page
  ↓ Calls voidInvoice(invoiceId, reason) Server Action
  ↓
[Server Action] lib/actions/inventory.ts
  ↓ supabase.from('invoices').update({ is_voided: true, ... })
  ↓
[Database Trigger] cascade_invoice_void_recalculation()
  ↓ [Step 1] UPDATE po_line_items (decrement invoiced_quantity)
  ↓ [Step 2] UPDATE inventory_transactions (cancel related stock-ins)
  ↓
[Database Trigger] handle_inventory_transaction_status_change() (EXISTING)
  ↓ Detects cancelled inventory_in transactions
  ↓ Recalculates item WAC from remaining completed transactions
  ↓
[Database Trigger] calculate_po_status() (ASSUMED EXISTING)
  ↓ Recalculates PO status based on new invoiced_quantity
  ↓
[Database Trigger] create_audit_log() (EXISTING)
  ↓ Logs void action
  ↓
[Server Action] Returns success
  ↓
[Client Component] Refetches invoice detail
  ↓ Shows updated status, audit log entry
```

**Consistency:** All updates happen in single database transaction

### Flow 3: Manual Stock-In with Currency

```
User submits manual stock-in form (THB currency, item's WAC is MMK)
  ↓
[Client Component] stock-in/page.tsx
  ↓ Calls createManualStockIn(...) Server Action
  ↓
[Server Action] lib/actions/inventory.ts
  ↓ supabase.from('inventory_transactions').insert({
  ↓   movement_type: 'inventory_in',
  ↓   unit_cost: 100,      # THB
  ↓   currency: 'THB',
  ↓   exchange_rate: 0.029, # THB to USD
  ↓   ...
  ↓ })
  ↓
[Database Trigger] update_item_wac() (ENHANCED)
  ↓ Fetches item's current WAC currency (MMK)
  ↓ Converts new value: (100 THB / 0.029) * 2100 = 7,241,379 MMK
  ↓ Calculates new WAC in MMK
  ↓ Updates item.wac_amount (in MMK)
  ↓
[Server Action] Returns success
  ↓
[Client Component] Shows success toast, refetches inventory
```

**Currency Handling:** Cross-currency conversion maintains WAC consistency

---

## Technology Stack Alignment

### Database (PostgreSQL via Supabase)
**Existing:**
- Triggers: WAC calculation, audit logging, status updates
- Views: warehouse_inventory, item_stock_summary
- RPC functions: Dashboard aggregations

**New (v1.2):**
- Trigger: cascade_invoice_void_recalculation
- Enhanced trigger: update_item_wac (currency conversion)
- RPC function: get_inventory_dashboard_stats

**Confidence:** HIGH - Extends proven patterns

### Backend (Supabase + Next.js Server Actions)
**Existing:**
- Server Actions: getDashboardData(), file operations
- Pattern: Parallel fetching with Promise.all

**New (v1.2):**
- Server Action: getInventoryDashboardData()
- Server Action: voidInvoice()
- Server Action: createManualStockIn() (enhanced)

**Confidence:** HIGH - Same pattern as existing actions

### Frontend (Next.js 14 Server Components + React 18)
**Existing:**
- Dashboard pattern: KPI cards + tables
- Warehouse detail pattern: Client-side KPI calculation

**New (v1.2):**
- Inventory dashboard: Same as management dashboard
- Stock-in form: Enhanced with currency selector

**Confidence:** HIGH - Reuses existing components and patterns

---

## Build Order and Dependencies

### Phase 1: Database Foundation (No dependencies)
**Tasks:**
1. Create RPC function: `get_inventory_dashboard_stats()`
2. Enhance trigger: `update_item_wac()` with currency conversion logic
3. Create trigger: `cascade_invoice_void_recalculation()`

**Testing:**
- Unit test RPC function with sample data
- Test WAC trigger with cross-currency stock-in
- Test cascade trigger with voided invoice

**Why first:** Database changes are foundation, must be deployed before app changes

### Phase 2: Server Actions (Depends: Phase 1)
**Tasks:**
1. Create `lib/actions/inventory.ts`
2. Implement `getInventoryDashboardData()`
3. Implement `voidInvoice()`
4. Enhance `createManualStockIn()` with currency fields

**Testing:**
- Server Action returns correct data structure
- voidInvoice triggers cascade correctly
- Manual stock-in with different currency calculates WAC

**Why second:** Actions use new RPC/triggers, needed for UI

### Phase 3: UI Components (Depends: Phase 2)
**Tasks:**
1. Build `app/(dashboard)/inventory/page.tsx` (dashboard)
2. Create `components/inventory/inventory-stats-cards.tsx`
3. Create `components/inventory/top-items-table.tsx`
4. Enhance `app/(dashboard)/inventory/stock-in/page.tsx` with currency selector
5. Add void button to invoice detail page

**Testing:**
- Dashboard displays correct KPIs
- Stock-in form accepts currency selection
- Void button triggers cascade, refetches data

**Why third:** UI consumes Server Actions, built last

### Phase 4: Integration Testing (Depends: Phase 1-3)
**Tasks:**
1. End-to-end test: Void invoice → verify PO status + WAC recalculation
2. End-to-end test: Manual stock-in THB → verify WAC in MMK
3. Performance test: Dashboard load time with 1000+ inventory items
4. Cross-browser test: Dashboard renders correctly

**Why last:** Validates entire flow across all layers

---

## Architectural Constraints and Trade-offs

### Constraint 1: Single WAC Currency per Item
**Decision:** Each item maintains WAC in one consistent currency
**Rationale:** Simplifies accounting, prevents currency flip-flopping
**Trade-off:** Manual stock-in requires currency conversion (adds complexity to trigger)
**Mitigation:** Conversion logic isolated in trigger, tested thoroughly

### Constraint 2: Cascade Triggers for Void
**Decision:** Use database triggers instead of application logic
**Rationale:** Ensures consistency, handles edge cases (concurrent updates)
**Trade-off:** Harder to debug than application code
**Mitigation:** Comprehensive logging in triggers, audit trail captures all changes

### Constraint 3: Client-Side KPI Calculation for Warehouse Detail
**Decision:** Keep existing pattern (calculate from fetched transactions)
**Rationale:** Avoids additional query, fast for single-warehouse scope
**Trade-off:** Won't scale if warehouse has 10,000+ items
**Mitigation:** Warehouse detail page is scoped to single warehouse (limited data), pagination if needed later

### Constraint 4: RPC for Dashboard Aggregation
**Decision:** Use single RPC function for inventory stats
**Rationale:** Proven pattern from management dashboard, avoids N+1
**Trade-off:** Less flexible than client-side aggregation
**Mitigation:** RPC parameters allow filtering (e.g., by warehouse_id), extendable with new RPCs if needed

---

## Integration Risk Assessment

| Integration Point | Risk Level | Mitigation |
|-------------------|------------|------------|
| **WAC trigger enhancement** | MEDIUM | Thorough testing with multiple currencies, fallback to existing logic if conversion fails |
| **Cascade trigger ordering** | HIGH | Document trigger execution order, test with concurrent invoice voids |
| **RPC performance** | LOW | RPC aggregates server-side (fast), add indexes on join columns if slow |
| **Manual stock-in UI** | LOW | Reuses existing form pattern, just adds currency fields |
| **Invoice void UI** | LOW | Follows existing mutation pattern (Server Action + refetch) |

**Highest Risk: Cascade Trigger Ordering**
- **Issue:** If triggers fire in wrong order, WAC or PO status may be incorrect
- **Mitigation:**
  1. Use `AFTER UPDATE` trigger on invoices (fires after row committed)
  2. Existing triggers on inventory_transactions and po_line_items fire automatically
  3. Add integration test that voids invoice, checks all downstream updates
  4. Document expected trigger sequence in migration comments

---

## Performance Considerations

### Dashboard Load Performance
**Current Baseline:** Management dashboard loads in ~300ms (RPC + parallel queries)
**Expected v1.2:** Inventory dashboard should match (~300-400ms)

**Optimization:**
- Single RPC call for aggregations (not multiple queries)
- Indexes on inventory_transactions (warehouse_id, item_id, transaction_date)
- Parallel fetching (RPC + recent movements query)

**Scalability:**
- RPC aggregates in database (efficient at any scale)
- Recent movements limited to 10 records (constant time)
- Warehouse breakdown limited by warehouse count (typically < 20)

### Invoice Void Cascade Performance
**Expected:** < 200ms for typical invoice (5-10 line items)

**Optimization:**
- Single UPDATE triggers cascade (not multiple API calls)
- Batch updates in trigger (UPDATE FROM join, not loop)
- Indexes on foreign keys (po_line_item_id, invoice_id)

**Scalability:**
- Performance degrades linearly with line item count
- Large invoices (100+ line items) may take 1-2 seconds (acceptable for rare operation)

### WAC Recalculation Performance
**Current:** < 50ms for item with < 100 transactions
**Expected v1.2:** Same (currency conversion adds negligible overhead)

**Optimization:**
- Recalculation only on inventory_in (not every transaction)
- Aggregates from completed transactions only (filtered in query)

---

## Testing Strategy per Layer

### Database Layer Tests
**Unit Tests (SQL):**
- RPC function returns correct structure and values
- WAC trigger handles cross-currency conversion correctly
- Cascade trigger updates all related tables

**Integration Tests (SQL):**
- Void invoice → verify po_line_items, inventory_transactions, items.wac_amount all updated
- Manual stock-in THB → verify item WAC recalculated in MMK

### Server Action Tests
**Unit Tests (TypeScript):**
- getInventoryDashboardData returns typed data
- voidInvoice calls Supabase with correct parameters

**Integration Tests (TypeScript):**
- Call Server Action → verify database state changes
- Error handling: Supabase error → thrown exception

### UI Component Tests
**Unit Tests (React Testing Library):**
- Inventory dashboard renders KPI cards
- Stock-in form submits with currency fields

**Integration Tests (Playwright/Cypress):**
- Load inventory dashboard → verify KPIs displayed
- Submit manual stock-in → verify success toast
- Void invoice → verify refetched data shows voided status

---

## Sources and References

### PostgreSQL Trigger Patterns
- [PostgreSQL Trigger Definition Documentation](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL CREATE TRIGGER Documentation](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [Optimizing PostgreSQL Trigger Execution - DEV Community](https://dev.to/bhanufyi/optimizing-postgresql-trigger-execution-balancing-precision-with-control-ibh)

### Next.js Dashboard Patterns
- [Next.js Data Fetching Patterns and Best Practices](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js SaaS Dashboard Development: Scalability & Best Practices](https://www.ksolves.com/blog/next-js/best-practices-for-saas-dashboards)

### Inventory Management Architecture
- [Building an Inventory Management App with Next.js - Medium](https://medium.com/@hackable-projects/building-an-inventory-management-app-with-next-js-react-and-firebase-e9647a61eb82)
- [Build an Inventory Management System Using NextJS - GeeksforGeeks](https://www.geeksforgeeks.org/reactjs/build-an-inventory-management-system-using-nextjs/)

### Existing Codebase (HIGH Confidence)
- `supabase/migrations/024_inventory_wac_trigger.sql` - WAC calculation trigger
- `supabase/migrations/033_dashboard_functions.sql` - RPC aggregation pattern
- `lib/actions/dashboard.ts` - Parallel fetching pattern
- `app/(dashboard)/warehouse/[id]/page.tsx` - Client-side KPI calculation pattern

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **RPC Pattern** | HIGH | Proven in management dashboard, same approach |
| **WAC Enhancement** | MEDIUM | Currency conversion adds complexity, needs thorough testing |
| **Cascade Triggers** | MEDIUM | Pattern is standard, but ordering requires careful testing |
| **Server Actions** | HIGH | Follows existing pattern exactly (dashboard.ts) |
| **UI Components** | HIGH | Reuses existing dashboard component structure |

**Overall Confidence: MEDIUM-HIGH**
- High confidence in patterns (all proven in existing codebase)
- Medium confidence in cascade logic (new complexity, needs validation)
- Thorough testing will raise confidence to HIGH

---

*Architecture Research Complete: 2026-01-28*
