# Phase 21: Item Enhancements - Research

**Researched:** 2026-02-06
**Domain:** Database schema extension, SKU code generation, UI enhancements
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Price Reference Display**
- Free text field, max 100 characters
- Required for new items; existing items without reference can remain until manually edited
- Visible in: PO line item selector (tooltip on hover), Item List page (dedicated column)
- Item List column visible by default

**Code Generation Behavior**
- Code generated on form save (not on category select)
- Format: `SKU-[CAT]-[XXXX]` where CAT is category abbreviation and XXXX is random 4-char uppercase alphanumeric
- Sequence is random per item (not sequential numbering)
- If category changes, only the CAT portion updates; random suffix stays the same
- Backfill all existing items during migration (overwrite any existing codes)

**Code Format Details**
- Category abbreviation: First letter of each word, uppercase (e.g., "Office Supplies" -> OFS, "Equipment" -> E)
- Random suffix: 4 characters, uppercase alphanumeric only (A-Z, 0-9)
- Category is now required for item creation (no uncategorized items)

**Code Display & Override**
- Code cannot be edited or overridden by users
- Code hidden during item creation; only visible after save
- Code is primary identifier - displayed prominently
- Format in lists/selectors: "SKU-EQP-A7B2 - Laptop Stand" (code first)

### Claude's Discretion
- Collision handling strategy for random codes
- Migration script approach for backfill
- Exact tooltip styling for price reference

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope

</user_constraints>

## Summary

This phase adds two enhancements to the items module: a price reference note field and auto-generated SKU codes based on category. The implementation requires database schema changes (new columns, modified triggers), migration scripts for existing data, and UI updates across item forms and selectors.

The codebase already has the foundation for this work:
- Items table exists with `sku` column (currently auto-generated via trigger using sequential format)
- Categories table supports items via `entity_type = 'item'`
- Radix UI tooltip library is installed but no tooltip component exists yet
- PO line item selector shows items with current SKU format

**Primary recommendation:** Replace the existing sequential SKU trigger with a new category-based random code generator, add price_reference column with NOT NULL constraint for new rows, and update all item display locations to use the new "SKU-CAT-XXXX - Name" format.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @radix-ui/react-tooltip | ^1.1.3 | Tooltip component | Installed, needs component wrapper |
| PostgreSQL | via Supabase | Database triggers, functions | In use |
| Next.js 14 | App Router | UI framework | In use |

### No New Dependencies Required
This phase uses existing libraries only.

## Architecture Patterns

### Database Schema Extension

**New columns for items table:**
```sql
-- Add price reference field
ALTER TABLE items ADD COLUMN price_reference TEXT;

-- Add constraint for 100 char max
ALTER TABLE items ADD CONSTRAINT items_price_reference_length
  CHECK (char_length(price_reference) <= 100);

-- Keep existing sku column, replace trigger logic
```

### SKU Code Generation Pattern

**Category abbreviation extraction:**
```sql
-- Function to generate category abbreviation
CREATE OR REPLACE FUNCTION get_category_abbreviation(category_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Extract first letter of each word, uppercase
  -- "Office Supplies" -> "OS"
  -- "Equipment" -> "E"
  -- "Electronics" -> "E"
  RETURN UPPER(
    array_to_string(
      ARRAY(
        SELECT substring(word, 1, 1)
        FROM regexp_split_to_table(category_name, '\s+') AS word
        WHERE word != ''
      ),
      ''
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

**Random suffix generation:**
```sql
-- Generate 4-character random alphanumeric (A-Z, 0-9)
CREATE OR REPLACE FUNCTION generate_random_suffix(length INT DEFAULT 4)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * 36 + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;
```

### Collision Handling Strategy (Claude's Discretion)

**Recommendation: Retry with new random on collision**

The probability of collision with 36^4 = 1,679,616 possible combinations is very low. Strategy:

```sql
CREATE OR REPLACE FUNCTION generate_item_sku_v2()
RETURNS TRIGGER AS $$
DECLARE
  cat_abbr TEXT;
  rand_suffix TEXT;
  new_sku TEXT;
  attempt INT := 0;
  max_attempts INT := 10;
BEGIN
  -- Only generate on INSERT or when category changes
  IF TG_OP = 'INSERT' OR
     (TG_OP = 'UPDATE' AND OLD.category_id IS DISTINCT FROM NEW.category_id) THEN

    -- Get category abbreviation
    SELECT get_category_abbreviation(c.name) INTO cat_abbr
    FROM categories c WHERE c.id = NEW.category_id;

    -- If no category, use 'UNK' (shouldn't happen - category is required)
    cat_abbr := COALESCE(cat_abbr, 'UNK');

    -- For UPDATE: keep existing suffix, only update category portion
    IF TG_OP = 'UPDATE' AND OLD.sku IS NOT NULL THEN
      -- Extract existing suffix (last 4 chars after final dash)
      rand_suffix := substring(OLD.sku FROM '[A-Z0-9]{4}$');
      IF rand_suffix IS NOT NULL THEN
        NEW.sku := 'SKU-' || cat_abbr || '-' || rand_suffix;
        RETURN NEW;
      END IF;
    END IF;

    -- For INSERT or UPDATE without valid suffix: generate new random
    LOOP
      rand_suffix := generate_random_suffix(4);
      new_sku := 'SKU-' || cat_abbr || '-' || rand_suffix;

      -- Check for collision
      IF NOT EXISTS (SELECT 1 FROM items WHERE sku = new_sku AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) THEN
        NEW.sku := new_sku;
        EXIT;
      END IF;

      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique SKU after % attempts', max_attempts;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Migration Script Approach (Claude's Discretion)

**Recommendation: Single migration with backfill in transaction**

```sql
-- Backfill existing items with new SKU format
DO $$
DECLARE
  item_rec RECORD;
  cat_abbr TEXT;
  rand_suffix TEXT;
  new_sku TEXT;
  attempt INT;
  max_attempts INT := 10;
BEGIN
  FOR item_rec IN SELECT i.id, i.category_id, c.name as category_name
                  FROM items i
                  LEFT JOIN categories c ON c.id = i.category_id
                  WHERE i.is_active = true
  LOOP
    -- Get category abbreviation (or 'UNK' for uncategorized)
    cat_abbr := COALESCE(
      get_category_abbreviation(item_rec.category_name),
      'UNK'
    );

    -- Generate unique SKU with retry
    attempt := 0;
    LOOP
      rand_suffix := generate_random_suffix(4);
      new_sku := 'SKU-' || cat_abbr || '-' || rand_suffix;

      IF NOT EXISTS (SELECT 1 FROM items WHERE sku = new_sku) THEN
        UPDATE items SET sku = new_sku WHERE id = item_rec.id;
        EXIT;
      END IF;

      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        -- Fallback: append item ID snippet
        new_sku := 'SKU-' || cat_abbr || '-' || upper(substring(item_rec.id::text, 1, 4));
        UPDATE items SET sku = new_sku WHERE id = item_rec.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;
```

### Tooltip Styling (Claude's Discretion)

**Recommendation: Standard Radix tooltip with dark theme styling**

Create `/components/ui/tooltip.tsx`:
```tsx
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200",
      "border border-slate-700 shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
));
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Random string generation | Custom JS crypto | PostgreSQL `random()` + string functions | Consistent across API/trigger, database-level uniqueness check |
| Tooltip | Custom hover component | Radix UI Tooltip | Accessibility, keyboard support, positioning |
| Category abbreviation | Frontend logic | Database function | Consistency in migration and triggers |

**Key insight:** All SKU generation logic should live in the database trigger to ensure consistency whether items are created via UI, API, or direct SQL.

## Common Pitfalls

### Pitfall 1: Frontend-generated codes
**What goes wrong:** Generating SKU codes in the frontend leads to race conditions and duplicates
**Why it happens:** Multiple users creating items simultaneously
**How to avoid:** Generate codes in database trigger with collision check
**Warning signs:** Duplicate SKU errors in production

### Pitfall 2: Breaking existing SKU references
**What goes wrong:** Changing SKU format breaks PO line items, inventory transactions that snapshot item_sku
**Why it happens:** Other tables store `item_sku` as denormalized field
**How to avoid:** Migration updates all snapshot fields; verify with query before/after
**Warning signs:** Old SKU format appearing in PO/invoice line items

### Pitfall 3: Category abbreviation collisions
**What goes wrong:** "Electronics" and "Equipment" both become "E"
**Why it happens:** First-letter-of-each-word can collide for single-word categories
**How to avoid:** This is acceptable - the random suffix ensures uniqueness. Could add 2+ letters for single words if needed.
**Warning signs:** Multiple categories with same abbreviation

### Pitfall 4: Price reference required breaking existing flow
**What goes wrong:** Existing items can't be updated because price_reference is required
**Why it happens:** Adding NOT NULL constraint retroactively
**How to avoid:** Use CHECK constraint only for new items: `CHECK (created_at < 'migration_date' OR price_reference IS NOT NULL)`
**Warning signs:** Update failures on existing items

### Pitfall 5: Tooltip overflow in narrow dropdowns
**What goes wrong:** Long price reference text overflows or clips
**Why it happens:** SelectItem in narrow dropdown
**How to avoid:** Use `max-width` on tooltip content, truncate with ellipsis
**Warning signs:** Tooltip extending past screen edge

## Code Examples

### Item Dialog - Price Reference Field
```tsx
// Source: New addition to /app/(dashboard)/item/item-dialog.tsx
<div className="grid gap-2">
  <Label htmlFor="price_reference">
    Price Reference <span className="text-red-400">*</span>
  </Label>
  <Input
    id="price_reference"
    value={formData.price_reference}
    onChange={(e) =>
      setFormData({ ...formData, price_reference: e.target.value })
    }
    placeholder="e.g., $50-75 retail, bulk discount available"
    maxLength={100}
    required
  />
  <p className="text-xs text-slate-400">
    {formData.price_reference.length}/100 characters
  </p>
</div>
```

### PO Line Item Selector with Tooltip
```tsx
// Source: Modified /components/po/po-line-items-table.tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// In SelectContent for item selection:
<SelectContent>
  <TooltipProvider>
    {availableItems.map((item) => (
      <Tooltip key={item.id}>
        <TooltipTrigger asChild>
          <SelectItem value={item.id}>
            <span className="font-mono text-amber-400">{item.sku}</span>
            <span className="mx-2 text-slate-500">-</span>
            <span>{item.name}</span>
          </SelectItem>
        </TooltipTrigger>
        {item.price_reference && (
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs text-slate-300">{item.price_reference}</p>
          </TooltipContent>
        )}
      </Tooltip>
    ))}
  </TooltipProvider>
</SelectContent>
```

### Item List Page - New Column Order
```tsx
// Source: Modified /app/(dashboard)/item/page.tsx
const columns: ColumnDef<ItemWithCategory>[] = [
  {
    accessorKey: "photo_url",
    header: "Photo",
    // ... existing
  },
  {
    accessorKey: "sku",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
    cell: ({ row }) => (
      <code className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-brand-400">
        {row.getValue("sku") || "-"}
      </code>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    // ... existing
  },
  {
    accessorKey: "price_reference",
    header: "Price Reference",
    cell: ({ row }) => {
      const ref = row.getValue("price_reference") as string | null;
      return ref ? (
        <span className="text-sm text-slate-300 truncate max-w-[200px] block">
          {ref}
        </span>
      ) : (
        <span className="text-slate-500">-</span>
      );
    },
  },
  {
    accessorKey: "category_rel",
    header: "Category",
    // ... existing
  },
  // ... actions
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential SKU (EQ-0001) | Random SKU (SKU-EQP-A7B2) | This phase | Better for distributed systems, no sequence gaps |
| Category optional | Category required | This phase | All items must have category |
| No price reference | Price reference field | This phase | Purchasing team has context |

**Current item schema:**
- `sku` column exists (TEXT UNIQUE)
- `category_id` column exists (nullable FK to categories)
- No `price_reference` column
- Trigger `generate_item_sku_trigger` uses sequential format

## Open Questions

1. **Category abbreviation for multi-word single letters?**
   - What we know: "Office Supplies" -> "OS", "Equipment" -> "E"
   - What's unclear: Is "E" sufficient or should single-word categories use more letters?
   - Recommendation: Keep simple first-letter approach; random suffix ensures uniqueness

2. **Existing uncategorized items during backfill?**
   - What we know: Some items may have `category_id = NULL`
   - What's unclear: Should these get "UNK" abbreviation or should category be required before migration?
   - Recommendation: Use "UNK" for backfill, require category going forward

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/supabase/migrations/007_items.sql` - Current items schema
- Codebase analysis: `/supabase/migrations/017_item_categories.sql` - Category support
- Codebase analysis: `/app/(dashboard)/item/` - Current item UI
- Codebase analysis: `/components/po/po-line-items-table.tsx` - PO item selector
- Codebase analysis: `/package.json` - Radix tooltip already installed

### Secondary (MEDIUM confidence)
- PostgreSQL documentation for `random()` and string functions
- Radix UI Tooltip documentation for component pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing libraries, no new dependencies
- Architecture: HIGH - Database triggers are established pattern in codebase
- Pitfalls: MEDIUM - Based on common issues with code generation, may miss edge cases

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain)
