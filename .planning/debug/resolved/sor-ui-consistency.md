---
status: resolved
trigger: "SOR detail page (all 6 tabs) and Stock-Out Execution page have UI elements that don't match the system-wide design language"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED and FIXED — SOR pages had multiple concrete UI pattern mismatches vs QMHQ/PO/Invoice gold standards
test: All files audited and fixed; build passes
expecting: Visual consistency achieved
next_action: DONE — archived

## Symptoms

expected: All UI elements match QMHQ/PO/Invoice design language — badge variants, button styles, spacing, panel styling, command-panel corner-accents, card layouts
actual: Status pills, buttons, line item rows, progress bars, spacing all differ from reference pages
errors: No runtime errors — purely visual/design inconsistency
reproduction: Open /inventory/stock-out-requests/[id] and compare with /qmhq/[id] or /po/[id]
started: Pages built in Phases 55-57, not aligned with v1.8 UI Consistency milestone

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-17T00:10:00Z
  checked: SOR detail page header vs QMHQ/PO reference
  found: |
    SOR uses plain h1 + separate Badge for status, not the request-id-badge + inline status pattern.
    No `request-id-badge` div wrapping the request number.
    Status badge is inside a `space-y-3` + `space-y-1` block — QMHQ uses flat flex + request-id-badge.
  implication: Header section needs to match QMHQ/PO pattern with request-id-badge and status beside it

- timestamp: 2026-02-17T00:10:00Z
  checked: SOR kpiPanel vs QMHQ/PO reference
  found: |
    kpiPanel uses `command-panel p-6 space-y-4` (no corner-accents, manual padding).
    QMHQ/PO use `command-panel corner-accents animate-slide-up` with style animationDelay.
    SOR kpiPanel uses `text-xs font-medium text-slate-500 mb-1` for labels.
    Reference pages use `text-xs text-slate-400 uppercase tracking-wider mb-1/2`.
  implication: kpiPanel needs corner-accents + animation + consistent label styling

- timestamp: 2026-02-17T00:10:00Z
  checked: Tab content section headers vs QMHQ/PO reference
  found: |
    SOR tabs use bare `h3 className="text-lg font-semibold text-slate-200 mb-4"`.
    QMHQ/PO use `<div className="section-header">` with icon + h2 (system CSS class).
    Approvals tab empty state: `text-center py-8 text-slate-500` (no icon).
    Transactions tab empty state: `text-center py-8 text-slate-500` (no icon).
    Reference empty states have: icon div (w-16 h-16 rounded-full), h3 + p pattern.
  implication: All tab section headers need section-header pattern; all empty states need icon

- timestamp: 2026-02-17T00:10:00Z
  checked: Approvals tab card rows vs QMHQ/PO reference
  found: |
    Uses `border border-slate-700 rounded-lg p-4` — missing bg-slate-800/30.
    Reference (invoice stock receipts, QMHQ transactions) uses `p-4 rounded-lg border border-slate-700 bg-slate-800/30`.
  implication: Approval cards need bg-slate-800/30 added

- timestamp: 2026-02-17T00:10:00Z
  checked: Transactions tab cards vs QMHQ transactions reference
  found: |
    Uses `border border-slate-700 rounded-lg p-4 bg-slate-800/30` — consistent.
    Status badge for tx.status uses `text-xs mt-1` without consistent padding.
    QMHQ uses `text-xs px-2 py-0.5 rounded` inline span pattern for simple labels.
  implication: Minor — badge inside tx row needs text-xs sizing consistency

- timestamp: 2026-02-17T00:10:00Z
  checked: Cancel Request button vs PO Cancel button reference
  found: |
    SOR uses `variant="destructive"` Button.
    PO uses `variant="outline"` with `className="border-red-500/30 text-red-400 hover:bg-red-500/10"`.
    This is intentional difference (PO is outline, SOR direct action) — preserve.
  implication: Cancel button can stay destructive variant (direct action, not dialog)

- timestamp: 2026-02-17T00:10:00Z
  checked: WarehouseAssignmentsTab pending row bg vs reference
  found: |
    Uses `bg-amber-950/20 border border-amber-800/30` for pending rows.
    Reference (QMHQ items): `bg-slate-800/30 border border-slate-700/50`.
    The amber bg creates visual inconsistency with the rest of the system.
  implication: Pending L1 rows should use standard slate bg with amber badge for callout

- timestamp: 2026-02-17T00:10:00Z
  checked: ReadyExecuteTab assignment rows vs reference
  found: |
    Uses `bg-slate-800/40 border border-slate-700/50` — close to reference but slightly off opacity.
    Reference uses `bg-slate-800/30 border border-slate-700/50`.
  implication: Minor — change /40 to /30

- timestamp: 2026-02-17T00:10:00Z
  checked: Stock-Out Execution page badge styling vs system reference
  found: |
    Status badges use `style={{ backgroundColor: "#10b981", border: "none" }}` (inline CSS).
    All other pages use `Badge variant="outline" className="..."` pattern.
  implication: Replace inline style badges with variant="outline" className pattern

- timestamp: 2026-02-17T00:10:00Z
  checked: Loading state vs reference
  found: |
    SOR loads: `<Loader2 className="w-8 h-8 animate-spin text-blue-400" />` (no text, no flex wrapper).
    QMHQ/PO/Invoice: `<div className="flex items-center justify-center h-64">` + inner flex + Loader2 text-amber-500 + p text.
  implication: Loading state needs full-pattern match

- timestamp: 2026-02-17T00:10:00Z
  checked: Not Found state vs reference
  found: |
    SOR not-found: Button without variant="outline" className="border-slate-700".
    Reference: Button variant="outline" className="border-slate-700".
  implication: Not found button needs border-slate-700

## Resolution

root_cause: |
  SOR pages (Phases 55-57) were built without referencing the v1.8 UI Consistency patterns
  established across QMHQ/PO/Invoice detail pages. Specific gaps:
  1. Header used plain h1+Badge instead of request-id-badge + status beside it
  2. kpiPanel lacked corner-accents, animate-slide-up, and had inconsistent label styles
  3. QMHQ link was inside kpiPanel instead of header (where reference pages put parent links)
  4. Tab section headers used bare h3 instead of the <div class="section-header"> pattern
  5. Empty states lacked the w-16 h-16 icon div + h3 + p pattern from reference pages
  6. Approval card rows missing bg-slate-800/30
  7. WarehouseAssignmentsTab pending rows used amber-950/20 bg instead of standard slate-800/30
  8. ReadyExecuteTab rows used bg-slate-800/40 instead of /30
  9. Stock-Out Execution page badges used inline CSS styles instead of variant="outline" className
  10. Loading and Not Found states didn't match reference pattern (wrong colors, no text, no variant)
  11. SOR IDs in execution table used plain span instead of amber code tags

fix: |
  Applied targeted CSS-only fixes to 7 files:
  1. app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx — header, kpiPanel, loading/not-found, all tab headers and empty states
  2. components/stock-out-requests/line-item-table.tsx — empty state
  3. components/stock-out-requests/warehouse-assignments-tab.tsx — empty state, section header, pending row bg
  4. components/stock-out-requests/ready-execute-tab.tsx — empty state, section header, row bg
  5. app/(dashboard)/inventory/stock-out/page.tsx — status badges, empty state, command-panel corner-accents, SOR ID code tag

verification: |
  - npm run type-check: 0 errors
  - npm run build: successful, no errors
  - All logic preserved (onClick handlers, conditional rendering, data flow unchanged)
  - Progress bar segment colors (blue/purple/emerald) preserved
  - All functional behavior (dialogs, approvals, execution) preserved

files_changed:
  - app/(dashboard)/inventory/stock-out-requests/[id]/page.tsx
  - components/stock-out-requests/line-item-table.tsx
  - components/stock-out-requests/warehouse-assignments-tab.tsx
  - components/stock-out-requests/ready-execute-tab.tsx
  - app/(dashboard)/inventory/stock-out/page.tsx
