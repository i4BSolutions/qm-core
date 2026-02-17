# Phase 56: List View Standardization - Research

**Researched:** 2026-02-17
**Domain:** Next.js 14 App Router, React state management, URL-driven pagination, shared UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Text overflow: truncate with ellipsis (single line, compact rows)
- Row density: comfortable (medium padding, standard text)
- Status display: colored badge pills (colored background, white text)
- Financial amounts: follow per-page roadmap spec (QMHQ/PO/Invoice show amounts, QMRL/Items do not)
- Row click: whole row clickable to navigate to detail page
- Assigned person in list rows: avatar only (name on hover tooltip) — compact
- Responsive: auto-switch to card view below tablet breakpoint (no horizontal scroll)
- Default view: card view on all pages (including QMRL — gets card + list toggle for full consistency)
- No persistence: always resets to card default on page load
- Toggle position: right side of toolbar, icon toggle
- Reuse existing `components/ui/pagination.tsx` component across all pages
- Make pagination URL-driven (?page=N&pageSize=N) — bookmarkable, back button works
- Show total count: "Showing X to Y of Z items"
- Assigned person filter: single select dropdown, shows avatar + name per option
- Position: after status filter (Search | Status | Assigned Person | Category | ... | Toggle)
- No "Assigned to me" shortcut button
- Changing any filter resets page to 1
- Every list page follows the same toolbar layout: Search (left, fixed width) | Filter dropdowns (middle) | Card/list toggle (right)
- Responsive: filters collapse into a "Filters" button on narrow screens (mobile/tablet)

### Claude's Discretion
- Column widths (fixed vs flex with min/max — decide per column type)
- Default page size
- Active filter chip display below toolbar
- Exact breakpoint for auto-switch to card view
- Exact breakpoint for filter collapse to button

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LIST-01 | QMRL page has a list view with columns: ID, Title, Status, Assigned Person, Request Date | QMRL page exists with card view only; `assigned_to` field exists; UserAvatar at 28px default; URL-driven pagination pattern documented |
| LIST-02 | QMHQ list view shows columns: ID, Name, Route, Status, Assigned Person, QMRL Ref | QMHQ page already has list view but missing assigned person filter; needs to add `assigned_user` column with avatar |
| LIST-03 | PO list view shows columns: PO ID, Supplier, Status, Total Amount/EUSD, Progress, Date | PO list view exists; no `assigned_to` in DB — "assigned person" here is the QMHQ line's assigned user reached via join |
| LIST-04 | Invoice list view shows columns: INV ID, Status, Amount/EUSD, Received %, Date, PO Ref | Invoice list view exists; no `assigned_to` in DB — same interpretation needed |
| LIST-05 | Items list view shows columns: SKU, Name, Category, Unit, Price Ref | Items page uses DataTable (tanstack); needs migration to new pattern with card/list toggle |
| LIST-06 | Stock-out execution page list view shows columns: SOR ID, Item, Requester, Reason, QMHQ Ref, Status | Stock-out requests page exists; "Item" column = first line item or item count; Requester has `full_name`; needs pagination + assigned filter |
| AVTR-03 | User avatar appears next to assigned person in list view rows | UserAvatar component exists at `components/ui/user-avatar.tsx`; accepts `fullName: string`; size 28px for list rows |
| PAGE-01 | All list and card view pages use the same Pagination component with consistent UI | `components/ui/pagination.tsx` exists and matches spec; needs URL-sync wrapper or caller changes |
| PAGE-02 | All list pages can be filtered by assigned person | QMRL already has assigned filter; QMHQ/PO/Invoice/Items/SOR need it; PO/Invoice have no `assigned_to` — must use alternative person field |
| PAGE-03 | Page resets to page 1 when filters change | Pattern exists in QMRL/QMHQ/PO/Invoice via `useEffect` watching filters; needs to also reset URL param |
</phase_requirements>

---

## Summary

Phase 56 standardizes 6 list pages. All the core UI building blocks already exist in this codebase. The work is additive: adding a list view to QMRL, standardizing toolbar layout, wiring URL-driven pagination into the existing `Pagination` component, and adding the assigned person filter to all pages.

The biggest discovery is a **data model gap**: PO, Invoice, and Items tables have no `assigned_to` column. The "assigned person" filter on those pages must use a different field — the QMHQ line's `assigned_to` for PO (one join level up), and `created_by` for Invoice. For Items, there is no person association at all, so the assigned person filter is not meaningful there. The planner must decide how to interpret PAGE-02 for tables that lack an `assigned_to` column.

Stock-out requests use `requester_id` (not `assigned_to`), so the filter dropdown on that page will show all users and filter by `requester_id`.

URL-driven pagination requires adding `useSearchParams` + `useRouter` to every list page. The existing `Pagination` component is callback-based; callers must translate URL params into the `currentPage`/`pageSize` props and push URL updates on change.

**Primary recommendation:** Add a shared `usePaginationParams` hook that reads `?page=N&pageSize=N` from the URL and returns `{page, pageSize, setPage, setPageSize}` where setters call `router.push`. Use this hook in all 6 pages instead of local state.

---

## Standard Stack

### Core (already in project)
| Component | Location | Purpose |
|-----------|----------|---------|
| `Pagination` | `components/ui/pagination.tsx` | Numbered pages, first/prev/next/last, page size selector, "Showing X to Y of Z" |
| `UserAvatar` | `components/ui/user-avatar.tsx` | boring-avatars Beam, accepts `fullName: string`, default size 28px |
| `FilterBar` | `components/composite/filter-bar.tsx` | Wraps search + selects in `command-panel` div, flex layout |
| `FilterBar.Search` | same file | Debounced text search with icon |
| `FilterBar.Select` | same file | Shadcn Select wrapped with standard styling |
| `CardViewGrid` | `components/composite/card-view-grid.tsx` | 3-column Kanban grouped card layout |
| `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent` | `components/ui/tooltip.tsx` | Radix tooltip — use for avatar hover name |
| `Badge` | `components/ui/badge.tsx` | Colored pill badges for status |
| `CurrencyDisplay` | `components/ui/currency-display.tsx` | Shows amount + EUSD inline |

### New to create
| Component | Location | Purpose |
|-----------|----------|---------|
| `usePaginationParams` | `lib/hooks/use-pagination-params.ts` | Read/write `?page=N&pageSize=N` from URL |
| `ListViewTable` | `components/shared/list-view-table.tsx` (optional) | Shared `<table>` shell with standard thead styling — reduces copy-paste |

### Supporting patterns already used
| Pattern | Example | Notes |
|---------|---------|-------|
| `useSearchParams` + `useRouter` | `app/(dashboard)/po/new/page.tsx` | Next.js App Router URL param pattern |
| Avatar-only with tooltip | Admin users page uses `UserAvatar` at size 32 | For list rows, use size 28 (default), wrap in `Tooltip` |
| View toggle (card/list) | QMHQ, PO, Invoice pages | Icon toggle buttons, `viewMode` state — already implemented |
| Filter-resets-page pattern | `useEffect([searchQuery, ...], () => setCurrentPage(1))` | Used in QMRL, QMHQ, PO, Invoice |

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
lib/
  hooks/
    use-pagination-params.ts    # NEW: URL-driven pagination hook
components/
  shared/                       # NEW folder (optional)
    list-view-table.tsx         # Optional: shared table shell
app/(dashboard)/
  qmrl/page.tsx                 # ADD: list view + toggle + URL pagination
  qmhq/page.tsx                 # ADD: assigned person filter + URL pagination
  po/page.tsx                   # ADD: assigned person filter + URL pagination
  invoice/page.tsx              # ADD: assigned person filter + URL pagination
  item/page.tsx                 # REPLACE: DataTable with card/list toggle + standard toolbar
  inventory/stock-out-requests/
    page.tsx                    # ADD: list view standardization + URL pagination
```

### Pattern 1: URL-Driven Pagination Hook

**What:** A hook that reads `page` and `pageSize` from URL search params, returns them, and exposes setters that push URL updates with `router.push`. Changing filters that call `setPage(1)` will reset the URL param.

**When to use:** On every list page as the single source of pagination state.

```typescript
// lib/hooks/use-pagination-params.ts
"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PaginationParams {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export function usePaginationParams(defaultPageSize = 20): PaginationParams {
  const router = useRouter();
  const searchParams = useSearchParams();

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = parseInt(
    searchParams.get("pageSize") || String(defaultPageSize),
    10
  );

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        params.set(key, value);
      });
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const setPage = useCallback(
    (p: number) => updateParams({ page: String(p) }),
    [updateParams]
  );

  const setPageSize = useCallback(
    (size: number) => updateParams({ page: "1", pageSize: String(size) }),
    [updateParams]
  );

  return { page, pageSize, setPage, setPageSize };
}
```

**IMPORTANT:** Pages using `useSearchParams` in Next.js 14 App Router must be wrapped in `<Suspense>` at the layout level or use a client boundary. All target pages are already `"use client"` and already use `useSearchParams` in some related pages, so this pattern is safe.

### Pattern 2: Avatar-Only Assigned Person Column

**What:** Show only the `UserAvatar` in the list row. Wrap it with Radix `Tooltip` so hovering shows the full name.

**When to use:** In the "Assigned" column of any list view table.

```typescript
// In list view table rows:
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/ui/user-avatar";

{assignedUser ? (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default">
          <UserAvatar fullName={assignedUser.full_name} size={28} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{assignedUser.full_name}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
) : (
  <span className="text-slate-500">—</span>
)}
```

### Pattern 3: Assigned Person Filter Dropdown with Avatar + Name

**What:** The filter dropdown for assigned person shows avatar + name in each option. This requires rendering custom JSX in `SelectItem` content. The existing `FilterBar.Select` only accepts `{ value, label }` text pairs — extend or bypass it.

**When to use:** The assigned person filter on every page.

```typescript
// Use the raw Shadcn Select directly (not FilterBar.Select) for avatar-enriched options:
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";

<Select value={assignedFilter} onValueChange={(v) => { setAssignedFilter(v); setPage(1); }}>
  <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
    <SelectValue placeholder="Assigned Person" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Assignees</SelectItem>
    {users.map((u) => (
      <SelectItem key={u.id} value={u.id}>
        <div className="flex items-center gap-2">
          <UserAvatar fullName={u.full_name} size={20} />
          <span>{u.full_name}</span>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Note:** Use size 20 in the dropdown options (smaller than row usage of 28) because the dropdown has less vertical space.

### Pattern 4: View Toggle Position in Toolbar

**What:** Card/list toggle is an icon button group placed at the **right** of the toolbar. For QMRL this is new; for QMHQ/PO/Invoice it moves from the PageHeader `actions` area into the FilterBar itself.

**Decision:** Move the toggle INTO the `FilterBar` as the last child (rightmost), or add a separate row. Based on CONTEXT.md: "Toggle position: right side of toolbar". The FilterBar uses `flex flex-wrap items-center gap-4`. Add `ml-auto` on the toggle wrapper to push it right.

```typescript
// At the end of FilterBar children:
<div className="ml-auto flex items-center border border-slate-700 rounded-lg overflow-hidden">
  <button onClick={() => setViewMode("card")} className={viewMode === "card" ? "p-2 bg-amber-500/20 text-amber-400" : "p-2 bg-slate-800/50 text-slate-400 hover:text-slate-200"}>
    <LayoutGrid className="h-4 w-4" />
  </button>
  <button onClick={() => setViewMode("list")} className={viewMode === "list" ? "p-2 bg-amber-500/20 text-amber-400" : "p-2 bg-slate-800/50 text-slate-400 hover:text-slate-200"}>
    <List className="h-4 w-4" />
  </button>
</div>
```

### Pattern 5: Responsive Filter Collapse

**What:** On mobile/tablet, all filter dropdowns collapse into a "Filters" button. Below `md` breakpoint, hide individual filter selects and show a button that opens a drawer or popover with all filters. The search bar stays visible always.

**Recommended approach:** Use `hidden md:flex` on the filter dropdowns wrapper and show a `Filters` button with badge count of active filters on small screens. This avoids a complex popover/drawer implementation.

```typescript
// Desktop filters (hidden on mobile):
<div className="hidden md:flex items-center gap-2">
  {/* Status, Assigned Person, Category dropdowns */}
</div>
// Mobile filter button (visible only on mobile):
<div className="flex md:hidden">
  <Button variant="outline" size="sm" className="border-slate-700">
    <SlidersHorizontal className="h-4 w-4 mr-2" />
    Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
  </Button>
</div>
```

For this phase, a simple "Filters button shows a popover with all filter selects" implementation is sufficient. The popover is already available in `components/ui/popover.tsx`.

### Pattern 6: Responsive Auto-Switch to Card View

**What:** Below tablet breakpoint, automatically switch to card view (no horizontal scroll).

**Implementation:** Use a `useEffect` + `window.matchMedia` or a `useMediaQuery` hook. Since there is no existing `useMediaQuery` hook in this codebase, the simplest approach is to force `viewMode = "card"` when `window.innerWidth < 768` on mount and on resize. **Do not persist viewMode** (matches the "no persistence" decision).

```typescript
// In each page component:
useEffect(() => {
  const checkBreakpoint = () => {
    if (window.innerWidth < 768) setViewMode("card");
  };
  checkBreakpoint();
  window.addEventListener("resize", checkBreakpoint);
  return () => window.removeEventListener("resize", checkBreakpoint);
}, []);
```

**Recommended breakpoint:** `md` (768px) — standard Tailwind tablet breakpoint. This matches the `hidden md:flex` pattern used for filter collapse.

### Pattern 7: Standard List View Table Shell

**What:** All list views use the same `<table>` HTML structure and CSS classes. The pattern is already established in QMHQ, PO, and Invoice pages. Extract the repeated shell for consistency.

**Current pattern (consistent across QMHQ/PO/Invoice):**
```typescript
<div className="command-panel">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-700">
          <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">COLUMN</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
            onClick={() => router.push(`/entity/${item.id}`)}>
          <td className="py-3 px-4">...</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

**Use `router.push()` for row clicks, not `window.location.href`** — the latter causes full page reloads and loses scroll position. The existing pages use `window.location.href` for historical reasons; the new list views should use `router.push`.

### Anti-Patterns to Avoid

- **`window.location.href` for row navigation:** Causes full reload. Use `router.push()` from `next/navigation` instead.
- **Storing view mode in localStorage or cookies:** Decision says no persistence, always default to card.
- **Fetching ALL users for the assigned filter on every page:** Pages like PO and Invoice don't have `assigned_to` — only fetch users relevant to that page's person field.
- **Horizontal scroll on mobile:** The decision requires auto-switching to card below tablet, not showing a scrollable table.
- **Extending `FilterBar.Select` to support avatar options:** The existing `FilterBarSelectProps` only accepts `{ value, label }` strings. Use the raw Shadcn `Select` directly for the assigned person dropdown.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip on hover | Custom CSS hover states | `Tooltip` from `@/components/ui/tooltip.tsx` (Radix) | Handles keyboard/screen reader, portals, positioning |
| Pagination UI | Custom page number buttons | `Pagination` from `@/components/ui/pagination.tsx` | Already styled, already has first/last/prev/next + page size selector |
| URL search params management | Manual `window.location.search` manipulation | `useSearchParams` + `useRouter` from `next/navigation` | Next.js App Router built-in, handles SSR hydration |
| Avatar generation | CSS initials or custom SVG | `boring-avatars` via `UserAvatar` component | Already in codebase; consistent with all other avatar usages |
| Responsive breakpoints | JS window size listeners everywhere | Tailwind `hidden md:flex` classes | Zero JS, matches the existing Tailwind-first pattern in this codebase |

---

## Common Pitfalls

### Pitfall 1: `useSearchParams` Suspense Boundary Requirement
**What goes wrong:** Adding `useSearchParams()` to a page component without a Suspense boundary causes the entire page to opt out of static rendering and may throw during build.
**Why it happens:** Next.js 14 requires `useSearchParams` to be inside a `<Suspense>` boundary because it reads dynamic values.
**How to avoid:** Since all 6 target pages are `"use client"` with data fetching, they are already dynamic. However, to be safe, the `usePaginationParams` hook should be documented as requiring a `<Suspense>` wrapper at the caller's boundary — or wrap the component export with `<Suspense fallback={<Loading />}>`. In practice, these pages already handle their own loading states so the risk is low.
**Warning signs:** Build errors mentioning "useSearchParams() should be wrapped in a Suspense boundary."

### Pitfall 2: Stale Pagination on Filter Change
**What goes wrong:** User is on page 3, changes status filter, still sees page 3 (which may be empty or wrong).
**Why it happens:** The page number is in state or URL but isn't reset when filters change.
**How to avoid:** Every filter `onChange` handler must also call `setPage(1)`. The `usePaginationParams` hook's `setPageSize` already does this; add the same for filter changes.
**Warning signs:** Empty list view on page > 1 after filtering.

### Pitfall 3: Assigned Person Filter on Tables Without `assigned_to`
**What goes wrong:** PO and Invoice tables have no `assigned_to` column, so filtering by assigned person produces empty results or errors.
**Why it happens:** The data model does not include an assignee concept for PO or Invoice. PAGE-02 says "all list pages can be filtered by assigned person."
**How to avoid:**
- **PO page:** The QMHQ line linked to a PO has `assigned_to`. To support filtering, either: (a) fetch all POs and filter by their joined `qmhq.assigned_to`, or (b) add the `assigned_to` to the PO query via join. Option (a) is the path of least resistance since the PO query already joins QMHQ.
- **Invoice page:** No person field exists. Options: (a) filter by `created_by` (the person who created the invoice), or (b) traverse PO → QMHQ → assigned_to. This is 2 join levels. Use `created_by` for Invoice as the practical interpretation of "assigned person."
- **Items page:** No person association. Skip the assigned person filter on Items, or show it greyed out. The requirement LIST-05 does not mention assigned person columns, only SKU/Name/Category/Unit/Price Ref.
- **Stock-out requests:** Use `requester_id` as the person filter field (requester is the functional "assigned person" for SOR).
**Warning signs:** Empty filter results, TypeScript errors on non-existent fields.

### Pitfall 4: `FilterBar.Select` Cannot Render Avatar JSX in Options
**What goes wrong:** Using `FilterBar.Select` for the assigned person filter renders plain text names, not avatar + name.
**Why it happens:** `FilterBarSelectProps.options` is typed as `{ value: string; label: string }[]` — label is a string, not JSX.
**How to avoid:** Use the raw Shadcn `Select`/`SelectItem` directly for the assigned person dropdown (as shown in Pattern 3 above). Do NOT modify `FilterBar.Select` — it would break other usages.
**Warning signs:** TypeScript error when passing `ReactNode` to the `label` field.

### Pitfall 5: Status Badge Style Divergence
**What goes wrong:** Some pages use colored border + text badges (current QMRL/QMHQ style), but the decision requires colored BACKGROUND + white text.
**Why it happens:** The CONTEXT.md decision says "colored background, white text" for status badges in list view.
**How to avoid:** In list view rows, use inline style with `backgroundColor: status.color` and `color: 'white'` instead of the current border-only style. The existing card view styles can remain unchanged.

```typescript
// List view status badge (new):
<Badge
  className="text-xs"
  style={{ backgroundColor: status.color || "#94a3b8", color: "white", border: "none" }}
>
  {status.name}
</Badge>
```

### Pitfall 6: Items Page is `DataTable` (TanStack), Not the Custom Table Pattern
**What goes wrong:** The Items page uses `DataTable` (TanStack React Table with its own pagination/search). Adding card/list toggle requires bypassing the DataTable for the card view.
**Why it happens:** Items was built earlier with a different pattern than QMHQ/PO/Invoice.
**How to avoid:** For Items, the list view can still use the DataTable (it handles search/sort internally), but wrap it with the new standardized toolbar. Add a `viewMode` state; show DataTable in list mode and a custom card grid in card mode. Extract the item fetch out of DataTable so both views share data.

---

## Code Examples

### URL-driven pagination reading (standard pattern)
```typescript
// In any list page — replaces useState for currentPage/pageSize:
const { page: currentPage, pageSize, setPage: setCurrentPage, setPageSize } = usePaginationParams(20);

// Reset page when filters change (replaces the existing useEffect pattern):
const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
  setter(value);
  setCurrentPage(1); // Resets URL ?page=1
};
```

### Pagination component wiring (unchanged interface)
```typescript
// The Pagination component interface is already correct:
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={totalItems}
  pageSize={pageSize}
  onPageChange={setCurrentPage}    // This now pushes ?page=N to URL
  onPageSizeChange={setPageSize}   // This now pushes ?pageSize=N&page=1 to URL
/>
```

### QMRL list view row (new — doesn't exist yet)
```typescript
// List view row for QMRL:
<tr
  className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
  onClick={() => router.push(`/qmrl/${qmrl.id}`)}
>
  <td className="py-3 px-4 w-36">
    <code className="text-amber-400 text-sm">{qmrl.request_id}</code>
  </td>
  <td className="py-3 px-4">
    <span className="text-slate-200 font-medium truncate block max-w-xs">{qmrl.title}</span>
  </td>
  <td className="py-3 px-4 w-36">
    {qmrl.status ? (
      <Badge
        className="text-xs text-white"
        style={{ backgroundColor: qmrl.status.color || "#94a3b8", border: "none" }}
      >
        {qmrl.status.name}
      </Badge>
    ) : <span className="text-slate-500">—</span>}
  </td>
  <td className="py-3 px-4 w-12">
    {qmrl.assigned_user ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">
              <UserAvatar fullName={qmrl.assigned_user.full_name} size={28} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{qmrl.assigned_user.full_name}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : <span className="text-slate-500">—</span>}
  </td>
  <td className="py-3 px-4 w-28">
    <span className="text-slate-400 text-sm">{formatDate(qmrl.request_date)}</span>
  </td>
</tr>
```

---

## State of the Art

| Old Approach (current codebase) | New Approach (this phase) | Impact |
|---------------------------------|---------------------------|--------|
| Pagination state in `useState` | URL-driven via `useSearchParams` | Back button works, pages are bookmarkable |
| Card view toggle in `PageHeader.actions` | Toggle in `FilterBar` (rightmost) | Consistent toolbar layout across all pages |
| QMRL has no list view at all | QMRL gets card/list toggle and list view | Full consistency across all 6 pages |
| Assigned filter missing from QMHQ/PO/Invoice/Items/SOR | Added to all pages | PAGE-02 requirement fulfilled |
| Assigned person in card rows: avatar + first name | Assigned person in list rows: avatar only + tooltip | Compact, consistent with AVTR-03 |
| Status badges: colored border + text | Status badges in list view: colored background + white text | CONTEXT.md decision |
| Items page: DataTable (TanStack) with internal pagination | Items page: custom toolbar + card/list toggle | Consistent with other pages |
| `window.location.href` for row navigation | `router.push()` | No full page reload |
| Filter collapse: no mobile handling | Filters collapse to button below `md` breakpoint | Mobile-responsive |

---

## Page-by-Page Gap Analysis

### QMRL (`/qmrl`)
- **Has:** Card view, Pagination, assigned filter, category filter, search, `UserAvatar` in cards
- **Needs:** Card/list toggle, list view table (LIST-01), URL pagination, move toggle into FilterBar, status badge style change in list view
- **Data already fetched:** `assigned_user`, `status`, `request_date` — no new query changes needed

### QMHQ (`/qmhq`)
- **Has:** Card/list toggle (in PageHeader), list view table, pagination, route filter, status filter
- **Needs:** Assigned person filter (users query), URL pagination, move toggle into FilterBar, add avatar to list view assigned column, filter page reset for new assigned filter
- **Data gap:** Currently fetches `assigned_user` in query but has no assigned filter UI or column in list view

### PO (`/po`)
- **Has:** Card/list toggle, list view table, pagination, status filter, supplier filter
- **Needs:** Assigned person filter (via QMHQ.assigned_to join — already partially joined), URL pagination, move toggle into FilterBar
- **Data gap:** PO has no `assigned_to`; must filter through `qmhq.assigned_to`. The PO query already joins QMHQ. Add `assigned_user:users!qmhq_assigned_to_fkey(id, full_name)` to the QMHQ join.
- **No avatar column needed in LIST-03** — LIST-03 columns don't include Assigned Person

### Invoice (`/invoice`)
- **Has:** Card/list toggle, list view table, pagination, status filter, show-voided toggle
- **Needs:** Assigned person filter (use `created_by` — fetch users for the dropdown), URL pagination, move toggle into FilterBar
- **Data gap:** No `assigned_to`; use `created_by` as the filter field. Add `creator:users!invoices_created_by_fkey(id, full_name)` to invoice query.
- **No avatar column needed in LIST-04** — LIST-04 columns don't include Assigned Person

### Items (`/item`)
- **Has:** DataTable with internal search/pagination, no card view, no standard toolbar
- **Needs:** Card view grid, card/list toggle, standard FilterBar toolbar, URL pagination for list mode, assigned person filter — BUT items have no person field
- **Recommendation:** Add the FilterBar with search + category filter (relevant filters) + toggle. Skip the assigned person filter for Items since no person field exists. LIST-05 does not specify an Assigned Person column.
- **Items card view:** Show photo, SKU, name, category badge, unit — existing card components in admin may provide a reference

### Stock-out Requests (`/inventory/stock-out-requests`)
- **Has:** Card view (Kanban-style), list view table, search, status tabs (not FilterBar), view toggle (separate from FilterBar)
- **Needs:** Standardized FilterBar (replace status tabs + separate search/toggle with unified toolbar), assigned person filter (using `requester_id`), URL pagination (currently no pagination at all — fetches everything), Pagination component
- **Data already fetched:** `requester.full_name` — can use for filter. Add `users` query for the dropdown.
- **LIST-06 columns:** SOR ID, Item (first line item name or item count), Requester, Reason, QMHQ Ref, Status. The "Item" column challenge: each SOR has multiple `line_items`. Show item count (`N items`) or first item name. Existing list view shows "N item(s)" — keep this pattern.

---

## Open Questions

1. **Assigned person filter on PO: which user?**
   - What we know: PO has no `assigned_to`; PO links to QMHQ which has `assigned_to`
   - What's unclear: Does the user expect to filter POs by the QMHQ assigned user? Or by PO creator?
   - Recommendation: Filter by `qmhq.assigned_to` (one join). This is the most meaningful assignment in the PO workflow.

2. **Assigned person filter on Items: meaningful or skip?**
   - What we know: Items have no person association
   - What's unclear: Should the filter be hidden on the Items page, or shown as disabled?
   - Recommendation: Skip the filter on Items (LIST-05 doesn't require an Assigned Person column anyway). Show only search + category filter + toggle.

3. **Items card view: what does a card look like?**
   - What we know: Items currently use a DataTable, no card design exists for items
   - What's unclear: The card layout for an item (photo thumbnail, SKU, name, category, unit)
   - Recommendation: Simple card with photo, SKU badge, name, category colored badge. Similar to the existing table row structure but vertical.

4. **Status badge color for list view — only list view or card view too?**
   - What we know: CONTEXT.md says "colored background, white text" for status display in list view
   - What's unclear: Whether card view badges should also change
   - Recommendation: Apply colored-background style to list view rows only. Leave existing card badge styles unchanged.

5. **Default page size: 20 (matches QMRL) or 10?**
   - Recommendation: 20 — matches the existing QMRL default and shows enough rows to be useful. The paginator offers 10/20/50/100 options.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `components/ui/pagination.tsx` — complete component, interface verified
- Direct codebase inspection: `components/ui/user-avatar.tsx` — props interface, default size 28, boring-avatars Beam
- Direct codebase inspection: `components/composite/filter-bar.tsx` — props interface, child components
- Direct codebase inspection: `components/composite/card-view-grid.tsx` — generic interface
- Direct codebase inspection: `components/ui/tooltip.tsx` — Radix TooltipPrimitive wrapper
- Direct codebase inspection: `types/database.ts` — confirmed `assigned_to` presence in `qmrl`/`qmhq`, absence in `purchase_orders`/`invoices`/`items`
- Direct codebase inspection: all 6 list pages — current state, gaps, data fetched

### Secondary (MEDIUM confidence)
- Next.js 14 App Router docs pattern for `useSearchParams` + Suspense boundary requirement (from training knowledge, Jan 2025 cutoff)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components verified by direct file inspection
- Architecture patterns: HIGH — derived from existing page patterns in codebase
- Pitfalls: HIGH — derived from direct inspection of data model and component interfaces
- Page-by-page gaps: HIGH — derived from reading all 6 page files

**Research date:** 2026-02-17
**Valid until:** Stable (no external dependencies; all research is of the local codebase)
