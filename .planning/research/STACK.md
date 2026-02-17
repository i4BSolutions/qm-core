# Technology Stack

**Project:** QM System v1.12 — List Views, Two-Layer Approval, User Avatars, Pagination Standardization
**Researched:** 2026-02-17
**Confidence:** HIGH

---

## NEW Stack Additions

### 1. boring-avatars (Auto-Generated User Avatars)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **boring-avatars** | ^2.0.4 | Deterministic SVG avatars generated from user name string | Zero backend, zero image upload, zero storage cost. Generates consistent per-user avatars from a name string. React-native component, tiny footprint (~7KB gzip), pure SVG output compatible with Next.js SSR and App Router. |

**Rationale:** The milestone requires avatars displayed in three places: comment cards (already using `<User>` icon placeholder), history tab (`changed_by_name` text only), and user displays in list views. Users have `avatar_url` field in the database type (currently `null` for all users — no photo upload exists). The cleanest solution is deterministic generated avatars from `full_name` with no storage dependency.

**Why boring-avatars over DiceBear:**
- **boring-avatars** is a single React component (`<Avatar name="John Doe" variant="beam" />`). Import and render. Zero configuration.
- **DiceBear** requires `@dicebear/core` + a separate style package (`@dicebear/initials`, `@dicebear/thumbs`, etc.), calling `createAvatar()` then converting to SVG string manually. More setup for the same outcome.
- **boring-avatars** outputs pure JSX SVG — no `dangerouslySetInnerHTML`, no img tag, no external URL.
- **boring-avatars** v2.0.4 ships ESM + CJS, no Next.js App Router issues. 158K weekly downloads, 10K+ GitHub stars, last published 4 months ago (healthy maintenance cadence).
- **DiceBear** recently separated its PNG converter from core to fix a Next.js compatibility bug — additional complexity for pure SVG use case.

**Why NOT alternatives:**
- DiceBear — More setup required (two packages, JS API call, SVG serialization). Better when you need HTTP API or non-React frameworks.
- UI Avatars (external service) — Network dependency. The old API was paused July 2024. Unreliable for production.
- Robohash — Robotic/monster aesthetic, wrong for business app.
- Custom initials component — Already exists as `<User>` icon placeholder in `comment-card.tsx`. But initials-only loses visual distinction between users with same initials. boring-avatars `beam` variant produces colorful, distinct patterns per name.

**Integration points:**
- `comment-card.tsx` line 35: Replace `<User>` icon div with `<Avatar name={comment.author.full_name} variant="beam" size={32} />`
- `history-tab.tsx` `HistoryEntry` function: Add avatar next to `changed_by_name` text
- List view columns: User chip with avatar + name inline
- The `avatar_url` column on users table remains `null` — boring-avatars replaces it as the avatar source. No migration needed.

**SSR behavior:** boring-avatars generates pure SVG via React JSX. No canvas, no document access, no browser APIs. Renders correctly in Next.js Server Components and App Router. MEDIUM confidence on SSR (confirmed via library type: pure React component rendering SVG, no browser globals observed).

**Version:** 2.0.4 is current as of research date. Use `^2.0.4` to allow patch updates.

**Install:**
```bash
npm install boring-avatars
```

**Usage pattern:**
```tsx
import Avatar from "boring-avatars";

// In comment-card.tsx, history-tab.tsx, user chips in list views
<Avatar
  name={user.full_name}          // Seed for deterministic generation
  variant="beam"                  // Colorful organic pattern, professional look
  size={32}                       // 32px for inline use, 40px for comment/profile
  colors={["#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#EF4444"]}
  // ^ Matches existing app accent colors (amber, blue, emerald, purple, red)
/>
```

**Sources:**
- [boring-avatars npm](https://www.npmjs.com/package/boring-avatars) — v2.0.4, 158K weekly downloads
- [boring-avatars GitHub](https://github.com/boringdesigners/boring-avatars) — Source, 10K+ stars
- [DiceBear Initials](https://www.dicebear.com/styles/initials/) — Comparison reference
- [DiceBear JS Library](https://www.dicebear.com/how-to-use/js-library/) — Two-package setup confirmed

---

### 2. Pagination (NO NEW DEPENDENCIES)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Pagination component** | Existing (`/components/ui/pagination.tsx`) | Client-side page slicing for list views | Already fully implemented with page navigation, page size selector (10/20/50/100), item count display, first/last/prev/next buttons, and ellipsis for large page counts. |

**Current state:** The `Pagination` component at `/components/ui/pagination.tsx` is complete and already adopted on 5 pages:
- `/app/(dashboard)/qmrl/page.tsx` — uses Pagination
- `/app/(dashboard)/po/page.tsx` — uses Pagination
- `/app/(dashboard)/qmhq/page.tsx` — uses Pagination
- `/app/(dashboard)/inventory/page.tsx` — uses Pagination
- `/app/(dashboard)/invoice/page.tsx` — uses Pagination

**What's missing:** The stock-out-requests list page (`/app/(dashboard)/inventory/stock-out-requests/page.tsx`) does NOT have pagination — it has no `Pagination` import, no `currentPage`/`pageSize` state. This is the gap to fill.

**Pagination pattern (already standardized):**
```tsx
// State (copy from existing pages)
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(20);

// Derived values
const totalItems = filteredRequests.length;
const totalPages = Math.ceil(totalItems / pageSize);
const paginatedRequests = useMemo(() => {
  const start = (currentPage - 1) * pageSize;
  return filteredRequests.slice(start, start + pageSize);
}, [filteredRequests, currentPage, pageSize]);

// Component usage
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={totalItems}
  pageSize={pageSize}
  onPageChange={setCurrentPage}
  onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
/>
```

**No new library needed.** The existing `Pagination` component has all required features. Task is adoption on missing pages, not building a new component.

**Why NOT external pagination libraries:**
- `react-paginate` — External dependency when identical functionality already exists in codebase
- `@tanstack/react-table` pagination — The project already has `@tanstack/react-table` installed, but uses it for table rendering only. Its pagination hooks add complexity without value when client-side slice is sufficient.
- shadcn/ui Pagination — Project already has a custom Pagination component that matches the dark slate UI theme; shadcn defaults would require restyling.

---

### 3. Two-Layer Stock-Out Approval (NO NEW DEPENDENCIES)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL triggers + existing tables** | Built-in | Add Layer 2 (warehouse assignment) as a separate status state after Layer 1 (qty approval) | The existing `stock_out_approvals` table already stores `approved_quantity` and `decision`. Layer 2 needs warehouse assignment stored either as a column addition or a new status enum value. No new library needed — pattern follows existing approval workflow. |

**Current single-layer flow:**
```
SOR created → [Layer 1: Approve qty + assign warehouse in same dialog] → Execute
```

**Target two-layer flow:**
```
SOR created → [Layer 1: Approve qty only] → [Layer 2: Assign warehouse] → Execute
```

**Implementation approach — NO new library:**
The existing `stock_out_approvals` table needs a `warehouse_id` column (currently absent — approval stores qty and decision, but warehouse is set directly on the `inventory_transactions` pending row). The two-layer split means:
- Layer 1: `stock_out_approvals.decision = 'approved'`, `warehouse_id = NULL`
- Layer 2: Set `stock_out_approvals.warehouse_id` (warehouse assignment)
- Execute: Only possible after `warehouse_id IS NOT NULL`

**Database change required:** Add `warehouse_id UUID REFERENCES warehouses(id)` to `stock_out_approvals` table. This is a nullable column addition — no data loss.

**UI components required (existing patterns):**
- `ApprovalDialog` splits into: `Layer1ApprovalDialog` (qty only) and `Layer2WarehouseDialog` (warehouse assignment)
- Both use existing Radix UI Dialog, Select, Button patterns — no new components
- Existing `execution-dialog.tsx` remains — execution blocked until Layer 2 complete

**Status enum extension:** The `sor_line_item_status` enum currently has: `pending → approved → partially_executed → executed`. May need `qty_approved` (Layer 1 done) and `warehouse_assigned` (Layer 2 done) to distinguish states cleanly. This is a PostgreSQL migration, not a new library.

**Trigger pattern (proven in migrations 052-054):**
```sql
-- Existing pattern: trigger updates parent request status from child line items
-- Same pattern applies to two-layer: trigger enforces warehouse_id set before execution
CREATE OR REPLACE FUNCTION block_execution_without_warehouse()
RETURNS TRIGGER AS $$
BEGIN
  -- Block inventory_transaction insert if approval has no warehouse
  IF NOT EXISTS (
    SELECT 1 FROM stock_out_approvals
    WHERE id = NEW.stock_out_approval_id
    AND warehouse_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot execute: warehouse not yet assigned for this approval';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Sources:**
- Migration 052 (`stock_out_requests.sql`) — existing table schemas examined directly
- Migration 054 (`stock_out_rls_audit.sql`) — RLS and trigger patterns examined directly
- `approval-dialog.tsx` — existing UI pattern examined directly

---

## Existing Stack — No Changes Needed

These capabilities are already present and sufficient for the milestone features.

### User Attribution in History (NO NEW DEPENDENCIES)

| Component | Status | Usage for This Milestone |
|-----------|--------|--------------------------|
| `audit_logs.changed_by_name` | Exists | Already a TEXT column captured at trigger time. History tab displays it as text. |
| `HistoryTab` component | Exists (`/components/history/history-tab.tsx`) | Currently shows `changed_by_name` as text only. Milestone adds avatar next to name. |

**Gap:** The `HistoryEntry` component renders `{log.changed_by_name || "System"}` as a plain `<span>`. Need to add `<Avatar name={log.changed_by_name || "System"} variant="beam" size={24} />` before the name. No schema change needed — `changed_by_name` is already captured.

### List View Columns (NO NEW DEPENDENCIES)

| Component | Status | Usage |
|-----------|--------|-------|
| `@tanstack/react-table` | Installed (^8.21.3) | Already available for table column definition. QMRL page uses a custom grouped display rather than react-table. Standardized columns can use either approach. |
| `table.tsx` | Exists in `/components/ui/` | Base table component. Use for standardized column layouts. |

**Gap:** Stock-out-requests list lacks pagination and standardized columns. Other pages (QMRL, QMHQ, PO, Invoice) already have Pagination. The "assigned person filter" mentioned in milestone requirements can use the existing `FilterBar` composite component pattern.

### Card/List View Toggle (NO NEW DEPENDENCIES)

| Component | Status | Usage |
|-----------|--------|-------|
| `CardViewGrid` composite | Exists | Already used on QMHQ, PO, Invoice pages |
| `LayoutGrid` + `ListIcon` from lucide-react | Exists | Toggle button icons already imported in `stock-out-requests/page.tsx` |
| View state toggle pattern | Exists in `stock-out-requests/page.tsx` line 71 | `const [viewMode, setViewMode] = useState<"card" | "list">("card")` already there |

**Gap:** The stock-out list page has the toggle UI but no list view implementation — only card view renders. Need to implement the list view table rendering when `viewMode === "list"`.

---

## Summary: What Changes

| Capability | New Library? | Approach |
|-----------|-------------|---------|
| Auto-generated user avatars | **YES: `boring-avatars@^2.0.4`** | React component, name-seeded SVG |
| Pagination on stock-out list | NO | Apply existing `Pagination` component |
| Two-layer stock-out approval | NO | DB migration (add `warehouse_id` to approvals) + refactor existing dialog components |
| Audit history user display | NO | Add boring-avatars `<Avatar>` next to `changed_by_name` in `HistoryTab` |
| Standardized list columns | NO | Apply existing `table.tsx` + `@tanstack/react-table` patterns |
| Assigned person filter | NO | Apply existing `FilterBar` composite + existing filter state pattern |

---

## Installation

```bash
# One new dependency
npm install boring-avatars

# Verify it installed (current version should be 2.0.4)
npm list boring-avatars
```

No changes to `tsconfig.json`, `next.config.js`, or Tailwind config required.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Avatar generation | `boring-avatars` | `@dicebear/core` + `@dicebear/initials` | Two packages required; JS API (not React component); more setup for identical SVG output |
| Avatar generation | `boring-avatars` | Custom initials component | Letter-based initials lose visual distinction for same-initial users; boring-avatars' beam variant creates unique patterns per name |
| Avatar generation | `boring-avatars` | External avatar service (UI Avatars, Gravatar) | Network dependency; old boring-avatars API paused July 2024; adds request latency to every user display |
| Pagination | Existing component | `react-paginate` | External dependency when identical behavior already exists in codebase |
| Pagination | Existing component | shadcn/ui Pagination | Would require restyling to match slate/amber dark theme; project already has matching custom component |
| Approval workflow | DB migration + dialog split | Workflow engine (Temporal, Inngest) | Massive overkill for a two-step form; internal tool doesn't need durable execution or event sourcing |
| Approval workflow | DB migration + dialog split | XState | Application-layer state management unnecessary when PostgreSQL triggers enforce state at data level |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `boring-avatars@^2.0.4` | React 18.3.1 | Pure JSX/SVG rendering, no hooks with browser deps. Compatible with Next.js 15 App Router. |
| `boring-avatars@^2.0.4` | TypeScript 5.6.2 | Package ships its own type definitions. No `@types/boring-avatars` needed. |
| `boring-avatars@^2.0.4` | Tailwind CSS 3.4.x | No conflict — component renders inline SVG, Tailwind classes applied to wrapper div if needed |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@dicebear/core` + style packages | Two packages, imperative API, extra setup for pure SVG output | `boring-avatars` — single React component |
| `react-paginate` | Redundant — identical component exists at `/components/ui/pagination.tsx` | Existing `Pagination` component |
| External avatar URL service | Network latency per render, API availability risk, privacy (sends usernames to external server) | `boring-avatars` — client-side deterministic generation |
| `XState` for approval FSM | Frontend state machine library; approval state must be enforced at DB level, not just UI | PostgreSQL trigger with `RAISE EXCEPTION` blocking invalid transitions |
| `react-flow` / `reactflow` | Graph visualization library; linear approval chain doesn't need graph layout | Simple dialog-based step UI with existing Radix UI Dialog |

---

## Integration Points

### boring-avatars Integration

**File: `/components/comments/comment-card.tsx`**
```tsx
// BEFORE (line 35-37)
<div className="h-8 w-8 flex-shrink-0 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
  <User className="h-4 w-4 text-amber-500" />
</div>

// AFTER
import Avatar from "boring-avatars";
const APP_PALETTE = ["#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#EF4444"];

<div className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden">
  <Avatar
    name={comment.author.full_name}
    variant="beam"
    size={32}
    colors={APP_PALETTE}
  />
</div>
```

**File: `/components/history/history-tab.tsx`** (inside `HistoryEntry`)
```tsx
// BEFORE (line 255-260)
<span className="flex items-center gap-1">
  <span className="font-medium text-slate-300">
    {log.changed_by_name || "System"}
  </span>
</span>

// AFTER
<span className="flex items-center gap-2">
  <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0">
    <Avatar
      name={log.changed_by_name || "System"}
      variant="beam"
      size={20}
      colors={APP_PALETTE}
    />
  </div>
  <span className="font-medium text-slate-300">
    {log.changed_by_name || "System"}
  </span>
</span>
```

**Shared constant:** Extract `APP_PALETTE` to `/lib/constants/avatars.ts`:
```ts
// lib/constants/avatars.ts
export const APP_AVATAR_PALETTE = [
  "#F59E0B", // amber-500
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#8B5CF6", // violet-500
  "#EF4444", // red-500
];
```

### Two-Layer Approval: DB Migration

**New migration file:** `supabase/migrations/YYYYMMDD_sor_approval_warehouse_assignment.sql`
```sql
-- Add warehouse_id to stock_out_approvals for Layer 2
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT;

-- Optional: Add new enum value for line item status clarity
-- (only if business logic requires distinguishing qty_approved vs warehouse_assigned)
-- ALTER TYPE sor_line_item_status ADD VALUE IF NOT EXISTS 'qty_approved';
```

**Guard trigger (blocks execution without warehouse):**
Follows existing `aa_` prefix convention from migration patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| boring-avatars recommendation | **HIGH** | v2.0.4 confirmed via npm search (158K weekly downloads, last published 4 months ago). React component renders pure SVG — no browser globals, SSR-safe. Verified DiceBear requires two packages vs one. |
| Pagination — no new library | **HIGH** | `Pagination` component exists and is already adopted on 5/6 list pages. Code read directly. |
| Two-layer approval — no new library | **HIGH** | Existing migration 052 and approval-dialog.tsx read directly. Pattern confirmed: add nullable `warehouse_id` column, split dialog, add guard trigger. |
| boring-avatars SSR compatibility | **MEDIUM** | Confirmed: pure JSX/SVG rendering (not canvas, not img, no `document` access). No official SSR docs found, but pure-SVG JSX components are universally SSR-safe in Next.js. |
| boring-avatars bundle size | **MEDIUM** | Listed as "tiny" by maintainers, confirmed low npm weekly download footprint. Exact gzip size not confirmed via Bundlephobia (access blocked). Expect <10KB gzip based on library description and SVG-only nature. |

---

## Sources

### HIGH Confidence (Verified Directly)
- `/home/yaungni/qm-core/package.json` — Current dependencies confirmed (boring-avatars absent, @tanstack/react-table present, no DiceBear)
- `/home/yaungni/qm-core/components/ui/pagination.tsx` — Pagination component read directly (full implementation confirmed)
- `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` — stock_out_approvals schema read directly (no warehouse_id column confirmed)
- `/home/yaungni/qm-core/components/stock-out-requests/approval-dialog.tsx` — Current single-layer approval flow confirmed
- `/home/yaungni/qm-core/types/database.ts` — `changed_by_name` field confirmed, `avatar_url: null` for users confirmed
- `/home/yaungni/qm-core/.planning/PROJECT.md` — Milestone requirements read directly

### MEDIUM Confidence (Verified via Web Search)
- [boring-avatars npm](https://www.npmjs.com/package/boring-avatars) — v2.0.4, 158K weekly downloads, last published 4 months ago
- [boring-avatars GitHub](https://github.com/boringdesigners/boring-avatars) — 10K+ GitHub stars, open source React library for SVG avatars
- [DiceBear JS Library](https://www.dicebear.com/how-to-use/js-library/) — Two-package setup (@dicebear/core + style) confirmed
- [DiceBear Initials style](https://www.dicebear.com/styles/initials/) — Initials avatar style documented

---

**Total New Dependencies:** 1 (`boring-avatars`)

**Complexity:** Low (boring-avatars is a drop-in component). Medium (two-layer approval requires DB migration + dialog component refactor). Low (pagination adoption on stock-out list).

**Risk Areas:**
1. **Two-layer approval status clarity**: If `sor_line_item_status` enum doesn't get `qty_approved` intermediate value, the UI must infer Layer 1 complete from `approval.warehouse_id IS NULL` — workable but slightly indirect. Adding enum value is cleaner but a multi-step migration.
2. **Avatar color consistency**: If `APP_AVATAR_PALETTE` isn't extracted to a shared constant, each component may use slightly different color arrays producing inconsistent avatar appearances for the same user across different pages.
3. **boring-avatars SSR edge case**: Pure SVG rendering is expected to work in App Router Server Components, but if hydration mismatches occur, wrap in a `"use client"` boundary — this adds one client component per avatar render location, which is acceptable.
