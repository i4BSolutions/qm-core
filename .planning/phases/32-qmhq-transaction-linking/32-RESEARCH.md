# Phase 32: QMHQ Transaction Linking - Research

**Researched:** 2026-02-11
**Domain:** Database foreign key propagation and UI data visualization
**Confidence:** HIGH

## Summary

Phase 32 links stock-out transactions to their parent QMHQ via qmhq_id FK propagation. The existing architecture already supports this linking through the approval dialog (which creates pending inventory_transactions with qmhq_id), but the QMHQ detail page UI needs enhancements to display these linked transactions grouped by their parent Stock-Out Request (SOR) with a rich quantity breakdown visualization.

The core integration point is in `components/stock-out-requests/approval-dialog.tsx` (line 323), which already sets `qmhq_id` when creating pending transactions. The research confirms no database schema changes are needed; this is purely a UI presentation enhancement to surface existing FK relationships.

**Primary recommendation:** Enhance the QMHQ Stock Out tab with SOR-grouped transaction display and implement a stepped progress bar component showing the full fulfillment pipeline (Requested → Approved → Executed → Pending).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transaction grouping on Stock Out tab:**
- Group transactions by their parent Stock-Out Request (SOR)
- Each SOR group has a compact header: SOR ID + status badge + total qty from that SOR
- SOR group headers link to SOR detail page
- Groups are always expanded (no accordion/collapse interaction)
- Remove the standalone Stock-Out Request Card — SOR info now lives in the group headers

**Items Summary breakdown:**
- Full qty breakdown per item: Requested → Approved → Executed → Pending
- Display as a stepped progress bar visualization (funnel-style)
- Color-coded segments: gray=requested, blue=approved, green=executed
- Rejected items still appear in the Items Summary with a 'Rejected' badge (full transparency)

**Empty state behavior:**
- When no linked stock-out transactions exist, show empty state message with 'Request Stock-Out' CTA button
- SOR groups only appear once transactions exist (don't show pending/unapproved SORs without transactions)

### Claude's Discretion

- Exact progress bar segment widths and styling
- Transaction row columns and density within each SOR group
- How to handle the FK propagation mechanism (trigger vs application-level)
- Legacy transaction handling (existing transactions without qmhq_id)
- Navigation link styling between entities

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 14+ (App Router) | Frontend framework | Project standard per CLAUDE.md |
| React | 18+ | UI library | Next.js dependency |
| TypeScript | 5+ | Type safety | Project standard |
| Supabase | Latest | Database + client | Project standard for PostgreSQL access |
| Tailwind CSS | 3+ | Styling | Project standard per CLAUDE.md |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | Latest | Icons | Already in use project-wide |
| cn (class-variance-authority) | Latest | Conditional classes | Already in @/lib/utils |
| sonner | Latest | Toast notifications | Already in use for user feedback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom progress bar | react-step-progress-bar | Third-party dependency overhead; custom implementation gives exact control for funnel visualization |
| Material UI Accordion | Custom expand/collapse | User decision: always-expanded groups, so accordion not needed |
| DevExtreme List Groups | Custom grouping | User decision: custom SOR grouping logic, not generic list grouping |

**Installation:**
```bash
# No new dependencies required — all libraries already in project
```

## Architecture Patterns

### Recommended Project Structure

```
app/(dashboard)/qmhq/[id]/
  └── page.tsx                    # MODIFY: Stock Out tab UI enhancement

components/qmhq/
  └── fulfillment-progress-bar.tsx  # EXISTS: Extend for stepped segments
  └── sor-transaction-group.tsx     # NEW: SOR group header + transactions
  └── items-summary-progress.tsx    # NEW: Multi-segment progress bar
```

### Pattern 1: FK Propagation in Approval Dialog

**What:** Copy `qmhq_id` from stock_out_request to inventory_transaction when creating pending transactions.

**When to use:** During approval creation in `approval-dialog.tsx`.

**Current Implementation:**
```typescript
// components/stock-out-requests/approval-dialog.tsx (lines 314-327)
const { error: transactionError } = await supabase
  .from("inventory_transactions")
  .insert({
    movement_type: "inventory_out",
    item_id: item.item_id,
    warehouse_id: warehouseId,
    quantity: approvedQty,
    reason: requestReason as "request" | "consumption" | "damage" | "lost" | "transfer" | "adjustment",
    stock_out_approval_id: approvalRecord.id,
    qmhq_id: qmhqId || null,  // FK propagation already implemented
    status: "pending",
    created_by: user.id,
  });
```

**Source:** `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` (line 323)

**Confidence:** HIGH — Verified in existing codebase.

### Pattern 2: SOR-Grouped Transaction Display

**What:** Group inventory_transactions by their parent stock_out_request, showing compact headers with aggregate info.

**When to use:** In QMHQ Stock Out tab to organize transactions by their approval workflow.

**Implementation Pattern:**
```typescript
// Fetch transactions with SOR relationship
const { data: transactions } = await supabase
  .from('inventory_transactions')
  .select(`
    *,
    item:items(id, name, sku),
    warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name),
    approval:stock_out_approvals(
      id,
      approval_number,
      line_item:stock_out_line_items(
        id,
        request:stock_out_requests(id, request_number, status)
      )
    )
  `)
  .eq('qmhq_id', qmhqId)
  .eq('movement_type', 'inventory_out')
  .eq('is_active', true);

// Group by SOR request_number
const groupedBySOR = transactions.reduce((groups, tx) => {
  const sorNumber = tx.approval?.line_item?.request?.request_number;
  if (!sorNumber) return groups;

  if (!groups[sorNumber]) {
    groups[sorNumber] = {
      request: tx.approval.line_item.request,
      transactions: [],
      totalQty: 0
    };
  }

  groups[sorNumber].transactions.push(tx);
  groups[sorNumber].totalQty += tx.quantity;

  return groups;
}, {});
```

**Source:** Adapted from existing QMHQ page query pattern (app/(dashboard)/qmhq/[id]/page.tsx lines 212-222) and approval-dialog relationship traversal.

**Confidence:** HIGH — Pattern already used in codebase for similar joins.

### Pattern 3: Stepped Progress Bar Visualization

**What:** Multi-segment horizontal bar showing Requested → Approved → Executed → Pending quantities with color-coded segments.

**When to use:** Items Summary section to show full fulfillment pipeline visibility.

**Visual Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ [████ Gray 20] [████ Blue 15] [████ Green 10] [▒▒ Amber 5] │
│  Requested      Approved        Executed        Pending     │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Pattern:**
```typescript
interface ProgressSegment {
  label: string;
  value: number;
  color: string;  // Tailwind color class
  percentage: number;
}

function calculateSegments(
  requested: number,
  approved: number,
  executed: number
): ProgressSegment[] {
  const pending = approved - executed;
  const rejected = requested - approved;

  const segments = [
    { label: 'Requested', value: requested, color: 'bg-slate-500', percentage: 100 },
    { label: 'Approved', value: approved, color: 'bg-blue-500', percentage: (approved / requested) * 100 },
    { label: 'Executed', value: executed, color: 'bg-emerald-500', percentage: (executed / requested) * 100 },
  ];

  if (pending > 0) {
    segments.push({
      label: 'Pending',
      value: pending,
      color: 'bg-amber-500',
      percentage: (pending / requested) * 100
    });
  }

  return segments;
}

// Render as stacked div segments
<div className="relative h-8 w-full bg-slate-800 rounded-lg overflow-hidden">
  {segments.map((seg, idx) => (
    <div
      key={idx}
      className={`absolute h-full ${seg.color} transition-all`}
      style={{
        left: `${idx > 0 ? segments.slice(0, idx).reduce((sum, s) => sum + s.percentage, 0) : 0}%`,
        width: `${seg.percentage}%`
      }}
    />
  ))}
</div>
```

**Source:** Inspired by existing FulfillmentProgressBar component (components/qmhq/fulfillment-progress-bar.tsx) extended for multi-segment display. Similar patterns found in [react-step-progress-bar](https://pierreericgarcia.github.io/react-step-progress-bar/docs/first-steps).

**Confidence:** MEDIUM — Existing component provides foundation; segmented layout is new but follows standard CSS stacking patterns.

### Anti-Patterns to Avoid

- **Fetching SORs without transactions:** Don't show empty SOR groups. Per user decision, only show groups when transactions exist.
- **Accordion/collapse UI:** User decided groups are always expanded. Don't add toggle state or collapse functionality.
- **Hardcoded status colors:** Use status_config table colors where possible; only use fixed colors for quantity states (pending/executed).
- **Null qmhq_id handling at query level:** Handle legacy transactions (without qmhq_id) gracefully by filtering in query, not hiding errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status badge rendering | Custom badge component | Existing ClickableStatusBadge or Badge | Already handles status colors from DB |
| Currency display | Manual formatting | Existing CurrencyDisplay component | Handles exchange rates + EUSD conversion |
| Date formatting | Custom formatters | Existing formatDate utils or Intl.DateTimeFormat | Consistent formatting project-wide |
| Toast notifications | Custom modals | sonner (already in use) | User feedback consistency |

**Key insight:** The QM System has established patterns for entity detail pages (QMRL, QMHQ, PO, Invoice all follow similar tab structures). Reuse these patterns rather than inventing new UI paradigms.

## Common Pitfalls

### Pitfall 1: Missing qmhq_id on Legacy Transactions

**What goes wrong:** Existing inventory_transactions created before Phase 32 may have NULL qmhq_id even when linked to a QMHQ.

**Why it happens:** FK propagation only occurs going forward. Historical data predates the implementation.

**How to avoid:**
1. Query should filter `qmhq_id IS NOT NULL` explicitly if needed
2. Alternatively, use fallback query via stock_out_approval_id → line_item → request → qmhq_id join path

**Warning signs:** Stock Out tab shows "0 transactions" when you know stock-outs were executed.

**Verification:**
```sql
-- Check for orphaned transactions (linked to SOR but missing qmhq_id)
SELECT it.id, it.qmhq_id, sor.qmhq_id as sor_qmhq_id
FROM inventory_transactions it
JOIN stock_out_approvals soa ON it.stock_out_approval_id = soa.id
JOIN stock_out_line_items soli ON soa.line_item_id = soli.id
JOIN stock_out_requests sor ON soli.request_id = sor.id
WHERE it.qmhq_id IS NULL AND sor.qmhq_id IS NOT NULL;
```

**Confidence:** HIGH — This is a known pattern when adding FK links to existing systems.

### Pitfall 2: SOR Status Badge Stale After Transaction Execution

**What goes wrong:** SOR status shown in group header doesn't update after executing transactions from QMHQ page.

**Why it happens:** Status is computed by trigger on stock_out_line_items table, but UI caches SOR data fetched at page load.

**How to avoid:**
1. Refetch data after execution dialog success
2. Use URL param `?updated=timestamp` to trigger refetch (pattern already used in codebase)

**Warning signs:** Status shows "approved" but transactions are "completed" (should show "executed").

**Source:** Similar pattern in app/(dashboard)/qmhq/[id]/page.tsx (line 114): `updatedParam` triggers refetch.

**Confidence:** HIGH — Verified refetch pattern already in use.

### Pitfall 3: Group Header Aggregate Doesn't Match Transaction Sum

**What goes wrong:** SOR header shows "Total Qty: 20" but summing visible transactions gives 15.

**Why it happens:**
1. Filtering transactions by status/is_active but not applying same filter to aggregate
2. Multiple approvals per line item — some transactions may be from different approvals for same SOR

**How to avoid:** Calculate aggregate from the SAME filtered dataset displayed in group, not from a separate query.

```typescript
// WRONG: Separate aggregate query
const { data: totalQty } = await supabase.rpc('get_sor_total_qty', { sor_id });

// RIGHT: Aggregate from filtered transaction list
const totalQty = groupTransactions.reduce((sum, tx) => sum + tx.quantity, 0);
```

**Warning signs:** Header totals inconsistent with visible rows; numbers change when filtering.

**Confidence:** HIGH — Common aggregation mismatch pattern in grouped displays.

### Pitfall 4: Progress Bar Segment Overflow (>100%)

**What goes wrong:** Stepped progress bar shows segments totaling >100% width or overlapping.

**Why it happens:**
1. Data inconsistency (approved > requested due to data bug)
2. Calculation error in percentage math
3. Rejected items counted twice (once in requested, once as separate segment)

**How to avoid:**
1. Cap each segment at its logical max: `Math.min(approved, requested)`
2. Use cumulative percentage positioning, not independent widths
3. Validate data integrity: `approved <= requested` before rendering

**Warning signs:** Segments extend beyond container; colors overlap; total percentage ≠ 100%.

**Confidence:** MEDIUM — Standard progress bar pitfall, mitigated by validation.

### Pitfall 5: Empty State CTA Button Disabled When It Should Be Enabled

**What goes wrong:** "Request Stock-Out" button is disabled even when QMHQ has requested items.

**Why it happens:**
1. Permission check `can('create', 'stock_out_request')` fails
2. QMHQ has no qmhq_items (legacy single-item QMHQ)
3. All items already fully executed (button should be disabled in this case)

**How to avoid:**
1. Check both qmhq_items table AND legacy item_id field for item data
2. Only enable if: user has permission AND items exist AND not fully executed
3. Show tooltip explaining why button is disabled

**Warning signs:** User complains they can't create stock-out when they should be able to.

**Confidence:** MEDIUM — Common permission + state check pitfall.

## Code Examples

Verified patterns from official sources and existing codebase:

### Example 1: Fetching Transactions with SOR Relationship

```typescript
// Source: app/(dashboard)/qmhq/[id]/page.tsx (lines 210-230) — ENHANCED
const { data: stockOutData, error: stockOutError } = await supabase
  .from('inventory_transactions')
  .select(`
    *,
    item:items(id, name, sku),
    warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name),
    stock_out_approval:stock_out_approvals(
      id,
      approval_number,
      approved_quantity,
      decided_at,
      line_item:stock_out_line_items(
        id,
        requested_quantity,
        status,
        request:stock_out_requests(
          id,
          request_number,
          status,
          reason
        )
      )
    )
  `)
  .eq('qmhq_id', qmhqData.id)
  .eq('movement_type', 'inventory_out')
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```

**Confidence:** HIGH — Direct enhancement of existing query pattern.

### Example 2: SOR Transaction Group Component

```tsx
// components/qmhq/sor-transaction-group.tsx (NEW)
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface SORTransactionGroupProps {
  sorNumber: string;
  sorId: string;
  sorStatus: string;
  totalQty: number;
  transactions: InventoryTransaction[];
}

export function SORTransactionGroup({
  sorNumber,
  sorId,
  sorStatus,
  totalQty,
  transactions
}: SORTransactionGroupProps) {
  const statusColors = {
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    executed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="space-y-3">
      {/* SOR Group Header */}
      <div className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3">
          <Link
            href={`/inventory/stock-out-requests/${sorId}`}
            className="font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            {sorNumber}
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Badge className={statusColors[sorStatus] || 'bg-slate-500/20 text-slate-400'}>
            {sorStatus}
          </Badge>
        </div>
        <div className="text-sm text-slate-400">
          Total Qty: <span className="font-mono text-slate-200">{totalQty}</span>
        </div>
      </div>

      {/* Transactions in this SOR */}
      <div className="space-y-2 pl-4">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between p-2 rounded bg-slate-800/20 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-300">{tx.item?.name}</span>
              {tx.item?.sku && (
                <code className="text-xs text-amber-400">{tx.item.sku}</code>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">{tx.warehouse?.name}</span>
              <span className="font-mono text-sm text-slate-200">{tx.quantity}</span>
              <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                {tx.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Source:** Pattern derived from existing Badge and Link usage in QMHQ detail page. Component structure follows project conventions.

**Confidence:** HIGH — Follows established component patterns.

### Example 3: Items Summary with Stepped Progress Bar

```tsx
// components/qmhq/items-summary-progress.tsx (NEW)
interface ItemProgressData {
  itemId: string;
  itemName: string;
  itemSku: string | null;
  requested: number;
  approved: number;
  executed: number;
  rejected: number;
}

export function ItemsSummaryProgress({ items }: { items: ItemProgressData[] }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Items Summary
      </h3>

      {items.map((item) => {
        const pending = item.approved - item.executed;
        const total = item.requested;

        return (
          <div key={item.itemId} className="space-y-2">
            {/* Item header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.itemSku && (
                  <code className="text-xs text-amber-400">{item.itemSku}</code>
                )}
                <span className="text-sm text-slate-200">{item.itemName}</span>
                {item.rejected > 0 && (
                  <Badge variant="outline" className="border-red-500/30 text-red-400">
                    Rejected: {item.rejected}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {item.executed}/{item.requested}
              </span>
            </div>

            {/* Stepped progress bar */}
            <div className="relative h-6 w-full bg-slate-800/50 rounded-lg overflow-hidden">
              {/* Requested baseline (full width) */}
              <div className="absolute inset-0 bg-slate-600/30" />

              {/* Approved segment */}
              {item.approved > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-blue-500/40 transition-all"
                  style={{ width: `${(item.approved / total) * 100}%` }}
                />
              )}

              {/* Executed segment */}
              {item.executed > 0 && (
                <div
                  className="absolute left-0 top-0 h-full bg-emerald-500 transition-all"
                  style={{ width: `${(item.executed / total) * 100}%` }}
                />
              )}

              {/* Labels overlay */}
              <div className="absolute inset-0 flex items-center justify-between px-2 text-xs font-medium">
                <span className="text-slate-300">Requested: {item.requested}</span>
                <div className="flex gap-3">
                  <span className="text-blue-300">Approved: {item.approved}</span>
                  <span className="text-emerald-300">Executed: {item.executed}</span>
                  {pending > 0 && (
                    <span className="text-amber-300">Pending: {pending}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Source:** Enhanced version of FulfillmentProgressBar (components/qmhq/fulfillment-progress-bar.tsx) with multi-segment stacking.

**Confidence:** MEDIUM — New component but uses existing progress bar patterns as foundation.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual qmhq_id setting | FK propagation via approval dialog | Phase 32 (v1.7) | Transactions automatically linked to QMHQ |
| Single progress bar (issued/requested) | Multi-segment pipeline visualization | Phase 32 (v1.7) | Full visibility into approval → execution stages |
| Flat transaction list | SOR-grouped transaction display | Phase 32 (v1.7) | Better traceability and organization |
| Query by qmhq_id only | Query by qmhq_id + join via approval FK | Phase 32 (v1.7) | Handles both new and legacy data |

**Deprecated/outdated:**
- **Legacy QMHQ auto-stock-out trigger:** Migration 034_qmhq_auto_stockout.sql created automatic stock-outs when QMHQ was created. This is now DEPRECATED in favor of explicit SOR workflow. Existing transactions created by trigger will have qmhq_id but no stock_out_approval_id.

## Open Questions

1. **Legacy Transaction Backfill**
   - What we know: Existing transactions may lack qmhq_id even when linked via SOR
   - What's unclear: Should we run a data migration to backfill qmhq_id on historical transactions?
   - Recommendation: NOT in Phase 32 scope. Query pattern should handle both cases. Consider backfill in future maintenance phase if performance becomes issue.

2. **Multi-QMHQ SORs**
   - What we know: stock_out_requests.qmhq_id is nullable (supports manual SORs without QMHQ)
   - What's unclear: Can one SOR link to multiple QMHQs? (Schema says no — 1:1 via unique index)
   - Recommendation: Confirm with user that 1:1 relationship is correct. If multiple QMHQs need same items, create separate SORs.

3. **Rejected Items in Progress Bar**
   - What we know: User wants rejected items visible with 'Rejected' badge
   - What's unclear: Should rejected quantity subtract from "Requested" baseline or appear as separate segment?
   - Recommendation: Show as badge next to item name (not as bar segment) to avoid visual clutter. Baseline remains "Requested" (includes rejected).

4. **Empty State CTA Permission Logic**
   - What we know: Button should appear when no transactions exist
   - What's unclear: What permission check? Same as SOR creation (admin/quartermaster/inventory only)?
   - Recommendation: Use same RLS policy as stock_out_requests INSERT (admin/quartermaster/inventory). Button disabled if user lacks permission.

## Sources

### Primary (HIGH confidence)

- `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` - SOR schema
- `/home/yaungni/qm-core/supabase/migrations/023_inventory_transactions.sql` - Transaction table with qmhq_id FK
- `/home/yaungni/qm-core/supabase/migrations/053_stock_out_validation.sql` - Status computation trigger
- `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` - FK propagation implementation (line 323)
- `/home/yaungni/qm-core/app/(dashboard)/qmhq/[id]/page.tsx` - Existing QMHQ detail page structure and query patterns
- `/home/yaungni/qm-core/components/qmhq/fulfillment-progress-bar.tsx` - Existing progress bar component
- `/home/yaungni/qm-core/.planning/research/ARCHITECTURE-per-line-execution.md` - Architecture documentation for SOR execution flow

### Secondary (MEDIUM confidence)

- [React Step Progress Bar](https://pierreericgarcia.github.io/react-step-progress-bar/docs/first-steps) - Segmented progress bar patterns
- [Material UI Accordion](https://mui.com/material-ui/react-accordion/) - Collapsible group patterns (evaluated but not used per user decision)
- [DevExtreme React List Grouping](https://js.devexpress.com/React/Documentation/Guide/UI_Components/List/Grouping/Expand_and_Collapse_a_Group/) - Group header patterns

### Tertiary (LOW confidence)

None — all findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project
- Architecture: HIGH - FK propagation verified in code; UI patterns match existing components
- Pitfalls: HIGH - Legacy data handling, status staleness, and aggregate mismatches are well-documented patterns

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days for stable project)

---

## Additional Notes

### Database Triggers Already Support This Pattern

The existing `update_sor_line_item_execution_status()` trigger (migration 053, lines 309-370) already computes line item status by aggregating across ALL approvals for a line item. This means the FK link works correctly for status updates when transactions are executed from QMHQ page — no trigger changes needed.

### Component Reuse Opportunities

The project has strong patterns for entity detail pages:
- Tabs component (Details, History, Attachments)
- Badge for status display
- CurrencyDisplay for financial amounts
- ClickableStatusBadge for status changes

The Stock Out tab should follow these patterns for consistency.

### Performance Consideration

Fetching transactions with deep joins (transaction → approval → line_item → request) could be slow for QMHQs with many stock-outs. Consider:
1. Index on `inventory_transactions.qmhq_id` (already exists per migration 023, line 126)
2. Index on `stock_out_approvals.line_item_id` (already exists per migration 052, line 154)
3. Paginate if transaction count > 50 (unlikely for single QMHQ, but good practice)

Current query pattern (direct FK filter on qmhq_id) is optimal. Join path is only for display, not filtering.
