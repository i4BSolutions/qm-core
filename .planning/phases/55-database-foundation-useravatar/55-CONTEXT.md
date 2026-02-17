# Phase 55: Database Foundation + UserAvatar - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the two-layer approval schema (migration 063 with backfill + trigger rewrite) and create a shared UserAvatar component using boring-avatars. This phase provides the database foundation and shared component that phases 56, 57, and 58 all depend on.

</domain>

<decisions>
## Implementation Decisions

### Avatar Style & Colors
- Use **Beam** variant (simple smiley face with geometric shapes)
- Use boring-avatars **default color palette** (no custom colors)
- Render as a **circle** (clipped, overflow hidden)
- No tooltip on hover — name is always shown alongside the avatar
- No fallback needed — `fullName` is always present (required field on user creation)
- No border vs subtle border: Claude's discretion based on contrast

### Avatar Sizing
- Size variants: Claude's discretion based on downstream usage in phases 56-58
- Layout in list rows: **inline** (avatar circle next to name on same line)
- Only one person assigned per entity — no multi-avatar stacking needed
- Whether to include optional name label prop: Claude's discretion on API design

### Trigger Status Flow
- **Full status flow:** `pending` → Layer 1 approve → `awaiting_admin` → Layer 2 warehouse assign → `fully_approved` → execute
- Layer 1 approval **auto-transitions** line item status to `awaiting_admin` via database trigger
- Layer 1 rejection is **permanent** — no re-approval allowed for that line item
- Layer 1 rejection **requires a reason** (mandatory text field) — existing notes/reason column already exists in schema
- **Layer 2 has no reject option** — it is purely a warehouse assignment step (pick warehouse + set qty)
- Layer 2 qty is **capped by both** Layer 1 approved qty AND available warehouse stock
- Layer 2 qty cap enforced at **both database trigger and UI levels**
- Warehouse stock cap enforcement: Claude's discretion (trigger vs UI-only based on concurrency trade-offs)
- Same admin can do both Layer 1 and Layer 2 — no separation of duties required
- Layer 1 quantity is **locked once submitted** — no edits after approval
- New `fully_approved` enum value: execution is allowed **only** from `fully_approved` status (not old `approved`)
- All pending records go through the **new two-layer flow** going forward
- Status transitions logged silently — existing audit triggers handle logging

### Backfill Strategy
- Existing `approved` records: backfill `layer = 'admin'` AND update status to `fully_approved` (so they're not blocked from execution)
- Existing `rejected` records and backfill scope: Claude's discretion based on data integrity
- Enum extension approach (ALTER TYPE vs new type): Claude's discretion based on current schema
- Layer ordering enforcement (L2 requires L1 first): Claude's discretion based on existing validation patterns

### Claude's Discretion
- Avatar border/ring styling based on UI contrast
- Avatar size variants based on downstream phase needs
- UserAvatar component API (avatar-only vs avatar+name option)
- Warehouse stock check enforcement level (trigger vs UI for stock cap)
- Rejected records backfill handling
- Enum extension approach
- Layer ordering enforcement (DB trigger vs app-level)

</decisions>

<specifics>
## Specific Ideas

- Beam variant chosen for its friendly, approachable feel — matches internal tool aesthetic
- Layer 2 is conceptually a "warehouse assignment" not an "approval" — the naming in UI should reflect this (Phase 57 concern, but informs trigger design)
- Rejection reason is for accountability — requester should see why their request was rejected

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 55-database-foundation-useravatar*
*Context gathered: 2026-02-17*
