# Phase 27: Stock-Out Approval DB Foundation - Research

**Researched:** 2026-02-09
**Domain:** PostgreSQL approval workflow, inventory validation, RLS policies
**Confidence:** HIGH

## Summary

Phase 27 establishes database foundation for stock-out approval workflow. Currently, stock-out happens directly via `inventory_transactions` table with `inventory_out` movement type. This phase introduces an approval layer where requests are created with `Pending` status, admin approves/rejects with optional partial approval, and only approved requests can execute stock-out.

**Key challenges:**
1. Race condition prevention for concurrent stock validation at request + approval time
2. Partial approval schema design (requested vs approved quantities)
3. Audit trail integration with existing `audit_logs` table
4. RLS policies following existing role-based permission matrix

**Primary recommendation:** Use existing patterns from invoice quantity validation (trigger-based with `SELECT` queries) and PO approval status (enum-based workflow tracking). Leverage established audit trigger pattern and RLS helper functions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 14+ | RDBMS with MVCC | Project standard, already in use |
| Supabase | Current | Backend platform | Project stack, provides RLS + auth |
| plpgsql | Built-in | Stored procedures | Native to PostgreSQL, used for all triggers/functions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | 5+ | Type safety | Generate types from schema with Supabase CLI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Trigger validation | Application-level validation | Triggers enforce at DB level regardless of client, better for data integrity |
| SERIALIZABLE isolation | Row-level locking with SELECT FOR UPDATE | Row locking simpler for single-row updates, SERIALIZABLE adds retry complexity |
| Custom audit table | Generic audit_logs table | Already established pattern in codebase, reuse existing infrastructure |

**Installation:**
N/A - Using existing PostgreSQL/Supabase infrastructure

## Architecture Patterns

### Recommended Table Structure
```sql
supabase/migrations/
├── 0XX_stock_out_requests.sql           # Main table + enums + indexes
├── 0XX_stock_out_requests_triggers.sql  # Validation + audit triggers
├── 0XX_stock_out_requests_rls.sql       # RLS policies
└── types/database.ts                     # Auto-generated (supabase gen types)
```

### Pattern 1: Approval Status Enum Workflow
**What:** Track workflow state with PostgreSQL enum type, similar to existing `po_status` and `approval_status` patterns
**When to use:** Multi-state workflows with defined transitions (Pending → Approved/Rejected)
**Example:**
```sql
-- Source: Existing pattern from 015_purchase_orders.sql
CREATE TYPE stock_out_request_status AS ENUM (
  'pending',    -- Initial state, awaiting admin approval
  'approved',   -- Admin approved (possibly with different qty)
  'rejected',   -- Admin rejected with reason
  'cancelled'   -- Requester cancelled before approval
);
```

### Pattern 2: Requested vs Approved Quantity Schema
**What:** Separate columns for initial request and final approval, enabling partial approval
**When to use:** When approver needs ability to approve less than requested amount
**Example:**
```sql
-- Schema design for partial approval
requested_quantity DECIMAL(15,2) NOT NULL CHECK (requested_quantity > 0),
approved_quantity DECIMAL(15,2) CHECK (approved_quantity > 0 AND approved_quantity <= requested_quantity),
-- approved_quantity is NULL when status = 'pending'
-- approved_quantity must be set when status = 'approved'
```

### Pattern 3: Trigger-Based Stock Validation
**What:** Use BEFORE trigger with `SELECT` query to check stock availability, similar to existing `validate_invoice_line_quantity()`
**When to use:** Prevent race conditions at database level for inventory checks
**Example:**
```sql
-- Source: Existing pattern from 022_invoice_line_items.sql lines 35-72
CREATE OR REPLACE FUNCTION validate_stock_out_request()
RETURNS TRIGGER AS $$
DECLARE
  available_stock DECIMAL(15,2);
BEGIN
  -- Only validate on INSERT or when approving (status → 'approved')
  IF TG_OP = 'UPDATE' AND (OLD.status = NEW.status OR NEW.status != 'approved') THEN
    RETURN NEW;
  END IF;

  -- Get current available stock using existing helper function
  available_stock := get_warehouse_stock(NEW.item_id, NEW.warehouse_id);

  -- Validate requested quantity at creation time
  IF TG_OP = 'INSERT' AND NEW.requested_quantity > available_stock THEN
    RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %',
      NEW.requested_quantity, available_stock;
  END IF;

  -- Validate approved quantity at approval time
  IF NEW.status = 'approved' THEN
    IF NEW.approved_quantity IS NULL THEN
      RAISE EXCEPTION 'Approved quantity must be set when approving request';
    END IF;

    IF NEW.approved_quantity > available_stock THEN
      RAISE EXCEPTION 'Approved quantity (%) exceeds available stock (%)',
        NEW.approved_quantity, available_stock;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Pattern 4: Audit Integration with Existing Trigger
**What:** Reuse existing `create_audit_log()` trigger function that handles status changes and approval actions
**When to use:** All entity state changes need audit trail
**Example:**
```sql
-- Source: Existing pattern from 026_audit_triggers.sql
-- The generic audit trigger already handles:
-- - Status changes (lines 108-138)
-- - Approval actions (lines 212-232)
-- Simply attach to new table:
DROP TRIGGER IF EXISTS audit_stock_out_requests ON stock_out_requests;
CREATE TRIGGER audit_stock_out_requests
  AFTER INSERT OR UPDATE OR DELETE ON stock_out_requests
  FOR EACH ROW EXECUTE FUNCTION create_audit_log();
```

### Pattern 5: RLS Helper Functions
**What:** Use `SECURITY DEFINER` functions to check permissions without circular dependencies, following existing `get_user_role()` pattern
**When to use:** Complex authorization logic that RLS policies need to reference
**Example:**
```sql
-- Source: Existing pattern from 027_rls_policies.sql lines 14-25
-- Reuse existing helper
CREATE OR REPLACE FUNCTION owns_stock_out_request(request_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM stock_out_requests
    WHERE id = request_id AND requester_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

### Anti-Patterns to Avoid
- **Using application-level locking:** Database-level triggers ensure validation regardless of which client accesses data
- **Soft-delete approval records:** Keep full history; soft-delete with `is_active` follows project convention
- **Custom audit table structure:** Use existing `audit_logs` table and `create_audit_log()` trigger
- **Missing CHECK constraints:** Always validate `approved_quantity <= requested_quantity` at schema level

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent stock validation | Custom locking mechanism | PostgreSQL BEFORE trigger + `get_warehouse_stock()` function | Existing codebase has proven pattern in invoice validation; handles race conditions via MVCC |
| Approval workflow audit | Custom audit table/triggers | Existing `audit_logs` table + `create_audit_log()` trigger | Already handles status changes, approvals, assignments - just attach trigger |
| Role-based permissions | Custom middleware checks | Supabase RLS + existing helper functions (`get_user_role()`) | Permission matrix already implemented, follows project standard |
| TypeScript types | Hand-written types | `supabase gen types typescript` CLI command | Auto-generates accurate types from actual schema, prevents drift |

**Key insight:** This phase has 90% infrastructure already in place. Success comes from pattern reuse, not custom solutions.

## Common Pitfalls

### Pitfall 1: Race Condition Between Stock Check and Approval
**What goes wrong:** Two approvers simultaneously approve requests, both see sufficient stock, both approve, resulting in overselling
**Why it happens:** Stock check happens at query time, but approval updates happen later
**How to avoid:**
- Use BEFORE trigger that validates stock at moment of status change
- Validation happens in same transaction as UPDATE
- PostgreSQL MVCC ensures consistent read during transaction
**Warning signs:**
- Negative stock quantities appearing
- Approved quantities exceeding actual inventory

### Pitfall 2: Missing Approved Quantity on Approval
**What goes wrong:** Request status changes to 'approved' but `approved_quantity` remains NULL
**Why it happens:** Application forgets to set approved_quantity, only updates status
**How to avoid:**
```sql
-- Add CHECK constraint
ALTER TABLE stock_out_requests ADD CONSTRAINT approved_qty_required
  CHECK (
    status != 'approved' OR approved_quantity IS NOT NULL
  );
```
**Warning signs:** NULL approved quantities with approved status

### Pitfall 3: Forgetting to Attach Audit Trigger
**What goes wrong:** Stock-out request changes don't appear in audit logs
**Why it happens:** New table created but audit trigger not attached
**How to avoid:** Add to same migration that creates table, test with query:
```sql
-- Verification query
SELECT entity_type, COUNT(*)
FROM audit_logs
WHERE entity_type = 'stock_out_requests'
GROUP BY entity_type;
```
**Warning signs:** Zero audit_logs entries for stock_out_requests after creating test records

### Pitfall 4: RLS Policy Circular Dependency
**What goes wrong:** RLS policy on stock_out_requests tries to read stock_out_requests to check ownership
**Why it happens:** Policy needs to validate ownership but table has RLS enabled
**How to avoid:** Use `SECURITY DEFINER` helper function that bypasses RLS:
```sql
-- Helper function (SECURITY DEFINER bypasses RLS)
CREATE FUNCTION owns_stock_out_request(UUID) ... SECURITY DEFINER;

-- Policy uses helper, not direct table access
CREATE POLICY ... USING (owns_stock_out_request(id));
```
**Warning signs:** Infinite recursion errors, policy evaluation failures

### Pitfall 5: Wrong Status Transition Validation
**What goes wrong:** Approved request transitions back to pending, or rejected request gets approved
**Why it happens:** No validation on status transitions
**How to avoid:** Add trigger to validate state machine:
```sql
CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Once approved/rejected, cannot change status
  IF OLD.status IN ('approved', 'rejected') AND NEW.status != OLD.status THEN
    RAISE EXCEPTION 'Cannot change status from % to %', OLD.status, NEW.status;
  END IF;

  -- Can only cancel if pending
  IF NEW.status = 'cancelled' AND OLD.status != 'pending' THEN
    RAISE EXCEPTION 'Can only cancel pending requests';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
**Warning signs:** Illogical audit trail (approved → pending → approved)

## Code Examples

Verified patterns from official sources and existing codebase:

### Stock Validation RPC Function
```sql
-- Source: Pattern from 024_inventory_wac_trigger.sql lines 256-280
-- Reuse existing get_warehouse_stock() function
CREATE OR REPLACE FUNCTION get_warehouse_stock(
  p_item_id UUID,
  p_warehouse_id UUID
)
RETURNS DECIMAL(15,2) AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN movement_type = 'inventory_in' THEN quantity
        WHEN movement_type = 'inventory_out' THEN -quantity
      END
    ),
    0
  )
  FROM inventory_transactions
  WHERE item_id = p_item_id
    AND warehouse_id = p_warehouse_id
    AND status = 'completed'
    AND is_active = true;
$$ LANGUAGE sql STABLE;
```

### Approval Workflow RLS Policies
```sql
-- Source: Pattern from 027_rls_policies.sql
-- Admin can approve any request
-- Requester can view/cancel own pending requests
-- Inventory/Quartermaster roles can view all

CREATE POLICY stock_out_requests_select ON stock_out_requests
  FOR SELECT USING (
    get_user_role() IN ('admin', 'quartermaster', 'inventory')
    OR (get_user_role() = 'requester' AND requester_id = auth.uid())
  );

CREATE POLICY stock_out_requests_insert ON stock_out_requests
  FOR INSERT WITH CHECK (
    get_user_role() IN ('admin', 'quartermaster', 'inventory')
  );

CREATE POLICY stock_out_requests_update ON stock_out_requests
  FOR UPDATE USING (
    -- Admin can approve/reject any
    get_user_role() = 'admin'
    -- Requester can cancel own pending requests only
    OR (
      get_user_role() IN ('quartermaster', 'inventory')
      AND requester_id = auth.uid()
      AND status = 'pending'
      AND NEW.status = 'cancelled'
    )
  );
```

### Complete Table Schema with All Constraints
```sql
-- Stock Out Requests Table
CREATE TABLE stock_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request identification
  request_number TEXT UNIQUE, -- Auto-generated: SOR-YYYY-NNNNN

  -- Core request fields
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  requested_quantity DECIMAL(15,2) NOT NULL CHECK (requested_quantity > 0),
  approved_quantity DECIMAL(15,2) CHECK (approved_quantity > 0 AND approved_quantity <= requested_quantity),

  -- Workflow status
  status stock_out_request_status NOT NULL DEFAULT 'pending',
  reason stock_out_reason NOT NULL, -- Reuse existing enum
  notes TEXT,

  -- Approval tracking
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Link to QMHQ if request originated from QMHQ item route
  qmhq_id UUID REFERENCES qmhq(id) ON DELETE SET NULL,

  -- Snapshot fields (preserve item details at request time)
  item_name TEXT,
  item_sku TEXT,

  -- Audit fields
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE stock_out_requests ADD CONSTRAINT approved_qty_required
  CHECK (status != 'approved' OR approved_quantity IS NOT NULL);

ALTER TABLE stock_out_requests ADD CONSTRAINT rejected_reason_required
  CHECK (status != 'rejected' OR rejection_reason IS NOT NULL);

ALTER TABLE stock_out_requests ADD CONSTRAINT approved_by_required
  CHECK (status NOT IN ('approved', 'rejected') OR approved_by IS NOT NULL);

-- Indexes
CREATE INDEX idx_stock_out_requests_status ON stock_out_requests(status);
CREATE INDEX idx_stock_out_requests_item ON stock_out_requests(item_id);
CREATE INDEX idx_stock_out_requests_warehouse ON stock_out_requests(warehouse_id);
CREATE INDEX idx_stock_out_requests_requester ON stock_out_requests(requester_id);
CREATE INDEX idx_stock_out_requests_qmhq ON stock_out_requests(qmhq_id);
CREATE INDEX idx_stock_out_requests_is_active ON stock_out_requests(is_active) WHERE is_active = true;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct inventory_out | Approval workflow with request table | This phase (v1.6) | Prevents unauthorized stock depletion, enables approval audit trail |
| Application-level validation | Database trigger validation | Established pattern (v1.2) | Guarantees validation regardless of client, prevents race conditions |
| Manual audit logging | Generic trigger-based audit | v1.1 | Consistent audit format, automatic logging |

**Deprecated/outdated:**
- Hard delete: Soft delete with `is_active` is established pattern since v1.1
- Custom audit tables: Generic `audit_logs` table handles all entities since v1.1
- Application-only validation: Triggers enforce data integrity at DB level since v1.2

## Open Questions

1. **QMHQ Integration Strategy**
   - What we know: Stock-out requests can optionally link to QMHQ via `qmhq_id` FK
   - What's unclear: Should QMHQ item route status change to "done" auto-create stock-out request, or manual trigger?
   - Recommendation: Manual creation for Phase 27 (DB foundation only), defer auto-creation to Phase 28 (UI integration)

2. **Request Number Format**
   - What we know: Other entities use `TYPE-YYYY-NNNNN` format (QMRL, QMHQ, PO, INV)
   - What's unclear: Prefix for stock-out requests - `SOR-` (Stock Out Request) vs `STO-` (Stock Out) vs other
   - Recommendation: Use `SOR-YYYY-NNNNN` to match established pattern and distinguish from direct inventory_out

3. **Partial Approval UI Complexity**
   - What we know: Schema supports `approved_quantity` different from `requested_quantity`
   - What's unclear: How common will partial approval be? Worth UI complexity?
   - Recommendation: Schema supports it; Phase 28 can implement simple "Approve All" or "Approve Partial" UX

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `/supabase/migrations/015_purchase_orders.sql` - Approval status enum pattern
  - `/supabase/migrations/022_invoice_line_items.sql` - Quantity validation trigger pattern
  - `/supabase/migrations/024_inventory_wac_trigger.sql` - Stock validation with `get_warehouse_stock()`
  - `/supabase/migrations/026_audit_triggers.sql` - Generic audit trigger
  - `/supabase/migrations/027_rls_policies.sql` - RLS helper functions with SECURITY DEFINER
  - `/supabase/migrations/023_inventory_transactions.sql` - Stock movement enums and constraints
- Project documentation:
  - `/.planning/REQUIREMENTS.md` - v1.6 requirements (SOAR-01, SOAR-04, SOAR-09, SOAR-10, SOAR-11)
  - `/.planning/STATE.md` - Phase 27 considerations, prior decisions
  - `/CLAUDE.md` - Database conventions, audit patterns, financial rules

### Secondary (MEDIUM confidence)
- [Workflow Management Database Design](https://budibase.com/blog/data/workflow-management-database-design/) - Generic approval workflow patterns
- [Database Design for Workflow Management Systems - GeeksforGeeks](https://www.geeksforgeeks.org/dbms/database-design-for-workflow-management-systems/) - State machine design for workflows
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - RLS best practices
- [Custom Claims & Role-based Access Control (RBAC) | Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) - Role-based policies

### Tertiary (LOW confidence)
- [SELECT FOR UPDATE - Prevent Race Conditions](https://sqlfordevs.com/transaction-locking-prevent-race-condition) - Locking strategies (not needed due to trigger validation pattern)
- [Preventing Postgres SQL Race Conditions with SELECT FOR UPDATE](https://on-systems.tech/blog/128-preventing-read-committed-sql-concurrency-errors/) - Pessimistic locking (alternative approach, not chosen)
- [Using PostgreSQL advisory locks to avoid race conditions | FireHydrant](https://firehydrant.com/blog/using-advisory-locks-to-avoid-race-conditions-in-rails/) - Advisory locks (overkill for single-row validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using exact same stack as existing project
- Architecture: HIGH - Directly copying 5+ existing proven patterns from codebase
- Pitfalls: HIGH - Based on actual patterns used in invoice/PO validation (lines of code cited)

**Research date:** 2026-02-09
**Valid until:** 30 days (stable patterns, PostgreSQL/Supabase best practices)

**Pattern reuse rate:** 90% - Nearly all patterns exist in codebase:
- Approval status enum: `purchase_orders.sql`
- Quantity validation: `invoice_line_items.sql`
- Stock checking: `inventory_wac_trigger.sql`
- Audit integration: `audit_triggers.sql`
- RLS policies: `rls_policies.sql`

**New patterns:** 10%
- `requested_quantity` + `approved_quantity` schema (standard SQL pattern)
- Status transition validation (state machine constraint)
