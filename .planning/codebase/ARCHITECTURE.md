# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Next.js 14 App Router with Client/Server Component Separation + Supabase Backend

**Key Characteristics:**
- Server Components by default, client components only for interactivity
- Supabase as the single backend (database + auth + edge functions)
- Role-based access control via permission matrix
- Feature-based folder organization with co-located components
- Kanban-style status views for request management (QMRL/QMHQ)

## Layers

**Presentation Layer (UI Components):**
- Purpose: Render UI and handle user interaction
- Location: `/components`
- Contains: UI primitives, forms, tables, layout shells
- Depends on: Client-side Supabase, type definitions
- Used by: All pages

**Page Layer (Next.js Pages):**
- Purpose: Entry points for routes, compose components into full pages
- Location: `/app/(auth)`, `/app/(dashboard)`, `/app/api`
- Contains: Page components, API routes
- Depends on: Components, hooks, Supabase clients
- Used by: Browser routing

**Business Logic Layer (Hooks & Utilities):**
- Purpose: Encapsulate reusable logic, state management, calculations
- Location: `/lib/hooks`, `/lib/utils`
- Contains: Permission checking, PO status calculation, ID generation, search utilities
- Depends on: Type definitions, Supabase
- Used by: Pages and components

**Data Access Layer (Supabase Clients):**
- Purpose: Communicate with database and auth
- Location: `/lib/supabase`
- Contains: Browser client, server client, auth middleware
- Depends on: Supabase SDK, environment variables
- Used by: All components and pages

**Type Layer:**
- Purpose: Define TypeScript interfaces for database schema
- Location: `/types`
- Contains: Database types (auto-generated from schema), common types (FinancialAmount, AuditFields)
- Depends on: None
- Used by: All layers

## Data Flow

**Request Creation (QMRL Creation):**

1. User navigates to `/qmrl/new`
2. `new/page.tsx` (client component) renders form with sections
3. `InlineCreateSelect` component allows inline status/category creation
4. Form submission calls Supabase `.insert()` via browser client
5. Server-side trigger generates `QMRL-YYYY-NNNNN` ID
6. Success redirect to `/qmrl/[id]` with server refresh
7. Audit log created by database trigger

**List Display (QMRL List):**

1. `qmrl/page.tsx` (client component) mounts
2. `useEffect` calls `fetchData()` which:
   - Parallel fetches: QMRL data with relations, statuses, categories, users
   - Supabase returns joined data (status_config, categories, users)
3. Data filtered by search query, category, assignee in useMemo
4. Grouped by status_group (to_do, in_progress, done) for Kanban view
5. Pagination state managed locally in component
6. Re-renders on filter/search changes

**Financial Amount Display:**

1. Any financial entity (expense, PO, invoice) fetched from database
2. Contains: `amount`, `currency`, `exchange_rate`
3. Calculated field: `amount_eusd = amount / exchange_rate`
4. Display component shows both amounts side-by-side

**Stock Transaction Processing:**

1. `/inventory/stock-in` page shows form to select invoice or manual source
2. If from invoice: auto-populate items and quantities
3. Warehouse selection + unit cost input
4. On submit: INSERT to `inventory_transactions` table
5. Database trigger `update_item_wac()` calculates new WAC
6. Warehouse inventory view updated automatically

## Key Abstractions

**Permission System:**
- Purpose: Centralize access control logic
- Examples: `src/lib/hooks/use-permissions.ts`
- Pattern: Permission matrix by role + resource, memoized selectors
- Entry point: `usePermissions()` hook checks `can(action, resource)`
- Used by: Components conditionally render buttons/forms, routes check via `canAccessRoute()`

**Status Configuration:**
- Purpose: Manage customizable status values (not hardcoded)
- Examples: Status and Category tables in Supabase
- Pattern: Fetch from DB, cache in component state, display with color/icon
- Supports inline creation during form submission via `InlineCreateSelect` component

**PO Smart Status:**
- Purpose: Calculate status based on ordered/invoiced/received quantities
- Examples: `lib/utils/po-status.ts`
- Pattern: Functions calculate progress and determine status automatically
- Formula: `not_started → partially_invoiced → awaiting_delivery → partially_received → closed`

**ID Generation:**
- Purpose: Create human-readable IDs for user-facing entities
- Examples: `lib/utils/id-generator.ts`
- Pattern: Format `QMRL-YYYY-NNNNN`, database trigger generates sequence
- Used by: QMRL, QMHQ, PO, Invoice creation

**Financial Amount:**
- Purpose: Standardize financial calculations across app
- Examples: Types/database.ts `FinancialAmount` interface
- Pattern: Store base amount + exchange rate, calculate EUSD via generated column
- Display: Always show amount and EUSD side-by-side

## Entry Points

**Browser Entry (Root Layout):**
- Location: `app/layout.tsx`
- Triggers: Page load
- Responsibilities: Set up fonts, metadata, Toaster provider

**Authentication Check (Middleware):**
- Location: `middleware.ts`
- Triggers: Every request
- Responsibilities: Verify user session, redirect unauthenticated users to login

**Auth Callback:**
- Location: `app/auth/callback/route.ts`
- Triggers: After Supabase email/OTP verification
- Responsibilities: Handle auth exchange, set session cookie

**Dashboard Shell:**
- Location: `app/(dashboard)/layout.tsx`
- Triggers: All authenticated routes
- Responsibilities: Render Sidebar + Header + Main content area, wrap with AuthProvider

**Login Page:**
- Location: `app/(auth)/login/page.tsx`
- Triggers: Unauthenticated users, or manual `/login` navigation
- Responsibilities: Email input, OTP request, error handling

## Error Handling

**Strategy:** Client-side error boundaries + try-catch with toast notifications

**Patterns:**

- **Network Errors:** Caught in try-catch, displayed via `useToast()` with "variant: destructive"
- **Validation Errors:** Form-level validation before submission, field-level feedback
- **Permission Errors:** Conditionally hide/disable buttons if user lacks permission
- **Database Errors:** Supabase error returned, displayed to user, retry option offered
- **Page-level:** Error state stored in component state, shown as banner with retry button

**Example (from qmrl/page.tsx):**
```typescript
} catch (err) {
  console.error('Error fetching QMRL data:', err);
  const errorMessage = err instanceof Error ? err.message : 'Failed to load QMRL data';
  setError(errorMessage);
  // Rendered as: <AlertCircle /> + message + "Click to retry" link
}
```

## Cross-Cutting Concerns

**Logging:** Console.error() for server/client errors, displayed to user via toast

**Validation:** Zod schemas (imported) + manual validation in components before submission

**Authentication:** Supabase Auth (Email OTP/Magic Link) + custom User profile in `users` table

**Authorization:** Permission matrix in `use-permissions.ts` checked via `can(action, resource)` before rendering UI

**Timestamps:** All tables use `created_at`, `updated_at` with `TIMESTAMPTZ` type

**Audit:** Database triggers auto-create audit logs, History components display via `history-tab.tsx`

**State Management:** React hooks (useState/useContext) at page/component level, no global state manager

---

*Architecture analysis: 2026-01-26*
