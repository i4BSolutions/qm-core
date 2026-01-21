# CLAUDE.md - QM System Development Guide

## Project Overview

**QM System** is an internal ticket, expense, and inventory management platform serving as a Single Source of Truth (SSOT) for request-to-fulfillment workflows across departments.

### Tech Stack

| Layer           | Technology                           |
|-----------------|--------------------------------------|
| Frontend        | Next.js 14+ (App Router), React, TypeScript |
| Styling         | Tailwind CSS                         |
| Authentication  | Supabase Auth (Email OTP / Magic Link) |
| Database        | Supabase PostgreSQL                  |
| Authorization   | Supabase RLS + Custom RBAC           |
| Backend         | Supabase Edge Functions              |
| Deployment      | Vercel                               |

### Key Documents

- `PRD.md` - Full product requirements (~1,900 lines)

---

## Key Commands

```bash
# Development
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking

# Database (Supabase CLI)
npx supabase start           # Start local Supabase
npx supabase db reset        # Reset database with migrations
npx supabase migration new   # Create new migration
npx supabase db push         # Push migrations to remote

# Testing
npm run test         # Run tests
npm run test:watch   # Watch mode
```

---

## Architecture Decisions

### Folder Structure

```
/app
  /api                 # API routes
  /(auth)
    /login             # Login page
  /(dashboard)
    /dashboard         # Main dashboard
    /qmrl              # QMRL pages
    /qmhq              # QMHQ pages
    /po                # Purchase Order pages
    /invoice           # Invoice pages
    /inventory         # Inventory pages
    /warehouse         # Warehouse pages
    /item              # Item pages
    /admin             # Admin pages
  layout.tsx           # Root layout

/components
  /ui                  # Base UI components (Button, Input, Select, etc.)
  /forms               # Form components (reusable inputs, selects)
  /tables              # Table/List components
  /cards               # Card view components
  /layout              # Layout components (Sidebar, Header)

/lib
  /supabase            # Supabase client and utilities
  /hooks               # Custom React hooks
  /utils               # Utility functions
  /validations         # Zod schemas

/types                 # TypeScript type definitions

/supabase
  /migrations          # Database migrations
  /functions           # Edge Functions
```

### Component Patterns

1. **Server Components by Default** - Use client components only when needed (interactivity, hooks)
2. **Colocation** - Keep related files together (page + components)
3. **Composition over Props** - Build complex UI from smaller composable components

### Database Conventions

- **IDs**: Use `QMRL-YYYY-NNNNN` format for user-facing IDs (e.g., `QMRL-2025-00001`)
- **UUIDs**: Use Postgres `gen_random_uuid()` for internal primary keys
- **Timestamps**: Always include `created_at`, `updated_at` with `TIMESTAMPTZ`
- **Audit Fields**: Include `created_by`, `updated_by` referencing `users(id)`
- **Soft Delete**: Use `is_active` boolean instead of hard deletes

### Financial Display Rules

| Rule | Implementation |
|------|----------------|
| Amounts | 2 decimal places (`DECIMAL(15,2)`) |
| Exchange Rates | 4 decimal places (`DECIMAL(10,4)`) |
| EUSD Display | Show alongside every financial amount |
| Calculation | `amount_eusd = amount / exchange_rate` |

---


## Iteration Guide

Development is organized into 10 iterations with minimal cross-dependencies. Complete each iteration fully before moving to the next.

---

### Iteration 1: Project Foundation

**Dependencies:** None

**Goal:** Initialize the Next.js project with proper configuration and folder structure.

#### Deliverables

1. **Next.js Setup**
   - Initialize Next.js 14+ with App Router
   - Configure TypeScript (strict mode)
   - Set up Tailwind CSS with design tokens

2. **Folder Structure**
   - Create `/app`, `/components`, `/lib`, `/types` directories
   - Set up path aliases in `tsconfig.json`

3. **Supabase Client**
   - Create `/lib/supabase/client.ts` (browser client)
   - Create `/lib/supabase/server.ts` (server client)
   - Create `/lib/supabase/middleware.ts` (for auth)

4. **Environment Configuration**
   - Create `.env.local.example` with required variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=
     NEXT_PUBLIC_SUPABASE_ANON_KEY=
     SUPABASE_SERVICE_ROLE_KEY=
     ```

5. **Base Layout**
   - Create root `layout.tsx` with Tailwind setup
   - Create placeholder `/app/page.tsx`

#### Files to Create
```
/app/layout.tsx
/app/page.tsx
/lib/supabase/client.ts
/lib/supabase/server.ts
/tailwind.config.ts
/types/index.ts
.env.local.example
```

---

### Iteration 2: Database Schema - Core Tables

**Dependencies:** Iteration 1 (Supabase client configured)

**Goal:** Create the foundational database tables and type definitions.

#### Deliverables

1. **Core Table Migrations**
   ```
   /supabase/migrations/
     001_departments.sql
     002_users.sql
     003_status_config.sql
     004_categories.sql
   ```

2. **Departments Table**
   - Fields: `id`, `name`, `parent_id`, audit fields
   - Self-referential for hierarchy

3. **Users Table**
   - Link to `auth.users(id)` with `ON DELETE CASCADE`
   - Roles: `admin`, `quartermaster`, `finance`, `inventory`, `proposal`, `frontline`, `requester`
   - Reference to `departments`

4. **Status Config Table**
   - Entity types: `qmrl`, `qmhq`
   - Status groups: `to_do`, `in_progress`, `done`
   - Default statuses seeded

5. **Categories Table**
   - Entity types: `qmrl`, `qmhq`
   - Default categories seeded

6. **ID Generation Utility**
   - Function to generate `QMRL-YYYY-NNNNN` format IDs
   - Location: `/lib/utils/id-generator.ts`

7. **Type Definitions**
   - Create types in `/types/database.ts` matching schema

#### Key Schema Details
```sql
-- Users role enum
CHECK (role IN ('admin', 'quartermaster', 'finance', 'inventory', 'proposal', 'frontline', 'requester'))

-- Status groups
CHECK (status_group IN ('to_do', 'in_progress', 'done'))
```

---

### Iteration 3: Authentication

**Dependencies:** Iteration 2 (users table exists)

**Goal:** Implement Supabase Auth with Email OTP and protected routes.

#### Deliverables

1. **Login Page** (`/app/(auth)/login/page.tsx`)
   - Email input form
   - OTP/Magic Link request via Supabase Auth
   - Error handling for unknown emails ("Contact administrator")

2. **Auth Middleware** (`/middleware.ts`)
   - Protect all routes except `/login`
   - Redirect unauthenticated users to `/login`
   - Redirect authenticated users from `/login` to `/dashboard`

3. **User Context Provider**
   - Create `/components/providers/auth-provider.tsx`
   - Expose current user and role via context
   - Include `useUser()` hook

4. **Dashboard Shell**
   - Create `/app/(dashboard)/layout.tsx`
   - Sidebar navigation component
   - Header with user info and logout

5. **Role-Based Navigation**
   - Show/hide nav items based on user role
   - Implement permission matrix from PRD

#### Permission Matrix Reference
| Resource | Admin | Quartermaster | Finance | Inventory | Proposal | Frontline | Requester |
|----------|-------|---------------|---------|-----------|----------|-----------|-----------|
| QMRL | CRUD | CRUD | R | R | RU | RU | CR (own) |
| QMHQ | CRUD | CRUD | RU | RU | CRUD | R | R (own) |

---

### Iteration 4: Master Data Management

**Dependencies:** Iteration 2 (departments table)

**Goal:** Create master data entities and reusable form/table components.

#### Deliverables

1. **Database Tables**
   ```
   /supabase/migrations/
     005_contact_persons.sql
     006_suppliers.sql
     007_items.sql
     008_warehouses.sql
   ```

2. **Reusable UI Components**
   - `/components/ui/input.tsx` - Text input with label/error
   - `/components/ui/select.tsx` - Searchable select dropdown
   - `/components/ui/date-picker.tsx` - Date input
   - `/components/ui/textarea.tsx` - Multi-line input
   - `/components/ui/button.tsx` - Button variants

3. **Reusable Table Components**
   - `/components/tables/data-table.tsx` - Generic data table
   - Column sorting, pagination, search

4. **CRUD Pages for Each Entity**
   - Contact Persons: `/admin/contacts`
   - Suppliers: `/admin/suppliers`
   - Items: `/item` (list) + `/item/[id]` (detail) + `/item/new` (create)
   - Warehouses: `/warehouse` (list) + `/warehouse/[id]` (detail)

5. **Search and Filter Utilities**
   - `/lib/utils/search.ts` - Text search helpers
   - `/lib/hooks/use-search.ts` - Debounced search hook

#### Items Table Key Fields
```sql
-- WAC Valuation (auto-updated)
wac_amount DECIMAL(15,2) DEFAULT 0.00
wac_currency TEXT DEFAULT 'MMK'
wac_exchange_rate DECIMAL(10,4) DEFAULT 1.0000
wac_amount_eusd DECIMAL(15,2) GENERATED ALWAYS AS (...)
```

---

### Iteration 5: QMRL Module

**Dependencies:** Iteration 3 (auth), Iteration 4 (master data)

**Goal:** Implement the QMRL (Request Letter) module with Notion-style status.

#### Deliverables

1. **Database Migration**
   ```sql
   /supabase/migrations/009_qmrl.sql
   ```
   - Create `qmrl` table with all fields from PRD
   - Create indexes on `status_id`, `category_id`, `assigned_to`

2. **QMRL List Page** (`/qmrl/page.tsx`)
   - Group by status (to_do, in_progress, done)
   - Filter by category, assigned user
   - Search by title/ID

3. **QMRL Create Page** (`/qmrl/new/page.tsx`)
   - Single-page form (not multi-step)
   - Sections: Basic Info, Department & Contacts, Assignment & Status, Description
   - Inline status/category creation with [+] button

4. **QMRL Detail Page** (`/qmrl/[id]/page.tsx`)
   - Tabs: Details, QMHQ Lines, History
   - Edit functionality
   - Link to create QMHQ

5. **Inline Creation Pattern**
   - `/components/forms/inline-create-select.tsx`
   - Select dropdown with [+] button
   - Expandable inline form for new item creation
   - "Create & Select" action

#### QMRL Fields
- `request_id` (QMRL-YYYY-NNNNN)
- `title`, `description`, `notes`
- `status_id`, `category_id`
- `department_id`, `contact_person_id`
- `assigned_to`, `requester_id`
- `priority` (low, medium, high, critical)
- `request_date`

---

### Iteration 6: QMHQ Module

**Dependencies:** Iteration 5 (QMRL)

**Goal:** Implement QMHQ with three route types (Item, Expense, PO).

#### Deliverables

1. **Database Migrations**
   ```
   /supabase/migrations/
     010_qmhq.sql
     011_financial_transactions.sql
   ```

2. **QMHQ List Page** (`/qmhq/page.tsx`)
   - Card View / List View toggle
   - Filter by route type, status
   - Show amount/EUSD for financial routes

3. **QMHQ Create - Page 1** (`/qmhq/new/page.tsx`)
   - Parent QMRL display
   - Basic info: line name, category, contact, assigned to, status
   - Route selection cards: Item, Expense, PO
   - "Next" button to route-specific page

4. **QMHQ Create - Page 2A: Item Route**
   - Item selection with search
   - Quantity input
   - Warehouse availability display (read-only)

5. **QMHQ Create - Page 2B: Expense Route**
   - Amount input (2 decimals)
   - Exchange rate input (4 decimals)
   - EUSD equivalent display (calculated)

6. **QMHQ Create - Page 2C: PO Route**
   - Budget amount input
   - Exchange rate input
   - EUSD display
   - Info about Balance in Hand flow

7. **QMHQ Detail Page** (`/qmhq/[id]/page.tsx`)
   - Tabs: Details, Transactions (for expense/po), POs (for po route), History
   - Route-specific content

#### Route Types
| Route | Code | Financial | Inventory |
|-------|------|-----------|-----------|
| Item | `item` | No | Inventory Out |
| Expense | `expense` | Money In/Out | No |
| PO | `po` | Money In + PO | Stock In via Invoice |

#### Balance in Hand (PO Route)
```
balance_in_hand = total_money_in - total_po_committed
```

---

### Iteration 7: Purchase Orders

**Dependencies:** Iteration 6 (QMHQ with PO route)

**Goal:** Implement PO module with smart status lifecycle.

#### Deliverables

1. **Database Migrations**
   ```
   /supabase/migrations/
     012_purchase_orders.sql
     013_po_line_items.sql
   ```

2. **PO List Page** (`/po/page.tsx`)
   - Card View / List View toggle
   - Status badges with colors
   - Progress indicator (% invoiced/received)

3. **PO Create Page** (`/po/new/page.tsx`)
   - Select QMHQ (PO route only)
   - Supplier selection
   - Line items table (add/edit/remove)
   - Currency and exchange rate
   - Balance in Hand validation

4. **PO Detail Page** (`/po/[id]/page.tsx`)
   - Tabs: Details, Line Items, Invoices, History
   - Smart status display
   - Lock indicator when closed

5. **Smart Status Calculation**
   - Create `/lib/utils/po-status.ts`
   - Calculate based on:
     - `total_ordered` = SUM(po_line_items.quantity)
     - `total_invoiced` = SUM(non-voided invoice line items)
     - `total_received` = SUM(inventory_in transactions)

#### PO Status Values
| Status | Condition |
|--------|-----------|
| `not_started` | No invoices or goods received |
| `partially_invoiced` | Some items invoiced |
| `awaiting_delivery` | Fully invoiced, not received |
| `partially_received` | Some goods received |
| `closed` | Fully matched (PO = Invoice = Stock) |
| `cancelled` | PO cancelled |

---

### Iteration 8: Invoices

**Dependencies:** Iteration 7 (PO exists)

**Goal:** Implement 4-step invoice creation with quantity validation.

#### Deliverables

1. **Database Migrations**
   ```
   /supabase/migrations/
     014_invoices.sql
     015_invoice_line_items.sql
   ```

2. **Invoice List Page** (`/invoice/page.tsx`)
   - Card View / List View toggle
   - Status indicators
   - EUSD totals

3. **Invoice Create - 4 Steps** (`/invoice/new/page.tsx`)
   - **Step 1: Header** - Invoice no, dates, currency, exchange rate
   - **Step 2: PO Selection** - Search open POs, show available quantities
   - **Step 3: Line Items** - Select items, input qty (max = available), unit price
   - **Step 4: Summary** - Review all details, submit

4. **Invoice Detail Page** (`/invoice/[id]/page.tsx`)
   - Tabs: Details, Line Items, Stock Receipts, History
   - Void button (no delete)

5. **Quantity Validation**
   - Database trigger: `validate_invoice_line_quantity()`
   - UI validation: Qty <= Available (PO Qty - Already Invoiced)

6. **Block Invoice for Closed PO**
   - Database trigger: `block_invoice_for_closed_po()`
   - UI: Hide closed POs from selection

7. **Void Functionality**
   - Set `is_voided = true`, `voided_at`, `voided_by`, `void_reason`
   - Voided invoices excluded from PO status calculations

#### Invoice Independence
- Invoice currency and exchange rate are **independent** from PO
- PO unit price shown as reference only

---

### Iteration 9: Inventory Management

**Dependencies:** Iteration 8 (Invoices for Stock In from Invoice)

**Goal:** Implement stock transactions and WAC calculation.

#### Deliverables

1. **Database Migration**
   ```
   /supabase/migrations/016_inventory_transactions.sql
   ```

2. **Stock In Form** (`/inventory/stock-in/page.tsx`)
   - Source selection: From Invoice or Manual
   - If from Invoice: select invoice, auto-populate items/quantities
   - Warehouse selection
   - Unit cost for WAC calculation

3. **Stock Out Form** (`/inventory/stock-out/page.tsx`)
   - Item and warehouse selection
   - Quantity (max = available stock)
   - Reason selection: `request`, `consumption`, `damage`, `lost`, `transfer`, `adjustment`
   - For transfer: destination warehouse

4. **WAC Calculation Trigger**
   - Create `update_item_wac()` function
   - Triggered on `inventory_in` with unit cost
   - Formula: `WAC = (Existing Value + New Value) / (Existing Qty + New Qty)`

5. **Warehouse Detail Page Enhancement** (`/warehouse/[id]`)
   - Inventory tab with WAC display
   - KPI cards: Total Items, Total Units, Total Value, Total Value EUSD
   - Stock Movement tab

6. **Item Detail Page Enhancement** (`/item/[id]`)
   - Stock by warehouse table
   - Current WAC display
   - Transaction history

#### Stock Out Reasons
```sql
CHECK (reason IN ('request', 'consumption', 'damage', 'lost', 'transfer', 'adjustment'))
```

---

### Iteration 10: Audit, RLS & Polish

**Dependencies:** All previous iterations

**Goal:** Add audit logging, RLS policies, and final polish.

#### Deliverables

1. **Database Migration**
   ```
   /supabase/migrations/
     017_audit_logs.sql
     018_audit_triggers.sql
     019_rls_policies.sql
   ```

2. **Audit Log Table**
   - Entity type, entity ID, action
   - Old/new values (JSONB)
   - Changed by, changed at
   - Human-readable summary

3. **Audit Triggers**
   - Create generic `create_audit_log()` function
   - Apply to all major tables: users, qmrl, qmhq, items, warehouses, purchase_orders, invoices, inventory_transactions, financial_transactions, suppliers, contact_persons

4. **History Tab Component**
   - Reusable `/components/history/history-tab.tsx`
   - Timeline display with icons per action type
   - Filter by action, date range, user

5. **RLS Policies**
   - Users: Admin full access, others read own
   - QMRL: Based on permission matrix
   - QMHQ: Based on permission matrix
   - Master data: Role-based read/write

6. **Permission Checks in UI**
   - Create `/lib/hooks/use-permissions.ts`
   - Check `can('create', 'qmrl')`, `can('update', 'qmhq')`, etc.
   - Conditionally render buttons/forms

7. **Error Handling**
   - Global error boundary
   - Toast notifications for actions
   - Form validation error display

8. **Loading States**
   - Skeleton loaders for lists/cards
   - Suspense boundaries

#### Action Icons for History
| Action | Icon |
|--------|------|
| create | + |
| update | (pencil) |
| delete | (trash) |
| status_change | (note) |
| assignment_change | (user) |
| void | (stop) |
| approve | (check) |
| close | (lock) |

---

## Quick Reference

### QMHQ Routes

| Route | Financial | Inventory |
|-------|-----------|-----------|
| Item | None | Stock Out from warehouse |
| Expense | Money In/Out | None |
| PO | Money In -> PO -> Invoice | Stock In from Invoice |

### PO Status Flow

```
not_started -> partially_invoiced -> awaiting_delivery -> partially_received -> closed
                                                                              \-> cancelled
```

### ID Formats

| Entity | Format | Example |
|--------|--------|---------|
| QMRL | QMRL-YYYY-NNNNN | QMRL-2025-00001 |
| QMHQ | QMHQ-YYYY-NNNNN | QMHQ-2025-00001 |
| PO | PO-YYYY-NNNNN | PO-2025-00001 |
| Invoice | INV-YYYY-NNNNN | INV-2025-00001 |

### User Roles

| Role | Access Level |
|------|--------------|
| Admin | Full system access |
| Quartermaster | Approve, view all, manage inventory |
| Finance | Financial transactions, PO, Invoice |
| Inventory | Inventory transactions, warehouses |
| Proposal | Process requests, create QMHQ |
| Frontline | Validate draft requests |
| Requester | Create requests, view own only |

---

## Development Workflow

1. **Start each iteration** by reading its dependencies and deliverables
2. **Create database migrations first** - schema before application code
3. **Generate types** from schema using Supabase CLI
4. **Build UI components** from smallest to largest
5. **Test thoroughly** before moving to next iteration
6. **Commit at iteration completion** with clear message

---

## Notes

- Always display EUSD alongside any financial amount
- Use generated columns for EUSD calculations where possible
- Soft delete with `is_active` flag, never hard delete
- All timestamps in UTC with `TIMESTAMPTZ`
- Keep PRD.md as source of truth for business rules
