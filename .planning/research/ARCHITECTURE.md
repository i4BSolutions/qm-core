# Architecture Research

**Domain:** PO Smart Lifecycle, Cancellation Guards & PDF Export
**Researched:** 2026-02-12
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
│  ┌────────────┐  ┌───────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ PO Detail  │  │ Invoice   │  │ Stock-In   │  │ PDF Export   │  │
│  │   Page     │  │   Pages   │  │   Pages    │  │   Dialogs    │  │
│  └─────┬──────┘  └─────┬─────┘  └─────┬──────┘  └──────┬───────┘  │
│        │               │              │                 │           │
├────────┴───────────────┴──────────────┴─────────────────┴───────────┤
│                      COMPOSITE UI LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ PageHeader | DetailPageLayout | FilterBar | ActionButtons   │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                      SERVER ACTIONS LAYER                            │
│  ┌────────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────────┐   │
│  │ voidInvoice│  │ cancelPO │  │stockIn  │  │ generatePDF     │   │
│  │ (cascade)  │  │ (guard)  │  │ (event) │  │ (server-side)   │   │
│  └─────┬──────┘  └─────┬────┘  └────┬────┘  └─────────┬───────┘   │
│        │               │             │                  │           │
├────────┴───────────────┴─────────────┴──────────────────┴───────────┤
│                      DATABASE TRIGGER LAYER                          │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Status Engine: calculate_po_status() + trigger_update_..() │     │
│  │ • Triggered by: invoice_line_items, inventory_transactions │     │
│  │ • Updates: po.status (6-state enum)                        │     │
│  │ • Lock-free: runs within transaction                       │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Cancellation Guards: BEFORE UPDATE/DELETE triggers         │     │
│  │ • block_po_cancel_with_invoices()                          │     │
│  │ • block_invoice_void_with_stockin() (existing)             │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Audit Cascade: AFTER triggers with zz_ prefix              │     │
│  │ • audit_po_cancel_cascade()                                │     │
│  │ • audit_invoice_void_cascade() (existing)                  │     │
│  └────────────────────────────────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────────────┤
│                      DATABASE STORAGE LAYER                          │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐       │
│  │ POs        │  │ Invoices     │  │ Inventory Trans.      │       │
│  │ po_status  │  │ is_voided    │  │ movement_type:        │       │
│  │ (enum)     │  │ voided_by    │  │ inventory_in          │       │
│  └────────────┘  └──────────────┘  └───────────────────────┘       │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐       │
│  │ PO Line    │  │ Invoice Line │  │ Audit Logs            │       │
│  │ Items      │  │ Items        │  │ (cascade tracking)    │       │
│  │ invoiced_  │  │ po_line_item_│  │                       │       │
│  │ quantity   │  │ id           │  │                       │       │
│  │ received_  │  │              │  │                       │       │
│  │ quantity   │  │              │  │                       │       │
│  └────────────┘  └──────────────┘  └───────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **PO Status Engine** | Calculate 6-state status from line item quantities | Database trigger + pure function (no side effects) |
| **Cancellation Guards** | Block PO cancel if invoices exist; block invoice void if stock-in exists | BEFORE triggers with aa_ prefix (fire first) |
| **Cascade Auditors** | Log all entities affected by void/cancel operations | AFTER triggers with zz_ prefix (fire last) |
| **Server Actions** | Void invoice, cancel PO, execute stock-in with cascade feedback | Next.js Server Actions ('use server') |
| **PDF Generator** | Server-side PDF export for invoices, QMHQ money-out, stock-out receipts | @react-pdf/renderer or jsPDF in Server Action |
| **Composite UI** | Reusable layouts (PageHeader, DetailPageLayout, FilterBar, ActionButtons) | React components with consistent spacing |

## Recommended Project Structure

```
supabase/migrations/
├── 068_po_smart_status_engine.sql        # NEW: 6-state status calculation
├── 069_po_cancellation_guards.sql         # NEW: block_po_cancel_with_invoices()
├── 070_po_cancel_cascade_audit.sql        # NEW: audit_po_cancel_cascade()
└── (040, 041, 057 already exist)          # EXISTING: invoice void guards + audit

lib/
├── actions/
│   ├── po-actions.ts                      # NEW: cancelPurchaseOrder() server action
│   ├── invoice-actions.ts                 # EXISTING: voidInvoice() (already cascades)
│   └── pdf-actions.ts                     # NEW: generateInvoicePDF(), generateReceiptPDF()
├── utils/
│   ├── po-status.ts                       # EXISTING: status config, canCancelPO()
│   ├── invoice-status.ts                  # EXISTING: canVoidInvoice()
│   └── pdf-generator.ts                   # NEW: PDF template builders
└── hooks/
    └── use-cascade-feedback.ts            # NEW: Hook for cascade toast display

app/(dashboard)/
├── po/[id]/
│   ├── page.tsx                           # MODIFY: Add "Matching" tab, lock UI when closed
│   ├── _components/
│   │   ├── po-matching-tab.tsx            # NEW: Side-by-side PO/Invoice/Stock-In comparison
│   │   ├── po-line-progress.tsx           # NEW: Per-line-item progress bars
│   │   └── po-cancel-dialog.tsx           # NEW: Cancel dialog with guard check
│   └── (detail-tabs.tsx exists)           # EXISTING: Tabs component
├── invoice/[id]/
│   ├── page.tsx                           # MODIFY: Add PDF export button
│   └── _components/
│       ├── invoice-void-dialog.tsx        # EXISTING: Already shows cascade feedback
│       └── invoice-pdf-export.tsx         # NEW: PDF export dialog
└── inventory/stock-out/
    └── _components/
        └── stock-out-receipt-pdf.tsx      # NEW: Receipt PDF export

components/composite/
├── page-header.tsx                        # EXISTING: Reuse as-is
├── detail-page-layout.tsx                 # EXISTING: Reuse as-is
├── filter-bar.tsx                         # EXISTING: Reuse as-is
├── action-buttons.tsx                     # EXISTING: Reuse as-is
└── (4 more components)                    # EXISTING: FormField, FormSection, CardViewGrid
```

### Structure Rationale

- **Database migrations first:** Status engine (068), guards (069), audit (070) build on existing trigger architecture (040, 041, 057)
- **Server Actions layer:** Centralize cascade logic, guard checks, and PDF generation in `lib/actions/`
- **Component colocation:** PO-specific components in `app/(dashboard)/po/[id]/_components/` (Next.js 14 convention)
- **Reuse composite UI:** All 7 composite components (PageHeader, DetailPageLayout, etc.) already established in v1.8
- **Utility functions:** Status config and guards in `lib/utils/`, PDF templates in `lib/utils/pdf-generator.ts`

## Architectural Patterns

### Pattern 1: Trigger-Driven Status Engine

**What:** Database triggers automatically recalculate PO status when invoice or stock-in events occur. Pure function `calculate_po_status()` determines new status from line item quantities, then `trigger_update_po_status()` applies it.

**When to use:** When status is a pure derivative of data (ordered, invoiced, received quantities) and must stay synchronized across concurrent transactions.

**Trade-offs:**
- **Pro:** Guaranteed consistency (status cannot drift from reality), lock-free (no pg_advisory_lock needed), transaction-safe (runs within same transaction)
- **Con:** Harder to debug than application logic, requires database migration for changes, can impact write performance if trigger logic is complex

**Example:**
```sql
-- Pure function: no side effects, just calculation
CREATE OR REPLACE FUNCTION calculate_po_status(p_po_id UUID)
RETURNS po_status AS $$
DECLARE
  total_ordered DECIMAL(15,2);
  total_invoiced DECIMAL(15,2);
  total_received DECIMAL(15,2);
BEGIN
  -- Get totals from line items
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(invoiced_quantity), 0),
    COALESCE(SUM(received_quantity), 0)
  INTO total_ordered, total_invoiced, total_received
  FROM po_line_items
  WHERE po_id = p_po_id AND is_active = true;

  -- 6-state decision tree
  IF total_received >= total_ordered AND total_invoiced >= total_ordered THEN
    RETURN 'closed'::po_status;
  ELSIF total_received > 0 AND total_received < total_ordered THEN
    RETURN 'partially_received'::po_status;
  ELSIF total_invoiced >= total_ordered AND total_received = 0 THEN
    RETURN 'awaiting_delivery'::po_status;
  ELSIF total_invoiced > 0 AND total_invoiced < total_ordered THEN
    RETURN 'partially_invoiced'::po_status;
  ELSE
    RETURN 'not_started'::po_status;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: applies the calculated status
CREATE TRIGGER po_line_item_update_status
  AFTER INSERT OR UPDATE OR DELETE ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_po_status();
```

### Pattern 2: Guard-Then-Cascade Trigger Chain

**What:** Ordered trigger execution using alphabetical prefixes: `aa_` guards fire BEFORE to block invalid operations, core triggers execute, `zz_` auditors fire AFTER to log cascade effects.

**When to use:** When operations have prerequisites (guards) and side effects (cascades) that must be tracked, and you need deterministic trigger ordering.

**Trade-offs:**
- **Pro:** Declarative (defined in schema), guaranteed order (alphabetical), transaction-safe (rollback reverts all), audit trail automatic
- **Con:** Prefix naming convention fragile (must document), harder to debug (multiple triggers interact), performance cost (multiple trigger invocations)

**Example:**
```sql
-- GUARD (aa_ prefix = fires FIRST among BEFORE triggers)
CREATE FUNCTION aa_block_po_cancel_with_invoices()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF EXISTS (
      SELECT 1 FROM invoices WHERE po_id = NEW.id AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Cannot cancel: invoices exist for this PO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aa_block_po_cancel_with_invoices
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION aa_block_po_cancel_with_invoices();

-- AUDITOR (zz_ prefix = fires LAST among AFTER triggers)
CREATE FUNCTION zz_audit_po_cancel_cascade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Log QMHQ balance_in_hand change
    -- Log PO line item releases
    -- (See full implementation in migration 070)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zz_audit_po_cancel_cascade
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION zz_audit_po_cancel_cascade();
```

**Trigger execution order for PO cancellation:**
1. `aa_block_po_cancel_with_invoices` (BEFORE) — guard check
2. `purchase_orders` row updated
3. `update_qmhq_po_committed` (AFTER) — recalculate QMHQ balance
4. `create_audit_log` (AFTER) — log PO status change
5. `zz_audit_po_cancel_cascade` (AFTER) — log cascade effects

### Pattern 3: Server Action Cascade Feedback

**What:** Server Actions execute database operations, then query cascade results and return structured feedback for toast display. Follows the pattern: execute → query cascade effects → return detailed result.

**When to use:** When user-initiated actions (void invoice, cancel PO) have complex cascade effects and users need immediate feedback on what changed.

**Trade-offs:**
- **Pro:** Type-safe (TypeScript end-to-end), revalidates cache automatically (Next.js), user feedback rich (lists affected entities), testable (pure functions)
- **Con:** More complex than simple mutation (must query cascade), requires multiple database round-trips (void + query results), larger payload (all cascade data)

**Example:**
```typescript
// lib/actions/po-actions.ts
'use server';

export type CancelPOResult =
  | {
      success: true;
      data: {
        poNumber: string;
        releasedBudget: number; // Balance in Hand freed
        affectedQMHQ: { qmhqNumber: string; newBalance: number };
      };
    }
  | { success: false; error: string };

export async function cancelPurchaseOrder(
  poId: string,
  reason: string
): Promise<CancelPOResult> {
  const supabase = await createClient();

  // 1. Authenticate
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  // 2. Fetch PO BEFORE cancel to get baseline budget
  const { data: poBefore } = await supabase
    .from('purchase_orders')
    .select('po_number, total_amount_eusd, qmhq_id')
    .eq('id', poId)
    .single();

  if (!poBefore) {
    return { success: false, error: 'PO not found' };
  }

  // 3. Execute cancel (triggers will fire, guard may block)
  const { error: cancelError } = await supabase
    .from('purchase_orders')
    .update({
      status: 'cancelled',
      cancelled_by: user.id,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    })
    .eq('id', poId);

  if (cancelError) {
    // Guard blocked (invoices exist) or other error
    return { success: false, error: cancelError.message };
  }

  // 4. Query cascade results (AFTER triggers have run)
  const { data: qmhqAfter } = await supabase
    .from('qmhq')
    .select('qmhq_number, balance_in_hand')
    .eq('id', poBefore.qmhq_id)
    .single();

  // 5. Revalidate cache
  revalidatePath(`/po/${poId}`);
  revalidatePath('/po');

  // 6. Return structured feedback
  return {
    success: true,
    data: {
      poNumber: poBefore.po_number,
      releasedBudget: poBefore.total_amount_eusd,
      affectedQMHQ: {
        qmhqNumber: qmhqAfter?.qmhq_number || '',
        newBalance: qmhqAfter?.balance_in_hand || 0,
      },
    },
  };
}
```

**UI consumption:**
```typescript
// app/(dashboard)/po/[id]/_components/po-cancel-dialog.tsx
const handleCancel = async () => {
  const result = await cancelPurchaseOrder(poId, reason);

  if (result.success) {
    toast.success(`PO ${result.data.poNumber} cancelled`, {
      description: `${result.data.releasedBudget} EUSD released to ${result.data.affectedQMHQ.qmhqNumber}. New balance: ${result.data.affectedQMHQ.newBalance} EUSD`,
    });
    router.push('/po');
  } else {
    toast.error('Cannot cancel PO', { description: result.error });
  }
};
```

### Pattern 4: PDF Generation in Server Actions

**What:** Generate PDFs server-side in Next.js Server Actions using @react-pdf/renderer (React-first) or jsPDF (canvas-based). Return PDF as blob for download or save to Supabase Storage.

**When to use:** When PDF structure is complex (multi-page invoices, formatted receipts) and requires server-side data access. Prefer server-side to keep bundle size small and use authentication context.

**Trade-offs:**
- **Pro:** Secure (user auth on server), smaller bundle (no PDF lib in client), consistent output (no browser quirks), can access database directly
- **Con:** Slower than client-side (network round-trip), requires Server Action (cannot use in pure client components), limited interactivity (no preview before generate)

**Example:**
```typescript
// lib/actions/pdf-actions.ts
'use server';

import { renderToBuffer } from '@react-pdf/renderer';
import { InvoicePDFDocument } from '@/lib/utils/pdf-generator';
import { createClient } from '@/lib/supabase/server';

export async function generateInvoicePDF(invoiceId: string): Promise<
  | { success: true; blob: Uint8Array; filename: string }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  // 1. Fetch invoice with all relations
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      purchase_order:purchase_orders(*),
      invoice_line_items(*, item:items(*))
    `)
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    return { success: false, error: 'Invoice not found' };
  }

  // 2. Generate PDF using React component
  const pdfBuffer = await renderToBuffer(
    <InvoicePDFDocument invoice={invoice} />
  );

  // 3. Return blob for download
  return {
    success: true,
    blob: new Uint8Array(pdfBuffer),
    filename: `${invoice.invoice_number}.pdf`,
  };
}
```

**UI consumption:**
```typescript
// app/(dashboard)/invoice/[id]/_components/invoice-pdf-export.tsx
const handleExport = async () => {
  setLoading(true);
  const result = await generateInvoicePDF(invoiceId);

  if (result.success) {
    // Trigger browser download
    const blob = new Blob([result.blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('PDF exported');
  } else {
    toast.error('Export failed', { description: result.error });
  }
  setLoading(false);
};
```

**Library choice (2026 best practices):**
- **@react-pdf/renderer:** React-first API, JSX components for PDF structure, better for complex multi-page documents, server + browser compatible
- **jsPDF:** Canvas-based, lighter weight, better for simple single-page receipts, requires html2canvas for CSS support
- **Recommendation:** Use @react-pdf/renderer for invoices (multi-page, complex layout), jsPDF for receipts (single-page, simple)

## Data Flow

### Request Flow: Void Invoice with Cascade Feedback

```
[User clicks "Void Invoice" in UI]
    ↓
[voidInvoice Server Action] → [Authenticate user]
    ↓
[Fetch invoice BEFORE void] → [Get baseline invoiced_quantity per line]
    ↓
[UPDATE invoices SET is_voided = true] → [Triggers fire in order:]
    ↓
    ├─ aa_block_invoice_void_stockin (BEFORE) → [Guard: fail if stock-in exists]
    ├─ invoice_void_recalculate (AFTER) → [Decrease po_line_items.invoiced_quantity]
    ├─ trigger_update_po_status (AFTER) → [Recalculate PO status]
    ├─ create_audit_log (AFTER) → [Log void action]
    └─ zz_audit_invoice_void_cascade (AFTER) → [Log PO line + status changes]
    ↓
[Query cascade results] → [Fetch updated PO status, invoiced quantities]
    ↓
[Return VoidInvoiceResult] → [{ success: true, data: { poNumber, newPoStatus, invoicedQtyChanges } }]
    ↓
[UI displays toast] → ["Invoice INV-2026-00042 voided. PO-2026-00123 status: partially_invoiced"]
    ↓
[revalidatePath] → [Next.js cache invalidated for /invoice/[id] and /po/[id]]
```

### State Management: PO Status Engine

```
[Invoice created with line items]
    ↓
[INSERT INTO invoice_line_items] → [Triggers on po_line_items:]
    ↓
    └─ po_line_item_update_status (AFTER INSERT/UPDATE) → [trigger_update_po_status()]
        ↓
        └─ calculate_po_status(po_id) → [Pure function:]
            ↓
            ├─ Query: SUM(quantity), SUM(invoiced_quantity), SUM(received_quantity)
            ├─ Decision tree:
            │   ├─ received >= ordered AND invoiced >= ordered → 'closed'
            │   ├─ received > 0 AND received < ordered → 'partially_received'
            │   ├─ invoiced >= ordered AND received = 0 → 'awaiting_delivery'
            │   ├─ invoiced > 0 AND invoiced < ordered → 'partially_invoiced'
            │   └─ else → 'not_started'
            └─ RETURN new_status
        ↓
        └─ UPDATE purchase_orders SET status = new_status WHERE status != 'cancelled'
    ↓
[PO status updated in same transaction]
```

### Key Data Flows

1. **Invoice Void Cascade:** User voids invoice → Server Action → Guard checks stock-in → Recalculate PO line invoiced_quantity → Recalculate PO status → Audit cascade → Return feedback → Toast display
2. **PO Cancellation:** User cancels PO → Server Action → Guard checks invoices → Update QMHQ balance_in_hand → Audit cascade → Return feedback → Toast display
3. **Stock-In Event:** User creates stock-in → Increase inventory_transactions.received_quantity → Trigger recalculates po_line_items.received_quantity → Trigger recalculates PO status → Status updates (e.g., 'awaiting_delivery' → 'partially_received')
4. **PDF Export:** User clicks export → Server Action → Fetch invoice with relations → Render @react-pdf/renderer component → Return blob → Browser downloads

## Integration Points

### New Components

| Component | Type | Purpose | Integrates With |
|-----------|------|---------|-----------------|
| `po-matching-tab.tsx` | NEW | Side-by-side PO/Invoice/Stock-In comparison table | Existing PO detail tabs |
| `po-line-progress.tsx` | NEW | Per-line-item progress bars (ordered → invoiced → received) | PO line items table |
| `po-cancel-dialog.tsx` | NEW | Cancel dialog with guard feedback | Existing ActionButtons |
| `invoice-pdf-export.tsx` | NEW | PDF export dialog and download handler | Existing invoice detail page |
| `stock-out-receipt-pdf.tsx` | NEW | Receipt PDF export for SOR-based stock-outs | Existing stock-out execution flow |

### Modified Components

| Component | Change | Integration Point |
|-----------|--------|-------------------|
| `app/(dashboard)/po/[id]/page.tsx` | Add "Matching" tab, lock UI when status = 'closed' | Existing DetailPageLayout + Tabs |
| `app/(dashboard)/invoice/[id]/page.tsx` | Add PDF export button to actions slot | Existing PageHeader actions prop |
| `lib/utils/po-status.ts` | Add `canCancelPO()` guard check | Existing status config utilities |
| `lib/actions/invoice-actions.ts` | ALREADY EXISTS with cascade feedback | No changes needed (reuse) |

### Database Integration

| Migration | Purpose | Triggers Added | Functions Added |
|-----------|---------|----------------|-----------------|
| `068_po_smart_status_engine.sql` | 6-state status calculation | `po_line_item_update_status` (modify existing) | `calculate_po_status()` (enhance) |
| `069_po_cancellation_guards.sql` | Block cancel if invoices exist | `aa_block_po_cancel_with_invoices` | `block_po_cancel_with_invoices()` |
| `070_po_cancel_cascade_audit.sql` | Audit PO cancellation cascade | `zz_audit_po_cancel_cascade` | `audit_po_cancel_cascade()` |

**Existing triggers (DO NOT MODIFY):**
- `040_invoice_void_block_stockin.sql` — `aa_block_invoice_void_stockin`
- `041_invoice_void_cascade_audit.sql` — `zz_audit_invoice_void_cascade`
- `057_deletion_protection.sql` — 6 `aa_block_*_deactivation` triggers

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Storage | Direct upload via Server Action | For PDF archival (optional) |
| Next.js Cache | `revalidatePath()` after mutations | Invalidate `/po/[id]`, `/invoice/[id]` |
| @react-pdf/renderer | `renderToBuffer()` in Server Action | Server-side PDF generation |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ Server Actions | Next.js Server Actions (type-safe) | Use CancelPOResult, VoidInvoiceResult types |
| Server Actions ↔ Database | Supabase client (TypeScript SDK) | Use existing `createClient()` pattern |
| Triggers ↔ Audit Logs | Direct INSERT via SECURITY DEFINER | Follow existing audit trigger pattern |
| Composite UI ↔ Pages | Props-based composition | Reuse PageHeader, DetailPageLayout slots |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k POs | Trigger-based status engine sufficient. No indexes beyond existing. |
| 1k-10k POs | Add partial indexes on `po_line_items(po_id, is_active)` for status calc. Consider caching PO status in Redis for read-heavy detail pages. |
| 10k-100k POs | Migrate to materialized view for PO aggregates (refresh on schedule or event). Add read replicas for PDF generation (heavy queries). |
| 100k+ POs | Separate read/write databases. Move PDF generation to background jobs (queue-based). Consider event sourcing for audit trail. |

### Scaling Priorities

1. **First bottleneck:** Trigger execution time when voiding invoices with many line items. **Fix:** Batch line item updates using transition tables (AFTER UPDATE OF triggers with `OLD TABLE` / `NEW TABLE`), avoid row-by-row processing.
2. **Second bottleneck:** PDF generation blocking Server Action response. **Fix:** Move to background job queue (Supabase Edge Functions + pg_cron or external queue like BullMQ), return job ID immediately, poll for completion.

**Current architecture is optimized for 0-1k POs scale** (existing codebase size). No premature optimization needed.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Status Calculation

**What people do:** Calculate PO status in React components based on line item data, display computed status in UI.
**Why it's wrong:** Status can drift from reality (stale data, concurrent updates), no single source of truth, error-prone (duplicated logic), race conditions (status updated before line items fetched).
**Do this instead:** Always use database-calculated status from `purchase_orders.status` enum. Let triggers maintain consistency. UI only *displays* status, never *calculates* it.

### Anti-Pattern 2: Optimistic UI for Void/Cancel

**What people do:** Immediately update UI to show "Voided" status before Server Action completes, assuming success.
**Why it's wrong:** Guard triggers may block the operation (stock-in exists, invoices exist), user sees success then error toast (confusing), UI state out of sync with database, requires complex rollback logic.
**Do this instead:** Show loading state during Server Action, wait for result, update UI only on `success: true`. Accept the 200-500ms latency for correctness.

### Anti-Pattern 3: Trigger Chain Without Ordering

**What people do:** Create multiple BEFORE/AFTER triggers on same table without prefix naming convention, assume undefined execution order is acceptable.
**Why it's wrong:** PostgreSQL triggers fire in alphabetical order by name, but this is implicit. Without prefixes, adding new triggers may break cascade logic (audit fires before recalculate), debugging is nightmare (order unclear).
**Do this instead:** Use explicit prefixes: `aa_` for guards (fire first), `zz_` for auditors (fire last). Document the chain in migration comments. Add COMMENT ON TRIGGER explaining position in chain.

### Anti-Pattern 4: Synchronous PDF in Page Load

**What people do:** Generate PDF during page render (e.g., `await generatePDF()` in Server Component), block page load waiting for PDF.
**Why it's wrong:** PDFs are slow (500ms-2s for complex invoices), user stares at blank page, times out on large documents, wastes server resources (re-generate on every visit).
**Do this instead:** Generate PDF on-demand via button click (user-initiated), show loading state, cache result in Supabase Storage (optional), stream to browser as blob download.

### Anti-Pattern 5: Advisory Locks for Status Updates

**What people do:** Use `pg_advisory_lock()` to serialize PO status updates, prevent concurrent modifications.
**Why it's wrong:** Status engine is already transaction-safe (pure function + UPDATE in same transaction), advisory locks add latency (blocking), increase deadlock risk (lock ordering), unnecessary complexity (existing Row-Level Locking sufficient).
**Do this instead:** Rely on PostgreSQL's default Read Committed isolation level and Row-Level Locking. Status triggers run within transaction that modifies line items, automatic serialization. Only use advisory locks for cross-table workflows (not applicable here).

## Performance Optimization Patterns

### Pattern 1: Partial Indexes for Guard Checks

**What:** Create partial indexes with `WHERE is_active = true` for guard trigger lookups.
**Why:** Guard triggers query for active references (e.g., `EXISTS (SELECT 1 FROM invoices WHERE po_id = X AND is_active = true)`). Full table scans are slow.
**Example:**
```sql
-- In migration 069
CREATE INDEX IF NOT EXISTS idx_invoices_po_id_active
  ON invoices(po_id)
  WHERE is_active = true;
```

### Pattern 2: SECURITY DEFINER with search_path

**What:** Audit triggers use `SECURITY DEFINER` to write to `audit_logs` table (RLS bypassed) with `SET search_path = pg_catalog, public` to prevent injection.
**Why:** RLS policies may block trigger's write to audit table, `SECURITY DEFINER` runs as function owner (superuser rights), `search_path` prevents malicious schemas.
**Example:**
```sql
CREATE OR REPLACE FUNCTION zz_audit_po_cancel_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ ... $$;
```

### Pattern 3: Lazy Load PDF Libraries

**What:** Import @react-pdf/renderer dynamically in Server Action, not at module top-level.
**Why:** PDF libraries are heavy (500KB+), lazy import reduces Server Action cold start time, only loads when PDF actually requested.
**Example:**
```typescript
// lib/actions/pdf-actions.ts
export async function generateInvoicePDF(invoiceId: string) {
  // Lazy import (only loaded when this action is called)
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const { InvoicePDFDocument } = await import('@/lib/utils/pdf-generator');

  const pdfBuffer = await renderToBuffer(<InvoicePDFDocument invoice={invoice} />);
  return { success: true, blob: new Uint8Array(pdfBuffer) };
}
```

## Sources

### PostgreSQL Triggers & Performance
- [PostgreSQL Materialized Views & Triggers](https://www.augustinfotech.com/blogs/mastering-postgresql-materialized-views-stored-procedures-and-triggers/)
- [PostgreSQL Triggers in 2026: Design, Performance, and Production Reality](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/)
- [PostgreSQL: Documentation: 18: 13.3. Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)

### PostgreSQL Advisory Locks
- [How to Use Advisory Locks in PostgreSQL](https://oneuptime.com/blog/post/2026-01-25-use-advisory-locks-postgresql/view)
- [PostgreSQL Advisory Locks, explained](https://flaviodelgrosso.com/blog/postgresql-advisory-locks)
- [Advisory Locks in PostgreSQL | Hashrocket](https://hashrocket.com/blog/posts/advisory-locks-in-postgres)

### PostgreSQL Transaction Isolation
- [PostgreSQL: Documentation: 18: 13.2. Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Transaction Isolation in Postgres, explained](https://www.thenile.dev/blog/transaction-isolation-postgres)
- [Understanding Transaction Isolation in PostgreSQL | mkdev](https://mkdev.me/posts/transaction-isolation-levels-with-postgresql-as-an-example)

### Next.js Server Actions & PDF Generation
- [Next.js API Routes vs. Server Actions: Which One to Use and Why?](https://medium.com/@shavaizali159/next-js-api-routes-vs-server-actions-which-one-to-use-and-why-809f09d5069b)
- [Should I Use Server Actions Or APIs?](https://www.pronextjs.dev/should-i-use-server-actions-or-apis)
- [Top 6 Open-Source PDF Libraries for React Developers](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025)
- [Best JavaScript PDF libraries 2025](https://www.nutrient.io/blog/javascript-pdf-libraries/)

### Next.js App Router Configuration
- [File-system conventions: Route Segment Config | Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [Next.js Dynamic Route Segments in the App Router (2026 Guide)](https://thelinuxcode.com/nextjs-dynamic-route-segments-in-the-app-router-2026-guide/)
- [Route Segment Config in Next.js](https://tigerabrodi.blog/route-segment-config-in-nextjs)

---
*Architecture research for: PO Smart Lifecycle, Cancellation Guards & PDF Export*
*Researched: 2026-02-12*
