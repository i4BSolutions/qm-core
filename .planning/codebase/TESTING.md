# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- Not configured/not used

**Assertion Library:**
- Not configured/not used

**Run Commands:**
```bash
npm run test              # Not configured
npm run test:watch       # Not configured
npm run test:coverage    # Not configured
```

## Current State

**No formal test infrastructure exists** in this codebase. There are:
- No test files in `/app`, `/components`, or `/lib` directories
- No Jest or Vitest configuration
- No test scripts in `package.json`
- No test dependencies installed

Only development dependencies related to code quality are configured:
- ESLint (linting)
- Prettier (formatting)
- TypeScript (type checking)

## Recommended Testing Approach

While no tests currently exist, this section describes the **recommended testing strategy** for implementing tests in this Next.js 14 application.

### Test File Organization

**Location Pattern:**
- Co-located with source files
- `.test.ts` or `.test.tsx` suffix

**Directory Structure:**
```
/lib
  /hooks
    use-permissions.ts
    use-permissions.test.ts
  /utils
    po-status.ts
    po-status.test.ts

/components
  /ui
    button.tsx
    button.test.tsx
  /forms
    inline-create-select.tsx
    inline-create-select.test.tsx
```

**Test File Naming:**
- Unit test file: `component.test.tsx` or `utility.test.ts`
- Integration test file: `feature.integration.test.tsx`

### Recommended Framework

**Suggested Stack:**
- **Test Runner:** Vitest (faster, better TypeScript support)
- **Testing Library:** React Testing Library (for components)
- **Utilities:** @testing-library/user-event, @testing-library/jest-dom

**Why Vitest:**
- Faster than Jest for Next.js 14
- Better TypeScript support
- ESM-compatible with Next.js
- Simpler configuration

### Unit Test Patterns

**Utility Functions:**

```typescript
// lib/utils/index.ts
import { describe, it, expect } from "vitest";
import { calculateEUSD, formatCurrency, formatAmount } from "./index";

describe("Currency utilities", () => {
  describe("calculateEUSD", () => {
    it("calculates EUSD correctly from amount and exchange rate", () => {
      expect(calculateEUSD(1000, 2500)).toBe(0.4);
    });

    it("returns 0 for zero or negative exchange rate", () => {
      expect(calculateEUSD(1000, 0)).toBe(0);
      expect(calculateEUSD(1000, -1)).toBe(0);
    });

    it("handles floating point precision", () => {
      expect(calculateEUSD(3999.99, 2500)).toBe(1.6);
    });
  });

  describe("formatCurrency", () => {
    it("formats number with thousand separators", () => {
      expect(formatCurrency(1234.56)).toBe("1,234.56");
    });

    it("respects decimal places parameter", () => {
      expect(formatCurrency(1234.5, 2)).toBe("1,234.50");
      expect(formatCurrency(1234.567, 4)).toBe("1,234.5670");
    });
  });
});
```

**Hooks:**

```typescript
// lib/hooks/use-permissions.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { hasPermission, getPermissions, canAccessRoute } from "./use-permissions";

describe("Permission utilities", () => {
  describe("hasPermission", () => {
    it("returns true for admin with any action on any resource", () => {
      expect(hasPermission("admin", "create", "qmrl")).toBe(true);
      expect(hasPermission("admin", "delete", "invoices")).toBe(true);
    });

    it("respects role-based permissions", () => {
      expect(hasPermission("finance", "read", "invoices")).toBe(true);
      expect(hasPermission("finance", "create", "invoices")).toBe(true);
      expect(hasPermission("requester", "read", "invoices")).toBe(false);
    });

    it("returns false for null role", () => {
      expect(hasPermission(null, "create", "qmrl")).toBe(false);
    });
  });

  describe("canAccessRoute", () => {
    it("allows requester to access /qmrl routes", () => {
      expect(canAccessRoute("requester", "/qmrl")).toBe(true);
      expect(canAccessRoute("requester", "/qmrl/new")).toBe(true);
    });

    it("prevents requester from accessing /invoice routes", () => {
      expect(canAccessRoute("requester", "/invoice")).toBe(false);
    });

    it("returns false for null role", () => {
      expect(canAccessRoute(null, "/dashboard")).toBe(false);
    });
  });
});
```

**Status Utilities:**

```typescript
// lib/utils/po-status.test.ts
import { describe, it, expect } from "vitest";
import {
  calculatePOProgress,
  canEditPO,
  canCreateInvoice,
  getStatusHexColor,
} from "./po-status";

describe("PO Status utilities", () => {
  describe("calculatePOProgress", () => {
    it("calculates progress percentages correctly", () => {
      const result = calculatePOProgress(100, 50, 30);
      expect(result.invoicedPercent).toBe(50);
      expect(result.receivedPercent).toBe(30);
    });

    it("caps at 100 percent", () => {
      const result = calculatePOProgress(100, 150, 200);
      expect(result.invoicedPercent).toBe(100);
      expect(result.receivedPercent).toBe(100);
    });

    it("returns 0 for zero total", () => {
      const result = calculatePOProgress(0, 0, 0);
      expect(result.invoicedPercent).toBe(0);
      expect(result.receivedPercent).toBe(0);
    });
  });

  describe("canEditPO", () => {
    it("allows editing of not_started POs", () => {
      expect(canEditPO("not_started")).toBe(true);
    });

    it("prevents editing of closed POs", () => {
      expect(canEditPO("closed")).toBe(false);
    });

    it("prevents editing of cancelled POs", () => {
      expect(canEditPO("cancelled")).toBe(false);
    });
  });

  describe("canCreateInvoice", () => {
    it("allows invoice creation for non-closed, non-cancelled, non-awaiting status", () => {
      expect(canCreateInvoice("not_started")).toBe(true);
      expect(canCreateInvoice("partially_invoiced")).toBe(true);
    });

    it("prevents invoice creation for awaiting_delivery", () => {
      expect(canCreateInvoice("awaiting_delivery")).toBe(false);
    });
  });
});
```

### Component Test Patterns

**UI Component:**

```typescript
// components/ui/badge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders with default variant", () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
  });

  it("applies variant class", () => {
    const { container } = render(<Badge variant="destructive">Error</Badge>);
    const badge = container.querySelector("div");
    expect(badge).toHaveClass("bg-red-600");
  });

  it("supports custom className", () => {
    const { container } = render(
      <Badge className="custom-class">Custom</Badge>
    );
    const badge = container.querySelector("div");
    expect(badge).toHaveClass("custom-class");
  });
});
```

**Form Component with State:**

```typescript
// components/forms/inline-create-select.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InlineCreateSelect } from "./inline-create-select";

describe("InlineCreateSelect", () => {
  const mockOptions = [
    { id: "1", name: "Option 1", color: "#3B82F6" },
    { id: "2", name: "Option 2", color: "#10B981" },
  ];

  const defaultProps = {
    value: "",
    onValueChange: vi.fn(),
    options: mockOptions,
    onOptionsChange: vi.fn(),
    entityType: "qmrl" as const,
    createType: "category" as const,
  };

  it("renders with placeholder text", () => {
    render(<InlineCreateSelect {...defaultProps} placeholder="Select..." />);
    expect(screen.getByText("Select...")).toBeInTheDocument();
  });

  it("displays selected option", () => {
    render(<InlineCreateSelect {...defaultProps} value="1" />);
    expect(screen.getByText("Option 1")).toBeInTheDocument();
  });

  it("opens popover on button click", async () => {
    render(<InlineCreateSelect {...defaultProps} />);
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Option 1")).toBeInTheDocument();
    });
  });

  it("calls onValueChange when option selected", async () => {
    const onValueChange = vi.fn();
    render(
      <InlineCreateSelect
        {...defaultProps}
        onValueChange={onValueChange}
      />
    );

    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    await waitFor(() => {
      const option = screen.getByText("Option 1");
      fireEvent.click(option);
    });

    expect(onValueChange).toHaveBeenCalledWith("1");
  });

  it("shows creation form when [+] clicked", async () => {
    render(<InlineCreateSelect {...defaultProps} />);
    const createButton = screen.getByTitle(/Create new/);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Enter category name/)).toBeInTheDocument();
    });
  });
});
```

### Integration Test Patterns

**Page with Data Loading:**

```typescript
// app/(dashboard)/admin/categories/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CategoriesPage from "./page";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            then: vi.fn(),
          })),
        })),
      })),
    })),
  })),
}));

describe("Categories Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page title", async () => {
    render(<CategoriesPage />);
    expect(screen.getByText("Category Management")).toBeInTheDocument();
  });

  it("loads and displays categories", async () => {
    render(<CategoriesPage />);

    await waitFor(() => {
      // Component should render after data loads
      expect(screen.queryByText(/Category Management/)).toBeInTheDocument();
    });
  });
});
```

### Error Testing Patterns

**Async Error Handling:**

```typescript
// Test error handling in components
it("shows error toast on failed submission", async () => {
  const mockError = new Error("Failed to create category");
  vi.mocked(createClient).mockReturnValueOnce({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockRejectedValueOnce(mockError),
        })),
      })),
    })),
  });

  render(<CategoryDialog open={true} onClose={vi.fn()} category={null} />);

  // Fill form and submit
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Test" } });
  fireEvent.click(screen.getByText("Create"));

  await waitFor(() => {
    expect(screen.getByText(/Failed to create category/)).toBeInTheDocument();
  });
});
```

### Fixture and Factory Patterns

**Test Fixtures:**

```typescript
// tests/fixtures/categories.ts
import type { Category } from "@/types/database";

export const mockCategory: Category = {
  id: "cat-1",
  name: "Operations",
  entity_type: "qmrl",
  color: "#3B82F6",
  display_order: 1,
  description: "Test category",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const createMockCategory = (overrides: Partial<Category> = {}): Category => ({
  ...mockCategory,
  ...overrides,
});
```

**Factory Pattern:**

```typescript
// tests/factories/po.ts
import type { PurchaseOrder } from "@/types/database";

export function createMockPO(
  overrides: Partial<PurchaseOrder> = {}
): PurchaseOrder {
  return {
    id: "po-1",
    po_number: "PO-2025-00001",
    status: "not_started",
    total_amount: 10000,
    currency: "MMK",
    exchange_rate: 2500,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
```

## Coverage

**Requirements:** None currently enforced

**Recommended Target:**
- Utilities: 100% coverage
- Hooks: 90%+ coverage
- Components: 80%+ coverage (focus on logic, less on rendering)
- Pages: Integration test coverage

**View Coverage:**
```bash
# After Vitest setup
npm run test:coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Test input/output with various scenarios
- Examples: `calculateEUSD`, `formatCurrency`, `hasPermission`, `canEditPO`
- Dependencies mocked

**Integration Tests:**
- Scope: Component with internal state and external calls
- Approach: Test user interactions leading to data changes
- Examples: Form submission with Supabase, dialog open/close flows
- Database calls mocked, but state management intact

**E2E Tests:**
- Framework: Not configured (Cypress or Playwright recommended)
- Scope: Full user workflows across pages
- Not implemented in current codebase

## Common Testing Patterns

**Async Testing:**

```typescript
// Test async function with await
it("fetches data successfully", async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

// Test with waitFor for state updates
await waitFor(() => {
  expect(screen.getByText("Loaded")).toBeInTheDocument();
});

// Test promise rejection
it("handles fetch error", async () => {
  vi.mocked(fetchData).mockRejectedValueOnce(new Error("Network error"));
  // Test error handling
});
```

**Error Testing:**

```typescript
// Test error scenarios
describe("error handling", () => {
  it("throws on invalid input", () => {
    expect(() => calculateEUSD(100, 0)).not.toThrow(); // Returns 0 instead
  });

  it("handles null gracefully", () => {
    expect(getPermissions(null, "qmrl")).toEqual([]);
  });

  it("shows user-friendly error message", async () => {
    render(<Form />);
    fireEvent.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(screen.getByText(/Failed to submit/)).toBeInTheDocument();
    });
  });
});
```

**Form Testing:**

```typescript
// Test form submission
it("submits form with correct data", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();

  render(<CategoryForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText("Name"), "New Category");
  await user.click(screen.getByText("Create"));

  expect(onSubmit).toHaveBeenCalledWith({
    name: "New Category",
    color: expect.any(String),
  });
});
```

## Mocking Strategy

**Framework:** Vitest mocking utilities

**What to Mock:**
- External API calls (Supabase client)
- Toast notifications
- Router navigation
- Date/time functions for consistency

**What NOT to Mock:**
- React hooks (useState, useEffect)
- Utility functions from same file
- Component rendering logic
- User interaction handlers

**Example Mocking Pattern:**

```typescript
import { vi } from "vitest";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        })),
      })),
    })),
  })),
}));
```

---

*Testing analysis: 2026-01-26*
