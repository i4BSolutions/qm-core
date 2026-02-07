# Phase 25: Two-Step Selectors - Research

**Researched:** 2026-02-07
**Domain:** React dependent dropdowns, category-filtered item selection, accessible form patterns
**Confidence:** HIGH

## Summary

This phase implements a two-step category-first item selection pattern across all item selectors in the QM System. The pattern reduces cognitive load when dealing with large item catalogs by first narrowing by category, then selecting items filtered to that category.

The codebase already has the necessary data model: items have a `category_id` field linking to the `categories` table with `entity_type = 'item'`. The existing `Select` component (Radix UI based) and `InlineCreateSelect` component provide the foundation for searchable dropdowns. The implementation requires creating a new `CategoryItemSelector` component that manages the two-step flow, then replacing current item selectors across PO, Invoice, QMHQ, and Inventory pages.

**Primary recommendation:** Create a reusable `CategoryItemSelector` component using existing Radix Select/Popover primitives with internal search. Fetch categories with item counts, filter items by selected category, and implement the dependent dropdown behavior with proper disabled states and helper text.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Selector Layout
- Stacked layout: category dropdown above, item dropdown below
- Both dropdowns are full width (same width as each other)
- PO line items cannot be edited after creation (no edit mode for selectors)
- Pattern applies to ALL item selectors across the app, not just PO
- Items display as "Name + SKU" in dropdown (name with SKU code visible)
- Inactive items are hidden from dropdown (not shown grayed out)
- Empty categories show message in dropdown: "No items in this category"

#### Category Display
- No item counts shown next to category names
- Color dot shown before category name (using category's assigned color)
- Categories sorted alphabetically (A-Z)
- Empty categories hidden from dropdown (only categories with active items shown)

#### Item Filtering Behavior
- Category is required (no "All Categories" option)
- When category changes: clear item selection and close dropdown
- Item dropdown is disabled until category is selected
- Helper text under category field: "Selecting a category will filter items below"

#### Search Experience
- Both category and item dropdowns are searchable
- Item search matches both name and SKU
- Search starts immediately on first character (no minimum)
- Full keyboard support: arrow keys to navigate, Enter to select, Escape to close

### Claude's Discretion
- Loading state approach (prefetch vs on-demand with spinner)
- Exact helper text wording
- Dropdown styling and animations
- Search debounce timing if needed

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-select | ^2.1.1 | Base dropdown primitive | Already installed, accessible by default |
| @radix-ui/react-popover | ^1.1.1 | Custom searchable dropdown | Already installed, better for search UX |
| React useState/useEffect | ^18.x | State management | Native React patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.441.0 | Icons (Search, ChevronDown, Check) | Already installed |
| tailwindcss | ^3.4.13 | Styling | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Popover + custom search | react-select/headless | Extra dependency, radix already in stack |
| useState for items | React Query/SWR | Overkill for simple fetch, no caching needed |
| Two separate components | Single combined component | Two components match existing patterns |

**Installation:**
```bash
# No new dependencies needed - all already installed
```

## Architecture Patterns

### Recommended Project Structure
```
components/
└── forms/
    ├── category-item-selector.tsx    # NEW: Two-step selector component
    └── inline-create-select.tsx      # EXISTING: Reference pattern

lib/
└── hooks/
    └── use-categories-with-items.ts  # NEW: Fetch categories with items
```

### Pattern 1: Dependent Dropdown State Management
**What:** Parent controls both values; category change resets item
**When to use:** Two-step selection where second depends on first
**Example:**
```typescript
// Source: React controlled components pattern
interface CategoryItemSelectorProps {
  categoryId: string;
  itemId: string;
  onCategoryChange: (categoryId: string) => void;
  onItemChange: (itemId: string) => void;
  disabled?: boolean;
}

function CategoryItemSelector({
  categoryId,
  itemId,
  onCategoryChange,
  onItemChange,
  disabled
}: CategoryItemSelectorProps) {
  // When category changes, reset item
  const handleCategoryChange = (newCategoryId: string) => {
    onCategoryChange(newCategoryId);
    onItemChange(""); // Clear item selection
  };

  // Item dropdown disabled until category selected
  const isItemDisabled = disabled || !categoryId;

  return (
    <div className="space-y-3">
      {/* Category selector */}
      <div>
        <CategorySearchSelect
          value={categoryId}
          onValueChange={handleCategoryChange}
          disabled={disabled}
        />
        <p className="text-xs text-slate-400 mt-1">
          Selecting a category will filter items below
        </p>
      </div>

      {/* Item selector - disabled until category selected */}
      <ItemSearchSelect
        value={itemId}
        onValueChange={onItemChange}
        categoryId={categoryId}
        disabled={isItemDisabled}
      />
    </div>
  );
}
```

### Pattern 2: Searchable Select with Popover
**What:** Popover-based dropdown with search input and filtered list
**When to use:** Dropdowns with many options requiring search
**Example:**
```typescript
// Source: Existing inline-create-select.tsx pattern
function SearchableSelect<T extends { id: string; name: string }>({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  disabled,
  renderOption,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt =>
      opt.name.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const handleSelect = (optionId: string) => {
    onValueChange(optionId);
    setOpen(false);
    setSearchQuery("");
  };

  // Reset search when popover closes
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between",
            !value && "text-slate-400"
          )}
        >
          {/* Display selected or placeholder */}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        {/* Search input */}
        <div className="flex items-center border-b border-slate-700 px-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-10 w-full bg-transparent px-2 text-sm outline-none"
          />
        </div>

        {/* Options list */}
        <div className="max-h-[200px] overflow-y-auto p-1">
          {filteredOptions.map(option => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                "w-full flex items-center px-2 py-2 text-sm rounded-sm",
                "hover:bg-slate-800"
              )}
            >
              {renderOption ? renderOption(option) : option.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### Pattern 3: Category with Color Dot
**What:** Category option with color indicator dot
**When to use:** Category dropdowns where visual distinction helps
**Example:**
```typescript
// Source: Existing category display patterns in codebase
function CategoryOption({ category }: { category: Category }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: category.color || '#6B7280' }}
      />
      <span>{category.name}</span>
    </div>
  );
}
```

### Pattern 4: Item with Name + SKU Display
**What:** Item option showing name prominently with SKU code visible
**When to use:** All item dropdowns per user decision
**Example:**
```typescript
// Source: Existing PO line items table pattern
function ItemOption({ item }: { item: Item }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-slate-200">{item.name}</span>
      {item.sku && (
        <code className="text-amber-400 text-xs font-mono">
          {item.sku}
        </code>
      )}
    </span>
  );
}
```

### Anti-Patterns to Avoid
- **Fetching items before category selected:** Wasteful; only fetch when category known
- **Keeping old item selection on category change:** User decided to clear item when category changes
- **Showing grayed-out inactive items:** User decided inactive items should be hidden
- **"All Categories" option:** User decided category is required, no "All" option

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible dropdown | Custom div+click handlers | Radix UI Popover/Select | ARIA, keyboard, focus management |
| Search debouncing | setTimeout chains | Just filter directly (list is small) | Simplicity; debounce adds complexity |
| Keyboard navigation | Custom keydown handlers | Radix UI primitives | Built-in arrow/enter/escape support |
| Color dot styling | Inline styles per option | Tailwind + style prop | Consistent with codebase |

**Key insight:** The existing `inline-create-select.tsx` component already implements the searchable Popover pattern. Use it as a template for the new component, adapting it for the two-step flow.

## Common Pitfalls

### Pitfall 1: Stale Items After Category Change
**What goes wrong:** Item dropdown shows items from previous category
**Why it happens:** Not resetting filtered items when category changes
**How to avoid:** Clear item selection AND refresh item list when category changes
**Warning signs:** Items visible that don't belong to selected category

### Pitfall 2: Not Closing Popover on Selection
**What goes wrong:** Dropdown stays open after item selected
**Why it happens:** Missing setOpen(false) after selection
**How to avoid:** User decision says "close dropdown" when category changes
**Warning signs:** Users manually clicking away to close

### Pitfall 3: Item Search Not Matching SKU
**What goes wrong:** Search only matches name, not SKU
**Why it happens:** Search filter only checks name field
**How to avoid:** Filter should check both `name.includes(query)` and `sku?.includes(query)`
**Warning signs:** Searching SKU code returns no results

### Pitfall 4: Empty Category Visible in Dropdown
**What goes wrong:** Categories with no active items appear
**Why it happens:** Not filtering categories by item count
**How to avoid:** Query categories that have at least one active item
**Warning signs:** Selecting category shows "No items" message

### Pitfall 5: Popover Width Mismatch
**What goes wrong:** Dropdown content narrower than trigger button
**Why it happens:** PopoverContent has fixed width
**How to avoid:** Use `w-full` with proper width inheritance from trigger
**Warning signs:** Visual inconsistency between closed/open states

### Pitfall 6: Search State Persisting Across Opens
**What goes wrong:** Opening dropdown shows previous search text
**Why it happens:** Not clearing searchQuery on popover close
**How to avoid:** Reset searchQuery in onOpenChange handler when closing
**Warning signs:** Stale search filter from previous interaction

## Code Examples

Verified patterns from official sources and existing codebase:

### Fetching Categories with Active Items
```typescript
// Source: Codebase pattern from categories + items relationship
async function fetchCategoriesWithItems() {
  const supabase = createClient();

  // Get categories for items that have at least one active item
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, color")
    .eq("entity_type", "item")
    .eq("is_active", true)
    .order("name", { ascending: true });

  // Get item counts per category to filter empty ones
  const { data: items } = await supabase
    .from("items")
    .select("category_id")
    .eq("is_active", true);

  // Filter to categories with at least one item
  const categoryIdsWithItems = new Set(
    items?.map(i => i.category_id).filter(Boolean)
  );

  return categories?.filter(c => categoryIdsWithItems.has(c.id)) || [];
}
```

### Fetching Items by Category
```typescript
// Source: Codebase pattern from items table
async function fetchItemsByCategory(categoryId: string) {
  const supabase = createClient();

  const { data: items } = await supabase
    .from("items")
    .select("id, name, sku, default_unit, price_reference")
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  return items || [];
}
```

### CategoryItemSelector Component Structure
```typescript
// Source: Pattern based on inline-create-select.tsx and user decisions
"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Category, Item } from "@/types/database";

interface CategoryItemSelectorProps {
  categoryId: string;
  itemId: string;
  onCategoryChange: (categoryId: string) => void;
  onItemChange: (itemId: string) => void;
  disabled?: boolean;
  /** Optional: preloaded categories with items */
  initialCategories?: Category[];
  /** Optional: preloaded items for selected category */
  initialItems?: Item[];
}

export function CategoryItemSelector({
  categoryId,
  itemId,
  onCategoryChange,
  onItemChange,
  disabled = false,
  initialCategories,
  initialItems,
}: CategoryItemSelectorProps) {
  // Categories state
  const [categories, setCategories] = useState<Category[]>(initialCategories || []);
  const [categoriesLoading, setCategoriesLoading] = useState(!initialCategories);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Items state
  const [items, setItems] = useState<Item[]>(initialItems || []);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  // Load categories on mount
  useEffect(() => {
    if (!initialCategories) {
      loadCategories();
    }
  }, []);

  // Load items when category changes
  useEffect(() => {
    if (categoryId && !initialItems) {
      loadItems(categoryId);
    }
  }, [categoryId]);

  const loadCategories = async () => {
    setCategoriesLoading(true);
    const supabase = createClient();

    // Fetch categories with item entity_type
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, color")
      .eq("entity_type", "item")
      .eq("is_active", true)
      .order("name");

    // Get items to filter empty categories
    const { data: allItems } = await supabase
      .from("items")
      .select("category_id")
      .eq("is_active", true);

    const categoryIdsWithItems = new Set(
      allItems?.map(i => i.category_id).filter(Boolean)
    );

    setCategories(
      (cats || []).filter(c => categoryIdsWithItems.has(c.id))
    );
    setCategoriesLoading(false);
  };

  const loadItems = async (catId: string) => {
    setItemsLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from("items")
      .select("id, name, sku, default_unit, price_reference")
      .eq("category_id", catId)
      .eq("is_active", true)
      .order("name");

    setItems(data || []);
    setItemsLoading(false);
  };

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const query = categorySearch.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(query));
  }, [categories, categorySearch]);

  // Filter items by search (name AND sku)
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const query = itemSearch.toLowerCase();
    return items.filter(i =>
      i.name.toLowerCase().includes(query) ||
      i.sku?.toLowerCase().includes(query)
    );
  }, [items, itemSearch]);

  // Handlers
  const handleCategorySelect = (catId: string) => {
    onCategoryChange(catId);
    onItemChange(""); // Clear item selection per user decision
    setCategoryOpen(false);
    setCategorySearch("");
  };

  const handleItemSelect = (itmId: string) => {
    onItemChange(itmId);
    setItemOpen(false);
    setItemSearch("");
  };

  const handleCategoryOpenChange = (open: boolean) => {
    setCategoryOpen(open);
    if (!open) setCategorySearch("");
  };

  const handleItemOpenChange = (open: boolean) => {
    setItemOpen(open);
    if (!open) setItemSearch("");
  };

  // Get selected for display
  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedItem = items.find(i => i.id === itemId);

  const isItemDisabled = disabled || !categoryId;

  return (
    <div className="space-y-3">
      {/* Category Selector */}
      <div>
        <Popover open={categoryOpen} onOpenChange={handleCategoryOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={categoryOpen}
              disabled={disabled || categoriesLoading}
              className={cn(
                "w-full justify-between bg-slate-800/50 border-slate-700",
                "hover:bg-slate-800 hover:border-amber-500/50",
                !categoryId && "text-slate-400"
              )}
            >
              {categoriesLoading ? (
                <span>Loading categories...</span>
              ) : selectedCategory ? (
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedCategory.color || '#6B7280' }}
                  />
                  <span className="text-slate-200">{selectedCategory.name}</span>
                </div>
              ) : (
                <span>Select category...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-900 border-slate-700"
            align="start"
          >
            {/* Search */}
            <div className="flex items-center border-b border-slate-700 px-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search category..."
                className="flex h-10 w-full bg-transparent py-3 px-2 text-sm text-slate-200 placeholder:text-slate-400 outline-none"
                autoFocus
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch("")}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Options */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {filteredCategories.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No categories found
                </div>
              ) : (
                filteredCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className={cn(
                      "relative flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                      "hover:bg-slate-800 hover:text-slate-100",
                      categoryId === cat.id
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-300"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        categoryId === cat.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span
                      className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                      style={{ backgroundColor: cat.color || '#6B7280' }}
                    />
                    <span>{cat.name}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-slate-400 mt-1">
          Selecting a category will filter items below
        </p>
      </div>

      {/* Item Selector */}
      <div>
        <Popover open={itemOpen} onOpenChange={handleItemOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={itemOpen}
              disabled={isItemDisabled || itemsLoading}
              className={cn(
                "w-full justify-between bg-slate-800/50 border-slate-700",
                "hover:bg-slate-800 hover:border-amber-500/50",
                !itemId && "text-slate-400",
                isItemDisabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {itemsLoading ? (
                <span>Loading items...</span>
              ) : selectedItem ? (
                <span className="flex items-center gap-2">
                  <span className="text-slate-200">{selectedItem.name}</span>
                  {selectedItem.sku && (
                    <code className="text-amber-400 text-xs font-mono">{selectedItem.sku}</code>
                  )}
                </span>
              ) : isItemDisabled ? (
                <span>Select category first...</span>
              ) : (
                <span>Select item...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-900 border-slate-700"
            align="start"
          >
            {/* Search */}
            <div className="flex items-center border-b border-slate-700 px-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search by name or SKU..."
                className="flex h-10 w-full bg-transparent py-3 px-2 text-sm text-slate-200 placeholder:text-slate-400 outline-none"
                autoFocus
              />
              {itemSearch && (
                <button
                  type="button"
                  onClick={() => setItemSearch("")}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Options */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {items.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No items in this category
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  No items match search
                </div>
              ) : (
                filteredItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item.id)}
                    className={cn(
                      "relative flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                      "hover:bg-slate-800 hover:text-slate-100",
                      itemId === item.id
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-300"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        itemId === item.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-slate-200">{item.name}</span>
                    {item.sku && (
                      <code className="ml-2 text-amber-400 text-xs font-mono">{item.sku}</code>
                    )}
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
```

### Usage in PO Line Items Table
```typescript
// Source: Pattern based on existing po-line-items-table.tsx
// Replace current Select with CategoryItemSelector

// In EditableLineItemsTable component
<td className="py-2 px-3 min-w-[280px]">
  {item.item_id ? (
    // Display locked item (no edit after creation)
    <div className="flex items-center gap-2">
      <span className="text-slate-200">{item.item_name}</span>
      {item.item_sku && (
        <code className="text-amber-400 text-xs">{item.item_sku}</code>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => clearItemSelection(item.id)}
        disabled={disabled}
      >
        Change
      </Button>
    </div>
  ) : (
    <CategoryItemSelector
      categoryId={item.category_id || ""}
      itemId=""
      onCategoryChange={(catId) => {
        handleUpdateItem(item.id, "category_id", catId);
      }}
      onItemChange={(itmId) => {
        const selected = availableItems.find(i => i.id === itmId);
        if (selected) {
          handleUpdateItem(item.id, "item_id", itmId);
          handleUpdateItem(item.id, "item_name", selected.name);
          handleUpdateItem(item.id, "item_sku", selected.sku || "");
          // ... other fields
        }
      }}
      disabled={disabled}
    />
  )}
</td>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat item list | Category-filtered selection | This phase | Reduced cognitive load |
| Native select | Searchable Popover dropdown | Already done | Better UX for long lists |
| Radix Select only | Popover + custom search | Pattern established | More control over search UX |

**Deprecated/outdated:**
- **Native HTML select for long lists:** Poor UX; use searchable Popover
- **react-select:** Extra dependency when Radix already in stack

## Open Questions

Things that couldn't be fully resolved:

1. **Prefetch vs On-Demand Loading**
   - What we know: Claude discretion per user
   - Options: Prefetch categories on mount, load items on category select (recommended)
   - Recommendation: Prefetch categories (small set), lazy-load items on category change

2. **Item Selector in Table Rows - Width**
   - What we know: Two dropdowns stacked takes vertical space
   - What's unclear: How much table column width needed
   - Recommendation: Min 280px width for item column; test and adjust

3. **Keyboard Navigation Between Dropdowns**
   - What we know: Radix handles within-dropdown keyboard nav
   - What's unclear: Tab order between category and item dropdowns
   - Recommendation: Natural tab order (category first, item second); Radix handles rest

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/components/forms/inline-create-select.tsx` - Searchable Popover pattern
- Existing codebase: `/components/ui/popover.tsx` - Radix Popover wrapper
- Existing codebase: `/components/po/po-line-items-table.tsx` - Current item selection
- Existing codebase: `/types/database.ts` - Item and Category types

### Secondary (MEDIUM confidence)
- Radix UI Popover docs - Popover primitive usage
- Radix UI Select docs - Native select alternative

### Tertiary (LOW confidence)
- None - all patterns verified in existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Pattern based on existing `inline-create-select.tsx`
- Pitfalls: HIGH - Based on React controlled component best practices and user decisions
- Code examples: HIGH - Adapted from existing codebase patterns

**Research date:** 2026-02-07
**Valid until:** 90 days (stable domain, existing stack)
