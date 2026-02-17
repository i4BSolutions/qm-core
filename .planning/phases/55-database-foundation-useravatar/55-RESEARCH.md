# Phase 55: Database Foundation + UserAvatar - Research

**Researched:** 2026-02-17
**Domain:** PostgreSQL enum extension + multi-layer approval schema + boring-avatars React component
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Avatar Style & Colors
- Use **Beam** variant (simple smiley face with geometric shapes)
- Use boring-avatars **default color palette** (no custom colors)
- Render as a **circle** (clipped, overflow hidden)
- No tooltip on hover — name is always shown alongside the avatar
- No fallback needed — `fullName` is always present (required field on user creation)
- No border vs subtle border: Claude's discretion based on contrast

#### Avatar Sizing
- Size variants: Claude's discretion based on downstream usage in phases 56-58
- Layout in list rows: **inline** (avatar circle next to name on same line)
- Only one person assigned per entity — no multi-avatar stacking needed
- Whether to include optional name label prop: Claude's discretion on API design

#### Trigger Status Flow
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

#### Backfill Strategy
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| APPR-06 | Existing approved stock-out records are migrated to work with the two-layer flow | Backfill strategy: UPDATE stock_out_approvals SET layer = 'admin' WHERE decision = 'approved'; UPDATE stock_out_line_items SET status = 'fully_approved' WHERE status = 'approved' AND (all its approvals have decision='approved') — must run inside migration 063 atomically |
| AVTR-01 | User profile avatars are auto-generated using boring-avatars library when displayed | boring-avatars v2.0.2 confirmed; Beam variant deterministic on `name` prop; install with `npm install boring-avatars` |
| AVTR-04 | User avatar is consistent (same user always gets same avatar) across all pages | boring-avatars is deterministic by design — same `name` string always produces same SVG; component must be a pure function of `fullName` with no random state |
</phase_requirements>

---

## Summary

Phase 55 has two independent workstreams: (1) a database migration that extends the `stock_out_approvals` table and `sor_line_item_status` enum for two-layer approval, and (2) a shared `UserAvatar` React component using boring-avatars. The two workstreams share no code and can be planned as separate tasks within the phase.

The database workstream is the more complex of the two. The existing schema in migration 052 created `stock_out_approvals` with only a flat `decision` column ('approved'/'rejected'). Migration 063 must add `layer` (TEXT, values 'quartermaster'/'admin') and `parent_approval_id` (UUID self-reference for L2 → L1 link) to `stock_out_approvals`. It must also extend `sor_line_item_status` enum with `awaiting_admin` and `fully_approved`. Five triggers need to be rewritten to enforce the new two-layer flow. The backfill is a data migration inside the same transaction.

The UserAvatar workstream is straightforward: install boring-avatars v2.0.2, create `/components/ui/user-avatar.tsx` as a client component that accepts `fullName: string` and renders an SVG avatar using the Beam variant. The component is purely presentational — it accepts data, renders SVG, no fetch, no state. The existing codebase already has a pattern for user name display (initials in header, `User` icon in comment-card) that UserAvatar replaces in downstream phases.

**Primary recommendation:** Write migration 063 as a single atomic transaction. Use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (project precedent in migrations 017 and 055) to extend the enum rather than expand-and-contract, since `ADD VALUE` is simpler and this project already uses it. Use `pg_advisory_xact_lock` (project precedent in migration 058) for any new trigger-level concurrency protection.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| boring-avatars | ^2.0.2 | Deterministic SVG avatar generation | Lightweight, TypeScript-native, deterministic by design, no external service dependency |
| PostgreSQL ALTER TYPE ADD VALUE | built-in | Extend existing enum | Project precedent (migrations 017, 055); simpler than expand-and-contract for append-only additions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_advisory_xact_lock | built-in | Serialize concurrent trigger access | Whenever new trigger touches data that concurrent transactions might also touch (project precedent: migration 058) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ALTER TYPE ADD VALUE | Expand-and-contract (rename + new type + migrate + drop) | ADD VALUE is simpler for append-only additions; expand-and-contract needed only when removing/renaming values — not the case here |
| boring-avatars | dicebear (two packages: @dicebear/core + variant) | boring-avatars is single package, simpler API; dicebear is more flexible but heavier — overkill here |
| boring-avatars | UI Avatars API (external URL) | External URL introduces network dependency and privacy concern; boring-avatars generates SVG client-side |

**Installation:**
```bash
npm install boring-avatars
```

---

## Architecture Patterns

### Recommended Project Structure

The phase produces two artifacts:

```
supabase/migrations/
└── 20260217XXXXXX_two_layer_approval_schema.sql   # migration 063

components/ui/
└── user-avatar.tsx                                 # new shared component
```

The migration file follows the timestamp format established by recent migrations (e.g., `20260216400000_usd_exchange_rate_constraints.sql`).

### Pattern 1: Enum Extension with ALTER TYPE ADD VALUE

**What:** Add new values to an existing PostgreSQL enum using `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

**When to use:** When appending new values to an existing enum without removing or renaming existing values. Cannot run inside a transaction block when targeting an existing type that has live rows — must run outside a transaction, or use a DO block with exception handling. PostgreSQL 12+ supports `ADD VALUE IF NOT EXISTS`.

**Critical Postgres constraint:** `ALTER TYPE ... ADD VALUE` cannot be run inside a transaction block if the type already has data (PostgreSQL restriction). This means the enum extension must happen either before the transaction starts, or the migration must be structured without wrapping the ADD VALUE calls in a BEGIN/COMMIT. Recent migrations in this project that use ADD VALUE (017, 055) run outside transaction blocks.

**Project precedent:**
```sql
-- From migration 017_item_categories.sql (HIGH confidence — verified in codebase)
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'item';
```

**For this phase:**
```sql
-- Extend sor_line_item_status to add two new values
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'awaiting_admin';
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'fully_approved';
```

These must run before the transaction block that adds columns and updates data.

### Pattern 2: Schema Column Addition

**What:** Add `layer` and `parent_approval_id` columns to `stock_out_approvals`.

**Layer column design:**
```sql
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS layer TEXT
  CHECK (layer IN ('quartermaster', 'admin'));

ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS parent_approval_id UUID
  REFERENCES stock_out_approvals(id) ON DELETE SET NULL;
```

Layer 1 approvals: `layer = 'quartermaster'`, `parent_approval_id = NULL`
Layer 2 approvals: `layer = 'admin'`, `parent_approval_id = <layer1_approval_id>`

**Why TEXT not enum for `layer`:** Avoids another `ALTER TYPE` dependency. The two values are stable and a CHECK constraint provides the same enforcement. This is consistent with the existing `decision` column which is TEXT + CHECK.

### Pattern 3: Backfill Data Migration

**What:** Update existing approved records to be compatible with the new two-layer flow.

**Locked decision:** Existing `approved` records get `layer = 'admin'` AND line item status backfilled to `fully_approved`.

**Recommended approach for rejected records (Claude's discretion):** Leave rejected approvals with `layer = NULL` — they are terminal states that will never be executed, so they do not block the two-layer flow. Adding a constraint like `CHECK (layer IS NOT NULL)` would need to exclude rejected records (or be applied only after backfill). Simplest: leave layer as nullable, required only when decision = 'approved'.

```sql
-- Inside transaction block (after ADD VALUE runs outside transaction)
BEGIN;

-- Step 1: Backfill layer on approved approvals
UPDATE stock_out_approvals
SET layer = 'admin',
    updated_at = NOW()
WHERE decision = 'approved'
  AND layer IS NULL
  AND is_active = true;

-- Step 2: Backfill line item status for fully-approved items
-- A line item is "fully approved" if total approved >= requested AND it currently has status='approved'
UPDATE stock_out_line_items soli
SET status = 'fully_approved',
    updated_at = NOW()
WHERE soli.status = 'approved'
  AND soli.is_active = true;

COMMIT;
```

Note: The status transition guard trigger (`validate_sor_line_item_status_transition`) must be disabled or updated BEFORE this backfill, because it currently blocks transitions from 'approved' to anything except 'partially_executed'/'executed'. The trigger rewrite in this same migration will replace that function before the backfill runs.

### Pattern 4: Trigger Rewrite Strategy

The following triggers must be rewritten or extended for two-layer flow:

**1. `validate_sor_approval()` (migration 058 version with advisory lock)**
- Currently validates: approved_quantity does not exceed requested_quantity + stock check
- Needs to add:
  - Layer 1 approval: same as before (approve qty, check stock)
  - Layer 2 approval: must have parent_approval_id pointing to a Layer 1 approval; qty <= L1 approved qty; use advisory lock on item+warehouse for stock check
  - Reject must set `layer = 'quartermaster'` automatically

**2. `update_line_item_status_on_approval()` (latest version: migration 20260211103947)**
- Currently: transitions pending → approved/rejected based on total qty
- Needs to change:
  - When L1 (quartermaster) approval submitted: if total L1 approved >= requested → transition to `awaiting_admin`
  - When L1 rejected: if total rejected covers requested qty → transition to `rejected`
  - When L2 (admin) assignment submitted: transition `awaiting_admin` → `fully_approved`

**3. `validate_sor_line_item_status_transition()` (migration 053)**
- Currently allows: approved → partially_executed, executed
- Needs to allow: pending → awaiting_admin, awaiting_admin → fully_approved, fully_approved → partially_executed → executed
- Block: direct pending → approved (old path now invalid)
- Block: approved → fully_approved (old status must not be reachable for new records)

**4. `validate_sor_fulfillment()` (migration 058 with advisory lock)**
- Currently checks: `approval_decision != 'approved'` raises exception
- Needs to change: check `layer = 'admin'` AND `decision = 'approved'` — only L2 approvals can be executed
- The advisory lock pattern (hashtext on approval_id) stays the same

**5. `compute_sor_request_status()` (migration 059 with row lock)**
- Currently counts: pending, approved, rejected, executed states
- Needs to add: count `awaiting_admin` and `fully_approved` in the aggregation
- `awaiting_admin` items → parent request status contribution: treat like "partially approved" (still active)
- `fully_approved` items → treat like old `approved` for parent-level aggregation

### Pattern 5: Advisory Lock Strategy for New Triggers

**From context:** Use `pg_advisory_xact_lock` pattern (not SELECT FOR UPDATE) to avoid deadlock with migration 059's row locks.

When Layer 2 trigger validates warehouse stock, use advisory lock on item_id + warehouse_id combination:

```sql
-- Serialize concurrent L2 approval validation for same item+warehouse
lock_key := hashtext(NEW.item_id::text || NEW.warehouse_id::text);
PERFORM pg_advisory_xact_lock(lock_key);
```

Migration 059 uses `SELECT ... FOR UPDATE` on the parent request row. If a new trigger also does `SELECT ... FOR UPDATE` on child rows, deadlock is possible. Advisory locks avoid this since they don't lock rows.

### Pattern 6: UserAvatar Component Design

**Library API (verified from GitHub):**
```tsx
import Avatar from 'boring-avatars';

<Avatar
  name="Maria Mitchell"  // deterministic seed — use full_name
  variant="beam"         // locked decision
  size={32}             // numeric pixels
  // colors omitted = use library defaults
  // square omitted = circle by default
/>
```

The `square` prop defaults to `false`, which renders a circle — matches the "circle" locked decision. No need to add CSS `rounded-full` to the SVG itself.

**Recommended UserAvatar component:**
```tsx
// /components/ui/user-avatar.tsx
"use client";

import Avatar from "boring-avatars";

interface UserAvatarProps {
  fullName: string;
  size?: number;
  className?: string;
}

export function UserAvatar({ fullName, size = 28, className }: UserAvatarProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", flexShrink: 0 }}
    >
      <Avatar
        name={fullName}
        variant="beam"
        size={size}
      />
    </span>
  );
}
```

**Size recommendations based on downstream phase usage:**
- `28` (default) — list row inline avatar next to name (phases 56, 57)
- `32` — comment card avatar (phase 58, replaces current `h-8 w-8` icon)
- `40` — header profile area (optional upgrade in a later phase)

The component is a client component (`"use client"`) because boring-avatars generates SVG via JavaScript — it cannot run as a React Server Component. This is correct since all list rows that use it are already client-rendered via data fetching.

**No name label prop needed:** The locked decision is "name always shown alongside" — this means the parent renders the name separately. The component stays focused: avatar only.

### Anti-Patterns to Avoid

- **Do not wrap ADD VALUE in a transaction block.** PostgreSQL rejects `ALTER TYPE ... ADD VALUE` inside a transaction when the enum is already in use. Always run ADD VALUE statements before the `BEGIN;` of the data migration transaction.
- **Do not reuse the old `'approved'` line item status for new records.** The new flow uses `awaiting_admin` then `fully_approved`. The old `'approved'` value must remain in the enum (for backward compatibility with existing data that has not been backfilled), but the trigger rewrite must ensure new approvals never set status to `'approved'`.
- **Do not use SELECT FOR UPDATE in new trigger functions.** Migration 059 already acquires a row lock on `stock_out_requests` via FOR UPDATE. Any new trigger that also uses FOR UPDATE risks deadlock. Use `pg_advisory_xact_lock` instead (project precedent: migration 058).
- **Do not pass userId or avatar URL to UserAvatar.** The component is data-passive: accepts `fullName: string` only. This prevents N+1 queries on list pages.
- **Do not implement UserAvatar as a Server Component.** boring-avatars uses browser SVG APIs; it must be `"use client"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic avatar generation | Custom initials + color hash | boring-avatars | Library handles color mixing, geometry, consistent seeding across browsers |
| Enum value addition | New type + migrate + drop old | ALTER TYPE ADD VALUE IF NOT EXISTS | Postgres built-in; project already uses this pattern |
| Concurrent trigger race conditions | Application-level retry loops | pg_advisory_xact_lock | DB-level; automatic release on transaction end; project precedent in migration 058 |

**Key insight:** boring-avatars is intentionally simple — one import, one component, one required prop. Do not wrap it in complexity; the value is in the determinism.

---

## Common Pitfalls

### Pitfall 1: ADD VALUE Inside Transaction Block
**What goes wrong:** `ERROR: ALTER TYPE ... ADD VALUE cannot be executed from a function or multi-command string` or similar — the migration fails on a live database.
**Why it happens:** PostgreSQL prohibits `ALTER TYPE ... ADD VALUE` within a transaction block when rows exist with that type.
**How to avoid:** Place all `ALTER TYPE ... ADD VALUE` statements at the top of the migration file, before any `BEGIN;` statement. The migration 017 in this codebase demonstrates the correct pattern.
**Warning signs:** Migration fails with "cannot be executed from a function" error.

### Pitfall 2: Status Transition Guard Blocks Backfill
**What goes wrong:** The backfill UPDATE that sets `status = 'fully_approved'` on existing `'approved'` line items is blocked by `validate_sor_line_item_status_transition()` because it doesn't allow `approved → fully_approved`.
**Why it happens:** The transition guard runs BEFORE UPDATE via trigger and raises an exception.
**How to avoid:** In migration 063, rewrite `validate_sor_line_item_status_transition()` BEFORE the backfill UPDATE. The new function must allow `approved → fully_approved` as a valid transition (for the backfill case) OR the backfill must be done with elevated privileges that skip the trigger (not recommended). Simplest: update the trigger function first.
**Warning signs:** Backfill UPDATE fails with "Cannot change line item status from approved to fully_approved".

### Pitfall 3: Execution Validation Breaks for Layer 2 Approvals
**What goes wrong:** `validate_sor_fulfillment()` checks `approval_decision != 'approved'` but Layer 2 approvals have `decision = 'approved'` + `layer = 'admin'`. The check passes correctly, but the stock check uses total item stock across all warehouses, not the specific warehouse. This is the Layer 2 stock cap problem.
**Why it happens:** The original trigger was designed before warehouses were part of the approval flow.
**How to avoid:** For Layer 2 approvals (which include a warehouse_id), validate against warehouse-specific stock using `get_warehouse_stock()` (already exists from migration 056) rather than `get_total_item_stock()`. Use advisory lock on item+warehouse combination.
**Warning signs:** Execution succeeds but creates negative warehouse stock.

### Pitfall 4: boring-avatars Import in Server Components
**What goes wrong:** Build fails or hydration mismatch because boring-avatars is imported in a Server Component.
**Why it happens:** boring-avatars generates SVG using browser-side randomness (seeded by name) and relies on the React component lifecycle.
**How to avoid:** Always add `"use client"` at the top of `user-avatar.tsx`. If a Server Component needs to display an avatar, it passes `fullName` as a prop to a client child.
**Warning signs:** `Error: document is not defined` at build time, or hydration mismatch warnings.

### Pitfall 5: compute_sor_request_status Misses New Statuses
**What goes wrong:** Parent SOR request status stays stuck at `'partially_approved'` even when all line items are `awaiting_admin` or `fully_approved`.
**Why it happens:** The aggregation in `compute_sor_request_status()` only counts: pending, approved, rejected, executed. New statuses aren't counted, defaulting to the `partially_approved` fallback.
**How to avoid:** When rewriting `compute_sor_request_status()`, add `awaiting_admin_count` and `fully_approved_count` variables. Define clear aggregation rules (see Code Examples below).
**Warning signs:** SOR list page shows incorrect parent status despite all line items being approved.

---

## Code Examples

Verified patterns from project codebase and official sources:

### Enum Extension (project pattern, migration 017)
```sql
-- Source: /supabase/migrations/017_item_categories.sql
ALTER TYPE public.entity_type ADD VALUE IF NOT EXISTS 'item';
```

Applied to this phase:
```sql
-- Run BEFORE BEGIN; block — outside any transaction
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'awaiting_admin';
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'fully_approved';
```

### Advisory Lock Pattern (project pattern, migration 058)
```sql
-- Source: /supabase/migrations/058_advisory_lock_stock_validation.sql
lock_key := hashtext(NEW.item_id::text);
PERFORM pg_advisory_xact_lock(lock_key);
```

For Layer 2 (item + warehouse combination):
```sql
lock_key := hashtext(NEW.item_id::text || NEW.warehouse_id::text);
PERFORM pg_advisory_xact_lock(lock_key);
```

### Status Aggregation with New Values
```sql
-- compute_sor_request_status() — new aggregation logic
SELECT
  COUNT(*),
  COUNT(*) FILTER (WHERE status = 'pending'),
  COUNT(*) FILTER (WHERE status = 'cancelled'),
  COUNT(*) FILTER (WHERE status = 'rejected'),
  COUNT(*) FILTER (WHERE status = 'awaiting_admin'),   -- NEW
  COUNT(*) FILTER (WHERE status = 'fully_approved'),   -- NEW (replaces old 'approved')
  COUNT(*) FILTER (WHERE status = 'approved'),         -- Legacy — may still exist from old data
  COUNT(*) FILTER (WHERE status = 'partially_executed'),
  COUNT(*) FILTER (WHERE status = 'executed')
INTO total_count, pending_count, cancelled_count, rejected_count,
     awaiting_admin_count, fully_approved_count, approved_count,
     partially_executed_count, executed_count
FROM stock_out_line_items
WHERE request_id = parent_request_id AND is_active = true;
```

Parent request status mapping for new values:
- All items `fully_approved` → parent status `'approved'` (execution ready)
- Mix of `awaiting_admin` + `fully_approved` → parent `'partially_approved'`
- Any `awaiting_admin` items with no pending → parent `'partially_approved'`

### UserAvatar Component
```tsx
// Source: boring-avatars v2.0.2 API (verified from GitHub)
// /components/ui/user-avatar.tsx
"use client";

import Avatar from "boring-avatars";

interface UserAvatarProps {
  fullName: string;
  size?: number;    // pixels, defaults to 28 for list rows
  className?: string;
}

export function UserAvatar({ fullName, size = 28, className }: UserAvatarProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", flexShrink: 0 }}
    >
      <Avatar
        name={fullName}
        variant="beam"
        size={size}
      />
    </span>
  );
}
```

Usage in a list row:
```tsx
import { UserAvatar } from "@/components/ui/user-avatar";

// Inline layout: avatar circle next to name on same line
<div className="flex items-center gap-2">
  <UserAvatar fullName={request.requester.full_name} size={28} />
  <span className="text-sm text-slate-200">{request.requester.full_name}</span>
</div>
```

### Migration 063 File Structure
```sql
-- Migration: 20260217XXXXXX_two_layer_approval_schema.sql
-- Phase: 55-database-foundation-useravatar
-- Description: Two-layer approval schema (layer + parent_approval_id columns)
--              + sor_line_item_status enum extension + backfill + trigger rewrite

-- ============================================================================
-- STEP 1: ENUM EXTENSION (must run OUTSIDE transaction block)
-- ============================================================================
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'awaiting_admin';
ALTER TYPE public.sor_line_item_status ADD VALUE IF NOT EXISTS 'fully_approved';

-- ============================================================================
-- STEP 2: SCHEMA CHANGES + TRIGGER REWRITES + BACKFILL (in transaction)
-- ============================================================================
BEGIN;

-- 2a. Add columns
ALTER TABLE stock_out_approvals
  ADD COLUMN IF NOT EXISTS layer TEXT CHECK (layer IN ('quartermaster', 'admin')),
  ADD COLUMN IF NOT EXISTS parent_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL;

-- 2b. Add index for layer lookups
CREATE INDEX IF NOT EXISTS idx_sor_approval_layer ON stock_out_approvals(layer);
CREATE INDEX IF NOT EXISTS idx_sor_approval_parent ON stock_out_approvals(parent_approval_id)
  WHERE parent_approval_id IS NOT NULL;

-- 2c. Rewrite trigger functions (validate_sor_line_item_status_transition first)
-- ... [trigger rewrites] ...

-- 2d. Backfill existing approved records
UPDATE stock_out_approvals
SET layer = 'admin', updated_at = NOW()
WHERE decision = 'approved' AND layer IS NULL AND is_active = true;

UPDATE stock_out_line_items
SET status = 'fully_approved', updated_at = NOW()
WHERE status = 'approved' AND is_active = true;

-- 2e. Comments
COMMENT ON COLUMN stock_out_approvals.layer IS 'L1=quartermaster (qty approval), L2=admin (warehouse assignment). NULL for rejected records.';
COMMENT ON COLUMN stock_out_approvals.parent_approval_id IS 'L2 approval links to its L1 parent. NULL for L1 approvals.';

COMMIT;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| boring-avatars v1.x (CommonJS) | v2.x (ESM + TypeScript native) | Sep 2025 | Better tree-shaking, no type hacks needed |
| Flat single-layer approval | Two-layer (qty → warehouse) | This phase | Execution now requires `fully_approved` not `approved` |
| `validate_sor_fulfillment` checks `decision = 'approved'` | Must check `layer = 'admin'` AND `decision = 'approved'` | This phase | Prevents L1 approvals from being directly executed |

**Deprecated/outdated:**
- `sor_line_item_status = 'approved'`: No new records will reach this state after the trigger rewrite. The value stays in the enum for backward compatibility with backfilled records that are set to `fully_approved`.
- Direct execution from `approved` status: Phase 63 locks execution to `fully_approved` only.

---

## Open Questions

1. **Layer 2 warehouse_id storage location**
   - What we know: Layer 2 approval assigns a warehouse. The existing `stock_out_approvals` table has no `warehouse_id` column. The `inventory_transactions` table has a `warehouse_id`.
   - What's unclear: Does `warehouse_id` get stored on the Layer 2 approval row itself, or is it only set at execution time on the `inventory_transactions` row?
   - Recommendation: The Phase 55 migration should add `warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT` to `stock_out_approvals`, nullable for L1 records, required (NOT NULL) for L2 records. This column is needed by Phase 57 (UI) and Phase 55 trigger validation (Layer 2 stock check). **If this is not added in migration 063, the Layer 2 stock cap enforcement in the trigger cannot reference a warehouse.** Planner should confirm this is in scope or flag to user.
   - **Impact on Phase 55 scope:** The `warehouse_id` column on `stock_out_approvals` is implied by the trigger design (Layer 2 qty cap must check specific warehouse stock) and must be in migration 063 even if Phase 57 is where the UI captures it.

2. **`sor_request_status` enum extension**
   - What we know: Parent request status is computed from line items. Currently has: pending, partially_approved, approved, rejected, cancelled, partially_executed, executed.
   - What's unclear: Do we need new parent-level status values (e.g., `awaiting_admin`) to mirror the new line item states?
   - Recommendation: The parent status `'approved'` can remain semantically valid for "all lines fully_approved" — no new parent enum values are strictly required. The parent `approved` status becomes "all lines ready to execute" which is the same meaning as before. No `ALTER TYPE sor_request_status` needed.

---

## Sources

### Primary (HIGH confidence)
- `/home/yaungni/qm-core/supabase/migrations/052_stock_out_requests.sql` — Original schema: stock_out_approvals table, sor_line_item_status enum, trigger functions
- `/home/yaungni/qm-core/supabase/migrations/053_stock_out_validation.sql` — validate_sor_approval(), update_line_item_status_on_approval(), validate_sor_line_item_status_transition()
- `/home/yaungni/qm-core/supabase/migrations/058_advisory_lock_stock_validation.sql` — Advisory lock pattern (pg_advisory_xact_lock) for validate_sor_fulfillment()
- `/home/yaungni/qm-core/supabase/migrations/059_row_lock_status_aggregation.sql` — Row lock pattern in compute_sor_request_status()
- `/home/yaungni/qm-core/supabase/migrations/017_item_categories.sql` — ALTER TYPE ADD VALUE IF NOT EXISTS project precedent
- `/home/yaungni/qm-core/supabase/migrations/20260211103947_fix_line_item_status_rejection_qty.sql` — Latest version of update_line_item_status_on_approval()
- `/home/yaungni/qm-core/types/database.ts` — Current TypeScript types for stock_out_approvals, sor_line_item_status, sor_request_status
- GitHub: boringdesigners/boring-avatars — v2.0.2 API verified: name, variant, size, colors props; Beam variant confirmed; circle default confirmed

### Secondary (MEDIUM confidence)
- boring-avatars npm page (403 fetched via WebFetch) — version and description confirmed via GitHub releases page
- boring-avatars GitHub releases page — v2.0.2 released Sep 24, 2025; TypeScript introduced in v2.0.0

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — boring-avatars API verified from official GitHub; migration patterns verified from codebase
- Architecture: HIGH — All trigger rewrites based on actual migration files read; enum extension pattern verified from project precedent
- Pitfalls: HIGH — All pitfalls identified from actual codebase patterns and PostgreSQL constraints

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (boring-avatars stable; DB patterns are project-internal)
