# Phase 13: Verification & Quick Fixes - Research

**Researched:** 2026-02-02
**Domain:** Verification testing, RLS policy validation, UI permission logic, progress indicators
**Confidence:** HIGH

## Summary

Phase 13 verifies two already-deployed feature areas: (1) attachment deletion with RLS-based permissions, and (2) QMHQ item route fulfillment tracking with stock-out restrictions. Research confirms that foundational components exist but reveals specific gaps requiring fixes.

**Current state:**
- RLS policy migration 037 allows users to delete own uploads (via `uploaded_by = auth.uid()`)
- UI permission check in QMHQ/QMRL detail pages uses admin/quartermaster-only logic (`canEditAttachments`)
- Stock-out tab exists (lines 712-837 in QMHQ detail) with fulfillment tracking per item
- General stock-out form defaults to "request" reason when `qmhq` param exists, but doesn't filter items
- No progress bar component exists for QMHQ fulfillment (PO progress bar exists but not reusable)

**Gap analysis:**
1. UI permission check doesn't match RLS policy (UI restricts to admin/quartermaster, RLS allows users to delete own files)
2. General stock-out form shows all items, doesn't restrict to manual reasons only
3. No fulfillment progress indicator in QMHQ detail header
4. No "Issue Stock" button with disabled state for fully fulfilled items

**Primary recommendation:** Fix UI permission logic to check uploader ownership, filter QMHQ items from general stock-out, add progress indicator component for fulfillment tracking.

## Standard Stack

The established libraries/tools for this verification phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase RLS | PostgreSQL 15+ | Row-level security policies | Already used for all data access control |
| Next.js Server Actions | 14+ | Server-side permission checks | Pattern established in `lib/actions/files.ts` |
| Tailwind CSS | 3.x | UI styling and color system | Project standard, existing progress bar patterns |
| TypeScript | 5.x | Type safety for permission logic | Prevents runtime permission errors |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-day-picker | 8.x | Date picker (via shadcn/ui) | Already integrated, not modified in this phase |
| lucide-react | Latest | Icons for progress indicators | Consistent with existing UI (CheckCircle2, Package icons) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual testing | Automated tests (Playwright) | Manual sufficient for verification phase, automated overkill for 5 success criteria |
| Database query for fulfillment | Client calculation | Database query more accurate but adds latency; client calculation from stock-out transactions is acceptable |
| Separate progress component | Reuse PO progress bar | PO progress has dual bars (invoiced/received); QMHQ needs single fulfillment bar - separate component cleaner |

**Installation:**
```bash
# No new dependencies needed
# All verification work uses existing stack
```

## Architecture Patterns

### Recommended Fix Structure
```
Phase 13 fixes follow existing codebase patterns:

RLS Policy Verification:
1. Check migration 037 (already correct)
2. Fix UI logic in detail pages

UI Permission Logic:
1. Read file.uploaded_by from FileAttachmentWithUploader
2. Compare to user.id from useAuth()
3. Show delete if: user.role in ['admin', 'quartermaster'] OR file.uploaded_by === user.id

Stock-out Filtering:
1. Modify general stock-out item selector
2. Filter out items linked to active QMHQ (via qmhq_items table)
3. Stock-out tab in QMHQ detail remains unchanged

Progress Indicator:
1. Create FulfillmentProgressBar component (single bar, not dual)
2. Calculate: issued qty / requested qty
3. Place in QMHQ detail header and stock-out tab
```

### Pattern 1: UI Permission Check Matching RLS
**What:** Client-side permission logic mirrors database RLS policy
**When to use:** Anytime delete/edit UI needs to show/hide based on permissions
**Example:**
```typescript
// Source: app/(dashboard)/qmhq/[id]/page.tsx (current - WRONG)
const canEditAttachments = user?.role === 'admin' || user?.role === 'quartermaster';

// Fixed pattern (matches RLS policy from migration 037)
const canDeleteFile = useCallback((file: FileAttachmentWithUploader) => {
  if (!user) return false;
  // Admin and quartermaster can delete any file
  if (user.role === 'admin' || user.role === 'quartermaster') return true;
  // Users can delete their own uploads
  return file.uploaded_by === user.id;
}, [user]);

// Usage in AttachmentsTab
<FileCard
  file={file}
  canDelete={canDeleteFile(file)}
  onDelete={() => handleDeleteClick(file)}
/>
```

### Pattern 2: Fulfillment Progress Calculation
**What:** Calculate issued vs requested quantity from stock-out transactions
**When to use:** Displaying QMHQ item route fulfillment status
**Example:**
```typescript
// Source: app/(dashboard)/qmhq/[id]/page.tsx lines 736-740 (existing)
const issuedQty = stockOutTransactions
  .filter(t => t.item_id === item.item_id)
  .reduce((sum, t) => sum + (t.quantity || 0), 0);
const pendingQty = Math.max(0, item.quantity - issuedQty);
const isFullyIssued = pendingQty === 0;
const progressPercent = Math.round((issuedQty / item.quantity) * 100);
```

### Pattern 3: Progress Bar Component
**What:** Single-bar progress indicator for fulfillment tracking
**When to use:** Showing completion percentage with visual bar
**Example:**
```typescript
// New component: components/qmhq/fulfillment-progress-bar.tsx
// Pattern based on POProgressBar but simplified to single bar
interface FulfillmentProgressBarProps {
  issuedQty: number;
  requestedQty: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function FulfillmentProgressBar({
  issuedQty,
  requestedQty,
  showLabel = true,
  size = "md",
}: FulfillmentProgressBarProps) {
  const percent = Math.round((issuedQty / requestedQty) * 100);
  const heightClass = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-400">Fulfilled</span>
          <span className="text-emerald-400 font-mono">{issuedQty}/{requestedQty}</span>
        </div>
      )}
      <div className={cn("w-full rounded-full bg-slate-700/50", heightClass)}>
        <div
          className={cn(
            "rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 transition-all duration-500",
            heightClass
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
```

### Pattern 4: Item Filtering in General Stock-out
**What:** Exclude items already assigned to QMHQ from general stock-out form
**When to use:** Preventing duplicate stock-out for QMHQ items
**Example:**
```typescript
// Modify: app/(dashboard)/inventory/stock-out/page.tsx
// Fetch items NOT in active QMHQ
const { data: itemsData } = await supabase
  .from("items")
  .select("id, name, sku, default_unit, wac_amount, wac_currency")
  .eq("is_active", true)
  .not('id', 'in', `(
    SELECT DISTINCT item_id
    FROM qmhq_items qi
    JOIN qmhq q ON qi.qmhq_id = q.id
    WHERE q.route_type = 'item'
  )`)
  .order("name");
```

### Anti-Patterns to Avoid
- **Hardcoding user IDs for permission checks:** Always use `auth.uid()` or `user.id` from context
- **Client-only permission logic:** Must match RLS policies to prevent security bypass
- **Calculating fulfillment in SQL trigger:** Keep calculation in application layer for flexibility
- **Reusing PO progress component:** Dual-bar design doesn't fit single-metric fulfillment

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User authentication state | Custom session management | Supabase Auth + AuthProvider | Already integrated, handles refresh tokens, RLS context |
| Permission checks | if/else role checks | RLS policies + matching client logic | Single source of truth, prevents client/server mismatch |
| File ownership check | Custom uploader tracking | file.uploaded_by vs auth.uid() | Built into file_attachments schema, RLS-safe |
| Progress bar styling | Custom CSS animations | Tailwind gradient + transition | Consistent with existing POProgressBar pattern |
| Stock quantity validation | Client-side only | Database constraints + client validation | Prevent race conditions in concurrent stock-outs |

**Key insight:** Permission logic must be duplicated (RLS + client) for security. Client logic shows/hides UI elements, RLS enforces at data layer. Never rely on client-only checks.

## Common Pitfalls

### Pitfall 1: UI Permission Logic Doesn't Match RLS Policy
**What goes wrong:** UI shows delete button only for admin/quartermaster, but RLS policy allows users to delete own files. Result: users can't delete their own uploads even though policy permits it.
**Why it happens:** Migration 037 updated RLS policy but UI logic wasn't updated to match.
**How to avoid:** When RLS policy changes, audit all UI components that show/hide based on permissions. Use verification checklist: "Can user X perform action Y via UI?" vs "Does RLS policy permit it?"
**Warning signs:**
- Comments in CONTEXT.md mention "migration 036" but actual policy is in migration 037
- `canEditAttachments` variable name suggests edit, but actually controls delete visibility
- Single boolean for all files instead of per-file permission check

### Pitfall 2: Filtering Items by QMHQ Association
**What goes wrong:** Using `.not('id', 'in', subquery)` with large datasets causes performance issues or syntax errors.
**Why it happens:** Supabase client `.not()` doesn't support subquery syntax directly.
**How to avoid:** Use RPC function or manual filtering after fetch:
```typescript
// Better approach: Filter in application
const { data: allItems } = await supabase.from("items").select("*");
const { data: qmhqItems } = await supabase.from("qmhq_items")
  .select("item_id")
  .eq("qmhq.route_type", "item");
const qmhqItemIds = new Set(qmhqItems?.map(qi => qi.item_id) || []);
const availableItems = allItems?.filter(item => !qmhqItemIds.has(item.id));
```
**Warning signs:**
- Complex `.not()` queries failing silently
- Items appearing in both general stock-out and QMHQ forms

### Pitfall 3: Calculating Fulfillment from Legacy Single-Item Fields
**What goes wrong:** QMHQ can have items in either `qmhq.item_id` (legacy) or `qmhq_items` table (new). Calculating fulfillment from only one source gives incomplete data.
**Why it happens:** Migration 035 added multi-item support but kept legacy fields for backward compatibility.
**How to avoid:** Query both sources, aggregate results:
```typescript
// Get items from both sources
const legacyItem = qmhq.item_id ? [{ item_id: qmhq.item_id, quantity: qmhq.quantity }] : [];
const qmhqItems = [...legacyItem, ...fetchedQmhqItems];
```
**Warning signs:**
- Fulfillment showing 0% for legacy QMHQ records
- Stock-out transactions not matching displayed items

### Pitfall 4: Progress Bar Showing >100%
**What goes wrong:** If stock-out allows issuing more than requested (due to validation bug), progress bar exceeds 100%.
**Why it happens:** UI validation allows it, or concurrent transactions bypass check.
**How to avoid:** Cap progress at 100% in display, but investigate root cause:
```typescript
const progressPercent = Math.min(100, Math.round((issuedQty / requestedQty) * 100));
```
**Warning signs:**
- Progress bar fills beyond container
- Fulfillment shows "11/10 issued"

### Pitfall 5: "Issue Stock" Button Not Disabled When Fulfilled
**What goes wrong:** Button remains clickable when fully fulfilled, allowing over-issuance.
**Why it happens:** Disabled state checks wrong condition or doesn't update reactively.
**How to avoid:**
```typescript
const isFullyFulfilled = useMemo(() => {
  return qmhqItems.every(item => {
    const issued = stockOutTransactions
      .filter(t => t.item_id === item.item_id)
      .reduce((sum, t) => sum + (t.quantity || 0), 0);
    return issued >= item.quantity;
  });
}, [qmhqItems, stockOutTransactions]);

<Button disabled={isFullyFulfilled} ...>
  {isFullyFulfilled ? "Fully Issued" : "Issue Stock"}
</Button>
```
**Warning signs:**
- Button enabled when all items show "Complete" badge
- Tooltip says "Fully issued" but button still clickable

## Code Examples

Verified patterns from official sources:

### Permission Check Pattern (RLS + Client Match)
```typescript
// Source: Migration 037 + app/(dashboard)/qmhq/[id]/page.tsx (to be fixed)
// Database policy (migration 037_file_attachments_delete_own.sql)
CREATE POLICY file_attachments_update ON public.file_attachments
  FOR UPDATE
  USING (
    public.get_user_role() IN ('admin', 'quartermaster')
    OR uploaded_by = auth.uid()
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'quartermaster')
    OR uploaded_by = auth.uid()
  );

// Client-side equivalent (FIXED)
const canDeleteFile = (file: FileAttachmentWithUploader) => {
  if (!user) return false;
  return (
    user.role === 'admin' ||
    user.role === 'quartermaster' ||
    file.uploaded_by === user.id
  );
};

// Usage in FileCard via AttachmentsTab
<FileCard
  file={file}
  canDelete={canDeleteFile(file)}
  onDelete={() => handleDeleteClick(file)}
/>
```

### Fulfillment Progress Calculation
```typescript
// Source: app/(dashboard)/qmhq/[id]/page.tsx lines 736-740
// Calculate per-item fulfillment status
{qmhqItems.map((item) => {
  const issuedQty = stockOutTransactions
    .filter(t => t.item_id === item.item_id)
    .reduce((sum, t) => sum + (t.quantity || 0), 0);
  const pendingQty = Math.max(0, item.quantity - issuedQty);
  const isFullyIssued = pendingQty === 0;

  return (
    <div key={item.id}>
      <span>Requested: {item.quantity}</span>
      <span>Issued: {issuedQty}</span>
      {!isFullyIssued && <span>Pending: {pendingQty}</span>}
    </div>
  );
})}
```

### Warehouse Stock Display in Selector
```typescript
// Source: app/(dashboard)/inventory/stock-out/page.tsx lines 129-177
// Show available stock per warehouse
const fetchItemStock = async (itemId: string) => {
  const { data: transactions } = await supabase
    .from("inventory_transactions")
    .select(`
      warehouse_id,
      movement_type,
      quantity,
      warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name, location)
    `)
    .eq("item_id", itemId)
    .eq("is_active", true)
    .eq("status", "completed");

  // Calculate stock by warehouse
  const stockMap = new Map<string, WarehouseStock>();
  transactions?.forEach((tx) => {
    const warehouseId = tx.warehouse_id;
    if (!stockMap.has(warehouseId)) {
      stockMap.set(warehouseId, {
        warehouse_id: warehouseId,
        warehouse_name: tx.warehouse?.name || 'Unknown',
        warehouse_location: tx.warehouse?.location || '',
        current_stock: 0,
      });
    }
    const entry = stockMap.get(warehouseId)!;
    entry.current_stock += tx.movement_type === 'inventory_in'
      ? tx.quantity
      : -tx.quantity;
  });

  setItemWarehouses(Array.from(stockMap.values()).filter(w => w.current_stock > 0));
};

// Display in selector
<Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
  {itemWarehouses.map(wh => (
    <SelectItem key={wh.warehouse_id} value={wh.warehouse_id}>
      {wh.warehouse_name} ({wh.current_stock} in stock)
    </SelectItem>
  ))}
</Select>
```

### Delete Confirmation Pattern
```typescript
// Source: components/files/delete-file-dialog.tsx
// User-friendly confirmation with filename display
<DeleteFileDialog
  open={!!fileToDelete}
  onOpenChange={(open) => !open && setFileToDelete(null)}
  filename={fileToDelete?.filename ?? ''}
  onConfirm={handleDeleteConfirm}
  isDeleting={isDeleting}
/>

// Dialog content (lines 63-68)
<DialogDescription>
  Are you sure you want to delete &ldquo;{filename}&rdquo;? This
  action cannot be undone.
</DialogDescription>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Admin-only attachment delete | User can delete own uploads | Migration 037 (2026-02-02) | UI needs update to match RLS policy |
| All items in stock-out form | Filter QMHQ items from general form | Phase 13 requirement | Prevents duplicate stock-out channels |
| Text-only fulfillment status | Visual progress bar indicator | Phase 13 requirement | Clearer completion status at a glance |
| Status-based stock-out trigger | Manual stock-out from detail page | Migration 034 + Phase 13 | More control, works with multi-item QMHQ |

**Deprecated/outdated:**
- Single-item QMHQ (qmhq.item_id): Still supported for legacy records but new QMHQ use qmhq_items junction table (migration 035)
- Admin-only delete UI logic: Migration 037 allows user-owned deletes, UI logic must be updated

## Open Questions

Things that couldn't be fully resolved:

1. **Should fully fulfilled QMHQ auto-close to "Completed" status?**
   - What we know: Stock-out tab shows "Complete" badge per item, but QMHQ status is manually set
   - What's unclear: Whether fulfillment completion should trigger automatic status change
   - Recommendation: Keep manual status control. Fulfillment and status are separate concerns (user may mark complete before all items issued, or keep open for documentation). Document this decision in verification report.

2. **How to handle partial fulfillment with multiple warehouses?**
   - What we know: qmhq_items.warehouse_id is optional, stock-out form requires warehouse selection
   - What's unclear: If user selects different warehouses for same item across multiple stock-outs, should UI show combined or per-warehouse fulfillment?
   - Recommendation: Show combined fulfillment (sum all stock-outs for item regardless of warehouse). Warehouse detail is in stock-out transaction list below.

3. **Should progress bar color change based on completion percentage?**
   - What we know: PO uses amber for invoiced, emerald for received. QMHQ fulfillment is single metric.
   - What's unclear: Use emerald always, or blue → emerald when 100%?
   - Recommendation: Use emerald always (matches existing "Complete" badge color). Blue would introduce new semantic meaning not present elsewhere.

4. **Legacy single-item QMHQ auto stock-out trigger compatibility**
   - What we know: Migration 034 creates trigger for legacy qmhq.item_id, checks `NEW.item_id IS NOT NULL`
   - What's unclear: Should this trigger remain active or be disabled in favor of manual stock-out?
   - Recommendation: Keep trigger active for backward compatibility. Multi-item QMHQ won't trigger it (item_id = NULL). Document that new flow is manual stock-out, trigger is legacy support only.

## Sources

### Primary (HIGH confidence)
- Migration 030_file_attachments.sql — Original RLS policies (admin/quartermaster only update)
- Migration 036_fix_file_attachments_rls.sql — Fixed UPDATE policy WITH CHECK clause
- Migration 037_file_attachments_delete_own.sql — Allows users to delete own uploads
- app/(dashboard)/qmhq/[id]/page.tsx — Stock-out tab implementation (lines 712-837)
- components/files/attachments-tab.tsx — File delete flow (lines 249-281)
- components/files/file-card.tsx — canDelete prop usage (lines 169-194)
- components/po/po-progress-bar.tsx — Existing progress bar pattern
- lib/actions/files.ts — deleteFile server action (lines 151-192)
- .planning/phases/07.1-attachment-item-route-fixes/07.1-VERIFICATION.md — Prior verification notes

### Secondary (MEDIUM confidence)
- tailwind.config.ts — Color system (emerald, amber, blue gradients)
- app/(dashboard)/inventory/stock-out/page.tsx — General stock-out form structure
- supabase/migrations/035_qmhq_items.sql — Multi-item junction table schema

### Tertiary (LOW confidence)
- None — all research based on existing codebase artifacts

## Metadata

**Confidence breakdown:**
- RLS policy state: HIGH — Migrations 030, 036, 037 provide complete history
- UI permission logic gap: HIGH — Code shows canEditAttachments admin/quartermaster only, doesn't check uploader
- Stock-out tab implementation: HIGH — Lines 712-837 in QMHQ detail page confirmed
- Progress bar pattern: HIGH — Existing POProgressBar provides template
- Item filtering approach: MEDIUM — No existing pattern in codebase, recommendation based on Supabase client capabilities

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days — stable phase, no fast-moving dependencies)
