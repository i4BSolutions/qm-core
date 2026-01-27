# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Status:** No test infrastructure currently implemented

**Testing Gap:** The project has NOT established a test framework yet. This is a significant gap for quality assurance. The codebase is production-ready (Iteration 10 complete) but lacks test coverage.

**Recommended Setup:**
- Framework: Vitest or Jest (both work with Next.js)
- Runner: Vitest recommended for speed with Next.js App Router
- Assertion library: Vitest built-in or Chai
- UI testing: Playwright or Testing Library for component/E2E tests
- Mocking: Vitest's `vi` or Jest mocks

**Run Commands (to implement):**
```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

## Test File Organization

**Recommended Location:**
- Co-located pattern: `[component].test.tsx` next to component file
- Alternative: `__tests__/` directory at same level

**Recommended Naming:**
- Unit tests: `[module].test.ts` or `[module].spec.ts`
- Component tests: `[Component].test.tsx`
- Integration tests: `[feature].integration.test.ts`
- E2E tests: Separate `/e2e` directory with `.spec.ts` files

**Example Structure (to implement):**
```
/components
  /ui
    button.tsx
    button.test.tsx         # Co-located test
    input.tsx
    input.test.tsx
  /providers
    auth-provider.tsx
    auth-provider.test.tsx

/lib
  /utils
    __tests__/
      id-generator.test.ts
      po-status.test.ts
      invoice-status.test.ts
```

## Test Structure

**Recommended Suite Organization (based on codebase patterns):**

```typescript
// Example: lib/utils/id-generator.test.ts
import { describe, it, expect } from "vitest";
import { generateId, parseId, isValidId, formatSequence } from "./id-generator";

describe("ID Generator", () => {
  describe("generateId", () => {
    it("should generate formatted ID with current year", () => {
      const id = generateId("QMRL", 1);
      expect(id).toMatch(/^QMRL-\d{4}-00001$/);
    });

    it("should generate formatted ID with specific year", () => {
      const id = generateId("PO", 123, 2024);
      expect(id).toBe("PO-2024-00123");
    });

    it("should pad sequence number to 5 digits", () => {
      const id = generateId("INV", 5);
      expect(id).toMatch(/-00005$/);
    });
  });

  describe("parseId", () => {
    it("should parse valid ID string", () => {
      const parsed = parseId("QMRL-2025-00001");
      expect(parsed).toEqual({
        prefix: "QMRL",
        year: 2025,
        sequence: 1,
      });
    });

    it("should return null for invalid format", () => {
      expect(parseId("INVALID-FORMAT")).toBeNull();
    });
  });

  describe("isValidId", () => {
    it("should validate correct format", () => {
      expect(isValidId("QMRL-2025-00001")).toBe(true);
    });

    it("should check prefix when specified", () => {
      expect(isValidId("QMRL-2025-00001", "QMRL")).toBe(true);
      expect(isValidId("QMRL-2025-00001", "PO")).toBe(false);
    });
  });
});
```

**Patterns:**
- Use `describe()` to group related tests
- Use nested `describe()` for organization by function/feature
- Clear test names: `should [expected behavior] [when condition]`
- Arrange-Act-Assert pattern implied by test name
- One assertion per test typically (or related assertions)

## Mocking

**Framework:** Vitest's `vi` mock utilities (when implemented)

**Patterns to Implement:**

**Pattern 1 - Mock Supabase Client:**
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client");

describe("Supabase operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch data on success", async () => {
    const mockData = [{ id: "1", name: "Test" }];
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      }),
    } as any);

    // Test code using mocked client
  });
});
```

**Pattern 2 - Mock React Hooks:**
```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePermissions } from "@/lib/hooks";

vi.mock("@/components/providers/auth-provider", () => ({
  useUserRole: () => "admin",
}));

describe("usePermissions", () => {
  it("should check admin permissions", () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.can("create", "qmrl")).toBe(true);
  });
});
```

**Pattern 3 - Mock Context:**
```typescript
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// In test
const mockAuthValue = {
  user: { id: "123", role: "admin" },
  isLoading: false,
  error: null,
  signOut: vi.fn(),
  refreshUser: vi.fn(),
};

// Wrap component in provider with mock value
```

**What to Mock:**
- External API calls (Supabase)
- Authentication/Context providers
- Date/time functions (for deterministic tests)
- Browser APIs (localStorage, sessionStorage)
- Expensive computations

**What NOT to Mock:**
- Utility functions (id-generator, formatters)
- Status/permission configuration objects
- Type conversions and helpers
- Component rendering logic (test real components)

## Fixtures and Factories

**Test Data Pattern (to implement):**

```typescript
// lib/utils/__tests__/fixtures/qmrl.fixtures.ts
import type { QMRL, StatusConfig } from "@/types/database";

export const createMockQMRL = (overrides?: Partial<QMRL>): QMRL => ({
  id: "uuid-1",
  request_id: "QMRL-2025-00001",
  title: "Test Request",
  description: "Test description",
  priority: "medium",
  status_id: "status-1",
  category_id: "category-1",
  assigned_to: "user-1",
  requester_id: "user-2",
  department_id: "dept-1",
  is_active: true,
  created_at: "2025-01-27T00:00:00Z",
  updated_at: "2025-01-27T00:00:00Z",
  created_by: "user-1",
  updated_by: "user-1",
  request_date: "2025-01-27",
  notes: null,
  ...overrides,
});

export const createMockStatusConfig = (overrides?: Partial<StatusConfig>): StatusConfig => ({
  id: "status-1",
  entity_type: "qmrl",
  status_group: "to_do",
  name: "Draft",
  color: "#9CA3AF",
  display_order: 1,
  is_default: true,
  is_active: true,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  ...overrides,
});
```

**Usage in Tests:**
```typescript
it("should display draft status", () => {
  const qmrl = createMockQMRL({ status_id: "draft" });
  const status = createMockStatusConfig({ name: "Draft" });

  // Use in test
});

it("should handle different priorities", () => {
  ["low", "medium", "high", "critical"].forEach((priority) => {
    const qmrl = createMockQMRL({ priority: priority as any });
    // Test with each priority
  });
});
```

**Location:**
- `lib/utils/__tests__/fixtures/` for data fixtures
- `lib/utils/__tests__/factories/` for factory functions
- Shared fixtures available to all test suites

## Coverage

**Current Status:** 0% - No test infrastructure

**Recommended Target:** 70%+ for business logic, 50%+ for UI components

**Critical Areas to Test (Priority Order):**
1. ID generation (`lib/utils/id-generator.ts`) - 100% coverage required
2. Status calculations (`lib/utils/po-status.ts`, `lib/utils/invoice-status.ts`)
3. Financial calculations (`lib/utils/index.ts` - EUSD, formatting)
4. Permission checks (`lib/hooks/use-permissions.ts`)
5. Auth provider state management (`components/providers/auth-provider.tsx`)
6. Form validation and submission flows

**View Coverage (to implement):**
```bash
npm run test:coverage
# Generates coverage report in ./coverage directory
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Examples to implement:
  - `id-generator.test.ts`: All ID format variations
  - `po-status.test.ts`: All status calculation scenarios
  - `utils/index.test.ts`: All formatters (currency, EUSD, dates)
  - `use-permissions.test.ts`: Permission matrix checks
- Approach: Pure function testing, no mocks except external APIs

**Integration Tests (to implement):**
- Scope: Multiple functions working together
- Examples:
  - PO creation with status calculation
  - Invoice validation with available quantity checks
  - Auth flow: login → fetch profile → set user
  - QMRL filtering with multiple criteria
- Approach: Mock Supabase, real utility functions
- Location: `__tests__/integration/`

**E2E Tests (to implement):**
- Scope: Full user workflows
- Framework: Playwright or Cypress
- Examples:
  - Create QMRL → Edit → Change Status
  - Create PO → Add Invoice → Check Progress
  - Login → Navigate Dashboard → Create Item
- Location: `/e2e/` directory
- Run with: `npm run test:e2e`

## Common Patterns

**Async Testing Pattern:**
```typescript
it("should fetch data and set loading state", async () => {
  const { result } = renderHook(() => useData());

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.data).toBeDefined();
});
```

**Error Testing Pattern:**
```typescript
it("should handle fetch error", async () => {
  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Network error"),
    }),
  } as any);

  const { result } = renderHook(() => useData());

  await waitFor(() => {
    expect(result.current.error).toBe("Network error");
  });
});
```

**Component Snapshot Testing (use sparingly):**
```typescript
it("should render button with correct styles", () => {
  const { container } = render(
    <Button variant="default" size="lg">
      Click me
    </Button>
  );

  expect(container.firstChild).toMatchSnapshot();
});
```

**Testing Permissions (to implement):**
```typescript
describe("Permission checks", () => {
  const permissionTests = [
    { role: "admin", resource: "users", action: "delete", expected: true },
    { role: "requester", resource: "users", action: "delete", expected: false },
    { role: "finance", resource: "invoices", action: "create", expected: true },
  ];

  permissionTests.forEach(({ role, resource, action, expected }) => {
    it(`should ${expected ? "allow" : "deny"} ${role} to ${action} ${resource}`, () => {
      expect(hasPermission(role as UserRole, action as PermissionAction, resource as PermissionResource))
        .toBe(expected);
    });
  });
});
```

## Implementation Checklist

**Phase 1: Setup (1-2 days)**
- [ ] Install Vitest, @testing-library/react, @testing-library/jest-dom
- [ ] Create vitest.config.ts with Next.js configuration
- [ ] Add npm scripts: test, test:watch, test:coverage
- [ ] Create test fixtures structure

**Phase 2: Core Utilities (2-3 days)**
- [ ] Unit tests for `lib/utils/id-generator.ts` - 100% coverage
- [ ] Unit tests for `lib/utils/po-status.ts` - status calculations
- [ ] Unit tests for `lib/utils/invoice-status.ts`
- [ ] Unit tests for `lib/utils/index.ts` - formatters and calculations

**Phase 3: Business Logic (3-5 days)**
- [ ] Tests for `lib/hooks/use-permissions.ts`
- [ ] Tests for `lib/utils/search.ts`
- [ ] Integration tests for permission-based queries
- [ ] Tests for status and category management

**Phase 4: Components & Auth (5-7 days)**
- [ ] Tests for auth provider state management
- [ ] Component tests for UI primitives (Button, Input, Select)
- [ ] Tests for form components
- [ ] E2E tests for critical user flows

**Phase 5: Coverage Goals (ongoing)**
- [ ] Achieve 80%+ coverage on utilities
- [ ] Achieve 60%+ coverage on hooks
- [ ] Achieve 50%+ coverage on components
- [ ] Document coverage baseline and maintain

---

*Testing analysis: 2026-01-27*
