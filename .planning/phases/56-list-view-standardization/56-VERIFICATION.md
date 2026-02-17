---
phase: 56-list-view-standardization
verified: 2026-02-17T13:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: false
human_verification:
  - test: "Open /qmrl, click list toggle, narrow browser below 768px"
    expected: "View auto-switches to card; filter dropdowns collapse to Filters button"
    why_human: "Responsive breakpoint behavior requires a real browser to confirm"
  - test: "On /qmrl list view, hover over assigned person avatar"
    expected: "Tooltip shows full name"
    why_human: "Tooltip interaction requires browser"
  - test: "On /qmrl, change Assignee filter then check URL"
    expected: "?page=1 resets; results narrow to selected assignee"
    why_human: "Filter-reset behavior and actual data filtering requires browser + DB"
  - test: "On /po list view, verify Progress is visible in the Status column cell"
    expected: "POProgressBar renders as a small bar beneath the status badge"
    why_human: "Progress is embedded in Status cell, not a separate column; visual confirmation needed"
  - test: "On /invoice list view, verify Received % mini progress bar is visible"
    expected: "MiniProgressBar renders beneath InvoiceStatusBadge in Status cell for invoices with line items"
    why_human: "Embedded progress bar requires browser + real invoice data"
  - test: "On /item, click list toggle to see list view, then click card toggle"
    expected: "Card view shows photo/SKU/name/category grid; list view shows Photo, SKU, Name, Category, Unit, Price Ref columns"
    why_human: "Card/list content and layout requires visual inspection"
  - test: "On /inventory/stock-out-requests, use Requester filter dropdown"
    expected: "Avatar + name options appear; selecting one narrows results; URL page resets to 1"
    why_human: "Filter effectiveness requires browser + real SOR data"
---

# Phase 56: List View Standardization Verification Report

**Phase Goal:** Every major list page has a consistent list view with defined columns, working pagination, and an assigned person filter.
**Verified:** 2026-02-17T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | QMRL page has card/list toggle defaulting to card view | VERIFIED | `useState<"card" | "list">("card")` at line 81; `LayoutGrid` + `List` icons in `ml-auto` div inside FilterBar |
| 2 | QMRL list view shows columns: ID, Title, Status, Assigned (avatar+tooltip), Date | VERIFIED | `<th>` headers at lines 572–586 in qmrl/page.tsx; UserAvatar in assigned column at line 642 |
| 3 | Pagination is URL-driven on all 6 pages; back button navigates page history | VERIFIED | `usePaginationParams` imported and called in all 6 pages; uses `router.push` with `{ scroll: false }` |
| 4 | Changing any filter resets URL page param to 1 on all 6 pages | VERIFIED | `setCurrentPage(1)` calls found in filter handlers: QMRL=3, QMHQ=4, PO=4, Invoice=4, Items=2, SOR=3 |
| 5 | User avatar appears next to assigned person in list view rows (AVTR-03) | VERIFIED | `UserAvatar` with `Tooltip` in QMRL assigned column (line 642) and QMHQ assigned column (line 711) |
| 6 | All 6 pages respond to < 768px by auto-switching to card view | VERIFIED | `window.innerWidth < 768` useEffect present in all 6 pages |
| 7 | Filters collapse to a Filters button on narrow screens | VERIFIED | `hidden md:flex` wrapper + `flex md:hidden` Popover pattern in all 6 pages |
| 8 | QMHQ list view shows: ID, Name, Route, Status, Assigned (avatar), QMRL Ref | VERIFIED | Columns at lines 632–638 in qmhq/page.tsx; UserAvatar+Tooltip at lines 707–723 |
| 9 | PO list view shows: PO ID, Supplier, Status (with POProgressBar), Amount/EUSD, Date | VERIFIED | Columns at lines 546–563 in po/page.tsx; `POProgressBar` embedded in Status cell at lines 630–637 |
| 10 | Invoice list view shows: INV ID, Supplier Ref, PO#, Supplier, Amount/EUSD, Status (with MiniProgressBar), Date | VERIFIED | Columns at lines 573–592 in invoice/page.tsx; `MiniProgressBar` computed received % in Status cell at lines 655–661 |
| 11 | Items list view shows: Photo, SKU, Name, Category, Unit, Price Ref | VERIFIED | Columns at lines 497–515 in item/page.tsx; satisfies LIST-05 (Photo is additional) |
| 12 | Stock-out requests list view shows: SOR ID, Item, Requester, Reason, QMHQ Ref, Status | VERIFIED | Exact column match at lines 487–503 in stock-out-requests/page.tsx |
| 13 | All applicable pages have assigned person filter (QMRL, QMHQ, PO, Invoice, SOR) | VERIFIED | `assignedFilter`/`requesterFilter` state + users fetch + filter logic on all 5 applicable pages; Items intentionally excluded (no person field) |
| 14 | All row clicks use router.push (no window.location.href) | VERIFIED | Zero `window.location.href` occurrences across all 6 pages |

**Score:** 14/14 truths verified (automated checks)

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `lib/hooks/use-pagination-params.ts` | — | 45 | VERIFIED | Reads ?page/?pageSize, pushes URL updates via router.push |
| `lib/hooks/index.ts` | — | 13 | VERIFIED | Exports `usePaginationParams` at line 13 |
| `app/(dashboard)/qmrl/page.tsx` | 300 | 688 | VERIFIED | Full rewrite with list/card toggle, URL pagination, filters |
| `app/(dashboard)/qmhq/page.tsx` | 350 | 750 | VERIFIED | Assigned filter, avatar column, URL pagination, toolbar toggle |
| `app/(dashboard)/po/page.tsx` | 350 | 669 | VERIFIED | Assigned filter via QMHQ join, URL pagination, toolbar toggle |
| `app/(dashboard)/invoice/page.tsx` | 350 | 693 | VERIFIED | Creator filter, URL pagination, toolbar toggle |
| `app/(dashboard)/item/page.tsx` | 200 | 662 | VERIFIED | Rebuilt from DataTable: card/list toggle, FilterBar, URL pagination |
| `app/(dashboard)/inventory/stock-out-requests/page.tsx` | 300 | 590 | VERIFIED | FilterBar replaces status tabs, URL pagination, requester filter |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `qmrl/page.tsx` | `use-pagination-params.ts` | `usePaginationParams(20)` | WIRED | 2 occurrences (import + call) |
| `qmrl/page.tsx` | `components/ui/user-avatar.tsx` | `UserAvatar` in assigned column + filter dropdown | WIRED | 4 occurrences |
| `qmrl/page.tsx` | `components/ui/pagination.tsx` | `<Pagination>` at bottom | WIRED | 1 occurrence |
| `qmhq/page.tsx` | `use-pagination-params.ts` | `usePaginationParams(20)` | WIRED | 2 occurrences |
| `qmhq/page.tsx` | `components/ui/user-avatar.tsx` | `UserAvatar` in assigned column + filter dropdown | WIRED | 3 occurrences |
| `po/page.tsx` | `use-pagination-params.ts` | `usePaginationParams(20)` | WIRED | 2 occurrences |
| `po/page.tsx` | `components/ui/user-avatar.tsx` | `UserAvatar` in filter dropdown | WIRED | 2 occurrences |
| `invoice/page.tsx` | `use-pagination-params.ts` | `usePaginationParams(20)` | WIRED | 2 occurrences |
| `invoice/page.tsx` | `components/ui/user-avatar.tsx` | `UserAvatar` in creator filter dropdown | WIRED | 2 occurrences |
| `item/page.tsx` | `use-pagination-params.ts` | `usePaginationParams(20)` | WIRED | 2 occurrences |
| `stock-out-requests/page.tsx` | `use-pagination-params.ts` | `usePaginationParams(20)` | WIRED | 2 occurrences |
| `stock-out-requests/page.tsx` | `components/ui/user-avatar.tsx` | `UserAvatar` in requester filter dropdown | WIRED | 2 occurrences |
| `stock-out-requests/page.tsx` | `components/ui/pagination.tsx` | `<Pagination>` at bottom | WIRED | 1 occurrence |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| LIST-01 | 56-01 | QMRL page list view with columns: ID, Title, Status, Assigned Person, Request Date | SATISFIED | Columns at qmrl/page.tsx lines 572–586; all 5 columns present |
| LIST-02 | 56-02 | QMHQ list view: ID, Name, Route, Status, Assigned Person, QMRL Ref | SATISFIED | Columns at qmhq/page.tsx lines 632–638; all 6 columns present |
| LIST-03 | 56-02 | PO list view: PO ID, Supplier, Status, Total Amount/EUSD, Progress, Date | SATISFIED | PO# + Supplier + Amount(EUSD) + Status(with POProgressBar) + Date at lines 546–563; Progress embedded in Status cell |
| LIST-04 | 56-02 | Invoice list view: INV ID, Status, Amount/EUSD, Received %, Date, PO Ref | SATISFIED | Invoice# + PO# + Amount(EUSD) + Status(with MiniProgressBar) + Date at lines 573–592; Received% embedded in Status cell |
| LIST-05 | 56-02 | Items list view: SKU, Name, Category, Unit, Price Ref | SATISFIED | Photo + SKU + Name + Category + Unit + Price Ref at item/page.tsx lines 497–515 |
| LIST-06 | 56-03 | Stock-out execution list view: SOR ID, Item, Requester, Reason, QMHQ Ref, Status | SATISFIED | Exact column match at stock-out-requests/page.tsx lines 487–503 |
| AVTR-03 | 56-01 | User avatar next to assigned person in list view rows | SATISFIED | UserAvatar+Tooltip at qmrl/page.tsx line 642 and qmhq/page.tsx line 711 |
| PAGE-01 | 56-01 | All list/card view pages use same Pagination component | SATISFIED | `<Pagination` present in all 6 pages (count=1 each) |
| PAGE-02 | 56-02, 56-03 | All list pages can be filtered by assigned person | SATISFIED | assignedFilter on QMRL/QMHQ/PO/Invoice; requesterFilter on SOR; Items excluded (no person field per data model) |
| PAGE-03 | 56-01 | Page resets to page 1 when filters change | SATISFIED | `setCurrentPage(1)` in every filter handler on all 6 pages |

### Anti-Patterns Found

No blockers or significant anti-patterns found.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| All 6 pages | `placeholder=` on SelectValue | Info | Legitimate JSX attribute, not a stub |
| qmhq/page.tsx L270 | `return null` | Info | Guard for missing route config — intentional |

### Human Verification Required

#### 1. Responsive Auto-Switch

**Test:** Open `/qmrl`, switch to list view, then narrow the browser window below 768px.
**Expected:** View automatically switches back to card (Kanban) view. Filter dropdowns disappear and a "Filters" button appears.
**Why human:** `window.innerWidth` resize handler behavior requires a real browser.

#### 2. Assigned Person Tooltip

**Test:** On `/qmrl` in list view, hover over the avatar in the Assigned column.
**Expected:** Tooltip showing the assigned person's full name appears.
**Why human:** CSS/JS tooltip interaction requires browser.

#### 3. Filter Resets Page to 1

**Test:** On `/qmrl`, navigate to page 2 (if data allows), then change the Assignee filter.
**Expected:** URL changes to `?page=1` and results narrow to the selected assignee.
**Why human:** Requires real data and browser URL inspection.

#### 4. PO Progress Embedded in Status

**Test:** Open `/po`, switch to list view, find a PO with line items.
**Expected:** POProgressBar renders as a small dual-track bar beneath the status badge in the Status column cell.
**Why human:** Progress bar visibility depends on PO having `line_items_aggregate.total_quantity > 0`.

#### 5. Invoice Received % Embedded in Status

**Test:** Open `/invoice`, switch to list view, find an invoice with line items that have received quantities.
**Expected:** MiniProgressBar renders beneath the status badge in the Status column cell showing received percentage.
**Why human:** Requires real invoice data with `line_items_aggregate.total_quantity > 0`.

#### 6. Items Card/List Toggle

**Test:** Open `/item`, confirm default is card view grid, switch to list view.
**Expected:** Card view shows photo thumbnail, SKU badge, name, category badge, unit, price in a grid. List view shows Photo, SKU, Name, Category, Unit, Price Ref columns with edit/delete dropdown.
**Why human:** Visual layout and card content requires browser.

#### 7. SOR Requester Filter

**Test:** Open `/inventory/stock-out-requests`, use the Requester dropdown.
**Expected:** Avatar+name options appear; selecting one narrows the list; URL shows `?page=1`.
**Why human:** Requires real SOR data and browser.

### Notes on Column Implementation

**LIST-03 (PO) and LIST-04 (Invoice):** Both require a "Progress" / "Received %" column. In the actual implementation, these are embedded as progress bars within the Status cell (not as standalone column headers). This satisfies the data requirement — the information IS present in the list view — but the column header count differs from the spec. The PLAN explicitly noted "Current columns already satisfy LIST-03 ... No column changes needed." This is an accepted design decision.

**Items page assigned filter:** The PLAN explicitly decided not to add an assigned person filter to Items because items have no person association in the data model. PAGE-02 is satisfied on all applicable pages; Items is the documented exception.

### Commits Verified

| Commit | Description | Status |
|--------|-------------|--------|
| `de05d55` | feat(56-01): create usePaginationParams hook | EXISTS |
| `42cfd86` | feat(56-01): add list view, card/list toggle, URL pagination to QMRL | EXISTS |
| `bf02754` | feat(56-02): standardize QMHQ and PO pages | EXISTS |
| `988b940` | feat(56-02): standardize Invoice and Items pages | EXISTS |
| `990f862` | feat(56-03): standardize stock-out requests list page | EXISTS |

---

_Verified: 2026-02-17T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
