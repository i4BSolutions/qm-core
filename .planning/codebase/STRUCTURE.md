# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
qm-core/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/
│   │       └── page.tsx        # Login form
│   ├── (dashboard)/            # Protected routes with sidebar layout
│   │   ├── layout.tsx          # Dashboard shell with AuthProvider
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── admin/              # Admin management pages
│   │   │   ├── users/
│   │   │   ├── categories/
│   │   │   ├── statuses/
│   │   │   ├── contacts/
│   │   │   ├── suppliers/
│   │   │   └── departments/
│   │   ├── qmrl/               # QMRL (Request Letter) module
│   │   │   ├── page.tsx        # List view
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # Create form
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Detail with tabs
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   ├── qmhq/               # QMHQ (Head Quarter) module
│   │   │   ├── page.tsx        # List (card/table view)
│   │   │   ├── new/
│   │   │   │   ├── page.tsx    # Step 1: Select route type
│   │   │   │   └── [route]/
│   │   │   │       └── page.tsx # Step 2: Route-specific form
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Detail with tabs
│   │   │       └── edit/
│   │   ├── po/                 # Purchase Orders module
│   │   │   ├── page.tsx        # List (card/table)
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # Create form
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Detail with tabs
│   │   ├── invoice/            # Invoices module
│   │   │   ├── page.tsx        # List (card/table)
│   │   │   ├── new/
│   │   │   │   └── page.tsx    # 4-step creation wizard
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Detail with tabs
│   │   ├── inventory/          # Inventory module
│   │   │   ├── page.tsx        # Dashboard with KPIs
│   │   │   ├── stock-in/
│   │   │   │   └── page.tsx    # Stock in form
│   │   │   └── stock-out/
│   │   │       └── page.tsx    # Stock out form
│   │   ├── warehouse/          # Warehouses module
│   │   │   ├── page.tsx        # List with inline create
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Detail with inventory tab
│   │   └── item/               # Items module
│   │       ├── page.tsx        # List with inline create
│   │       └── [id]/
│   │           └── page.tsx    # Detail with WAC, transactions
│   ├── api/                    # API routes (server-side)
│   │   ├── admin/
│   │   │   └── invite-user/
│   │   │       └── route.ts
│   │   └── upload/
│   │       └── route.ts
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts        # Magic link callback
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Index redirect
│   └── globals.css
│
├── components/                 # React components
│   ├── ui/                     # Base UI primitives
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── label.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── dialog.tsx
│   │   ├── date-picker.tsx
│   │   ├── textarea.tsx
│   │   ├── skeleton.tsx
│   │   ├── pagination.tsx
│   │   ├── separator.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── popover.tsx
│   │   ├── calendar.tsx
│   │   ├── toast.tsx
│   │   ├── toaster.tsx
│   │   └── use-toast.tsx
│   ├── layout/                 # Layout components
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   └── header.tsx          # Top header
│   ├── tables/                 # Data table components
│   │   └── data-table.tsx      # TanStack Table wrapper
│   ├── forms/                  # Form components
│   │   └── inline-create-select.tsx # Create status/category inline
│   ├── providers/              # Context providers
│   │   └── auth-provider.tsx   # User auth state
│   ├── history/                # History/audit components
│   │   └── history-tab.tsx     # Audit log timeline display
│   ├── invoice/                # Invoice-specific components
│   │   ├── invoice-card.tsx
│   │   ├── invoice-line-items-table.tsx
│   │   ├── invoice-po-selector.tsx
│   │   ├── invoice-status-badge.tsx
│   │   ├── invoice-summary-panel.tsx
│   │   └── void-invoice-dialog.tsx
│   ├── po/                     # PO-specific components
│   │   ├── po-card.tsx
│   │   ├── po-line-items-table.tsx
│   │   ├── po-status-badge.tsx
│   │   ├── po-progress-bar.tsx
│   │   └── po-balance-panel.tsx
│   └── qmhq/                   # QMHQ-specific components
│       └── transaction-dialog.tsx
│
├── lib/                        # Utility functions and hooks
│   ├── supabase/               # Supabase client instances
│   │   ├── client.ts           # Browser client (singleton)
│   │   ├── server.ts           # Server client (per-request)
│   │   └── middleware.ts       # Session update function
│   ├── hooks/                  # Custom React hooks
│   │   ├── index.ts
│   │   ├── use-permissions.ts  # Permission checking with matrix
│   │   └── use-search.ts       # Debounced search
│   ├── utils/                  # Utility functions
│   │   ├── index.ts            # cn(), formatCurrency(), etc.
│   │   ├── id-generator.ts     # Generate QMRL-YYYY-NNNNN format IDs
│   │   ├── po-status.ts        # PO status calculation & display
│   │   ├── invoice-status.ts   # Invoice status calculations
│   │   ├── inventory.ts        # Inventory helpers
│   │   └── search.ts           # Text search utilities
│   └── validations/            # Zod schemas (not yet created)
│
├── types/                      # TypeScript types
│   ├── index.ts                # Re-exports, API types
│   └── database.ts             # Supabase generated types
│
├── supabase/                   # Database and functions
│   ├── migrations/             # SQL migrations (001-027)
│   │   ├── 001_departments.sql
│   │   ├── 002_users.sql
│   │   ├── 003_status_config.sql
│   │   ├── 004_categories.sql
│   │   ├── 005-008_master_data.sql
│   │   ├── 009_qmrl.sql
│   │   ├── 011_qmhq.sql
│   │   ├── 015_purchase_orders.sql
│   │   ├── 021_invoices.sql
│   │   ├── 023_inventory_transactions.sql
│   │   ├── 025_audit_logs.sql
│   │   ├── 026_audit_triggers.sql
│   │   └── 027_rls_policies.sql
│   └── functions/              # Edge Functions (if any)
│
├── .planning/                  # GSD planning documents
│   └── codebase/
│       ├── ARCHITECTURE.md
│       ├── STRUCTURE.md
│       ├── CONVENTIONS.md
│       └── TESTING.md
│
├── middleware.ts               # Next.js middleware (auth)
├── next.config.mjs
├── tsconfig.json               # Path aliases: @/*, @/components/*, @/lib/*, etc.
├── tailwind.config.ts          # Dark theme configuration
├── package.json
├── CLAUDE.md                   # Project guidelines
└── PRD.md                      # Product requirements
```

## Directory Purposes

**app/:**
- Next.js App Router directory
- All routes defined here
- Server Components by default, marked with `"use client"` where interactivity needed
- Organized by feature (qmrl/, qmhq/, po/, etc.)

**app/(auth):**
- Public routes for login
- No sidebar layout
- Auth callback route handles magic link processing

**app/(dashboard):**
- Protected routes (checked by middleware)
- All wrapped by dashboard layout with sidebar + header
- Uses `AuthProvider` for user context
- Force dynamic rendering to prevent static prerendering issues

**components/ui/:**
- Headless, reusable UI primitives
- Built on Radix UI foundations
- Styled with Tailwind CSS
- Use class-variance-authority for variants

**components/[feature]/:**
- Feature-specific components (invoice/, po/, qmhq/)
- Cards, tables, dialogs, badges specific to that module
- Composed from UI primitives

**lib/supabase/:**
- Supabase client configuration
- Two instances: browser (singleton) and server (per-request)
- Middleware for session token refresh

**lib/hooks/:**
- Custom React hooks
- `usePermissions()` for RBAC checks
- `useSearch()` for debounced search
- All must be client components (`"use client"`)

**lib/utils/:**
- Pure functions (no state, no side effects)
- `id-generator.ts`: Generate QMRL-YYYY-NNNNN style IDs
- `po-status.ts`: Status calculation and display configs
- `invoice-status.ts`: Invoice status helpers
- `search.ts`: Text search logic

**types/:**
- `database.ts`: Generated from Supabase schema, defines all tables/enums
- `index.ts`: Re-exports commonly used types, adds API response types
- Import from `@/types` not `@/types/database`

**supabase/migrations/:**
- Numbered SQL files (001, 002, etc.)
- Run in sequence during `supabase db reset`
- Contains: table definitions, triggers, functions, RLS policies, seed data
- 27 migrations from init through Iteration 10 (Audit, RLS, Polish)

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Root index, redirects to login/dashboard
- `app/(auth)/login/page.tsx`: Login form
- `app/auth/callback/route.ts`: Magic link handler
- `app/(dashboard)/layout.tsx`: Dashboard shell entry point

**Configuration:**
- `tsconfig.json`: Path aliases (@/*, @/components/*, etc.)
- `tailwind.config.ts`: Dark theme, design tokens
- `middleware.ts`: Auth middleware, session refresh
- `.env.local.example`: Required environment variables

**Core Logic:**
- `lib/hooks/use-permissions.ts`: Permission matrix, role-based checks
- `lib/utils/po-status.ts`: Smart PO status calculation
- `lib/supabase/client.ts`: Browser client singleton
- `lib/supabase/server.ts`: Server client per-request instance
- `components/providers/auth-provider.tsx`: User context with session timeout

**Testing (if implemented):**
- Typically `*.test.ts` or `*.spec.ts` files co-located with tested code
- Not yet configured (no jest.config.js found)

## Naming Conventions

**Files:**
- Page routes: `page.tsx` (no dashes for routes, handled by Next.js)
- Components: PascalCase (e.g., `InlineCreateSelect.tsx`, `DataTable.tsx`)
- Utilities: kebab-case (e.g., `po-status.ts`, `id-generator.ts`)
- Hooks: `use-` prefix, kebab-case (e.g., `use-permissions.ts`)
- API routes: kebab-case with `.ts` extension (e.g., `invite-user/route.ts`)

**Directories:**
- Feature modules: kebab-case (e.g., `/stock-in`, `/invoice`, `/po`)
- Grouped routes: parentheses for layout grouping (e.g., `(auth)`, `(dashboard)`)
- Config: lowercase (e.g., `/lib/supabase`, `/lib/hooks`, `/lib/utils`)

**TypeScript:**
- Types: PascalCase (e.g., `User`, `QMRL`, `QMRLWithRelations`)
- Enums: PascalCase (e.g., `UserRole`, `POStatusEnum`)
- Constants: UPPER_SNAKE_CASE (e.g., `SESSION_TIMEOUT_MS`, `ACTIVITY_KEY`)
- Functions: camelCase (e.g., `hasPermission()`, `calculatePOProgress()`)
- React components: PascalCase (e.g., `function QMRLPage() {}`)
- Props interfaces: `ComponentNameProps` (e.g., `DataTableProps<TData>`)

**CSS:**
- Tailwind classes only (no custom CSS files except globals)
- Utility class patterns: `px-4 py-2`, `text-slate-400`, `bg-slate-500/10`
- Dark theme prefix: all styles already dark-mode compatible

## Where to Add New Code

**New Feature (e.g., new module like "Reports"):**
- Create directory: `app/(dashboard)/reports/`
- Add routes: `page.tsx` (list), `new/page.tsx` (create), `[id]/page.tsx` (detail)
- Add components: `components/reports/` for report-specific cards/tables
- Add database tables: `supabase/migrations/0XX_reports.sql`
- Add types: Update `types/database.ts` with generated types
- Add permissions: Update `lib/hooks/use-permissions.ts` permission matrix
- Add RLS: Add policies in `supabase/migrations/027_rls_policies.sql` or new migration

**New Component/Module:**
- If reusable UI primitive → `components/ui/`
- If feature-specific → `components/[feature-name]/`
- If layout → `components/layout/`
- If provider/context → `components/providers/`
- If table/form → `components/tables/` or `components/forms/`

**New Utility Function:**
- General utility → `lib/utils/index.ts`
- Feature-specific calculation → `lib/utils/[feature-name].ts` (e.g., `po-status.ts`)
- Search/filter → `lib/utils/search.ts`
- ID generation → `lib/utils/id-generator.ts`

**New Custom Hook:**
- General → `lib/hooks/index.ts`
- Permission-related → `lib/hooks/use-permissions.ts`
- Search-related → `lib/hooks/use-search.ts`
- New feature hooks → `lib/hooks/use-[feature].ts`

**New Database Table:**
- Create migration: `supabase/migrations/0XX_[feature].sql`
- Include: table creation, indexes, audit fields, soft delete flag
- Add types: Run `npx supabase gen types` to update `types/database.ts`
- Add RLS: Add policies in migrations or 027_rls_policies.sql

## Special Directories

**app/api/:**
- Backend API routes (server-side only)
- Use server client for auth validation
- Check permissions before executing
- Typically for admin operations requiring service role key
- Pattern: Verify current user role, execute operation, return response with error handling

**supabase/migrations/:**
- Generated: No, manually created
- Committed: Yes, tracked in git
- Runs sequentially during `supabase db reset`
- Must never modify migration files after deployment
- New changes → create new migration file

**types/:**
- Generated: `database.ts` generated from schema, check into git
- Committed: Yes
- Regenerate with: `npx supabase gen types typescript --project-id YOUR_ID > types/database.ts`
- Manually edit `index.ts` to re-export and add custom types

**.planning/codebase/:**
- Generated: No, created by GSD mapping commands
- Committed: Yes, checked into git
- Purpose: Architecture documentation for Claude agents
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

---

*Structure analysis: 2026-01-27*
