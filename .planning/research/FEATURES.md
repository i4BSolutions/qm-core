# Feature Landscape

**Domain:** Internal Procurement & Inventory Management — UI Standardization & Workflow Enhancement
**Researched:** 2026-02-17
**Confidence:** HIGH (all findings verified against actual codebase)

---

## Scope

This milestone adds four feature areas to an existing, mature application. The codebase already has: card/list view toggle on QMHQ/PO/Invoice/SOR pages, single-layer stock-out approval (SOR -> line items -> approvals -> execution), audit logs with `changed_by_name` text, pagination component, and per-entity `avatar_url` field. This research maps what is already built, what is missing, and what the milestone should deliver in each area.

---

## Feature Area 1: Two-Layer Stock-Out Approval (Warehouse Assignment with Caps)

### What Already Exists

The current approval flow is:

```
SOR created (multi-item request)
  -> Line items (pending)
  -> Approver opens ApprovalDialog
  -> Sets approved_quantity (capped at remaining_quantity), selects warehouse, enters conversion rate
  -> Approval record inserted into stock_out_approvals
  -> Pending inventory_transaction created (status = 'pending')
  -> Inventory team executes via ExecutionDialog (confirms transaction, moves status to 'completed')
```

This is already a two-stage process (approve + execute). The approval dialog already fetches warehouse stock levels and shows a warning when approved qty exceeds available stock. Per-line-item approved quantity is already capped at `remaining_quantity`.

### What Is Missing

The milestone context says "two-layer approval workflow — qty approval then warehouse assignment with caps." After reading the actual `ApprovalDialog`, these two happen in the same dialog in one step. The missing capability is **separating** qty approval from warehouse assignment, or adding a **hard cap** enforced at the database level (currently only a UI warning, not a block).

**Research finding:** The current approval dialog shows `showStockWarning` as a soft warning — it does NOT prevent submission when approved qty exceeds available warehouse stock. This is a gap. The approval will create a `pending` inventory_transaction that cannot be executed if stock is actually insufficient.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Hard cap: approved qty cannot exceed warehouse stock** | Approval without stock is meaningless — creates phantom pending transactions | MEDIUM | Currently only a UI warning. Needs DB-level validation in `approve_stock_out_request()` function or trigger |
| **Warehouse stock shown on line items in approval dialog** | Approver must see available qty per warehouse before setting approved qty | LOW | Already implemented — `fetchWarehouseStockForItem()` runs on dialog open |
| **Approved qty capped at remaining line item qty** | Cannot approve more than was requested | LOW | Already implemented via `max={item.remaining_quantity}` on AmountInput |
| **Approval record links to specific warehouse + inventory transaction** | Audit trail: who approved what qty from which warehouse | LOW | Already implemented — `stock_out_approvals` links to `stock_out_line_items` and `inventory_transactions` |
| **Execution dialog shows stock availability at time of execution** | Stock may change between approval and execution | MEDIUM | `ExecutionDialog` fetches warehouse stock at open time. Needs explicit "available when approved" vs "available now" display |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Real-time stock cap enforcement (database-level)** | Prevents approval dialogs from creating invalid pending transactions | MEDIUM | Add check in `stock_out_approvals` insert trigger or RPC function. Follow advisory_lock pattern from migration 058 |
| **Partial approval across multiple warehouses for one line item** | One line item can be fulfilled from Warehouse A (10 units) + Warehouse B (5 units) | HIGH | Requires schema change: multiple approvals per line item already exist, but UI currently one warehouse per line item. Out of scope unless explicitly requested |
| **Automatic warehouse suggestion** | System suggests warehouse with highest stock for requested item | LOW | Sort warehouses by available_stock descending — already done in `fetchWarehouseStockForItem()` |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Fully separating qty approval from warehouse assignment into two screens** | Adds friction — approver must return to same request twice. The current single-dialog UX is better. | Keep combined. Enforce hard caps at save time, not by splitting screens |
| **Auto-executing approved transactions** | Bypasses inventory team's physical verification step. Safety risk. | Keep the two-step approve-then-execute flow |
| **Approving without a warehouse selection** | Creates incomplete approval records that block execution | Make warehouse mandatory (it already is in UI validation) |

### Dependencies

```
Two-Layer Approval Caps
  └── requires --> stock_out_approvals table (already exists, migration 052)
  └── requires --> inventory_transactions table (already exists, migration 023)
  └── enhances --> ApprovalDialog UI (add error message instead of warning on stock exceed)
  └── enhances --> approve RPC function (add stock validation with advisory lock)
```

### Complexity Assessment

| Sub-Feature | Complexity | Risk |
|-------------|------------|------|
| Soft warning -> hard error in ApprovalDialog UI | LOW | Low — UI change only |
| DB-level stock validation on approval insert | MEDIUM | Medium — advisory lock pattern required |
| Execution stock re-check | LOW | Low — pattern already exists |

---

## Feature Area 2: Auto-Generated User Avatars

### What Already Exists

- `avatar_url TEXT | null` column on `users` table (verified in `types/database.ts` line 753)
- `getInitials(name)` function in `components/layout/header.tsx` (extracts first 2 initials, uppercase)
- `UserAvatar` in `components/flow-tracking/flow-qmrl-node.tsx` and `flow-qmhq-node.tsx` — shows `avatar_url` image if set, falls back to single first-letter initial in a `h-5 w-5` circle
- Comments section uses a generic `User` icon (no initials, no real avatar)
- History tab (`components/history/history-tab.tsx`) shows only `log.changed_by_name` text, no visual avatar

### What Is Missing

There is **no shared, reusable UserAvatar component**. Avatar logic is duplicated across 3+ files with different sizes and fallback strategies. The history tab has no visual user indicator at all.

**Research finding on auto-generation:** The `avatar_url` field exists but users are invited via magic link — there is no avatar upload flow in the app. The database schema comment says "cached name for display without joins" for `changed_by_name`. A deterministic avatar can be generated from the user's name at render time without any backend calls.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Consistent user avatar display across all user-attribution points** | Seeing different avatar styles in different parts of the app feels unfinished | LOW | Requires a single shared `UserAvatar` component used everywhere |
| **Initials-based fallback when no avatar_url** | Users without uploaded photos still need visual identity | LOW | `getInitials()` already exists in header.tsx — extract to shared util |
| **Avatar in history tab entries** | Who made a change should be visually scannable, not just text | LOW | History tab has `changed_by_name` and `changed_by` UUID. Currently shows text only |
| **Avatar in comments** | CommentsCard uses generic User icon — inconsistent with flow-tracking nodes | LOW | Replace User icon with UserAvatar component |
| **Deterministic color per user** | Initials-only avatars should have a stable color (not random each render) | LOW | Hash the user's name or UUID to select from a palette of 8-10 colors |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Avatar tooltip showing full name on hover** | Compact spaces show small avatars — tooltip reveals identity | LOW | Wrap with existing `TooltipProvider` pattern from codebase |
| **Avatar group (stacked) for multi-user display** | List pages could show requester + assignee stacked with overlap | MEDIUM | Custom component — not warranted unless list views need it |
| **Gravatar or external avatar integration** | Pulls real photos from email hash | MEDIUM | Requires network call, privacy concern. Not recommended for internal tool |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Avatar upload feature** | Scope creep — requires storage bucket, upload UI, cropping. Users are added by admin. | Use deterministic initials + color. If real photos needed, admin can set avatar_url directly in DB |
| **Random color on each render** | Confusing — same user appears different colors | Hash name/id to stable color index from a fixed palette |
| **Image loading without fallback** | If avatar_url 404s, shows broken image | Always show initials as fallback, only render img if avatar_url is set and loads |

### Implementation Pattern

```typescript
// Deterministic color from name string
function getAvatarColor(name: string): string {
  const COLORS = [
    "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "bg-purple-500/20 text-purple-400 border-purple-500/30",
    "bg-rose-500/20 text-rose-400 border-rose-500/30",
    "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    "bg-orange-500/20 text-orange-400 border-orange-500/30",
    "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}
```

### Dependencies

```
UserAvatar component
  └── requires --> getInitials() utility (extract from header.tsx)
  └── requires --> getAvatarColor() utility (new, simple hash)
  └── enhances --> HistoryTab (add avatar next to changed_by_name)
  └── enhances --> CommentCard (replace User icon with UserAvatar)
  └── enhances --> flow-qmrl-node, flow-qmhq-node (replace inline UserAvatar)
  └── enhances --> Header (replace inline initials logic)
```

### Complexity Assessment

| Sub-Feature | Complexity | Risk |
|-------------|------------|------|
| Extract getInitials() to shared util | LOW | Low |
| Create UserAvatar component (sm/md/lg sizes) | LOW | Low |
| Apply to history tab | LOW | Low |
| Apply to comments | LOW | Low |
| Apply to flow-tracking nodes | LOW | Low |

---

## Feature Area 3: Standardized List Views

### What Already Exists

**Pages with card/list toggle:**
- QMHQ list: `viewMode: "card" | "list"` — card view grouped by status group, list view renders rows
- PO list: `viewMode: "card" | "list"` — card view grouped by status, list view renders table rows
- Invoice list: `viewMode: "card" | "list"` — card view grouped by status, list view renders table rows
- SOR list: `viewMode: "card" | "list"` — state exists but list view rendering may not be implemented

**Pages WITHOUT list view:**
- QMRL list: Only card view, grouped by status (to_do, in_progress, done). No `viewMode` state.

**Pagination:**
- `Pagination` component exists at `components/ui/pagination.tsx` — fully featured (first/last/prev/next buttons, page numbers with ellipsis, page size selector)
- QMRL, QMHQ, PO, Invoice pages all import and use `Pagination`
- SOR list does NOT appear to use `Pagination` (not imported in stock-out-requests/page.tsx)
- Pagination is client-side (slice on filtered array), not server-side

### What Is Missing

1. **QMRL list view is missing entirely** — only grouped card view exists
2. **SOR list does not use `Pagination`** — loads all items, no pagination control
3. **Inconsistent list view column schemas** — each page that has list view defines its own columns inline with no shared pattern
4. **Page size persistence** — users cannot save their preferred page size; resets to 20 on navigation
5. **Sorting on list view columns** — no column sort in any list view currently

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **QMRL list view (table/row format)** | QMRL is the primary entity. All other entity list pages have list toggle. Gap is obvious. | MEDIUM | Needs columns: ID, Title, Priority badge, Status badge, Category badge, Assigned user, Request date, Created at |
| **SOR list pagination** | SOR page loads all records — performance degrades with volume | LOW | Add Pagination component following existing pattern from PO/QMHQ pages |
| **Consistent toggle button placement and icons** | LayoutGrid + List icons already used in QMHQ/PO/Invoice — QMRL needs same | LOW | Add `viewMode` state and toggle buttons to QMRL page |
| **List view shows same columns that card shows** | Users switching views should not lose information | LOW | Map card data to table columns |
| **Empty state in both views** | No records should show informative empty state, not blank area | LOW | Pattern exists in codebase — replicate |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Column sorting in list view** | Power users scanning large lists need sort by date, priority, status | MEDIUM | Client-side sort using `useMemo`. No library needed. Add sort icon to column headers. |
| **View mode persistence in localStorage** | User preference remembered across navigation | LOW | `localStorage.getItem("qmrl-view-mode")` on mount, save on change |
| **Configurable columns (show/hide)** | Users can remove columns they don't use | HIGH | Complex UI. Not recommended for MVP of this milestone. |
| **Sortable by clicking column header** | Standard UX for data tables | MEDIUM | Add `sortField` / `sortDirection` state, sort `filteredItems` in `useMemo` |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Server-side pagination** | Adds API complexity and latency for an internal tool with <1000 records per entity | Keep client-side. Apply `.limit(500)` on Supabase queries. |
| **Drag-to-reorder columns** | Complex DnD implementation for low internal-tool value | Static column order. Hide/show toggle as future enhancement. |
| **URL-synced pagination state** | Useful for sharing deep links, but QMRL/QMHQ don't have shareable filtered views | Keep pagination in component state. Simple. |
| **Infinite scroll instead of pagination** | Confusing with filters active — where are you in the list? | Keep explicit page navigation with page numbers |

### Column Schema Recommendations

**QMRL list view columns (in order):**
| Column | Display | Width | Notes |
|--------|---------|-------|-------|
| ID | `QMRL-2025-00001` | 140px | Fixed, monospace |
| Title | Full text | flex-1 | Truncated with tooltip |
| Priority | Pill badge | 80px | LOW/MED/HIGH/CRIT |
| Status | Color badge | 140px | From status_config |
| Category | Color badge | 120px | From categories |
| Assigned | User name | 140px | Could show avatar |
| Request Date | `Jan 15, 2025` | 110px | Short date |
| Actions | Links | 80px | View button |

**Consistent list view column pattern across all pages:**
- ID (monospace, fixed)
- Primary name/title (flex-1)
- Status badge
- Financial amounts (right-aligned, if applicable)
- Dates
- Actions column

### Pagination Standardization

The existing Pagination component is already well-built. Standardization needed:

1. Apply to SOR list (missing)
2. Ensure all pages use `pageSize` state with the same default (20)
3. Use same `pageSizeOptions = [10, 20, 50, 100]` everywhere
4. Reset `currentPage` to 1 on filter/search change (already done on PO/QMHQ — verify SOR)

### Dependencies

```
List View Standardization
  └── requires --> Pagination component (already exists, complete)
  └── requires --> viewMode state pattern (already in QMHQ/PO/Invoice — replicate to QMRL, SOR)
  └── enhances --> QMRL page (add list view)
  └── enhances --> SOR page (add pagination)
  └── no new dependencies

Column Sorting (differentiator)
  └── requires --> list view (must exist first)
  └── no new dependencies (client-side useMemo sort)
```

### Complexity Assessment

| Sub-Feature | Complexity | Risk |
|-------------|------------|------|
| Add list view to QMRL page | MEDIUM | Low — follow QMHQ pattern exactly |
| Add pagination to SOR page | LOW | Low — copy from QMHQ page |
| Standardize page size defaults across all pages | LOW | Low — change constants |
| Column sorting on list views | MEDIUM | Low — client-side sort |
| View mode persistence in localStorage | LOW | Low |

---

## Feature Area 4: Audit History with User Attribution and Avatars

### What Already Exists

The `HistoryTab` component (`components/history/history-tab.tsx`) is complete with:
- Timeline layout with action-specific icons and colors
- `changed_by_name` text display (cached in `audit_logs.changed_by_name`)
- Expand/collapse for field-level change details
- Relative time display ("2h ago") with full timestamp on hover
- Supports all 9 action types: create, update, delete, status_change, assignment_change, void, approve, close, cancel
- Void cascade detection via `changes_summary.includes('void of invoice')`

The `audit_logs` table has both:
- `changed_by UUID` — FK to users table (nullable due to `ON DELETE SET NULL`)
- `changed_by_name TEXT` — cached name snapshot (no join needed for display)

### What Is Missing

1. **No avatar next to `changed_by_name`** — the history entry only shows the text name. No visual indicator of who made the change.
2. **No avatar_url join in history query** — the current query fetches `audit_logs` with `select("*")`. The `changed_by` FK exists but `avatar_url` is not fetched (requires a join to `users`).
3. **`changed_by` UUID can become `null`** if a user is deleted (ON DELETE SET NULL) — the cached `changed_by_name` survives but the UUID is gone. Avatar generation must gracefully handle null UUID.

### Architecture Decision: Name-Based vs UUID-Based Avatar

Two options for getting avatar color in history:

**Option A: Deterministic from `changed_by_name`** (recommended)
- No additional query needed — `changed_by_name` is always present
- Hash the name string to pick a color from the palette
- Initials from the name string
- Survives user deletion (name is cached)
- Consistent: same name always gets same color

**Option B: Join to `users` to get `avatar_url`**
- Requires changing `select("*")` to `select("*, changed_by_user:users(id, full_name, avatar_url)")`
- Gets real photo if uploaded
- Breaks when user is deleted (changed_by is null)
- More expensive query

**Recommendation: Option A** — use `changed_by_name` for deterministic initials and color. If `avatar_url` support is needed later, it can be fetched via Option B with a null-safe fallback.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Avatar (initials circle) next to username in history entries** | Visual scanning: users can recognize who made changes without reading every name | LOW | Use shared `UserAvatar` component from Feature Area 2 |
| **Deterministic avatar color per user in history** | Same user should always have same color across all history entries | LOW | Hash `changed_by_name` for stable color |
| **Graceful handling of null changed_by** | System-generated changes (triggers) have no user | LOW | Show "System" with a gear icon avatar |
| **Initials from full name in history** | Two-character initials more scannable than single letter | LOW | Use `getInitials()` from shared util |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Avatar tooltip showing full name** | History avatars are small — tooltip confirms identity | LOW | Wrap avatar in existing TooltipProvider |
| **Filter history by user** | "Show only changes by [User X]" in busy entities | MEDIUM | Add a user filter dropdown above timeline. Requires collecting unique users from `logs` array |
| **Filter history by action type** | "Show only status changes" | MEDIUM | Add action filter. UI complication vs value depends on entity verbosity |
| **Pagination for history entries** | Busy entities (POs) accumulate 100+ history entries | MEDIUM | Current: `.limit(50)`. Add "Load more" button or pagination |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Real-time auto-refresh for history** | Internal tool, users don't watch history continuously | Provide manual refresh button if needed |
| **Joining users table on every history entry for avatar_url** | Adds latency, fails on deleted users | Use deterministic initials from cached `changed_by_name` |
| **Color-coding entries by user (entire entry background)** | Hard to read alongside action-color coding already in use | Color only the avatar circle, keep entry background neutral |

### Dependencies

```
History Avatar Feature
  └── requires --> UserAvatar component (Feature Area 2)
  └── requires --> getInitials() utility (Feature Area 2)
  └── requires --> getAvatarColor() utility (Feature Area 2)
  └── enhances --> HistoryTab (add avatar before changed_by_name display)
  └── no schema changes needed (changed_by_name already cached)
```

### Complexity Assessment

| Sub-Feature | Complexity | Risk |
|-------------|------------|------|
| Add UserAvatar to history entries | LOW | Low — pure UI addition |
| System/null changed_by fallback | LOW | Low — simple null check |
| History entry user filter | MEDIUM | Low — client-side filter on loaded entries |
| History pagination (load more) | MEDIUM | Low — cursor-based or offset on audit_logs query |

---

## Cross-Feature Dependencies

```
UserAvatar component (Feature 2)
  ├── enables --> History avatars (Feature 4)
  ├── enables --> List view user columns (Feature 3)
  └── is foundational (build first)

List View standardization (Feature 3)
  ├── requires --> Pagination component (already exists)
  └── can proceed independently of Features 1, 2, 4

Two-Layer Approval caps (Feature 1)
  └── can proceed independently (backend + dialog changes only)

History avatars (Feature 4)
  └── requires --> UserAvatar (Feature 2, must build first)
```

**Build order recommendation:**
1. UserAvatar component + utilities (Feature 2 foundation)
2. List view standardization — QMRL list view + SOR pagination (Feature 3)
3. Approval hard caps — UI + DB validation (Feature 1)
4. History avatars — apply UserAvatar to HistoryTab (Feature 4)

---

## MVP Definition

### Launch With (this milestone)

- [ ] `UserAvatar` component with initials fallback and deterministic color — foundational for all other features
- [ ] QMRL list view (table format with card/list toggle matching QMHQ pattern)
- [ ] SOR list pagination (apply existing Pagination component)
- [ ] Approval dialog: hard error (not soft warning) when approved qty exceeds warehouse stock
- [ ] History tab: avatar circle next to `changed_by_name` for every audit entry

### Add After Validation (v-next)

- [ ] Column sorting on list views — once list views are stable
- [ ] View mode persistence in localStorage — low-effort quality improvement
- [ ] History entry user filter — when entities accumulate many entries

### Future Consideration (v2+)

- [ ] Avatar upload flow — requires storage bucket, upload UI, admin tooling
- [ ] Server-side pagination — only if record counts exceed 500+ per entity
- [ ] Real-time history refresh — polling or WebSocket

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UserAvatar component | HIGH | LOW | P1 — foundational |
| QMRL list view | HIGH | MEDIUM | P1 — visible gap |
| SOR pagination | MEDIUM | LOW | P1 — performance fix |
| Approval hard cap | HIGH | MEDIUM | P1 — data integrity |
| History avatars | MEDIUM | LOW | P1 — visual polish |
| Column sorting | MEDIUM | MEDIUM | P2 — usability |
| View mode persistence | LOW | LOW | P2 — convenience |
| History user filter | LOW | MEDIUM | P3 — power users |
| Approval multi-warehouse split | MEDIUM | HIGH | P3 — complex schema change |

---

## Sources

**Codebase verification (HIGH confidence):**
- `/home/yaungni/qm-core/components/history/history-tab.tsx` — confirmed no avatar, confirmed `changed_by_name` cached field
- `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` — confirmed soft warning (not hard error) on stock exceed
- `/home/yaungni/qm-core/types/database.ts` line 753 — confirmed `avatar_url: string | null` on users table
- `/home/yaungni/qm-core/components/layout/header.tsx` — confirmed `getInitials()` utility exists but is local
- `/home/yaungni/qm-core/components/flow-tracking/flow-qmrl-node.tsx` — confirmed inline `UserAvatar` with single-letter fallback
- `/home/yaungni/qm-core/components/ui/pagination.tsx` — confirmed Pagination component is complete and usable
- `/home/yaungni/qm-core/app/(dashboard)/qmrl/page.tsx` — confirmed no `viewMode` state, no list view
- `/home/yaungni/qm-core/app/(dashboard)/inventory/stock-out-requests/page.tsx` — confirmed no Pagination import
- `/home/yaungni/qm-core/supabase/migrations/025_audit_logs.sql` — confirmed `changed_by UUID`, `changed_by_name TEXT` both present

**Implementation patterns verified in codebase:**
- QMHQ page as reference for card/list toggle + pagination + filter bar pattern
- PO page as reference for list view columns + status badge in list rows
- Advisory lock pattern from migration 058 for stock validation

---
*Feature research for: QM System — list view standardization, two-layer approval caps, user avatars, audit history*
*Researched: 2026-02-17*
