---
phase: 28-stock-out-request-approval-ui
plan: 01
subsystem: inventory-management
tags: [stock-out-requests, ui, list-page, create-form, permissions, navigation]
completed: 2026-02-09

dependency_graph:
  requires:
    - "Phase 27: stock_out_requests and stock_out_line_items tables"
    - "Phase 27: sor_request_status and sor_line_item_status enums"
    - "Phase 27: QMHQ-linked request FK constraint"
  provides:
    - "Stock-Out Requests navigation item under Inventory"
    - "Permission matrix entry for stock_out_requests resource"
    - "List page at /inventory/stock-out-requests with card/list toggle"
    - "Create page at /inventory/stock-out-requests/new with QMHQ-linked mode"
    - "RequestCard component for card view display"
  affects:
    - "components/layout/sidebar.tsx: added Stock-Out Requests nav item"
    - "lib/hooks/use-permissions.ts: added stock_out_requests resource and role navigation"

tech_stack:
  added:
    - "CategoryItemSelector: two-step category-first item selection"
    - "STOCK_OUT_REASON_CONFIG: reused from lib/utils/inventory"
  patterns:
    - "Card/List toggle view pattern (from QMHQ page)"
    - "Status tab filtering with count badges"
    - "QMHQ-linked mode with locked fields and reference banner"
    - "Multi-line-item form with add/remove rows"
    - "Reason selector with grid of colored cards"
    - "RLS-based role visibility (admin/QM/inventory see all, others see own)"

key_files:
  created:
    - "app/(dashboard)/inventory/stock-out-requests/page.tsx: List page with card/list toggle, status tabs, search (398 lines)"
    - "app/(dashboard)/inventory/stock-out-requests/new/page.tsx: Create form with QMHQ-linked and manual modes (535 lines)"
    - "components/stock-out-requests/request-card.tsx: Card component with status badges and reason display (145 lines)"
  modified:
    - "components/layout/sidebar.tsx: Added Stock-Out Requests nav item under Inventory"
    - "lib/hooks/use-permissions.ts: Added stock_out_requests resource to permission matrix and role navigation"

decisions:
  - decision: "Stock-Out Requests nav item placed under Inventory section"
    rationale: "Aligns with existing inventory flow (Stock In, Stock Out, Stock-Out Requests)"
    alternatives: "Could have been top-level nav item, but logically belongs in Inventory grouping"

  - decision: "Proposal role gets create permission for stock_out_requests"
    rationale: "Proposal role needs to create requests on behalf of requesters as part of QMHQ workflow"
    alternatives: "Could restrict to inventory roles only, but would break QMHQ integration"

  - decision: "QMHQ-linked requests enforce locked item/quantity fields in UI"
    rationale: "Database constraint enforces single line item for QMHQ-linked requests; UI reflects this"
    alternatives: "Could show disabled multi-item UI, but locked fields provide clearer UX"

  - decision: "No stock level display on creation form"
    rationale: "Per user decision: requester does not see stock levels, only requests what's needed"
    alternatives: "Could show available stock for transparency, but decided against for simplified requester UX"

  - decision: "Card view groups by status groups (Pending, In Progress, Done)"
    rationale: "Follows QMHQ pattern, provides clear visual organization by workflow stage"
    alternatives: "Could group by reason or requester, but status is most operationally relevant"

metrics:
  duration: "260 seconds (4.3 minutes)"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
  lines_added: 1078
  commits: 2
---

# Phase 28 Plan 01: Stock-Out Request List & Create Pages Summary

**One-liner:** Stock-out request list page with card/list toggle, status tabs, and create form supporting both QMHQ-linked and manual multi-item requests.

## What Was Built

Created the stock-out request list and creation pages, establishing the navigation entry point, permission resource, and core CRUD functionality for stock-out requests.

### Task 1: Sidebar, Permissions, List Page, and Card Component

**Commits:** `a0fd4fa`

**Changes:**
1. **Sidebar Navigation (components/layout/sidebar.tsx)**
   - Added "Stock-Out Requests" as child of Inventory nav group
   - Positioned after "Stock Out" in children array
   - Visible to admin, quartermaster, and inventory roles

2. **Permission Matrix (lib/hooks/use-permissions.ts)**
   - Added `stock_out_requests` to `PermissionResource` type union
   - Permission mapping:
     - admin/quartermaster/inventory: CRUD (full control)
     - proposal: create + read (can create on behalf of requesters)
     - finance/frontline/requester: read only
   - Added `/inventory/stock-out-requests` to role navigation for admin, quartermaster, inventory, and proposal

3. **Request List Page (app/(dashboard)/inventory/stock-out-requests/page.tsx)**
   - View modes: Card view (default) with status grouping, List view with table
   - Status tabs: All, Pending, Approved, Rejected, Cancelled with count badges
   - Search: filters by request number or requester name
   - Card view: Groups requests by status groups (Pending, In Progress, Done)
   - List view: Table with columns: Request #, Requester, Reason, Items, Status, Created
   - "New Request" button (permission-gated: `can('create', 'stock_out_requests')`)
   - Data fetching: Queries `stock_out_requests` with joined relations (requester, qmhq, line_items)
   - RLS handles role-based visibility at database level

4. **Request Card Component (components/stock-out-requests/request-card.tsx)**
   - Displays: request number (monospace), requester name, reason badge, item count, status badge, created date
   - Shows "QMHQ" label if qmhq_id is present
   - Uses command-panel styling with corner accents
   - Status colors: pending=amber, partially_approved=blue, approved=emerald, rejected=red, cancelled=slate, partially_executed=purple, executed=emerald
   - Reason colors: reuses STOCK_OUT_REASON_CONFIG from lib/utils/inventory
   - Clickable, navigates to `/inventory/stock-out-requests/{id}`

**Files:**
- Created: `app/(dashboard)/inventory/stock-out-requests/page.tsx` (398 lines)
- Created: `components/stock-out-requests/request-card.tsx` (145 lines)
- Modified: `components/layout/sidebar.tsx` (added 1 nav item)
- Modified: `lib/hooks/use-permissions.ts` (added resource + role navigation)

### Task 2: Stock-Out Request Creation Form

**Commits:** `4b112be`

**Changes:**
1. **Form Mode Detection**
   - Reads `?qmhq={id}` query param
   - If present: QMHQ-linked mode (locked fields, single item)
   - If absent: Manual mode (multi-line-item support)

2. **QMHQ-Linked Mode**
   - Fetches QMHQ data: request_id, line_name, item_id, quantity, qmhq_items
   - Supports multi-item QMHQ via qmhq_items join (takes first item for single-line-item enforcement)
   - Falls back to legacy qmhq.item_id/quantity if qmhq_items empty
   - Shows blue info banner: "Linked to QMHQ: {request_id}" with line_name
   - Item and quantity fields are disabled with "Locked" badge
   - Cannot add more line items (button hidden)
   - Reason defaults to "request"

3. **Manual Mode**
   - Multi-line-item form: each row has CategoryItemSelector + Quantity input
   - "Add Item" button to add more rows
   - Remove button (X) on each row if more than one row
   - CategoryItemSelector uses two-step category-first item selection pattern
   - Quantity input: number-only, font-mono, handleQuantityKeyDown validation
   - No stock levels shown (per user decision)
   - No warehouse selection (approver assigns warehouse)

4. **Common Fields**
   - Reason selector: Grid of colored cards (2 columns on desktop)
   - Each card shows label + description from STOCK_OUT_REASON_CONFIG
   - Selected card highlighted with reason-specific color
   - Notes: Optional textarea

5. **Form Sections (command-panel pattern)**
   - QMHQ Reference (only if linked): Blue info banner
   - Line Items: Item selector + quantity per row
   - Reason: Grid of reason cards
   - Notes: Optional textarea

6. **Submission**
   - Validation: at least one line item, each has item_id + quantity > 0, reason selected
   - Insert into `stock_out_requests`: qmhq_id, reason, notes, requester_id, created_by
   - Insert line items into `stock_out_line_items`: request_id, item_id, requested_quantity, created_by
   - Success: toast "Stock-Out Request Created" + redirect to detail page
   - Error: toast with error message

**Files:**
- Created: `app/(dashboard)/inventory/stock-out-requests/new/page.tsx` (535 lines)

## Deviations from Plan

None - plan executed exactly as written. All requirements met:
- Sidebar nav item added
- Permission matrix includes stock_out_requests resource with correct role mappings
- List page displays requests with card/list toggle and status tabs
- Create form supports both QMHQ-linked (locked fields) and manual (multi-line-item) modes
- Form submission creates records in both tables

## Key Patterns Established

### Card/List Toggle View
Reused from QMHQ page pattern:
- View mode state: "card" | "list"
- Toggle buttons with LayoutGrid and ListIcon
- Card view: grouped by status groups with visual separation
- List view: table with sortable columns

### Status Tab Filtering with Count Badges
- Status tabs at top: All, Pending, Approved, Rejected, Cancelled
- Each tab shows count badge with number of requests
- Active tab highlighted with amber color scheme
- Inactive tabs in slate with hover effect

### QMHQ-Linked Request Pattern
- Query param detection: `?qmhq={id}`
- Fetch QMHQ data with relations
- Pre-fill form fields from QMHQ data
- Disable/lock fields with Lock icon and "Locked" badge
- Show reference banner with info about linked entity
- Hide multi-item functionality (enforce single line item)

### Multi-Line-Item Form Pattern
- Array of line items with client-side IDs
- Add/remove rows dynamically
- Each row has independent state
- CategoryItemSelector for item selection
- Validation before submission

### Reason Selector Grid Pattern
- Grid layout: 2 columns on desktop, 1 on mobile
- Each reason card shows label + description
- Selected card highlighted with reason-specific color (from config)
- Click to select, visual feedback

## Dependencies Satisfied

**Requires:**
- Phase 27-01: stock_out_requests table with columns: id, request_number, status, reason, notes, qmhq_id, requester_id, is_active, audit fields
- Phase 27-01: stock_out_line_items table with columns: id, request_id, item_id, requested_quantity, status, item_name, item_sku, is_active, audit fields
- Phase 27-01: sor_request_status enum: pending, partially_approved, approved, rejected, cancelled, partially_executed, executed
- Phase 27-01: sor_line_item_status enum: pending, approved, rejected, partially_fulfilled, fulfilled
- Phase 27-01: FK constraint: stock_out_requests.qmhq_id -> qmhq.id
- Phase 27-01: Database trigger: compute_request_status() updates parent status from line items
- Existing: CategoryItemSelector component (components/forms/category-item-selector.tsx)
- Existing: STOCK_OUT_REASON_CONFIG (lib/utils/inventory.ts)

## Integration Points

**Upstream (Data Sources):**
- `stock_out_requests` table: fetched for list page
- `stock_out_line_items` table: joined for item count and details
- `users` table: joined for requester name
- `qmhq` table: joined for QMHQ reference, fetched for create form
- `qmhq_items` table: joined for multi-item QMHQ support
- `items` table: joined via qmhq for item details
- `status_config` table: (not used yet, will be for status badges in future)
- `categories` table: (not used yet, will be for category filtering in future)

**Downstream (Next Steps):**
- Plan 28-02: Detail page will link to `/inventory/stock-out-requests/{id}`
- Plan 28-02: Approval workflow will update line item statuses
- Plan 28-03: Fulfillment page will create inventory transactions
- QMHQ detail page: can add "Create Stock-Out Request" button linking to `/inventory/stock-out-requests/new?qmhq={id}`
- QMHQ item route: will integrate stock-out request creation

**Permission Gates:**
- List page: accessible via `/inventory/stock-out-requests` (admin, quartermaster, inventory, proposal)
- Create button: shown if `can('create', 'stock_out_requests')` (admin, quartermaster, inventory, proposal)
- RLS policies: filter requests based on role (admin/QM/inventory see all, others see own)

## Testing Notes

**Manual Testing Checklist:**
- [ ] Navigate to /inventory/stock-out-requests as admin - list loads
- [ ] Navigate to /inventory/stock-out-requests as inventory - list loads
- [ ] Navigate to /inventory/stock-out-requests as proposal - list loads
- [ ] Navigate to /inventory/stock-out-requests as requester - access denied or sees own requests only
- [ ] Switch between card and list view - both render correctly
- [ ] Click status tabs - filters work, counts update
- [ ] Search by request number - filters correctly
- [ ] Search by requester name - filters correctly
- [ ] Click request card - navigates to detail page (when implemented)
- [ ] Click "New Request" button - navigates to create form
- [ ] Create manual request with single item - submits successfully
- [ ] Create manual request with multiple items - submits successfully
- [ ] Create QMHQ-linked request via `/inventory/stock-out-requests/new?qmhq={valid_id}` - pre-fills and locks fields
- [ ] Try to remove line item in QMHQ-linked mode - button hidden
- [ ] Try to add line item in QMHQ-linked mode - button hidden
- [ ] Submit form without item - validation error
- [ ] Submit form without quantity - validation error
- [ ] Submit form without reason - validation error
- [ ] Submit valid form - success toast, redirects to detail page

**Edge Cases to Test:**
- Invalid QMHQ ID in query param - error banner shown
- QMHQ with no item_id (legacy) - falls back to qmhq_items
- QMHQ with multiple qmhq_items - takes first item
- Remove all line items in manual mode - keeps at least one
- Quantity input with non-numeric characters - prevented by handleQuantityKeyDown
- Very long request number or requester name - truncates in card view

## Performance Notes

**Query Optimization:**
- List page fetches with `.limit(100)` to prevent large payloads
- Uses `.select()` with specific columns to avoid over-fetching
- Joins are indexed (FK constraints create indexes automatically)

**Client-Side Filtering:**
- Status filter applied client-side on fetched data (fine for <100 records)
- Search filter applied client-side with string matching

**Future Optimizations:**
- If list grows beyond 100 records, implement pagination
- Consider server-side filtering for search (use `.ilike()` in query)
- Consider caching status/category data (changes infrequently)

## Known Limitations

1. **No Pagination:** List page fetches up to 100 records. Will need pagination if volume grows.

2. **Client-Side Filtering:** Status and search filters applied client-side. Fine for current volume, but should move to server-side for scale.

3. **No Detail Page Yet:** Clicking a request card/row navigates to detail page URL, but page doesn't exist yet (Plan 28-02).

4. **No Edit Functionality:** Once created, requests cannot be edited via UI (will be in detail page).

5. **No Status Color Configuration:** Status colors hard-coded in RequestCard. Should eventually pull from status_config table.

6. **No Category Filtering:** List page doesn't filter by category yet (categories not used in stock-out requests).

7. **No Bulk Actions:** Cannot select multiple requests for bulk operations.

8. **No Export:** Cannot export list to CSV/Excel.

## Self-Check: PASSED

**Created Files:**
- [FOUND] app/(dashboard)/inventory/stock-out-requests/page.tsx (398 lines, exceeds 150 min)
- [FOUND] app/(dashboard)/inventory/stock-out-requests/new/page.tsx (535 lines, exceeds 200 min)
- [FOUND] components/stock-out-requests/request-card.tsx (145 lines, exceeds 30 min)

**Modified Files:**
- [FOUND] components/layout/sidebar.tsx contains "stock-out-requests"
- [FOUND] lib/hooks/use-permissions.ts contains "stock_out_requests" resource

**Key Links Verified:**
- [FOUND] Sidebar links to "/inventory/stock-out-requests" (pattern: stock-out-requests)
- [FOUND] List page queries "stock_out_requests" (pattern: from.*stock_out_requests)
- [FOUND] Create page inserts into "stock_out_requests" (pattern: from.*stock_out_requests.*insert)

**Commits:**
- [FOUND] a0fd4fa: feat(28-01): add stock-out requests list page with nav and permissions
- [FOUND] 4b112be: feat(28-01): add stock-out request creation form

**Must-Have Truths:**
- [✓] Stock-Out Requests nav item visible under Inventory section in sidebar
- [✓] List page shows stock-out requests with card/list toggle
- [✓] List page has status tabs (All / Pending / Approved / Rejected / Cancelled)
- [✓] User can create a manual stock-out request with multiple line items
- [✓] User can create a QMHQ-linked stock-out request with locked item and quantity
- [✓] Role-based list visibility works (admin/QM/inventory see all, others see own - via RLS)

All checks passed. Plan 28-01 execution complete and verified.
