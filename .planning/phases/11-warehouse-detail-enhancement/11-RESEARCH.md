# Phase 11: Warehouse Detail Enhancement - Research

**Researched:** 2026-01-30
**Domain:** Data table enhancement with financial calculations
**Confidence:** HIGH

## Summary

Phase 11 enhances the existing warehouse detail page inventory tab to display per-item WAC (Weighted Average Cost) with EUSD values. The implementation builds on established patterns from Phase 10 (inventory dashboard) and existing warehouse detail functionality. The core technical challenge is client-side aggregation of inventory transactions to calculate per-item stock levels with WAC-based valuations, similar to the existing implementation but with enhanced column display and KPI cards.

The project already has all necessary infrastructure: WAC calculation triggers in the database, inventory transaction tables, utility functions for formatting, and TanStack Table v8 for data presentation. The enhancement is primarily a UI task: adding columns to the existing table and displaying KPI cards above it.

**Primary recommendation:** Extend the existing warehouse detail page implementation following the established DataTable pattern with @tanstack/react-table v8, reusing formatting utilities and calculation patterns from the current codebase.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.21.3 | Data table with sorting/filtering | Industry standard for React tables, already used throughout project |
| Next.js App Router | 14.2.13 | Client component with useEffect for data fetching | Project standard for interactive data displays |
| Supabase Client | ^2.50.0 | Real-time data fetching from PostgreSQL | Project's database layer |
| TypeScript | ^5.6.2 | Type safety for calculations | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.447.0 | Icons (Package, DollarSign, etc.) | All UI icons in project |
| tailwind-merge | ^2.5.2 | CSS class composition | Via cn() utility |
| clsx | ^2.1.1 | Conditional classes | Via cn() utility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side aggregation | Database view | View already exists (warehouse_inventory) but filters out zero-stock items; client-side allows showing them with visual distinction |
| TanStack Table | Custom table | Would lose sorting, filtering, and pagination features; not justified for simple column additions |

**Installation:**
```bash
# No new dependencies required - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/warehouse/[id]/
├── page.tsx                    # Enhanced with new columns
lib/utils/
├── inventory.ts                # Existing formatWAC, formatStockQuantity utilities
├── index.ts                    # Existing formatCurrency utility
```

### Pattern 1: Client-Side Inventory Aggregation
**What:** Calculate current stock per item from transaction history
**When to use:** Warehouse detail, item detail pages (already used)
**Example:**
```typescript
// Source: app/(dashboard)/warehouse/[id]/page.tsx lines 121-157
const inventoryMap = new Map<string, WarehouseInventoryItem>();

transactionsData.forEach((t) => {
  const item = t.item;
  if (!item) return;

  if (!inventoryMap.has(item.id)) {
    inventoryMap.set(item.id, {
      item_id: item.id,
      item_name: item.name,
      item_sku: item.sku,
      item_unit: item.default_unit,
      current_stock: 0,
      wac_amount: item.wac_amount,
      wac_currency: item.wac_currency,
      wac_amount_eusd: item.wac_amount_eusd,
      total_value: 0,
      total_value_eusd: 0,
    });
  }

  const inv = inventoryMap.get(item.id)!;
  if (t.movement_type === "inventory_in") {
    inv.current_stock += t.quantity;
  } else if (t.movement_type === "inventory_out") {
    inv.current_stock -= t.quantity;
  }
});

// Calculate total values
const inventoryList = Array.from(inventoryMap.values())
  .map((inv) => ({
    ...inv,
    total_value: inv.current_stock * (inv.wac_amount || 0),
    total_value_eusd: inv.current_stock * (inv.wac_amount_eusd || 0),
  }));
```

### Pattern 2: TanStack Table with Sortable Columns
**What:** Define columns with DataTableColumnHeader for sorting
**When to use:** All data tables in the project
**Example:**
```typescript
// Source: app/(dashboard)/warehouse/[id]/page.tsx lines 194-274
const columns: ColumnDef<WarehouseInventoryItem>[] = [
  {
    accessorKey: "item_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Item" />
    ),
    cell: ({ row }) => (
      <Link href={`/item/${row.original.item_id}`}>
        {row.getValue("item_name")}
      </Link>
    ),
  },
  {
    accessorKey: "total_value_eusd",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total (EUSD)" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-emerald-400">
        {formatCurrency(row.getValue("total_value_eusd"))}
      </span>
    ),
  },
];
```

### Pattern 3: KPI Cards Above Table
**What:** Grid of summary cards displaying aggregated metrics
**When to use:** Dashboard-style pages (warehouse detail, inventory dashboard)
**Example:**
```typescript
// Source: app/(dashboard)/warehouse/[id]/page.tsx lines 495-551
const kpis = useMemo(() => {
  const totalItems = inventoryItems.length;
  const totalUnits = inventoryItems.reduce((sum, item) => sum + item.current_stock, 0);
  const totalValue = inventoryItems.reduce((sum, item) => sum + item.total_value, 0);
  const totalValueEusd = inventoryItems.reduce((sum, item) => sum + item.total_value_eusd, 0);
  return { totalItems, totalUnits, totalValue, totalValueEusd };
}, [inventoryItems]);

<div className="grid grid-cols-4 gap-4">
  <div className="command-panel text-center">
    <div className="flex items-center justify-center gap-2 mb-2">
      <DollarSign className="h-5 w-5 text-emerald-400" />
      <p className="text-xs text-slate-400 uppercase tracking-wider">
        Total Value
      </p>
    </div>
    <p className="text-2xl font-mono font-bold text-emerald-400">
      {formatCurrency(kpis.totalValueEusd)}
    </p>
    <p className="text-xs text-slate-500 mt-1">EUSD</p>
  </div>
</div>
```

### Pattern 4: Low Stock Warning Visual
**What:** Highlight rows with stock below threshold using conditional styling
**When to use:** Inventory tables where stock levels matter
**Example:**
```typescript
// Pattern for row highlighting (not in existing code, but follows project conventions)
cell: ({ row }) => {
  const stock = row.getValue("current_stock") as number;
  const LOW_STOCK_THRESHOLD = 10;

  return (
    <span className={cn(
      "font-mono",
      stock <= 0 ? "text-slate-500" : // Zero stock
      stock < LOW_STOCK_THRESHOLD ? "text-amber-400" : // Low stock
      "text-emerald-400" // Normal stock
    )}>
      {formatStockQuantity(stock, row.original.item_unit)}
    </span>
  );
}
```

### Anti-Patterns to Avoid
- **Don't filter out zero-stock items**: Keep them in the list with visual distinction (grayed out) for inventory awareness
- **Don't add MMK columns**: Phase context specifies "EUSD only" to avoid clutter
- **Don't use database view for this**: The `warehouse_inventory` view filters out zero-stock items, but we need to show them
- **Don't make item rows fully clickable**: Only the item name should be a link (prevents accidental navigation when clicking sort headers or other cells)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WAC calculation | Custom formula in component | Existing item.wac_amount_eusd | Database trigger maintains it (024_inventory_wac_trigger.sql) |
| Currency formatting | Manual toLocaleString | formatCurrency() from lib/utils | Handles rounding, decimal places, thousand separators consistently |
| Stock quantity display | String concatenation | formatStockQuantity() from lib/utils/inventory.ts | Handles unit display, null values, and formatting |
| Table sorting/filtering | Custom state management | @tanstack/react-table | Mature library handles edge cases (multi-column sort, filter types) |
| Low stock threshold | Hard-coded values | Global constant (10 units) | Consistent with dashboard implementation (Phase 5) |

**Key insight:** The database already calculates WAC via triggers on inventory_in transactions. Components should display pre-calculated values, not recalculate them. This prevents calculation drift and maintains consistency across the system.

## Common Pitfalls

### Pitfall 1: Including Zero-Stock Items in Value Calculations
**What goes wrong:** Zero-stock items inflate "Unique Items" KPI count
**Why it happens:** Developers include all items in length count without filtering
**How to avoid:** Filter items with `current_stock > 0` for KPI counts, but show all items in table
**Warning signs:** "Unique Items" count doesn't match visible non-zero rows
```typescript
// Correct approach
const kpis = useMemo(() => {
  // Only count items with stock > 0
  const totalItems = inventoryItems.filter(item => item.current_stock > 0).length;
  // Only sum values for items with stock > 0
  const totalValueEusd = inventoryItems
    .filter(item => item.current_stock > 0)
    .reduce((sum, item) => sum + item.total_value_eusd, 0);
  return { totalItems, totalValueEusd };
}, [inventoryItems]);
```

### Pitfall 2: Missing WAC Handling for Items Without Transactions
**What goes wrong:** Items show "NaN" or crash when wac_amount is null
**Why it happens:** New items without stock-in transactions have null WAC
**How to avoid:** Use optional chaining and nullish coalescing: `item.wac_amount_eusd ?? 0`
**Warning signs:** Console errors about null/undefined in arithmetic, dash (—) not displaying
```typescript
// Correct approach from existing code
total_value_eusd: inv.current_stock * (inv.wac_amount_eusd || 0)
```

### Pitfall 3: Column Alignment Inconsistency
**What goes wrong:** Numbers appear left-aligned mixing with text columns, making scanning difficult
**Why it happens:** Default table cell alignment is left for all columns
**How to avoid:** Add `text-right` class to numeric column cells for accounting-style alignment
**Warning signs:** Numbers of different digit counts don't line up visually
```typescript
// Recommended approach for numeric columns
cell: ({ row }) => (
  <span className="font-mono text-emerald-400 text-right">
    {formatCurrency(row.getValue("total_value_eusd"))}
  </span>
)
```

### Pitfall 4: Forgetting to Update Default Sort
**What goes wrong:** Table shows items in database order (by item name) instead of by value
**Why it happens:** TanStack Table defaults to no sorting unless configured
**How to avoid:** Set initialState.sorting in useReactTable configuration
**Warning signs:** Most valuable items not visible at top of table
```typescript
// Correct approach
const table = useReactTable({
  data,
  columns,
  initialState: {
    sorting: [{ id: "total_value_eusd", desc: true }],
  },
  // ... other config
});
```

## Code Examples

Verified patterns from official sources:

### TanStack Table Column Definition with Sorting
```typescript
// Source: Existing warehouse detail implementation
// All columns in warehouse inventory table are sortable via DataTableColumnHeader
import { DataTableColumnHeader } from "@/components/tables/data-table";

const columns: ColumnDef<WarehouseInventoryItem>[] = [
  {
    accessorKey: "wac_amount_eusd",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="WAC (EUSD)" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-emerald-400">
        {formatCurrency(row.getValue("wac_amount_eusd") ?? 0)}
      </span>
    ),
  },
];
```

### Currency Formatting with Suffix
```typescript
// Source: lib/utils/index.ts lines 17-29
// Format number with thousand separators and 2 decimal places
export function formatCurrency(amount: number, decimals: number = 2): string {
  const multiplier = Math.pow(10, decimals);
  const rounded = Math.round(amount * multiplier) / multiplier;

  return new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rounded);
}

// Usage: formatCurrency(1234.5678) => "1,234.57"
// Add " EUSD" suffix in component: `${formatCurrency(value)} EUSD`
```

### Zero Value Display
```typescript
// Pattern for displaying zero/null values as em-dash
cell: ({ row }) => {
  const value = row.getValue("wac_amount_eusd") as number | null;
  if (value === null || value === 0) return <span className="text-slate-500">—</span>;
  return <span className="font-mono">{formatCurrency(value)} EUSD</span>;
}
```

### Low Stock Visual Indicator
```typescript
// Pattern for conditional styling based on stock level
const LOW_STOCK_THRESHOLD = 10;

cell: ({ row }) => {
  const stock = row.getValue("current_stock") as number;
  return (
    <span className={cn(
      "font-mono",
      stock <= 0 ? "text-slate-500" :
      stock < LOW_STOCK_THRESHOLD ? "text-amber-400 font-semibold" :
      "text-emerald-400"
    )}>
      {formatStockQuantity(stock, row.original.item_unit)}
    </span>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate MMK and EUSD columns | EUSD only display | Phase 11 decision | Reduced clutter, faster comprehension |
| Filter zero-stock items | Show with visual distinction | Phase 11 decision | Better inventory awareness |
| Database view for inventory | Client-side aggregation | Existing pattern | Allows showing zero-stock items |
| TanStack Table v7 | TanStack Table v8 | Project inception | Better TypeScript support, composition API |

**Deprecated/outdated:**
- Manual pagination: DataTable component handles it via TanStack Table
- Custom sorting logic: Built into TanStack Table with declarative column config
- Separate KPI calculation functions: useMemo hooks inline in components for co-location

## Open Questions

Things that couldn't be fully resolved:

1. **Search includes zero-stock items**
   - What we know: CONTEXT.md states "Search includes zero-stock items in results"
   - What's unclear: Should search be case-sensitive? Should it match SKU and name?
   - Recommendation: Follow DataTable pattern with globalFilter matching all text columns (case-insensitive)

2. **Column grouping for Value columns**
   - What we know: CONTEXT.md specifies "WAC (EUSD)" and "Total Value (EUSD)" as separate columns
   - What's unclear: Should these be visually grouped as "Value Information" section?
   - Recommendation: Claude's discretion per CONTEXT.md "Visual separation between column groups"

3. **Pagination vs Virtual Scroll**
   - What we know: CONTEXT.md leaves "Pagination approach" to Claude's discretion
   - What's unclear: Will warehouses typically have >50 items?
   - Recommendation: Use pagination (existing DataTable pattern) unless warehouse has >100 items

## Sources

### Primary (HIGH confidence)
- Existing codebase: app/(dashboard)/warehouse/[id]/page.tsx (lines 45-659)
- Existing codebase: lib/utils/inventory.ts (lines 1-292)
- Existing codebase: lib/utils/index.ts (lines 1-133)
- Database schema: supabase/migrations/024_inventory_wac_trigger.sql
- Phase context: .planning/phases/11-warehouse-detail-enhancement/11-CONTEXT.md
- Global constants: Low stock threshold = 10 units (from STATE.md)

### Secondary (MEDIUM confidence)
- TanStack Table v8 documentation (via package.json dependency)
- Project styling patterns (command-panel, tactical-card classes)

### Tertiary (LOW confidence)
- None — all findings verified from codebase and official project documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used
- Architecture: HIGH - Patterns verified in existing code
- Pitfalls: HIGH - Derived from existing implementations and common mistakes

**Research date:** 2026-01-30
**Valid until:** 60 days (stable domain, established patterns)
