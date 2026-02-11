# Phase 36: UI Component Standardization - Research

**Researched:** 2026-02-11
**Domain:** React component composition, design system implementation
**Confidence:** HIGH

## Summary

Phase 36 establishes reusable composite UI components for standardized page layouts across the QM system. The codebase currently has 54+ pages with inconsistent header structures, filter bar implementations, and spacing patterns. This phase creates 8 composite components (PageHeader, FilterBar, DataTable, DetailPageLayout, CardViewGrid, FormField, FormSection, ActionButtons) that can be adopted incrementally without breaking existing pages.

**Primary recommendation:** Build composite components that wrap existing primitives (Button, Input, Select) rather than replacing them. Validate on 2-3 pilot pages (QMRL list, PO list, Item detail) before broader rollout in Phase 40.

**Key findings:**
- Existing architecture uses Radix UI + CVA + Tailwind (shadcn/ui pattern) - composite components extend this naturally
- Current codebase has tactical CSS classes (`.command-panel`, `.tactical-card`, `.column-header`) that need consolidation into components
- Filter bars have 3 distinct implementations across pages - should standardize to single FilterBar component with slot-based customization
- Page headers vary in structure: some have breadcrumbs, some have badges, placement of action buttons differs

## Standard Stack

### Core Dependencies (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | Component framework | Next.js requirement |
| Next.js | 14.2.13 | App Router framework | Project foundation |
| @radix-ui/* | 2.x | Primitive components | Accessibility, composability |
| class-variance-authority | 0.7.1 | Variant management | Type-safe styling variants |
| tailwind-merge | 2.5.2 | Class merging utility | Merge Tailwind classes without conflicts |
| clsx | 2.1.1 | Conditional classes | Simplifies className logic |
| Tailwind CSS | 3.4.13 | Utility-first styling | Design system foundation |
| lucide-react | 0.447.0 | Icon system | Consistent iconography |

**All dependencies already installed.** No new packages required for Phase 36.

### Supporting Libraries (Already in Use)

| Library | Current Usage | Phase 36 Usage |
|---------|---------------|----------------|
| @tanstack/react-table | Table state management | DataTable composite wraps existing table logic |
| react-hook-form | Form validation | FormField composite works with existing forms |
| zod | Schema validation | No direct usage - forms already use it |

### Design System Foundation

**Existing Design Tokens (tailwind.config.ts):**
```typescript
colors: {
  brand: { 600: '#D97706' }, // Amber accent
  slate: { 700-900 },         // Dark theme base
  status: { todo, in-progress, done } // Status colors
}

spacing: default scale (4px increments)
borderRadius: { lg: 0.625rem }
shadows: { soft-sm, soft-md, brand-sm }
```

**Custom CSS Classes (globals.css):**
```css
.tactical-card      /* Dark gradient cards with hover effects */
.command-panel      /* Form section containers */
.column-header      /* Kanban column headers */
.priority-tactical  /* Priority badges */
.status-dot         /* Glowing status indicators */
```

**Phase 36 Goal:** Consolidate these CSS patterns into React components.

## Architecture Patterns

### Recommended Component Structure

```
components/
├── composite/              # NEW: Phase 36 components
│   ├── page-header.tsx    # Title, description, actions
│   ├── filter-bar.tsx     # Search + dropdowns + date pickers
│   ├── data-table.tsx     # Standardized table wrapper
│   ├── detail-page-layout.tsx  # Header + tabs + content
│   ├── card-view-grid.tsx # Card grid with status grouping
│   ├── form-field.tsx     # Label + input + error wrapper
│   ├── form-section.tsx   # Section header + divider + content
│   └── action-buttons.tsx # Primary/secondary action group
├── ui/                    # EXISTING: Primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   └── ...
├── layout/                # EXISTING: Shell components
│   ├── sidebar.tsx
│   └── header.tsx
└── [domain]/              # EXISTING: Feature components
    ├── po/
    ├── qmhq/
    └── invoice/
```

### Pattern 1: Composite Components with Slot-Based Composition

**What:** Components accept children via slots for flexible customization while maintaining consistent structure.

**When to use:** For page-level patterns (PageHeader, FilterBar) where content varies but structure is consistent.

**Example (PageHeader):**
```typescript
// Source: Composition pattern from Next.js docs + shadcn/ui patterns
// URL: https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;      // Slot: optional status badge
  actions?: React.ReactNode;    // Slot: action buttons
}

export function PageHeader({ title, description, badge, actions }: PageHeaderProps) {
  return (
    <div className="relative flex items-start justify-between mb-6">
      <div>
        {badge}
        <h1 className="text-3xl font-bold tracking-tight text-slate-200">{title}</h1>
        {description && <p className="mt-1 text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Usage
<PageHeader
  title="Purchase Orders"
  description={`${totalItems} POs found`}
  badge={<Badge>Procurement</Badge>}
  actions={
    <>
      <ViewToggle mode={viewMode} onChange={setViewMode} />
      <Button asChild><Link href="/po/new">New PO</Link></Button>
    </>
  }
/>
```

**Benefits:**
- Consistent spacing/typography without restricting content
- Type-safe props prevent layout breaking
- Easy to add new sections (e.g., breadcrumbs slot) without breaking existing usage

### Pattern 2: Compound Components with Context

**What:** Parent component manages state, child components access via context.

**When to use:** For DataTable (parent manages sort/filter, columns access state) and FilterBar (parent manages filter state, individual filters update it).

**Example (FilterBar with compound components):**
```typescript
// Source: Compound pattern - https://www.patterns.dev/react/compound-pattern/

const FilterBarContext = createContext<FilterBarContextType | null>(null);

export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="command-panel mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {children}
      </div>
    </div>
  );
}

FilterBar.Search = function Search({
  value,
  onChange,
  placeholder = "Search..."
}: SearchProps) {
  return (
    <div className="relative flex-1 min-w-[240px] max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
      />
    </div>
  );
};

FilterBar.Select = function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  icon
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
        {icon}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

// Usage
<FilterBar>
  <FilterBar.Search
    value={searchQuery}
    onChange={setSearchQuery}
    placeholder="Search by PO#, supplier..."
  />
  <FilterBar.Select
    value={statusFilter}
    onChange={setStatusFilter}
    options={statusOptions}
    placeholder="Status"
  />
  <FilterBar.Select
    value={supplierFilter}
    onChange={setSupplierFilter}
    options={supplierOptions}
    placeholder="Supplier"
  />
</FilterBar>
```

**Benefits:**
- Namespaced components prevent naming collisions
- Enforces consistent filter styling
- Easy to extend (e.g., `FilterBar.DatePicker`)

### Pattern 3: Render Props for Flexible Content

**What:** Component accepts function as child to customize rendering while maintaining structure.

**When to use:** For CardViewGrid where card content varies by entity but grid structure is consistent.

**Example (CardViewGrid):**
```typescript
interface CardViewGridProps<T> {
  items: T[];
  groupBy: (item: T) => 'active' | 'completed' | 'cancelled';
  renderCard: (item: T, index: number) => React.ReactNode;
}

export function CardViewGrid<T>({ items, groupBy, renderCard }: CardViewGridProps<T>) {
  const groups = useMemo(() => {
    // Group items by status
    return items.reduce((acc, item) => {
      const group = groupBy(item);
      acc[group].push(item);
      return acc;
    }, { active: [], completed: [], cancelled: [] });
  }, [items, groupBy]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {statusGroups.map((group) => (
        <div key={group.key} className="flex flex-col">
          <div className="column-header">
            <div className={group.dotClass} />
            <h2>{group.label}</h2>
            <span className="stat-counter ml-auto">{groups[group.key].length}</span>
          </div>
          <div className="flex-1 rounded-b-lg border border-t-0 border-slate-700 bg-slate-900/30 p-3 min-h-[400px]">
            <div className="space-y-3">
              {groups[group.key].map((item, index) => renderCard(item, index))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Usage
<CardViewGrid
  items={pos}
  groupBy={(po) => po.status === 'closed' ? 'completed' : 'active'}
  renderCard={(po, index) => (
    <POCard key={po.id} po={po} animationDelay={index * 50} />
  )}
/>
```

### Pattern 4: CVA for Standardized Variants

**What:** Use `class-variance-authority` to define spacing/sizing variants consistently.

**When to use:** For spacing (FormSection, PageHeader) and sizing (FormField, ActionButtons).

**Example (FormSection with spacing variants):**
```typescript
import { cva, type VariantProps } from "class-variance-authority";

const formSectionVariants = cva(
  "command-panel corner-accents", // Base classes
  {
    variants: {
      spacing: {
        default: "p-6 space-y-4",
        compact: "p-4 space-y-3",
        relaxed: "p-8 space-y-6",
      },
    },
    defaultVariants: {
      spacing: "default",
    },
  }
);

interface FormSectionProps extends VariantProps<typeof formSectionVariants> {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function FormSection({ title, icon, spacing, children }: FormSectionProps) {
  return (
    <div className={formSectionVariants({ spacing })}>
      <div className="section-header">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid

**❌ Prop Drilling for Styling**
```typescript
// DON'T: Pass styling props down multiple levels
<PageHeader titleColor="amber" titleSize="3xl" descriptionColor="slate-400" />
```
**✅ Use CVA Variants Instead**
```typescript
// DO: Define semantic variants
<PageHeader variant="primary" size="lg" />
```

**❌ Overly Rigid Components**
```typescript
// DON'T: Force specific button text/actions
<PageHeader title="..." createButtonText="New Item" onCreateClick={...} />
```
**✅ Use Slots for Flexibility**
```typescript
// DO: Accept actions as children
<PageHeader title="..." actions={<Button>Custom Action</Button>} />
```

**❌ Mixing Layout and Business Logic**
```typescript
// DON'T: Fetch data inside composite components
function FilterBar() {
  const { data: filters } = useFetchFilters(); // ❌
  return <div>...</div>;
}
```
**✅ Keep Components Presentational**
```typescript
// DO: Accept data as props
function FilterBar({ filters }: { filters: Filter[] }) {
  return <div>...</div>;
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible dropdowns | Custom `<div>` with click handlers | `@radix-ui/react-select` | Keyboard nav, ARIA, focus management |
| Accessible dialogs | `position: fixed` + `useEffect` | `@radix-ui/react-dialog` | Focus trap, escape handling, overlay |
| Responsive tables | Media queries + custom scroll | `@tanstack/react-table` | Column resizing, sticky headers, virtualization |
| Form validation | Manual state + error checking | `react-hook-form` + `zod` | Type-safe schemas, async validation, field dependencies |
| Class name merging | `classNames.join(' ')` | `tailwind-merge` + `clsx` | Handles Tailwind class conflicts (e.g., `p-4` vs `p-6`) |
| Variant management | Nested ternaries | `class-variance-authority` | Type-safe, composable variants |

**Key insight:** Radix UI primitives handle accessibility edge cases (screen reader announcements, keyboard shortcuts, focus management) that take months to implement correctly. CVA prevents the "style prop explosion" that makes components unmaintainable.

## Common Pitfalls

### Pitfall 1: Inconsistent Spacing Between Components

**What goes wrong:** Developers use arbitrary margins (e.g., `mb-4` vs `mb-6` vs `mb-8`) between sections, creating visual inconsistency.

**Why it happens:** No standardized spacing scale documented. Developers guess spacing values.

**How to avoid:**
- Define spacing scale in composite components using CVA variants
- Use consistent gap utilities (`space-y-6` for vertical, `gap-4` for horizontal)
- Document spacing in component JSDoc

**Example:**
```typescript
/**
 * PageHeader
 *
 * Spacing:
 * - Bottom margin: mb-6 (24px) - consistent with other page sections
 * - Title/description gap: mt-1 (4px)
 * - Action button gap: gap-2 (8px)
 */
```

**Warning signs:**
- Pages with uneven vertical rhythm
- Inconsistent spacing between filter bar and content
- Action buttons with different gaps

### Pitfall 2: Overusing `className` Prop for Customization

**What goes wrong:** Every composite component accepts `className` for "flexibility," leading to style overrides that break consistency.

**Why it happens:** Developers want quick fixes without updating the component.

**How to avoid:**
- Provide specific customization props (e.g., `actions`, `badge`) instead of `className`
- Use CVA variants for supported variations
- Only allow `className` for wrapper-level adjustments (not internal elements)

**Example:**
```typescript
// ❌ BAD: Allows breaking internal layout
<PageHeader className="flex-col items-start gap-8" />

// ✅ GOOD: Controlled variants
<PageHeader spacing="relaxed" align="start" />
```

**Warning signs:**
- Components with `cn(defaultClasses, className)` allowing full style override
- Multiple pages with different header layouts despite using same component

### Pitfall 3: Client-Side Only Composite Components

**What goes wrong:** Composite components marked `"use client"` when they don't need client interactivity, increasing bundle size.

**Why it happens:** Developers default to client components to avoid "cannot use hooks in server component" errors.

**How to avoid:**
- Keep composites as **Server Components by default**
- Only mark client if component uses: `useState`, `useEffect`, `onClick`, etc.
- For PageHeader/FormSection (presentational): Server Component ✅
- For FilterBar (has state): Client Component ✅

**Example:**
```typescript
// ✅ PageHeader - Server Component (no "use client")
export function PageHeader({ title, actions }) {
  return <div>...</div>; // Pure presentation
}

// ✅ FilterBar - Client Component (has state)
"use client";
export function FilterBar({ children }) {
  return <div>...</div>; // Has onChange handlers
}
```

**Warning signs:**
- Large client bundle size (check `.next/analyze`)
- Components with `"use client"` but no hooks/event handlers

### Pitfall 4: Not Validating on Pilot Pages First

**What goes wrong:** Building all 8 composite components, then discovering architectural issues when applying to 54 pages.

**Why it happens:** Trying to design components in isolation without real-world validation.

**How to avoid:**
1. **Phase 36:** Build components + validate on 2-3 pilot pages
2. **Phase 40:** Roll out to remaining pages with lessons learned
3. Pilot page selection: Choose diverse pages (list page, detail page, form page)

**Recommended pilots:**
- QMRL list page (kanban view with filters)
- PO list page (card/list toggle)
- Item detail page (tabs with form sections)

**Warning signs:**
- Components that don't fit pilot page needs (requires workarounds)
- Pilot pages looking worse than original implementation

## Code Examples

### Example 1: PageHeader Component

```typescript
// components/composite/page-header.tsx
// Verified pattern: shadcn/ui Patterns - Page Headers
// URL: https://www.shadcndesign.com/pro-blocks/page-headers

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  badge,
  actions,
  className
}: PageHeaderProps) {
  return (
    <div className={cn(
      "relative flex items-start justify-between mb-6",
      className
    )}>
      <div className="flex-1">
        {badge && (
          <div className="flex items-center gap-3 mb-2">
            {badge}
          </div>
        )}
        <h1 className="text-3xl font-bold tracking-tight text-slate-200">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-slate-400">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 ml-4">
          {actions}
        </div>
      )}
    </div>
  );
}
```

### Example 2: FilterBar with Compound Components

```typescript
// components/composite/filter-bar.tsx
// Verified pattern: Compound Components for shared state
// URL: https://www.patterns.dev/react/compound-pattern/

"use client";

import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("command-panel mb-6", className)}>
      <div className="flex flex-wrap items-center gap-4">
        {children}
      </div>
    </div>
  );
}

// Search sub-component
interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

FilterBar.Search = function Search({ value, onChange, placeholder = "Search..." }: SearchProps) {
  return (
    <div className="relative flex-1 min-w-[240px] max-w-md">
      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
      />
    </div>
  );
};

// Select sub-component
interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: React.ReactNode;
}

FilterBar.Select = function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
  icon
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
        {icon && <span className="mr-2">{icon}</span>}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

### Example 3: FormSection Component

```typescript
// components/composite/form-section.tsx
// Pattern: CVA variants for consistent spacing

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const formSectionVariants = cva(
  "command-panel corner-accents animate-slide-up",
  {
    variants: {
      spacing: {
        default: "p-6 space-y-4",
        compact: "p-4 space-y-3",
        relaxed: "p-8 space-y-6",
      },
    },
    defaultVariants: {
      spacing: "default",
    },
  }
);

interface FormSectionProps extends VariantProps<typeof formSectionVariants> {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  animationDelay?: string;
  className?: string;
}

export function FormSection({
  title,
  icon,
  spacing,
  children,
  animationDelay,
  className
}: FormSectionProps) {
  return (
    <div
      className={cn(formSectionVariants({ spacing }), className)}
      style={animationDelay ? { animationDelay } : undefined}
    >
      <div className="section-header">
        {icon}
        <h3>{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}
```

### Example 4: FormField Component

```typescript
// components/composite/form-field.tsx
// Pattern: Wrapper for label + input + error with consistent spacing

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-slate-300 font-medium">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS-only component library (Bootstrap) | Headless components + Tailwind (Radix + shadcn/ui) | ~2022 | Accessibility baked in, no CSS bundle bloat |
| Global CSS classes | Utility-first CSS (Tailwind) | ~2020 | No naming conflicts, faster development |
| Prop-based variants (`primary={true}`) | CVA for type-safe variants | ~2023 | Better TypeScript integration, composable variants |
| React.FC with PropTypes | TypeScript + interfaces | ~2021 | Type safety, better IDE support |
| Manual class merging | tailwind-merge | ~2022 | Handles class conflicts (e.g., `p-4` beats `p-2`) |

**Deprecated/outdated:**
- **styled-components / emotion:** Still used but losing popularity. Tailwind + CVA is now standard for design systems.
- **Material-UI v4:** Opinionated styling. shadcn/ui approach (headless + utilities) now preferred for customizable systems.
- **Component prop drilling:** React Context + compound components now standard for shared state.

## Open Questions

1. **How to handle breakpoints in FilterBar?**
   - What we know: Current implementation uses `flex-wrap` for mobile
   - What's unclear: Should FilterBar.Search stack vertically on mobile, or collapse to icon-only?
   - Recommendation: Start with flex-wrap (matches current behavior), validate on pilot pages

2. **Should DataTable be server or client component?**
   - What we know: @tanstack/react-table requires client-side state
   - What's unclear: Can we create a server wrapper that pre-sorts/filters?
   - Recommendation: Start as client component (easier migration), optimize later if needed

3. **Spacing scale consistency with existing pages**
   - What we know: Current pages use mix of `mb-4`, `mb-6`, `mb-8`
   - What's unclear: Should Phase 36 enforce strict spacing, or allow flexibility?
   - Recommendation: Enforce consistent spacing in composites, but don't force-migrate existing pages until Phase 40

## Sources

### Primary (HIGH confidence)

- **Next.js Composition Patterns** - https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns - Verified patterns for Server/Client component interleaving
- **shadcn/ui Patterns** - https://www.shadcndesign.com/pro-blocks/page-headers - Page header composition examples
- **Radix UI Documentation** - https://www.radix-ui.com/primitives/docs/overview/introduction - Primitive component API patterns
- **CVA GitHub** - https://cva.style/docs - Variant API and TypeScript integration
- **QM Core Codebase** - `/home/yaungni/qm-core/components/ui/` - Current component implementations
- **QM Core Tailwind Config** - `/home/yaungni/qm-core/tailwind.config.ts` - Design token definitions
- **QM Core Global Styles** - `/home/yaungni/qm-core/app/globals.css` - Tactical CSS class patterns

### Secondary (MEDIUM confidence)

- **Patterns.dev - Compound Pattern** - https://www.patterns.dev/react/compound-pattern/ - Compound component architecture
- **React Component Patterns 2026** - https://www.patterns.dev/react/react-2026/ - Modern composition patterns

### Codebase Analysis (HIGH confidence)

**Files Examined:**
- `/app/(dashboard)/qmrl/page.tsx` - QMRL list with kanban layout
- `/app/(dashboard)/po/page.tsx` - PO list with card/list toggle
- `/app/(dashboard)/invoice/page.tsx` - Invoice list with voided filter
- `/app/(dashboard)/qmrl/new/page.tsx` - Form with sections and inline create
- `/components/ui/button.tsx` - CVA variant pattern
- `/components/ui/input.tsx` - Base input styling
- `/.planning/research/ARCHITECTURE-v1.8-integration.md` - System architecture overview
- `/.planning/REQUIREMENTS.md` - UI standardization requirements (UI-01 through UI-08)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies installed and in use
- Architecture patterns: HIGH - Patterns verified in Next.js docs and existing codebase
- Pitfalls: MEDIUM - Based on common React/Next.js issues, validated against codebase patterns

**Research date:** 2026-02-11
**Valid until:** 60 days (stable ecosystem - Next.js 14, React 18, Radix UI stable)

**Pilot Page Validation Required:**
Before Phase 40 rollout, validate composites on:
1. QMRL list page (`/app/(dashboard)/qmrl/page.tsx`)
2. PO list page (`/app/(dashboard)/po/page.tsx`)
3. Item detail page (`/app/(dashboard)/item/[id]/page.tsx`)

Success criteria:
- ✅ Composites reduce page component line count by 20%+
- ✅ Visual consistency matches or improves original
- ✅ No accessibility regressions (keyboard nav, screen readers)
- ✅ Bundle size impact <5KB gzipped per composite
