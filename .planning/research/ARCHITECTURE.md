# Architecture: PO Smart Lifecycle Integration

**Project:** QM System - PO Smart Lifecycle
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

The PO Smart Lifecycle features integrate deeply with QM System's existing Next.js 14 + Supabase PostgreSQL architecture. The system already has sophisticated infrastructure in place:

- **Database-driven status calculation** via PostgreSQL triggers tracking `invoiced_quantity` and `received_quantity` on `po_line_items`
- **Existing progress tracking** with `POProgressBar` component showing invoiced/received percentages
- **Trigger deduplication** pattern using time-window checks (2-second window)
- **Audit logging** automatically capturing status changes, including PO closure events

The new features (visual matching panel, enhanced progress bars, lock mechanism) are **UI enhancements and presentation improvements** over existing calculation infrastructure, not new data models.

**Key architectural insight:** The three-way match calculation already exists. We're adding visibility and user experience layers.

## Current Architecture Foundation

### Database Layer: Three-Way Match Already Implemented

The system already calculates three-way match status via cascading triggers:

```
invoice_line_items (INSERT/UPDATE/DELETE)
  ↓ trigger: update_po_line_invoiced_quantity()
po_line_items.invoiced_quantity updated
  ↓ trigger: trigger_update_po_status()
purchase_orders.status recalculated via calculate_po_status()
  ↓ considers: total_ordered, total_invoiced, total_received
purchase_orders.status = ('not_started' | 'partially_invoiced' | 'awaiting_delivery' | 'partially_received' | 'closed' | 'cancelled')
```

**Stock-in flow:**
```
inventory_transactions (INSERT with movement_type='inventory_in', invoice_line_item_id set)
  ↓ needs new trigger: update_invoice_line_received_quantity()
invoice_line_items.received_quantity updated
  ↓ needs new trigger: update_po_line_received_quantity()
po_line_items.received_quantity updated
  ↓ existing trigger: trigger_update_po_status()
purchase_orders.status recalculated
```

**Current gap:** Stock-in transactions don't update `invoice_line_items.received_quantity` or `po_line_items.received_quantity`. This is the only missing database piece.

**Source:** Migration files `016_po_line_items.sql`, `022_invoice_line_items.sql`, `023_inventory_transactions.sql`

### Component Layer: Progress Tracking Exists

Current PO detail page (`/app/(dashboard)/po/[id]/page.tsx`) already displays:
- Invoiced percentage with amber color
- Received percentage with emerald color
- Two-bar progress visualization via `POProgressBar` component
- KPI cards showing progress metrics

**Source:** `app/(dashboard)/po/[id]/page.tsx` lines 182-334, `components/po/po-progress-bar.tsx`

### Audit Layer: Closure Events Logged

The audit trigger already captures:
- PO status changes (line 268-298 in `048_status_update_with_note.sql`)
- Specific closure event: When status becomes 'closed', an additional audit entry with action='close' is created (lines 284-294)
- Deduplication via 2-second time window for status changes (lines 222-237)

**Source:** `supabase/migrations/048_status_update_with_note.sql`

## Integration Architecture

### 1. Visual Matching Panel

**Purpose:** Side-by-side comparison of PO quantities vs invoiced vs received.

#### Data Source
Query executed server-side in PO detail page:

```typescript
// Server Component fetch
const { data: matchingData } = await supabase
  .from('po_line_items')
  .select(`
    id,
    item_id,
    item_name,
    item_sku,
    quantity,
    invoiced_quantity,
    received_quantity,
    item:items(id, name, sku)
  `)
  .eq('po_id', poId)
  .eq('is_active', true);
```

#### Component Structure
```
/components/po/po-matching-panel.tsx (NEW)
  - Server Component (default)
  - Receives matchingData as props
  - Renders comparison table
  - Uses existing MiniProgressBar for visual indicators
  - Color coding: amber (invoiced), emerald (received)
```

#### Integration Point
Add to PO detail page after Financial Summary Panel, before Tabs section:

```typescript
// app/(dashboard)/po/[id]/page.tsx
// After line 334 (Financial Summary Panel)
// Before line 336 (Tabs)

{po.status !== 'not_started' && (
  <POMatchingPanel
    lineItems={lineItems}
    totalOrdered={totalQty}
    totalInvoiced={invoicedQty}
    totalReceived={receivedQty}
  />
)}
```

**No database changes needed.** All data already available in page query.

### 2. Enhanced Progress Bars

**Purpose:** Add legend, improve visual hierarchy, show match vs mismatch states.

#### Current Implementation
`POProgressBar` component shows two bars with labels (invoiced %, received %).

#### Enhancement Strategy
Modify existing `POProgressBar` component:

```typescript
// components/po/po-progress-bar.tsx
interface POProgressBarProps {
  invoicedPercent: number;
  receivedPercent: number;
  showLabels?: boolean;
  showLegend?: boolean; // NEW
  highlightMismatch?: boolean; // NEW
  size?: "sm" | "md";
}
```

**Visual enhancements:**
- Add legend explaining colors (Invoiced = Amber, Received = Emerald)
- Highlight discrepancy when invoiced !== received (border glow effect)
- Add completion indicator when both reach 100%
- Animate transitions using existing Tailwind classes

**Integration:** Update existing usage in PO detail page (line 328) with new props.

### 3. Lock Mechanism (Status = 'closed')

**Purpose:** Prevent edits to closed POs with visual indicators.

#### Database Layer
**No changes needed.** Lock logic already implemented:

1. `calculate_po_status()` function (lines 97-152 in `016_po_line_items.sql`) sets status to 'closed' when `total_received >= total_ordered AND total_invoiced >= total_ordered`
2. `block_invoice_for_closed_po()` trigger (lines 95-121 in `021_invoices.sql`) prevents invoice creation for closed POs
3. `canEditPO()` utility (line 175 in `lib/utils/po-status.ts`) returns `false` for closed status

#### UI Layer Enhancements

**Current behavior:**
- Edit button hidden when `!canEditPO(status)` (line 218, `app/(dashboard)/po/[id]/page.tsx`)
- Cancel button hidden for closed POs (line 219)

**New visual indicators:**
1. **Lock badge** on page header when status = 'closed'
2. **Banner alert** explaining closure (dismissible)
3. **Disabled state** for all interactive elements
4. **Audit trail link** in banner to view closure event

#### Component Structure
```typescript
// components/po/po-lock-indicator.tsx (NEW)
interface POLockIndicatorProps {
  status: POStatusEnum;
  closedAt?: string; // from audit_logs
  closedBy?: string; // from audit_logs
}

// Shows:
// - Lock icon badge in header
// - Alert banner: "This PO is closed and locked. All quantities have been fully matched."
// - Link to History tab showing closure audit entry
```

**Integration:** Add after status badges in PO detail page header (after line 238).

#### Data Requirement
Fetch closure audit event when status = 'closed':

```typescript
const { data: closureEvent } = await supabase
  .from('audit_logs')
  .select('changed_at, changed_by_name')
  .eq('entity_type', 'purchase_orders')
  .eq('entity_id', poId)
  .eq('action', 'close')
  .order('changed_at', { ascending: false })
  .limit(1)
  .single();
```

## Data Flow: Complete Three-Way Match

### Missing Piece: Stock-In → Received Quantity Updates

**Current state:** Stock-in creates `inventory_transactions` records but doesn't update `received_quantity` fields.

**Required triggers:**

```sql
-- Trigger 1: Update invoice_line_items.received_quantity
-- File: supabase/migrations/050_update_received_quantities.sql (NEW)

CREATE OR REPLACE FUNCTION update_invoice_line_received_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_invoice_line_id UUID;
  new_received_qty DECIMAL(15,2);
BEGIN
  -- Only process inventory_in transactions with invoice_line_item_id
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE')
     AND NEW.movement_type = 'inventory_in'
     AND NEW.invoice_line_item_id IS NOT NULL THEN
    target_invoice_line_id := NEW.invoice_line_item_id;
  ELSIF TG_OP = 'DELETE'
     AND OLD.movement_type = 'inventory_in'
     AND OLD.invoice_line_item_id IS NOT NULL THEN
    target_invoice_line_id := OLD.invoice_line_item_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate total received quantity for this invoice line
  SELECT COALESCE(SUM(quantity), 0)
  INTO new_received_qty
  FROM inventory_transactions
  WHERE invoice_line_item_id = target_invoice_line_id
    AND movement_type = 'inventory_in'
    AND status = 'completed'
    AND is_active = true;

  -- Update invoice line item
  UPDATE invoice_line_items
  SET received_quantity = new_received_qty,
      updated_at = NOW()
  WHERE id = target_invoice_line_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inventory_update_invoice_received ON inventory_transactions;
CREATE TRIGGER inventory_update_invoice_received
  AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_line_received_quantity();
```

```sql
-- Trigger 2: Update po_line_items.received_quantity (aggregate from invoice lines)
CREATE OR REPLACE FUNCTION update_po_line_received_quantity()
RETURNS TRIGGER AS $$
DECLARE
  target_po_line_id UUID;
  new_received_qty DECIMAL(15,2);
BEGIN
  -- Determine target
  IF TG_OP = 'DELETE' THEN
    target_po_line_id := OLD.po_line_item_id;
  ELSE
    target_po_line_id := NEW.po_line_item_id;
  END IF;

  -- Aggregate received_quantity from all invoice line items
  SELECT COALESCE(SUM(received_quantity), 0)
  INTO new_received_qty
  FROM invoice_line_items
  WHERE po_line_item_id = target_po_line_id
    AND is_active = true;

  -- Update PO line item
  UPDATE po_line_items
  SET received_quantity = new_received_qty,
      updated_at = NOW()
  WHERE id = target_po_line_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_line_update_po_received ON invoice_line_items;
CREATE TRIGGER invoice_line_update_po_received
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_line_received_quantity();
```

**Trigger chain:**
```
inventory_transactions (stock-in created)
  → update_invoice_line_received_quantity()
  → invoice_line_items.received_quantity updated
  → update_po_line_received_quantity()
  → po_line_items.received_quantity updated
  → trigger_update_po_status() (EXISTING)
  → purchase_orders.status recalculated
  → create_audit_log() (EXISTING)
  → audit_logs (closure event if status changed to 'closed')
```

### Realtime UI Updates

**Pattern:** React Server Components + TanStack Query hybrid architecture

**Server Component (initial load):**
- PO detail page fetches all data on server
- Renders matching panel, progress bars, lock indicators
- Zero client JS for static content

**Client-side updates (post-stock-in):**
```typescript
// app/(dashboard)/po/[id]/page.tsx
// Wrap in client component for real-time updates

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PODetailPage() {
  const router = useRouter();

  // Refresh data on window focus
  useEffect(() => {
    const handleFocus = () => router.refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [router]);

  // Rest of component...
}
```

**Alternative:** TanStack Query for background polling
```typescript
// If more aggressive refreshing needed
const { data } = useQuery({
  queryKey: ['po', poId],
  queryFn: () => fetchPOData(poId),
  refetchInterval: 30000, // 30 seconds
  refetchOnWindowFocus: true
});
```

**Recommendation:** Start with router.refresh() on window focus. Most users will navigate from stock-in page back to PO detail, triggering automatic refresh. Only add TanStack Query if real-time updates are critical.

**Source:** [React Server Components + TanStack Query: The 2026 Data-Fetching Power Duo](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj)

## Component Architecture

### New Components

| Component | Type | Purpose | Props |
|-----------|------|---------|-------|
| `po-matching-panel.tsx` | Server | Visual three-way comparison table | `lineItems`, `totalOrdered`, `totalInvoiced`, `totalReceived` |
| `po-lock-indicator.tsx` | Server | Lock badge and banner for closed POs | `status`, `closedAt`, `closedBy` |

### Modified Components

| Component | Changes | Reason |
|-----------|---------|--------|
| `po-progress-bar.tsx` | Add `showLegend`, `highlightMismatch` props | Enhanced visual feedback |
| `po/[id]/page.tsx` | Add matching panel, lock indicator, optional client wrapper | Integrate new features |

### Component Hierarchy

```
app/(dashboard)/po/[id]/page.tsx (Server Component, optionally wrapped in client)
├─ POStatusBadge (existing)
├─ ApprovalStatusBadge (existing)
├─ POLockIndicator (NEW) - when status='closed'
├─ Financial Summary Panel (existing)
├─ POMatchingPanel (NEW) - when status != 'not_started'
├─ POProgressBar (modified) - enhanced with legend
└─ Tabs
   ├─ Details
   ├─ Line Items (ReadonlyLineItemsTable with progress)
   ├─ Invoices
   └─ History (shows closure audit event)
```

## Database Schema Changes

### Required Migration

**File:** `supabase/migrations/050_update_received_quantities.sql`

**Changes:**
1. Create `update_invoice_line_received_quantity()` function
2. Create trigger on `inventory_transactions` AFTER INSERT/UPDATE/DELETE
3. Create `update_po_line_received_quantity()` function
4. Create trigger on `invoice_line_items` AFTER INSERT/UPDATE/DELETE

**No table structure changes.** All required columns already exist:
- `invoice_line_items.received_quantity` (line 23, `022_invoice_line_items.sql`)
- `po_line_items.received_quantity` (line 17, `016_po_line_items.sql`)
- `inventory_transactions.invoice_line_item_id` (line 76, `023_inventory_transactions.sql`)

**Testing triggers:**
```sql
-- Test: Create stock-in transaction
INSERT INTO inventory_transactions (
  movement_type, item_id, warehouse_id, quantity,
  invoice_line_item_id, created_by
) VALUES (
  'inventory_in', 'item-uuid', 'warehouse-uuid', 10.00,
  'invoice-line-uuid', 'user-uuid'
);

-- Verify: Check invoice_line_items.received_quantity updated
SELECT received_quantity FROM invoice_line_items WHERE id = 'invoice-line-uuid';
-- Expected: 10.00

-- Verify: Check po_line_items.received_quantity updated
SELECT received_quantity FROM po_line_items WHERE id = (
  SELECT po_line_item_id FROM invoice_line_items WHERE id = 'invoice-line-uuid'
);
-- Expected: 10.00

-- Verify: Check PO status recalculated
SELECT status FROM purchase_orders WHERE id = (
  SELECT po_id FROM po_line_items WHERE id = (...)
);
-- Expected: 'partially_received' or 'closed' depending on quantities
```

## Build Order & Dependencies

### Phase 1: Database Foundation (Prerequisite)
**Goal:** Complete three-way match calculation

1. Create migration `050_update_received_quantities.sql`
2. Write and test trigger functions
3. Deploy to development database
4. Verify trigger chain with test data

**Dependencies:** None (uses existing tables)

**Validation:**
- Stock-in creates inventory transaction
- Invoice line `received_quantity` updates automatically
- PO line `received_quantity` updates automatically
- PO status recalculates to 'closed' when fully matched

### Phase 2: Visual Matching Panel
**Goal:** Display three-way comparison

1. Create `components/po/po-matching-panel.tsx`
2. Design comparison table layout
3. Add color coding (amber/emerald)
4. Integrate into PO detail page

**Dependencies:** Phase 1 complete (received quantities accurate)

**Integration point:** After line 334 in `app/(dashboard)/po/[id]/page.tsx`

### Phase 3: Enhanced Progress Bars
**Goal:** Improve visual feedback

1. Modify `components/po/po-progress-bar.tsx`
2. Add legend, mismatch highlighting
3. Update usage in PO detail page

**Dependencies:** None (existing data sufficient)

### Phase 4: Lock Mechanism
**Goal:** Visual indicators for closed POs

1. Create `components/po/po-lock-indicator.tsx`
2. Query closure audit event when status='closed'
3. Display lock badge and banner
4. Integrate into PO detail header

**Dependencies:** None (audit logs already capture closure)

**Integration point:** After line 238 in `app/(dashboard)/po/[id]/page.tsx`

### Phase 5: Realtime Updates (Optional)
**Goal:** Auto-refresh after stock-in

1. Convert PO detail to client component (or wrap)
2. Add router.refresh() on window focus
3. Test navigation flow: stock-in → back to PO detail

**Dependencies:** Phases 1-4 complete

**Alternative:** TanStack Query for background polling (if needed)

## Architectural Patterns & Best Practices

### 1. Server Components First

**Principle:** Keep components as Server Components unless interactivity required.

**Application:**
- `POMatchingPanel`: Server Component (no state, pure display)
- `POLockIndicator`: Server Component (no state)
- `POProgressBar`: Already client component (uses animations), but could be server
- PO detail page: Start as Server Component, convert to client only if realtime needed

**Benefits:** Zero JS for non-interactive UI, faster initial render.

### 2. Cascading Triggers Pattern

**Principle:** Database triggers update aggregations automatically, maintaining consistency.

**Application:**
- Stock-in → Invoice line received qty → PO line received qty → PO status → Audit log
- Each trigger responsible for one level of aggregation
- No application code needed for calculations

**Benefits:** Consistency guaranteed, works even with direct DB access, audit trail automatic.

**Caveat:** Trigger debugging requires SQL knowledge. Add logging for production troubleshooting.

### 3. Trigger Deduplication

**Principle:** Prevent duplicate audit entries when application and trigger both try to log.

**Application:**
- Status change audit uses 2-second time window deduplication (line 222-237, `048_status_update_with_note.sql`)
- RPC function `update_status_with_note()` creates audit entry before UPDATE
- Trigger checks for recent entry, skips if found

**Benefits:** Clean audit log, supports both manual and automatic status changes.

**Extension:** Use same pattern if adding manual closure button (though auto-closure via triggers is preferred).

### 4. Snapshot Pattern

**Principle:** Preserve historical data at transaction time.

**Application:**
- PO line items snapshot item name/SKU (lines 32-46, `016_po_line_items.sql`)
- Invoice line items snapshot PO unit price for reference (line 112-114, `022_invoice_line_items.sql`)
- Audit logs preserve old/new values (JSONB columns)

**Benefits:** Historical accuracy even if master data changes.

**Matching panel use:** Display snapshotted item names, not current item names.

### 5. Soft Delete & Void Pattern

**Principle:** Never hard delete financial/audit data.

**Application:**
- `is_active` flag for soft delete (items, categories, etc.)
- `is_voided` flag for financial records (invoices)
- Voided invoices excluded from calculations (line 189, `022_invoice_line_items.sql`)

**Benefits:** Audit trail intact, reversible actions, historical reporting accurate.

**Matching panel:** Only show active/non-voided records in calculations.

## Anti-Patterns to Avoid

### 1. Client-Side Status Calculation

**Anti-pattern:** Fetching line items in browser and calculating status in React.

**Why bad:**
- Race conditions (data changes during calculation)
- Inconsistent with database state
- Performance impact on large POs

**Correct approach:** Database triggers calculate, UI displays.

### 2. Manual Status Updates

**Anti-pattern:** Adding "Close PO" button that sets status='closed' directly.

**Why bad:**
- Defeats purpose of three-way match validation
- Can create data inconsistency (status='closed' but quantities mismatched)
- Bypasses audit trail

**Correct approach:** Let triggers automatically close when quantities match. If manual intervention needed, use approval_status or separate flag.

### 3. Polling on Every Component

**Anti-pattern:** Every component independently polls for updates.

**Why bad:**
- Excessive API calls
- Inconsistent UI (components update at different times)
- Battery/bandwidth waste

**Correct approach:** Single refresh point (page level) or TanStack Query with global cache.

### 4. Bypassing Trigger Chain

**Anti-pattern:** Updating `po_line_items.received_quantity` directly from stock-in API.

**Why bad:**
- Skips audit logging
- Breaks if stock-in is voided/deleted
- Doesn't handle edge cases (multiple stock-ins per invoice line)

**Correct approach:** Triggers aggregate from source of truth (inventory_transactions).

## Scalability Considerations

### At Current Scale (< 1000 POs/month)

**Trigger performance:** Negligible impact. Each stock-in triggers 4 updates (invoice line, PO line, PO status, audit log).

**Query performance:** Matching panel query joins 3 tables (PO lines, items, progress data). With indexes on `po_id`, `item_id`, this is O(n) where n = line items per PO (typically < 50).

**UI performance:** Server Components eliminate client-side calculation overhead.

### At Medium Scale (10,000 POs/month)

**Trigger performance:** Still acceptable. Triggers execute synchronously but are fast (< 10ms per trigger).

**Query performance:** Add materialized view for PO summary data if detail page becomes slow:

```sql
CREATE MATERIALIZED VIEW po_summary AS
SELECT
  po_id,
  SUM(quantity) as total_ordered,
  SUM(invoiced_quantity) as total_invoiced,
  SUM(received_quantity) as total_received
FROM po_line_items
WHERE is_active = true
GROUP BY po_id;

-- Refresh on trigger or schedule
REFRESH MATERIALIZED VIEW CONCURRENTLY po_summary;
```

**UI performance:** Consider Redis caching for frequently accessed PO details.

### At Large Scale (100,000+ POs/month)

**Trigger performance:** May need optimization:
- Batch trigger execution (process multiple rows at once)
- Async trigger execution (queue updates, process in background)
- Denormalize further (cache status on PO record, recalculate periodically)

**Query performance:**
- Partition `inventory_transactions` table by date
- Use read replicas for reporting queries
- Cache matching panel data (invalidate on update)

**UI performance:**
- CDN for static assets
- Edge functions for PO detail API
- Lazy load matching panel (only when tab opened)

## References & Sources

### Official Documentation
- [PostgreSQL Triggers](https://www.postgresql.org/docs/current/trigger-definition.html)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc)

### Industry Patterns
- [Three-Way Match Process](https://lassosupplychain.com/resources/blog/understanding-three-way-match-purchase-order-invoice-receipt/) - Understanding PO, invoice, and receipt matching
- [3-Way Match | Amazon Business](https://business.amazon.com/en/solutions/streamlined-purchasing/3-way-match) - Real-world implementation example
- [Three-Way Matching | NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml) - Accounting best practices

### Technical Architecture
- [React Server Components (RSC): 2026 Guide](https://www.grapestechsolutions.com/blog/react-server-components-explained/)
- [React Server Components + TanStack Query: The 2026 Data-Fetching Power Duo](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj)
- [Next.js Architecture in 2026](https://www.yogijs.tech/blog/nextjs-project-architecture-app-router)
- [PostgreSQL Triggers: Everything You Need to Know](https://www.enterprisedb.com/postgres-tutorials/everything-you-need-know-about-postgresql-triggers)

### QM System Codebase
- `supabase/migrations/016_po_line_items.sql` - PO line items with tracking fields
- `supabase/migrations/022_invoice_line_items.sql` - Invoice line items with PO linkage
- `supabase/migrations/023_inventory_transactions.sql` - Stock-in records
- `supabase/migrations/048_status_update_with_note.sql` - Audit trigger deduplication
- `lib/utils/po-status.ts` - Status configuration and helpers
- `components/po/po-progress-bar.tsx` - Existing progress visualization
- `app/(dashboard)/po/[id]/page.tsx` - PO detail page implementation

---

**Document Status:** Complete - HIGH Confidence
**Last Updated:** 2026-02-03
**Reviewed By:** GSD Researcher Agent
