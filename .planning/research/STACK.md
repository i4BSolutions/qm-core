# Technology Stack

**Project:** QM System v1.8 - UI Standardization, Flow Tracking, RBAC Overhaul
**Researched:** 2026-02-11

---

## NEW Stack Additions

### Flow Visualization (Admin Flow Tracking Page)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **NONE REQUIRED** | - | Flow visualization | Use native CSS + existing components. Linear chain QMRL→QMHQ→PO→Invoice→Stock does not require graph library overhead. |

**Rationale:** React Flow (latest v11.x) is powerful for complex node-based UIs with dragging, zooming, and custom layouts, but introduces unnecessary complexity for a **simple linear chain visualization**. The flow tracking page shows a sequential chain with clear parent-child relationships, not a complex DAG requiring interaction.

**Implementation approach:**
- Use existing `Table`, `Badge`, `Card` components
- CSS Flexbox/Grid for horizontal timeline layout
- Lucide icons (`ChevronRight`, `ArrowRight`) for connectors
- Conditional rendering based on data presence
- No additional dependencies needed

Sources:
- [React Flow Documentation](https://reactflow.dev)
- [Supabase Best Practices](https://supabase.com/docs/guides/database/postgres/enums)

---

### UI Standardization (Page Layout Consistency)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **NONE REQUIRED** | - | Consistent layouts | Current stack sufficient. Create reusable layout components from existing primitives. |

**Current stack already provides:**
- ✅ `@tanstack/react-table` (v8.21.3) - table sorting, filtering, pagination
- ✅ shadcn/ui primitives (Radix UI) - `Card`, `Badge`, `Table`, `Input`, `Select`, `Skeleton`
- ✅ Tailwind CSS design tokens - status colors, typography scale, shadows
- ✅ `Pagination` component - consistent pagination
- ✅ `use-search` hook - debounced search

**What's needed:** Composition patterns, not new libraries.

**Implementation approach:**
1. **Create `<PageShell>` component** - Standard page wrapper with title, actions, filters
2. **Create `<DataTableShell>` component** - Wraps `@tanstack/react-table` with search, filters, pagination
3. **Create `<FilterBar>` component** - Reusable filter controls (search, selects, date pickers)
4. **Document layout patterns** - Establish conventions in component library

**Example pattern:**
```tsx
<PageShell
  title="QMRL Requests"
  action={<Button>New Request</Button>}
>
  <FilterBar
    search={searchQuery}
    onSearchChange={setSearchQuery}
    filters={[
      { type: 'select', label: 'Category', value: categoryFilter, onChange: setCategoryFilter },
      { type: 'select', label: 'Assigned To', value: assignedFilter, onChange: setAssignedFilter }
    ]}
  />
  <DataTableShell
    columns={columns}
    data={filteredData}
    pagination={{ page: currentPage, pageSize, total }}
  />
</PageShell>
```

Sources:
- [shadcn/ui Next.js Templates](https://www.shadcn.io/template)
- [Next.js & shadcn/ui Admin Dashboard](https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard)

---

### RBAC Overhaul (7 Roles → 3 Roles)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **NONE REQUIRED** | - | Role migration | PostgreSQL native ALTER TYPE + data migration. No ORM changes needed. |

**Database changes required:**
1. **Create new enum** `user_role_new` with values: `admin`, `qmrl_user`, `qmhq_user`
2. **Map existing roles** to new roles via data migration
3. **Update RLS policies** to reference new roles
4. **Drop old enum**, rename new enum to `user_role`

**Migration strategy (SAFE):**
```sql
-- Step 1: Create new enum
CREATE TYPE user_role_new AS ENUM ('admin', 'qmrl_user', 'qmhq_user');

-- Step 2: Add temporary column
ALTER TABLE users ADD COLUMN role_new user_role_new;

-- Step 3: Migrate data with explicit mapping
UPDATE users SET role_new =
  CASE role::text
    WHEN 'admin' THEN 'admin'::user_role_new
    WHEN 'quartermaster' THEN 'admin'::user_role_new
    WHEN 'finance' THEN 'qmhq_user'::user_role_new
    WHEN 'inventory' THEN 'qmhq_user'::user_role_new
    WHEN 'proposal' THEN 'qmhq_user'::user_role_new
    WHEN 'frontline' THEN 'qmrl_user'::user_role_new
    WHEN 'requester' THEN 'qmrl_user'::user_role_new
  END;

-- Step 4: Drop old column, rename new
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_new TO role;

-- Step 5: Drop old enum
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;
```

**Why NOT unsafe direct ALTER TYPE:**
PostgreSQL `ALTER TYPE ADD VALUE` is safe, but **removing enum values is unsafe** per Supabase docs: "Even if you delete every occurrence of an Enum value within a table, the target value could still exist in upper index pages. If you delete the pg_enum entry you'll break the index."

**Frontend changes:**
- Update `types/database.ts` (auto-generated from Supabase)
- Update `lib/hooks/use-permissions.ts` permission matrix
- Update `components/layout/sidebar.tsx` navigation logic
- Update RLS policies in migrations

**No external dependencies needed** - Supabase client handles enum typing automatically.

Sources:
- [Supabase Enum Management](https://supabase.com/docs/guides/database/postgres/enums)
- [PostgreSQL ALTER TYPE](https://www.postgresql.org/docs/current/sql-altertype.html)

---

## Supporting Libraries (Already in Stack)

### Forms & Validation
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-hook-form | ^7.53.0 | Form state management | All forms (already used) |
| zod | ^3.23.8 | Schema validation | All form validation |
| @hookform/resolvers | ^3.9.0 | Zod + RHF integration | All forms |

### UI Primitives (shadcn/ui via Radix)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.15 | Modals, dialogs | Confirmations, forms |
| @radix-ui/react-dropdown-menu | ^2.1.16 | Dropdowns | Action menus |
| @radix-ui/react-select | ^2.2.6 | Select inputs | Filters, forms |
| @radix-ui/react-tabs | ^1.1.13 | Tabbed interfaces | Detail pages |
| @radix-ui/react-toast | ^1.2.15 | Notifications | Success/error feedback |
| @radix-ui/react-tooltip | ^1.1.3 | Tooltips | Help text, context |

### Data Display
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-table | ^8.21.3 | Advanced tables | List pages with sorting/filtering |
| lucide-react | ^0.447.0 | Icons | All UI icons |
| date-fns | ^3.6.0 | Date formatting | All date displays |

### Styling
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tailwindcss | ^3.4.13 | Utility CSS | All styling |
| tailwindcss-animate | ^1.0.7 | Animations | Transitions, feedback |
| class-variance-authority | ^0.7.1 | Component variants | Button, Badge variations |
| tailwind-merge | ^2.5.2 | Class merging | cn() utility |
| clsx | ^2.1.1 | Conditional classes | Dynamic styling |

### File Handling
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dropzone | ^14.3.8 | File uploads | Attachment uploads |
| react-pdf | ^10.0.0 | PDF preview | Document viewer |
| file-saver | ^2.0.5 | File downloads | Export functionality |
| jszip | ^3.10.1 | Bulk downloads | Multiple file exports |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| **Flow Viz** | Native CSS + existing components | React Flow v11.x | Overkill for linear chain. React Flow adds 300KB+ for draggable nodes, zooming, complex layouts - none needed for sequential QMRL→QMHQ→PO→Invoice→Stock display. |
| **Flow Viz** | Native CSS | D3.js | Too low-level, steep learning curve for simple horizontal timeline. |
| **Layout** | Composition of existing primitives | New UI framework | Current stack complete. Adding Mantine, Ant Design, or Material-UI duplicates functionality and increases bundle size. |
| **Enum Migration** | ALTER TYPE with new enum + migration | Drizzle ORM | Project uses Supabase client, not ORM. Adding Drizzle introduces migration complexity without value - raw SQL safer and more direct. |
| **Enum Migration** | PostgreSQL enum | Lookup table | Enum appropriate here: small, fixed set (3 roles). Lookup table overkill for simple role system. |

---

## Installation

### No New Dependencies Required

All features can be implemented with existing stack:

```bash
# Current dependencies already sufficient
# No npm install needed
```

### Type Generation (After Enum Migration)

```bash
# Regenerate types from Supabase schema after role enum changes
npx supabase gen types typescript --local > types/database.ts
```

---

## Integration Points

### 1. Flow Tracking Page (`/admin/flow-tracking`)

**Data flow:**
1. Search by QMRL ID → Supabase query QMRL table
2. Join QMHQ (via `parent_qmrl_id`)
3. Join PO (via `qmhq_id`)
4. Join Invoice (via `po_id`)
5. Join `inventory_transactions` (via `invoice_id`, type='stock_in')

**Query pattern:**
```typescript
const { data } = await supabase
  .from('qmrl')
  .select(`
    *,
    qmhq:qmhq!parent_qmrl_id(*,
      purchase_orders(*,
        invoices(*,
          inventory_transactions(*)
        )
      )
    )
  `)
  .eq('request_id', searchId)
  .single();
```

**UI components:**
- `PageShell` - Standard page wrapper
- `Input` + `Search` icon - ID search
- `Card` - Each entity in chain
- `Badge` - Status indicators
- `ChevronRight` icon - Connectors
- `Skeleton` - Loading states

### 2. UI Standardization

**Component hierarchy:**
```
<PageShell>
  └─ <FilterBar>
      ├─ <Input> (search)
      ├─ <Select> (filters)
      └─ <DatePicker> (date filters)
  └─ <DataTableShell>
      ├─ @tanstack/react-table (core)
      ├─ <Table> (shadcn wrapper)
      └─ <Pagination>
```

**Files to create:**
- `components/layout/page-shell.tsx`
- `components/layout/filter-bar.tsx`
- `components/tables/data-table-shell.tsx`

**Pattern documentation:**
- Add to `/components/README.md` with usage examples
- Update CLAUDE.md with standardized patterns

### 3. RBAC Overhaul

**Affected files:**
1. `supabase/migrations/0XX_role_overhaul.sql` - Enum migration
2. `types/database.ts` - Auto-regenerated
3. `lib/hooks/use-permissions.ts` - New permission matrix
4. `components/layout/sidebar.tsx` - New navigation logic
5. All RLS policies - Update role checks

**New permission matrix:**
| Resource | Admin | QMRL User | QMHQ User |
|----------|-------|-----------|-----------|
| Users | CRUD | - | - |
| QMRL | CRUD | CRUD | R |
| QMHQ | CRUD | R | CRUD |
| PO | CRUD | - | CRUD |
| Invoice | CRUD | - | CRUD |
| Inventory | CRUD | - | CRUD |
| Items | CRUD | R | CRUD |
| Warehouses | CRUD | - | CRUD |

**Migration testing:**
1. Backup production before migration
2. Test in local Supabase first
3. Verify user role mapping matches business requirements
4. Check all RLS policies still enforce correctly

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Flow Visualization | **HIGH** | Native CSS sufficient for linear chain. Verified existing components cover all needs. No graph library required. |
| UI Standardization | **HIGH** | Current stack complete. Pattern composition from existing primitives (shadcn/ui + Tailwind). Zero new dependencies. |
| RBAC Migration | **MEDIUM** | PostgreSQL enum migration well-documented. Safe strategy established. Risk: RLS policy updates must be thorough - missing policy = broken feature. Requires careful testing. |

---

## What NOT to Add

### Don't Add These Libraries

1. **React Flow / D3.js / Recharts** - Flow tracking is linear chain, not complex visualization
2. **New UI framework** (Mantine, Ant Design, MUI) - shadcn/ui already provides all primitives
3. **ORM** (Drizzle, Prisma, TypeORM) - Supabase client sufficient, raw SQL safer for enum migration
4. **State management** (Zustand, Redux) - React Server Components + URL params handle state
5. **Animation libraries** (Framer Motion, GSAP) - `motion` library already in stack (v11.11.4), tailwindcss-animate sufficient
6. **Form builders** (Formik, Final Form) - react-hook-form already established
7. **Date libraries beyond date-fns** (Moment, Day.js, Luxon) - date-fns adequate
8. **CSS-in-JS** (Emotion, styled-components) - Tailwind + CVA pattern established

### Why Minimal Additions

**Current bundle health:**
- Next.js 14.2.13 - stable, modern
- TypeScript strict mode - type safety
- Tailwind + shadcn/ui - consistent design system
- Supabase client - auth, db, realtime
- Form handling - react-hook-form + zod

**Adding libraries increases:**
- Bundle size (slower page loads)
- Maintenance burden (dependency updates, security patches)
- Learning curve (team onboarding)
- Build complexity (tree-shaking, optimization)

**Philosophy:** Compose from existing primitives before adding dependencies.

---

## Sources

### Primary (HIGH Confidence)
- [Supabase Enum Management](https://supabase.com/docs/guides/database/postgres/enums) - Official enum handling guidance
- [PostgreSQL ALTER TYPE Documentation](https://www.postgresql.org/docs/current/sql-altertype.html) - Official PostgreSQL docs
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) - Official integration guide

### Secondary (MEDIUM Confidence)
- [React Flow Documentation](https://reactflow.dev) - Flow library comparison (decided against)
- [Next.js & shadcn/ui Templates](https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard) - Layout pattern examples
- [shadcn/ui Templates Collection](https://shadcntemplates.com) - Community patterns

### Community Resources (Context)
- [GitHub: sequelize enum migration issues](https://github.com/sequelize/sequelize/issues/2554) - Enum migration pitfalls
- [GitHub: awesome-shadcn-ui](https://github.com/birobirobiro/awesome-shadcn-ui) - Component patterns
- [Medium: shadcn/ui + Next.js 14 integration](https://medium.com/zestgeek/how-to-integrate-shadcn-into-next-js-14-a-step-by-step-guide-917bb1946cba) - Setup guide

---

## Implementation Checklist

### Phase 1: UI Standardization (Zero Dependencies)
- [ ] Create `PageShell` component
- [ ] Create `FilterBar` component
- [ ] Create `DataTableShell` wrapper for TanStack Table
- [ ] Document patterns in `components/README.md`
- [ ] Refactor 2-3 existing pages to validate pattern
- [ ] Update CLAUDE.md with standard layout conventions

### Phase 2: RBAC Overhaul (Database Migration)
- [ ] Write migration: new enum + data mapping
- [ ] Test migration on local Supabase
- [ ] Update `use-permissions.ts` with new matrix
- [ ] Update sidebar navigation logic
- [ ] Update all RLS policies (verify each table)
- [ ] Regenerate TypeScript types
- [ ] Test permission enforcement (admin, qmrl_user, qmhq_user)
- [ ] Backup production + execute migration

### Phase 3: Flow Tracking Page (Composition)
- [ ] Create `/admin/flow-tracking/page.tsx`
- [ ] Implement search by QMRL ID
- [ ] Build join query (QMRL→QMHQ→PO→Invoice→Stock)
- [ ] Create timeline/chain layout with CSS
- [ ] Use `Card` + `Badge` + `ChevronRight` for visualization
- [ ] Add admin-only route protection
- [ ] Test with complete chains and partial chains

---

**Total New Dependencies:** 0

**Complexity:** Low (composition) to Medium (enum migration testing)

**Risk Areas:**
1. RLS policy updates - must be comprehensive
2. User role mapping - verify business logic correctness
3. Frontend permission checks - update all role conditionals

**Recommended:** Execute phases sequentially. UI standardization first (low risk), validates patterns for flow tracking page. RBAC last (highest risk), requires production backup.
