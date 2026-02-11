---
phase: 33
plan: 01
subsystem: qmhq
tags:
  - stock-out
  - transactions
  - ui
  - references
  - traceability
dependency_graph:
  requires:
    - "32-02: SOR-grouped transaction display with progress tracking"
  provides:
    - "Dual reference display (SOR approval + QMHQ) on stock-out transactions"
    - "Linked transactions table component for QMHQ detail page"
  affects:
    - "components/qmhq/sor-transaction-group.tsx"
    - "app/(dashboard)/qmhq/[id]/page.tsx"
    - "Phase 34 will build on this reference system for transaction updates"
tech_stack:
  added:
    - "QmhqLinkedTransactions component (client-side table with independent data fetch)"
  patterns:
    - "Dual reference display (primary + secondary with conditional suppression)"
    - "Independent data fetching in nested components (useEffect with qmhqId dependency)"
    - "Circular navigation prevention (currentQmhqId prop pattern)"
key_files:
  created:
    - path: "components/qmhq/qmhq-linked-transactions.tsx"
      purpose: "Displays all stock-out transactions linked to a QMHQ in dedicated table format"
      exports: "QmhqLinkedTransactions"
  modified:
    - path: "components/qmhq/sor-transaction-group.tsx"
      changes: "Added approval_number badge, QMHQ secondary reference, currentQmhqId prop"
    - path: "app/(dashboard)/qmhq/[id]/page.tsx"
      changes: "Enhanced query with qmhq FK join, added approval_number, integrated QmhqLinkedTransactions"
decisions:
  - context: "QMHQ link suppression on own detail page"
    choice: "Pass currentQmhqId prop to conditionally hide 'via QMHQ-XXX' link"
    rationale: "Prevents circular navigation when user is already on that QMHQ's page"
  - context: "Linked transactions table placement"
    choice: "Separate section below SOR-grouped display in Stock Out tab"
    rationale: "SOR-grouped display shows workflow progress; linked table provides scannable reference list. Both serve distinct purposes."
  - context: "Data fetching strategy for linked transactions"
    choice: "Independent fetch in QmhqLinkedTransactions component with useEffect"
    rationale: "Keeps component reusable and avoids coupling to parent state. Uses standard React pattern with dependency array."
metrics:
  duration: "6min"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
  completed_at: "2026-02-11T07:41:17Z"
---

# Phase 33 Plan 01: Dual Reference Display Summary

**One-liner:** Stock-out transactions now display both SOR approval number (primary badge) and parent QMHQ ID (secondary link) with clickable navigation to respective detail pages, plus dedicated linked transactions table on QMHQ detail.

## Tasks Completed

### Task 1: Enhance SOR transaction group with dual reference display

**Commit:** `16d6731`

Enhanced the `SORTransactionGroup` component to display dual references on each transaction row:

1. **Primary reference (approval number):**
   - Displayed as amber badge with `font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/10`
   - Links to SOR detail page at `/inventory/stock-out-requests/${sorId}`
   - Positioned before item name in transaction row
   - Gracefully handles NULL approval_number (legacy transactions)

2. **Secondary reference (QMHQ):**
   - Displayed as `"via QMHQ-YYYY-NNNNN"` text with external link icon
   - Styled with `text-xs text-slate-400 font-mono text-blue-400`
   - Positioned after warehouse line in transaction row
   - Only rendered when `transaction.qmhq` exists AND `transaction.qmhq.id !== currentQmhqId`
   - Prevents circular navigation on QMHQ's own detail page

3. **QMHQ detail page query enhancements:**
   - Added `qmhq:qmhq!inventory_transactions_qmhq_id_fkey(id, request_id)` join
   - Added `approval_number` to stock_out_approvals select
   - Extended `StockOutTransaction` interface with `approval_number` and `qmhq_ref` fields
   - Updated `sorGroupedTransactions` useMemo to map approval_number and qmhq data
   - Passed `currentQmhqId={qmhqId}` prop to SORTransactionGroup invocation

**Files modified:**
- `components/qmhq/sor-transaction-group.tsx` — Added dual reference display logic
- `app/(dashboard)/qmhq/[id]/page.tsx` — Enhanced query and data mapping

### Task 2: Create QMHQ linked transactions table and integrate into detail page

**Commit:** `eff9a54`

Created a dedicated `QmhqLinkedTransactions` component to display all stock-out transactions linked to a specific QMHQ:

1. **Component features:**
   - Client component with independent data fetching using `useEffect([qmhqId])`
   - Query fetches inventory_transactions filtered by `qmhq_id`, `movement_type='inventory_out'`, `is_active=true`
   - Joins `stock_out_approvals` to get approval_number and nested request data
   - Displays loading state: "Loading transactions..." in command-panel
   - Displays empty state: Package icon with "No stock-out transactions linked to this QMHQ yet"

2. **Table structure:**
   - **Reference column:** Approval number (clickable link to SOR) + "via QMHQ-XXXX" (display text, not link)
   - **Item column:** Item name + SKU in font-mono text-slate-400
   - **Quantity column:** Right-aligned font-mono
   - **Status column:** Badge (default variant for "completed", secondary otherwise)
   - **Date column:** Formatted with `toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })`
   - Hover effect: `hover:bg-slate-800/30` on rows
   - Responsive: Wrapped in `overflow-x-auto` for horizontal scroll

3. **Integration into QMHQ detail page:**
   - Imported `QmhqLinkedTransactions` from `@/components/qmhq/qmhq-linked-transactions`
   - Rendered in Stock Out tab after SOR-grouped transactions section
   - Placed in `<div className="mt-6">` outside the command-panel containing SOR groups
   - Passed `qmhqId` and `qmhqRequestId` props

**Files created:**
- `components/qmhq/qmhq-linked-transactions.tsx` — New component (218 lines)

**Files modified:**
- `app/(dashboard)/qmhq/[id]/page.tsx` — Added import and integration

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All verification criteria passed:

1. ✅ `npm run type-check` passed with no errors
2. ✅ `npm run build` succeeded (production build)
3. ✅ SOR transaction group component accepts and renders approval_number badge
4. ✅ SOR transaction group component shows "via QMHQ-XXXX" with Link when qmhq data present and not on that QMHQ's page
5. ✅ QMHQ detail page query includes qmhq FK join for request_id
6. ✅ QmhqLinkedTransactions component renders table with Reference, Item, Qty, Status, Date columns
7. ✅ Linked transactions table is integrated into QMHQ Stock Out tab

**Build impact:**
- `/qmhq/[id]` route size increased from 15.3 kB to 15.9 kB (+0.6 kB) — expected due to new component

## Success Criteria

All success criteria met:

- ✅ Stock-out transactions show SOR approval number as primary reference badge with link to SOR detail
- ✅ Transactions linked to QMHQ show "via QMHQ-YYYY-NNNNN" as clickable secondary reference
- ✅ Circular navigation prevented (QMHQ link suppressed when on that QMHQ's page)
- ✅ QMHQ item detail has dedicated linked transactions table below the SOR-grouped display
- ✅ All builds pass (type-check + production build)

## Technical Implementation

### Dual Reference Pattern

The dual reference display follows a layered hierarchy:

```
┌─────────────────────────────────────────────────────────┐
│ Transaction Row                                         │
│                                                         │
│  [APR-2026-00001] Item Name (SKU-123)                  │
│  Warehouse Name                                         │
│  via QMHQ-2026-00042 →                                 │
└─────────────────────────────────────────────────────────┘
```

- **Primary reference (approval_number):** Links to SOR detail (source of truth for approval)
- **Secondary reference (qmhq):** Links to parent QMHQ (context provider)
- **Suppression logic:** `transaction.qmhq.id !== currentQmhqId` prevents self-link

### Component Architecture

```
QMHQDetailPage
│
├─ Stock Out Tab
│  ├─ ItemsSummaryProgress (stepped progress bar)
│  ├─ SORTransactionGroup (grouped display with dual refs)
│  └─ QmhqLinkedTransactions (flat table view)
│
└─ Other Tabs...
```

**Data flow:**
- `QMHQDetailPage` fetches stock-out transactions with joins for approval_number and qmhq
- `SORTransactionGroup` receives mapped transactions with dual reference data
- `QmhqLinkedTransactions` independently fetches same transactions for table view

**Rationale for dual fetch:**
- SOR-grouped display: Workflow-centric (shows progress through approval pipeline)
- Linked transactions table: Reference-centric (scannable list optimized for lookup)
- Independent fetches keep components decoupled and reusable

### Query Enhancements

**Stock-out transactions query:**
```typescript
.select(`
  *,
  item:items(id, name, sku),
  warehouse:warehouses!inventory_transactions_warehouse_id_fkey(id, name),
  qmhq:qmhq!inventory_transactions_qmhq_id_fkey(id, request_id),  // NEW
  stock_out_approval:stock_out_approvals(
    id,
    approval_number,  // NEW
    approved_quantity,
    line_item:stock_out_line_items(...)
  )
`)
```

**Key changes:**
1. Added `qmhq` join with explicit FK hint (`inventory_transactions_qmhq_id_fkey`)
2. Added `approval_number` to stock_out_approvals select
3. Extended TypeScript interfaces to include new fields

## Impact on Codebase

**New patterns introduced:**
1. **Circular navigation prevention:** Pass entity ID to component to suppress self-links
2. **Independent nested data fetching:** Components can fetch their own data when context allows
3. **Dual reference display:** Primary (badge) + secondary (text link) with conditional rendering

**Dependencies created:**
- Phase 34 (transaction updates) will rely on these reference displays for navigation
- Phase 35 may enhance linked transactions table with real-time updates

**No breaking changes:** All changes are additive enhancements to existing components.

## Self-Check

Verifying all claims in this summary:

```bash
# Check created files exist
[ -f "components/qmhq/qmhq-linked-transactions.tsx" ] && echo "✅ FOUND: qmhq-linked-transactions.tsx" || echo "❌ MISSING"

# Check modified files exist
[ -f "components/qmhq/sor-transaction-group.tsx" ] && echo "✅ FOUND: sor-transaction-group.tsx" || echo "❌ MISSING"
[ -f "app/(dashboard)/qmhq/[id]/page.tsx" ] && echo "✅ FOUND: qmhq detail page" || echo "❌ MISSING"

# Check commits exist
git log --oneline --all | grep -q "16d6731" && echo "✅ FOUND: Task 1 commit (16d6731)" || echo "❌ MISSING"
git log --oneline --all | grep -q "eff9a54" && echo "✅ FOUND: Task 2 commit (eff9a54)" || echo "❌ MISSING"
```

## Self-Check: PASSED

All files and commits verified present.
