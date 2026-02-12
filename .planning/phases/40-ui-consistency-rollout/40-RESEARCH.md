# Phase 40: UI Consistency Rollout - Research

**Researched:** 2026-02-12
**Domain:** Incremental UI migration, composite component adoption, large-scale refactoring
**Confidence:** HIGH

## Summary

Phase 40 implements incremental migration of 33 pages (out of 33 total, with 3 already migrated in Phase 36) to use standardized composite components. This is NOT a greenfield implementation - composite components already exist and are validated on 3 pilot pages (QMRL list, PO list, Item detail). The codebase has 33 pages with varying complexity: 10 list pages with filters, 10 detail pages with tabs, 9 form pages, and 4 specialized pages (dashboard, admin). The challenge is surgical migration without breaking business logic, especially in complex forms like Invoice (917 lines, 3-step wizard) and Stock Out (978 lines, dynamic validation).

**Primary recommendation:** Migrate in 4 waves prioritized by complexity (simple lists first, complex forms last). Use established surgical JSX replacement pattern from Phase 36. Track migration progress with per-page verification to ensure 80%+ adoption across all page types.

**Key findings:**
- Composite components validated in Phase 36 (7 components, 3 pilot pages, -110 lines, 0 regressions)
- 33 pages remain unmigrated across 4 categories: list (10), detail (10), form (9), specialized (4)
- Largest/riskiest pages: QMHQ detail (1289 lines), Stock In (1107 lines), Invoice new (917 lines), Stock Out Requests detail (1047 lines)
- 31 pages use `command-panel` CSS class (can migrate to FormSection/FilterBar composites)
- 5 pages use `tactical-card` CSS class (domain-specific, should NOT migrate to generic composite)
- Form pages (QMRL new, QMHQ new/edit, PO new, Invoice new) have custom validation logic that must be preserved

## Standard Stack

### Core Dependencies (Already Installed in Phase 36)

All dependencies from Phase 36 are installed and validated. No new packages required.

| Library | Version | Purpose | Phase 40 Usage |
|---------|---------|---------|----------------|
| React | 18.3.1 | Component framework | All page migrations |
| Next.js | 14.2.13 | App Router | Migration preserves SSR/CSR patterns |
| @radix-ui/* | 2.x | Primitives | Used by composites (no direct change) |
| class-variance-authority | 0.7.1 | Variants | FormSection spacing variants |
| tailwind-merge | 2.5.2 | Class merging | Composite className props |
| clsx | 2.1.1 | Conditional classes | Page-level conditional styling |
| Tailwind CSS | 3.4.13 | Utility-first | Design tokens unchanged |
| lucide-react | 0.447.0 | Icons | Icon imports may change (some moved to composites) |

**No new installations required.** Phase 40 is pure migration work.

### Existing Composite Components (from Phase 36)

| Component | Type | Use Cases in Phase 40 |
|-----------|------|----------------------|
| PageHeader | Server | All 10 list pages |
| FilterBar (compound) | Client | All 10 list pages + some admin pages |
| ActionButtons | Server | Detail pages, form pages |
| FormField | Server | All 9 form pages |
| FormSection | Server | All 9 form pages + detail pages |
| DetailPageLayout | Server | All 10 detail pages |
| CardViewGrid | Client | 3 additional list pages (QMHQ, Invoice, Inventory) |

**Total:** 7 composite components, all validated in Phase 36-03 pilot migration.

## Architecture Patterns

### Migration Wave Strategy

Phase 40 follows an incremental wave-based approach to minimize risk and validate patterns early.

**Wave 1: Simple List Pages (15% risk)**
- Pages: Warehouse list, Item list, Admin (contacts, suppliers, departments, categories, statuses, users)
- Composites: PageHeader + FilterBar (some) + DataTable
- Complexity: Low - mostly table-based, minimal custom logic
- Line count: 100-300 lines per page

**Wave 2: List Pages with Card Views (25% risk)**
- Pages: QMHQ list, Invoice list, Inventory dashboard
- Composites: PageHeader + FilterBar + CardViewGrid
- Complexity: Medium - card rendering with domain-specific content
- PO list deferred from Phase 36 (add CardViewGrid with view toggle)
- Line count: 200-400 lines per page

**Wave 3: Detail Pages (35% risk)**
- Pages: QMRL detail, QMHQ detail, PO detail, Invoice detail, Warehouse detail, Stock Out Request detail
- Composites: DetailPageLayout + FormSection (for info panels)
- Complexity: Medium-High - tabs, complex data fetching, nested components
- Largest: QMHQ detail (1289 lines) requires careful sectioning
- Line count: 400-1300 lines per page

**Wave 4: Form Pages (40% risk)**
- Pages: QMRL new/edit, QMHQ new/edit, PO new, Invoice new, Stock In, Stock Out, Stock Out Request new
- Composites: FormSection + FormField + PageHeader
- Complexity: High - custom validation, multi-step wizards, dynamic field visibility
- Riskiest: Invoice new (917 lines, 3-step wizard), Stock Out (978 lines, dynamic warehouse stock)
- Line count: 300-1100 lines per page

**Wave 5: Specialized Pages (10% risk, optional)**
- Pages: Dashboard, Flow Tracking
- Composites: May need new composites (DashboardCard, StatsGrid) or defer
- Complexity: Medium - custom layouts, KPI cards
- Decision: Evaluate after Wave 1-4 completion

### Pattern: Surgical JSX Replacement (from Phase 36-03)

Phase 36 established and validated this pattern across 3 diverse pilot pages.

**Step 1: Read-First Approach**
```typescript
// ALWAYS read full file before modifying
// - Understand data fetching (useEffect, callbacks)
// - Identify state management (useState, filters, pagination)
// - Locate JSX sections to replace (lines X-Y)
// - Note preserved logic (search, filter, sort, business rules)
```

**Step 2: Surgical JSX Replacement**
```typescript
// BEFORE (inline header)
<div className="relative flex items-start justify-between mb-6">
  <div>
    <h1 className="text-3xl font-bold tracking-tight text-slate-200">
      Purchase Orders
    </h1>
    <p className="mt-1 text-slate-400">{totalItems} POs found</p>
  </div>
  <div className="flex items-center gap-2">
    <Button asChild><Link href="/po/new">New PO</Link></Button>
  </div>
</div>

// AFTER (composite)
<PageHeader
  title="Purchase Orders"
  description={`${totalItems} POs found`}
  actions={
    <Button asChild><Link href="/po/new">New PO</Link></Button>
  }
/>
```

**Step 3: Import Management**
```typescript
// ADD composite imports
import { PageHeader, FilterBar, CardViewGrid } from "@/components/composite";

// REMOVE icons now used internally by composites
// - Search icon (used by FilterBar.Search)
// - User icon (may be used by FilterBar.Select)

// KEEP imports still used elsewhere
// - Link, Button (used in actions slot)
// - Badge (domain-specific)
```

**Step 4: Verification**
```bash
# After each file edit
npx tsc --noEmit

# After all wave edits
npm run build

# Verify no visual regression (optional: screenshot comparison)
# Test all functionality (search, filter, pagination, navigation)
```

### Pattern: Preserve Domain-Specific Content

**What to migrate:** Structural layout (headers, filter bars, grid containers)
**What to preserve:** Domain-specific content (card interiors, badges, custom validations)

**Example: QMHQ Card Interior**
```typescript
// ✓ MIGRATE: CardViewGrid structure
<CardViewGrid
  items={qmhqs}
  groupBy={(q) => q.status?.status_group || 'to_do'}
  renderCard={(qmhq, index) => (
    // ✓ PRESERVE: Domain-specific card content
    <div className="tactical-card">
      {/* Route type badge, amount display, metadata - domain-specific */}
      <div className={routeConfig[qmhq.route_type].bgColor}>
        {/* ... */}
      </div>
    </div>
  )}
/>
```

**Why:** Composite components provide consistent structure, not domain content. Tactical styling (`tactical-card`, priority badges, status dots) is intentionally non-generic.

### Pattern: Form Migration Strategy

Form pages have the highest risk due to custom validation logic.

**Low-Risk Form Migration:**
```typescript
// Simple forms (Admin pages - contacts, suppliers)
// - Replace: Inline labels/inputs with FormField
// - Replace: Section dividers with FormSection
// - Preserve: react-hook-form logic, zod schemas, submit handlers
```

**High-Risk Form Migration (Multi-Step Wizards):**
```typescript
// Invoice new (917 lines, 3 steps)
// - Migrate: Step headers (PageHeader with step indicator)
// - Migrate: Form sections within each step (FormSection)
// - Preserve: Step state machine, step validation, inter-step data flow
// - Preserve: Dynamic line item table, quantity validation

// QMHQ new (901 lines, 2 pages: route selection + route-specific form)
// - Migrate: Route selection cards (may need custom layout)
// - Migrate: Route-specific form sections (FormSection)
// - Preserve: Route type logic, conditional field rendering
```

**Incremental Validation Approach:**
- Migrate one section at a time (e.g., header first, then step 1, then step 2)
- Test form submission after each section migration
- Verify validation errors still display correctly

### Anti-Patterns to Avoid

**❌ Forcing Generic Composites on Custom Layouts**
```typescript
// DON'T: Try to make Invoice multi-step wizard fit DetailPageLayout
// DetailPageLayout is for detail pages with tabs, not wizard flows

// DO: Use PageHeader for step headers, FormSection for step content
<PageHeader title={`Step ${currentStep}: ${STEPS[currentStep].label}`} />
<FormSection title="Invoice Header">
  {/* Step 1 content */}
</FormSection>
```

**❌ Migrating All Pages at Once**
```typescript
// DON'T: Mass find-replace across all 33 pages
// Risk: Single mistake breaks 33 pages

// DO: Wave-based migration with verification between waves
// Wave 1 → verify → Wave 2 → verify → ...
```

**❌ Breaking Existing Validation Logic**
```typescript
// DON'T: Replace custom validation with generic FormField
// Stock Out has warehouse-specific quantity validation

// DO: Use FormField for structure, preserve validation logic
<FormField label="Quantity" error={quantityError}>
  <Input
    value={quantity}
    onChange={(e) => {
      setQuantity(e.target.value);
      validateQuantity(e.target.value); // ← PRESERVE
    }}
  />
</FormField>
```

**❌ Removing Tactical CSS Classes Prematurely**
```typescript
// DON'T: Remove tactical-card, command-panel from globals.css yet
// Pages still use these during migration

// DO: Remove CSS classes AFTER all migrations complete (post-Phase 40)
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page-by-page migration tracking | Manual checklist | TaskCreate/TaskUpdate | Structured progress tracking, built-in status management |
| Visual regression detection | Manual screenshot comparison | Manual testing + TypeScript | Budget constraint - automated visual testing tools (Percy, Chromatic) expensive for internal tool |
| Line count measurement | Manual counting | `wc -l` + git diff stats | Accurate, reproducible metrics |
| Migration impact analysis | Manual code review | grep patterns + AST analysis | Find all `command-panel`, `tactical-card` usage programmatically |

**Key insight:** This phase is NOT about building new tools - it's about applying existing patterns (from Phase 36) at scale. Use structured task management to track progress, but avoid over-engineering the migration process itself.

## Common Pitfalls

### Pitfall 1: Breaking Data Fetching During JSX Replacement

**What goes wrong:** Accidentally removing or modifying data fetching logic (useEffect, callbacks) while replacing JSX.

**Why it happens:** Data fetching often co-located near JSX in large files. Easy to select too many lines during replacement.

**How to avoid:**
- Read entire file first, identify all useEffect/useCallback blocks
- Mark line ranges for JSX replacement ONLY
- Use Edit tool with precise old_string (not line ranges)
- Verify data fetching unchanged after edit (compare fetchData functions)

**Example:**
```typescript
// PRESERVE THIS (lines 79-120)
const fetchData = useCallback(async () => {
  setIsLoading(true);
  const supabase = createClient();
  const { data } = await supabase.from("invoices").select(...);
  setInvoices(data);
  setIsLoading(false);
}, []);

// REPLACE THIS (lines 250-280)
<div className="relative flex items-start...">
  <h1>Invoices</h1>
  {/* ... */}
</div>
```

**Warning signs:**
- TypeScript errors about missing state variables
- Page loads with no data
- Infinite re-render loops (useEffect dependencies broken)

### Pitfall 2: Incorrect Compound Component Usage

**What goes wrong:** FilterBar compound pattern breaks if not used correctly after migration.

**Why it happens:** Developers unfamiliar with compound pattern copy-paste `<FilterBar>` without `.Search` and `.Select`.

**How to avoid:**
- Always use compound pattern: `<FilterBar><FilterBar.Search /></FilterBar>`
- Never use standalone Search/Select components
- Validate FilterBar import includes compound sub-components

**Example:**
```typescript
// ❌ WRONG: FilterBar without sub-components
<FilterBar>
  <Search value={query} onChange={setQuery} /> {/* Error: Search not defined */}
</FilterBar>

// ✅ CORRECT: Compound pattern
<FilterBar>
  <FilterBar.Search value={query} onChange={setQuery} />
  <FilterBar.Select value={status} onChange={setStatus} options={...} />
</FilterBar>
```

**Warning signs:**
- TypeScript error: "Property 'Search' does not exist on type"
- Runtime error: "Cannot read property 'Search' of undefined"

### Pitfall 3: Lost Spacing Consistency During Form Migration

**What goes wrong:** Form pages have inconsistent spacing after migration (some sections use `space-y-4`, others `space-y-6`).

**Why it happens:** FormSection has spacing variants, but developers don't use them consistently.

**How to avoid:**
- Document spacing scale in migration guide
- Default to `spacing="default"` (p-6, space-y-4)
- Use `spacing="compact"` for dense forms (admin pages)
- Use `spacing="relaxed"` for important forms (QMRL new, PO new)

**Example:**
```typescript
// ✓ GOOD: Consistent spacing across all sections
<FormSection title="Basic Info" spacing="default">...</FormSection>
<FormSection title="Details" spacing="default">...</FormSection>

// ❌ BAD: Mixing spacing arbitrarily
<FormSection title="Basic Info" spacing="default">...</FormSection>
<FormSection title="Details" spacing="relaxed">...</FormSection>
```

**Warning signs:**
- Visual "jumps" between form sections
- Inconsistent padding between forms on different pages
- Designer feedback: "Some forms feel cramped"

### Pitfall 4: Breaking Multi-Step Form State Machines

**What goes wrong:** Invoice new page (3-step wizard) breaks after migrating step headers.

**Why it happens:** Step navigation logic tied to specific DOM structure. Changing JSX breaks `currentStep` state transitions.

**How to avoid:**
- Identify step state variables (`currentStep`, `setCurrentStep`)
- Test step transitions (Next, Back, validation)
- Preserve step indicator JSX exactly (don't migrate to generic component)
- Only migrate step content sections (FormSection inside each step)

**Example:**
```typescript
// PRESERVE: Step state machine
const [currentStep, setCurrentStep] = useState(1);

const handleNext = () => {
  if (validateCurrentStep()) {
    setCurrentStep(prev => prev + 1);
  }
};

// MIGRATE: Step header (but preserve step indicator logic)
<PageHeader
  title={`Step ${currentStep}: ${STEPS[currentStep - 1].label}`}
  description="Create new invoice"
/>

// MIGRATE: Step content
<FormSection title="Invoice Header">
  {currentStep === 1 && <>{/* Step 1 fields */}</>}
</FormSection>
```

**Warning signs:**
- Step transitions broken (stuck on step 1)
- Validation errors appear on wrong step
- Back button doesn't work

## Code Examples

### Example 1: List Page Migration (Warehouse List)

**Before (inline header + table):**
```typescript
// app/(dashboard)/warehouse/page.tsx (lines 90-140)
return (
  <div className="space-y-6">
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-200">
          Warehouses
        </h1>
        <p className="mt-1 text-slate-400">Manage warehouse locations</p>
      </div>
      <Button onClick={handleCreate}>
        <Plus className="mr-2 h-4 w-4" />
        New Warehouse
      </Button>
    </div>

    <DataTable columns={columns} data={warehouses} />
  </div>
);
```

**After (with PageHeader composite):**
```typescript
// app/(dashboard)/warehouse/page.tsx
import { PageHeader } from "@/components/composite";

return (
  <div className="space-y-6">
    <PageHeader
      title="Warehouses"
      description="Manage warehouse locations"
      actions={
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Warehouse
        </Button>
      }
    />

    <DataTable columns={columns} data={warehouses} />
  </div>
);
```

**Impact:** -8 lines, consistent header structure, no logic change.

### Example 2: Card View Migration (QMHQ List)

**Before (inline kanban grid):**
```typescript
// app/(dashboard)/qmhq/page.tsx (lines 200-350)
<div className="grid gap-6 lg:grid-cols-3">
  {statusGroups.map((group) => {
    const groupItems = filteredQmhqs.filter(
      (q) => q.status?.status_group === group.key
    );

    return (
      <div key={group.key}>
        <div className="column-header">
          <div className={group.dotClass} />
          <h2>{group.label}</h2>
          <span className="ml-auto">{groupItems.length}</span>
        </div>
        <div className="rounded-b-lg border border-t-0 border-slate-700 bg-slate-900/30 p-3">
          {groupItems.map((qmhq) => (
            <QMHQCard key={qmhq.id} qmhq={qmhq} />
          ))}
        </div>
      </div>
    );
  })}
</div>
```

**After (with CardViewGrid composite):**
```typescript
// app/(dashboard)/qmhq/page.tsx
import { CardViewGrid } from "@/components/composite";

<CardViewGrid
  items={filteredQmhqs}
  groupBy={(qmhq) => qmhq.status?.status_group || 'to_do'}
  renderCard={(qmhq, index) => (
    <QMHQCard key={qmhq.id} qmhq={qmhq} />
  )}
/>
```

**Impact:** -40 lines, consistent kanban structure, no logic change, QMHQCard content preserved.

### Example 3: Detail Page Migration (QMRL Detail)

**Before (inline layout):**
```typescript
// app/(dashboard)/qmrl/[id]/page.tsx (lines 150-250)
<div className="space-y-6 relative">
  <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />
  <div className="relative flex items-start justify-between">
    <div className="flex items-start gap-4">
      <Link href="/qmrl">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>
      <div>
        <h1>{qmrl.title}</h1>
        <p>{qmrl.request_id}</p>
      </div>
    </div>
    <div className="flex gap-2">
      <Button asChild><Link href={`/qmrl/${qmrl.id}/edit`}>Edit</Link></Button>
      <Button asChild><Link href={`/qmhq/new?qmrl=${qmrl.id}`}>Create QMHQ</Link></Button>
    </div>
  </div>

  <Tabs>
    {/* Tab content */}
  </Tabs>
</div>
```

**After (with DetailPageLayout composite):**
```typescript
// app/(dashboard)/qmrl/[id]/page.tsx
import { DetailPageLayout } from "@/components/composite";

<DetailPageLayout
  backHref="/qmrl"
  header={
    <div>
      <h1>{qmrl.title}</h1>
      <p>{qmrl.request_id}</p>
    </div>
  }
  actions={
    <>
      <Button asChild><Link href={`/qmrl/${qmrl.id}/edit`}>Edit</Link></Button>
      <Button asChild><Link href={`/qmhq/new?qmrl=${qmrl.id}`}>Create QMHQ</Link></Button>
    </>
  }
>
  <Tabs>
    {/* Tab content */}
  </Tabs>
</DetailPageLayout>
```

**Impact:** -15 lines, consistent detail page structure, grid overlay handled by composite, no logic change.

### Example 4: Form Page Migration (QMRL New)

**Before (inline form sections):**
```typescript
// app/(dashboard)/qmrl/new/page.tsx (lines 200-350)
<form onSubmit={handleSubmit}>
  <div className="command-panel corner-accents p-6 space-y-4">
    <div className="section-header">
      <FileText className="h-5 w-5 text-amber-400" />
      <h3>Basic Information</h3>
    </div>
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Title *</Label>
        <Input value={formData.title} onChange={...} />
      </div>
      {/* More fields */}
    </div>
  </div>

  <div className="command-panel corner-accents p-6 space-y-4">
    <div className="section-header">
      <Building2 className="h-5 w-5 text-amber-400" />
      <h3>Department & Contact</h3>
    </div>
    {/* More fields */}
  </div>
</form>
```

**After (with FormSection and FormField composites):**
```typescript
// app/(dashboard)/qmrl/new/page.tsx
import { FormSection, FormField } from "@/components/composite";

<form onSubmit={handleSubmit}>
  <FormSection
    title="Basic Information"
    icon={<FileText className="h-5 w-5 text-amber-400" />}
    spacing="default"
  >
    <FormField label="Title" required>
      <Input value={formData.title} onChange={...} />
    </FormField>
    {/* More fields */}
  </FormSection>

  <FormSection
    title="Department & Contact"
    icon={<Building2 className="h-5 w-5 text-amber-400" />}
    spacing="default"
  >
    {/* More fields */}
  </FormSection>
</form>
```

**Impact:** -25 lines, consistent form structure, validation logic preserved, no behavioral change.

## State of the Art

This is NOT a new implementation - this is incremental adoption of patterns established in Phase 36.

| Aspect | Phase 36 (Pilot) | Phase 40 (Rollout) | Approach |
|--------|------------------|---------------------|----------|
| Composite components | 7 components built | Same 7 components used | No new components needed |
| Migration pattern | Established on 3 pages | Apply to 33 pages | Proven pattern, larger scale |
| Validation | Manual testing | Manual testing + TypeScript | Same verification approach |
| Risk level | Low (pilot pages) | Medium (mass migration) | Incremental waves reduce risk |

**No "state of the art" changes.** Phase 40 is about execution, not innovation.

## Open Questions

### 1. Should Dashboard and Flow Tracking pages migrate in Phase 40?

**What we know:**
- Dashboard has custom KPI card layout (not standard list/detail/form)
- Flow Tracking is specialized admin tool (may need custom layout)

**What's unclear:**
- Do existing composites fit these pages?
- Should we create DashboardCard composite?
- Is migration worth the effort vs. leaving as custom layouts?

**Recommendation:**
- Defer Dashboard and Flow Tracking to Wave 5 (optional)
- Attempt migration after Wave 1-4 complete
- If composites don't fit naturally, leave as custom layouts
- Don't force composites where they don't belong

### 2. How to handle PO list page card/list view toggle?

**What we know:**
- PO page deferred from Phase 36 due to view toggle complexity
- CardViewGrid assumes card view only, not list/card toggle

**What's unclear:**
- Should CardViewGrid support viewMode prop?
- Should we create separate CardViewGrid and ListView components?
- Or keep PO page with custom implementation?

**Recommendation:**
- Add viewMode prop to page component (not CardViewGrid)
- Conditionally render `<CardViewGrid>` or `<DataTable>` based on viewMode
- CardViewGrid remains view-agnostic (always renders cards)

### 3. What is the target percentage for success criteria?

**Success Criteria from Phase Description:**
- "At least 80% of list pages use standardized components"
- "At least 80% of forms use standardized components"
- "At least 80% of detail pages use standardized components"

**What's unclear:**
- Is 80% measured by page count or line count?
- Can we exceed 80% (aim for 100%)?
- What counts as "uses standardized components" (1 composite, or all applicable composites)?

**Recommendation:**
- Measure by page count: 80% = 27 pages (out of 33)
- Aim for 100% where composites fit naturally (defer only if forced)
- "Uses standardized components" = page uses at least 1 composite (PageHeader, FilterBar, DetailPageLayout, FormSection)
- Track per-page composite adoption in verification

## Sources

### Primary (HIGH confidence)

- **Phase 36 Research** - `/home/yaungni/qm-core/.planning/phases/36-ui-component-standardization/36-RESEARCH.md` - Composite component patterns and validation
- **Phase 36 Plan 03 Summary** - `/home/yaungni/qm-core/.planning/phases/36-ui-component-standardization/36-03-SUMMARY.md` - Pilot migration patterns and lessons learned
- **Phase 36 Verification** - `/home/yaungni/qm-core/.planning/phases/36-ui-component-standardization/36-VERIFICATION.md` - Validation approach and success metrics
- **QM Core Codebase** - 33 pages analyzed via Glob, Read, Grep - Current page structure and complexity
- **Composite Components** - `/home/yaungni/qm-core/components/composite/` - 7 validated components
- **REQUIREMENTS.md** - `/home/yaungni/qm-core/.planning/REQUIREMENTS.md` - UI-01 through UI-08 requirements

### Secondary (MEDIUM confidence)

- **Page Complexity Analysis** - `wc -l` on all page.tsx files - Identified largest/riskiest pages
- **CSS Pattern Analysis** - `grep command-panel` and `grep tactical-card` - Identified migration opportunities

### Codebase Analysis (HIGH confidence)

**Files Examined:**
- All 33 unmigrated pages (Glob pattern: `app/(dashboard)/**/page.tsx`)
- 3 pilot pages from Phase 36 (QMRL list, PO list, Item detail)
- Composite component implementations (`components/composite/*.tsx`)
- Global CSS (`app/globals.css`) for tactical class patterns

**Page Inventory:**
- **List pages (10):** Invoice, QMHQ, Warehouse, Item, Admin (contacts, suppliers, departments, categories, statuses, users, flow-tracking)
- **Detail pages (10):** QMRL detail, QMHQ detail, PO detail, Invoice detail, Warehouse detail, Stock Out Request detail, QMRL edit, QMHQ edit
- **Form pages (9):** QMRL new, QMHQ new (2 pages), PO new, Invoice new, Stock In, Stock Out, Stock Out Request new
- **Specialized (4):** Dashboard, Flow Tracking, Inventory dashboard, Stock Out Requests list

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all from Phase 36
- Architecture patterns: HIGH - Patterns validated in Phase 36 pilot
- Migration strategy: HIGH - Wave-based approach is standard practice
- Pitfalls: MEDIUM - Based on Phase 36 experience, but larger scale introduces new risks

**Research date:** 2026-02-12
**Valid until:** 30 days (stable codebase, no dependency changes expected)

**Phase 36 Validation Results (Foundation for Phase 40):**
- ✓ 7 composite components built and validated
- ✓ 3 pilot pages migrated (QMRL list, PO list, Item detail)
- ✓ -110 lines net reduction
- ✓ 0 visual regressions
- ✓ 0 functional regressions
- ✓ Surgical JSX replacement pattern established
- ✓ TypeScript compilation verified
- ✓ Production build verified

**Phase 40 Scope:**
- 33 pages remaining (10 list, 10 detail, 9 form, 4 specialized)
- Target: 80%+ adoption (27+ pages)
- Stretch: 100% adoption where composites fit naturally
- Risk: Complex forms (Invoice, Stock Out) require careful migration
- Timeline: 4 waves, incremental verification between waves
