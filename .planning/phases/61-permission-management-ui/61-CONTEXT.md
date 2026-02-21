# Phase 61: Permission Management UI - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can view, assign, and edit per-user permissions through a matrix UI. All 16 resources visible at once, changes saved atomically, and no admin can remove their own Admin resource Edit permission. The user creation form includes a mandatory permission matrix section that must be completed before saving.

</domain>

<decisions>
## Implementation Decisions

### Matrix layout
- Flat list of all 16 resources (not grouped by module)
- Radio button group per resource row: Edit / View / Block columns
- Human-friendly resource labels (e.g., "System Dashboard" not "system_dashboard")
- No resource descriptions — names are self-explanatory
- Resources ordered by logical workflow: QMRL → QMHQ → PO → Invoice → Inventory → Admin flow
- Sticky header row for Edit/View/Block column labels
- Minimal color coding: only Block highlighted in red, rest neutral
- Changed rows show dirty state indicator (subtle highlight) before saving
- "Set All Edit" / "Set All View" / "Set All Block" buttons above the matrix
- Set All overwrites all resources (both set and unset) — requires confirmation dialog
- Permission matrix lives as a tab on the existing user detail page

### Permission editing flow
- Single "Save All" button — atomic update of all 16 permissions at once
- Unsaved changes warning dialog when navigating away
- Toast notification on successful save: "Permissions updated for [user]"
- No reset/discard button — admin navigates away or reloads to discard

### User creation integration
- Single-step form: user detail fields at top, permission matrix below, one save action
- No default permission values — admin must explicitly choose Edit/View/Block for every resource
- Save button disabled until all 16 resources have a level selected
- "X/16 configured" counter near the save button
- "Permissions" section header above the matrix
- Set All buttons available on creation form (same as edit flow, fills all at once with confirmation)
- Old role dropdown replaced entirely by the permission matrix
- Unset resource rows visual treatment: Claude's discretion

### Lockout prevention
- Admin resource row is disabled (read-only radio buttons) when editing your own profile
- Tooltip on hover explains: "You cannot remove your own admin access"
- Only the Admin resource is self-locked — other resources can be self-edited
- One admin can remove another admin's Admin Edit permission — no restriction on editing others

### Claude's Discretion
- Whether permission tab shows user header (name/email) at top or relies on page context
- Visual treatment of unset resource rows during user creation
- Exact spacing, typography, and component sizing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing QM System admin patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 61-permission-management-ui*
*Context gathered: 2026-02-21*
