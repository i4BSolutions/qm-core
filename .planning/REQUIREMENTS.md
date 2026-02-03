# Requirements: v1.4 PO Smart Lifecycle

## Summary

This milestone fixes PO status calculation to use true three-way matching (PO <-> Invoice <-> Stock-in) and adds visual lifecycle components including a matching panel, progress bar, and lock mechanism.

## Requirements

### Database & Calculation (DB)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| DB-01 | Stock-in triggers update `invoice_line_items.received_quantity` | Must | Missing cascade piece |
| DB-02 | Invoice line triggers update `po_line_items.received_quantity` | Must | Missing cascade piece |
| DB-03 | PO status calculated from three-way match (PO qty = Invoice qty = Stock-in qty) | Must | Existing trigger, needs data |
| DB-04 | Voided invoices excluded from all matching calculations | Must | Consistency requirement |
| DB-05 | Trigger guards prevent infinite recursion | Must | Use `pg_trigger_depth()` |
| DB-06 | Race condition protection with row-level locking | Must | Use `FOR UPDATE` |

### Status Rules (SR)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| SR-01 | Not Started: No invoices AND no stock-in | Must | Initial state |
| SR-02 | Partially Invoiced: Some items invoiced (takes priority over Partially Received) | Must | User-specified priority rule |
| SR-03 | Awaiting Delivery: Fully invoiced, not fully received | Must | Intermediate state |
| SR-04 | Partially Received: Some goods received (lower priority than Partially Invoiced) | Must | User-specified priority rule |
| SR-05 | Closed: PO.qty = Invoice.qty = Stock-in.qty for ALL line items | Must | Three-way match complete |
| SR-06 | Cancelled: PO was cancelled | Must | Terminal state |

### Visual Matching Panel (VMP)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| VMP-01 | Three-column layout: PO qty | Invoiced qty | Received qty | Must | Side-by-side comparison |
| VMP-02 | Line-level detail for each PO line item | Must | Drill-down capability |
| VMP-03 | Color coding: amber = invoiced, emerald = received | Should | Visual clarity |
| VMP-04 | Collapsible accordion for detailed view | Should | Clean UI |
| VMP-05 | Available quantity display (Ordered - Invoiced) | Must | Users need this |
| VMP-06 | Multiple partial invoices shown | Must | System supports split invoices |

### Progress Bar (PB)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| PB-01 | Show percentage completion toward "Closed" status | Must | User requested |
| PB-02 | Dual bars: invoiced % and received % | Should | Existing pattern |
| PB-03 | Legend explaining bar segments | Should | UX improvement |
| PB-04 | Mismatch highlighting when variances exist | Should | Visual clarity |

### Lock Mechanism (LM)

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| LM-01 | Block edits when PO status = Closed | Must | User specified |
| LM-02 | Lock enforced at database trigger level (not just UI) | Must | Prevent bypass |
| LM-03 | Admin role can override lock | Must | Business reality |
| LM-04 | Visual lock indicator badge on PO detail | Must | User awareness |
| LM-05 | Alert banner explaining locked state | Should | UX clarity |
| LM-06 | Reopen functionality for Admin with reason required | Should | Business need |

## Out of Scope

- Four-way matching (+ Payment) — QM System scope is procurement, not AP
- Automatic PO closure without confirmation — Business reality requires review
- Tolerance-based auto-approval — Defeats fraud prevention purpose
- Edit invoices after stock-in — Breaks integrity; use void + recreate
- Real-time WebSocket updates — Polling/refresh sufficient for MVP

## Dependencies

- Existing `calculate_po_status()` function in migration 016
- Existing `po_line_items.invoiced_quantity` and `received_quantity` columns
- Existing `POProgressBar` component
- Existing `canEditPO()` utility in `lib/utils/po-status.ts`

## Success Criteria

1. PO status accurately reflects three-way match state
2. Matching panel displays correct quantities for PO, Invoice, and Stock-in
3. Progress bar shows meaningful completion percentage
4. Closed POs cannot be edited (except by Admin)
5. All existing tests pass
6. No trigger recursion or race condition issues

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 17 | Pending |
| DB-02 | Phase 17 | Pending |
| DB-03 | Phase 17 | Pending |
| DB-04 | Phase 17 | Pending |
| DB-05 | Phase 17 | Pending |
| DB-06 | Phase 17 | Pending |
| SR-01 | Phase 17 | Pending |
| SR-02 | Phase 17 | Pending |
| SR-03 | Phase 17 | Pending |
| SR-04 | Phase 17 | Pending |
| SR-05 | Phase 17 | Pending |
| SR-06 | Phase 17 | Pending |
| VMP-01 | Phase 18 | Pending |
| VMP-02 | Phase 18 | Pending |
| VMP-03 | Phase 18 | Pending |
| VMP-04 | Phase 18 | Pending |
| VMP-05 | Phase 18 | Pending |
| VMP-06 | Phase 18 | Pending |
| PB-01 | Phase 19 | Pending |
| PB-02 | Phase 19 | Pending |
| PB-03 | Phase 19 | Pending |
| PB-04 | Phase 19 | Pending |
| LM-01 | Phase 19 | Pending |
| LM-02 | Phase 19 | Pending |
| LM-03 | Phase 19 | Pending |
| LM-04 | Phase 19 | Pending |
| LM-05 | Phase 19 | Pending |
| LM-06 | Phase 19 | Pending |

---
*Requirements defined: 2026-02-03*
*Based on research: .planning/research/SUMMARY.md*
*Traceability added: 2026-02-03*
