# Codebase Concerns

**Analysis Date:** 2026-01-27

## Auth & Session Management

**Race Condition on Page Refresh:**
- Issue: Session state could become inconsistent during rapid page refreshes or when tab becomes inactive and reactivates. Fixed in commit b70101b but complexity remains in `AuthProvider` logic.
- Files: `components/providers/auth-provider.tsx`, `lib/supabase/middleware.ts`
- Impact: Users may be randomly logged out despite active session, creating poor UX. Session markers (`sessionStorage` + `localStorage`) can become desynchronized.
- Mitigation: Added cancel flag in useEffect cleanup to prevent state updates on unmounted components. Session timeout checks run at 60-second intervals.
- Risk level: **Medium** - Fixed in production but the mechanism is fragile

**Console Logging in Auth Provider:**
- Issue: 19 console.log/console.error statements in production code (`AuthProvider`, login page, various dialogs). These are helpful for debugging but should be removed or moved to logger.
- Files: `components/providers/auth-provider.tsx` (17 console statements), `app/(auth)/login/page.tsx`, various admin dialogs
- Impact: Exposes internal auth flow details in browser console, increased bundle size
- Fix approach: Implement conditional logging based on environment (only in development) or remove entirely

**localStorage/sessionStorage Reliance:**
- Issue: Auth provider depends on browser storage for session markers (`qm_session_active`, `qm_last_activity`). Storage may be disabled in private browsing or cleared by browser plugins.
- Files: `components/providers/auth-provider.tsx` (lines 27-60, 194-224), `app/(auth)/login/page.tsx` (lines 109-111)
- Impact: Session timeout detection could fail silently; activity tracking may not work
- Fix approach: Wrap all storage access in try-catch (already done) but consider fallback mechanism if storage unavailable

## Data Loading & Error Handling

**Missing Error Boundaries:**
- Issue: No global error boundary component for graceful error handling at page level. Individual pages handle errors with inline state but don't provide fallback UI consistently.
- Files: `app/layout.tsx` (root layout), all major pages: `qmrl/page.tsx`, `qmhq/page.tsx`, `po/page.tsx`, `invoice/page.tsx`
- Impact: Unhandled errors could show blank screens; users don't know what failed
- Fix approach: Create `app/error.tsx` boundary and implement consistent error UI across pages

**Silent Failures in .single() Calls:**
- Issue: Multiple Supabase `.single()` calls without proper null-coalescing. If query returns no rows, `single()` throws error but recovery path is minimal.
- Files: `app/(dashboard)/qmrl/[id]/page.tsx`, `qmhq/[id]/page.tsx`, `po/[id]/page.tsx`, `invoice/[id]/page.tsx`, `warehouse/[id]/page.tsx`, `item/[id]/page.tsx`
- Impact: 404 handling is inconsistent - some pages redirect to list, others may show error
- Example: Line 88-91 in `qmrl/[id]/page.tsx` only redirects on error with no user feedback
- Fix approach: Show toast notification before redirect, handle "not found" vs "error" differently

**Insufficient Error Messages:**
- Issue: Generic error messages like "Error fetching data" don't help users troubleshoot. Error codes from Supabase not captured.
- Files: `qmrl/page.tsx` (line 129), `po/page.tsx`, `invoice/page.tsx`, `qmhq/page.tsx`
- Impact: Users can't report specific errors; hard to debug without console access
- Fix approach: Log full error objects, display user-friendly message + error code/timestamp

## RLS & Security

**RLS Policies Rely on get_user_role() Function:**
- Issue: All RLS policies depend on `get_user_role()` which queries the users table. This adds latency to every query and creates a potential bottleneck.
- Files: `supabase/migrations/027_rls_policies.sql` (lines 14-25), all policy definitions reference this function
- Impact: Each Supabase query that hits RLS checks must call this function; performance degrades with scale
- Fix approach: Cache user role in JWT claims (Supabase Auth with custom claims) instead of querying at policy time

**SECURITY_DEFINER Functions Could Be Abused:**
- Issue: `get_user_role()` and owner check functions (`owns_qmrl()`, `owns_qmhq()`) use `SECURITY DEFINER` to bypass RLS. If user table is compromised, queries could return wrong roles.
- Files: `supabase/migrations/027_rls_policies.sql` (lines 14-48)
- Impact: Policy bypass if users table is manipulated
- Mitigation: Functions query `auth.uid()` which is internal, but recommend regular audit of who can modify users table
- Fix approach: Ensure only service role can modify users table; add database audit logging

**No RLS on Financial Transactions Table Details:**
- Issue: `financial_transactions` RLS policies restrict read/create based on role, but don't restrict users from viewing transactions for entities they don't have access to (e.g., requester viewing QMHQs from other requests).
- Files: `supabase/migrations/027_rls_policies.sql` (lines 440-480)
- Impact: Information disclosure - requester could theoretically see financial data from other requests if they craft direct queries
- Fix approach: Add ownership check similar to QMRL/QMHQ policies, restrict based on associated request/document

## Data Integrity & Consistency

**No Constraint on PO Money-Out Transactions:**
- Issue: Block was added to prevent money-out to PO route (migration 020), but logic is only in trigger. No validation in UI prevents user from attempting it.
- Files: `app/(dashboard)/qmhq/new/[route]/page.tsx` (line ~300+, should check for PO route + money-out combination)
- Impact: Users see confusing error messages instead of being prevented from invalid action
- Fix approach: Disable/hide transaction type selection for PO route in UI

**WAC Calculation Could Race:**
- Issue: WAC update trigger in `024_inventory_wac_trigger.sql` runs synchronously but if multiple stock-in transactions complete simultaneously, calculations could be based on stale data.
- Files: `supabase/migrations/024_inventory_wac_trigger.sql`, `app/(dashboard)/inventory/stock-in/page.tsx`
- Impact: Rare race condition where WAC calculation uses old opening balance
- Fix approach: Add transaction isolation or make WAC calculation idempotent (recalculate from all historical transactions, not incremental)

**Pagination Doesn't Persist on Filter Change:**
- Issue: When user changes filters (category, assignee), pagination resets to page 1. This is correct behavior but means users can miss counting total results.
- Files: `app/(dashboard)/qmrl/page.tsx` (line 142-143), uses `useMemo` to calculate filtered items but fetches fixed 100 items
- Impact: If filters reduce results from 150 to 20, user sees "20 of 150" which is misleading
- Fix approach: Either fetch all items in one query (if dataset stays reasonable) or implement server-side filtering with offset/limit

## Performance Bottlenecks

**All Dashboard Pages Use force-dynamic:**
- Issue: `dynamic = "force-dynamic"` set in `app/(dashboard)/layout.tsx` (line 7) to prevent static prerendering. This disables Next.js caching and makes every page dynamic.
- Files: `app/(dashboard)/layout.tsx`
- Impact: No ISR or static generation possible; every request goes to Supabase; slower page loads
- Why it's needed: Database env vars not available at build time (Vercel deployment)
- Fix approach: Switch to using edge functions or API routes that fetch data server-side; remove dynamic requirement from layout

**Large List Fetches Without Pagination:**
- Issue: QMRL page fetches 100 items per query (line 83 in `qmrl/page.tsx`), filters in memory, then paginates. If database grows to 10k+ QMRLs, this becomes slow.
- Files: `app/(dashboard)/qmrl/page.tsx`, `qmhq/page.tsx`, `po/page.tsx`, `invoice/page.tsx`
- Impact: Memory usage on client; slow initial load with large datasets
- Fix approach: Implement server-side filtering/pagination via API routes or implement infinite scroll

**N+1 Query Patterns:**
- Issue: Pages fetch primary data with relations (e.g., QMRL with status, category, users), but also independently fetch statuses and users for filter dropdowns. This is 5+ queries per page load.
- Files: `qmrl/page.tsx` (lines 68-101, 4 parallel queries), `qmhq/page.tsx`, `po/page.tsx`
- Impact: Unnecessary database load; could be combined into single query with better selection
- Fix approach: Restructure queries to fetch all needed data in one call, or implement query result caching

## Testing & Quality

**No Test Coverage:**
- Issue: No test files found in repository. Complex business logic (PO status calculation, WAC, invoice quantity validation) is untested.
- Files: No `.test.ts`, `.spec.ts` files, no `jest.config.js` or `vitest.config.ts`
- Impact: Regressions go undetected; refactoring is risky; business logic bugs not caught
- Fix approach: Add Jest/Vitest configuration and tests for:
  - `lib/utils/po-status.ts` - PO status calculation logic
  - `lib/utils/invoice-status.ts` - Available quantity calculation
  - `lib/utils/inventory.ts` - Inventory transaction validation
  - Auth hooks and permission checks
  - Utility functions for currency/formatting

**Missing Input Validation:**
- Issue: Form submissions validate required fields but don't validate format, ranges, or business rules. For example, exchange rate in invoice could be negative.
- Files: `app/(dashboard)/invoice/new/page.tsx` (no validation on exchange rate), `po/new/page.tsx` (no validation on budget amount), `warehouse/[id]/page.tsx`
- Impact: Garbage data enters database; calculations produce invalid results
- Fix approach: Add Zod schemas for all forms; validate on client and server

## Scaling Limits

**Session Storage for Activity Tracking:**
- Issue: Every user action updates localStorage with timestamp (line 200 in auth-provider.tsx). With 100+ concurrent users, this causes high localStorage mutation churn.
- Files: `components/providers/auth-provider.tsx` (lines 194-224)
- Impact: Performance hit in React; localStorage writes are synchronous
- Fix approach: Throttle activity updates (e.g., only update every 5 minutes instead of every action)

**Audit Logs Will Grow Unbounded:**
- Issue: `audit_logs` table (migration 025) has no retention policy or archival strategy. Logs grow forever.
- Files: `supabase/migrations/025_audit_logs.sql`, `026_audit_triggers.sql`
- Impact: Table bloat; slower queries on large tables; storage costs increase indefinitely
- Fix approach: Implement retention policy (keep 90 days, archive to external storage) or implement log rotation

## Dependencies at Risk

**Supabase Version Pinning:**
- Issue: `@supabase/supabase-js` pinned to `^2.50.0` (package.json line 28). Next major version (3.0) may have breaking changes not yet known.
- Files: `package.json`
- Risk: Migration pain when v3 releases; security fixes in v2 may lag behind v3
- Mitigation: Current version is recent (Jan 2025); breaking changes unlikely soon
- Plan: Monitor Supabase releases; test with major versions in CI before upgrading

**Tailwind CSS Customization Coupled to Design:**
- Issue: Custom CSS classes for tactical theme (grid-overlay, corner-accents, tactical-card, status-dot, etc.) defined in global styles. Changing theme requires touching CSS + all components.
- Files: All .tsx files reference custom classes; styles likely in `tailwind.config.ts` or global CSS
- Impact: Theme/branding changes are difficult; no design system abstraction
- Fix approach: Create design token system (separate variable set for colors, spacing) or use Tailwind tokens more consistently

## Missing Critical Features

**No Offline Support:**
- Issue: Application requires active network connection. No service worker, no offline queue for submissions.
- Files: `app/layout.tsx`, `middleware.ts` - no service worker setup
- Impact: Form submissions lost if connection drops; poor mobile experience
- Fix approach: Add service worker for caching, implement offline queue for mutations

**No Multi-Language Support:**
- Issue: All text hardcoded in English. No i18n framework setup.
- Impact: Cannot serve non-English users; difficult to add translations later
- Fix approach: Implement next-intl or i18n library

**No Analytics/Usage Tracking:**
- Issue: No event tracking or analytics. Cannot measure feature usage, identify bottlenecks, or understand user behavior.
- Impact: Blind to performance issues; can't optimize based on usage patterns
- Fix approach: Add Sentry for errors, PostHog or Mixpanel for analytics

## Database Concerns

**No Explicit Column Ordering:**
- Issue: Migration files don't specify column order explicitly in CREATE TABLE. Order depends on migration execution order.
- Impact: Hard to review schemas; future migrations that add columns could cause unexpected ordering
- Fix approach: Document expected column order or use explicit column listing in selects

**Soft Deletes Mixed with is_active:**
- Issue: Many tables have both `is_active` boolean AND soft deletes (records not physically deleted). This is redundant.
- Files: All major tables use `is_active = true` in WHERE clauses
- Impact: Developer confusion about which flag to use; risk of querying deleted data
- Fix approach: Standardize on `is_active` OR use actual soft delete pattern with deleted_at timestamps

## Code Quality Issues

**Large Component Files:**
- Issue: Several component files exceed 700+ lines, violating single responsibility principle.
- Files:
  - `app/(dashboard)/inventory/stock-in/page.tsx` (993 lines)
  - `app/(dashboard)/invoice/new/page.tsx` (923 lines)
  - `app/(dashboard)/qmhq/[id]/page.tsx` (835 lines)
  - `app/(dashboard)/invoice/[id]/page.tsx` (832 lines)
  - `app/(dashboard)/inventory/stock-out/page.tsx` (743 lines)
- Impact: Hard to test, maintain, and reason about; high cyclomatic complexity
- Fix approach: Extract sub-components for each section (header, form, summary, etc.); consider moving form logic to custom hooks

**Repeated Code in Form Pages:**
- Issue: Multiple form pages follow similar pattern: load reference data, validate, submit. This is repeated with slight variations.
- Files: `qmrl/new/page.tsx`, `qmhq/new/[route]/page.tsx`, `po/new/page.tsx`, `invoice/new/page.tsx`
- Impact: Maintenance burden; bug fixes must be applied to multiple files
- Fix approach: Create form builder/hook pattern to reduce duplication

**Type Safety Gaps:**
- Issue: Some queries use `as unknown as Type` casts instead of proper typing. No exhaustiveness checking on switch statements.
- Files: `qmrl/[id]/page.tsx` (line 109), various dialogs with `any` type casting
- Impact: Runtime errors possible; TypeScript not catching potential bugs
- Fix approach: Remove type assertions; implement stricter tsconfig settings

---

*Concerns audit: 2026-01-27*
