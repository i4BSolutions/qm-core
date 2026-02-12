# Technology Stack

**Project:** QM System - PO Smart Lifecycle, Cancellation Guards, PDF Export
**Researched:** 2026-02-12

---

## NEW Stack Additions

### PDF Generation (@react-pdf/renderer)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@react-pdf/renderer** | ^4.3.2 | Server-side PDF generation for invoices, money-out receipts, stock-out receipts | React-like declarative API, works in Next.js 14+ App Router with workarounds, generates PDFs server-side without headless browser overhead. |

**Rationale:** QM System already has `react-pdf` (^10.0.0) for **viewing** PDFs, but NOT for **generating** them. The project needs to export receipts matching app UI style.

**Why @react-pdf/renderer:**
- **Declarative React syntax** - Define PDF structure with JSX-like components (`<Document>`, `<Page>`, `<View>`, `<Text>`)
- **Server-side compatible** - Works in Next.js API routes (requires workaround for App Router <14.1.1)
- **No browser required** - Unlike Puppeteer/Playwright, no headless Chrome overhead
- **Styling with Tailwind-like primitives** - Flexbox layout, style objects similar to React Native
- **Existing ecosystem fit** - Team already familiar with React patterns

**Why NOT alternatives:**
- ❌ **jsPDF** - Imperative API (manual positioning), harder to maintain complex layouts
- ❌ **pdfmake** - JSON-based declarative structure is powerful but less intuitive for React developers
- ❌ **Puppeteer** - Heavy (300MB+ Chromium), slow startup, overkill for simple receipts
- ❌ **pdf-lib** - Low-level PDF manipulation, not designed for document generation from scratch

**Next.js 14 Compatibility Issue:**
Before Next.js 14.1.1, App Router had bug causing "TypeError: ba.Component is not a constructor" with @react-pdf/renderer. Project uses Next.js 14.2.13 (safe). If downgrading needed, add to `next.config.js`:

```javascript
experimental: {
  serverComponentsExternalPackages: ['@react-pdf/renderer']
}
```

**Sources:**
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) - Latest version 4.3.2
- [NextJS 14 and react-pdf integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) - Integration guide
- [react-pdf GitHub Discussion #2402](https://github.com/diegomura/react-pdf/discussions/2402) - Server-side rendering patterns
- [Top 6 Open-Source PDF Libraries for React](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025) - Comparison
- [JS PDF Generation libraries comparison](https://dmitriiboikov.com/posts/2025/01/pdf-generation-comarison/) - Performance benchmarks

---

### PO Status Engine (NO NEW DEPENDENCIES)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL Enum + Triggers** | Built-in | 6-state status engine for PO lifecycle | System already has proven pattern: `po_status` enum exists, `calculate_po_status()` function exists, trigger infrastructure established in migrations 015-016. |

**Current implementation (ALREADY EXISTS):**
- ✅ Enum: `po_status` with 6 values: `not_started`, `partially_invoiced`, `awaiting_delivery`, `partially_received`, `closed`, `cancelled`
- ✅ Function: `calculate_po_status(po_id)` - Computes status from `total_ordered` vs `total_invoiced` vs `total_received`
- ✅ Trigger: `trigger_update_po_status()` - Fires AFTER po_line_items INSERT/UPDATE/DELETE
- ✅ Aggregate tracking: `invoiced_quantity`, `received_quantity` on `po_line_items` table

**What's NEW for this milestone:**
1. **Enhanced status logic** - Refine edge cases (e.g., over-invoicing, partial cancellation)
2. **Status transition validation** - Add BEFORE UPDATE trigger to block invalid transitions
3. **Manual status override** - Allow setting `cancelled` manually (bypass auto-calculation)

**NO new libraries needed** - Pure PostgreSQL native features.

**Pattern proven in codebase:**
- Migration 016 already has `calculate_po_status()` with 150+ lines of logic
- Migration 041 shows cascade audit pattern (invoice void → PO status recalc)
- Migration 059 shows row-level locking for status aggregation (prevents stale reads)

**Sources:**
- [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) - Modern trigger patterns
- [Implementing State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) - Finite state machine patterns
- [PostgreSQL Triggers Performance](https://infinitelambda.com/postgresql-triggers/) - Performance considerations
- [Generated Columns vs Triggers](https://ongres.com/blog/generate_columns_vs_triggers/) - When to use triggers vs generated columns

---

### Cancellation Guards (NO NEW DEPENDENCIES)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL BEFORE DELETE/UPDATE Triggers** | Built-in | Block PO cancellation/deletion when invoices or stock-in exist | System already uses this pattern extensively: migration 057 (deletion protection), 040 (block invoice void), 020 (block money-out for PO route). |

**Current implementation patterns (ALREADY ESTABLISHED):**

**Pattern 1: Block deletion via BEFORE DELETE trigger**
```sql
-- Return NULL to cancel the deletion
CREATE OR REPLACE FUNCTION block_po_deletion_with_children()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM invoices WHERE po_id = OLD.id AND is_active = true) THEN
    RAISE EXCEPTION 'Cannot delete: PO has active invoices';
  END IF;
  RETURN NULL; -- Blocks the DELETE operation
END;
$$ LANGUAGE plpgsql;
```

**Pattern 2: Block status change via BEFORE UPDATE trigger**
```sql
-- Return OLD to prevent the update
CREATE OR REPLACE FUNCTION block_po_cancellation_with_stockin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    IF EXISTS (
      SELECT 1 FROM inventory_transactions it
      JOIN invoice_line_items ili ON ili.invoice_id = it.invoice_id
      JOIN invoices i ON i.id = ili.invoice_id
      WHERE i.po_id = OLD.id
        AND it.movement_type = 'inventory_in'
        AND it.is_active = true
    ) THEN
      RAISE EXCEPTION 'Cannot cancel: inventory has been received against this PO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Existing guard examples in codebase:**
- Migration 040: `block_invoice_void_with_stockin()` - Prevents voiding invoices with stock-in
- Migration 057: `block_item_deactivation()` - Prevents soft-delete of items in use (5 reference checks)
- Migration 020: `validate_transaction_type_for_route()` - Blocks money-out for PO routes

**Guard hierarchy for PO:**
1. **Block hard delete** if any invoices exist (active or voided)
2. **Block cancellation** if any stock-in exists
3. **Allow cancellation** if only invoices exist (no stock-in) - creates audit trail

**Trigger naming convention:** Use `aa_` prefix to fire BEFORE audit triggers (alphabetical ordering).

**Performance:** Uses partial indexes for fast reference checking (pattern from migration 040):
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_po_active
  ON invoices(po_id)
  WHERE is_active = true;
```

**Sources:**
- [PostgreSQL BEFORE DELETE Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-before-delete-trigger/) - Official pattern
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) - Return NULL to cancel operation
- [Preventing Deletions with Triggers](https://www.postgresql.org/message-id/4042.1085153332@sss.pgh.pa.us) - PostgreSQL mailing list guidance
- [How to Implement Soft Deletes](https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view) - Soft delete patterns

---

## Supporting Infrastructure (Already in Stack)

### Trigger Infrastructure
| Component | Version | Purpose | Usage in Milestone |
|-----------|---------|---------|-------------------|
| PostgreSQL PL/pgSQL | Built-in | Trigger functions | All guard logic, status calculations |
| Trigger ordering (`aa_`, `zz_` prefix) | Convention | Control execution order | `aa_block_*` fires before `audit_*` |
| Advisory locks (`pg_advisory_xact_lock`) | Built-in | Prevent race conditions | Optional for concurrent PO updates |
| Row-level locking (`FOR UPDATE`) | Built-in | Serialize status aggregation | Proven in migration 059 |

### Audit Trail
| Component | Version | Purpose | Usage in Milestone |
|-----------|---------|---------|-------------------|
| `audit_logs` table | Existing | Track all changes | Capture PO status transitions, cancellation attempts |
| `create_audit_log()` trigger | Existing | Auto-log changes | Applied to `purchase_orders` table |
| Cascade audit (migration 041) | Existing | Log cascade effects | Pattern for PO cancellation → invoice impact |

### Database Performance Patterns
| Pattern | Source Migration | Purpose | Usage in Milestone |
|---------|-----------------|---------|-------------------|
| Partial indexes | 040, 054 | Fast filtered lookups | Index `invoices(po_id) WHERE is_active = true` |
| Conditional triggers (WHEN clause) | N/A (PostgreSQL native) | Skip unnecessary trigger fires | `WHEN (NEW.status IS DISTINCT FROM OLD.status)` |
| Transaction-level advisory locks | 058 | Prevent race conditions | Optional for high-concurrency PO updates |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **PDF Generation** | @react-pdf/renderer | Puppeteer | Heavy (300MB Chromium), slow startup (1-2s), overkill for simple receipts. Good for complex browser rendering needs. |
| **PDF Generation** | @react-pdf/renderer | pdfmake | JSON-based declarative is powerful but less intuitive for React team. Valid alternative if @react-pdf has issues. |
| **PDF Generation** | @react-pdf/renderer | jsPDF | Imperative API (manual X/Y positioning) harder to maintain. Good for simple one-off documents. |
| **Status Engine** | PostgreSQL triggers | Computed column (GENERATED ALWAYS AS) | Can't use: status depends on aggregating child rows, not single-row expression. Generated columns only support IMMUTABLE functions. |
| **Status Engine** | PostgreSQL triggers | Application-layer (Next.js) | Unsafe: status updates could be skipped by direct database access, bulk imports, or manual SQL. Database-level enforcement guarantees consistency. |
| **Cancellation Guards** | BEFORE triggers with RAISE EXCEPTION | Foreign key ON DELETE RESTRICT | Too coarse: FK prevents deletion entirely, we need conditional logic (allow if no stock-in, block if stock-in exists). |
| **Cancellation Guards** | BEFORE triggers | Application-layer validation (Next.js) | Unsafe: guards could be bypassed. Database-level enforcement is final arbiter. |
| **Row Locking** | Row-level locks (FOR UPDATE) | Advisory locks | Both valid. Row locks simpler for single-row aggregation. Advisory locks better for complex multi-table coordination. Use row locks for PO status (following migration 059 pattern). |

---

## Installation

### New Dependencies

```bash
# PDF generation library
npm install @react-pdf/renderer@^4.3.2

# Type definitions (included in package, but for reference)
# @react-pdf/renderer includes built-in TypeScript definitions
```

### No Database Dependencies

All database features use PostgreSQL built-in capabilities:
- ✅ PL/pgSQL (included)
- ✅ Trigger system (included)
- ✅ Enum types (included)
- ✅ Advisory locks (included)
- ✅ Row-level locks (included)

### Type Generation (After Status Enum Changes)

```bash
# If po_status enum values change
npx supabase gen types typescript --local > types/database.ts
```

---

## Integration Points

### 1. PDF Export API Routes

**File structure:**
```
/app/api/pdf/
  ├─ invoice/[id]/route.ts       # GET /api/pdf/invoice/123
  ├─ money-out/[id]/route.ts     # GET /api/pdf/money-out/456
  └─ stock-out/[id]/route.ts     # GET /api/pdf/stock-out/789
```

**Route handler pattern (Next.js 14 App Router):**
```typescript
// app/api/pdf/invoice/[id]/route.ts
import { renderToBuffer } from '@react-pdf/renderer';
import InvoiceReceiptDocument from '@/components/pdf/invoice-receipt';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 1. Fetch data from Supabase
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*), purchase_orders(*)')
    .eq('id', params.id)
    .single();

  // 2. Generate PDF buffer
  const pdfBuffer = await renderToBuffer(
    <InvoiceReceiptDocument data={invoice} />
  );

  // 3. Return with proper headers
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  });
}
```

**PDF Document component pattern:**
```typescript
// components/pdf/invoice-receipt.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40 },
  header: { fontSize: 18, marginBottom: 20 },
  table: { display: 'flex', flexDirection: 'column' },
  row: { flexDirection: 'row', borderBottom: '1 solid #ccc' },
  // ... Tailwind-like utility styles
});

export default function InvoiceReceiptDocument({ data }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text>Invoice: {data.invoice_number}</Text>
        </View>
        <View style={styles.table}>
          {data.invoice_line_items.map(item => (
            <View style={styles.row} key={item.id}>
              <Text>{item.item_name}</Text>
              <Text>{item.quantity}</Text>
              <Text>{formatCurrency(item.total_price)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
```

**Client-side download trigger:**
```typescript
// components/invoice/invoice-actions.tsx
async function handleDownloadPDF(invoiceId: string) {
  const response = await fetch(`/api/pdf/invoice/${invoiceId}`);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${invoiceId}.pdf`;
  a.click();
  window.URL.revokeObjectURL(url);
}
```

**Sources:**
- [Next.js API Routes Documentation](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) - Official API route patterns
- [How to Implement Download Files in NextJS](https://reacthustle.com/blog/how-to-implement-download-files-in-nextjs-using-an-api-route) - Binary file download
- [Download a File From App Router API](https://www.codeconcisely.com/posts/nextjs-app-router-api-download-file/) - Next.js 14 App Router specific

---

### 2. PO Status Engine Enhancement

**Migration file structure:**
```
supabase/migrations/
  ├─ 0XX_po_status_transitions.sql        # State transition validation
  ├─ 0XX_po_status_manual_override.sql    # Allow manual cancellation
  └─ 0XX_po_status_edge_cases.sql         # Refinements for over-invoicing, partial scenarios
```

**State transition validation:**
```sql
-- Block invalid status transitions
CREATE OR REPLACE FUNCTION validate_po_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow manual cancellation from any state
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Block manual changes to auto-calculated states
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- If status changed by user (not trigger), validate it's allowed
    IF NOT (pg_trigger_depth() > 1) THEN
      RAISE EXCEPTION 'Cannot manually set PO status to %. Status is auto-calculated from invoices and stock-in.',
        NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire BEFORE auto-calculation trigger
DROP TRIGGER IF EXISTS aa_validate_po_status_transition ON purchase_orders;
CREATE TRIGGER aa_validate_po_status_transition
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION validate_po_status_transition();
```

**Enhanced status calculation (refine existing function):**
```sql
-- Refine calculate_po_status() for edge cases
CREATE OR REPLACE FUNCTION calculate_po_status(p_po_id UUID)
RETURNS po_status AS $$
DECLARE
  total_ordered DECIMAL(15,2);
  total_invoiced DECIMAL(15,2);
  total_received DECIMAL(15,2);
  tolerance DECIMAL(15,2) := 0.01; -- 1 cent tolerance for floating-point
BEGIN
  -- Check if manually cancelled (bypass calculation)
  IF EXISTS (
    SELECT 1 FROM purchase_orders
    WHERE id = p_po_id AND status = 'cancelled'
  ) THEN
    RETURN 'cancelled'::po_status;
  END IF;

  -- Get totals with row-level lock (prevent stale reads)
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(invoiced_quantity), 0),
    COALESCE(SUM(received_quantity), 0)
  INTO total_ordered, total_invoiced, total_received
  FROM po_line_items
  WHERE po_id = p_po_id AND is_active = true
  FOR UPDATE; -- Lock rows during aggregation

  -- Edge case: No line items or all zero
  IF total_ordered <= tolerance THEN
    RETURN 'not_started'::po_status;
  END IF;

  -- Fully matched (allow tolerance for floating-point errors)
  IF (total_received >= total_ordered - tolerance) AND
     (total_invoiced >= total_ordered - tolerance) THEN
    RETURN 'closed'::po_status;
  END IF;

  -- Partially received (some goods received, but not all)
  IF total_received > tolerance AND total_received < total_ordered - tolerance THEN
    RETURN 'partially_received'::po_status;
  END IF;

  -- Awaiting delivery (fully invoiced, nothing received yet)
  IF total_invoiced >= total_ordered - tolerance AND total_received <= tolerance THEN
    RETURN 'awaiting_delivery'::po_status;
  END IF;

  -- Partially invoiced (some invoiced, but not fully)
  IF total_invoiced > tolerance AND total_invoiced < total_ordered - tolerance THEN
    RETURN 'partially_invoiced'::po_status;
  END IF;

  RETURN 'not_started'::po_status;
END;
$$ LANGUAGE plpgsql;
```

**Sources:**
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) - FOR UPDATE documentation
- [Row-level Locking in Status Aggregation](https://oneuptime.com/blog/post/2026-01-25-use-advisory-locks-postgresql/view) - Advisory locks vs row locks
- [State Machine Trigger Patterns](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) - Validation patterns

---

### 3. Cancellation Guards

**Migration file:**
```
supabase/migrations/0XX_po_cancellation_guards.sql
```

**Guard 1: Block hard delete if invoices exist**
```sql
CREATE OR REPLACE FUNCTION block_po_deletion_with_invoices()
RETURNS TRIGGER AS $$
DECLARE
  invoice_count INT;
BEGIN
  -- Check if PO has any invoices (active or voided)
  SELECT COUNT(*) INTO invoice_count
  FROM invoices
  WHERE po_id = OLD.id;

  IF invoice_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: PO has % invoice(s). Use cancellation instead.', invoice_count;
  END IF;

  -- Allow deletion if no invoices
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS aa_block_po_deletion ON purchase_orders;
CREATE TRIGGER aa_block_po_deletion
  BEFORE DELETE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION block_po_deletion_with_invoices();
```

**Guard 2: Block cancellation if stock-in exists**
```sql
CREATE OR REPLACE FUNCTION block_po_cancellation_with_stockin()
RETURNS TRIGGER AS $$
DECLARE
  stockin_exists BOOLEAN;
BEGIN
  -- Only check when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status != 'cancelled' OR OLD.status IS NULL) THEN
    -- Check if any stock-in exists for this PO (via invoices)
    SELECT EXISTS (
      SELECT 1
      FROM inventory_transactions it
      JOIN invoices i ON i.id = it.invoice_id
      WHERE i.po_id = OLD.id
        AND it.movement_type = 'inventory_in'
        AND it.is_active = true
    ) INTO stockin_exists;

    IF stockin_exists THEN
      RAISE EXCEPTION 'Cannot cancel: inventory has been received against this PO. Physical stock exists.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire BEFORE status validation trigger (aa_ prefix)
DROP TRIGGER IF EXISTS aa_block_po_cancellation_stockin ON purchase_orders;
CREATE TRIGGER aa_block_po_cancellation_stockin
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION block_po_cancellation_with_stockin();
```

**Partial index for performance:**
```sql
-- Fast lookup: invoices by PO with active stock-in
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_po_stockin
  ON inventory_transactions(invoice_id)
  WHERE movement_type = 'inventory_in' AND is_active = true;
```

**Audit trail for cancellation attempts:**
```sql
-- Log cancellation events (uses existing audit_logs table)
CREATE OR REPLACE FUNCTION audit_po_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    INSERT INTO audit_logs (
      entity_type, entity_id, action,
      field_name, old_value, new_value,
      changes_summary,
      changed_by, changed_at
    ) VALUES (
      'purchase_orders',
      NEW.id,
      'status_change',
      'status',
      OLD.status::TEXT,
      'cancelled',
      'PO ' || NEW.po_number || ' cancelled by user',
      NEW.updated_by,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire AFTER cancellation succeeds (zz_ prefix to fire last)
DROP TRIGGER IF EXISTS zz_audit_po_cancellation ON purchase_orders;
CREATE TRIGGER zz_audit_po_cancellation
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION audit_po_cancellation();
```

**Frontend cancellation flow:**
```typescript
// components/po/po-cancel-dialog.tsx
async function handleCancelPO(poId: string, reason: string) {
  try {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status: 'cancelled', notes: reason })
      .eq('id', poId);

    if (error) {
      // Trigger will throw exception with message
      toast.error(error.message); // "Cannot cancel: inventory has been received..."
    } else {
      toast.success('PO cancelled successfully');
    }
  } catch (err) {
    toast.error('Failed to cancel PO');
  }
}
```

**Sources:**
- [PostgreSQL BEFORE DELETE Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-before-delete-trigger/) - Return OLD vs NULL
- [Trigger to prevent deletion](https://www.tek-tips.com/threads/trigger-to-prevent-insert-update-delete.1116256/) - RAISE EXCEPTION pattern
- [PostgreSQL Best Practices for DELETE](https://runebook.dev/en/docs/postgresql/sql-delete) - TRUNCATE vs soft deletes

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| PDF Generation | **HIGH** | @react-pdf/renderer is mature (v4.3.2), proven in React ecosystem. Next.js 14.2.13 compatible (bug fixed in 14.1.1+). Pattern straightforward: API route → renderToBuffer → Response with headers. |
| PO Status Engine | **HIGH** | Infrastructure already exists (migrations 015-016). Enhancement is refinement (edge cases, tolerance) not new architecture. Row-level locking pattern proven in migration 059. |
| Cancellation Guards | **HIGH** | Pattern extensively used in codebase (migrations 020, 040, 057). BEFORE trigger + RAISE EXCEPTION is PostgreSQL best practice. Partial indexes ensure performance. |
| Trigger Performance | **MEDIUM** | Status recalculation on every line item change could add latency at scale. Mitigation: row locks (not advisory locks) for single-PO aggregation, WHEN clause to skip unchanged rows. Monitor with EXPLAIN ANALYZE if >10k POs. |

---

## What NOT to Add

### Don't Add These Libraries

1. **Puppeteer / Playwright** - Headless browser for PDF generation too heavy (300MB Chromium, 1-2s startup). Use @react-pdf/renderer.
2. **pdfmake** - Valid alternative but JSON-based API less intuitive for React team. Prefer @react-pdf/renderer.
3. **jsPDF** - Imperative X/Y positioning harder to maintain. Only if @react-pdf fails.
4. **html2pdf / html2canvas** - Client-side only, can't run in API routes. Not suitable for server-side generation.
5. **Workflow engine (Camunda, Temporal)** - PO lifecycle is simple 6-state FSM, not BPMN workflow. PostgreSQL triggers sufficient.
6. **State machine library (XState)** - Application-layer state management. Database-level enforcement needed for consistency.
7. **ORM (Drizzle, Prisma)** - Project uses raw SQL migrations. Adding ORM introduces migration complexity without value.

### Why Minimal Additions

**Bundle impact:**
- @react-pdf/renderer: ~600KB (adds to server bundle, not client)
- PDF generation happens server-side (API routes), no client-side impact
- Zero client bundle increase for status engine and guards (database-only)

**Current stack sufficiency:**
- ✅ PostgreSQL triggers (status engine, guards)
- ✅ Enum types (po_status)
- ✅ Audit logs table (cancellation trail)
- ✅ RLS policies (permission enforcement)
- ✅ Next.js 14 API routes (PDF download endpoints)

**Philosophy:** Use database-level enforcement for data integrity. Application layer is presentation and user experience.

---

## Sources

### Primary (HIGH Confidence)
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) - Official package, version 4.3.2
- [PostgreSQL Trigger Functions Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html) - Official trigger patterns
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) - FOR UPDATE, advisory locks
- [Next.js API Routes Documentation](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) - Official API route patterns

### Secondary (MEDIUM Confidence)
- [NextJS 14 and react-pdf integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) - Integration guide with workarounds
- [react-pdf GitHub Discussion #2402](https://github.com/diegomura/react-pdf/discussions/2402) - Server-side rendering in Next.js 13+
- [Top 6 Open-Source PDF Libraries for React](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025) - Library comparison
- [JS PDF Generation libraries comparison](https://dmitriiboikov.com/posts/2025/01/pdf-generation-comarison/) - Performance benchmarks
- [PostgreSQL Triggers in 2026](https://thelinuxcode.com/postgresql-triggers-in-2026-design-performance-and-production-reality/) - Modern trigger patterns
- [How to Implement Download Files in NextJS](https://reacthustle.com/blog/how-to-implement-download-files-in-nextjs-using-an-api-route) - Binary file download
- [Download a File From App Router API](https://www.codeconcisely.com/posts/nextjs-app-router-api-download-file/) - Next.js 14 App Router

### PostgreSQL Patterns (MEDIUM to HIGH Confidence)
- [Implementing State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) - FSM trigger patterns
- [PostgreSQL Triggers Performance](https://infinitelambda.com/postgresql-triggers/) - Performance impact analysis
- [Generated Columns vs Triggers](https://ongres.com/blog/generate_columns_vs_triggers/) - When to use triggers
- [PostgreSQL BEFORE DELETE Trigger](https://neon.com/postgresql/postgresql-triggers/postgresql-before-delete-trigger/) - Deletion blocking
- [Preventing Deletions with Triggers](https://www.postgresql.org/message-id/4042.1085153332@sss.pgh.pa.us) - PostgreSQL mailing list
- [How to Implement Soft Deletes](https://oneuptime.com/blog/post/2026-01-21-postgresql-soft-deletes/view) - Soft delete patterns
- [How to Use Advisory Locks](https://oneuptime.com/blog/post/2026-01-25-use-advisory-locks-postgresql/view) - Advisory locks vs row locks
- [Enums vs Check Constraints](https://www.crunchydata.com/blog/enums-vs-check-constraints-in-postgres) - Enum best practices

---

## Implementation Checklist

### Phase 1: PDF Export Infrastructure
- [ ] Install `@react-pdf/renderer@^4.3.2`
- [ ] Verify Next.js version (14.2.13) - no workaround needed
- [ ] Create `components/pdf/` directory for PDF document components
- [ ] Create base styles file `components/pdf/styles.ts` (Tailwind-like utilities)
- [ ] Create API route `/app/api/pdf/invoice/[id]/route.ts`
- [ ] Create PDF document component `components/pdf/invoice-receipt.tsx`
- [ ] Test PDF generation with sample invoice data
- [ ] Add download button to invoice detail page
- [ ] Repeat for money-out and stock-out receipts

### Phase 2: PO Status Engine Enhancement
- [ ] Write migration `0XX_po_status_transitions.sql`
  - [ ] Add state transition validation trigger
  - [ ] Allow manual cancellation bypass
  - [ ] Block manual changes to auto-calculated states
- [ ] Write migration `0XX_po_status_edge_cases.sql`
  - [ ] Refine `calculate_po_status()` with tolerance for floating-point
  - [ ] Add row-level locking (`FOR UPDATE`)
  - [ ] Handle over-invoicing edge case
- [ ] Test status calculations with various scenarios:
  - [ ] Normal flow: not_started → partially_invoiced → awaiting_delivery → partially_received → closed
  - [ ] Manual cancellation from each state
  - [ ] Over-invoicing (qty > ordered)
  - [ ] Partial scenarios (some lines invoiced, others not)
- [ ] Verify trigger ordering (status validation BEFORE auto-calculation)

### Phase 3: Cancellation Guards
- [ ] Write migration `0XX_po_cancellation_guards.sql`
  - [ ] Add `block_po_deletion_with_invoices()` trigger
  - [ ] Add `block_po_cancellation_with_stockin()` trigger
  - [ ] Add `audit_po_cancellation()` trigger
  - [ ] Create partial index for performance
- [ ] Test guard logic:
  - [ ] Attempt delete PO with invoices (should block)
  - [ ] Attempt delete PO without invoices (should allow)
  - [ ] Attempt cancel PO with stock-in (should block with clear message)
  - [ ] Attempt cancel PO without stock-in (should allow)
- [ ] Add frontend cancellation dialog with reason input
- [ ] Display guard error messages clearly to user
- [ ] Verify audit trail captures cancellation events

### Phase 4: Integration Testing
- [ ] End-to-end test: Create PO → Generate invoice → Download PDF
- [ ] End-to-end test: Create PO → Cancel before invoice (should succeed)
- [ ] End-to-end test: Create PO → Invoice → Stock-in → Cancel (should block)
- [ ] Performance test: Status recalculation with 100+ line items
- [ ] Monitor trigger execution time with `EXPLAIN ANALYZE`
- [ ] Verify audit logs capture all status transitions and cancellation attempts

---

**Total New Dependencies:** 1 (@react-pdf/renderer)

**Complexity:** Low (PDF API routes) to Medium (trigger refinement, guard logic testing)

**Risk Areas:**
1. **PDF styling** - @react-pdf/renderer uses subset of CSS, not full Tailwind. Expect manual style conversion.
2. **Trigger performance** - Status recalculation fires on every line item change. Monitor latency at scale (>10k POs).
3. **State transition edge cases** - Ensure guards handle all scenarios (voided invoices, partial stock-in, etc.).

**Recommended:** Execute phases sequentially. PDF infrastructure first (low risk, independent). Status engine second (medium risk, test thoroughly). Guards last (highest complexity, depends on status logic).
