# Phase 6: Status & Transaction UX - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Quick inline updates to status badges on QMRL/QMHQ detail pages, plus a view-only transaction detail modal. Users can change status via dropdown without navigating to full edit forms. Transaction modal displays financial details in read-only mode.

**Scope change from original requirements:** Transaction editing (UX-06, UX-07) is OUT OF SCOPE. Transactions are view-only for audit integrity.

</domain>

<decisions>
## Implementation Decisions

### Status Badge Interaction
- Inline dropdown appears below badge on click (not floating popover)
- **Detail page only** — badge not clickable in list views or cards
- Dropdown groups statuses by status_group (to_do, in_progress, done sections)
- Current status shown but disabled/greyed out (not clickable)
- Clicking outside dropdown closes it without changes
- Confirmation dialog required before saving status change
- Confirmation dialog includes optional note field (saved to audit log)
- Confirmation dialog shows preview of new status badge appearance
- Badge shows spinner during save operation
- Success toast notification after status change completes
- Error toast notification if status change fails
- Debounce clicks while previous change is processing
- Badge not clickable (no hover effect) for users without edit permission
- Any status transition allowed (no workflow restrictions)

### Transaction Modal Layout
- Open via explicit 'View' button on transaction row (not row click)
- Medium centered modal (~500px wide)
- **View-only** — no edit mode, no editable fields
- Modal header shows transaction type as title ("Money In" or "Money Out")
- Display essential fields only: amount, currency, exchange rate, EUSD, date, type, notes
- Local amount shown prominently, EUSD as smaller subtitle below
- QMHQ ID displayed as text reference (no navigation link)
- Close via X button or clicking outside modal

### Audit & Permissions
- Status changes show old → new values in audit log ("Status changed from Draft to Pending Review")
- User notes from confirmation dialog displayed inline with audit entry
- Audit history visible to anyone with entity view permission
- Status change entries have distinct icon (different from standard update icon)

### Date Picker Consistency
- Calendar popup style across all forms (QMRL, QMHQ, PO, money in/out)
- Date only — no time selection
- Display format: DD/MM/YYYY
- No week numbers shown
- No date restrictions (any date allowed)
- Click/touch only navigation (no keyboard arrow key support)

### Claude's Discretion
- Week start day (Monday vs Sunday)
- "Today" button presence in calendar
- Exact spinner style for loading state
- Modal animation and transition details
- Status-specific icon design for audit entries

</decisions>

<specifics>
## Specific Ideas

No specific product references mentioned — open to standard patterns that match existing codebase.

</specifics>

<deferred>
## Deferred Ideas

- **Transaction date/notes editing** (UX-06, UX-07) — Originally scoped but user decided transactions should be view-only for audit integrity. May revisit in future milestone.

</deferred>

---

*Phase: 06-status-transaction-ux*
*Context gathered: 2026-01-28*
