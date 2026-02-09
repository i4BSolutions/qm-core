---
phase: 27-stock-out-approval-db-foundation
plan: 02
subsystem: database
tags: [validation, triggers, stock-out-approval, data-integrity]
dependency_graph:
  requires: ["27-01"]
  provides: ["stock-validation-rules", "status-transition-enforcement", "fulfillment-linkage"]
  affects: ["stock_out_line_items", "stock_out_approvals", "inventory_transactions"]
tech_stack:
  added: []
  patterns: ["cross-warehouse-validation", "over-execution-blocking", "auto-status-transition"]
key_files:
  created: ["supabase/migrations/053_stock_out_validation.sql"]
  modified: []
decisions:
  - "Creation and approval stock validation checks total across ALL warehouses, not per warehouse"
  - "Hard block on insufficient stock at both creation and approval time"
  - "Status transitions are final — approved/rejected line items cannot revert to pending"
  - "Only pending line items can be cancelled"
  - "Over-execution blocked: sum of fulfillment quantities cannot exceed approved quantity"
  - "Nullable FK approach for linking inventory_transactions to stock_out_approvals (simpler than junction table)"
metrics:
  duration: 106
  tasks_completed: 1
  files_created: 1
  completed_date: "2026-02-09"
---

# Phase 27 Plan 02: Stock Validation & Business Rules Summary

**One-liner:** Stock validation triggers enforcing cross-warehouse availability checks, status transition rules, and over-execution prevention with auto-status updates.

## Overview

Added comprehensive validation layer for stock-out approval workflow: hard blocks on insufficient stock at creation/approval, approval sum constraints, status transition enforcement, over-execution blocking, and auto-status computation based on fulfillments.

## Tasks Completed

### Task 1: Stock validation functions and creation/approval checks
**Status:** Complete
**Commit:** 277ea3f
**Files:** supabase/migrations/053_stock_out_validation.sql

**Implementation:**
- **get_total_item_stock()**: Cross-warehouse stock aggregation function summing all inventory_in/inventory_out movements
- **validate_sor_line_item_creation()**: BEFORE INSERT trigger blocking line item creation when requested_quantity > total available stock
- **validate_sor_approval()**: BEFORE INSERT trigger enforcing:
  - Sum of approved quantities for a line item must not exceed requested_quantity
  - Approved quantity must not exceed total available stock across all warehouses
- **update_line_item_status_on_approval()**: AFTER INSERT trigger auto-transitioning line item to 'approved' or 'rejected' based on approval decision
- **validate_sor_line_item_status_transition()**: BEFORE UPDATE trigger enforcing status flow:
  - approved -> partially_executed -> executed (only)
  - rejected/cancelled are terminal
  - Only pending can be cancelled
- **ALTER TABLE inventory_transactions**: Added stock_out_approval_id UUID FK (nullable) linking fulfillment events to approvals
- **validate_sor_fulfillment()**: BEFORE INSERT/UPDATE trigger on inventory_transactions blocking over-execution:
  - Sum of fulfilled quantities cannot exceed approved_quantity
  - Cannot fulfill rejected approvals
- **update_sor_line_item_execution_status()**: AFTER INSERT/UPDATE trigger auto-updating line item status:
  - approved -> partially_executed when first fulfillment recorded
  - partially_executed -> executed when total fulfilled >= total approved

## Technical Highlights

### Cross-Warehouse Validation Pattern
```sql
-- Validates against total stock across ALL warehouses
SELECT COALESCE(SUM(
  CASE
    WHEN movement_type = 'inventory_in' THEN quantity
    WHEN movement_type = 'inventory_out' THEN -quantity
    ELSE 0
  END
), 0) FROM inventory_transactions
WHERE item_id = p_item_id AND is_active = true AND status = 'completed'
```

### Status State Machine Enforcement
```
pending -> approved -> partially_executed -> executed
       \-> rejected (terminal)
       \-> cancelled (only from pending, terminal)
```

### Over-Execution Prevention
```sql
-- Blocks fulfillment when sum exceeds approved amount
IF (total_executed + NEW.quantity) > approval_qty THEN
  RAISE EXCEPTION 'Over-execution blocked. Approved: %, Already executed: %, Attempting: %'
```

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

Manual verification completed (local Supabase not running):
- Migration structure validated: 5 functions, 6 triggers, 1 ALTER TABLE
- Key patterns confirmed:
  - Cross-warehouse total stock function exists
  - Approval sum validation: `(total_already_approved + NEW.approved_quantity) > li_requested_quantity`
  - FK linkage: `stock_out_approval_id UUID REFERENCES stock_out_approvals(id) ON DELETE SET NULL`
  - Status transition enforcement with RAISE EXCEPTION for invalid transitions
  - Over-execution blocking with three-part error message
- All must_have truths implemented:
  - Creation blocked when total stock < requested_quantity ✓
  - Approval blocked when total stock < approved_quantity ✓
  - Sum of approved quantities <= requested_quantity ✓
  - Sum of fulfillments <= approved_quantity ✓
  - Status cannot revert from approved/rejected ✓
  - Only pending can be cancelled ✓
  - inventory_transactions links to approvals via FK ✓
  - Fulfillment blocked when warehouse stock insufficient (handled by existing 024 trigger) ✓

## Next Steps

Proceed to plan 27-03 (RLS & Audit) to add authorization policies and audit trail for stock-out approval workflow.

## Self-Check: PASSED

**Files created:**
- FOUND: supabase/migrations/053_stock_out_validation.sql

**Commits:**
- FOUND: 277ea3f
