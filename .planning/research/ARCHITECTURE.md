# Architecture Research

**Domain:** v1.12 — List View Standardization, Two-Layer Stock-Out Approval, User Avatars, Pagination, Audit History User Display
**Researched:** 2026-02-17
**Confidence:** HIGH (all findings from direct codebase inspection)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ SOR List     │  │ SOR Detail   │  │ History    │  │ Admin    │  │
│  │ (Card+List)  │  │ (4 tabs)     │  │ Tab        │  │ Users    │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘  │
│         │                 │                │               │        │
├─────────┴─────────────────┴────────────────┴───────────────┴────────┤
│                      COMPOSITE UI LAYER                              │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  ┌────────────┐  │
│  │ PageHeader  │  │FilterBar │  │ CardViewGrid  │  │ Pagination │  │
│  │ (existing)  │  │(existing)│  │ (existing)    │  │(existing)  │  │
│  └─────────────┘  └──────────┘  └───────────────┘  └────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ NEW: ListViewTable (shared, typed, sortable, onClick row nav)   │ │
│  │ NEW: UserAvatar (initials + color, extends existing user type)  │ │
│  │ NEW: AvatarHistoryEntry (wraps HistoryTab entry display)        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      STATE & DATA LAYER                              │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Supabase PostgREST — existing patterns:                         │ │
│  │  • .from("stock_out_requests").select(...).eq("is_active",true) │ │
│  │  • .from("stock_out_approvals").insert({...}).select("id")      │ │
│  │  • .from("audit_logs").select("*").eq("entity_type","...") ...  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                      DATABASE TRIGGER LAYER                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ EXISTING (do not modify):                                    │   │
│  │  • compute_sor_request_status() — rolls up line item status  │   │
│  │  • update_line_item_status_on_approval() — pending→approved  │   │
│  │  • validate_sor_approval() — qty constraints                  │   │
│  │  • trg_update_li_status_on_approval (on stock_out_approvals) │   │
│  │  • validate_sor_fulfillment() — over-execution block         │   │
│  │  • update_sor_line_item_execution_status() — auto executed   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ NEW (v1.12 schema changes):                                  │   │
│  │  • stock_out_approvals.layer TEXT — 'quartermaster'|'admin'  │   │
│  │  • stock_out_approvals.parent_approval_id UUID FK (nullable) │   │
│  │  • validate_two_layer_approval() — layer ordering rules      │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                      DATABASE STORAGE LAYER                          │
│  ┌─────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ stock_out_requests      │  │ stock_out_approvals               │  │
│  │ stock_out_line_items    │  │ + layer TEXT (NEW)                │  │
│  │ (unchanged schema)      │  │ + parent_approval_id UUID (NEW)   │  │
│  └─────────────────────────┘  └──────────────────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ users                   │  │ audit_logs                       │  │
│  │ avatar_url TEXT (exists)│  │ changed_by UUID                  │  │
│  │ full_name TEXT (exists) │  │ changed_by_name TEXT (cached)    │  │
│  └─────────────────────────┘  └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `stock-out-requests/page.tsx` | List page with card+list view toggle, status tabs, search | MODIFY: add list view standardization + pagination |
| `stock-out-requests/[id]/page.tsx` | Detail page with approval/execution flow | MODIFY: support two-layer approval UI |
| `approval-dialog.tsx` | Layer-1 (Quartermaster) approval: qty + warehouse + conversion rate | MODIFY: label as Layer 1, gate by role |
| `rejection-dialog.tsx` | Reject line items (any approver layer) | EXISTING: reuse unchanged |
| `execution-dialog.tsx` | Execute approved stock-out transactions | EXISTING: reuse unchanged |
| `line-item-table.tsx` | Line item rows with status, selection | MODIFY: reflect two-layer approval state |
| `history-tab.tsx` | Audit timeline with changed_by_name | MODIFY: render UserAvatar alongside changed_by_name |
| `Pagination` (`components/ui/pagination.tsx`) | Page navigation + page size select | EXISTING: already built, needs wiring into SOR list |
| `CardViewGrid` (`components/composite/card-view-grid.tsx`) | Kanban column layout | EXISTING: already used for card view on QMRL/PO |
| `ListViewTable` | Standardized list view table — sortable columns, row click nav | NEW |
| `UserAvatar` | Initials + deterministic color avatar from full_name | NEW |

## Recommended Project Structure

```
supabase/migrations/
├── 063_two_layer_approval.sql         # NEW: layer column + parent_approval_id + validate fn
└── (052-062 exist: SOR tables, locks, constraints)

components/
├── ui/
│   └── user-avatar.tsx                # NEW: initials avatar (no storage, generated)
├── composite/
│   ├── list-view-table.tsx            # NEW: shared list view component
│   └── (page-header, filter-bar, card-view-grid, pagination already exist)
├── stock-out-requests/
│   ├── request-card.tsx               # EXISTING: card view
│   ├── line-item-table.tsx            # MODIFY: two-layer approval state column
│   ├── approval-dialog.tsx            # MODIFY: layer-1 (quartermaster) mode
│   ├── approval-layer2-dialog.tsx     # NEW: layer-2 (admin) final approval
│   ├── rejection-dialog.tsx           # EXISTING: unchanged
│   ├── execution-confirmation-dialog.tsx  # EXISTING: unchanged
│   └── execution-dialog.tsx           # EXISTING: unchanged
└── history/
    └── history-tab.tsx                # MODIFY: add UserAvatar to entry display

app/(dashboard)/
└── inventory/
    └── stock-out-requests/
        ├── page.tsx                   # MODIFY: pagination + ListViewTable
        └── [id]/page.tsx              # MODIFY: two-layer approval flow
```

### Structure Rationale

- **`components/ui/user-avatar.tsx`:** Placed in `/ui` (not `/composite`) because it is a primitive display component, not a layout composition. Consistent with `badge.tsx`, `button.tsx` pattern.
- **`components/composite/list-view-table.tsx`:** Placed in `/composite` not `/tables` because it composes `FilterBar.Search` style + `Table` + `Pagination` into one reusable unit. `/tables/data-table.tsx` (tanstack) serves admin pages; list-view-table serves list pages with server-state pagination.
- **`approval-layer2-dialog.tsx`:** Separate file from `approval-dialog.tsx` to avoid conditional complexity. Layer 1 (quartermaster: sets qty + warehouse) and Layer 2 (admin: final sign-off) have different form fields.
- **Migration `063_two_layer_approval.sql`:** Extends `stock_out_approvals` with two non-breaking nullable columns. Existing approval records treated as single-layer (backward compatible).

## Feature Integration Analysis

### Feature 1: Two-Layer Approval

**Current state:** Single approval layer. Admin inserts into `stock_out_approvals` with `decision: 'approved'|'rejected'`. The `update_line_item_status_on_approval()` trigger fires immediately on insert and promotes line item from `pending` to `approved`.

**Required schema change:** Add two columns to `stock_out_approvals`:
```sql
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'admin'
    CHECK (layer IN ('quartermaster', 'admin')),
  ADD COLUMN IF NOT EXISTS parent_approval_id UUID
    REFERENCES stock_out_approvals(id) ON DELETE SET NULL;
```
- `layer = 'quartermaster'` — Layer 1: sets approved_quantity + warehouse assignment. Status = `pending_admin`.
- `layer = 'admin'` — Layer 2: final approval referencing Layer 1 via `parent_approval_id`. Triggers line item status → `approved`.

**State machine after v1.12:**
```
Line Item: pending
  → Quartermaster submits Layer 1 approval → line_item stays 'pending' (or new status 'awaiting_admin')
  → Admin submits Layer 2 approval (parent_approval_id = Layer1.id) → line_item → 'approved'
  → Execution → line_item → 'partially_executed' | 'executed'
```

**Trigger impact:** `update_line_item_status_on_approval()` must check `layer = 'admin'` before promoting. Layer 1 insert should NOT promote line item. Add new trigger function `validate_two_layer_approval()` that enforces: Layer 2 must reference a Layer 1 approval for same line_item_id.

**Optional: new line_item_status enum value.** Adding `'awaiting_admin'` would make state visible in UI without querying approvals table separately. The decision: either add enum value (migration cost, clear status) or derive state from approvals table (no schema change, query cost). Recommendation: add `'awaiting_admin'` to `sor_line_item_status` enum — consistent with existing pattern of computed status names.

**RLS impact:** Layer 1 insert requires `role = 'qmrl'` (quartermaster maps to qmrl in 3-role model) OR `role = 'admin'`. Layer 2 insert requires `role = 'admin'`. Existing `sor_approval_insert` policy only allows admin — extend it:
```sql
DROP POLICY sor_approval_insert ON stock_out_approvals;
CREATE POLICY sor_approval_insert ON stock_out_approvals
  FOR INSERT WITH CHECK (
    -- Layer 1: qmrl or admin
    (NEW.layer = 'quartermaster' AND public.get_user_role() IN ('admin', 'qmrl'))
    -- Layer 2: admin only
    OR (NEW.layer = 'admin' AND public.get_user_role() = 'admin')
  );
```

**UI components needed:**
- `ApprovalDialog` (existing): repurpose as Layer-1 dialog. Gate display by `user.role === 'qmrl' || user.role === 'admin'`.
- `ApprovalLayer2Dialog` (new): Admin-only. Shows Layer-1 approval details (warehouse already selected, qty already set). Admin sees what was proposed and confirms or rejects.
- `LineItemTable` (modify): Show two-layer status column: "Pending | Awaiting Admin | Approved | Rejected".

### Feature 2: Stock-Out Execution Page

**Current state:** Execution is done inline within `stock-out-requests/[id]/page.tsx` — the "Approvals" tab shows an Execute button per approval, which updates `inventory_transactions` status from `pending` to `completed`.

**v1.12 scope (from milestone context):** "New stock-out execution page — routing, data queries." This implies a dedicated route, not inline in the detail page.

**Recommended routing:**
```
/inventory/stock-out-requests/[id]/execute
```
This is a dedicated page that:
1. Fetches all `stock_out_approvals` for the SOR where `layer = 'admin'` (Layer 2, approved) and linked `inventory_transactions` are `pending`.
2. Renders a checklist of pending transactions: item, warehouse, quantity, conversion rate.
3. Admin executes each or bulk-executes.
4. Uses the advisory lock mechanism already in `validate_stock_out_quantity()` for concurrent safety.

**Data query for execution page:**
```typescript
const { data } = await supabase
  .from("stock_out_approvals")
  .select(`
    id, approval_number, approved_quantity, layer, parent_approval_id,
    line_item:stock_out_line_items(id, item_id, item_name, item_sku, conversion_rate),
    pending_tx:inventory_transactions!stock_out_approval_id(
      id, warehouse_id, quantity, status,
      warehouse:warehouses(id, name)
    )
  `)
  .eq("line_item.request_id", requestId)
  .eq("layer", "admin")
  .eq("decision", "approved")
  .eq("pending_tx.status", "pending");
```

**Routing integration:** `stock-out-requests/[id]/page.tsx` replaces the inline Execute button in the Approvals tab with a "Go to Execution" link button. The execution page has its own Back button back to the detail page.

**No new components required** beyond what exists (`execution-dialog.tsx` logic can be extracted or reused). The page itself is the new artifact.

### Feature 3: Avatar Storage

**Current state:** `users` table has `avatar_url TEXT` column (migration 002). The column exists but is not populated — users are created by `handle_new_user()` trigger with no avatar logic. The admin users page does not display avatars. The history tab shows `changed_by_name` as plain text.

**Recommendation: Generate avatars on-the-fly, never store to database.** Rationale:
- Zero storage cost (no Supabase Storage bucket needed)
- No sync issues (avatar always reflects current `full_name`)
- Works offline (no network request for avatar image)
- Consistent with internal-tool UX (GitHub-style initials avatars)
- `avatar_url` column can remain for future real photo upload without schema changes

**Implementation — `UserAvatar` component:**
```typescript
// components/ui/user-avatar.tsx
"use client";

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
  "bg-indigo-500", "bg-teal-500",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface UserAvatarProps {
  fullName: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({ fullName, avatarUrl, size = "md", className }: UserAvatarProps) {
  const sizeClasses = { sm: "h-6 w-6 text-xs", md: "h-8 w-8 text-sm", lg: "h-10 w-10 text-base" };
  const color = getAvatarColor(fullName);

  if (avatarUrl) {
    return <img src={avatarUrl} alt={fullName} className={cn(sizeClasses[size], "rounded-full object-cover", className)} />;
  }

  return (
    <div className={cn(sizeClasses[size], color, "rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0", className)}>
      {getInitials(fullName)}
    </div>
  );
}
```

**Integration points for UserAvatar:**
- `history-tab.tsx` (existing HistoryEntry): Replace `<span className="font-medium text-slate-300">{log.changed_by_name}</span>` with `<UserAvatar fullName={log.changed_by_name || 'System'} size="sm" />` + name text alongside.
- Admin users page: Row avatar column.
- SOR detail page: Requester display in kpiPanel.
- Approval cards in Approvals tab: `decided_by_user.full_name`.

**No database migration required.** The `avatar_url` column exists; `UserAvatar` falls back to initials when null.

### Feature 4: List View Standardization

**Current state:** Three divergent list view implementations exist:

| Page | List View Pattern | Issues |
|------|------------------|--------|
| `po/page.tsx` | Inline `<table>` with tailwind classes, uses `Pagination` component | No reusable component |
| `stock-out-requests/page.tsx` | Inline `<table>` with `window.location.href` for row nav | Missing router, no pagination |
| `qmrl/page.tsx` | (check needed) | Likely similar inline pattern |

**Recommendation: Extract `ListViewTable` component to `components/composite/list-view-table.tsx`.**

This component unifies:
- Column definition API (array of `{ key, header, render, sortable?, width? }`)
- Row click navigation via `useRouter().push()` (not `window.location.href`)
- Consistent column header style (`text-xs font-medium text-slate-400 uppercase tracking-wider`)
- Hover row state (`hover:bg-slate-800/30 cursor-pointer transition-colors`)
- Empty state (centered message)
- Loading skeleton (optional)
- Composition with the existing `Pagination` component below the table

**API design:**
```typescript
// components/composite/list-view-table.tsx
interface ListViewTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface ListViewTableProps<T> {
  columns: ListViewTableColumn<T>[];
  data: T[];
  onRowClick: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  keyExtractor: (item: T) => string;
  // Pagination (optional — omit for non-paginated use)
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}
```

**Migration approach:** Pages continue to work during migration. Replace list view `<table>` blocks in `stock-out-requests/page.tsx` first (it's the least complete), then backfill PO and QMRL list pages if they're included in scope.

**Do NOT replace `DataTable` (`tanstack/react-table`)** — that serves admin pages with complex column visibility, server-side sorting, and column filtering. `ListViewTable` is for simpler list views with client-side data.

### Feature 5: Pagination Standardization

**Current state:** `Pagination` component at `components/ui/pagination.tsx` exists and is fully implemented. It is used in `po/page.tsx`. It is NOT used in `stock-out-requests/page.tsx` (that page has no pagination at all).

**Implementation pattern (from `po/page.tsx`):**
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(20);

// Reset page on filter change
useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

// Client-side slice for current page
const paginatedItems = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filteredItems.slice(start, start + pageSize);
}, [filteredItems, currentPage, pageSize]);

const totalPages = Math.ceil(filteredItems.length / pageSize);
```

**Wire `Pagination` into `stock-out-requests/page.tsx`:** No new component needed. Simply add the pagination state and slice logic. The `Pagination` component accepts `currentPage`, `totalPages`, `totalItems`, `pageSize`, `onPageChange`, `onPageSizeChange`. It renders cleanly below the table.

**Card view + pagination interaction:** For card view, paginate the `filteredRequests` array before grouping into status buckets. This matches how `po/page.tsx` does it — `paginatedPOs` feeds `groupedPOs`. The Pagination component appears once below whichever view is active.

**Shared `usePagination` hook (optional):** If two or more pages need the exact same state boilerplate, extract to `lib/hooks/use-pagination.ts`:
```typescript
export function usePagination(defaultPageSize = 20) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const resetPage = useCallback(() => setCurrentPage(1), []);
  return { currentPage, pageSize, setCurrentPage, setPageSize, resetPage };
}
```
This reduces boilerplate but is optional if only SOR list page is being standardized this milestone.

### Feature 6: Audit History User Display

**Current state:** `history-tab.tsx` `HistoryEntry` component renders:
```tsx
<span className="font-medium text-slate-300">
  {log.changed_by_name || "System"}
</span>
```
This is plain text only. The `audit_logs` table has `changed_by UUID` and `changed_by_name TEXT` (cached at write time).

**No database changes needed.** `changed_by_name` is already cached on the audit log row. `UserAvatar` needs only `fullName` to render.

**Modified `HistoryEntry` component:**
```tsx
// Before
<span className="font-medium text-slate-300">
  {log.changed_by_name || "System"}
</span>

// After
<div className="flex items-center gap-1.5">
  <UserAvatar fullName={log.changed_by_name || "System"} size="sm" />
  <span className="font-medium text-slate-300">
    {log.changed_by_name || "System"}
  </span>
</div>
```

**`changed_by` UUID** is available on the log row if richer lookup is needed, but fetching additional user data per log entry would add N+1 queries. The cached `changed_by_name` is sufficient for avatar generation (name-based initials and deterministic color).

## Data Flow

### Two-Layer Approval Request Flow

```
[Admin/Quartermaster clicks "Approve" on pending line items]
    ↓
[Layer-1 ApprovalDialog opens]
  → User selects: approved_quantity, warehouse_id, conversion_rate
  → INSERT into stock_out_approvals { layer: 'quartermaster', decision: 'approved', ... }
    ↓
[Trigger: validate_two_layer_approval() — layer 1 may be inserted by qmrl or admin]
[Trigger: update_line_item_status_on_approval() — checks layer = 'quartermaster'
  → does NOT promote line item; status remains 'pending' (or → 'awaiting_admin')]
    ↓
[Admin sees line item in 'awaiting_admin' state]
    ↓
[Admin opens Layer-2 ApprovalLayer2Dialog]
  → Shows Layer-1 details (qty, warehouse already set, read-only)
  → Admin confirms (or rejects)
  → INSERT into stock_out_approvals { layer: 'admin', decision: 'approved',
      parent_approval_id: <layer1.id>, approved_quantity: <same as L1>, ... }
    ↓
[Trigger: update_line_item_status_on_approval() — layer = 'admin' → promotes to 'approved']
[Trigger: compute_sor_request_status() — recalculates parent request status]
[Trigger: audit_stock_out_approvals — logs both approval events]
    ↓
[Line item status = 'approved']
[Admin navigates to /inventory/stock-out-requests/[id]/execute]
    ↓
[Execution page fetches pending inventory_transactions linked to layer='admin' approvals]
[Admin executes → UPDATE inventory_transactions SET status = 'completed']
[Trigger: update_sor_line_item_execution_status() → 'partially_executed' | 'executed']
[Advisory lock in validate_stock_out_quantity() prevents race conditions]
```

### List View Navigation Flow

```
[User on /inventory/stock-out-requests]
  → Data fetched once, filtered client-side
  → Pagination slices filteredRequests[]
  → Card view: sliced data → groupBy(status) → CardViewGrid
  → List view: sliced data → ListViewTable (new)
    → row click → useRouter().push(`/inventory/stock-out-requests/${item.id}`)
  → Pagination component: currentPage, pageSize controls
    → page change → setCurrentPage() → useMemo re-slices
    → filter change → useEffect resets to page 1
```

### Avatar Render Flow

```
[HistoryEntry renders log entry]
  → log.changed_by_name = "Aung Ko" (cached string from audit_logs row)
  → <UserAvatar fullName="Aung Ko" size="sm" />
    → getInitials("Aung Ko") → "AK"
    → getAvatarColor("Aung Ko") → deterministic hash → "bg-emerald-500"
    → renders: <div class="h-6 w-6 bg-emerald-500 rounded-full ...">AK</div>
  → No network request, no database lookup, no storage
```

## Integration Points

### New Components

| Component | Location | Type | Integrates With |
|-----------|----------|------|-----------------|
| `UserAvatar` | `components/ui/user-avatar.tsx` | NEW | HistoryTab, SOR detail, Admin users page |
| `ListViewTable` | `components/composite/list-view-table.tsx` | NEW | SOR list page, optionally PO/QMRL list pages |
| `ApprovalLayer2Dialog` | `components/stock-out-requests/approval-layer2-dialog.tsx` | NEW | SOR detail page Approvals tab |
| `/inventory/stock-out-requests/[id]/execute/page.tsx` | App route | NEW | Replaces inline Execute button in detail page |

### Modified Components

| Component | Change | Why |
|-----------|--------|-----|
| `stock-out-requests/page.tsx` | Wire `Pagination`, replace inline `<table>` with `ListViewTable` | Standardization + pagination |
| `stock-out-requests/[id]/page.tsx` | Two-layer approval: show Layer-1 → awaiting admin state, Layer-2 approve button for admin, link to execute page | New approval flow |
| `approval-dialog.tsx` | Add `layer` prop, label as "Layer 1 — Quartermaster Approval", gate by role check | Layer identification |
| `line-item-table.tsx` | Add approval layer status column: show "Awaiting Admin Approval" when Layer-1 exists but no Layer-2 | Two-layer state visibility |
| `history-tab.tsx` (HistoryEntry) | Wrap `changed_by_name` display with `<UserAvatar>` | Avatar feature |
| `lib/hooks/use-permissions.ts` | Ensure `qmrl` role has `create` on `stock_out_requests` for Layer-1 approvals | RBAC alignment |

### Database Integration

| Migration | Purpose | Tables Modified |
|-----------|---------|-----------------|
| `063_two_layer_approval.sql` | Add `layer` + `parent_approval_id` to `stock_out_approvals`; add `'awaiting_admin'` to `sor_line_item_status` enum; update `update_line_item_status_on_approval()` trigger; update `sor_approval_insert` RLS policy | `stock_out_approvals`, `sor_line_item_status` enum, `stock_out_line_items` (enum depends on it) |

**Existing migrations that must NOT be modified:**
- `052_stock_out_requests.sql` — core SOR tables
- `053_stock_out_validation.sql` — fulfillment linkage + over-execution block
- `054_stock_out_rls_audit.sql` — existing RLS policies (extend, don't replace)
- `058_advisory_lock_stock_validation.sql` — advisory lock pattern (reuse)
- `060_require_approval_id_for_request.sql` — constraint (no impact from v1.12)
- `062_idempotency_constraint_execution.sql` — idempotency (no impact)

### Build Order (Dependency-Aware)

The correct build order respects what each feature depends on:

1. **Database migration `063_two_layer_approval.sql`** — Must be first. All UI changes for two-layer approval depend on the schema.
2. **`UserAvatar` component** — No dependencies. Can be built in parallel with migration.
3. **`ListViewTable` component** — No dependencies. Can be built in parallel with migration.
4. **`usePagination` hook (optional)** — No dependencies.
5. **Modify `history-tab.tsx`** — Requires `UserAvatar`.
6. **`ApprovalLayer2Dialog`** — Requires migration 063 (layer column must exist).
7. **Modify `approval-dialog.tsx`** — Requires migration 063 (layer column).
8. **Modify `line-item-table.tsx`** — Requires migration 063 (awaiting_admin status).
9. **Modify `stock-out-requests/page.tsx`** — Requires `ListViewTable`, `Pagination` (exists).
10. **Modify `stock-out-requests/[id]/page.tsx`** — Requires `ApprovalLayer2Dialog`, `ApprovalDialog` (modified), `LineItemTable` (modified).
11. **New execute page** — Requires migration 063 + modified detail page (remove inline execute button).
12. **Update RLS policy in migration or via `use-permissions.ts`** — Requires migration 063 in place.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ Database | Supabase PostgREST via `createClient()` | Continue existing pattern; no Server Actions needed for SOR mutations (client-side with optimistic update is established pattern) |
| Layer-1 ↔ Layer-2 approval | `parent_approval_id` FK in `stock_out_approvals` | Layer-2 dialog reads Layer-1 record to display proposed qty/warehouse |
| `UserAvatar` ↔ Data | `fullName` string only | No database lookup; name cached in audit_logs.changed_by_name |
| `ListViewTable` ↔ Data | Passes `data[]` and `onRowClick` — parent owns fetch | Presentation only; no data fetching inside component |
| Execution page ↔ Advisory lock | Existing `validate_stock_out_quantity()` trigger | Lock fires automatically on `inventory_transactions` UPDATE; no app-layer changes needed |
| BroadcastChannel | `qm-stock-out-execution` channel | Already in detail page; execute page should also broadcast and listen |

## Architectural Patterns

### Pattern 1: Extend Enums with Additive Migrations

**What:** PostgreSQL enums cannot be altered with `RENAME VALUE` or `DROP VALUE` in most cases, but `ADD VALUE IF NOT EXISTS` is safe and non-breaking. Adding `'awaiting_admin'` to `sor_line_item_status` follows this pattern.

**When to use:** When new state is a strict addition with no ambiguity about existing data. Old records have no `awaiting_admin` entries — existing data remains valid.

**Trade-offs:**
- Pro: No data migration required, backward compatible, atomic
- Con: Enums cannot have values removed later; use TEXT with CHECK constraint if flexibility matters

**Example:**
```sql
ALTER TYPE sor_line_item_status ADD VALUE IF NOT EXISTS 'awaiting_admin' AFTER 'pending';
```

### Pattern 2: Nullable FK for Hierarchical Approvals

**What:** `parent_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL` creates a self-referential link without a hard dependency. Layer-1 rows have `parent_approval_id = NULL`. Layer-2 rows point to Layer-1.

**When to use:** When approval chains are optional and records at the same level must remain valid independently.

**Trade-offs:**
- Pro: Backward compatible (existing rows have NULL), simple to query
- Con: Cannot enforce "Layer-2 must always have Layer-1" at pure DB constraint level without CHECK (must use trigger)

**Example:**
```sql
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS layer TEXT DEFAULT 'admin'
    CHECK (layer IN ('quartermaster', 'admin')),
  ADD COLUMN IF NOT EXISTS parent_approval_id UUID
    REFERENCES stock_out_approvals(id) ON DELETE SET NULL;

-- Enforce: admin-layer approvals must reference a quartermaster-layer approval for same line_item
CREATE OR REPLACE FUNCTION validate_two_layer_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.layer = 'admin' AND NEW.parent_approval_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM stock_out_approvals
      WHERE id = NEW.parent_approval_id
        AND line_item_id = NEW.line_item_id
        AND layer = 'quartermaster'
        AND decision = 'approved'
    ) THEN
      RAISE EXCEPTION 'Admin approval must reference an approved quartermaster approval for the same line item';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Pattern 3: Generated Avatars from Name String

**What:** Compute initials and color from `fullName` using a deterministic hash function. No storage, no network, always available.

**When to use:** Internal tools where user count is small and real photos are impractical. Avoids Supabase Storage bucket setup, RLS policies for avatar objects, and sync issues.

**Trade-offs:**
- Pro: Zero infrastructure cost, instant render, consistent across sessions
- Con: Colors assigned automatically (not user-chosen), no photos, initials collision possible (two "AK" users)

**Example:**
```typescript
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
```

### Pattern 4: Client-Side Pagination over Server-Side

**What:** Fetch all records once, filter and slice client-side. The `Pagination` component and state live in the page component. This matches the existing pattern in `po/page.tsx`.

**When to use:** When total record count is bounded (SOR list is bounded by business activity, not unbounded like logs). Fetching all with `.limit(200)` and slicing is acceptable up to ~500 records.

**Trade-offs:**
- Pro: Simple implementation, no extra API calls on page change, filtering is instant
- Con: Initial load fetches all data (acceptable for bounded sets), not suitable for audit logs or high-volume tables

**Do NOT use:** For audit_logs, inventory_transactions — those use `.limit(50)` server-side (already implemented in HistoryTab). For SOR list, client-side pagination is appropriate.

## Anti-Patterns

### Anti-Pattern 1: Storing Avatar URLs When Name-Based Generation Suffices

**What people do:** Upload user photos to Supabase Storage, store URL in `users.avatar_url`, build upload UI, handle RLS for storage objects.
**Why it's wrong for this project:** Internal tool with ~10-50 users. Adds bucket management, RLS policies, upload flow, and broken image handling. Returns minimal UX value.
**Do this instead:** Generate initials + color from `full_name`. Fall back to `avatar_url` if it exists (forward compatibility). The `avatar_url` column already exists and supports future real photos without migration.

### Anti-Pattern 2: Modifying Existing Trigger Functions Instead of Extending

**What people do:** Edit `update_line_item_status_on_approval()` in migration 053 by replacing the function body.
**Why it's wrong:** Migration 053 is already applied to production. Editing the CREATE OR REPLACE function must happen in a new migration that replaces it, not by editing the old migration file. Editing old migration files creates divergence between dev reset and production state.
**Do this instead:** Create migration `063_two_layer_approval.sql` with `CREATE OR REPLACE FUNCTION update_line_item_status_on_approval()` that includes the layer check. New migration, same function name — safe pattern already used throughout the codebase (e.g., migrations 028, 029 fix earlier trigger bugs).

### Anti-Pattern 3: `window.location.href` for Row Navigation

**What people do:** `onClick={() => window.location.href = '/inventory/...'` (currently in stock-out-requests/page.tsx list view).
**Why it's wrong:** Full page reload, loses scroll position, bypasses Next.js router cache, slower than client-side navigation, causes flicker.
**Do this instead:** `const router = useRouter(); onClick={() => router.push(...)` — uses Next.js App Router prefetching and soft navigation.

### Anti-Pattern 4: Two Separate Pagination Implementations

**What people do:** Implement pagination inline per-page (PO list has its own state + logic; SOR list would have its own different implementation).
**Why it's wrong:** When the Pagination component API needs to change, must update multiple pages. Style diverges.
**Do this instead:** If extracting `usePagination` hook, all pages use the same state shape. `ListViewTable` accepts `pagination` prop and renders `<Pagination>` at the bottom. One place to update layout.

### Anti-Pattern 5: Per-Line-Item User Fetch in HistoryTab

**What people do:** In HistoryEntry, for each log entry, fetch the user record by `log.changed_by` UUID to get full name and avatar URL.
**Why it's wrong:** N+1 queries (50 log entries = 50 user fetches), cache miss on every render (not batched), adds latency to history tab load.
**Do this instead:** `audit_logs.changed_by_name` is already cached at write time by the audit trigger. Use it directly for `UserAvatar`. No additional query needed.

## Scaling Considerations

| Scale | Architecture Notes |
|-------|-------------------|
| Current (internal, ~50 users) | Client-side pagination + in-memory filter is fine. One fetch per list page load. SOR table will grow slowly. |
| 500+ SORs | Add `.range(offset, offset+pageSize-1)` server-side pagination in Supabase query. Requires count query for total. `Pagination` component API is already compatible. |
| Approval volume | `stock_out_approvals` gets 2 rows per line item in two-layer flow (vs 1 before). Existing `idx_sor_approval_line_item` index covers this. No new indexes needed. |

## Sources

All findings from direct inspection of:
- `/home/yaungni/qm-core/supabase/migrations/` (migrations 002, 025, 052–062)
- `/home/yaungni/qm-core/components/` (composite, stock-out-requests, history, ui/pagination)
- `/home/yaungni/qm-core/app/(dashboard)/inventory/stock-out-requests/` (page.tsx, [id]/page.tsx)
- `/home/yaungni/qm-core/app/(dashboard)/po/page.tsx` (pagination pattern reference)
- `/home/yaungni/qm-core/lib/hooks/use-permissions.ts` (RBAC matrix)
- `/home/yaungni/qm-core/types/database.ts` (users.avatar_url column confirmed)

Confidence: HIGH — all integration points verified from codebase, not from training data.

---
*Architecture research for: v1.12 — List View Standardization, Two-Layer Stock-Out Approval, User Avatars, Pagination, Audit History*
*Researched: 2026-02-17*
