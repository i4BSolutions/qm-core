# Pitfalls Research

**Domain:** Adding List View Standardization, Two-Layer Approval, User Avatars, and Pagination Consistency to Existing Internal Tool (QM System)
**Researched:** 2026-02-17
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: State Machine Migration — Adding a Second Approval Layer Invalidates Existing `approved` Status Records

**What goes wrong:**
Adding a warehouse-approval layer to the stock-out workflow means existing `stock_out_approvals` records (currently covering "approve qty") must now be interpreted as "qty approved only — warehouse still pending." Records that are already `decision = 'approved'` in the current schema have no warehouse assignment. The second-layer check sees no warehouse on old approvals and either blocks execution or — worse — silently skips the second approval gate because a guard written as `WHERE warehouse_id IS NULL` treats old records as exempt.

**Why it happens:**
Developers add the new column (`approved_warehouse_id UUID`) with a `DEFAULT NULL` and then add the second-layer gate as `IF NEW.approved_warehouse_id IS NOT NULL THEN ... END IF`. Old approvals have `NULL`, so they slip through the gate, violating the new business rule. The data migration step to mark old approvals as "warehouse already confirmed" (or to re-route them into a "pending warehouse approval" queue) is skipped because "old data is old data."

**How to avoid:**
Write the migration in three explicit steps — not two:

1. Add the structural change (new column/table for warehouse approval).
2. Run a data migration that classifies every existing `approved` record:
   - For approvals whose parent SOR `status IN ('executed', 'partially_executed')`: mark warehouse approval as already completed (backfill with a sentinel or a dedicated "legacy" warehouse record).
   - For approvals whose parent SOR `status IN ('approved', 'partially_approved')`: insert a pending warehouse-approval record, reset line item status to `qty_approved_pending_warehouse`.
3. Deploy the application code that enforces the new two-layer gate.

Never do step 3 without step 2 in the same migration transaction.

```sql
-- Example backfill for completed approvals:
INSERT INTO stock_out_warehouse_approvals (
  line_item_id, approved_warehouse_id, approved_by, approved_at, is_legacy_backfill
)
SELECT
  li.id,
  it.warehouse_id,   -- use the warehouse from the actual inventory_transaction
  it.created_by,
  it.created_at,
  true
FROM stock_out_line_items li
JOIN stock_out_approvals soa ON soa.line_item_id = li.id AND soa.decision = 'approved'
JOIN inventory_transactions it ON it.stock_out_approval_id = soa.id
WHERE li.status IN ('executed', 'partially_executed');
```

**Warning signs:**
- Any SOR in `approved` or `partially_approved` status with no corresponding warehouse-approval record after migration — use this as the verification query:
  ```sql
  SELECT COUNT(*) FROM stock_out_approvals soa
  LEFT JOIN stock_out_warehouse_approvals swa ON swa.sor_approval_id = soa.id
  WHERE soa.decision = 'approved'
    AND swa.id IS NULL;
  -- Should be 0 after migration
  ```
- Any inventory_transaction with `stock_out_approval_id NOT NULL` that was created before migration date and has no warehouse approval record — this is a phantom execution from the old flow.

**Phase to address:**
The database migration phase that introduces the two-layer schema (adding the warehouse approval table or column). The data backfill must be in the same migration file, not a follow-up.

---

### Pitfall 2: Existing `validate_sor_line_item_status_transition()` Trigger Blocks the New Intermediate Status

**What goes wrong:**
Migration 053 (`trg_validate_sor_li_status_transition`) hard-codes allowed transitions. Adding a new intermediate status (e.g., `qty_approved` between `pending` and `approved`) without updating this trigger causes all new-flow transitions to raise an exception and the feature ships broken on first use.

**Why it happens:**
The transition allowlist is a static array inside the trigger function. Developers add the new enum value to `sor_line_item_status` but forget to add the corresponding transition rows to the allowlist. The ENUM update succeeds silently (Postgres allows adding enum values), the application code sends the new status, and the trigger raises `Cannot change line item status from pending to qty_approved`.

**How to avoid:**
- Add the new enum value AND update the trigger function in the same migration.
- Write a dedicated transition test function that exercises every transition path after migration:

```sql
-- Run immediately after migration to verify:
DO $$
DECLARE
  test_li_id UUID;
BEGIN
  -- Insert test line item in 'pending' state
  -- Attempt transition to 'qty_approved' — should succeed
  -- Attempt 'qty_approved' -> 'approved' — should succeed
  -- Attempt 'pending' -> 'approved' (skipping qty step) — should raise exception
  RAISE NOTICE 'Transition validation OK';
END;
$$;
```

- Keep the transition allowlist as a table, not an inline array, so it can be queried and audited without reading function source code.

**Warning signs:**
- Error `Cannot change line item status from X to Y` appearing in Supabase logs immediately after deploying a new status.
- The status enum in `pg_enum` has the new value but `update_line_item_status_on_approval()` still only references old statuses.

**Phase to address:**
Same phase as the two-layer approval schema migration. The transition trigger must be updated atomically with the enum addition.

---

### Pitfall 3: The Row-Level Locking Pattern (Migration 059) Deadlocks When Two Approvals Compete for the Same Request Row

**What goes wrong:**
Migration 059 adds `SELECT ... FOR UPDATE` on `stock_out_requests` inside `compute_sor_request_status()`. With a single approval layer this was safe: one trigger fires at a time per line item. With two approval layers, two concurrent database operations can lock the same parent request row from different parent triggers, causing a deadlock:

- Session A: Approving qty on line item 1 → locks `stock_out_requests.id`
- Session B: Approving warehouse on line item 2 (same request) → tries to lock same `stock_out_requests.id`

PostgreSQL detects the cycle and aborts one session with `ERROR: deadlock detected`.

**Why it happens:**
The advisory lock (migration 058) and the `FOR UPDATE` row lock (migration 059) are distinct mechanisms. Adding a second trigger chain (warehouse approval → line item status → request status) introduces a new path to the same `FOR UPDATE` lock on `stock_out_requests`. Two threads competing on different line items of the same request both converge on the parent row lock.

**How to avoid:**
Use the advisory lock pattern exclusively (migration 058 approach) for the warehouse approval layer — do NOT add another `FOR UPDATE` in the new trigger. Advisory locks are transaction-scoped, use the same `hashtext(request_id::text)` key, and serialize correctly without deadlock because PostgreSQL advisory locks are cooperative:

```sql
-- In the new warehouse approval status aggregation trigger:
CREATE OR REPLACE FUNCTION compute_sor_status_from_warehouse_approval()
RETURNS TRIGGER AS $$
DECLARE
  lock_key BIGINT;
  parent_request_id UUID;
BEGIN
  -- Reuse the same advisory lock key as the existing trigger (migration 059)
  SELECT li.request_id INTO parent_request_id
  FROM stock_out_line_items li WHERE li.id = NEW.line_item_id;

  lock_key := hashtext(parent_request_id::text);
  PERFORM pg_advisory_xact_lock(lock_key);  -- Blocks, does not deadlock

  -- Now compute new status safely
  -- ...
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Remove the `FOR UPDATE` from `compute_sor_request_status()` in migration 059 if the advisory lock key is shared — the two mechanisms conflict and double-locking the same row is deadlock-prone.

**Warning signs:**
- `ERROR: deadlock detected` in Supabase logs involving `stock_out_requests` and `stock_out_line_items`.
- UI: Stock-out approval actions silently fail (the rolled-back transaction shows as "no change" rather than an error if the app catches exceptions generically).
- pg_stat_activity shows sessions blocked with `wait_event = 'relation'` on `stock_out_requests`.

**Phase to address:**
The two-layer approval database phase. Review lock acquisition order across all triggers that touch `stock_out_requests` before writing a single line of new trigger code.

---

### Pitfall 4: Client-Side Pagination on Fetch-All Queries Causes Silent Data Truncation

**What goes wrong:**
Multiple list pages (QMRL, QMHQ, PO) fetch with `.limit(100)` from Supabase, then slice client-side for pagination display. When a list grows beyond 100 records, the pagination UI shows "Page 1 of 5 (of 100 items)" while the actual database has 240 records. Users assume they are seeing all data, make business decisions on incomplete information. No error, no warning — the pagination math is just wrong because `totalItems` is capped at 100.

**Why it happens:**
The pattern is already established in the codebase: `/qmrl/page.tsx` line 76 uses `.limit(100)` and then does client-side slice. This is a known shortcut (`totalItems = filteredQmrls.length`, always <= 100). Standardizing pagination across pages without changing this architectural decision copies the bug to new pages.

**How to avoid:**
Server-side pagination via Supabase range queries with count:

```typescript
// WRONG (current pattern):
const { data } = await supabase
  .from('stock_out_requests')
  .select('*')
  .limit(100);  // Silent truncation at 100

// CORRECT:
const from = (currentPage - 1) * pageSize;
const to = from + pageSize - 1;

const { data, count } = await supabase
  .from('stock_out_requests')
  .select('*', { count: 'exact' })
  .range(from, to)
  .order('created_at', { ascending: false });

// totalItems = count (database total, not array length)
```

Standardization phase must change the fetch architecture, not just copy the Pagination component. Pages that already have `.limit(100)` need `{ count: 'exact' }` + `.range()` before the Pagination component is meaningful.

**Warning signs:**
- `totalItems` in any list page equals exactly 100, 50, or 20 (a configured limit value) despite UI showing "Page X of Y".
- Pagination shows multiple pages but filtering reveals far fewer records than expected when switching to a filter that includes only recent records.
- Stock-out-requests page (`page.tsx`) has no Pagination import at all — it fetches all and renders all in the table view with no paging.

**Phase to address:**
Pagination standardization phase. Before adding the Pagination component to any page, verify the data fetch uses server-side range + count, not client-side slice.

---

### Pitfall 5: Avatar Component Initiates N+1 User Fetches When Rendered in List Rows

**What goes wrong:**
A naive `<UserAvatar userId={...} />` component that fetches user data independently triggers one Supabase query per avatar per row. A list of 20 stock-out requests with requesters and approvers renders 40 individual `users` table queries. Supabase's connection pool saturates on list pages; the page load time is 5-8 seconds instead of 200ms.

**Why it happens:**
Avatar components are designed for convenience — pass a `userId`, get an avatar. This is ergonomic when the component is used once per page (header, profile). When used in list rows, each row mounts independently and each component fires its own `useEffect` fetch, unaware of sibling fetches for the same users.

**How to avoid:**
Two valid patterns — choose one per context:

**Pattern A (preferred for lists): Fetch users with the list query, pass `user` object as prop:**
```typescript
// List page: join users in the main query
const { data } = await supabase
  .from('stock_out_requests')
  .select(`
    id, status, reason,
    requester:users!requester_id(id, full_name),
    approved_by:users!qty_approver_id(id, full_name)
  `);

// Row component receives full user objects
<RequestRow request={request} />

// Avatar receives pre-fetched user (no fetch needed)
<UserAvatar user={request.requester} size="sm" />
```

**Pattern B (for detail pages where user list unknown at render): Fetch all needed users once at page level, provide via context:**
```typescript
// Detail page: collect all user IDs, fetch once
const allUserIds = [...new Set([
  log.changed_by,
  ...approvals.map(a => a.decided_by)
])].filter(Boolean);

const { data: usersMap } = await supabase
  .from('users')
  .select('id, full_name')
  .in('id', allUserIds);

// Context or prop: usersById: Record<string, User>
```

Never build `<UserAvatar userId={userId} />` that internally fetches. The component must accept a `user` object or `initials`/`name` string, not a UUID.

**Warning signs:**
- Supabase project dashboard shows "Users" table appearing disproportionately often in the query stats relative to business tables.
- Network tab in browser shows 15-30 simultaneous GET requests to `/rest/v1/users` on list page load.
- List page load time measured in seconds rather than milliseconds.

**Phase to address:**
Avatar implementation phase. The component API must be designed as data-passive (receives user data) from the start. This is unrecoverable by refactor without touching every callsite.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Client-side pagination with `.limit(100)` | Simple code, no server-side complexity | Silent data truncation above limit; pagination math lies | Never for production user-facing lists |
| Avatar component that fetches by `userId` | Convenient at callsite | N+1 queries on any list; saturates connection pool | Only in single-user contexts (profile page, header) |
| Copying `.limit(100)` pattern to new pages during "standardization" | Fast to implement | Propagates the truncation bug to more pages | Never |
| Adding new enum value without updating transition trigger | Faster migration | Feature breaks on first state transition; silent ENUM accepts it, trigger blocks it | Never |
| Reusing `FOR UPDATE` locking pattern from migration 059 in new triggers | Consistent with existing code | Deadlock when two triggers compete on same row | Never without auditing all lock acquisition paths first |
| Using `changed_by_name` cached text in audit_logs without avatar | No join needed for history display | History tab shows names but no visual identity; inconsistent with everywhere else that now has avatars | Acceptable for initial history implementation, but becomes inconsistent debt when avatars land elsewhere |

---

## Integration Gotchas

Common mistakes when adding these features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Two-layer approval + existing idempotency constraint (`idx_unique_approval_execution`) | Adding a warehouse approval record as a new row in `stock_out_approvals` with a new FK causes the unique partial index to block the second approval's execution because it treats both approvals as competing for the same execution slot | Keep the two layers in separate tables: `stock_out_approvals` (qty layer), `stock_out_warehouse_approvals` (warehouse layer). The unique index on `inventory_transactions(stock_out_approval_id)` then correctly governs per-qty-approval execution |
| User avatars + existing `changed_by_name TEXT` cache in `audit_logs` | Displaying avatar in history requires a join to `users` for the avatar initials, but `changed_by_name` was cached to avoid this join. Developers add a second join and the column becomes redundant — or worse, inconsistent when a user's name changes | Use `changed_by UUID` for avatar fetching (batch-fetched at page level via Pattern B above). `changed_by_name` remains as fallback display text when `changed_by` is NULL (system actions). Explicitly document this dual-field convention |
| Pagination + card-view grouped layout | Grouping by status after server-side pagination means a page of 20 records might have 19 in one group and 1 in another, breaking the grouped layout assumption. Current QMRL, QMHQ, and PO pages group the full client-side result — this breaks with real server-side pagination | For grouped card views: either fetch all (no pagination, just virtual scroll) or paginate within each status group separately using `status_id` filter + individual counts per group |
| List view toggle + existing card-only pages | Pages without list view (item, warehouse, admin pages) need list view added. Copying the toggle UI without implementing the list table for that entity results in a toggle that switches to a blank/broken view | Require both card and list implementations before shipping the toggle button |
| Pagination component + stock-out-requests page | The existing stock-out-requests page has no Pagination import and no page state — it renders all records in table view. Adding Pagination without changing the fetch pattern (it uses `.order().eq()` with no limit) works correctly by accident only as long as record count stays low | Add server-side range + count to stock-out-requests fetch before adding the Pagination component |
| Two-layer approval + existing audit trigger | The current `audit_triggers.sql` (migration 026) logs changes to `stock_out_approvals`. A new `stock_out_warehouse_approvals` table has no audit trigger by default. Warehouse approval actions (approve/reject warehouse) won't appear in entity history | Add audit trigger to the new warehouse approval table in the same migration that creates it |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Client-side filter + sort on fetch-all lists | Filtering works but count in tabs/badges is always total (no filter-aware count); search feels instant at low volume but lags at 500+ records | Move filter logic to Supabase query parameters | Around 200-300 records per table |
| Rendering all avatars in history tab (50 entries) with individual user fetches | History tab takes 3-5 seconds to load after audit log count grows | Batch-fetch all `changed_by` UUIDs from the 50 log entries in one query | After ~10 history entries in the tab (10 unique users = 10 queries vs 1) |
| Grouping records client-side for kanban view after server-side pagination | Group counts shown in column headers are wrong (show page count not total count) | For group counts, run `SELECT status, COUNT(*) GROUP BY status` as a separate count query | Any time records span more than one page |
| Pagination state in URL (`?page=2`) vs React state | User shares link to page 2, recipient sees page 1 (state not in URL); back button loses page position | Sync pagination state to URL search params via `useSearchParams` | Users start sharing direct links or using back navigation |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Two-layer approval where the same user can approve both layers for their own request | Approval circumvention: a malicious user self-approves qty AND warehouse assignment, bypasses oversight | Add `CHECK (warehouse_approver_id != requester_id)` at DB level AND RLS policy that prevents inserting warehouse approval where `auth.uid() = parent_request.requester_id` |
| Avatar component receives `userId` and fetches from `users` table without RLS restriction | Any authenticated user can observe user full names by inspecting network requests, even for users they cannot otherwise see | Ensure `users` table RLS policy restricts `SELECT` to relevant context; or expose only `id + initials + color` in a `user_display_profiles` view without PII |
| Warehouse approval step performed by same role that performs qty approval (if business rule requires separation) | One person can complete entire approval chain, defeating the two-layer control | Enforce in DB: warehouse approver must have a different role, or at minimum be a different user (`warehouse_approver_id != qty_approver_id`) |
| Pagination with server-side range queries bypasses existing RLS | If range query is computed on a pre-filtered client count but RLS filters more rows server-side, `count` from Supabase is RLS-scoped but page math done on unfiltered count — shows "Page 1 of 3" when there are actually 0 items on page 3 | Always use `count: 'exact'` from Supabase (which is RLS-aware) rather than computing totalPages from a separate unguarded count |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Two-layer approval shows as "Pending" at both stages with no differentiation | Approvers cannot distinguish "pending qty approval" from "pending warehouse approval" — both show the same badge | Use distinct badge labels: "Awaiting Qty Approval" vs "Awaiting Warehouse" — or use a two-dot progress indicator showing which stage is active |
| Avatars shown only on list pages but not on detail pages (or vice versa) | Inconsistent identity display erodes trust — users expect the same person to look the same everywhere | Roll out UserAvatar component to all user-reference contexts in one phase, not incrementally |
| Pagination persists to page 5, user applies filter, page 5 returns empty | User sees blank page with no explanation — they are on page 5 of a 2-page filtered result | Reset `currentPage` to 1 on every filter change (QMRL page does this correctly; ensure all new pages replicate the `useEffect([searchQuery, ...], () => setCurrentPage(1))` pattern) |
| List view shows fewer columns than card view communicates | User switches to list view expecting to scan all data; critical fields (e.g., approved qty, warehouse) are omitted in list table | Define list view column spec before implementation; minimum required: ID, requester, status, key financial/qty field, date, actions |
| Two-layer approval history in audit log shows two "Approved" events with no label distinguishing layers | History tab confusing — which approval was qty, which was warehouse? | Ensure audit log `changes_summary` includes the approval layer: `"Qty approved: 50 units"` vs `"Warehouse approved: Central Warehouse"` |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Two-layer approval UI**: Both approval stages are visible in the detail page — verify that the execution (stock-out) button is gated on BOTH layers, not just one. Check: can you execute after only qty approval but before warehouse approval?
- [ ] **UserAvatar in list rows**: Avatar renders correctly — verify it shows correct initials for all users including users with one-word names (no space in full_name splits to empty slice). Test with `full_name = "Admin"`.
- [ ] **Pagination standardization**: Pagination component is present — verify `totalItems` equals actual database row count, not array length. Run `SELECT COUNT(*) FROM table` in psql and compare to what the UI displays.
- [ ] **List view toggle on all pages**: Toggle button present — verify list view actually renders a table with data, not an empty or skeleton state. Toggle all new pages to list mode after each phase.
- [ ] **Audit history for two-layer approvals**: Approval records appear in history tab — verify the new `stock_out_warehouse_approvals` table has an audit trigger (not just `stock_out_approvals`).
- [ ] **Avatar in history tab**: `changed_by_name` displays in history — verify avatar initials match `changed_by_name` (they come from different sources: name from cached text, avatar from UUID lookup; they can diverge if user renames).
- [ ] **Page size preference reset on navigation**: User sets page size to 50, navigates away, returns — verify page size resets to default 20 or is persisted consistently. Inconsistency across pages creates confusion.
- [ ] **Filter + pagination interaction**: Filters applied — verify status-tab counts update to reflect filtered total, not total-total. (Stock-out-requests page status counts use the full `requests` array, correct for in-memory; server-side pages need separate count queries per status group.)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Old approvals bypass warehouse gate after migration | HIGH | 1. Emergency migration to mark all existing approvals as "warehouse confirmed" with a backfill flag. 2. Audit all SOR executions that occurred in the gap window. 3. Confirm no phantom stock reductions from improper gate bypass. |
| Transition trigger blocks new status after ENUM addition | LOW | Write a new migration that updates `validate_sor_line_item_status_transition()` to include the new transition. Deploy immediately. No data corruption, only functional breakage. |
| Deadlock detected in approval triggers | MEDIUM | 1. Identify which triggers hold conflicting locks via `pg_locks`. 2. Migrate to advisory lock pattern in the conflicting trigger. 3. Remove `FOR UPDATE` from the trigger that competes. Requires migration + deploy but no data repair. |
| Client-side pagination truncated data (limit 100) was live for weeks | MEDIUM | 1. Identify which business decisions were made from pages where count was artificially capped. 2. Audit report: run actual count queries and compare to what was displayed. 3. Fix the fetch architecture. No data loss, but business trust impact. |
| Avatar N+1 saturating connection pool | MEDIUM | 1. Add connection pool increase temporarily in Supabase dashboard. 2. Remove all UserAvatar components that fetch internally. 3. Rebuild with data-passive pattern. 4. Restore pool to normal settings. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| State machine migration invalidates existing `approved` records | Two-layer approval database migration phase | Run verification query: count `stock_out_approvals` where `decision = 'approved'` AND no corresponding warehouse approval record — must be 0 |
| Transition trigger blocks new intermediate status | Same migration as ENUM addition (atomic) | Run DO block after migration that exercises all valid and invalid transition paths |
| Row lock deadlock from competing triggers | Two-layer approval trigger design phase | Load test: 10 concurrent approvals on different line items of same request — zero deadlock errors |
| Client-side pagination silent truncation | Pagination standardization phase | Insert 150 test records in staging, verify paginated list shows all 150 (total count in UI = 150, not 100) |
| Avatar N+1 queries | Avatar implementation phase | Load list page with 20 rows, inspect network tab — exactly 1 users query, not 20 |
| Old data bypasses warehouse gate | Before warehouse approval gate is enforced in DB | Row count of "gated" approvals with no warehouse record must be 0 |
| Grouped card view breaks with server-side pagination | Pagination standardization phase | For each page that uses grouped card view: group counts in column headers must sum to database total, not page size |
| Missing audit trigger on new warehouse approval table | Warehouse approval schema migration | Insert a test warehouse approval, verify entry appears in audit_logs for the parent SOR entity |

---

## Sources

### State Machine Migrations in Production Systems
- PostgreSQL documentation on ALTER TYPE (adding enum values without table rewrite): transaction-safe since PostgreSQL 12, but triggers referencing the enum require explicit function update
- QM System migration 053 (`validate_sor_line_item_status_transition`) — existing transition enforcement pattern
- QM System migration 20260211102133 — real case study of fixing premature status transition, confirms trigger must be updated atomically with business rule change

### Concurrency and Locking
- QM System migration 058 (`advisory_lock_stock_validation`) — existing advisory lock pattern with `hashtext()` key
- QM System migration 059 (`row_lock_status_aggregation`) — existing `FOR UPDATE` pattern; source of deadlock risk when combined with new trigger chains
- QM System migration 062 (`idempotency_constraint_execution`) — partial unique index pattern that governs execution idempotency; must not be broken by second-layer approval records

### Pagination Architecture
- QM System `/qmrl/page.tsx` lines 60-81 — documented `.limit(100)` + client-side slice pattern (the baseline anti-pattern)
- QM System `/components/ui/pagination.tsx` — existing Pagination component; accepts `totalItems` and `totalPages` from caller; is agnostic to whether count is real or capped
- Supabase PostgREST docs: `select('*', { count: 'exact' })` + `.range(from, to)` — server-side pagination with RLS-aware count

### Avatar Performance
- React performance pattern: "lift data fetching" — components that receive data via props rather than fetching independently scale linearly
- QM System `components/comments/comment-card.tsx` — existing pattern where avatar is just a static div with `<User />` icon (no fetch); confirms the system does not yet have a real avatar component
- QM System `components/layout/header.tsx` `getInitials()` function — existing initials logic that should be extracted to shared utility for the avatar component

### Audit Log and User Display
- QM System `025_audit_logs.sql` — `changed_by UUID` + `changed_by_name TEXT` dual-field design; `changed_by_name` is cached at write time for display without joins
- QM System `components/history/history-tab.tsx` line 257 — current implementation uses `log.changed_by_name` text only, no avatar; confirms gap that the avatar feature must fill

### Two-Layer Approval Design
- QM System existing three-table structure: `stock_out_requests`, `stock_out_line_items`, `stock_out_approvals` — the new warehouse layer must integrate without breaking idempotency constraint (`idx_unique_approval_execution` in migration 062)
- PostgreSQL advisory lock semantics: same `pg_advisory_xact_lock(key)` call from two sessions with the same key serializes correctly; two sessions competing for the same `FOR UPDATE` row lock deadlock if acquired in different orders

---
*Pitfalls research for: Adding list view standardization, two-layer stock-out approval, user avatars, and pagination consistency to QM System*
*Researched: 2026-02-17*
