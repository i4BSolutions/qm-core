# Phase 29: Deletion Protection - Research

**Researched:** 2026-02-10
**Domain:** PostgreSQL referential integrity, soft-delete patterns, database triggers
**Confidence:** HIGH

## Summary

Phase 29 implements deletion protection for master data entities (items, statuses, categories, departments, contact persons, suppliers) to prevent deactivation when they are referenced by active records. The project uses soft-delete (`is_active = false`) throughout, not hard deletes. The solution requires BEFORE UPDATE triggers that check for active references and block the deactivation attempt with a generic error message.

This phase differs from typical foreign key constraint approaches because:
1. The project uses soft-delete (is_active boolean), not hard DELETE
2. Only active (is_active = true) references should block deactivation
3. A generic user-facing error is required regardless of reference type

**Primary recommendation:** Use BEFORE UPDATE triggers with reference counting functions. Check only is_active = true references. Return generic error message "Cannot delete: this item is in use" to hide internal schema details from users.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 14+ | Database with trigger support | Already used throughout project |
| Supabase | Current | PostgreSQL hosting and RLS | Project standard |
| plpgsql | Native | Stored procedure language | PostgreSQL built-in for triggers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SECURITY DEFINER | Native | Elevated function privileges | For RPC functions that bypass RLS (not needed for triggers) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Triggers | Check constraints | Cannot query other tables, no conditional logic for soft-delete |
| Triggers | RLS policies | Policies prevent reads/writes but don't provide custom error messages |
| Triggers | Application-level checks | Less reliable, can be bypassed, no database-level protection |

**Installation:**
```bash
# No installation needed - all functionality is native PostgreSQL
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
├── 0XX_deletion_protection.sql    # All deletion protection triggers in single migration
```

### Pattern 1: Soft-Delete Protection Trigger

**What:** BEFORE UPDATE trigger that fires when is_active changes from true to false, checks for active references, and blocks with error if found.

**When to use:** For all master data entities that can be soft-deleted and are referenced by other tables.

**Example:**
```sql
-- Function to block item deactivation when referenced
CREATE OR REPLACE FUNCTION block_item_deactivation()
RETURNS TRIGGER AS $$
DECLARE
  ref_count INTEGER;
BEGIN
  -- Only check when is_active changes from true to false
  IF OLD.is_active = true AND NEW.is_active = false THEN

    -- Count active references across all tables
    SELECT COUNT(*) INTO ref_count FROM (
      -- Check QMHQ (item route)
      SELECT 1 FROM qmhq
      WHERE item_id = OLD.id
        AND is_active = true
      LIMIT 1

      UNION ALL

      -- Check QMHQ items junction table
      SELECT 1 FROM qmhq_items qi
      JOIN qmhq q ON q.id = qi.qmhq_id
      WHERE qi.item_id = OLD.id
        AND q.is_active = true
      LIMIT 1

      UNION ALL

      -- Check PO line items (via active POs)
      SELECT 1 FROM po_line_items pli
      JOIN purchase_orders po ON po.id = pli.po_id
      WHERE pli.item_id = OLD.id
        AND po.is_active = true
        AND pli.is_active = true
      LIMIT 1

      UNION ALL

      -- Check inventory transactions
      SELECT 1 FROM inventory_transactions
      WHERE item_id = OLD.id
        AND is_active = true
      LIMIT 1
    ) refs;

    IF ref_count > 0 THEN
      RAISE EXCEPTION 'Cannot delete: this item is in use';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to block deactivation
CREATE TRIGGER block_item_deactivation_trigger
  BEFORE UPDATE ON items
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION block_item_deactivation();
```

### Pattern 2: Efficient Reference Checking with LIMIT 1

**What:** Use UNION ALL with LIMIT 1 on each subquery for early exit once first reference is found.

**When to use:** When checking multiple tables for references - stops as soon as one active reference is found.

**Example:**
```sql
-- Efficient: stops at first match
SELECT EXISTS (
  SELECT 1 FROM qmrl WHERE status_id = OLD.id AND is_active = true LIMIT 1
  UNION ALL
  SELECT 1 FROM qmhq WHERE status_id = OLD.id AND is_active = true LIMIT 1
) INTO has_refs;

-- Inefficient: counts all references
SELECT COUNT(*) FROM (
  SELECT 1 FROM qmrl WHERE status_id = OLD.id AND is_active = true
  UNION ALL
  SELECT 1 FROM qmhq WHERE status_id = OLD.id AND is_active = true
) INTO ref_count;
```

### Pattern 3: Generic Error Messages

**What:** Use generic user-facing error messages that don't reveal internal schema details.

**When to use:** Always for user-facing operations - matches requirement DPRT-07.

**Example:**
```sql
-- Good: Generic message
RAISE EXCEPTION 'Cannot delete: this item is in use';

-- Bad: Reveals internal schema
RAISE EXCEPTION 'Cannot delete: referenced by % QMRL records and % QMHQ records', qmrl_count, qmhq_count;

-- Bad: Reveals table names
RAISE EXCEPTION 'Cannot delete: referenced in po_line_items table';
```

### Pattern 4: WHEN Clause for Trigger Efficiency

**What:** Use WHEN clause in CREATE TRIGGER to filter which rows fire the trigger, avoiding function execution when not needed.

**When to use:** When trigger only needs to fire for specific state transitions.

**Example:**
```sql
-- Efficient: Function only runs when is_active changes to false
CREATE TRIGGER block_item_deactivation_trigger
  BEFORE UPDATE ON items
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false)
  EXECUTE FUNCTION block_item_deactivation();

-- Inefficient: Function runs on every update, checks inside
CREATE TRIGGER block_item_deactivation_trigger
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION block_item_deactivation(); -- checks inside: IF OLD.is_active = true AND NEW.is_active = false
```

### Anti-Patterns to Avoid

- **Counting all references:** Use EXISTS or LIMIT 1 instead of COUNT(*) for better performance
- **Checking inactive references:** Only check is_active = true records to allow cleanup of historical data
- **Detailed error messages:** Don't reveal schema structure in user-facing errors
- **Application-level checks only:** Database triggers provide essential data integrity guarantee
- **Using ON DELETE CASCADE:** Project uses soft-delete, not hard DELETE
- **RPC functions for deactivation checks:** Triggers are more reliable and cannot be bypassed

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Foreign key enforcement | Custom CASCADE/RESTRICT logic | PostgreSQL foreign keys with ON DELETE | Built-in, tested, performant |
| Soft-delete protection | Application-level checks | Database triggers | Cannot be bypassed, guaranteed enforcement |
| Reference counting | Manual queries | EXISTS with UNION ALL + LIMIT 1 | Early exit optimization built into PostgreSQL |
| Generic error patterns | Custom error message system | RAISE EXCEPTION with fixed messages | Simple, standard PostgreSQL |

**Key insight:** PostgreSQL triggers and constraints are battle-tested solutions. Custom application logic can be bypassed or contain bugs. For data integrity, always prefer database-level enforcement.

## Common Pitfalls

### Pitfall 1: Checking Inactive References

**What goes wrong:** Trigger blocks deactivation even when all references are themselves inactive (soft-deleted).

**Why it happens:** Forgetting to filter by is_active = true in reference queries.

**How to avoid:** Always include `AND is_active = true` in WHERE clauses when checking references.

**Warning signs:**
- Cannot deactivate old items that were only used in archived/deleted records
- Users report "false positive" blocking messages

**Example:**
```sql
-- Wrong: checks all references including inactive
SELECT COUNT(*) FROM qmhq WHERE item_id = OLD.id

-- Correct: only checks active references
SELECT COUNT(*) FROM qmhq WHERE item_id = OLD.id AND is_active = true
```

### Pitfall 2: Performance Issues with Large Tables

**What goes wrong:** Slow deactivation attempts due to full table scans.

**Why it happens:** Missing indexes on foreign key columns or is_active flags.

**How to avoid:** Ensure composite indexes exist on (foreign_key, is_active) for all reference checks.

**Warning signs:**
- Deactivation attempts time out
- High database CPU during deactivation
- EXPLAIN shows sequential scans

**Example:**
```sql
-- Add indexes for efficient reference checking
CREATE INDEX IF NOT EXISTS idx_qmhq_item_active
  ON qmhq(item_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_qmrl_status_active
  ON qmrl(status_id) WHERE is_active = true;
```

### Pitfall 3: Trigger Ordering Issues

**What goes wrong:** Audit triggers fire before validation triggers, logging an operation that then fails.

**Why it happens:** PostgreSQL fires triggers in alphabetical order when multiple BEFORE triggers exist.

**How to avoid:** Use naming conventions (e.g., `aa_` prefix) to control trigger firing order if needed.

**Warning signs:**
- Audit logs show failed operations
- Unexpected trigger execution order

**Example:**
```sql
-- Validation trigger fires first (aa_ prefix)
CREATE TRIGGER aa_block_item_deactivation_trigger
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION block_item_deactivation();

-- Audit trigger fires after validation passes
CREATE TRIGGER audit_item_changes_trigger
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION create_audit_log();
```

### Pitfall 4: Foreign Key Constraint Conflicts

**What goes wrong:** Existing ON DELETE RESTRICT constraints already block hard deletes, creating confusion about which protection is active.

**Why it happens:** Mixing hard-delete constraints with soft-delete protection triggers.

**How to avoid:** Document clearly that ON DELETE RESTRICT protects hard deletes, triggers protect soft-deletes. They serve different purposes.

**Warning signs:**
- Different error messages for same apparent operation
- Confusion about whether item "can be deleted"

**Example:**
```sql
-- These protect DIFFERENT operations:

-- Foreign key protects against hard DELETE
item_id UUID REFERENCES items(id) ON DELETE RESTRICT

-- Trigger protects against soft-delete (UPDATE is_active = false)
CREATE TRIGGER block_item_deactivation_trigger...
```

### Pitfall 5: Junction Table Reference Checks

**What goes wrong:** Forgetting to check junction tables (e.g., qmhq_items) when validating item references.

**Why it happens:** Junction tables are "hidden" in the schema and easy to overlook.

**How to avoid:** Systematically map all foreign key relationships, including junction tables. Check each one.

**Warning signs:**
- Item deactivated despite being used in multi-item QMHQ
- "Orphaned" references after deactivation

**Example:**
```sql
-- Must check both direct reference AND junction table
UNION ALL
SELECT 1 FROM qmhq WHERE item_id = OLD.id AND is_active = true LIMIT 1
UNION ALL
SELECT 1 FROM qmhq_items qi
JOIN qmhq q ON q.id = qi.qmhq_id
WHERE qi.item_id = OLD.id AND q.is_active = true LIMIT 1
```

## Code Examples

Verified patterns from existing codebase:

### Existing Pattern: Block Invoice Void with Stock-In

From `/supabase/migrations/040_invoice_void_block_stockin.sql`:

```sql
CREATE OR REPLACE FUNCTION block_invoice_void_with_stockin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  stockin_exists BOOLEAN;
BEGIN
  -- Only check when is_voided changes to true
  IF NEW.is_voided = true AND (OLD.is_voided = false OR OLD.is_voided IS NULL) THEN
    -- Check if any active stock-in transactions exist for this invoice
    SELECT EXISTS (
      SELECT 1 FROM inventory_transactions
      WHERE invoice_id = NEW.id
        AND movement_type = 'inventory_in'
        AND is_active = true
    ) INTO stockin_exists;

    IF stockin_exists THEN
      RAISE EXCEPTION 'Cannot void: inventory has been received against this invoice';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER aa_block_invoice_void_stockin
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION block_invoice_void_with_stockin();
```

### Existing Pattern: Soft-Delete with Validation

From `/supabase/migrations/20260207144000_soft_delete_comment_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.soft_delete_comment(comment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id UUID;
  v_has_replies BOOLEAN;
  v_current_user UUID;
BEGIN
  -- Get current user
  v_current_user := auth.uid();

  IF v_current_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check for replies
  v_has_replies := public.comment_has_replies(comment_id);

  IF v_has_replies THEN
    RAISE EXCEPTION 'Cannot delete comment with replies';
  END IF;

  -- Perform soft delete
  UPDATE public.comments
  SET
    deleted_at = NOW(),
    deleted_by = v_current_user
  WHERE id = comment_id;

  RETURN TRUE;
END;
$$;
```

### Existing Pattern: Soft-Delete in Frontend

From `/app/(dashboard)/admin/users/page.tsx`:

```typescript
const handleDelete = async (id: string) => {
  const supabase = createClient();
  const { error } = await supabase
    .from("users")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    toast({
      title: "Error",
      description: "Failed to deactivate user.",
      variant: "destructive",
    });
  } else {
    toast({
      title: "Success",
      description: "User deactivated.",
    });
    fetchData();
  }
};
```

### Complete Reference Map by Entity

**Items:**
```sql
-- References to check when deactivating item
SELECT 1 FROM qmhq WHERE item_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM qmhq_items qi
  JOIN qmhq q ON q.id = qi.qmhq_id
  WHERE qi.item_id = ? AND q.is_active = true
UNION ALL
SELECT 1 FROM po_line_items pli
  JOIN purchase_orders po ON po.id = pli.po_id
  WHERE pli.item_id = ? AND po.is_active = true AND pli.is_active = true
UNION ALL
SELECT 1 FROM inventory_transactions
  WHERE item_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM stock_out_line_items
  WHERE item_id = ? AND is_active = true
```

**Status Config:**
```sql
-- References to check when deactivating status
SELECT 1 FROM qmrl WHERE status_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM qmhq WHERE status_id = ? AND is_active = true
```

**Categories:**
```sql
-- References to check when deactivating category
SELECT 1 FROM qmrl WHERE category_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM qmhq WHERE category_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM items WHERE category_id = ? AND is_active = true
```

**Departments:**
```sql
-- References to check when deactivating department
SELECT 1 FROM users WHERE department_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM qmrl WHERE department_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM contact_persons WHERE department_id = ? AND is_active = true
```

**Contact Persons:**
```sql
-- References to check when deactivating contact person
SELECT 1 FROM qmrl WHERE contact_person_id = ? AND is_active = true
UNION ALL
SELECT 1 FROM qmhq WHERE contact_person_id = ? AND is_active = true
```

**Suppliers:**
```sql
-- References to check when deactivating supplier
SELECT 1 FROM purchase_orders WHERE supplier_id = ? AND is_active = true
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard DELETE with ON DELETE CASCADE | Soft-delete with is_active flag | 2010s+ | Preserves audit trail, enables undelete |
| Application-level validation | Database triggers | Always standard | Cannot be bypassed, guaranteed data integrity |
| COUNT(*) for reference checks | EXISTS or LIMIT 1 | PostgreSQL 7.x+ | Early exit optimization, better performance |
| Detailed error messages | Generic user-facing errors | Security best practice | Prevents information disclosure |

**Deprecated/outdated:**
- Hard DELETE for transactional data: Modern systems use soft-delete for audit trails
- ON DELETE CASCADE for master data: Too dangerous, prevents reference checking

## Open Questions

None - approach is straightforward with established patterns in codebase.

## Sources

### Primary (HIGH confidence)
- Existing codebase migrations: 040_invoice_void_block_stockin.sql, 20260207144000_soft_delete_comment_rpc.sql
- PostgreSQL trigger documentation: https://www.postgresql.org/docs/current/sql-createtrigger.html
- Project CLAUDE.md architecture patterns
- Existing schema analysis from migrations 001-056

### Secondary (MEDIUM confidence)
- N/A

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Native PostgreSQL features already in use
- Architecture: HIGH - Patterns verified in existing codebase
- Pitfalls: HIGH - Based on existing trigger implementations and PostgreSQL best practices

**Research date:** 2026-02-10
**Valid until:** 2026-03-31 (stable - PostgreSQL trigger patterns unlikely to change)
