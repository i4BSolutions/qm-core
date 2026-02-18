---
status: resolved
trigger: "After the recent UI rewrite (commit d91634a), choosing a line item in the QMHQ item route's CategoryItemSelector does not actually select the item. The selection doesn't register."
created: 2026-02-18T00:00:00Z
updated: 2026-02-18T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED. `handleUpdateItem` uses a stale closure over `selectedItems` instead of a functional updater. When `onItemChange` fires 6 consecutive `handleUpdateItem` calls, each reads the same stale `selectedItems`, so only the last call's field survives — and since `item_id` is updated in call 1 but overwritten (reset to "") by later calls, the item never appears as selected.
test: Verified by comparing with working PO version in po-line-items-table.tsx which uses `setLineItems((prev) => ...)` functional updater.
expecting: Applying functional updater pattern to `handleUpdateItem` will fix the bug.
next_action: Fix handleUpdateItem to use functional updater.

## Symptoms

expected: When clicking an item in the CategoryItemSelector on the QMHQ item route creation page, the item should be selected and shown (with SKU badge, name chip, Change button — same as PO).
actual: Clicking an item does nothing — the selection is not registered/applied. The item doesn't get selected.
errors: No error messages reported — the selection just silently fails.
reproduction: Go to QMHQ create -> choose Item route -> try to add a line item -> use the CategoryItemSelector to pick an item. The item click doesn't select it.
started: After commit d91634a which rewrote the QMHQ item line picker to match PO layout.

## Eliminated

- hypothesis: onItemChange prop is not wired / has wrong prop name
  evidence: onItemChange is correctly wired; CategoryItemSelector calls it with the item id. The callback fires.
  timestamp: 2026-02-18T00:01:00Z

- hypothesis: items.find() fails because parent items list doesn't have the item
  evidence: Parent fetches up to 200 items which would cover most cases; this is a secondary scalability concern but not the primary cause since the entire item_id update is silently overwritten before state commits.
  timestamp: 2026-02-18T00:01:00Z

## Evidence

- timestamp: 2026-02-18T00:01:00Z
  checked: handleUpdateItem in QMHQ page vs handleUpdateLineItem in po-line-items-table.tsx
  found: QMHQ: `setSelectedItems(selectedItems.map(...))` — captures selectedItems from closure. PO: `setLineItems((prev) => prev.map(...))` — uses functional updater.
  implication: When onItemChange fires 6 consecutive handleUpdateItem calls (item_id, item_name, item_sku, item_unit, item_price_reference, item_standard_unit), React 18 batches them but each reads the SAME stale selectedItems from the closure. Each call overwrites the previous. The final call updates item_standard_unit only, leaving item_id as "". Since the display conditional is `selectedItem.item_id ? <chip> : <selector>`, the item never shows as selected.

## Resolution

root_cause: handleUpdateItem in QMHQ page uses a direct closure reference to `selectedItems` state instead of a functional updater. When multiple sequential calls happen in one event handler (6 fields set in onItemChange), all reads see the same stale state and only the last write survives — which leaves item_id as "" and the item never registers as selected.
fix: Change handleUpdateItem to use functional updater `setSelectedItems(prev => prev.map(...))` matching the PO pattern in po-line-items-table.tsx.
verification: Applied one-line change — `setSelectedItems(selectedItems.map(...))` → `setSelectedItems(prev => prev.map(...))`. TypeScript check passes (exit 0). Now each of the 6 sequential handleUpdateItem calls in onItemChange reads the latest accumulated state via `prev`, so all 6 field updates are applied correctly and item_id is persisted. The display conditional `selectedItem.item_id ? <chip> : <selector>` will now show the selected item chip.
files_changed:
  - app/(dashboard)/qmhq/new/[route]/page.tsx
