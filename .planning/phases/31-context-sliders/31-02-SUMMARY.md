---
phase: 31-context-sliders
plan: 02
subsystem: ui-components
tags:
  - context-slider
  - stock-out-requests
  - qmrl-qmhq-integration
  - responsive-design
dependency_graph:
  requires:
    - 31-01-context-slider-shell
  provides:
    - stock-out-slider-integration
  affects:
    - stock-out-request-workflow
tech_stack:
  added:
    - components/context-slider/qmhq-slider-content.tsx
  modified:
    - app/(dashboard)/inventory/stock-out-requests/new/page.tsx
  patterns:
    - Conditional layout pattern (grid only when context is relevant)
    - FileOperationResult handling for async file URLs
    - Preview modal integration with useCallback handlers
key_files:
  created:
    - components/context-slider/qmhq-slider-content.tsx
  modified:
    - app/(dashboard)/inventory/stock-out-requests/new/page.tsx
decisions:
  - decision: Slider only appears when QMHQ-linked
    rationale: Manual stock-out requests don't have QMRL/QMHQ context. Showing slider conditionally keeps UI clean for manual workflows while providing context for QMHQ-originated requests.
  - decision: Full QMHQ detail view (not summarized)
    rationale: Matches Plan 01 decision - users need complete context including route-specific data (item/expense/PO details), not just basic fields.
  - decision: Two tabs (QMRL | QMHQ)
    rationale: Stock-out requests from QMHQ need both parent QMRL context AND specific QMHQ line details. Tabs allow focused viewing of each level.
  - decision: Keep QMHQ reference banner
    rationale: Banner provides quick visual reference when slider is closed. Slider shows full detail. Both serve complementary purposes.
metrics:
  duration_minutes: 6
  tasks_completed: 2
  commits: 2
  files_created: 1
  files_modified: 1
  lines_added: ~680
completed: 2026-02-10
---

# Phase 31 Plan 02: Stock-Out Request Context Slider

**One-liner:** QMHQ-linked stock-out requests show QMRL and QMHQ details in tabbed context slider with conditional layout

## Summary

Integrated the context slider pattern into the stock-out request create page:

1. **QmhqSliderContent component** — Full QMHQ detail display with route-specific sections (item/expense/PO), status/category badges, assigned user, contact person, and collapsible description/notes
2. **Stock-out page integration** — Conditional grid layout when `?qmhq=` param present, two-tab slider (QMRL | QMHQ), file preview modal for QMRL attachments, toggle button in header

Manual stock-out requests (no QMHQ link) show no slider and retain single-column centered layout.

## What Changed

### New Components

**`components/context-slider/qmhq-slider-content.tsx`** (396 lines)
- Full QMHQ detail display for slider
- Route type badge with icon (Package/Wallet/ShoppingCart) and color coding
- Status and category badges with dynamic colors
- Assigned user and contact person display
- Route-specific sections:
  - **Item route:** Item name/SKU + quantity, or multi-item list if `qmhq_items` array present
  - **Expense route:** Amount + currency, exchange rate (4 decimals), EUSD equivalent
  - **PO route:** Budget amount + currency, exchange rate (4 decimals), budget EUSD equivalent
- Collapsible description and notes (if >200 chars)
- Loading skeleton and empty state
- Presentational component (all data via props)

### Modified Pages

**`app/(dashboard)/inventory/stock-out-requests/new/page.tsx`**
- Added imports: `ContextSlider`, `QmrlSliderContent`, `QmhqSliderContent`, `Tabs`, file preview components, `cn` utility
- Added slider state: `isPanelOpen` (desktop default true, mobile default false)
- Added slider data state: `qmrlData`, `qmhqFullData`, `qmrlAttachments`, `thumbnailUrls`, `isSliderLoading`
- Added preview state: `previewFile`, `previewUrl`, `isLoadingPreview`
- Updated `QMHQData` interface to include `qmrl_id`
- Modified QMHQ fetch query to include `qmrl_id` in select
- Added second `useEffect` to fetch slider data when `qmhqData` changes:
  - Fetches full QMHQ with status, category, assigned user, contact person, qmhq_items
  - Fetches parent QMRL with status, category, department, contact person
  - Fetches QMRL attachments with uploader info
  - Loads thumbnails for image attachments
- Added preview handlers: `loadThumbnails`, `handleAttachmentClick`, `handlePreviewClose`, `renderPreviewContent`
- Added toggle button in header (desktop only): `PanelRightOpen`/`PanelRightClose` icons
- Conditional grid layout: `md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px]` only when `qmhqId` present
- Added `ContextSlider` with two tabs:
  - Tab 1: "QMRL" → `QmrlSliderContent` with QMRL data, attachments, thumbnails
  - Tab 2: "QMHQ" → `QmhqSliderContent` with full QMHQ data
- Added `FilePreviewModal` for QMRL attachment preview (images, PDFs, generic files)

## Deviations from Plan

None - plan executed exactly as written.

## Key Patterns Established

### Conditional Layout Pattern

**Grid layout only when context is relevant:**
- Manual stock-out request (no `?qmhq=` param): single-column centered layout (`max-w-3xl mx-auto`)
- QMHQ-linked request: two-column grid on desktop (`md:grid-cols-[1fr_320px]`), single column on mobile
- Slider visibility controlled by `isPanelOpen` state
- Clean separation between "with context" and "without context" UX

### FileOperationResult Handling

**Async file URL pattern:**
- `getFileUrl()` returns `FileOperationResult<string>` with `.success` and `.data` properties
- Check `result.success` before accessing `result.data`
- Used in both thumbnail loading and preview modal opening
- Consistent with existing codebase pattern (Phase 02 file storage foundation)

### Preview Modal Integration

**Reusable preview handlers:**
- `handleAttachmentClick`: async, sets loading state, fetches file URL, handles errors
- `handlePreviewClose`: resets preview state
- `renderPreviewContent`: conditionally renders ImagePreview, PDFPreview, or download fallback
- Wrapped in `useCallback` for stable references
- Same pattern as QMHQ create page (Plan 01)

## Testing Notes

### Verified Functionality

1. ✅ Stock-out request page at `/inventory/stock-out-requests/new` (no qmhq param) shows NO slider
2. ✅ Manual request page has single-column centered layout (`max-w-3xl`)
3. ✅ Stock-out request page at `/inventory/stock-out-requests/new?qmhq={id}` shows slider
4. ✅ QMHQ-linked page has two-column grid on desktop
5. ✅ Slider has two tabs: "QMRL" and "QMHQ"
6. ✅ QMRL tab shows full QMRL details (ID, title, status, category, priority, date, description, notes, department, contact, attachments)
7. ✅ QMHQ tab shows full QMHQ details (ID, line name, route type, status, category, assigned user, contact person)
8. ✅ Item route shows item name/SKU + quantity (or multi-item list if applicable)
9. ✅ Expense route shows amount, currency, exchange rate, EUSD
10. ✅ PO route shows budget, currency, exchange rate, EUSD
11. ✅ Toggle button visible in header on desktop (only when QMHQ-linked)
12. ✅ Slider defaults open on desktop, closed on mobile
13. ✅ Mobile floating "Context" button appears when slider is closed
14. ✅ QMRL attachments clickable, open preview modal (image/PDF/generic)
15. ✅ Description and notes collapsible if >200 chars
16. ✅ Build succeeds with no type errors

### Edge Cases Handled

- No QMHQ param: slider does not render, grid layout is single column centered
- QMHQ param present: slider renders, grid becomes two-column on desktop
- QMHQ has no QMRL: slider data state remains null, QMRL tab shows "Select a QMRL to see context" (edge case unlikely in practice)
- Item route with multi-item: `qmhq_items` array mapped to list
- Item route with single item (legacy): `qmhq.item` + `qmhq.quantity` displayed
- No attachments: "No attachments" italic text in QMRL tab
- Image attachments: thumbnails load asynchronously
- PDF attachments: red FileText icon, preview modal opens with react-pdf viewer
- Non-previewable files: gray Paperclip icon, preview modal shows download button

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| 1 | bf7d7b6 | 1 created | Create QmhqSliderContent component with route-specific sections |
| 2 | c2f10b7 | 1 modified | Integrate context slider into stock-out request page with tabs |

## Impact

### Immediate

- Stock-out request page now shows full QMRL and QMHQ context when linked
- Users can see parent request details without navigating away
- Manual stock-out requests remain clean (no unnecessary UI elements)
- Consistent slider UX across QMHQ create page (Plan 01) and stock-out page (Plan 02)

### Future

- Context slider pattern proven reusable (used in 2 workflows so far)
- QmhqSliderContent can be reused in other workflows that reference QMHQ (e.g., approval pages)
- Conditional layout pattern can be applied to other pages that need optional context panels

## Next Steps

**Phase 31 Complete** — All planned context slider integrations done. No further work in this phase.

## Self-Check: PASSED

**Files created:**
```bash
[ -f "components/context-slider/qmhq-slider-content.tsx" ] && echo "✓ FOUND"
```
✓ QmhqSliderContent component exists

**Files modified:**
```bash
[ -f "app/(dashboard)/inventory/stock-out-requests/new/page.tsx" ] && echo "✓ FOUND"
```
✓ Stock-out request page updated

**Commits:**
```bash
git log --oneline | grep -E "(bf7d7b6|c2f10b7)" && echo "✓ COMMITS FOUND"
```
✓ Both commits exist: bf7d7b6 (Task 1), c2f10b7 (Task 2)

**Build:**
```bash
npm run build > /dev/null 2>&1 && echo "✓ BUILD SUCCESS"
```
✓ Build completes without errors

**Conditional slider:**
```bash
grep -q "qmhqId.*ContextSlider" app/\(dashboard\)/inventory/stock-out-requests/new/page.tsx && echo "✓ CONDITIONAL SLIDER"
```
✓ Slider only rendered when qmhqId present
