# Phase 22: PO Inline Item Creation & Validation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create new items inline during PO entry without leaving the form. Contact person is enforced for financial routes (Expense and PO). Multi-tab session handling ensures users don't encounter authentication errors when working across tabs.

</domain>

<decisions>
## Implementation Decisions

### Inline Item Creation UX
- **Form style:** Dialog/Modal overlay (not slide-out or inline expansion)
- **Required fields:** Full item form — all fields same as existing ItemDialog
- **Post-creation:** Toast success message, then auto-select item in the line row
- **Error handling:** Toast notification AND inline field errors (double feedback)
- **Trigger:** [+] button next to item selector (matching status/category inline create pattern)
- **Modal title:** "Create New Item"
- **SKU visibility:** Hide until saved — user doesn't see generated SKU in the modal
- **Cancel behavior:** Confirm discard if user has entered data before closing
- **Link to full form:** No link needed — modal has all fields
- **Visual style:** Reuse existing ItemDialog component exactly
- **New item indicator:** None — toast confirmation is sufficient
- **Partial failure:** If item created but auto-select fails, show error and keep item (user manually selects)
- **Keyboard shortcuts:** None for now (no Escape/Enter shortcuts)
- **Name pre-fill:** Start blank regardless of search term
- **Category default:** No default — user must select

### Contact Person Enforcement
- **Validation timing:** On field blur (when user tabs out without selecting)
- **Required indicator:** Asterisk (*) on label ("Contact Person *")
- **Submit block:** Prevent submit + scroll to field with inline error
- **PO context:** New requirement — contact person field exists but wasn't required before

### Multi-tab Session Behavior
- **Current issue:** Session expires in inactive tabs
- **Re-auth behavior:** Silent refresh in background — user doesn't notice
- **Refresh failure:** Redirect to login page
- **Expiration warning:** No warning — silent refresh handles it
- **Cross-tab sync:** Login and logout sync across all tabs
- **Unsaved work:** Show modal warning ("Session expired. You have unsaved changes.") before redirect
- **Session check triggers:** Both on tab focus AND on API 401 errors

### Item Selector Enhancement
- **Create option location:** [+] button next to selector (matching existing pattern)
- **Item display:** Match existing pattern (Phase 21: SKU - Name format)
- **Search scope:** Match both item name AND SKU code
- **Price reference tooltip:** Yes, show on hover (Phase 21 behavior)
- **Post-create dropdown:** Close and show selected item in field
- **Price ref indicator:** No visual distinction between items with/without price reference

### Claude's Discretion
- Loading state in item dropdown
- Maximum items shown before requiring search
- Technical implementation of session refresh

</decisions>

<specifics>
## Specific Ideas

- [+] button pattern from status/category inline create should be reused for item creation
- Existing ItemDialog should be reused exactly — no simplified version
- Modal should feel like creating an item normally, just triggered from PO context

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-po-inline-creation-validation*
*Context gathered: 2026-02-06*
