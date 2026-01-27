# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `Button.tsx`, `AuthProvider.tsx`)
- Pages: kebab-case for routes, PascalCase for component exports (e.g., `/qmrl/[id]/edit/page.tsx`)
- Utilities: camelCase (e.g., `id-generator.ts`, `po-status.ts`, `invoice-status.ts`)
- Hooks: `use` prefix with camelCase (e.g., `usePermissions.ts`, `useSearch.ts`)
- Types: PascalCase for types and interfaces (e.g., `AuthContextType`, `QMRLWithRelations`)

**Functions:**
- camelCase for all functions and methods
- Utility functions fully documented with JSDoc comments
- Callback functions prefixed with `handle` or `on` when in event context (e.g., `handlePageSizeChange`, `onValueChange`)
- Helper functions that calculate values use `calculate` prefix (e.g., `calculatePOProgress`, `calculateEUSD`)

**Variables:**
- camelCase for regular variables and state
- UPPER_SNAKE_CASE for constants (e.g., `SESSION_TIMEOUT_MS`, `ACTIVITY_KEY`, `SESSION_KEY`)
- Prefixed state names for clarity: use full descriptive names (e.g., `isLoading`, `searchQuery`, `categoryFilter`)

**Types:**
- PascalCase for type names
- Union types use descriptive names with `Type` suffix (e.g., `PermissionAction`, `PermissionResource`, `EntityPrefix`)
- Extended types use `With` prefix for joined relations (e.g., `QMRLWithRelations`)

## Code Style

**Formatting:**
- Prettier with custom config: `C:\Users\User\Documents\qm-core\.prettierrc`
- Print width: 100 characters
- Tab width: 2 spaces
- Trailing commas: ES5 style (objects/arrays in code, not function params)
- Quotes: Double quotes for strings
- Semicolons: Always present
- Tailwind CSS class ordering: Tailwind plugin sorts classes automatically

**Linting:**
- ESLint with Next.js core config
- Config: `C:\Users\User\Documents\qm-core\.eslintrc.json`
- Extends: `next/core-web-vitals` and `prettier`
- Custom rules disabled:
  - `react/no-unescaped-entities`: off
  - `@next/next/no-page-custom-font`: off
- Run with: `npm run lint` or `npm run lint:fix`

**Strict TypeScript:**
- All files use TypeScript strict mode
- Type annotations required for function parameters and return types
- No `any` types without explicit justification
- Database types generated from Supabase schema in `C:\Users\User\Documents\qm-core\types\database.ts`

## Import Organization

**Order:**
1. React and framework imports (`react`, `next/*`)
2. Radix UI and external libraries (`@radix-ui/*`, `lucide-react`, `clsx`, etc.)
3. Internal absolute imports using path aliases (`@/lib/*`, `@/components/*`, `@/types/*`)
4. Type-only imports at the end with `import type`

**Pattern:**
```typescript
import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QMRL, StatusConfig } from "@/types/database";
```

**Path Aliases:**
- `@/*`: Root directory
- `@/components/*`: `./components/*`
- `@/lib/*`: `./lib/*`
- `@/types/*`: `./types/*`
- `@/app/*`: `./app/*`

All relative imports use absolute aliases for clarity.

## Error Handling

**Pattern - Supabase Queries:**
```typescript
const { data, error } = await supabase
  .from("table")
  .select("*")
  .single();

if (error) {
  console.error('Query error:', error.message);
  throw new Error(error.message);
}
// Use data
```

**Pattern - Async/Await:**
```typescript
const fetchData = useCallback(async () => {
  try {
    const result = await someAsyncCall();
    setData(result);
  } catch (err) {
    console.error('Error fetching:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    setError(message);
  } finally {
    setIsLoading(false);
  }
}, []);
```

**Pattern - Auth Provider:**
- Silent error handling for storage operations: `try {...} catch {}`
- Session management errors logged but don't crash the app
- Specific error messages for user-facing errors
- Debug logging throughout auth flow (can be filtered with "Auth:" prefix)

**Pattern - UI Error Display:**
```typescript
{error && (
  <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
    <div className="flex items-center gap-2">
      <AlertCircle className="h-5 w-5 text-red-400" />
      <p className="text-red-400">{error}</p>
    </div>
    <button onClick={fetchData} className="...">
      Click to retry
    </button>
  </div>
)}
```

**Error Context:**
- Server operations use try/catch with specific error messages
- Client operations propagate errors to state for UI display
- Console.error logs always include context (e.g., "Auth: Profile error")
- User-facing errors are human-readable, never raw error codes

## Logging

**Framework:** `console` (native browser/Node APIs)

**Patterns:**
- Info logs prefixed with module name: `console.log("Auth: Init starting...")`
- Error logs with context: `console.error('QMRL query error:', error)`
- No logging in production (handled by environment)
- Auth provider uses verbose logging with prefixes for debugging race conditions
- Query errors logged before throwing: `console.error('Error:', err); throw new Error(...)`

**Log Levels:**
- `console.log()`: Debug info, flow tracking
- `console.error()`: Exceptions, query failures, state issues
- No `console.warn()` observed in codebase
- Debug prefix format: `"Module: Context message"` (e.g., `"Auth: Clearing session: timeout"`)

## Comments

**When to Comment:**
- JSDoc blocks for public functions and utilities (always)
- Complex logic requiring explanation (inline comments)
- Workarounds and temporary fixes marked with context
- Configuration objects with unclear purposes
- NOT for obvious code (e.g., `// increment counter` is unnecessary)

**JSDoc/TSDoc Pattern:**
```typescript
/**
 * Generate a formatted ID for an entity
 *
 * @param prefix - The entity prefix (QMRL, QMHQ, PO, INV)
 * @param sequence - The sequence number
 * @param year - Optional year (defaults to current year)
 * @returns Formatted ID string
 *
 * @example
 * generateId("QMRL", 1) // "QMRL-2025-00001"
 */
export function generateId(
  prefix: EntityPrefix,
  sequence: number,
  year?: number
): string {
```

**Inline Comments:**
```typescript
// Force dynamic rendering for all dashboard routes to prevent
// static prerendering which fails without Supabase env vars at build time
export const dynamic = "force-dynamic";
```

**Configuration Documentation:**
```typescript
// Session timeout: 6 hours
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;
```

## Function Design

**Size:**
- Utility functions: 10-30 lines typical
- Component logic: 20-50 lines before extracting hooks/helpers
- Pages: can be longer (100+ lines) due to JSX and layout needs
- Example: `calculatePOProgress` is ~15 lines, `fetchData` callback is ~35 lines

**Parameters:**
- Single object parameter for functions with 3+ parameters
- Optional parameters use `?` modifier
- Default values in parameter declaration: `year?: number` or `padding: number = 5`
- Typed parameters always use specific types, not `any`

**Return Values:**
- Explicitly typed return types always specified
- Functions returning multiple values use object return (not tuple)
- Example: `{ invoicedPercent: number; receivedPercent: number }`
- Nullish values return `null` not `undefined` for consistency

**Callbacks:**
- useCallback for memoized callbacks in pages and providers
- Dependencies array always included for useCallback
- Named callbacks: `const handleSubmit = useCallback(async () => {...}, [])`

## Module Design

**Exports:**
- Named exports preferred over default exports
- Barrel exports in `index.ts` files for convenience imports
- Example: `C:\Users\User\Documents\qm-core\lib\hooks\index.ts` exports all hooks

**Example Barrel Pattern:**
```typescript
export {
  usePermissions,
  hasPermission,
  getPermissions,
  canAccessRoute,
  roleNavigation,
  type PermissionAction,
  type PermissionResource,
} from "./use-permissions";
```

**File Organization:**
- UI components in `C:\Users\User\Documents\qm-core\components\ui\*`
- Business logic utilities in `C:\Users\User\Documents\qm-core\lib\utils\*`
- Custom hooks in `C:\Users\User\Documents\qm-core\lib\hooks\*`
- Type definitions in `C:\Users\User\Documents\qm-core\types\*`
- Pages and layouts follow Next.js App Router structure

**Barrel Files:**
- `index.ts` files group related exports
- Enables cleaner imports: `import { usePermissions } from "@/lib/hooks"` instead of `from "@/lib/hooks/use-permissions"`
- Export both implementations and types

## Component Patterns

**Functional Components:**
- All components are functional (no class components)
- Server components by default in Next.js App Router
- Client components marked with `"use client"` directive at top

**Component Props:**
- Interface extends appropriate HTML attributes
- Example: `extends React.ButtonHTMLAttributes<HTMLButtonElement>`
- Custom props added to interface

**Ref Forwarding:**
- Components using refs use `React.forwardRef<ElementType, PropsType>`
- Display name always set: `Component.displayName = "ComponentName"`

**Example:**
```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
```

## State Management

**Hooks:**
- useState for local component state
- useCallback for memoized functions
- useMemo for expensive calculations
- useEffect for side effects with proper cleanup
- useContext for auth and permissions context

**Pattern - Filtering with Memoization:**
```typescript
const filteredQmrls = useMemo(() => {
  return qmrls.filter((qmrl) => {
    // filter logic
  });
}, [qmrls, searchQuery, categoryFilter, assignedFilter]);
```

**Pattern - Data Fetching:**
- useCallback for fetch function
- useEffect calls fetch function on mount
- Dependencies managed carefully: `useEffect(() => { fetchData(); }, [fetchData])`

## Styling

**Tailwind CSS:**
- Utility-first approach, no custom CSS files for components
- Dark theme (slate palette): slate-50 through slate-950
- Accent color: amber for highlights and interactive states
- Spacing and sizing via Tailwind scale (px-3, py-2, etc.)

**Color Pattern:**
- Text: slate-200 (light), slate-300, slate-400 (muted), slate-500 (very muted)
- Backgrounds: slate-900 (dark), slate-800, slate-700
- Accents: amber-500, amber-600 (primary), with `/10` and `/30` opacity variants
- Borders: slate-700 base, with `/50` and `/30` opacity variants
- Status colors from config objects: PO_STATUS_CONFIG, APPROVAL_STATUS_CONFIG

**Example Status Colors:**
```typescript
const colorMap: Record<POStatusEnum, string> = {
  not_started: "#94a3b8",    // slate-400
  partially_invoiced: "#f59e0b", // amber-500
  awaiting_delivery: "#3b82f6",  // blue-500
  partially_received: "#a855f7", // purple-500
  closed: "#10b981",         // emerald-500
  cancelled: "#ef4444",      // red-500
};
```

---

*Convention analysis: 2026-01-27*
