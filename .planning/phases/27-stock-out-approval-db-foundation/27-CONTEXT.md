# Phase 27: Stock-Out Approval DB Foundation - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema, triggers, RLS policies, and validation functions for a stock-out request/approval workflow. This phase creates the data layer only — UI comes in Phase 28. The schema supports a 4-level entity hierarchy: Request → Line Items → Approvals → Fulfillments (inventory_out transactions).

</domain>

<decisions>
## Implementation Decisions

### Approval Workflow Rules
- Only **admin** role can approve or reject stock-out requests
- **Partial approval** supported: approver can set approved_quantity <= requested_quantity per line item
- **Multiple approvals per line item**: a single line item can receive multiple approvals over time, each for a portion of the total (sum of all approvals <= requested qty)
- Approval/rejection is **final** — no reverting to pending after decision
- **Requester can cancel** own pending requests (only while status is 'pending')
- Once approved, **cannot be cancelled** by admin — stays approved
- **No expiry** on approved requests — valid indefinitely until executed
- **Partial execution** allowed: multiple stock-out events can fulfill one approval from different warehouses/dates
- **Mandatory rejection reason** when admin rejects
- Approval grants permission only — user **manually executes** stock-out (no auto-execution)
- Status flow per line item: pending → approved/rejected/cancelled → partially_executed → executed
- SOR request status is **computed from line items** (not independently managed)

### Stock Validation Behavior
- **Creation time**: hard block if total stock across ALL warehouses < requested quantity
- **Approval time**: hard block if total stock across ALL warehouses < approved quantity
- **Fulfillment time**: hard block if specific warehouse stock < fulfillment quantity
- Stock check uses **raw stock only** — does not subtract pending/approved-but-not-yet-executed quantities from other requests
- **Over-execution blocked**: sum of executed stock-out events for an approval must not exceed approved_quantity

### QMHQ Integration Strategy
- Stock-out request created **manually** — user clicks 'Request Stock-Out' button on QMHQ detail page
- **One QMHQ → One stock-out request** (1:1 relationship)
- Request quantity **pre-filled with QMHQ quantity** (user can adjust)
- QMHQ-linked SOR always has **exactly one line item** (QMHQ item route = one item)
- **Standalone SORs** can exist without QMHQ link (e.g., damage, lost, adjustment)
- Standalone SORs can have **multiple line items**
- User **chooses reason** for both QMHQ-linked and standalone requests (same reason options)
- Valid reasons: same as current stock-out reasons (request, consumption, damage, lost, transfer, adjustment)

### Request Data Model
- Request number format: **SOR-YYYY-NNNNN**
- Approval number format: **SOR-001-A01, SOR-001-A02** (sequential suffix per request)
- **Snapshot item name and SKU** on line item at creation time
- Fulfillments link to **existing inventory_transactions** (no separate fulfillment entity)
- **Reason** is per SOR request (all items share same reason)
- **Notes** is per SOR request (not per line item)
- Entity hierarchy: SOR Request → SOR Line Items → SOR Approvals → inventory_transactions (fulfillments)
- Request who can create: **Inventory + Quartermaster + Admin** roles only

### Claude's Discretion
- FK linking strategy between inventory_transactions and stock_out_approvals (nullable FK vs junction table)
- Exact trigger implementation for computed SOR status
- Index strategy for performance
- Exact CHECK constraints for status transitions
- Audit trigger attachment pattern

</decisions>

<specifics>
## Specific Ideas

- The flow follows: QMRL → QMHQ (item route) → SOR (one per QMHQ) → Approvals (multiple per line item) → Stock-Out Events (multiple per approval, from different warehouses)
- Approval numbers use parent SOR prefix: SOR-2026-00001-A01, SOR-2026-00001-A02
- Status computation from line items mirrors the PO smart status pattern (computed from invoice/receipt state)
- Stock validation at creation and approval uses total stock across ALL warehouses since warehouse is only decided at fulfillment time

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-stock-out-approval-db-foundation*
*Context gathered: 2026-02-09*
