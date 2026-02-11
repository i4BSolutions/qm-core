# Pitfalls Research

**Domain:** UI Standardization, Request Flow Tracking, and RBAC Role Overhaul for Existing Internal Management System
**Researched:** 2026-02-11
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Enum Migration Without Data Remapping Strategy

**What goes wrong:**
Changing PostgreSQL enum values (7 roles → 3 roles) without a clear data migration strategy causes users to lose access or get locked out. The database has 66 migrations, 132+ references to `get_user_role()`, and active users with roles like `quartermaster`, `finance`, `inventory`, `proposal`, `frontline` that need mapping to new `qmrl`/`qmhq` roles. PostgreSQL enums cannot have values removed or reordered without dropping and recreating the type, which breaks foreign key references and RLS policies.

**Why it happens:**
Developers assume enum changes work like adding a column. They create a new migration that attempts `ALTER TYPE user_role DROP VALUE 'quartermaster'`, which PostgreSQL rejects. They then try to drop and recreate the enum, but fail because 132+ RLS policies, functions, and table columns reference the enum type. The migration script doesn't address the existing user data, leaving users stranded with invalid role values.

**How to avoid:**
Use the **expand-and-contract pattern** for enum migrations:

1. **Expand Phase** (Migration 1):
   - Create temporary enum `user_role_new` with only 3 values: `admin`, `qmrl`, `qmhq`
   - Add new column `role_new user_role_new` to users table
   - Create mapping function that converts old role → new role:
     ```sql
     admin → admin
     quartermaster → admin
     finance → qmhq
     inventory → qmhq
     proposal → qmrl
     frontline → qmrl
     requester → qmrl
     ```
   - Update all existing users: `UPDATE users SET role_new = map_old_role_to_new(role)`
   - Verify 100% of users have `role_new` populated

2. **Contract Phase** (Migration 2, deployed AFTER verify):
   - Drop all RLS policies referencing `role` column
   - Drop functions `get_user_role()`, `has_role()` that return old enum
   - Rename column: `ALTER TABLE users RENAME COLUMN role TO role_old`
   - Rename column: `ALTER TABLE users RENAME COLUMN role_new TO role`
   - Drop old enum: `DROP TYPE user_role` (now safe, no references)
   - Rename new enum: `ALTER TYPE user_role_new RENAME TO user_role`
   - Recreate RLS policies using new enum
   - Recreate functions using new enum

3. **Cleanup Phase** (Migration 3):
   - Drop `role_old` column after 1+ week of monitoring

**Warning signs:**
- Migration attempts `ALTER TYPE ... DROP VALUE` (PostgreSQL will reject)
- Migration attempts `DROP TYPE user_role` but fails with "type is still referenced"
- No mapping table or function to convert old roles to new roles
- No verification query to check 100% user coverage before column swap
- RLS policy recreation not in same transaction as enum change

**Phase to address:**
Phase 1: Database Foundation - Must include complete enum migration strategy with verification steps before proceeding to middleware/UI changes.

---

### Pitfall 2: RLS Policy Cascade Failures After Role Change

**What goes wrong:**
After changing role enum, recreating RLS policies without accounting for dependency order causes cascade failures. The system has 132+ references to `get_user_role()` across 9 migration files. Policies on tables like `qmrl`, `qmhq`, `purchase_orders`, `invoices`, `financial_transactions`, `file_attachments`, `comments` all check role. Dropping and recreating policies out of order breaks foreign key cascades or leaves tables unprotected (RLS disabled but no policies = all data public).

**Why it happens:**
Developer drops all policies at once, recreates `get_user_role()` function with new enum, then recreates policies. But during the window between drop and recreate, tables are UNPROTECTED. If deployment fails mid-migration or transaction rollback occurs, production database is left with RLS enabled but no policies (queries return empty results) or RLS disabled entirely (data breach).

Additionally, foreign key constraints with `ON DELETE CASCADE` can conflict with RLS policies. If a parent record deletion cascades to children, but the user doesn't have RLS permissions on the child table, the cascade fails with a permission error.

**How to avoid:**

1. **Atomic Policy Recreation:**
   ```sql
   BEGIN;
     -- Drop policies in dependency order (children first, parents last)
     DROP POLICY IF EXISTS comments_select_policy ON comments;
     DROP POLICY IF EXISTS file_attachments_select_policy ON file_attachments;
     DROP POLICY IF EXISTS qmhq_select_policy ON qmhq;
     DROP POLICY IF EXISTS qmrl_select_policy ON qmrl;

     -- Recreate functions
     CREATE OR REPLACE FUNCTION get_user_role() ...;

     -- Recreate policies in reverse order (parents first, children last)
     CREATE POLICY qmrl_select_policy ON qmrl ...;
     CREATE POLICY qmhq_select_policy ON qmhq ...;
     CREATE POLICY file_attachments_select_policy ON file_attachments ...;
     CREATE POLICY comments_select_policy ON comments ...;
   COMMIT;
   ```

2. **Policy Verification Query:**
   After migration, verify every table with RLS enabled has at least one policy:
   ```sql
   SELECT tablename
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN (
       SELECT tablename FROM pg_policies WHERE schemaname = 'public'
     )
     AND rowsecurity = true
   EXCEPT
   SELECT tablename FROM pg_policies WHERE schemaname = 'public';
   ```
   Result should be empty. If not, tables have RLS enabled but no policies.

3. **Cascade Delete Compatibility:**
   Review all `ON DELETE CASCADE` constraints to ensure they don't conflict with RLS:
   - `users` → `qmrl.created_by` (SET NULL safer than CASCADE)
   - `users` → `qmhq.assigned_to` (SET NULL safer)
   - Auth user deletion should cascade properly (already ON DELETE CASCADE)

**Warning signs:**
- Migration script drops policies but doesn't recreate them in same transaction
- No verification query after policy recreation
- Mixed cascade constraint types (`CASCADE` on parent, `RESTRICT` on child)
- RLS policy uses foreign key relationship but cascade delete is configured
- Empty query results after migration (RLS enabled, no matching policies)

**Phase to address:**
Phase 1: Database Foundation - Include policy dependency graph, atomic recreation script, and verification queries as pre-merge checklist.

---

### Pitfall 3: Middleware Authorization Breaking on Deployment

**What goes wrong:**
Next.js middleware updates to check new 3-role system deploy successfully but break authentication flow due to CVE-2025-29927 (authorization bypass via `x-middleware-subrequest` header), middleware execution order changes, or session refresh timing issues. The system uses `middleware.ts` + `lib/supabase/middleware.ts` with session timeout tracking in `localStorage`. Middleware changes that don't account for Vercel vs. self-hosted environments, Edge runtime constraints, or Auth.js version differences cause users to be logged out randomly or unable to access protected routes.

**Why it happens:**
Developer updates `middleware.ts` to check for `admin`, `qmrl`, or `qmhq` roles instead of old 7 roles. They test locally (works fine), deploy to Vercel (breaks). Root causes:
- **CVE-2025-29927**: Self-hosted deployments with `output: standalone` are vulnerable to middleware bypass via header injection. Vercel deployments are NOT affected, but if later migrating to self-hosted, security holes open.
- **Session refresh race condition**: Middleware refreshes auth tokens, but if session update fails, subsequent requests use stale session. User appears logged in but queries fail due to expired JWT.
- **Edge runtime limitations**: Middleware runs in Edge runtime (no Node.js APIs). If new role checking logic uses Node-only features (filesystem, crypto modules), deployment succeeds but middleware fails at runtime.

**How to avoid:**

1. **Security Hardening:**
   - Add header check to reject requests with `x-middleware-subrequest`:
     ```typescript
     // In middleware.ts
     if (request.headers.get('x-middleware-subrequest')) {
       return new Response('Forbidden', { status: 403 });
     }
     ```
   - Note: Only critical if planning self-hosted deployment. Vercel already blocks this.

2. **Session Refresh Guard:**
   ```typescript
   const { data: { session }, error } = await supabase.auth.getSession();

   if (error) {
     console.error('Session fetch error:', error);
     return NextResponse.redirect(new URL('/login', request.url));
   }

   // Explicit refresh before role check
   const { data: { session: refreshedSession } } =
     await supabase.auth.refreshSession();

   if (!refreshedSession) {
     return NextResponse.redirect(new URL('/login', request.url));
   }
   ```

3. **Edge Runtime Compatibility:**
   - Test that role-checking function works in Edge runtime
   - Avoid using `fs`, `crypto` (Node built-ins)
   - Use `@supabase/ssr` package methods designed for Edge

4. **Deployment Testing Checklist:**
   - [ ] Test in Vercel preview deployment before production
   - [ ] Verify session refresh works across page navigations
   - [ ] Test with multiple tabs open (session sync)
   - [ ] Test session timeout (6 hours) forces re-login
   - [ ] Test role change: admin → qmrl (user should be logged out and re-login)

**Warning signs:**
- Middleware works locally, fails in Vercel preview
- Users report random logouts after deployment
- Auth errors in Vercel logs: "Session expired" or "Invalid JWT"
- Middleware uses `require()` or Node.js built-ins
- No header injection protection for self-hosted deployments

**Phase to address:**
Phase 2: Middleware & Auth Updates - Deploy with feature flag, test in staging, monitor error rates before full rollout.

---

### Pitfall 4: Flow Tracking Query Becomes N+1 Performance Nightmare

**What goes wrong:**
Admin flow tracking page that joins across `qmrl → qmhq → purchase_orders → invoices → inventory_transactions → stock_out_requests → stock_out_approvals` becomes unusably slow. Developer builds the page with multiple sequential queries in React components, creating N+1 patterns. With 100+ QMRLs, each having 5+ QMHQ lines, each with 3+ POs, the page makes 2000+ database queries and takes 30+ seconds to load.

**Why it happens:**
Developer creates flow tracking page with component structure like:
```tsx
<QMRLList>               // Query 1: Fetch all QMRLs
  {qmrls.map(qmrl =>
    <QMRLRow qmrl={qmrl}>
      <QMHQList qmrlId={qmrl.id}>  // Query 2-101: Fetch QMHQ per QMRL
        {qmhqs.map(qmhq =>
          <POList qmhqId={qmhq.id}>   // Query 102-601: Fetch POs per QMHQ
            ...
```

Each component fetches its own data on mount. The system already has performance issues (see CONCERNS.md):
- "All Dashboard Pages Use force-dynamic" - no caching
- "Large List Fetches Without Pagination" - 100+ items in memory
- "N+1 Query Patterns" - 5+ queries per page load already

Adding flow tracking multiplies this by 20x.

**How to avoid:**

1. **Single Denormalized Query Strategy:**
   ```sql
   SELECT
     qmrl.id AS qmrl_id,
     qmrl.request_id,
     qmrl.title,
     qmrl.status_id,
     qmhq.id AS qmhq_id,
     qmhq.line_name,
     qmhq.route_type,
     po.id AS po_id,
     po.po_number,
     po.status AS po_status,
     inv.id AS invoice_id,
     inv.invoice_number,
     inv.is_voided,
     it.id AS inventory_transaction_id,
     it.transaction_type
   FROM qmrl
   LEFT JOIN qmhq ON qmhq.qmrl_id = qmrl.id
   LEFT JOIN purchase_orders po ON po.qmhq_id = qmhq.id
   LEFT JOIN invoices inv ON inv.purchase_order_id = po.id
   LEFT JOIN inventory_transactions it ON it.invoice_id = inv.id
   WHERE qmrl.is_active = true
   ORDER BY qmrl.created_at DESC
   LIMIT 100;
   ```

   This returns flat rows. Client-side code groups by `qmrl_id` to reconstruct hierarchy.

2. **Materialized View for Expensive Aggregations:**
   If query still slow (10+ seconds), create materialized view:
   ```sql
   CREATE MATERIALIZED VIEW qmrl_flow_summary AS
   SELECT
     qmrl.id,
     qmrl.request_id,
     COUNT(DISTINCT qmhq.id) AS total_qmhq_lines,
     COUNT(DISTINCT po.id) AS total_pos,
     COUNT(DISTINCT inv.id) AS total_invoices,
     COUNT(DISTINCT it.id) AS total_inventory_transactions,
     SUM(CASE WHEN po.status = 'closed' THEN 1 ELSE 0 END) AS closed_pos,
     MAX(it.created_at) AS last_activity_date
   FROM qmrl
   LEFT JOIN qmhq ON qmhq.qmrl_id = qmrl.id
   LEFT JOIN purchase_orders po ON po.qmhq_id = qmhq.id
   LEFT JOIN invoices inv ON inv.purchase_order_id = po.id
   LEFT JOIN inventory_transactions it ON it.invoice_id = inv.id
   GROUP BY qmrl.id;

   CREATE INDEX idx_qmrl_flow_request_id ON qmrl_flow_summary(request_id);
   CREATE INDEX idx_qmrl_flow_last_activity ON qmrl_flow_summary(last_activity_date);
   ```

   Refresh strategy:
   - **Manual**: Admin page has "Refresh Flow Data" button
   - **Scheduled**: PostgreSQL cron job refreshes every 30 minutes
   - **Trigger-based**: Update on major state changes (PO closed, invoice created)

3. **Pagination + Virtual Scrolling:**
   Don't load all 100+ QMRLs at once. Use:
   - Server-side pagination: 20 QMRLs per page
   - Virtual scrolling library (react-window) if keeping client-side
   - Infinite scroll with cursor-based pagination

4. **Index Strategy:**
   Ensure indexes exist on all join columns:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_qmhq_qmrl_id ON qmhq(qmrl_id);
   CREATE INDEX IF NOT EXISTS idx_po_qmhq_id ON purchase_orders(qmhq_id);
   CREATE INDEX IF NOT EXISTS idx_invoice_po_id ON invoices(purchase_order_id);
   CREATE INDEX IF NOT EXISTS idx_inventory_invoice_id ON inventory_transactions(invoice_id);
   ```

   Verify with `EXPLAIN ANALYZE` that indexes are used:
   ```sql
   EXPLAIN ANALYZE
   SELECT ... FROM qmrl LEFT JOIN qmhq ... LIMIT 100;
   ```
   Look for "Index Scan" not "Seq Scan" on joined tables.

**Warning signs:**
- Page load time > 5 seconds in development (will be 20+ in production)
- Browser DevTools Network tab shows 100+ requests to `/api/*` or Supabase
- React DevTools shows component tree re-rendering 1000+ times
- `EXPLAIN ANALYZE` shows "Nested Loop" joins with "Seq Scan" on large tables
- Database CPU spikes when flow tracking page is accessed

**Phase to address:**
Phase 3: Flow Tracking Implementation - Include query optimization, indexing strategy, and materialized view as part of initial implementation. DO NOT build UI first then "optimize later."

---

### Pitfall 5: UI Standardization Breaking Working Pages

**What goes wrong:**
Refactoring components for consistency (e.g., standardizing all forms to use shared `FormInput`, `FormSelect` components) inadvertently breaks working pages. The codebase has 44K lines of TypeScript with large component files (993 lines for stock-in, 923 for invoice creation). Standardization changes props, removes custom validation logic, or alters state management patterns that working components depend on. After deployment, forms fail to submit, dropdowns don't populate, or validation errors appear incorrectly.

**Why it happens:**
Developer creates standardized components:
- `FormInput` replaces inline `<input>` tags across 50+ files
- `FormSelect` replaces custom select implementations
- New components have different prop names (`value` → `defaultValue`)
- New components use different validation timing (onBlur → onChange)
- New components missing features old components had (e.g., inline creation for categories)

Developer uses find-replace to update all files, tests a few pages, deploys. But edge cases break:
- Invoice form has custom currency formatting in input - new `FormInput` strips formatting
- Stock-out form has warehouse selection that filters items - new `FormSelect` doesn't trigger filter callback
- PO line items table has inline editing - new components don't support table context

**How to avoid:**

1. **Parallel Implementation Strategy:**
   - Create new standardized components with `v2` suffix: `FormInputV2`, `FormSelectV2`
   - Migrate pages ONE AT A TIME, testing each fully before next
   - Keep old and new components side-by-side during transition
   - Delete old components only after 100% migration confirmed

2. **Component API Compatibility Layer:**
   If old components used certain props, new components should support them:
   ```typescript
   interface FormInputProps {
     value?: string;           // Old prop
     defaultValue?: string;    // New prop
     onChange?: (value: string) => void;  // Old signature
     onValueChange?: (value: string) => void;  // New signature
   }

   export function FormInput({ value, defaultValue, onChange, onValueChange, ...rest }: FormInputProps) {
     const actualValue = value ?? defaultValue;
     const actualOnChange = onChange ?? onValueChange;
     // ...
   }
   ```

3. **Pre-Refactor Testing:**
   Before changing any component:
   - [ ] Identify all usages with `grep -r "ComponentName" app/`
   - [ ] Document edge cases (custom formatting, validation, callbacks)
   - [ ] Write integration test for each usage context
   - [ ] Verify test coverage for all form submission paths

4. **Incremental Rollout with Feature Flag:**
   ```typescript
   // lib/feature-flags.ts
   export const USE_STANDARDIZED_FORMS = process.env.NEXT_PUBLIC_USE_V2_FORMS === 'true';

   // In component
   import { USE_STANDARDIZED_FORMS } from '@/lib/feature-flags';

   {USE_STANDARDIZED_FORMS ? <FormInputV2 /> : <FormInput />}
   ```

   Deploy with flag OFF, test in production, enable flag for admin users only, then roll out to all.

5. **Refactoring Scope Boundaries:**
   Don't refactor "all forms" at once. Scope boundaries:
   - **Phase 1**: Simple forms (login, user profile) - low risk
   - **Phase 2**: List pages with filters - medium risk
   - **Phase 3**: Multi-step forms (invoice, PO) - high risk
   - **Phase 4**: Complex forms with business logic (stock-in/out) - highest risk

**Warning signs:**
- Refactor PR touches 30+ files
- PR description says "standardize all forms to use new components"
- No A/B testing or feature flag strategy mentioned
- No migration checklist for each affected page
- Test coverage doesn't increase (indicates components changed but tests didn't)
- Find-replace used for prop name changes across many files

**Phase to address:**
Phase 4: UI Standardization - Break into sub-phases by component complexity. Each sub-phase targets specific page types with full testing before moving to next.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip enum migration testing in staging | Faster deployment (save 1 day) | Production data corruption, user lockout, requires emergency rollback | Never - enum changes are irreversible without backup restore |
| Use find-replace for component refactoring | Refactor 50 files in 1 hour vs. 1 week manual | Broken forms, missing validation, production bugs, user trust loss | Never - scope boundaries reduce time to 2-3 days safely |
| Build flow tracking UI before query optimization | See UI mockup sooner, get stakeholder approval | Page unusable in production, database CPU spikes, requires full rewrite | Only for design review, never deploy to users |
| Recreate RLS policies without verification | Fewer lines of migration code | Tables unprotected (data breach) or over-protected (empty results) | Never - verification query is 5 lines |
| Deploy middleware changes without preview testing | Skip staging environment setup | Users locked out, auth bypass vulnerabilities, emergency rollback | Never - Vercel preview deployments are free |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostgreSQL enum migration | Using `ALTER TYPE ... DROP VALUE` or `DROP TYPE` directly | Expand-and-contract pattern: add new enum, migrate data, drop old enum in separate transactions |
| Supabase RLS policy recreation | Dropping all policies, then recreating outside transaction | Atomic transaction: drop children first, recreate parents first, verify with query |
| Next.js middleware auth | Assuming local behavior matches Vercel Edge runtime | Test in Vercel preview, add header injection protection, verify session refresh timing |
| Materialized view refresh | Manual `REFRESH MATERIALIZED VIEW` after every data change | Scheduled refresh (30-min cron) or manual trigger via admin UI only |
| Multi-table JOIN optimization | Building UI with N+1 queries, planning to optimize later | Write denormalized query FIRST, verify with EXPLAIN ANALYZE, then build UI |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 query cascade in flow tracking | Page load 30+ seconds, 1000+ database queries in DevTools | Single denormalized JOIN query, group results client-side | 100+ QMRLs with 5+ QMHQ each (500+ parent records) |
| RLS policy function calls on every query | Slow list page loads (5+ seconds), high database CPU | Cache user role in JWT custom claims instead of querying users table | 50+ concurrent users making simultaneous queries |
| Enum migration without indexes | Query timeout errors after role change | Recreate indexes on new role column before swapping, verify with EXPLAIN | 10K+ users, JOIN queries on role column |
| Materialized view never refreshed | Flow tracking shows stale data, user confusion | PostgreSQL cron extension or manual refresh UI with last-updated timestamp | First user access after view creation (data is 0 minutes old but appears stale) |
| force-dynamic on all dashboard pages | Every page load hits database, no caching, slow cold starts | Use ISR where possible, move auth checks to API routes, cache static data | 100+ users accessing dashboard simultaneously (cold start stampede) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Deploying middleware changes without CVE-2025-29927 mitigation | Authorization bypass via header injection on self-hosted deployments | Add `x-middleware-subrequest` header check, even if currently on Vercel |
| Recreating RLS policies outside atomic transaction | Window of time where tables have RLS enabled but no policies (empty results) or RLS disabled (public data) | Wrap all policy changes in single BEGIN/COMMIT transaction, verify before deploy |
| Using `ON DELETE CASCADE` with RLS policies | Cascade delete fails if user doesn't have RLS permission on child table | Use `ON DELETE SET NULL` for audit fields, verify cascade constraints don't conflict with RLS |
| Exposing role migration mapping in client code | User role hierarchy visible in browser bundle, attackers know which roles to target | Keep role mapping in database migration only, not in TypeScript constants |
| No verification query after enum migration | Users with unmapped roles can't be detected until they try to log in | Add `SELECT role, COUNT(*) FROM users GROUP BY role` verification before column swap |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Flow tracking page loads for 30 seconds with no feedback | User thinks page is broken, closes tab, complains to admin | Add skeleton loader, progressive loading (QMRLs first, then details), show "Loading 45/100 requests..." counter |
| User role changes but not logged out | User sees "Permission denied" errors on actions they previously could do, confused why | Force logout on role change with toast: "Your role has been updated. Please log in again." |
| Standardized form removes custom validation | User submits invalid data (negative exchange rate), database rejects, generic error shown | Migration checklist includes "transfer all custom validation to new component" verification step |
| RLS policy recreation causes empty results | User sees "No data available" on pages that previously had data, thinks data was deleted | Add error message: "If you expected to see data, contact admin" + error code for debugging |
| Materialized view stale data | User sees PO status as "in progress" but they just marked it closed 5 minutes ago | Show last-refresh timestamp: "Data as of 2:30 PM" + manual refresh button |

## "Looks Done But Isn't" Checklist

- [ ] **Enum migration:** Migration script succeeds but verification query shows unmapped users still exist
- [ ] **RLS policies:** All policies recreated but verification query shows tables with RLS enabled but 0 policies
- [ ] **Middleware auth:** Middleware deploys successfully but session refresh errors appear in logs 6 hours later
- [ ] **Flow tracking query:** Query returns results in development (10 records) but times out in production (1000 records)
- [ ] **Component standardization:** All files updated to use new components but custom validation logic was not migrated
- [ ] **Index creation:** Indexes created on new role column but not on foreign key columns for flow tracking JOINs
- [ ] **Materialized view:** View created but no refresh strategy (manual button, cron job, trigger)
- [ ] **Feature flag:** Standardized components deployed but feature flag hard-coded to `true` (can't disable if broken)

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Enum migration breaks user access | HIGH (30-60 min downtime) | 1. Rollback migration to restore old enum. 2. Fix mapping logic. 3. Re-run with verification. 4. Manual verification of all users can log in. |
| RLS policies dropped but not recreated | CRITICAL (5-10 min window of public data or no access) | 1. Immediately rollback transaction if detected. 2. If committed, run emergency policy recreation script. 3. Audit logs for unauthorized access during window. |
| Middleware auth breaks on deploy | HIGH (all users locked out until fix) | 1. Revert deployment via Vercel rollback. 2. Test middleware in preview environment. 3. Fix session refresh logic. 4. Gradual rollout with monitoring. |
| Flow tracking query causes database CPU spike | MEDIUM (page disabled until optimized) | 1. Add feature flag to disable flow tracking page. 2. Create materialized view with indexes. 3. Re-enable with pagination. 4. Monitor database CPU. |
| Component refactor breaks forms | MEDIUM-HIGH (forms unusable until hotfix) | 1. Identify broken pages via error monitoring. 2. Revert specific component changes via git. 3. Use feature flag to disable new components. 4. Fix validation logic, redeploy. |
| Materialized view never refreshed | LOW (stale data shown, but functional) | 1. Add manual refresh button to admin UI. 2. Show last-refresh timestamp. 3. Set up cron job for auto-refresh. 4. Add refresh trigger on major state changes. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Enum migration without data remapping | Phase 1: Database Foundation | Run verification query: 100% users have new role mapped, 0 users have old role values |
| RLS policy cascade failures | Phase 1: Database Foundation | Run verification query: all RLS-enabled tables have policies, no tables unprotected |
| Middleware authorization breaking | Phase 2: Middleware & Auth Updates | Deploy to Vercel preview, test session refresh, verify header injection protection |
| Flow tracking query N+1 performance | Phase 3: Flow Tracking Implementation | Run EXPLAIN ANALYZE, verify index usage, load test with 1000+ QMRLs |
| UI standardization breaking pages | Phase 4: UI Standardization | Incremental rollout with feature flag, test each page type before next, monitor error rates |
| Index missing on new role column | Phase 1: Database Foundation | Run query plan analysis, verify indexes exist on role, foreign keys, join columns |
| Materialized view no refresh strategy | Phase 3: Flow Tracking Implementation | Manual refresh button works, last-refresh timestamp shown, cron job scheduled |

## Sources

**PostgreSQL Enum Migration:**
- [Managing Enums in Postgres | Supabase Docs](https://supabase.com/docs/guides/database/postgres/enums)
- [PostgreSQL: Documentation: 18: 8.7. Enumerated Types](https://www.postgresql.org/docs/current/datatype-enum.html)
- [Why You Should (and Shouldn't) Use Enums in PostgreSQL | Medium](https://medium.com/@slashgkr/why-you-should-and-shouldnt-use-enums-in-postgresql-1e354203fd62)
- [Handling PostgreSQL Enum Updates with View Dependencies in Alembic Migrations](https://bakkenbaeck.com/tech/enums-views-alembic-migrations)

**Supabase RLS Policies:**
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Row Level Security (RLS): Complete Guide (2026)](https://designrevision.com/blog/supabase-row-level-security)
- [Cascade Deletes | Supabase Docs](https://supabase.com/docs/guides/database/postgres/cascade-deletes)

**Next.js Middleware Security:**
- [CVE-2025-29927: Next.js Middleware Authorization Bypass - Technical Analysis](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass)
- [Understanding CVE-2025-29927: The Next.js Middleware Authorization Bypass Vulnerability](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/)
- [Postmortem on Next.js Middleware bypass - Vercel](https://vercel.com/blog/postmortem-on-next-js-middleware-bypass)

**PostgreSQL Query Performance:**
- [Join strategies and performance in PostgreSQL](https://www.cybertec-postgresql.com/en/join-strategies-and-performance-in-postgresql/)
- [Strategies for Improving Postgres JOIN Performance](https://www.tigerdata.com/learn/strategies-for-improving-postgres-join-performance)
- [Optimizing Materialized Views in PostgreSQL](https://medium.com/@ShivIyer/optimizing-materialized-views-in-postgresql-best-practices-for-performance-and-efficiency-3e8169c00dc1)
- [Indexing Materialized Views in Postgres](https://www.crunchydata.com/blog/indexing-materialized-views-in-postgres)

**React Component Refactoring:**
- [Common Sense Refactoring of a Messy React Component](https://alexkondov.com/refactoring-a-messy-react-component/)
- [Refactoring A Junior's React Code - Reduced Complexity](https://profy.dev/article/react-junior-code-review-and-refactoring-2)
- [Modularizing React Applications with Established UI Patterns](https://martinfowler.com/articles/modularizing-react-apps.html)

**Project-Specific Context:**
- QM System codebase concerns audit (2026-01-27)
- Database migration analysis: 66 migrations, 132+ RLS policy references
- Architecture review: 44K lines TypeScript, force-dynamic pages, N+1 query patterns

---
*Pitfalls research for: UI Standardization, Request Flow Tracking, and RBAC Role Overhaul*
*Researched: 2026-02-11*
