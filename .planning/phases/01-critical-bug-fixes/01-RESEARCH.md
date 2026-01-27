# Phase 1: Critical Bug Fixes - Research

**Researched:** 2026-01-27
**Domain:** Bug fixing in Next.js/Supabase procurement workflow
**Confidence:** HIGH

## Summary

This phase focuses on fixing critical bugs in the PO creation, stock-in, invoice creation, and stock-out workflows. The codebase is a Next.js 14+ App Router application with Supabase backend featuring complex database triggers for maintaining data consistency (PO totals, QMHQ balance_in_hand, invoice quantity validation, WAC calculation).

The research involved deep investigation of the existing implementation across:
- Frontend pages: `/po/new`, `/inventory/stock-in`, `/inventory/stock-out`, `/invoice/new`
- Database schema: migrations 015-024 covering purchase_orders, po_line_items, invoices, invoice_line_items, inventory_transactions
- Database triggers: PO total calculation, QMHQ committed balance updates, invoice line quantity validation, WAC calculation
- RLS policies: Role-based access control for all tables

**Primary recommendation:** Debug by checking Supabase logs and browser console for specific error messages. Most bugs likely stem from: (1) database trigger validation failures, (2) missing required fields, (3) RLS policy denials, or (4) foreign key constraint violations.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in use - do not change)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Next.js 14+ (App Router) | Frontend framework | Already established |
| Supabase | Backend (PostgreSQL + Auth) | Already established |
| TypeScript | Type safety | Already established |
| Tailwind CSS | Styling | Already established |

### Debugging Tools
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Supabase Dashboard (SQL Editor) | Direct SQL queries | Test triggers, check data state |
| Supabase Dashboard (Logs) | View database errors | Identify trigger failures |
| Browser DevTools (Network) | View API responses | See Supabase error details |
| Browser DevTools (Console) | Client-side errors | Catch unhandled exceptions |

## Architecture Patterns

### Existing Data Flow Patterns

The codebase follows these established patterns:

```
User Action (Form Submit)
    |
    v
Client Component (useAuth for user.id)
    |
    v
Supabase Client (.insert/.update)
    |
    v
Database Triggers (BEFORE/AFTER)
    |-- validate_po_qmhq_route (BEFORE INSERT on purchase_orders)
    |-- update_qmhq_po_committed (AFTER INSERT/UPDATE/DELETE on purchase_orders)
    |-- update_po_total (AFTER INSERT/UPDATE/DELETE on po_line_items)
    |-- validate_invoice_line_quantity (BEFORE INSERT/UPDATE on invoice_line_items)
    |-- update_invoice_total (AFTER on invoice_line_items)
    |-- update_po_line_invoiced_quantity (AFTER on invoice_line_items)
    |-- validate_stock_out_quantity (BEFORE on inventory_transactions)
    |-- update_item_wac (AFTER INSERT on inventory_transactions)
    |-- update_invoice_line_received_quantity (AFTER INSERT on inventory_transactions)
    |
    v
RLS Policies Check
    |
    v
Success/Error Response
```

### Current PO Creation Flow
```typescript
// From app/(dashboard)/po/new/page.tsx
1. Fetch reference data (QMHQs with balance, suppliers, items, contacts)
2. User selects QMHQ, supplier, fills header, adds line items
3. Submit: INSERT into purchase_orders (triggers validate_po_qmhq_route)
4. Submit: INSERT into po_line_items (triggers update_po_total, trigger_update_po_status)
5. Router redirects to /po/[id]
```

### Current Stock-In Flow
```typescript
// From app/(dashboard)/inventory/stock-in/page.tsx
1. Two modes: "invoice" or "manual"
2. Invoice mode: Select invoice, select line items, set quantities
3. Submit: INSERT into inventory_transactions with:
   - movement_type: "inventory_in"
   - invoice_line_item_id (for tracking)
   - Triggers: update_item_wac, update_invoice_line_received_quantity
```

### Current Invoice Creation Flow
```typescript
// From app/(dashboard)/invoice/new/page.tsx - 3 step wizard
// Step 1: Select PO + Invoice header (date, currency, exchange rate)
// Step 2: Select line items from PO, adjust quantities/prices
// Step 3: Review and submit

1. INSERT into invoices
2. INSERT into invoice_line_items (triggers validate_invoice_line_quantity)
```

### Current Stock-Out Flow
```typescript
// From app/(dashboard)/inventory/stock-out/page.tsx
1. Select item -> Fetch stock by warehouse
2. Select source warehouse, quantity, reason
3. If transfer: also creates inventory_in at destination
4. Submit: INSERT into inventory_transactions with movement_type: "inventory_out"
   - Trigger: validate_stock_out_quantity checks available stock
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PO total calculation | Manual sum | Database trigger `update_po_total` | Trigger keeps it consistent |
| Invoice qty validation | Client-only check | DB trigger `validate_invoice_line_quantity` | Trigger is authoritative |
| Stock availability | Client calculation | DB function `get_warehouse_stock` | Single source of truth |
| WAC calculation | Manual formula | DB trigger `update_item_wac` | Complex edge cases handled |
| PO status | Manual status | DB function `calculate_po_status` | Based on invoice/received qtys |

**Key insight:** The database already has comprehensive triggers for business logic. Fixes should work WITH these triggers, not around them.

## Common Pitfalls

### Pitfall 1: QMHQ Balance Not Updated
**What goes wrong:** PO created but QMHQ.total_po_committed not updated, showing wrong balance_in_hand
**Why it happens:** Trigger `update_qmhq_po_committed` only fires AFTER insert, calculates from total_amount_eusd
**How to avoid:** Ensure PO has total_amount calculated correctly (requires line items with prices)
**Warning signs:** QMHQ balance shows stale data after PO creation

### Pitfall 2: Invoice Line Quantity Validation Failure
**What goes wrong:** Error "Invoice quantity (X) exceeds available quantity (Y)"
**Why it happens:** Trigger `validate_invoice_line_quantity` compares against po_line_items.invoiced_quantity
**How to avoid:** Ensure UI shows correct available quantity, don't allow submit if exceeds
**Warning signs:** Error message on insert, UI allows more than database does

### Pitfall 3: Stock-In Without Valid invoice_line_item_id
**What goes wrong:** Invoice line item's received_quantity not updated
**Why it happens:** Trigger `update_invoice_line_received_quantity` only fires when invoice_line_item_id is NOT NULL
**How to avoid:** Always pass invoice_line_item_id when doing stock-in from invoice
**Warning signs:** Invoice shows 0 received even after stock-in

### Pitfall 4: Missing currency/exchange_rate on inventory_in
**What goes wrong:** WAC not calculated correctly
**Why it happens:** Trigger needs unit_cost, currency, exchange_rate for WAC
**How to avoid:** Manual stock-in should prompt for currency (defaults to MMK with rate 1.0)
**Warning signs:** Item WAC stays at 0 or old value

### Pitfall 5: RLS Policy Denial
**What goes wrong:** Insert silently fails or returns no data
**Why it happens:** User role doesn't have INSERT permission on table
**How to avoid:** Check RLS policies match user's role
**Warning signs:** No error but also no data, or "permission denied" in Supabase logs

### Pitfall 6: Foreign Key Constraint Violation
**What goes wrong:** Insert fails with "violates foreign key constraint"
**Why it happens:** Referenced record doesn't exist or is soft-deleted (is_active=false)
**How to avoid:** Only show active records in dropdowns, verify before submit
**Warning signs:** Specific constraint name in error message

### Pitfall 7: PO Status Filter Exclusion
**What goes wrong:** Valid POs don't appear in invoice creation
**Why it happens:** Query filters `.not("status", "in", '("closed","cancelled")')` - note string format
**How to avoid:** Verify Supabase query syntax for status filtering
**Warning signs:** PO exists but doesn't show in dropdown

## Code Examples

### PO Creation Insert Pattern
```typescript
// Source: app/(dashboard)/po/new/page.tsx lines 171-211
// Create PO first
const { data: poData, error: poError } = await supabase
  .from("purchase_orders")
  .insert({
    qmhq_id: selectedQmhqId,
    supplier_id: supplierId,
    po_date: poDate.toISOString().split("T")[0],
    expected_delivery_date: expectedDeliveryDate?.toISOString().split("T")[0] || null,
    currency,
    exchange_rate: exchangeRate,
    contact_person_name: contactPersonName || null,
    sign_person_name: signPersonName || null,
    authorized_signer_name: authorizedSignerName || null,
    notes: notes || null,
    created_by: user.id,  // Required!
  })
  .select()
  .single();

// Then create line items
const lineItemsToInsert = lineItems
  .filter((li) => li.item_id)  // Must have item_id
  .map((li) => ({
    po_id: poData.id,
    item_id: li.item_id,
    quantity: li.quantity,
    unit_price: li.unit_price,
    item_name: li.item_name,
    item_sku: li.item_sku || null,
    item_unit: li.item_unit || null,
  }));

const { error: lineItemsError } = await supabase
  .from("po_line_items")
  .insert(lineItemsToInsert);
```

### Stock-In Insert Pattern
```typescript
// Source: app/(dashboard)/inventory/stock-in/page.tsx lines 311-330
const transactions = selectedStockInLines.map((line) => ({
  movement_type: "inventory_in" as const,
  item_id: line.item_id,  // Required!
  warehouse_id: warehouseId,  // Required!
  quantity: line.quantity,
  unit_cost: line.unit_cost,
  currency: selectedInvoice.currency || "MMK",
  exchange_rate: selectedInvoice.exchange_rate || 1,
  invoice_id: selectedInvoiceId,
  invoice_line_item_id: line.invoice_line_item_id,  // Important for tracking!
  transaction_date: transactionDate.toISOString().split("T")[0],
  notes: notes || null,
  status: "completed" as const,
  created_by: user.id,
}));
```

### Invoice Line Item Validation
```sql
-- Source: supabase/migrations/022_invoice_line_items.sql
-- This trigger runs BEFORE INSERT/UPDATE
CREATE OR REPLACE FUNCTION validate_invoice_line_quantity()
RETURNS TRIGGER AS $$
DECLARE
  po_quantity DECIMAL(15,2);
  already_invoiced DECIMAL(15,2);
  available_qty DECIMAL(15,2);
BEGIN
  -- Get PO line item quantity and currently invoiced quantity
  SELECT quantity, COALESCE(invoiced_quantity, 0)
  INTO po_quantity, already_invoiced
  FROM po_line_items
  WHERE id = NEW.po_line_item_id;

  available_qty := po_quantity - already_invoiced;

  IF NEW.quantity > available_qty THEN
    RAISE EXCEPTION 'Invoice quantity (%) exceeds available quantity (%)',
      NEW.quantity, available_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Checking Stock Availability
```sql
-- Source: supabase/migrations/024_inventory_wac_trigger.sql
CREATE OR REPLACE FUNCTION get_warehouse_stock(p_item_id UUID, p_warehouse_id UUID)
RETURNS DECIMAL(15,2) AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(
      CASE
        WHEN movement_type = 'inventory_in' THEN quantity
        WHEN movement_type = 'inventory_out' THEN -quantity
        ELSE 0
      END
    ), 0)
    FROM inventory_transactions
    WHERE item_id = p_item_id
      AND warehouse_id = p_warehouse_id
      AND is_active = true
      AND status = 'completed'
  );
END;
$$ LANGUAGE plpgsql;
```

## Debugging Approach

### Step 1: Identify Error Source
```
1. Check browser DevTools > Network > Response for Supabase error
2. Check browser DevTools > Console for unhandled exceptions
3. Check Supabase Dashboard > Logs > Postgres for trigger errors
```

### Step 2: Test Database Directly
```sql
-- Check QMHQ has balance
SELECT id, request_id, line_name, route_type, balance_in_hand
FROM qmhq
WHERE route_type = 'po' AND is_active = true AND balance_in_hand > 0;

-- Check PO creation prerequisites
SELECT id, route_type FROM qmhq WHERE id = '[qmhq_id]';

-- Test trigger manually
BEGIN;
INSERT INTO purchase_orders (qmhq_id, supplier_id, created_by)
VALUES ('[qmhq_id]', '[supplier_id]', '[user_id]');
-- Check for errors, then ROLLBACK;
```

### Step 3: Verify RLS
```sql
-- Check user role
SELECT id, email, role FROM users WHERE id = auth.uid();

-- Check if role has permission (example for PO)
SELECT public.get_user_role() IN ('admin', 'quartermaster', 'finance', 'proposal');
```

## Invoice Behavior Requirements

### INV-01: Invoice line item quantity cannot exceed PO line item quantity
**Current state:** Already implemented via `validate_invoice_line_quantity` trigger
**Action needed:** Verify UI enforces same constraint before submit

### INV-02: Invoice total amount CAN exceed PO total amount
**Current state:** No constraint on invoice total vs PO total
**Action needed:** Confirm no code prevents this, document as feature

## Open Questions

None - the codebase is well-documented with comprehensive migrations and types.

## Sources

### Primary (HIGH confidence)
- Codebase investigation of:
  - `app/(dashboard)/po/new/page.tsx` - PO creation workflow
  - `app/(dashboard)/inventory/stock-in/page.tsx` - Stock-in workflow
  - `app/(dashboard)/inventory/stock-out/page.tsx` - Stock-out workflow
  - `app/(dashboard)/invoice/new/page.tsx` - Invoice creation workflow
  - `supabase/migrations/015_purchase_orders.sql` - PO schema + triggers
  - `supabase/migrations/016_po_line_items.sql` - PO line items + status calculation
  - `supabase/migrations/021_invoices.sql` - Invoice schema + triggers
  - `supabase/migrations/022_invoice_line_items.sql` - Invoice line validation
  - `supabase/migrations/023_inventory_transactions.sql` - Inventory schema
  - `supabase/migrations/024_inventory_wac_trigger.sql` - WAC + stock validation
  - `supabase/migrations/027_rls_policies.sql` - RLS policies
  - `types/database.ts` - TypeScript types

## Metadata

**Confidence breakdown:**
- Architecture understanding: HIGH - Direct code analysis
- Pitfall identification: HIGH - Based on trigger logic
- Debugging approach: HIGH - Standard Supabase patterns

**Research date:** 2026-01-27
**Valid until:** N/A - Bug fixing phase, patterns won't change
