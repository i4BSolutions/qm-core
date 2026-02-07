# Stack Research: v1.5 Features

**Research Date:** 2026-02-07
**Milestone:** v1.5 UX Polish & Collaboration
**Confidence:** HIGH

## Summary

v1.5 features require **minimal stack additions**. Three of four features work with existing stack. Only searchable two-step selector needs a new library.

**Recommendation:** Add `cmdk` (1.1.1) for searchable combobox pattern. All other features achievable with existing Tailwind CSS + Radix UI.

---

## Feature Analysis

### 1. Comments with Threaded Replies

**Stack Decision:** Build custom with existing Supabase + React
**Rationale:** No library needed

**Why no library:**
- Simple requirement: one level of replies (not infinite nesting)
- Delete-only (no edit), straightforward CRUD
- Existing audit system handles timestamps and user attribution
- Supabase RLS already handles permission logic
- Real-time not required (polling pattern established)

**Existing stack coverage:**
- `@supabase/supabase-js` - Database queries and RLS
- `@radix-ui/react-dialog` - Reply modal if needed
- `lucide-react` - Icons (Reply, Trash)
- `date-fns` - Timestamp formatting
- Existing pattern: File attachments (similar polymorphic relationship)

**Implementation approach:**
```sql
-- Database schema (no new dependencies)
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL, -- 'qmrl', 'qmhq', 'po', 'invoice'
  entity_id UUID NOT NULL,
  parent_comment_id UUID NULL, -- NULL = top-level, not NULL = reply
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Avoided libraries:**
- `react-comments-section` - Last updated 2023, unmaintained, brings unnecessary UI opinions
- Third-party comment SDKs (Ably, Replyke) - Overkill for internal tool, introduces external service dependency

---

### 2. Responsive Typography for Large Numbers

**Stack Decision:** Tailwind CSS with custom configuration
**Rationale:** CSS-only solution, no runtime library needed

**Why no library:**
- Pure CSS problem, solvable with `clamp()` function
- Tailwind container queries available via plugin (already mature)
- No JavaScript needed for font scaling

**Existing stack coverage:**
- Tailwind CSS 3.4.13 - Already installed
- Current `CurrencyDisplay` component - Just needs responsive classes

**Implementation approach:**

Option A: **CSS `clamp()` in Tailwind config (RECOMMENDED)**
```typescript
// tailwind.config.ts extension
fontSize: {
  'currency-responsive': 'clamp(0.875rem, 2vw, 1rem)', // Shrinks at small viewports
}
```

Option B: **Container queries with plugin**
```bash
npm install @tailwindcss/container-queries
```
```typescript
// tailwind.config.ts
plugins: [
  require("tailwindcss-animate"),
  require("@tailwindcss/container-queries")
]
```
```tsx
// Usage in CurrencyDisplay
<div className="@container">
  <span className="@xs:text-sm @sm:text-base">...</span>
</div>
```

**Recommendation:** Start with Option A (clamp), add container queries plugin only if needed for complex card layouts.

**Sources:**
- [Tailwind CSS Container Queries](https://tailwindcss.com/docs/responsive-design)
- [Fluid Typography with CSS Clamp](https://davidhellmann.com/blog/development/tailwindcss-fluid-typography-with-css-clamp)

---

### 3. Two-Step Searchable Selectors (Category → Item)

**Stack Decision:** Add `cmdk` library
**Rationale:** Radix UI Select lacks native search; cmdk provides accessible combobox pattern

**Why add `cmdk`:**
- Radix UI Select doesn't support typeahead/search natively
- `cmdk` is headless (no style conflicts with existing design system)
- Battle-tested (2,550+ npm dependents)
- Actively maintained (v1.1.1, published Feb 2025)
- Small bundle size, zero dependencies
- Composable API fits existing component patterns

**Alternative considered: Build custom with Radix Popover + Input**
- More code to maintain
- Reinventing accessibility (keyboard nav, ARIA)
- cmdk is already solving this well

**Installation:**
```bash
npm install cmdk@^1.1.1
```

**Integration pattern:**
```tsx
import { Command } from 'cmdk';

// Two-step pattern
<Command>
  <Command.Input placeholder="Search category..." />
  <Command.List>
    <Command.Group heading="Categories">
      <Command.Item onSelect={() => setStep('items')}>Electronics</Command.Item>
    </Command.Group>
  </Command.List>
</Command>

// Step 2: Items within selected category
<Command filter={(value, search) => /* filter by category */}>
  <Command.Input placeholder="Search items..." />
  <Command.List>
    <Command.Item onSelect={(item) => addToLineItems(item)}>
      Item Name - SKU-ELE-0001
    </Command.Item>
  </Command.List>
</Command>
```

**Why not alternatives:**
- Radix Combobox - Doesn't exist yet (open issue #1342 on radix-ui/primitives)
- Ariakit Combobox - Different API patterns, steeper learning curve vs existing Radix usage
- Custom solution - Unnecessary complexity for common pattern

**Sources:**
- [cmdk GitHub](https://github.com/dip/cmdk)
- [Radix UI Select limitations](https://github.com/radix-ui/primitives/issues/1334)

---

### 4. Currency Display Improvements (Org + EUSD Unification)

**Stack Decision:** Refactor existing `CurrencyDisplay` component
**Rationale:** Pure logic change, no new dependencies

**Why no library:**
- Currency formatting already handled by existing `formatCurrency` utility
- Just needs state management for QMHQ money-out inheriting money-in currency
- Display logic already in `CurrencyDisplay` component

**Existing stack coverage:**
- `CurrencyDisplay` component - Two-line format (original + EUSD)
- `formatCurrency` utility - Number formatting with thousand separators
- React Hook Form - Form state for currency inheritance

**Implementation approach:**
1. Store `currency` and `exchange_rate` from first money-in transaction in QMHQ
2. Auto-populate money-out form with same currency
3. Update `CurrencyDisplay` usage on list cards (already supports two-line format)

**No additional libraries needed.**

---

## Stack Additions

### Required: cmdk

| Library | Version | Purpose | Bundle Impact |
|---------|---------|---------|---------------|
| `cmdk` | ^1.1.1 | Searchable combobox for two-step selector | ~10KB gzipped |

**Installation:**
```bash
npm install cmdk@^1.1.1
```

**Integration notes:**
- Headless library, style with existing Tailwind classes
- Composable API matches Radix UI patterns already in use
- Use with existing form validation (React Hook Form + Zod)

---

## Optional: Container Queries Plugin

**Only if** responsive typography requires complex card-level breakpoints:

```bash
npm install @tailwindcss/container-queries
```

**Recommended:** Start without plugin, use CSS `clamp()` first. Add plugin only if needed.

---

## No New Dependencies Needed

### Features achievable with existing stack:

1. **Comments** - Supabase + React components + RLS policies
2. **Responsive typography** - Tailwind CSS with `clamp()` or container query classes
3. **Currency unification** - Component refactoring + state management

### Why this is good:

- **Smaller bundle** - Only one dependency added (cmdk)
- **Lower maintenance** - Fewer third-party libraries to update
- **Consistent patterns** - Leverages existing Supabase + Radix UI patterns
- **Faster development** - Developers already know the stack

---

## Integration Notes

### cmdk + Existing Patterns

**Fits existing architecture:**
- **Server Components pattern:** Command menu is client component (matches current Select usage)
- **Form integration:** Works with React Hook Form (same as Radix Select)
- **Styling:** Tailwind classes (same as all UI components)
- **TypeScript:** Full type safety (matches project standards)

**Example integration:**
```tsx
// app/(dashboard)/po/new/components/item-selector.tsx
"use client";

import { Command } from "cmdk";
import { useState } from "react";
import type { Item, Category } from "@/types/database";

export function TwoStepItemSelector({ onSelect }: Props) {
  const [step, setStep] = useState<'category' | 'item'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <Command className="rounded-lg border border-slate-700 bg-slate-900">
      {step === 'category' ? (
        <CategoryStep onSelect={(cat) => {
          setSelectedCategory(cat);
          setStep('item');
        }} />
      ) : (
        <ItemStep
          categoryId={selectedCategory}
          onSelect={onSelect}
          onBack={() => setStep('category')}
        />
      )}
    </Command>
  );
}
```

**Reusable pattern:** Can extract `<SearchableSelect>` wrapper component for other use cases.

---

## What NOT to Add

### Avoided Dependencies

| Library | Why Not |
|---------|---------|
| `react-comments-section` | Unmaintained (last update 2023), brings UI opinions, simple CRUD doesn't need library |
| `@tailwindcss/container-queries` | Optional, start with CSS `clamp()` first |
| `react-window` / `react-virtualized` | Not needed, item lists not large enough to require virtualization |
| `Ariakit` | Steeper learning curve, prefer Radix UI consistency |
| Third-party comment services | External dependency for internal tool, unnecessary complexity |

---

## Verification Checklist

- [x] Versions verified (cmdk 1.1.1 published ~Feb 2025)
- [x] Integration with existing stack considered (Radix UI patterns, Tailwind)
- [x] Bundle impact assessed (~10KB for cmdk)
- [x] Alternative approaches evaluated (custom vs library)
- [x] Official sources checked (GitHub, npm)

---

## Sources

**Comments:**
- [React UI Libraries 2026](https://www.builder.io/blog/react-component-libraries-2026)
- [react-comments-section npm](https://www.npmjs.com/package/react-comments-section)

**Responsive Typography:**
- [Tailwind CSS Font Size](https://tailwindcss.com/docs/font-size)
- [CSS Clamp with Tailwind](https://davidhellmann.com/blog/development/tailwindcss-fluid-typography-with-css-clamp)
- [Tailwind Container Queries](https://tailkits.com/blog/tailwind-container-queries/)

**Searchable Selectors:**
- [cmdk GitHub](https://github.com/dip/cmdk)
- [cmdk npm](https://www.npmjs.com/package/cmdk)
- [Radix Select Searchable Issue](https://github.com/radix-ui/primitives/issues/1334)
- [Radix Combobox Feature Request](https://github.com/radix-ui/primitives/issues/1342)

---

*Research complete. Ready for roadmap creation.*
