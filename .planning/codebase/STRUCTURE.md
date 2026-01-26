# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
project-root/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                   # Public auth routes (layout group)
│   │   ├── layout.tsx
│   │   └── login/page.tsx        # Login page
│   ├── (dashboard)/              # Protected routes (layout group)
│   │   ├── layout.tsx            # Dashboard shell with Sidebar + Header
│   │   ├── admin/                # Admin management pages
│   │   │   ├── categories/
│   │   │   ├── contacts/
│   │   │   ├── departments/
│   │   │   ├── statuses/
│   │   │   ├── suppliers/
│   │   │   └── users/
│   │   ├── dashboard/page.tsx    # Main dashboard
│   │   ├── inventory/            # Inventory management
│   │   │   ├── page.tsx          # Inventory dashboard
│   │   │   ├── stock-in/page.tsx
│   │   │   └── stock-out/page.tsx
│   │   ├── invoice/              # Invoice management
│   │   ├── item/                 # Item/Product management
│   │   ├── po/                   # Purchase Order module
│   │   ├── qmhq/                 # QMHQ (HQ Requests) module
│   │   ├── qmrl/                 # QMRL (Request Letters) module
│   │   └── warehouse/            # Warehouse management
│   ├── api/                      # API routes (backend endpoints)
│   │   ├── admin/
│   │   │   └── invite-user/route.ts
│   │   ├── auth/
│   │   │   └── callback/route.ts
│   │   └── upload/route.ts
│   ├── auth/callback/route.ts    # Auth callback handler
│   ├── layout.tsx                # Root layout (fonts, metadata, Toaster)
│   ├── page.tsx                  # Root page (redirect to /login or /dashboard)
│   └── globals.css               # Tailwind styles
├── components/                   # Reusable React components
│   ├── forms/
│   │   └── inline-create-select.tsx  # Reusable select with [+] inline create
│   ├── invoice/                      # Invoice-specific components
│   │   ├── invoice-card.tsx
│   │   ├── invoice-line-items-table.tsx
│   │   ├── invoice-po-selector.tsx
│   │   ├── invoice-status-badge.tsx
│   │   ├── invoice-summary-panel.tsx
│   │   └── void-invoice-dialog.tsx
│   ├── layout/                       # Shell layout components
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── index.ts
│   ├── po/                           # PO-specific components
│   │   ├── po-balance-panel.tsx
│   │   ├── po-card.tsx
│   │   ├── po-line-items-table.tsx
│   │   ├── po-progress-bar.tsx
│   │   └── po-status-badge.tsx
│   ├── providers/
│   │   └── auth-provider.tsx         # Auth context provider
│   ├── qmhq/
│   │   └── transaction-dialog.tsx
│   ├── tables/
│   │   └── data-table.tsx            # Generic data table component
│   └── ui/                           # Base UI primitives (Radix-based)
│       ├── badge.tsx
│       ├── button.tsx
│       ├── calendar.tsx
│       ├── card.tsx
│       ├── date-picker.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── pagination.tsx
│       ├── popover.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       ├── use-toast.tsx
│       ├── index.ts
│       └── [others...]
├── lib/                          # Business logic and utilities
│   ├── hooks/
│   │   ├── use-permissions.ts    # Permission checking hook
│   │   ├── use-search.ts         # Debounced search hook
│   │   └── index.ts
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client (singleton)
│   │   ├── server.ts             # Server-side Supabase client
│   │   └── middleware.ts         # Auth middleware for session refresh
│   └── utils/
│       ├── id-generator.ts       # QMRL-YYYY-NNNNN ID generation
│       ├── inventory.ts          # Inventory calculation utilities
│       ├── invoice-status.ts     # Invoice status helpers
│       ├── po-status.ts          # PO status calculation
│       ├── search.ts             # Text search helpers
│       ├── index.ts
│       └── [cn utility from clsx/tailwind-merge]
├── types/
│   ├── database.ts               # Auto-generated from Supabase schema
│   └── index.ts                  # Re-exports + common types
├── supabase/                     # Supabase migrations and config
│   └── migrations/               # SQL migration files
│       ├── 001_departments.sql
│       ├── 002_users.sql
│       ├── ... (up to 019_rls_policies.sql)
├── public/                       # Static assets
├── .env.local                    # Environment variables (local)
├── .env.local.example            # Environment template
├── middleware.ts                 # Next.js middleware for auth
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS config
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
└── .prettierrc                   # Prettier config
```

## Directory Purposes

**`app/(auth)`:**
- Purpose: Public authentication routes
- Contains: Login page, auth callback
- Key files: `login/page.tsx`

**`app/(dashboard)`:**
- Purpose: Protected authenticated routes
- Contains: All business logic pages (QMRL, QMHQ, PO, Invoice, Inventory)
- Layout: Wrapped with Sidebar, Header, AuthProvider

**`app/api`:**
- Purpose: Backend API routes (serverless functions)
- Contains: User invitation, auth callback, file upload
- Key files: `admin/invite-user/route.ts`, `auth/callback/route.ts`

**`components/ui`:**
- Purpose: Base UI components built with Radix UI
- Contains: Button, Input, Select, Dialog, Tabs, Badge, etc.
- Pattern: Unstyled Radix primitives styled with Tailwind

**`components/layout`:**
- Purpose: Shell layout components
- Contains: Sidebar (navigation), Header (user menu, breadcrumbs)
- Uses: Permission checking to show role-based nav items

**`components/[feature]`:**
- Purpose: Feature-specific components (invoice, po, qmhq, forms)
- Pattern: Co-locate related components together
- Examples: `invoice-card.tsx`, `po-progress-bar.tsx`, `inline-create-select.tsx`

**`lib/supabase`:**
- Purpose: Supabase client initialization
- Pattern: Singleton clients to avoid recreating connections
- Middleware: Handles auth session refresh on every request

**`lib/hooks`:**
- Purpose: Reusable React hooks
- Key hooks: `usePermissions()` for access control, `useSearch()` for debounced search

**`lib/utils`:**
- Purpose: Pure utility functions
- Examples: PO status calculation, ID generation, search filtering

**`types`:**
- Purpose: TypeScript type definitions
- database.ts: Auto-generated from Supabase schema
- index.ts: Re-exports + application-wide types (FinancialAmount, AuditFields)

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout, fonts, metadata
- `app/page.tsx` - Root page redirect
- `app/(dashboard)/layout.tsx` - Dashboard shell with auth check
- `middleware.ts` - Auth session middleware

**Configuration:**
- `next.config.mjs` - Next.js build config
- `tailwind.config.ts` - Design tokens, animations
- `tsconfig.json` - Path aliases (`@/*` → `./`)
- `.env.local` - Supabase URL, keys

**Core Logic:**
- `lib/supabase/client.ts` - Browser Supabase client
- `lib/supabase/server.ts` - Server Supabase client
- `lib/supabase/middleware.ts` - Auth middleware
- `lib/hooks/use-permissions.ts` - Permission matrix + access control
- `lib/utils/po-status.ts` - PO status calculation

**Testing & Examples:**
- None currently (testing framework not yet implemented)

## Naming Conventions

**Files:**
- Page components: `page.tsx` (Next.js convention)
- Components: `kebab-case.tsx` (e.g., `invoice-card.tsx`)
- Hooks: `use-[name].ts` (e.g., `use-permissions.ts`)
- Utils: `kebab-case.ts` (e.g., `po-status.ts`)
- Styles: Tailwind classes (no separate CSS files)
- Types: `database.ts`, `index.ts` in types folder

**Directories:**
- Feature folders: lowercase (e.g., `qmrl`, `inventory`)
- Component categories: lowercase (e.g., `ui`, `forms`, `layout`)
- Grouped routes: parentheses (e.g., `(auth)`, `(dashboard)`)

**Component Names:**
- PascalCase in code, same as export name
- Examples: `<InlineCreateSelect />`, `<DataTable />`, `<Sidebar />`

**Variables & Functions:**
- camelCase for variables and functions
- Examples: `fetchReferenceData()`, `selectedContactPerson`, `formData`
- Constants: SCREAMING_SNAKE_CASE (e.g., `PO_STATUS_CONFIG`)

## Where to Add New Code

**New Feature (e.g., new module like QMRL):**
- Primary code: `app/(dashboard)/[feature]/` (create directory)
  - Create `page.tsx` for list
  - Create `new/page.tsx` for create form
  - Create `[id]/page.tsx` for detail
  - Create `[id]/edit/page.tsx` for edit
- Components: `components/[feature]/` if multi-file components needed
- Utilities: `lib/utils/[feature].ts` for calculations or helpers
- Tests: Create `__tests__` folder in feature directory (future)

**New UI Component:**
- Location: `components/ui/[component].tsx`
- Pattern: Follow Radix UI + Tailwind pattern from existing components
- Must export component and include TypeScript types
- Add to `components/ui/index.ts` for easy imports

**New Reusable Component:**
- Location: `components/[category]/[name].tsx`
- Category examples: `forms/`, `tables/`, `invoice/`, `po/`
- Must be standalone and accept props for configuration
- Co-locate related components in same directory

**New Hook:**
- Location: `lib/hooks/use-[name].ts`
- Pattern: Export named hook function
- Add to `lib/hooks/index.ts`
- Should be pure logic (no direct Supabase calls unless data-fetching hook)

**New Utility Function:**
- Location: `lib/utils/[name].ts`
- Pattern: Pure functions, no side effects
- Examples: Calculations, formatters, validators
- Add to `lib/utils/index.ts` if commonly used

**New Database Schema:**
- Location: `supabase/migrations/NNN_[name].sql`
- Pattern: Sequential numbering (001, 002, etc.)
- Must include: id (uuid), created_at, updated_at, is_active fields
- Run: `npx supabase db push`

**New Page:**
- Location: `app/(dashboard)/[route]/page.tsx`
- If part of existing feature: `app/(dashboard)/[feature]/[subroute]/page.tsx`
- Always a client component (`"use client"`) for interactivity
- Pattern: Fetch data in useEffect, render UI, handle forms

## Special Directories

**`/public`:**
- Purpose: Static assets
- Generated: No
- Committed: Yes
- Access: Via `/[filename]` in URLs

**`/.next`:**
- Purpose: Build output
- Generated: Yes (by `npm run build`)
- Committed: No (in `.gitignore`)

**`/node_modules`:**
- Purpose: Dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in `.gitignore`)

**`/supabase`:**
- Purpose: Supabase config and migrations
- Generated: Migrations generated by `npx supabase migration new`
- Committed: Yes

**`/.planning/codebase`:**
- Purpose: GSD codebase mapping documents
- Generated: By GSD mapping command
- Committed: Yes

---

*Structure analysis: 2026-01-26*
