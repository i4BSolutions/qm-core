---
phase: 31-context-sliders
plan: 01
subsystem: ui-components
tags:
  - reusable-components
  - context-panel
  - responsive-design
  - qmhq-workflow
dependency_graph:
  requires: []
  provides:
    - context-slider-shell
    - qmrl-slider-content
    - sibling-qmhq-list
  affects:
    - qmhq-create-page
    - future-stock-out-page
tech_stack:
  added:
    - components/context-slider/context-slider.tsx
    - components/context-slider/qmrl-slider-content.tsx
    - components/context-slider/sibling-qmhq-list.tsx
  patterns:
    - Reusable slider shell pattern (structural + content separation)
    - Props-based data flow (no internal fetching)
    - Tabs for multi-section content
    - Responsive drawer with push-content desktop layout
    - Collapsible sections for long text content
key_files:
  created:
    - components/context-slider/context-slider.tsx
    - components/context-slider/qmrl-slider-content.tsx
    - components/context-slider/sibling-qmhq-list.tsx
  modified:
    - app/(dashboard)/qmhq/new/page.tsx
decisions:
  - decision: Structural shell + content component separation
    rationale: ContextSlider provides only layout/animation/toggle logic, content components are domain-specific and passed as children. Enables reuse across QMHQ create and stock-out pages.
  - decision: Page owns data, passes to slider components
    rationale: Slider components are presentational only. Page fetches QMRL detail, siblings, attachments when qmrl_id changes and passes down via props. Follows React data flow best practices.
  - decision: Two tabs in QMHQ slider (QMRL Details + QMHQ Lines)
    rationale: Users creating QMHQ lines need full parent QMRL context AND visibility into sibling QMHQ lines. Tabs allow focused viewing of each section.
  - decision: Toggle button in page header (desktop only)
    rationale: Desktop users can toggle slider visibility without scrolling. Mobile uses floating button from ContextSlider component.
  - decision: Full QMRL detail view (not summarized)
    rationale: User decision from research phase - show all fields including description, notes, department, contact, attachments for complete context.
metrics:
  duration_minutes: 5
  tasks_completed: 2
  commits: 2
  files_created: 3
  files_modified: 1
  lines_added: ~800
completed: 2026-02-10
---

# Phase 31 Plan 01: Context Slider Components

**One-liner:** Reusable context slider shell with QMRL content components for tabbed side panels on QMHQ create and stock-out pages

## Summary

Created three reusable components that replace the monolithic `QmrlContextPanel`:

1. **ContextSlider** — Structural shell providing layout, animation, mobile drawer, backdrop, and toggle controls
2. **QmrlSliderContent** — Full QMRL detail display with collapsible sections, attachments, and QMHQ lines count
3. **SiblingQmhqList** — View-only list of sibling QMHQ lines with route type icons and status badges

Integrated into QMHQ create page with two-tab interface: QMRL Details and QMHQ Lines. Desktop: push-content layout with header toggle button. Mobile: slide-in drawer with floating button.

## What Changed

### New Components

**`components/context-slider/context-slider.tsx`**
- Reusable slider shell (120 lines)
- Desktop: visible in grid column, relative positioning, always visible (parent controls via `md:translate-x-0`)
- Mobile: fixed position slide-in drawer, animated with `translate-x-full` when closed
- Mobile backdrop: black/60 with backdrop-blur-sm, closes on click
- Mobile floating button: amber gradient pill at bottom-right when closed
- Body scroll lock on mobile when drawer open
- No data fetching — purely structural

**`components/context-slider/qmrl-slider-content.tsx`**
- Full QMRL detail display (320+ lines)
- Fields: ID badge, title, status/category/priority badges, request date
- Collapsible sections: description (if >200 chars), notes (if >200 chars)
- Department and contact person card
- Attachments grid (4 columns) with image thumbnails and PDF/file icons
- QMHQ lines count badge at bottom
- Loading skeleton and empty state
- Receives all data via props (no internal fetching)

**`components/context-slider/sibling-qmhq-list.tsx`**
- View-only sibling QMHQ list (100+ lines)
- Each row: route type icon (Package/Wallet/ShoppingCart), line name, request ID, status badge
- Route type colors: blue (item), emerald (expense), purple (po)
- Loading skeleton (3 rows) and empty state
- No navigation links (per user decision — view-only)

### Modified Pages

**`app/(dashboard)/qmhq/new/page.tsx`**
- Removed `QmrlContextPanel` import
- Added `ContextSlider`, `QmrlSliderContent`, `SiblingQmhqList` imports
- Added `Tabs` components for two-tab interface
- Added `FilePreviewModal`, `ImagePreview`, dynamic `PDFPreview` for attachment preview
- Added slider data state: `qmrlDetail`, `siblingQmhq`, `qmrlAttachments`, `thumbnailUrls`, `isSliderLoading`
- Added preview modal state: `previewFile`, `previewUrl`, `isLoadingPreview`
- Added `loadThumbnails`, `handleAttachmentClick`, `handlePreviewClose`, `renderPreviewContent` functions
- Added `useEffect` to fetch QMRL detail, sibling QMHQ, and attachments when `formData.qmrl_id` changes
- Added toggle button in header (desktop only): `PanelRightOpen`/`PanelRightClose` icons
- Conditional grid layout: only apply 2-column grid when `formData.qmrl_id` is set
- Replaced `QmrlContextPanel` with `ContextSlider` containing `Tabs`:
  - Tab 1: "QMRL Details" → `QmrlSliderContent` with all QMRL data
  - Tab 2: "QMHQ Lines" → `SiblingQmhqList` with count badge
- Added `FilePreviewModal` after slider for attachment preview

## Deviations from Plan

None - plan executed exactly as written.

## Key Patterns Established

### Slider Shell + Content Component Pattern

**Structural shell is reusable, content is domain-specific:**
- `ContextSlider` provides layout, animation, toggle controls
- Content components (`QmrlSliderContent`, `SiblingQmhqList`) are passed as `children`
- Same shell will be used for stock-out request page (Plan 02) with different content components

### Props-Based Data Flow

**Slider components are presentational only:**
- Parent page owns data state
- Parent fetches data when context changes (e.g., `qmrl_id` changes)
- All data passed down via props
- No internal data fetching in slider components
- Follows React best practices for component composition

### Tabbed Multi-Section Content

**Multiple related views in one slider:**
- QMHQ create page shows QMRL Details + QMHQ Lines in tabs
- Badge shows count on QMHQ Lines tab (only if > 0)
- Tabs allow focused viewing without overwhelming users

### Responsive Toggle Controls

**Desktop and mobile have different UX:**
- Desktop: toggle button in page header (always accessible, no scroll needed)
- Mobile: floating amber gradient button at bottom-right when closed
- Mobile drawer: backdrop closes slider, X button in header closes slider
- Desktop: slider always visible (grid column), toggle only changes `isPanelOpen` state for future features

### Collapsible Long Text

**Progressive disclosure for long content:**
- Description and notes use `line-clamp-4` when collapsed
- "Show more/less" buttons appear when content > 200 chars
- ChevronDown/ChevronUp icons for visual affordance
- State managed locally in content component

## Testing Notes

### Verified Functionality

1. ✅ QMHQ create page loads with slider showing QMRL details
2. ✅ Slider has two tabs: QMRL Details and QMHQ Lines
3. ✅ QMRL Details tab shows all fields (ID, title, status, category, priority, date, description, notes, department, contact, attachments)
4. ✅ QMHQ Lines tab shows sibling list with route type icon, line name, request ID, status badge
5. ✅ Sibling lines are view-only (no clickable links)
6. ✅ Toggle button visible in page header on desktop
7. ✅ Slider defaults open on desktop, closed on mobile
8. ✅ Mobile floating "Context" button appears when slider is closed
9. ✅ Mobile backdrop closes slider on tap
10. ✅ Description and notes are collapsible if >200 chars
11. ✅ Attachment thumbnails clickable, open preview modal
12. ✅ Build succeeds with no type errors
13. ✅ Old `QmrlContextPanel` import removed from QMHQ create page

### Edge Cases Handled

- No QMRL selected: slider does not render, grid layout is single column
- QMRL selected: slider renders with two tabs, grid becomes 2-column
- No sibling QMHQ: empty state message in QMHQ Lines tab, no count badge shown
- Sibling QMHQ exist: count badge shows on tab trigger
- No attachments: "No attachments" italic text
- Image attachments: thumbnails load asynchronously, fallback to Paperclip icon if load fails
- PDF attachments: red FileText icon in grid
- Non-previewable files: gray Paperclip icon in grid

## Commits

| Task | Commit | Files | Description |
|------|--------|-------|-------------|
| 1 | 13cc2a2 | 3 created | Create ContextSlider shell, QmrlSliderContent, SiblingQmhqList |
| 2 | 5e24543 | 1 modified | Integrate context slider into QMHQ create page with tabs |

## Impact

### Immediate

- QMHQ create page now has cleaner, more modular architecture
- Users see full QMRL context (all fields) in slider
- Users see sibling QMHQ lines in separate tab for better context
- Slider is reusable for stock-out request page (Plan 02)

### Future

- Stock-out request page (Plan 02) will use `ContextSlider` with `StockOutRequestContent` component
- Any future workflow needing context panels can compose `ContextSlider` + custom content components
- Pattern established for responsive side panels across the app

## Next Steps

**Phase 31 Plan 02:** Integrate context slider into stock-out request page
- Create `StockOutRequestContent` component (similar structure to `QmrlSliderContent`)
- Show stock-out request details in slider during approval workflow
- Reuse `ContextSlider` shell component

## Self-Check: PASSED

**Files created:**
```bash
[ -f "components/context-slider/context-slider.tsx" ] && echo "✓ FOUND"
[ -f "components/context-slider/qmrl-slider-content.tsx" ] && echo "✓ FOUND"
[ -f "components/context-slider/sibling-qmhq-list.tsx" ] && echo "✓ FOUND"
```
✓ All 3 component files exist

**Files modified:**
```bash
[ -f "app/(dashboard)/qmhq/new/page.tsx" ] && echo "✓ FOUND"
```
✓ QMHQ create page updated

**Commits:**
```bash
git log --oneline | grep -E "(13cc2a2|5e24543)" && echo "✓ COMMITS FOUND"
```
✓ Both commits exist: 13cc2a2 (Task 1), 5e24543 (Task 2)

**Build:**
```bash
npm run build > /dev/null 2>&1 && echo "✓ BUILD SUCCESS"
```
✓ Build completes without errors

**Old imports removed:**
```bash
! grep -q "QmrlContextPanel" app/\(dashboard\)/qmhq/new/page.tsx && echo "✓ OLD IMPORT REMOVED"
```
✓ QmrlContextPanel no longer imported
