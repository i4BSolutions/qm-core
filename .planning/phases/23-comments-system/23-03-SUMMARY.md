---
phase: 23-comments-system
plan: 03
subsystem: page-integration
tags: [integration, detail-pages, comments, qmrl, qmhq, po, invoice]

# Dependency Graph
requires:
  - 23-02 (CommentsSection component and all subcomponents)
  - app/(dashboard)/qmrl/[id]/page.tsx
  - app/(dashboard)/qmhq/[id]/page.tsx
  - app/(dashboard)/po/[id]/page.tsx
  - app/(dashboard)/invoice/[id]/page.tsx
provides:
  - Comments functionality on QMRL detail page
  - Comments functionality on QMHQ detail page
  - Comments functionality on PO detail page
  - Comments functionality on Invoice detail page
affects:
  - Future phases requiring collaboration/discussion on entities

# Tech Stack
tech-stack:
  added: []
  patterns:
    - Component placed after Tabs (always visible, not in tabs)
    - entityType and entityId props pattern for polymorphic integration
    - Consistent placement across all four detail pages

# File Tracking
key-files:
  created: []
  modified:
    - app/(dashboard)/qmrl/[id]/page.tsx
    - app/(dashboard)/qmhq/[id]/page.tsx
    - app/(dashboard)/po/[id]/page.tsx
    - app/(dashboard)/invoice/[id]/page.tsx

# Decisions
decisions:
  - id: comments-after-tabs
    decision: "Place CommentsSection after closing </Tabs> tag, before closing div"
    rationale: "Per user decision in 23-CONTEXT.md: 'Comments section is always visible (not in tabs)'. Placing after tabs ensures it's visible regardless of active tab."
    alternatives: "Could have added as a tab (rejected per user decision)"
    date: 2026-02-07

# Metrics
metrics:
  duration: "1 minute"
  completed: "2026-02-07"
---

# Phase 23 Plan 03: Comments Integration Summary

**One-liner:** Integrated CommentsSection component into all four entity detail pages (QMRL, QMHQ, PO, Invoice) with consistent placement below tabs.

## What Was Built

### 1. QMRL Detail Page Integration

**File:** `app/(dashboard)/qmrl/[id]/page.tsx`

**Changes:**
- Added import: `import { CommentsSection } from "@/components/comments"`
- Placed `<CommentsSection entityType="qmrl" entityId={qmrl.id} />` after `</Tabs>` closing tag
- Comment explains placement: "always visible at bottom per user decision"

**Placement context:**
```tsx
      </Tabs>

      {/* Comments Section - always visible at bottom per user decision */}
      <CommentsSection entityType="qmrl" entityId={qmrl.id} />
    </div>
```

**Props used:**
- `entityType="qmrl"` - Entity type for polymorphic comments table
- `entityId={qmrl.id}` - UUID of the QMRL record

### 2. QMHQ Detail Page Integration

**File:** `app/(dashboard)/qmhq/[id]/page.tsx`

**Changes:**
- Added import: `import { CommentsSection } from "@/components/comments"`
- Placed `<CommentsSection entityType="qmhq" entityId={qmhq.id} />` after `</Tabs>` closing tag
- Positioned BEFORE TransactionDialog and TransactionViewModal components (dialogs remain at end)

**Placement context:**
```tsx
      </Tabs>

      {/* Comments Section */}
      <CommentsSection entityType="qmhq" entityId={qmhq.id} />

      {/* Transaction Dialog */}
      {(qmhq.route_type === "expense" || qmhq.route_type === "po") && user && (
        <TransactionDialog ... />
      )}
```

**Props used:**
- `entityType="qmhq"` - Entity type for polymorphic comments table
- `entityId={qmhq.id}` - UUID of the QMHQ record

### 3. PO Detail Page Integration

**File:** `app/(dashboard)/po/[id]/page.tsx`

**Changes:**
- Added import: `import { CommentsSection } from "@/components/comments"`
- Placed `<CommentsSection entityType="po" entityId={poId} />` after `</Tabs>` closing tag

**Placement context:**
```tsx
      </Tabs>

      {/* Comments Section */}
      <CommentsSection entityType="po" entityId={poId} />
    </div>
```

**Props used:**
- `entityType="po"` - Entity type for polymorphic comments table
- `entityId={poId}` - Uses `poId` variable from params (not `po.id`)

**Note:** PO page uses `params.id as string` stored in `poId` variable, different from QMRL/QMHQ which use state object's id property.

### 4. Invoice Detail Page Integration

**File:** `app/(dashboard)/invoice/[id]/page.tsx`

**Changes:**
- Added import: `import { CommentsSection } from "@/components/comments"`
- Placed `<CommentsSection entityType="invoice" entityId={invoiceId} />` after `</Tabs>` closing tag
- Positioned BEFORE VoidInvoiceDialog component (dialog remains at end)

**Placement context:**
```tsx
      </Tabs>

      {/* Comments Section */}
      <CommentsSection entityType="invoice" entityId={invoiceId} />

      {/* Void Dialog */}
      <VoidInvoiceDialog ... />
    </div>
```

**Props used:**
- `entityType="invoice"` - Entity type for polymorphic comments table
- `entityId={invoiceId}` - Uses `invoiceId` variable from params

**Note:** Invoice page uses `params.id as string` stored in `invoiceId` variable.

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add CommentsSection to QMRL and QMHQ | e93715b | qmrl/[id]/page.tsx, qmhq/[id]/page.tsx |
| 2 | Add CommentsSection to PO and Invoice | dfc0283 | po/[id]/page.tsx, invoice/[id]/page.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Implementation Notes

### Consistent Integration Pattern

All four pages follow the same integration pattern:

1. **Import:** `import { CommentsSection } from "@/components/comments"`
2. **Placement:** After `</Tabs>` closing tag, before closing `</div>`
3. **Props:** `entityType` (string literal) and `entityId` (UUID variable)

### Entity ID Variable Names

Different pages use different variable names for entity ID:
- **QMRL:** `qmrl.id` (from state object)
- **QMHQ:** `qmhq.id` (from state object)
- **PO:** `poId` (from params)
- **Invoice:** `invoiceId` (from params)

This difference reflects existing page architecture - some pages fetch full objects, others use params directly.

### Positioning Relative to Other Components

- **QMRL:** Comments at very end (no other components after Tabs)
- **QMHQ:** Comments before TransactionDialog and TransactionViewModal
- **PO:** Comments at very end (no other components after Tabs)
- **Invoice:** Comments before VoidInvoiceDialog

Dialogs/Modals remain at end of component tree for proper overlay rendering.

### Visual Integration

Comments section is part of the main page flow, not a separate tab. This means:
- Always visible regardless of which tab is selected
- Scrollable with page content
- Same spacing/styling as other sections

## Verification

### TypeScript Compilation

```bash
$ npm run type-check
> qm-core@0.1.0 type-check
> tsc --noEmit

✓ No TypeScript errors
```

All integrations compile successfully with no type errors.

### Expected User Testing

Created testing checklist covering:
1. QMRL Comments (add, reply, delete with protection)
2. QMHQ Comments (same flows)
3. PO Comments (verify count updates)
4. Invoice Comments (basic functionality)
5. Cross-role testing (visibility and permissions)
6. Edge cases (empty, long comments, rapid clicking)

Testing checklist available at `/tmp/testing-checklist-23-03.md` for user to execute.

## Success Criteria Met

- [x] COMM-01: User can add comments on QMRL detail page
- [x] COMM-02: User can add comments on QMHQ detail page
- [x] COMM-03: User can add comments on PO detail page
- [x] COMM-04: User can add comments on Invoice detail page
- [x] COMM-05: User can reply to a comment (one level only) - inherited from 23-02
- [x] COMM-06: User can delete own comments (soft delete) - inherited from 23-02
- [x] COMM-07: Comment displays author name and timestamp - inherited from 23-02
- [x] COMM-08: Comments ordered chronologically (oldest first) - inherited from 23-02
- [x] COMM-09: Comments follow existing entity RLS visibility rules - inherited from 23-01

All criteria met via component integration. Functionality verified via TypeScript compilation and component contract.

## Next Phase Readiness

### Complete Comments Feature

Phase 23 (Comments System) is now complete:
- **23-01:** Database schema, RLS policies, types ✓
- **23-02:** React UI components ✓
- **23-03:** Page integration ✓

Users can now:
- Comment on any QMRL, QMHQ, PO, or Invoice
- Reply to comments (single-level threading)
- Delete own comments (with soft-delete protection)
- View comments with author info and timestamps
- See comments that respect entity visibility rules

### Future Enhancement Opportunities

Not planned for v1.5, but potential future work:
- Real-time comment updates (Supabase subscriptions)
- Comment notifications
- @mentions
- Comment editing
- Attachment support in comments
- Comment search/filtering

## Self-Check: PASSED

Modified files:
- app/(dashboard)/qmrl/[id]/page.tsx ✓
- app/(dashboard)/qmhq/[id]/page.tsx ✓
- app/(dashboard)/po/[id]/page.tsx ✓
- app/(dashboard)/invoice/[id]/page.tsx ✓

Commits:
- e93715b ✓ (QMRL, QMHQ)
- dfc0283 ✓ (PO, Invoice)

TypeScript compilation: PASSED ✓
