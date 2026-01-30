# Phase 10: Inventory Dashboard - Research

**Researched:** 2026-01-30
**Domain:** Dashboard UI with KPIs, filtering, pagination, and data tables
**Confidence:** HIGH

## Summary

This phase creates a dashboard page to view inventory transaction history with KPIs, filters, and tab-based grouping. The standard approach combines Next.js 14 App Router patterns with existing project components (@tanstack/react-table for tables, Radix UI primitives for tabs/popovers, react-day-picker for date ranges). The inventory_transactions table already exists with proper indexing for queries. User decisions specify KPI presentation (EUSD-only values, clickable cards), filter layout (popover with chips), and tab design (All/Stock In/Stock Out with counts).

The primary technical challenge is managing filter state persistence across page visits, which the community has standardized around URL search parameters using Next.js's useSearchParams hook or the nuqs library for type-safe implementation. KPI calculations should use server-side aggregation (similar to existing get_qmrl_status_counts pattern) to avoid client-side computation of large datasets. Pagination follows TanStack Table patterns already established in the QMHQ list page.

**Primary recommendation:** Build server-side KPI aggregation functions in PostgreSQL, use URL search params for filter persistence, reuse existing Pagination and Tabs UI components, and follow established patterns from QMHQ list page for table layout.

## Standard Stack

The project already has the necessary libraries installed. No additional installations required.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | 8.21.3 | Data table functionality | Industry standard for React tables, handles sorting/filtering/pagination |
| @radix-ui/react-tabs | 1.1.13 | Tab navigation UI | Accessible primitive already in project |
| @radix-ui/react-popover | 1.1.15 | Filter popover container | Accessible primitive for filter UI |
| react-day-picker | 8.10.1 | Date range selection | WCAG 2.1 AA compliant, used in existing DatePicker component |
| date-fns | 3.6.0 | Date manipulation | Lightweight, already used in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | 14.2.13 (Next.js) | URL search params management | Built-in hook for filter persistence |
| lucide-react | 0.447.0 | Icons for badges, filters, KPIs | Consistent iconography across app |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useSearchParams (native) | nuqs library | nuqs adds type safety but increases bundle size; native is sufficient for this use case |
| Server-side filtering | Client-side only | Server-side required for large datasets (10k+ transactions) but adds complexity |
| Custom date picker | Native input[type=date] | Native is more accessible but less control over UX; react-day-picker already in project |

**Installation:**
```bash
# No new packages required - all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/inventory/
├── dashboard/
│   ├── page.tsx              # Main dashboard page (server component)
│   └── components/
│       ├── kpi-section.tsx   # KPI cards row (client component)
│       ├── filter-bar.tsx    # Filter controls with popover (client component)
│       ├── filter-chips.tsx  # Active filter display (client component)
│       └── transaction-table.tsx  # Data table with tabs (client component)

lib/actions/
└── inventory-dashboard.ts    # Server actions for KPI fetching

supabase/migrations/
└── 0XX_inventory_dashboard_kpis.sql  # RPC functions for aggregations
```

### Pattern 1: Server-Side KPI Aggregation with RPC Functions
**What:** Create PostgreSQL functions that compute KPIs on the database, similar to existing `get_qmrl_status_counts()` pattern
**When to use:** Always for aggregate calculations over large datasets
**Example:**
```typescript
// supabase/migrations/0XX_inventory_dashboard_kpis.sql
-- Source: Existing pattern from 033_dashboard_functions.sql
CREATE OR REPLACE FUNCTION public.get_inventory_kpis(
  from_date date DEFAULT NULL,
  to_date date DEFAULT NULL,
  warehouse_id_filter uuid DEFAULT NULL,
  item_id_filter uuid DEFAULT NULL
)
RETURNS TABLE(
  stock_in_count bigint,
  stock_in_value_eusd numeric,
  stock_out_count bigint,
  stock_out_value_eusd numeric,
  net_movement_eusd numeric
) AS $$
  WITH filtered_transactions AS (
    SELECT
      movement_type,
      total_cost_eusd
    FROM inventory_transactions
    WHERE is_active = true
      AND status = 'completed'
      AND (from_date IS NULL OR transaction_date >= from_date)
      AND (to_date IS NULL OR transaction_date <= to_date)
      AND (warehouse_id_filter IS NULL OR warehouse_id = warehouse_id_filter)
      AND (item_id_filter IS NULL OR item_id = item_id_filter)
  )
  SELECT
    COUNT(*) FILTER (WHERE movement_type = 'inventory_in') AS stock_in_count,
    COALESCE(SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_in'), 0) AS stock_in_value_eusd,
    COUNT(*) FILTER (WHERE movement_type = 'inventory_out') AS stock_out_count,
    COALESCE(SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_out'), 0) AS stock_out_value_eusd,
    COALESCE(
      SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_in') -
      SUM(total_cost_eusd) FILTER (WHERE movement_type = 'inventory_out'),
      0
    ) AS net_movement_eusd
  FROM filtered_transactions;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Pattern 2: URL Search Params for Filter State Persistence
**What:** Store filter state in URL query parameters for persistence and shareability
**When to use:** All dashboard filters (date range, warehouse, item, tab selection)
**Example:**
```typescript
// Source: Next.js 14 App Router official docs
// app/(dashboard)/inventory/dashboard/page.tsx
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

function TransactionTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read from URL
  const activeTab = searchParams.get('tab') || 'all';
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');
  const warehouseId = searchParams.get('warehouse');

  // Update URL when filter changes
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    // Filter components call updateFilter() on change
  );
}
```

### Pattern 3: Clickable KPI Cards with Tab Synchronization
**What:** KPI cards navigate to filtered view AND switch to corresponding tab
**When to use:** All KPI cards that filter by transaction type
**Example:**
```typescript
// Source: Adapted from existing app/(dashboard)/dashboard/components/kpi-card.tsx
interface KPICardProps {
  title: string;
  value: number;
  label: string;
  onClick?: () => void;
}

function KPICard({ title, value, label, onClick }: KPICardProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-slate-700 transition"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-2">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-200">
          {formatCurrency(value, 2)}
        </span>
        <span className="text-sm text-slate-400">EUSD</span>
      </div>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

// Usage with tab sync
<KPICard
  title="Stock In"
  value={kpis.stock_in_value_eusd}
  label={`${kpis.stock_in_count} transactions`}
  onClick={() => {
    updateFilter('tab', 'in');
    // Tab component will react to URL change
  }}
/>
```

### Pattern 4: Filter Chips with Remove Functionality
**What:** Display active filters as removable chips below filter button
**When to use:** When any filter is active
**Example:**
```typescript
// Source: Material-UI Chip pattern adapted for project styling
interface FilterChip {
  label: string;
  onRemove: () => void;
}

function FilterChips({ filters }: { filters: FilterChip[] }) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter, index) => (
        <div
          key={index}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm"
        >
          <span>{filter.label}</span>
          <button
            onClick={filter.onRemove}
            className="hover:text-amber-300 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => filters.forEach(f => f.onRemove())}
        className="text-sm text-slate-400 hover:text-slate-200 underline"
      >
        Clear all
      </button>
    </div>
  );
}
```

### Pattern 5: Date Range Picker Component
**What:** Two DatePicker components for from/to dates with validation
**When to use:** Custom date range filter (no presets per user decision)
**Example:**
```typescript
// Source: Existing components/ui/date-picker.tsx with range logic
function DateRangeFilter() {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const handleApply = () => {
    updateFilter('from', fromDate?.toISOString().split('T')[0]);
    updateFilter('to', toDate?.toISOString().split('T')[0]);
    closePopover();
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-slate-400 mb-2 block">From</label>
        <DatePicker
          date={fromDate}
          onDateChange={setFromDate}
          maxDate={toDate || undefined}
          placeholder="Start date"
        />
      </div>
      <div>
        <label className="text-sm text-slate-400 mb-2 block">To</label>
        <DatePicker
          date={toDate}
          onDateChange={setToDate}
          minDate={fromDate || undefined}
          placeholder="End date"
        />
      </div>
      <Button onClick={handleApply} className="w-full">
        Apply
      </Button>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Fetching all transactions client-side then filtering:** Use server-side filtering/pagination for datasets over 1000 records
- **Storing filter state only in component state:** Breaks shareability and browser back button; always use URL params
- **Computing KPIs client-side:** Database aggregation is orders of magnitude faster and reduces network payload
- **Hardcoding date presets:** User specifically requested custom range only, don't add "Last 7 days" buttons
- **Making every column sortable:** User specified only Date column is sortable

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table sorting/filtering/pagination | Custom table state management | @tanstack/react-table | Already in project, handles edge cases like reset-on-filter-change |
| Date picker UI | Custom calendar component | react-day-picker (via DatePicker) | WCAG 2.1 AA compliant, handles edge cases like leap years, locales |
| URL state management | Manual URLSearchParams manipulation | useSearchParams + useRouter pattern | Next.js 14 App Router optimized, handles shallow routing |
| Pagination UI | Custom prev/next buttons | Existing Pagination component | Already handles edge cases like totalPages calculation |
| Tab navigation | Custom state + conditional rendering | @radix-ui/react-tabs | Accessible (keyboard nav, ARIA), already styled in project |
| Filter popover positioning | Custom CSS positioning | @radix-ui/react-popover | Handles viewport boundaries, portals, focus trap |
| Number formatting | String manipulation for commas | Intl.NumberFormat (via formatCurrency) | Handles locale, edge cases, already in lib/utils/index.ts |

**Key insight:** Dashboard UI has many solved problems. This project already has production-ready components and utilities. Use them instead of rebuilding.

## Common Pitfalls

### Pitfall 1: Client-Side KPI Calculation Performance
**What goes wrong:** Fetching all transactions to client then computing aggregates causes slow page loads
**Why it happens:** Intuition says "just SUM() the data in JavaScript" but network transfer + client computation is slow
**How to avoid:** Create PostgreSQL RPC functions that return pre-computed KPIs, call via Supabase RPC
**Warning signs:** Page load >1s with moderate data, browser memory spikes, network waterfall shows large JSON payloads

### Pitfall 2: Filter State Lost on Page Refresh
**What goes wrong:** User sets filters, refreshes page, filters reset to defaults
**Why it happens:** Storing filter state in component useState only, not persisting anywhere
**How to avoid:** Use URL search parameters as single source of truth for all filter state
**Warning signs:** User complaints about losing filter settings, inability to share filtered views via URL

### Pitfall 3: Pagination Reset Confusion
**What goes wrong:** User filters data on page 3, filter changes, still on page 3 but out of bounds (only 2 pages now)
**Why it happens:** Not resetting currentPage to 1 when filters change
**How to avoid:** useEffect that resets page to 1 when searchQuery, dateRange, warehouse, or item filters change (see QMHQ page.tsx pattern)
**Warning signs:** Empty table after applying filter, "Page X of Y" shows impossible page number

### Pitfall 4: N+1 Query Problem in Transaction List
**What goes wrong:** Fetching transactions then separately fetching item/warehouse for each row
**Why it happens:** Not using Supabase select() join syntax properly
**How to avoid:** Use nested select in single query: `select('*, item:items(name, sku), warehouse:warehouses(name)')`
**Warning signs:** Network tab shows dozens of queries, slow table render, multiple DB round trips

### Pitfall 5: Tab Count Staleness
**What goes wrong:** Tab counts don't update when filters change, show total counts instead of filtered counts
**Why it happens:** Computing tab counts once on mount, not recalculating when filters applied
**How to avoid:** Either: (A) filter transactions client-side and count per tab dynamically, OR (B) include filtered counts in server response
**Warning signs:** "Stock In (80)" tab shows 80 items but filtered table only has 10 rows

### Pitfall 6: Date Range Validation Edge Cases
**What goes wrong:** User selects To date before From date, or future dates for historical data
**Why it happens:** Not validating date selections or constraining picker
**How to avoid:** DatePicker already supports minDate/maxDate props; use fromDate as minDate for toDate picker
**Warning signs:** Invalid date ranges submitted, nonsensical KPI results, empty results for valid-looking filters

## Code Examples

Verified patterns from official sources and existing codebase:

### Server Action for KPI Fetching
```typescript
// lib/actions/inventory-dashboard.ts
'use server';

import { createClient } from '@/lib/supabase/server';

interface InventoryKPIs {
  stock_in_count: number;
  stock_in_value_eusd: number;
  stock_out_count: number;
  stock_out_value_eusd: number;
  net_movement_eusd: number;
}

export async function getInventoryKPIs(
  fromDate?: string,
  toDate?: string,
  warehouseId?: string,
  itemId?: string
): Promise<InventoryKPIs> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('get_inventory_kpis', {
      from_date: fromDate || null,
      to_date: toDate || null,
      warehouse_id_filter: warehouseId || null,
      item_id_filter: itemId || null,
    });

  if (error) throw error;

  return data[0] || {
    stock_in_count: 0,
    stock_in_value_eusd: 0,
    stock_out_count: 0,
    stock_out_value_eusd: 0,
    net_movement_eusd: 0,
  };
}
```

### Transaction List with Joins
```typescript
// Source: Existing QMHQ page.tsx pattern
const { data: transactions, error } = await supabase
  .from('inventory_transactions')
  .select(`
    id,
    transaction_date,
    movement_type,
    quantity,
    unit_cost,
    currency,
    total_cost,
    total_cost_eusd,
    reference_no,
    item:items(id, name, sku),
    warehouse:warehouses(id, name),
    invoice:invoices(id, invoice_number),
    qmhq:qmhq(id, request_id)
  `)
  .eq('is_active', true)
  .eq('status', 'completed')
  .order('transaction_date', { ascending: false })
  .range(startRow, endRow);
```

### Clickable Table Row Navigation
```typescript
// Source: Existing QMHQ list view pattern
<tr
  key={transaction.id}
  className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
  onClick={() => {
    // Navigate to source document
    if (transaction.invoice_id) {
      router.push(`/invoice/${transaction.invoice_id}`);
    } else if (transaction.qmhq_id) {
      router.push(`/qmhq/${transaction.qmhq_id}`);
    }
  }}
>
  {/* Table cells */}
</tr>
```

### Tabs with Dynamic Counts
```typescript
// Source: @radix-ui/react-tabs official pattern
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function TransactionTabs({ transactions, activeTab, onTabChange }) {
  const allCount = transactions.length;
  const inCount = transactions.filter(t => t.movement_type === 'inventory_in').length;
  const outCount = transactions.filter(t => t.movement_type === 'inventory_out').length;

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="all">
          All ({allCount})
        </TabsTrigger>
        <TabsTrigger value="in">
          Stock In ({inCount})
        </TabsTrigger>
        <TabsTrigger value="out">
          Stock Out ({outCount})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all">
        <TransactionTable transactions={transactions} />
      </TabsContent>
      {/* Other tab contents */}
    </Tabs>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router with getServerSideProps | App Router with Server Components | Next.js 13+ (2023) | Simpler data fetching, automatic request deduplication |
| Client-side filtering only | Hybrid: server aggregation + client filtering | TanStack Table v8 (2022) | Better performance for large datasets |
| Local storage for filter persistence | URL search parameters | React Router v6, Next.js 13+ pattern | Shareable URLs, better UX |
| react-table v7 | @tanstack/react-table v8 | 2022 | Framework-agnostic, better TypeScript support |
| Custom date pickers | react-day-picker v8 | 2021 | WCAG 2.1 AA compliance built-in |

**Deprecated/outdated:**
- **Pages Router data fetching (getServerSideProps):** Replaced by Server Components in App Router; heavier bundle, no streaming
- **react-table v7:** Renamed to @tanstack/react-table v8 in 2022; different API, no longer maintained
- **Imperative router.push() for filters:** Use declarative URL params; more predictable, SSR-friendly
- **localStorage for dashboard state:** URL params provide better UX; localStorage not shareable, SSR issues

## Open Questions

Things that couldn't be fully resolved:

1. **Recommended page size for transaction list**
   - What we know: User decision left this to Claude's discretion; QMHQ page uses 20 as default
   - What's unclear: Optimal page size depends on transaction volume (unknown)
   - Recommendation: Use 20 as default (matches QMHQ pattern), include page size selector with options [10, 20, 50, 100]

2. **Tab state in URL vs component state**
   - What we know: User decision left this to Claude's discretion
   - What's unclear: Whether tab switching should trigger URL change (affects browser history)
   - Recommendation: Include tab in URL (`?tab=in`) for shareability; matches modern dashboard UX patterns

3. **Negative value styling (Net Movement)**
   - What we know: User decision left styling choice to Claude's discretion
   - What's unclear: Red text vs parentheses vs minus sign styling preference
   - Recommendation: Use red text color (`text-red-400`) for negative values; simpler than parentheses, visually clear

4. **Transaction detail modal vs navigation**
   - What we know: User specified clicking row navigates to source document (Invoice or QMHQ)
   - What's unclear: What happens for manual stock-in (no source document)?
   - Recommendation: For manual stock-in, make row non-clickable or show a detail modal with full transaction data

## Sources

### Primary (HIGH confidence)
- Next.js 14 App Router - useSearchParams official documentation: https://nextjs.org/docs/app/api-reference/functions/use-search-params
- TanStack Table v8 Pagination Guide: https://tanstack.com/table/v8/docs/guide/pagination
- React Aria DateRangePicker (accessibility): https://react-spectrum.adobe.com/react-aria/DateRangePicker.html
- Existing codebase patterns:
  - `app/(dashboard)/qmhq/page.tsx` (lines 1-595)
  - `supabase/migrations/033_dashboard_functions.sql` (lines 1-131)
  - `components/ui/pagination.tsx` (lines 1-186)
  - `components/ui/tabs.tsx` (lines 1-56)
  - `components/ui/popover.tsx` (lines 1-31)
  - `components/ui/date-picker.tsx` (lines 1-86)

### Secondary (MEDIUM confidence)
- [Beyond useState: State Management in Next.js using URL Parameters](https://blog.openreplay.com/state-management-in-react-using-url/)
- [nuqs | Type-safe search params state management for React](https://nuqs.dev/)
- [Mastering State in Next.js App Router with URL Query Parameters](https://medium.com/@roman_j/mastering-state-in-next-js-app-router-with-url-query-parameters-a-practical-guide-03939921d09c)
- [TanStack Table Server-side Pagination Guide](https://medium.com/@aylo.srd/server-side-pagination-and-sorting-with-tanstack-table-and-react-bd493170125e)
- [Tremor – React Dashboard Components](https://www.tremor.so/)
- [Material UI Chip Component (filter chips pattern)](https://mui.com/material-ui/react-chip/)
- [React DayPicker Documentation](https://daypicker.dev/)

### Tertiary (LOW confidence)
- None - all findings verified with official docs or existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in project
- Architecture: HIGH - Patterns verified in existing codebase (QMHQ, dashboard, migrations)
- Pitfalls: HIGH - Based on documented TanStack Table behavior and Next.js App Router patterns
- Code examples: HIGH - Adapted from official docs and existing working code

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (30 days for stable patterns; Next.js/TanStack core APIs unlikely to change)
