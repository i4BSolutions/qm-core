# Codebase Concerns

**Analysis Date:** 2026-01-26

## Tech Debt

**Unsafe Type Casting (`as unknown as T` pattern):**
- Issue: Multiple pages use unsafe generic type casting to work around Supabase's flexible response types. This bypasses TypeScript's type system and can hide real data structure mismatches.
- Files:
  - `app/(dashboard)/invoice/[id]/page.tsx`
  - `app/(dashboard)/po/[id]/page.tsx`
  - `app/(dashboard)/qmhq/[id]/page.tsx`
  - `app/(dashboard)/qmrl/[id]/page.tsx`
  - `app/(dashboard)/inventory/stock-out/page.tsx`
  - `app/(dashboard)/item/[id]/page.tsx`
  - `app/(dashboard)/warehouse/[id]/page.tsx`
- Impact: Runtime errors possible if Supabase query joins don't return expected shape. Breaks type safety for joined relations.
- Fix approach: Generate proper type-safe interfaces that match actual Supabase query response structure, or use response validation with Zod.

**Unsafe Error Typing:**
- Issue: `catch (error: any)` in `app/(dashboard)/admin/users/user-dialog.tsx:137` suppresses TypeScript error handling.
- Files: `app/(dashboard)/admin/users/user-dialog.tsx`
- Impact: Error property access (`.message`) can fail silently if error is not an Error object.
- Fix approach: Use `catch (error: unknown)` and proper type guards: `if (error instanceof Error) { ... }`

## Query Performance Issues

**Hardcoded List Limits Without Pagination:**
- Issue: Multiple pages fetch data with `.limit(100)` or `.limit(50)` but show unlimited results in UI. If dataset grows beyond limit, users won't see all data.
- Files:
  - `app/(dashboard)/qmrl/page.tsx` - limit(100) for QMRL list
  - `app/(dashboard)/qmhq/page.tsx` - limit(100) for QMHQ list
  - `app/(dashboard)/po/page.tsx` - limit(100) for PO list
  - `app/(dashboard)/qmhq/new/page.tsx` - limit(100) for QMHQ selection
  - `app/(dashboard)/warehouse/page.tsx` - limit(50) for warehouse list
- Impact: Users cannot access records beyond the hardcoded limit. Data appears incomplete as database grows.
- Scaling path:
  1. Implement cursor-based or offset pagination in all list pages
  2. Add "Load More" button or infinite scroll
  3. Reduce default page size to 20-25, increase limit to 100+
  4. Store pagination state in URL params

**N+1 Query Pattern (Resolved but Monitor):**
- Issue: Previous iterations had N+1 queries, now fixed with useCallback in Iteration 9.3. However, complex pages like `stock-in/page.tsx` still fetch multiple parallel queries.
- Files: All pages using `Promise.all([...])` for parallel fetching
- Impact: Each page load triggers 3-5 Supabase API calls. Scales poorly with user count or slow network.
- Improvement path:
  1. Implement backend edge function that returns aggregated data in single call
  2. Add query result caching at client level
  3. Use Supabase RLS to pre-filter unnecessary data in queries

## Data Quality & Validation

**Missing Input Validation on Client:**
- Issue: Forms accept input but minimal validation before submission. Exchange rate, quantities, unit costs can be negative or zero without frontend prevention.
- Files:
  - `app/(dashboard)/po/new/page.tsx` - Line 122: `exchangeRate > 0` only checked in display, not form input
  - `app/(dashboard)/inventory/stock-in/page.tsx` - Quantity/cost fields have no min/max constraints
  - `app/(dashboard)/invoice/new/page.tsx` - Quantity and unit price fields unconstrained
- Impact: Invalid data reaches backend. Requires database triggers to catch (slower, worse UX).
- Fix approach: Add Zod validation schemas to all forms, use `<input type="number" min="0" step="0.01" />` attributes

**Database Trigger Dependency:**
- Issue: Application logic relies on database triggers for critical validation (e.g., `validate_invoice_line_quantity()` trigger in migration 022_invoice_line_items.sql). If trigger fails silently, application doesn't know.
- Files: Backend validation in `supabase/migrations/` not replicated in frontend
- Impact: Trigger failures go unnoticed if error handling is poor. Data inconsistency possible.
- Fix approach: Duplicate critical validation in frontend before submission, always check Supabase `.error` responses

## Error Handling Gaps

**Silent Failures in Parallel Queries:**
- Issue: When using `Promise.all()`, if one query fails, entire page fails but user only sees generic error. Which query failed is unclear.
- Files: All pages with `Promise.all([...])` like:
  - `app/(dashboard)/po/new/page.tsx:87`
  - `app/(dashboard)/qmrl/page.tsx:68`
  - `app/(dashboard)/invoice/page.tsx`
- Impact: Difficult debugging. Users don't know which operation failed.
- Fix approach: Separate Promise.all() into individual await statements with specific error messages for each query

**Console Logging in Production:**
- Issue: 39 `console.error()` and `console.log()` statements left in production code. These expose internal error details and clutter browser console.
- Files: Scattered across all page components
- Impact: Security risk (error details visible to users). Browser console pollution makes debugging harder.
- Fix approach: Replace all `console.` calls with proper error tracking (e.g., Sentry). For development-only logging, use `if (process.env.NODE_ENV === 'development') console.log(...)`

## Type Safety Issues

**Incomplete Supabase Type Generation:**
- Issue: `types/database.ts` is manually maintained and may drift from actual schema if migrations are pushed without regenerating types.
- Files: `types/database.ts`
- Impact: TypeScript catches fewer schema mismatches. Adding new fields to tables doesn't update types automatically.
- Fix approach:
  1. Document process to regenerate: `npx supabase gen types typescript --project-id YOUR_ID > types/database.ts`
  2. Make part of CI/CD pipeline
  3. Add pre-commit hook to warn if schema.sql changed but types weren't regenerated

## Fragile Areas

**Stock-In Form Complexity (993 lines):**
- Issue: `app/(dashboard)/inventory/stock-in/page.tsx` is enormous (993 lines). Mixing mode switching (invoice vs manual), line item management, form state, and submission logic in one component.
- Files: `app/(dashboard)/inventory/stock-in/page.tsx`
- Why fragile: Any change to state management risks breaking both modes. Testing both paths requires reading entire 993-line file. Adding new feature is risky.
- Safe modification:
  1. Extract `InvoiceMode` and `ManualMode` to separate subcomponents
  2. Move state management to custom hook `useStockInForm()`
  3. Create shared `StockInLineItemsTable` component
  4. Ensure each subcomponent under 300 lines
- Test coverage: Needs integration tests for mode switching, invoice line item selection, quantity validation

**Invoice Creation Form (922 lines):**
- Issue: `app/(dashboard)/invoice/new/page.tsx` implements 4-step wizard in single file with complex state management.
- Files: `app/(dashboard)/invoice/new/page.tsx`
- Why fragile: Step progression logic, quantity validation, PO/line item loading all intertwined. Adding validation step requires understanding entire flow.
- Safe modification:
  1. Extract each step to `Step1Header`, `Step2POSelection`, `Step3LineItems`, `Step4Summary` components
  2. Move wizard state to context or custom hook
  3. Add step guards to prevent skipping validation
- Test coverage: Need tests for step progression, back navigation, quantity validation

**PO Detail Page (661 lines):**
- Issue: `app/(dashboard)/po/[id]/page.tsx` handles viewing, editing, cancelling with multiple tabs and conditional rendering.
- Files: `app/(dashboard)/po/[id]/page.tsx`
- Why fragile: Edit mode transitions, tab switching, and cancellation logic scattered across file. Refactoring any section risks breaking others.
- Safe modification: Extract edit form, history tab, and line items table to subcomponents. Create `usePODetail()` hook for state.

## Security Considerations

**Environment Variables at Risk:**
- Risk: `.env.local` file contains `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in plaintext on developer machines.
- Files: `.env.local`
- Current mitigation: File is in `.gitignore`, not committed to repo.
- Recommendations:
  1. Use separate service account for development
  2. Rotate keys regularly (monthly or on developer offboarding)
  3. Add pre-commit hook to prevent `.env` files being staged
  4. Document in README: "Never commit .env files"

**Missing Request Validation:**
- Risk: API routes and form submissions don't validate request body structure or size limits.
- Files: `/api/admin/invite-user` endpoint referenced in `app/(dashboard)/admin/users/user-dialog.tsx:90`
- Current mitigation: Supabase RLS policies check user permissions after insert attempt.
- Recommendations:
  1. Add body validation with Zod in all API routes before database operations
  2. Set Content-Type and Content-Length limits in middleware
  3. Implement rate limiting on user creation endpoint

**Weak Error Message Exposure:**
- Risk: Error messages from database or API often shown directly to users, may reveal schema/structure information.
- Files: All pages with `error && <AlertCircle>` error banners
- Example: `app/(dashboard)/admin/users/user-dialog.tsx:137` shows `error.message` directly
- Recommendations:
  1. Log full error server-side
  2. Show sanitized user message: "An error occurred. Please try again or contact support."
  3. Include unique error ID for support lookup

## Missing Critical Features

**No Audit Trail UI:**
- Problem: Audit logs are stored in database (from migrations) but no UI to view history/changes across entities.
- Blocks: Compliance tracking, user accountability, debugging who changed what and when.
- Notes: Partially addressed in PRD (Iteration 10 history tabs), but history tab components not found in codebase yet.

**No Offline Support:**
- Problem: Application requires live connection to Supabase. No offline data or cached state.
- Blocks: Users cannot work offline, form data lost on network disconnect.
- Alternative: Add service worker + local IndexedDB for form draft saving

**No Real-time Collaboration:**
- Problem: Two users editing same record causes last-write-wins conflict. No conflict resolution.
- Blocks: Team workflows where multiple people need to update same request/PO.
- Improvement path: Implement Operational Transformation or CRDTs for concurrent editing

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Utility functions (`lib/utils/`), permissions logic (`lib/hooks/use-permissions.ts`), format functions
- Files:
  - `lib/utils/index.ts` - formatCurrency, calculateEUSD, formatDate, etc.
  - `lib/utils/po-status.ts` - PO status calculation logic
  - `lib/utils/inventory.ts` - Inventory calculations
- Risk: Rounding errors in currency calculations could go unnoticed. Status transitions may break silently.
- Priority: High - these are critical business logic

**No Integration Tests:**
- What's not tested: Multi-step workflows (create QMRL → create QMHQ → create PO → create Invoice → stock-in)
- Files: Multiple pages work together but no tests verify end-to-end flow
- Risk: Breaking one page might not break another, but workflow is broken.
- Priority: High - users experience workflows, not individual pages

**No E2E Tests:**
- What's not tested: Real user journeys through UI
- Risk: Visual regression, page rendering issues, form submission failures
- Priority: Medium

**Untested Edge Cases:**
- Large dataset performance: How does list page perform with 10k records?
- Concurrent submissions: What if user double-clicks submit button?
- Floating point edge cases: Already fixed once (Iteration 6.1), but formatCurrency() rounding needs tests
- Quantity over-allocation: Can user over-issue stock despite validation?

## Performance Bottlenecks

**No Query Result Caching:**
- Problem: Reference data (suppliers, warehouses, categories) fetched on every page load from Supabase.
- Files: All pages with `createClient().from(...).select(...)`
- Cause: No client-side caching layer. Supabase filters with `is_active = true` on every query.
- Improvement path:
  1. Implement React Query / SWR for client caching
  2. Add `staleTime: 5 * 60 * 1000` (5 minute cache)
  3. Revalidate on mutations (create/update status, category, etc.)

**List Pagination N+1 Problem:**
- Problem: Warehouse page shows stock by warehouse but queries warehouse list, then each warehouse's inventory separately.
- Files: `app/(dashboard)/warehouse/page.tsx`
- Cause: No aggregation in single query. Each warehouse card triggers additional query.
- Improvement path: Use single Supabase query with `.select('*, inventory_transactions(...)')` to fetch all data in one round trip

**Large File Uploads Not Supported:**
- Problem: No file upload mechanism for invoices, attachments, or supporting documents.
- Files: Not implemented yet
- Impact: Users cannot attach supporting docs to financial transactions.
- Workaround: Store as database references only, no file storage

## Scaling Limits

**Supabase Anon Key Rate Limits:**
- Current capacity: Supabase free tier has rate limits (~200 req/min per IP)
- Limit: If 20 users navigate simultaneously, each making 4 parallel queries, that's 80 requests. Safe margin: 200-80=120 before hitting limits.
- Scaling path:
  1. Implement request queuing on client
  2. Implement edge function to batch queries
  3. Upgrade Supabase plan for higher limits

**Hardcoded 100-Record Limit:**
- Current capacity: All lists return max 100 records
- Limit: System breaks for users trying to see 101st QMRL/QMHQ/PO
- Scaling path: Implement pagination as noted in "Query Performance Issues"

**No Database Connection Pooling:**
- Current capacity: Each Next.js server instance opens new connection per request
- Limit: Can exhaust Supabase connection limit under load
- Scaling path: Use Supabase connection pooling in production

## Dependencies at Risk

**Next.js Version Lock:**
- Risk: Using Next.js 14.2.13 (not latest). Future security patches may not be backported.
- Impact: If critical vulnerability found in 14.x, must upgrade to 15.x (potentially breaking changes).
- Migration plan:
  1. Test Next.js 15 upgrade in staging quarterly
  2. Pin to 14.x with understanding of EOL date
  3. Plan upgrade before EOL

**Supabase JS Client Pinned to v2.50.0:**
- Risk: Version is specific (not `^2.50.0`). New versions might fix bugs but must manually update.
- Impact: Missing bug fixes, security patches, breaking changes in related packages.
- Recommendation: Change to `^2.50.0` to allow patch/minor version updates automatically

**React Hook Form & Zod:**
- Risk: Both are external libraries. If either goes unmaintained, maintenance burden falls on team.
- Impact: Bug fixes, TypeScript updates, new React features might not be supported.
- Monitoring: Check GitHub issues weekly, update monthly if patches available

## Known Production Issues (From Progress.md)

**Production Rendering Bug - Fixed in 9.2 & 9.3:**
- Issue: Pages work on first navigation but break on subsequent navigations. `useEffect(() => {}, [])` only runs once on first mount, not on navigation because Next.js App Router reuses component instances between route changes.
- Solution: Applied `useCallback` pattern to all data fetching and ensured dependencies are correct.
- Residual risk: If new pages are added without useCallback, bug will re-appear. Need linting rule to prevent.
- Fix approach: Add ESLint rule warning about empty dependency arrays in useEffect

**Floating Point Display Bug - Fixed in 6.1:**
- Issue: Entering 4000 displays as 3999.999 due to floating point precision. Fixed with rounding in `formatCurrency()`.
- Residual risk: Other calculations (WAC, exchange rates) might have similar issues.
- Test approach: Add unit tests for edge cases: 0.1 + 0.2, large numbers (1,000,000), very small numbers (0.01)

---

*Concerns audit: 2026-01-26*
