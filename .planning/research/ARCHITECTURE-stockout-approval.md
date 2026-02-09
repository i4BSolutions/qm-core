# Architecture: Stock-Out Approval, Deletion Protection, Context Sliders

**Researched:** 2026-02-09
**Confidence:** HIGH
**Scope:** Integration architecture for 3 new features into existing QM System

---

## RESEARCH COMPLETE

**Project:** QM System v1.6+
**Mode:** Ecosystem integration patterns
**Confidence:** HIGH

### Key Findings

1. **Stock-out approval workflow integrates cleanly** with existing inventory_transactions table via new stock_out_requests table and RPC approval functions
2. **Deletion protection** requires new check_entity_references() function and reusable DeleteWithProtectionDialog component
3. **Context sliders** abstract existing QmrlContextPanel pattern into reusable ContextSlider base component
4. **No existing code needs modification** - all features are additive except replacing delete buttons with protected dialogs
5. **QMHQ auto stock-out trigger remains unchanged** - approval workflow is parallel path for manual operations

### Files Created

- `.planning/research/ARCHITECTURE-stockout-approval.md` (this file)

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Stock-out approval | HIGH | Verified integration with existing inventory_transactions, RLS patterns match established policies |
| Deletion protection | HIGH | Foreign key checking pattern researched from PostgreSQL docs, component follows dialog patterns |
| Context sliders | HIGH | Pattern exists in codebase (QmrlContextPanel), abstraction straightforward |
| Build order | HIGH | Dependencies identified, phased approach ensures no blocking issues |

### Roadmap Implications

**Suggested phase structure:**

1. **Foundation** (no dependencies)
   - check_entity_references() database function
   - ContextSlider base component

2. **Deletion Protection** (depends on Phase 1.1)
   - useDeletionCheck hook
   - DeleteWithProtectionDialog component
   - Replace delete buttons across admin pages

3. **Context Sliders** (depends on Phase 1.2)
   - ItemContextSlider (for stock operations)
   - WarehouseStockSlider (for transfers)

4. **Stock-Out Approval Schema** (no dependencies)
   - stock_out_requests table with constraints, indexes, triggers
   - inventory_transactions FK addition

5. **Stock-Out Approval Functions** (depends on Phase 4)
   - approve_stock_out_request() and reject_stock_out_request() RPC functions
   - RLS policies for stock_out_requests

6. **Stock-Out Approval UI** (depends on Phases 3, 4, 5)
   - Request form with ItemContextSlider
   - Pending requests list with approval/rejection dialogs
   - Navigation integration

7. **Audit Integration** (depends on Phase 4)
   - Apply existing create_audit_log() trigger to stock_out_requests

8. **Testing & Documentation**
   - End-to-end workflow testing
   - CLAUDE.md pattern documentation

### Open Questions

**Resolved:**
- QMHQ auto stock-out trigger → No changes needed (parallel workflows)
- Existing RLS policies → No changes needed (new policies added for new tables)
- Audit triggers → Automatically apply to new tables via existing function

**Remaining:**
- Should stock-out requests have time-based auto-cancellation? (Recommend: No for v1, add monitoring dashboard later)
- Should deletion protection suggest reassignment UI? (Recommend: No for v1, just block with message)

---

## Architecture Summary

### Feature 1: Stock-Out Approval Workflow

**Integration Pattern:** New request/approval layer before inventory_transactions

```
Current Flow:
  User form → inventory_transactions (completed)

New Flow:
  User form → stock_out_requests (pending)
       ↓
  Approval → inventory_transactions (completed) + update request (approved)
  OR
  Rejection → update request (rejected), no transaction
```

**Key Components:**

- **stock_out_requests table** - Stores pending requests with status (pending/approved/rejected/cancelled)
- **approve_stock_out_request()** - RPC function with row-level locking, stock validation, transaction creation
- **reject_stock_out_request()** - RPC function to reject with reason
- **Stock-out request form** - Client component with ItemContextSlider integration
- **Pending requests list** - Server component with approval/rejection dialogs

**Database Design:**

```sql
CREATE TABLE stock_out_requests (
  id UUID PRIMARY KEY,
  request_id TEXT UNIQUE, -- SOR-YYYY-NNNNN format
  item_id UUID REFERENCES items(id),
  warehouse_id UUID REFERENCES warehouses(id),
  quantity DECIMAL(15,2) CHECK (quantity > 0),
  reason stock_out_reason NOT NULL, -- Reuse existing enum
  destination_warehouse_id UUID REFERENCES warehouses(id), -- For transfers
  notes TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  requested_by UUID REFERENCES users(id),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  inventory_transaction_id UUID REFERENCES inventory_transactions(id),

  -- Snapshot fields
  item_name TEXT,
  item_sku TEXT,

  -- Audit
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE stock_out_requests ADD CONSTRAINT check_transfer_destination_stockout
  CHECK (reason != 'transfer' OR destination_warehouse_id IS NOT NULL);

ALTER TABLE stock_out_requests ADD CONSTRAINT check_different_warehouses_stockout
  CHECK (destination_warehouse_id IS NULL OR destination_warehouse_id != warehouse_id);

-- Indexes
CREATE INDEX idx_stock_out_requests_status ON stock_out_requests(status) WHERE status = 'pending';
CREATE INDEX idx_stock_out_requests_item_id ON stock_out_requests(item_id);
CREATE INDEX idx_stock_out_requests_warehouse_id ON stock_out_requests(warehouse_id);
```

**RLS Policies:**

- SELECT: Quartermaster/Inventory see all, Requester sees own
- INSERT: Requester+ can create
- UPDATE: Only Quartermaster/Inventory/Admin (for approval)
- DELETE: Admin only (soft delete via is_active)

**Integration with Existing Auto Stock-Out:**

The existing QMHQ item route trigger (034_qmhq_auto_stockout.sql) continues unchanged. Two parallel flows:

1. **QMHQ Item Route:** QMHQ status → 'done' → auto inventory_out (no approval)
2. **Manual Stock-Out:** User request → approval → inventory_out

Both write to inventory_transactions from different sources.

---

### Feature 2: Deletion Protection

**Integration Pattern:** Pre-deletion reference check via database function

```
Current Flow:
  Delete button → UPDATE is_active=false

New Flow:
  Delete button → check_entity_references()
      ↓
  IF references exist → Show blocking dialog with reference list
  IF no references → Confirm deletion → UPDATE is_active=false
```

**Key Components:**

- **check_entity_references()** - Database function returning JSONB with reference details
- **useDeletionCheck** - React hook wrapping RPC call
- **DeleteWithProtectionDialog** - Reusable dialog showing references or confirmation
- **Modified delete buttons** - Replace across admin pages (items, warehouses, suppliers, departments, contacts, categories, statuses)

**Database Function:**

```sql
CREATE OR REPLACE FUNCTION check_entity_references(
  entity_table TEXT,
  entity_id UUID
)
RETURNS JSONB AS $$
DECLARE
  reference_count INTEGER;
  reference_details JSONB := '[]'::JSONB;
BEGIN
  CASE entity_table
    WHEN 'items' THEN
      -- Check inventory_transactions, qmhq, po_line_items, invoice_line_items
    WHEN 'warehouses' THEN
      -- Check inventory_transactions, qmhq
    WHEN 'suppliers' THEN
      -- Check purchase_orders, invoices
    WHEN 'departments' THEN
      -- Check users, contact_persons, qmrl
    WHEN 'contact_persons' THEN
      -- Check qmrl, qmhq
    WHEN 'categories' THEN
      -- Check qmrl, qmhq, items
    WHEN 'status_config' THEN
      -- Check qmrl, qmhq
  END CASE;

  IF jsonb_array_length(reference_details) > 0 THEN
    RETURN jsonb_build_object(
      'can_delete', false,
      'references', reference_details,
      'total_references', (SELECT SUM((value->>'count')::INTEGER) FROM jsonb_array_elements(reference_details))
    );
  ELSE
    RETURN jsonb_build_object('can_delete', true, 'references', '[]'::JSONB, 'total_references', 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**React Hook:**

```typescript
// lib/hooks/use-deletion-check.ts
export function useDeletionCheck() {
  const [isChecking, setIsChecking] = useState(false);

  const checkReferences = async (entityTable: string, entityId: string) => {
    setIsChecking(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('check_entity_references', {
      entity_table: entityTable,
      entity_id: entityId,
    });
    setIsChecking(false);
    if (error) throw error;
    return data as DeletionCheckResult;
  };

  return { checkReferences, isChecking };
}
```

**Component Pattern:**

```typescript
// components/dialogs/delete-with-protection-dialog.tsx
export function DeleteWithProtectionDialog({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  onConfirmDelete,
}: Props) {
  const { checkReferences, isChecking } = useDeletionCheck();
  const [checkResult, setCheckResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      checkReferences(entityType, entityId).then(setCheckResult);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {isChecking ? (
        <LoadingSpinner />
      ) : checkResult?.can_delete ? (
        <ConfirmationView onConfirm={onConfirmDelete} />
      ) : (
        <BlockingView references={checkResult?.references} />
      )}
    </Dialog>
  );
}
```

---

### Feature 3: Context Side Sliders

**Integration Pattern:** Abstract QmrlContextPanel into reusable base component

```
Existing:
  QmrlContextPanel (QMHQ creation) → Shows parent QMRL context

New Pattern:
  ContextSlider (base) ← Generic responsive side panel
    ├─ ItemContextSlider (stock operations)
    ├─ WarehouseStockSlider (transfers)
    └─ QmrlContextPanel (unchanged, can migrate later)
```

**Key Components:**

- **ContextSlider** - Base component with responsive behavior (desktop: always visible, mobile: slide-in drawer)
- **ItemContextSlider** - Shows item details during stock operations
- **WarehouseStockSlider** - Shows warehouse stock during transfers

**Base Component API:**

```typescript
interface ContextSliderProps {
  isOpen: boolean;
  onToggle: () => void;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: ReactNode;
  toggleButtonLabel?: string;
}

export function ContextSlider({ isOpen, onToggle, title, icon, children }: Props) {
  // Mobile: Fixed slide-in with backdrop
  // Desktop: Sticky side panel
  // Body scroll lock on mobile when open
  // Close button on mobile only
}
```

**Specialized Sliders:**

```typescript
// ItemContextSlider
export function ItemContextSlider({ itemId, isOpen, onToggle }: Props) {
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    if (itemId) fetchItem(itemId).then(setItem);
  }, [itemId]);

  return (
    <ContextSlider isOpen={isOpen} onToggle={onToggle} title="Item Context" icon={Package}>
      {item ? <ItemDetails item={item} /> : <EmptyState />}
    </ContextSlider>
  );
}

// WarehouseStockSlider
export function WarehouseStockSlider({ warehouseId, itemId, isOpen, onToggle }: Props) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);

  useEffect(() => {
    if (warehouseId && itemId) fetchStock(warehouseId, itemId).then(setStockInfo);
  }, [warehouseId, itemId]);

  return (
    <ContextSlider isOpen={isOpen} onToggle={onToggle} title="Stock Info" icon={Warehouse}>
      {stockInfo ? <StockDetails stockInfo={stockInfo} /> : <EmptyState />}
    </ContextSlider>
  );
}
```

**Responsive Behavior:**

- **Desktop (md+):** Always visible, part of grid layout, sticky position
- **Mobile (<md):** Hidden by default, floating toggle button, slides in on tap, backdrop blur, body scroll lock

**Styling:** Matches existing QmrlContextPanel (bg-slate-900, border-slate-700, amber accents)

---

## Component Boundaries

### New Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| stock_out_requests (table) | Store pending requests | items, warehouses, users, inventory_transactions |
| approve_stock_out_request() (function) | Approve with validation | stock_out_requests, inventory_transactions |
| reject_stock_out_request() (function) | Reject with reason | stock_out_requests |
| check_entity_references() (function) | Check FK references | All entity tables |
| ContextSlider (component) | Base side panel | Children components |
| ItemContextSlider (component) | Item details panel | items via Supabase |
| WarehouseStockSlider (component) | Stock info panel | warehouses, items, inventory_transactions |
| StockOutRequestForm (component) | Create requests | stock_out_requests |
| StockOutRequestsList (component) | List with approve/reject | stock_out_requests, RPC functions |
| DeleteWithProtectionDialog (component) | Deletion confirmation | check_entity_references RPC |
| useDeletionCheck (hook) | Reference checking | Supabase RPC |

### Modified Components

| Component | Modification | Reason |
|-----------|-------------|--------|
| inventory_transactions (table) | Add stock_out_request_id FK | Link to approval requests |
| Delete buttons (admin pages) | Replace with DeleteWithProtectionDialog | Add protection |
| Navigation sidebar | Add "Stock-Out Requests" link | Access new feature |

### Unchanged Components

| Component | Status |
|-----------|--------|
| 034_qmhq_auto_stockout.sql trigger | No changes (parallel workflow) |
| RLS policies (existing) | No changes (new policies added) |
| Audit triggers | No changes (auto-apply to new tables) |
| WAC calculation | No changes (same trigger) |
| QmrlContextPanel | No changes (reference for abstraction) |

---

## Build Order (Dependency-Aware)

### Phase 1: Foundation

1. check_entity_references() database function
2. ContextSlider base component

### Phase 2: Deletion Protection

3. useDeletionCheck hook
4. DeleteWithProtectionDialog component
5. Replace delete buttons across admin pages

### Phase 3: Context Sliders

6. ItemContextSlider component
7. WarehouseStockSlider component

### Phase 4: Stock-Out Approval Schema

8. stock_out_requests table migration
9. inventory_transactions FK addition

### Phase 5: Stock-Out Approval Functions

10. approve/reject RPC functions
11. RLS policies for stock_out_requests

### Phase 6: Stock-Out Approval UI

12. Stock-Out Request Form with ItemContextSlider
13. Pending Requests List with approval dialogs
14. Navigation integration

### Phase 7: Audit Integration

15. Apply audit trigger to stock_out_requests

### Phase 8: Testing

16-20. End-to-end workflow testing, documentation

---

## Sources

**Supabase & PostgreSQL:**
- [Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes)
- [SQL ON DELETE RESTRICT | DataCamp](https://www.datacamp.com/tutorial/sql-on-delete-restrict)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

**Soft Deletion:**
- [Soft Deletion Analysis](https://brandur.org/soft-deletion)
- [PostgreSQL Soft Deletion](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database)

**Approval Workflows:**
- [Multi Level Approval System Design](https://www.coderbased.com/p/multi-level-approval-system-design)
- [Approval Process Guide 2026](https://kissflow.com/workflow/approval-process/)

**Next.js Patterns:**
- [Shadcn Drawer](https://www.shadcn.io/ui/drawer)
- [Next.js Server Actions Guide](https://makerkit.dev/blog/tutorials/nextjs-server-actions)
- [Next.js Forms](https://nextjs.org/docs/app/guides/forms)
