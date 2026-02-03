# Feature Landscape: PO Smart Lifecycle

**Domain:** Purchase Order Three-Way Matching and Lifecycle Management
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

This research covers the feature landscape for PO smart lifecycle management — specifically the three-way matching features (PO ↔ Invoice ↔ Goods Receipt) needed to automatically calculate PO status and provide visual progress tracking. The system already has basic PO, Invoice, and Stock-in functionality; this milestone adds the "smart" layer that ties them together.

**Key Finding:** Three-way matching is table stakes in modern procurement systems, but the visual presentation and lock mechanisms are differentiators. The QM System's user-defined status rules (Partially Invoiced takes priority over Partially Received) are non-standard but intentional.

---

## Table Stakes

Features users expect in ANY procurement system with three-way matching. Missing these = system feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Three-Way Quantity Matching** | Core procurement control — prevents payment errors and fraud | Medium | PO line items, Invoice line items, Stock-in transactions | Already have all data; need calculation logic |
| **Auto-Calculated PO Status** | Manual status management = error-prone; automation expected in 2026 | Medium | Three-way matching logic | User-defined rules already specified in PRD |
| **Status Priority Rules** | When PO is both partially invoiced AND partially received, need deterministic status | Low | Status calculation | PRD specifies: Partially Invoiced > Partially Received |
| **Quantity Availability Display** | Users need to see "Available to Invoice" (Ordered - Already Invoiced) | Low | PO line items, existing invoices | UI display logic only |
| **PO Closure Detection** | System must recognize when PO = Invoice = Stock-in for ALL line items | Medium | Three-way matching aggregation | "Closed" means ALL lines fully matched |
| **Lock on Closed PO** | Closed POs must be read-only to prevent data corruption | Low | PO status detection | Already block invoice creation; extend to edits |
| **Admin Override/Reopen** | Business reality: sometimes need to reopen closed POs (vendor credit, returns) | Low | Role-based permissions | Admin-only action |
| **Voided Invoice Exclusion** | Voided invoices must not count toward matching calculations | Low | Invoice void flag | Already have is_voided; ensure excluded in queries |

**MVP Recommendation:** ALL table stakes features required. Three-way matching without these feels broken or incomplete.

**Sources:**
- [3-Way Invoice Matching in Accounts Payable](https://start.docuware.com/blog/document-management/3-way-invoice-matching)
- [What is a 3-Way Match? How It Works in the AP Process](https://tipalti.com/resources/learn/3-way-match/)
- [What Is Three-Way Matching & Why Is It Important? | NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml)

---

## Differentiators

Features that set the QM System apart. Not expected, but provide competitive advantage or better UX.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Visual Matching Panel** | Side-by-side PO vs Invoice vs Stock comparison makes discrepancies obvious at a glance | Medium | Three-way data aggregation, UI design | Standard ERP systems hide this in reports |
| **Progress Bar with %** | Shows completion toward "Closed" status visually — avoids status confusion | Low | Percentage calculation | Modern UX pattern (2026 trend) |
| **Line-Level Matching Detail** | Drill down from PO-level to line-item-level matching shows WHICH items are behind | Medium | Line-item aggregation queries | Most systems only show PO-level totals |
| **Real-Time Status Updates** | Status updates immediately when invoice/stock-in created (not batch nightly) | Low | Database triggers | Modern expectation vs legacy batch processing |
| **Color-Coded Variance Indicators** | Red/yellow/green indicators for over/under/matched quantities | Low | Threshold logic | Visual clarity for discrepancies |
| **User-Defined Status Rules** | Status rules in PRD (Partially Invoiced > Partially Received) are business-specific | Low | Configuration via PRD | Most systems have fixed status logic |
| **Status History Timeline** | Shows when PO transitioned through statuses (Not Started → Partially Invoiced → Closed) | Medium | Audit log integration | Visibility into lifecycle progression |
| **Multiple Partial Invoices** | System already supports multiple invoices per PO; matching panel shows ALL invoices | Low | Existing multi-invoice support | Many simple systems only allow 1:1 PO:Invoice |

**MVP Recommendation for Milestone:**
1. Visual Matching Panel (HIGH priority — most visible feature)
2. Progress Bar (MEDIUM — nice UX, low complexity)
3. Line-Level Matching Detail (MEDIUM — needed for debugging discrepancies)

**Defer to future:**
- Status History Timeline (can use existing History tab)
- Color-coded variance indicators (polish feature)

**Sources:**
- [Procurement Dashboards: Examples & KPIs to Track (2026)](https://www.superblocks.com/blog/procurement-dashboard)
- [Purchase order overview - Supply Chain Management | Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-overview)
- [Matching Purchase Order Receipts with Invoices](https://erp-core.premierinc.com/ematerials/help/Procedures/MatchPOandInvoice.htm)

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain or scope creep risks.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automatic PO Closure** | Business reality: discrepancies happen (damaged goods, partial shipments). Auto-closing prevents resolution. | Admin-triggered closure with confirmation dialog |
| **Edit Invoices After Stock-In** | Breaks three-way matching integrity — changing invoice after goods received creates audit nightmare | Block edits; require void + recreate invoice |
| **Four-Way Matching (+ Payment)** | Adds payment tracking complexity; QM System scope is procurement, not AP payment processing | Stop at three-way matching; payment out of scope |
| **Automated Discrepancy Resolution** | AI/ML to "fix" mismatches sounds smart but dangerous — wrong qty/price corrections = financial errors | Flag discrepancies; require human review |
| **Line Item Reordering After Invoicing** | Allowing PO line item changes after partial invoicing breaks line-item-level matching | Lock PO line items once first invoice created |
| **Tolerance-Based Auto-Approval** | "Auto-approve invoices within 5% of PO" bypasses matching control — defeats the purpose | Always show discrepancies; optional workflow approval |
| **Over-Invoicing Prevention at DB Level** | Strict DB constraint prevents invoice creation if qty > available, but breaks legitimate overages (e.g., supplier sends extra) | Validate in UI; allow with approval/override |
| **Historical Status Snapshots** | Storing PO status at every change = complex data model; audit log already captures this | Use audit log for status history; calculated field for current status |

**Rationale:**
- **Automatic PO Closure:** Research shows ERP systems require manual closure for exactly this reason — see [Closing and Reopening Purchase Orders](https://support.infor.com/esknowbase/root/DLPublic/10884/ch12.pdf)
- **Four-Way Matching:** QM System PRD explicitly scopes to procurement; payment tracking belongs in future AP module
- **Tolerance-Based Auto-Approval:** Defeats fraud prevention purpose of three-way matching per [Best Practices for 2-way and 3-way Match](https://optisconsulting.com/best-practices-for-2-way-and-3-way-match/)

**Sources:**
- [Closing and Reopening Purchase Orders 12-1](https://support.infor.com/esknowbase/root/DLPublic/10884/ch12.pdf)
- [Best Practices for 2-way and 3-way Match | Optis Consulting](https://optisconsulting.com/best-practices-for-2-way-and-3-way-match/)
- [3-Way Invoice Matching Explained: Process, Benefits, and Best Practices](https://www.zintego.com/blog/3-way-invoice-matching-explained-process-benefits-and-best-practices/)

---

## Feature Dependencies

```
Three-Way Matching Calculation (core)
  ├── Auto-Calculated PO Status ← depends on matching logic
  │     ├── Status Priority Rules
  │     └── Closed Status Detection
  ├── Visual Matching Panel ← depends on matching data
  │     ├── Line-Level Matching Detail
  │     └── Progress Bar
  └── Lock Mechanism ← depends on status detection
        └── Admin Reopen ← depends on lock mechanism
```

**Critical Path:** Three-way matching calculation must be implemented first. All other features depend on having accurate PO/Invoice/Stock-in aggregation.

**Sequence Recommendation:**
1. Three-Way Matching Logic (database queries + views)
2. Auto-Calculated PO Status (status calculation function)
3. Lock on Closed PO (prevent edits when status = 'closed')
4. Visual Matching Panel (UI to display matching data)
5. Progress Bar (UI enhancement)
6. Admin Reopen (administrative override)

---

## Existing Features (Already Built)

The QM System already has these features implemented, which provide the foundation for smart lifecycle:

| Feature | Status | Notes |
|---------|--------|-------|
| PO Creation with Line Items | ✅ Built | `purchase_orders` + `po_line_items` tables |
| Invoice Creation with Quantity Validation | ✅ Built | Multi-step wizard, qty <= available enforced |
| Stock-In from Invoices | ✅ Built | `inventory_transactions` with invoice_id reference |
| Manual Stock-In | ✅ Built | Stock-in without invoice for manual purchases |
| PO Status Enum | ✅ Built | All 6 statuses defined in schema |
| Invoice Void | ✅ Built | `is_voided` flag with void metadata |
| Block Invoice for Closed PO | ✅ Built | Database trigger prevents new invoices |
| Basic PO Detail Page | ✅ Built | Shows PO header + line items |

**Gap:** Status is currently a user-selected field, not auto-calculated. This milestone makes it "smart."

---

## Feature Complexity Assessment

| Feature Category | Complexity | Estimated Effort | Risk Level |
|------------------|-----------|------------------|------------|
| Three-Way Matching Logic | Medium | 3-5 days | Medium — SQL aggregation across 3 tables |
| Status Calculation | Medium | 2-3 days | Low — clear business rules from PRD |
| Lock Mechanism | Low | 1 day | Low — conditional logic in UI/API |
| Visual Matching Panel | Medium | 3-4 days | Low — UI work, data is available |
| Progress Bar | Low | 0.5 days | Low — simple percentage display |
| Line-Level Detail | Medium | 2-3 days | Low — drill-down queries |

**Total Estimated Effort:** 11-16 days (2-3 weeks)

**Highest Risk:** Three-way matching aggregation queries — need to handle:
- Multiple invoices per PO
- Partial invoicing (invoice qty < PO qty)
- Partial receiving (stock-in qty < invoice qty)
- Voided invoices (excluded from calculations)
- Multiple stock-in transactions per invoice line

**Mitigation:** Create database views for aggregation; test with complex scenarios (3 invoices, 2 partial stock-ins, 1 voided invoice).

---

## User Stories

### US-1: View Matching Status at a Glance
**As a** Finance user
**I want to** see PO vs Invoice vs Stock-in quantities side-by-side
**So that** I can quickly identify discrepancies without manual calculation

**Acceptance Criteria:**
- Matching panel shows three columns: PO Qty | Invoiced Qty | Received Qty
- Each line item shows individual quantities
- PO-level totals shown at bottom
- Visual indicators for matched/unmatched status

### US-2: Understand PO Completion Progress
**As a** Proposal user
**I want to** see a progress bar showing how close a PO is to closure
**So that** I can prioritize follow-up with suppliers on delayed deliveries

**Acceptance Criteria:**
- Progress bar shows percentage toward "Closed" status
- Percentage based on: (total received qty / total ordered qty) × 100
- Shows on PO detail page and PO card view
- Updates in real-time when invoice/stock-in created

### US-3: Prevent Changes to Closed POs
**As a** Finance user
**I want** closed POs to be read-only
**So that** historical procurement records remain accurate and auditable

**Acceptance Criteria:**
- Edit button hidden when status = 'closed'
- API blocks edits to closed POs
- Admin can reopen via "Reopen PO" action
- Lock icon displayed on closed PO detail page

### US-4: Drill Down to Line-Level Discrepancies
**As a** Inventory user
**I want to** see line-item-level matching details
**So that** I can identify WHICH items are behind schedule

**Acceptance Criteria:**
- Click on PO-level matching panel opens line-item detail
- Each line shows: Item | PO Qty | Invoiced Qty | Received Qty | Status
- Filter by: Fully Matched | Partially Invoiced | Not Invoiced | Partially Received
- Export to CSV for reporting

---

## Open Questions for Implementation

1. **Status Calculation Trigger:** Database trigger vs application layer?
   - **Recommendation:** Database trigger for data integrity; application recalculates on display for performance

2. **Progress Bar Metric:** Based on invoicing progress or receiving progress?
   - **Recommendation:** Receiving progress (actual goods in warehouse matters more than paperwork)

3. **Admin Reopen Requirements:** What validations needed?
   - **Recommendation:** Require reason for reopening (text field); log in audit trail

4. **Lock Scope:** Lock entire PO or just line items?
   - **Recommendation:** Lock entire PO (header + line items); prevent any edits when closed

5. **Multiple Warehouses:** Stock-in can go to different warehouses — how to aggregate?
   - **Recommendation:** Sum across all warehouses for matching calculation (PO doesn't specify warehouse)

---

## Success Metrics

**Feature Adoption:**
- % of POs that reach "Closed" status (target: >80% within 30 days of creation)
- Time to closure (median days from PO creation to Closed status)

**User Behavior:**
- % of users who click on Matching Panel (measures engagement)
- % of closed POs reopened by Admin (should be <5% — indicates initial closure was correct)

**System Accuracy:**
- Zero instances of invoice creation on closed PO (enforced by DB trigger)
- Zero instances of status calculation errors (monitored via QA testing)

---

## Sources Referenced

### Three-Way Matching Best Practices
- [3-Way Invoice Matching in Accounts Payable](https://start.docuware.com/blog/document-management/3-way-invoice-matching)
- [Best Practices for 2-way and 3-way Match | Optis Consulting](https://optisconsulting.com/best-practices-for-2-way-and-3-way-match/)
- [Streamlining Inventory Purchasing: 3-Way Purchase Order Matching 101](https://www.settle.com/blog/3-way-purchase-order-matching-101)
- [What is a 3-Way Match? How It Works in the AP Process](https://tipalti.com/resources/learn/3-way-match/)
- [What Is Three-Way Matching & Why Is It Important? | NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/three-way-matching.shtml)
- [3-Way Invoice Matching Explained: Process, Benefits, and Best Practices](https://www.zintego.com/blog/3-way-invoice-matching-explained-process-benefits-and-best-practices/)

### PO Lifecycle Management
- [The Procurement Lifecycle: 7 Stages Explained](https://ramp.com/blog/procurement-process-lifecycle)
- [How PO Lifecycle Visibility Reduces Supply Chain Risk | Epicor](https://www.epicor.com/en-us/blog/supply-chain-management/how-po-lifecycle-visibility-reduces-supply-chain-risk/)
- [Top 10 Purchase Order Management Tools in 2026](https://zapro.ai/procurement/purchase-order-management-tools/)

### Visual Design and Dashboard Trends
- [Procurement Dashboards: Examples & KPIs to Track (2026)](https://www.superblocks.com/blog/procurement-dashboard)
- [Purchase order overview - Supply Chain Management | Dynamics 365](https://learn.microsoft.com/en-us/dynamics365/supply-chain/procurement/purchase-order-overview)
- [Matching Purchase Order Receipts with Invoices](https://erp-core.premierinc.com/ematerials/help/Procedures/MatchPOandInvoice.htm)

### Lock Mechanisms and PO Closure
- [Unlock Purchase Order (MUPO)](https://docs.oracle.com/cd/E95327_01/oroms/pdf/5/cws_help/MUPO.htm)
- [Use ERP Purchase Order Functionality to Support the GL Period Close](https://www.velosio.com/blog/use-erp-purchase-order-functionality-to-support-the-gl-period/)
- [What happens if a purchase order is closed?](https://docs.oracle.com/en/cloud/saas/procurement/25b/oaprc/what-happens-if-a-purchase-order-is-closed.html)
- [Closing and Reopening Purchase Orders 12-1](https://support.infor.com/esknowbase/root/DLPublic/10884/ch12.pdf)

### Partial Invoicing and Receiving
- [Solved: Process for receiving partial items on a PO](https://quickbooks.intuit.com/learn-support/en-us/reports-and-accounting/process-for-receiving-partial-items-on-a-po-applying-partial/00/1288482)
- [How to partially receive products on a purchase order](https://www.inflowinventory.com/support/cloud/how-do-i-partially-receive-products-on-a-purchase-order-in-inflow-cloud)
- [Processing Partial Payments against Purchase Orders](https://finance.utoronto.ca/knowledgecentre/processing-partial-payments-against-purchase-orders/)
