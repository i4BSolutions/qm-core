# Phase 12: Invoice Void Cascade - Research

**Researched:** 2026-01-31
**Domain:** PostgreSQL database trigger cascade patterns, Next.js error handling, React toast notifications
**Confidence:** HIGH

## Summary

This phase implements the UI and feedback layer for invoice voiding — the database cascade infrastructure already exists in migrations 022, 040, and 041. When an invoice is voided, three database triggers execute in order (aa_ blocks if stock-in exists, invoice_void_recalculate updates PO line items, zz_audit_invoice_void_cascade logs changes). The UI challenge is providing immediate feedback that reflects these cascaded changes without page refresh, handling errors gracefully, and presenting audit trail entries in both Invoice and PO history tabs.

The standard stack combines Next.js server actions with optimistic UI patterns (immediate badge updates), detailed toast notifications (showing concrete numbers), and role-based permission checks. The existing void-invoice-dialog.tsx provides the confirmation flow — this phase extends it with cascade feedback.

**Primary recommendation:** Use server actions with revalidatePath for immediate updates, detailed success toasts with calculated values, and expand existing audit display to show void cascade entries with before/after states.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js Server Actions | 14+ | Mutation handling | Built-in, type-safe, integrates with App Router |
| Radix UI Toast | Latest | Toast notifications | Already in project (components/ui/toast.tsx) |
| Supabase Realtime | Latest | Post-update queries | Already integrated, ensures fresh data |
| PostgreSQL Triggers | 15+ | Database cascade | Native, ACID guarantees, trigger ordering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| revalidatePath | Next.js 14+ | Cache invalidation | After successful void to refresh invoice/PO pages |
| useToast hook | Custom | Toast management | Already in project (components/ui/use-toast.tsx) |
| SECURITY DEFINER | PostgreSQL | Trigger permissions | Already used in migration 039/041 for audit logging |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| revalidatePath | router.refresh() | revalidatePath is more targeted, refresh() reloads entire route |
| Server Actions | API routes | Server actions are more ergonomic, less boilerplate |
| Toast notifications | Alert dialogs | Toasts are non-blocking, better UX for success feedback |

**Installation:**
```bash
# All dependencies already installed
# Radix UI Toast: @radix-ui/react-toast
# Next.js 14+ includes server actions and revalidatePath
```

## Architecture Patterns

### Recommended Flow Structure
```
UI Layer (Client Component)
├── VoidInvoiceDialog (exists)
│   └── Confirmation form with reason input
│
Server Action Layer (app/actions or inline)
├── voidInvoice(invoiceId, reason, userId)
│   ├── Update invoice SET is_voided=true, voided_by, void_reason
│   ├── Database triggers execute cascade
│   ├── Query cascade results (new PO status, balance change)
│   ├── revalidatePath for invoice and PO pages
│   └── Return success with cascade data
│
Database Trigger Layer (already exists)
├── aa_block_invoice_void_stockin (migration 040)
│   └── Prevents void if stock-in exists
├── invoice_void_recalculate (migration 022)
│   └── Recalculates PO line item invoiced_quantity
├── trigger_update_po_status (migration 016)
│   └── Recalculates PO status
└── zz_audit_invoice_void_cascade (migration 041)
    └── Logs all cascade effects to audit_logs
```

### Pattern 1: Server Action with Cascade Feedback
**What:** Execute void mutation, query cascade results, return detailed feedback data
**When to use:** For mutations that trigger database cascades requiring user feedback
**Example:**
```typescript
// app/actions/invoice-actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function voidInvoice(invoiceId: string, reason: string, userId: string) {
  const supabase = createClient()

  // Update invoice (triggers cascade)
  const { error: voidError } = await supabase
    .from('invoices')
    .update({
      is_voided: true,
      voided_at: new Date().toISOString(),
      voided_by: userId,
      void_reason: reason,
    })
    .eq('id', invoiceId)

  if (voidError) {
    return { success: false, error: voidError.message }
  }

  // Query cascade results
  const { data: invoice } = await supabase
    .from('invoices')
    .select(`
      invoice_number,
      purchase_order:po_id(
        po_number,
        status,
        qmhq:qmhq_id(balance_in_hand)
      )
    `)
    .eq('id', invoiceId)
    .single()

  // Revalidate affected pages
  revalidatePath('/invoice')
  revalidatePath(`/invoice/${invoiceId}`)
  if (invoice?.purchase_order?.po_id) {
    revalidatePath(`/po/${invoice.purchase_order.po_id}`)
  }

  return {
    success: true,
    data: {
      poNumber: invoice?.purchase_order?.po_number,
      newPoStatus: invoice?.purchase_order?.status,
      balanceInHand: invoice?.purchase_order?.qmhq?.balance_in_hand,
    }
  }
}
```

### Pattern 2: Detailed Toast with Cascade Data
**What:** Show concrete numbers and outcomes in success toast
**When to use:** After successful void to inform user of cascade effects
**Example:**
```typescript
// In client component after server action succeeds
const result = await voidInvoice(invoiceId, reason, user.id)

if (result.success) {
  toast({
    variant: "success",
    title: "Invoice Voided",
    description: (
      <div className="space-y-1">
        <p>Invoice {invoiceNumber} has been voided.</p>
        <p className="text-sm">
          • PO {result.data.poNumber} status: {result.data.newPoStatus}
        </p>
        {result.data.balanceInHand && (
          <p className="text-sm">
            • Balance in Hand: {formatCurrency(result.data.balanceInHand)} EUSD
          </p>
        )}
      </div>
    ),
  })
}
```

### Pattern 3: Voided Invoice Display
**What:** Grey text, strikethrough, "Voided" badge for voided invoices in lists
**When to use:** Invoice list, PO detail invoices tab
**Example:**
```typescript
// In invoice list component
<div className={cn(
  "flex items-center gap-3",
  invoice.is_voided && "opacity-60"
)}>
  <span className={cn(
    "font-mono",
    invoice.is_voided && "line-through"
  )}>
    {invoice.invoice_number}
  </span>
  {invoice.is_voided && (
    <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
      Voided
    </span>
  )}
</div>
```

### Pattern 4: Grouped Audit Entry for Cascade
**What:** Single expandable audit entry showing all cascade effects
**When to use:** History tab in Invoice and PO detail pages
**Example:**
```typescript
// Audit entry component
<div className="border-l-2 border-red-500 pl-4 py-3 bg-red-900/10">
  <div className="flex items-start gap-3">
    <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5" />
    <div className="flex-1">
      <p className="font-medium text-red-400">Invoice Voided</p>
      <p className="text-sm text-slate-400 mt-1">
        {entry.changes_summary}
      </p>
      {entry.expanded && (
        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <p>Before: {entry.old_value}</p>
          <p>After: {entry.new_value}</p>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-2">
        {entry.changed_by_name} • {formatDate(entry.changed_at)}
      </p>
    </div>
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Client-side cascade calculation:** Don't calculate PO status or balance changes in UI — query database after triggers execute
- **Multiple toast calls:** Don't show separate toasts for each cascade effect — combine into one detailed message
- **Page refresh after void:** Don't use router.refresh() — use revalidatePath for targeted updates
- **Ignoring trigger ordering:** Don't assume audit trigger captures old values — it fires AFTER cascade (use zz_ prefix)
- **Manual audit logging:** Don't manually insert audit entries from UI — triggers handle this

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit logging for void cascade | Manual INSERT in server action | Existing zz_audit_invoice_void_cascade trigger | Already captures before/after values, trigger ordering guaranteed |
| PO status recalculation | Client-side calculation | calculate_po_status() function (migration 016) | Complex logic with edge cases, already tested |
| Transaction rollback on error | Try/catch with manual rollback | PostgreSQL transaction + trigger ordering | ACID guarantees, atomic cascade |
| Toast notification system | Custom notification queue | Radix UI Toast + useToast hook | Already integrated, accessible, customizable |
| Cache invalidation | Manual state updates | revalidatePath() | Next.js knows dependencies, ensures consistency |

**Key insight:** The database cascade infrastructure is complete. Don't rebuild validation, calculation, or audit logic in the UI layer — query the results and present them.

## Common Pitfalls

### Pitfall 1: Querying Cascade Results Too Early
**What goes wrong:** Server action queries PO status immediately after UPDATE, before triggers finish executing, returns stale data
**Why it happens:** Triggers fire asynchronously in some databases (but PostgreSQL fires synchronously)
**How to avoid:** PostgreSQL triggers fire synchronously within the same transaction — query immediately after UPDATE succeeds
**Warning signs:** Toast shows old PO status, refreshing page shows correct status

### Pitfall 2: Missing revalidatePath for Related Pages
**What goes wrong:** Invoice detail page updates, but PO detail page shows old invoiced quantities until user refreshes
**Why it happens:** Next.js caches each route independently, void affects multiple pages
**How to avoid:** Call revalidatePath for invoice list, invoice detail, PO detail, and PO list
**Warning signs:** User navigates to PO, sees outdated "awaiting_delivery" status

### Pitfall 3: Not Handling Stock-In Block Error
**What goes wrong:** User voids invoice with stock-in transactions, gets cryptic database error, invoice remains in limbo
**Why it happens:** aa_block_invoice_void_stockin trigger raises error if stock-in exists
**How to avoid:** Check for stock-in before void OR catch error and show user-friendly message: "Cannot void invoice with stock-in transactions"
**Warning signs:** Error message: "Invoice has active stock-in transactions"

### Pitfall 4: Audit Entry Attribution Missing
**What goes wrong:** Audit logs show "System" instead of user who voided invoice
**Why it happens:** Forgot to set voided_by in UPDATE, trigger uses updated_by as fallback
**How to avoid:** Always set voided_by explicitly in UPDATE statement
**Warning signs:** Audit trail shows "System" or wrong user

### Pitfall 5: Balance in Hand Confusion
**What goes wrong:** User expects Balance in Hand to increase when invoice voided, but it doesn't change
**Why it happens:** By design (STATE.md decision), Balance in Hand = total_money_in - total_po_committed, and voiding invoice doesn't change PO commitment
**How to avoid:** Don't show Balance in Hand change in toast — it's unchanged by design. Show PO status and invoiced quantity changes only.
**Warning signs:** Toast says "Balance in Hand +1,500 EUSD" but value doesn't change

### Pitfall 6: Optimistic UI Without Server Confirmation
**What goes wrong:** UI immediately shows "Voided" badge, server action fails, badge stuck in voided state
**Why it happens:** Applied optimistic update without rollback mechanism
**How to avoid:** Only update UI after server action succeeds (this phase uses standard server action pattern, not optimistic)
**Warning signs:** Badge shows voided, but clicking invoice detail shows not voided

## Code Examples

Verified patterns from official sources:

### Server Action Error Handling Pattern
```typescript
// Source: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
'use server'

export async function voidInvoice(invoiceId: string, reason: string) {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('invoices')
      .update({ is_voided: true, void_reason: reason })
      .eq('id', invoiceId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/invoice')
    return { success: true }

  } catch (error) {
    // Unexpected errors (network, database down)
    return {
      success: false,
      error: 'Unable to void invoice. Please try again or contact admin.'
    }
  }
}
```

### Toast Notification Pattern
```typescript
// Source: Radix UI Toast documentation + project pattern
import { useToast } from '@/components/ui/use-toast'

const { toast } = useToast()

// Success variant (already supported in components/ui/toast.tsx)
toast({
  variant: "success",
  title: "Invoice Voided",
  description: "PO status updated to not_started",
})

// Error variant
toast({
  variant: "destructive",
  title: "Void Failed",
  description: error.message,
})
```

### Querying After Cascade
```typescript
// Query pattern to fetch cascade results
const { data: cascadeData } = await supabase
  .from('invoices')
  .select(`
    id,
    invoice_number,
    purchase_order:po_id (
      id,
      po_number,
      status,
      po_line_items (
        invoiced_quantity
      ),
      qmhq:qmhq_id (
        balance_in_hand
      )
    )
  `)
  .eq('id', invoiceId)
  .single()

// Use cascadeData to build detailed toast message
```

### Audit Entry Display with Expand
```typescript
// Grouped audit entry for void cascade
const [expanded, setExpanded] = useState(false)

return (
  <div
    className="cursor-pointer hover:bg-slate-800/50 transition"
    onClick={() => setExpanded(!expanded)}
  >
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 text-red-400" />
      <p className="font-medium">Invoice Voided</p>
    </div>

    <p className="text-sm text-slate-400 mt-1">
      {entry.changes_summary}
    </p>

    {expanded && (
      <div className="mt-2 pl-6 space-y-1 text-sm text-slate-500">
        <p>Invoiced Quantity: {entry.old_value} → {entry.new_value}</p>
        <p>Reason: {entry.void_reason}</p>
      </div>
    )}
  </div>
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side cascade calculation | Database triggers with query after | PostgreSQL standard | More reliable, ACID guarantees |
| router.refresh() for updates | revalidatePath() targeted invalidation | Next.js 13+ App Router | Faster, preserves scroll position |
| useOptimistic for mutations | Standard server actions + revalidation | Next.js 14 stable | Simpler mental model, fewer edge cases |
| Manual audit log inserts | Trigger-based audit with zz_ prefix ordering | Project Phase 8 | Consistent ordering, no missed entries |
| Generic error messages | Return errors as data with context | Next.js 14 server actions pattern | Better UX, actionable errors |

**Deprecated/outdated:**
- **Optimistic UI for void operations:** This phase uses standard server action pattern (not optimistic) because void is infrequent, high-stakes, and cascade results need to be accurate
- **pages/api routes for mutations:** Server actions are preferred in App Router
- **Manual trigger ordering:** Use alphabetical prefixes (aa_, zz_) instead of CREATE TRIGGER ... AFTER trigger_name

## Open Questions

Things that couldn't be fully resolved:

1. **Should we check for stock-in before void or let trigger error?**
   - What we know: aa_block_invoice_void_stockin trigger already prevents void if stock-in exists (migration 040)
   - What's unclear: Should UI check first and show friendly error, or let database error bubble up?
   - Recommendation: Let trigger error, catch it in server action, show user-friendly message. Simpler code, trigger is source of truth.

2. **Should Balance in Hand be shown in toast if it doesn't change?**
   - What we know: By design (STATE.md), Balance in Hand unchanged on void (PO commitment preserved)
   - What's unclear: Users might expect it to increase when invoice voided
   - Recommendation: Don't show Balance in Hand in toast. Show PO status and invoiced quantity changes only. Add explanatory text in UI: "PO commitment preserved."

3. **How long should success toast stay visible?**
   - What we know: TOAST_REMOVE_DELAY = 1000000 (very long, essentially manual dismiss)
   - What's unclear: Should void success toast auto-dismiss or require manual dismiss?
   - Recommendation: Manual dismiss for void (high-stakes action, user needs time to read cascade details)

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Audit Trigger Wiki](https://wiki.postgresql.org/wiki/Audit_trigger) - Trigger patterns, JSONB audit approach
- [Next.js Server Actions Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) - Error handling, revalidation patterns
- [Next.js revalidatePath Documentation](https://nextjs.org/docs/app/api-reference/functions/revalidatePath) - Cache invalidation API
- Project codebase migrations 022, 040, 041 - Existing void cascade implementation
- Project codebase components/ui/toast.tsx - Toast UI implementation
- Project codebase components/ui/use-toast.tsx - Toast hook implementation

### Secondary (MEDIUM confidence)
- [PostgreSQL Audit Logging Best Practices | Severalnines](https://severalnines.com/blog/postgresql-audit-logging-best-practices/) - Trigger timing, security considerations
- [Next.js Server Actions Error Handling Guide](https://medium.com/@pawantripathi648/next-js-server-actions-error-handling-the-pattern-i-wish-i-knew-earlier-e717f28f2f75) - Return errors as data pattern
- [React useOptimistic Hook Guide](https://react.dev/reference/react/useOptimistic) - Optimistic UI patterns (decided against for this phase)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified in codebase
- Architecture: HIGH - Database triggers already implemented and tested
- Pitfalls: HIGH - Based on PostgreSQL trigger behavior and Next.js 14 patterns
- Code examples: HIGH - Derived from official docs and project conventions

**Research date:** 2026-01-31
**Valid until:** 2026-03-02 (30 days - stable stack, unlikely to change)
