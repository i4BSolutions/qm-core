# Phase 57: Two-Layer Approval UI + Execution Page - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins can approve stock-out quantities in Layer 1 (qty-only) and assign a warehouse in Layer 2; execution is blocked until both layers are complete. A dedicated execution page at `/inventory/stock-out` replaces the old sidebar link. Execution also available from inside SOR detail page.

</domain>

<decisions>
## Implementation Decisions

### Approval Dialog Flow
- **Separate dialogs** for L1 and L2 — not a single multi-step dialog
- L1: Inline "Approve Qty" button on line item row opens a dialog for quantity confirmation (partial qty allowed — admin can approve less than requested)
- L2: After L1 approval, the button **replaces** L1 button → becomes "Assign Warehouse" button
- L2 "Assign Warehouse" button stays visible until all L1-approved qty is fully warehouse-assigned
- Each L2 approval is single-warehouse — to split across warehouses, admin does multiple L2 approvals on the same line item
- Second+ L2 approval dialog pre-fills with remaining unassigned qty
- **Rejection only at Layer 1** — once qty is approved, L2 only assigns warehouse (no rejection at L2)
- **Replace existing approval dialog entirely** — all approvals now go through L1/L2 flow (no separate non-admin dialog)
- **Same person (admin only)** can perform both L1 and L2
- L2 assignment is **final** — no undo/edit after assignment (before execution)
- When fully warehouse-assigned, button changes to "Ready to Execute" **status badge only** — no execute button on SOR detail line items tab

### Status Progression
- **Single badge with layer text** — one badge that changes: "Pending" → "Qty Approved" → "Warehouse Assigned" → "Ready to Execute"
- **Match existing status colors** — use the same color system (amber=pending, blue=in-progress, purple=awaiting, green=ready)
- **3-segment progress bar** on line items: L1 approved | L2 warehouse-assigned | Executed — shows full lifecycle
- Progress bar colors: Claude's discretion (based on existing color system)
- **Detailed tooltip on hover** for progress bar — shows exact numbers per layer (e.g., "L1: 60/100, L2: 40/60, Executed: 20/40")
- **No SOR header progress summary** — progress shown per line item only, SOR header just shows overall SOR status badge
- Warehouse assignments visible via **expandable section** under each line item on the Line Items tab

### Warehouse Assignments Tab (New)
- **New tab** on SOR detail page alongside existing tabs (Details, Line Items, History)
- **Grouped by line item** — Item X: WH-A (40), WH-B (20); Item Y: WH-A (10)
- **Shows execution status** per assignment — "Executed" or "Pending Execution"

### SOR Auto-Status
- SOR status **auto-updates** based on aggregate line item state
- Add new status: **"Awaiting Warehouse"**
- Status logic:
  - ANY line item pending → SOR = "Pending"
  - ALL L1 approved, ANY unassigned → SOR = "Awaiting Warehouse"
  - ALL fully warehouse-assigned → SOR = "Ready to Execute"
  - ALL executed → SOR = "Executed"
  - ALL L1 rejected → SOR = "Rejected"
- **Mixed state (some approved, some rejected):** SOR status follows the furthest approved items — rejected items are skipped

### Execution Page Layout
- Located at **`/inventory/stock-out`** (replaces current page, sidebar link updated)
- **List view only** (no card view), filterable by warehouse
- Each row = **one warehouse assignment** (SOR ID, Item, Warehouse, Qty, Requester, Status)
- Shows **all assignments** with status filter (Pending Execution / Executed / All) — defaults to Pending
- SOR ID is **display-only** — not a link
- Execute via **confirmation dialog** per row (single execution, no bulk)
- After execution, **row updates in-place** (status changes to "Executed", execute button disappears)
- **No "New Request" button** — this page is for execution only
- **Execution also available from SOR detail page** (Warehouse Assignments tab) — with before/after stock display

### Stock Validation UX
- L2 dialog: **Real-time validation** as warehouse is selected — immediately shows available stock, qty field max auto-capped
- Available stock shown as **text below warehouse dropdown**: "Available: 45 units"
- If qty exceeds stock: **inline field error** — red text below qty field, submit button disabled
- Qty input uses **hard cap** — can't type beyond available stock (input max attribute)
- Hard cap = min(remaining unassigned L1 qty, available warehouse stock)
- Error message **shows both limits**: remaining approved qty AND warehouse stock
- **Standard unit conversion shown in both L1 and L2 dialogs** (e.g., "40 boxes = 480 pieces")
- Execution **re-validates warehouse stock** at execution time — blocks with error if insufficient
- If execution fails due to insufficient stock, **assignment stays** — admin retries later after stock is replenished
- Execution from stock-out page: **simple confirmation** (no stock display)
- Execution from SOR detail page: **confirmation with before/after stock levels** ("WH-A current: 45 → After: 5")

### Claude's Discretion
- Progress bar segment colors
- Exact spacing and typography of approval dialogs
- Error state handling details
- Loading states during stock validation API calls

</decisions>

<specifics>
## Specific Ideas

- L2 warehouse assignment model: one warehouse per approval, multiple approvals to split — similar to how PO line items work
- Execution page should feel like a simple task queue — see pending items, execute them one by one
- SOR detail page gets richer with the new Warehouse Assignments tab showing the full assignment + execution lifecycle per line item

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 57-two-layer-approval-ui-execution-page*
*Context gathered: 2026-02-17*
