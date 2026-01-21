# QM System Development Progress

This document tracks the development progress, issues encountered, and solutions applied across all iterations.

---

## Iteration 1: Project Foundation

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Project Initialization**
   - Initialized Next.js 14 with App Router and TypeScript
   - Configured Tailwind CSS with custom design tokens
   - Set up "Refined Industrial" aesthetic theme

2. **Folder Structure Created**
   ```
   qm-core/
   ├── app/
   │   ├── (auth)/login/
   │   ├── (dashboard)/
   │   └── layout.tsx
   ├── components/
   │   ├── layout/
   │   ├── providers/
   │   └── ui/
   ├── lib/
   │   ├── supabase/
   │   ├── hooks/
   │   └── utils/
   ├── types/
   └── supabase/migrations/
   ```

3. **Configuration Files**
   - `package.json` - Dependencies including Next.js, Supabase, Tailwind, Lucide icons
   - `tsconfig.json` - TypeScript strict mode configuration
   - `tailwind.config.ts` - Custom theme with brand colors, sidebar tokens
   - `postcss.config.mjs` - PostCSS with Tailwind
   - `.env.local` - Environment variables for Supabase

4. **Supabase Client Utilities**
   - `lib/supabase/client.ts` - Browser client
   - `lib/supabase/server.ts` - Server-side client
   - `lib/supabase/middleware.ts` - Auth middleware

5. **Type Definitions**
   - `types/database.ts` - Supabase database types
   - `types/index.ts` - Application types (UserRole, EntityType, StatusGroup, etc.)

6. **Utility Functions**
   - `lib/utils/index.ts` - cn() helper, formatters
   - `lib/utils/id-generator.ts` - QMRL-YYYY-NNNNN format generator

7. **Base UI Components (shadcn/ui pattern)**
   - Button, Input, Label, Textarea
   - Card, Badge, Separator, Skeleton

8. **Layout Components**
   - `app/layout.tsx` - Root layout with fonts
   - `app/(auth)/login/page.tsx` - Login page
   - `app/(dashboard)/layout.tsx` - Dashboard shell
   - `components/layout/sidebar.tsx` - Navigation sidebar
   - `components/layout/header.tsx` - Top header

9. **Styling**
   - `app/globals.css` - CSS variables, custom utilities, animations

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Initial setup decisions (package manager, UI library) | Chose pnpm for efficiency, shadcn/ui patterns for components |
| Design aesthetic needed | Applied "Refined Industrial" theme with amber brand color (#d97706), slate backgrounds |

### Deliverables Verified
- [x] Next.js project runs with `npm run dev`
- [x] Tailwind CSS working with custom theme
- [x] Supabase client utilities created
- [x] Type definitions in place
- [x] Basic layout components functional

---

## Iteration 2: Database Schema - Core Tables

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Migration Files Created**
   - `001_departments.sql` - Departments table
   - `002_users.sql` - Users table with role enum, trigger for new user handling
   - `003_status_config.sql` - Status configuration with entity_type and status_group enums
   - `004_categories.sql` - Categories table
   - `run_all_migrations.sql` - Combined migration file

2. **Database Schema**

   **departments**
   - id (UUID), name, code, description, is_active, timestamps

   **users**
   - id (UUID), email, full_name, role (user_role enum), department_id, phone, avatar_url, is_active, audit fields

   **status_config**
   - id (UUID), entity_type, name, color, description, sort_order, status_group, is_default, is_active

   **categories**
   - id (UUID), entity_type, name, description, is_active, timestamps

3. **Enums Created**
   - `user_role`: admin, quartermaster, finance, inventory, proposal, frontline, requester
   - `entity_type`: qmrl, qmhq, po, invoice, inventory
   - `status_group`: to_do, in_progress, done

4. **Triggers & Functions**
   - `handle_new_user()` - Auto-creates user record when auth user signs up

5. **Updated Type Definitions**
   - Full Supabase database types in `types/database.ts`

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Needed to push migrations to Supabase | Used `npx supabase link` and `npx supabase db push` |
| Verify tables were created | Used REST API queries to confirm table existence |

### Deliverables Verified
- [x] All 4 migration files created
- [x] Migrations pushed to Supabase successfully
- [x] Tables verified via REST API
- [x] Type definitions updated

---

## Iteration 3: Authentication

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Auth Provider**
   - `components/providers/auth-provider.tsx`
   - Exports: `AuthProvider`, `useAuth`, `useUser`, `useUserRole`
   - Tracks auth state, user data from database, loading states

2. **Permission System**
   - `lib/hooks/use-permissions.ts`
   - Permission matrix based on PRD requirements
   - `usePermissions()` hook with: `can()`, `canAny()`, `canAll()`, `isAdmin`
   - `canAccessRoute()` helper for route protection
   - `roleNavigation` mapping for sidebar

3. **Role-Based Navigation**
   - Updated `sidebar.tsx` with role filtering
   - Navigation items have optional `roles` array
   - Admin section only visible to admins

4. **Header Updates**
   - Shows actual user info from auth context
   - Displays user name and role
   - Sign out functionality

5. **Dashboard Layout**
   - Wrapped with `AuthProvider`
   - Protected route structure

6. **Two-Step Email OTP Login**
   - Step 1: Email input → sends OTP via `signInWithOtp`
   - Step 2: 6-digit code input → verifies via `verifyOtp`
   - Features: auto-focus, paste support, resend cooldown (60s)

7. **Email Templates**
   - `docs/supabase-email-templates.md`
   - Styled HTML template for OTP emails
   - Uses `{{ .Token }}` placeholder for 6-digit code

8. **Admin Users Created**
   - admin@qmsystem.local (admin role)
   - yaungni@i4bsolutions.com (admin role)

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| TypeScript error in login page ref callback | Changed `ref={(el) => (otpRefs.current[index] = el)}` to `ref={(el) => { otpRefs.current[index] = el; }}` - callback was returning value instead of void |
| Supabase service role key was outdated | Read correct key from `.env.local` file |
| Anon key truncation in earlier session | Re-read user input and wrote correct full key |

### Deliverables Verified
- [x] AuthProvider working with context
- [x] usePermissions hook functional
- [x] Role-based sidebar navigation
- [x] Two-step OTP login flow
- [x] Admin users created in database
- [x] TypeScript compiles without errors

### Pending Setup (User Action Required)
- [ ] Configure SMTP in Supabase Dashboard for email sending
- [ ] Update email templates in Supabase Dashboard (Authentication > Email Templates)

---

## Iteration 4: Master Data Management

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migrations (4 new tables)**
   - `005_contact_persons.sql` - Contact persons with department FK
   - `006_suppliers.sql` - Suppliers/vendors table
   - `007_items.sql` - Items with WAC fields, item_category enum, SKU auto-generation trigger
   - `008_warehouses.sql` - Warehouses with seed data (Main/Sub Warehouse)

2. **Database Schema**

   **contact_persons**
   - id (UUID), name, department_id (FK), position, phone, email, address, notes, is_active, timestamps

   **suppliers**
   - id (UUID), name, company_name, department_id, position, phone, email, address, tax_id, payment_terms, notes, is_active, timestamps

   **items**
   - id (UUID), name, description, category (item_category enum), sku (auto-generated), default_unit
   - WAC fields: wac_amount, wac_currency, wac_exchange_rate, wac_amount_eusd (generated column)
   - photo_url, is_active, timestamps

   **warehouses**
   - id (UUID), name, location, description, capacity_notes, is_active, timestamps

3. **New Enum**
   - `item_category`: equipment, consumable, uniform, other

4. **UI Components Created (Radix UI primitives)**
   - `components/ui/dialog.tsx` - Modal dialog
   - `components/ui/select.tsx` - Select dropdown
   - `components/ui/dropdown-menu.tsx` - Context menus
   - `components/ui/toast.tsx` - Toast notifications
   - `components/ui/use-toast.tsx` - Toast hook
   - `components/ui/toaster.tsx` - Toast container
   - `components/ui/popover.tsx` - Popover
   - `components/ui/table.tsx` - Base table component

5. **Data Table Component**
   - `components/tables/data-table.tsx`
   - TanStack React Table integration
   - Sorting, pagination, search
   - Loading states with skeleton
   - Column header component

6. **Search & Filter Utilities**
   - `lib/hooks/use-search.ts` - useDebouncedValue, useSearch, useFilteredItems, usePagination
   - `lib/utils/search.ts` - matchesSearchQuery, filterBySearch, sortByField, paginateItems

7. **CRUD Pages Built**

   **Contact Persons** (`/admin/contacts`)
   - List with DataTable, search by name
   - Create/Edit dialog (name, department, position, phone, email, address, notes)
   - Soft delete (is_active = false)

   **Suppliers** (`/admin/suppliers`)
   - List with DataTable, search by name
   - Create/Edit dialog (name, company, position, phone, email, address, tax_id, payment_terms, notes)
   - Soft delete

   **Items** (`/item`)
   - List with DataTable, category badges, WAC display (amount + EUSD)
   - Create/Edit dialog (name, category, unit, SKU, description)
   - Category color mapping (equipment=blue, consumable=emerald, uniform=purple, other=slate)
   - Soft delete

   **Warehouses** (`/warehouse`)
   - List with DataTable, location with MapPin icon
   - Create/Edit dialog (name, location, description, capacity_notes)
   - Soft delete

8. **Dependencies Installed**
   - @radix-ui/react-dialog, @radix-ui/react-select, @radix-ui/react-dropdown-menu
   - @radix-ui/react-popover, @radix-ui/react-toast
   - @tanstack/react-table
   - Updated @supabase/supabase-js to v2.50.0 for type compatibility

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| TypeScript errors with Supabase insert/update showing 'never' type | Updated @supabase/supabase-js to v2.50.0 and regenerated types with `npx supabase gen types typescript` |
| Generated types used `type` keyword instead of `interface` | Replaced database.ts with generated type format including `__InternalSupabase: { PostgrestVersion: "14.1" }` |
| `InsertTables`/`UpdateTables` renamed in new types | Updated types/index.ts to export `TablesInsert`/`TablesUpdate` instead |
| formatCurrency called with `number | null` | Added nullish coalescing: `wac ?? 0` |
| File write errors for existing placeholder files | Read the file first before overwriting |

### Deliverables Verified
- [x] All 4 migration files created and pushed to Supabase
- [x] Tables verified via REST API (warehouses returned seed data)
- [x] UI components functional (Dialog, Select, Toast, etc.)
- [x] DataTable with sorting, pagination, search
- [x] All 4 CRUD pages working
- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [x] Build succeeds (`npm run build`)

---

## Iteration 5: QMRL Module

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migration**
   - `009_qmrl.sql` - QMRL (Request Letter) table with all fields from PRD
   - Auto-generated request_id trigger (QMRL-YYYY-NNNNN format)
   - Indexes on status_id, category_id, assigned_to, requester_id, department_id, request_date

2. **Database Schema**

   **qmrl**
   - id (UUID), request_id (auto-generated), title
   - status_id (FK to status_config), category_id (FK to categories)
   - department_id (FK), contact_person_id (FK)
   - assigned_to (FK to users), requester_id (FK to users)
   - request_date, description, priority (low/medium/high/critical), notes
   - is_active, timestamps, audit fields

3. **QMRL List Page** (`/qmrl`)
   - Notion-style status grouping (To Do, In Progress, Done)
   - Kanban-like columns with colored indicators
   - Search by title or request ID
   - Filter by category and assigned user
   - QMRL cards with priority badges, category tags, dates, assignees
   - Click-through to detail page

4. **QMRL Creation Form** (`/qmrl/new`)
   - Single-page form with sections:
     - Basic Information (title, category, priority)
     - Department & Contacts (department, contact person, request date)
     - Assignment & Status (assigned to, status)
     - Description (description, notes)
   - Department-filtered contact person selection
   - Auto-selects default status
   - Redirects to detail page after creation

5. **QMRL Detail Page** (`/qmrl/[id]`)
   - Header with request ID, priority badge, status badge
   - Tabs: Details, QMHQ Lines, History
   - Details tab with department/contact info, description, notes, assignment
   - QMHQ Lines tab placeholder (for Iteration 6)
   - History tab placeholder (for Iteration 10)
   - Edit and Add QMHQ Line buttons

6. **UI Component Added**
   - `components/ui/tabs.tsx` - Radix UI tabs component

7. **Dependencies Installed**
   - @radix-ui/react-tabs

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Generated types had `request_id` as required in Insert | Made it optional with comment noting auto-generation by trigger |
| Need for Tabs component | Created tabs.tsx using Radix UI primitives |

### Deliverables Verified
- [x] QMRL migration created and pushed to Supabase
- [x] Database types updated with QMRL table
- [x] QMRL list page with status grouping and filters
- [x] QMRL creation form with all sections
- [x] QMRL detail page with tabs
- [x] TypeScript compiles without errors
- [x] Build succeeds

### Frontend Design Enhancements Applied

Applied "Tactical Command Center" aesthetic using the frontend-design skill:

1. **Design System Added to globals.css**
   - `@keyframes pulse-glow` - Glowing status dot animation
   - `@keyframes scan-line` - Subtle scan line effect on cards
   - `@keyframes slide-up` - Staggered card entrance animation
   - `@keyframes border-glow` - Priority badge glow animation
   - `.tactical-card` - Cards with hover effects, gradient borders, amber accent line
   - `.corner-accents` - Military badge style corner marks
   - `.status-dot` - Pulsing status indicators (todo/progress/done)
   - `.command-panel` - Form section styling with top accent line
   - `.section-header` - Section headers with amber accent line divider
   - `.request-id-badge` - Prominent request ID display with amber styling
   - `.priority-tactical` - Tactical priority badges with glow effects
   - `.grid-overlay` - Subtle amber grid pattern background

2. **QMRL List Page Enhancements**
   - Kanban columns with glowing status dots
   - Tactical cards with scan-line overlay and corner accents
   - Staggered animation on card reveal
   - Priority badges with contextual colors and glow
   - Category badges with dynamic coloring
   - Command panel for filters section

3. **QMRL Create Form Enhancements**
   - Command panels for each form section
   - Section headers with amber accent and icon
   - Corner accents on panels
   - Staggered animation delays
   - Styled form controls with slate/amber theme

4. **QMRL Detail Page Enhancements**
   - Request ID badge with Target icon
   - Priority and status badges in header
   - Tabs with amber active state
   - Command panels for info sections
   - User avatars with role indicators
   - Audit trail section styling

### Notes
- ~~Inline status/category creation pattern deferred (can be added later)~~ **Implemented in 5.2**
- QMHQ Lines tab is placeholder - will be implemented in Iteration 6
- History tab is placeholder - will be implemented in Iteration 10

---

## Iteration 5.1: QMRL Module Enhancements

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migration**
   - `010_qmrl_request_letter_no.sql` - Added `request_letter_no` TEXT column to qmrl table
   - Stores external/physical request letter reference number

2. **TypeScript Types Updated**
   - Added `request_letter_no: string | null` to QMRL Row, Insert, and Update types in `types/database.ts`

3. **New UI Components**
   - `components/ui/calendar.tsx` - Calendar component using react-day-picker
     - Tactical dark theme styling (amber selection on slate background)
     - Custom navigation icons
     - Month/year caption styling
   - `components/ui/date-picker.tsx` - DatePicker component
     - Combines Popover + Calendar
     - Button trigger showing selected date in "PPP" format (e.g., "January 21, 2026")
     - Styled with tactical amber/slate theme

4. **QMRL Create Form Enhancements** (`/qmrl/new`)
   - Added "Request Letter No" text input field in Basic Information section
     - Optional field for external reference numbers
     - Placeholder: "External reference number (e.g., RL-2024-001)"
   - Replaced HTML date input with DatePicker component
     - Visual calendar popup for date selection
     - Supports backdate selection for late entries
   - Contact Person now primary selection (department auto-derived)

5. **QMRL Detail Page Enhancements** (`/qmrl/[id]`)
   - Added Request Letter No display in Department & Contact section
     - Only shows when value exists
     - Monospace font styling

6. **Dependencies Installed**
   - `react-day-picker@^8.10.1` - Calendar library for date picker component

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| No date picker appearing with native HTML input | Created custom DatePicker component using react-day-picker + Radix Popover |
| Native date input styling inconsistent across browsers | Custom calendar component ensures consistent tactical theme |

### Deliverables Verified
- [x] Migration file created for request_letter_no
- [x] TypeScript types updated
- [x] Calendar component working with dark theme
- [x] DatePicker component functional with popover
- [x] Request Letter No field in create form
- [x] DatePicker replaces HTML date input
- [x] Detail page displays Request Letter No when present
- [x] TypeScript compiles without errors

---

## Iteration 5.2: Inline Creation Pattern

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **InlineCreateSelect Component** (`/components/forms/inline-create-select.tsx`)
   - Reusable component combining searchable Select dropdown with [+] button
   - Expandable inline form for creating new items
   - Features:
     - **Searchable dropdown** - Type to filter options (handles many items)
     - Popover-based list with search input at top
     - Color preset picker (8 colors)
     - Status group selector (for status creation)
     - "Create & Select" action **auto-selects new item**
     - Cancel button to close inline form
     - Loading state during creation
     - Check mark shows selected item
   - Works for both Category and Status

2. **QMRL Create Form Updates** (`/qmrl/new/page.tsx`)
   - Category select replaced with InlineCreateSelect
     - Entity type: `qmrl`
     - Create type: `category`
     - Helper text: "Classification only — click [+] to create new"
   - Status select replaced with InlineCreateSelect
     - Entity type: `qmrl`
     - Create type: `status`
     - Helper text: "Click [+] to create new status"

3. **Component Props**
   ```typescript
   interface InlineCreateSelectProps<T extends BaseOption> {
     value: string;
     onValueChange: (value: string) => void;
     options: T[];
     onOptionsChange: (options: T[]) => void;
     placeholder?: string;
     entityType: "qmrl" | "qmhq";
     createType: "category" | "status";
     statusGroup?: "to_do" | "in_progress" | "done";
   }
   ```

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| TypeScript generic type casting error | Used `as unknown as T` for Supabase data casting |
| Color picker needed for inline form | Added 8 color presets with visual circle buttons |
| `request_letter_no` column not found error | Migration `010_qmrl_request_letter_no.sql` pushed to Supabase via `npx supabase db push` |
| QMRL cards too close together | Added `block mb-2` to Link wrapper for proper spacing |

### Deliverables Verified
- [x] InlineCreateSelect component created
- [x] Category field uses InlineCreateSelect
- [x] Status field uses InlineCreateSelect
- [x] Inline form expands/collapses correctly
- [x] New category creates and auto-selects
- [x] New status creates with status_group and auto-selects
- [x] **Search functionality** - type to filter options
- [x] **Auto-selection** - newly created items are automatically selected
- [x] Migration `010_qmrl_request_letter_no.sql` applied to database
- [x] QMRL list card spacing improved
- [x] TypeScript compiles without errors

---

## Iteration 5.3: Admin Management Pages

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Status Management Page** (`/admin/statuses`)
   - `app/(dashboard)/admin/statuses/page.tsx` - Main list page
   - `app/(dashboard)/admin/statuses/status-dialog.tsx` - Create/Edit dialog
   - Features:
     - DataTable with search, sort, pagination
     - Stats cards showing QMRL/QMHQ/Total status counts
     - Color dot display for each status
     - Entity type badges (QMRL, QMHQ)
     - Status group indicators (To Do, In Progress, Done)
     - Default status badge (cannot delete default)
     - Create/Edit dialog with color picker
     - Soft delete functionality

2. **Category Management Page** (`/admin/categories`)
   - `app/(dashboard)/admin/categories/page.tsx` - Main list page
   - `app/(dashboard)/admin/categories/category-dialog.tsx` - Create/Edit dialog
   - Features:
     - DataTable with search, sort, pagination
     - Stats cards showing QMRL/QMHQ/Total category counts
     - Color dot display for each category
     - Entity type badges (QMRL, QMHQ)
     - Description column
     - Display order column
     - Create/Edit dialog with color picker and description
     - Soft delete functionality

### Deliverables Verified
- [x] `/admin/statuses` page accessible (no 404)
- [x] `/admin/categories` page accessible (no 404)
- [x] Status CRUD operations work
- [x] Category CRUD operations work
- [x] Color pickers functional
- [x] Search and filtering work
- [x] TypeScript compiles without errors

---

## Iteration 5.4: User Management Page

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **User Management Page** (`/admin/users`)
   - `app/(dashboard)/admin/users/page.tsx` - Main list page
   - `app/(dashboard)/admin/users/user-dialog.tsx` - Create/Edit dialog
   - Features:
     - DataTable with search, sort, pagination
     - Stats cards showing Total Users, Admins, Quartermasters, Staff counts
     - User avatar with initial letter
     - Role color indicators (admin=red, quartermaster=purple, finance=emerald, etc.)
     - Department display
     - Phone number display (monospace)
     - Create new user via Supabase Auth signUp
     - Edit existing user profile
     - Soft delete (deactivate) functionality

2. **User Dialog Features**
   - Create Mode:
     - Email input (required, used for auth)
     - Full Name input (required)
     - Role selector (7 roles with descriptions)
     - Department selector (optional)
     - Phone input (optional)
     - Creates auth user with random password
     - User receives verification email
   - Edit Mode:
     - Email displayed but not editable
     - Update full name, role, department, phone
     - Profile update via users table

3. **Role Configuration**
   - 7 roles with color coding:
     - Admin (red) - Full system access
     - Quartermaster (purple) - Approve, view all, manage inventory
     - Finance (emerald) - Financial transactions, PO, Invoice
     - Inventory (blue) - Inventory transactions, warehouses
     - Proposal (amber) - Process requests, create QMHQ
     - Frontline (cyan) - Validate draft requests
     - Requester (slate) - Create requests, view own only

4. **TypeScript Type Definitions**
   - `UserRole` type alias for role union type
   - `UserWithDepartment` type for user with joined department

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| TypeScript error: `formData.role` (string) not assignable to role union type | Created `UserRole` type alias and cast `formData.role` appropriately |

### Deliverables Verified
- [x] `/admin/users` page accessible
- [x] User list with DataTable
- [x] Create user dialog functional
- [x] Edit user dialog functional
- [x] Role selector with descriptions
- [x] Department selector
- [x] Deactivate user works
- [x] TypeScript compiles without errors

---

## Iteration 5.5: Performance Optimizations & User Invite API

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Data Fetching Performance Optimizations**
   - **QMRL page**: Changed from 4 sequential queries to `Promise.all` parallel fetching
   - **All pages**: Changed from `select("*")` to selective column queries
   - **Added limits**: Prevents loading excessive records at once

   | Page | Optimization |
   |------|-------------|
   | QMRL | `Promise.all`, specific columns, limit 100 |
   | Users | Specific columns, limit 200 |
   | Contacts | Specific columns, limit 200 |
   | Suppliers | Specific columns, limit 200 |
   | Statuses | Specific columns only |
   | Categories | Specific columns only |
   | Items | Specific columns, limit 200 |
   | Warehouses | Specific columns, limit 50 |

2. **Supabase Client Singleton**
   - `lib/supabase/client.ts` - Client now cached as singleton
   - Avoids recreating client on every function call
   - Reduces connection overhead

3. **User Invite API Route** (`/api/admin/invite-user`)
   - Server-side API route using Supabase Admin API
   - Uses `inviteUserByEmail` instead of client-side `signUp`
   - Sends invitation email to new users
   - Sets user profile (role, department, phone) on creation
   - Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
   - Admin-only endpoint with role verification

4. **Bug Fixes**
   - Fixed `SelectItem` empty value error in department select
     - Changed from `value=""` to `value="none"` with conversion logic
   - Fixed users table query ambiguous relationship error
     - Changed `departments(id, name)` to `departments:departments!department_id(id, name)`
   - Fixed users not showing due to `is_active` null filter
     - Changed `.eq("is_active", true)` to `.neq("is_active", false)`

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Pages loading very slowly | Parallel fetching with `Promise.all`, selective columns, limits |
| SelectItem cannot have empty string value | Use `"none"` value with conversion logic |
| Ambiguous relationship between users and departments | Specify FK explicitly: `departments!department_id` |
| Users with `is_active = null` not showing | Use `.neq("is_active", false)` instead of `.eq("is_active", true)` |
| Client-side user creation slow | Server-side API route with admin invite |

### Files Created/Modified

**Created:**
- `app/api/admin/invite-user/route.ts` - User invitation API endpoint

**Modified:**
- `lib/supabase/client.ts` - Singleton pattern
- `app/(dashboard)/qmrl/page.tsx` - Parallel fetch, selective columns
- `app/(dashboard)/admin/users/page.tsx` - Query optimizations, FK fix
- `app/(dashboard)/admin/users/user-dialog.tsx` - Use invite API, fix SelectItem
- `app/(dashboard)/admin/contacts/page.tsx` - Selective columns
- `app/(dashboard)/admin/suppliers/page.tsx` - Selective columns
- `app/(dashboard)/admin/statuses/page.tsx` - Selective columns
- `app/(dashboard)/admin/categories/page.tsx` - Selective columns
- `app/(dashboard)/item/page.tsx` - Selective columns
- `app/(dashboard)/warehouse/page.tsx` - Selective columns

### Deliverables Verified
- [x] Pages load faster with parallel fetching
- [x] User invite API working (requires SMTP config for emails)
- [x] Department select works without empty value error
- [x] Users list shows all active users
- [x] TypeScript compiles without errors

### Notes
- Email delivery requires SMTP configuration in Supabase Dashboard
- For testing, check Supabase Dashboard → Authentication → Users to verify invites

---

## Iteration 6: QMHQ Module

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migrations**
   - `011_qmhq.sql` - QMHQ (Request Lines) table
     - Auto-generated request_id trigger (QMHQ-YYYY-NNNNN format)
     - Route type enum: `item`, `expense`, `po`
     - Item route fields: item_id, quantity, warehouse_id
     - Expense/PO route fields: amount, currency, exchange_rate, amount_eusd (generated)
     - PO route balance fields: total_money_in, total_po_committed, balance_in_hand (generated)
     - References: qmrl_id, status_id, category_id, contact_person_id, assigned_to
   - `012_financial_transactions.sql` - Financial Transactions table
     - Transaction type enum: `money_in`, `money_out`
     - Amount with EUSD conversion (generated column)
     - Soft delete and void functionality
     - Trigger to update QMHQ total_money_in automatically

2. **Database Schema**

   **qmhq**
   - id (UUID), request_id (auto-generated), line_name, description, notes
   - qmrl_id (FK to qmrl), route_type (enum)
   - status_id (FK), category_id (FK), contact_person_id (FK), assigned_to (FK)
   - Item route: item_id, quantity, warehouse_id
   - Financial: amount, currency, exchange_rate, amount_eusd (generated)
   - PO route: total_money_in, total_po_committed, balance_in_hand (generated)
   - is_active, timestamps, audit fields

   **financial_transactions**
   - id (UUID), qmhq_id (FK), transaction_type (enum)
   - amount, currency, exchange_rate, amount_eusd (generated)
   - description, reference_no, transaction_date, notes
   - Void fields: is_voided, voided_at, voided_by, void_reason
   - is_active, timestamps, audit fields

3. **TypeScript Types Updated** (`types/database.ts`)
   - Added `QMHQ` type from Tables
   - Added `FinancialTransaction` type from Tables

4. **QMHQ List Page** (`/qmhq`)
   - Card/List view toggle (Kanban vs Table)
   - Card View:
     - 3-column Kanban layout (Pending, In Progress, Completed)
     - Tactical cards with scan overlay and corner accents
     - Route type badges (Item=blue, Expense=emerald, PO=purple)
     - Financial info display for expense/po routes (EUSD amount)
     - Category badges, status badges, assignee display
     - Click-through to detail page
   - List View:
     - Table format with columns: ID, Name, Route, Parent QMRL, Amount (EUSD), Status, Assigned
     - Route type badges in table cells
     - Click-row navigation to detail
   - Filters:
     - Search by name or request ID
     - Route type filter (All, Item, Expense, PO)
     - Status filter (dynamic from database)

5. **QMHQ 2-Page Creation Flow**

   **Page 1: Basic Info** (`/qmhq/new`)
   - Line name (required)
   - Parent QMRL selection (required)
   - Category and Status (InlineCreateSelect)
   - Contact Person and Assigned To
   - Description and Notes
   - Route Type Selection (3 clickable cards):
     - Item Route: "Request items from warehouse inventory"
     - Expense Route: "Direct money in/out transactions"
     - PO Route: "Procurement via Purchase Orders"
   - Next button stores data in sessionStorage

   **Page 2: Route Details** (`/qmhq/new/[route]`)
   - Dynamic route: `/qmhq/new/item`, `/qmhq/new/expense`, `/qmhq/new/po`
   - Item Route Form:
     - Item selection from catalog (with code and unit)
     - Quantity input
     - Target warehouse selection (optional)
   - Expense Route Form:
     - Amount, Currency, Exchange Rate inputs
     - Real-time EUSD calculation display
     - Formula shown: Amount ÷ Exchange Rate = EUSD
   - PO Route Form:
     - Budget Amount, Currency, Exchange Rate
     - EUSD calculation display
     - Balance preview (Money In, PO Committed, Balance in Hand)
     - Important notice about needing Money In before POs
   - Back button returns to Page 1
   - Create button submits to database and redirects to detail

6. **QMHQ Detail Page** (`/qmhq/[id]`)
   - Header:
     - Route type badge with color
     - Status badge
     - Request ID display
     - Line name title
     - Parent QMRL link with click-through
   - Financial Summary Panel (expense/po routes):
     - Budget/Amount, Total Money In, PO Committed/Money Out, Balance
     - Color-coded sections (emerald, amber, purple)
   - Tabs:
     - **Details Tab**: Basic info, Assignment, Route-specific info, Timestamps
     - **Transactions Tab** (expense/po): List of financial transactions with add button
     - **Purchase Orders Tab** (po only): Placeholder for POs, insufficient balance warning
     - **History Tab**: Placeholder for audit log
   - Edit button placeholder

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Route type needed to determine page 2 form | Used dynamic route `[route]` with sessionStorage to pass data |
| EUSD calculation needed in real-time | Used `useMemo` for calculated EUSD based on amount/rate |
| Foreign key relationships in queries | Specified FK explicitly: `users!qmhq_assigned_to_fkey` |
| Balance tracking for PO route | Database generated column: `balance_in_hand = total_money_in - total_po_committed` |

### Files Created

**Migrations:**
- `supabase/migrations/011_qmhq.sql`
- `supabase/migrations/012_financial_transactions.sql`

**Pages:**
- `app/(dashboard)/qmhq/page.tsx` - List page with Card/List toggle
- `app/(dashboard)/qmhq/new/page.tsx` - Creation Page 1 (Basic Info)
- `app/(dashboard)/qmhq/new/[route]/page.tsx` - Creation Page 2 (Route Details)
- `app/(dashboard)/qmhq/[id]/page.tsx` - Detail page with tabs

**Types:**
- Updated `types/database.ts` with QMHQ and FinancialTransaction types

### Deliverables Verified
- [x] QMHQ migration created and pushed to Supabase
- [x] Financial transactions migration created and pushed
- [x] TypeScript types updated
- [x] QMHQ list page with Card/List toggle
- [x] Route type filtering and search
- [x] 2-page creation flow working
- [x] All 3 route types (item, expense, po) have appropriate forms
- [x] EUSD calculation working in real-time
- [x] QMHQ detail page with tabs
- [x] Financial summary panel for expense/po routes
- [x] Transactions tab with placeholder
- [x] TypeScript compiles without errors

### Route Type Summary

| Route | Purpose | Key Fields | Next Steps |
|-------|---------|------------|------------|
| Item | Request items | item_id, quantity | Stock availability check |
| Expense | Direct money in/out | amount, currency, exchange_rate | Add transactions |
| PO | Procurement via POs | amount (budget), balance tracking | Create POs after Money In |

---

## Iteration 6.1: QMHQ Refinements & Bug Fixes

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Currency Display Formatting**
   - Removed dollar sign (`$`) prefix from all EUSD amounts
   - All EUSD amounts now display as `1,234.56 EUSD` instead of `$1,234.56`
   - Added thousand separators to all currency amounts
   - Updated `formatCurrency()` utility to return just the formatted number
   - Added `formatAmount()` for amount with currency suffix (e.g., "1,234.56 MMK")
   - Updated `formatEUSD()` to return "1,234.56 EUSD" format

2. **Floating Point Precision Fix**
   - Fixed issue where entering 4000 would display as 3999.999
   - Added proper rounding in EUSD calculation: `Math.round((amount / rate) * 100) / 100`
   - Added rounding in `formatCurrency()` to handle floating point display issues

3. **Multi-Step Form Data Persistence**
   - Step 1 now loads saved draft data from sessionStorage on mount
   - Step 2 saves route-specific data (amount, currency, exchange rate, item, quantity) when clicking "Back"
   - All form fields are preserved when navigating between steps
   - Draft data cleared only after successful submission

4. **Item Route Simplification**
   - Removed warehouse field from item route (not required per requirements)
   - Item route now only asks for: Item selection and Quantity
   - Removed warehouse from QMHQ detail page for item routes
   - Cleaned up unused warehouse imports and queries

5. **Database Column Name Fixes**
   - Fixed items table queries: `code` → `sku`, `unit` → `default_unit`
   - Fixed warehouses table queries: removed non-existent `code` column
   - Updated all display components to use correct column names

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Dollar sign prefix on EUSD amounts | Removed `$` and `DollarSign` icons, added "EUSD" suffix text |
| 4000 displaying as 3999.999 | Added `Math.round()` in EUSD calculation and formatCurrency |
| Form data lost when navigating back | Save/restore data via sessionStorage with separate keys for basic and route data |
| Wrong column names (code, unit) | Updated to use correct DB columns (sku, default_unit) |

### Files Modified

**Utilities:**
- `lib/utils/index.ts` - Updated formatCurrency, formatAmount, formatEUSD functions

**Pages:**
- `app/(dashboard)/qmhq/page.tsx` - Fixed EUSD display, removed DollarSign
- `app/(dashboard)/qmhq/new/page.tsx` - Load draft data on mount
- `app/(dashboard)/qmhq/new/[route]/page.tsx` - Save/restore route data, removed warehouse, fixed column names
- `app/(dashboard)/qmhq/[id]/page.tsx` - Fixed EUSD display, removed warehouse, fixed column names

### Deliverables Verified
- [x] All amounts display with thousand separators (1,234.56)
- [x] EUSD displayed without dollar sign prefix
- [x] No floating point precision issues in display
- [x] Form data persists when navigating back in multi-step flow
- [x] Item route only asks for item and quantity (no warehouse)
- [x] TypeScript compiles without errors

---

## Iteration 6.2: Money In/Out Transaction Dialog

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Transaction Dialog Component** (`/components/qmhq/transaction-dialog.tsx`)
   - Full-featured dialog for recording Money In and Money Out transactions
   - Transaction Type Selection:
     - Two clickable cards: Money In (emerald) and Money Out (amber)
     - Money Out disabled for PO route (per PRD requirements)
     - Visual icons and descriptions for each type
   - Form Fields:
     - Amount (required, number input)
     - Currency selector (MMK, USD, EUR, THB, SGD)
     - Exchange Rate (required, auto-calculates EUSD)
     - Transaction Date (date picker)
     - Description (optional)
     - Reference Number (optional, for receipts/invoices)
     - Notes (optional, textarea)
   - Real-Time EUSD Calculation:
     - Shows calculated EUSD with proper rounding
     - Color-coded based on transaction type (emerald/amber)
   - Validation:
     - Amount must be positive
     - Exchange rate must be positive
   - Submit Action:
     - Inserts into `financial_transactions` table
     - Associates with QMHQ via `qmhq_id`
     - Records `created_by` user
     - Success toast notification
     - Auto-refreshes transaction list

2. **QMHQ Detail Page Integration** (`/qmhq/[id]/page.tsx`)
   - Added "Add Transaction" button in Transactions tab
   - Button opens TransactionDialog with proper props
   - Dialog passes:
     - `qmhqId` - Links transaction to QMHQ
     - `routeType` - Controls Money Out availability (disabled for PO)
     - `userId` - Records who created the transaction
     - `onSuccess` - Callback to refresh data after adding

3. **PO Route Restrictions**
   - Money Out button visually disabled for PO routes
   - Shows "Disabled for PO" helper text
   - Enforced in UI (cannot click to select Money Out)
   - Per PRD: PO routes only have Money In, spend via Purchase Orders

### Files Created/Modified

**Created:**
- `components/qmhq/transaction-dialog.tsx` - Transaction dialog component

**Modified:**
- `app/(dashboard)/qmhq/[id]/page.tsx` - Integrated TransactionDialog

### Database Integration

- Inserts to `financial_transactions` table
- Uses existing `amount_eusd` generated column
- Triggers update QMHQ's `total_money_in` automatically

### Deliverables Verified
- [x] Transaction dialog component created
- [x] Money In/Money Out type selection
- [x] Amount, Currency, Exchange Rate inputs
- [x] Real-time EUSD calculation
- [x] Money Out disabled for PO routes
- [x] Form validation working
- [x] Transaction saves to database
- [x] Success notification and data refresh
- [x] TypeScript compiles without errors

---

## Iteration 6.3: Transaction Enhancements & QMHQ Edit

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Transaction Dialog Improvements** (`/components/qmhq/transaction-dialog.tsx`)
   - Removed Description field (not needed)
   - Removed Reference Number field (not needed)
   - Added Image Upload field:
     - Click-to-upload interface with preview
     - File type validation (images only: JPG, PNG, etc.)
     - File size validation (max 5MB)
     - Remove attachment button
   - Fixed scrolling issue with `max-h-[90vh] overflow-y-auto`

2. **File Upload API Route** (`/app/api/upload/route.ts`)
   - Server-side file upload handler
   - Automatically creates `attachments` storage bucket if not exists
   - Uses Supabase service role key for proper permissions
   - Validates file type and size
   - Returns public URL after successful upload

3. **Financial Summary Dashboard** (QMHQ Detail Page)
   - Updated to show 5 financial metrics in a grid:
     - **QMHQ Amount** - Original budget/amount (slate)
     - **Yet to Receive** - QMHQ Amount - Money In (cyan)
     - **Money In** - Total received (emerald)
     - **Money Out** - Total spent or PO Committed (amber)
     - **Balance in Hand** - Money In - Money Out (purple)
   - Auto-calculated based on transactions
   - Color-coded for easy reading

4. **Auto-Generated Transaction IDs**
   - New column `transaction_id` on `financial_transactions` table
   - Format: `QMTRX-0001`, `QMTRX-0002`, etc.
   - Auto-generated via PostgreSQL sequence and trigger
   - Displayed prominently in transaction list with type badge (IN/OUT)

5. **QMHQ Edit Page** (`/qmhq/[id]/edit/page.tsx`)
   - Edit button in QMHQ detail page now functional
   - Editable fields:
     - Line Name
     - Category (with inline create)
     - Status (with inline create)
     - Description
     - Notes
     - Contact Person
     - Assigned To
   - Non-editable (route-specific, locked after creation):
     - Route Type
     - Item Details (Item, Quantity)
     - Amount Details (Amount, Currency, Exchange Rate)
     - Budget Details (Amount, Currency, Exchange Rate)
   - Route type badge displayed in header (read-only indicator)

### Database Migrations

**Migration 013:** `013_financial_transactions_attachment.sql`
- Added `attachment_url` column for storing uploaded image URLs

**Migration 014:** `014_financial_transactions_id.sql`
- Added `transaction_id` column (unique, auto-generated)
- Created `financial_transaction_seq` sequence
- Created trigger `generate_transaction_id_trigger`
- Backfilled existing records with IDs

### Files Created/Modified

**Created:**
- `app/api/upload/route.ts` - File upload API endpoint
- `app/(dashboard)/qmhq/[id]/edit/page.tsx` - QMHQ edit page
- `supabase/migrations/013_financial_transactions_attachment.sql`
- `supabase/migrations/014_financial_transactions_id.sql`

**Modified:**
- `components/qmhq/transaction-dialog.tsx` - Removed fields, added upload
- `app/(dashboard)/qmhq/[id]/page.tsx` - 5-metric dashboard, edit link, transaction display
- `types/database.ts` - Added `transaction_id` and `attachment_url` fields

### Deliverables Verified
- [x] Transaction dialog with image upload
- [x] File upload API working
- [x] 5 financial metrics displayed correctly
- [x] Auto-generated transaction IDs (QMTRX-NNNN)
- [x] QMHQ edit page functional
- [x] Route-specific fields locked from editing
- [x] TypeScript compiles without errors

---

## Iteration 6.4: QMRL Detail - Related QMHQ Display

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **QMRL Detail Page - QMHQ Lines Tab** (`/qmrl/[id]/page.tsx`)
   - Updated "QMHQ Lines" tab to display related QMHQ records
   - Tab label shows count: "QMHQ Lines (3)"
   - Fetches QMHQ records linked via `qmrl_id` foreign key

2. **QMHQ Card Display**
   - Each QMHQ shown as clickable card linking to detail page
   - Route type icon with color-coded badge (Item/Expense/PO)
   - Request ID in amber monospace
   - Status badge with custom color
   - Line name
   - Assigned user and created date
   - Amount in EUSD (for expense/po routes)
   - Quantity in units (for item route)

3. **Empty State**
   - Shows placeholder when no QMHQ lines exist
   - "Add Line" button to create new QMHQ

### Files Modified

- `app/(dashboard)/qmrl/[id]/page.tsx` - Added QMHQ fetching and display

### Deliverables Verified
- [x] Related QMHQ records fetched on page load
- [x] QMHQ count shown in tab label
- [x] QMHQ cards display all key information
- [x] Cards link to QMHQ detail page
- [x] Route-specific data displayed (amount/quantity)
- [x] Empty state when no QMHQ lines
- [x] TypeScript compiles without errors

---

## Iteration 6.5: QMRL Edit Page

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **QMRL Edit Page** (`/qmrl/[id]/edit/page.tsx`)
   - Created edit page for QMRL records
   - Edit button in QMRL detail page now functional
   - Pre-populates form with existing QMRL data

2. **Editable Fields**
   - Title (required)
   - Request Letter No.
   - Request Date (DatePicker)
   - Category (with inline create)
   - Priority (Low/Medium/High/Critical)
   - Status (with inline create)
   - Description
   - Notes
   - Contact Person (required, auto-fills department)
   - Assigned To

3. **Features**
   - Shows Request ID in header (read-only)
   - Department auto-filled from selected contact person
   - Form validation (title and contact person required)
   - Success toast and redirect to detail page on save

### Files Created

- `app/(dashboard)/qmrl/[id]/edit/page.tsx` - QMRL edit page

### Deliverables Verified
- [x] Edit page loads existing QMRL data
- [x] All editable fields working
- [x] Form validation for required fields
- [x] Department auto-fills from contact person
- [x] Inline create for Category and Status
- [x] Save updates QMRL record
- [x] Redirect to detail page after save
- [x] TypeScript compiles without errors

---

## Iteration 6.6: Pre-Select Parent QMRL in QMHQ Creation

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **QMHQ New Page - Query Parameter Support** (`/qmhq/new/page.tsx`)
   - Added `useSearchParams` hook to read URL query parameters
   - Reads `qmrl` query parameter when navigating from QMRL detail page
   - Pre-fills `qmrl_id` in form data from query parameter

2. **Locked Parent QMRL Field**
   - Added `isQmrlLocked` state to track if QMRL is pre-selected
   - When `qmrl` param exists, the field is locked (disabled)
   - Visual indicators when locked:
     - Lock icon next to label
     - "Locked" text badge in amber
     - Select control has reduced opacity and `cursor-not-allowed`
     - Helper text changes to "This QMHQ is being created from the parent QMRL"

3. **Session Storage Integration**
   - Pre-selected QMRL takes precedence over saved draft data
   - If navigating back from Step 2, QMRL remains locked if it was locked initially

### User Flow

1. User views QMRL detail page (`/qmrl/[id]`)
2. Clicks "Add Line" button in QMHQ Lines tab
3. Navigates to `/qmhq/new?qmrl=[qmrl-id]`
4. Parent QMRL field is pre-selected and locked
5. User cannot change the Parent QMRL selection
6. User completes the rest of the form normally

### Files Modified

- `app/(dashboard)/qmhq/new/page.tsx` - Added query param support and locked field logic

### Deliverables Verified
- [x] Query parameter `qmrl` is read on page load
- [x] Parent QMRL field pre-filled with the value
- [x] Field is disabled (cannot be changed)
- [x] Lock icon and "Locked" badge displayed
- [x] Helper text indicates field is locked
- [x] Works with session storage for multi-step flow
- [x] TypeScript compiles without errors

---

## Iteration 6.7: Pagination for Card/List Views

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Reusable Pagination Component** (`/components/ui/pagination.tsx`)
   - Created a reusable pagination component with:
     - Items per page selector (10, 20, 50, 100)
     - Page navigation buttons (First, Prev, page numbers, Next, Last)
     - "Showing X to Y of Z items" display
     - Tactical styling matching the design system
     - Smart page number display with ellipsis for large page counts

2. **QMRL List Page Pagination** (`/qmrl/page.tsx`)
   - Added pagination state (currentPage, pageSize)
   - Implemented paginated filtering logic
   - Reset page to 1 when filters change
   - Pagination applies to filtered items before grouping into Kanban columns
   - Updated header to show "X requests found (of Y total)" when filtered

3. **QMHQ List Page Pagination** (`/qmhq/page.tsx`)
   - Added pagination state (currentPage, pageSize)
   - Implemented paginated filtering logic
   - Reset page to 1 when filters change
   - Pagination works for both Card view (Kanban) and List view (Table)
   - Updated header to show "X lines found (of Y total)" when filtered

### Features

- **Page Size Options:** 10, 20, 50, 100 items per page (default: 20)
- **Navigation:** First, Previous, numbered pages, Next, Last buttons
- **Current Page Indicator:** Active page highlighted in amber
- **Auto Reset:** Page resets to 1 when search or filters change
- **Responsive:** Pagination controls stack vertically on mobile

### Files Created

- `components/ui/pagination.tsx` - Reusable pagination component

### Files Modified

- `app/(dashboard)/qmrl/page.tsx` - Added pagination
- `app/(dashboard)/qmhq/page.tsx` - Added pagination

### Deliverables Verified
- [x] Pagination component created
- [x] QMRL page has working pagination
- [x] QMHQ page has working pagination (Card and List views)
- [x] Page resets when filters change
- [x] Items per page selector works
- [x] Page navigation buttons work
- [x] TypeScript compiles without errors

---

## Iteration 6.8: AuthProvider Performance Fix

**Status:** Completed
**Date:** January 2026

### Problem

Client-side navigation was extremely slow/stuck. Users had to refresh the browser for every action. The page would appear to hang indefinitely during navigation.

### Root Cause

The `AuthProvider` component had an **infinite re-render loop**:

1. `createClient()` was called inside the component body (line 25)
2. This created a new Supabase client instance on every render
3. `useCallback` hooks depended on `supabase` which changed every render
4. `useEffect` depended on `supabase.auth` which changed every render
5. Every render → new supabase → effect re-ran → state change → new render → infinite loop

### Fixes Applied

1. **Moved `createClient()` outside component** (`auth-provider.tsx:20`)
   - Supabase client is now created once at module load time
   - No more new instances on every render

2. **Fixed `useCallback` dependencies**
   - `fetchUserProfile`: Empty dependency array (supabase is module-level constant)
   - `signOut`: Empty dependency array
   - `refreshUser`: Only depends on stable `fetchUserProfile`

3. **Added `initialLoadDone` ref** (`auth-provider.tsx:29`)
   - Prevents double fetching in React Strict Mode
   - useEffect only runs initial load once

4. **Memoized context value** (`auth-provider.tsx:117-124`)
   - Used `useMemo` to prevent unnecessary consumer re-renders
   - Only re-creates value when actual data changes

### Files Modified

- `components/providers/auth-provider.tsx` - Complete refactor of state management

### Impact

- Client-side navigation now works instantly
- No more need to refresh browser for every action
- Reduced unnecessary re-renders across the entire app

---

## Iteration 7: Purchase Orders

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migrations**
   - `015_purchase_orders.sql` - Purchase Orders table
     - Auto-generated po_number trigger (PO-YYYY-NNNNN format)
     - `po_status` enum: not_started, partially_invoiced, awaiting_delivery, partially_received, closed, cancelled
     - `approval_status` enum: draft, approved, rejected
     - Trigger to validate QMHQ has route_type='po'
     - Trigger to update QMHQ.total_po_committed when PO created/updated/cancelled
     - Generated column for total_amount_eusd
   - `016_po_line_items.sql` - PO Line Items table
     - Trigger to snapshot item details (name, sku, unit) on insert
     - Trigger to recalculate purchase_orders.total_amount
     - `calculate_po_status()` function for smart status calculation
     - Tracking fields: invoiced_quantity, received_quantity

2. **Database Schema**

   **purchase_orders**
   - id (UUID), po_number (auto-generated), qmhq_id (FK)
   - supplier_id (FK), po_date, expected_delivery_date
   - currency, exchange_rate, total_amount, total_amount_eusd (generated)
   - contact_person_name, sign_person_name, authorized_signer_name
   - status (po_status enum), approval_status (approval_status enum)
   - notes, is_active, timestamps, audit fields

   **po_line_items**
   - id (UUID), po_id (FK with CASCADE DELETE), item_id (FK)
   - quantity, unit_price, total_price (generated)
   - invoiced_quantity, received_quantity (for tracking)
   - item_name, item_sku, item_unit (snapshots)
   - notes, is_active, timestamps

3. **TypeScript Types Updated** (`types/database.ts`)
   - Added `purchase_orders` table types (Row, Insert, Update, Relationships)
   - Added `po_line_items` table types
   - Added `POStatusEnum` and `ApprovalStatus` type aliases
   - Added `PurchaseOrder` and `POLineItem` type aliases

4. **Utility Functions** (`lib/utils/po-status.ts`)
   - `PO_STATUS_CONFIG` - Status configuration with labels, colors, icons
   - `APPROVAL_STATUS_CONFIG` - Approval status configuration
   - `calculatePOProgress()` - Calculate invoiced/received percentages
   - `calculateLineItemProgress()` - Line item level progress
   - `getStatusHexColor()` - Get hex color for status
   - `canEditPO()`, `canCancelPO()`, `canCreateInvoice()` - Permission helpers

5. **PO Components** (`components/po/`)
   - `po-status-badge.tsx` - POStatusBadge and ApprovalStatusBadge with icons
   - `po-progress-bar.tsx` - POProgressBar (dual invoiced/received) and MiniProgressBar
   - `po-balance-panel.tsx` - Balance validation display (available, PO total, remaining)
   - `po-card.tsx` - Card component for list view
   - `po-line-items-table.tsx` - EditableLineItemsTable and ReadonlyLineItemsTable

6. **PO List Page** (`/po`)
   - Card/List view toggle
   - Card View: Shows PO number, supplier, amount (EUSD), status badges, progress bars
   - List View: Table with columns for all key fields
   - Filters: Search by PO#, status filter, supplier filter
   - Pagination
   - Grouped display: Active, Completed, Cancelled

7. **PO Create Page** (`/po/new`)
   - QMHQ Selection: Only shows QMHQ with route_type='po' and balance_in_hand > 0
   - Pre-selection via query param: `/po/new?qmhq={id}`
   - PO Header: Supplier, PO Date, Expected Delivery Date, Currency, Exchange Rate
   - Signer Fields: Contact Person, Sign Person, Authorized Signer (all from contact_persons select)
   - Line Items: Dynamic table with item selection, quantity (+/- buttons), unit price
   - Balance Validation Panel: Shows available balance, PO total, remaining after PO
   - Blocks submission if PO exceeds available balance

8. **PO Detail Page** (`/po/[id]`)
   - Header: PO number badge, status badge, approval badge, link to parent QMHQ
   - Financial Summary: Total amount with progress bars (invoiced %, received %)
   - Tabs:
     - Details: PO info, supplier, dates, signers, notes
     - Line Items: ReadonlyLineItemsTable with progress tracking per item
     - Invoices: Placeholder (Iteration 8)
     - History: Placeholder (Iteration 10)
   - Actions: Edit button, Cancel PO button

9. **QMHQ Integration** (`/qmhq/[id]`)
   - Updated Purchase Orders tab to fetch and display actual POs
   - Shows PO cards with status, amount, progress
   - "Create PO" button links to `/po/new?qmhq={id}`
   - Shows PO count in tab label

### Problems Encountered & Solutions

| Problem | Solution |
|---------|----------|
| Line items Select not showing selected value | Changed from native `<select>` to shadcn Select component with conditional rendering |
| Signer fields were text inputs | Changed to contact person Select dropdowns populated from database |
| Multiple state updates overwriting each other | Used functional state update: `setLineItems((prev) => ...)` |
| Native number input spinners cluttering UI | Added CSS to hide spinners: `[appearance:textfield]` and webkit overrides |

### Files Created

**Migrations:**
- `supabase/migrations/015_purchase_orders.sql`
- `supabase/migrations/016_po_line_items.sql`

**Utilities:**
- `lib/utils/po-status.ts`

**Components:**
- `components/po/po-status-badge.tsx`
- `components/po/po-progress-bar.tsx`
- `components/po/po-balance-panel.tsx`
- `components/po/po-card.tsx`
- `components/po/po-line-items-table.tsx`

**Pages:**
- `app/(dashboard)/po/page.tsx`
- `app/(dashboard)/po/new/page.tsx`
- `app/(dashboard)/po/[id]/page.tsx`

### Files Modified

- `types/database.ts` - Added PO types
- `app/(dashboard)/qmhq/[id]/page.tsx` - Integrated PO display in Purchase Orders tab

### Smart Status Calculation

The `calculate_po_status()` function determines PO status based on:

| Status | Condition |
|--------|-----------|
| `cancelled` | PO is cancelled |
| `closed` | total_received >= total_ordered AND total_invoiced >= total_ordered |
| `partially_received` | total_received > 0 AND < total_ordered |
| `awaiting_delivery` | total_invoiced >= total_ordered AND total_received = 0 |
| `partially_invoiced` | total_invoiced > 0 AND < total_ordered |
| `not_started` | Default (no invoices or goods received) |

### Deliverables Verified
- [x] Database migrations created and pushed to Supabase
- [x] PO number auto-generates (PO-2026-00001)
- [x] QMHQ.total_po_committed updates when PO created
- [x] PO creation blocked when exceeds balance_in_hand
- [x] PO list page shows Card/List views with filters
- [x] PO detail page displays all information with tabs
- [x] QMHQ Purchase Orders tab shows related POs
- [x] Line items use + / - buttons for quantity (no decimals)
- [x] Signer fields use contact person selects
- [x] TypeScript compiles without errors

---

## Iteration 7.1: Number Input Enhancements

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Quantity Fields with +/- Buttons**
   - QMHQ Item Route quantity field now has - and + buttons
   - Increments/decrements by 1 (whole numbers only)
   - Minimum value of 1
   - Input field centered with hidden browser spinners

2. **Hidden Browser Spinners on All Number Inputs**
   Applied CSS to hide native up/down arrows on all number inputs:
   ```css
   [appearance:textfield]
   [&::-webkit-outer-spin-button]:appearance-none
   [&::-webkit-inner-spin-button]:appearance-none
   ```

### Files Modified

| File | Changes |
|------|---------|
| `app/(dashboard)/qmhq/new/[route]/page.tsx` | Quantity with +/- buttons, hidden spinners on amount/rate |
| `components/qmhq/transaction-dialog.tsx` | Hidden spinners on amount and exchange rate |
| `app/(dashboard)/po/new/page.tsx` | Hidden spinners on exchange rate |
| `components/po/po-line-items-table.tsx` | Hidden spinners on unit price (qty already had +/-) |
| `app/(dashboard)/admin/statuses/status-dialog.tsx` | Hidden spinners on display order |
| `app/(dashboard)/admin/categories/category-dialog.tsx` | Hidden spinners on display order |

### Input Types Summary

| Input Type | Treatment |
|------------|-----------|
| Quantity | +/- buttons, whole numbers only, hidden spinners |
| Amount | Hidden spinners, decimal allowed |
| Exchange Rate | Hidden spinners, 4 decimal places |
| Unit Price | Hidden spinners, decimal allowed |
| Display Order | Hidden spinners, whole numbers |

### Deliverables Verified
- [x] QMHQ quantity field has +/- buttons
- [x] All number inputs have hidden browser spinners
- [x] PO line items already had +/- for quantity
- [x] TypeScript compiles without errors

---

## Iteration 7.2: DatePicker Min/Max Date Validation

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Enhanced DatePicker Component** (`components/ui/date-picker.tsx`)
   - Added `minDate` prop to disable dates before a minimum date
   - Added `maxDate` prop to disable dates after a maximum date
   - Uses react-day-picker's disabled matcher to gray out invalid dates

2. **PO Create Page Validation** (`app/(dashboard)/po/new/page.tsx`)
   - Expected Delivery Date now has `minDate={poDate}`
   - Cannot select a delivery date earlier than the PO date
   - Invalid dates are grayed out in the calendar picker

### Files Modified

| File | Changes |
|------|---------|
| `components/ui/date-picker.tsx` | Added `minDate` and `maxDate` props |
| `app/(dashboard)/po/new/page.tsx` | Set `minDate={poDate}` on Expected Delivery Date |

### Deliverables Verified
- [x] DatePicker supports minDate/maxDate props
- [x] Expected Delivery Date cannot be earlier than PO Date
- [x] Invalid dates grayed out in calendar
- [x] TypeScript compiles without errors

---

## Iteration 7.3: Currency Field Required with No Default

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Currency Field - No Default Value** (`app/(dashboard)/po/new/page.tsx`)
   - Changed default from "MMK" to empty string
   - Shows "Select currency..." placeholder when empty
   - Marked as required field with red asterisk
   - Added `currency` to `canSubmit` validation - form cannot submit without selection

### Files Modified

| File | Changes |
|------|---------|
| `app/(dashboard)/po/new/page.tsx` | Currency no default, placeholder, required validation |

### Deliverables Verified
- [x] Currency field starts empty with placeholder
- [x] Currency is required for form submission
- [x] TypeScript compiles without errors

---

## Iteration 7.4: Simplified Supplier Fields

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Simplified Supplier List Page** (`app/(dashboard)/admin/suppliers/page.tsx`)
   - Reduced columns to: Name, Email, Phone, Actions
   - Removed: Company Name, Payment Terms columns
   - Updated select query to only fetch required fields

2. **Simplified Supplier Dialog** (`app/(dashboard)/admin/suppliers/supplier-dialog.tsx`)
   - Reduced form fields to: Name (required), Email, Phone
   - Removed: Company Name, Position, Tax ID, Address, Payment Terms, Notes
   - Smaller dialog width (425px instead of 550px)

### Files Modified

| File | Changes |
|------|---------|
| `app/(dashboard)/admin/suppliers/page.tsx` | Simplified columns, removed unused imports |
| `app/(dashboard)/admin/suppliers/supplier-dialog.tsx` | Reduced to 3 fields only |

### Deliverables Verified
- [x] Supplier list shows only Name, Email, Phone
- [x] Supplier create/edit dialog has only 3 fields
- [x] TypeScript compiles without errors

---

## Iteration 7.5: Simplified Item Entity

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migrations**
   - `017_item_categories.sql` - Add 'item' to entity_type enum, add category_id FK column to items
   - `018_item_categories_seed.sql` - Seed default item categories (Equipment, Consumable, Uniform, Office Supplies, Electronics, Other)

2. **Simplified Item Schema**
   - Items now have only: Name (required), Category (from categories table), Photo (image upload), SKU (auto-generated)
   - Removed from UI: Unit, WAC columns/fields, Description
   - Category changed from enum to categories table reference (`category_id` FK)
   - Added 'item' to `entity_type` enum allowing categories table to have item categories

3. **Updated TypeScript Types** (`types/database.ts`)
   - Added 'item' to entity_type enum: `"qmrl" | "qmhq" | "item"`
   - Added `category_id: string | null` to items Row, Insert, Update
   - Added category_id relationship to items Relationships

4. **Item List Page Updates** (`app/(dashboard)/item/page.tsx`)
   - Simplified columns: Photo, SKU, Name, Category, Actions
   - Removed: Unit, WAC columns
   - Category now fetched via join to categories table
   - Photo column shows thumbnail or placeholder icon
   - Category badge with dynamic color from categories table

5. **Item Dialog Updates** (`app/(dashboard)/item/item-dialog.tsx`)
   - Simplified fields: Name (required), Category (select from categories), Photo (upload)
   - Removed: Unit, Description fields
   - Category select populated from categories table with `entity_type='item'`
   - Photo upload with:
     - Click-to-upload interface with preview
     - Max 5MB file size validation
     - Image type validation (JPG, PNG, etc.)
     - Remove button with proper layout containment
     - Fixed max-height container to prevent layout breaking
   - SKU shown as read-only for existing items (auto-generated)

6. **Image Upload Layout Fix** (both dialogs)
   - Fixed image preview breaking dialog layout when image is very wide or tall
   - Used absolute positioning for image inside fixed-size container
   - Added `min-w-0` to parent containers to prevent grid overflow
   - Image uses `absolute inset-0 w-full h-full object-contain` to scale within bounds
   - Container has fixed `h-40 w-full` dimensions that don't change with image size

### Files Created

**Migrations:**
- `supabase/migrations/017_item_categories.sql`
- `supabase/migrations/018_item_categories_seed.sql`

### Files Modified

| File | Changes |
|------|---------|
| `types/database.ts` | Added 'item' to entity_type, added category_id to items |
| `app/(dashboard)/item/page.tsx` | Simplified columns, added photo, category from table |
| `app/(dashboard)/item/item-dialog.tsx` | Simplified fields, added photo upload, category select |
| `components/qmhq/transaction-dialog.tsx` | Fixed image upload container layout |

### Default Item Categories

| Name | Color | Description |
|------|-------|-------------|
| Equipment | #3B82F6 (blue) | Tools, machinery, and equipment |
| Consumable | #10B981 (emerald) | Items that are used up |
| Uniform | #8B5CF6 (purple) | Clothing and uniforms |
| Office Supplies | #F59E0B (amber) | Stationery and office items |
| Electronics | #EC4899 (pink) | Electronic devices and components |
| Other | #6B7280 (gray) | Miscellaneous items |

### Deliverables Verified
- [x] Database migrations applied successfully
- [x] Item categories seeded in categories table
- [x] Item list shows Photo, SKU, Name, Category columns only
- [x] Item dialog has Name, Category, Photo fields only
- [x] Category uses categories table with dynamic colors
- [x] Photo upload works with proper layout containment
- [x] SKU shown as read-only for existing items
- [x] Transaction dialog image upload doesn't break layout
- [x] TypeScript compiles without errors

---

## Iteration 7.6: Department Management Page

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Database Migration** (`019_departments_code_head.sql`)
   - Added `code` column (TEXT, unique) for department codes
   - Added `head_id` column (UUID FK to users) for department head

2. **Updated TypeScript Types** (`types/database.ts`)
   - Added `code: string | null` to departments Row, Insert, Update
   - Added `head_id: string | null` to departments Row, Insert, Update
   - Added head_id relationship to departments Relationships

3. **Department List Page** (`/admin/departments`)
   - DataTable with columns: Name, Code, Department Head, Actions
   - Search by department name
   - Department code shown in monospace amber badge
   - Department head shows user name

4. **Department Dialog** (`department-dialog.tsx`)
   - Fields: Name (required), Department Code (auto-uppercase), Department Head (user select)
   - Code input converts to uppercase automatically
   - User select populated from active users

### Files Created

**Migration:**
- `supabase/migrations/019_departments_code_head.sql`

**Pages:**
- `app/(dashboard)/admin/departments/page.tsx`
- `app/(dashboard)/admin/departments/department-dialog.tsx`

### Files Modified

| File | Changes |
|------|---------|
| `types/database.ts` | Added code and head_id to departments type |

### Deliverables Verified
- [x] Database migration applied successfully
- [x] Department list page shows Name, Code, Head columns
- [x] Department create/edit dialog has 3 fields
- [x] Department code auto-uppercase
- [x] Department head select populated from users
- [x] TypeScript compiles without errors

---

## Iteration 7.7: Item Category Inline Creation

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Updated InlineCreateSelect Component**
   - Extended `entityType` prop to support `"item"` in addition to `"qmrl"` and `"qmhq"`
   - Now supports: `entityType: "qmrl" | "qmhq" | "item"`

2. **Updated Item Dialog**
   - Replaced standard Select with InlineCreateSelect for category field
   - Users can now create new item categories inline with [+] button
   - New categories are immediately added to options and selected

### Files Modified

| File | Changes |
|------|---------|
| `components/forms/inline-create-select.tsx` | Added "item" to entityType union |
| `app/(dashboard)/item/item-dialog.tsx` | Replaced Select with InlineCreateSelect |

### Deliverables Verified
- [x] Item category can be created inline with [+] button
- [x] New category is selected after creation
- [x] TypeScript compiles without errors

---

## Iteration 7.8: Filter by Entity Type in Categories and Statuses

**Status:** Completed
**Date:** January 2026

### What Was Done

1. **Categories Page Filter**
   - Added entity type filter tabs: All, QMRL, QMHQ, Item
   - Filter buttons show count for each entity type
   - Stats cards updated to 4 columns including Item count
   - DataTable filters data based on selected entity type

2. **Statuses Page Filter**
   - Added entity type filter tabs: All, QMRL, QMHQ
   - Filter buttons show count for each entity type
   - DataTable filters data based on selected entity type

### Files Modified

| File | Changes |
|------|---------|
| `app/(dashboard)/admin/categories/page.tsx` | Added entity type filter with counts |
| `app/(dashboard)/admin/statuses/page.tsx` | Added entity type filter with counts |

### Deliverables Verified
- [x] Categories page has All/QMRL/QMHQ/Item filter tabs
- [x] Statuses page has All/QMRL/QMHQ filter tabs
- [x] Filter tabs show count for each entity type
- [x] DataTable filters correctly based on selection
- [x] TypeScript compiles without errors

---

## Next Iteration: Iteration 8 - Invoices

**Dependencies:** Iteration 7 (Purchase Orders)

**Planned Tasks:**
- Database: `invoices`, `invoice_line_items` tables
- 4-step invoice creation wizard
- Invoice list page with Card/List views
- Invoice detail page
- Quantity validation (can't invoice more than PO quantity)
- Block invoices for closed POs
- Void functionality (no delete)
- Update PO smart status on invoice creation

---

## Development Notes

### Git Workflow
- Feature branches for each iteration
- Clear commit messages
- Tag releases after iteration completion

### Testing Approach
- Test as you go during development
- Verify all deliverables before marking iteration complete
- Run TypeScript check: `npx tsc --noEmit`
- Run dev server: `npm run dev`

### Key Decisions Made
1. **Package Manager:** npm (standard, widely compatible)
2. **UI Library:** shadcn/ui patterns (copy-paste, customizable)
3. **Design Theme:** "Refined Industrial" - amber brand (#d97706), slate backgrounds
4. **Auth Method:** Email OTP (two-step verification)
5. **Role System:** 7 roles as defined in PRD

---

## Version History

| Version | Date | Iterations | Notes |
|---------|------|------------|-------|
| v0.1.0 | Jan 2026 | 1-3 | Foundation, Database, Auth |
| v0.2.0 | Jan 2026 | 4 | Master Data Management (Contacts, Suppliers, Items, Warehouses) |
| v0.3.0 | Jan 2026 | 5 | QMRL Module (Request Letters with status grouping, forms, detail view) |
| v0.3.1 | Jan 2026 | 1-5 | "Tactical Command Center" design system applied across all UI |
| v0.3.2 | Jan 2026 | 5.1 | QMRL enhancements: Request Letter No field, DatePicker component, Calendar UI |
| v0.3.3 | Jan 2026 | 5.2 | Inline Creation Pattern: InlineCreateSelect component for Category and Status |
| v0.3.4 | Jan 2026 | 5.3 | Admin Management Pages: /admin/statuses and /admin/categories |
| v0.3.5 | Jan 2026 | 5.4 | User Management Page: /admin/users with create/edit/deactivate |
| v0.3.6 | Jan 2026 | 5.5 | Performance optimizations, User Invite API, bug fixes |
| v0.4.0 | Jan 2026 | 6 | QMHQ Module: 3 route types, 2-page creation, Card/List view, detail page |
| v0.4.1 | Jan 2026 | 6.1 | QMHQ fixes: EUSD display, thousand separators, form persistence, item route cleanup |
| v0.4.2 | Jan 2026 | 6.2 | Money In/Out Transaction Dialog for Expense and PO routes |
| v0.4.3 | Jan 2026 | 6.3 | Transaction enhancements (upload, IDs), 5-metric dashboard, QMHQ edit page |
| v0.4.4 | Jan 2026 | 6.4 | QMRL detail page shows related QMHQ lines |
| v0.4.5 | Jan 2026 | 6.5 | QMRL edit page |
| v0.4.6 | Jan 2026 | 6.6 | Pre-select Parent QMRL when creating QMHQ from QMRL detail |
| v0.4.7 | Jan 2026 | 6.7 | Pagination for QMRL and QMHQ list pages (Card/List views) |
| v0.4.8 | Jan 2026 | 6.8 | Fixed infinite re-render loop in AuthProvider causing slow navigation |
| v0.5.0 | Jan 2026 | 7 | Purchase Orders Module: PO creation with balance validation, line items, smart status |
| v0.5.1 | Jan 2026 | 7.1 | Number input enhancements: +/- buttons for quantity, hidden spinners on all inputs |
| v0.5.2 | Jan 2026 | 7.2 | DatePicker min/max validation: Expected Delivery Date cannot be earlier than PO Date |
| v0.5.3 | Jan 2026 | 7.3 | Currency field required with no default value |
| v0.5.4 | Jan 2026 | 7.4 | Simplified Supplier to only Name, Email, Phone |
| v0.5.5 | Jan 2026 | 7.5 | Simplified Item: Name, Category (from table), Photo (upload), SKU (auto-generated) |
| v0.5.6 | Jan 2026 | 7.6 | Department Management: Name, Code, Department Head |
| v0.5.7 | Jan 2026 | 7.7 | Item category inline creation (like QMRL/QMHQ) |
| v0.5.8 | Jan 2026 | 7.8 | Entity type filters in Categories and Statuses pages |

---

## Design System: Tactical Command Center

Applied comprehensive design enhancements across all iterations using the frontend-design skill.

### Core Design Principles
- **Theme:** Dark slate backgrounds with amber (#d97706) as primary accent
- **Typography:** Monospace for data/codes, clean sans-serif for content
- **Effects:** Scan line overlays, corner accents, pulsing status indicators
- **Animations:** Staggered slide-up entrances, hover transforms, glow effects

### Components Enhanced

#### Iteration 1 - Foundation
- **Login Page:** Tactical card with scan overlay, corner decorations, amber gradient buttons
- **Sidebar:** Section headers, status dot in footer, amber-highlighted active states
- **Header:** System status indicator, tactical profile dropdown, scan line effect
- **Dashboard Layout:** Grid overlay background, slate-950 base color

#### Iteration 3 - Authentication
- **Login Flow:** Shield icon, "OPERATOR EMAIL" labels, military-style messaging
- **OTP Input:** Amber-highlighted digits, "AUTHORIZATION CODE" styling

#### Iteration 4 - Master Data
- **Contact Persons:** Violet admin badge, command panel wrapper, staggered animation
- **Suppliers:** Emerald vendor badge, tactical data table styling
- **Items:** Blue inventory badge, category color badges
- **Warehouses:** Cyan storage badge, consistent page headers

#### Iteration 5 - QMRL Module
- **List Page:** Kanban columns with glowing status dots, tactical cards
- **Create Form:** Command panels with section headers and corner accents
- **Detail Page:** Request ID badges, styled tabs, info panels

### CSS Classes Added (globals.css)
- `.tactical-card` - Cards with hover effects, gradient borders
- `.corner-accents` - Military badge style corner marks
- `.status-dot` - Pulsing status indicators (todo/progress/done)
- `.command-panel` - Form section styling with top accent line
- `.section-header` - Section headers with amber accent divider
- `.request-id-badge` - Prominent request ID display
- `.priority-tactical` - Tactical priority badges with glow
- `.grid-overlay` - Subtle amber grid pattern background
- `.scan-overlay` - Scan line effect animation
- `.divider-accent` - Dividers with amber gradient edge

### Animation Keyframes
- `@keyframes pulse-glow` - Status dot pulsing
- `@keyframes scan-line` - Scan line movement
- `@keyframes slide-up` - Staggered card entrance
- `@keyframes border-glow` - Priority badge border animation
