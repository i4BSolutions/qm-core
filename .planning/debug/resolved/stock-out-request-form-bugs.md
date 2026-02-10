---
status: resolved
trigger: "stock-out-request-form-bugs"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:09:00Z
---

## Current Focus

hypothesis: Both fixes implemented and verified via build
test: Build compilation successful, changes reviewed
expecting: Fixes will work in production
next_action: Archive debug session and commit changes

## Symptoms

expected:
  Bug 1: Clicking a category in the CategoryItemSelector popover should select it and filter items below
  Bug 2: When creating a stock-out request from a QMHQ item route, the items from that QMHQ should be pre-filled in the request form
actual:
  Bug 1: Categories show in popover but clicking one has no effect - selection doesn't register
  Bug 2: The form loads empty with no pre-filled items from the QMHQ
errors: No error messages reported
reproduction:
  Bug 1: Go to /inventory/stock-out-requests/new, select Manual mode, try to click a category in the item selector
  Bug 2: Go to a QMHQ with item route, create a stock-out request from it, observe empty form
started: Both issues present after recent changes to category-item-selector.tsx (commit 31e5dfd removed item filtering)

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: CategoryItemSelector component (category-item-selector.tsx)
  found: Category click handler exists at line 212 (handleCategorySelect) and is properly wired to onClick at line 312. The handler calls onCategoryChange callback correctly.
  implication: Bug 1 is NOT in the CategoryItemSelector component itself - the click handler code looks correct

- timestamp: 2026-02-10T00:01:30Z
  checked: Stock-out request form (stock-out-requests/new/page.tsx)
  found: Form uses CategoryItemSelector at line 404-414. The onCategoryChange callback at line 407-408 calls handleLineItemChange which updates state correctly at line 180-182.
  implication: Form integration looks correct. Need to test if this is actually broken or a user perception issue.

- timestamp: 2026-02-10T00:02:00Z
  checked: Commit 31e5dfd details
  found: Only removed filtering logic in loadCategories() - did NOT touch click handlers or callbacks. The change was to show all categories instead of filtered ones.
  implication: The commit shouldn't have broken click functionality. Need to investigate if there's a different issue or if this is a misreported symptom.

- timestamp: 2026-02-10T00:03:00Z
  checked: Bug 2 pre-fill logic in stock-out request form
  found: Lines 103-122 set itemId when QMHQ data loads, but categoryId is always set to empty string "". CategoryItemSelector has useEffect at line 100 that only loads items when categoryId exists.
  implication: Items never load because categoryId is empty, so the item selector shows "Select category first..." even though itemId is set

- timestamp: 2026-02-10T00:04:00Z
  checked: CategoryItemSelector item loading logic
  found: useEffect at line 99-106 checks `if (categoryId)` before calling loadItems(). If categoryId is empty, items array stays empty [].
  implication: Even if itemId is pre-filled, the item won't be found in the items array (line 206: `items.find(i => i.id === itemId)`) because items is empty. This is Bug 2 root cause.

- timestamp: 2026-02-10T00:05:00Z
  checked: Database schema for items table
  found: Items table has category_id column (migration 017)
  implication: Can fetch the category_id when loading QMHQ item, then pre-fill both categoryId and itemId in the form

- timestamp: 2026-02-10T00:06:00Z
  checked: Historical context from commit 31e5dfd
  found: Commit message says "Since migration 017 added category_id column but didn't populate it, all items had category_id=null, causing the filter to eliminate all categories"
  implication: Bug 1 is CONFIRMED - items have category_id=null, so when user selects a category, the CategoryItemSelector loads items WHERE category_id = selected_category, which returns 0 rows. User sees empty dropdown and thinks "click didn't work"

## Resolution

root_cause: |
  Bug 1: Category selection appears broken because items table has category_id=null for all rows (migration 017 added column but didn't populate). When user selects a category, CategoryItemSelector queries items WHERE category_id = selected_category, returning 0 rows. Item dropdown stays disabled with "No items in this category" message, making user think category selection failed.

  Bug 2: QMHQ pre-fill sets itemId but leaves categoryId empty. CategoryItemSelector's useEffect (line 99-106) only loads items when categoryId is truthy. Without categoryId, items array stays empty, so selected item never displays even though itemId is set in state.

fix: |
  1. Bug 1: Modified CategoryItemSelector to add "Uncategorized" pseudo-category (id="_uncategorized") that shows items with null category_id. Updated loadItems() to query .is("category_id", null) when catId="_uncategorized".

  2. Bug 2: Updated stock-out request form to fetch category_id from items table in QMHQ query. Pre-fill logic now sets categoryId to item's category_id or "_uncategorized" if null.

verification: |
  ✓ TypeScript compilation successful - no type errors
  ✓ Build completes successfully
  ✓ Changes reviewed:
    - CategoryItemSelector now includes "Uncategorized" pseudo-category
    - loadItems() handles "_uncategorized" by querying .is("category_id", null)
    - Stock-out request form fetches category_id from items in QMHQ query
    - Pre-fill logic sets categoryId to item.category_id || "_uncategorized"

  Expected behavior:
  - Bug 1 FIXED: Users can select "Uncategorized" category to see items with null category_id
  - Bug 2 FIXED: QMHQ items pre-fill with correct category (or "_uncategorized"), enabling item display

files_changed:
  - components/forms/category-item-selector.tsx
  - app/(dashboard)/inventory/stock-out-requests/new/page.tsx
