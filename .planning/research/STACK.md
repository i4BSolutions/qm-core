# Technology Stack - v1.2 Inventory Enhancements

**Project:** QM System v1.2
**Focus:** Inventory dashboard, WAC display, cascade recalculation
**Researched:** 2026-01-28

---

## Executive Summary

v1.2 requires **zero new external dependencies**. The existing stack (Next.js 14, Supabase, TanStack Table, Tailwind CSS, Intl.NumberFormat) covers all requirements. This milestone focuses on database trigger optimization and component composition using validated libraries.

**Key finding:** Native `Intl.NumberFormat` API replaces the need for currency formatting libraries, Recharts is NOT needed (no charting requirements), and PostgreSQL triggers handle cascade recalculation natively.

---

## Validated Stack (No Changes Required)

### Core Framework
| Technology | Current Version | Purpose | Status |
|------------|-----------------|---------|--------|
| Next.js | 14.2.13 | App Router, SSR, server actions | **Sufficient** |
| React | 18.3.1 | Component framework | **Sufficient** |
| TypeScript | 5.6.2 | Type safety | **Sufficient** |

**Rationale:** App Router supports dashboard layouts, server components for data fetching, client components for KPI interactivity. No upgrade needed.

### Database & Backend
| Technology | Current Version | Purpose | Status |
|------------|-----------------|---------|--------|
| Supabase | @supabase/supabase-js ^2.50.0 | Database, auth, RPC functions | **Sufficient** |
| PostgreSQL | (via Supabase) | ACID transactions, triggers, views | **Sufficient** |

**Rationale:** Supabase RPC functions already built (`get_qmrl_status_counts`, `get_qmhq_status_counts`, `get_low_stock_alerts`). WAC trigger exists in `024_inventory_wac_trigger.sql`. Cascade recalculation uses native PostgreSQL AFTER UPDATE triggers.

### UI Components
| Technology | Current Version | Purpose | Status |
|------------|-----------------|---------|--------|
| Tailwind CSS | 3.4.13 | Styling with dark theme | **Sufficient** |
| Radix UI | Various (v1.x) | Headless UI primitives (Dialog, Tabs, etc.) | **Sufficient** |
| Lucide React | 0.447.0 | Icons | **Sufficient** |
| @tanstack/react-table | 8.21.3 | Headless table logic | **Sufficient** |

**Rationale:** Existing `Card` components, `DataTable` wrapper, and Radix Tabs handle dashboard layout. No charting library needed (requirements are KPI cards and tables, not graphs).

### Utilities
| Technology | Current Version | Purpose | Status |
|------------|-----------------|---------|--------|
| date-fns | 3.6.0 | Date formatting | **Sufficient** |
| Intl.NumberFormat | (native) | Currency/number formatting | **Sufficient** |
| zod | 3.23.8 | Schema validation | **Sufficient** |
| react-hook-form | 7.53.0 | Form handling | **Sufficient** |

**Rationale:** Existing `formatCurrency()` uses `Intl.NumberFormat` with 2-decimal precision. WAC requires 4-decimal exchange rates, which is a simple parameter change. No external library needed.

---

## What NOT to Add

### 1. Charting Libraries (Recharts, Chart.js, Visx)

**Why not:**
- v1.2 requirements specify KPI cards and tables, **not charts/graphs**
- Existing warehouse detail page (C:\Users\User\Documents\qm-core\app\(dashboard)\warehouse\[id]\page.tsx) uses KPI cards with numeric displays
- Management dashboard uses `KPICard` component (text + numbers, no visualization)
- Bundle bloat: Recharts 3.6.0 adds ~100KB gzipped

**When to reconsider:** If future milestones require trend graphs or time-series visualizations, Recharts is the recommended choice for React projects (simpler API than Visx, better React integration than Chart.js).

**Sources:**
- [Best React chart libraries (2025 update): Features, performance & use cases - LogRocket Blog](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [Top React Chart Libraries to Use in 2026 - Aglowid IT Solutions](https://aglowiditsolutions.com/blog/react-chart-libraries/)

### 2. Number Formatting Libraries (react-number-format, react-currency-format)

**Why not:**
- Native `Intl.NumberFormat` API handles all requirements (2-decimal amounts, 4-decimal exchange rates)
- Already in use: `formatCurrency()` in C:\Users\User\Documents\qm-core\lib\utils\index.ts
- Zero dependencies, smaller bundle, better TypeScript support
- Browser support is universal (IE11+ not a concern in 2026)

**Existing implementation:**
```typescript
export function formatCurrency(amount: number, decimals: number = 2): string {
  const multiplier = Math.pow(10, decimals);
  const rounded = Math.round(amount * multiplier) / multiplier;
  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
}
```

**For WAC with 4 decimals:** Simply call `formatCurrency(wacValue, 4)`.

**Sources:**
- [Simplify Currency Formatting in React: A Zero-Dependency Solution with Intl API - DEV Community](https://dev.to/josephciullo/simplify-currency-formatting-in-react-a-zero-dependency-solution-with-intl-api-3kok)
- [Intl.NumberFormat - JavaScript | MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)

### 3. Specialized Trigger Libraries

**Why not:**
- PostgreSQL native triggers (AFTER UPDATE, AFTER DELETE) handle cascade recalculation
- Supabase provides full PostgreSQL trigger support via migrations
- Existing WAC trigger in `024_inventory_wac_trigger.sql` demonstrates the pattern
- Statement-level triggers with transition tables handle batch updates efficiently

**Sources:**
- [Postgres Triggers | Supabase Docs](https://supabase.com/docs/guides/database/postgres/triggers)
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality – TheLinuxCode](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

---

## Integration Points with Existing Stack

### 1. Dashboard KPIs (Inventory Counts & Values)

**What:** Display total items, units, value at warehouse level
**How:** Extend existing pattern from C:\Users\User\Documents\qm-core\app\(dashboard)\warehouse\[id]\page.tsx

**Existing pattern (lines 176-182):**
```typescript
const kpis = useMemo(() => {
  const totalItems = inventoryItems.length;
  const totalUnits = inventoryItems.reduce((sum, item) => sum + item.current_stock, 0);
  const totalValue = inventoryItems.reduce((sum, item) => sum + item.total_value, 0);
  const totalValueEusd = inventoryItems.reduce((sum, item) => sum + item.total_value_eusd, 0);
  return { totalItems, totalUnits, totalValue, totalValueEusd };
}, [inventoryItems]);
```

**Integration:** Create similar aggregation for stock-in/out dashboard. No new libraries needed.

### 2. WAC Display with 4-Decimal Precision

**What:** Show WAC with exchange rate (4 decimals) and amount (2 decimals)
**How:** Extend existing `formatWAC()` utility from `lib/utils/inventory.ts`

**Current utilities:**
- `formatCurrency(amount, decimals)` - handles variable precision
- `formatWAC(amount, currency)` - formats WAC display

**Enhancement:** Add exchange rate parameter:
```typescript
export function formatWACWithRate(
  amount: number | null,
  currency: string | null,
  exchangeRate: number | null
): string {
  if (amount === null || amount === 0) return "—";
  const amountStr = formatCurrency(amount, 2);
  const rateStr = exchangeRate ? formatCurrency(exchangeRate, 4) : "—";
  return `${amountStr} ${currency || "MMK"} (Rate: ${rateStr})`;
}
```

**No external library required.** Uses existing `Intl.NumberFormat` via `formatCurrency()`.

### 3. Invoice Void → PO Status Recalculation

**What:** When invoice voided, recalculate PO `total_invoiced` and update smart status
**How:** PostgreSQL AFTER UPDATE trigger on `invoices.is_voided`

**Existing pattern:** `024_inventory_wac_trigger.sql` lines 111-164 show status change handling:
```sql
CREATE OR REPLACE FUNCTION handle_inventory_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'completed' THEN
    -- Recalculate WAC from all remaining completed transactions
    -- ...
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_transaction_status_change
  AFTER UPDATE OF status ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_inventory_transaction_status_change();
```

**For invoice void cascade:**
1. Create `handle_invoice_void_cascade()` function
2. AFTER UPDATE OF `is_voided` ON `invoices`
3. Recalculate affected PO's `total_invoiced` (SUM non-voided invoice line items)
4. Update PO smart status based on new totals

**Performance consideration:** For bulk voids, use statement-level triggers with transition tables:
```sql
CREATE TRIGGER invoice_void_cascade
  AFTER UPDATE OF is_voided ON invoices
  FOR EACH STATEMENT  -- Not per-row
  EXECUTE FUNCTION handle_invoice_void_cascade_batch();
```

**Sources:**
- [PostgreSQL AFTER UPDATE Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-after-update-trigger)
- [rules vs. trigger performance when logging bulk updates](https://www.cybertec-postgresql.com/en/rules-or-triggers-to-log-bulk-updates/)

### 4. Manual Stock-In with Currency/Exchange Rate

**What:** Stock-in form accepts currency (default MMK), exchange rate (default 1.0000), amount
**How:** Extend existing stock-in form, use existing `InventoryTransaction` schema

**Database schema (from `023_inventory_transactions.sql`):**
- `currency TEXT DEFAULT 'MMK'`
- `exchange_rate DECIMAL(10,4) DEFAULT 1.0000`
- `unit_cost DECIMAL(15,2)` - for WAC calculation

**Form inputs:**
- Currency: Select dropdown (MMK, USD, THB, etc.) - reuse existing pattern from financial transactions
- Exchange Rate: Number input with 4-decimal validation
- Unit Cost: Number input with 2-decimal validation

**Validation (Zod schema):**
```typescript
const stockInSchema = z.object({
  currency: z.string().default("MMK"),
  exchangeRate: z.number().min(0.0001).max(999999.9999),
  unitCost: z.number().min(0.01),
  // ... other fields
});
```

**No new libraries needed.** Uses existing `react-hook-form` + `zod` + `Intl.NumberFormat`.

---

## Database Strategy

### Cascade Recalculation Pattern

**Requirement:** Invoice void cascades to PO status recalculation

**PostgreSQL native approach:**

#### 1. Trigger Function (Statement-Level for Performance)
```sql
CREATE OR REPLACE FUNCTION recalculate_po_after_invoice_void()
RETURNS TRIGGER AS $$
DECLARE
  affected_po_id UUID;
BEGIN
  -- Get unique PO IDs affected by this statement
  FOR affected_po_id IN
    SELECT DISTINCT po_id
    FROM invoice_line_items ili
    JOIN invoices i ON i.id = ili.invoice_id
    WHERE i.id IN (SELECT id FROM new_table WHERE is_voided = true)
  LOOP
    -- Recalculate total_invoiced (exclude voided invoices)
    UPDATE purchase_orders
    SET total_invoiced = (
      SELECT COALESCE(SUM(ili.quantity), 0)
      FROM invoice_line_items ili
      JOIN invoices i ON i.id = ili.invoice_id
      WHERE ili.po_id = affected_po_id
        AND i.is_voided = false
        AND i.is_active = true
    )
    WHERE id = affected_po_id;

    -- Smart status will be recalculated by view/function
  END LOOP;

  RETURN NULL; -- Statement trigger returns null
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_void_cascade_recalculation
  AFTER UPDATE OF is_voided ON invoices
  REFERENCING NEW TABLE AS new_table OLD TABLE AS old_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION recalculate_po_after_invoice_void();
```

**Why statement-level:**
- Bulk void operations (voiding 100 invoices at once) execute trigger once, not 100 times
- Transition tables (`new_table`, `old_table`) provide access to all affected rows
- Performance is ~2x slower than no trigger, vs row-level which is ~13x slower

**Sources:**
- [PostgreSQL: Documentation: 18: 37.1. Overview of Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality – TheLinuxCode](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)

#### 2. Smart Status Calculation (View/Function)

Existing pattern from PRD: PO status calculated based on:
- `total_ordered` = SUM(po_line_items.quantity)
- `total_invoiced` = SUM(non-voided invoice line items)
- `total_received` = SUM(inventory_in transactions)

**Option A: Materialized View (faster reads)**
```sql
CREATE MATERIALIZED VIEW po_status_summary AS
SELECT
  po.id,
  po.total_ordered,
  po.total_invoiced,
  COALESCE(SUM(it.quantity), 0) as total_received,
  CASE
    WHEN po.total_invoiced = 0 AND total_received = 0 THEN 'not_started'
    WHEN po.total_invoiced < po.total_ordered THEN 'partially_invoiced'
    WHEN total_received = 0 THEN 'awaiting_delivery'
    WHEN total_received < po.total_ordered THEN 'partially_received'
    WHEN total_received = po.total_ordered THEN 'closed'
    ELSE 'not_started'
  END as calculated_status
FROM purchase_orders po
LEFT JOIN inventory_transactions it ON it.purchase_order_id = po.id
  AND it.movement_type = 'inventory_in'
  AND it.status = 'completed'
GROUP BY po.id, po.total_ordered, po.total_invoiced;

-- Refresh on invoice void
CREATE OR REPLACE FUNCTION refresh_po_status_on_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY po_status_summary;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**Option B: Database Function (simpler, no materialization)**
```sql
CREATE OR REPLACE FUNCTION get_po_smart_status(po_id UUID)
RETURNS TEXT AS $$
DECLARE
  ordered DECIMAL;
  invoiced DECIMAL;
  received DECIMAL;
BEGIN
  SELECT total_ordered, total_invoiced INTO ordered, invoiced
  FROM purchase_orders WHERE id = po_id;

  SELECT COALESCE(SUM(quantity), 0) INTO received
  FROM inventory_transactions
  WHERE purchase_order_id = po_id
    AND movement_type = 'inventory_in'
    AND status = 'completed';

  RETURN CASE
    WHEN invoiced = 0 AND received = 0 THEN 'not_started'
    WHEN invoiced < ordered THEN 'partially_invoiced'
    WHEN received = 0 THEN 'awaiting_delivery'
    WHEN received < ordered THEN 'partially_received'
    WHEN received = ordered THEN 'closed'
    ELSE 'not_started'
  END;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Recommendation:** Use Option B (function). Simpler, no refresh logic, status always current.

### WAC Recalculation (Already Implemented)

Existing trigger in `024_inventory_wac_trigger.sql` lines 4-83 handles:
- Insert of `inventory_in` with `unit_cost` → recalculate WAC
- Formula: `WAC = (existing_value + new_value) / (existing_qty + new_qty)`

**For cancellation:** Lines 111-164 handle status change to cancelled, recalculating WAC from remaining completed transactions.

**No changes needed.** Pattern is proven.

---

## Performance Considerations

### 1. Dashboard Aggregations

**Use Supabase RPC functions** (already implemented in `033_dashboard_functions.sql`):
- `get_qmrl_status_counts()` - server-side aggregation
- `get_qmhq_status_counts()` - server-side aggregation
- `get_low_stock_alerts(threshold)` - inventory alerts

**Why:** Aggregating 10,000 inventory transactions in JavaScript is slow. PostgreSQL aggregates in milliseconds.

**Pattern for inventory dashboard:**
```typescript
// Server action
export async function getInventoryDashboardData() {
  const supabase = createClient();

  const [stockIn, stockOut, lowStock] = await Promise.all([
    supabase.rpc('get_stock_in_summary'),
    supabase.rpc('get_stock_out_summary'),
    supabase.rpc('get_low_stock_alerts', { threshold: 10 }),
  ]);

  return { stockIn: stockIn.data, stockOut: stockOut.data, lowStock: lowStock.data };
}
```

### 2. Trigger Performance

**Batch updates:** Use statement-level triggers with transition tables (see cascade recalculation pattern above).

**Avoid in triggers:**
- Network calls (external APIs)
- Complex computations (defer to background workers)
- Long-running locks (batch large operations)

**Best practices:**
- Keep trigger logic under 1ms per row
- Use STABLE/IMMUTABLE functions for helper functions (PostgreSQL caches execution plans)
- For heavy computations, insert job into queue table, process asynchronously

**Sources:**
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality – TheLinuxCode](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [Effect of multiple update on same row in PostgreSQL tables | by Sheikh Wasiu Al Hasib | Medium](https://medium.com/@wasiualhasib/effect-of-multiple-update-on-same-row-in-postgresql-tables-7cae53db542c)

### 3. View vs Function for WAC Display

**Current implementation:** Calculate WAC in warehouse detail page (client-side aggregation).

**For dashboard scale:**
- Use `warehouse_inventory` view (lines 167-217 in `024_inventory_wac_trigger.sql`)
- View pre-calculates `current_stock`, `total_value`, `total_value_eusd` per warehouse per item
- Filter `HAVING current_stock > 0` reduces result set

**Query pattern:**
```sql
SELECT
  warehouse_id,
  SUM(total_value) as total_value,
  SUM(total_value_eusd) as total_value_eusd,
  COUNT(DISTINCT item_id) as item_count,
  SUM(current_stock) as total_units
FROM warehouse_inventory
GROUP BY warehouse_id;
```

**No new libraries needed.** Use existing Supabase RPC function.

---

## Component Patterns

### 1. KPI Cards (Reuse Existing)

**From:** C:\Users\User\Documents\qm-core\app\(dashboard)\dashboard\components\kpi-card.tsx (referenced but not shown)

**Pattern:**
- Icon + Label (uppercase, tracking-wider)
- Large numeric value (font-mono, bold)
- Subtitle/context (text-xs, slate-500)

**For inventory dashboard:**
```typescript
<div className="command-panel text-center">
  <div className="flex items-center justify-center gap-2 mb-2">
    <ArrowDownToLine className="h-5 w-5 text-emerald-400" />
    <p className="text-xs text-slate-400 uppercase tracking-wider">
      Stock In (Today)
    </p>
  </div>
  <p className="text-3xl font-mono font-bold text-emerald-400">
    {stockInCount.toLocaleString()}
  </p>
  <p className="text-xs text-slate-500 mt-1">transactions</p>
</div>
```

**Already implemented in warehouse detail page (lines 500-551).** Reuse pattern.

### 2. DataTable (Existing @tanstack/react-table Wrapper)

**From:** C:\Users\User\Documents\qm-core\components\tables\data-table.tsx

**Features:**
- Column sorting (`DataTableColumnHeader`)
- Search (`searchKey`, `searchPlaceholder`)
- Pagination

**For warehouse WAC display:**
```typescript
const columns: ColumnDef<WarehouseInventoryItem>[] = [
  {
    accessorKey: "item_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Item" />,
  },
  {
    accessorKey: "wac_amount",
    header: "WAC",
    cell: ({ row }) => (
      <span className="font-mono">
        {formatCurrency(row.getValue("wac_amount"), 2)} {row.original.wac_currency}
      </span>
    ),
  },
  {
    accessorKey: "wac_exchange_rate",
    header: "Exchange Rate",
    cell: ({ row }) => (
      <span className="font-mono text-slate-400">
        {formatCurrency(row.getValue("wac_exchange_rate"), 4)}
      </span>
    ),
  },
  // ...
];
```

**Already implemented** (lines 194-275 in warehouse detail page). Pattern is validated.

### 3. Manual Stock-In Form

**Extend existing form pattern** from stock-in/stock-out pages.

**New fields:**
- Currency select (reuse pattern from financial transactions)
- Exchange rate input (4-decimal number input)
- Unit cost input (2-decimal number input)

**Zod validation:**
```typescript
import { z } from "zod";

const stockInSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().positive(),
  currency: z.string().default("MMK"),
  exchangeRate: z.number().min(0.0001).max(999999.9999),
  unitCost: z.number().min(0.01),
  transactionDate: z.date(),
  notes: z.string().optional(),
});
```

**Form UI (react-hook-form):**
```typescript
<FormField
  control={form.control}
  name="exchangeRate"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Exchange Rate *</FormLabel>
      <FormControl>
        <Input
          type="number"
          step="0.0001"
          placeholder="1.0000"
          {...field}
          onChange={(e) => field.onChange(parseFloat(e.target.value))}
        />
      </FormControl>
      <FormDescription>4 decimal places (e.g., 3250.5000)</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

**No new libraries needed.** Uses existing `react-hook-form`, `zod`, `Input` component.

---

## Installation

**No new packages required for v1.2.**

If starting from scratch (not applicable here):
```bash
# Core (already installed)
npm install next@14.2.13 react@18.3.1 react-dom@18.3.1
npm install @supabase/supabase-js@^2.50.0 @supabase/ssr@^0.8.0
npm install @tanstack/react-table@^8.21.3
npm install tailwindcss@^3.4.13 autoprefixer@^10.4.20 postcss@^8.4.47
npm install date-fns@^3.6.0 zod@^3.23.8 react-hook-form@^7.53.0

# Dev dependencies (already installed)
npm install -D typescript@^5.6.2 @types/node @types/react @types/react-dom
npm install -D eslint eslint-config-next prettier
```

**For v1.2 development:**
```bash
# Verify dependencies are up to date
npm list @tanstack/react-table  # Should show 8.21.3
npm list date-fns              # Should show 3.6.0
npm list zod                   # Should show 3.23.8
```

---

## Migration Path (Database Only)

v1.2 requires **database migrations only**, no package updates.

### New Migrations Required

1. **Invoice Void Cascade Trigger** (`034_invoice_void_cascade.sql`)
   - `recalculate_po_after_invoice_void()` function
   - `invoice_void_cascade_recalculation` trigger (statement-level)
   - `get_po_smart_status(po_id)` function (if not using view)

2. **Inventory Dashboard RPC Functions** (`035_inventory_dashboard_functions.sql`)
   - `get_stock_in_summary()` - aggregate stock-in by date/warehouse
   - `get_stock_out_summary()` - aggregate stock-out by reason
   - `get_warehouse_value_summary()` - total value per warehouse with WAC

3. **Manual Stock-In Support** (No migration needed)
   - Existing `inventory_transactions` table supports `currency`, `exchange_rate`, `unit_cost`
   - Existing WAC trigger handles new stock-in records

### Testing Migrations

```bash
# Local development
npx supabase migration new 034_invoice_void_cascade
# Edit migration file
npx supabase db reset  # Test migration

# Production
npx supabase db push   # Apply to remote
```

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Zero new dependencies | **HIGH** | All requirements covered by existing stack (verified via package.json, warehouse detail implementation) |
| Intl.NumberFormat for 4-decimal precision | **HIGH** | MDN docs confirm `minimumFractionDigits`/`maximumFractionDigits` support arbitrary precision |
| PostgreSQL trigger performance | **MEDIUM** | Statement-level triggers proven faster than row-level, but production load testing needed for bulk voids |
| KPI component reusability | **HIGH** | Warehouse detail page demonstrates pattern with 4 KPI cards (lines 496-551) |
| DataTable with WAC display | **HIGH** | Existing implementation shows WAC columns (lines 238-254), pattern is validated |

---

## Gaps to Address

### 1. Bulk Invoice Void Performance

**Gap:** No production data on voiding 100+ invoices simultaneously
**Impact:** Potential lock contention or slow recalculation
**Mitigation:**
- Use statement-level trigger (implemented above)
- Add monitoring for trigger execution time
- Consider batching voids (UI: "Void up to 50 at a time")

### 2. Dashboard Auto-Refresh Strategy

**Gap:** Management dashboard refreshes every 60 seconds (line 32 in dashboard-client.tsx), inventory dashboard refresh strategy undefined
**Impact:** Stale WAC values or inventory counts
**Mitigation:**
- Use same pattern as management dashboard (60-second interval with `useInterval` hook)
- Add manual refresh button for immediate update
- Consider WebSocket for real-time updates (future enhancement, not v1.2)

### 3. WAC Calculation Edge Cases

**Gap:** Existing trigger assumes positive stock before WAC update, edge case: stock goes negative (more out than in)
**Impact:** Division by zero or negative WAC
**Mitigation:**
- Add `CHECK (wac_amount >= 0)` constraint on items table
- Trigger validates `current_stock >= 0` before calculating WAC
- UI: Block stock-out if insufficient stock (existing validation in `validate_stock_out_quality()`, line 282-320 in `024_inventory_wac_trigger.sql`)

**Status:** Existing trigger handles this (line 50: `current_qty := GREATEST(current_qty, 0);`)

---

## Recommendations for Roadmap

### Phase Structure

1. **Phase 1: Database Triggers** (No new dependencies)
   - Implement invoice void cascade trigger
   - Add inventory dashboard RPC functions
   - Test cascade recalculation with bulk voids

2. **Phase 2: Inventory Dashboard UI** (Reuse existing stack)
   - Create inventory dashboard page (KPI cards for stock-in/out counts and values)
   - Use existing `KPICard` pattern from management dashboard
   - Use existing `DataTable` for detailed views

3. **Phase 3: WAC Display Enhancements** (Extend existing utilities)
   - Add 4-decimal exchange rate display to warehouse detail
   - Show WAC breakdown (amount + currency + rate) in item detail
   - Use existing `formatCurrency()` with `decimals: 4` parameter

4. **Phase 4: Manual Stock-In Form** (Reuse form components)
   - Extend stock-in form with currency/exchange rate fields
   - Use existing `react-hook-form` + `zod` validation
   - Test WAC recalculation with manual entries

### Research Flags

- **Phase 1:** Likely needs **minimal research** (PostgreSQL trigger patterns well-documented)
- **Phase 2:** **No research needed** (KPI pattern validated in warehouse detail)
- **Phase 3:** **No research needed** (`Intl.NumberFormat` precision confirmed)
- **Phase 4:** **No research needed** (form pattern matches existing financial transaction forms)

**Overall:** v1.2 is **low research risk**. All patterns are validated in existing codebase.

---

## Sources

### Charting Libraries
- [Best React chart libraries (2025 update): Features, performance & use cases - LogRocket Blog](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [Top React Chart Libraries to Use in 2026 - Aglowid IT Solutions](https://aglowiditsolutions.com/blog/react-chart-libraries/)
- [recharts - npm](https://www.npmjs.com/package/recharts)

### Number Formatting
- [Simplify Currency Formatting in React: A Zero-Dependency Solution with Intl API - DEV Community](https://dev.to/josephciullo/simplify-currency-formatting-in-react-a-zero-dependency-solution-with-intl-api-3kok)
- [Intl.NumberFormat - JavaScript | MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat)
- [react-number-format - npm](https://www.npmjs.com/package/react-number-format)

### Database & Triggers
- [Postgres Triggers | Supabase Docs](https://supabase.com/docs/guides/database/postgres/triggers)
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality – TheLinuxCode](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [PostgreSQL: Documentation: 18: 37.1. Overview of Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html)
- [PostgreSQL AFTER UPDATE Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-after-update-trigger)
- [rules vs. trigger performance when logging bulk updates](https://www.cybertec-postgresql.com/en/rules-or-triggers-to-log-bulk-updates/)

### React Table
- [@tanstack/react-table - npm](https://www.npmjs.com/package/@tanstack/react-table)
- [TanStack Table](https://tanstack.com/table/latest)
