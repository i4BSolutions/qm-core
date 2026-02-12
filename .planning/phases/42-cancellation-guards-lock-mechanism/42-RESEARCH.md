# Phase 42: Cancellation Guards & Lock Mechanism - Research

**Researched:** 2026-02-12
**Domain:** PostgreSQL guard triggers, React disabled state with tooltips, read-only terminal states
**Confidence:** HIGH

## Summary

Phase 42 enforces financial integrity by preventing destructive actions when dependencies exist (guard pattern), making terminal states read-only, and providing visual feedback for matching progress. The codebase already has strong foundations: Phase 41 added PO cancellation infrastructure (fields + Server Action), Phase 12 implemented invoice void with cascade feedback, and migration 040 established the guard trigger pattern with `aa_` prefix ordering.

This phase extends existing patterns: add guard triggers for both PO cancellation and invoice void (block when dependencies exist), implement UI pre-checks with disabled buttons + tooltips (following Phase 35 stock-out pattern), enforce read-only states for cancelled/voided/closed entities, and create per-line-item progress bars + matching tab following the ItemsSummaryProgress pattern from QMHQ.

**Primary recommendation:** Database guards with `aa_` prefix (fire before cascade), UI pre-checks with disabled buttons wrapped in Tooltip component, simple toast feedback (no detailed cascade in toast), history log entries for cascade effects, stepped progress bars matching QMHQ pattern.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Progress bars & matching tab
- Per-line-item progress bars go **inside the existing line items table** as a column (not a separate tab)
- **Stacked segments** style (like GitHub language bars) — ordered baseline, invoiced (blue), received (green)
- Follow the **ItemsSummaryProgress pattern** from QMHQ: stepped bar with fraction text header row (`3/5`) and full legend row with colored dots below each bar
- Match existing app color palette — Claude picks consistent colors for invoiced/received/remaining
- Voided invoices **hidden by default** in matching tab, with toggle to reveal them
- Matching tab layout: **Claude's discretion** — pick best approach for clarity and scannability
- Mismatch highlighting (under-invoiced/under-received): **Claude's discretion** — pick what works for quick scanning

#### Cancellation & void guards
- **Pre-check approach**: Cancel/Void buttons are **disabled** when dependencies exist (no error dialogs needed)
- Disabled button **tooltip shows reason only** (e.g., "Cannot cancel — has active invoices") without specific counts
- PO cancel reason: **free text** textarea (admin types their own reason)
- Invoice void reason: **free text** textarea (user types their own reason)
- No extra warning when voiding the only invoice on a PO — status engine handles the cascade silently

#### Read-only terminal states
- **Cancelled POs** are read-only (no editing allowed)
- **Voided invoices** are read-only (no editing allowed)
- **Closed POs** are read-only (except admin unlock)

#### Cascade & error feedback
- **Simple toast** for user actions (e.g., "Invoice voided successfully", "PO cancelled")
- **No detailed cascade info in toast** — cascade effects recorded as **history/audit log entries** on the affected entities (PO history, QMHQ history)
- Balance in Hand updates silently — no visual flash or badge, just the number changes
- Same pattern for PO cancellation cascade and invoice void cascade
- User-initiated vs system-triggered history log distinction: **Claude's discretion** based on existing audit patterns

### Claude's Discretion
- Matching tab layout design (single table vs side-by-side)
- Mismatch highlighting approach (subtle row highlight vs bold variance column)
- Closed PO lock visual appearance and admin unlock button placement
- Confirmation dialog design for cancel/void flows
- History log labeling (user action vs system trigger)
- Progress bar exact color values (must match app palette)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

---

## Standard Stack

### Core Database
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PostgreSQL Triggers | Built-in | Guard validation at database level | Migration 040 pattern (aa_block_invoice_void_stockin) |
| Foreign Key Constraints | Built-in | Block cascading deletes | Already used throughout schema for referential integrity |
| EXISTS queries | Built-in | Check for active dependencies | Standard pattern in guard functions |

### Core Frontend
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Radix Tooltip | Via shadcn/ui | Disabled button tooltips | Already used in components/ui/tooltip.tsx, Phase 35 pattern |
| Server Actions | Next.js 14+ | Cancel/void with feedback | Existing pattern from lib/actions/po-actions.ts, invoice-actions.ts |
| useToast hook | shadcn/ui | Simple action feedback | Used throughout app for user notifications |
| Dialog component | shadcn/ui | Confirmation dialogs | Existing VoidInvoiceDialog pattern in components/invoice/void-invoice-dialog.tsx |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| TooltipProvider | Radix UI context | Wrap disabled buttons to show reason tooltips |
| cn() utility | Class merging | Conditional styling for disabled states |

**Installation:**
All dependencies already installed. No new packages required.

---

## Architecture Patterns

### Database Layer: Guard Triggers (aa_ Prefix)

**Existing Pattern from Migration 040:**
```sql
-- aa_ prefix ensures guard fires FIRST among BEFORE triggers
-- Blocks operation before any cascade effects occur

CREATE OR REPLACE FUNCTION block_invoice_void_with_stockin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stockin_exists BOOLEAN;
BEGIN
  -- Only check when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN
    -- Check if any active stock-in transactions exist
    SELECT EXISTS (
      SELECT 1 FROM inventory_transactions
      WHERE invoice_id = NEW.id
        AND movement_type = 'inventory_in'
        AND is_active = true
    ) INTO stockin_exists;

    IF stockin_exists THEN
      RAISE EXCEPTION 'Cannot void: inventory has been received against this invoice';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger with aa_ prefix
DROP TRIGGER IF EXISTS aa_block_invoice_void_stockin ON invoices;
CREATE TRIGGER aa_block_invoice_void_stockin
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION block_invoice_void_with_stockin();
```

**Key Characteristics:**
- `aa_` prefix ensures guard triggers fire FIRST (alphabetically before cascade triggers)
- `BEFORE UPDATE` timing blocks operation before state changes
- `EXISTS` query for efficient dependency checks
- Single responsibility: check one dependency type per trigger
- Specific error messages that Server Actions can catch and display

**Confidence:** HIGH — Pattern verified in migration 040_invoice_void_block_stockin.sql

---

### Database Layer: Guard Trigger for PO Cancellation

**New Pattern for This Phase:**
```sql
-- Guard: Block PO cancellation when active invoices exist
CREATE OR REPLACE FUNCTION aa_block_po_cancel_with_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_exists BOOLEAN;
BEGIN
  -- Only check when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Check if any active (non-voided) invoices exist for this PO
    SELECT EXISTS (
      SELECT 1 FROM invoices
      WHERE po_id = NEW.id
        AND is_active = true
        AND (is_voided = false OR is_voided IS NULL)
    ) INTO invoice_exists;

    IF invoice_exists THEN
      RAISE EXCEPTION 'Cannot cancel PO: active invoices exist';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_block_po_cancel_with_invoices ON purchase_orders;
CREATE TRIGGER aa_block_po_cancel_with_invoices
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION aa_block_po_cancel_with_invoices();
```

**Requirements coverage:**
- GARD-01: Database-level enforcement via trigger
- POCN-03: Blocks cancellation when active invoices exist
- INVV-03: Already implemented in migration 040

**Confidence:** HIGH — Direct extension of existing pattern

---

### UI Layer: Disabled Button with Tooltip (Phase 35 Pattern)

**Existing Pattern from Phase 35 Stock-Out Execution:**
```tsx
// Source: .planning/phases/35-per-line-item-execution-ui/35-01-PLAN.md
// Pattern: Execute button disabled with tooltip when stock insufficient

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Button
          disabled={hasInsufficientStock || isExecuting}
          onClick={handleExecute}
        >
          Execute
        </Button>
      </div>
    </TooltipTrigger>
    {hasInsufficientStock && (
      <TooltipContent>
        <p className="text-xs">
          Insufficient stock: Need {needed}, Available: {available}
        </p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

**Key Pattern Rules:**
1. Wrap button in `div` (TooltipTrigger requires child to accept ref)
2. Show tooltip content only when disabled condition is true
3. Tooltip text explains WHY disabled (no numeric details per user constraint)
4. Button remains visible (not hidden) to avoid confusion

**Application to Phase 42:**
```tsx
// PO Cancel Button
const hasActiveInvoices = invoices.some(inv => !inv.is_voided && inv.is_active);
const canCancelPO = !hasActiveInvoices && po.status !== 'cancelled' && po.status !== 'closed';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Button
          disabled={!canCancelPO}
          onClick={() => setShowCancelDialog(true)}
        >
          Cancel PO
        </Button>
      </div>
    </TooltipTrigger>
    {!canCancelPO && (
      <TooltipContent>
        <p className="text-xs">
          {hasActiveInvoices
            ? "Cannot cancel — has active invoices"
            : "Cannot cancel — PO is closed or already cancelled"}
        </p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>

// Invoice Void Button
const hasStockIn = stockReceipts.length > 0;
const canVoidInvoice = !hasStockIn && !invoice.is_voided;

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Button
          disabled={!canVoidInvoice}
          onClick={() => setShowVoidDialog(true)}
        >
          Void Invoice
        </Button>
      </div>
    </TooltipTrigger>
    {!canVoidInvoice && (
      <TooltipContent>
        <p className="text-xs">
          {hasStockIn
            ? "Cannot void — goods received"
            : "Invoice already voided"}
        </p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

**Requirements coverage:**
- GARD-01: UI-level pre-check with disabled state
- POCN-03, INVV-03: Dependencies checked before user interaction

**Confidence:** HIGH — Exact pattern from Phase 35

---

### UI Layer: Read-Only Terminal States

**Pattern: Conditional Rendering Based on Status**
```tsx
// PO Detail Page - Edit button hidden for terminal states
const isTerminalState =
  po.status === 'cancelled' ||
  po.status === 'closed';

const canEdit = can("update", "purchase_orders") && !isTerminalState;

{canEdit && (
  <Link href={`/po/${poId}/edit`}>
    <Button variant="outline">Edit</Button>
  </Link>
)}

// Invoice Detail Page - Edit button hidden for voided invoices
const canEdit = can("update", "invoices") && !invoice.is_voided;

{canEdit && (
  <Link href={`/invoice/${invoiceId}/edit`}>
    <Button variant="outline">Edit</Button>
  </Link>
)}
```

**Visual Indicators:**
- Cancelled POs: strikethrough on PO number (already implemented in Phase 41)
- Voided invoices: strikethrough + "VOIDED" badge (already exists)
- Closed POs: lock icon next to status badge (already in POStatusBadgeWithTooltip)

**Requirements coverage:**
- LOCK-01: Read-only when status = closed
- Terminal state enforcement for cancelled/voided

**Confidence:** HIGH — Simple conditional rendering

---

### UI Layer: Per-Line-Item Progress Bars

**Reference Pattern: ItemsSummaryProgress (components/qmhq/items-summary-progress.tsx)**
```tsx
// QMHQ pattern: Stepped bar with segments (requested, approved, executed)
// For PO: Ordered (gray baseline), Invoiced (blue), Received (green)

interface POLineItemProgressProps {
  ordered: number;
  invoiced: number;
  received: number;
}

function POLineItemProgress({ ordered, invoiced, received }: POLineItemProgressProps) {
  const invoicedPercent = ordered > 0 ? Math.min(100, (invoiced / ordered) * 100) : 0;
  const receivedPercent = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;

  return (
    <div className="space-y-2">
      {/* Header row: fraction text */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {received}/{ordered}
        </span>
      </div>

      {/* Stepped progress bar */}
      <div className="h-6 w-full bg-slate-800/50 rounded-lg overflow-hidden relative">
        {/* Ordered baseline (full width) */}
        <div
          className="absolute inset-y-0 left-0 bg-slate-600/30 transition-all duration-500"
          style={{ width: "100%" }}
        />
        {/* Invoiced segment (blue) */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
          style={{ width: `${invoicedPercent}%` }}
        />
        {/* Received segment (green) */}
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
          style={{ width: `${receivedPercent}%` }}
        />
      </div>

      {/* Legend row with colored dots */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center text-slate-400">
          <span className="w-2 h-2 rounded-full bg-slate-600 inline-block mr-1" />
          Ordered: {ordered}
        </div>
        <div className="flex items-center text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
          Invoiced: {invoiced}
        </div>
        <div className="flex items-center text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />
          Received: {received}
        </div>
      </div>
    </div>
  );
}
```

**Integration into ReadonlyLineItemsTable:**
Add new column "Progress" after "Line Total" column. Render POLineItemProgress component for each row with item.quantity (ordered), item.invoiced_quantity, item.received_quantity.

**Color Palette (from tailwind.config.ts):**
- Ordered (baseline): slate-600 (#64748B)
- Invoiced: blue-500 (#3B82F6)
- Received: emerald-500 (#10B981)

**Requirements coverage:**
- POPR-01: Per-line-item progress bars showing ordered/invoiced/received

**Confidence:** HIGH — Direct adaptation of existing ItemsSummaryProgress pattern

---

### UI Layer: PO Matching Tab

**Purpose:** Compare PO line items vs invoiced quantities vs received quantities in a single view

**Layout Options (Claude's discretion):**

**Option A: Single Table (Recommended)**
```
| Item     | SKU      | Ordered | Invoiced | Received | Variance |
|----------|----------|---------|----------|----------|----------|
| Widget A | WDG-001  | 10      | 10 ✓     | 8 ⚠️     | -2       |
| Widget B | WDG-002  | 5       | 3 ⚠️     | 3 ✓      | -2       |
```

Pros: Compact, easy to scan all metrics at once
Cons: Wide table on narrow screens

**Option B: Side-by-Side Cards**
```
[PO Line Items]    [Invoice Quantities]    [Received Quantities]
Widget A: 10       Widget A: 10 ✓          Widget A: 8 ⚠️
Widget B: 5        Widget B: 3 ⚠️          Widget B: 3 ✓
```

Pros: Clear separation, responsive on mobile
Cons: Harder to compare across columns

**Recommendation:** Option A (single table) with horizontal scroll on mobile. Matches existing line items table pattern.

**Mismatch Highlighting:**
- Under-invoiced (invoiced < ordered): amber text color on invoiced cell
- Under-received (received < ordered): amber text color on received cell
- Fully matched (ordered = invoiced = received): emerald checkmark icon
- Variance column: shows difference, red if negative, hidden if zero

**Voided Invoice Toggle:**
```tsx
const [showVoided, setShowVoided] = useState(false);

<div className="flex items-center gap-2 mb-4">
  <Label htmlFor="show-voided" className="text-sm text-slate-400">
    Show voided invoices
  </Label>
  <input
    type="checkbox"
    id="show-voided"
    checked={showVoided}
    onChange={(e) => setShowVoided(e.target.checked)}
    className="rounded border-slate-700"
  />
</div>
```

Filter invoice line items: `invoices.filter(inv => showVoided || !inv.is_voided)`

**Requirements coverage:**
- POPR-02: Matching tab with side-by-side comparison
- POPR-03: Mismatch highlighting with visual indicators
- INVV-07: Voided invoices hidden by default with toggle

**Confidence:** MEDIUM — Layout choice requires UX judgment, but pattern is clear

---

### Server Action: Cascade Feedback Pattern

**Existing Pattern from lib/actions/invoice-actions.ts (voidInvoice):**
```tsx
export type VoidInvoiceResult =
  | {
      success: true;
      data: {
        invoiceNumber: string;
        poNumber: string | null;
        newPoStatus: string | null;
        invoicedQtyChanges: Array<{
          itemName: string;
          oldQty: number;
          newQty: number;
        }>;
      };
    }
  | { success: false; error: string };

// Server Action workflow:
// 1. Fetch BEFORE state
// 2. Execute UPDATE (trigger guards run here)
// 3. Fetch AFTER state for cascade data
// 4. Revalidate paths
// 5. Return structured result
```

**Key Characteristics:**
- Type-safe return with success/error discrimination
- BEFORE/AFTER snapshot pattern for cascade detection
- Error messages from guard triggers caught and returned
- Cascade data returned to caller for toast display
- revalidatePath for affected pages

**Application to Phase 42:**

PO Cancellation Server Action already exists in lib/actions/po-actions.ts (created in Phase 41). No changes needed — it follows the same pattern.

Invoice Void Server Action already exists in lib/actions/invoice-actions.ts (created in Phase 12). Guard trigger will be added at database level.

**User Constraint Override:** Simple toast only (no cascade details in toast), cascade recorded in history log instead.

**Simplified Toast Pattern:**
```tsx
// User action: simple toast
toast({
  title: "Invoice Voided",
  description: "Invoice INV-2025-00012 has been voided successfully"
});

// Cascade effects: recorded in audit log (existing zz_ triggers)
// User sees cascade in History tab
```

**Confidence:** HIGH — Pattern already implemented and verified

---

### History/Audit Log Pattern

**Existing Infrastructure (components/history/history-tab.tsx):**
- ACTION_CONFIG with 9 action types (create, update, delete, status_change, assignment_change, void, approve, close, cancel)
- Timeline display with icons and color coding
- JSONB old_values/new_values storage
- User attribution with full_name display

**New Audit Entries for Phase 42:**

When PO is cancelled:
```json
{
  "entity_type": "purchase_orders",
  "entity_id": "po-uuid",
  "action": "cancel",
  "changed_by": "user-uuid",
  "summary": "PO cancelled: Budget released to QMHQ-2025-00008"
}
```

When invoice is voided (cascade to PO):
```json
{
  "entity_type": "purchase_orders",
  "entity_id": "po-uuid",
  "action": "status_change",
  "changed_by": "system",
  "summary": "Status recalculated: awaiting_delivery → partially_invoiced (invoice voided)"
}
```

**User-Initiated vs System-Triggered Distinction (Claude's discretion):**

Option A: Use changed_by field
- User actions: changed_by = user UUID
- System cascade: changed_by = NULL or special system UUID

Option B: Use action type
- Direct user actions: "cancel", "void"
- System cascade: "status_change" (already exists)

**Recommendation:** Option B (action type distinction) — clearer semantics, no schema change needed.

**Confidence:** HIGH — Existing audit infrastructure well-established

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dependency validation | Custom check functions for each entity type | Database guard triggers with EXISTS queries | Atomic, race-condition-free, single source of truth |
| Progress bar animations | Custom CSS keyframes | Tailwind transition-all duration-500 | Already in codebase, smooth, performant |
| Disabled button tooltips | Custom hover divs with absolute positioning | Radix Tooltip (via shadcn/ui) | Accessible (ARIA), keyboard navigation, positioning engine |
| Cascade notification | Custom modal with list of affected entities | Simple toast + audit log entries | User constraint: no detailed cascade in toast, use history tab instead |
| Read-only form enforcement | JavaScript disabled attributes on individual inputs | Conditional rendering of edit buttons | Simpler, impossible to bypass, clearer UX |

**Key insight:** Database constraints and triggers provide stronger guarantees than application-level validation. UI layer should pre-check for better UX, but database is the final authority.

---

## Common Pitfalls

### Pitfall 1: Guard Trigger Fires After Cascade Trigger

**What goes wrong:** If guard trigger has normal naming (e.g., `block_po_cancel`), it may fire AFTER cascade triggers that modify dependent records, causing inconsistent state.

**Why it happens:** PostgreSQL executes triggers alphabetically within the same timing (BEFORE UPDATE). Without `aa_` prefix, guard may fire after `invoice_void_recalculate`.

**How to avoid:** Use `aa_` prefix for ALL guard triggers. Verify trigger ordering with:
```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid = 'purchase_orders'::regclass
ORDER BY tgname;
```

**Warning signs:** Intermittent "dependency exists" errors, inconsistent blocking behavior, cascade effects occurring despite guard

**Confidence:** HIGH — Pattern verified in migration 040, Phase 41 research

---

### Pitfall 2: Tooltip Doesn't Show on Disabled Button

**What goes wrong:** Tooltip component doesn't trigger on disabled elements because they don't fire pointer events.

**Why it happens:** Browser default: `pointer-events: none` on disabled buttons.

**How to avoid:** Wrap button in a `div` and use `asChild` prop on TooltipTrigger:
```tsx
<TooltipTrigger asChild>
  <div>
    <Button disabled={condition}>Action</Button>
  </div>
</TooltipTrigger>
```

**Warning signs:** Tooltip works on enabled button but disappears when disabled

**Confidence:** HIGH — Documented in Phase 35 research and verified in codebase

---

### Pitfall 3: Forgetting to Check for Voided Invoices in Guard

**What goes wrong:** Guard blocks PO cancellation even when only voided invoices exist.

**Why it happens:** Query checks `invoices.is_active = true` but forgets to exclude `is_voided = true`.

**How to avoid:** Always filter voided invoices in guards:
```sql
SELECT EXISTS (
  SELECT 1 FROM invoices
  WHERE po_id = NEW.id
    AND is_active = true
    AND (is_voided = false OR is_voided IS NULL)  -- CRITICAL
) INTO invoice_exists;
```

**Warning signs:** User reports "Cannot cancel PO" but all visible invoices are voided

**Confidence:** HIGH — Per v1.9 design: voided invoices do NOT block PO cancellation

---

### Pitfall 4: Race Condition in Server Action BEFORE/AFTER Snapshot

**What goes wrong:** Between fetching BEFORE state and executing UPDATE, another transaction modifies the same PO, causing stale cascade data.

**Why it happens:** No advisory lock acquired in Server Action (only in database function).

**How to avoid:** Database-level advisory lock in calculate_po_status() protects status calculation. Server Action cascade detection is best-effort for toast display only. Critical: cascade effects are recorded in audit log (source of truth), not toast.

**Warning signs:** Toast shows "PO status changed to X" but database shows status Y

**Confidence:** MEDIUM — Advisory lock exists in calculate_po_status() but Server Action snapshot is inherently racy. Mitigation: audit log is authoritative, toast is informational only.

---

### Pitfall 5: Closed PO Admin Unlock Not Implemented

**What goes wrong:** Admin cannot unlock closed PO for corrections (LOCK-02 requirement).

**Why it happens:** Read-only enforcement applied to admin role too.

**How to avoid:** Add unlock button visible only to admin:
```tsx
const isAdmin = user?.role === 'admin';
const isClosed = po.status === 'closed';

{isAdmin && isClosed && (
  <Button onClick={handleUnlock}>
    Unlock PO
  </Button>
)}

// handleUnlock: Server Action that sets status = 'partially_received' or previous state
```

**Warning signs:** Admin reports unable to correct closed PO errors

**Confidence:** MEDIUM — LOCK-02 requirement, implementation pattern TBD in planning

---

## Code Examples

Verified patterns from official sources:

### Guard Trigger (Database Level)
```sql
-- Source: supabase/migrations/040_invoice_void_block_stockin.sql
-- Pattern: aa_ prefix, BEFORE UPDATE, EXISTS check, specific error

CREATE OR REPLACE FUNCTION aa_block_po_cancel_with_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  invoice_exists BOOLEAN;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    SELECT EXISTS (
      SELECT 1 FROM invoices
      WHERE po_id = NEW.id
        AND is_active = true
        AND (is_voided = false OR is_voided IS NULL)
    ) INTO invoice_exists;

    IF invoice_exists THEN
      RAISE EXCEPTION 'Cannot cancel PO: active invoices exist';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_block_po_cancel_with_invoices ON purchase_orders;
CREATE TRIGGER aa_block_po_cancel_with_invoices
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION aa_block_po_cancel_with_invoices();
```

### Disabled Button with Tooltip (UI Level)
```tsx
// Source: .planning/phases/35-per-line-item-execution-ui/35-01-PLAN.md
// Pattern: TooltipProvider > Tooltip > TooltipTrigger(asChild) > div > Button

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const hasActiveInvoices = invoices.some(inv => !inv.is_voided && inv.is_active);
const canCancel = !hasActiveInvoices && po.status !== 'cancelled' && po.status !== 'closed';

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Button
          disabled={!canCancel}
          onClick={() => setShowCancelDialog(true)}
          variant="outline"
          className="border-red-500/30 text-red-400"
        >
          <XCircle className="mr-2 h-4 w-4" />
          Cancel PO
        </Button>
      </div>
    </TooltipTrigger>
    {!canCancel && (
      <TooltipContent>
        <p className="text-xs">
          {hasActiveInvoices
            ? "Cannot cancel — has active invoices"
            : "Cannot cancel — PO is closed or already cancelled"}
        </p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

### Per-Line-Item Progress Bar
```tsx
// Source: components/qmhq/items-summary-progress.tsx (adapted for PO)
// Pattern: Stepped segments (ordered, invoiced, received)

interface POLineItemProgressProps {
  ordered: number;
  invoiced: number;
  received: number;
}

export function POLineItemProgress({ ordered, invoiced, received }: POLineItemProgressProps) {
  const invoicedPercent = ordered > 0 ? Math.min(100, (invoiced / ordered) * 100) : 0;
  const receivedPercent = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;

  return (
    <div className="space-y-2">
      {/* Header: fraction */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {received}/{ordered}
        </span>
      </div>

      {/* Stepped bar */}
      <div className="h-6 w-full bg-slate-800/50 rounded-lg overflow-hidden relative">
        {/* Baseline: ordered (gray) */}
        <div
          className="absolute inset-y-0 left-0 bg-slate-600/30 transition-all duration-500"
          style={{ width: "100%" }}
        />
        {/* Invoiced (blue) */}
        <div
          className="absolute inset-y-0 left-0 bg-blue-500/40 transition-all duration-500"
          style={{ width: `${invoicedPercent}%` }}
        />
        {/* Received (green) */}
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
          style={{ width: `${receivedPercent}%` }}
        />
      </div>

      {/* Legend with colored dots */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center text-slate-400">
          <span className="w-2 h-2 rounded-full bg-slate-600 inline-block mr-1" />
          Ordered: {ordered}
        </div>
        <div className="flex items-center text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
          Invoiced: {invoiced}
        </div>
        <div className="flex items-center text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />
          Received: {received}
        </div>
      </div>
    </div>
  );
}
```

### Read-Only State Enforcement
```tsx
// Source: Existing pattern from app/(dashboard)/po/[id]/page.tsx
// Pattern: Conditional rendering based on terminal state check

const isTerminalState =
  po.status === 'cancelled' ||
  po.status === 'closed';

const canEdit = can("update", "purchase_orders") && !isTerminalState;

{canEdit && (
  <Link href={`/po/${poId}/edit`}>
    <Button variant="outline">
      <Edit className="h-4 w-4 md:mr-2" />
      <span className="hidden md:inline">Edit</span>
    </Button>
  </Link>
)}
```

### Confirmation Dialog with Free-Text Reason
```tsx
// Source: components/invoice/void-invoice-dialog.tsx (adapted for PO cancel)
// Pattern: Dialog with textarea, disabled submit until reason provided

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

<Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
  <DialogContent className="bg-slate-900 border-slate-700">
    <DialogHeader>
      <DialogTitle className="text-slate-100">Cancel Purchase Order</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-4">
      <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
        <p className="text-sm text-red-400">
          This action is permanent and cannot be undone. The committed budget will be released back to QMHQ Balance in Hand.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cancel-reason" className="text-slate-300">
          Cancellation Reason <span className="text-red-400">*</span>
        </Label>
        <Textarea
          id="cancel-reason"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Why is this PO being cancelled?"
          className="min-h-[100px] bg-slate-800 border-slate-700 resize-none"
        />
      </div>
    </div>

    <DialogFooter className="gap-2">
      <Button
        variant="outline"
        onClick={() => setShowCancelDialog(false)}
      >
        Go Back
      </Button>
      <Button
        onClick={handleCancelPO}
        disabled={!cancelReason.trim() || isCancelling}
        className="bg-red-600 hover:bg-red-700"
      >
        Confirm Cancellation
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Error dialogs after action fails | Disabled buttons with tooltip before action | Phase 35 (2026-02-11) | Better UX: user knows WHY before clicking |
| Detailed cascade in toast notifications | Simple toast + audit log cascade | Phase 42 (user constraint) | Cleaner UI, history tab is source of truth |
| Custom disabled state styling | Radix Tooltip with asChild pattern | Phase 35 (2026-02-11) | Accessible, works with disabled elements |
| Manual trigger ordering via naming | aa_ prefix convention for guards | Migration 040 (2026-01) | Explicit, self-documenting, reliable |

**Deprecated/outdated:**
- Error dialogs for guard violations — replaced by pre-check disabled state
- Numeric counts in tooltips (e.g., "Cannot cancel: 3 invoices exist") — user constraint: reason only, no counts

---

## Open Questions

1. **Admin Unlock Mechanism for Closed PO**
   - What we know: LOCK-02 requires admin unlock capability
   - What's unclear: Should unlock restore previous status or default to partially_received? Should unlock require a reason?
   - Recommendation: Create unlockClosedPO Server Action that sets status to previous non-closed state (stored in audit log). No reason required since closed is system state, not user error.

2. **Matching Tab Mismatch Highlighting Intensity**
   - What we know: User wants mismatch highlighting, Claude picks approach
   - What's unclear: Subtle (amber text) vs bold (amber background + icon)?
   - Recommendation: Start with amber text + warning icon. If user feedback says "too subtle," upgrade to background highlight.

3. **History Log System-Triggered Entry Labeling**
   - What we know: Cascade effects logged separately from user actions
   - What's unclear: Show "System" as actor name or use different UI treatment?
   - Recommendation: Use action type distinction (status_change for system, cancel/void for user). Existing history-tab.tsx already supports this via ACTION_CONFIG.

---

## Sources

### Primary (HIGH confidence)
- supabase/migrations/040_invoice_void_block_stockin.sql — Guard trigger pattern with aa_ prefix
- supabase/migrations/20260212200000_po_status_engine_enhancement.sql — PO cancellation fields (cancelled_at, cancelled_by, cancellation_reason)
- lib/actions/po-actions.ts — cancelPO Server Action with cascade feedback
- lib/actions/invoice-actions.ts — voidInvoice Server Action with cascade feedback
- components/qmhq/items-summary-progress.tsx — Stepped progress bar pattern (QMHQ items)
- components/ui/tooltip.tsx — Radix Tooltip component
- components/invoice/void-invoice-dialog.tsx — Confirmation dialog with free-text reason
- components/history/history-tab.tsx — Audit log display with ACTION_CONFIG
- lib/utils/po-status.ts — PO status utilities (canEditPO, canCancelPO, canCreateInvoice)
- .planning/phases/35-per-line-item-execution-ui/35-01-PLAN.md — Disabled button with tooltip pattern
- .planning/phases/41-po-status-engine-enhancement/41-RESEARCH.md — PO status engine foundations
- .planning/phases/42-cancellation-guards-lock-mechanism/42-CONTEXT.md — User decisions and constraints

### Secondary (MEDIUM confidence)
- tailwind.config.ts — Color palette for progress bars (slate-600, blue-500, emerald-500)
- types/database.ts — Type definitions for voided_at, cancelled_at fields

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Guard trigger pattern: HIGH — Verified in migration 040, exact pattern applies
- Disabled button tooltip pattern: HIGH — Verified in Phase 35, exact pattern applies
- Progress bar pattern: HIGH — Verified in ItemsSummaryProgress, direct adaptation
- Read-only state enforcement: HIGH — Simple conditional rendering
- Matching tab layout: MEDIUM — UX judgment required, pattern clear but choice open
- Admin unlock mechanism: MEDIUM — LOCK-02 requirement clear, implementation details TBD

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (30 days — stable patterns)
