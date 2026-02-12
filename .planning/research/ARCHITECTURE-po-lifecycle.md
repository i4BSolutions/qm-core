# Architecture: PO Smart Lifecycle, Cancellation Guards & PDF Export

**Domain:** Purchase Order Management with 6-State Lifecycle
**Researched:** 2026-02-12
**Confidence:** HIGH

---

## Executive Summary

This document describes how PO smart lifecycle (6-state status engine), cancellation/void guards, and PDF receipt export integrate with the existing Next.js 14 App Router + Supabase PostgreSQL architecture.

**Key Integration Points:**
- **Database**: New triggers for PO edit/delete guards, enhanced status recalculation with row-level locking
- **API**: New route handler `/api/po/[id]/pdf/route.ts` for server-side PDF generation
- **Components**: New `MatchingTab`, `PDFDownloadButton`, enhanced PO detail page
- **Data Flow**: Trigger cascade on invoice/stock-in → PO status recalculation → audit logging → UI refresh

**Build Order:**
1. Database triggers (guards, enhanced status engine)
2. PDF infrastructure (route handler + template components)
3. UI components (MatchingTab, download button)
4. Integration testing (concurrent operations, lock verification)

---

## System Architecture

### Component Boundaries

| Layer | Component | Responsibility | Communicates With |
|-------|-----------|---------------|-------------------|
| **Database** | purchase_orders table | Stores PO header with smart status field | po_line_items, invoices, audit_logs |
| | po_line_items table | Stores ordered items with tracking (invoiced_quantity, received_quantity) | invoice_line_items, inventory_transactions |
| | Cancellation Guards | Prevents UPDATE/DELETE on closed POs (BEFORE triggers) | Application (raises exceptions) |
| | Status Recalc Trigger | Auto-updates PO status based on invoice/stock-in (AFTER trigger) | po_line_items, calculate_po_status() |
| | Row-Level Lock | Prevents concurrent status updates (FOR UPDATE in trigger) | trigger_update_po_status() |
| **API** | `/api/po/[id]/pdf/route.ts` | Generates PO receipt PDF server-side | Supabase (data), Puppeteer (PDF) |
| | Puppeteer Instance | Renders HTML → PDF with Tailwind styling | HTML template components |
| **Frontend** | `/po/[id]/page.tsx` | PO detail page with tabs, actions, lock indicator | Supabase client, child components |
| | `<MatchingTab />` | Per-line-item PO vs Invoice vs Stock-In comparison | Supabase (3-table join) |
| | `<PDFDownloadButton />` | Triggers PDF download, shows loading state | `/api/po/[id]/pdf` route |
| | `<POStatusBadge />` | Displays status with color + lock icon when closed | PO status enum |

---

## Data Flow Patterns

### Pattern 1: PO Status Recalculation (Trigger-Driven)

**Trigger:** Invoice line item created/updated/deleted OR inventory_in transaction confirmed

**Flow:**
```
1. User Action (Invoice/Stock-In)
   └─→ INSERT/UPDATE on invoice_line_items or inventory_transactions

2. Trigger: update_po_line_invoiced_quantity() or update_po_line_received_quantity()
   └─→ Updates po_line_items.invoiced_quantity or received_quantity

3. Trigger: trigger_update_po_status() (on po_line_items table)
   ├─→ Acquires row lock: SELECT * FROM purchase_orders WHERE id = po_id FOR UPDATE
   ├─→ Calls: calculate_po_status(po_id)
   │   ├─→ SUM(po_line_items.quantity) AS total_ordered
   │   ├─→ SUM(po_line_items.invoiced_quantity) AS total_invoiced
   │   ├─→ SUM(po_line_items.received_quantity) AS total_received
   │   └─→ Returns new status based on comparison logic
   └─→ UPDATE purchase_orders SET status = new_status WHERE id = po_id

4. Trigger: create_audit_log() (on purchase_orders)
   └─→ INSERT INTO audit_logs (action = 'status_change', ...)

5. Frontend: revalidatePath() → UI refresh
```

**Concurrency Handling:** Row-level lock (`FOR UPDATE`) prevents concurrent status updates. Follows existing pattern from `compute_sor_request_status()` (migration 059).

---

### Pattern 2: PO Edit/Delete Prevention (Guard Triggers)

**Trigger:** User attempts UPDATE or DELETE on purchase_orders with status = 'closed'

**Flow:**
```
1. User Action (Edit PO or Delete button)
   └─→ UPDATE/DELETE on purchase_orders WHERE id = po_id

2. Trigger: block_po_edit_when_closed() (BEFORE UPDATE)
   └─→ IF OLD.status = 'closed'
       RAISE EXCEPTION 'Cannot modify closed Purchase Order'

3. Trigger: block_po_delete_when_closed() (BEFORE DELETE)
   └─→ IF OLD.status = 'closed'
       RAISE EXCEPTION 'Cannot delete closed Purchase Order'

4. Frontend: Receives error → displays toast notification
```

**Admin Override:** Option 2 recommended (RPC function `admin_override_po_edit()` with SECURITY DEFINER) for audit trail clarity.

---

### Pattern 3: PDF Generation (Server-Side)

**Trigger:** User clicks "Download PDF" button

**Flow:**
```
1. Client: window.open(`/api/po/${id}/pdf`)
   └─→ GET /api/po/[id]/pdf

2. Route Handler: /api/po/[id]/pdf/route.ts
   ├─→ Validate authentication (Supabase Auth)
   ├─→ Fetch PO data (with supplier, line_items, items)
   ├─→ Render HTML template: <POReceiptTemplate /> → HTML string
   ├─→ Puppeteer: browser.launch() → page.setContent() → page.pdf()
   └─→ Return Response (Content-Type: application/pdf)

3. Client: Browser downloads file as "PO-2025-00001.pdf"
```

**Alternative:** `@react-pdf/renderer` (client-side) if Puppeteer deployment fails on Vercel.

---

## Patterns to Follow

### Row-Level Locking for Status Aggregation

**What:** Acquire exclusive row lock on parent record before aggregating child statuses

**When:** Any trigger that computes parent status from child line items

**Example:**
```sql
-- In trigger_update_po_status()
SELECT * INTO parent_po_record
FROM purchase_orders
WHERE id = target_po_id
FOR UPDATE;  -- Lock prevents concurrent status updates

new_status := calculate_po_status(target_po_id);

UPDATE purchase_orders
SET status = new_status
WHERE id = target_po_id;
```

**Why:** Prevents race condition where two concurrent invoice creations both read same old status.

**Source:** Existing pattern from migration 059 (`compute_sor_request_status`).

---

### Guard Triggers with BEFORE Execution

**What:** Block UPDATE/DELETE operations based on business rules

**When:** Prevent data modification that would violate workflow integrity

**Example:**
```sql
CREATE FUNCTION block_po_edit_when_closed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'Cannot modify closed Purchase Order (PO: %). Contact admin.', OLD.po_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER po_block_edit_closed
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION block_po_edit_when_closed();
```

**Why:** Database-level enforcement ensures business rules apply regardless of client.

**References:**
- [PostgreSQL Trigger Documentation](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [CYBERTEC: Triggers to Enforce Constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/)

---

### RPC-First Mutations for Complex Operations

**What:** Use Supabase RPC functions (SECURITY DEFINER) for multi-step operations

**When:** Operation involves multiple tables or requires privilege escalation

**Example (Admin Override):**
```sql
CREATE FUNCTION admin_override_po_edit(
  p_po_id UUID,
  p_changes JSONB,
  p_override_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT role FROM users WHERE id = auth.uid()) != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin role required');
  END IF;

  INSERT INTO audit_logs (entity_type, entity_id, action, notes)
  VALUES ('purchase_orders', p_po_id, 'admin_override', p_override_reason);

  -- Apply changes (bypasses trigger)
  RETURN jsonb_build_object('success', true);
END;
$$;
```

**Source:** Existing pattern from migration 048 (`update_status_with_note`).

---

## Anti-Patterns to Avoid

### 1. Client-Side Status Calculation

**Why bad:** Race conditions, inconsistency, audit gaps

**Instead:** Use database triggers for all status calculations (existing pattern).

---

### 2. Soft Delete for Closed POs

**Why bad:** Semantic confusion (`is_active = false` means archived, not locked)

**Instead:** Use status-based guards (triggers checking `status = 'closed'`).

---

### 3. Puppeteer in Edge Runtime

**Why bad:** Edge runtime doesn't support native modules (Puppeteer requires Chromium)

**Instead:** Use Node.js runtime:
```typescript
// app/api/po/[id]/pdf/route.ts
export const runtime = 'nodejs'; // NOT 'edge'
```

---

### 4. Inline PDF Generation in Page Component

**Why bad:** Increases page load time, browser expects JSON not binary

**Instead:** Use dedicated API route (`/api/po/[id]/pdf/route.ts`).

---

## New Components

### 1. `<MatchingTab />` Component

**Purpose:** Display per-line-item PO vs invoiced vs received quantities

**Location:** `components/po/matching-tab.tsx`

**Data Query:**
```sql
SELECT
  pli.id, pli.item_name,
  pli.quantity AS po_quantity,
  pli.invoiced_quantity,
  pli.received_quantity,
  (pli.quantity - pli.invoiced_quantity) AS available_to_invoice,
  (pli.invoiced_quantity - pli.received_quantity) AS available_to_receive
FROM po_line_items pli
WHERE pli.po_id = :poId AND pli.is_active = true
ORDER BY pli.created_at;
```

**UI:**
- Table with columns: Item | PO Qty | Invoiced | Received | Available to Invoice | Available to Receive | Match Status
- Badge: "Matched" (green) when po_qty = invoiced = received, "Partial" (amber) otherwise

**Confidence:** HIGH (standard data table, existing patterns)

---

### 2. `<PDFDownloadButton />` Component

**Purpose:** Trigger PDF generation and download

**Location:** `components/po/pdf-download-button.tsx`

**Implementation:**
```typescript
export function PDFDownloadButton({ poId, poNumber }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/po/${poId}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${poNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button onClick={handleDownload} disabled={isDownloading}>
      {isDownloading ? <Loader2 className="animate-spin" /> : <Download />}
      Download PDF
    </Button>
  );
}
```

**Confidence:** HIGH (standard file download pattern)

---

### 3. `POReceiptTemplate` React Component

**Purpose:** HTML template for PDF rendering (used by Puppeteer)

**Location:** `components/pdf/po-receipt-template.tsx`

**Structure:**
```tsx
export function POReceiptTemplate({ po, supplier, lineItems }: Props) {
  return (
    <div className="max-w-4xl mx-auto p-8 bg-white text-black">
      {/* Header: PO Number, Date */}
      {/* Supplier Info Grid */}
      {/* Line Items Table */}
      {/* Footer: Generated timestamp */}
    </div>
  );
}
```

**Styling:** Tailwind utility classes (Puppeteer renders correctly), print-friendly (`bg-white`, `text-black`)

**Confidence:** MEDIUM (Puppeteer CSS rendering may need iteration)

---

## Modified Components

### `/po/[id]/page.tsx` (Enhanced)

**Changes:**
- Add `<MatchingTab />` to tabs list
- Add `<PDFDownloadButton />` to action buttons
- Add lock indicator when `status === 'closed'`:
  ```tsx
  {po.status === 'closed' && (
    <div className="bg-slate-800/50 border border-slate-700 p-3 flex gap-2">
      <Lock className="h-4 w-4 text-amber-500" />
      <span>This PO is closed and cannot be edited.</span>
    </div>
  )}
  ```
- Disable Edit/Cancel buttons when `status === 'closed'`

**Confidence:** HIGH (standard UI changes)

---

## Database Objects

### 1. Cancellation Guard Triggers

**File:** `supabase/migrations/063_po_cancellation_guards.sql`

```sql
CREATE FUNCTION block_po_edit_when_closed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'closed' AND NEW.status != 'cancelled' THEN
    RAISE EXCEPTION 'Cannot modify closed Purchase Order (PO: %).', OLD.po_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER po_block_edit_closed
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION block_po_edit_when_closed();

CREATE FUNCTION block_po_delete_when_closed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'Cannot delete closed Purchase Order (PO: %).', OLD.po_number;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER po_block_delete_closed
  BEFORE DELETE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION block_po_delete_when_closed();
```

**Confidence:** HIGH (standard guard pattern)

---

### 2. Enhanced Status Recalculation (Row-Level Locking)

**File:** `supabase/migrations/064_po_status_row_lock.sql`

```sql
CREATE OR REPLACE FUNCTION trigger_update_po_status()
RETURNS TRIGGER AS $$
DECLARE
  target_po_id UUID;
  po_record RECORD;
  new_status po_status;
BEGIN
  target_po_id := COALESCE(NEW.po_id, OLD.po_id);

  -- Acquire row-level lock (prevents concurrent status updates)
  SELECT * INTO po_record
  FROM purchase_orders
  WHERE id = target_po_id
  FOR UPDATE;

  IF po_record.status = 'cancelled' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  new_status := calculate_po_status(target_po_id);

  UPDATE purchase_orders
  SET status = new_status, updated_at = NOW()
  WHERE id = target_po_id
    AND status IS DISTINCT FROM new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger
DROP TRIGGER IF EXISTS po_line_item_update_status ON po_line_items;
CREATE TRIGGER po_line_item_update_status
  AFTER INSERT OR UPDATE OR DELETE ON po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_po_status();
```

**Confidence:** HIGH (pattern verified from migration 059)

---

## API Route Implementation

### File: `app/api/po/[id]/pdf/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import puppeteer from 'puppeteer';
import { renderToStaticMarkup } from 'react-dom/server';
import { POReceiptTemplate } from '@/components/pdf/po-receipt-template';

export const runtime = 'nodejs'; // REQUIRED for Puppeteer

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const poId = params.id;

  try {
    const supabase = await createClient();

    // 1. Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch PO data
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:suppliers(*),
        line_items:po_line_items!po_line_items_po_id_fkey(*, item:items(id, name, sku))
      `)
      .eq('id', poId)
      .single();

    if (poError || !po) {
      return NextResponse.json({ error: 'PO not found' }, { status: 404 });
    }

    // 3. Render React component to HTML
    const htmlContent = renderToStaticMarkup(
      <POReceiptTemplate po={po} supplier={po.supplier} lineItems={po.line_items} />
    );

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><script src="https://cdn.tailwindcss.com"></script></head>
        <body>${htmlContent}</body>
      </html>
    `;

    // 4. Generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    });

    await browser.close();

    // 5. Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${po.po_number}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
```

**Dependencies:**
```bash
npm install puppeteer react-dom @sparticuz/chromium puppeteer-core
npm install -D @types/react-dom
```

**Vercel Deployment:** Use `@sparticuz/chromium` for serverless Chromium binary.

**Confidence:** MEDIUM (Puppeteer straightforward, serverless deployment may need iteration)

**References:**
- [Puppeteer PDF Generation](https://pptr.dev/guides/pdf-generation)
- [Next.js PDF with Puppeteer](https://medium.com/front-end-weekly/dynamic-html-to-pdf-generation-in-next-js-a-step-by-step-guide-with-puppeteer-dbcf276375d7)

---

## Build Order (Dependency-Aware)

### Phase 1: Database Triggers
**Dependencies:** None

1. Create `063_po_cancellation_guards.sql` (block edit/delete)
2. Create `064_po_status_row_lock.sql` (enhance with FOR UPDATE)
3. Test: Edit/delete closed PO → verify exception

**Output:** Database enforces guards, status recalculation race-free

---

### Phase 2: PDF Infrastructure
**Dependencies:** None (parallel with Phase 1)

1. Install: `npm install puppeteer react-dom @sparticuz/chromium puppeteer-core`
2. Create `components/pdf/po-receipt-template.tsx`
3. Create `app/api/po/[id]/pdf/route.ts`
4. Test: Access `/api/po/{id}/pdf` → should download PDF

**Output:** PDF generation working end-to-end

---

### Phase 3: UI Components
**Dependencies:** Phase 1 (database triggers)

1. Create `components/po/matching-tab.tsx`
2. Create `components/po/pdf-download-button.tsx`
3. Modify `/po/[id]/page.tsx` (add tabs, actions, lock indicator)
4. Test: Navigate to closed PO → verify lock + disabled buttons

**Output:** Complete UI integration

---

### Phase 4: Integration Testing
**Dependencies:** All previous phases

Test flows:
- Lifecycle progression (not_started → partially_invoiced → closed)
- Guard enforcement (edit/delete closed PO fails)
- PDF generation (download matches PO data)
- Concurrent operations (two invoices simultaneously → status correct)

**Output:** All features working, edge cases handled

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Database Triggers | HIGH | Standard guard pattern, row-locking verified from migration 058/059 |
| Status Engine | HIGH | Existing `calculate_po_status()` unchanged, only trigger enhanced |
| Cancellation Guards | HIGH | BEFORE trigger pattern well-documented, PostgreSQL standard |
| Puppeteer PDF | MEDIUM | Library well-supported, serverless deployment may need iteration |
| React PDF Template | MEDIUM | Tailwind rendering mostly works, may need CSS adjustments |
| Matching Tab | HIGH | Standard data table, 3-table join straightforward |
| UI Integration | HIGH | Existing patterns (DetailPageLayout, tabs, badges) |
| Concurrency | HIGH | Row-level locking proven in existing codebase |

**Overall:** HIGH for database/backend, MEDIUM for PDF (deployment considerations)

---

## Gaps to Address

### 1. Admin Override (Optional for MVP)

**Gap:** No admin override for editing closed POs

**Options:**
- A: RPC function `admin_override_po_edit()` with SECURITY DEFINER
- B: Manual SQL by DBA with audit note
- C: Status → cancelled → edit → re-close (workflow workaround)

**Recommendation:** Option C for MVP + document A for future

**Confidence:** LOW (not required for MVP)

---

### 2. PDF Template Styling

**Gap:** Puppeteer may not render Tailwind perfectly

**Mitigation:**
- Start simple (tables + text)
- Test visually
- Iterate (use inline styles if needed)

**Confidence:** MEDIUM (requires manual testing)

---

### 3. Vercel Deployment for Puppeteer

**Gap:** Chromium binary (~300MB) may exceed Vercel limits

**Mitigation:**
- Use `@sparticuz/chromium-min` (~50MB)
- Upgrade to Vercel Pro
- Alternative: Migrate to `@react-pdf/renderer`

**Confidence:** LOW (deployment-specific)

**References:**
- [Vercel Puppeteer Discussion](https://github.com/vercel/next.js/discussions/30034)
- [browserless/vercel-puppeteer](https://github.com/browserless/vercel-puppeteer)

---

### 4. Matching Tab Performance

**Gap:** 3-table join may slow at 10K+ line items

**Mitigation:**
- Add indexes on `invoice_line_items(po_line_item_id)`
- Add index on `inventory_transactions(invoice_line_item_id)`
- Future: Materialized view

**Confidence:** HIGH (indexes sufficient for MVP)

---

## Sources

### PostgreSQL Triggers
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- [CYBERTEC: Enforce Constraints](https://www.cybertec-postgresql.com/en/triggers-to-enforce-constraints/)
- [BEFORE DELETE Trigger (Neon)](https://neon.com/postgresql/postgresql-triggers/postgresql-before-delete-trigger)
- [Supabase Triggers](https://supabase.com/docs/guides/database/postgres/triggers)

### PO Lifecycle Patterns
- [Dynamics 365: PO Overview](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-overview)
- [Managing PO Status (Logan)](https://www.loganconsulting.com/blog/managing-purchase-order-status-in-microsoft-dynamics-365-scm/)
- [PO Status Types (Microsoft)](https://learn.microsoft.com/en-us/troubleshoot/dynamics/gp/different-types-purchase-order-statuses)

### Next.js PDF
- [Puppeteer Guide](https://pptr.dev/guides/pdf-generation)
- [Dynamic PDF (Medium)](https://medium.com/front-end-weekly/dynamic-html-to-pdf-generation-in-next-js-a-step-by-step-guide-with-puppeteer-dbcf276375d7)
- [Next.js 15 PDF (Dev Genius)](https://blog.devgenius.io/pdf-generation-in-next-js-15-with-puppeteer-3023df1ead95)
- [Creating PDF (Medium)](https://medium.com/@farmaan30327/creating-a-pdf-in-next-js-backend-using-pupeteer-bdc27c99b1e8)
- [PDF Engine (Strapi)](https://strapi.io/blog/build-a-pdf-generation-engine-with-nextjs-puppeteer-and-strapi)

### React PDF & SSR
- [react-pdf Discussion](https://github.com/diegomura/react-pdf/discussions/2402)
- [@react-pdf/renderer NPM](https://www.npmjs.com/package/@react-pdf/renderer)
- [Compatibility Docs](https://react-pdf.org/compatibility)
- [Next.js 14 Integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515)

### Vercel
- [Puppeteer Discussion](https://github.com/vercel/next.js/discussions/30034)
- [browserless Example](https://github.com/browserless/vercel-puppeteer)

---

**End of Architecture Document**
