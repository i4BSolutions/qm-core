# Phase 8: Database Foundation - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Database layer supports currency-aware WAC calculation and invoice void cascades. This phase establishes constraints, triggers, and audit logging for financial accuracy. UI for manual stock-in and inventory dashboard are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Void Cascade Behavior
- Invoices with stock-in transactions CANNOT be voided (hard block)
- Invoices without stock-in CAN be voided
- Void requires a reason (mandatory field)
- Only Admin role can void invoices (for now)
- No time limit on voiding — any eligible invoice can be voided regardless of age
- Voiding is permanent — no "unvoid" capability
- PO status recalculates automatically (no manual close/reopen — status is derived from quantities)
- Cascade effects: PO status recalculates, Balance in Hand releases committed funds
- Notification: In-app only, notify PO creator when invoice is voided
- Confirmation: Simple "Are you sure?" dialog (no impact preview)
- All cascade effects happen in same database transaction (atomic)

### Audit Logging Detail
- Single audit entry per void (not separate entries per effect)
- Log includes ALL cascade effects in one record: void action, PO status change, Balance in Hand change
- Both old and new values captured (before/after format)
- Human-readable summary included (e.g., "John voided Invoice INV-2026-00001, releasing 50,000 MMK to Balance in Hand")
- Audit trail visible on Invoice History tab only

### Currency Validation Rules
- Allowed currencies: USD, MMK, CNY, THB (hardcoded enum)
- No exchange rate bounds — accept any positive rate
- Exchange rate required for non-USD currencies; USD always has rate = 1.0
- Exchange rate precision: 2 decimal places (DECIMAL(10,2))
- Base currency for EUSD configurable via environment variable (default USD)
- No default currency — user must explicitly select currency each time

### Error Handling Strategy
- All-or-nothing: void cascade rolls back entirely if any step fails
- Database constraint violations show friendly message + expandable technical details
- Block message when void denied: "Cannot void: inventory has been received against this invoice"
- Only successful operations logged — failed/rolled-back operations not in audit trail

### Claude's Discretion
- Specific trigger implementation approach
- SECURITY DEFINER function structure
- In-app notification mechanism (bell icon, toast, etc.)
- Technical error message formatting

</decisions>

<specifics>
## Specific Ideas

- Stock-in existence check must be efficient (index on invoice_id in inventory transactions)
- Void cascade should use SECURITY DEFINER to ensure trigger can update related tables
- Notification system may need a new notifications table if not already present

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-database-foundation*
*Context gathered: 2026-01-30*
