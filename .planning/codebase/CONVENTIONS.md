# Coding Conventions

**Analysis Date:** 2026-01-26

## Naming Patterns

**Files:**
- UI components: `kebab-case.tsx` (e.g., `inline-create-select.tsx`, `contact-dialog.tsx`)
- Utilities/hooks: `kebab-case.ts` (e.g., `use-permissions.ts`, `po-status.ts`)
- Pages: `page.tsx` in route directory (e.g., `/app/(dashboard)/admin/categories/page.tsx`)
- Dialogs: `component-dialog.tsx` (e.g., `category-dialog.tsx`, `supplier-dialog.tsx`)
- Tables: `component-table.tsx` or `component-line-items-table.tsx`
- Index files: `index.ts` for barrel exports (e.g., `/components/invoice/index.ts`, `/lib/hooks/index.ts`)

**Functions:**
- camelCase for all functions (e.g., `calculateEUSD`, `handleCreate`, `fetchData`, `canEditPO`)
- Prefix utility functions with action verbs: `format*`, `calculate*`, `get*`, `is*`, `can*`, `has*`
- Hook functions: `use*` convention (e.g., `usePermissions`, `useSearch`, `useDebouncedValue`)
- Event handlers: `handle*` prefix (e.g., `handleCreate`, `handleDelete`, `handleEdit`, `handleSelect`)

**Variables:**
- camelCase for all variables and constants
- Component props interfaces: PascalCase suffix with `Props` (e.g., `InlineCreateSelectProps`, `BadgeProps`)
- State variables: descriptive camelCase (e.g., `isLoading`, `isSubmitting`, `isCreating`, `dialogOpen`)
- Boolean variables: `is*`, `has*`, `can*` prefixes (e.g., `isOpen`, `hasNextPage`, `canEdit`)

**Types:**
- PascalCase for all type/interface names (e.g., `Category`, `StatusConfig`, `FinancialAmount`)
- Enum types: PascalCase (e.g., `UserRole`, `StatusGroup`, `EntityType`, `POStatusEnum`)
- Interface naming: descriptive PascalCase, typically no suffix (e.g., `BaseOption`, `ApiResponse`)
- Props interfaces: `ComponentNameProps` suffix (e.g., `DialogProps`, `TableProps`)

## Code Style

**Formatting:**
- Prettier 3.3.3 with configuration in `.prettierrc`
- 2-space indentation
- 100 character print width
- Trailing commas: ES5 (consistent in arrays/objects)
- Quotes: double quotes (`"`) preferred
- Semicolons: required (semi: true)
- Tailwind CSS class sorting: enabled via `prettier-plugin-tailwindcss`

**Prettier Configuration:**
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**Linting:**
- ESLint 8.57.1 with Next.js core web vitals configuration
- Config: `.eslintrc.json`
- Rule overrides:
  - `react/no-unescaped-entities`: off
  - `@next/next/no-page-custom-font`: off
- ESLint integration with Prettier to prevent conflicts

**TypeScript:**
- Strict mode enabled: `"strict": true`
- Path aliases configured in `tsconfig.json`:
  - `@/*` → Root directory
  - `@/components/*` → `./components/*`
  - `@/lib/*` → `./lib/*`
  - `@/types/*` → `./types/*`
  - `@/app/*` → `./app/*`
- No implicit any
- Module resolution: bundler

## Import Organization

**Order:**
1. React/Next.js imports
2. Third-party library imports (Lucide icons, Radix UI, etc.)
3. Internal component imports
4. Internal utility/hook imports
5. Type imports (typically last with `import type`)

**Example Import Pattern:**
```typescript
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/tables/data-table";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import type { Category } from "@/types/database";
```

**Path Aliases:**
- Always use path aliases with `@/` prefix, never relative paths like `../../`
- Import from barrels: `import { Button } from "@/components/ui/button"` or grouped from index
- Type imports use `import type` keyword to ensure tree-shaking

## Error Handling

**Patterns:**
- Try-catch blocks for async database operations
- Error type checking: `error: any` in catch blocks due to Supabase SDK
- Destructure errors: Check `error.message` or error object properties
- User feedback: Show errors via toast notifications with title and description
- Throw database errors after logging: `if (error) throw error;`

**Example Error Handling Pattern:**
```typescript
try {
  const { data, error } = await supabase.from("table").insert({...}).select();
  if (error) throw error;
  // Success path
} catch (error: any) {
  toast({
    title: "Error",
    description: error.message || "Failed to perform action",
    variant: "destructive",
  });
  // Optional: console.error("Action failed:", error);
}
```

**Console Usage:**
- Avoid console.log in production code
- Use console.error for debugging async errors in try-catch blocks
- Prefixed with context: `console.error("Error fetching user profile:", fetchError)`

## Logging

**Framework:** console methods (native JavaScript)

**Patterns:**
- Minimal logging in components
- Console.error used for debugging async operation failures
- Error logging in auth provider and async functions
- Pattern: `console.error("Context: message", errorObject)`

## Comments

**When to Comment:**
- JSDoc/TSDoc for public functions, hooks, and utilities
- Inline comments for non-obvious business logic
- Comment complex calculation logic (e.g., WAC calculations, EUSD conversions)
- Avoid obvious comments like `// Set state`

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * Format a number with currency suffix (e.g., "1,234.56 MMK")
 */
export function formatAmount(
  amount: number,
  currency: string = "MMK",
  decimals: number = 2
): string {
  return formatCurrency(amount, decimals) + ` ${currency}`;
}

/**
 * Calculate EUSD from amount and exchange rate
 */
export function calculateEUSD(amount: number, exchangeRate: number): number {
  if (exchangeRate <= 0) return 0;
  return Math.round((amount / exchangeRate) * 100) / 100;
}
```

## Function Design

**Size:**
- Keep functions under 50 lines when possible
- Extract complex logic into separate utility functions
- Dialogs and pages may exceed 100 lines due to form handling

**Parameters:**
- Use object parameters for functions with 3+ parameters
- Typed explicitly, avoid any unless necessary

**Return Values:**
- Explicit return types on all functions (except obvious inferred ones)
- Use tuple types for multiple return values
- Return objects for multiple related values

**Example Function Patterns:**
```typescript
// Simple utility
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Hook with multiple returns
export function useSearch(initialValue: string = "", delay: number = 300) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  return {
    searchTerm,
    handleSearch,
    clearSearch,
    isSearching,
  };
}

// Status calculation with early returns
export function canEditPO(status: POStatusEnum): boolean {
  return status !== "closed" && status !== "cancelled";
}
```

## Module Design

**Exports:**
- Named exports preferred: `export function name() {}`
- Default exports only for pages: `export default function Page() {}`
- Type exports with `export type` keyword

**Barrel Files:**
- `/lib/hooks/index.ts`: Re-exports all hooks from subdirectory
- `/components/layout/index.ts`: Re-exports layout components
- `/components/invoice/index.ts`: Re-exports invoice-related components
- Pattern: `export * from "./module-name"`

**Barrel Export Example from `/lib/hooks/index.ts`:**
```typescript
export * from "./use-permissions";
export * from "./use-search";
```

## Component Patterns

**Client vs. Server Components:**
- Use `"use client"` directive at top for interactive components
- Pages use server components by default
- Hooks and state require client component wrapper
- Auth context providers are client components

**Component Structure:**
- Props interface at top
- Main component function (exported)
- Styled with Tailwind CSS
- Lucide React for icons

**Dialog Pattern:**
```typescript
"use client";

interface DialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  item: ItemType | null;
}

export function ItemDialog({ open, onClose, item }: DialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    // Logic
  };

  return <Dialog>...</Dialog>;
}
```

## Configuration Constants

**Constants:**
- Define locally in files or in utility modules
- Exported as constants for reuse
- Example: `colorPresets`, `entityTypeLabels`, `PO_STATUS_CONFIG`

**Status/Config Objects:**
- Exported as readonly records: `export const CONFIG: Record<Type, Config> = {...}`
- Used for display labels, colors, icons
- Centralized in utils for consistency

## String Literals

**Avoid Magic Strings:**
- Create typed objects for string constants
- Example: `entityTypeLabels` record maps types to display strings
- Database table names inlined in queries (expected pattern)

## Type Safety

**Usage:**
- Explicit return types on all functions
- Props interfaces required for all components
- Database types from generated `@/types/database`
- Generic types for reusable components like `InlineCreateSelect<T extends BaseOption>`

**Type Imports:**
```typescript
import type { Category, Department, User } from "@/types/database";
```

---

*Convention analysis: 2026-01-26*
