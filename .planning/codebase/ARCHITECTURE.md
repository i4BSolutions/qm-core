# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Next.js 14+ Server/Client Hybrid with Supabase Backend

**Key Characteristics:**
- Server-first components by default (Server Components), client components only where interactivity is required
- Role-based access control (RBAC) with Supabase RLS enforced at database layer
- Multi-layer permission checking: auth middleware → route guards → UI-level permission checks
- Supabase-driven architecture with minimal custom backend (mostly API routes for admin operations)
- Tailwind CSS with dark theme and tactical styling system
- Responsive component composition pattern with reusable UI primitives

## Layers

**Presentation Layer:**
- Purpose: User interface and user interactions
- Location: `app/(dashboard)/*`, `components/`
- Contains: Page components, forms, tables, cards, dialogs, layout components
- Depends on: Supabase client, hooks, UI components, permission system
- Used by: Browser (Next.js client)

**Business Logic & State Management Layer:**
- Purpose: Permission checking, form state, data transformation, status calculations
- Location: `lib/hooks/`, `lib/utils/`, `components/providers/`
- Contains: `usePermissions` hook, `useSearch` hook, `AuthProvider`, status calculators, ID generators
- Depends on: Supabase client, TypeScript types
- Used by: Presentation components, API routes

**Data Access Layer:**
- Purpose: Communication with Supabase database and auth services
- Location: `lib/supabase/`, types at `types/database.ts`
- Contains: Browser client (`client.ts`), server client (`server.ts`), middleware (`middleware.ts`)
- Depends on: Supabase SDK (@supabase/ssr)
- Used by: All application code, middleware

**Authentication & Authorization Layer:**
- Purpose: Session management, user authentication, route protection
- Location: `middleware.ts`, `lib/supabase/middleware.ts`, `components/providers/auth-provider.tsx`
- Contains: Session middleware, auth state provider with activity tracking
- Depends on: Supabase Auth, Next.js middleware
- Used by: All protected routes via middleware

**API Layer:**
- Purpose: Backend operations requiring service-role authentication (admin operations)
- Location: `app/api/`
- Contains: Admin user invitation, file uploads
- Depends on: Supabase admin client, auth verification
- Used by: Frontend forms, admin pages

**Database Layer:**
- Purpose: Data persistence, transactions, audit trails, RLS enforcement
- Location: `supabase/migrations/`, implemented in PostgreSQL
- Contains: Tables, triggers, audit logs, RLS policies
- Depends on: PostgreSQL 14+
- Used by: All data access via Supabase client

## Data Flow

**User Authentication & Session Flow:**

1. Unauthenticated user hits `/login` → middleware allows access
2. User submits email → Supabase sends OTP/magic link
3. User clicks link → redirected to `/auth/callback` route → callback stores session
4. Middleware intercepts request → checks for valid session in cookie
5. If valid session → user redirected to `/dashboard`
6. If session timeout detected (6 hours) → cleared from localStorage/sessionStorage → user redirected to `/login`
7. AuthProvider on dashboard fetches user profile from `users` table → stores in context

**List Page Data Flow (Example: QMRL List):**

1. Page mounts (`useEffect`) → calls `fetchData()` callback
2. `fetchData()` uses Supabase client to fetch:
   - Main data (qmrl records with relations)
   - Filter options (statuses, categories, users)
   - All executed in parallel with `Promise.all()`
3. Supabase RLS policies checked at database level
4. Results stored in component state → component re-renders
5. User interacts (search, filter) → state updates → component updates UI
6. Pagination handled in component state (currentPage, pageSize)

**Detail Page with Tabs:**

1. Page mounts → extracts ID from params → fetches main record + related data
2. Tabs component lazy-loads content:
   - Details tab: Shows record information
   - QMHQ Lines tab (for QMRL): Fetches related QMHQ records
   - History tab: Fetches audit logs with filter/search capabilities
3. Each tab manages its own loading state
4. User can edit → form populates, submits to Supabase
5. Form validation happens client-side (Zod schemas) and server-side (database constraints)

**Form Creation Multi-Step Flow:**

1. Page with step indicator and form sections
2. Form state accumulated in component state (multiple `useState`)
3. When "Next" clicked → validation of current section
4. If valid → move to next step (or submit if last step)
5. On submit → POST request to Supabase with all form data
6. Success → toast notification, redirect to detail/list page
7. Error → display in form, state preserved for editing

**State Management:**
- Component-local with `useState` for form state, loading, errors
- Context for authentication (`AuthProvider` via `useUser()`)
- No global state management library (Redux/Zustand) - complexity kept in components
- URL state for pagination, filters via query parameters (when needed)

## Key Abstractions

**Permission System:**
- Purpose: Centralized role-based access control
- Examples: `lib/hooks/use-permissions.ts`, `lib/hooks/use-permissions.ts` (permission matrix)
- Pattern: Permission matrix defines allowed actions per resource per role; `usePermissions()` hook provides `can()`, `canAny()`, `canAll()` methods; UI conditionally renders based on permissions; RLS policies enforce server-side

**Status Configuration System:**
- Purpose: Dynamic, user-customizable status workflows (Notion-style)
- Examples: QMRL statuses, QMHQ statuses, PO statuses
- Pattern: Status records in database with `entity_type`, `status_group` (to_do, in_progress, done), color; UI displays in kanban-like groups; smart status calculation for PO based on invoice/receipt counts

**Inline Creation Pattern:**
- Purpose: Create categories/statuses without leaving form context
- Examples: `components/forms/inline-create-select.tsx`
- Pattern: Select dropdown with [+] button → expands inline form → "Create & Select" action inserts record and selects it → updates local options state

**PO Smart Status Calculation:**
- Purpose: Automatically determine PO status from line item completion
- Examples: `lib/utils/po-status.ts`
- Pattern: Status determined by comparing quantities: ordered vs invoiced vs received; statuses include `not_started`, `partially_invoiced`, `awaiting_delivery`, `partially_received`, `closed`, `cancelled`

**Component Relations Pattern:**
- Purpose: Fetch related data using Supabase foreign key selectors
- Examples: All list/detail pages use `.select()` with relations like `status:status_config(*)`, `assigned_user:users!qmrl_assigned_to_fkey(*)`
- Pattern: Single query fetches parent + relations to avoid N+1; typed as `WithRelations` interfaces extending main entity

**Audit Trail System:**
- Purpose: Track all changes for compliance and history
- Examples: `components/history/history-tab.tsx`, database triggers in migrations
- Pattern: Database trigger captures before/after values, action type, user, timestamp; History component queries `audit_logs` table, filters by action type/date, displays timeline

## Entry Points

**Web Application:**
- Location: `app/page.tsx`
- Triggers: User navigates to `/`
- Responsibilities: Redirects to `/login` if unauthenticated, `/dashboard` if authenticated (via middleware)

**Login Page:**
- Location: `app/(auth)/login/page.tsx`
- Triggers: User accesses `/login` or unauthenticated access to protected route
- Responsibilities: Email input form, OTP request, error handling, redirect to callback on success

**Auth Callback:**
- Location: `app/auth/callback/route.ts`
- Triggers: Magic link in email clicked
- Responsibilities: Process Supabase auth callback, store session, redirect to dashboard

**Dashboard Layout:**
- Location: `app/(dashboard)/layout.tsx`
- Triggers: Any route under `/(dashboard)/*`
- Responsibilities: Wraps with `AuthProvider`, renders Sidebar + Header + main content area, forces dynamic rendering for all dashboard routes

**Middleware:**
- Location: `middleware.ts`
- Triggers: All requests (see matcher config)
- Responsibilities: Check for valid session, refresh auth tokens, redirect to `/login` if unauthorized, redirect authenticated users from `/login` to `/dashboard`

**Admin APIs:**
- Location: `app/api/admin/*`
- Triggers: POST requests from admin pages
- Responsibilities: Verify admin role, execute privileged operations (user invitations, etc.) with service role key

## Error Handling

**Strategy:** Multi-layered with user-facing feedback and server-side logging

**Patterns:**

1. **Form Validation:**
   - Client-side: Zod schemas with hook-form integration → real-time feedback
   - Server-side: Database constraints → returned as Supabase errors
   - User feedback: Toast notifications or form field error messages

2. **Async Data Fetching:**
   - Try/catch wraps all Supabase queries
   - Error state set in component → conditional error UI displayed
   - Common pattern: `[isLoading, setIsLoading]`, `[error, setError]`, conditional render
   - Loading indicators while fetching, error message on failure

3. **Permission Errors:**
   - Supabase RLS rejects unauthorized queries → `error` returned
   - API routes check admin role → return 403 Forbidden
   - UI permission checks prevent rendering of unauthorized buttons/forms

4. **Authentication Errors:**
   - Session expired → user redirected to login by middleware
   - Auth callback errors → user redirected to login with error toast
   - Signout errors silently handled → still clears session markers and redirects

5. **Boundary Errors:**
   - No global error boundary implemented (standard Next.js error.tsx per route)
   - Page-level try/catch for data fetching
   - Unhandled errors logged to console for debugging

## Cross-Cutting Concerns

**Logging:**
- Client-side: `console.error()` for debugging, shown in browser DevTools
- Server-side: `console.error()` in API routes and functions
- No centralized logging service; errors logged to Vercel logs in production

**Validation:**
- Forms: Zod schemas for client-side + database constraints for server-side
- Queries: Supabase type-checking via TypeScript types from `types/database.ts`
- Business rules: Stored procedures in database (e.g., PO status calculation triggers)

**Authentication:**
- Handled by Supabase Auth with email OTP/magic link
- Session stored in httpOnly cookie
- Middleware refreshes token on each request
- AuthProvider manages client-side session state with 6-hour timeout

**Authorization:**
- Role-based matrix in `lib/hooks/use-permissions.ts`
- Checked in three places: UI (conditional render), API routes (permission check), database (RLS policies)
- RLS policies on all tables enforce database-level access control

**Caching:**
- No explicit client-side caching; all queries fresh from Supabase
- Pagination implemented for list views to reduce data load
- Component state preserved during navigation (not refetched on back)

---

*Architecture analysis: 2026-01-27*
