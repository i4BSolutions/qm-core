---
status: resolved
trigger: "SOR (Stock Out Request) create line item selector doesn't work properly — selecting a line item doesn't appear/show. It should work the same as the QMHQ item create line item selector, which had the same bug previously and was fixed."
created: 2026-02-19T00:00:00Z
updated: 2026-02-19T01:30:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED. SOR used old pattern relying on CategoryItemSelector to display selected item via itemId prop. QMHQ/PO use external display pattern (custom chip + Change button, CategoryItemSelector with itemId=""). Applied QMHQ/PO pattern to SOR.
test: TypeScript check passes (exit 0). Logic verified by code review.
expecting: After selecting a category and item in SOR create, the selected item appears as a chip with name/SKU and a Change button — same UX as QMHQ item route and PO.
next_action: Archive and commit.

## Symptoms

expected: When creating a SOR and selecting line items, the selected items should appear in the form (same behavior as QMHQ item create line item selector)
actual: When selecting a line item in SOR create, the chosen line item does not appear
errors: No specific error messages — UI behavior issue only
reproduction: Go to SOR create page, try to select/add line items
started: Current behavior — QMHQ item selector had the same bug previously and was fixed (commits d91634a + 6d32cfc on Feb 18), but SOR create was not updated to match

## Eliminated

- hypothesis: Stale closure in handleLineItemChange
  evidence: handleLineItemChange already uses functional updater setLineItems(prev => ...) since commit 3bd037f. Only one call per onItemChange so stale closure wouldn't cause item_id to be lost.
  timestamp: 2026-02-19T00:30:00Z

- hypothesis: CategoryItemSelector items state not populated during re-render
  evidence: In the standalone SOR flow, useEffect([categoryId]) loads items before user can select. items state persists across renders. selectedItem = items.find(i => i.id === itemId) should find the item theoretically.
  timestamp: 2026-02-19T00:40:00Z

## Evidence

- timestamp: 2026-02-19T00:10:00Z
  checked: SOR create page vs QMHQ item route page and po-line-items-table.tsx
  found: QMHQ/PO use external display pattern (show custom chip when item_id set, CategoryItemSelector with itemId="" otherwise). SOR uses CategoryItemSelector always with itemId={item.itemId}, relying on component's internal selectedItem display.
  implication: SOR uses the OLD pattern that was replaced in QMHQ/PO with the reliable external display pattern.

- timestamp: 2026-02-19T00:15:00Z
  checked: QMHQ fix commits d91634a and 6d32cfc (Feb 18)
  found: d91634a introduced CategoryItemSelector usage WITH external display pattern. 6d32cfc fixed stale closure for multiple sequential handleUpdateItem calls. SOR was not touched.
  implication: The QMHQ fix introduced the reliable external display pattern. SOR still had the old unreliable pattern.

- timestamp: 2026-02-19T00:20:00Z
  checked: po-line-items-table.tsx onItemChange callback
  found: Uses availableItems.find(i => i.id === itmId) to get item metadata synchronously. Updates multiple fields (item_id, item_name, item_sku, etc.) via onUpdateItem with functional updater.
  implication: The proven pattern stores item metadata in parent state and uses external display chip.

- timestamp: 2026-02-19T00:25:00Z
  checked: CategoryItemSelector component interface
  found: Only exposed onItemChange(itemId: string). No way to get item name/sku from callback in parent.
  implication: Added optional onItemSelect(item: ItemOption) callback to CategoryItemSelector so SOR can get item metadata without pre-fetching all items.

- timestamp: 2026-02-19T01:00:00Z
  checked: TypeScript compilation
  found: exit 0 — no type errors
  implication: All changes are type-safe.

## Resolution

root_cause: SOR create page used CategoryItemSelector with itemId={item.itemId}, relying on the component's internal selectedItem display (items.find(i => i.id === itemId)). The established proven pattern (used by both QMHQ and PO) is to use an EXTERNAL display (custom chip showing item name/SKU + Change button), with CategoryItemSelector only shown when no item is selected (itemId=""). The SOR was not updated to use this pattern when QMHQ was fixed on Feb 18 (commits d91634a + 6d32cfc).

fix: |
  1. Added optional onItemSelect(item: ItemOption) callback to CategoryItemSelector. When user selects an item, calls both onItemChange(id) and onItemSelect(fullItem) if provided.
  2. Added itemName and itemSku fields to SOR LineItem interface.
  3. Updated SOR line item rendering to use external display pattern:
     - When item.itemId is set: show custom chip with SKU/name + Change button (no CategoryItemSelector)
     - When no item.itemId: show CategoryItemSelector with itemId="" and onItemSelect wired to populate itemName/itemSku
  4. Updated QMHQ prefill to also populate itemName/itemSku from fetched QMHQ item data.
  5. Fixed handleAddLineItem to use functional updater (was using stale lineItems closure).
  6. Fixed handleRemoveLineItem to use functional updater.

verification: |
  TypeScript check: exit 0 (no errors)
  ESLint: no new warnings
  Logic review:
  - Standalone SOR: user picks category → items load in CategoryItemSelector → user picks item → onItemChange(id) + onItemSelect({name, sku}) fire → itemId/itemName/itemSku stored in parent state → custom chip displays ✓
  - QMHQ-linked SOR: items pre-filled from QMHQ (including name/sku) → chip displays immediately, CategoryItemSelector not shown ✓
  - Change button: clears categoryId/itemId/itemName/itemSku → CategoryItemSelector shown again ✓

files_changed:
  - components/forms/category-item-selector.tsx
  - app/(dashboard)/inventory/stock-out-requests/new/page.tsx
